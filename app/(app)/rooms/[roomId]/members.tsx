import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRoom } from '@/hooks/useRoom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { InviteSheet } from '@/components/InviteSheet';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';

export default function MembersScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const {
    activeRoom,
    activeRoomMembers,
    isLoading,
    fetchMembers,
    removeMember,
  } = useRoom();

  const [refreshing, setRefreshing] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const currentUserId = session?.user?.id;

  const handleFetchMembers = useCallback(async () => {
    if (roomId) {
      await fetchMembers(roomId);
    }
  }, [roomId, fetchMembers]);

  useEffect(() => {
    handleFetchMembers();
  }, [handleFetchMembers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await handleFetchMembers();
    setRefreshing(false);
  };

  const handleRemoveMember = (userId: string, username: string) => {
    if (!roomId) return;

    Alert.alert(
      'Remove Collaborator',
      `Are you sure you want to remove "${username}" from this room? They will lose access to this canvas.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await removeMember(roomId, userId);
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to remove member.');
            }
          },
        },
      ]
    );
  };

  const handleClose = () => {
    router.back();
  };

  const isOwner = activeRoom?.owner_id === currentUserId;

  const getInitials = (displayName: string | null, username: string | null) => {
    const name = displayName || username || 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.closeButton,
              { backgroundColor: pressed ? theme.backgroundSelected || '#2E3135' : 'transparent' },
            ]}
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle} type="smallBold">
            Collaborators
          </ThemedText>
          <View style={styles.placeholder} />
        </View>

        {/* Member list */}
        {isLoading && activeRoomMembers.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#7C7CF0" />
          </View>
        ) : (
          <FlatList
            data={activeRoomMembers}
            keyExtractor={(item) => item.user_id}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#7C7CF0"
                colors={['#7C7CF0']}
              />
            }
            renderItem={({ item }) => {
              const profile = item.profiles;
              const displayName = profile?.display_name || 'Anonymous User';
              const username = profile?.username || 'anonymous';
              const isItemOwner = activeRoom?.owner_id === item.user_id;
              const isSelf = currentUserId === item.user_id;

              return (
                <View
                  style={[
                    styles.memberRow,
                    { borderBottomColor: theme.backgroundSelected || '#2E3135' },
                  ]}
                >
                  {/* Avatar fallback / Image */}
                  {profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: isItemOwner ? 'rgba(91, 91, 214, 0.2)' : 'rgba(96, 100, 108, 0.2)' },
                      ]}
                    >
                      <ThemedText
                        style={[styles.avatarText, { color: isItemOwner ? '#7C7CF0' : theme.text }]}
                        type="smallBold"
                      >
                        {getInitials(displayName, username)}
                      </ThemedText>
                    </View>
                  )}

                  {/* Details */}
                  <View style={styles.detailsContainer}>
                    <View style={styles.nameRow}>
                      <ThemedText style={styles.displayName} type="smallBold">
                        {displayName} {isSelf && '(You)'}
                      </ThemedText>
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: isItemOwner
                              ? 'rgba(91, 91, 214, 0.15)'
                              : item.status === 'pending'
                              ? 'rgba(239, 68, 68, 0.12)'
                              : 'rgba(96, 100, 108, 0.12)',
                          },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.badgeText,
                            {
                              color: isItemOwner
                                ? '#7C7CF0'
                                : item.status === 'pending'
                                ? '#ef4444'
                                : theme.textSecondary || '#B0B4BA',
                            },
                          ]}
                          type="code"
                        >
                          {isItemOwner
                            ? 'OWNER'
                            : item.status === 'pending'
                            ? 'INVITED'
                            : 'COLLABORATOR'}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText style={styles.username} type="code">
                      @{username}
                    </ThemedText>
                  </View>

                  {/* Remove Button (Visible to Owner, except for Owner themselves) */}
                  {isOwner && !isItemOwner && (
                    <Pressable
                      onPress={() => handleRemoveMember(item.user_id, displayName)}
                      style={({ pressed }) => [
                        styles.removeButton,
                        {
                          backgroundColor: pressed ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                        },
                      ]}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={20} color={(theme as any).destructive || '#ef4444'} />
                    </Pressable>
                  )}
                </View>
              );
            }}
          />
        )}

        {/* Footer actions */}
        <View style={[styles.footer, { borderTopColor: theme.backgroundSelected || '#2E3135' }]}>
          <Pressable
            onPress={() => setShowInviteSheet(true)}
            style={({ pressed }) => [
              styles.inviteButton,
              {
                backgroundColor: '#7C7CF0',
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons name="person-add-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>
              Invite Collaborators
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Invite Sheet modal overlay */}
      {activeRoom && (
        <InviteSheet
          visible={showInviteSheet}
          onClose={() => setShowInviteSheet(false)}
          roomId={activeRoom.id}
          roomName={activeRoom.name}
        />
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    height: 56,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: 100,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.three,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: Spacing.three,
  },
  avatarText: {
    fontSize: 15,
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '600',
  },
  username: {
    fontSize: 12,
    opacity: 0.6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: Spacing.four,
    borderTopWidth: 1,
  },
  inviteButton: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C7CF0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
