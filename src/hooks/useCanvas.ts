import { useEffect, useState, useRef } from 'react';
import { Alert } from 'react-native';
import { useCanvasStore } from '../store/canvasStore';
import { useAuth } from './useAuth';
import { realtimeService, Collaborator } from '../lib/realtime';
import { supabase } from '../lib/supabaseClient';
import { Point, Stroke, Command } from '../types/canvas';
import { sharedStorage } from '../lib/sharedStorage';

export function useCanvas(roomId: string) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  // Actions
  const setStrokes = useCanvasStore((state) => state.setStrokes);
  const addStroke = useCanvasStore((state) => state.addStroke);
  const clearStrokes = useCanvasStore((state) => state.clearStrokes);

  // Active Tool/Color properties (needed by the UI toolbar in CanvasScreen)
  const activeColor = useCanvasStore((state) => state.activeColor);
  const activeWidth = useCanvasStore((state) => state.activeWidth);
  const activeTool = useCanvasStore((state) => state.activeTool);
  const eraserMode = useCanvasStore((state) => state.eraserMode);

  const setColor = useCanvasStore((state) => state.setColor);
  const setWidth = useCanvasStore((state) => state.setWidth);
  const setTool = useCanvasStore((state) => state.setTool);
  const setEraserMode = useCanvasStore((state) => state.setEraserMode);

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Sync state during render when room changes to avoid effect cascades
  const [prevRoomId, setPrevRoomId] = useState(roomId);
  if (roomId !== prevRoomId) {
    setPrevRoomId(roomId);
    setHistoryLoading(true);
  }

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

  // Sync strokes to shared storage for widget instant rendering
  useEffect(() => {
    if (!roomId) return;
    
    // Initial sync
    sharedStorage.syncActiveRoomStrokes(roomId, useCanvasStore.getState().strokes);

    // Sync on store changes
    const unsubscribe = useCanvasStore.subscribe((state) => {
      sharedStorage.syncActiveRoomStrokes(roomId, state.strokes);
    });
    return () => unsubscribe();
  }, [roomId]);

  // Touch drawing handlers
  const startDrawing = (x: number, y: number) => {
    if (!userId) return;
    const startPoint: Point = { x, y };
    
    const state = useCanvasStore.getState();
    realtimeService.broadcastDraw(
      userId,
      [startPoint],
      state.activeColor,
      state.activeWidth,
      state.activeTool
    );
  };

  const draw = (points: Point[]) => {
    if (!userId || points.length === 0) return;
    const state = useCanvasStore.getState();
    
    // Broadcast the accumulated points path to peers in real-time
    realtimeService.broadcastDraw(
      userId,
      points,
      state.activeColor,
      state.activeWidth,
      state.activeTool
    );
  };

  // Undo and Redo stacks private to this hook instance
  const undoStack = useRef<Command[]>([]);
  const redoStack = useRef<Command[]>([]);

  // DB Sync Helper Functions
  const saveStrokeToDB = (stroke: Stroke) => {
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
        if (error) console.error('Error saving stroke in DB:', error.message);
      });
  };

  const deleteStrokeFromDB = (id: string) => {
    supabase
      .from('strokes')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('Error deleting stroke in DB:', error.message);
      });
  };

  const updateTextInDB = (id: string, text: string) => {
    supabase
      .from('strokes')
      .update({ text })
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('Error updating text in DB:', error.message);
      });
  };

  const updatePointsInDB = (id: string, points: Point[]) => {
    supabase
      .from('strokes')
      .update({ points })
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('Error updating points in DB:', error.message);
      });
  };

  const updateColorInDB = (id: string, color: string) => {
    supabase
      .from('strokes')
      .update({ color })
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('Error updating color in DB:', error.message);
      });
  };

  const updateWidthInDB = (id: string, width: number) => {
    supabase
      .from('strokes')
      .update({ width })
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('Error updating width in DB:', error.message);
      });
  };

  // Symmetric Command Application and Inversion
  const applyCommand = (cmd: Command, isUndoOrRedo = false) => {
    if (!userId) return;

    switch (cmd.type) {
      case 'ADD_STROKE': {
        useCanvasStore.getState().addStroke(cmd.stroke);
        realtimeService.broadcastDrawEnd(userId, cmd.stroke);
        saveStrokeToDB(cmd.stroke);
        break;
      }
      case 'DELETE_STROKE': {
        useCanvasStore.setState((state) => ({
          strokes: state.strokes.filter((s) => s.id !== cmd.id),
        }));
        realtimeService.broadcastUndo(cmd.id);
        deleteStrokeFromDB(cmd.id);
        break;
      }
      case 'SPLIT_STROKE': {
        useCanvasStore.setState((state) => ({
          strokes: [...state.strokes.filter((s) => s.id !== cmd.originalId), ...cmd.newStrokes],
        }));
        realtimeService.broadcastUndo(cmd.originalId);
        cmd.newStrokes.forEach((s) => realtimeService.broadcastDrawEnd(userId, s));
        
        deleteStrokeFromDB(cmd.originalId);
        cmd.newStrokes.forEach(saveStrokeToDB);
        break;
      }
      case 'EDIT_TEXT': {
        const currentStroke = useCanvasStore.getState().strokes.find((s) => s.id === cmd.id);
        if (!currentStroke) return;
        const updatedStroke = {
          ...currentStroke,
          text: cmd.toText,
          timestamp: Date.now(),
        };
        useCanvasStore.setState((state) => ({
          strokes: state.strokes.map((s) => (s.id === cmd.id ? updatedStroke : s)),
        }));
        realtimeService.broadcastObjectUpdate(updatedStroke);
        updateTextInDB(cmd.id, cmd.toText);
        break;
      }
      case 'MOVE_OBJECT': {
        const currentStroke = useCanvasStore.getState().strokes.find((s) => s.id === cmd.id);
        if (!currentStroke) return;
        const updatedStroke = {
          ...currentStroke,
          points: cmd.toPoints,
          timestamp: Date.now(),
        };
        useCanvasStore.setState((state) => ({
          strokes: state.strokes.map((s) => (s.id === cmd.id ? updatedStroke : s)),
        }));
        realtimeService.broadcastObjectUpdate(updatedStroke);
        updatePointsInDB(cmd.id, cmd.toPoints);
        break;
      }
      case 'CHANGE_COLOR': {
        const currentStroke = useCanvasStore.getState().strokes.find((s) => s.id === cmd.id);
        if (!currentStroke) return;
        const updatedStroke = {
          ...currentStroke,
          color: cmd.toColor,
          timestamp: Date.now(),
        };
        useCanvasStore.setState((state) => ({
          strokes: state.strokes.map((s) => (s.id === cmd.id ? updatedStroke : s)),
        }));
        realtimeService.broadcastObjectUpdate(updatedStroke);
        updateColorInDB(cmd.id, cmd.toColor);
        break;
      }
      case 'CHANGE_WIDTH': {
        const currentStroke = useCanvasStore.getState().strokes.find((s) => s.id === cmd.id);
        if (!currentStroke) return;
        const updatedStroke = {
          ...currentStroke,
          width: cmd.toWidth,
          timestamp: Date.now(),
        };
        useCanvasStore.setState((state) => ({
          strokes: state.strokes.map((s) => (s.id === cmd.id ? updatedStroke : s)),
        }));
        realtimeService.broadcastObjectUpdate(updatedStroke);
        updateWidthInDB(cmd.id, cmd.toWidth);
        break;
      }
      case 'BATCH': {
        cmd.commands.forEach((c) => applyCommand(c, isUndoOrRedo));
        break;
      }
    }
  };

  const invertCommand = (cmd: Command): Command => {
    switch (cmd.type) {
      case 'ADD_STROKE':
        return { type: 'DELETE_STROKE', id: cmd.stroke.id, snapshot: cmd.stroke };
      case 'DELETE_STROKE':
        return { type: 'ADD_STROKE', stroke: cmd.snapshot };
      case 'SPLIT_STROKE':
        return {
          type: 'BATCH',
          commands: [
            ...cmd.newStrokes.map((s) => ({ type: 'DELETE_STROKE' as const, id: s.id, snapshot: s })),
            { type: 'ADD_STROKE' as const, stroke: cmd.originalSnapshot },
          ],
        };
      case 'EDIT_TEXT':
        return { ...cmd, fromText: cmd.toText, toText: cmd.fromText };
      case 'MOVE_OBJECT':
        return { ...cmd, fromPoints: cmd.toPoints, toPoints: cmd.fromPoints };
      case 'CHANGE_COLOR':
        return { ...cmd, fromColor: cmd.toColor, toColor: cmd.fromColor };
      case 'CHANGE_WIDTH':
        return { ...cmd, fromWidth: cmd.toWidth, toWidth: cmd.fromWidth };
      case 'BATCH':
        return {
          type: 'BATCH',
          commands: [...cmd.commands].reverse().map(invertCommand),
        };
    }
  };

  const executeCommand = (cmd: Command) => {
    applyCommand(cmd);
    undoStack.current.push(cmd);
    redoStack.current = []; // Clear redo stack on new action
  };

  const endDrawing = (points: Point[]) => {
    if (!userId || !roomId || points.length === 0) return;
    const state = useCanvasStore.getState();

    const finalColor = state.activeTool === 'eraser' ? 'eraser' : state.activeColor;
    const strokeId = generateUUID();
    
    const stroke: Stroke = {
      id: strokeId,
      userId,
      roomId,
      points,
      color: finalColor,
      width: state.activeWidth,
      timestamp: Date.now(),
    };
    
    executeCommand({ type: 'ADD_STROKE', stroke });
  };

  const undo = () => {
    const cmd = undoStack.current.pop();
    if (!cmd) return;
    const inverse = invertCommand(cmd);
    applyCommand(inverse, true);
    redoStack.current.push(cmd);
  };

  const redo = () => {
    const cmd = redoStack.current.pop();
    if (!cmd) return;
    applyCommand(cmd, true);
    undoStack.current.push(cmd);
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
    const state = useCanvasStore.getState();

    let fontSize = 20;
    if (state.activeWidth === 3) fontSize = 16;
    if (state.activeWidth === 12) fontSize = 32;

    const stroke: Stroke = {
      id: strokeId,
      userId,
      roomId,
      points: [{ x, y }],
      color: state.activeColor,
      width: fontSize,
      timestamp: Date.now(),
      text: text.trim(),
    };

    executeCommand({ type: 'ADD_STROKE', stroke });
  };

  const deleteStroke = (strokeId: string) => {
    const stroke = useCanvasStore.getState().strokes.find((s) => s.id === strokeId);
    if (!stroke) return;
    executeCommand({ type: 'DELETE_STROKE', id: strokeId, snapshot: stroke });
  };

  const editText = (id: string, fromText: string, toText: string) => {
    executeCommand({ type: 'EDIT_TEXT', id, fromText, toText });
  };

  const moveObject = (id: string, fromPoints: Point[], toPoints: Point[]) => {
    executeCommand({ type: 'MOVE_OBJECT', id, fromPoints, toPoints });
  };

  const eraseStrokes = (commands: Command[]) => {
    if (commands.length === 0) return;
    if (commands.length === 1) {
      executeCommand(commands[0]);
    } else {
      executeCommand({ type: 'BATCH', commands });
    }
  };

  return {
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
