import React, { useEffect, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Pressable,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '../themed-text';
import { Ionicons } from '@expo/vector-icons';

interface SideDrawerProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.8, 320);

export function SideDrawer({ visible, onClose, title, children }: SideDrawerProps) {
  const theme = useTheme();
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, animValue]);

  if (!visible) return null;

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-DRAWER_WIDTH, 0],
  });

  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const handleClose = () => {
    Animated.timing(animValue, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const isDark = theme.text === '#FFFFFF' || theme.background === '#121212';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        {/* Animated Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={styles.pressableBackdrop} onPress={handleClose} />
        </Animated.View>

        {/* Animated Drawer Content */}
        <Animated.View
          style={[
            styles.drawerContainer,
            {
              width: DRAWER_WIDTH,
              transform: [{ translateX }],
              backgroundColor: theme.backgroundElement || '#212225',
              borderColor: theme.backgroundSelected || '#2E3135',
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.backgroundSelected || '#2E3135' }]}>
            {title ? (
              <ThemedText style={styles.title} type="smallBold">
                {title}
              </ThemedText>
            ) : (
              <View />
            )}
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [
                styles.closeButton,
                {
                  backgroundColor: pressed
                    ? theme.backgroundSelected || 'rgba(255, 255, 255, 0.1)'
                    : 'transparent',
                },
              ]}
            >
              <Ionicons name="close" size={20} color={theme.text} />
            </Pressable>
          </View>

          {/* Children content wrapper */}
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  pressableBackdrop: {
    flex: 1,
  },
  drawerContainer: {
    height: '100%',
    borderRightWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
});
