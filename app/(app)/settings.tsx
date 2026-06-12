import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Appearance,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks/useAuth';
import { Colors } from '../../src/constants/Colors';
import { Spacing } from '../../src/constants/theme';
import { supabase } from '../../src/lib/supabaseClient';
import { useAuthStore } from '../../src/store/authStore';
import * as SecureStore from 'expo-secure-store';

const PRESET_AVATARS = [
  { name: 'Felix', url: 'https://api.dicebear.com/7.x/bottts/png?seed=Felix' },
  { name: 'Aneka', url: 'https://api.dicebear.com/7.x/bottts/png?seed=Aneka' },
  { name: 'Jack', url: 'https://api.dicebear.com/7.x/bottts/png?seed=Jack' },
  { name: 'Buster', url: 'https://api.dicebear.com/7.x/bottts/png?seed=Buster' },
  { name: 'Cody', url: 'https://api.dicebear.com/7.x/bottts/png?seed=Cody' },
  { name: 'Daisy', url: 'https://api.dicebear.com/7.x/bottts/png?seed=Daisy' },
  { name: 'Sasha', url: 'https://api.dicebear.com/7.x/bottts/png?seed=Sasha' },
  { name: 'Oliver', url: 'https://api.dicebear.com/7.x/bottts/png?seed=Oliver' },
  { name: 'Milo', url: 'https://api.dicebear.com/7.x/bottts/png?seed=Milo' },
  { name: 'Rocky', url: 'https://api.dicebear.com/7.x/bottts/png?seed=Rocky' },
  { name: 'Ginger', url: 'https://api.dicebear.com/7.x/bottts/png?seed=Ginger' },
  { name: 'Toby', url: 'https://api.dicebear.com/7.x/bottts/png?seed=Toby' },
];

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'light' ? 'light' : 'dark'];
  const { profile, session, signOut, fetchProfile } = useAuth();
  const setProfile = useAuthStore((state) => state.setProfile);

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    if (session?.user?.id) {
      setRefreshing(true);
      await fetchProfile(session.user.id);
      setRefreshing(false);
    }
  };

  // Sync profile changes during render to avoid useEffect state updates
  const [prevProfile, setPrevProfile] = useState(profile);
  if (profile !== prevProfile) {
    setPrevProfile(profile);
    setDisplayName(profile?.display_name || '');
    setUsername(profile?.username || '');
    setAvatarUrl(profile?.avatar_url || '');
  }

  const handleUpdateProfile = async () => {
    if (!session?.user) return;
    
    setError(null);
    setSuccess(false);

    if (!displayName.trim()) {
      setError('Display Name cannot be empty.');
      return;
    }

    setUpdating(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      // Update Zustand local state
      setProfile({
        id: session.user.id,
        username: profile?.username || username,
        display_name: displayName.trim(),
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setUpdating(false);
    }
  };

  const toggleTheme = () => {
    const nextScheme = colorScheme === 'dark' ? 'light' : 'dark';
    Appearance.setColorScheme(nextScheme);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const getInitials = () => {
    if (profile?.display_name) {
      return profile.display_name.substring(0, 2).toUpperCase();
    }
    if (session?.user?.email) {
      return session.user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const triggerTestNotification = async () => {
    if (!session?.user) return;
    try {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert({
          user_id: session.user.id,
          title: 'Test Notification 🚀',
          message: 'This is a test background push notification!',
          type: 'test_notification',
          is_read: false,
        });
      if (insertError) throw insertError;
      Alert.alert('Success', 'Test notification inserted! Press Home to background the app and test background delivery.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to trigger test notification');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Profile Card Summary */}
        <View style={[styles.profileCard, { backgroundColor: colorScheme === 'dark' ? '#1E1E1E' : '#F5F5F7', borderColor: colors.border }]}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarCircle, { backgroundColor: colors.accent }]}>
              <Text style={styles.avatarText}>{getInitials()}</Text>
            </View>
          )}
          <View style={styles.profileDetails}>
            <Text style={[styles.displayNameHeader, { color: colors.text }]}>
              {profile?.display_name || 'Anonymous User'}
            </Text>
            <Text style={[styles.usernameTextHeader, { color: colors.textSecondary }]}>
              @{profile?.username || 'user'}
            </Text>
            <Text style={[styles.emailText, { color: colors.textSecondary }]} numberOfLines={1}>
              {session?.user?.email}
            </Text>
          </View>
        </View>

        {/* Inline Profile Editor Form */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>EDIT PROFILE</Text>
        
        <View style={[styles.settingsGroup, { backgroundColor: colorScheme === 'dark' ? '#1E1E1E' : '#F5F5F7', borderColor: colors.border, padding: Spacing.three }]}>
          {error && (
            <View style={[styles.statusBox, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '40' }]}>
              <Text style={[styles.statusText, { color: colors.destructive }]}>{error}</Text>
            </View>
          )}

          {success && (
            <View style={[styles.statusBox, { backgroundColor: '#2E7D3215', borderColor: '#2E7D3240' }]}>
              <Text style={[styles.statusText, { color: '#2E7D32' }]}>Profile updated successfully!</Text>
            </View>
          )}

          {/* Display Name Input */}
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Display Name</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colorScheme === 'dark' ? '#111111' : '#FFFFFF', borderColor: colors.border }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display Name"
            placeholderTextColor={colors.textSecondary}
            editable={!updating}
          />

          {/* Username Input (Read-only) */}
          <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: Spacing.three }]}>Username (Unique)</Text>
          <View style={[styles.readOnlyInputWrapper, { backgroundColor: colorScheme === 'dark' ? '#141414' : '#EBEBEF', borderColor: colors.border }]}>
            <TextInput
              style={[styles.readOnlyInput, { color: colors.textSecondary }]}
              value={username}
              editable={false}
            />
            <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} style={{ marginRight: 12 }} />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.accent, opacity: updating ? 0.8 : 1 }]}
            onPress={handleUpdateProfile}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Avatar Gallery Selector */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>AVATAR GALLERY</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colorScheme === 'dark' ? '#1E1E1E' : '#F5F5F7', borderColor: colors.border, padding: Spacing.three }]}>
          <Text style={[styles.avatarGallerySub, { color: colors.textSecondary, marginBottom: Spacing.three }]}>
            Choose a preset avatar below:
          </Text>
          <View style={styles.avatarGrid}>
            {PRESET_AVATARS.map((avatar) => {
              const isSelected = avatarUrl === avatar.url;
              return (
                <TouchableOpacity
                  key={avatar.name}
                  onPress={() => setAvatarUrl(avatar.url)}
                  disabled={updating}
                  style={[
                    styles.avatarGridItem,
                    {
                      borderColor: isSelected ? colors.accent : 'transparent',
                      backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#EBEBEF',
                    },
                  ]}
                >
                  <Image source={{ uri: avatar.url }} style={styles.gridAvatarImage} />
                  {isSelected && (
                    <View style={[styles.checkBadge, { backgroundColor: colors.accent }]}>
                      <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Preferences Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PREFERENCES</Text>
        
        <View style={[styles.settingsGroup, { backgroundColor: colorScheme === 'dark' ? '#1E1E1E' : '#F5F5F7', borderColor: colors.border }]}>
          <TouchableOpacity style={styles.settingsRow} onPress={toggleTheme}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#FF980020' }]}>
                <Ionicons name="color-palette-outline" size={20} color="#FF9800" />
              </View>
              <Text style={[styles.rowText, { color: colors.text }]}>Theme Mode</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValueText, { color: colors.textSecondary, marginRight: 8 }]}>
                {colorScheme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </Text>
              <Ionicons name="swap-horizontal" size={16} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Test Utilities Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>TEST UTILITIES (TEMPORARY)</Text>
        
        <View style={[styles.settingsGroup, { backgroundColor: colorScheme === 'dark' ? '#1E1E1E' : '#F5F5F7', borderColor: colors.border }]}>
          <TouchableOpacity style={styles.settingsRow} onPress={triggerTestNotification}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#4CAF5020' }]}>
                <Ionicons name="notifications-outline" size={20} color="#4CAF50" />
              </View>
              <Text style={[styles.rowText, { color: colors.text }]}>Send Test Push Notification</Text>
            </View>
            <View style={styles.rowRight}>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.signOutButton, { borderColor: colors.destructive }]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.destructive} style={{ marginRight: 8 }} />
          <Text style={[styles.signOutButtonText, { color: colors.destructive }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: Spacing.four,
    paddingBottom: 120, // Space for custom tab bar
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.three,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  profileDetails: {
    flex: 1,
  },
  displayNameHeader: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  usernameTextHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  emailText: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
    paddingLeft: Spacing.one,
  },
  settingsGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.three,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    height: 54,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.three,
  },
  rowText: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowValueText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  saveButton: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    height: 52,
    borderWidth: 1.5,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.five,
    alignSelf: 'stretch',
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: Spacing.three,
  },
  readOnlyInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 12,
  },
  readOnlyInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
  },
  avatarGallerySub: {
    fontSize: 13,
    fontWeight: '500',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  avatarGridItem: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gridAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
});
