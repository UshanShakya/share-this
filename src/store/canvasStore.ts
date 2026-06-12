import { create } from 'zustand';
import { Point, Stroke, ToolType } from '../types/canvas';
import { sharedStorage } from '../lib/sharedStorage';

interface CanvasState {
  strokes: Stroke[];
  remoteActiveStrokes: Record<string, { points: Point[]; color: string; width: number; tool: ToolType }>;
  activeColor: string;
  activeWidth: number;
  activeTool: ToolType;
  eraserMode: 'pixel' | 'object';
  
  // Actions
  setStrokes: (strokes: Stroke[]) => void;
  addStroke: (stroke: Stroke) => void;
  
  setRemoteActiveStroke: (userId: string, points: Point[], color: string, width: number, tool: ToolType) => void;
  clearRemoteActiveStroke: (userId: string) => void;
  
  setColor: (color: string) => void;
  setWidth: (width: number) => void;
  setTool: (tool: ToolType) => void;
  setEraserMode: (mode: 'pixel' | 'object') => void;
  
  undoLastLocalStroke: (userId: string) => string | null; // Returns the stroke ID that was undone
  clearStrokes: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  strokes: [],
  remoteActiveStrokes: {},
  activeColor: '#7C7CF0',
  activeWidth: 4,
  activeTool: 'brush',
  eraserMode: 'pixel',

  setStrokes: (strokes) => set({ strokes }),

  addStroke: (stroke) => set((state) => ({
    strokes: [...state.strokes, stroke],
  })),

  setRemoteActiveStroke: (userId, points, color, width, tool) => set((state) => ({
    remoteActiveStrokes: {
      ...state.remoteActiveStrokes,
      [userId]: { points, color, width, tool },
    },
  })),

  clearRemoteActiveStroke: (userId) => set((state) => {
    const nextRemote = { ...state.remoteActiveStrokes };
    delete nextRemote[userId];
    return { remoteActiveStrokes: nextRemote };
  }),

  setColor: (activeColor) => set({ activeColor }),
  setWidth: (activeWidth) => set({ activeWidth }),
  setTool: (activeTool) => set({ activeTool }),
  setEraserMode: (eraserMode) => set({ eraserMode }),

  undoLastLocalStroke: (userId) => {
    const { strokes } = get();
    // Find the last stroke created by this user
    let undoId: string | null = null;
    const nextStrokes = [...strokes];
    
    for (let i = nextStrokes.length - 1; i >= 0; i--) {
      if (nextStrokes[i].userId === userId) {
        undoId = nextStrokes[i].id;
        nextStrokes.splice(i, 1);
        break;
      }
    }

    if (undoId) {
      set({ strokes: nextStrokes });
    }
    
    return undoId;
  },

  clearStrokes: () => set({ strokes: [], remoteActiveStrokes: {} }),
}));

let lastStrokes = useCanvasStore.getState().strokes;
useCanvasStore.subscribe((state) => {
  if (state.strokes !== lastStrokes) {
    lastStrokes = state.strokes;
    sharedStorage.reloadWidget();
  }
});
