import React, { useState, useRef, useMemo, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, TextInput, Keyboard, useColorScheme } from 'react-native';
import { Canvas as SkiaCanvas, Path, Group, Circle, Rect, Skia, SkPath } from '@shopify/react-native-skia';
import { Point, ToolType, Stroke, Command } from '../types/canvas';
import { ThemedText } from './themed-text';
import { useCanvasStore } from '../store/canvasStore';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  runOnJS,
  SharedValue,
  useAnimatedProps,
} from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';

interface CanvasProps {
  historyLoading: boolean;
  startDrawing: (x: number, y: number) => void;
  draw: (points: Point[]) => void;
  endDrawing: (points: Point[]) => void;
  addTextStroke: (text: string, x: number, y: number) => void;
  deleteStroke: (strokeId: string) => void;
  redo: () => void;
  editText: (id: string, fromText: string, toText: string) => void;
  moveObject: (id: string, fromPoints: Point[], toPoints: Point[]) => void;
  eraseStrokes: (commands: Command[]) => void;
}

// Convert coordinate points to smooth quadratic Bezier SVG Path format
const getSvgPathString = (points: Point[]) => {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
  }
  
  let d = `M ${points[0].x} ${points[0].y}`;
  
  if (points.length === 2) {
    d += ` L ${points[1].x} ${points[1].y}`;
    return d;
  }
  
  // Midpoint quadratic bezier curve interpolation
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const xc = (current.x + next.x) / 2;
    const yc = (current.y + next.y) / 2;
    
    if (i === 0) {
      d += ` L ${xc} ${yc}`;
    } else {
      d += ` Q ${current.x} ${current.y}, ${xc} ${yc}`;
    }
  }
  
  // Connect to the last point
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
};

// Memoized individual finalized stroke component
const FinishedStroke = React.memo(({ stroke }: { stroke: Stroke }) => {
  const pathString = useMemo(() => getSvgPathString(stroke.points), [stroke.points]);
  if (!pathString) return null;

  const isEraser = stroke.color === 'eraser';

  return (
    <Path
      path={pathString}
      color={isEraser ? 'transparent' : stroke.color}
      style="stroke"
      strokeWidth={stroke.width}
      strokeCap="round"
      strokeJoin="round"
      blendMode={isEraser ? 'clear' : 'srcOver'}
    />
  );
});
FinishedStroke.displayName = 'FinishedStroke';

// Sub-components to isolate rendering updates

interface FinishedStrokesLayerProps {
  selectedId: string | null;
  selectedTransform: SharedValue<any>;
}

const FinishedStrokesLayer = React.memo(({ selectedId, selectedTransform }: FinishedStrokesLayerProps) => {
  const strokes = useCanvasStore((s) => s.strokes);
  return (
    <>
      {strokes.map((stroke) => {
        if (stroke.text) return null; // Render text using native overlay instead
        const isSelected = stroke.id === selectedId;

        if (isSelected) {
          return (
            <Group key={stroke.id} transform={selectedTransform}>
              <FinishedStroke stroke={stroke} />
            </Group>
          );
        }
        return <FinishedStroke key={stroke.id} stroke={stroke} />;
      })}
    </>
  );
});
FinishedStrokesLayer.displayName = 'FinishedStrokesLayer';

const RemoteActiveStroke = React.memo(({ userId }: { userId: string }) => {
  const remote = useCanvasStore((s) => s.remoteActiveStrokes[userId]);
  if (!remote || !remote.points || remote.points.length < 2) return null;

  const pathString = getSvgPathString(remote.points);
  if (!pathString) return null;

  const isEraser = remote.tool === 'eraser';

  return (
    <Path
      path={pathString}
      color={isEraser ? 'transparent' : remote.color}
      style="stroke"
      strokeWidth={remote.width}
      strokeCap="round"
      strokeJoin="round"
      blendMode={isEraser ? 'clear' : 'srcOver'}
    />
  );
});
RemoteActiveStroke.displayName = 'RemoteActiveStroke';

const RemoteActiveStrokesLayer = React.memo(() => {
  const remoteUserIds = useCanvasStore(
    useShallow((s) => Object.keys(s.remoteActiveStrokes))
  );

  return (
    <>
      {remoteUserIds.map((userId) => (
        <RemoteActiveStroke key={userId} userId={userId} />
      ))}
    </>
  );
});
RemoteActiveStrokesLayer.displayName = 'RemoteActiveStrokesLayer';

