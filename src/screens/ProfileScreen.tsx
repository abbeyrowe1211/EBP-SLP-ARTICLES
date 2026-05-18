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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import { getSavedPlans } from '@/services/storage';
import { getAllSessionData } from '@/services/sessionDataStorage';

// ─── Storage keys ─────────────────────────────────────────────────────────────
const KEY_PROFILE       = 'ebp_slp_profile_v1';
const KEY_SETTINGS      = 'ebp_slp_settings_v1';
const KEY_NOTIF_PREFS   = 'ebp_slp_notif_prefs_v1';

interface ProfileData {
  name: string;
  credentials: string;
  setting: string;
}

interface AppSettings {
  defaultSessionLength: string;
  showWhyNotes: boolean;
}

interface NotifPrefs {
  enabled: boolean;
  method: 'email' | 'sms';
  contact: string;           // email address or phone number
  areas: string[];           // ASHA area names subscribed to
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultSessionLength: '45 min',
  showWhyNotes: true,
};

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  enabled: false,
  method: 'email',
  contact: '',
  areas: [],
};

const SESSION_LENGTHS = ['30 min', '45 min', '60 min', '90 min'];

const ASHA_AREAS = [
  'Language',
  'Swallowing',
  'Voice & Resonance',
  'Motor Speech',
  'Cognitive-Communication',
  'Fluency',
  'AAC',
];

const WORK_SETTINGS = [
  'Acute care',
  'Inpatient rehab',
  'Skilled nursing',
  'Home health',
  'Outpatient',
  'School',
  'Private practice',
  'Telepractice',
];

// ─── Section wrapper ──────────────────────────────────────────────────────────
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionCard}>{children}</View>
  </View>
);

// ─── Row ──────────────────────────────────────────────────────────────────────
const Row: React.FC<{
  label: string;
  children: React.ReactNode;
  last?: boolean;
}> = ({ label, children, last }) => (
  <View style={[styles.row, !last && styles.rowBorder]}>
    <Text style={styles.rowLabel}>{label}</Text>
    <View style={styles.rowValue}>{children}</View>
  </View>
);

