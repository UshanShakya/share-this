import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRoom } from '@/hooks/useRoom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { InviteSheet } from '@/components/InviteSheet';
import { Canvas } from '@/components/Canvas';
import { StrokeToolbar } from '@/components/StrokeToolbar';
import { AvatarStack } from '@/components/AvatarStack';
import { useCanvas } from '@/hooks/useCanvas';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabaseClient';

export default function CanvasScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const {
    activeRoom,
    setActiveRoom,
    clearActiveRoom,
  } = useRoom();

  const [isVerifying, setIsVerifying] = useState(true);
  const [needsToJoin, setNeedsToJoin] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const currentUserId = session?.user?.id;

  // Initialize canvas drawing hook when room is verified
  const {
    activeColor,
    activeWidth,
    activeTool,
    eraserMode,
    collaborators,
    historyLoading,
    startDrawing,
    draw,
    endDrawing,
    undo,
    redo,
    clear,
    addTextStroke,
    deleteStroke,
    editText,
    moveObject,
    eraseStrokes,
    setColor,
    setWidth,
    setTool,
    setEraserMode,
  } = useCanvas(roomId || '');

  // Verify membership and load room details
  const verifyMembershipAndLoad = useCallback(async () => {
    if (!roomId || !currentUserId) return;

    setIsVerifying(true);
    try {
      // 1. Check if user is already a member
      const { data: memberData, error: memberErr } = await supabase
        .from('room_members')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', currentUserId);

      if (memberErr) throw memberErr;

      if (memberData && memberData.length > 0) {
        // User is a member, fetch room details
        const { data: roomData, error: roomErr } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single();

        if (roomErr) throw roomErr;

        setActiveRoom(roomData);
        setNeedsToJoin(false);
      } else {
        // User is not a member, prompt to join
        setNeedsToJoin(true);
      }
    } catch (err: any) {
      console.warn('[CanvasScreen verifyMembership] Verification error:', err.message || err);
      setNeedsToJoin(true);
    } finally {
      setIsVerifying(false);
    }
  }, [roomId, currentUserId, setActiveRoom]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    verifyMembershipAndLoad();

    return () => {
      clearActiveRoom();
    };
  }, [verifyMembershipAndLoad, clearActiveRoom]);

  const handleJoinRoom = async () => {
    if (!roomId || !currentUserId) return;
    setIsVerifying(true);

    try {
      // Attempt to self-join
      const { error: joinErr } = await supabase
        .from('room_members')
        .insert({
          room_id: roomId,
          user_id: currentUserId,
        });

      if (joinErr && joinErr.code !== '23505') {
        throw joinErr;
      }

      // Fetch room details
      const { data: roomData, error: roomErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomErr) {
        throw new Error('Room not found or deleted by owner.');
      }

      setActiveRoom(roomData);
      setNeedsToJoin(false);
    } catch (err: any) {
      Alert.alert(
        'Cannot Join Room',
        err.message || 'This room does not exist or you do not have permission to join.',
        [{ text: 'OK', onPress: () => router.replace('/rooms' as any) }]
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBack = () => {
    router.replace('/rooms' as any);
  };

  const handleOpenMembers = () => {
    if (roomId) {
      router.push(`/rooms/${roomId}/members` as any);
    }
  };

  // 1. Loading screen
  if (isVerifying) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#7C7CF0" />
        <ThemedText style={{ marginTop: Spacing.two }} type="code">
          Verifying connection...
        </ThemedText>
      </ThemedView>
    );
  }

  // 2. Joining Prompt screen
  if (needsToJoin) {
    return (
      <ThemedView style={styles.centerContainer}>
        <SafeAreaView style={styles.joinCard}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="mail-open-outline" size={48} color="#7C7CF0" />
          </View>
          <ThemedText style={styles.joinTitle} type="smallBold">
            {"You've been invited!"}
          </ThemedText>
          <ThemedText style={styles.joinSubtitle} type="code">
            Would you like to join this collaborative drawing canvas and draw with other members?
          </ThemedText>

          <View style={styles.joinButtonRow}>
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [
                styles.joinButton,
                {
                  backgroundColor: theme.backgroundSelected || '#2E3135',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <ThemedText type="smallBold">Cancel</ThemedText>
            </Pressable>

            <Pressable
              onPress={handleJoinRoom}
              style={({ pressed }) => [
                styles.joinButton,
                {
                  backgroundColor: '#7C7CF0',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>
                Join & Draw
              </ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Canvas Toolbar / Header */}
        <View style={[styles.toolbar, { borderBottomColor: theme.backgroundSelected || '#2E3135' }]}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [
              styles.toolbarButton,
              { backgroundColor: pressed ? theme.backgroundSelected || '#2E3135' : 'transparent' },
            ]}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>

          <View style={styles.titleContainer}>
            <ThemedText numberOfLines={1} style={styles.roomName} type="smallBold">
              {activeRoom?.name || 'Loading room...'}
            </ThemedText>
            <AvatarStack collaborators={collaborators} />
          </View>

          <View style={styles.toolbarActions}>
            <Pressable
              onPress={() => setShowInviteSheet(true)}
              style={({ pressed }) => [
                styles.toolbarButton,
                { backgroundColor: pressed ? theme.backgroundSelected || '#2E3135' : 'transparent' },
              ]}
            >
              <Ionicons name="person-add-outline" size={22} color={theme.text} />
            </Pressable>

            <Pressable
              onPress={handleOpenMembers}
              style={({ pressed }) => [
                styles.toolbarButton,
                { backgroundColor: pressed ? theme.backgroundSelected || '#2E3135' : 'transparent' },
              ]}
            >
              <Ionicons name="people-outline" size={24} color={theme.text} />
            </Pressable>
          </View>
        </View>

        {/* Drawing Canvas Area */}
        <View style={[styles.canvasArea, { backgroundColor: theme.background || '#000000' }]}>
          {/* Subtle Canvas Dot Grid Background */}
          <View style={styles.gridOverlay} pointerEvents="none">
            <View style={styles.dotGridRow}>
              <View style={[styles.gridDot, { backgroundColor: theme.textSecondary || '#B0B4BA' }]} />
              <View style={[styles.gridDot, { backgroundColor: theme.textSecondary || '#B0B4BA' }]} />
              <View style={[styles.gridDot, { backgroundColor: theme.textSecondary || '#B0B4BA' }]} />
            </View>
          </View>

          <Canvas
            historyLoading={historyLoading}
            startDrawing={startDrawing}
            draw={draw}
            endDrawing={endDrawing}
            addTextStroke={addTextStroke}
            deleteStroke={deleteStroke}
            redo={redo}
            editText={editText}
            moveObject={moveObject}
            eraseStrokes={eraseStrokes}
          />

          {/* Floating Settings StrokeToolbar */}
          <View style={styles.floatingToolbarContainer} pointerEvents="box-none">
            <StrokeToolbar
              activeColor={activeColor}
              activeWidth={activeWidth}
              activeTool={activeTool}
              eraserMode={eraserMode}
              setColor={setColor}
              setWidth={setWidth}
              setTool={setTool}
              setEraserMode={setEraserMode}
              undo={undo}
              redo={redo}
              clear={clear}
            />
          </View>
        </View>
      </SafeAreaView>

      {/* Invite Friends Modal */}
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
  },
  joinCard: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 400,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(124, 124, 240, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  joinTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: Spacing.one,
  },
  joinSubtitle: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.four,
  },
  joinButtonRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    width: '100%',
  },
  joinButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    height: 56,
    borderBottomWidth: 1,
  },
  titleContainer: {
    flex: 1,
    paddingHorizontal: Spacing.two,
    justifyContent: 'center',
  },
  roomName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toolbarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasArea: {
    flex: 1,
    position: 'relative',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.05,
    zIndex: 0,
  },
  dotGridRow: {
    flexDirection: 'row',
    gap: 30,
  },
  gridDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  floatingToolbarContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 10,
  },
});
