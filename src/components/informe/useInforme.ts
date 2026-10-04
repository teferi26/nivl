// NIVL · Informe: datos, efectos y cerrojos (patrón L-RADICAL §C, FASE3 Lote
// F). Cortado y pegado de la ruta sin reescribir: la consulta al Oráculo (14
// días reales, normas rotas y el XP perdido leído de los eventos), el
// consentimiento de IA antes de mandar nada, NIVL Pro por la compra
// integrada y los ajustes que se aplican con un toque. Las cuentas de la
// semana salen de derivarInforme (puro). Devuelve las props de InformeVista.
//
// Cambios de presentación (no de lógica):
//   · La carga deja huecos y su fallo va en línea con «Reintentar» (antes,
//     un Alert y la pantalla pintada con ceros como si no hubiera actividad).
//   · El silencio del Oráculo va en línea en su sección, con «Reintentar», y
//     vibra `penalizacion` (FASE3, tabla de vibraciones).

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useConsentimientoIA } from '@/components/ConsentimientoIA';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { volver } from '@/components/ui/Screen';
import { vibrar } from '@/design/haptics';
import { useAuth } from '@/lib/auth';
import { questsScheduledOn } from '@/lib/closing';
import { olvidarConsentimiento } from '@/lib/consent';
import { createQuest, ensureProfile, fetchCompletionsSince, fetchQuests, updateQuest } from '@/lib/data';
import { addDays, dateKey } from '@/lib/dates';
import { levelFromXp } from '@/lib/game';
import { askWeeklyOracle, ConsentRequiredError, PaywallError, type QuestSnapshot, type WeeklyAdvice } from '@/lib/oracle';
import { supabase } from '@/lib/supabase';
import type { Completion, Quest } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';
import { derivarInforme } from './derivarInforme';
import type { InformeVistaProps } from './InformeVista';

export function useInforme(): { vista: InformeVistaProps; hoja: ReactNode } {
  const consentimiento = useConsentimientoIA();
  const { session } = useAuth();
  const userId = session?.user.id;
  const today = dateKey();
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [advice, setAdvice] = useState<WeeklyAdvice | null>(null);
  const [consulting, setConsulting] = useState(false);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [refrescando, setRefrescando] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [errorOraculo, setErrorOraculo] = useState<string | null>(null);
  const lock = useRef(false);

  // El sistema se mejora a sí mismo: manda los datos reales de 14 días a la IA
  // y devuelve ajustes concretos que se aplican con un toque.
  const consultOracle = async () => {
    if (lock.current || !userId) return;
    lock.current = true;
    if (!(await consentimiento.asegurar())) {
      lock.current = false;
      return;
    }
    setConsulting(true);
    setErrorOraculo(null);
    try {
      const activeQuests = quests.filter((q) => q.active && !q.is_penalty);
      const from = addDays(dateKey(), -13);
      const recentCompletions = completions.filter((c) => c.date >= from);
      const doneByQuest = new Map<string, number>();
      for (const c of recentCompletions) {
        doneByQuest.set(c.quest_id, (doneByQuest.get(c.quest_id) ?? 0) + 1);
      }
      const snapshots: QuestSnapshot[] = activeQuests.map((q) => {
        let scheduled = 0;
        for (let i = 0; i < 14; i++) {
          if (questsScheduledOn([q], addDays(from, i)).length > 0) scheduled++;
        }
        return {
          id: q.id,
          title: q.title,
          difficulty: q.difficulty,
          days_of_week: q.days_of_week,
          scheduled,
          completed: doneByQuest.get(q.id) ?? 0,
        };
      });
      const { count: breaks } = await supabase
        .from('rule_breaks')
        .select('*', { count: 'exact', head: true })
        .gte('date', from);
      // El XP perdido de verdad, leído de los eventos de penalización. Antes
      // se enviaba un 0 fijo: la IA analizaba la quincena creyendo que no
      // habías perdido nada y sus ajustes salían de un dato falso.
      const { data: penaltyEvents } = await supabase
        .from('events')
        .select('payload')
        .eq('type', 'penalty')
        .gte('created_at', `${from}T00:00:00`);
      const penaltiesXp = (penaltyEvents ?? []).reduce(
        (sum: number, e: { payload: { xp?: number } | null }) => sum + (e.payload?.xp ?? 0),
        0,
      );

      const prof = await ensureProfile(userId);
      const result = await askWeeklyOracle(
        {
          quests: snapshots,
          streakDays: prof.streak_days,
          level: levelFromXp(prof.xp_total).level,
          rulesBroken: breaks ? [`${breaks} normas rotas en 14 días`] : [],
          penaltiesXp,
        },
        userId,
      );
      setAdvice(result);
      setApplied(new Set());
    } catch (e) {
      if (e instanceof PaywallError) {
        // Todo lo de pago lleva a /pro (compra integrada): nada de Stripe ni
        // de clave propia en la app de tienda (Guideline 3.1.1).
        const verPro = await confirmar({
          titulo: 'Análisis semanal',
          mensaje: 'El análisis del Oráculo es parte de NIVL Pro. El informe sigue siendo tuyo.',
          confirmar: 'Ver NIVL Pro',
          cancelar: 'Ahora no',
        });
        if (verPro) router.push('/pro');
      } else if (e instanceof ConsentRequiredError) {
        olvidarConsentimiento();
        consentimiento.pedir();
      } else {
        vibrar('penalizacion');
        setErrorOraculo(mensajeSistema(e));
      }
    } finally {
      lock.current = false;
      setConsulting(false);
    }
  };

  const applyAdjustment = async (adj: WeeklyAdvice['adjustments'][number]) => {
    try {
      if (adj.action === 'desactivar') {
        await updateQuest(adj.quest_id, { active: false, health_data: true });
      } else if (adj.new_difficulty) {
        await updateQuest(adj.quest_id, { difficulty: adj.new_difficulty, health_data: true });
      }
      setApplied((prev) => new Set(prev).add(adj.quest_id));
      await load();
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    }
  };

  const applyNewQuest = async (q: WeeklyAdvice['new_quests'][number], key: string) => {
    if (!userId) return;
    try {
      await createQuest(userId, {
        health_data: true,
        title: q.title,
        stat: q.stat,
        difficulty: q.difficulty,
        days_of_week: q.days_of_week,
        requires_evidence: false,
      });
      setApplied((prev) => new Set(prev).add(key));
      await load();
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    }
  };

  const load = useCallback(async () => {
    try {
      const from = addDays(dateKey(), -91);
      const [cs, qs] = await Promise.all([fetchCompletionsSince(from), fetchQuests()]);
      setCompletions(cs);
      setQuests(qs);
      setErrorCarga(null);
      setLoaded(true);
    } catch (e) {
      setErrorCarga(mensajeSistema(e));
    }
  }, []);

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

  return {
    vista: {
      cargado: loaded,
      errorCarga,
      hoy: today,
      datos: derivarInforme(completions, quests, today),
      advice,
      aplicados: applied,
      consultando: consulting,
      errorOraculo,
      refrescando,
      acciones: {
        onVolver: () => volver(router),
        onRefrescar: refrescar,
        onReintentar: () => {
          load();
        },
        onConsultar: consultOracle,
        onAplicar: applyAdjustment,
        onCrear: applyNewQuest,
      },
    },
    hoja: consentimiento.hoja,
  };
}
