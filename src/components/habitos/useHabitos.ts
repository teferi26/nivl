// NIVL · Hábitos: datos, efectos y cerrojos (L-RADICAL §C). Cortado y pegado
// de la ruta sin reescribir la lógica; lo que se deriva (rachas, reparto,
// resumen) sale de derivarHabitos. Devuelve las props de HabitosVista y las
// de la hoja de crear y editar (QuestForm, que se queda en la ruta).

import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { avisar, useAlVolver } from '@/components/ui';
import { confirmar } from '@/components/ui/confirmar';
import { vibrar } from '@/design/haptics';
import { sincronizarRango } from '@/lib/achievements';
import { useAuth } from '@/lib/auth';
import { createQuest, deleteQuest, ensureProfile, updateQuest, type QuestInput } from '@/lib/data';
import { dateKey } from '@/lib/dates';
import { awardXp } from '@/lib/engine';
import { desmarcarRegla, fetchRuleChecks, fetchRules, marcarReglaCumplida } from '@/lib/contract';
import { HABIT_ACQUIRED_XP } from '@/lib/game';
import { xpPagado } from '@/lib/pagoActo';
import {
  consolidarHabito,
  fetchHabitos,
  fetchFechasPorHabito,
  reactivarHabito,
} from '@/lib/habitdata';
import type { ProgresoHabito } from '@/lib/habits';
import type { Quest, Rule } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';
import { clasificarHabitos } from './derivarHabitos';
import type { HabitosVistaProps } from './HabitosVista';

export interface HojaHabito {
  visible: boolean;
  initial: Quest | null;
  onClose: () => void;
  onSubmit: (input: QuestInput) => Promise<void>;
  onDelete: (q: Quest) => Promise<void>;
}

