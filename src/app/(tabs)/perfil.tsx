import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { Hexagon } from '@/components/Hexagon';
import { SystemButton } from '@/components/SystemButton';
import { SystemWindow } from '@/components/SystemWindow';
import { XPBar } from '@/components/XPBar';
import { ACHIEVEMENTS, fetchUnlocked } from '@/lib/achievements';
import { useAuth } from '@/lib/auth';
import { completionStats, ensureProfile, signedUrl, updateProfile, uploadAvatar } from '@/lib/data';
import { addDays, dateKey } from '@/lib/dates';
import { setFreeze } from '@/lib/engine';
import { exportAllData } from '@/lib/exporter';
import {
  levelFromXp,
  MAX_STONES,
  rankForLevel,
  STAT_COLUMN,
  statPoints,
  STATS,
  streakMultiplier,
} from '@/lib/game';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import type { Profile } from '@/lib/types';

const FREEZE_REASONS = ['Exámenes', 'Enfermedad', 'Vacaciones'];
const FREEZE_DAYS = [1, 3, 7, 14];

export default function Perfil() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const shareRef = useRef<View>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [stats, setStats] = useState<{ total: number; withEvidence: number }>({ total: 0, withEvidence: 0 });
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [freezeReason, setFreezeReason] = useState(FREEZE_REASONS[0]!);
  const [freezeDays, setFreezeDays] = useState(3);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const today = dateKey();

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const prof = await ensureProfile(userId);
      setProfile(prof);
      setName(prof.name);
      setStats(await completionStats());
      setUnlocked(await fetchUnlocked());
      if (prof.avatar_url) {
        setAvatarUri(await signedUrl('avatars', prof.avatar_url));
      }
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pickAvatar = async () => {
    if (!userId || !profile) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;
    const b64 = result.assets[0]?.base64;
    if (!b64) return;
    try {
      const path = await uploadAvatar(userId, b64);
      await updateProfile(userId, { avatar_url: path });
      setProfile({ ...profile, avatar_url: path });
      setAvatarUri(await signedUrl('avatars', path));
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'No se pudo subir la foto');
    }
  };

  const saveName = async () => {
    if (!userId || !profile) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === profile.name) return;
    await updateProfile(userId, { name: trimmed });
    setProfile({ ...profile, name: trimmed });
  };

  const activateFreeze = async () => {
    if (!profile) return;
    const until = addDays(today, freezeDays - 1);
    const updated = await setFreeze(profile, until, freezeReason);
    setProfile(updated);
    setFreezeOpen(false);
  };

  const deactivateFreeze = async () => {
    if (!profile) return;
    const updated = await setFreeze(profile, null, null);
    setProfile(updated);
  };

  const onAchievementTap = async (code: string) => {
    if (!userId || !profile) return;
    const def = ACHIEVEMENTS.find((a) => a.code === code);
    if (!def || !unlocked.has(code)) return;
    if (!def.title) {
      Alert.alert(def.name, def.desc);
      return;
    }
    const isEquipped = profile.equipped_title === def.title;
    Alert.alert(def.name, `${def.desc}\nTítulo: "${def.title}"`, [
      { text: 'Cerrar', style: 'cancel' },
      {
        text: isEquipped ? 'Quitar título' : 'Equipar título',
        onPress: async () => {
          const next = isEquipped ? null : def.title ?? null;
          await updateProfile(userId, { equipped_title: next });
          setProfile({ ...profile, equipped_title: next });
        },
      },
    ]);
  };

  const shareProfile = async () => {
    try {
      const uri = await captureRef(shareRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartir perfil NIVL' });
      }
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'No se pudo generar la imagen');
    }
  };

  const onExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await exportAllData();
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Export fallido');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (!profile) {
    return <SafeAreaView style={styles.screen} edges={['top']} />;
  }

  const lvl = levelFromXp(profile.xp_total);
  const rank = rankForLevel(lvl.level);
  const maxStatXp = Math.max(100, ...STATS.map((s) => profile[STAT_COLUMN[s]]));
  const evidencePct = stats.total > 0 ? Math.round((stats.withEvidence / stats.total) * 100) : 0;
  const frozen = profile.freeze_until != null && profile.freeze_until >= today;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <SystemWindow color={colors.cyanDim}>
          <View style={styles.profileTop}>
            <Pressable onPress={pickAvatar}>
              <Hexagon size={92}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <Text style={styles.avatarLetter}>{profile.name.charAt(0).toUpperCase()}</Text>
                )}
              </Hexagon>
              <Text style={styles.changePhoto}>Cambiar foto</Text>
            </Pressable>
            <View style={styles.identity}>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                onBlur={saveName}
                onSubmitEditing={saveName}
                returnKeyType="done"
                maxLength={24}
              />
              {profile.equipped_title ? (
                <Text style={styles.equippedTitle}>« {profile.equipped_title.toUpperCase()} »</Text>
              ) : null}
              <Text style={styles.rankText}>CAZADOR · RANGO {rank}</Text>
              <View style={styles.levelRow}>
                <Text style={styles.lvLabel}>LV.</Text>
                <Text style={styles.lvValue}>{lvl.level}</Text>
              </View>
            </View>
          </View>
          <View style={{ marginTop: 10 }}>
            <XPBar ratio={lvl.next > 0 ? lvl.into / lvl.next : 1} height={8} />
            <Text style={styles.xpText}>
              {lvl.next > 0
                ? `${lvl.into} / ${lvl.next} XP para el nivel ${lvl.level + 1}`
                : 'NIVEL MÁXIMO ALCANZADO'}
            </Text>
          </View>
        </SystemWindow>

        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.windowTitle}>VÁLVULAS DEL SISTEMA</Text>
          <View style={styles.valveRow}>
            <Ionicons name="shield-half-outline" size={18} color={colors.cyan} />
            <Text style={styles.valveText}>
              Piedras de Protección: {profile.protection_stones}/{MAX_STONES}
            </Text>
          </View>
          <Text style={styles.valveHint}>
            Se forja 1 por semana de racha perfecta; se consume sola al fallar un día y absorbe todo el daño.
          </Text>
          {frozen ? (
            <>
              <View style={[styles.valveRow, { marginTop: 12 }]}>
                <Ionicons name="snow-outline" size={18} color={colors.cyanText} />
                <Text style={styles.valveText}>
                  Sistema en pausa ({profile.freeze_reason}) hasta {profile.freeze_until}
                </Text>
              </View>
              <SystemButton title="Reanudar el sistema" variant="outline" onPress={deactivateFreeze} style={{ marginTop: 12 }} />
            </>
          ) : (
            <SystemButton title="Pausar sistema (examen · enfermedad · viaje)" variant="outline" onPress={() => setFreezeOpen(true)} style={{ marginTop: 12 }} />
          )}
        </SystemWindow>

        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.windowTitle}>ESTADÍSTICAS</Text>
          {STATS.map((s) => {
            const xp = profile[STAT_COLUMN[s]];
            return (
              <View key={s} style={styles.statRow}>
                <Text style={styles.statAbbr}>{s}</Text>
                <View style={styles.statBar}>
                  <XPBar ratio={xp / maxStatXp} />
                </View>
                <Text style={styles.statPoints}>{statPoints(xp)}</Text>
              </View>
            );
          })}
          <Text style={styles.statHint}>1 punto por cada 100 XP de área</Text>
        </SystemWindow>

        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.windowTitle}>
            LOGROS · {unlocked.size}/{ACHIEVEMENTS.length}
          </Text>
          <View style={styles.achGrid}>
            {ACHIEVEMENTS.map((a) => {
              const isUnlocked = unlocked.has(a.code);
              return (
                <Pressable
                  key={a.code}
                  onPress={() => onAchievementTap(a.code)}
                  style={[styles.ach, isUnlocked && styles.achOn]}
                >
                  <Ionicons
                    name={isUnlocked ? 'ribbon' : 'lock-closed-outline'}
                    size={15}
                    color={isUnlocked ? colors.cyan : colors.textFaint}
                  />
                  <Text style={[styles.achName, isUnlocked && styles.achNameOn]} numberOfLines={2}>
                    {a.name}
                  </Text>
                  {a.title && isUnlocked ? <Text style={styles.achTitleTag}>título</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </SystemWindow>

        <SystemWindow color={colors.cyanDim}>
          <Text style={styles.windowTitle}>REGISTRO DEL CAZADOR</Text>
          <View style={styles.kpiGrid}>
            <View style={styles.kpi}>
              <Text style={styles.kpiValue}>{stats.total}</Text>
              <Text style={styles.kpiLabel}>Misiones completadas</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiValue}>{evidencePct}%</Text>
              <Text style={styles.kpiLabel}>Con evidencia</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiValue}>{profile.streak_days}</Text>
              <Text style={styles.kpiLabel}>Días de racha</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiValue}>×{streakMultiplier(profile.streak_days).toFixed(1)}</Text>
              <Text style={styles.kpiLabel}>Multiplicador XP</Text>
            </View>
          </View>
        </SystemWindow>

        <SystemButton title="Compartir perfil" onPress={() => setShareOpen(true)} style={{ marginTop: 2 }} />
        <SystemButton title="Exportar mis datos" variant="outline" onPress={onExport} loading={busy} style={{ marginTop: 10 }} />
        <SystemButton title="Cerrar sesión" variant="danger" onPress={signOut} style={{ marginTop: 10 }} />
      </ScrollView>

      <Modal visible={freezeOpen} transparent animationType="slide" onRequestClose={() => setFreezeOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>PAUSAR EL SISTEMA</Text>
            <Text style={styles.sheetHint}>
              Sin misiones, sin penalizaciones, sin pérdida de racha. Pausar no es rendirse: es estrategia.
            </Text>
            <Text style={styles.label}>Motivo</Text>
            <View style={styles.chips}>
              {FREEZE_REASONS.map((r) => (
                <Pressable key={r} onPress={() => setFreezeReason(r)} style={[styles.chip, freezeReason === r && styles.chipOn]}>
                  <Text style={[styles.chipText, freezeReason === r && styles.chipTextOn]}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Duración (desde hoy)</Text>
            <View style={styles.chips}>
              {FREEZE_DAYS.map((d) => (
                <Pressable key={d} onPress={() => setFreezeDays(d)} style={[styles.chip, freezeDays === d && styles.chipOn]}>
                  <Text style={[styles.chipText, freezeDays === d && styles.chipTextOn]}>
                    {d} día{d > 1 ? 's' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
            <SystemButton title="Activar pausa" onPress={activateFreeze} style={{ marginTop: 20 }} />
            <SystemButton title="Cancelar" variant="outline" onPress={() => setFreezeOpen(false)} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Modal>

      <Modal visible={shareOpen} transparent animationType="fade" onRequestClose={() => setShareOpen(false)}>
        <View style={styles.shareBackdrop}>
          <View ref={shareRef} collapsable={false} style={styles.shareCard}>
            <Text style={styles.shareBrand}>NIVL</Text>
            <Hexagon size={84}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.shareAvatar} contentFit="cover" />
              ) : (
                <Text style={styles.avatarLetter}>{profile.name.charAt(0).toUpperCase()}</Text>
              )}
            </Hexagon>
            <Text style={styles.shareName}>{profile.name.toUpperCase()}</Text>
            {profile.equipped_title ? (
              <Text style={styles.shareTitle}>« {profile.equipped_title.toUpperCase()} »</Text>
            ) : null}
            <Text style={styles.shareRank}>CAZADOR · RANGO {rank}</Text>
            <Text style={styles.shareLevel}>LV. {lvl.level}</Text>
            <View style={styles.shareStats}>
              {STATS.map((s) => (
                <View key={s} style={styles.shareStat}>
                  <Text style={styles.shareStatAbbr}>{s}</Text>
                  <Text style={styles.shareStatVal}>{statPoints(profile[STAT_COLUMN[s]])}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.shareFooter}>
              {stats.total} misiones · racha {profile.streak_days} días
            </Text>
          </View>
          <SystemButton title="Compartir imagen" onPress={shareProfile} style={{ marginTop: 16, alignSelf: 'stretch' }} />
          <SystemButton title="Cerrar" variant="outline" onPress={() => setShareOpen(false)} style={{ marginTop: 10, alignSelf: 'stretch' }} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  profileTop: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  avatarImage: { width: 64, height: 64, borderRadius: 32 },
  avatarLetter: { fontFamily: fonts.brand, fontSize: 32, color: colors.cyan },
  changePhoto: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 5,
  },
  identity: { flex: 1, minWidth: 0 },
  nameInput: {
    fontFamily: fonts.heading,
    fontSize: 22,
    letterSpacing: 1,
    color: colors.text,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  equippedTitle: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.amber,
    marginTop: 5,
  },
  rankText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.cyanText,
    marginTop: 4,
  },
  levelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  lvLabel: { fontFamily: fonts.heading, fontSize: 12, color: colors.textFaint },
  lvValue: { fontFamily: fonts.brand, fontSize: 34, color: colors.cyan },
  xpText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textDim, marginTop: 6 },
  windowTitle: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2.5,
    color: colors.cyan,
    marginBottom: 10,
  },
  valveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  valveText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  valveHint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 5, lineHeight: 17 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  statAbbr: { fontFamily: fonts.heading, fontSize: 13, color: colors.cyanText, width: 34 },
  statBar: { flex: 1 },
  statPoints: { fontFamily: fonts.heading, fontSize: 14, color: colors.text, width: 30, textAlign: 'right' },
  statHint: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 2 },
  achGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ach: {
    width: '31%',
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 4,
  },
  achOn: { borderColor: colors.cyanDim, backgroundColor: colors.cyanFaint },
  achName: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textFaint, textAlign: 'center' },
  achNameOn: { color: colors.text },
  achTitleTag: { fontFamily: fonts.body, fontSize: 10, color: colors.amber },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { width: '47%', backgroundColor: colors.cyanFaint, paddingVertical: 12, paddingHorizontal: 12 },
  kpiValue: { fontFamily: fonts.number, fontSize: 22, color: colors.cyan },
  kpiLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, marginTop: 3 },
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 14, 0.85)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.panel,
    borderTopWidth: 1.5,
    borderTopColor: colors.cyanDim,
    padding: 20,
    paddingBottom: 34,
  },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: 3, color: colors.cyan },
  sheetHint: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, marginTop: 6, lineHeight: 18 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.textDim,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 7,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.cyanDim, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.cyanFaint, borderColor: colors.cyan },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDim },
  chipTextOn: { color: colors.cyan },
  shareBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 14, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  shareCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.cyan,
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 20,
  },
  shareBrand: { fontFamily: fonts.brand, fontSize: 16, letterSpacing: 8, color: colors.cyan, marginBottom: 14 },
  shareAvatar: { width: 58, height: 58, borderRadius: 29 },
  shareName: { fontFamily: fonts.heading, fontSize: 20, letterSpacing: 1, color: colors.text, marginTop: 10 },
  shareTitle: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2, color: colors.amber, marginTop: 3 },
  shareRank: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 2, color: colors.cyanText, marginTop: 4 },
  shareLevel: { fontFamily: fonts.brand, fontSize: 40, color: colors.cyan, marginTop: 6 },
  shareStats: { flexDirection: 'row', gap: 14, marginTop: 12 },
  shareStat: { alignItems: 'center' },
  shareStatAbbr: { fontFamily: fonts.heading, fontSize: 11, color: colors.cyanText },
  shareStatVal: { fontFamily: fonts.number, fontSize: 16, color: colors.text, marginTop: 2 },
  shareFooter: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, marginTop: 14 },
});
