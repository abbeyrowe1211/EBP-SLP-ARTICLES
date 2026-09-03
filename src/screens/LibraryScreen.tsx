import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SearchIcon } from '@/components/icons/NavIcons';
import Svg, { Line, Circle, Polyline, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import {
  getSavedPlans,
  deleteSavedPlan,
  deletePatientGroup,
  renamePatientLabel,
  getPatientGroups,
  formatSavedDate,
  type SavedPlan,
  type PatientGroup,
} from '@/services/storage';
import {
  getAllSessionData,
  deleteSessionData,
  formatSessionDate,
} from '@/services/sessionDataStorage';
import { type SessionDataRecord } from '@/types/sessionData';

// ─── Accuracy trend chart ─────────────────────────────────────────────────────

const AccuracyTrendChart: React.FC<{ sessions: SessionDataRecord[] }> = ({ sessions }) => {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  if (sorted.length < 2) return null;

  const W = 300;
  const H = 120;
  const PAD_L = 30;
  const PAD_R = 10;
  const PAD_T = 14;
  const PAD_B = 26;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const toX = (i: number) =>
    sorted.length === 1
      ? PAD_L + chartW / 2
      : PAD_L + (i / (sorted.length - 1)) * chartW;
  const toY = (acc: number) => PAD_T + chartH - (acc / 100) * chartH;

  const pts = sorted.map((s, i) => ({
    x: toX(i),
    y: toY(s.overallAccuracy),
    acc: s.overallAccuracy,
    date: new Date(s.date),
  }));

  const polyPts = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const targetY = toY(80);

  const dotColor = (acc: number) =>
    acc >= 80 ? '#16A34A' : acc >= 60 ? '#D97706' : '#DC2626';

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });

  return (
    <View style={chartStyles.container}>
      <Text style={chartStyles.title}>Accuracy trend</Text>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {/* Baseline */}
        <Line
          x1={PAD_L} y1={PAD_T + chartH}
          x2={W - PAD_R} y2={PAD_T + chartH}
          stroke="#E5E7EB" strokeWidth={1}
        />
        {/* 80% target dashed line */}
        <Line
          x1={PAD_L} y1={targetY}
          x2={W - PAD_R} y2={targetY}
          stroke="#A78BFA" strokeWidth={1} strokeDasharray="4,3"
        />
        <SvgText
          x={PAD_L - 3} y={targetY + 3.5}
          fontSize={7.5} fill="#7C3AED" textAnchor="end"
        >
          80%
        </SvgText>

        {/* Connecting line */}
        <Polyline
          points={polyPts}
          fill="none"
          stroke="#7C3AED"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots, labels, dates */}
        {pts.map((p, i) => (
          <React.Fragment key={i}>
            <Circle cx={p.x} cy={p.y} r={5} fill={dotColor(p.acc)} />
            <SvgText
              x={p.x} y={p.y - 9}
              fontSize={8} fill={dotColor(p.acc)}
              textAnchor="middle" fontWeight="bold"
            >
              {p.acc}%
            </SvgText>
            <SvgText
              x={p.x} y={H - 5}
              fontSize={7.5} fill="#9CA3AF" textAnchor="middle"
            >
              {fmtDate(p.date)}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
};

// ─── Session history row ──────────────────────────────────────────────────────

const SessionRow: React.FC<{
  session: SessionDataRecord;
  onPress: () => void;
  onDelete: () => void;
}> = ({ session, onPress, onDelete }) => {
  const pct = session.overallAccuracy;
  const color =
    pct >= 80 ? '#16A34A' : pct >= 60 ? '#D97706' : '#DC2626';

  return (
    <Pressable style={styles.sessionRow} onPress={onPress}>
      {/* Accuracy dot */}
      <View style={[styles.accuracyDot, { backgroundColor: color }]}>
        <Text style={styles.accuracyDotText}>{pct}%</Text>
      </View>

      <View style={styles.sessionInfo}>
        <Text style={styles.sessionDate}>{formatSessionDate(session.date)}</Text>
        <Text style={styles.sessionMeta}>
          {session.totalTrials} trial{session.totalTrials !== 1 ? 's' : ''}
          {' · '}
          {session.stepSummaries.length} step{session.stepSummaries.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.sessionActions}>
        <Text style={styles.sessionArrow}>→</Text>
        <Pressable
          style={styles.deleteBtn}
          onPress={(e) => { e.stopPropagation?.(); onDelete(); }}
          hitSlop={8}
        >
          <Text style={styles.deleteBtnText}>✕</Text>
        </Pressable>
      </View>
    </Pressable>
  );
};

// ─── Plan card ────────────────────────────────────────────────────────────────

const PlanCard: React.FC<{
  item: SavedPlan;
  sessions: SessionDataRecord[];
  onOpen: () => void;
  onDelete: () => void;
  onOpenSession: (s: SessionDataRecord) => void;
  onDeleteSession: (s: SessionDataRecord) => void;
  onStartSession: () => void;
}> = ({ item, sessions, onOpen, onDelete, onOpenSession, onDeleteSession, onStartSession }) => {
  const [showSessions, setShowSessions] = useState(false);

  return (
    <View style={styles.planCard}>
      {/* Plan info + delete */}
      <View style={styles.planCardHeader}>
        <View style={styles.planCardInner}>
          <Text style={styles.planCardTitle} numberOfLines={2}>
            {item.plan.sessionTitle}
          </Text>
          <Text style={styles.planCardMeta}>
            {item.articleAuthorShort} · {item.articleYear}
          </Text>
          <Text style={styles.planCardDate}>{formatSavedDate(item.savedAt)}</Text>
        </View>
        <Pressable
          style={styles.deleteBtn}
          onPress={onDelete}
          hitSlop={8}
        >
          <Text style={styles.deleteBtnText}>✕</Text>
        </Pressable>
      </View>

      {/* Action buttons */}
      <View style={styles.planActionRow}>
        <Pressable style={styles.viewPlanBtn} onPress={onOpen}>
          <Text style={styles.viewPlanBtnText}>📋  View plan</Text>
        </Pressable>
        <Pressable style={styles.newSessionBtnCard} onPress={onStartSession}>
          <Text style={styles.newSessionBtnCardText}>＋ New session</Text>
        </Pressable>
      </View>

      {/* Session history toggle */}
      <Pressable
        style={styles.sessionBar}
        onPress={() => setShowSessions((v) => !v)}
      >
        <Text style={styles.sessionBarLabel}>
          📊 {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded
        </Text>
        <Text style={styles.sessionBarChevron}>
          {showSessions ? '▾' : '▸'}
        </Text>
      </Pressable>

      {/* Expanded session list */}
      {showSessions && (
        <View style={styles.sessionList}>
          {sessions.length === 0 ? (
            <Text style={styles.noSessionsText}>
              No sessions yet — tap "+ New" to start collecting data.
            </Text>
          ) : (
            sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                onPress={() => onOpenSession(s)}
                onDelete={() => onDeleteSession(s)}
              />
            ))
          )}
        </View>
      )}
    </View>
  );
};

// ─── Patient group card ───────────────────────────────────────────────────────

const PatientGroupCard: React.FC<{
  group: PatientGroup;
  sessionsByPlan: Record<string, SessionDataRecord[]>;
  expanded: boolean;
  onToggle: () => void;
  onOpenPlan: (plan: SavedPlan) => void;
  onDeletePlan: (plan: SavedPlan) => void;
  onOpenSession: (s: SessionDataRecord) => void;
  onDeleteSession: (s: SessionDataRecord) => void;
  onStartSession: (plan: SavedPlan) => void;
  onRenameGroup: () => void;
  onDeleteGroup: () => void;
}> = ({ group, sessionsByPlan, expanded, onToggle, onOpenPlan, onDeletePlan, onOpenSession, onDeleteSession, onStartSession, onRenameGroup, onDeleteGroup }) => {
  // Aggregate session count across all plans for this patient
  const totalSessions = group.plans.reduce(
    (sum, p) => sum + (sessionsByPlan[p.id]?.length ?? 0),
    0
  );

  return (
    <View style={styles.groupCard}>
      <Pressable style={styles.groupHeader} onPress={onToggle}>
        <View style={styles.groupHeaderLeft}>
          <View style={styles.patientIcon}>
            <Text style={styles.patientIconText}>
              {group.label.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            <Text style={styles.groupCount}>
              {group.plans.length} plan{group.plans.length !== 1 ? 's' : ''}
              {totalSessions > 0 ? ` · ${totalSessions} session${totalSessions !== 1 ? 's' : ''}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.groupHeaderRight}>
          <Pressable
            style={[styles.groupMenuBtn]}
            onPress={(e) => { e.stopPropagation?.(); onRenameGroup(); }}
            hitSlop={8}
          >
            <Text style={styles.groupMenuBtnText}>✎</Text>
          </Pressable>
          <Pressable
            style={[styles.groupMenuBtn, styles.groupDeleteBtn]}
            onPress={(e) => { e.stopPropagation?.(); onDeleteGroup(); }}
            hitSlop={8}
          >
            <Text style={[styles.groupMenuBtnText, styles.groupDeleteBtnText]}>🗑</Text>
          </Pressable>
          <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
        </View>
      </Pressable>

      {expanded && (() => {
        const allSessions = group.plans.flatMap((p) => sessionsByPlan[p.id] ?? []);
        return (
          <>
            {allSessions.length >= 2 && <AccuracyTrendChart sessions={allSessions} />}
            <View style={styles.planList}>
              {group.plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  item={plan}
                  sessions={sessionsByPlan[plan.id] ?? []}
                  onOpen={() => onOpenPlan(plan)}
                  onDelete={() => onDeletePlan(plan)}
                  onOpenSession={onOpenSession}
                  onDeleteSession={onDeleteSession}
                  onStartSession={() => onStartSession(plan)}
                />
              ))}
            </View>
          </>
        );
      })()}
    </View>
  );
};

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ onBrowse: () => void }> = ({ onBrowse }) => (
  <View style={styles.emptyState}>
    <Text style={styles.emptyIcon}>📋</Text>
    <Text style={styles.emptyTitle}>No saved sessions yet</Text>
    <Text style={styles.emptyBody}>
      Generate a session plan from any article and tap "Save to Plans" to store it here.
    </Text>
    <Pressable style={styles.emptyBtn} onPress={onBrowse}>
      <Text style={styles.emptyBtnText}>Browse articles →</Text>
    </Pressable>
  </View>
);

// ─── Library Screen ───────────────────────────────────────────────────────────

export const LibraryScreen: React.FC = () => {
  const router = useRouter();
  const [groups, setGroups] = useState<PatientGroup[]>([]);
  const [sessionsByPlan, setSessionsByPlan] = useState<Record<string, SessionDataRecord[]>>({});
  const [expandedLabels, setExpandedLabels] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');

  // Rename group modal
  const [renameModalGroup, setRenameModalGroup] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const [plans, allSessions] = await Promise.all([
          getSavedPlans(),
          getAllSessionData(),
        ]);
        setGroups(getPatientGroups(plans));

        // Index sessions by savedPlanId, newest first
        const byPlan: Record<string, SessionDataRecord[]> = {};
        for (const s of allSessions) {
          if (!byPlan[s.savedPlanId]) byPlan[s.savedPlanId] = [];
          byPlan[s.savedPlanId].push(s);
        }
        // Sort each plan's sessions newest first
        for (const key of Object.keys(byPlan)) {
          byPlan[key].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
        setSessionsByPlan(byPlan);
      };
      load().catch(() => {});
    }, [])
  );

  const toggleGroup = (label: string) => {
    setExpandedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleOpenPlan = (plan: SavedPlan) => {
    router.push({
      pathname: '/session/plan',
      params: {
        planJson: JSON.stringify(plan.plan),
        articleId: plan.articleId,
        savedPlanId: plan.id,
        patientLabel: plan.patientLabel,
        source: 'library',
      },
    });
  };

  const handleDeletePlan = (plan: SavedPlan) => {
    Alert.alert(
      'Remove session plan',
      `Remove "${plan.plan.sessionTitle}" from ${plan.patientLabel}? Session data will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteSavedPlan(plan.id);
            const updated = await getSavedPlans();
            setGroups(getPatientGroups(updated));
          },
        },
      ]
    );
  };

  const reloadGroups = async () => {
    const updated = await getSavedPlans();
    setGroups(getPatientGroups(updated));
  };

  const handleRenameGroup = (label: string) => {
    setRenameText(label);
    setRenameModalGroup(label);
  };

  const confirmRename = async () => {
    if (!renameModalGroup || !renameText.trim()) return;
    await renamePatientLabel(renameModalGroup, renameText.trim());
    setRenameModalGroup(null);
    await reloadGroups();
  };

  const handleDeleteGroup = (group: PatientGroup) => {
    Alert.alert(
      'Delete patient group',
      `Delete "${group.label}" and all ${group.plans.length} plan${group.plans.length !== 1 ? 's' : ''} in it? Session data will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: async () => {
            await deletePatientGroup(group.label);
            await reloadGroups();
          },
        },
      ]
    );
  };

  const handleOpenSession = (session: SessionDataRecord) => {
    router.push({
      pathname: '/session/data-summary',
      params: {
        summaryJson: JSON.stringify({
          stepSummaries: session.stepSummaries,
          overallAccuracy: session.overallAccuracy,
          totalTrials: session.totalTrials,
        }),
        sessionTitle: session.sessionTitle,
        patientLabel: session.patientLabel,
        articleId: session.articleId,
        fromLibrary: 'true',
      },
    });
  };

  const handleDeleteSession = (session: SessionDataRecord) => {
    Alert.alert(
      'Delete session data',
      `Delete this session from ${formatSessionDate(session.date)} for "${session.patientLabel}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSessionData(session.id);
            const allSessions = await getAllSessionData();
            const byPlan: Record<string, SessionDataRecord[]> = {};
            for (const s of allSessions) {
              if (!byPlan[s.savedPlanId]) byPlan[s.savedPlanId] = [];
              byPlan[s.savedPlanId].push(s);
            }
            for (const key of Object.keys(byPlan)) {
              byPlan[key].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            }
            setSessionsByPlan(byPlan);
          },
        },
      ]
    );
  };

  const handleStartSession = (plan: SavedPlan) => {
    router.push({
      pathname: '/session/data',
      params: {
        planJson: JSON.stringify(plan.plan),
        articleId: plan.articleId,
        savedPlanId: plan.id,
        patientLabel: plan.patientLabel,
      },
    });
  };

  // Only count sessions that belong to currently-saved plans (not orphaned sessions from deleted plans)
  const totalPlans = groups.reduce((sum, g) => sum + g.plans.length, 0);
  const totalSessions = groups
    .flatMap((g) => g.plans)
    .reduce((sum, p) => sum + (sessionsByPlan[p.id]?.length ?? 0), 0);

  // Filter groups by search text
  const q = searchText.trim().toLowerCase();
  const filteredGroups = q
    ? groups.filter((g) =>
        g.label.toLowerCase().includes(q) ||
        g.plans.some(
          (p) =>
            p.plan.sessionTitle?.toLowerCase().includes(q) ||
            p.articleAuthorShort.toLowerCase().includes(q) ||
            String(p.articleYear).includes(q)
        )
      )
    : groups;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Plans</Text>
        {groups.length > 0 && (
          <Text style={styles.headerMeta}>
            {totalPlans} plan{totalPlans !== 1 ? 's' : ''}
            {totalSessions > 0 ? ` · ${totalSessions} session${totalSessions !== 1 ? 's' : ''}` : ''}
          </Text>
        )}
      </View>

      {/* Search bar */}
      {groups.length > 0 && (
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <SearchIcon color={colors.textMuted} size={15} />
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search patients or plans…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        </View>
      )}

      {groups.length === 0 ? (
        <EmptyState onBrowse={() => router.push('/(tabs)/browse')} />
      ) : filteredGroups.length === 0 ? (
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>No plans match "{searchText}"</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filteredGroups.map((group) => (
            <PatientGroupCard
              key={group.label}
              group={group}
              sessionsByPlan={sessionsByPlan}
              expanded={expandedLabels.has(group.label)}
              onToggle={() => toggleGroup(group.label)}
              onOpenPlan={handleOpenPlan}
              onDeletePlan={handleDeletePlan}
              onOpenSession={handleOpenSession}
              onDeleteSession={handleDeleteSession}
              onStartSession={handleStartSession}
              onRenameGroup={() => handleRenameGroup(group.label)}
              onDeleteGroup={() => handleDeleteGroup(group)}
            />
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Rename group modal */}
      <Modal
        visible={renameModalGroup !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalGroup(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRenameModalGroup(null)} />
          <View style={styles.renameSheet}>
            <Text style={styles.renameTitle}>Rename patient label</Text>
            <TextInput
              style={styles.renameInput}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="e.g. AJB"
              placeholderTextColor={colors.textMuted}
              autoFocus
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={confirmRename}
            />
            <View style={styles.renameActions}>
              <Pressable
                style={styles.renameCancelBtn}
                onPress={() => setRenameModalGroup(null)}
              >
                <Text style={styles.renameCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.renameSaveBtn, !renameText.trim() && { opacity: 0.4 }]}
                onPress={confirmRename}
                disabled={!renameText.trim()}
              >
                <Text style={styles.renameSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  screenTitle: { ...text.h2, color: colors.text },
  headerMeta: { ...text.bodySmall, color: colors.textMuted },
  searchRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    ...text.bodySmall,
    color: colors.text,
    paddingVertical: 0,
  },
  noResults: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  noResultsText: {
    ...text.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },

  // ── Group card ──
  groupCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  groupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  patientIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientIconText: { ...text.h3, color: colors.primaryDeep, fontFamily: 'Quicksand_700Bold' },
  groupLabel: { ...text.h4, color: colors.text },
  groupCount: { ...text.caption, color: colors.textMuted, marginTop: 2 },
  chevron: { ...text.body, color: colors.textMuted, marginLeft: 8 },

  // ── Plan list ──
  planList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
  },

  // ── Plan card ──
  planCard: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 4,
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    paddingBottom: 10,
  },
  planCardInner: { flex: 1 },
  planCardTitle: { ...text.h4, color: colors.text, marginBottom: 3, lineHeight: 20 },
  planCardMeta: { ...text.caption, color: colors.primaryDark, marginBottom: 2 },
  planCardDate: { ...text.caption, color: colors.textMuted },

  // ── Plan action row ──
  planActionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  viewPlanBtn: {
    flex: 1,
    backgroundColor: colors.primaryDark,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  viewPlanBtnText: {
    ...text.bodySmall,
    color: colors.surface,
    fontFamily: 'Quicksand_700Bold',
  },
  newSessionBtnCard: {
    flex: 1,
    backgroundColor: colors.primaryLighter,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  newSessionBtnCardText: {
    ...text.bodySmall,
    color: colors.primaryDeep,
    fontFamily: 'Quicksand_700Bold',
  },

  // ── Session bar ──
  sessionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.primaryLighter,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  sessionBarLabel: {
    ...text.caption,
    color: colors.primaryDeep,
    fontFamily: 'Quicksand_600SemiBold',
    flex: 1,
  },
  sessionBarChevron: { ...text.caption, color: colors.primaryDeep },

  // ── Session list ──
  sessionList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  noSessionsText: {
    ...text.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
  },

  // ── Session row ──
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  accuracyDot: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  accuracyDotText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Quicksand_700Bold',
  },
  sessionInfo: { flex: 1 },
  sessionDate: { ...text.bodySmall, color: colors.text, fontFamily: 'Quicksand_600SemiBold' },
  sessionMeta: { ...text.caption, color: colors.textMuted, marginTop: 2 },
  sessionActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sessionArrow: { ...text.body, color: colors.primary },

  // ── Shared ──
  deleteBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 11, color: '#DC2626', fontFamily: 'Quicksand_700Bold' },

  // ── Empty state ──
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { ...text.h2, color: colors.text, marginBottom: 10, textAlign: 'center' },
  emptyBody: {
    ...text.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyBtn: {
    backgroundColor: colors.primaryLighter,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  emptyBtnText: { ...text.body, color: colors.primaryDeep, fontFamily: 'Quicksand_700Bold' },

  // ── Group header action buttons ──
  groupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupMenuBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.primaryLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupMenuBtnText: {
    fontSize: 14,
    color: colors.primaryDeep,
  },
  groupDeleteBtn: {
    backgroundColor: '#FEF2F2',
  },
  groupDeleteBtnText: {
    fontSize: 13,
  },

  // ── Rename modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  renameSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
  },
  renameTitle: {
    ...text.h3,
    color: colors.text,
    marginBottom: 16,
  },
  renameInput: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...text.body,
    color: colors.text,
    marginBottom: 16,
  },
  renameActions: {
    flexDirection: 'row',
    gap: 12,
  },
  renameCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  renameCancelText: {
    ...text.body,
    color: colors.textMuted,
    fontFamily: 'Quicksand_600SemiBold',
  },
  renameSaveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
  },
  renameSaveText: {
    ...text.body,
    color: '#fff',
    fontFamily: 'Quicksand_700Bold',
  },
});

// ─── Chart styles ─────────────────────────────────────────────────────────────
const chartStyles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 4,
  },
  title: {
    ...text.label,
    color: colors.textMuted,
    marginBottom: 2,
  },
});