export function useHabitos(): { vista: HabitosVistaProps; hoja: HojaHabito } {
  const { session } = useAuth();
  const userId = session?.user.id;
  // El día es estado y lo fija cada carga: si la app vuelve de segundo plano
  // tras la medianoche, las reglas y las rachas pasan a contar el día nuevo.
  const [hoy, setHoy] = useState(() => dateKey());
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const consolidando = useRef(false);

  const [enCurso, setEnCurso] = useState<Quest[]>([]);
  const [adquiridos, setAdquiridos] = useState<Quest[]>([]);
  const [progresos, setProgresos] = useState<Map<string, ProgresoHabito>>(new Map());
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Quest | null>(null);
  const [busy, setBusy] = useState(false);
  const [reglas, setReglas] = useState<Rule[]>([]);
  const [cumplidas, setCumplidas] = useState<Set<string>>(new Set());
  // Copia síncrona de `cumplidas`: alternarRegla decide con ella si la regla
  // estaba marcada, no con el `cumplidas` de la clausura del render en que se
  // tocó (que puede ser viejo si llega un `cargar` entre medias).
  const cumplidasRef = useRef<Set<string>>(new Set());
  // Reglas con una escritura en vuelo: un segundo toque sobre la misma regla
  // antes de que vuelva la red se ignora (si no, marcar y desmarcar se cruzan).
  const reglasEnVuelo = useRef<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    const dia = dateKey();
    try {
      // Las cuatro consultas son independientes: van a la vez.
      const [todos, fechas, rs, checks] = await Promise.all([
        fetchHabitos(),
        fetchFechasPorHabito(),
        fetchRules(),
        fetchRuleChecks(dia),
      ]);
      const c = clasificarHabitos(todos, fechas, dia);
      setHoy(dia);
      setProgresos(c.progresos);
      setEnCurso(c.enCurso);
      setAdquiridos(c.adquiridos);
      setReglas(rs);
      cumplidasRef.current = checks;
      setCumplidas(checks);
      setLoadError(null);
    } catch (e) {
      setLoadError(mensajeSistema(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );
  useAlVolver(cargar);

  /**
   * Marcar una regla del contrato como cumplida hoy.
   *
   * Es optimista a propósito: son seis toques seguidos cada noche y esperar a
   * la red en cada uno haría que se sintiera rota. Si falla, se revierte.
   */
  const fijarRegla = (id: string, marcada: boolean) => {
    // Idempotente (añade o quita, no alterna) y en forma funcional: no depende
    // del estado que viera el render que lo llamó.
    const aplicar = (prev: Set<string>) => {
      if (prev.has(id) === marcada) return prev;
      const s = new Set(prev);
      if (marcada) s.add(id);
      else s.delete(id);
      return s;
    };
    cumplidasRef.current = aplicar(cumplidasRef.current);
    setCumplidas(aplicar);
  };

  const alternarRegla = async (r: Rule) => {
    if (!userId || reglasEnVuelo.current.has(r.id)) return;
    reglasEnVuelo.current.add(r.id);
    const estaba = cumplidasRef.current.has(r.id);
    fijarRegla(r.id, !estaba);
    try {
      if (estaba) await desmarcarRegla(r.id, hoy);
      else await marcarReglaCumplida(userId, r.id, hoy);
      if (!estaba) vibrar('seleccion');
    } catch (e) {
      fijarRegla(r.id, estaba);
      avisar('El sistema no responde', mensajeSistema(e));
    } finally {
      reglasEnVuelo.current.delete(r.id);
    }
  };

  const consolidar = async (q: Quest, p: ProgresoHabito) => {
    const ok = await confirmar({
      titulo: 'HÁBITO ADQUIRIDO',
      mensaje: `${q.title} lleva ${p.racha} días seguidos.\n\nSi lo das por adquirido, deja de pedirte el toque diario y deja de poder romperte la racha. Puedes seguir marcándolo cuando quieras.\n\nSi prefieres seguir contando, no pasa nada: sigue sumando.`,
      confirmar: 'Darlo por adquirido',
      cancelar: 'Seguir contando',
    });
    // Cerrojo síncrono además de `busy`: el XP del hábito adquirido se paga una vez.
    if (!ok || !userId || busy || consolidando.current) return;
    consolidando.current = true;
    setBusy(true);
    try {
      await consolidarHabito(q.id, p.racha);
      const perfil = await ensureProfile(userId);
      const res = await awardXp(perfil, HABIT_ACQUIRED_XP, q.stat, 'habit_acquired', {
        // quest_id: clave del premio de una sola vez (lista blanca del servidor).
        quest_id: q.id,
        quest: q.title,
        dias: p.racha,
      });
      // El rango se recalcula en segundo plano: no bloquea ni rompe el cobro.
      sincronizarRango().catch(() => []);
      // Lo PAGADO, acotado al premio: otro XP que entre a la vez no se cuenta.
      const pagado = xpPagado(HABIT_ACQUIRED_XP, perfil.xp_total, res.profile.xp_total);
      vibrar('rachaHito');
      await cargar();
      // Sin pago puede ser premio ya cobrado (una vez por misión) o el tope
      // diario de hábitos adquiridos: el cliente no distingue cuál, así que no
      // afirma ninguno de los dos.
      avisar(
        'El sistema lo da por tuyo',
        `${q.title} ya no se te va a pedir.\n${
          pagado > 0
            ? `+${pagado} XP a ${q.stat}.`
            : 'Este premio no suma hoy: ya estaba cobrado o has llegado al tope diario.'
        }`,
      );
    } catch (e) {
      avisar('El sistema no responde', mensajeSistema(e));
    } finally {
      consolidando.current = false;
      setBusy(false);
    }
  };

  const reactivar = async (q: Quest) => {
    const ok = await confirmar({
      titulo: 'Volver a exigirlo',
      mensaje: `${q.title} vuelve a pedirse cada día y vuelve a contar para la racha.`,
      confirmar: 'Volver a exigirlo',
    });
    if (!ok) return;
    try {
      await reactivarHabito(q.id);
    } catch (e) {
      avisar('El sistema no responde', mensajeSistema(e));
    }
    await cargar();
  };

  const vista: HabitosVistaProps = {
    estado: loaded ? 'listo' : 'cargando',
    error: loadError,
    enCurso,
    adquiridos,
    progresos,
    reglas,
    cumplidas,
    ocupado: busy,
    acciones: {
      onNuevo: () => setFormOpen(true),
      onEditar: (q) => {
        setEditando(q);
        setFormOpen(true);
      },
      onConsolidar: consolidar,
      onReactivar: reactivar,
      onAlternarRegla: alternarRegla,
      onReintentar: cargar,
    },
  };

  const hoja: HojaHabito = {
    visible: formOpen,
    initial: editando,
    onClose: () => {
      setFormOpen(false);
      setEditando(null);
    },
    onSubmit: async (input) => {
      if (editando) await updateQuest(editando.id, input);
      else if (userId) await createQuest(userId, input);
      setFormOpen(false);
      setEditando(null);
      await cargar();
    },
    onDelete: async (q) => {
      await deleteQuest(q.id);
      setFormOpen(false);
      setEditando(null);
      await cargar();
    },
  };

  return { vista, hoja };
}
