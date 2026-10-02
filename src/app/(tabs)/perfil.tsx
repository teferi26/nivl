import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCelebracion } from '@/components/celebracion/contexto';
import { useConsentimientoIA } from '@/components/ConsentimientoIA';
import { HealthPrivacySection } from '@/components/ConsentimientoSalud';
import { EliteBadge } from '@/components/EliteBadge';
import { CaminoDeRangos } from '@/components/perfil/CaminoDeRangos';
import { SystemButton } from '@/components/SystemButton';
import { Version } from '@/components/Version';
import { XPBar } from '@/components/XPBar';
import {
  avisar,
  Avatar,
  Card,
  Chip,
  ChipWrap,
  confirmar,
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
import { Interruptor } from '@/components/ui/Interruptor';
import {
  ACHIEVEMENT_BY_CODE,
  ACHIEVEMENTS,
  ACHIEVEMENTS_VISIBLES,
  fetchUnlocked,
  sincronizarRangoDetalle,
  tituloVigente,
} from '@/lib/achievements';
import { useVibraciones, vibrar } from '@/design/haptics';
import { ink } from '@/design/tokens';
import { useSizeClass } from '@/design/useSizeClass';
import { useAuth } from '@/lib/auth';
import { cerrarSesion } from '@/lib/authFlow';
import {
  completionStats,
  ensureProfile,
  olvidarFirma,
  removeAvatar,
  signedUrlCached,
  updateProfile,
  uploadAvatar,
} from '@/lib/data';
import { CODIGO_MAX_LENGTH, motivoReferral } from '@/lib/creatormath';
import { claimReferral, fetchCreatorPanel, fetchMyReferral, type MyReferral } from '@/lib/creators';
import { addDays, dateKey, isValidKey, nombreDia } from '@/lib/dates';
import { setFreeze } from '@/lib/engine';
import { exportAllData } from '@/lib/exporter';
import { deleteAccount } from '@/lib/account';
import {
  consentimientoVigente,
  DESCARGO_SALUD,
  fetchConsentimiento,
  LINEA_CRISIS,
  lineaPerfil,
  retirarConsentimiento,
  type EstadoConsentimiento,
} from '@/lib/consent';
import {
  estadoAvisos,
  inicializarAvisos,
  type EstadoAvisos,
} from '@/lib/notifications';
import { registrarDispositivo } from '@/lib/push';
import { fetchAiStatus, isElite, isPro } from '@/lib/pro';
import { LEGAL_URLS } from '@/lib/proplans';
import {
  fetchSubscription,
  isPremium,
  openCheckout,
  paymentsConfigured,
  paywallEnabled,
  type Subscription,
} from '@/lib/subscription';
import {
  MAX_STONES,
  STAT_COLUMN,
  STAT_LABEL,
  statPoints,
  STATS,
  streakMultiplier,
} from '@/lib/game';
import { KINDS, kindMeta, PROFILE_KINDS, type ProfileKind } from '@/lib/kinds';
import { cosmeticosDe, estadoDe, type LogroInfo } from '@/lib/progression';
import { colors, fonts } from '@/lib/theme';
import type { Profile } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';
import { voice } from '@/lib/voice';

const FREEZE_REASONS = ['Exámenes', 'Enfermedad', 'Vacaciones'];
const FREEZE_DAYS = [1, 3, 7, 14];

function multiplicador(dias: number): string {
  return `×${streakMultiplier(dias).toFixed(1).replace('.', ',')}`;
}

/** Un código `rango_X` de sync_rank en la forma del contrato de celebraciones. */
const logroDeCodigo = (codigo: string): LogroInfo => {
  const def = ACHIEVEMENT_BY_CODE[codigo];
  return def ? { codigo, nombre: def.name, desc: def.desc, titulo: def.title } : { codigo, nombre: codigo, desc: '' };
};

export default function Perfil() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const marco = useSizeClass();
  const ancho = marco.sizeClass !== 'compact';
  const [vibraciones, setVibraciones] = useVibraciones();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [stats, setStats] = useState<{ total: number; withEvidence: number }>({ total: 0, withEvidence: 0 });
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  // Días activos que usó el servidor para el rango (sync_rank). null = no se
  // saben (sin red o sin la 0051): el camino lo dice sin cifra.
  const [diasActivos, setDiasActivos] = useState<number | null>(null);
  const { celebrar, compartir } = useCelebracion();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  // null = aún no se sabe (o sin red): la fila de Pro se pinta sin detalle.
  const [tieneCoach, setTieneCoach] = useState<boolean | null>(null);
  // La insignia Élite (0026): estética, nada más. El dueño no la lleva.
  const [elite, setElite] = useState(false);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [freezeReason, setFreezeReason] = useState(FREEZE_REASONS[0]!);
  const [freezeDays, setFreezeDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [avisos, setAvisos] = useState<EstadoAvisos | null>(null);
  // Programa de creadores: la fila del código solo sale sin atribución y en
  // plazo; la del panel, solo si esta cuenta es creador.
  const [referral, setReferral] = useState<MyReferral | null>(null);
  const [esCreador, setEsCreador] = useState(false);
  const [codigoOpen, setCodigoOpen] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [avisoCodigo, setAvisoCodigo] = useState<string | null>(null);
  const [codigoBusy, setCodigoBusy] = useState(false);
  // El consentimiento para la IA (0028): se ve y se retira aquí.
  const [consent, setConsent] = useState<EstadoConsentimiento | null>(null);
  const consentimiento = useConsentimientoIA();
  // Esta hoja solo permite borrar la cuenta y los datos de NIVL.
  const [borrarOpen, setBorrarOpen] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [avisoBorrar, setAvisoBorrar] = useState<string | null>(null);

  const refrescarAvisos = useCallback(() => {
    estadoAvisos().then(setAvisos).catch(() => setAvisos(null));
  }, []);

  const activarAvisos = async () => {
    const ok = await inicializarAvisos();
    if (ok) {
      // Con permiso, el dispositivo se registra para el push del coach.
      registrarDispositivo().catch(() => {});
    } else {
      const titulo = 'Avisos bloqueados';
      const mensaje =
        'Actívalos en los ajustes del teléfono, en las notificaciones de NIVL. Sin ellos el sistema no puede despertarte ni avisarte de los bloques.';
      if (Platform.OS === 'web') {
        avisar(titulo, mensaje);
      } else if (await confirmar({ titulo, mensaje, confirmar: 'Abrir ajustes' })) {
        Linking.openSettings().catch(() => {});
      }
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
      avisar('Error del sistema', mensajeSistema(e));
    }
  };

  const today = dateKey();
  const streakDays = profile?.streak_days ?? 0;
  // Memo: sin él, pick() elegiría una frase nueva en cada pulsación del nombre.
  const streakMsg = useMemo(() => voice.streakHype(streakDays), [streakDays]);

  const load = useCallback(async () => {
    if (!userId) return;
    // Por su cuenta: no bloquea el perfil ni lo tumba si falla.
    fetchAiStatus()
      .then((s) => {
        setTieneCoach(isPro(s));
        setElite(isElite(s));
      })
      .catch(() => {});
    fetchMyReferral()
      .then(setReferral)
      .catch(() => {});
    fetchCreatorPanel()
      .then((p) => setEsCreador(!!p))
      .catch(() => {});
    fetchConsentimiento({ fresco: true })
      .then(setConsent)
      .catch(() => setConsent(null));
    // Rango y días activos, en paralelo y sin bloquear: si el servidor registra
    // un rango nuevo aquí, se celebra por la cola como en cualquier pantalla.
    sincronizarRangoDetalle()
      .then(async ({ nuevos, diasActivos: dias }) => {
        setDiasActivos(dias);
        if (nuevos.length === 0) return;
        const logros = await fetchUnlocked();
        setUnlocked(logros);
        celebrar({
          accion: `perfil:rango:${Date.now()}`,
          logrosAntes: [...logros].filter((c) => !nuevos.includes(c)),
          logrosNuevos: nuevos.map(logroDeCodigo),
          diasActivos: dias,
          final: true,
        });
      })
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
      avisar('Error del sistema', mensajeSistema(e));
    }
  }, [userId, celebrar]);

  useFocusEffect(
    useCallback(() => {
      load();
      refrescarAvisos();
    }, [load, refrescarAvisos]),
  );

  const pickAvatar = async () => {
    if (!userId || !profile || uploadingPhoto) return;
    setUploadingPhoto(true);
    try {
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
      const path = await uploadAvatar(userId, b64);
      try {
        await updateProfile(userId, { avatar_url: path });
      } catch (error) {
        await removeAvatar(userId, path).catch(() => {});
        throw error;
      }
      setProfile({ ...profile, avatar_url: path });
      if (profile.avatar_url && profile.avatar_url !== path) {
        await removeAvatar(userId, profile.avatar_url).catch(() => {});
      }
      olvidarFirma('avatars', path);
      setAvatarUri(await signedUrlCached('avatars', path));
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const saveName = async () => {
    if (!userId || !profile) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === profile.name) return;
    try {
      await updateProfile(userId, { name: trimmed });
      setProfile({ ...profile, name: trimmed });
    } catch (error) {
      setName(profile.name);
      avisar('No se ha guardado el nombre', mensajeSistema(error));
    }
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
      avisar(def.name, def.desc);
      return;
    }
    const isEquipped = profile.equipped_title === def.title;
    const ok = await confirmar({
      titulo: def.name,
      mensaje: `${def.desc}\nTítulo: "${def.title}"`,
      confirmar: isEquipped ? 'Quitar título' : 'Equipar título',
      cancelar: 'Cerrar',
    });
    if (!ok) return;
    const next = isEquipped ? null : def.title ?? null;
    try {
      await updateProfile(userId, { equipped_title: next });
      setProfile({ ...profile, equipped_title: next });
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    }
  };

  // La hoja de compartir es la de la cola de celebraciones: la pausa mientras
  // está abierta y pide ella el código de amigo. La de rango lleva el retrato.
  const abrirCompartir = () => {
    compartir({ tipo: 'rango', rango: rank, titulo, rachaDias: streakDays }, { retratoUri: avatarUri });
  };

  const cambiarVibraciones = (v: boolean) => {
    setVibraciones(v);
    if (v) vibrar('seleccion');
  };

  const onExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await exportAllData();
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    // cerrarSesion (authFlow, Chat 3) limpia lo que heredaría el siguiente
    // usuario de este móvil: token push, avisos locales, key del Oráculo,
    // consentimiento y código de creador. Nunca impide salir.
    await cerrarSesion().catch(() => {});
    router.replace('/login');
  };

  const abrirCodigo = () => {
    setCodigo('');
    setAvisoCodigo(null);
    setCodigoOpen(true);
  };

  const enviarCodigo = async () => {
    if (codigoBusy || !codigo.trim()) return;
    setCodigoBusy(true);
    try {
      const r = await claimReferral(codigo, 'perfil');
      if (r.ok) {
        vibrar('mision');
        setReferral({ alias: r.alias, since: new Date().toISOString(), claimable: false });
        setCodigoOpen(false);
      } else {
        setAvisoCodigo(motivoReferral(r.reason));
        // Ya asignado o fuera de plazo: la fila deja de tener sentido.
        if (r.reason === 'ya_asignado' || r.reason === 'fuera_de_plazo' || r.reason === 'ya_pagas') {
          setReferral((prev) => (prev ? { ...prev, claimable: false } : prev));
        }
      }
    } catch (e) {
      setAvisoCodigo(mensajeSistema(e));
    } finally {
      setCodigoBusy(false);
    }
  };

  const abrirBorrar = () => {
    setAvisoBorrar(null);
    setBorrarOpen(true);
  };

  const ejecutarBorrado = async () => {
    if (borrando) return;
    setBorrando(true);
    setAvisoBorrar(null);
    try {
      await deleteAccount();
      setBorrarOpen(false);
      router.replace('/login');
    } catch (e) {
      setAvisoBorrar(mensajeSistema(e));
    } finally {
      setBorrando(false);
    }
  };

  const confirmarBorrado = async () => {
    if (borrando) return;
    // `confirmar` y no Alert.alert: en la web el Alert no se pinta y el
    // borrado se quedaba sin hacer.
    const ok = await confirmar({
      titulo: '¿Estás totalmente seguro?',
      mensaje: 'Se borra tu cuenta de NIVL. El sistema no puede deshacerlo.',
      confirmar: 'Eliminar para siempre',
      destructivo: true,
    });
    if (ok) await ejecutarBorrado();
  };

  // Aceptado: retirar (con confirmación). Sin aceptar: la hoja.
  const tocarConsentimiento = async () => {
    if (consentimientoVigente(consent)) {
      const ok = await confirmar({
        titulo: 'Retirar el consentimiento',
        mensaje:
          'Desde ahora no se envía nada al proveedor de IA y el coach deja de funcionar, también los avisos que prepara. Tus datos en NIVL no se borran. Puedes volver a aceptarlo cuando quieras.',
        confirmar: 'Retirar',
        destructivo: true,
      });
      if (!ok) return;
      // El estado solo cambia con lo que diga el servidor tras retirar: si la
      // llamada falla, la pantalla sigue diciendo "aceptado".
      try {
        await retirarConsentimiento();
        setConsent(await fetchConsentimiento({ fresco: true }));
      } catch (e) {
        avisar('Error del sistema', mensajeSistema(e));
      }
      return;
    }
    if (await consentimiento.pedir()) {
      fetchConsentimiento({ fresco: true })
        .then(setConsent)
        .catch(() => {});
    }
  };

  if (!profile) {
    return (
      <Screen>
        <EmptyState icon="person-outline" title="Consultando el registro" body="El sistema está cargando tu ficha de gladiador." />
      </Screen>
    );
  }

  // Sin días activos (null), siguienteRango no sabe cuántos faltan (faltanDias = null).
  const estado = estadoDe(profile, unlocked, diasActivos ?? undefined);
  const rank = estado.rango;
  const titulo = tituloVigente(profile.equipped_title) ?? cosmeticosDe(rank).titulo;
  const leyenda = rank === 'S';
  const maxStatXp = Math.max(100, ...STATS.map((s) => profile[STAT_COLUMN[s]]));
  const evidencePct = stats.total > 0 ? Math.round((stats.withEvidence / stats.total) * 100) : 0;
  const frozen = profile.freeze_until != null && profile.freeze_until >= today;
  const kind = kindMeta(profile.profile_kind);
  const premium = isPremium(subscription);
  const visibles = ACHIEVEMENTS_VISIBLES();
  const desbloqueados = visibles.filter((a) => unlocked.has(a.code)).length;
  const sinPermiso = !!avisos && !avisos.permitido;

  const campoNombre = (
    <TextInput
      style={[styles.heroName, ancho ? null : styles.heroNameCentro, elite && styles.heroNameShrink]}
      value={name}
      onChangeText={setName}
      onBlur={saveName}
      onSubmitEditing={saveName}
      returnKeyType="done"
      maxLength={24}
      accessibilityLabel="Tu nombre. Toca para cambiarlo."
    />
  );

  return (
    <Screen
      contentStyle={styles.content}
    >
      <Stagger>
        {/* Cabecera: retrato con el marco de su rango, nombre, título y cifras.
            En S la tarjeta lleva marco de grano (logro); si no, superficie. */}
        <FadeIn index={0} from={0}>
          <Card variant={leyenda ? 'logro' : 'surface'} style={styles.cabecera}>
            <View style={[styles.cabeceraDentro, ancho && styles.cabeceraAncha]}>
              <Pressable
                onPress={pickAvatar}
                disabled={uploadingPhoto}
                style={styles.retrato}
                accessibilityRole="button"
                // El botón agrupa al Avatar: su etiqueta (nombre, rango, título) va aquí.
                accessibilityLabel={`${profile.name}, rango ${rank}, ${titulo}. Cambiar foto de gladiador`}
                accessibilityState={{ busy: uploadingPhoto }}
              >
                <Avatar
                  size={ancho ? 136 : 112}
                  avatarPath={profile.avatar_url}
                  name={profile.name}
                  rank={rank}
                  titulo={titulo}
                />
                <View style={styles.camara} pointerEvents="none">
                  {uploadingPhoto ? (
                    <ActivityIndicator size="small" color={ink.ink9} />
                  ) : (
                    <Ionicons name="camera-outline" size={14} color={ink.ink9} />
                  )}
                </View>
              </Pressable>

              <View style={[styles.datos, ancho ? styles.datosAncha : styles.datosCentro]}>
                {/* Con insignia, nombre y laurel en fila; sin ella, el campo solo
                    (un TextInput en fila mide por su contenido). */}
                {elite ? (
                  <View style={[styles.heroNameRow, !ancho && styles.heroNameRowCentro]}>
                    {campoNombre}
                    <EliteBadge size={22} style={styles.heroBadge} />
                  </View>
                ) : (
                  campoNombre
                )}
                <Text style={[styles.lineaTitulo, !ancho && styles.textoCentro]} numberOfLines={2}>
                  « {titulo.toUpperCase()} » · {kind.title}
                </Text>
                <StatRow style={styles.cifras}>
                  <Stat value={estado.nivel} label="Nivel" />
                  <Stat value={rank} label="Rango" />
                  <Stat value={streakDays} unit="d" label="Racha" />
                  <Stat value={`${profile.protection_stones}/${MAX_STONES}`} label="Piedras" />
                </StatRow>
              </View>
            </View>
          </Card>
        </FadeIn>

        <View style={styles.body}>
          <Text style={styles.profileReviewNotice}>
            Tu nombre, foto y título se muestran a otras personas tras su revisión. Mientras tanto verán un alias provisional.
          </Text>
          <FadeIn index={1}>
            <Card>
              <View>
                <XPBar ratio={estado.xpSiguiente > 0 ? estado.xpEnNivel / estado.xpSiguiente : 1} height={5} />
                <View style={styles.xpMeta}>
                  <Text style={styles.xpText}>
                    {estado.xpSiguiente > 0
                      ? `${estado.xpEnNivel} / ${estado.xpSiguiente} XP para el nivel ${estado.nivel + 1}`
                      : 'Nivel máximo alcanzado'}
                  </Text>
                  <Text style={[styles.xpMult, streakDays >= 7 && styles.xpMultOn]}>{multiplicador(streakDays)} XP</Text>
                </View>
              </View>
              <Text style={styles.streakMsg}>{streakMsg}</Text>
              <SystemButton
                title="Compartir mi progreso"
                icon="share-social-outline"
                variant="outline"
                onPress={abrirCompartir}
                style={{ marginTop: 16 }}
              />
            </Card>
          </FadeIn>

          <FadeIn index={1}>
            <Section title="Camino de rangos">
              <CaminoDeRangos rango={rank} siguiente={estado.siguienteRango} />
            </Section>
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
              {referral?.claimable ? (
                <Row
                  chevron
                  leading={<Ionicons name="ticket-outline" size={18} color={colors.text} />}
                  title="Código de creador"
                  detail="¿Te trajo alguien? Escribe su código"
                  onPress={abrirCodigo}
                />
              ) : null}
              {esCreador ? (
                <Row
                  chevron
                  leading={<Ionicons name="megaphone-outline" size={18} color={colors.text} />}
                  title="Panel de creador"
                  detail="Tu código, tus ventas y tus pagos"
                  onPress={() => router.push('/creador')}
                />
              ) : null}
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
              meta={`${desbloqueados}/${visibles.length}`}
              tone={desbloqueados > 0 ? 'logro' : 'default'}
            >
              <View style={styles.achGrid}>
                {visibles.map((a) => {
                  const isUnlocked = unlocked.has(a.code);
                  const equipado = !!a.title && profile.equipped_title === a.title;
                  return (
                    <Card
                      key={a.code}
                      onPress={() => onAchievementTap(a.code)}
                      style={[styles.ach, isUnlocked ? styles.achOn : styles.achOff]}
                      accessibilityLabel={`${a.name}${isUnlocked ? ', desbloqueado' : ', bloqueado'}${a.title && isUnlocked ? `. Título: ${a.title}${equipado ? ', equipado' : ''}` : ''}`}
                    >
                      <Ionicons
                        name={isUnlocked ? 'ribbon' : 'lock-closed-outline'}
                        size={18}
                        color={isUnlocked ? ink.ink10 : ink.ink6}
                      />
                      <Text style={[styles.achName, isUnlocked && styles.achNameOn]} numberOfLines={2}>
                        {a.name}
                      </Text>
                      {a.title && isUnlocked ? (
                        equipado ? <Tag tone="logro">EQUIPADO</Tag> : <Tag>TÍTULO</Tag>
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
                  <Stat value={multiplicador(profile.streak_days)} label="Multiplicador" />
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
                <Row
                  leading={<Ionicons name="phone-portrait-outline" size={20} color={vibraciones ? ink.ink9 : ink.ink6} />}
                  title="Vibraciones"
                  detail="Al completar, subir de nivel o de rango."
                  trailing={
                    <Interruptor value={vibraciones} onValueChange={cambiarVibraciones} accessibilityLabel="Vibraciones" />
                  }
                />
              </Card>
            </Section>
          </FadeIn>

          {/* Sin esto no había forma de saber si los avisos estaban vivos: fallaban
              en silencio y el gladiador se enteraba por no recibirlos. */}
          <FadeIn index={8}>
            <Section title="Avisos" tone={sinPermiso ? 'alerta' : 'default'}>
              <Card padded={false} variant={sinPermiso ? 'alerta' : 'surface'}>
                {/* El relleno va dentro: en alerta la trama hace de marco de 3 pt. */}
                <View style={styles.lista}>
                  <Row
                    first
                    leading={
                      <Ionicons
                        name={avisos?.permitido ? 'notifications-outline' : 'notifications-off-outline'}
                        size={20}
                        color={avisos === null ? ink.ink6 : ink.ink9}
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
                    chevron={sinPermiso}
                    onPress={sinPermiso ? activarAvisos : undefined}
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
                      leading={<Ionicons name="alert-circle-outline" size={20} color={ink.ink9} />}
                      title="Último error"
                      detail={avisos.error}
                      muted
                    />
                  ) : null}
                </View>
              </Card>
              {avisos?.permitido ? <Text style={styles.nota}>{avisos.programados} avisos programados.</Text> : null}
            </Section>
          </FadeIn>

          {/* Stripe solo existe fuera de la app de tienda (paywallEnabled es
              false en iOS y Android, Guideline 3.1.1): allí lo de pago es /pro. */}
          {paywallEnabled() ? (
          <FadeIn index={9}>
            <Section title="El Oráculo">
              <Card padded={false} style={styles.lista}>
                <Row
                  first
                  leading={<Ionicons name="sparkles-outline" size={20} color={ink.ink8} />}
                  title={premium ? 'Premium activo' : 'Hazte Premium'}
                  detail={
                    premium
                      ? `El Oráculo va incluido${subscription?.current_period_end ? `. Renueva el ${subscription.current_period_end.slice(0, 10)}` : ''}.`
                      : paymentsConfigured()
                        ? 'La IA (misiones desde objetivos y análisis semanal) consume API real. Con la suscripción va incluida; sin ella puedes usar tu propia key en el módulo Oráculo.'
                        : 'Pagos aún no configurados en este servidor. Puedes usar tu propia key en el módulo Oráculo.'
                  }
                  trailing={premium ? <Tag>Activo</Tag> : undefined}
                  chevron={!premium && paymentsConfigured()}
                  onPress={
                    !premium && paymentsConfigured()
                      ? () =>
                          userId &&
                          openCheckout(userId).catch((e) =>
                            avisar('Pagos no disponibles', mensajeSistema(e)),
                          )
                      : undefined
                  }
                  accessibilityLabel={!premium && paymentsConfigured() ? 'Hazte Premium' : undefined}
                />
              </Card>
            </Section>
          </FadeIn>
          ) : null}

          <FadeIn index={9}>
            <Section title="Datos y la IA">
              <Card padded={false} style={styles.lista}>
                <Row
                  first
                  leading={<Ionicons name="shield-checkmark-outline" size={20} color={colors.text} />}
                  title="Envío de datos al coach"
                  detail={consent ? lineaPerfil(consent) : 'Qué datos van al proveedor de IA y a quién.'}
                  chevron
                  onPress={tocarConsentimiento}
                  accessibilityLabel="Consentimiento para el envío de datos al proveedor de IA"
                />
              </Card>
              <Text style={styles.nota}>{`${DESCARGO_SALUD} ${LINEA_CRISIS}`}</Text>
            </Section>
          </FadeIn>

          <FadeIn index={10}>
            <HealthPrivacySection />
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
                  detail="Tu progreso queda guardado en tu cuenta."
                  chevron
                  onPress={signOut}
                  accessibilityLabel="Cerrar sesión"
                />
                <Row
                  leading={<Ionicons name="document-text-outline" size={20} color={colors.text} />}
                  title="Términos de uso"
                  chevron
                  onPress={() => Linking.openURL(LEGAL_URLS.terminos).catch(() => {})}
                  accessibilityRole="link"
                  accessibilityLabel="Términos de uso de NIVL"
                />
                <Row
                  leading={<Ionicons name="shield-checkmark-outline" size={20} color={colors.text} />}
                  title="Política de privacidad"
                  chevron
                  onPress={() => Linking.openURL(LEGAL_URLS.privacidad).catch(() => {})}
                  accessibilityRole="link"
                  accessibilityLabel="Política de privacidad de NIVL"
                />
              </Card>
              <SystemButton
                title="Eliminar cuenta"
                variant="danger"
                icon="trash-outline"
                onPress={abrirBorrar}
                style={{ marginTop: 6 }}
              />
              <Text style={styles.nota}>
                Borra para siempre tu perfil y todo tu progreso en NIVL.
              </Text>
            </Section>
          </FadeIn>

          <FadeIn index={11}>
            <Version />
          </FadeIn>
        </View>
      </Stagger>

      {consentimiento.hoja}

      <Modal visible={borrarOpen} transparent animationType="slide" onRequestClose={() => !borrando && setBorrarOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            style={styles.backdropTap}
            onPress={() => !borrando && setBorrarOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>ELIMINAR CUENTA</Text>
            <Text style={styles.sheetTitle}>Borrar para siempre</Text>
            <Text style={styles.sheetHint}>
              Se borran tu perfil, misiones, campañas, diario, datos de cuerpo y dinero, la conversación con el coach,
              tus fotos y todo tu progreso. No hay vuelta atrás.
            </Text>
            <Text style={styles.hint}>
              {/* En iOS no se nombra Google Play (guideline 2.3.10), y al revés. */}
              {Platform.OS === 'android'
                ? 'Borrar la cuenta no cancela una suscripción de NIVL Pro: cancélala en Play Store > Pagos y suscripciones > Suscripciones.'
                : Platform.OS === 'ios'
                  ? 'Borrar la cuenta no cancela una suscripción de NIVL Pro: cancélala en Ajustes > tu nombre > Suscripciones.'
                  : 'Borrar la cuenta no cancela una suscripción de NIVL Pro: cancélala en la tienda donde la contrataste.'}
            </Text>
            {avisoBorrar ? (
              <Text style={styles.avisoCodigo} accessibilityRole="alert">
                {avisoBorrar}
              </Text>
            ) : null}
            <SystemButton
              title="Eliminar para siempre"
              variant="danger"
              icon="trash-outline"
              onPress={confirmarBorrado}
              loading={borrando}
              style={{ marginTop: 22 }}
            />
            <SystemButton
              title="Cancelar"
              variant="ghost"
              onPress={() => setBorrarOpen(false)}
              disabled={borrando}
              style={{ marginTop: 6 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

      <Modal visible={codigoOpen} transparent animationType="slide" onRequestClose={() => setCodigoOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            style={styles.backdropTap}
            onPress={() => setCodigoOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>CÓDIGO DE CREADOR</Text>
            <Text style={styles.sheetTitle}>¿Quién te trajo?</Text>
            <Text style={styles.sheetHint}>
              Si te recomendó NIVL alguien del programa de creadores, escribe su código. No cambia nada para ti y solo
              se puede poner una vez.
            </Text>
            <Text style={styles.label}>Código</Text>
            <TextInput
              style={styles.codigoInput}
              value={codigo}
              onChangeText={(t) => {
                setCodigo(t);
                setAvisoCodigo(null);
              }}
              placeholder="CÓDIGO"
              placeholderTextColor={colors.textFaint}
              maxLength={CODIGO_MAX_LENGTH + 4}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={enviarCodigo}
              accessibilityLabel="Código del creador que te trajo"
            />
            {avisoCodigo ? (
              <Text style={styles.avisoCodigo} accessibilityRole="alert">
                {avisoCodigo}
              </Text>
            ) : null}
            <SystemButton
              title="Guardar código"
              onPress={enviarCodigo}
              loading={codigoBusy}
              disabled={!codigo.trim()}
              style={{ marginTop: 22 }}
            />
            <SystemButton title="Cancelar" variant="ghost" onPress={() => setCodigoOpen(false)} style={{ marginTop: 6 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 0, paddingTop: 0 },
  body: { paddingHorizontal: 20, marginTop: 14 },
  accesos: { paddingHorizontal: 16, paddingVertical: 2 },

  cabecera: { marginHorizontal: 20, marginTop: 16, marginBottom: 0 },
  cabeceraDentro: { alignItems: 'center', gap: 16 },
  cabeceraAncha: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  retrato: { alignItems: 'center', justifyContent: 'center' },
  camara: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ink.ink0,
    borderWidth: 1,
    borderColor: ink.ink4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datos: { gap: 6 },
  datosCentro: { alignSelf: 'stretch', alignItems: 'center' },
  datosAncha: { flex: 1, minWidth: 0 },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroNameRowCentro: { justifyContent: 'center', maxWidth: '100%' },
  heroBadge: { flexShrink: 0 },
  heroNameShrink: { flexShrink: 1 },
  heroName: {
    fontFamily: fonts.heading,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: ink.ink10,
    padding: 0,
  },
  heroNameCentro: { textAlign: 'center' },
  lineaTitulo: {
    fontFamily: fonts.heading,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2,
    color: ink.ink8,
  },
  textoCentro: { textAlign: 'center' },
  cifras: { marginTop: 10 },

  xpMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 6 },
  xpText: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
  xpMult: { fontFamily: fonts.number, fontSize: 12, color: colors.textFaint },
  xpMultOn: { color: ink.ink9 },
  streakMsg: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.text, marginTop: 12 },
  profileReviewNotice: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textDim, marginBottom: 16 },

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
  statLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 1 },
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
  },
  achOn: { borderWidth: 2, borderColor: ink.ink8 },
  achOff: { borderWidth: 1, borderColor: ink.ink3 },
  achName: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, color: ink.ink6, textAlign: 'center' },
  achNameOn: { color: ink.ink9 },

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
  codigoInput: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.number,
    fontSize: 17,
    letterSpacing: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avisoCodigo: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: ink.ink9, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  enlace: { color: colors.accentText, textDecorationLine: 'underline' },
});
