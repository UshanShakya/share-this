import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { Profile } from '../types/user';

WebBrowser.maybeCompleteAuthSession();

export const useAuth = () => {
  const {
    session,
    profile,
    isLoading,
    error,
    setSession,
    setProfile,
    setLoading,
    setError,
    clearError,
  } = useAuthStore();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to fetch user profile from profiles table
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        // If profile doesn't exist (PGRST116), dynamically create it with a preset avatar fallback
        if (profileError.code === 'PGRST116') {
          const presetSeeds = ['Felix', 'Aneka', 'Jack', 'Buster', 'Cody', 'Daisy', 'Sasha', 'Oliver', 'Milo', 'Rocky', 'Ginger', 'Toby'];
          const randomSeed = presetSeeds[Math.floor(Math.random() * presetSeeds.length)];
          const randomAvatarUrl = `https://api.dicebear.com/7.x/bottts/png?seed=${randomSeed}`;
          
          const defaultUsername = 'user_' + Math.random().toString(36).substring(2, 10);
          
          // Get metadata displayName if available (e.g. from Google oauth metadata)
          const { data: { user: authUser } } = await supabase.auth.getUser();
          const googleDisplayName = authUser?.user_metadata?.display_name || authUser?.user_metadata?.full_name || authUser?.user_metadata?.name;
          const finalDisplayName = googleDisplayName || 'User_' + userId.substring(0, 8);

          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .upsert({
              id: userId,
              username: defaultUsername,
              display_name: finalDisplayName,
              avatar_url: randomAvatarUrl,
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (createError) {
            console.error('[fetchProfile] Failed to create fallback profile:', createError.message);
            return null;
          }
          return newProfile as Profile;
        }
        throw profileError;
      }

      // If avatar_url is null or empty, or is not in our preset list, re-assign a random preset avatar
      const presetSeeds = ['Felix', 'Aneka', 'Jack', 'Buster', 'Cody', 'Daisy', 'Sasha', 'Oliver', 'Milo', 'Rocky', 'Ginger', 'Toby'];
      const hasPresetAvatar = data.avatar_url && presetSeeds.some(seed => data.avatar_url?.includes(`seed=${seed}`));
      
      if (data && (!data.avatar_url || !hasPresetAvatar)) {
        const randomSeed = presetSeeds[Math.floor(Math.random() * presetSeeds.length)];
        const randomAvatarUrl = `https://api.dicebear.com/7.x/bottts/png?seed=${randomSeed}`;
        
        // Update database asynchronously without blocking the UI thread
        supabase
          .from('profiles')
          .update({ avatar_url: randomAvatarUrl })
          .eq('id', userId)
          .then(({ error: updateErr }) => {
            if (updateErr) {
              console.warn('[fetchProfile] Failed to assign default avatar:', updateErr.message);
            }
          });
        
        return {
          ...data,
          avatar_url: randomAvatarUrl,
        } as Profile;
      }

      return data as Profile;
    } catch (err: any) {
      console.error('Error fetching profile:', err.message || err);
      return null;
    }
  };

  // Sign Up with Email and Password
  const signUp = async (email: string, password: string, username: string, displayName: string) => {
    setIsSubmitting(true);
    clearError();
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            display_name: displayName,
          },
        },
      });

      if (signUpError) throw signUpError;
      
      const user = data.user;
      if (!user) throw new Error('User creation failed.');

      // Wait, standard trigger in Supabase can auto-create the profile.
      // If it doesn't, we can insert it manually. We'll implement a fallback insert here:
      const { error: insertError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: username.toLowerCase().trim(),
          display_name: displayName.trim(),
          avatar_url: null,
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.warn('Profile insert failed or was already handled by trigger:', insertError.message);
      }

      const userProfile = await fetchProfile(user.id);
      setProfile(userProfile);
      if (data.session) {
        setSession(data.session);
      }
      return { success: true };
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration.');
      return { success: false, error: err.message };
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sign In with Email and Password
  const signIn = async (email: string, password: string) => {
    setIsSubmitting(true);
    clearError();
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      const user = data.user;
      if (!user) throw new Error('User sign in failed.');

      const userProfile = await fetchProfile(user.id);
      setProfile(userProfile);
      setSession(data.session);
      return { success: true };
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
      return { success: false, error: err.message };
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sign In with Google OAuth
  const signInWithGoogle = async () => {
    setIsSubmitting(true);
    clearError();
    try {
      const redirectUrl = Linking.createURL('/');

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (oauthError) {
        console.error('[signInWithGoogle] Supabase OAuth Init Error:', oauthError);
        throw oauthError;
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (result.type === 'success' && result.url) {
          const parsed = Linking.parse(result.url);

          const access_token = (parsed.queryParams?.access_token || parsed.queryParams?.['#access_token']) as string | undefined;
          const refresh_token = (parsed.queryParams?.refresh_token || parsed.queryParams?.['#refresh_token']) as string | undefined;
          
          if (access_token && refresh_token) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (sessionError) {
              console.error('[signInWithGoogle] setSession Error:', sessionError);
              throw sessionError;
            }
            
            const { data: { user: sessionUser }, error: getUserError } = await supabase.auth.getUser();
            
            if (getUserError) {
              console.error('[signInWithGoogle] getUser Error:', getUserError);
            }

            if (sessionUser) {
              const userProfile = await fetchProfile(sessionUser.id);
              setProfile(userProfile);
            }
            return { success: true };
          } else {
            console.warn('[signInWithGoogle] Missing tokens in parsed parameters.');
          }
        }
      }
      return { success: false };
    } catch (err: any) {
      console.error('[signInWithGoogle] Fatal OAuth Error:', err);
      setError(err.message || 'Google Sign-In failed.');
      return { success: false, error: err.message };
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sign Out
  const signOut = async () => {
    setLoading(true);
    clearError();
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      
      setSession(null);
      setProfile(null);
    } catch (err: any) {
      setError(err.message || 'Failed to sign out.');
    } finally {
      setLoading(false);
    }
  };

  return {
    session,
    profile,
    isLoading: isLoading || isSubmitting,
    error,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    fetchProfile,
    clearError,
  };
};
