import React from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors } from '../../src/constants/Colors';
import { CustomTabBar } from '../../src/components/CustomTabBar';

export default function AppLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'light' ? 'light' : 'dark'];

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 20,
          color: colors.text,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      {/* Hidden redirect root tab */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      
      {/* Visible Rooms Stack tab */}
      <Tabs.Screen
        name="rooms"
        options={{
          title: 'Rooms',
          headerShown: false,
        }}
      />

      {/* Visible Friends tab */}
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          headerShown: false,
        }}
      />


      {/* Visible Create tab */}
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          headerShown: false,
        }}
      />

      {/* Visible Settings tab */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
        }}
      />
    </Tabs>
  );
}
