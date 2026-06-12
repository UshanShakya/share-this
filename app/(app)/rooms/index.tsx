import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  RefreshControl,
  Text,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useRoom } from '@/hooks/useRoom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { RoomCard } from '@/components/RoomCard';
import { ThemedText } from '@/components/themed-text';
import { Sheet } from '@/components/ui/Sheet';
import { SideDrawer } from '@/components/ui/SideDrawer';
import { InviteSheet } from '@/components/InviteSheet';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { Room, RoomInvite } from '@/types/room';
import { useNotificationStore } from '@/store/notificationStore';
import { supabase } from '@/lib/supabaseClient';
import { SwipeableNotificationItem } from '@/components/ui/SwipeableNotificationItem';


export default function RoomsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const {
    rooms,
    roomInvites,
    isLoading,
    error,
    fetchRooms,
    fetchRoomInvites,
    acceptRoomInvite,
    declineRoomInvite,
    deleteRoom,
    leaveRoom,
  } = useRoom();

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'invites'>('active');
  
  // State for Options sheet
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);

  // State for Invite sheet
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  
  // State for Notifications sheet
  const [showNotifications, setShowNotifications] = useState(false);
  const [dismissingIds, setDismissingIds] = useState<string[]>([]);



  const currentUserId = session?.user?.id;

  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    deleteNotification,
    subscribeNotifications,
  } = useNotificationStore();

  const handleMarkAllAsRead = () => {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;

    unread.forEach((item, index) => {
      setTimeout(() => {
        setDismissingIds((prev) => [...prev, item.id]);
      }, index * 120);
    });
  };

  const unreadNotifications = notifications.filter((n) => !n.is_read);

  const handleFetchRooms = useCallback(async () => {
    await Promise.all([fetchRooms(), fetchRoomInvites(), fetchNotifications()]);
  }, [fetchRooms, fetchRoomInvites, fetchNotifications]);

  useEffect(() => {
    handleFetchRooms();
  }, [handleFetchRooms]);

  useEffect(() => {
    if (currentUserId) {
      console.log('[RoomsScreen] Subscribing to notifications realtime for:', currentUserId);
      const unsubscribe = subscribeNotifications(currentUserId);
      return () => {
        console.log('[RoomsScreen] Unsubscribing from notifications realtime for:', currentUserId);
        unsubscribe();
      };
    }
  }, [currentUserId, subscribeNotifications]);

  useEffect(() => {
    if (!currentUserId) return;

    // Subscribe to rooms and room_members realtime updates
    console.log('[RoomsScreen] Subscribing to rooms and room_members realtime updates...');
    const channel = supabase
      .channel(`rooms_realtime_sync_${Math.random().toString(36).substring(2, 9)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_members',
        },
        (payload) => {
          console.log('[RoomsScreen] Realtime change detected on room_members table:', payload);
          fetchRooms().catch(() => {});
          fetchRoomInvites().catch(() => {});
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
        },
        (payload) => {
          console.log('[RoomsScreen] Realtime change detected on rooms table:', payload);
          fetchRooms().catch(() => {});
          fetchRoomInvites().catch(() => {});
        }
      )
      .subscribe((status) => {
        console.log('[RoomsScreen] Realtime rooms subscription status:', status);
      });

    return () => {
      console.log('[RoomsScreen] Unsubscribing from rooms and room_members realtime updates...');
      channel.unsubscribe();
    };
  }, [currentUserId, fetchRooms, fetchRoomInvites]);

  const handleNotificationPress = async (notification: any) => {
    await markAsRead(notification.id);
    setShowNotifications(false);
    if (notification.type === 'friend_request') {
      router.push('/friends' as any);
    } else if (notification.type === 'room_invite') {
      setActiveTab('invites');
    } else if ((notification.type === 'room_update' || notification.type === 'canvas_update') && notification.related_id) {
      router.push(`/rooms/${notification.related_id}/canvas` as any);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await handleFetchRooms();
    setRefreshing(false);
  };

  const handleOpenRoom = (roomId: string) => {
    router.push(`/rooms/${roomId}/canvas` as any);
  };

  const handleAcceptInvite = async (roomId: string, roomName: string) => {
    const res = await acceptRoomInvite(roomId);
    if (res.success) {
      Alert.alert('Joined Room', `You have joined the room "${roomName}".`);
    } else {
      Alert.alert('Error', res.error || 'Failed to join room.');
    }
  };

  const handleDeclineInvite = async (roomId: string, roomName: string) => {
    Alert.alert(
      'Decline Invite',
      `Are you sure you want to decline the invite to "${roomName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            const res = await declineRoomInvite(roomId);
            if (!res.success) {
              Alert.alert('Error', res.error || 'Failed to decline invite.');
            }
          },
        },
      ]
    );
  };

  const renderInviteItem = ({ item }: { item: RoomInvite }) => {
    const room = item.room;
    if (!room) return null;
    const ownerName = room.owner_profile?.display_name || room.owner_profile?.username || 'Unknown Owner';
    const ownerUser = room.owner_profile?.username ? `@${room.owner_profile.username}` : '';

    return (
      <View style={[styles.inviteCardRow, { borderBottomColor: theme.backgroundSelected || '#2E3135' }]}>
        <View style={[styles.inviteAvatar, { backgroundColor: 'rgba(124, 124, 240, 0.15)' }]}>
          <Ionicons name="mail-open-outline" size={20} color="#7C7CF0" />
        </View>
        <View style={styles.inviteInfo}>
          <ThemedText style={styles.inviteRoomName} type="smallBold">
            {room.name}
          </ThemedText>
          <ThemedText style={styles.inviteOwnerText} type="code">
            Invited by: {ownerName} {ownerUser}
          </ThemedText>
        </View>
        <View style={styles.inviteActions}>
          <Pressable
            onPress={() => handleDeclineInvite(room.id, room.name)}
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
            onPress={() => handleAcceptInvite(room.id, room.name)}
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
        </View>
      </View>
    );
  };

  const handleOpenOptions = (room: Room) => {
    setSelectedRoom(room);
    setShowOptionsSheet(true);
  };

  const handleCloseOptions = () => {
    setShowOptionsSheet(false);
    setSelectedRoom(null);
  };

  const handleInvitePress = () => {
    setShowOptionsSheet(false);
    // Open invite sheet
    setTimeout(() => {
      setShowInviteSheet(true);
    }, 300); // Small timeout to allow options sheet to dismiss smoothly
  };

  const handleDeletePress = () => {
    if (!selectedRoom) return;
    const roomId = selectedRoom.id;

    Alert.alert(
      'Delete Room',
      `Are you sure you want to delete "${selectedRoom.name}"? This will permanently delete the room and all its drawing content for everyone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setShowOptionsSheet(false);
            const result = await deleteRoom(roomId);
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete room.');
            }
          },
        },
      ]
    );
  };

  const handleLeavePress = () => {
    if (!selectedRoom) return;
    const roomId = selectedRoom.id;

    Alert.alert(
      'Leave Room',
      `Are you sure you want to leave "${selectedRoom.name}"? You will lose access to this canvas unless you are invited back.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setShowOptionsSheet(false);
            const result = await leaveRoom(roomId);
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to leave room.');
            }
          },
        },
      ]
    );
  };

  const isOwner = selectedRoom?.owner_id === currentUserId;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <ThemedText style={styles.title} type="subtitle">
            Canvases
          </ThemedText>
          <ThemedText style={styles.subtitle} type="code">
            Create or join collaborative rooms
          </ThemedText>
        </View>
        <Pressable
          onPress={() => {
            setDismissingIds([]);
            setShowNotifications(true);
          }}
          style={({ pressed }) => [
            styles.bellButton,
            {
              backgroundColor: pressed ? theme.backgroundSelected || '#2E3135' : 'transparent',
            },
          ]}
        >
          <Ionicons name="notifications-outline" size={24} color={theme.text} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <Pressable
          onPress={() => setActiveTab('active')}
          style={[
            styles.tab,
            activeTab === 'active' && { borderBottomColor: '#7C7CF0', borderBottomWidth: 2 },
          ]}
        >
          <ThemedText
            style={[
              styles.tabText,
              { color: activeTab === 'active' ? '#7C7CF0' : theme.textSecondary || '#B0B4BA' },
            ]}
            type="smallBold"
          >
            Canvases ({rooms.length})
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('invites')}
          style={[
            styles.tab,
            activeTab === 'invites' && { borderBottomColor: '#7C7CF0', borderBottomWidth: 2 },
          ]}
        >
          <ThemedText
            style={[
              styles.tabText,
              { color: activeTab === 'invites' ? '#7C7CF0' : theme.textSecondary || '#B0B4BA' },
            ]}
            type="smallBold"
          >
            Invites ({roomInvites.length})
          </ThemedText>
        </Pressable>
      </View>

      {/* Main List / Content */}
      {isLoading && rooms.length === 0 && roomInvites.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#7C7CF0" />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="warning-outline" size={48} color={(theme as any).destructive || '#ef4444'} />
          <ThemedText style={styles.errorText} type="smallBold">
            {error}
          </ThemedText>
          <Pressable
            style={[styles.retryButton, { backgroundColor: '#7C7CF0' }]}
            onPress={handleFetchRooms}
          >
            <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>
              Retry
            </ThemedText>
          </Pressable>
        </View>
      ) : activeTab === 'active' ? (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContainer, rooms.length === 0 && { flexGrow: 1, justifyContent: 'center' }]}
          renderItem={({ item }) => (
            <RoomCard
              room={item}
              currentUserId={currentUserId}
              onPress={() => handleOpenRoom(item.id)}
              onOptionsPress={() => handleOpenOptions(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: theme.backgroundSelected || '#2E3135' }]}>
                <Ionicons name="color-palette-outline" size={48} color="#7C7CF0" />
              </View>
              <ThemedText style={styles.emptyTitle} type="smallBold">
                No rooms yet
              </ThemedText>
              <ThemedText style={styles.emptySubtitle} type="code">
                Tap the + button to create a new collaborative canvas room or ask a friend for a link.
              </ThemedText>
              <Pressable
                style={[styles.createButton, { backgroundColor: '#7C7CF0' }]}
                onPress={() => router.push('/rooms/new')}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>
                  Create Canvas
                </ThemedText>
              </Pressable>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7C7CF0"
              colors={['#7C7CF0']}
            />
          }
        />
      ) : (
        <FlatList
          data={roomInvites}
          keyExtractor={(item) => item.room_id}
          contentContainerStyle={[styles.listContainer, roomInvites.length === 0 && { flexGrow: 1, justifyContent: 'center' }]}
          renderItem={renderInviteItem}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: theme.backgroundSelected || '#2E3135' }]}>
                <Ionicons name="mail-outline" size={48} color="#7C7CF0" />
              </View>
              <ThemedText style={styles.emptyTitle} type="smallBold">
                No invites yet
              </ThemedText>
              <ThemedText style={styles.emptySubtitle} type="code">
                Canvas collaboration invites from your friends will appear here.
              </ThemedText>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7C7CF0"
              colors={['#7C7CF0']}
            />
          }
        />
      )}

      {/* Floating Action Button (Only show on active canvases tab) */}
      {activeTab === 'active' && (
        <Pressable
          onPress={() => router.push('/rooms/new')}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: '#7C7CF0',
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}

      {/* Options Menu Bottom Sheet */}
      <Sheet
        visible={showOptionsSheet}
        onClose={handleCloseOptions}
        title={selectedRoom?.name || 'Room Options'}
      >
        <View style={styles.optionsContainer}>
          {/* Invite Collaborator Option */}
          <Pressable
            onPress={handleInvitePress}
            style={({ pressed }) => [
              styles.optionItem,
              { backgroundColor: pressed ? theme.backgroundSelected || '#2E3135' : 'transparent' },
            ]}
          >
            <Ionicons name="person-add-outline" size={20} color={theme.text} />
            <ThemedText style={styles.optionText} type="small">
              Invite Collaborators
            </ThemedText>
          </Pressable>

          {/* Delete Option (Owners only) */}
          {isOwner ? (
            <Pressable
              onPress={handleDeletePress}
              style={({ pressed }) => [
                styles.optionItem,
                { backgroundColor: pressed ? theme.backgroundSelected || '#2E3135' : 'transparent' },
              ]}
            >
              <Ionicons name="trash-outline" size={20} color={(theme as any).destructive || '#ef4444'} />
              <ThemedText
                style={[styles.optionText, { color: (theme as any).destructive || '#ef4444' }]}
                type="small"
              >
                Delete Room (Permanent)
              </ThemedText>
            </Pressable>
          ) : (
            /* Leave Option (Collaborators only) */
            <Pressable
              onPress={handleLeavePress}
              style={({ pressed }) => [
                styles.optionItem,
                { backgroundColor: pressed ? theme.backgroundSelected || '#2E3135' : 'transparent' },
              ]}
            >
              <Ionicons name="exit-outline" size={20} color={(theme as any).destructive || '#ef4444'} />
              <ThemedText
                style={[styles.optionText, { color: (theme as any).destructive || '#ef4444' }]}
                type="small"
              >
                Leave Room
              </ThemedText>
            </Pressable>
          )}
        </View>
      </Sheet>

      {/* Invite Friends Bottom Sheet */}
      {selectedRoom && (
        <InviteSheet
          visible={showInviteSheet}
          onClose={() => {
            setShowInviteSheet(false);
            setSelectedRoom(null);
          }}
          roomId={selectedRoom.id}
          roomName={selectedRoom.name}
        />
      )}

      {/* Notifications Side Drawer */}
      <SideDrawer
        visible={showNotifications}
        onClose={() => {
          setShowNotifications(false);
          setDismissingIds([]);
        }}
        title="Notifications"
      >
        <View style={styles.notificationsContainer}>
          {unreadNotifications.length > 0 && (
            <Pressable
              onPress={handleMarkAllAsRead}
              style={({ pressed }) => [
                styles.markAllReadBtn,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <ThemedText style={{ color: '#7C7CF0', fontSize: 13 }} type="smallBold">
                Mark all as read
              </ThemedText>
            </Pressable>
          )}

          {unreadNotifications.length === 0 ? (
            <View style={styles.noNotifications}>
              <Ionicons name="notifications-off-outline" size={36} color={theme.textSecondary || '#B0B4BA'} style={{ marginBottom: 8 }} />
              <ThemedText style={styles.noNotificationsText} type="code">
                No notifications yet.
              </ThemedText>
            </View>
          ) : (
            <FlatList
              data={unreadNotifications}
              keyExtractor={(item) => item.id}
              style={styles.notificationsScroll}
              renderItem={({ item }) => {
                const iconName = 
                  item.type === 'friend_request' ? 'person-add-outline' :
                  item.type === 'room_invite' ? 'mail-open-outline' :
                  'color-palette-outline';
                
                const isDismissed = dismissingIds.includes(item.id);

                return (
                  <SwipeableNotificationItem
                    id={item.id}
                    dismissTriggered={isDismissed}
                    onDismiss={() => {
                      if (isDismissed) {
                        markAsRead(item.id);
                      } else {
                        deleteNotification(item.id);
                      }
                    }}
                  >
                    <Pressable
                      onPress={() => handleNotificationPress(item)}
                      style={({ pressed }) => [
                        styles.notificationItem,
                        {
                          backgroundColor: pressed 
                            ? theme.backgroundSelected || '#2E3135' 
                            : 'rgba(124, 124, 240, 0.05)',
                          borderBottomColor: theme.backgroundSelected || '#2E3135',
                        },
                      ]}
                    >
                      <View style={[styles.notificationIcon, { backgroundColor: 'rgba(124, 124, 240, 0.15)' }]}>
                        <Ionicons name={iconName} size={16} color="#7C7CF0" />
                      </View>
                      <View style={styles.notificationContent}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <ThemedText style={[styles.notificationTitle, { fontWeight: '700' }]} type="smallBold">
                            {item.title}
                          </ThemedText>
                          <View style={styles.unreadDot} />
                        </View>
                        <ThemedText style={styles.notificationMessage} type="code">
                          {item.message}
                        </ThemedText>
                      </View>
                    </Pressable>
                  </SwipeableNotificationItem>
                );
              }}
            />
          )}
        </View>
      </SideDrawer>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  listContainer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: 120, // Space for custom tab bar
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
  },
  errorText: {
    textAlign: 'center',
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
    opacity: 0.8,
  },
  retryButton: {
    paddingHorizontal: 20,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: Spacing.one,
  },
  emptySubtitle: {
    fontSize: 13,
    opacity: 0.6,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.four,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    height: 48,
    borderRadius: 24,
    shadowColor: '#7C7CF0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 104, // Lifted above the custom tab bar container
    right: Spacing.four,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  optionsContainer: {
    paddingBottom: Spacing.two,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
    marginVertical: 2,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabText: {
    fontSize: 14,
  },
  inviteCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  inviteAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteInfo: {
    flex: 1,
    paddingHorizontal: Spacing.two,
  },
  inviteRoomName: {
    fontSize: 15,
    fontWeight: '700',
  },
  inviteOwnerText: {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 2,
  },
  inviteActions: {
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
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  notificationsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: Spacing.four,
  },
  markAllReadBtn: {
    alignSelf: 'flex-end',
    marginVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  noNotifications: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.five,
  },
  noNotificationsText: {
    fontSize: 12,
    opacity: 0.6,
  },
  notificationsScroll: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: Spacing.two,
    borderRadius: 10,
    borderBottomWidth: 0.5,
  },
  notificationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
  },
  notificationMessage: {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 2,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7C7CF0',
  },
});
