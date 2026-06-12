import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Knoodle',
  slug: 'shared-canvas',
  scheme: 'sharedcanvas',
  ios: {
    ...config.ios,
    bundleIdentifier: 'com.ushanshakya.sharedcanvas',
  },
  android: {
    ...config.android,
    package: 'com.ushanshakya.sharedcanvas',
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
