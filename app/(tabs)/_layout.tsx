import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import {
  HomeIcon,
  BrowseIcon,
  LibraryIcon,
  ProfileIcon,
  SavedIcon,
} from '@/components/icons/NavIcons';
import { colors } from '@/theme/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: 'Quicksand_600SemiBold',
          fontSize: 10,
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 84,
          paddingTop: 8,
          paddingBottom: 28,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <HomeIcon color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: 'Browse',
          tabBarIcon: ({ color }) => <BrowseIcon color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'My Articles',
          tabBarIcon: ({ color, focused }) => <SavedIcon color={color} size={22} filled={focused} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Caseload',
          tabBarIcon: ({ color }) => <LibraryIcon color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <ProfileIcon color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}
