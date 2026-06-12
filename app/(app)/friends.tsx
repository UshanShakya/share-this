import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Text,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabaseClient';
import { Sheet } from '@/components/ui/Sheet';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { useNotificationStore } from '@/store/notificationStore';

interface FriendProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface Friendship {
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted';
  friendProfile: FriendProfile;
}

export default function FriendsScreen() {
  const theme = useTheme();
  const { session, profile } = useAuth();
  const uid = session?.user?.id;

  const [activeTab, setActiveTab] = useState<'list' | 'requests'>('list');
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<Friendship[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<Friendship[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<FriendProfile | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Invite from friends list states
  const [invitingFriend, setInvitingFriend] = useState<FriendProfile | null>(null);
  const [showRoomSelector, setShowRoomSelector] = useState(false);
  const [myRooms, setMyRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Reset loading state when user ID changes
  const [prevUid, setPrevUid] = useState(uid);
  if (uid !== prevUid) {
    setPrevUid(uid);
    setIsLoading(true);
  }

  const fetchFriendsData = useCallback(async () => {
    if (!uid) return;
    try {
      // 1. Fetch all friendships involving the current user
      const { data: friendships, error: friendshipErr } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id.eq.${uid},friend_id.eq.${uid}`);

      if (friendshipErr) throw friendshipErr;

      if (!friendships || friendships.length === 0) {
        setFriends([]);
        setIncomingRequests([]);
        setOutgoingRequests([]);
        return;
      }

      // 2. Fetch profiles for all friends in the list
      const friendIds = friendships.map((f) => (f.user_id === uid ? f.friend_id : f.user_id));
      const { data: profiles, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .in('id', friendIds);

      if (profileErr) throw profileErr;

      const profileMap = new Map<string, FriendProfile>();
      profiles?.forEach((p) => profileMap.set(p.id, p));

      // 3. Map friendships and profiles together
      const mappedFriendships: Friendship[] = friendships
        .map((f) => {
          const friendId = f.user_id === uid ? f.friend_id : f.user_id;
          const profile = profileMap.get(friendId);
          return {
            ...f,
            friendProfile: profile || {
              id: friendId,
              username: 'unknown',
              display_name: 'Unknown User',
              avatar_url: null,
            },
          };
        })
        .filter((f) => f.friendProfile.id !== uid); // sanity check

      // Split into lists
      setFriends(mappedFriendships.filter((f) => f.status === 'accepted'));
      
      // Incoming requests: status is pending AND the current user is the receiver (friend_id)
      setIncomingRequests(
        mappedFriendships.filter((f) => f.status === 'pending' && f.friend_id === uid)
      );

      // Outgoing requests: status is pending AND the current user is the sender (user_id)
      setOutgoingRequests(
        mappedFriendships.filter((f) => f.status === 'pending' && f.user_id === uid)
      );
    } catch (err: any) {
      console.error('Error fetching friends:', err.message || err);
    } finally {
      setIsLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    fetchFriendsData();

    if (!uid) return;

    // Subscribe to realtime changes on the friends table
    console.log('[FriendsScreen] Subscribing to friends realtime changes...');
    const channel = supabase
      .channel(`friends_realtime_sync_${Math.random().toString(36).substring(2, 9)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friends',
        },
        (payload) => {
          console.log('[FriendsScreen] Realtime change detected on friends table:', payload);
          fetchFriendsData();
        }
      )
      .subscribe((status) => {
        console.log('[FriendsScreen] Realtime friends subscription status:', status);
      });

    return () => {
      console.log('[FriendsScreen] Unsubscribing from friends realtime changes...');
      channel.unsubscribe();
    };
  }, [uid, fetchFriendsData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFriendsData();
    setRefreshing(false);
  };

  const handleSearchUser = async () => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      // 1. Fetch user by username
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', query)
        .single();

      if (error || !profile) {
        throw new Error('User not found.');
      }

      if (profile.id === uid) {
        throw new Error("You cannot add yourself as a friend.");
      }

      setSearchResult(profile);
    } catch (err: any) {
      setSearchError(err.message || 'User not found.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult || !uid) return;
    setIsSearching(true);

    try {
      // Check if relationship already exists
      const { data: existing, error: existErr } = await supabase
        .from('friends')
        .select('*')
        .or(
          `and(user_id.eq.${uid},friend_id.eq.${searchResult.id}),and(user_id.eq.${searchResult.id},friend_id.eq.${uid})`
        );

      if (existErr) throw existErr;

      if (existing && existing.length > 0) {
        const rel = existing[0];
        if (rel.status === 'accepted') {
          throw new Error('You are already friends with this user.');
        } else if (rel.user_id === uid) {
          throw new Error('Friend request already sent.');
        } else {
          throw new Error('This user has already sent you a request. Check your requests tab.');
        }
      }

      // Send request
      const { error } = await supabase.from('friends').insert({
        user_id: uid,
        friend_id: searchResult.id,
        status: 'pending',
      });

      if (error) throw error;

      // Send friend request notification to target user
      const senderName = profile?.username ? `@${profile.username}` : (profile?.display_name || 'Someone');
      await useNotificationStore.getState().addNotification(
        searchResult.id,
        'New Friend Request',
        `${senderName} has sent you a friend request.`,
        'friend_request'
      );

      Alert.alert('Success', `Friend request sent to @${searchResult.username}!`);
      setSearchResult(null);
      setSearchQuery('');
      fetchFriendsData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send request.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAcceptRequest = async (senderId: string) => {
    if (!uid) return;

    try {
      const { error } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('user_id', senderId)
        .eq('friend_id', uid);

      if (error) throw error;

      fetchFriendsData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to accept friend request.');
    }
  };

  const handleDeclineRequest = async (senderId: string) => {
    if (!uid) return;

    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', senderId)
        .eq('friend_id', uid);

      if (error) throw error;

      fetchFriendsData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to decline request.');
    }
  };

  const handleUnfriend = async (friendId: string, displayName: string) => {
    if (!uid) return;

    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove "${displayName}" from your friends list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('friends')
                .delete()
                .or(
                  `and(user_id.eq.${uid},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${uid})`
                );

              if (error) throw error;
              fetchFriendsData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to unfriend.');
            }
          },
        },
      ]
    );
  };

  const handleOpenInviteToRoom = async (friend: FriendProfile) => {
    setInvitingFriend(friend);
    setShowRoomSelector(true);
    setLoadingRooms(true);
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('owner_id', uid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyRooms(data || []);
    } catch (err) {
      console.error('Error fetching owned rooms for invite:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleInviteToRoom = async (roomId: string, roomName: string) => {
    if (!invitingFriend) return;
    try {
      // Check if friend is already a member or invited
      const { data: existing, error: existErr } = await supabase
        .from('room_members')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', invitingFriend.id);

      if (existErr) throw existErr;
      if (existing && existing.length > 0) {
        Alert.alert('Already Member', `${invitingFriend.display_name} is already a member or invited to "${roomName}".`);
        return;
      }

      const { error } = await supabase
        .from('room_members')
        .insert({
          room_id: roomId,
          user_id: invitingFriend.id,
          status: 'pending',
        });

      if (error) throw error;

      // Send room invite notification
      const inviterName = profile?.display_name || profile?.username || 'Someone';
      await useNotificationStore.getState().addNotification(
        invitingFriend.id,
        'Canvas Invite',
        `${inviterName} has invited you to join the canvas room "${roomName}".`,
        'room_invite',
        roomId
      );

      Alert.alert('Success', `Invited ${invitingFriend.display_name} to "${roomName}"!`);
      setShowRoomSelector(false);
      setInvitingFriend(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to invite to room.');
    }
  };

  const handleCancelRequest = async (friendId: string) => {
    if (!uid) return;
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', uid)
        .eq('friend_id', friendId);

      if (error) throw error;
      fetchFriendsData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to cancel request.');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const renderFriendItem = ({ item }: { item: Friendship }) => {
    const friend = item.friendProfile;
    return (
      <View style={[styles.cardRow, { borderBottomColor: theme.backgroundSelected || '#2E3135' }]}>
        {friend.avatar_url ? (
          <Image source={{ uri: friend.avatar_url }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: 'rgba(124, 124, 240, 0.15)' }]}>
            <ThemedText style={{ color: '#7C7CF0', fontWeight: '700' }}>
              {getInitials(friend.display_name || friend.username)}
            </ThemedText>
          </View>
        )}
        <View style={styles.friendInfo}>
          <ThemedText style={styles.displayName} type="smallBold">
            {friend.display_name}
          </ThemedText>
          <ThemedText style={styles.username} type="code">
            @{friend.username}
          </ThemedText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Pressable
            onPress={() => handleOpenInviteToRoom(friend)}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: pressed ? theme.backgroundSelected || '#2E3135' : 'transparent' },
            ]}
          >
            <Ionicons name="person-add-outline" size={20} color={theme.text} />
          </Pressable>
          <Pressable
            onPress={() => handleUnfriend(friend.id, friend.display_name)}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: pressed ? 'rgba(239, 68, 68, 0.08)' : 'transparent' },
            ]}
          >
            <Ionicons name="person-remove-outline" size={20} color={(theme as any).destructive || '#ef4444'} />
          </Pressable>
        </View>
      </View>
    );
  };

  const renderRequestItem = ({ item }: { item: Friendship & { isOutgoing?: boolean } }) => {
    const friend = item.friendProfile;
    const isOutgoing = item.isOutgoing;

    return (
      <View style={[styles.cardRow, { borderBottomColor: theme.backgroundSelected || '#2E3135' }]}>
        {friend.avatar_url ? (
          <Image source={{ uri: friend.avatar_url }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: 'rgba(96, 100, 108, 0.15)' }]}>
            <ThemedText style={{ color: theme.textSecondary || '#B0B4BA', fontWeight: '700' }}>
              {getInitials(friend.display_name || friend.username)}
            </ThemedText>
          </View>
        )}
        <View style={styles.friendInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ThemedText style={styles.displayName} type="smallBold">
              {friend.display_name}
            </ThemedText>
            <View style={[styles.statusBadge, { backgroundColor: isOutgoing ? 'rgba(237, 108, 2, 0.12)' : 'rgba(91, 91, 214, 0.12)' }]}>
              <Text style={{ color: isOutgoing ? '#ED6C02' : '#7C7CF0', fontSize: 9, fontWeight: '700' }}>
                {isOutgoing ? 'SENT' : 'RECEIVED'}
              </Text>
            </View>
          </View>
          <ThemedText style={styles.username} type="code">
            @{friend.username}
          </ThemedText>
        </View>
        <View style={styles.requestButtonRow}>
          {isOutgoing ? (
            <Pressable
              onPress={() => handleCancelRequest(friend.id)}
              style={({ pressed }) => [
                styles.cancelRequestBtn,
                {
                  backgroundColor: theme.backgroundSelected || '#2E3135',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <ThemedText type="smallBold" style={{ color: theme.textSecondary || '#B0B4BA', fontSize: 12 }}>
                Cancel
              </ThemedText>
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={() => handleDeclineRequest(friend.id)}
                style={({ pressed }) => [
                  styles.roundDeclineButton,
                  {
                    backgroundColor: pressed ? 'rgba(239, 68, 68, 0.15)' : theme.backgroundSelected || '#2E3135',
                  },
                ]}
              >
                <Ionicons name="close" size={18} color={(theme as any).destructive || '#ef4444'} />
              </Pressable>
              <Pressable
                onPress={() => handleAcceptRequest(friend.id)}
                style={({ pressed }) => [
                  styles.roundAcceptButton,
                  {
                    backgroundColor: '#7C7CF0',
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.title} type="subtitle">
            Friends
          </ThemedText>
          <ThemedText style={styles.subtitle} type="code">
            Find and add drawing partners
          </ThemedText>
        </View>

        {/* Add Friend Input Search Container */}
        <View
          style={[
            styles.searchSection,
            {
              backgroundColor: theme.backgroundElement || '#212225',
              borderColor: theme.backgroundSelected || '#2E3135',
            },
          ]}
        >
          <View style={styles.searchRow}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  color: theme.text,
                  backgroundColor: theme.background || '#000000',
                  borderColor: theme.backgroundSelected || '#2E3135',
                },
              ]}
              placeholder="Search username to add..."
              placeholderTextColor={theme.textSecondary || '#B0B4BA'}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (searchError) setSearchError(null);
                if (searchResult) setSearchResult(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={handleSearchUser}
              disabled={isSearching || !searchQuery.trim()}
              style={({ pressed }) => [
                styles.searchButton,
                {
                  backgroundColor: '#7C7CF0',
                  opacity: pressed || !searchQuery.trim() ? 0.8 : 1,
                },
              ]}
            >
              {isSearching ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="search" size={20} color="#FFFFFF" />
              )}
            </Pressable>
          </View>

          {/* Search Results Display */}
          {searchResult && (
            <View style={styles.resultBox}>
              <View style={styles.resultDetails}>
                {searchResult.avatar_url ? (
                  <Image source={{ uri: searchResult.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: 'rgba(124, 124, 240, 0.2)' }]}>
                    <ThemedText style={{ color: '#7C7CF0', fontWeight: '700' }}>
                      {getInitials(searchResult.display_name || searchResult.username)}
                    </ThemedText>
                  </View>
                )}
                <View>
                  <ThemedText type="smallBold">{searchResult.display_name}</ThemedText>
                  <ThemedText type="code" style={styles.username}>
                    @{searchResult.username}
                  </ThemedText>
                </View>
              </View>
              <Pressable
                onPress={handleSendRequest}
                style={({ pressed }) => [
                  styles.addFriendBtn,
                  { backgroundColor: '#7C7CF0', opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Ionicons name="person-add" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <ThemedText type="smallBold" style={{ color: '#FFFFFF', fontSize: 13 }}>
                  Add
                </ThemedText>
              </Pressable>
            </View>
          )}

          {searchError && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={(theme as any).destructive || '#ef4444'} />
              <ThemedText style={{ color: (theme as any).destructive || '#ef4444', fontSize: 12 }} type="code">
                {searchError}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <Pressable
            onPress={() => setActiveTab('list')}
            style={[
              styles.tab,
              activeTab === 'list' && { borderBottomColor: '#7C7CF0', borderBottomWidth: 2 },
            ]}
          >
            <ThemedText
              style={[
                styles.tabText,
                { color: activeTab === 'list' ? '#7C7CF0' : theme.textSecondary || '#B0B4BA' },
              ]}
              type="smallBold"
            >
              Friends ({friends.length})
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('requests')}
            style={[
              styles.tab,
              activeTab === 'requests' && { borderBottomColor: '#7C7CF0', borderBottomWidth: 2 },
            ]}
          >
            <ThemedText
              style={[
                styles.tabText,
                { color: activeTab === 'requests' ? '#7C7CF0' : theme.textSecondary || '#B0B4BA' },
              ]}
              type="smallBold"
            >
              Requests ({incomingRequests.length + outgoingRequests.length})
            </ThemedText>
          </Pressable>
        </View>

        {/* Content List */}
        {isLoading && friends.length === 0 && incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#7C7CF0" />
          </View>
        ) : activeTab === 'list' ? (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.friendProfile.id}
            contentContainerStyle={[styles.listContainer, friends.length === 0 && { flexGrow: 1, justifyContent: 'center' }]}
            renderItem={renderFriendItem}
            ListEmptyComponent={
              <View style={styles.centerContainer}>
                <Ionicons name="people-outline" size={48} color={theme.textSecondary || '#B0B4BA'} style={{ opacity: 0.5 }} />
                <ThemedText style={styles.emptyText} type="smallBold">
                  Your friends list is empty
                </ThemedText>
                <ThemedText style={styles.emptySubtitle} type="code">
                  Search above by username to send friend requests!
                </ThemedText>
              </View>
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C7CF0" />
            }
          />
        ) : (
          <FlatList
            data={[
              ...incomingRequests.map((r) => ({ ...r, isOutgoing: false })),
              ...outgoingRequests.map((r) => ({ ...r, isOutgoing: true })),
            ]}
            keyExtractor={(item) => `${item.isOutgoing ? 'out' : 'in'}-${item.friendProfile.id}`}
            contentContainerStyle={[styles.listContainer, (incomingRequests.length + outgoingRequests.length) === 0 && { flexGrow: 1, justifyContent: 'center' }]}
            renderItem={renderRequestItem}
            ListEmptyComponent={
              <View style={styles.centerContainer}>
                <Ionicons name="mail-outline" size={48} color={theme.textSecondary || '#B0B4BA'} style={{ opacity: 0.5 }} />
                <ThemedText style={styles.emptyText} type="smallBold">
                  No pending requests
                </ThemedText>
                <ThemedText style={styles.emptySubtitle} type="code">
                  Pending friend requests (both sent and received) will show up here.
                </ThemedText>
              </View>
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C7CF0" />
            }
          />
        )}
      </SafeAreaView>

      {/* Invite Friend to Canvas Room Selector Sheet */}
      <Sheet
        visible={showRoomSelector}
        onClose={() => {
          setShowRoomSelector(false);
          setInvitingFriend(null);
        }}
        title={`Invite to Canvas`}
      >
        <View style={styles.roomsSelectorContainer}>
          <ThemedText style={styles.inviteLabel} type="code">
            CHOOSE A CANVAS TO INVITE @{invitingFriend?.username}
          </ThemedText>
          
          {loadingRooms ? (
            <ActivityIndicator size="small" color="#7C7CF0" style={{ marginVertical: Spacing.four }} />
          ) : myRooms.length === 0 ? (
            <View style={styles.noRoomsContainer}>
              <Ionicons name="alert-circle-outline" size={36} color={theme.textSecondary || '#B0B4BA'} style={{ marginBottom: 8 }} />
              <ThemedText style={styles.noRoomsText} type="code">
                {"You don't own any canvases yet. Create one in the Create tab!"}
              </ThemedText>
            </View>
          ) : (
            <FlatList
              data={myRooms}
              keyExtractor={(item) => item.id}
              style={styles.roomSelectScroll}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleInviteToRoom(item.id, item.name)}
                  style={({ pressed }) => [
                    styles.roomSelectItem,
                    {
                      backgroundColor: pressed ? theme.backgroundSelected || '#2E3135' : 'transparent',
                      borderBottomColor: theme.backgroundSelected || '#2E3135',
                    },
                  ]}
                >
                  <Ionicons name="color-palette-outline" size={20} color="#7C7CF0" style={{ marginRight: 12 }} />
                  <ThemedText type="smallBold" style={{ flex: 1 }}>{item.name}</ThemedText>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary || '#B0B4BA'} />
                </Pressable>
              )}
            />
          )}
        </View>
      </Sheet>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  searchSection: {
    marginHorizontal: Spacing.four,
    padding: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: Spacing.three,
  },
  searchRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  resultDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  addFriendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.two,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginBottom: Spacing.one,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabText: {
    fontSize: 14,
  },
  listContainer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: 120, // Space for custom tab bar
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  friendInfo: {
    flex: 1,
    paddingHorizontal: Spacing.two,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '600',
  },
  username: {
    fontSize: 11,
    opacity: 0.6,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestButtonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  roundDeclineButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundAcceptButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelRequestBtn: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomsSelectorContainer: {
    paddingBottom: Spacing.four,
  },
  inviteLabel: {
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.5,
    marginBottom: Spacing.three,
    letterSpacing: 0.5,
  },
  noRoomsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
  },
  noRoomsText: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.6,
  },
  roomSelectScroll: {
    maxHeight: 250,
  },
  roomSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: Spacing.two,
    borderRadius: 10,
    borderBottomWidth: 0.5,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
    minHeight: 250,
  },
  emptyText: {
    marginTop: Spacing.two,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 4,
    textAlign: 'center',
  },
});