// ─── Stat box ─────────────────────────────────────────────────────────────────
const StatBox: React.FC<{ value: string | number; label: string }> = ({ value, label }) => (
  <View style={styles.statBox}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ─── Profile Screen ───────────────────────────────────────────────────────────
export const ProfileScreen: React.FC = () => {
  const [profile, setProfile]       = useState<ProfileData>({ name: '', credentials: '', setting: '' });
  const [settings, setSettings]     = useState<AppSettings>(DEFAULT_SETTINGS);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [stats, setStats]           = useState({ patients: 0, plans: 0, sessions: 0, trials: 0 });
  const [editingProfile, setEditingProfile]   = useState(false);
  const [draftProfile, setDraftProfile]       = useState<ProfileData>({ name: '', credentials: '', setting: '' });
  const [editingNotifs, setEditingNotifs]     = useState(false);
  const [draftNotifs, setDraftNotifs]         = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);

  // ── Load persisted data ──
  const load = useCallback(async () => {
    const [profileRaw, settingsRaw, notifRaw, plans, sessions] = await Promise.all([
      AsyncStorage.getItem(KEY_PROFILE),
      AsyncStorage.getItem(KEY_SETTINGS),
      AsyncStorage.getItem(KEY_NOTIF_PREFS),
      getSavedPlans(),
      getAllSessionData(),
    ]);

    if (profileRaw) setProfile(JSON.parse(profileRaw));
    if (settingsRaw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(settingsRaw) });
    if (notifRaw) setNotifPrefs({ ...DEFAULT_NOTIF_PREFS, ...JSON.parse(notifRaw) });

    const patients = new Set(plans.map((p) => p.patientLabel)).size;
    const totalTrials = sessions.reduce((sum, s) => sum + s.totalTrials, 0);
    setStats({ patients, plans: plans.length, sessions: sessions.length, trials: totalTrials });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Save profile ──
  const saveProfile = async () => {
    const trimmed: ProfileData = {
      name: draftProfile.name.trim(),
      credentials: draftProfile.credentials.trim(),
      setting: draftProfile.setting,
    };
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(trimmed));
    setProfile(trimmed);
    setEditingProfile(false);
  };

  const openEditProfile = () => {
    setDraftProfile({ ...profile });
    setEditingProfile(true);
  };

  // ── Save a settings patch ──
  const saveSetting = async (patch: Partial<AppSettings>) => {
    const updated = { ...settings, ...patch };
    setSettings(updated);
    await AsyncStorage.setItem(KEY_SETTINGS, JSON.stringify(updated));
  };

  // ── Notification prefs ──
  const openEditNotifs = () => {
    setDraftNotifs({ ...notifPrefs });
    setEditingNotifs(true);
  };

  const saveNotifPrefs = async () => {
    const trimmed = { ...draftNotifs, contact: draftNotifs.contact.trim() };
    if (trimmed.enabled && !trimmed.contact) {
      Alert.alert('Contact required', `Enter your ${trimmed.method === 'email' ? 'email address' : 'phone number'} to receive notifications.`);
      return;
    }
    if (trimmed.enabled && trimmed.areas.length === 0) {
      Alert.alert('Select areas', 'Choose at least one clinical area to be notified about.');
      return;
    }
    await AsyncStorage.setItem(KEY_NOTIF_PREFS, JSON.stringify(trimmed));
    setNotifPrefs(trimmed);
    setEditingNotifs(false);
  };

  const toggleArea = (area: string) => {
    setDraftNotifs((prev) => ({
      ...prev,
      areas: prev.areas.includes(area)
        ? prev.areas.filter((a) => a !== area)
        : [...prev.areas, area],
    }));
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Avatar / name banner ── */}
        <View style={styles.avatarBanner}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {profile.name ? profile.name.trim()[0].toUpperCase() : '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.avatarName}>
              {profile.name || 'Add your name'}
            </Text>
            {(profile.credentials || profile.setting) ? (
              <Text style={styles.avatarSub}>
                {[profile.credentials, profile.setting].filter(Boolean).join(' · ')}
              </Text>
            ) : (
              <Text style={styles.avatarSubMuted}>Tap Edit to fill in your details</Text>
            )}
          </View>
          <Pressable style={styles.editBtn} onPress={openEditProfile}>
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>

        {/* ── Edit profile form ── */}
        {editingProfile && (
          <View style={styles.editForm}>
            <Text style={styles.editFormTitle}>Your information</Text>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={draftProfile.name}
              onChangeText={(v) => setDraftProfile((p) => ({ ...p, name: v }))}
              placeholder="e.g. Abbey Rowe"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Credentials</Text>
            <TextInput
              style={styles.fieldInput}
              value={draftProfile.credentials}
              onChangeText={(v) => setDraftProfile((p) => ({ ...p, credentials: v }))}
              placeholder="e.g. MS, CCC-SLP"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />

            <Text style={styles.fieldLabel}>Primary work setting</Text>
            <View style={styles.chipGrid}>
              {WORK_SETTINGS.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.chip, draftProfile.setting === s && styles.chipActive]}
                  onPress={() => setDraftProfile((p) => ({ ...p, setting: p.setting === s ? '' : s }))}
                >
                  <Text style={[styles.chipText, draftProfile.setting === s && styles.chipTextActive]}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.editActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditingProfile(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={saveProfile}>
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Caseload stats ── */}
        <Section title="CASELOAD STATS">
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
                  <Text style={[styles.segmentText, settings.defaultSessionLength === l && styles.segmentTextActive]}>
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

        {/* ── Notification settings ── */}
        <Section title="NOTIFICATIONS">
          <Row label="New article alerts" last>
            <Switch
              value={notifPrefs.enabled}
              onValueChange={(v) => {
                const updated = { ...notifPrefs, enabled: v };
                setNotifPrefs(updated);
                AsyncStorage.setItem(KEY_NOTIF_PREFS, JSON.stringify(updated));
                if (v && !editingNotifs) setEditingNotifs(true);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </Row>

          {notifPrefs.enabled && !editingNotifs && (
            <View style={styles.notifSummary}>
              <Text style={styles.notifSummaryText}>
                {notifPrefs.method === 'email' ? '✉️  ' : '💬  '}
                <Text style={styles.notifSummaryBold}>{notifPrefs.contact || '—'}</Text>
              </Text>
              {notifPrefs.areas.length > 0 && (
                <Text style={styles.notifSummaryAreas}>
                  {notifPrefs.areas.join(' · ')}
                </Text>
              )}
              <Pressable style={styles.notifEditBtn} onPress={openEditNotifs}>
                <Text style={styles.notifEditBtnText}>Edit preferences</Text>
              </Pressable>
            </View>
          )}

          {editingNotifs && (
            <View style={styles.notifForm}>
              {/* Delivery method */}
              <Text style={styles.fieldLabel}>Notify me by</Text>
              <View style={styles.methodRow}>
                {(['email', 'sms'] as const).map((m) => (
                  <Pressable
                    key={m}
                    style={[styles.methodChip, draftNotifs.method === m && styles.methodChipActive]}
                    onPress={() => setDraftNotifs((p) => ({ ...p, method: m, contact: '' }))}
                  >
                    <Text style={[styles.methodChipText, draftNotifs.method === m && styles.methodChipTextActive]}>
                      {m === 'email' ? '✉️  Email' : '💬  Text (SMS)'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Contact input */}
              <Text style={styles.fieldLabel}>
                {draftNotifs.method === 'email' ? 'Email address' : 'Phone number'}
              </Text>
              <TextInput
                style={styles.fieldInput}
                value={draftNotifs.contact}
                onChangeText={(v) => setDraftNotifs((p) => ({ ...p, contact: v }))}
                placeholder={draftNotifs.method === 'email' ? 'you@example.com' : '+1 (555) 000-0000'}
                placeholderTextColor={colors.textMuted}
                keyboardType={draftNotifs.method === 'email' ? 'email-address' : 'phone-pad'}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* Area selection */}
              <Text style={styles.fieldLabel}>Alert me when new articles are added to</Text>
              <View style={styles.chipGrid}>
                {ASHA_AREAS.map((area) => (
                  <Pressable
                    key={area}
                    style={[styles.chip, draftNotifs.areas.includes(area) && styles.chipActive]}
                    onPress={() => toggleArea(area)}
                  >
                    <Text style={[styles.chipText, draftNotifs.areas.includes(area) && styles.chipTextActive]}>
                      {area}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  style={[styles.chip, draftNotifs.areas.length === ASHA_AREAS.length && styles.chipActive]}
                  onPress={() => setDraftNotifs((p) => ({
                    ...p,
                    areas: p.areas.length === ASHA_AREAS.length ? [] : [...ASHA_AREAS],
                  }))}
                >
                  <Text style={[styles.chipText, draftNotifs.areas.length === ASHA_AREAS.length && styles.chipTextActive]}>
                    All areas
                  </Text>
                </Pressable>
              </View>

              <View style={styles.editActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setEditingNotifs(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveBtn} onPress={saveNotifPrefs}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Section>

        {/* ── About ── */}
        <Section title="ABOUT">
          <Row label="App version">
            <Text style={styles.metaText}>1.0.0 (beta)</Text>
          </Row>
          <Row label="Evidence base">
            <Text style={styles.metaText}>ASHA · PubMed</Text>
          </Row>
          <Row label="PHI policy" last>
            <Text style={styles.metaText}>No PHI stored</Text>
          </Row>
        </Section>

        {/* ── PHI disclaimer ── */}
        <View style={styles.phiDisclaimer}>
          <Text style={styles.phiDisclaimerText}>
            🛡  EBP-SLP is designed to be PHI-free. Patient labels are non-identifying descriptors chosen by you. No clinical notes, names, or identifying data are ever stored or transmitted.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  sectionTitle: { ...text.label, color: colors.textMuted, marginBottom: 8 },
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

  // ── Meta text ──
  metaText: { ...text.bodySmall, color: colors.textMuted },

  // ── Notifications ──
  notifSummary: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 4,
  },
  notifSummaryText: { ...text.bodySmall, color: colors.text },
  notifSummaryBold: { fontFamily: 'Quicksand_700Bold' },
  notifSummaryAreas: { ...text.caption, color: colors.textMuted, lineHeight: 16 },
  notifEditBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  notifEditBtnText: { ...text.caption, color: colors.primaryDark, fontFamily: 'Quicksand_600SemiBold' },
  notifForm: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
  },
  methodRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  methodChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  methodChipActive: { backgroundColor: colors.primaryLighter, borderColor: colors.primary },
  methodChipText: { ...text.bodySmall, color: colors.textMuted, fontFamily: 'Quicksand_600SemiBold' },
  methodChipTextActive: { color: colors.primaryDeep },

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
