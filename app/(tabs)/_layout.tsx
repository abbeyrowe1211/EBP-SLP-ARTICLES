import React, { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HomeIcon,
  BrowseIcon,
  LibraryIcon,
  ProfileIcon,
  SavedIcon,
} from '@/components/icons/NavIcons';
import { colors } from '@/theme/colors';
import { NEW_ARTICLES_SEEN_KEY, getPendingNewArticleIds } from '@/data/newArticles';

const styles = StyleSheet.create({
  newDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
    borderWidth: 1.5,
    borderColor: 'white',
  },
});

export default function TabLayout() {
  const [hasNewArticles, setHasNewArticles] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const [seenRaw, pendingIds] = await Promise.all([
          AsyncStorage.getItem(NEW_ARTICLES_SEEN_KEY),
          getPendingNewArticleIds(),
        ]);
        const seen: string[] = seenRaw ? JSON.parse(seenRaw) : [];
        setHasNewArticles(pendingIds.some((id) => !seen.includes(id)));
      } catch {}
    };
    check();
    // Re-check every 30s to pick up when user views the new articles panel
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: false,
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
          tabBarIcon: ({ color }) => (
            <View>
              <BrowseIcon color={color} size={22} />
              {hasNewArticles && (
                <View style={styles.newDot} />
              )}
            </View>
          ),
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
          title: 'Plans',
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
