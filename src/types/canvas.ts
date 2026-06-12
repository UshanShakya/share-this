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
  eraserMode: 'pixel' | 'object';
}

export type Command =
  | { type: 'ADD_STROKE'; stroke: Stroke }
  | { type: 'DELETE_STROKE'; id: string; snapshot: Stroke }
  | { type: 'SPLIT_STROKE'; originalId: string; originalSnapshot: Stroke; newStrokes: Stroke[] }
  | { type: 'EDIT_TEXT'; id: string; fromText: string; toText: string }
  | { type: 'MOVE_OBJECT'; id: string; fromPoints: Point[]; toPoints: Point[] }
  | { type: 'CHANGE_COLOR'; id: string; fromColor: string; toColor: string }
  | { type: 'CHANGE_WIDTH'; id: string; fromWidth: number; toWidth: number }
  | { type: 'BATCH'; commands: Command[] };

