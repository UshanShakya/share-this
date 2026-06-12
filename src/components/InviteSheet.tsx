import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  Share,
  Alert,
  ScrollView,
} from 'react-native';
import { supabase } from '@/lib/supabaseClient';
import { Sheet } from './ui/Sheet';
import { ThemedText } from './themed-text';
import { useRoom } from '@/hooks/useRoom';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';

interface InviteSheetProps {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
}

export function InviteSheet({ visible, onClose, roomId, roomName }: InviteSheetProps) {
  const theme = useTheme();
  const { inviteMember } = useRoom();
  const { session } = useAuth();
  const uid = session?.user?.id;

  const [username, setUsername] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Quick invite friends states
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [roomMembersList, setRoomMembersList] = useState<Record<string, 'pending' | 'accepted'>>({});
  const [loadingFriends, setLoadingFriends] = useState(false);

  const fetchFriendsAndMembers = useCallback(async () => {
    if (!uid || !roomId || !visible) return;
    await Promise.resolve();
    setLoadingFriends(true);
    try {
      // 1. Fetch friendships
      const { data: friendships, error: friendshipErr } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id.eq.${uid},friend_id.eq.${uid}`)
        .eq('status', 'accepted');

      if (friendshipErr) throw friendshipErr;

      let friendsProfiles: any[] = [];
      if (friendships && friendships.length > 0) {
        // 2. Fetch profiles
        const friendIds = friendships.map((f) => (f.user_id === uid ? f.friend_id : f.user_id));
        const { data: profiles, error: profileErr } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .in('id', friendIds);

        if (profileErr) throw profileErr;
        friendsProfiles = profiles || [];
      }

      // 3. Fetch room members
      const { data: members, error: membersErr } = await supabase
        .from('room_members')
        .select('user_id, status')
        .eq('room_id', roomId);

      if (membersErr) throw membersErr;

      const membersMap: Record<string, 'pending' | 'accepted'> = {};
      members?.forEach((m) => {
        membersMap[m.user_id] = m.status as any;
      });

      setFriendsList(friendsProfiles);
      setRoomMembersList(membersMap);
    } catch (err) {
      console.error('Error fetching friends for invite:', err);
    } finally {
      setLoadingFriends(false);
    }
  }, [uid, roomId, visible]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFriendsAndMembers();
  }, [fetchFriendsAndMembers]);

  const handleInviteFriend = async (friendUsername: string) => {
    setStatus(null);
    try {
      const result = await inviteMember(roomId, friendUsername);
      if (result.success) {
        // Refresh members mapping
        fetchFriendsAndMembers();
      } else {
        Alert.alert('Error', result.error || 'Failed to invite friend.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred.');
    }
  };

  // Generate deep link
  // Inside Expo Go, this resolves to exp://[ip]:[port]/--/rooms/[roomId]/canvas
  const inviteUrl = Linking.createURL(`/rooms/${roomId}`);

  const handleInvite = async () => {
    if (!username.trim()) return;
    setIsInviting(true);
    setStatus(null);

    try {
      const result = await inviteMember(roomId, username);
      if (result.success) {
        setStatus({
          type: 'success',
          message: `Successfully added "${username}" to the room!`,
        });
        setUsername('');
      } else {
        setStatus({
          type: 'error',
          message: result.error || 'Failed to invite user.',
        });
      }
    } catch (err: any) {
      setStatus({
        type: 'error',
        message: err.message || 'An error occurred.',
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = async () => {
    try {
      await Share.share({
        message: `Join my collaborative drawing room "${roomName}" on Knoodle! Draw together here: ${inviteUrl}`,
        title: `Invite to room ${roomName}`,
      });
    } catch (error: any) {
      console.error('Error sharing link:', error.message);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Invite Collaborators">
      <View style={styles.container}>
        {/* Username invite form */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel} type="code">
            INVITE BY USERNAME
          </ThemedText>
          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.background || '#000000',
                  borderColor: theme.backgroundSelected || '#2E3135',
                },
              ]}
              placeholder="Enter username (e.g. creative_user)"
              placeholderTextColor={theme.textSecondary || '#B0B4BA'}
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                if (status) setStatus(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isInviting}
            />
            <Pressable
              onPress={handleInvite}
              disabled={isInviting || !username.trim()}
              style={({ pressed }) => [
                styles.inviteButton,
                {
                  backgroundColor: '#7C7CF0',
                  opacity: pressed || !username.trim() ? 0.8 : 1,
                },
              ]}
            >
              {isInviting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
              )}
            </Pressable>
          </View>

          {status && (
            <View
              style={[
                styles.statusBox,
                {
                  backgroundColor:
                    status.type === 'success'
                      ? 'rgba(74, 222, 128, 0.1)'
                      : 'rgba(239, 68, 68, 0.1)',
                  borderColor: status.type === 'success' ? '#4ade80' : '#ef4444',
                },
              ]}
            >
              <Ionicons
                name={status.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={16}
                color={status.type === 'success' ? '#4ade80' : '#ef4444'}
                style={{ marginRight: 6 }}
              />
              <ThemedText
                style={[
                  styles.statusText,
                  { color: status.type === 'success' ? '#4ade80' : '#ef4444' },
                ]}
                type="code"
              >
                {status.message}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Friends quick invite list */}
        <View style={[styles.divider, { backgroundColor: theme.backgroundSelected || '#2E3135' }]} />

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel} type="code">
            QUICK INVITE FRIENDS
          </ThemedText>
          
          {loadingFriends ? (
            <ActivityIndicator size="small" color="#7C7CF0" style={{ marginVertical: Spacing.two }} />
          ) : friendsList.length === 0 ? (
            <ThemedText style={styles.emptyText} type="code">
              Add friends in the Friends tab to quickly invite them here.
            </ThemedText>
          ) : (
            <ScrollView style={styles.friendsListContainer} nestedScrollEnabled={true}>
              {friendsList.map((friend) => {
                const membershipStatus = roomMembersList[friend.id];
                
                return (
                  <View key={friend.id} style={styles.friendRow}>
                    <View style={styles.friendInfo}>
                      <ThemedText type="smallBold">{friend.display_name}</ThemedText>
                      <ThemedText type="code" style={styles.friendUsername}>
                        @{friend.username}
                      </ThemedText>
                    </View>
                    
                    {membershipStatus === 'accepted' ? (
                      <View style={[styles.statusBadge, { backgroundColor: 'rgba(74, 222, 128, 0.12)' }]}>
                        <ThemedText style={{ color: '#4ade80', fontSize: 11, fontWeight: '700' }} type="code">
                          MEMBER
                        </ThemedText>
                      </View>
                    ) : membershipStatus === 'pending' ? (
                      <View style={[styles.statusBadge, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                        <ThemedText style={{ color: '#ef4444', fontSize: 11, fontWeight: '700' }} type="code">
                          INVITED
                        </ThemedText>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => handleInviteFriend(friend.username)}
                        style={({ pressed }) => [
                          styles.inviteFriendBtn,
                          {
                            backgroundColor: '#7C7CF0',
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <ThemedText type="smallBold" style={{ color: '#FFFFFF', fontSize: 12 }}>
                          Invite
                        </ThemedText>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.backgroundSelected || '#2E3135' }]} />

        {/* Link share section */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel} type="code">
            SHARE JOIN LINK
          </ThemedText>
          <ThemedText style={styles.linkDescription} type="code">
            Anyone with this link can join and draw on this canvas.
          </ThemedText>

          <View
            style={[
              styles.linkBox,
              {
                backgroundColor: theme.background || '#000000',
                borderColor: theme.backgroundSelected || '#2E3135',
              },
            ]}
          >
            <ThemedText numberOfLines={1} style={styles.linkText} type="code">
              {inviteUrl}
            </ThemedText>
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              onPress={handleCopyLink}
              style={({ pressed }) => [
                styles.actionButton,
                {
                  backgroundColor: theme.backgroundSelected || '#2E3135',
                  borderColor: theme.backgroundSelected || '#2E3135',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy'}
                size={16}
                color={copied ? '#4ade80' : theme.text}
                style={{ marginRight: 6 }}
              />
              <ThemedText type="smallBold" style={{ color: copied ? '#4ade80' : theme.text }}>
                {copied ? 'Copied!' : 'Copy Link'}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={handleShareLink}
              style={({ pressed }) => [
                styles.actionButton,
                {
                  backgroundColor: '#7C7CF0',
                  borderColor: '#7C7CF0',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons
                name="share-social"
                size={16}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>
                Share Link
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.two,
  },
  section: {
    marginVertical: Spacing.two,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.5,
    marginBottom: Spacing.two,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  inviteButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.two,
    marginTop: Spacing.two,
  },
  statusText: {
    fontSize: 12,
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.three,
  },
  linkDescription: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: Spacing.two,
  },
  linkBox: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  linkText: {
    fontSize: 13,
    opacity: 0.8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    opacity: 0.5,
    marginVertical: Spacing.one,
  },
  friendsListContainer: {
    maxHeight: 180,
    marginTop: Spacing.one,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(120, 120, 120, 0.15)',
  },
  friendInfo: {
    flex: 1,
  },
  friendUsername: {
    fontSize: 11,
    opacity: 0.5,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteFriendBtn: {
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
