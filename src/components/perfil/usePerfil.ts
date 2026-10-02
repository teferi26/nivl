// NIVL · Perfil: los datos y los efectos de la pantalla (L-RADICAL §C).
//
// Cortado y pegado de src/app/(tabs)/perfil.tsx sin reescribir: subir el
// avatar, el nombre, sincronizarRangoDetalle con su celebración, avisos,
// vibraciones, consentimiento, creadores, pausa y borrar la cuenta. Devuelve
// `vista` (PerfilVista, pura), `ajustes` (PerfilAjustes) y `hojas` (las tres
// hojas que pinta la ruta: pausa, código de creador y borrar).

import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Linking, Platform } from 'react-native';
import { useCelebracion } from '@/components/celebracion/contexto';
import { useConsentimientoIA } from '@/components/ConsentimientoIA';
import { avisar, confirmar } from '@/components/ui';
import {
  ACHIEVEMENT_BY_CODE,
  ACHIEVEMENTS,
  ACHIEVEMENTS_VISIBLES,
  fetchUnlocked,
  sincronizarRangoDetalle,
  tituloVigente,
} from '@/lib/achievements';
import { useVibraciones, vibrar } from '@/design/haptics';
import { useAuth } from '@/lib/auth';
import { cerrarSesion } from '@/lib/authFlow';
import {
  completionStats,
  ensureProfile,
  fetchCompletionsForDate,
  fetchQuests,
  olvidarFirma,
  removeAvatar,
  signedUrlCached,
  updateProfile,
  uploadAvatar,
} from '@/lib/data';
import { motivoReferral } from '@/lib/creatormath';
import { claimReferral, fetchCreatorPanel, fetchMyReferral, type MyReferral } from '@/lib/creators';
import { questsScheduledOn, rachaVisible } from '@/lib/closing';
import { addDays, dateKey } from '@/lib/dates';
import { setFreeze } from '@/lib/engine';
import { exportAllData } from '@/lib/exporter';
import { deleteAccount } from '@/lib/account';
import {
  consentimientoVigente,
  fetchConsentimiento,
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
import {
  fetchSubscription,
  isPremium,
  openCheckout,
  type Subscription,
} from '@/lib/subscription';
import type { ProfileKind } from '@/lib/kinds';
import { cosmeticosDe, estadoDe, type LogroInfo } from '@/lib/progression';
import type { Profile } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';
import { voice } from '@/lib/voice';
import type { PerfilAjustesProps } from './PerfilAjustes';
import type { LogroVitrina, PerfilVistaProps } from './PerfilVista';

export const FREEZE_REASONS = ['Exámenes', 'Enfermedad', 'Vacaciones'];
export const FREEZE_DAYS = [1, 3, 7, 14];

/** Un código `rango_X` de sync_rank en la forma del contrato de celebraciones. */
const logroDeCodigo = (codigo: string): LogroInfo => {
  const def = ACHIEVEMENT_BY_CODE[codigo];
  return def ? { codigo, nombre: def.name, desc: def.desc, titulo: def.title } : { codigo, nombre: codigo, desc: '' };
};

/** De dónde suben el nivel, la barra y la racha del Hero al montarse. */
interface DesdeHero {
  nivel: number;
  xpRatio: number;
  racha: number;
}

// Lo último que enseñó el Hero de Perfil. Vive fuera del componente, como en
// useHoy: al volver a Perfil los números suben desde ahí y no desde cero.
let ultimoHero: DesdeHero | null = null;
const DESDE_CERO: DesdeHero = { nivel: 0, xpRatio: 0, racha: 0 };

export interface PerfilHojas {
  today: string;
  /** La hoja del consentimiento para la IA (la pinta la ruta). */
  consentimientoHoja: ReactNode;
  pausa: {
    abierta: boolean;
    cerrar: () => void;
    motivo: string;
    setMotivo: (m: string) => void;
    dias: number;
    setDias: (d: number) => void;
    activar: () => void;
  };
  codigo: {
    abierta: boolean;
    cerrar: () => void;
    valor: string;
    cambiar: (t: string) => void;
    aviso: string | null;
    ocupado: boolean;
    enviar: () => void;
  };
  borrar: {
    abierta: boolean;
    cerrar: () => void;
    aviso: string | null;
    borrando: boolean;
    confirmar: () => void;
  };
}

export interface UsePerfil {
  vista: Omit<PerfilVistaProps, 'ajustes'>;
  /** null mientras carga el perfil. */
  ajustes: PerfilAjustesProps | null;
  hojas: PerfilHojas;
}

export function usePerfil(): UsePerfil {
  const { session } = useAuth();
  const userId = session?.user.id;
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
  // La carga del perfil ha fallado: la vista lo dice con un reintento en vez
  // de dejar los huecos para siempre.
  const [loadError, setLoadError] = useState<string | null>(null);
  // La racha que enseña Hoy (rachaVisible): cuenta hoy si ya está cerrado.
  // null = aún no se sabe (o sin red): se enseña la de los días cerrados.
  const [rachaHoy, setRachaHoy] = useState<{ valor: number; hoyCerrado: boolean } | null>(null);
  const [desdeHero] = useState<DesdeHero>(() => ultimoHero ?? DESDE_CERO);
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
  // La misma racha que Hoy: con el día de hoy si ya está cerrado. El
  // multiplicador (Registro) sigue saliendo de los días CERRADOS.
  const rachaVista = rachaHoy?.valor ?? streakDays;
  // Memo: sin él, pick() elegiría una frase nueva en cada pulsación del nombre.
  const streakMsg = useMemo(() => voice.streakHype(rachaVista), [rachaVista]);

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
    // El perfil se pide una vez y lo usan la ficha y la celebración del rango
    // (sin él la ceremonia no sabe el «siguiente» ni la tarjeta de nivel).
    const perfilPromesa = ensureProfile(userId);
    perfilPromesa.catch(() => {});
    // Rango y días activos, en paralelo y sin bloquear: si el servidor registra
    // un rango nuevo aquí, se celebra por la cola como en cualquier pantalla.
    sincronizarRangoDetalle()
      .then(async ({ nuevos, diasActivos: dias }) => {
        setDiasActivos(dias);
        if (nuevos.length === 0) return;
        const [logros, perfil] = await Promise.all([fetchUnlocked(), perfilPromesa.catch(() => null)]);
        setUnlocked(logros);
        celebrar({
          accion: `perfil:rango:${Date.now()}`,
          perfilDespues: perfil ?? undefined,
          logrosAntes: [...logros].filter((c) => !nuevos.includes(c)),
          logrosNuevos: nuevos.map(logroDeCodigo),
          diasActivos: dias,
          final: true,
        });
      })
      .catch(() => {});
    try {
      const prof = await perfilPromesa;
      setProfile(prof);
      setName(prof.name);
      setLoadError(null);
      // La racha visible, con el mismo criterio que Hoy. Por su cuenta: si
      // falla, se queda la de los días cerrados.
      const dia = dateKey();
      Promise.all([fetchQuests(), fetchCompletionsForDate(dia)])
        .then(([quests, hechas]) => {
          const r = rachaVisible(
            prof.streak_days,
            questsScheduledOn(quests, dia),
            new Set(hechas.map((c) => c.quest_id)),
          );
          setRachaHoy({ valor: r.valor, hoyCerrado: r.hoyCerrado });
        })
        .catch(() => setRachaHoy(null));
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
      // En línea y con reintento, no en una alerta: Perfil se recarga en cada
      // foco y sin red la alerta saltaría una y otra vez.
      setLoadError(mensajeSistema(e));
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

  // Sin días activos (null), siguienteRango no sabe cuántos faltan (faltanDias = null).
  const estado = profile ? estadoDe(profile, unlocked, diasActivos ?? undefined) : null;
  const rank = estado?.rango ?? 'E';
  const titulo = (profile ? tituloVigente(profile.equipped_title) : null) ?? cosmeticosDe(rank).titulo;
  const frozen = !!profile && profile.freeze_until != null && profile.freeze_until >= today;

  // La hoja de compartir es la de la cola de celebraciones: la pausa mientras
  // está abierta y pide ella el código de amigo. La de rango lleva el retrato.
  const abrirCompartir = () => {
    compartir({ tipo: 'rango', rango: rank, titulo, rachaDias: rachaVista }, { retratoUri: avatarUri });
  };

  const logros: LogroVitrina[] = ACHIEVEMENTS_VISIBLES().map((a) => ({
    code: a.code,
    name: a.name,
    title: a.title,
    unlocked: unlocked.has(a.code),
    equipado: !!a.title && profile?.equipped_title === a.title,
  }));

  // Lo que enseña el Hero, para que la próxima visita suba desde aquí.
  const heroNivel = estado?.nivel;
  const heroRatio = estado ? (estado.xpSiguiente > 0 ? estado.xpEnNivel / estado.xpSiguiente : 1) : null;
  useEffect(() => {
    if (heroNivel == null || heroRatio == null) return;
    ultimoHero = { nivel: heroNivel, xpRatio: heroRatio, racha: rachaVista };
  }, [heroNivel, heroRatio, rachaVista]);

  const vista: UsePerfil['vista'] = {
    datos:
      profile && estado
        ? {
            profile,
            estado,
            titulo,
            elite,
            frozen,
            tieneCoach,
            codigoCreador: !!referral?.claimable,
            esCreador,
            logros,
            stats,
            rachaFrase: streakMsg,
            racha: rachaVista,
            rachaCerrada: rachaHoy?.hoyCerrado ?? false,
          }
        : null,
    error: loadError,
    desde: desdeHero,
    nombre: name,
    subiendoFoto: uploadingPhoto,
    acciones: {
      onNombre: setName,
      onGuardarNombre: saveName,
      onAvatar: pickAvatar,
      onCompartir: abrirCompartir,
      onCodigo: abrirCodigo,
      onLogro: onAchievementTap,
      onReintentar: () => {
        setLoadError(null);
        load();
      },
    },
  };

  const ajustes: PerfilAjustesProps | null = profile
    ? {
        profile,
        busy,
        frozen,
        onPerfilDeUso: cambiarPerfilDeUso,
        onPausar: () => setFreezeOpen(true),
        onReanudar: deactivateFreeze,
        vibraciones,
        onVibraciones: cambiarVibraciones,
        avisos,
        onActivarAvisos: activarAvisos,
        premium: isPremium(subscription),
        subscription,
        onCheckout: () => {
          if (userId) openCheckout(userId).catch((e) => avisar('Pagos no disponibles', mensajeSistema(e)));
        },
        consent,
        onConsentimiento: tocarConsentimiento,
        onExportar: onExport,
        onCerrarSesion: signOut,
        onBorrar: abrirBorrar,
      }
    : null;

  const hojas: PerfilHojas = {
    today,
    consentimientoHoja: consentimiento.hoja,
    pausa: {
      abierta: freezeOpen,
      cerrar: () => setFreezeOpen(false),
      motivo: freezeReason,
      setMotivo: setFreezeReason,
      dias: freezeDays,
      setDias: setFreezeDays,
      activar: activateFreeze,
    },
    codigo: {
      abierta: codigoOpen,
      cerrar: () => setCodigoOpen(false),
      valor: codigo,
      cambiar: (t) => {
        setCodigo(t);
        setAvisoCodigo(null);
      },
      aviso: avisoCodigo,
      ocupado: codigoBusy,
      enviar: enviarCodigo,
    },
    borrar: {
      abierta: borrarOpen,
      cerrar: () => setBorrarOpen(false),
      aviso: avisoBorrar,
      borrando,
      confirmar: confirmarBorrado,
    },
  };

  return { vista, ajustes, hojas };
}
