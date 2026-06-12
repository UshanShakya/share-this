import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View, StyleSheet, useColorScheme, Alert, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (err: any) {
  console.log('[RootLayout] expo-notifications could not be required (normal in Expo Go):', err.message);
}

import { useAuthStore } from '../src/store/authStore';
import { supabase } from '../src/lib/supabaseClient';
import { sharedStorage } from '../src/lib/sharedStorage';
import { Colors } from '../src/constants/Colors';
import { useAlertStore } from '../src/store/alertStore';
import { GlassAlert } from '../src/components/GlassAlert';
import { KnoodleSplashScreen } from '../src/components/KnoodleSplashScreen';

// Keep the native splash screen visible while the React Native JS bundle is loading
SplashScreen.preventAutoHideAsync().catch(() => {});

// Configure notification behavior for when the app is in the foreground
if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

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

  // Setup notification response listener (taps on notifications when app is in background or closed)
  useEffect(() => {
    if (!Notifications || typeof Notifications.addNotificationResponseReceivedListener !== 'function') {
      return;
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data;
      if (data && data.relatedId && session) {
        // Direct navigate to the specific room canvas
        setTimeout(() => {
          router.push(`/rooms/${data.relatedId}/canvas`);
        }, 100);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [router, session]);

  // Check if app was opened from a cold-start/killed state by tapping a notification
  useEffect(() => {
    if (!Notifications || typeof Notifications.getLastNotificationResponseAsync !== 'function') {
      return;
    }

    const checkInitialNotification = async () => {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response) {
          const data = response.notification.request.content.data;
          if (data && data.relatedId && session) {
            setTimeout(() => {
              router.push(`/rooms/${data.relatedId}/canvas`);
            }, 500);
          }
        }
      } catch (err) {
        console.warn('[PushNotification] Error checking initial notification:', err);
      }
    };

    if (session && !isLoading) {
      checkInitialNotification();
    }
  }, [session, isLoading, router]);

  return null;
}

import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'light' ? 'light' : 'dark'];
  const { setSession, setProfile, setLoading, isLoading } = useAuthStore();
  const [splashAnimationComplete, setSplashAnimationComplete] = useState(false);

  useEffect(() => {
    // Reset active room on app startup
    sharedStorage.syncActiveRoom(null);

    // Hide the native splash screen as soon as the JS app mounts
    SplashScreen.hideAsync().catch(() => {});

    // Request system notification permissions
    const requestNotificationPermissions = async () => {
      if (!Notifications || typeof Notifications.getPermissionsAsync !== 'function') {
        return;
      }
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted' && typeof Notifications.requestPermissionsAsync === 'function') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus === 'granted' && Platform.OS === 'android' && typeof Notifications.setNotificationChannelAsync === 'function') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#D4537E',
          });
        }
      } catch (err) {
        console.warn('[RootLayout] Error configuring notification channel:', err);
      }
    };
    requestNotificationPermissions();

    const registerForPushNotifications = async (userId: string) => {
      // Safeguard: Notifications must be loaded (non-Expo Go) and running on physical device
      if (!Notifications || typeof Notifications.getPermissionsAsync !== 'function') {
        return;
      }
      
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted' && typeof Notifications.requestPermissionsAsync === 'function') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          return;
        }

        // Must be physical device for remote push notifications
        if (!Device.isDevice) {
          return;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) {
          console.warn('[PushNotification] No EAS projectId found. Registering push token skipped.');
          return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;

        // Save token to Supabase profiles table
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ expo_push_token: token })
          .eq('id', userId);

        if (updateError) {
          console.warn('[PushNotification] Failed to save push token to profiles:', updateError.message);
        }
      } catch (err) {
        console.warn('[PushNotification] Error registering push notification token:', err);
      }
    };

    const bootstrapAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        sharedStorage.syncAuth(currentSession?.access_token || null);

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
            registerForPushNotifications(currentSession.user.id).catch(() => {});
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
      sharedStorage.syncAuth(currentSession?.access_token || null);
      
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
            registerForPushNotifications(currentSession.user.id).catch(() => {});
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      {!splashAnimationComplete && (
        <KnoodleSplashScreen onAnimationComplete={() => setSplashAnimationComplete(true)} />
      )}
      <AuthGuard />
      {isLoading ? (
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <Stack screenOptions={{ headerShown: false }} />
      )}
      <GlassAlert />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