interface TextStrokeProps {
  stroke: Stroke;
  scale: SharedValue<number>;
  panX: SharedValue<number>;
  panY: SharedValue<number>;
  selectedIdShared: SharedValue<string | null>;
  dragDeltaX: SharedValue<number>;
  dragDeltaY: SharedValue<number>;
}

const TextStroke = React.memo(({ stroke, scale, panX, panY, selectedIdShared, dragDeltaX, dragDeltaY }: TextStrokeProps) => {
  const startPoint = stroke.points[0];
  if (!startPoint) return null;

  const animatedStyle = useAnimatedStyle(() => {
    const isSelected = selectedIdShared.value === stroke.id;
    const dx = isSelected ? dragDeltaX.value : 0;
    const dy = isSelected ? dragDeltaY.value : 0;

    return {
      left: (startPoint.x + dx) * scale.value + panX.value,
      top: (startPoint.y + dy) * scale.value + panY.value,
      fontSize: stroke.width * scale.value,
    };
  });

  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.renderedText,
        { color: stroke.color },
        animatedStyle,
      ]}
    >
      {stroke.text}
    </Animated.Text>
  );
});
TextStroke.displayName = 'TextStroke';

interface FinishedTextLayerProps {
  scale: SharedValue<number>;
  panX: SharedValue<number>;
  panY: SharedValue<number>;
  selectedIdShared: SharedValue<string | null>;
  dragDeltaX: SharedValue<number>;
  dragDeltaY: SharedValue<number>;
  editingId: string | null;
}

const FinishedTextLayer = React.memo(({ scale, panX, panY, selectedIdShared, dragDeltaX, dragDeltaY, editingId }: FinishedTextLayerProps) => {
  const strokes = useCanvasStore((s) => s.strokes);
  return (
    <>
      {strokes.map((stroke) => {
        if (!stroke.text || stroke.id === editingId) return null;
        return (
          <TextStroke
            key={stroke.id}
            stroke={stroke}
            scale={scale}
            panX={panX}
            panY={panY}
            selectedIdShared={selectedIdShared}
            dragDeltaX={dragDeltaX}
            dragDeltaY={dragDeltaY}
          />
        );
      })}
    </>
  );
});
FinishedTextLayer.displayName = 'FinishedTextLayer';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface ActiveTextInputProps {
  editingText: { x: number; y: number } | null;
  inputValue: string;
  setInputValue: (val: string) => void;
  handleFinishText: () => void;
  textScale: number;
  textPanX: number;
  textPanY: number;
}

const ActiveTextInput = React.memo(({
  editingText,
  inputValue,
  setInputValue,
  handleFinishText,
  textScale,
  textPanX,
  textPanY,
}: ActiveTextInputProps) => {
  const activeColor = useCanvasStore((s) => s.activeColor);
  const activeWidth = useCanvasStore((s) => s.activeWidth);
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const containerBg = isDark ? 'rgba(30, 30, 30, 0.85)' : 'rgba(255, 255, 255, 0.85)';

  if (!editingText) return null;

  const baseSize = activeWidth === 3 ? 16 : activeWidth === 12 ? 32 : 20;
  const fontSize = baseSize * textScale;
  const minWidth = 120 * textScale;
  const paddingHorizontal = 6 * textScale;
  const paddingVertical = 2 * textScale;
  const borderWidth = Math.max(1, 1.5 * textScale);
  const borderRadius = Math.max(3, 6 * textScale);
  const offset = 18 * textScale;

  const left = editingText.x * textScale + textPanX;
  const top = (editingText.y * textScale + textPanY) - offset;

  return (
    <View
      style={[
        styles.textInputContainer,
        {
          backgroundColor: containerBg,
          minWidth,
          paddingHorizontal,
          paddingVertical,
          borderWidth,
          borderRadius,
          left,
          top,
        },
      ]}
    >
      <TextInput
        style={[
          styles.textInput,
          {
            color: activeColor,
            fontSize,
          },
        ]}
        autoFocus
        multiline
        blurOnSubmit={true}
        value={inputValue}
        onChangeText={setInputValue}
        placeholder="Type text..."
        placeholderTextColor="rgba(150, 150, 150, 0.5)"
        onSubmitEditing={handleFinishText}
      />
    </View>
  );
});
ActiveTextInput.displayName = 'ActiveTextInput';


