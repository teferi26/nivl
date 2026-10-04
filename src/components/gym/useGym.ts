// NIVL · Gimnasio: datos, efectos y cerrojos (patrón L-RADICAL §C, FASE3
// Lote E1). Cortado y pegado de la ruta sin reescribir la lógica: la carga en
// paralelo, las series, `finishTraining` con su cerrojo `saving`, el pago del
// módulo descontando la misión enlazada, los récords, la guarda `subeNivel`,
// `celebrar()` y la foto del entreno. Devuelve las props de GymVista y de las
// dos hojas.
//
// Cambios de presentación (no de lógica): la carga deja huecos y su fallo va
// en línea con «Reintentar»; crear un día o guardar un ejercicio falla en
// línea dentro de su hoja (antes no se capturaba) y el borrado confirmado
// vibra `destructiva`.

import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { useCelebracion } from '@/components/celebracion/contexto';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { volver } from '@/components/ui/Screen';
import { vibrar } from '@/design/haptics';
import {
  ACHIEVEMENT_BY_CODE,
  evaluateAchievements,
  fetchUnlocked,
  sincronizarRangoDetalle,
  unlockAchievements,
} from '@/lib/achievements';
import { useAuth } from '@/lib/auth';
import {
  createGymDay,
  createGymExercise,
  createSession,
  deleteGymDay,
  deleteGymExercise,
  fetchGymDays,
  fetchGymExercises,
  fetchMaxLifts,
  fetchSessionForDate,
  insertLifts,
  updateGymExercise,
} from '@/lib/body';
import { fetchPrescription, type Prescription } from '@/lib/bodywork';
import { ensureProfile, fetchCompletionsForDate, fetchQuests, insertEvent } from '@/lib/data';
import { dateKey, isoWeekday } from '@/lib/dates';
import { awardXp } from '@/lib/engine';
import { GYM_SESSION_XP, levelFromXp, PR_XP } from '@/lib/game';
import { propagarActo, restoDelModulo } from '@/lib/links';
import { subirFotoMision } from '@/lib/photos';
import type { LogroInfo } from '@/lib/progression';
import { supabase } from '@/lib/supabase';
import type { GymDay, GymExercise, GymSession } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';
import type { GymVistaProps } from './GymVista';
import type { HojaDiaProps, HojaEjercicioProps } from './HojasGym';
import type { LiftInput, SerieInput } from './SesionEnCurso';

/** Un código suelto (p. ej. `rango_C` de sync_rank) en la forma del contrato. */
const logroDeCodigo = (codigo: string): LogroInfo => {
  const def = ACHIEVEMENT_BY_CODE[codigo];
  return def ? { codigo: def.code, nombre: def.name, desc: def.desc, titulo: def.title } : { codigo, nombre: codigo, desc: '' };
};
// Pedido por el Chat 5 (economía): con el tope diario de award_xp, pagar más
// récords se recortaría en silencio. En la primera sesión todo es récord.
const MAX_PR_PAGADOS = 4;

export interface UseGym {
  vista: GymVistaProps;
  hojaDia: HojaDiaProps;
  hojaEjercicio: HojaEjercicioProps;
}

