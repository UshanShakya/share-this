import React from 'react';
import { StyleSheet, Pressable, View } from 'react-native';
import { Room } from '../types/room';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';

interface RoomCardProps {
  room: Room;
  currentUserId?: string;
  onPress: () => void;
  onOptionsPress: () => void;
}

export function RoomCard({ room, currentUserId, onPress, onOptionsPress }: RoomCardProps) {
  const theme = useTheme();
  const isOwner = room.owner_id === currentUserId;
  const formattedDate = new Date(room.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.backgroundElement || '#212225',
          borderColor: theme.backgroundSelected || '#2E3135',
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: isOwner ? 'rgba(91, 91, 214, 0.15)' : 'rgba(96, 100, 108, 0.15)' },
            ]}
          >
            <Ionicons
              name={isOwner ? 'color-palette' : 'people'}
              size={24}
              color={isOwner ? '#7C7CF0' : theme.textSecondary || '#B0B4BA'}
            />
          </View>
          <View style={styles.textContainer}>
            <ThemedText style={styles.roomName} type="smallBold">
              {room.name}
            </ThemedText>
            <ThemedText style={styles.dateText} type="code">
              Created {formattedDate}
            </ThemedText>
          </View>
        </View>

        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onOptionsPress();
          }}
          style={({ pressed }) => [
            styles.optionsButton,
            {
              backgroundColor: pressed ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
            },
          ]}
          hitSlop={8}
        >
          <Ionicons
            name="ellipsis-vertical"
            size={20}
            color={theme.textSecondary || '#B0B4BA'}
          />
        </Pressable>
      </View>

      <View style={styles.cardFooter}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: isOwner ? 'rgba(91, 91, 214, 0.15)' : 'rgba(96, 100, 108, 0.12)',
            },
          ]}
        >
          <ThemedText
            style={[
              styles.badgeText,
              { color: isOwner ? '#7C7CF0' : theme.textSecondary || '#B0B4BA' },
            ]}
            type="code"
          >
            {isOwner ? 'OWNER' : 'COLLABORATOR'}
          </ThemedText>
        </View>
        
        <View style={styles.enterContainer}>
          <ThemedText
            style={[styles.enterText, { color: '#7C7CF0' }]}
            type="smallBold"
          >
            Draw
          </ThemedText>
          <Ionicons name="arrow-forward" size={16} color="#7C7CF0" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.two,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  roomName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 11,
    opacity: 0.6,
  },
  optionsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  enterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  enterText: {
    fontSize: 14,
  },
});
