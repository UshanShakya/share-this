import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View, StyleSheet, useColorScheme, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../src/store/authStore';
import { supabase } from '../src/lib/supabaseClient';
import { Colors } from '../src/constants/Colors';
import { useAlertStore } from '../src/store/alertStore';
import { GlassAlert } from '../src/components/GlassAlert';

// Patch native Alert.alert globally with our custom beautiful glassy alert dialog
Alert.alert = (title: string, message?: string, buttons?: any[]) => {
  useAlertStore.getState().show(title, message, buttons);
};

function AuthGuard() {
  const { session, isLoading } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [session, segments, isLoading]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'light' ? 'light' : 'dark'];
  const { setSession, setProfile, setLoading, isLoading } = useAuthStore();

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);

        if (currentSession?.user) {
          const { data: profileData, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentSession.user.id)
            .single();
          
          if (profileErr) {
            console.warn('[RootLayout bootstrapAuth] Error fetching profile:', profileErr.message);
          }
          if (profileData) {
            setProfile(profileData);
          }
        }
      } catch (err) {
        console.error('[RootLayout bootstrapAuth] Fatal bootstrapping error:', err);
      } finally {
        setLoading(false);
      }
    };

    bootstrapAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      
      if (currentSession?.user) {
        try {
          const { data: profileData, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentSession.user.id)
            .single();

          if (profileErr) {
            console.warn('[RootLayout onAuthStateChange] Error fetching profile:', profileErr.message);
          }
          if (profileData) {
            setProfile(profileData);
          }
        } catch (err) {
          console.error('[RootLayout onAuthStateChange] Error fetching profile:', err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    const handleDeepLink = async (url: string) => {
      try {
        const cleanUrl = url.replace('#', '?');
        const parsed = Linking.parse(cleanUrl);
        
        const access_token = parsed.queryParams?.access_token as string | undefined;
        const refresh_token = parsed.queryParams?.refresh_token as string | undefined;
        
        if (access_token && refresh_token) {
          setLoading(true);
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (sessionError) throw sessionError;
        }
      } catch (err) {
        console.error('[RootLayout handleDeepLink] Error handling deep link:', err);
      } finally {
        setLoading(false);
      }
    };

    const subscriptionLink = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription.unsubscribe();
      subscriptionLink.remove();
    };
  }, []);

  return (
    <>
      <AuthGuard />
      {isLoading ? (
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <Stack screenOptions={{ headerShown: false }} />
      )}
      <GlassAlert />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
