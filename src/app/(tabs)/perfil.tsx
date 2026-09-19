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
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { Hexagon } from '@/components/Hexagon';
import { SystemButton } from '@/components/SystemButton';
import { Version } from '@/components/Version';
import { XPBar } from '@/components/XPBar';
import {
  Card,
  Chip,
  ChipWrap,
  EmptyState,
  FadeIn,
  Row,
  RowValue,
  Screen,
  Section,
  Stagger,
  Stat,
  StatRow,
  Tag,
} from '@/components/ui';
import { ACHIEVEMENTS, fetchUnlocked } from '@/lib/achievements';
import { useAuth } from '@/lib/auth';
import {
  completionStats,
  ensureProfile,
  olvidarFirma,
  signedUrlCached,
  updateProfile,
  uploadAvatar,
} from '@/lib/data';
import { addDays, dateKey, isValidKey, nombreDia } from '@/lib/dates';
import { setFreeze } from '@/lib/engine';
import { exportAllData } from '@/lib/exporter';
import { deleteAccount } from '@/lib/account';
import {
  estadoAvisos,
  inicializarAvisos,
  type EstadoAvisos,
} from '@/lib/notifications';
import { setApiKey } from '@/lib/oracle';
import { fetchAiStatus, isPro } from '@/lib/pro';
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
  STAT_LABEL,
  statPoints,
  STATS,
  streakMultiplier,
} from '@/lib/game';
import { supabase } from '@/lib/supabase';
import { KINDS, kindMeta, PROFILE_KINDS, type ProfileKind } from '@/lib/kinds';
import { colors, fonts } from '@/lib/theme';
import type { Profile } from '@/lib/types';
import { voice } from '@/lib/voice';

const FREEZE_REASONS = ['Exámenes', 'Enfermedad', 'Vacaciones'];
const FREEZE_DAYS = [1, 3, 7, 14];

