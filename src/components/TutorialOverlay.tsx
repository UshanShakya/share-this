import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Mask, Rect, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LayoutCircle {
  x: number;
  y: number;
  r: number;
}

interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TutorialOverlayProps {
  visible: boolean;
  onClose: () => void;
  bellLayout?: LayoutCircle | null;
  tabsLayout?: LayoutRect | null;
  fabLayout?: LayoutCircle | null;
}

export function TutorialOverlay({
  visible,
  onClose,
  bellLayout,
  tabsLayout,
  fabLayout,
}: TutorialOverlayProps) {
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(20)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setStep(0);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const handleNext = () => {
    if (step < 3) {
      // Animate card content transition
      Animated.sequence([
        Animated.timing(cardTranslateY, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleFinish = async () => {
    try {
      await SecureStore.setItemAsync('knoodle_tutorial_completed', 'true');
    } catch (e) {
      console.warn('Failed to save tutorial status to SecureStore:', e);
    }
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  // Position coordinates of spotlights
  // 1. Notification Bell (Top Right)
  const bellX = bellLayout?.x ?? (SCREEN_WIDTH - 44);
  const bellY = bellLayout?.y ?? (insets.top + 36); // Adjust for header padding
  const bellRadius = bellLayout?.r ?? 26;

  // 2. FAB Button (Bottom Right)
  const fabX = fabLayout?.x ?? (SCREEN_WIDTH - 54);
  const fabY = fabLayout?.y ?? (SCREEN_HEIGHT - 134);
  const fabRadius = fabLayout?.r ?? 36;

  // 3. Tab Bar (Top under header)
  const tabX = tabsLayout?.x ?? 16;
  const tabY = tabsLayout?.y ?? (insets.top + 76); // Under the header
  const tabW = tabsLayout?.w ?? (SCREEN_WIDTH - 32);
  const tabH = tabsLayout?.h ?? 52;

  // Determine tooltip card position based on step
  const getCardStyle = () => {
    switch (step) {
      case 1: // FAB Highlight
        return {
          bottom: 190,
          left: 20,
          right: 20,
        };
      case 2: // Notification Bell Highlight
        return {
          top: bellY + bellRadius + 16,
          left: 20,
          right: 20,
        };
      case 3: // Tab Bar Highlight
        return {
          top: tabY + tabH + 16,
          left: 20,
          right: 20,
        };
      case 0:
      default: // Centered Welcome Card
        return {
          top: SCREEN_HEIGHT / 2 - 130,
          left: 24,
          right: 24,
        };
    }
  };

  return (
    <Animated.View style={[styles.overlayContainer, { opacity: fadeAnim }]}>
      {/* SVG Mask for the Spotlight effect */}
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <Mask id="spotlightMask">
            {/* White parts keep the overlay solid */}
            <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="white" />
            {/* Black parts cut holes in the overlay */}
            {step === 1 && (
              <Circle cx={fabX} cy={fabY} r={fabRadius} fill="black" />
            )}
            {step === 2 && (
              <Circle cx={bellX} cy={bellY} r={bellRadius} fill="black" />
            )}
            {step === 3 && (
              <Rect x={tabX} y={tabY} width={tabW} height={tabH} rx={8} ry={8} fill="black" />
            )}
          </Mask>
        </Defs>
        {/* The semi-transparent overlay using the mask */}
        <Rect
          x="0"
          y="0"
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          fill="rgba(15, 15, 15, 0.78)"
          mask="url(#spotlightMask)"
        />
      </Svg>

      {/* Pulsing indicator ring around the active spotlight */}
      {step === 1 && (
        <View
          style={[
            styles.pulseRing,
            {
              left: fabX - fabRadius - 6,
              top: fabY - fabRadius - 6,
              width: (fabRadius + 6) * 2,
              height: (fabRadius + 6) * 2,
              borderRadius: fabRadius + 6,
            },
          ]}
        />
      )}
      {step === 2 && (
        <View
          style={[
            styles.pulseRing,
            {
              left: bellX - bellRadius - 6,
              top: bellY - bellRadius - 6,
              width: (bellRadius + 6) * 2,
              height: (bellRadius + 6) * 2,
              borderRadius: bellRadius + 6,
            },
          ]}
        />
      )}
      {step === 3 && (
        <View
          style={[
            styles.pulseRingRect,
            {
              left: tabX - 6,
              top: tabY - 6,
              width: tabW + 12,
              height: tabH + 12,
              borderRadius: 12,
            },
          ]}
        />
      )}

      {/* Tooltip/Onboarding Card */}
      <Animated.View
        style={[
          styles.card,
          getCardStyle(),
          { transform: [{ translateY: cardTranslateY }] },
        ]}
      >
        {step === 0 && (
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="sparkles" size={28} color="#FFD700" />
            </View>
            <Text style={styles.cardTitle}>Welcome to Knoodle!</Text>
          </View>
        )}

        {step === 1 && (
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="add-circle" size={24} color="#7C7CF0" />
            </View>
            <Text style={styles.cardTitle}>Create a Canvas</Text>
          </View>
        )}

        {step === 2 && (
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="notifications" size={24} color="#D4537E" />
            </View>
            <Text style={styles.cardTitle}>Stay Updated</Text>
          </View>
        )}

        {step === 3 && (
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="grid" size={24} color="#EF9F27" />
            </View>
            <Text style={styles.cardTitle}>Your Dashboard</Text>
          </View>
        )}

        <Text style={styles.cardDescription}>
          {step === 0 && "Let's take a quick 1-minute tour to help you get started with real-time collaborative drawing."}
          {step === 1 && "Tap this button to create a brand new canvas room. You can invite your friends by username to draw with you!"}
          {step === 2 && "Tap the notification bell to view incoming room invites from your friends, and real-time updates."}
          {step === 3 && "Switch between your active room list ('Canvases') and received collaborator invitations ('Invites') here."}
        </Text>

        {/* Progress Dots */}
        {step > 0 && (
          <View style={styles.progressDotsContainer}>
            <View style={[styles.progressDot, step === 1 && styles.progressDotActive]} />
            <View style={[styles.progressDot, step === 2 && styles.progressDotActive]} />
            <View style={[styles.progressDot, step === 3 && styles.progressDotActive]} />
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          {step > 0 ? (
            <Pressable style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.backButton} onPress={handleFinish}>
              <Text style={styles.backButtonText}>Skip</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.primaryButton}
            onPress={handleNext}
          >
            <Text style={styles.primaryButtonText}>
              {step === 0 ? "Start Tour" : step === 3 ? "Get Started" : "Next"}
            </Text>
            <Ionicons
              name={step === 3 ? "checkmark-circle" : "arrow-forward"}
              size={16}
              color="#FFFFFF"
              style={{ marginLeft: 4 }}
            />
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 100000,
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: '#7C7CF0',
    backgroundColor: 'rgba(124, 124, 240, 0.1)',
  },
  pulseRingRect: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: '#EF9F27',
    backgroundColor: 'rgba(239, 159, 39, 0.08)',
  },
  card: {
    position: 'absolute',
    backgroundColor: 'rgba(30, 30, 35, 0.95)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  cardDescription: {
    fontSize: 14,
    color: '#d0d4da',
    lineHeight: 20,
    marginBottom: 20,
  },
  progressDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressDotActive: {
    width: 16,
    backgroundColor: '#7C7CF0',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: '#a0a4aa',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C7CF0',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