export function useGym(): UseGym {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [days, setDays] = useState<GymDay[]>([]);
  const [exercises, setExercises] = useState<GymExercise[]>([]);
  const [todaySession, setTodaySession] = useState<GymSession | null>(null);
  const [training, setTraining] = useState(false);
  const [lifts, setLifts] = useState<LiftInput[]>([]);
  const [dayFormOpen, setDayFormOpen] = useState(false);
  const [prescrito, setPrescrito] = useState<Prescription[]>([]);
  const [newDayOfWeek, setNewDayOfWeek] = useState(1);
  const [newDayName, setNewDayName] = useState('');
  const [exFormDay, setExFormDay] = useState<GymDay | null>(null);
  // Cuando no es null, el formulario edita en vez de crear.
  const [exEditando, setExEditando] = useState<GymExercise | null>(null);
  const [notas, setNotas] = useState('');
  const [fotoB64, setFotoB64] = useState<string | null>(null);
  const [exName, setExName] = useState('');
  const [exSets, setExSets] = useState('3');
  const [exReps, setExReps] = useState('10');
  const [exWeight, setExWeight] = useState('');
  const { celebrar } = useCelebracion();
  const [busy, setBusy] = useState(false);
  // XP que han pagado hoy las misiones enlazadas al gimnasio. La sesión guarda
  // solo lo que paga el módulo (el resto hasta su base y los récords): sin
  // sumar esto, la tarjeta decía +25 mientras la misión enseñaba +50.
  const [xpMisionHoy, setXpMisionHoy] = useState(0);
  const saving = useRef(false);

  // Presentación: huecos hasta la primera carga buena, el fallo de carga en
  // línea y los de las hojas dentro de su hoja.
  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardandoHoja, setGuardandoHoja] = useState(false);
  const [errorHoja, setErrorHoja] = useState<string | null>(null);
  // El día de la hoja de ejercicio sigue puesto mientras la hoja sale.
  const ultimoDiaHoja = useRef<GymDay | null>(null);
  if (exFormDay) ultimoDiaHoja.current = exFormDay;

  const today = dateKey();
  const todayWd = isoWeekday(new Date());

  const load = useCallback(async () => {
    try {
      const hoy = dateKey();
      // En paralelo: eran cuatro viajes en serie al abrir la pantalla.
      const [d, ex, sesion, presc, quests, hechas] = await Promise.all([
        fetchGymDays(),
        fetchGymExercises(),
        fetchSessionForDate(hoy),
        fetchPrescription(hoy).catch(() => []),
        fetchQuests().catch(() => []),
        fetchCompletionsForDate(hoy).catch(() => []),
      ]);
      const deGym = new Set(quests.filter((q) => q.link === 'gym').map((q) => q.id));
      setDays(d);
      setExercises(ex);
      setTodaySession(sesion);
      setPrescrito(presc);
      setXpMisionHoy(hechas.filter((c) => deGym.has(c.quest_id)).reduce((s, c) => s + c.xp_awarded, 0));
      setErrorCarga(null);
      setCargado(true);
    } catch (e) {
      setErrorCarga(mensajeSistema(e));
    }
  }, []);

  // Era la única pantalla con useEffect: no se refrescaba al volver de entrenar.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const todayPlan = days.find((d) => d.day_of_week === todayWd);
  const exercisesFor = (dayId: string) => exercises.filter((e) => e.gym_day_id === dayId);

  const cambiarSerie = (iEj: number, iSerie: number, campo: keyof SerieInput, valor: string) =>
    setLifts((prev) =>
      prev.map((l, j) =>
        j !== iEj
          ? l
          : { ...l, series: l.series.map((s, k) => (k === iSerie ? { ...s, [campo]: valor } : s)) },
      ),
    );

  /** Copia la última serie: lo normal es repetir y tocar un solo número. */
  const anadirSerie = (iEj: number) =>
    setLifts((prev) =>
      prev.map((l, j) => {
        if (j !== iEj) return l;
        const ultima = l.series[l.series.length - 1] ?? { weight: '', reps: '', rpe: '' };
        return { ...l, series: [...l.series, { ...ultima, rpe: '' }] };
      }),
    );

  const quitarSerie = (iEj: number, iSerie: number) =>
    setLifts((prev) =>
      prev.map((l, j) =>
        // Nunca por debajo de una: un ejercicio sin series no es un ejercicio.
        j !== iEj || l.series.length === 1
          ? l
          : { ...l, series: l.series.filter((_, k) => k !== iSerie) },
      ),
    );

  const startTraining = () => {
    if (!todayPlan) return;
    setLifts(
      exercisesFor(todayPlan.id).map((e) => ({
        exercise: e.name,
        // Tantas filas como series diga la rutina, ya rellenas con el peso y
        // las reps de referencia: lo normal es tocar solo lo que cambie.
        series: Array.from({ length: Math.max(1, e.sets) }, () => ({
          weight: e.weight !== null ? String(e.weight) : '',
          reps: String(e.reps),
          rpe: '',
        })),
      })),
    );
    setTraining(true);
  };

  const finishTraining = async () => {
    // Cerrojo síncrono: el doble toque chocaba con unique(user_id,date) (23505)
    // dejando una sesión fantasma. busy solo no bloquea de forma síncrona.
    if (!userId || busy || saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      const valid = lifts
        .flatMap((l) =>
          l.series.map((serie, idx) => ({
            exercise_name: l.exercise,
            weight: parseFloat(serie.weight.replace(',', '.')) || 0,
            reps: parseInt(serie.reps, 10) || 0,
            rpe: serie.rpe.trim() ? parseFloat(serie.rpe.replace(',', '.')) : null,
            set_index: idx,
          })),
        )
        .filter((l) => l.reps > 0 || l.weight > 0);

      const previousMax = await fetchMaxLifts();
      // El récord es por EJERCICIO, no por serie: con series de peso creciente,
      // contar cada una daría tres PR del mismo movimiento en una sesión.
      const mejorPorEjercicio = new Map<string, (typeof valid)[number]>();
      for (const l of valid) {
        const previo = mejorPorEjercicio.get(l.exercise_name);
        if (!previo || l.weight > previo.weight) mejorPorEjercicio.set(l.exercise_name, l);
      }
      const prs = [...mejorPorEjercicio.values()].filter(
        (l) => l.weight > 0 && l.weight > (previousMax[l.exercise_name] ?? 0),
      );

      // Primero se guarda el acto. xp_awarded se corrige abajo, cuando se sabe
      // cuánto ha pagado ya la misión enlazada.
      const gymSession = await createSession(userId, {
        date: today,
        gym_day_id: todayPlan?.id ?? null,
        xp_awarded: GYM_SESSION_XP + Math.min(prs.length, MAX_PR_PAGADOS) * PR_XP,
        notes: notas.trim() || null,
      });

      // La foto del entreno entra en quest_photos: así la ve el coach y así
      // aparece en el resumen del domingo. Si falla, la sesión no se cae: ya
      // está registrada y perderla por una foto sería absurdo.
      if (fotoB64) {
        await subirFotoMision(userId, {
          base64: fotoB64,
          questId: null,
          completionId: null,
          date: today,
          caption: `Entreno ${todayPlan?.name ?? 'libre'}${notas.trim() ? `: ${notas.trim()}` : ''}`,
        }).catch(() => {});
      }
      await insertLifts(userId, gymSession.id, valid);

      // Un solo gesto: con la sesión ya guardada, se marcan solas la misión, la
      // regla y el bloque del plan que la pedían. El módulo paga solo lo que la
      // misión no haya pagado ya (más los récords): el mismo entreno no cobra
      // dos veces.
      // Lo de antes de la acción, para la cola de celebraciones: perfil y logros.
      const perfilAntes = await ensureProfile(userId);
      const logrosAntes = await fetchUnlocked().catch(() => new Set<string>());
      const eco = await propagarActo(perfilAntes, 'gym', today);
      // Récords pagados: como mucho MAX_PR_PAGADOS (50 + 4×25 = 150, el tope
      // diario). Los récords se registran todos; lo que se limita es el pago.
      const prsPagados = Math.min(prs.length, MAX_PR_PAGADOS);
      const totalXp = restoDelModulo(GYM_SESSION_XP, eco) + prsPagados * PR_XP;

      const res =
        totalXp > 0
          ? await awardXp(eco.profile, totalXp, 'FUE', 'gym_session', {
              day: todayPlan?.name ?? 'libre',
              prs: prs.map((p) => p.exercise_name),
            })
          : { profile: eco.profile, leveledUp: false, newLevel: 0 };
      // Lo PAGADO, no lo calculado: si el servidor recorta por tope, la sesión
      // y el aviso dicen lo que de verdad ha entrado.
      const pagado = Math.max(0, Math.min(totalXp, res.profile.xp_total - eco.profile.xp_total));
      if (pagado !== gymSession.xp_awarded) {
        await supabase.from('gym_sessions').update({ xp_awarded: pagado }).eq('id', gymSession.id);
      }
      for (const pr of prs) {
        await insertEvent(userId, 'gym_pr', { exercise: pr.exercise_name, weight: pr.weight });
      }

      const { count: prCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'gym_pr');
      const fresh = await unlockAchievements(userId, evaluateAchievements({ prCount: prCount ?? 0 }));

      // Nada de Alert aquí: en iOS, con un UIAlertController abierto el Modal
      // de la ceremonia no se presenta y la cola se queda bloqueada. El
      // resumen va corto (cabe en un toast): el XP total y los récords. El
      // desglose (misión enlazada, sesión, récords) ya lo pinta la ficha de
      // la sesión al recargar.
      const xpTotal = eco.xp + pagado;
      const lineaXp =
        xpTotal > 0
          ? `+${xpTotal} XP · FUE`
          : totalXp > 0
            ? 'Tope diario de XP alcanzado'
            : 'Sesión registrada · la misión de hoy ya estaba pagada';
      const resumen = [lineaXp, ...prs.map((p) => `Récord · ${p.exercise_name}`)];
      // El nivel vibra en su ceremonia; el rango, si llega del servidor, en la
      // suya. Sin nivel nuevo, misión cumplida.
      const subeNivel = levelFromXp(res.profile.xp_total).level > levelFromXp(perfilAntes.xp_total).level;
      if (!subeNivel) vibrar('mision');
      // Nivel, rango, logros y rachas: una sola celebración por la cola. La
      // ventana la cierra el rango que devuelve el servidor (sync_rank).
      const accion = `gym:${gymSession.id}`;
      celebrar({
        accion,
        perfilAntes,
        perfilDespues: res.profile,
        logrosAntes,
        logrosNuevos: fresh.map((a) => ({ codigo: a.code, nombre: a.name, desc: a.desc, titulo: a.title })),
        fecha: dateKey(),
        resumen,
      });
      sincronizarRangoDetalle()
        .catch(() => ({ nuevos: [] as string[], diasActivos: null }))
        .then(({ nuevos, diasActivos }) => celebrar({ accion, logrosNuevos: nuevos.map(logroDeCodigo), diasActivos, final: true }))
        .catch(() => {});
      setTraining(false);
      setNotas('');
      setFotoB64(null);
      await load();
    } catch (e) {
      vibrar('penalizacion');
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const abrirDia = () => {
    setErrorHoja(null);
    setDayFormOpen(true);
  };

  const cerrarDia = () => {
    setErrorHoja(null);
    setDayFormOpen(false);
  };

  const addDay = async () => {
    if (!userId || !newDayName.trim() || guardandoHoja) return;
    setGuardandoHoja(true);
    setErrorHoja(null);
    try {
      await createGymDay(userId, newDayOfWeek, newDayName.trim());
    } catch (e) {
      // En línea, dentro de la hoja: lo escrito sigue ahí para reintentar.
      setErrorHoja(mensajeSistema(e));
      vibrar('penalizacion');
      return;
    } finally {
      setGuardandoHoja(false);
    }
    setNewDayName('');
    setDayFormOpen(false);
    await load();
  };

  const abrirEjercicio = (dia: GymDay, ejercicio: GymExercise | null) => {
    setErrorHoja(null);
    setExEditando(ejercicio);
    setExName(ejercicio?.name ?? '');
    setExSets(String(ejercicio?.sets ?? 3));
    setExReps(String(ejercicio?.reps ?? 10));
    setExWeight(ejercicio?.weight !== null && ejercicio !== null ? String(ejercicio.weight) : '');
    setExFormDay(dia);
  };

  const guardarEjercicio = async () => {
    if (!userId || !exFormDay || !exName.trim() || guardandoHoja) return;
    const datos = {
      name: exName.trim(),
      sets: parseInt(exSets, 10) || 3,
      reps: parseInt(exReps, 10) || 10,
      weight: exWeight ? parseFloat(exWeight.replace(',', '.')) : null,
    };
    setGuardandoHoja(true);
    setErrorHoja(null);
    try {
      if (exEditando) {
        await updateGymExercise(exEditando.id, datos);
      } else {
        await createGymExercise(userId, exFormDay.id, {
          ...datos,
          position: exercisesFor(exFormDay.id).length,
        });
      }
    } catch (e) {
      setErrorHoja(mensajeSistema(e));
      vibrar('penalizacion');
      return;
    } finally {
      setGuardandoHoja(false);
    }
    setExName('');
    setExWeight('');
    setExEditando(null);
    setExFormDay(null);
    await load();
  };

  const fotoSesion = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      const mensaje = 'El sistema necesita la cámara para el registro del entreno.';
      if (Platform.OS === 'web') {
        avisar('Sin cámara', mensaje);
      } else if (await confirmar({ titulo: 'Sin cámara', mensaje, confirmar: 'Abrir ajustes' })) {
        Linking.openSettings().catch(() => {});
      }
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.4, base64: true });
    if (r.canceled) return;
    setFotoB64(r.assets[0]?.base64 ?? null);
    vibrar('seleccion');
  };

  const confirmarBorrarDia = async (d: GymDay) => {
    const ok = await confirmar({
      titulo: 'Eliminar día',
      mensaje: `¿Eliminar ${d.name} y sus ejercicios?`,
      confirmar: 'Eliminar',
      destructivo: true,
    });
    if (!ok) return;
    vibrar('destructiva');
    try {
      await deleteGymDay(d.id);
    } catch (err) {
      avisar('Error del sistema', mensajeSistema(err));
      return;
    }
    await load();
  };

  const confirmarBorrarEjercicio = async (e: GymExercise) => {
    const ok = await confirmar({ titulo: 'Eliminar ejercicio', mensaje: e.name, confirmar: 'Eliminar', destructivo: true });
    if (!ok) return;
    vibrar('destructiva');
    try {
      await deleteGymExercise(e.id);
    } catch (err) {
      avisar('Error del sistema', mensajeSistema(err));
      return;
    }
    await load();
  };

  const cerrarFormEjercicio = () => {
    setErrorHoja(null);
    setExEditando(null);
    setExFormDay(null);
  };

  return {
    vista: {
      cargado,
      errorCarga,
      hoyDia: todayWd,
      dias: days,
      ejercicios: exercises,
      sesionHoy: todaySession,
      xpMisionHoy,
      prescrito,
      entrenando: training,
      series: lifts,
      notas,
      fotoLista: fotoB64 !== null,
      ocupado: busy,
      acciones: {
        onVolver: () => volver(router),
        onReintentar: () => {
          load();
        },
        onNuevoDia: abrirDia,
        onEntrenar: startTraining,
        onTerminar: finishTraining,
        onCambiarSerie: cambiarSerie,
        onAnadirSerie: anadirSerie,
        onQuitarSerie: quitarSerie,
        onNotas: setNotas,
        onFoto: fotoSesion,
        onNuevoEjercicio: (dia) => abrirEjercicio(dia, null),
        onEditarEjercicio: abrirEjercicio,
        onBorrarDia: confirmarBorrarDia,
        onBorrarEjercicio: confirmarBorrarEjercicio,
      },
    },
    hojaDia: {
      visible: dayFormOpen,
      diaSemana: newDayOfWeek,
      nombre: newDayName,
      guardando: guardandoHoja,
      error: dayFormOpen ? errorHoja : null,
      onDiaSemana: setNewDayOfWeek,
      onNombre: setNewDayName,
      onGuardar: addDay,
      onCerrar: cerrarDia,
    },
    hojaEjercicio: {
      visible: exFormDay !== null,
      dia: exFormDay ?? ultimoDiaHoja.current,
      editando: exEditando,
      nombre: exName,
      series: exSets,
      reps: exReps,
      kg: exWeight,
      guardando: guardandoHoja,
      error: exFormDay !== null ? errorHoja : null,
      onNombre: setExName,
      onSeries: setExSets,
      onReps: setExReps,
      onKg: setExWeight,
      onGuardar: guardarEjercicio,
      onCerrar: cerrarFormEjercicio,
    },
  };
}