function multiplicador(dias: number): string {
  return `×${streakMultiplier(dias).toFixed(1).replace('.', ',')}`;
}

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
  // null = aún no se sabe (o sin red): la fila de Pro se pinta sin detalle.
  const [tieneCoach, setTieneCoach] = useState<boolean | null>(null);
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

  // Cambia lo que va delante en Hoy y el énfasis del coach; no borra nada.
  const cambiarPerfilDeUso = async (k: ProfileKind) => {
    if (!profile || !userId || profile.profile_kind === k) return;
    const anterior = profile.profile_kind;
    setProfile({ ...profile, profile_kind: k });
    try {
      await updateProfile(userId, { profile_kind: k });
    } catch (e) {
      setProfile((p) => (p ? { ...p, profile_kind: anterior } : p));
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  };

  const today = dateKey();
  const { height: winHeight } = useWindowDimensions();
  // La foto ocupa casi media pantalla, como pidió el gladiador.
  const heroHeight = Math.max(320, Math.round(winHeight * 0.44));
  const streakDays = profile?.streak_days ?? 0;
  // Memo: sin él, pick() elegiría una frase nueva en cada pulsación del nombre.
  const streakMsg = useMemo(() => voice.streakHype(streakDays), [streakDays]);

  const load = useCallback(async () => {
    if (!userId) return;
    // Por su cuenta: no bloquea el perfil ni lo tumba si falla.
    fetchAiStatus()
      .then((s) => setTieneCoach(isPro(s)))
      .catch(() => {});
    try {
      const prof = await ensureProfile(userId);
      setProfile(prof);
      setName(prof.name);
      // La foto, ANTES que el resto. Iba la última, detrás de dos consultas que
      // no tienen nada que ver con ella, así que su cara tardaba tres viajes de
      // red en aparecer sobre una pantalla ya pintada.
      if (prof.avatar_url) {
        setAvatarUri(await signedUrlCached('avatars', prof.avatar_url));
      }
      setStats(await completionStats());
      setUnlocked(await fetchUnlocked());
      setSubscription(await fetchSubscription(userId).catch(() => null));
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
      // La ruta es siempre la misma (un gladiador, un retrato), así que sin
      // olvidar la firma guardada seguiría viéndose la foto anterior.
      olvidarFirma('avatars', path);
      setAvatarUri(await signedUrlCached('avatars', path));
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
      'Esto borra PARA SIEMPRE tu perfil, misiones, campañas, diario, evidencias y todo tu progreso. No hay vuelta atrás.',
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
    return (
      <Screen>
        <EmptyState icon="person-outline" title="Consultando el registro" body="El sistema está cargando tu ficha de gladiador." />
      </Screen>
    );
  }

  const lvl = levelFromXp(profile.xp_total);
  const rank = rankForLevel(lvl.level);
  const maxStatXp = Math.max(100, ...STATS.map((s) => profile[STAT_COLUMN[s]]));
  const evidencePct = stats.total > 0 ? Math.round((stats.withEvidence / stats.total) * 100) : 0;
  const frozen = profile.freeze_until != null && profile.freeze_until >= today;
  const kind = kindMeta(profile.profile_kind);
  const premium = isPremium(subscription);
  const inicial = profile.name.charAt(0).toUpperCase();

  return (
    <Screen contentStyle={styles.content}>
      <Stagger>
        {/* La foto del gladiador ocupa casi media pantalla: identidad y rango. */}
        <FadeIn index={0} from={0}>
          <Pressable
            onPress={pickAvatar}
            style={[styles.hero, { height: heroHeight }]}
            accessible={false}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.heroImage} contentFit="cover" transition={200} />
            ) : profile.avatar_url ? (
              // Sabemos que hay foto aunque todavía no haya llegado: hueco en
              // silencio. Poner la inicial aquí es lo que hacía aparecer una letra
              // y después la cara, cada vez que entrabas.
              <View style={styles.heroEmpty} />
            ) : (
              <View style={styles.heroEmpty}>
                <Hexagon size={110}>
                  <Text style={styles.avatarLetter}>{inicial}</Text>
                </Hexagon>
                <Text style={styles.heroEmptyHint}>Toca para poner tu foto de gladiador</Text>
              </View>
            )}
            <LinearGradient
              colors={['rgba(5,5,5,0.35)', 'rgba(5,5,5,0)', 'rgba(5,5,5,0.9)', colors.bg]}
              locations={[0, 0.3, 0.68, 1]}
              style={styles.heroShade}
              pointerEvents="none"
            />
            <Pressable
              style={styles.heroCamera}
              onPress={pickAvatar}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Cambiar foto de gladiador"
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="camera-outline" size={16} color={colors.text} />
              )}
            </Pressable>
            <View style={styles.heroOverlay} pointerEvents="box-none">
              <View style={styles.heroIdentity} pointerEvents="box-none">
                <View style={styles.heroIdentityText} pointerEvents="box-none">
                  <Text style={styles.heroEyebrow}>
                    {kind.title} · RANGO {rank} · NIVEL {lvl.level}
                  </Text>
                  <TextInput
                    style={styles.heroName}
                    value={name}
                    onChangeText={setName}
                    onBlur={saveName}
                    onSubmitEditing={saveName}
                    returnKeyType="done"
                    maxLength={24}
                    accessibilityLabel="Tu nombre. Toca para cambiarlo."
                  />
                  {profile.equipped_title ? (
                    <Text style={styles.equippedTitle} numberOfLines={1}>
                      « {profile.equipped_title.toUpperCase()} »
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.heroRankLetter} accessibilityLabel={`Rango ${rank}`}>
                  {rank}
                </Text>
              </View>
            </View>
          </Pressable>
        </FadeIn>

        <View style={styles.body}>
          <FadeIn index={1}>
            <Card>
              <StatRow>
                <Stat value={lvl.level} label="Nivel" />
                <Stat value={rank} label="Rango" />
                <Stat value={streakDays} unit="d" label="Racha" tone={streakDays > 0 ? 'gold' : 'text'} />
                <Stat value={`${profile.protection_stones}/${MAX_STONES}`} label="Piedras" />
              </StatRow>
              <View style={styles.xp}>
                <XPBar ratio={lvl.next > 0 ? lvl.into / lvl.next : 1} height={5} />
                <View style={styles.xpMeta}>
                  <Text style={styles.xpText}>
                    {lvl.next > 0 ? `${lvl.into} / ${lvl.next} XP para el nivel ${lvl.level + 1}` : 'Nivel máximo alcanzado'}
                  </Text>
                  <Text style={[styles.xpMult, streakDays >= 7 && styles.xpMultOn]}>{multiplicador(streakDays)} XP</Text>
                </View>
              </View>
              <Text style={styles.streakMsg}>{streakMsg}</Text>
              <SystemButton
                title="Compartir mi progreso"
                icon="share-social-outline"
                onPress={() => setShareOpen(true)}
                style={{ marginTop: 16 }}
              />
            </Card>
          </FadeIn>

          {/* Las dos puertas que no son un módulo más: la gente y el coach. Amigos
              solo se alcanzaba desde el último azulejo de Hoy. */}
          <FadeIn index={2}>
            <Card padded={false} style={styles.accesos}>
              <Row
                first
                chevron
                leading={<Ionicons name="people-outline" size={18} color={colors.text} />}
                title="Amigos"
                detail="Ranking y tu código"
                onPress={() => router.push('/amigos')}
              />
              <Row
                chevron
                leading={<Ionicons name="shield-half-outline" size={18} color={colors.text} />}
                title="NIVL Pro"
                detail={tieneCoach === null ? undefined : tieneCoach ? 'Activo' : 'Activa el coach'}
                onPress={() => router.push('/pro')}
              />
            </Card>
          </FadeIn>

          {frozen ? (
            <FadeIn index={2}>
              <Card variant="outline" accent={colors.accentDim}>
                <Text style={styles.alertTitle}>
                  <Ionicons name="snow-outline" size={12} color={colors.accentText} /> SISTEMA EN PAUSA
                </Text>
                <Text style={styles.alertBody}>
                  {voice.frozen(profile.freeze_reason ?? 'pausa')}
                  {profile.freeze_until && isValidKey(profile.freeze_until)
                    ? ` Hasta el ${nombreDia(profile.freeze_until).toLowerCase()}.`
                    : ''}
                </Text>
              </Card>
            </FadeIn>
          ) : null}

          <FadeIn index={3}>
            <Section title="Para qué uso NIVL">
              <ChipWrap>
                {PROFILE_KINDS.map((k) => (
                  <Chip
                    key={k}
                    label={KINDS[k].label}
                    icon={KINDS[k].icon as never}
                    selected={profile.profile_kind === k}
                    onPress={() => cambiarPerfilDeUso(k)}
                    disabled={busy}
                    accessibilityLabel={`Perfil ${KINDS[k].label}`}
                  />
                ))}
              </ChipWrap>
              <Text style={styles.nota}>{kind.tagline}</Text>
            </Section>
          </FadeIn>

          <FadeIn index={4}>
            <Section title="Estadísticas">
              <Card>
                {STATS.map((s, i) => {
                  const xp = profile[STAT_COLUMN[s]];
                  return (
                    <View key={s} style={[styles.statRow, i > 0 && styles.statRowSep]}>
                      <View style={styles.statName}>
                        <Text style={styles.statAbbr}>{s}</Text>
                        <Text style={styles.statLabel} numberOfLines={1}>
                          {STAT_LABEL[s]}
                        </Text>
                      </View>
                      <View style={styles.statBar}>
                        <XPBar ratio={xp / maxStatXp} height={5} />
                      </View>
                      <Text style={styles.statPoints}>{statPoints(xp)}</Text>
                    </View>
                  );
                })}
              </Card>
              <Text style={styles.nota}>Un punto por cada 100 XP del área.</Text>
            </Section>
          </FadeIn>

          <FadeIn index={5}>
            <Section
              title="Logros"
              meta={`${unlocked.size}/${ACHIEVEMENTS.length}`}
              tone={unlocked.size > 0 ? 'gold' : 'dim'}
            >
              <View style={styles.achGrid}>
                {ACHIEVEMENTS.map((a) => {
                  const isUnlocked = unlocked.has(a.code);
                  return (
                    <Card
                      key={a.code}
                      onPress={() => onAchievementTap(a.code)}
                      style={[styles.ach, isUnlocked && styles.achOn]}
                      accessibilityLabel={`${a.name}${isUnlocked ? ', desbloqueado' : ', bloqueado'}${a.title && isUnlocked ? `. Título: ${a.title}` : ''}`}
                    >
                      <Ionicons
                        name={isUnlocked ? 'ribbon' : 'lock-closed-outline'}
                        size={18}
                        color={isUnlocked ? colors.gold : colors.textFaint}
                      />
                      <Text style={[styles.achName, isUnlocked && styles.achNameOn]} numberOfLines={2}>
                        {a.name}
                      </Text>
                      {a.title && isUnlocked ? (
                        <Text style={[styles.achTitleTag, profile.equipped_title === a.title && styles.achTitleTagOn]}>
                          {profile.equipped_title === a.title ? 'EQUIPADO' : 'TÍTULO'}
                        </Text>
                      ) : null}
                    </Card>
                  );
                })}
              </View>
            </Section>
          </FadeIn>

          <FadeIn index={6}>
            <Section title="Registro">
              <Card>
                <StatRow>
                  <Stat value={stats.total} label="Misiones" />
                  <Stat value={evidencePct} unit="%" label="Con evidencia" />
                  <Stat value={multiplicador(profile.streak_days)} label="Multiplicador" tone={streakDays >= 7 ? 'gold' : 'text'} />
                </StatRow>
              </Card>
            </Section>
          </FadeIn>

          <FadeIn index={7}>
            <Section title="Válvulas del sistema">
              <Card padded={false} style={styles.lista}>
                <Row
                  first
                  leading={<Ionicons name="shield-half-outline" size={20} color={colors.accent} />}
                  title="Piedras de protección"
                  detail="Se forja una por semana de racha perfecta. Se consume sola al fallar un día y absorbe todo el daño."
                  trailing={
                    <RowValue tone="accent" strong>
                      {profile.protection_stones}/{MAX_STONES}
                    </RowValue>
                  }
                />
                <Row
                  leading={<Ionicons name="snow-outline" size={20} color={frozen ? colors.accentText : colors.textDim} />}
                  title={frozen ? `En pausa · ${profile.freeze_reason ?? 'pausa'}` : 'Pausar el sistema'}
                  detail={
                    frozen
                      ? `Hasta el ${profile.freeze_until}. Toca para reanudar antes.`
                      : 'Exámenes, enfermedad, viaje. Sin misiones ni penalizaciones mientras dure.'
                  }
                  trailing={frozen ? <Tag tone="accent">Pausa</Tag> : undefined}
                  chevron
                  onPress={frozen ? deactivateFreeze : () => setFreezeOpen(true)}
                  accessibilityLabel={frozen ? 'Reanudar el sistema' : 'Pausar el sistema'}
                />
              </Card>
            </Section>
          </FadeIn>

          {/* Sin esto no había forma de saber si los avisos estaban vivos: fallaban
              en silencio y el gladiador se enteraba por no recibirlos. */}
          <FadeIn index={8}>
            <Section title="Avisos" tone={avisos && !avisos.permitido ? 'red' : 'dim'}>
              <Card padded={false} style={styles.lista} accent={avisos && !avisos.permitido ? colors.red : undefined}>
                <Row
                  first
                  leading={
                    <Ionicons
                      name={avisos?.permitido ? 'notifications-outline' : 'notifications-off-outline'}
                      size={20}
                      color={avisos === null ? colors.textDim : avisos.permitido ? colors.accent : colors.red}
                    />
                  }
                  title={
                    avisos === null ? 'Comprobando los avisos' : avisos.permitido ? 'Avisos activos' : 'Avisos desactivados'
                  }
                  detail={
                    avisos?.permitido
                      ? 'Despertador, bloques del día y cierre. Una notificación no suena en silencio ni en Modo Concentración: mantén también la alarma del reloj.'
                      : avisos === null
                        ? undefined
                        : 'Sin permiso no hay despertador ni avisos de bloque. Toca para activarlos.'
                  }
                  trailing={
                    avisos?.permitido ? (
                      <RowValue tone="accent" strong>
                        {avisos.programados}
                      </RowValue>
                    ) : undefined
                  }
                  chevron={!!avisos && !avisos.permitido}
                  onPress={avisos && !avisos.permitido ? activarAvisos : undefined}
                  accessibilityLabel={
                    avisos && !avisos.permitido
                      ? avisos.puedePreguntar
                        ? 'Activar avisos'
                        : 'Abrir ajustes del sistema para activar los avisos'
                      : undefined
                  }
                />
                {avisos?.error ? (
                  <Row
                    leading={<Ionicons name="alert-circle-outline" size={20} color={colors.red} />}
                    title="Último error"
                    detail={avisos.error}
                    muted
                  />
                ) : null}
              </Card>
              {avisos?.permitido ? <Text style={styles.nota}>{avisos.programados} avisos programados.</Text> : null}
            </Section>
          </FadeIn>

          <FadeIn index={9}>
            <Section title="El Oráculo" tone="steel">
              <Card padded={false} style={styles.lista}>
                <Row
                  first
                  leading={<Ionicons name="sparkles-outline" size={20} color={colors.steel} />}
                  title={premium ? 'Premium activo' : 'Hazte Premium'}
                  detail={
                    premium
                      ? `El Oráculo va incluido${subscription?.current_period_end ? `. Renueva el ${subscription.current_period_end.slice(0, 10)}` : ''}.`
                      : paymentsConfigured()
                        ? 'La IA (misiones desde objetivos y análisis semanal) consume API real. Con la suscripción va incluida; sin ella puedes usar tu propia key en el módulo Oráculo.'
                        : 'Pagos aún no configurados en este servidor. Puedes usar tu propia key en el módulo Oráculo.'
                  }
                  trailing={premium ? <Tag tone="steel">Activo</Tag> : undefined}
                  chevron={!premium && paymentsConfigured()}
                  onPress={
                    !premium && paymentsConfigured()
                      ? () =>
                          userId &&
                          openCheckout(userId).catch((e) =>
                            Alert.alert('Pagos no disponibles', e instanceof Error ? e.message : ''),
                          )
                      : undefined
                  }
                  accessibilityLabel={!premium && paymentsConfigured() ? 'Hazte Premium' : undefined}
                />
              </Card>
            </Section>
          </FadeIn>

          <FadeIn index={10}>
            <Section title="Cuenta">
              <Card padded={false} style={styles.lista}>
                <Row
                  first
                  leading={<Ionicons name="download-outline" size={20} color={colors.text} />}
                  title="Exportar mis datos"
                  detail="Copia de seguridad con todo tu progreso."
                  trailing={busy ? <ActivityIndicator size="small" color={colors.accent} /> : undefined}
                  chevron={!busy}
                  onPress={onExport}
                  disabled={busy}
                  accessibilityLabel="Exportar mis datos"
                  accessibilityState={{ disabled: busy }}
                />
                <Row
                  leading={<Ionicons name="log-out-outline" size={20} color={colors.text} />}
                  title="Cerrar sesión"
                  detail="Tu cuenta de Franky sigue intacta."
                  chevron
                  onPress={signOut}
                  accessibilityLabel="Cerrar sesión"
                />
              </Card>
              <SystemButton
                title="Eliminar cuenta"
                variant="danger"
                icon="trash-outline"
                onPress={onDeleteAccount}
                style={{ marginTop: 6 }}
              />
              <Text style={styles.nota}>Borra para siempre tu perfil y todo tu progreso. El sistema no puede deshacerlo.</Text>
            </Section>
          </FadeIn>

          <FadeIn index={11}>
            <Version />
          </FadeIn>
        </View>
      </Stagger>

      <Modal visible={freezeOpen} transparent animationType="slide" onRequestClose={() => setFreezeOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            style={styles.backdropTap}
            onPress={() => setFreezeOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>PAUSAR EL SISTEMA</Text>
            <Text style={styles.sheetTitle}>¿Cuánto tiempo?</Text>
            <Text style={styles.sheetHint}>
              Sin misiones, sin penalizaciones, sin pérdida de racha. Pausar no es rendirse: es estrategia.
            </Text>
            <Text style={styles.label}>Motivo</Text>
            <ChipWrap>
              {FREEZE_REASONS.map((r) => (
                <Chip
                  key={r}
                  label={r}
                  selected={freezeReason === r}
                  onPress={() => setFreezeReason(r)}
                  accessibilityLabel={`Motivo: ${r}`}
                />
              ))}
            </ChipWrap>
            <Text style={styles.label}>Duración, desde hoy</Text>
            <ChipWrap>
              {FREEZE_DAYS.map((d) => (
                <Chip
                  key={d}
                  label={`${d} día${d > 1 ? 's' : ''}`}
                  selected={freezeDays === d}
                  onPress={() => setFreezeDays(d)}
                  accessibilityLabel={`${d} día${d > 1 ? 's' : ''}`}
                />
              ))}
            </ChipWrap>
            <Text style={styles.hint}>El sistema se reanuda solo el {addDays(today, freezeDays)}.</Text>
            <SystemButton title="Activar pausa" onPress={activateFreeze} style={{ marginTop: 22 }} />
            <SystemButton title="Cancelar" variant="ghost" onPress={() => setFreezeOpen(false)} style={{ marginTop: 6 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={shareOpen} transparent animationType="fade" onRequestClose={() => setShareOpen(false)}>
        <View style={styles.shareBackdrop}>
          {/* La tarjeta que se captura: monocromo, oro solo para la racha y el título. */}
          <View ref={shareRef} collapsable={false} style={styles.shareCard}>
            <Text style={styles.shareBrand}>NIVL</Text>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.shareAvatar} contentFit="cover" />
            ) : (
              <Hexagon size={84}>
                <Text style={styles.avatarLetter}>{inicial}</Text>
              </Hexagon>
            )}
            <Text style={styles.shareName} numberOfLines={1}>
              {profile.name}
            </Text>
            {profile.equipped_title ? (
              <Text style={styles.shareTitle} numberOfLines={1}>
                « {profile.equipped_title.toUpperCase()} »
              </Text>
            ) : null}
            <Text style={styles.shareRank}>
              {kind.title} · RANGO {rank}
            </Text>
            <View style={styles.shareLevelRow}>
              <Text style={styles.shareLevelLabel}>NIVEL</Text>
              <Text style={styles.shareLevel}>{lvl.level}</Text>
            </View>
            <View style={styles.shareStreak}>
              <Ionicons name="flame" size={14} color={streakDays > 0 ? colors.gold : colors.textFaint} />
              <Text style={[styles.shareStreakText, streakDays === 0 && styles.shareStreakOff]}>
                {streakDays} {streakDays === 1 ? 'DÍA' : 'DÍAS'} DE RACHA · {multiplicador(streakDays)} XP
              </Text>
            </View>
            <View style={styles.shareRule} />
            <View style={styles.shareStats}>
              {STATS.map((s) => (
                <View key={s} style={styles.shareStat}>
                  <Text style={styles.shareStatVal}>{statPoints(profile[STAT_COLUMN[s]])}</Text>
                  <Text style={styles.shareStatAbbr}>{s}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.shareFooter}>
              {stats.total} misiones completadas · {evidencePct}% con evidencia
            </Text>
          </View>
          <SystemButton
            title="Compartir imagen"
            icon="share-social-outline"
            onPress={shareProfile}
            style={{ marginTop: 16, alignSelf: 'stretch' }}
          />
          <SystemButton
            title="Cerrar"
            variant="ghost"
            onPress={() => setShareOpen(false)}
            style={{ marginTop: 6, alignSelf: 'stretch' }}
          />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 0, paddingTop: 0 },
  body: { paddingHorizontal: 20, marginTop: 14 },
  accesos: { paddingHorizontal: 16, paddingVertical: 2 },

  hero: { width: '100%', backgroundColor: colors.panelDeep },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  heroEmptyHint: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
  heroShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroCamera: {
    position: 'absolute',
    top: 12,
    right: 20,
    width: 36,
    height: 36,
    backgroundColor: colors.panelDeep,
    borderWidth: 1,
    borderColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOverlay: { position: 'absolute', left: 20, right: 20, bottom: 8 },
  heroIdentity: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  heroIdentityText: { flex: 1, minWidth: 0 },
  heroEyebrow: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2.5,
    color: colors.textDim,
    marginBottom: 4,
  },
  heroName: {
    fontFamily: fonts.heading,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: colors.text,
    padding: 0,
  },
  equippedTitle: {
    fontFamily: fonts.heading,
    fontSize: 11.5,
    letterSpacing: 2,
    color: colors.gold,
    marginTop: 4,
  },
  heroRankLetter: {
    fontFamily: fonts.brand,
    fontSize: 58,
    lineHeight: 60,
    color: colors.accent,
  },
  avatarLetter: { fontFamily: fonts.brand, fontSize: 32, color: colors.accent },

  xp: { marginTop: 16 },
  xpMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 6 },
  xpText: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
  xpMult: { fontFamily: fonts.number, fontSize: 12, color: colors.textFaint },
  xpMultOn: { color: colors.gold },
  streakMsg: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.text, marginTop: 12 },

  alertTitle: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2.5,
    color: colors.accentText,
    marginBottom: 6,
  },
  alertBody: { fontFamily: fonts.body, fontSize: 13.5, color: colors.text, lineHeight: 19 },

  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 8 },
  lista: { paddingHorizontal: 16, paddingVertical: 2 },

  statRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  statRowSep: { borderTopWidth: 1, borderTopColor: colors.line },
  statName: { width: 88 },
  statAbbr: { fontFamily: fonts.heading, fontSize: 12.5, letterSpacing: 1.5, color: colors.text },
  statLabel: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textFaint, marginTop: 1 },
  statBar: { flex: 1 },
  statPoints: { fontFamily: fonts.number, fontSize: 14, color: colors.text, width: 34, textAlign: 'right' },

  achGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ach: {
    width: '31.5%',
    marginBottom: 0,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  achOn: { borderColor: colors.goldDim },
  achName: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, color: colors.textFaint, textAlign: 'center' },
  achNameOn: { color: colors.text },
  achTitleTag: { fontFamily: fonts.heading, fontSize: 9, letterSpacing: 1.5, color: colors.goldDim },
  achTitleTagOn: { color: colors.gold },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  backdropTap: { flex: 1 },
  sheet: {
    backgroundColor: colors.panel,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
  sheetHandle: { alignSelf: 'center', width: 36, height: 3, backgroundColor: colors.accentDim, marginBottom: 16 },
  sheetEyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.accentText },
  sheetTitle: {
    fontFamily: fonts.heading,
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.text,
    marginTop: 6,
    marginBottom: 4,
  },
  sheetHint: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, lineHeight: 18 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 10, lineHeight: 17 },

  shareBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  shareCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.accentDim,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  shareBrand: { fontFamily: fonts.brand, fontSize: 15, letterSpacing: 8, color: colors.accent, marginBottom: 18 },
  shareAvatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 1.5, borderColor: colors.accent },
  shareName: { fontFamily: fonts.heading, fontSize: 24, letterSpacing: -0.5, color: colors.text, marginTop: 14 },
  shareTitle: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2, color: colors.gold, marginTop: 4 },
  shareRank: { fontFamily: fonts.heading, fontSize: 10.5, letterSpacing: 2.5, color: colors.textFaint, marginTop: 6 },
  shareLevelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 10 },
  shareLevelLabel: { fontFamily: fonts.heading, fontSize: 10, letterSpacing: 2.5, color: colors.textFaint },
  shareLevel: { fontFamily: fonts.brand, fontSize: 44, lineHeight: 48, color: colors.accent },
  shareStreak: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  shareStreakText: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1.5, color: colors.gold },
  shareStreakOff: { color: colors.textFaint },
  shareRule: { alignSelf: 'stretch', height: 1, backgroundColor: colors.line, marginTop: 18, marginBottom: 14 },
  shareStats: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-around' },
  shareStat: { alignItems: 'center' },
  shareStatVal: { fontFamily: fonts.number, fontSize: 18, color: colors.text },
  shareStatAbbr: { fontFamily: fonts.heading, fontSize: 10, letterSpacing: 1.5, color: colors.textFaint, marginTop: 3 },
  shareFooter: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, marginTop: 16 },
});
