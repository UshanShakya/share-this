import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, useColorScheme, ScrollView, Modal, Pressable } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface StrokeToolbarProps {
  activeColor: string;
  activeWidth: number;
  activeTool: 'brush' | 'eraser' | 'text' | 'pan';
  eraserMode: 'pixel' | 'object';
  setColor: (color: string) => void;
  setWidth: (width: number) => void;
  setTool: (tool: 'brush' | 'eraser' | 'text' | 'pan') => void;
  setEraserMode: (mode: 'pixel' | 'object') => void;
  undo: () => void;
  clear: () => void;
}

const PALETTE_COLORS = [
  '#7C7CF0', // Accent Purple
  '#F16063', // Red/Pink
  '#2E7D32', // Green
  '#ED6C02', // Orange
  '#0288D1', // Blue
  '#111111', // Black (will be white in dark mode)
];

export function StrokeToolbar({
  activeColor,
  activeWidth,
  activeTool,
  eraserMode,
  setColor,
  setWidth,
  setTool,
  setEraserMode,
  undo,
  clear,
}: StrokeToolbarProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'light' ? 'light' : 'dark'];

  // Color Picker States
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [r, setR] = useState(124);
  const [g, setG] = useState(124);
  const [b, setB] = useState(240);

  // Dragging states to prevent ScrollView hijacking touch gestures
  const [isDragging, setIsDragging] = useState(false);
  const [sliderLeft, setSliderLeft] = useState<number | null>(null);
  const [rgbSliderLeft, setRgbSliderLeft] = useState<number | null>(null);

  // Helper to parse hex color to rgb
  const hexToRgb = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (_, r1, g1, b1) => r1 + r1 + g1 + g1 + b1 + b1);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 124, g: 124, b: 240 };
  };

  // Helper to convert rgb to hex
  const rgbToHex = (rNum: number, gNum: number, bNum: number) => {
    const clamp = (val: number) => Math.max(0, Math.min(255, val));
    return '#' + [clamp(rNum), clamp(gNum), clamp(bNum)].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('').toUpperCase();
  };

  const handleOpenColorPicker = () => {
    if (activeColor && activeColor !== 'eraser' && activeColor.startsWith('#')) {
      const rgb = hexToRgb(activeColor);
      setR(rgb.r);
      setG(rgb.g);
      setB(rgb.b);
    }
    setShowColorPicker(true);
  };

  const handleApplyColor = () => {
    setColor(rgbToHex(r, g, b));
    setShowColorPicker(false);
  };

  // Resolve black color in dark mode to white
  const resolveColor = (color: string) => {
    if (color === '#111111' && scheme === 'dark') {
      return '#FFFFFF';
    }
    return color;
  };

  // Custom size slider handlers
  const handleSliderTouch = (e: any) => {
    setIsDragging(true);
    const { locationX, pageX } = e.nativeEvent;
    const left = pageX - locationX;
    setSliderLeft(left);

    const percentage = Math.max(0, Math.min(1, locationX / 120));
    const size = Math.round(2 + percentage * (40 - 2));
    setWidth(size);
  };

  const handleSliderMove = (e: any) => {
    if (sliderLeft === null) return;
    const { pageX } = e.nativeEvent;
    const localX = pageX - sliderLeft;
    const percentage = Math.max(0, Math.min(1, localX / 120));
    const size = Math.round(2 + percentage * (40 - 2));
    setWidth(size);
  };

  const handleSliderRelease = () => {
    setIsDragging(false);
    setSliderLeft(null);
  };

  // Helper to render color picker RGB sliders using absolute pageX positions
  const renderRGBSlider = (
    label: string,
    value: number,
    onChange: (val: number) => void,
    color: string
  ) => {
    return (
      <View style={styles.rgbSliderRow}>
        <Text style={[styles.rgbLabel, { color: colors.text }]}>{label}: {value}</Text>
        <View
          style={styles.pickerTrackWrapper}
          onStartShouldSetResponder={() => true}
          onResponderGrant={(e) => {
            const { locationX, pageX } = e.nativeEvent;
            const left = pageX - locationX;
            setRgbSliderLeft(left);
            const percentage = Math.max(0, Math.min(1, locationX / 180));
            onChange(Math.round(percentage * 255));
          }}
          onResponderMove={(e) => {
            if (rgbSliderLeft === null) return;
            const { pageX } = e.nativeEvent;
            const localX = pageX - rgbSliderLeft;
            const percentage = Math.max(0, Math.min(1, localX / 180));
            onChange(Math.round(percentage * 255));
          }}
          onResponderRelease={() => setRgbSliderLeft(null)}
          onResponderTerminate={() => setRgbSliderLeft(null)}
        >
          <View style={[styles.pickerTrack, { backgroundColor: color }]} pointerEvents="none" />
          <View style={[styles.pickerThumb, { left: (value / 255) * 180 - 7 }]} pointerEvents="none" />
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: scheme === 'dark' ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)', borderColor: colors.border }]}>
      <ScrollView
        horizontal
        scrollEnabled={!isDragging}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Tool Switcher (Brush / Eraser / Text / Pan) */}
        <View style={[styles.section, { borderRightColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.toolButton, activeTool === 'brush' && [styles.activeTool, { backgroundColor: colors.accent + '20' }]]}
            onPress={() => setTool('brush')}
          >
            <Ionicons name="brush" size={20} color={activeTool === 'brush' ? colors.accent : colors.textSecondary} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.toolButton, activeTool === 'eraser' && [styles.activeTool, { backgroundColor: colors.accent + '20' }]]}
            onPress={() => setTool('eraser')}
          >
            <FontAwesome5 name="eraser" size={18} color={activeTool === 'eraser' ? colors.accent : colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, activeTool === 'text' && [styles.activeTool, { backgroundColor: colors.accent + '20' }]]}
            onPress={() => setTool('text')}
          >
            <Ionicons name="text" size={20} color={activeTool === 'text' ? colors.accent : colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, activeTool === 'pan' && [styles.activeTool, { backgroundColor: colors.accent + '20' }]]}
            onPress={() => setTool('pan')}
          >
            <Ionicons name="hand-left-outline" size={20} color={activeTool === 'pan' ? colors.accent : colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* 2. Color Palette Selection + Custom Picker (Visible if not using eraser/pan) */}
        {activeTool !== 'eraser' && activeTool !== 'pan' ? (
          <View style={[styles.section, styles.colorsSection, { borderRightColor: colors.border }]}>
            {PALETTE_COLORS.map((color) => {
              const displayColor = resolveColor(color);
              const isSelected = activeColor === displayColor;
              return (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorBubble,
                    { backgroundColor: displayColor },
                    isSelected && [styles.selectedColorBubble, { borderColor: colors.text }],
                  ]}
                  onPress={() => setColor(displayColor)}
                />
              );
            })}
            
            {/* Custom Color Picker Trigger */}
            <TouchableOpacity
              style={[styles.colorBubble, styles.customColorBubble, { borderColor: colors.border }]}
              onPress={handleOpenColorPicker}
            >
              <Ionicons name="add" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.section, styles.eraserInfoSection, { borderRightColor: colors.border }]}>
            {activeTool === 'eraser' ? (
              <View style={styles.eraserToggleRow}>
                <TouchableOpacity
                  style={[styles.eraserToggleButton, eraserMode === 'pixel' && [styles.eraserActiveToggle, { backgroundColor: colors.accent }]]}
                  onPress={() => setEraserMode('pixel')}
                >
                  <Text style={[styles.eraserToggleText, { color: eraserMode === 'pixel' ? '#FFFFFF' : colors.textSecondary }]}>Area</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.eraserToggleButton, eraserMode === 'object' && [styles.eraserActiveToggle, { backgroundColor: colors.accent }]]}
                  onPress={() => setEraserMode('object')}
                >
                  <Text style={[styles.eraserToggleText, { color: eraserMode === 'object' ? '#FFFFFF' : colors.textSecondary }]}>Stroke</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.eraserText, { color: colors.textSecondary }]}>Pan Mode Active</Text>
            )}
          </View>
        )}

        {/* 3. Brush/Text Size Drag Slider */}
        <View style={[styles.section, styles.sliderSection, { borderRightColor: colors.border }]}>
          <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>{activeWidth}px</Text>
          <View
            style={styles.sliderTrackWrapper}
            onStartShouldSetResponder={() => true}
            onResponderGrant={handleSliderTouch}
            onResponderMove={handleSliderMove}
            onResponderRelease={handleSliderRelease}
            onResponderTerminate={handleSliderRelease}
          >
            <View style={[styles.sliderTrack, { backgroundColor: colors.border }]} pointerEvents="none" />
            <View
              style={[
                styles.sliderThumb,
                {
                  backgroundColor: colors.accent,
                  left: ((activeWidth - 2) / (40 - 2)) * 120 - 7,
                },
              ]}
              pointerEvents="none"
            />
          </View>
        </View>

        {/* 4. Canvas Actions (Undo / Clear) */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.actionButton} onPress={undo}>
            <Ionicons name="arrow-undo-outline" size={20} color={colors.text} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={clear}>
            <Ionicons name="trash-outline" size={20} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 5. Custom RGB Color Picker Modal */}
      <Modal
        visible={showColorPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowColorPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowColorPicker(false)}>
          <Pressable 
            style={[styles.modalContent, { backgroundColor: scheme === 'dark' ? '#222222' : '#FFFFFF' }]} 
            onPress={() => {}} /* Intercepts touches to prevent closing the modal */
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Custom Color</Text>

            {/* Color Preview Block */}
            <View style={styles.previewContainer}>
              <View style={[styles.previewColor, { backgroundColor: rgbToHex(r, g, b) }]} />
              <Text style={[styles.hexCodeText, { color: colors.textSecondary }]}>
                {rgbToHex(r, g, b)}
              </Text>
            </View>

            {/* Red, Green, Blue Sliders */}
            {renderRGBSlider('R', r, setR, '#F16063')}
            {renderRGBSlider('G', g, setG, '#2E7D32')}
            {renderRGBSlider('B', b, setB, '#0288D1')}

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]}
                onPress={() => setShowColorPicker(false)}
              >
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: colors.accent }]}
                onPress={handleApplyColor}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    maxWidth: '94%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
    marginRight: 10,
    borderRightWidth: 1,
    height: '60%',
    gap: 6,
  },
  colorsSection: {
    gap: 6,
  },
  eraserInfoSection: {
    justifyContent: 'center',
    paddingHorizontal: 8,
    minWidth: 100,
  },
  eraserText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  toolButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTool: {
    borderRadius: 10,
  },
  colorBubble: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  selectedColorBubble: {
    borderWidth: 2,
    transform: [{ scale: 1.15 }],
  },
  customColorBubble: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderSection: {
    gap: 8,
    paddingRight: 12,
  },
  sliderLabel: {
    fontSize: 10,
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'center',
  },
  sliderTrackWrapper: {
    width: 120,
    height: 30,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    top: 8,
  },
  actionsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 280,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  previewColor: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  hexCodeText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  rgbSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 14,
    justifyContent: 'space-between',
  },
  rgbLabel: {
    fontSize: 12,
    fontWeight: '700',
    width: 45,
  },
  pickerTrackWrapper: {
    width: 180,
    height: 24,
    justifyContent: 'center',
    position: 'relative',
  },
  pickerTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
  },
  pickerThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111111',
    top: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  pickerButton: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  eraserToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(120, 120, 120, 0.1)',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  eraserToggleButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eraserActiveToggle: {
    // Set dynamically
  },
  eraserToggleText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
