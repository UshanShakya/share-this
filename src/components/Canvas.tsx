import React, { useState, useRef } from 'react';
import { StyleSheet, View, GestureResponderEvent, ActivityIndicator, Text, TextInput, Keyboard } from 'react-native';
import { Canvas as SkiaCanvas, Path, Group } from '@shopify/react-native-skia';
import { Point, ToolType } from '../types/canvas';
import { ThemedText } from './themed-text';

interface CanvasProps {
  strokes: any[];
  remoteActiveStrokes: Record<string, any>;
  currentStroke: Point[] | null;
  activeColor: string;
  activeWidth: number;
  activeTool: ToolType;
  eraserMode: 'pixel' | 'object';
  historyLoading: boolean;
  startDrawing: (x: number, y: number) => void;
  draw: (x: number, y: number) => void;
  endDrawing: () => void;
  addTextStroke: (text: string, x: number, y: number) => void;
  deleteStroke: (strokeId: string) => void;
}

export function Canvas({
  strokes,
  remoteActiveStrokes,
  currentStroke,
  activeColor,
  activeWidth,
  activeTool,
  eraserMode,
  historyLoading,
  startDrawing,
  draw,
  endDrawing,
  addTextStroke,
  deleteStroke,
}: CanvasProps) {
  const [editingText, setEditingText] = useState<{ x: number; y: number } | null>(null);
  const [inputValue, setInputValue] = useState('');

  // Viewport states for infinite canvas
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoomScale, setZoomScale] = useState(1.0);

  // References for panning and pinch zooming
  const touchStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchStartRef = useRef<{
    distance: number;
    scale: number;
    midX: number;
    midY: number;
    panX: number;
    panY: number;
  } | null>(null);
  
  // Convert coordinate points to standard SVG Path format
  const getSvgPathString = (points: Point[]) => {
    if (!points || points.length < 2) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  };

  const getTouchDistance = (touches: any[]) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchMidpoint = (touches: any[]) => {
    if (touches.length < 2) return { x: 0, y: 0 };
    return {
      x: (touches[0].pageX + touches[1].pageX) / 2,
      y: (touches[0].pageY + touches[1].pageY) / 2,
    };
  };

  const distanceToPoint = (p1: Point, p2: Point) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const findClickedStrokeId = (clickPoint: Point, strokesList: any[], threshold = 20) => {
    // Loop backwards to check the most recently drawn strokes first
    for (let i = strokesList.length - 1; i >= 0; i--) {
      const stroke = strokesList[i];
      if (stroke.text) {
        if (distanceToPoint(clickPoint, stroke.points[0]) < threshold * 2) {
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

  const handleObjectErase = (x: number, y: number) => {
    const clickedId = findClickedStrokeId({ x, y }, strokes);
    if (clickedId) {
      deleteStroke(clickedId);
    }
  };

  const handleFinishText = () => {
    if (editingText && inputValue.trim()) {
      addTextStroke(inputValue.trim(), editingText.x, editingText.y);
    }
    setEditingText(null);
    setInputValue('');
    Keyboard.dismiss();
  };

  const handleTouchStart = (e: GestureResponderEvent) => {
    const touches = e.nativeEvent.touches;
    
    if (touches.length === 2) {
      // 2 fingers: pinch-to-zoom & pan start
      const distance = getTouchDistance(touches);
      const midpoint = getTouchMidpoint(touches);
      pinchStartRef.current = {
        distance,
        scale: zoomScale,
        midX: midpoint.x,
        midY: midpoint.y,
        panX: panOffset.x,
        panY: panOffset.y,
      };
    } else if (touches.length === 1) {
      const { locationX, locationY, pageX, pageY } = e.nativeEvent;
      
      if (activeTool === 'pan') {
        // Single finger pan start
        touchStartRef.current = {
          x: pageX,
          y: pageY,
          panX: panOffset.x,
          panY: panOffset.y,
        };
      } else if (activeTool === 'eraser' && eraserMode === 'object') {
        // Object/Stroke Eraser start
        const canvasX = (locationX - panOffset.x) / zoomScale;
        const canvasY = (locationY - panOffset.y) / zoomScale;
        handleObjectErase(canvasX, canvasY);
      } else if (activeTool === 'text') {
        if (editingText && inputValue.trim()) {
          addTextStroke(inputValue.trim(), editingText.x, editingText.y);
        }
        // Map page touch coordinate to canvas space
        const canvasX = (locationX - panOffset.x) / zoomScale;
        const canvasY = (locationY - panOffset.y) / zoomScale;
        setEditingText({ x: canvasX, y: canvasY });
        setInputValue('');
      } else {
        // Drawing start (mapped to canvas space)
        const canvasX = (locationX - panOffset.x) / zoomScale;
        const canvasY = (locationY - panOffset.y) / zoomScale;
        startDrawing(canvasX, canvasY);
      }
    }
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    const touches = e.nativeEvent.touches;
    
    if (touches.length === 2 && pinchStartRef.current) {
      // 2 fingers: pinch scale & midpoint shift
      const distance = getTouchDistance(touches);
      const midpoint = getTouchMidpoint(touches);
      
      const scaleFactor = distance / pinchStartRef.current.distance;
      const newScale = Math.max(0.4, Math.min(3.0, pinchStartRef.current.scale * scaleFactor));
      
      const dx = midpoint.x - pinchStartRef.current.midX;
      const dy = midpoint.y - pinchStartRef.current.midY;
      
      setZoomScale(newScale);
      setPanOffset({
        x: pinchStartRef.current.panX + dx,
        y: pinchStartRef.current.panY + dy,
      });
    } else if (touches.length === 1) {
      const { locationX, locationY, pageX, pageY } = e.nativeEvent;
      
      if (activeTool === 'pan' && touchStartRef.current) {
        // Single finger panning
        const dx = pageX - touchStartRef.current.x;
        const dy = pageY - touchStartRef.current.y;
        setPanOffset({
          x: touchStartRef.current.panX + dx,
          y: touchStartRef.current.panY + dy,
        });
      } else if (activeTool === 'eraser' && eraserMode === 'object') {
        // Object/Stroke Eraser dragging
        const canvasX = (locationX - panOffset.x) / zoomScale;
        const canvasY = (locationY - panOffset.y) / zoomScale;
        handleObjectErase(canvasX, canvasY);
      } else if (activeTool !== 'pan' && activeTool !== 'text') {
        // Drawing move
        const canvasX = (locationX - panOffset.x) / zoomScale;
        const canvasY = (locationY - panOffset.y) / zoomScale;
        draw(canvasX, canvasY);
      }
    }
  };

  const handleTouchEnd = () => {
    pinchStartRef.current = null;
    touchStartRef.current = null;
    
    if (activeTool !== 'pan' && activeTool !== 'text') {
      endDrawing();
    }
  };

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
    <View style={styles.container}>
      <SkiaCanvas
        style={styles.canvas}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Group transform={[{ translateX: panOffset.x }, { translateY: panOffset.y }, { scale: zoomScale }]}>
          {/* 1. Render all finalized strokes from database history */}
          {strokes.map((stroke) => {
            if (stroke.text) return null; // Render text using native overlay instead

            const pathString = getSvgPathString(stroke.points);
            if (!pathString) return null;

            const isEraser = stroke.color === 'eraser';

            return (
              <Path
                key={stroke.id}
                path={pathString}
                color={isEraser ? 'transparent' : stroke.color}
                style="stroke"
                strokeWidth={stroke.width}
                strokeCap="round"
                strokeJoin="round"
                blendMode={isEraser ? 'clear' : 'srcOver'}
              />
            );
          })}

          {/* 2. Render remote users' active, in-progress drawing lines */}
          {Object.keys(remoteActiveStrokes).map((key) => {
            const remote = remoteActiveStrokes[key];
            if (!remote || !remote.points || remote.points.length < 2) return null;

            const pathString = getSvgPathString(remote.points);
            if (!pathString) return null;

            const isEraser = remote.tool === 'eraser';

            return (
              <Path
                key={`remote-${key}`}
                path={pathString}
                color={isEraser ? 'transparent' : remote.color}
                style="stroke"
                strokeWidth={remote.width}
                strokeCap="round"
                strokeJoin="round"
                blendMode={isEraser ? 'clear' : 'srcOver'}
              />
            );
          })}

          {/* 3. Render local in-progress drawing line */}
          {currentStroke && currentStroke.length >= 2 && (
            <Path
              path={getSvgPathString(currentStroke)}
              color={activeTool === 'eraser' ? 'transparent' : activeColor}
              style="stroke"
              strokeWidth={activeWidth}
              strokeCap="round"
              strokeJoin="round"
              blendMode={activeTool === 'eraser' ? 'clear' : 'srcOver'}
            />
          )}
        </Group>
      </SkiaCanvas>

      {/* 4. Render absolute-positioned text strokes on top of canvas */}
      {strokes.map((stroke) => {
        if (!stroke.text) return null;
        const startPoint = stroke.points[0];
        if (!startPoint) return null;

        return (
          <Text
            key={stroke.id}
            pointerEvents="none"
            style={[
              styles.renderedText,
              {
                left: startPoint.x * zoomScale + panOffset.x,
                top: startPoint.y * zoomScale + panOffset.y,
                color: stroke.color,
                fontSize: stroke.width * zoomScale,
              },
            ]}
          >
            {stroke.text}
          </Text>
        );
      })}

      {/* 5. Render floating text input box during active editing */}
      {editingText && (
        <View
          style={[
            styles.textInputContainer,
            {
              left: editingText.x * zoomScale + panOffset.x,
              top: (editingText.y * zoomScale + panOffset.y) - 18,
            }
          ]}
        >
          <TextInput
            style={[
              styles.textInput,
              {
                color: activeColor,
                fontSize: (activeWidth === 3 ? 16 : activeWidth === 12 ? 32 : 20) * zoomScale,
              }
            ]}
            autoFocus
            multiline
            blurOnSubmit={true}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Type text..."
            placeholderTextColor="rgba(150, 150, 150, 0.5)"
            onSubmitEditing={handleFinishText}
            onBlur={handleFinishText}
          />
        </View>
      )}
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
    backgroundColor: 'rgba(50, 50, 50, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#7C7CF0',
    minWidth: 120,
    maxWidth: '85%',
  },
  textInput: {
    padding: 0,
    margin: 0,
    fontWeight: '600',
    minHeight: 24,
  },
});
