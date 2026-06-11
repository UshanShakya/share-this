import { useEffect, useState, useRef } from 'react';
import { Alert } from 'react-native';
import { useCanvasStore } from '../store/canvasStore';
import { useAuth } from './useAuth';
import { realtimeService, Collaborator } from '../lib/realtime';
import { supabase } from '../lib/supabaseClient';
import { Point, Stroke } from '../types/canvas';

export function useCanvas(roomId: string) {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const {
    strokes,
    remoteActiveStrokes,
    currentStroke,
    activeColor,
    activeWidth,
    activeTool,
    eraserMode,
    setStrokes,
    startLocalStroke,
    updateLocalStroke,
    endLocalStroke,
    undoLastLocalStroke,
    clearStrokes,
    setColor,
    setWidth,
    setTool,
    setEraserMode,
  } = useCanvasStore();

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Sync state during render when room changes to avoid effect cascades
  const [prevRoomId, setPrevRoomId] = useState(roomId);
  if (roomId !== prevRoomId) {
    setPrevRoomId(roomId);
    setHistoryLoading(true);
  }

  // References to keep callbacks and drawing loops hot without stale state closures
  const stateRef = useRef({
    userId,
    roomId,
    currentStroke,
    activeColor,
    activeWidth,
    activeTool,
  });

  useEffect(() => {
    stateRef.current = {
      userId,
      roomId,
      currentStroke,
      activeColor,
      activeWidth,
      activeTool,
    };
  }, [userId, roomId, currentStroke, activeColor, activeWidth, activeTool]);

  // Connect to realtime and load historical strokes
  useEffect(() => {
    if (!roomId || !userId) return;

    const loadHistoryAndJoin = async () => {
      try {
        // 1. Fetch full stroke history on room join
        const { data, error } = await supabase
          .from('strokes')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (data) {
          const dbStrokes: Stroke[] = data.map((d: any) => ({
            id: d.id,
            userId: d.user_id,
            roomId: d.room_id,
            points: d.points,
            color: d.color,
            width: Number(d.width),
            timestamp: new Date(d.created_at).getTime(),
            text: d.text,
          }));
          setStrokes(dbStrokes);
        }
      } catch (err) {
        console.error('Failed to load canvas history:', err);
      } finally {
        setHistoryLoading(false);
      }

      // 2. Join the Supabase broadcast channel
      await realtimeService.joinRoom(roomId, userId, (onlineUsers) => {
        // Filter out self from online collaborators
        setCollaborators(onlineUsers.filter((u) => u.userId !== userId));
      });
    };

    loadHistoryAndJoin();

    return () => {
      realtimeService.leaveRoom();
    };
  }, [roomId, userId, setStrokes]);

  // Touch drawing handlers
  const startDrawing = (x: number, y: number) => {
    if (!userId) return;
    const startPoint: Point = { x, y };
    startLocalStroke(startPoint);
    realtimeService.broadcastDraw(
      userId,
      [startPoint],
      stateRef.current.activeColor,
      stateRef.current.activeWidth,
      stateRef.current.activeTool
    );
  };

  const draw = (x: number, y: number) => {
    if (!userId || !stateRef.current.currentStroke) return;
    
    // Performance optimization (Task 3.16): distance-threshold filtering
    // Only register and broadcast points if the cursor has moved by at least 2 pixels
    const points = stateRef.current.currentStroke;
    const lastPoint = points[points.length - 1];
    const distance = Math.hypot(x - lastPoint.x, y - lastPoint.y);

    if (distance >= 2) {
      const nextPoint = { x, y };
      updateLocalStroke(nextPoint);
      
      // Broadcast local points path to peers in real-time
      realtimeService.broadcastDraw(
        userId,
        [...points, nextPoint],
        stateRef.current.activeColor,
        stateRef.current.activeWidth,
        stateRef.current.activeTool
      );
    }
  };

  const endDrawing = () => {
    if (!userId || !roomId || !stateRef.current.currentStroke) return;

    // Generate unique ID for database syncing
    const strokeId = generateUUID();
    
    const stroke = endLocalStroke(strokeId, userId, roomId);
    
    if (stroke) {
      // 1. Broadcast stroke finished event
      realtimeService.broadcastDrawEnd(userId, stroke);
      
      // 2. Persist to database in the background (prevents blocking)
      supabase
        .from('strokes')
        .insert({
          id: stroke.id,
          room_id: stroke.roomId,
          user_id: stroke.userId,
          points: stroke.points,
          color: stroke.color,
          width: stroke.width,
        })
        .then(({ error }) => {
          if (error) {
            console.error('Error saving stroke:', error.message);
          }
        });
    }
  };

  const undo = () => {
    if (!userId) return;

    // 1. Undo local state and retrieve ID
    const undoneId = undoLastLocalStroke(userId);

    if (undoneId) {
      // 2. Broadcast undo to other users
      realtimeService.broadcastUndo(undoneId);

      // 3. Delete from remote database
      supabase
        .from('strokes')
        .delete()
        .eq('id', undoneId)
        .then(({ error }) => {
          if (error) {
            console.error('Error undoing stroke in DB:', error.message);
          }
        });
    }
  };

  const clear = () => {
    if (!userId || !roomId) return;

    AlertConfirm('Clear Canvas', 'Are you sure you want to clear the entire canvas for everyone?', () => {
      // 1. Clear state locally
      clearStrokes();

      // 2. Broadcast clear event to collaborators
      realtimeService.broadcastClear();

      // 3. Delete all strokes of the room in the database
      supabase
        .from('strokes')
        .delete()
        .eq('room_id', roomId)
        .then(({ error }) => {
          if (error) {
            console.error('Error clearing strokes in DB:', error.message);
          }
        });
    });
  };

  const addTextStroke = (text: string, x: number, y: number) => {
    if (!userId || !roomId || !text.trim()) return;

    const strokeId = generateUUID();

    // Font size scaling based on brush size selection:
    let fontSize = 20;
    if (activeWidth === 3) fontSize = 16;
    if (activeWidth === 12) fontSize = 32;

    const stroke: Stroke = {
      id: strokeId,
      userId,
      roomId,
      points: [{ x, y }],
      color: activeColor,
      width: fontSize,
      timestamp: Date.now(),
      text: text.trim(),
    };

    // 1. Add locally
    useCanvasStore.getState().addStroke(stroke);

    // 2. Broadcast
    realtimeService.broadcastDrawEnd(userId, stroke);

    // 3. Persist to DB in the background
    supabase
      .from('strokes')
      .insert({
        id: stroke.id,
        room_id: stroke.roomId,
        user_id: stroke.userId,
        points: stroke.points,
        color: stroke.color,
        width: stroke.width,
        text: stroke.text,
      })
      .then(({ error }) => {
        if (error) {
          console.error('Error saving text stroke:', error.message);
        }
      });
  };

  const deleteStroke = (strokeId: string) => {
    // 1. Delete locally
    useCanvasStore.setState((state) => ({
      strokes: state.strokes.filter((s) => s.id !== strokeId),
    }));

    // 2. Broadcast deletion
    realtimeService.broadcastUndo(strokeId);

    // 3. Delete from DB
    supabase
      .from('strokes')
      .delete()
      .eq('id', strokeId)
      .then(({ error }) => {
        if (error) {
          console.error('Error deleting stroke:', error.message);
        }
      });
  };

  return {
    strokes,
    remoteActiveStrokes,
    currentStroke,
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
    clear,
    addTextStroke,
    deleteStroke,
    
    setColor,
    setWidth,
    setTool,
    setEraserMode,
  };
}

function AlertConfirm(title: string, message: string, onConfirm: () => void) {
  if (typeof window !== 'undefined' && window.confirm) {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

// RFC4122 v4 compliant UUID generator for offline fallbacks
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
