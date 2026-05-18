import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import Svg, { Line, Circle, Polyline, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import {
  getSavedPlans,
  deleteSavedPlan,
  getPatientGroups,
  formatSavedDate,
  type SavedPlan,
  type PatientGroup,
} from '@/services/storage';
import {
  getAllSessionData,
  deleteSessionData,
  formatSessionDate,
  type SessionDataRecord,
} from '@/services/sessionDataStorage';

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
      {/* Plan header row */}
      <Pressable style={styles.planCardHeader} onPress={onOpen}>
        <View style={styles.planCardInner}>
          <Text style={styles.planCardTitle} numberOfLines={2}>
            {item.plan.sessionTitle}
          </Text>
          <Text style={styles.planCardMeta}>
            {item.articleAuthorShort} · {item.articleYear}
          </Text>
          <Text style={styles.planCardDate}>{formatSavedDate(item.savedAt)}</Text>
        </View>
        <View style={styles.planCardActions}>
          <Text style={styles.planCardArrow}>→</Text>
          <Pressable
            style={styles.deleteBtn}
            onPress={(e) => { e.stopPropagation?.(); onDelete(); }}
            hitSlop={8}
          >
            <Text style={styles.deleteBtnText}>✕</Text>
          </Pressable>
        </View>
      </Pressable>

      {/* Session history bar */}
      <View style={styles.sessionBar}>
        <Pressable
          style={styles.sessionBarToggle}
          onPress={() => setShowSessions((v) => !v)}
        >
          <Text style={styles.sessionBarLabel}>
            📊 {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded
          </Text>
          <Text style={styles.sessionBarChevron}>
            {showSessions ? '▾' : '▸'}
          </Text>
        </Pressable>

        {/* Start new session button */}
        <Pressable style={styles.newSessionBtn} onPress={onStartSession}>
          <Text style={styles.newSessionBtnText}>+ New</Text>
        </Pressable>
      </View>

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
}> = ({ group, sessionsByPlan, expanded, onToggle, onOpenPlan, onDeletePlan, onOpenSession, onDeleteSession, onStartSession }) => {
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
          <View>
            <Text style={styles.groupLabel}>{group.label}</Text>
            <Text style={styles.groupCount}>
              {group.plans.length} plan{group.plans.length !== 1 ? 's' : ''}
              {totalSessions > 0 ? ` · ${totalSessions} session${totalSessions !== 1 ? 's' : ''}` : ''}
            </Text>
          </View>
        </View>
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
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
      Generate a session plan from any article and tap "Save to caseload" to store it here.
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
      load();
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

  const totalSessions = Object.values(sessionsByPlan).reduce((s, a) => s + a.length, 0);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Caseload</Text>
        {groups.length > 0 && (
          <Text style={styles.headerMeta}>
            {groups.length} patient{groups.length !== 1 ? 's' : ''}
            {totalSessions > 0 ? ` · ${totalSessions} session${totalSessions !== 1 ? 's' : ''}` : ''}
          </Text>
        )}
      </View>

      {groups.length === 0 ? (
        <EmptyState onBrowse={() => router.push('/(tabs)/browse')} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group) => (
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
            />
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
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
    paddingBottom: 12,
  },
  screenTitle: { ...text.h2, color: colors.text },
  headerMeta: { ...text.bodySmall, color: colors.textMuted },
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
    alignItems: 'center',
    padding: 12,
  },
  planCardInner: { flex: 1 },
  planCardTitle: { ...text.h4, color: colors.text, marginBottom: 3, lineHeight: 20 },
  planCardMeta: { ...text.caption, color: colors.primaryDark, marginBottom: 2 },
  planCardDate: { ...text.caption, color: colors.textMuted },
  planCardActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 8 },
  planCardArrow: { ...text.h3, color: colors.primary },

  // ── Session bar ──
  sessionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.primaryLighter,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sessionBarToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionBarLabel: {
    ...text.caption,
    color: colors.primaryDeep,
    fontFamily: 'Quicksand_600SemiBold',
  },
  sessionBarChevron: { ...text.caption, color: colors.primaryDeep },
  newSessionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  newSessionBtnText: {
    ...text.caption,
    color: colors.surface,
    fontFamily: 'Quicksand_700Bold',
  },

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
