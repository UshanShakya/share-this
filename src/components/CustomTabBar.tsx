import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Platform, useColorScheme, Animated, Easing } from 'react-native';
import { useSegments } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';

interface AnimatedTabItemProps {
  isFocused: boolean;
  label: string;
  activeIcon: string;
  inactiveIcon: string;
  lightColor: string;
  darkColor: string;
  lightBg: string;
  darkBg: string;
  inactiveColor: string;
  onPress: () => void;
}

function AnimatedTabItem({
  isFocused,
  label,
  activeIcon,
  inactiveIcon,
  lightColor,
  darkColor,
  lightBg,
  darkBg,
  inactiveColor,
  onPress,
}: AnimatedTabItemProps) {
  const scheme = useColorScheme();
  const activeColor = scheme === 'dark' ? darkColor : lightColor;
  const activeBg = scheme === 'dark' ? darkBg : lightBg;
  
  const [animatedValue] = useState(() => new Animated.Value(isFocused ? 1 : 0));

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
      useNativeDriver: false,
    }).start();
  }, [isFocused, animatedValue]);

  const paddingHorizontal = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 16],
  });

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', activeBg],
  });

  const textOpacity = animatedValue.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 1],
  });

  const textMaxWidth = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 85],
  });

  const iconColor = isFocused ? activeColor : inactiveColor;

  return (
    <Pressable onPress={onPress} style={styles.pressableWrapper}>
      <Animated.View
        style={[
          styles.tabButtonContainer,
          {
            backgroundColor,
            paddingHorizontal,
          },
        ]}
      >
        <Ionicons
          name={(isFocused ? activeIcon : inactiveIcon) as any}
          size={21}
          color={iconColor}
        />
        <Animated.View
          style={{
            maxWidth: textMaxWidth,
            opacity: textOpacity,
            overflow: 'hidden',
          }}
        >
          <Animated.Text
            numberOfLines={1}
            style={[
              styles.tabLabel,
              {
                color: activeColor,
                marginLeft: 6,
              },
            ]}
          >
            {label}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export function CustomTabBar({ state, descriptors, navigation }: any) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const segments = useSegments();

  // Hide the tab bar when viewing a specific room's canvas or member list
  const isRoomSubScreen = segments[1] === 'rooms' && segments.length > 2 && segments[2] !== 'new';

  if (isRoomSubScreen) {
    return null;
  }

  const renderTabButton = (
    routeName: string,
    activeIcon: string,
    inactiveIcon: string,
    label: string,
    lightColor: string,
    darkColor: string,
    lightBg: string,
    darkBg: string
  ) => {
    const index = state.routes.findIndex((r: any) => r.name === routeName);
    if (index === -1) return null;
    
    const isFocused = state.index === index;
    const inactiveColor = theme.textSecondary || '#B0B4BA';

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: state.routes[index]?.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate({ name: routeName, merge: true } as any);
      }
    };

    return (
      <AnimatedTabItem
        isFocused={isFocused}
        label={label}
        activeIcon={activeIcon}
        inactiveIcon={inactiveIcon}
        lightColor={lightColor}
        darkColor={darkColor}
        lightBg={lightBg}
        darkBg={darkBg}
        inactiveColor={inactiveColor}
        onPress={onPress}
      />
    );
  };

  const barBg = scheme === 'dark' ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  const borderBg = scheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          backgroundColor: barBg,
          borderColor: borderBg,
        },
      ]}
    >
      {/* Canvases Tab */}
      {renderTabButton('rooms', 'color-palette', 'color-palette-outline', 'Canvases', '#5B5BD6', '#7C7CF0', '#5B5BD618', '#7C7CF020')}

      {/* Friends Tab */}
      {renderTabButton('friends', 'heart', 'heart-outline', 'Friends', '#E5484D', '#F16063', '#E5484D18', '#F1606320')}

      {/* Settings Tab */}
      {renderTabButton('settings', 'settings', 'settings-outline', 'Settings', '#ED6C02', '#FF9800', '#ED6C0218', '#FF980020')}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 16,
    right: 16,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    paddingHorizontal: 8,
  },
  pressableWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 22,
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
