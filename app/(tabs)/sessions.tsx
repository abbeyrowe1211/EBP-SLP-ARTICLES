import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import { ARTICLES } from '@/data/articles';

// Sessions tab — shows a prompt to pick an article and build a session.
// Phase 6 will add saved sessions list here.
export default function Sessions() {
  const router = useRouter();

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Sessions</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.bolt}>⚡</Text>
        <Text style={styles.heading}>Build a session plan</Text>
        <Text style={styles.subheading}>
          Open any article in Browse and tap{'\n'}"Generate session plan" to get started.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.quickLabel}>QUICK START — RECENT ARTICLES</Text>

        {ARTICLES.slice(0, 3).map((article) => (
          <Pressable
            key={article.id}
            style={styles.quickCard}
            onPress={() =>
              router.push({
                pathname: '/session/builder',
                params: { articleId: article.id },
              })
            }
          >
            <View style={styles.quickCardInner}>
              <Text style={styles.quickCardTitle} numberOfLines={2}>
                {article.shortTitle}
              </Text>
              <Text style={styles.quickCardMeta}>
                {article.authorShort} · {article.year}
              </Text>
            </View>
            <Text style={styles.quickCardArrow}>→</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  screenTitle: { ...text.h2, color: colors.text },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  bolt: { fontSize: 48, marginBottom: 12 },
  heading: { ...text.h2, color: colors.text, marginBottom: 8 },
  subheading: {
    ...text.body,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 20,
  },
  quickLabel: { ...text.label, color: colors.textMuted, marginBottom: 12 },
  quickCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickCardInner: { flex: 1 },
  quickCardTitle: { ...text.h4, color: colors.text, marginBottom: 3 },
  quickCardMeta: { ...text.caption, color: colors.textMuted },
  quickCardArrow: { ...text.h3, color: colors.primary, marginLeft: 8 },
});