const distanceToPoint = (p1: Point, p2: Point) => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const findClickedStrokeId = (clickPoint: Point, strokesList: Stroke[], threshold = 20) => {
  for (let i = strokesList.length - 1; i >= 0; i--) {
    const stroke = strokesList[i];
    if (stroke.text) {
      const textStart = stroke.points[0];
      if (!textStart) continue;
      const fontSize = stroke.width;
      const textHeight = fontSize;
      const textWidth = stroke.text.length * fontSize * 0.6;

      const minX = textStart.x - threshold;
      const maxX = textStart.x + textWidth + threshold;
      const minY = textStart.y - threshold;
      const maxY = textStart.y + textHeight + threshold;

      if (
        clickPoint.x >= minX &&
        clickPoint.x <= maxX &&
        clickPoint.y >= minY &&
        clickPoint.y <= maxY
      ) {
        return stroke.id;
      }
      continue;
    }
    for (const pt of stroke.points) {
      if (distanceToPoint(clickPoint, pt) < threshold) {
        return stroke.id;
      }
    }
  }
  return null;
};

// Hit testing and bounding box calculation worklets
const sqr = (n: number) => {
  'worklet';
  return n * n;
};

const getStrokeBounds = (points: Point[]) => {
  'worklet';
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
  };
};

const hitTest = (stroke: Stroke, x: number, y: number) => {
  'worklet';
  if (stroke.text) {
    const startPoint = stroke.points[0];
    if (!startPoint) return false;
    const fontSize = stroke.width;
    const textHeight = fontSize;
    const textWidth = stroke.text.length * fontSize * 0.6;
    return (
      x >= startPoint.x &&
      x <= startPoint.x + textWidth &&
      y >= startPoint.y &&
      y <= startPoint.y + textHeight
    );
  } else {
    // Check segment distance
    for (let i = 1; i < stroke.points.length; i++) {
      const p1 = stroke.points[i - 1];
      const p2 = stroke.points[i];
      const l2 = sqr(p1.x - p2.x) + sqr(p1.y - p2.y);
      let t = 0;
      if (l2 > 0) {
        t = ((x - p1.x) * (p2.x - p1.x) + (y - p1.y) * (p2.y - p1.y)) / l2;
        t = Math.max(0, Math.min(1, t));
      }
      const distSq = sqr(x - (p1.x + t * (p2.x - p1.x))) + sqr(y - (p1.y + t * (p2.y - p1.y)));
      if (distSq < 15 * 15) { // 15px hit threshold
        return true;
      }
    }
  }
  return false;
};

// Geometric splitting algorithm for pixel/segment erasing
function eraseSegmentFromStroke(
  stroke: Stroke,
  eraserPoints: Point[],
  radius: number
): Stroke[] {
  const groups: Point[][] = [];
  let current: Point[] = [];

  for (const pt of stroke.points) {
    let isErased = false;
    for (const erPt of eraserPoints) {
      if (Math.hypot(pt.x - erPt.x, pt.y - erPt.y) < radius) {
        isErased = true;
        break;
      }
    }

    if (isErased) {
      if (current.length >= 2) {
        groups.push(current);
      }
      current = [];
    } else {
      current.push(pt);
    }
  }
  if (current.length >= 2) {
    groups.push(current);
  }

  // Each group becomes a new stroke
  return groups.map((points) => ({
    ...stroke,
    id: generateUUID(),
    points,
    timestamp: Date.now(),
  }));
}

