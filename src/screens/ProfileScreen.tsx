import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
  Switch,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import { getSavedPlans } from '@/services/storage';
import { getAllSessionData } from '@/services/sessionDataStorage';
import { PROFILE_WORK_SETTINGS } from '@/data/sessionOptions';
import { exportBackup, importBackup } from '@/services/backupService';
import {
  type NotifFrequency,
  getNotifFrequency,
  getNotifDay,
  getNotifHour,
  setNotifFrequency,
  setNotifDay,
  setNotifHour,
  getMotivationNotifEnabled,
  setMotivationNotifEnabled,
  getMotivHour,
  setMotivHour,
  getMotivDays,
  setMotivDays,
  DAY_LABELS,
  DAY_FULL_LABELS,
} from '@/services/notificationService';
import {
  getAowEnabled,
  setAowEnabled,
  getAowDay,
  setAowDay,
  getAowHour,
  setAowHour,
} from '@/services/articleOfWeekService';

// ─── Storage keys ─────────────────────────────────────────────────────────────
const KEY_PROFILE   = 'ebp_slp_profile_v1';
const KEY_SETTINGS  = 'ebp_slp_settings_v1';
const KEY_CUE_VIS   = 'ebp_slp_cue_visibility_v1';

// All togglable built-in cue levels (Other is always on — it's the custom-cue catch-all)
const TOGGLEABLE_CUES: { level: string; label: string; group: string }[] = [
  { level: 'Independent', label: 'Independent', group: 'General' },
  { level: 'Min Verbal',  label: 'Min Verbal',  group: 'Verbal' },
  { level: 'Mod Verbal',  label: 'Mod Verbal',  group: 'Verbal' },
  { level: 'Max Verbal',  label: 'Max Verbal',  group: 'Verbal' },
  { level: 'Direct Model',label: 'Direct Model',group: 'Additional' },
  { level: 'Gestural',    label: 'Gestural',    group: 'Additional' },
  { level: 'Tactile',     label: 'Tactile',     group: 'Additional' },
];

interface ProfileData {
  name: string;
  credentials: string;
  setting: string;
}

interface AppSettings {
  defaultSessionLength: string;
  showWhyNotes: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultSessionLength: '45 min',
  showWhyNotes: true,
};

const SESSION_LENGTHS = ['30 min', '45 min', '60 min', '90 min'];

const WORK_SETTINGS = [...PROFILE_WORK_SETTINGS, 'Other'];

// ─── Section wrapper ──────────────────────────────────────────────────────────
const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}> = ({ title, children, collapsible = false, defaultExpanded = true }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!collapsible) {
    return (
      <View style={styles.section}>
        <Text allowFontScaling={false} style={[styles.sectionTitle, { marginBottom: 8 }]}>{title}</Text>
        <View style={styles.sectionCard}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Pressable style={styles.collapsibleHeader} onPress={() => setExpanded((v) => !v)}>
        <Text allowFontScaling={false} style={styles.sectionTitle}>{title}</Text>
        <Text allowFontScaling={false} style={styles.collapseChevron}>{expanded ? '▴' : '▾'}</Text>
      </Pressable>
      {expanded && <View style={styles.sectionCard}>{children}</View>}
    </View>
  );
};

// ─── Row ──────────────────────────────────────────────────────────────────────
const Row: React.FC<{
  label: string;
  children: React.ReactNode;
  last?: boolean;
}> = ({ label, children, last }) => (
  <View style={[styles.row, !last && styles.rowBorder]}>
    <Text allowFontScaling={false} style={styles.rowLabel}>{label}</Text>
    <View style={styles.rowValue}>{children}</View>
  </View>
);

// ─── Stat box ─────────────────────────────────────────────────────────────────
const StatBox: React.FC<{ value: string | number; label: string }> = ({ value, label }) => (
  <View style={styles.statBox}>
    <Text allowFontScaling={false} style={styles.statValue}>{value}</Text>
    <Text allowFontScaling={false} style={styles.statLabel}>{label}</Text>
  </View>
);

