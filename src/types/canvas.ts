export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  userId: string;
  roomId: string;
  points: Point[];
  color: string;
  width: number;
  timestamp: number;
  text?: string;
}

export type ToolType = 'brush' | 'eraser' | 'text' | 'pan';

export interface CanvasState {
  strokes: Stroke[];
  activeColor: string;
  activeWidth: number;
  activeTool: ToolType;
  currentStroke: Point[] | null;
  eraserMode: 'pixel' | 'object';
}
