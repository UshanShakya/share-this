import React, { useEffect, useState, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '../themed-text';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const theme = useTheme();
  const isDark = theme.text === '#ffffff';
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');

  // Animation values
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Local state to coordinate exit transitions before unmounting
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 150,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0.5,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible, SCREEN_HEIGHT]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShouldRender(false);
      onClose();
    });
  };

  // Instant gesture handling for the top handlebar (safe since there are no button children)
  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        translateY.setOffset(0);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        } else {
          translateY.setValue(gestureState.dy * 0.15);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.5) {
          handleClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 15,
            stiffness: 120,
          }).start();
        }
      },
    })
  ).current;

  // Conditional gesture handling for the header (so children like the Close button can receive taps)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Capture gesture only when vertical drag is significant and downwards
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && gestureState.dy > 5;
      },
      onPanResponderGrant: () => {
        translateY.setOffset(0);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        } else {
          // Provide resistance when dragging upwards beyond the top
          translateY.setValue(gestureState.dy * 0.15);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If dragged down past the threshold (120px) or velocity is high, dismiss
        if (gestureState.dy > 120 || gestureState.vy > 0.5) {
          handleClose();
        } else {
          // Bounce back to open state
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 15,
            stiffness: 120,
          }).start();
        }
      },
    })
  ).current;

  if (!shouldRender) return null;

  return (
    <Modal
      visible={shouldRender}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Animated.View style={[styles.backdropBg, { opacity: backdropOpacity }]} />
        </Pressable>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              transform: [{ translateY }],
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
              backgroundColor: 'transparent',
            },
          ]}
        >
          {/* Glassmorphic Background Blur */}
          <BlurView
            intensity={90}
            tint={isDark ? 'dark' : 'light'}
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark ? 'rgba(26, 27, 30, 0.65)' : 'rgba(255, 255, 255, 0.70)',
              },
            ]}
          />

          {/* Drag handle & Header views */}
          <View style={styles.dragZone}>
            {/* Handlebar */}
            <View
              style={styles.handleContainer}
              {...handlePanResponder.panHandlers}
            >
              <View
                style={[
                  styles.handle,
                  { backgroundColor: theme.textSecondary || '#B0B4BA', opacity: 0.3 },
                ]}
              />
            </View>

            {/* Header */}
            {(title !== undefined || onClose !== undefined) && (
              <View
                style={styles.header}
                {...panResponder.panHandlers}
              >
                {title ? (
                  <ThemedText style={styles.title} type="smallBold">
                    {title}
                  </ThemedText>
                ) : (
                  <View />
                )}
                <Pressable
                  onPress={handleClose}
                  style={[
                    styles.closeButton,
                    { backgroundColor: theme.backgroundSelected || '#2E3135' },
                  ]}
                >
                  <Ionicons name="close" size={20} color={theme.text} />
                </Pressable>
              </View>
            )}
          </View>

          {/* Content */}
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  backdropBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 24,
    overflow: 'hidden',
  },
  dragZone: {
    backgroundColor: 'transparent',
    width: '100%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
  },
});
