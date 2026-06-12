import React, { useRef, useState, useEffect } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;

interface SwipeableNotificationItemProps {
  id: string;
  dismissTriggered: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}

export function SwipeableNotificationItem({
  dismissTriggered,
  onDismiss,
  children,
}: SwipeableNotificationItemProps) {
  // Use state lazy-initialization to avoid React 19 ref-during-render rules
  const [translateX] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const [itemHeight] = useState(() => new Animated.Value(0));

  const [isCollapsing, setIsCollapsing] = useState(false);
  const [panHandlers, setPanHandlers] = useState<any>(null);
  
  const actualHeight = useRef(0);
  const isMounted = useRef(true);

  // Store mutable callbacks in refs to avoid stale closures in memoized callbacks
  const dismissRef = useRef<() => void>(onDismiss);
  const animDismissRef = useRef<(toValue: number) => void>((v) => {});

  const animateDismiss = (toValue: number) => {
    // Lock height to the actual measured layout height right before collapsing
    itemHeight.setValue(actualHeight.current);
    setIsCollapsing(true);

    Animated.parallel([
      Animated.timing(translateX, {
        toValue,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start(() => {
      // Collapse height to 0
      Animated.timing(itemHeight, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start(() => {
        if (isMounted.current) {
          dismissRef.current();
        }
      });
    });
  };

  // Update refs outside of render using useEffect
  useEffect(() => {
    dismissRef.current = onDismiss;
    animDismissRef.current = animateDismiss;
  });

  // Detect programmatically triggered dismiss (e.g. from staggered "Mark all as read" clear)
  useEffect(() => {
    if (dismissTriggered) {
      animDismissRef.current(-SCREEN_WIDTH);
    }
  }, [dismissTriggered]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Initialize PanResponder inside useEffect to comply with React 19 constraints
  useEffect(() => {
    const pr = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Hijack horizontal swipes only, ignore small taps/vertical scrolls
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 8;
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          animDismissRef.current(-SCREEN_WIDTH);
        } else if (gestureState.dx > SWIPE_THRESHOLD) {
          animDismissRef.current(SCREEN_WIDTH);
        } else {
          // Spring back to center
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 8,
          }).start();
        }
      },
    });
    setPanHandlers(pr.panHandlers);
  }, [translateX]);

  return (
    <Animated.View
      onLayout={(e) => {
        if (!isCollapsing) {
          actualHeight.current = e.nativeEvent.layout.height;
        }
      }}
      style={[
        isCollapsing ? { height: itemHeight } : null,
        {
          overflow: 'hidden',
        },
      ]}
    >
      <Animated.View
        {...(panHandlers || {})}
        style={[
          styles.contentWrapper,
          {
            opacity,
            transform: [{ translateX }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  contentWrapper: {
    width: '100%',
  },
});