// RFC4122 v4 compliant UUID generator for offline fallbacks
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function Canvas({
  historyLoading,
  startDrawing,
  draw,
  endDrawing,
  addTextStroke,
  deleteStroke,
  redo,
  editText,
  moveObject,
  eraseStrokes,
}: CanvasProps) {
  const strokes = useCanvasStore((s) => s.strokes);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
  const activeColor = useCanvasStore((s) => s.activeColor);
  const activeWidth = useCanvasStore((s) => s.activeWidth);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const eraserMode = useCanvasStore((s) => s.eraserMode);

  const [editingText, setEditingText] = useState<{ x: number; y: number } | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [textScale, setTextScale] = useState(1.0);
  const [textPanX, setTextPanX] = useState(0);
  const [textPanY, setTextPanY] = useState(0);
  
  // Selection and text editing React states
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Viewport states for infinite canvas (on the UI thread)
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const scale = useSharedValue(1.0);

  // Gesture initial states
  const initialPanX = useSharedValue(0);
  const initialPanY = useSharedValue(0);
  const initialScale = useSharedValue(1.0);

  // Local active drawing path
  const currentPath = useSharedValue<SkPath>(Skia.Path.Make());

  // Active tools & mode bindings
  const activeColorShared = useSharedValue(activeColor);
  const activeWidthShared = useSharedValue(activeWidth);
  const activeToolShared = useSharedValue(activeTool);
  const eraserModeShared = useSharedValue(eraserMode);

  // Selection & dragging shared values
  const selectedIdShared = useSharedValue<string | null>(null);
  const isDraggingObject = useSharedValue(false);
  const dragDeltaX = useSharedValue(0);
  const dragDeltaY = useSharedValue(0);

  // Store database copy in Reanimated shared memory
  const strokesShared = useSharedValue<Stroke[]>([]);

  useEffect(() => {
    strokesShared.value = strokes;
  }, [strokes]);

  const hasAutoCentered = useRef(false);

  useEffect(() => {
    if (historyLoading) {
      hasAutoCentered.current = false;
      return;
    }

    if (!hasAutoCentered.current && containerSize && strokes.length > 0) {
      hasAutoCentered.current = true;

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let hasPoints = false;

      for (const stroke of strokes) {
        for (const pt of stroke.points) {
          hasPoints = true;
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        }
      }

      if (hasPoints) {
        const boundsWidth = maxX - minX;
        const boundsHeight = maxY - minY;
        const centerX = minX + boundsWidth / 2;
        const centerY = minY + boundsHeight / 2;

        const margin = 40;
        const scaleX = (containerSize.width - margin * 2) / Math.max(1, boundsWidth);
        const scaleY = (containerSize.height - margin * 2) / Math.max(1, boundsHeight);
        const newScale = Math.max(0.5, Math.min(Math.min(scaleX, scaleY), 2.0));

        const targetPanX = containerSize.width / 2 - centerX * newScale;
        const targetPanY = containerSize.height / 2 - centerY * newScale;

        scale.value = newScale;
        panX.value = targetPanX;
        panY.value = targetPanY;
        console.log('[Canvas] Auto-centered viewport to:', targetPanX, targetPanY, 'scale:', newScale);
      }
    }
  }, [historyLoading, containerSize, strokes]);

  // Sync state variables to shared values for UI thread access
  useEffect(() => {
    activeColorShared.value = activeColor;
  }, [activeColor]);

  useEffect(() => {
    activeWidthShared.value = activeWidth;
  }, [activeWidth]);

  useEffect(() => {
    activeToolShared.value = activeTool;
  }, [activeTool]);

  useEffect(() => {
    eraserModeShared.value = eraserMode;
  }, [eraserMode]);

  const activeToolRef = useRef(activeTool);
  const editingTextRef = useRef(editingText);
  const inputValueRef = useRef(inputValue);
  const editingIdRef = useRef(editingId);

  useEffect(() => {
    editingTextRef.current = editingText;
    inputValueRef.current = inputValue;
    editingIdRef.current = editingId;
  }, [editingText, inputValue, editingId]);

  useEffect(() => {
    if (activeTool !== 'text' && activeToolRef.current === 'text') {
      const editingTextVal = editingTextRef.current;
      const inputValueVal = inputValueRef.current;
      const editingIdVal = editingIdRef.current;

      if (editingTextVal && inputValueVal.trim()) {
        if (editingIdVal) {
          commitTextEditJS(editingIdVal, inputValueVal.trim());
        } else {
          addTextStroke(inputValueVal.trim(), editingTextVal.x, editingTextVal.y);
        }
      }
      setEditingText(null);
      setEditingId(null);
      setInputValue('');
    }
    activeToolRef.current = activeTool;
  }, [activeTool]);

  const setSelectedIdBoth = (id: string | null) => {
    setSelectedId(id);
    selectedIdShared.value = id;
    if (id === null) {
      setEditingId(null);
    }
  };

  // Object eraser / cursor preview shared values
  const eraserCursorX = useSharedValue(0);
  const eraserCursorY = useSharedValue(0);
  const showEraserCursor = useSharedValue(false);

  const eraserCursorOpacity = useDerivedValue(() => {
    return showEraserCursor.value ? 1 : 0;
  });

  // Local points accumulation for networking, splitting eraser, and DB persistence
  const localPointsRef = useRef<Point[]>([]);
  const lastBroadcastTimeRef = useRef(0);

  // Holds original points of selected object before translation starts
  const selectedObjOriginalPointsRef = useRef<Point[]>([]);

  const startDrawingJS = (x: number, y: number) => {
    localPointsRef.current = [{ x, y }];
    // Only broadcast real-time sync for drawing tools (brush), not eraser splits
    if (activeTool === 'brush') {
      startDrawing(x, y);
    }
    lastBroadcastTimeRef.current = Date.now();
  };

  const addPointJS = (x: number, y: number) => {
    const nextPoint = { x, y };
    const points = localPointsRef.current;
    if (points.length === 0) return;

    const lastPoint = points[points.length - 1];
    const distance = Math.hypot(x - lastPoint.x, y - lastPoint.y);

    if (distance >= 2) {
      points.push(nextPoint);
      const now = Date.now();
      // Throttle network broadcast to 30ms (approx 30fps)
      if (activeTool === 'brush' && now - lastBroadcastTimeRef.current >= 30) {
        draw(points);
        lastBroadcastTimeRef.current = now;
      }
    }
  };

  const endDrawingJS = () => {
    const points = localPointsRef.current;
    localPointsRef.current = [];
    if (activeTool === 'brush') {
      endDrawing(points);
    } else if (activeTool === 'eraser' && eraserMode === 'pixel') {
      commitPixelEraserDragJS(points);
    }
  };

  // Geometric segment splitting eraser commit
  const commitPixelEraserDragJS = (eraserPoints: Point[]) => {
    if (eraserPoints.length === 0) return;
    
    const eraserRadius = activeWidth;
    const splitCommands: Command[] = [];
    
    for (const stroke of strokes) {
      if (stroke.text) continue; // Bounding box eraser handles text, pixel eraser ignores it

      const newStrokes = eraseSegmentFromStroke(stroke, eraserPoints, eraserRadius);
      
      // If the stroke was altered (either completely erased or split into sub-segments)
      if (newStrokes.length !== 1 || newStrokes[0].points.length !== stroke.points.length) {
        splitCommands.push({
          type: 'SPLIT_STROKE',
          originalId: stroke.id,
          originalSnapshot: stroke,
          newStrokes: newStrokes,
        });
      }
    }

    if (splitCommands.length > 0) {
      eraseStrokes(splitCommands);
    }
  };

  const handleObjectEraseJS = (x: number, y: number) => {
    const eraseThreshold = Math.max(20, activeWidth / 2 + 15);
    const clickedId = findClickedStrokeId({ x, y }, strokes, eraseThreshold);
    if (clickedId) {
      if (clickedId === selectedId) {
        setSelectedIdBoth(null);
      }
      deleteStroke(clickedId);
    }
  };

  const handleTextTapJS = (x: number, y: number, scaleVal: number, panXVal: number, panYVal: number) => {
    console.log('[handleTextTapJS] called at x:', x, 'y:', y, 'scaleVal:', scaleVal, 'panX:', panXVal, 'panY:', panYVal);
    if (editingText && inputValue.trim()) {
      if (editingId) {
        const target = strokes.find((s) => s.id === editingId);
        if (target) {
          editText(editingId, target.text || '', inputValue.trim());
        }
      } else {
        addTextStroke(inputValue.trim(), editingText.x, editingText.y);
      }
    }
    setEditingId(null);
    setEditingText({ x, y });
    setTextScale(scaleVal);
    setTextPanX(panXVal);
    setTextPanY(panYVal);
    setInputValue('');
  };

  const startEditingTextJS = (id: string, x: number, y: number, content: string, scaleVal: number, panXVal: number, panYVal: number) => {
    setEditingId(id);
    setSelectedIdBoth(id);
    setEditingText({ x, y });
    setTextScale(scaleVal);
    setTextPanX(panXVal);
    setTextPanY(panYVal);
    setInputValue(content);
  };

  const commitTextEditJS = (id: string, newText: string) => {
    const target = strokes.find((s) => s.id === id);
    if (target) {
      editText(id, target.text || '', newText);
    }
  };

  const commitObjectMoveJS = (id: string, dx: number, dy: number) => {
    const target = strokes.find((s) => s.id === id);
    if (!target) return;

    const updatedPoints = target.points.map((p) => ({
      x: p.x + dx,
      y: p.y + dy,
    }));

    moveObject(id, selectedObjOriginalPointsRef.current, updatedPoints);
  };

  const handleFinishText = () => {
    if (editingText && inputValue.trim()) {
      if (editingId) {
        commitTextEditJS(editingId, inputValue.trim());
      } else {
        addTextStroke(inputValue.trim(), editingText.x, editingText.y);
      }
    }
    setEditingId(null);
    setEditingText(null);
    setInputValue('');
    Keyboard.dismiss();
  };

  // GestureDetector configurations

  // 1. Double-Tap gesture to start text editing
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .enabled(activeTool === 'pan' || activeTool === 'text')
    .onEnd((e) => {
      'worklet';
      const canvasX = (e.x - panX.value) / scale.value;
      const canvasY = (e.y - panY.value) / scale.value;
      
      console.log('[doubleTapGesture] Recognized at:', canvasX, canvasY);

      // Find if we hit a text object
      let hitTextStroke: Stroke | null = null;
      const list = strokesShared.value;
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].text && hitTest(list[i], canvasX, canvasY)) {
          hitTextStroke = list[i];
          break;
        }
      }

      if (hitTextStroke) {
        runOnJS(startEditingTextJS)(
          hitTextStroke.id,
          hitTextStroke.points[0].x,
          hitTextStroke.points[0].y,
          hitTextStroke.text || '',
          scale.value,
          panX.value,
          panY.value
        );
      }
    });

  // 2. Single-Tap gesture to select object or place text
  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .enabled(
      activeTool === 'text' ||
        activeTool === 'pan' ||
        (activeTool === 'eraser' && eraserMode === 'object')
    )
    .requireExternalGestureToFail(doubleTapGesture)
    .onEnd((e) => {
      'worklet';
      const canvasX = (e.x - panX.value) / scale.value;
      const canvasY = (e.y - panY.value) / scale.value;
      
      console.log('[singleTapGesture] Recognized at:', canvasX, canvasY, 'ActiveTool:', activeToolShared.value);

      if (activeToolShared.value === 'text') {
        let hitTextStrokeId: string | null = null;
        const list = strokesShared.value;
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i].text && hitTest(list[i], canvasX, canvasY)) {
            hitTextStrokeId = list[i].id;
            break;
          }
        }
        if (hitTextStrokeId) {
          runOnJS(setSelectedIdBoth)(hitTextStrokeId);
        } else {
          runOnJS(handleTextTapJS)(canvasX, canvasY, scale.value, panX.value, panY.value);
        }
      } else if (activeToolShared.value === 'eraser' && eraserModeShared.value === 'object') {
        runOnJS(handleObjectEraseJS)(canvasX, canvasY);
      } else if (activeToolShared.value === 'pan') {
        let hitObjId: string | null = null;
        const list = strokesShared.value;
        for (let i = list.length - 1; i >= 0; i--) {
          if (hitTest(list[i], canvasX, canvasY)) {
            hitObjId = list[i].id;
            break;
          }
        }
        runOnJS(setSelectedIdBoth)(hitObjId);
      }
    });

  // 3. Local Stroke Drawing or Pixel/Segment Erasing path drawing
  const drawGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .enabled(activeTool !== 'pan' && activeTool !== 'text')
    .onStart((e) => {
      'worklet';
      const canvasX = (e.x - panX.value) / scale.value;
      const canvasY = (e.y - panY.value) / scale.value;

      if (activeToolShared.value === 'eraser' && eraserModeShared.value === 'object') {
        runOnJS(handleObjectEraseJS)(canvasX, canvasY);
        eraserCursorX.value = canvasX;
        eraserCursorY.value = canvasY;
        showEraserCursor.value = true;
      } else {
        const path = Skia.Path.Make();
        path.moveTo(canvasX, canvasY);
        currentPath.value = path;
        runOnJS(startDrawingJS)(canvasX, canvasY);
      }
    })
    .onUpdate((e) => {
      'worklet';
      const canvasX = (e.x - panX.value) / scale.value;
      const canvasY = (e.y - panY.value) / scale.value;

      if (activeToolShared.value === 'eraser' && eraserModeShared.value === 'object') {
        runOnJS(handleObjectEraseJS)(canvasX, canvasY);
        eraserCursorX.value = canvasX;
        eraserCursorY.value = canvasY;
      } else {
        const path = currentPath.value;
        if (!path) return;

        const last = path.getLastPt();
        const midX = (last.x + canvasX) / 2;
        const midY = (last.y + canvasY) / 2;
        path.quadTo(last.x, last.y, midX, midY);
        currentPath.value = path.copy();

        runOnJS(addPointJS)(canvasX, canvasY);
      }
    })
    .onEnd(() => {
      'worklet';
      showEraserCursor.value = false;
      if (currentPath.value && currentPath.value.countPoints() > 0) {
        currentPath.value = Skia.Path.Make();
        runOnJS(endDrawingJS)();
      }
    });

  // 4. Viewport Panning & Object Translation (Moving)
  const panGesture = Gesture.Pan()
    .minPointers(activeTool === 'pan' ? 1 : 2)
    .onStart((e) => {
      'worklet';
      const canvasX = (e.x - panX.value) / scale.value;
      const canvasY = (e.y - panY.value) / scale.value;

      initialPanX.value = panX.value;
      initialPanY.value = panY.value;

      if (activeToolShared.value === 'pan' && e.numberOfPointers === 1) {
        // Check if user is clicking/grabbing the already selected object
        let hitSelected = false;
        const currentSelId = selectedIdShared.value;
        let selectedStroke: Stroke | null = null;
        if (currentSelId) {
          const list = strokesShared.value;
          for (let i = 0; i < list.length; i++) {
            if (list[i].id === currentSelId) {
              selectedStroke = list[i];
              if (hitTest(list[i], canvasX, canvasY)) {
                hitSelected = true;
              }
              break;
            }
          }
        }

        if (hitSelected && selectedStroke) {
          isDraggingObject.value = true;
          dragDeltaX.value = 0;
          dragDeltaY.value = 0;
          runOnJS(storeOriginalPointsJS)(selectedStroke.points);
        } else {
          // Check if user clicked any other object
          let hitObj: Stroke | null = null;
          const list = strokesShared.value;
          for (let i = list.length - 1; i >= 0; i--) {
            if (hitTest(list[i], canvasX, canvasY)) {
              hitObj = list[i];
              break;
            }
          }

          if (hitObj) {
            runOnJS(setSelectedIdBoth)(hitObj.id);
            isDraggingObject.value = true;
            dragDeltaX.value = 0;
            dragDeltaY.value = 0;
            runOnJS(storeOriginalPointsJS)(hitObj.points);
          } else {
            runOnJS(setSelectedIdBoth)(null);
            isDraggingObject.value = false;
          }
        }
      } else {
        isDraggingObject.value = false;
      }
    })
    .onUpdate((e) => {
      'worklet';
      if (isDraggingObject.value) {
        dragDeltaX.value = e.translationX / scale.value;
        dragDeltaY.value = e.translationY / scale.value;
      } else {
        if (activeToolShared.value === 'pan' || e.numberOfPointers >= 2) {
          panX.value = initialPanX.value + e.translationX;
          panY.value = initialPanY.value + e.translationY;
        }
      }
    })
    .onEnd(() => {
      'worklet';
      if (isDraggingObject.value) {
        isDraggingObject.value = false;
        const currentSelId = selectedIdShared.value;
        const dx = dragDeltaX.value;
        const dy = dragDeltaY.value;
        
        dragDeltaX.value = 0;
        dragDeltaY.value = 0;

        if (currentSelId && (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1)) {
          runOnJS(commitObjectMoveJS)(currentSelId, dx, dy);
        }
      }
    });

  const storeOriginalPointsJS = (points: Point[]) => {
    selectedObjOriginalPointsRef.current = points;
  };

  // 5. Viewport Zooming (focal point relative)
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      initialScale.value = scale.value;
    })
    .onUpdate((e) => {
      'worklet';
      const newScale = Math.max(0.4, Math.min(3.0, initialScale.value * e.scale));
      const focusX = (e.focalX - panX.value) / scale.value;
      const focusY = (e.focalY - panY.value) / scale.value;
      
      scale.value = newScale;
      panX.value = e.focalX - focusX * newScale;
      panY.value = e.focalY - focusY * newScale;
    });

  const composedGesture = Gesture.Simultaneous(
    Gesture.Exclusive(doubleTapGesture, singleTapGesture),
    Gesture.Simultaneous(
      drawGesture,
      Gesture.Simultaneous(panGesture, pinchGesture)
    )
  );

  const transform = useDerivedValue(() => {
    return [
      { translateX: panX.value },
      { translateY: panY.value },
      { scale: scale.value }
    ];
  });

  const selectedTransform = useDerivedValue(() => {
    return [
      { translateX: dragDeltaX.value },
      { translateY: dragDeltaY.value },
    ];
  });

  const zoomAnimatedProps = useAnimatedProps(() => {
    return {
      text: `${Math.round(scale.value * 100)}%`,
    } as any;
  });

  if (historyLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C7CF0" />
        <ThemedText style={styles.loadingText} type="code">
          Hydrating drawing board...
        </ThemedText>
      </View>
    );
  }

  return (
    <View 
      style={styles.container}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setContainerSize({ width, height });
      }}
    >
      <GestureDetector gesture={composedGesture}>
        <View style={StyleSheet.absoluteFill}>
          <SkiaCanvas style={styles.canvas}>
            <Group transform={transform}>
              <FinishedStrokesLayer selectedId={selectedId} selectedTransform={selectedTransform} />
              <RemoteActiveStrokesLayer />

              {/* Local active drawing line or eraser path preview */}
              <Path
                path={currentPath}
                color={
                  activeTool === 'eraser'
                    ? 'rgba(200, 200, 200, 0.45)'
                    : activeColor
                }
                style="stroke"
                strokeWidth={activeWidth}
                strokeCap="round"
                strokeJoin="round"
                blendMode="srcOver"
              />

              {/* Selection box outline overlay inside the translated group */}
              {selectedId && (() => {
                const selectedStroke = strokes.find((s) => s.id === selectedId);
                if (!selectedStroke) return null;
                
                let bounds = { x: 0, y: 0, w: 0, h: 0 };
                if (selectedStroke.text) {
                  const startPoint = selectedStroke.points[0];
                  if (startPoint) {
                    const fontSize = selectedStroke.width;
                    bounds = {
                      x: startPoint.x,
                      y: startPoint.y,
                      w: selectedStroke.text.length * fontSize * 0.6,
                      h: fontSize,
                    };
                  }
                } else {
                  bounds = getStrokeBounds(selectedStroke.points);
                }

                return (
                  <Group transform={selectedTransform}>
                    <Rect
                      x={bounds.x - 4}
                      y={bounds.y - 4}
                      width={bounds.w + 8}
                      height={bounds.h + 8}
                      color="#7C7CF0"
                      style="stroke"
                      strokeWidth={1.5}
                    />
                    <Circle cx={bounds.x - 4} cy={bounds.y - 4} r={4} color="#7C7CF0" />
                    <Circle cx={bounds.x + bounds.w + 4} cy={bounds.y - 4} r={4} color="#7C7CF0" />
                    <Circle cx={bounds.x - 4} cy={bounds.y + bounds.h + 4} r={4} color="#7C7CF0" />
                    <Circle cx={bounds.x + bounds.w + 4} cy={bounds.y + bounds.h + 4} r={4} color="#7C7CF0" />
                  </Group>
                );
              })()}

              {/* Eraser cursor size preview */}
              <Circle
                cx={eraserCursorX}
                cy={eraserCursorY}
                r={activeWidth / 2}
                color="rgba(124, 124, 240, 0.45)"
                style="stroke"
                strokeWidth={1.5}
                opacity={eraserCursorOpacity}
              />
            </Group>
          </SkiaCanvas>
        </View>
      </GestureDetector>

      {/* Text layers positioned absolutely on top */}
      <FinishedTextLayer
        scale={scale}
        panX={panX}
        panY={panY}
        selectedIdShared={selectedIdShared}
        dragDeltaX={dragDeltaX}
        dragDeltaY={dragDeltaY}
        editingId={editingId}
      />
      
      <ActiveTextInput
        editingText={editingText}
        inputValue={inputValue}
        setInputValue={setInputValue}
        handleFinishText={handleFinishText}
        textScale={textScale}
        textPanX={textPanX}
        textPanY={textPanY}
      />

      {/* Floating Zoom Indicator on the side of the page */}
      <View style={styles.zoomContainer}>
        <AnimatedTextInput
          animatedProps={zoomAnimatedProps}
          editable={false}
          pointerEvents="none"
          style={styles.zoomText}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.6,
  },
  renderedText: {
    position: 'absolute',
    fontWeight: '600',
    backgroundColor: 'transparent',
    maxWidth: '85%',
  },
  textInputContainer: {
    position: 'absolute',
    zIndex: 100,
    borderColor: '#7C7CF0',
    borderStyle: 'dashed',
    maxWidth: '85%',
  },
  textInput: {
    padding: 0,
    margin: 0,
    fontWeight: '600',
    minHeight: 24,
  },
  zoomContainer: {
    position: 'absolute',
    right: 16,
    top: 100,
    backgroundColor: 'rgba(30, 30, 30, 0.75)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    padding: 0,
    margin: 0,
  },
});
