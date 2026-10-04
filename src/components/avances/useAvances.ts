// NIVL · Avances: datos, efectos y cerrojos (patrón L-RADICAL §C, FASE3 Lote
// F). Cortado y pegado de la ruta sin reescribir la lógica del XP (bloque B,
// src/lib/pagoActo.ts): pesarse marca la misión enlazada y el módulo solo
// cobra el resto; corregir el peso de hoy no paga; se anuncia lo PAGADO (al
// pesarse y al reclamar una meta) y solo vibra si entró algo. Devuelve las
// props de AvancesVista y de las dos hojas.
//
// Cambios de presentación (no de lógica):
//   · Lo que entró al pesarse o al reclamar una meta se anuncia con un Toast
//     en el `overlay` de la pantalla (y al lector, con el desglose entero).
//     El Alert queda solo para explicar por qué no entró nada.
//   · Los fallos de dato (peso fuera de rango, meta incompleta, valor manual)
//     van en línea, en su campo o en su hoja, con el mismo texto de antes.
//   · La carga deja huecos y su fallo va en línea con «Reintentar».
//   · Borrar una meta vibra `destructiva` tras confirmar; el fallo de una
//     acción principal vibra `penalizacion` (FASE3, tabla de vibraciones).

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useHealthConsent } from '@/components/ConsentimientoSalud';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { volver } from '@/components/ui/Screen';
import { vibrar } from '@/design/haptics';
import { useAuth } from '@/lib/auth';
import { ensureProfile } from '@/lib/data';
import { dateKey } from '@/lib/dates';
import { awardXp } from '@/lib/engine';
import { GOAL_ACHIEVED_XP, goalProgress, WEIGH_IN_XP } from '@/lib/game';
import { propagarActo, restoDelModulo } from '@/lib/links';
import { anuncioActo, xpPagado } from '@/lib/pagoActo';
import {
  createGoal,
  currentGoalValue,
  deleteGoal,
  fetchExerciseSeries,
  fetchGoals,
  fetchPersonalRecords,
  fetchWeights,
  updateGoal,
  upsertWeight,
} from '@/lib/progress';
import type { BodyMetric, Goal, GoalMetric } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';
import type { AvancesVistaProps, MetaVista, ToastAvances } from './AvancesVista';
import type { HojaMetaProps, HojaValorProps } from './HojasAvances';

export interface UseAvances {
  vista: Omit<AvancesVistaProps, 'avisoSalud' | 'fotos'>;
  hojaMeta: HojaMetaProps;
  hojaValor: HojaValorProps;
}

