import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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
import { deleteAccount } from '@/lib/account';
import {
  estadoAvisos,
  inicializarAvisos,
  type EstadoAvisos,
} from '@/lib/notifications';
import { setApiKey } from '@/lib/oracle';
import {
  fetchSubscription,
  isPremium,
  openCheckout,
  paymentsConfigured,
  type Subscription,
} from '@/lib/subscription';
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
import { voice } from '@/lib/voice';

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
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [freezeReason, setFreezeReason] = useState(FREEZE_REASONS[0]!);
  const [freezeDays, setFreezeDays] = useState(3);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [avisos, setAvisos] = useState<EstadoAvisos | null>(null);

  const refrescarAvisos = useCallback(() => {
    estadoAvisos().then(setAvisos).catch(() => setAvisos(null));
  }, []);

  const activarAvisos = async () => {
    const ok = await inicializarAvisos();
    if (!ok) {
      Alert.alert(
        'Avisos bloqueados',
        'Actívalos en los ajustes del teléfono, en las notificaciones de NIVL. Sin ellos el sistema no puede despertarte ni avisarte de los bloques.',
      );
    }
    refrescarAvisos();
  };

  const today = dateKey();
  const { height: winHeight } = useWindowDimensions();
  // La foto ocupa ~media pantalla, como pidió el cazador.
  const heroHeight = Math.max(340, Math.round(winHeight * 0.48));
  const streakDays = profile?.streak_days ?? 0;
  // Memo: sin él, pick() elegiría una frase nueva en cada pulsación del nombre.
  const streakMsg = useMemo(() => voice.streakHype(streakDays), [streakDays]);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const prof = await ensureProfile(userId);
      setProfile(prof);
      setName(prof.name);
      setStats(await completionStats());
      setUnlocked(await fetchUnlocked());
      setSubscription(await fetchSubscription(userId).catch(() => null));
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
      refrescarAvisos();
    }, [load, refrescarAvisos]),
  );

  const pickAvatar = async () => {
    if (!userId || !profile || uploadingPhoto) return;
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
    setUploadingPhoto(true);
    try {
      const path = await uploadAvatar(userId, b64);
      await updateProfile(userId, { avatar_url: path });
      setProfile({ ...profile, avatar_url: path });
      setAvatarUri(await signedUrl('avatars', path));
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'No se pudo subir la foto');
    } finally {
      setUploadingPhoto(false);
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
    // Borra la API key del dispositivo: en un móvil compartido el siguiente
    // usuario heredaría la key de pago de Anthropic.
    await setApiKey('');
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const onDeleteAccount = () => {
    Alert.alert(
      'Eliminar cuenta',
      'Esto borra PARA SIEMPRE tu perfil, misiones, mazmorras, diario, evidencias y todo tu progreso. No hay vuelta atrás.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () =>
            Alert.alert('¿Estás totalmente seguro?', 'El sistema no puede deshacer esto.', [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Eliminar mi cuenta',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteAccount();
                    router.replace('/login');
                  } catch (e) {
                    Alert.alert('Error del sistema', e instanceof Error ? e.message : 'No se pudo eliminar');
                  }
                },
              },
            ]),
        },
      ],
    );
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
        {/* La foto del cazador ocupa media pantalla: identidad, rango y niveles por ámbito. */}
        <Pressable
          onPress={pickAvatar}
          style={[styles.hero, { height: heroHeight }]}
          accessible={false}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.heroImage} contentFit="cover" transition={200} />
          ) : (
            <View style={styles.heroEmpty}>
              <Hexagon size={110}>
                <Text style={styles.avatarLetter}>{profile.name.charAt(0).toUpperCase()}</Text>
              </Hexagon>
              <Text style={styles.heroEmptyHint}>Toca para poner tu foto de cazador</Text>
            </View>
          )}
          <LinearGradient
            colors={['rgba(6,11,22,0.30)', 'rgba(6,11,22,0)', 'rgba(6,11,22,0.88)', colors.bg]}
            locations={[0, 0.28, 0.62, 1]}
            style={styles.heroShade}
            pointerEvents="none"
          />
          <Pressable
            style={styles.heroCamera}
            onPress={pickAvatar}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Cambiar foto de cazador"
          >
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color={colors.cyan} />
            ) : (
              <Ionicons name="camera-outline" size={15} color={colors.text} />
            )}
          </Pressable>
          <View style={styles.heroOverlay} pointerEvents="box-none">
            <View style={styles.heroIdentity} pointerEvents="box-none">
              <View style={styles.heroIdentityText} pointerEvents="box-none">
                <TextInput
                  style={styles.heroName}
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
                <Text style={styles.rankText}>
                  CAZADOR · RANGO {rank} · LV. {lvl.level}
                </Text>
              </View>
              <Text style={styles.heroRankLetter}>{rank}</Text>
            </View>
            <View style={styles.heroXp} pointerEvents="none">
              <XPBar ratio={lvl.next > 0 ? lvl.into / lvl.next : 1} height={7} />
              <Text style={styles.xpText}>
                {lvl.next > 0
                  ? `${lvl.into} / ${lvl.next} XP para el nivel ${lvl.level + 1}`
                  : 'NIVEL MÁXIMO ALCANZADO'}
              </Text>
            </View>
            <View style={styles.heroStats} pointerEvents="none">
              {STATS.map((s) => (
                <View key={s} style={styles.heroStat}>
                  <Text style={styles.heroStatVal}>{statPoints(profile[STAT_COLUMN[s]])}</Text>
                  <Text style={styles.heroStatAbbr}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        </Pressable>

        <View style={styles.body}>
          {/* Lo primero al abrir el perfil: la racha subiendo y un empujón del sistema. */}
          <SystemWindow color={streakDays > 0 ? colors.amberDim : colors.line} fill={colors.panelDeep}>
            <View style={styles.streakRow}>
              <Ionicons
                name="flame"
                size={34}
                color={streakDays > 0 ? colors.amber : colors.textFaint}
              />
              <View style={styles.streakBody}>
                <Text style={[styles.streakBig, streakDays === 0 && styles.streakBigOff]}>
                  {streakDays} {streakDays === 1 ? 'DÍA' : 'DÍAS'} DE RACHA
                </Text>
                <Text style={styles.streakMult}>
                  {streakMultiplier(streakDays) > 1
                    ? `×${streakMultiplier(streakDays).toFixed(1).replace('.', ',')} de multiplicador · cada misión vale más`
                    : '×1,0 · a los 7 días tu XP empieza a multiplicar'}
                </Text>
              </View>
            </View>
            <Text style={styles.streakMsg}>{streakMsg}</Text>
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
              <Text style={styles.kpiValue}>
                ×{streakMultiplier(profile.streak_days).toFixed(1).replace('.', ',')}
              </Text>
              <Text style={styles.kpiLabel}>Multiplicador XP</Text>
            </View>
          </View>
        </SystemWindow>

        {/* Pausar el sistema vive justo debajo del Registro del cazador: hay que bajar hasta aquí. */}
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

        {/* Sin esto no había forma de saber si los avisos estaban vivos: fallaban
            en silencio y el cazador se enteraba por no recibirlos. */}
        <SystemWindow color={avisos?.permitido ? colors.cyanDim : colors.redDim}>
          <Text style={styles.windowTitle}>AVISOS DEL SISTEMA</Text>
          <View style={styles.valveRow}>
            <Ionicons
              name={avisos?.permitido ? 'notifications-outline' : 'notifications-off-outline'}
              size={18}
              color={avisos?.permitido ? colors.cyan : colors.red}
            />
            <Text style={styles.valveText}>
              {avisos === null
                ? 'Comprobando…'
                : avisos.permitido
                  ? `Activos · ${avisos.programados} programados`
                  : 'Desactivados: el sistema no puede avisarte'}
            </Text>
          </View>
          <Text style={styles.valveHint}>
            {avisos?.permitido
              ? 'Despertador, bloques del día y cierre. Una notificación no suena en silencio ni en Modo Concentración: mantén también la alarma del reloj.'
              : 'Sin permiso de notificaciones no hay despertador ni avisos de bloque.'}
          </Text>
          {avisos && !avisos.permitido ? (
            <SystemButton
              title={avisos.puedePreguntar ? 'Activar avisos' : 'Abrir ajustes del sistema'}
              variant="outline"
              onPress={activarAvisos}
              style={{ marginTop: 12 }}
            />
          ) : null}
          {avisos?.error ? <Text style={styles.avisoError}>{avisos.error}</Text> : null}
        </SystemWindow>

        <SystemWindow color={colors.purpleDim} fill={colors.panelDeep}>
          <Text style={[styles.windowTitle, { color: '#A697F0' }]}>PREMIUM · EL ORÁCULO</Text>
          {isPremium(subscription) ? (
            <Text style={styles.valveText}>
              Suscripción activa
              {subscription?.current_period_end
                ? ` · renueva el ${subscription.current_period_end.slice(0, 10)}`
                : ''}
              . El Oráculo va incluido.
            </Text>
          ) : (
            <>
              <Text style={styles.valveHint}>
                La IA (misiones desde objetivos + análisis semanal) consume API real. Con la
                suscripción va incluida; sin ella puedes usar tu propia key en el módulo Oráculo.
              </Text>
              {paymentsConfigured() ? (
                <SystemButton
                  title="Hazte Premium"
                  variant="outline"
                  onPress={() => userId && openCheckout(userId).catch((e) =>
                    Alert.alert('Pagos no disponibles', e instanceof Error ? e.message : ''),
                  )}
                  style={{ marginTop: 12 }}
                />
              ) : (
                <Text style={[styles.valveHint, { marginTop: 8 }]}>
                  (Pagos aún no configurados en este servidor.)
                </Text>
              )}
            </>
          )}
        </SystemWindow>

        <SystemButton title="Compartir mi progreso" onPress={() => setShareOpen(true)} style={{ marginTop: 2 }} />
        <SystemButton title="Exportar datos (copia de seguridad)" variant="outline" onPress={onExport} loading={busy} style={{ marginTop: 10 }} />
        <SystemButton title="Cerrar sesión" variant="danger" onPress={signOut} style={{ marginTop: 10 }} />
        <SystemButton title="Eliminar cuenta" variant="danger" onPress={onDeleteAccount} style={{ marginTop: 10 }} />
        </View>
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
            <View style={styles.shareStreak}>
              <Ionicons name="flame" size={15} color={colors.amber} />
              <Text style={styles.shareStreakText}>
                {profile.streak_days} {profile.streak_days === 1 ? 'DÍA' : 'DÍAS'} DE RACHA · ×
                {streakMultiplier(profile.streak_days).toFixed(1).replace('.', ',')} XP
              </Text>
            </View>
            <View style={styles.shareStats}>
              {STATS.map((s) => (
                <View key={s} style={styles.shareStat}>
                  <Text style={styles.shareStatAbbr}>{s}</Text>
                  <Text style={styles.shareStatVal}>{statPoints(profile[STAT_COLUMN[s]])}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.shareFooter}>
              {stats.total} misiones completadas · {evidencePct}% con evidencia
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
  content: { paddingBottom: 32 },
  body: { paddingHorizontal: 16, marginTop: 12 },
  hero: { width: '100%', backgroundColor: colors.panelDeep },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  heroEmptyHint: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
  heroShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroCamera: {
    position: 'absolute',
    top: 12,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(6, 11, 22, 0.6)',
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOverlay: { position: 'absolute', left: 16, right: 16, bottom: 12 },
  heroIdentity: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  heroIdentityText: { flex: 1, minWidth: 0 },
  heroName: {
    fontFamily: fonts.heading,
    fontSize: 24,
    letterSpacing: 1,
    color: colors.text,
    padding: 0,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroRankLetter: {
    fontFamily: fonts.brand,
    fontSize: 58,
    lineHeight: 60,
    color: colors.cyan,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  heroXp: { marginTop: 8 },
  heroStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  heroStat: { alignItems: 'center', flex: 1 },
  heroStatVal: {
    fontFamily: fonts.number,
    fontSize: 18,
    color: colors.text,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  heroStatAbbr: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.cyanText,
    marginTop: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  avatarLetter: { fontFamily: fonts.brand, fontSize: 32, color: colors.cyan },
  equippedTitle: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.amber,
    marginTop: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  rankText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.cyanText,
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  xpText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textDim,
    marginTop: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streakBody: { flex: 1, minWidth: 0 },
  streakBig: { fontFamily: fonts.brand, fontSize: 20, letterSpacing: 1, color: colors.amber },
  streakBigOff: { color: colors.textDim },
  streakMult: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textDim, marginTop: 3 },
  streakMsg: { fontFamily: fonts.body, fontSize: 13, color: colors.text, marginTop: 10, lineHeight: 19 },
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
  avisoError: { fontFamily: fonts.body, fontSize: 11.5, color: colors.red, marginTop: 8 },
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
  shareStreak: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  shareStreakText: { fontFamily: fonts.heading, fontSize: 12, letterSpacing: 1, color: colors.amber },
  shareStats: { flexDirection: 'row', gap: 14, marginTop: 12 },
  shareStat: { alignItems: 'center' },
  shareStatAbbr: { fontFamily: fonts.heading, fontSize: 11, color: colors.cyanText },
  shareStatVal: { fontFamily: fonts.number, fontSize: 16, color: colors.text, marginTop: 2 },
  shareFooter: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, marginTop: 14 },
});
