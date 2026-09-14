import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import { EVIDENCE_LABELS, EVIDENCE_COLORS, type Article } from '@/data/articles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSavedArticleIds, toggleSavedArticle, subscribeSavedArticles } from '@/store/savedArticlesStore';
import {
  getGroups,
  createGroup,
  renameGroup,
  deleteGroup,
  setGroupArticles,
  subscribeGroups,
  type ArticleGroup,
} from '@/store/articleGroupsStore';
import { useArticles } from '@/context/ArticlesContext';
import { isPremium } from '@/config/premium';

// ─── Browse all articles modal ────────────────────────────────────────────────

const BrowseAllModal: React.FC<{
  visible: boolean;
  allArticles: Article[];
  savedIds: Set<string>;
  groups: ArticleGroup[];
  onSaveToGroup: (articleId: string, groupId: string | null) => void;
  onUnsave: (articleId: string) => void;
  onClose: () => void;
  onReadArticle: (article: Article) => void;
  /** When set, saving an article auto-assigns it to this group — no picker needed */
  targetGroupId?: string | null;
  targetGroupName?: string | null;
}> = ({ visible, allArticles, savedIds, groups, onSaveToGroup, onUnsave, onClose, onReadArticle, targetGroupId, targetGroupName }) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [groupPickerArticleId, setGroupPickerArticleId] = useState<string | null>(null);
  const [newGroupInputVisible, setNewGroupInputVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // Reset search when modal opens
  React.useEffect(() => { if (visible) setQuery(''); }, [visible]);

  const filtered = allArticles.filter((a) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      a.shortTitle.toLowerCase().includes(q) ||
      a.authorShort.toLowerCase().includes(q) ||
      a.areas.some((ar) => ar.toLowerCase().includes(q)) ||
      String(a.year).includes(q)
    );
  });

  const handleSavePress = (articleId: string) => {
    if (savedIds.has(articleId)) {
      onUnsave(articleId);
      return;
    }
    // If opened from "Add articles" on a group, go straight to that group
    if (targetGroupId) {
      onSaveToGroup(articleId, targetGroupId);
      return;
    }
    // Otherwise show group picker if groups exist, else save ungrouped
    if (groups.length > 0) {
      setGroupPickerArticleId(articleId);
    } else {
      onSaveToGroup(articleId, null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[browseStyles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={browseStyles.header}>
          <Pressable onPress={onClose} style={browseStyles.closeBtn}>
            <Text style={browseStyles.closeBtnText}>✕</Text>
          </Pressable>
          <Text style={browseStyles.title}>Browse all articles</Text>
          <Pressable style={browseStyles.doneBtn} onPress={onClose}>
            <Text style={browseStyles.doneBtnText}>Done</Text>
          </Pressable>
        </View>

        {/* "Adding to group" banner — shown when opened from a group card */}
        {targetGroupId && targetGroupName ? (
          <View style={browseStyles.addingToBanner}>
            <Text style={browseStyles.addingToBannerText}>
              Adding to · <Text style={browseStyles.addingToGroupName}>{targetGroupName}</Text>
            </Text>
          </View>
        ) : null}

        <View style={browseStyles.searchRow}>
          <TextInput
            style={browseStyles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by title, author, area…"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable style={browseStyles.searchClearBtn} onPress={() => setQuery('')} hitSlop={8}>
              <View style={browseStyles.searchClearCircle}>
                <Text style={browseStyles.searchClearText}>✕</Text>
              </View>
            </Pressable>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {filtered.map((article) => {
            const saved = savedIds.has(article.id);
            const evColor = EVIDENCE_COLORS[article.evidenceLevel];
            return (
              <View key={article.id} style={browseStyles.row}>
                <Pressable style={browseStyles.rowInfo} onPress={() => onReadArticle(article)}>
                  <View style={[browseStyles.evBadge, { backgroundColor: evColor.bg }]}>
                    <Text style={[browseStyles.evBadgeText, { color: evColor.text }]}>
                      {EVIDENCE_LABELS[article.evidenceLevel]}
                    </Text>
                  </View>
                  <Text style={browseStyles.rowTitle} numberOfLines={2}>{article.shortTitle}</Text>
                  <Text style={browseStyles.rowMeta}>{article.authorShort} · {article.year} · {article.areas[0]}</Text>
                </Pressable>
                <Pressable
                  style={[browseStyles.saveBtn, saved && browseStyles.saveBtnActive]}
                  onPress={() => handleSavePress(article.id)}
                >
                  <Text style={[browseStyles.saveBtnText, saved && browseStyles.saveBtnTextActive]}>
                    {saved ? '✓ Saved' : 'Save'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* In-app group picker sheet */}
        {groupPickerArticleId && (
          <View style={browseStyles.groupPickerOverlay}>
            <Pressable style={browseStyles.groupPickerBackdrop} onPress={() => setGroupPickerArticleId(null)} />
            <View style={browseStyles.groupPickerSheet}>
              <View style={browseStyles.sheetHandle} />
              <Text style={browseStyles.sheetTitle}>Add to a group?</Text>
              <Text style={browseStyles.sheetSub}>Article saved — choose a group or skip.</Text>
              <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
                {groups.map((g) => (
                  <Pressable
                    key={g.id}
                    style={browseStyles.groupOptionRow}
                    onPress={() => {
                      onSaveToGroup(groupPickerArticleId, g.id);
                      setGroupPickerArticleId(null);
                    }}
                  >
                    <Text style={browseStyles.groupOptionName}>{g.name}</Text>
                    <Text style={browseStyles.groupOptionCount}>{g.articleIds.length} articles</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable
                style={browseStyles.newGroupOptionRow}
                onPress={() => { setNewGroupInputVisible(true); setNewGroupName(''); }}
              >
                <Text style={browseStyles.newGroupOptionText}>+ New group</Text>
              </Pressable>
              <Pressable
                style={browseStyles.skipRow}
                onPress={() => { onSaveToGroup(groupPickerArticleId, null); setGroupPickerArticleId(null); }}
              >
                <Text style={browseStyles.skipText}>Save without group</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* New group input */}
        {newGroupInputVisible && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={browseStyles.groupPickerOverlay}
          >
            <Pressable style={browseStyles.groupPickerBackdrop} onPress={() => setNewGroupInputVisible(false)} />
            <View style={browseStyles.groupPickerSheet}>
              <View style={browseStyles.sheetHandle} />
              <Text style={browseStyles.sheetTitle}>New group</Text>
              <TextInput
                style={browseStyles.newGroupInput}
                value={newGroupName}
                onChangeText={setNewGroupName}
                placeholder="e.g. Aphasia, Dysphagia Research…"
                placeholderTextColor={colors.textMuted}
                autoFocus
                returnKeyType="done"
              />
              <View style={browseStyles.newGroupActions}>
                <Pressable style={browseStyles.ngCancelBtn} onPress={() => setNewGroupInputVisible(false)}>
                  <Text style={browseStyles.ngCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={browseStyles.ngCreateBtn}
                  onPress={async () => {
                    if (!newGroupName.trim() || !groupPickerArticleId) return;
                    onSaveToGroup(groupPickerArticleId, `__new__${newGroupName.trim()}`);
                    setNewGroupInputVisible(false);
                    setGroupPickerArticleId(null);
                  }}
                >
                  <Text style={browseStyles.ngCreateText}>Create</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
};

const browseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { ...text.bodySmall, color: colors.textMuted } as any,
  title: { ...text.h3, color: colors.text, flex: 1, textAlign: 'center' } as any,
  doneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.primaryDark,
  },
  doneBtnText: { ...text.bodySmall, color: colors.surface, fontFamily: 'Quicksand_700Bold' } as any,
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 16,
    gap: 8,
  },
  search: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...text.bodySmall,
    color: colors.text,
    backgroundColor: colors.surface,
  } as any,
  searchClearBtn: {
    padding: 4,
  },
  searchClearCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Quicksand_700Bold',
    lineHeight: 13,
  } as any,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowInfo: { flex: 1, gap: 4 },
  rowTitle: { ...text.bodySmall, color: colors.text, fontFamily: 'Quicksand_600SemiBold', lineHeight: 18 } as any,
  rowMeta: { ...text.caption, color: colors.textMuted } as any,
  evBadge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  evBadgeText: { ...text.badge, fontSize: 10 } as any,
  saveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minWidth: 62,
    alignItems: 'center',
  },
  saveBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  saveBtnText: { ...text.caption, color: colors.textMuted, fontFamily: 'Quicksand_600SemiBold' } as any,
  saveBtnTextActive: { color: colors.surface },

  // "Adding to [group]" banner
  addingToBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.primaryLighter,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  addingToBannerText: { ...text.caption, color: colors.primaryDeep, fontFamily: 'Quicksand_600SemiBold' } as any,
  addingToGroupName: { fontFamily: 'Quicksand_700Bold', color: colors.primaryDeep } as any,

  // Group picker sheet (inside BrowseAllModal)
  groupPickerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  groupPickerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  groupPickerSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 32,
    borderTopWidth: 1.5,
    borderColor: colors.border,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: { ...text.h3, color: colors.text, marginBottom: 4 } as any,
  sheetSub: { ...text.bodySmall, color: colors.textMuted, marginBottom: 16 } as any,
  groupOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupOptionName: { ...text.bodySmall, color: colors.primaryDeep, fontFamily: 'Quicksand_600SemiBold' } as any,
  groupOptionCount: { ...text.caption, color: colors.textMuted } as any,
  newGroupOptionRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  newGroupOptionText: { ...text.bodySmall, color: colors.primary, fontFamily: 'Quicksand_700Bold' } as any,
  skipRow: { paddingVertical: 14 },
  skipText: { ...text.bodySmall, color: colors.textMuted, fontFamily: 'Quicksand_600SemiBold' } as any,

  // New group input (inside BrowseAllModal)
  newGroupInput: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...text.body,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: 16,
    marginTop: 8,
  } as any,
  newGroupActions: { flexDirection: 'row', gap: 10 },
  ngCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  ngCancelText: { ...text.bodySmall, color: colors.textMuted, fontFamily: 'Quicksand_600SemiBold' } as any,
  ngCreateBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
  },
  ngCreateText: { ...text.bodySmall, color: colors.surface, fontFamily: 'Quicksand_700Bold' } as any,
});

// ─── Article picker modal ─────────────────────────────────────────────────────

const ArticlePickerModal: React.FC<{
  visible: boolean;
  savedArticles: Article[];
  currentIds: string[];
  onDone: (ids: string[]) => void;
  onClose: () => void;
}> = ({ visible, savedArticles, currentIds, onDone, onClose }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentIds));

  useEffect(() => {
    if (visible) setSelected(new Set(currentIds));
  }, [visible, currentIds]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Add articles to group</Text>
            <Pressable style={styles.doneBtn} onPress={() => onDone([...selected])}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {savedArticles.length === 0 ? (
              <Text style={styles.pickerEmpty}>No saved articles yet. Save articles from Browse first.</Text>
            ) : (
              savedArticles.map((article) => {
                const evColor = EVIDENCE_COLORS[article.evidenceLevel];
                const checked = selected.has(article.id);
                return (
                  <Pressable
                    key={article.id}
                    style={[styles.pickerRow, checked && styles.pickerRowActive]}
                    onPress={() => toggle(article.id)}
                  >
                    <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                      {checked && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <View style={styles.pickerRowInfo}>
                      <View style={[styles.evBadge, { backgroundColor: evColor.bg }]}>
                        <Text style={[styles.evBadgeText, { color: evColor.text }]}>
                          {EVIDENCE_LABELS[article.evidenceLevel]}
                        </Text>
                      </View>
                      <Text style={styles.pickerRowTitle} numberOfLines={2}>
                        {article.shortTitle}
                      </Text>
                      <Text style={styles.pickerRowMeta}>
                        {article.authorShort} · {article.year}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── New group modal ──────────────────────────────────────────────────────────

const NewGroupModal: React.FC<{
  visible: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}> = ({ visible, onSave, onClose }) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (visible) setName('');
  }, [visible]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Enter a name for this group.');
      return;
    }
    onSave(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.newGroupSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.newGroupTitle}>New group</Text>
          <TextInput
            style={styles.newGroupInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Aphasia, Dysphagia Research, Favourites…"
            placeholderTextColor={colors.textMuted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          <View style={styles.newGroupActions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.createBtn} onPress={handleSave}>
              <Text style={styles.createBtnText}>Create</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Group card ───────────────────────────────────────────────────────────────

const GroupCard: React.FC<{
  group: ArticleGroup;
  articles: Article[];
  expanded: boolean;
  onToggle: () => void;
  onArticlePress: (article: Article) => void;
  onUnsaveArticle: (id: string) => void;
  onRemoveFromGroup: (articleId: string) => void;
  onAddArticles: () => void;
  onRename: () => void;
  onDelete: () => void;
  notedIds?: Set<string>;
}> = ({
  group,
  articles,
  expanded,
  onToggle,
  onArticlePress,
  onUnsaveArticle,
  onRemoveFromGroup,
  onAddArticles,
  onRename,
  onDelete,
  notedIds,
}) => (
  <View style={styles.groupCard}>
    {/* Group header */}
    <Pressable style={styles.groupHeader} onPress={onToggle}>
      <View style={styles.groupHeaderLeft}>
        <Text style={styles.groupName}>{group.name}</Text>
        <View style={styles.groupCountBadge}>
          <Text style={styles.groupCountText}>{articles.length}</Text>
        </View>
      </View>
      <View style={styles.groupHeaderRight}>
        <Pressable style={styles.groupMenuBtn} onPress={onRename} hitSlop={8}>
          <Text style={styles.groupMenuBtnText}>✎</Text>
        </Pressable>
        <Pressable style={[styles.groupMenuBtn, styles.groupDeleteBtn]} onPress={onDelete} hitSlop={8}>
          <Text style={styles.groupDeleteBtnText}>🗑</Text>
        </Pressable>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
    </Pressable>

    {expanded && (
      <View style={styles.groupBody}>
        {articles.length === 0 ? (
          <Text style={styles.groupEmptyText}>No articles yet — tap below to add some.</Text>
        ) : (
          articles.map((article) => {
            const evColor = EVIDENCE_COLORS[article.evidenceLevel];
            return (
              <Pressable key={article.id} style={styles.articleRow} onPress={() => onArticlePress(article)}>
                <View style={styles.articleRowLeft}>
                  <View style={styles.articleBadgeRow}>
                    <View style={[styles.evBadge, { backgroundColor: evColor.bg }]}>
                      <Text style={[styles.evBadgeText, { color: evColor.text }]}>
                        {EVIDENCE_LABELS[article.evidenceLevel]}
                      </Text>
                    </View>
                    {notedIds?.has(article.id) && (
                      <View style={[styles.evBadge, { backgroundColor: '#FFFBEB' }]}>
                        <Text style={[styles.evBadgeText, { color: '#B45309' }]}>📝 Note</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.articleRowTitle} numberOfLines={2}>{article.shortTitle}</Text>
                  <Text style={styles.articleRowMeta}>
                    {article.authorShort} · {article.year} · {article.areas[0]}
                  </Text>
                </View>
                <View style={styles.articleRowActions}>
                  <Pressable
                    style={styles.removeFromGroupBtn}
                    onPress={() => onRemoveFromGroup(article.id)}
                    hitSlop={8}
                  >
                    <Text style={styles.removeFromGroupText}>✕</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })
        )}
        <Pressable style={styles.addArticlesBtn} onPress={onAddArticles}>
          <Text style={styles.addArticlesBtnText}>+ Add articles</Text>
        </Pressable>
      </View>
    )}
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export const SavedArticlesScreen: React.FC = () => {
  const router = useRouter();
  const { articles } = useArticles();

  const [savedArticles, setSavedArticles] = useState<Article[]>([]);
  const [notedIds, setNotedIds] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<ArticleGroup[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [newGroupVisible, setNewGroupVisible] = useState(false);
  const [pickerGroupId, setPickerGroupId] = useState<string | null>(null); // kept for legacy, unused
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [unsaveArticleId, setUnsaveArticleId] = useState<string | null>(null);
  const [allBrowseVisible, setAllBrowseVisible] = useState(false);
  const [allSavedIds, setAllSavedIds] = useState<Set<string>>(new Set());
  // When Browse All is opened from "+ Add articles" on a group, this is set
  const [browseTargetGroupId, setBrowseTargetGroupId] = useState<string | null>(null);
  // Set right before navigating to an article to "read before deciding" from
  // Browse All — reopens the modal (in the same group-add context) once the
  // user comes back, instead of dropping them back on the plain My Articles list.
  const [reopenBrowseAfterRead, setReopenBrowseAfterRead] = useState(false);

  const reload = useCallback(async () => {
    const [ids, grps, notesRaw] = await Promise.all([
      getSavedArticleIds(),
      getGroups(),
      AsyncStorage.getItem('ebp_article_notes_v1'),
    ]);
    setSavedArticles(articles.filter((a) => ids.has(a.id)));
    setAllSavedIds(ids);
    setGroups(grps);
    try {
      if (notesRaw) {
        const notes = JSON.parse(notesRaw) as Record<string, string>;
        setNotedIds(new Set(Object.keys(notes).filter((k) => !!notes[k]?.trim())));
      } else {
        setNotedIds(new Set());
      }
    } catch {
      setNotedIds(new Set());
    }
  }, [articles]);

  useFocusEffect(useCallback(() => {
    reload();
    if (reopenBrowseAfterRead) {
      setReopenBrowseAfterRead(false);
      setAllBrowseVisible(true);
    }
  }, [reload, reopenBrowseAfterRead]));

  useEffect(() => {
    const unsubSaved = subscribeSavedArticles(reload);
    const unsubGroups = subscribeGroups(reload);
    return () => { unsubSaved(); unsubGroups(); };
  }, [reload]);

  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleCreateGroup = async (name: string) => {
    if (!isPremium()) {
      setNewGroupVisible(false);
      router.push('/paywall');
      return;
    }
    const grp = await createGroup(name);
    setNewGroupVisible(false);
    setExpandedIds((prev) => new Set([...prev, grp.id]));
  };

  const handlePickerDone = async (articleIds: string[]) => {
    if (!pickerGroupId) return;
    await setGroupArticles(pickerGroupId, articleIds);
    setPickerGroupId(null);
  };

  const handleRename = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setRenameText(group.name);
    setRenameGroupId(groupId);
  };

  const confirmRename = async () => {
    if (!renameGroupId || !renameText.trim()) return;
    await renameGroup(renameGroupId, renameText.trim());
    setRenameGroupId(null);
    setRenameText('');
  };

  const handleDelete = (groupId: string) => setDeleteGroupId(groupId);

  const confirmDelete = async () => {
    if (!deleteGroupId) return;
    await deleteGroup(deleteGroupId);
    setDeleteGroupId(null);
  };

  const handleRemoveFromGroup = async (groupId: string, articleId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    await setGroupArticles(groupId, group.articleIds.filter((id) => id !== articleId));
  };

  const handleUnsave = (id: string) => setUnsaveArticleId(id);

  const confirmUnsave = async () => {
    if (!unsaveArticleId) return;
    await toggleSavedArticle(unsaveArticleId);
    // Remove from all groups too
    for (const g of groups) {
      if (g.articleIds.includes(unsaveArticleId)) {
        await setGroupArticles(g.id, g.articleIds.filter((aid) => aid !== unsaveArticleId));
      }
    }
    setUnsaveArticleId(null);
  };

  // Articles not in any group
  const allGroupedIds = new Set(groups.flatMap((g) => g.articleIds));
  const ungrouped = savedArticles.filter((a) => !allGroupedIds.has(a.id));

  // Move ungrouped article to a group
  const [movePickerArticleId, setMovePickerArticleId] = useState<string | null>(null);

  const handleMoveToGroup = (groupId: string) => {
    if (!isPremium()) {
      setMovePickerArticleId(null);
      router.push('/paywall');
      return;
    }
    const articleId = movePickerArticleId;
    if (!articleId) return;
    const grp = groups.find((g) => g.id === groupId);
    if (grp) {
      const updated = grp.articleIds.includes(articleId)
        ? grp.articleIds
        : [...grp.articleIds, articleId];
      setGroupArticles(groupId, updated);
    }
    setMovePickerArticleId(null);
  };

  const pickerGroup = groups.find((g) => g.id === pickerGroupId);
  const renameGroup_obj = groups.find((g) => g.id === renameGroupId);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Articles</Text>
          <Text style={styles.headerSub}>{savedArticles.length} saved</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.browseAllBtn} onPress={() => setAllBrowseVisible(true)}>
            <Text style={styles.browseAllBtnText}>Browse all</Text>
          </Pressable>
          <Pressable
            style={styles.newGroupBtn}
            onPress={() => {
              if (!isPremium()) { router.push('/paywall'); return; }
              setNewGroupVisible(true);
            }}
          >
            <Text style={styles.newGroupBtnText}>+ Group</Text>
          </Pressable>
        </View>
      </View>

      {savedArticles.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIllustration}>📚</Text>
          <Text style={styles.emptyTitle}>Your article library</Text>
          <Text style={styles.emptyBody}>
            Save EBP articles from Browse and they'll live here — organized into groups, ready for clinical reference.
          </Text>
          <View style={styles.emptyHints}>
            <View style={styles.emptyHintRow}>
              <Text style={styles.emptyHintIcon}>🔍</Text>
              <Text style={styles.emptyHintText}>Find articles by practice area or keyword</Text>
            </View>
            <View style={styles.emptyHintRow}>
              <Text style={styles.emptyHintIcon}>🔖</Text>
              <Text style={styles.emptyHintText}>Tap the bookmark icon to save any article</Text>
            </View>
            <View style={styles.emptyHintRow}>
              <Text style={styles.emptyHintIcon}>📂</Text>
              <Text style={styles.emptyHintText}>Group saved articles by client, area, or project (Pro)</Text>
            </View>
          </View>
          <Pressable style={styles.emptyBrowseBtn} onPress={() => setAllBrowseVisible(true)}>
            <Text style={styles.emptyBrowseBtnText}>Browse articles →</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Named groups */}
          {groups.map((group) => {
            const groupArticles = savedArticles.filter((a) => group.articleIds.includes(a.id));
            return (
              <GroupCard
                key={group.id}
                group={group}
                articles={groupArticles}
                expanded={expandedIds.has(group.id)}
                onToggle={() => toggleExpand(group.id)}
                onArticlePress={(article) =>
                  router.push({ pathname: '/article/[id]', params: { id: article.id } })
                }
                onUnsaveArticle={handleUnsave}
                onRemoveFromGroup={(articleId) => handleRemoveFromGroup(group.id, articleId)}
                onAddArticles={() => {
                  if (!isPremium()) { router.push('/paywall'); return; }
                  setBrowseTargetGroupId(group.id);
                  setAllBrowseVisible(true);
                }}
                onRename={() => handleRename(group.id)}
                onDelete={() => handleDelete(group.id)}
                notedIds={notedIds}
              />
            );
          })}

          {/* Ungrouped */}
          {ungrouped.length > 0 && (
            <View style={styles.ungroupedSection}>
              <Text style={styles.ungroupedLabel}>
                UNGROUPED · {ungrouped.length}
              </Text>
              {ungrouped.map((article) => {
                const evColor = EVIDENCE_COLORS[article.evidenceLevel];
                return (
                  <Pressable
                    key={article.id}
                    style={styles.articleRow}
                    onPress={() => router.push({ pathname: '/article/[id]', params: { id: article.id } })}
                    onLongPress={() => {
                      if (groups.length === 0) return;
                      if (!isPremium()) { router.push('/paywall'); return; }
                      setMovePickerArticleId(article.id);
                    }}
                    delayLongPress={400}
                  >
                    <View style={styles.articleRowLeft}>
                      <View style={styles.articleBadgeRow}>
                        <View style={[styles.evBadge, { backgroundColor: evColor.bg }]}>
                          <Text style={[styles.evBadgeText, { color: evColor.text }]}>
                            {EVIDENCE_LABELS[article.evidenceLevel]}
                          </Text>
                        </View>
                        {notedIds.has(article.id) && (
                          <View style={[styles.evBadge, { backgroundColor: '#FFFBEB' }]}>
                            <Text style={[styles.evBadgeText, { color: '#B45309' }]}>📝 Note</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.articleRowTitle} numberOfLines={2}>{article.shortTitle}</Text>
                      <Text style={styles.articleRowMeta}>
                        {article.authorShort} · {article.year} · {article.areas[0]}
                      </Text>
                    </View>
                    <View style={styles.ungroupedActions}>
                      {groups.length > 0 && (
                        <Pressable
                          style={styles.moveToGroupBtn}
                          onPress={() => {
                            if (!isPremium()) { router.push('/paywall'); return; }
                            setMovePickerArticleId(article.id);
                          }}
                          hitSlop={8}
                        >
                          <Text style={styles.moveToGroupText}>→ Group</Text>
                        </Pressable>
                      )}
                      <Pressable
                        style={styles.unsaveBtn}
                        onPress={() => handleUnsave(article.id)}
                        hitSlop={8}
                      >
                        <Text style={styles.unsaveBtnText}>✕</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Browse all modal */}
      <BrowseAllModal
        visible={allBrowseVisible}
        allArticles={articles}
        savedIds={allSavedIds}
        groups={groups}
        targetGroupId={browseTargetGroupId}
        targetGroupName={browseTargetGroupId ? (groups.find((g) => g.id === browseTargetGroupId)?.name ?? null) : null}
        onSaveToGroup={async (articleId, groupId) => {
          // First make sure article is saved — saving itself is always free
          if (!allSavedIds.has(articleId)) await toggleSavedArticle(articleId);
          if (!groupId) return; // no group — just save
          if (!isPremium()) {
            // Grouping is a premium feature — article is saved above, just
            // skip the group assignment rather than interrupting the save.
            setAllBrowseVisible(false);
            setBrowseTargetGroupId(null);
            router.push('/paywall');
            return;
          }
          if (groupId.startsWith('__new__')) {
            // Create new group with this name
            const name = groupId.replace('__new__', '');
            const grp = await createGroup(name);
            await setGroupArticles(grp.id, [articleId]);
          } else {
            const grp = groups.find((g) => g.id === groupId);
            if (grp) {
              const updated = grp.articleIds.includes(articleId)
                ? grp.articleIds
                : [...grp.articleIds, articleId];
              await setGroupArticles(groupId, updated);
            }
          }
        }}
        onUnsave={async (id) => { await toggleSavedArticle(id); }}
        onClose={() => { setAllBrowseVisible(false); setBrowseTargetGroupId(null); }}
        onReadArticle={(article) => {
          setReopenBrowseAfterRead(true);
          setAllBrowseVisible(false);
          router.push({ pathname: '/article/[id]', params: { id: article.id } });
        }}
      />

      {/* Move-to-group picker (for ungrouped articles) */}
      {movePickerArticleId && groups.length > 0 && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setMovePickerArticleId(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={() => setMovePickerArticleId(null)} />
            <View style={styles.pickerSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.pickerTitle}>Move to group</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
                {groups.map((g) => (
                  <Pressable
                    key={g.id}
                    style={styles.moveGroupRow}
                    onPress={() => handleMoveToGroup(g.id)}
                  >
                    <Text style={styles.moveGroupName}>{g.name}</Text>
                    <Text style={styles.moveGroupCount}>{g.articleIds.length} articles</Text>
                  </Pressable>
                ))}
                <View style={{ height: 16 }} />
              </ScrollView>
              <Pressable style={styles.moveCancelBtn} onPress={() => setMovePickerArticleId(null)}>
                <Text style={styles.moveCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* New group modal */}
      <NewGroupModal
        visible={newGroupVisible}
        onSave={handleCreateGroup}
        onClose={() => setNewGroupVisible(false)}
      />

      {/* Article picker modal */}
      <ArticlePickerModal
        visible={!!pickerGroupId}
        savedArticles={savedArticles}
        currentIds={pickerGroup?.articleIds ?? []}
        onDone={handlePickerDone}
        onClose={() => setPickerGroupId(null)}
      />

      {/* ── Rename group modal ── */}
      <Modal visible={!!renameGroupId} transparent animationType="fade" onRequestClose={() => setRenameGroupId(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={saStyles.overlay}>
          <View style={saStyles.card}>
            <Text style={saStyles.title}>Rename group</Text>
            <TextInput
              style={saStyles.input}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Group name…"
              placeholderTextColor={colors.textMuted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmRename}
            />
            <View style={saStyles.actions}>
              <Pressable style={saStyles.cancelBtn} onPress={() => setRenameGroupId(null)}>
                <Text style={saStyles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={saStyles.confirmBtn} onPress={confirmRename}>
                <Text style={saStyles.confirmText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Delete group confirm modal ── */}
      <Modal visible={!!deleteGroupId} transparent animationType="fade" onRequestClose={() => setDeleteGroupId(null)}>
        <View style={saStyles.overlay}>
          <View style={saStyles.card}>
            <Text style={saStyles.icon}>🗑</Text>
            <Text style={saStyles.title}>Delete "{groups.find(g => g.id === deleteGroupId)?.name}"?</Text>
            <Text style={saStyles.body}>The group will be removed. Saved articles stay in your library.</Text>
            <View style={saStyles.actions}>
              <Pressable style={saStyles.cancelBtn} onPress={() => setDeleteGroupId(null)}>
                <Text style={saStyles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[saStyles.confirmBtn, saStyles.destructiveBtn]} onPress={confirmDelete}>
                <Text style={saStyles.confirmText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Unsave article confirm modal ── */}
      <Modal visible={!!unsaveArticleId} transparent animationType="fade" onRequestClose={() => setUnsaveArticleId(null)}>
        <View style={saStyles.overlay}>
          <View style={saStyles.card}>
            <Text style={saStyles.title}>Remove from saved?</Text>
            <Text style={saStyles.body}>This article will be unsaved and removed from all groups.</Text>
            <View style={saStyles.actions}>
              <Pressable style={saStyles.cancelBtn} onPress={() => setUnsaveArticleId(null)}>
                <Text style={saStyles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[saStyles.confirmBtn, saStyles.destructiveBtn]} onPress={confirmUnsave}>
                <Text style={saStyles.confirmText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

// ─── Shared modal styles for this screen ─────────────────────────────────────
const saStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  icon: { fontSize: 28, marginBottom: 8 },
  title: { ...text.h3, color: colors.primaryDeep, textAlign: 'center', marginBottom: 8 } as any,
  body: { ...text.bodySmall, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 } as any,
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    ...text.body,
    color: colors.text,
    backgroundColor: colors.bg,
    marginBottom: 16,
  } as any,
  actions: { flexDirection: 'row', gap: 10, width: '100%' },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  cancelText: { ...text.bodySmall, color: colors.textMuted, fontFamily: 'Quicksand_600SemiBold' } as any,
  confirmBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 12,
    backgroundColor: colors.primaryDark, alignItems: 'center',
  },
  destructiveBtn: { backgroundColor: '#DC2626' },
  confirmText: { ...text.bodySmall, color: colors.surface, fontFamily: 'Quicksand_700Bold' } as any,
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerTitle: { ...text.h2, color: colors.text },
  headerSub: { ...text.caption, color: colors.textMuted, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  browseAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  browseAllBtnText: {
    ...text.bodySmall,
    color: colors.primaryDark,
    fontFamily: 'Quicksand_600SemiBold',
  },
  newGroupBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.primaryLighter,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  newGroupBtnText: {
    ...text.bodySmall,
    color: colors.primaryDeep,
    fontFamily: 'Quicksand_700Bold',
  },

  scroll: { paddingHorizontal: 16, paddingTop: 4 },

  // ── Group card ──
  groupCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  groupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  groupHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupMenuBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.primaryLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupMenuBtnText: { fontSize: 14, color: colors.primaryDeep },
  groupDeleteBtn: { backgroundColor: '#FEF2F2' },
  groupDeleteBtnText: { fontSize: 13 },
  groupName: { ...text.h4, color: colors.text },
  groupCountBadge: {
    backgroundColor: colors.primaryLighter,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  groupCountText: { ...text.caption, color: colors.primaryDeep, fontFamily: 'Quicksand_700Bold' },
  chevron: { ...text.caption, color: colors.textMuted },
  groupBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 4,
  },
  groupEmptyText: {
    ...text.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  addArticlesBtn: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addArticlesBtnText: {
    ...text.bodySmall,
    color: colors.primaryDeep,
    fontFamily: 'Quicksand_600SemiBold',
  },

  // ── Article row (shared) ──
  articleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  articleRowLeft: { flex: 1, gap: 5 },
  articleRowTitle: {
    ...text.bodySmall,
    color: colors.text,
    fontFamily: 'Quicksand_600SemiBold',
    lineHeight: 18,
  },
  articleRowMeta: { ...text.caption, color: colors.textMuted },
  articleRowActions: { alignItems: 'flex-end', gap: 6 },
  removeFromGroupBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  removeFromGroupText: { ...text.caption, color: colors.textMuted, fontSize: 11 },

  // ── Ungrouped ──
  ungroupedSection: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  ungroupedLabel: {
    ...text.label,
    color: colors.textMuted,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 2,
  },

  ungroupedActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  moveToGroupBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.primaryLighter,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  moveToGroupText: { ...text.caption, color: colors.primaryDeep, fontFamily: 'Quicksand_600SemiBold' },
  unsaveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  unsaveBtnText: { ...text.caption, color: colors.textMuted, fontSize: 11 },
  moveGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  moveGroupName: { ...text.bodySmall, color: colors.primaryDeep, fontFamily: 'Quicksand_600SemiBold' },
  moveGroupCount: { ...text.caption, color: colors.textMuted },
  moveCancelBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  moveCancelText: { ...text.bodySmall, color: colors.textMuted, fontFamily: 'Quicksand_600SemiBold' },

  // ── Evidence badge ──
  articleBadgeRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 2 },
  evBadge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  evBadgeText: { ...text.badge, fontSize: 10 },

  // ── Modals ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },

  // New group sheet
  newGroupSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  newGroupTitle: { ...text.h3, color: colors.text, marginBottom: 16 },
  newGroupInput: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...text.body,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  newGroupActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelBtnText: { ...text.bodySmall, color: colors.textMuted, fontFamily: 'Quicksand_600SemiBold' },
  createBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
  },
  createBtnText: { ...text.bodySmall, color: colors.surface, fontFamily: 'Quicksand_700Bold' },

  // Picker sheet
  pickerSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
    maxHeight: '80%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pickerTitle: { ...text.h3, color: colors.text },
  doneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.primaryDark,
  },
  doneBtnText: { ...text.bodySmall, color: colors.surface, fontFamily: 'Quicksand_700Bold' },
  pickerEmpty: {
    ...text.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 32,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  pickerRowActive: { backgroundColor: colors.primaryLighter },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.surface, fontSize: 12, fontFamily: 'Quicksand_700Bold' },
  pickerRowInfo: { flex: 1, gap: 4 },
  pickerRowTitle: {
    ...text.bodySmall,
    color: colors.text,
    fontFamily: 'Quicksand_600SemiBold',
    lineHeight: 18,
  },
  pickerRowMeta: { ...text.caption, color: colors.textMuted },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  emptyIllustration: { fontSize: 60, marginBottom: 18 },
  emptyTitle: { ...text.h2, color: colors.text, textAlign: 'center', marginBottom: 10 },
  emptyBody: {
    ...text.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyHints: { width: '100%', marginBottom: 30, gap: 14 },
  emptyHintRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyHintIcon: { fontSize: 22, width: 30, textAlign: 'center' },
  emptyHintText: {
    ...text.bodySmall,
    color: colors.text,
    flex: 1,
    lineHeight: 19,
    fontFamily: 'Quicksand_500Medium',
  },
  emptyBrowseBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 15,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  emptyBrowseBtnText: {
    ...text.bodySmall,
    color: colors.surface,
    fontFamily: 'Quicksand_700Bold',
    fontSize: 15,
  },
});