// ─── Profile Screen ───────────────────────────────────────────────────────────
export const ProfileScreen: React.FC = () => {
  const router = useRouter();
  const [profile, setProfile]     = useState<ProfileData>({ name: '', credentials: '', setting: '' });
  const [settings, setSettings]   = useState<AppSettings>(DEFAULT_SETTINGS);
  const [notifFreq, setNotifFreq] = useState<NotifFrequency>('off');
  const [notifDay, setNotifDayState] = useState<number>(2);   // 1=Sun … 7=Sat
  const [notifHour, setNotifHourState] = useState<number>(9); // 0–23
  const [motivationEnabled, setMotivationEnabled] = useState(false);
  const [motivHour, setMotivHourState] = useState<number>(9);
  const [motivDays, setMotivDaysState] = useState<number[]>([4]);  // default Wednesday
  const [aowEnabled, setAowEnabledState] = useState(false);
  const [aowDay, setAowDayState] = useState<number>(2);  // default Monday
  const [aowHour, setAowHourState] = useState<number>(9);
  const [notifExpanded, setNotifExpanded] = useState(false);
  const [customCues, setCustomCues] = useState<string[]>([]);
  const [stats, setStats]         = useState({ patients: 0, plans: 0, sessions: 0, trials: 0 });
  const [editingProfile, setEditingProfile] = useState(false);
  const [draftProfile, setDraftProfile]     = useState<ProfileData>({ name: '', credentials: '', setting: '' });
  const [cueVisibility, setCueVisibility]   = useState<Record<string, boolean>>({});
  const [backingUp, setBackingUp]           = useState(false);
  const [restoring, setRestoring]           = useState(false);
  const [customSettingMode, setCustomSettingMode] = useState(false);

  // Helper — is a cue enabled? Defaults to true
  const isCueOn = (level: string) => cueVisibility[level] !== false;

  const toggleCueVisibility = async (level: string) => {
    const updated = { ...cueVisibility, [level]: !isCueOn(level) };
    setCueVisibility(updated);
    try {
      await AsyncStorage.setItem(KEY_CUE_VIS, JSON.stringify(updated));
    } catch {}
  };

  // ── Load persisted data ──
  const load = useCallback(async () => {
    const [profileRaw, settingsRaw, freq, day, hour, motivHourVal, motivDaysVal, plans, sessions, cueVisRaw, motEnabled, cuesRaw, aowOn, aowDayVal, aowHourVal] = await Promise.all([
      AsyncStorage.getItem(KEY_PROFILE),
      AsyncStorage.getItem(KEY_SETTINGS),
      getNotifFrequency(),
      getNotifDay(),
      getNotifHour(),
      getMotivHour(),
      getMotivDays(),
      getSavedPlans(),
      getAllSessionData(),
      AsyncStorage.getItem(KEY_CUE_VIS),
      getMotivationNotifEnabled(),
      AsyncStorage.getItem('ebp_slp_custom_cues_v1'),
      getAowEnabled(),
      getAowDay(),
      getAowHour(),
    ]);

    try { if (profileRaw) setProfile(JSON.parse(profileRaw)); } catch {}
    try { if (settingsRaw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(settingsRaw) }); } catch {}
    try { if (cueVisRaw) setCueVisibility(JSON.parse(cueVisRaw)); } catch {}
    try { if (cuesRaw) setCustomCues(JSON.parse(cuesRaw)); } catch {}
    // Weekly reminders were retired in favor of Monthly / On Update —
    // migrate anyone still on 'weekly' so their schedule stays in sync.
    if (freq === 'weekly') {
      setNotifFrequency('monthly').catch(() => {});
      setNotifFreq('monthly');
    } else {
      setNotifFreq(freq);
    }
    setNotifDayState(day);
    setNotifHourState(hour);
    setMotivHourState(motivHourVal);
    setMotivDaysState(motivDaysVal);
    setMotivationEnabled(motEnabled);
    setAowEnabledState(aowOn);
    setAowDayState(aowDayVal);
    setAowHourState(aowHourVal);

    const patients = new Set(plans.map((p) => p.patientLabel)).size;
    const totalTrials = sessions.reduce((sum, s) => sum + s.totalTrials, 0);
    setStats({ patients, plans: plans.length, sessions: sessions.length, trials: totalTrials });
  }, []);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));

  // ── Save profile ──
  const saveProfile = async () => {
    const trimmed: ProfileData = {
      name: draftProfile.name.trim(),
      credentials: draftProfile.credentials.trim(),
      setting: draftProfile.setting.trim(),
    };
    try {
      await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(trimmed));
    } catch {}
    setProfile(trimmed);
    setEditingProfile(false);
  };

  const openEditProfile = () => {
    setDraftProfile({ ...profile });
    const isKnownSetting = !profile.setting || WORK_SETTINGS.includes(profile.setting);
    setCustomSettingMode(!isKnownSetting);
    setEditingProfile(true);
  };

  // ── Save a settings patch ──
  const saveSetting = async (patch: Partial<AppSettings>) => {
    const updated = { ...settings, ...patch };
    setSettings(updated);
    try {
      await AsyncStorage.setItem(KEY_SETTINGS, JSON.stringify(updated));
    } catch {}
  };

  // ── Notification frequency ──
  const handleNotifFreq = async (freq: NotifFrequency) => {
    try {
      await setNotifFrequency(freq);
      setNotifFreq(freq);
    } catch (e: any) {
      if (e?.message === 'notification_permission_denied') {
        Alert.alert(
          'Notifications blocked',
          'Notifications are turned off for EBP-SLP. Turn them on in Settings to receive article reminders.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
          ],
        );
      } else {
        Alert.alert('Error', 'Could not update notification settings. Try again.');
      }
    }
  };

  // Article Reminders uses a 3-way frequency (weekly/monthly/on-update) rather
  // than a plain boolean, but the header switch just needs an on/off view of
  // it — off turns it off, on restores whatever frequency was last chosen
  // (defaulting to weekly the very first time).
  const lastNotifFreqRef = React.useRef<NotifFrequency>('monthly');
  const handleNotifToggle = async (value: boolean) => {
    if (value) {
      const restore = lastNotifFreqRef.current !== 'off' ? lastNotifFreqRef.current : 'monthly';
      await handleNotifFreq(restore);
    } else {
      if (notifFreq !== 'off') lastNotifFreqRef.current = notifFreq;
      await handleNotifFreq('off');
    }
  };

  const handleMotivationToggle = async (value: boolean) => {
    try {
      await setMotivationNotifEnabled(value);
      setMotivationEnabled(value);
    } catch (e: any) {
      if (e?.message === 'notification_permission_denied') {
        Alert.alert(
          'Notifications blocked',
          'Notifications are turned off for EBP-SLP. Turn them on in Settings to receive motivation nudges.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
          ],
        );
      } else {
        Alert.alert('Error', 'Could not update notification settings. Try again.');
      }
    }
  };

  const handlePickDay = () => {
    const buttons = DAY_FULL_LABELS.map((day, idx) => ({
      text: (idx + 1 === notifDay ? '✓ ' : '') + day,
      onPress: async () => {
        try {
          await setNotifDay(idx + 1); // 1=Sun … 7=Sat
          setNotifDayState(idx + 1);
        } catch {}
      },
    }));
    Alert.alert('Reminder day', 'Which day should your weekly reminder send?', [
      ...buttons,
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const handleDeleteCustomCue = async (cue: string) => {
    Alert.alert('Remove custom cue', `Remove "${cue}" from your cues?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = customCues.filter((c) => c !== cue);
          setCustomCues(updated);
          // Also remove from visibility map
          const vis = { ...cueVisibility };
          delete vis[cue];
          setCueVisibility(vis);
          try {
            await AsyncStorage.setItem('ebp_slp_custom_cues_v1', JSON.stringify(updated));
            await AsyncStorage.setItem(KEY_CUE_VIS, JSON.stringify(vis));
          } catch {}
        },
      },
    ]);
  };

  const formatBackupDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return 'an earlier date';
    }
  };

  const handleExportBackup = async () => {
    setBackingUp(true);
    try {
      const { keyCount } = await exportBackup();
      if (keyCount === 0) {
        Alert.alert(
          'Nothing to back up yet',
          'Once you save articles, build plans, or log sessions, there will be data to back up.',
        );
      }
    } catch (e: any) {
      if (e?.message === 'sharing_unavailable') {
        Alert.alert("Can't share right now", 'Sharing isn’t available on this device.');
      } else {
        Alert.alert('Backup failed', 'Something went wrong creating your backup. Try again.');
      }
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreBackup = () => {
    Alert.alert(
      'Restore from backup?',
      'This will overwrite your current saved articles, plans, session data, and notes with whatever is in the backup file. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose file…',
          onPress: async () => {
            setRestoring(true);
            try {
              const result = await importBackup();
              if (result) {
                Alert.alert(
                  'Backup restored',
                  `Restored ${result.keyCount} item${result.keyCount === 1 ? '' : 's'} from a backup made on ${formatBackupDate(result.exportedAt)}. Close and reopen the app to make sure everything reloads.`,
                );
                load().catch(() => {});
              }
            } catch (e: any) {
              if (e?.message === 'invalid_file') {
                Alert.alert(
                  'Not a valid backup',
                  'That file doesn’t look like an EBP-SLP backup. Make sure you picked the right .json file.',
                );
              } else if (e?.message === 'empty_backup') {
                Alert.alert('Nothing to restore', 'That backup file doesn’t contain any data.');
              } else {
                Alert.alert('Restore failed', 'Something went wrong reading that file. Try again.');
              }
            } finally {
              setRestoring(false);
            }
          },
        },
      ],
    );
  };

  const handleAowToggle = async (value: boolean) => {
    try {
      await setAowEnabled(value);
      setAowEnabledState(value);
    } catch (e: any) {
      if (e?.message === 'notification_permission_denied') {
        Alert.alert(
          'Notifications blocked',
          'Notifications are turned off for EBP-SLP. Turn them on in Settings to receive Article of the Week.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
          ],
        );
      } else {
        Alert.alert('Error', 'Could not update notification settings. Try again.');
      }
    }
  };

  const handlePickMotivTime = () => {
    const TIME_OPTIONS = [
      { label: '7 AM', hour: 7 },
      { label: '8 AM', hour: 8 },
      { label: '9 AM', hour: 9 },
      { label: '10 AM', hour: 10 },
      { label: '12 PM', hour: 12 },
      { label: '3 PM', hour: 15 },
      { label: '5 PM', hour: 17 },
      { label: '7 PM', hour: 19 },
    ];
    const buttons = TIME_OPTIONS.map(({ label, hour }) => ({
      text: (hour === motivHour ? '✓ ' : '') + label,
      onPress: async () => {
        try {
          await setMotivHour(hour);
          setMotivHourState(hour);
        } catch {}
      },
    }));
    Alert.alert('Nudge time', 'What time should motivation nudges send?', [
      ...buttons,
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const handlePickTime = () => {
    const TIME_OPTIONS = [
      { label: '7 AM', hour: 7 },
      { label: '8 AM', hour: 8 },
      { label: '9 AM', hour: 9 },
      { label: '10 AM', hour: 10 },
      { label: '12 PM', hour: 12 },
      { label: '3 PM', hour: 15 },
      { label: '5 PM', hour: 17 },
      { label: '7 PM', hour: 19 },
    ];
    const buttons = TIME_OPTIONS.map(({ label, hour }) => ({
      text: (hour === notifHour ? '✓ ' : '') + label,
      onPress: async () => {
        try {
          await setNotifHour(hour);
          setNotifHourState(hour);
        } catch {}
      },
    }));
    Alert.alert('Reminder time', 'What time should the reminder send?', [
      ...buttons,
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const handlePickAowDay = () => {
    const buttons = DAY_FULL_LABELS.map((d, idx) => ({
      text: (idx + 1 === aowDay ? '✓ ' : '') + d,
      onPress: async () => {
        try {
          await setAowDay(idx + 1);
          setAowDayState(idx + 1);
        } catch {}
      },
    }));
    Alert.alert('Article of the Week day', 'Which day should the article arrive?', [
      ...buttons,
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const handlePickAowTime = () => {
    const TIME_OPTIONS = [
      { label: '7 AM', hour: 7 },
      { label: '8 AM', hour: 8 },
      { label: '9 AM', hour: 9 },
      { label: '10 AM', hour: 10 },
      { label: '12 PM', hour: 12 },
      { label: '3 PM', hour: 15 },
      { label: '5 PM', hour: 17 },
      { label: '7 PM', hour: 19 },
    ];
    const buttons = TIME_OPTIONS.map(({ label, hour }) => ({
      text: (hour === aowHour ? '✓ ' : '') + label,
      onPress: async () => {
        try {
          await setAowHour(hour);
          setAowHourState(hour);
        } catch {}
      },
    }));
    Alert.alert('Article of the Week time', 'What time should the article arrive?', [
      ...buttons,
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const toggleMotivDay = async (day: number) => {
    const isLastSelected = motivDays.length === 1 && motivDays.includes(day);
    if (isLastSelected) {
      Alert.alert('Select at least one day', 'Motivation nudges need at least one day of the week.');
      return;
    }
    const next = motivDays.includes(day)
      ? motivDays.filter((d) => d !== day)
      : [...motivDays, day];
    try {
      await setMotivDays(next);
      setMotivDaysState(next.slice().sort((a, b) => a - b));
    } catch {}
  };

  const formatHour = (h: number) => {
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text allowFontScaling={false} style={styles.screenTitle}>Profile</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Avatar / name banner ── */}
        <View style={styles.avatarBanner}>
          <View style={styles.avatar}>
            <Text allowFontScaling={false} style={styles.avatarInitial}>
              {profile.name ? profile.name.trim()[0].toUpperCase() : '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text allowFontScaling={false} style={styles.avatarName}>
              {profile.name || 'Add your name'}
            </Text>
            {(profile.credentials || profile.setting) ? (
              <Text allowFontScaling={false} style={styles.avatarSub}>
                {[profile.credentials, profile.setting].filter(Boolean).join(' · ')}
              </Text>
            ) : (
              <Text allowFontScaling={false} style={styles.avatarSubMuted}>Tap Edit to fill in your details</Text>
            )}
          </View>
          <Pressable style={styles.editBtn} onPress={openEditProfile}>
            <Text allowFontScaling={false} style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>

        {/* ── Edit profile form ── */}
        {editingProfile && (
          <View style={styles.editForm}>
            <Text allowFontScaling={false} style={styles.editFormTitle}>Your information</Text>

            <Text allowFontScaling={false} style={styles.fieldLabel}>Name</Text>
            <TextInput allowFontScaling={false}
              style={styles.fieldInput}
              value={draftProfile.name}
              onChangeText={(v) => setDraftProfile((p) => ({ ...p, name: v }))}
              placeholder="e.g. John Smith"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />

            <Text allowFontScaling={false} style={styles.fieldLabel}>Credentials</Text>
            <TextInput allowFontScaling={false}
              style={styles.fieldInput}
              value={draftProfile.credentials}
              onChangeText={(v) => setDraftProfile((p) => ({ ...p, credentials: v }))}
              placeholder="e.g. MS, CCC-SLP"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />

            <Text allowFontScaling={false} style={styles.fieldLabel}>Primary work setting</Text>
            <View style={styles.chipGrid}>
              {WORK_SETTINGS.map((s) => {
                const active = s === 'Other' ? customSettingMode : (!customSettingMode && draftProfile.setting === s);
                return (
                  <Pressable
                    key={s}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => {
                      if (s === 'Other') {
                        setCustomSettingMode(true);
                        setDraftProfile((p) => ({ ...p, setting: '' }));
                      } else {
                        setCustomSettingMode(false);
                        setDraftProfile((p) => ({ ...p, setting: p.setting === s ? '' : s }));
                      }
                    }}
                  >
                    <Text allowFontScaling={false} style={[styles.chipText, active && styles.chipTextActive]}>
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {customSettingMode && (
              <TextInput allowFontScaling={false}
                style={[styles.fieldInput, { marginTop: 10 }]}
                value={draftProfile.setting}
                onChangeText={(v) => setDraftProfile((p) => ({ ...p, setting: v }))}
                placeholder="Type your work setting"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
              />
            )}

            <View style={styles.editActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditingProfile(false)}>
                <Text allowFontScaling={false} style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={saveProfile}>
                <Text allowFontScaling={false} style={styles.saveBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Plan stats ── */}
        <Section title="PLAN STATS">
          <View style={styles.statsRow}>
            <StatBox value={stats.patients} label="Patients" />
            <View style={styles.statDivider} />
            <StatBox value={stats.plans} label="Plans saved" />
            <View style={styles.statDivider} />
            <StatBox value={stats.sessions} label="Sessions" />
            <View style={styles.statDivider} />
            <StatBox value={stats.trials} label="Trials" />
          </View>
        </Section>

        {/* ── Data backup ── */}
        <Section title="DATA BACKUP">
          <View style={styles.backupCard}>
            <Text allowFontScaling={false} style={styles.backupBody}>
              Your saved articles, plans, session data, and notes live only on this device — there's no account
              or server sync. Back them up so you don't lose anything if you lose your phone or reinstall the app.
            </Text>
            <Pressable
              style={[styles.backupBtn, (backingUp || restoring) && styles.backupBtnDisabled]}
              onPress={handleExportBackup}
              disabled={backingUp || restoring}
            >
              {backingUp ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <Text allowFontScaling={false} style={styles.backupBtnText}>Export backup</Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.backupBtnSecondary, (backingUp || restoring) && styles.backupBtnDisabled]}
              onPress={handleRestoreBackup}
              disabled={backingUp || restoring}
            >
              {restoring ? (
                <ActivityIndicator color={colors.primaryDark} size="small" />
              ) : (
                <Text allowFontScaling={false} style={styles.backupBtnSecondaryText}>Restore from backup</Text>
              )}
            </Pressable>
          </View>
        </Section>

        {/* ── App settings ── */}
        <Section title="APP SETTINGS">
          <Row label="Default session length">
            <View style={styles.segmentRow}>
              {SESSION_LENGTHS.map((l) => (
                <Pressable
                  key={l}
                  style={[styles.segment, settings.defaultSessionLength === l && styles.segmentActive]}
                  onPress={() => saveSetting({ defaultSessionLength: l })}
                >
                  <Text allowFontScaling={false} style={[styles.segmentText, settings.defaultSessionLength === l && styles.segmentTextActive]}>
                    {l.replace(' min', '')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Row>
          <Row label="Show 'Why' notes on steps" last>
            <Switch
              value={settings.showWhyNotes}
              onValueChange={(v) => saveSetting({ showWhyNotes: v })}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </Row>
        </Section>

        {/* ── Cueing personalisation ── */}
        <Section title="CUEING" collapsible defaultExpanded={false}>
          <View style={styles.cueHint}>
            <Text allowFontScaling={false} style={styles.cueHintText}>
              Choose which cue types appear during data collection. Custom cues you add are always shown.
            </Text>
          </View>
          {['General', 'Verbal', 'Additional'].map((group) => {
            const cues = TOGGLEABLE_CUES.filter((c) => c.group === group);
            return (
              <View key={group}>
                <Text allowFontScaling={false} style={styles.cueGroupHeader}>{group.toUpperCase()}</Text>
                {cues.map((c, i) => (
                  <Row key={c.level} label={c.label} last={i === cues.length - 1 && group === 'Additional' && customCues.length === 0}>
                    <Switch
                      value={isCueOn(c.level)}
                      onValueChange={() => toggleCueVisibility(c.level)}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.surface}
                    />
                  </Row>
                ))}
              </View>
            );
          })}

          {/* ── Custom cues management ── */}
          {customCues.length > 0 && (
            <View>
              <Text allowFontScaling={false} style={styles.cueGroupHeader}>YOUR CUSTOM CUES</Text>
              {customCues.map((cue, i) => (
                <View
                  key={cue}
                  style={[styles.row, i < customCues.length - 1 && styles.rowBorder]}
                >
                  <Text allowFontScaling={false} style={[styles.rowLabel, { flex: 1 }]}>{cue}</Text>
                  <View style={styles.rowValue}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Switch
                        value={isCueOn(cue)}
                        onValueChange={() => toggleCueVisibility(cue)}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={colors.surface}
                      />
                      <Pressable
                        onPress={() => handleDeleteCustomCue(cue)}
                        hitSlop={8}
                        style={styles.cueDeleteBtn}
                        accessibilityLabel={`Delete ${cue}`}
                        accessibilityRole="button"
                      >
                        <Text allowFontScaling={false} style={styles.cueDeleteBtnText}>✕</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* ── Notification settings ── */}
        <View style={styles.section}>
          <Pressable
            style={styles.collapsibleHeader}
            onPress={() => setNotifExpanded((v) => !v)}
          >
            <Text allowFontScaling={false} style={styles.sectionTitle}>NOTIFICATIONS</Text>
            <Text allowFontScaling={false} style={styles.collapseChevron}>{notifExpanded ? '▴' : '▾'}</Text>
          </Pressable>

          {notifExpanded && (
            <>
              {/* Card 1 — Article Reminders */}
              <View style={[styles.sectionCard, { marginBottom: 10 }]}>
                <View style={styles.notifCardHeader}>
                  <Text allowFontScaling={false} style={styles.notifCardTitle}>📅  Article Reminders</Text>
                  <Switch
                    value={notifFreq !== 'off'}
                    onValueChange={handleNotifToggle}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.surface}
                  />
                </View>
                <Text allowFontScaling={false} style={styles.notifCardCaption}>
                  Get notified when new research articles are added to EBP-SLP.
                </Text>
                {notifFreq !== 'off' && (
                  <View style={[styles.notifCardBody, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <View style={styles.notifFreqRow}>
                      {(['monthly', 'on-update'] as NotifFrequency[]).map((f) => (
                        <Pressable
                          key={f}
                          style={[styles.segment, notifFreq === f && styles.segmentActive]}
                          onPress={() => handleNotifFreq(f)}
                        >
                          <Text allowFontScaling={false} style={[styles.segmentText, notifFreq === f && styles.segmentTextActive]}>
                            {f === 'monthly' ? 'Monthly' : 'On Update'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    {notifFreq === 'monthly' && (
                      <View style={styles.notifPickerRow}>
                        <View style={styles.notifPickerGroup}>
                          <Text allowFontScaling={false} style={styles.notifPickerLabel}>Time</Text>
                          <Pressable onPress={handlePickTime} style={styles.pickerChip}>
                            <Text allowFontScaling={false} style={styles.pickerChipText}>{formatHour(notifHour)} ▾</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                    <Text allowFontScaling={false} style={styles.notifSummary}>
                      🔔{'  '}{notifFreq === 'monthly'
                        ? `1st of each month at ${formatHour(notifHour)}`
                        : 'Fires when new articles are added to EBP-SLP'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Card 2 — Article of the Week */}
              <View style={[styles.sectionCard, { marginBottom: 10 }]}>
                <View style={styles.notifCardHeader}>
                  <Text allowFontScaling={false} style={styles.notifCardTitle}>📖  Article of the Week</Text>
                  <Switch
                    value={aowEnabled}
                    onValueChange={handleAowToggle}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.surface}
                  />
                </View>
                <Text allowFontScaling={false} style={styles.notifCardCaption}>
                  Get alerted when a new article is selected as the focus of the week.
                </Text>
                {aowEnabled && (
                  <View style={[styles.notifCardBody, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <View style={styles.notifPickerRow}>
                      <View style={styles.notifPickerGroup}>
                        <Text allowFontScaling={false} style={styles.notifPickerLabel}>Day</Text>
                        <Pressable onPress={handlePickAowDay} style={styles.pickerChip}>
                          <Text allowFontScaling={false} style={styles.pickerChipText}>{DAY_FULL_LABELS[aowDay - 1]} ▾</Text>
                        </Pressable>
                      </View>
                      <View style={styles.notifPickerGroup}>
                        <Text allowFontScaling={false} style={styles.notifPickerLabel}>Time</Text>
                        <Pressable onPress={handlePickAowTime} style={styles.pickerChip}>
                          <Text allowFontScaling={false} style={styles.pickerChipText}>{formatHour(aowHour)} ▾</Text>
                        </Pressable>
                      </View>
                    </View>
                    <Text allowFontScaling={false} style={styles.notifSummary}>
                      📖{'  '}Every {DAY_FULL_LABELS[aowDay - 1]} at {formatHour(aowHour)} — rotating EBP article
                    </Text>
                  </View>
                )}
              </View>

              {/* Card 3 — Motivation Nudges */}
              <View style={styles.sectionCard}>
                <View style={styles.notifCardHeader}>
                  <Text allowFontScaling={false} style={styles.notifCardTitle}>💜  Motivation Nudges</Text>
                  <Switch
                    value={motivationEnabled}
                    onValueChange={handleMotivationToggle}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.surface}
                  />
                </View>
                <Text allowFontScaling={false} style={styles.notifCardCaption}>
                  Quotes and encouragement to keep you checking the evidence.
                </Text>
                {motivationEnabled && (
                  <View style={[styles.notifCardBody, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <View style={styles.notifPickerGroup}>
                      <Text allowFontScaling={false} style={styles.notifPickerLabel}>Days</Text>
                      <View style={styles.dayToggleRow}>
                        {DAY_LABELS.map((label, idx) => {
                          const dayNum = idx + 1;
                          const active = motivDays.includes(dayNum);
                          return (
                            <Pressable
                              key={dayNum}
                              style={[styles.dayToggleChip, active && styles.dayToggleChipActive]}
                              onPress={() => toggleMotivDay(dayNum)}
                            >
                              <Text allowFontScaling={false} style={[styles.dayToggleChipText, active && styles.dayToggleChipTextActive]}>
                                {label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <View style={[styles.notifPickerRow, { marginTop: 10 }]}>
                      <View style={styles.notifPickerGroup}>
                        <Text allowFontScaling={false} style={styles.notifPickerLabel}>Time</Text>
                        <Pressable onPress={handlePickMotivTime} style={styles.pickerChip}>
                          <Text allowFontScaling={false} style={styles.pickerChipText}>{formatHour(motivHour)} ▾</Text>
                        </Pressable>
                      </View>
                    </View>
                    <Text allowFontScaling={false} style={styles.notifSummary}>
                      🔔{'  '}Every {motivDays.map((d) => DAY_FULL_LABELS[d - 1]).join(', ')} at {formatHour(motivHour)} — quotes &amp; tips
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>

        {/* ── Article ranking ── */}
        <Section title="HOW ARTICLES ARE RANKED">
          <View style={styles.rankingCard}>
            <Text allowFontScaling={false} style={styles.rankingBody}>
              Articles in the Browse tab are sorted by two factors:
            </Text>
            <View style={styles.rankingItem}>
              <Text allowFontScaling={false} style={styles.rankingNum}>1</Text>
              <View style={{ flex: 1 }}>
                <Text allowFontScaling={false} style={styles.rankingTitle}>Publication year</Text>
                <Text allowFontScaling={false} style={styles.rankingDesc}>Newer research appears first. More recent evidence better reflects current clinical practice.</Text>
              </View>
            </View>
            <View style={styles.rankingItem}>
              <Text allowFontScaling={false} style={styles.rankingNum}>2</Text>
              <View style={{ flex: 1 }}>
                <Text allowFontScaling={false} style={styles.rankingTitle}>Evidence level (within the same year)</Text>
                <Text allowFontScaling={false} style={styles.rankingDesc}>Level 1a (systematic reviews) ranks above 1b (RCTs), then Level 2 (cohort studies), then Level 3 (case studies). Stronger evidence rises to the top.</Text>
              </View>
            </View>
            <Text allowFontScaling={false} style={[styles.rankingBody, { marginTop: 8 }]}>
              You can filter by ASHA area and search by author, keyword, diagnosis, or treatment name to narrow results further.
            </Text>
          </View>
        </Section>

        {/* ── About ── */}
        <Section title="ABOUT">
          <Row label="App version">
            <Text allowFontScaling={false} style={styles.metaText}>1.0.0 (beta)</Text>
          </Row>
          <Row label="Evidence base">
            <Text allowFontScaling={false} style={styles.metaText}>ASHA · PubMed</Text>
          </Row>
          <Row label="PHI policy">
            <Text allowFontScaling={false} style={styles.metaText}>No PHI stored</Text>
          </Row>
          <Pressable onPress={() => router.push('/onboarding?review=true')}>
            <Row label="Review intro slides">
              <Text allowFontScaling={false} style={styles.linkText}>View →</Text>
            </Row>
          </Pressable>
          <Pressable onPress={() => router.push('/disclaimer')}>
            <Row label="Clinical disclaimer">
              <Text allowFontScaling={false} style={styles.linkText}>View →</Text>
            </Row>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('https://ebpslp.app')}>
            <Row label="For more info" last>
              <Text allowFontScaling={false} style={styles.linkText}>ebpslp.app →</Text>
            </Row>
          </Pressable>
        </Section>

        {/* ── PHI disclaimer ── */}
        <View style={styles.phiDisclaimer}>
          <Text allowFontScaling={false} style={styles.phiDisclaimerText}>
            🛡  EBP-SLP is designed to be PHI-free. Patient labels are non-identifying descriptors chosen by you. No clinical notes, names, or identifying data are ever stored or transmitted.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  screenTitle: { ...text.h2, color: colors.text },
  scroll: { paddingHorizontal: 20, paddingTop: 12 },

  // ── Avatar banner ──
  avatarBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLighter,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: {
    fontSize: 22,
    fontFamily: 'Quicksand_700Bold',
    color: colors.primaryDark,
  },
  avatarName: { ...text.h3, color: colors.text },
  avatarSub: { ...text.bodySmall, color: colors.textMuted, marginTop: 2 },
  avatarSubMuted: { ...text.bodySmall, color: colors.textMuted, marginTop: 2, fontStyle: 'italic' },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  editBtnText: { ...text.bodySmall, color: colors.primaryDark, fontFamily: 'Quicksand_600SemiBold' },

  // ── Edit form ──
  editForm: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  editFormTitle: { ...text.h4, color: colors.primaryDeep, marginBottom: 14 },
  fieldLabel: { ...text.label, color: colors.textMuted, marginBottom: 6 },
  fieldInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    ...text.body,
    color: colors.text,
    backgroundColor: colors.bg,
    marginBottom: 14,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipActive: { backgroundColor: colors.primaryLighter, borderColor: colors.primary },
  chipText: { ...text.bodySmall, color: colors.textMuted, fontFamily: 'Quicksand_600SemiBold' },
  chipTextActive: { color: colors.primaryDeep },
  editActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelBtnText: { ...text.bodySmall, color: colors.textMuted, fontFamily: 'Quicksand_600SemiBold' },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
  },
  saveBtnText: { ...text.bodySmall, color: colors.surface, fontFamily: 'Quicksand_700Bold' },

  // ── Section ──
  section: { marginBottom: 20 },
  sectionTitle: { ...text.label, color: colors.textMuted, marginBottom: 0 },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 8,
  },
  collapseChevron: {
    fontSize: 13,
    color: colors.primary,
    fontFamily: 'Quicksand_700Bold',
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },

  // ── Row ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { ...text.bodySmall, color: colors.text, fontFamily: 'Quicksand_600SemiBold', flex: 1 },
  rowValue: { alignItems: 'flex-end' },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  statValue: { fontSize: 26, fontFamily: 'Quicksand_700Bold', color: colors.primaryDark, lineHeight: 32 },
  statLabel: { ...text.caption, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  statDivider: { width: 1, height: 36, backgroundColor: colors.border },

  // ── Segment control ──
  segmentRow: { flexDirection: 'row', gap: 4 },
  segment: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  segmentActive: { backgroundColor: colors.primaryLighter, borderColor: colors.primary },
  segmentText: { ...text.caption, color: colors.textMuted, fontFamily: 'Quicksand_600SemiBold' },
  segmentTextActive: { color: colors.primaryDeep },

  // ── Data backup ──
  backupCard: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  backupBody: {
    ...text.bodySmall,
    color: colors.textMuted,
    lineHeight: 18,
  },
  backupBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backupBtnText: { ...text.bodySmall, color: colors.surface, fontFamily: 'Quicksand_700Bold' },
  backupBtnSecondary: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backupBtnSecondaryText: { ...text.bodySmall, color: colors.primaryDark, fontFamily: 'Quicksand_700Bold' },
  backupBtnDisabled: { opacity: 0.6 },

  // ── Meta text ──
  metaText: { ...text.bodySmall, color: colors.textMuted },
  linkText: { ...text.bodySmall, color: colors.primary, fontFamily: 'Quicksand_600SemiBold' },

  // ── Cueing ──
  cueHint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  cueHintText: {
    ...text.bodySmall,
    color: colors.textMuted,
    lineHeight: 18,
  } as any,
  cueGroupHeader: {
    ...text.label,
    color: colors.textMuted,
    fontSize: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  } as any,

  // ── Notifications ──
  notifCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  notifCardTitle: {
    fontSize: 15,
    fontFamily: 'Quicksand_700Bold',
    color: colors.text,
  },
  notifCardCaption: {
    ...text.caption,
    color: colors.textMuted,
    paddingHorizontal: 16,
    paddingBottom: 12,
    lineHeight: 16,
  },
  notifCardBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 10,
  },
  dayToggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayToggleChip: {
    width: 40,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  dayToggleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayToggleChipText: {
    ...text.bodySmall,
    color: colors.textMuted,
    fontFamily: 'Quicksand_600SemiBold',
  },
  dayToggleChipTextActive: { color: colors.surface },
  notifFreqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  notifPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  notifPickerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifPickerLabel: {
    ...text.bodySmall,
    color: colors.textMuted,
    fontFamily: 'Quicksand_600SemiBold',
  },
  notifSummary: {
    ...text.caption,
    color: colors.primaryDark,
    fontFamily: 'Quicksand_600SemiBold',
  },
  // legacy — kept for any remaining references
  notifHint: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  notifHintText: {
    ...text.caption,
    color: colors.primaryDark,
    fontFamily: 'Quicksand_600SemiBold',
  },
  pickerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLighter,
  },
  pickerChipText: {
    ...text.bodySmall,
    color: colors.primaryDeep,
    fontFamily: 'Quicksand_600SemiBold',
  },

  // ── Article ranking ──
  rankingCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rankingBody: {
    ...text.bodySmall,
    color: colors.textMuted,
    lineHeight: 18,
  },
  rankingItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  rankingNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    color: colors.surface,
    fontFamily: 'Quicksand_700Bold',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 22,
    flexShrink: 0,
  },
  rankingTitle: {
    ...text.bodySmall,
    color: colors.text,
    fontFamily: 'Quicksand_700Bold',
    marginBottom: 2,
  },
  rankingDesc: {
    ...text.caption,
    color: colors.textMuted,
    lineHeight: 17,
  },

  // ── Custom cue delete ──
  cueDeleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cueDeleteBtnText: {
    fontSize: 10,
    color: '#DC2626',
    fontFamily: 'Quicksand_700Bold',
  },

  // ── PHI disclaimer ──
  phiDisclaimer: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  phiDisclaimerText: {
    ...text.bodySmall,
    color: '#166534',
    lineHeight: 18,
  },
});