export function useAvances(): UseAvances {
  const health = useHealthConsent();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [weights, setWeights] = useState<BodyMetric[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [prs, setPrs] = useState<{ exercise: string; weight: number }[]>([]);
  const [series, setSeries] = useState<{ exercise: string; values: number[] } | null>(null);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [gTitle, setGTitle] = useState('');
  const [gMetric, setGMetric] = useState<GoalMetric>('libre');
  const [gExercise, setGExercise] = useState('');
  const [gStart, setGStart] = useState('');
  const [gTarget, setGTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const lock = useRef(false);

  // Presentación: huecos hasta la primera carga buena, fallos en línea y el
  // aviso de lo pagado en un Toast.
  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [errorPeso, setErrorPeso] = useState<string | null>(null);
  const [errorMeta, setErrorMeta] = useState<string | null>(null);
  const [guardandoMeta, setGuardandoMeta] = useState(false);
  const [errorValor, setErrorValor] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastAvances | null>(null);

  const load = useCallback(async () => {
    try {
      const [ws, gs, records] = await Promise.all([
        health.accepted ? fetchWeights(180) : Promise.resolve([]),
        fetchGoals(),
        health.accepted ? fetchPersonalRecords() : Promise.resolve([]),
      ]);
      setWeights(ws);
      setGoals(gs);
      setPrs(records);
      setErrorCarga(null);
      setCargado(true);
    } catch (e) {
      setErrorCarga(mensajeSistema(e));
    }
  }, [health.accepted]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refrescar = async () => {
    setRefrescando(true);
    await load();
    setRefrescando(false);
  };

  // Ya se ha pesado hoy: volver a pesar corrige el dato, no vuelve a pagar.
  const pesadoHoy = weights.some((w) => w.date === dateKey());

  const saveWeight = async () => {
    if (!health.accepted) { health.ask(); return; }
    if (!userId || lock.current) return;
    const value = parseFloat(weightInput.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 20 || value >= 400) {
      setErrorPeso('Introduce tu peso en kg, p. ej. 78,4');
      return;
    }
    setErrorPeso(null);
    lock.current = true;
    setBusy(true);
    try {
      const { isNew } = await upsertWeight(userId, dateKey(), value);
      let mensaje = 'El sistema corrige el pesaje de hoy. Ya estaba cobrado.';
      // Lo que entró de verdad (misión enlazada incluida): solo eso vibra.
      // Corregir el peso de hoy no paga nada y no vibra.
      let entrado = 0;
      if (isNew) {
        // Un solo gesto: pesarse marca sola la misión de pesarse. Si la había,
        // paga ella y el módulo no vuelve a cobrar.
        const profile = await ensureProfile(userId);
        const eco = await propagarActo(profile, 'peso', dateKey());
        const resto = restoDelModulo(WEIGH_IN_XP, eco);
        let pagado = 0;
        if (resto > 0) {
          const res = await awardXp(eco.profile, resto, 'VIT', 'weigh_in', { weight: value });
          pagado = xpPagado(resto, eco.profile.xp_total, res.profile.xp_total);
        }
        entrado = eco.xp + pagado;
        // Lo que entró de verdad: la misión marcada ahora y el resto del módulo.
        mensaje =
          anuncioActo({ xpMision: eco.xp, marcadas: eco.marcadas, xpModulo: pagado, deModulo: 'a VIT por el pesaje' }) ||
          (resto > 0
            ? 'Anotado. Hoy ya has llegado al tope diario de XP.'
            : 'Anotado. La misión de hoy ya estaba marcada y pagada.');
      }
      if (entrado > 0) vibrar('mision');
      setWeightInput('');
      await load();
      // Si entró XP, lo dice el Toast (al lector, el desglose entero); el
      // Alert queda para explicar por qué no entró nada.
      if (entrado > 0) setToast({ texto: `Pesaje · +${entrado} XP`, anuncio: `Pesaje registrado. ${mensaje}` });
      else avisar('Pesaje registrado', mensaje);
    } catch (e) {
      vibrar('penalizacion');
      avisar('El sistema no responde', mensajeSistema(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const addGoal = async () => {
    if (gMetric !== 'libre' && !health.accepted) { health.ask(); return; }
    if (!userId || lock.current) return;
    const start = parseFloat(gStart.replace(',', '.'));
    const target = parseFloat(gTarget.replace(',', '.'));
    if (!gTitle.trim() || !Number.isFinite(start) || !Number.isFinite(target) || start === target) {
      setErrorMeta('Meta incompleta: título, valor inicial y valor objetivo (distintos).');
      return;
    }
    if (gMetric === 'ejercicio' && !gExercise.trim()) {
      setErrorMeta('Falta el ejercicio: escribe el nombre EXACTO del ejercicio del gym.');
      return;
    }
    setErrorMeta(null);
    lock.current = true;
    setGuardandoMeta(true);
    try {
      await createGoal(userId, {
        title: gTitle.trim(),
        metric_type: gMetric,
        exercise_name: gMetric === 'ejercicio' ? gExercise.trim() : null,
        start_value: start,
        target_value: target,
        unit: 'kg',
      });
      setGTitle('');
      setGStart('');
      setGTarget('');
      setGoalFormOpen(false);
      await load();
    } catch (e) {
      // Con la hoja abierta: el fallo va dentro de ella, con lo escrito intacto.
      vibrar('penalizacion');
      setErrorMeta(mensajeSistema(e));
    } finally {
      lock.current = false;
      setGuardandoMeta(false);
    }
  };

  const achieveGoal = async (goal: Goal) => {
    if (lock.current) return;
    const ok = await confirmar({
      titulo: 'META CONSEGUIDA',
      mensaje: `«${goal.title}»: hasta +${GOAL_ACHIEVED_XP} XP si hoy no has llegado al tope de metas.`,
      confirmar: 'Reclamar',
      cancelar: 'Aún no',
    });
    if (!ok || !userId || lock.current) return;
    lock.current = true;
    try {
      await updateGoal(goal.id, { status: 'achieved', achieved_at: new Date().toISOString() });
      const profile = await ensureProfile(userId);
      const res = await awardXp(profile, GOAL_ACHIEVED_XP, 'AGI', 'goal_achieved', { goal_id: goal.id, goal: goal.title });
      // Lo PAGADO: una meta ya cobrada (el servidor paga una vez por meta) o el
      // tope diario dejan la cifra por debajo de lo prometido.
      const pagado = xpPagado(GOAL_ACHIEVED_XP, profile.xp_total, res.profile.xp_total);
      if (pagado > 0) vibrar('mision');
      await load();
      if (pagado > 0) {
        setToast({ texto: `Meta conseguida · +${pagado} XP`, anuncio: `Meta conseguida. «${goal.title}»: +${pagado} XP a AGI.` });
      } else {
        avisar(
          'Meta conseguida',
          `«${goal.title}» queda como lograda. Este premio no suma hoy: ya estaba cobrado o has llegado al tope diario.`,
        );
      }
    } catch (e) {
      vibrar('penalizacion');
      avisar('El sistema no responde', mensajeSistema(e));
    } finally {
      lock.current = false;
    }
  };

  const removeGoal = async (goal: Goal) => {
    const ok = await confirmar({ titulo: 'Eliminar meta', mensaje: goal.title, confirmar: 'Eliminar', destructivo: true });
    if (!ok) return;
    vibrar('destructiva');
    try {
      await deleteGoal(goal.id);
      await load();
    } catch (e) {
      avisar('El sistema no responde', mensajeSistema(e));
    }
  };

  const [freeGoal, setFreeGoal] = useState<Goal | null>(null);
  const [freeValue, setFreeValue] = useState('');
  const [guardandoValor, setGuardandoValor] = useState(false);

  const saveFreeGoal = async () => {
    if (!freeGoal || lock.current) return;
    const v = parseFloat(freeValue.replace(',', '.'));
    if (!Number.isFinite(v)) {
      setErrorValor('Valor inválido: introduce un número.');
      return;
    }
    setErrorValor(null);
    lock.current = true;
    setGuardandoValor(true);
    try {
      await updateGoal(freeGoal.id, { current_value: v });
      setFreeGoal(null);
      setFreeValue('');
      await load();
    } catch (e) {
      // Con la hoja abierta: el fallo va dentro de ella, con lo escrito intacto.
      vibrar('penalizacion');
      setErrorValor(mensajeSistema(e));
    } finally {
      lock.current = false;
      setGuardandoValor(false);
    }
  };

  const showSeries = async (exercise: string) => {
    try {
      const s = await fetchExerciseSeries(exercise);
      setSeries({ exercise, values: s.map((p) => p.weight) });
    } catch (e) {
      avisar('El sistema no responde', mensajeSistema(e));
    }
  };

  // Lo que antes calculaba la pantalla al pintar cada meta.
  const latestWeight = weights.length > 0 ? weights[weights.length - 1]!.weight_kg : null;
  const metas: MetaVista[] = goals
    .filter((g) => g.status === 'active')
    .map((g) => {
      const actual = currentGoalValue(g, latestWeight, prs);
      return { goal: g, actual, progreso: actual === null ? 0 : goalProgress(g.start_value, g.target_value, actual) };
    });
  const logradas = goals.filter((g) => g.status === 'achieved');

  const abrirMeta = () => {
    setErrorMeta(null);
    setGoalFormOpen(true);
  };

  return {
    vista: {
      cargado,
      errorCarga,
      saludAceptada: health.accepted,
      weights,
      metas,
      logradas,
      prs,
      series,
      pesadoHoy,
      peso: weightInput,
      errorPeso,
      pesando: busy,
      refrescando,
      toast,
      acciones: {
        onVolver: () => volver(router),
        onRefrescar: refrescar,
        onReintentar: () => {
          load();
        },
        onPeso: (v: string) => {
          setWeightInput(v);
          if (errorPeso) setErrorPeso(null);
        },
        onPesar: saveWeight,
        onNuevaMeta: abrirMeta,
        onReclamar: achieveGoal,
        onActualizar: (g: Goal) => {
          setErrorValor(null);
          setFreeGoal(g);
          setFreeValue(String(g.current_value ?? g.start_value));
        },
        onBorrar: removeGoal,
        onSerie: showSeries,
        onToastHecho: () => setToast(null),
      },
    },
    hojaMeta: {
      visible: goalFormOpen,
      saludAceptada: health.accepted,
      titulo: gTitle,
      metrica: gMetric,
      ejercicio: gExercise,
      inicio: gStart,
      objetivo: gTarget,
      guardando: guardandoMeta,
      error: errorMeta,
      onTitulo: setGTitle,
      onMetrica: setGMetric,
      onEjercicio: setGExercise,
      onInicio: setGStart,
      onObjetivo: setGTarget,
      onGuardar: addGoal,
      onCerrar: () => {
        setErrorMeta(null);
        setGoalFormOpen(false);
      },
    },
    hojaValor: {
      meta: freeGoal,
      valor: freeValue,
      error: errorValor,
      guardando: guardandoValor,
      onValor: (v: string) => {
        setFreeValue(v);
        if (errorValor) setErrorValor(null);
      },
      onGuardar: saveFreeGoal,
      onCerrar: () => {
        if (!lock.current) setFreeGoal(null);
      },
    },
  };
}
