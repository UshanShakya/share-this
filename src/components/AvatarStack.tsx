import React from 'react';
import { StyleSheet, View, Text, useColorScheme, Image } from 'react-native';
import { Collaborator } from '../lib/realtime';
import { Colors } from '../constants/Colors';

interface AvatarStackProps {
  collaborators: Collaborator[];
}

const COLLAB_COLORS = [
  '#4CAF50', // Green
  '#E91E63', // Pink
  '#00BCD4', // Cyan
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#3F51B5', // Indigo
];

export function AvatarStack({ collaborators }: AvatarStackProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'light' ? 'light' : 'dark'];

  if (collaborators.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.offlineDot} />
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>Just you here</Text>
      </View>
    );
  }

  // Get color based on hash of username/id
  const getAvatarBg = (username: string) => {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % COLLAB_COLORS.length;
    return COLLAB_COLORS[index];
  };

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  // Render max 4 avatars, show +X for the rest
  const visibleCollabs = collaborators.slice(0, 4);
  const extraCount = collaborators.length - visibleCollabs.length;

  return (
    <View style={styles.container}>
      <View style={styles.stack}>
        {visibleCollabs.map((collab, index) => {
          const initials = getInitials(collab.display_name || collab.username);
          const bgColor = getAvatarBg(collab.username);
          const borderColor = scheme === 'dark' ? '#111111' : '#FFFFFF';
          const zIndex = visibleCollabs.length - index;
          
          return collab.avatar_url ? (
            <Image
              key={collab.userId}
              source={{ uri: collab.avatar_url }}
              style={[
                styles.avatarImage,
                {
                  borderColor,
                  zIndex,
                },
              ]}
            />
          ) : (
            <View
              key={collab.userId}
              style={[
                styles.avatarCircle,
                {
                  backgroundColor: bgColor,
                  borderColor,
                  zIndex,
                },
              ]}
            >
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          );
        })}

        {extraCount > 0 && (
          <View
            style={[
              styles.avatarCircle,
              styles.extraCircle,
              {
                backgroundColor: scheme === 'dark' ? '#222222' : '#E0E0E0',
                borderColor: scheme === 'dark' ? '#111111' : '#FFFFFF',
                zIndex: 0,
              },
            ]}
          >
            <Text style={[styles.avatarText, styles.extraText, { color: colors.text }]}>+{extraCount}</Text>
          </View>
        )}
      </View>

      <Text style={[styles.statusText, { color: colors.textSecondary }]}>
        {collaborators.length} {collaborators.length === 1 ? 'other' : 'others'} drawing
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9E9E9E',
  },
  stack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
    elevation: 1,
  },
  avatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    marginRight: -8,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  extraCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 0,
  },
  extraText: {
    fontWeight: '700',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
