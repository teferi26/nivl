// NIVL · Campañas: datos y efectos del detalle (L-RADICAL §C). Cortado de
// src/app/dungeon/[id].tsx sin reescribir: la carga, los cerrojos síncronos
// (cobrar tarea, reclamar botín, añadir), el cobro optimista y la celebración
// por la cola global (celebrar y cerrarConRango con diasActivos). Devuelve la
// vista (CampanaVista, pura) y el estado de la hoja de añadir tarea, que se
// queda en la ruta.

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCelebracion } from '@/components/celebracion/contexto';
import { avisar, volver } from '@/components/ui';
import { confirmar } from '@/components/ui/confirmar';
import { vibrar } from '@/design/haptics';
import {
  ACHIEVEMENT_BY_CODE,
  evaluateAchievements,
  fetchUnlocked,
  sincronizarRangoDetalle,
  unlockAchievements,
  type AchievementDef,
} from '@/lib/achievements';
import { useAuth } from '@/lib/auth';
import { ensureProfile } from '@/lib/data';
import { dateKey } from '@/lib/dates';
import { awardXp } from '@/lib/engine';
import {
  countClearedDungeons,
  createTask,
  deleteDungeon,
  deleteTask,
  fetchDungeon,
  fetchTasks,
  setTaskDone,
  updateDungeon,
} from '@/lib/dungeons';
import { DUNGEON_CLEAR_XP, dungeonTaskXp } from '@/lib/game';
import type { LogroInfo } from '@/lib/progression';
import type { Difficulty, Dungeon, DungeonTask } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';
import type { CampanaVistaProps } from './CampanaVista';

/** Un logro registrado, en la forma del contrato de celebraciones. */
const logroInfo = (a: AchievementDef): LogroInfo => ({ codigo: a.code, nombre: a.name, desc: a.desc, titulo: a.title });

/** Un código suelto (p. ej. `rango_C` de sync_rank) en la forma del contrato. */
const logroDeCodigo = (codigo: string): LogroInfo => {
  const def = ACHIEVEMENT_BY_CODE[codigo];
  return def ? logroInfo(def) : { codigo, nombre: codigo, desc: '' };
};

export interface HojaNuevaTarea {
  visible: boolean;
  onClose: () => void;
  taskTitle: string;
  setTaskTitle: (t: string) => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  isBoss: boolean;
  setIsBoss: (b: boolean) => void;
  adding: boolean;
  addTask: () => void;
}

export function useCampana(): { vista: CampanaVistaProps; hojas: { tarea: HojaNuevaTarea } } {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [dungeon, setDungeon] = useState<Dungeon | null>(null);
  const [tasks, setTasks] = useState<DungeonTask[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('media');
  const [isBoss, setIsBoss] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  // Cerrojos síncronos: el estado de React llega tarde a un doble toque.
  const cobrando = useRef(false);
  const anadiendo = useRef(false);
  const [adding, setAdding] = useState(false);
  // Tarea que se está cobrando: su Check muestra `busy` mientras va la red.
  const [marcando, setMarcando] = useState<string | null>(null);
  // XP, nivel, rango y logros van por la cola global de celebraciones.
  const { celebrar } = useCelebracion();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setLoaded(true);
      return;
    }
    try {
      const [d, t] = await Promise.all([fetchDungeon(id), fetchTasks(id)]);
      setDungeon(d);
      setTasks(t);
      setLoadError(null);
    } catch (e) {
      setLoadError(mensajeSistema(e));
    } finally {
      setLoaded(true);
    }
  }, [id]);

  /**
   * El rango, al final de la acción: el servidor registra el merecido y lo
   * nuevo llega a la cola como `rango_X`, cerrando la ventana. No lanza.
   */
  const cerrarConRango = (accion: string) => {
    sincronizarRangoDetalle()
      .catch(() => ({ nuevos: [] as string[], diasActivos: null }))
      .then(({ nuevos, diasActivos }) => celebrar({ accion, logrosNuevos: nuevos.map(logroDeCodigo), diasActivos, final: true }))
      .catch(() => {});
  };

  const reintentar = () => {
    setLoaded(false);
    load();
  };

  useEffect(() => {
    load();
  }, [load]);

  const addTask = async () => {
    if (!userId || !id || !taskTitle.trim() || anadiendo.current) return;
    anadiendo.current = true;
    setAdding(true);
    try {
      await createTask(userId, id, {
        title: taskTitle.trim(),
        difficulty,
        is_boss: isBoss,
        // max(position)+1 en vez de length: tras borrar una tarea del medio,
        // length colisionaba con una position ya existente.
        position: tasks.reduce((m, t) => Math.max(m, t.position), -1) + 1,
      });
      setTaskTitle('');
      setIsBoss(false);
      setFormOpen(false);
      await load();
    } catch (e) {
      avisar('El sistema no responde', mensajeSistema(e));
    } finally {
      anadiendo.current = false;
      setAdding(false);
    }
  };

  const toggleTask = async (task: DungeonTask) => {
    // Cerrojo síncrono: el doble toque duplicaba el XP de la tarea.
    if (!userId || !dungeon || busy || saving.current || dungeon.status !== 'active') return;
    if (task.done) return;
    saving.current = true;
    setBusy(true);
    setMarcando(task.id);
    // Optimista: la fila se marca al instante (y queda desactivada). Si algo
    // falla, se revierte.
    const fijarHecha = (hecha: boolean) =>
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: hecha } : t)));
    fijarHecha(true);
    let marcadaEnServidor = false;
    try {
      await setTaskDone(task.id, true);
      marcadaEnServidor = true;
      const [profile, logrosAntes] = await Promise.all([
        ensureProfile(userId),
        fetchUnlocked().catch(() => undefined),
      ]);
      const xp = dungeonTaskXp(task.difficulty, task.is_boss);
      const res = await awardXp(profile, xp, dungeon.stat, 'dungeon_task', {
        dungeon_id: dungeon.id,
        task_id: task.id,
        dungeon: dungeon.title,
        task: task.title,
        boss: task.is_boss,
      });
      vibrar(task.is_boss ? 'misionExtra' : 'mision');
      const accion = `tarea:${task.id}:${Date.now()}`;
      const pagadoTarea = Math.max(0, res.profile.xp_total - profile.xp_total);
      celebrar({
        accion,
        perfilAntes: profile,
        perfilDespues: res.profile,
        logrosAntes,
        fecha: dateKey(),
        // Con 0 por el tope diario de award_xp no se anuncia un «+0 XP».
        resumen: [pagadoTarea > 0 ? `+${pagadoTarea} XP · ${dungeon.stat}` : 'Tope diario de XP alcanzado'],
      });
      // El rango se recalcula en segundo plano: no bloquea ni rompe el cobro.
      cerrarConRango(accion);
      await load();
    } catch (e) {
      fijarHecha(false);
      // Si la tarea llegó a marcarse pero el XP no se cobró, se desmarca para
      // que se pueda volver a intentar (el premio va por task_id: no se paga
      // dos veces). Si esto también falla, la próxima carga dirá la verdad.
      if (marcadaEnServidor) setTaskDone(task.id, false).catch(() => undefined);
      avisar('El sistema no responde', mensajeSistema(e));
    } finally {
      saving.current = false;
      setMarcando(null);
      setBusy(false);
    }
  };

  const claimLoot = async () => {
    // El guard de status evita reclamar el botín dos veces (reentrada / doble
    // pantalla) y el cerrojo, tomado antes del primer await, el doble toque:
    // `busy` es estado y no llega a tiempo al segundo toque.
    if (!userId || !dungeon || busy || cobrando.current || dungeon.status !== 'active') return;
    cobrando.current = true;
    setBusy(true);
    try {
      await updateDungeon(dungeon.id, { status: 'cleared', cleared_at: new Date().toISOString() });
      const [profile, logrosAntes] = await Promise.all([
        ensureProfile(userId),
        fetchUnlocked().catch(() => undefined),
      ]);
      const loot = DUNGEON_CLEAR_XP[dungeon.rank];
      const res = await awardXp(profile, loot, dungeon.stat, 'dungeon_cleared', {
        dungeon_id: dungeon.id,
        dungeon: dungeon.title,
        rank: dungeon.rank,
      });
      // Los logros van en su propio try: el botín ya está pagado, y si fallan
      // no puede salir «El sistema no responde» (parecería que el cobro no entró).
      let fresh: AchievementDef[] = [];
      try {
        const cleared = await countClearedDungeons();
        fresh = await unlockAchievements(userId, evaluateAchievements({ dungeonsCleared: cleared }));
      } catch {
        fresh = [];
      }
      vibrar('misionExtra');
      const pagado = Math.max(0, res.profile.xp_total - profile.xp_total);
      // Una acción en la cola: «Campaña despejada» y el XP van en el resumen;
      // nivel, rango y logros los decide el contrato. El texto largo del
      // sistema ya lo pinta la tarjeta de despejada al recargar.
      const accion = `campana:${dungeon.id}:${Date.now()}`;
      celebrar({
        accion,
        perfilAntes: profile,
        perfilDespues: res.profile,
        logrosAntes,
        logrosNuevos: fresh.map(logroInfo),
        fecha: dateKey(),
        // Sin «+0 XP»: el botín puede no pagar (menos de 3 tareas, ya cobrado).
        resumen: [pagado > 0 ? `Campaña despejada · +${pagado} XP` : 'Campaña despejada'],
      });
      cerrarConRango(accion);
      await load();
    } catch (e) {
      avisar('El sistema no responde', mensajeSistema(e));
    } finally {
      cobrando.current = false;
      setBusy(false);
    }
  };

  const removeDungeon = async () => {
    if (!dungeon) return;
    const ok = await confirmar({
      titulo: 'Abandonar campaña',
      mensaje: `¿Eliminar "${dungeon.title}" y todas sus tareas?`,
      confirmar: 'Eliminar',
      destructivo: true,
    });
    if (!ok) return;
    try {
      await deleteDungeon(dungeon.id);
      // La háptica de borrado, solo si se ha borrado.
      vibrar('destructiva');
      volver(router);
    } catch (e) {
      avisar('El sistema no responde', mensajeSistema(e));
    }
  };

  const removeTask = async (t: DungeonTask) => {
    const ok = await confirmar({ titulo: 'Eliminar tarea', mensaje: t.title, confirmar: 'Eliminar', destructivo: true });
    if (!ok) return;
    try {
      await deleteTask(t.id);
      vibrar('destructiva');
      await load();
    } catch (e) {
      avisar('El sistema no responde', mensajeSistema(e));
    }
  };

  return {
    vista: {
      cargado: loaded,
      error: loadError,
      campana: dungeon,
      tareas: tasks,
      marcando,
      ocupada: busy,
      onVolver: () => volver(router),
      onReintentar: reintentar,
      onNuevaTarea: () => setFormOpen(true),
      onTarea: toggleTask,
      onBorrarTarea: removeTask,
      onReclamar: claimLoot,
      onBorrarCampana: removeDungeon,
    },
    hojas: {
      tarea: {
        visible: formOpen,
        onClose: () => setFormOpen(false),
        taskTitle,
        setTaskTitle,
        difficulty,
        setDifficulty,
        isBoss,
        setIsBoss,
        adding,
        addTask,
      },
    },
  };
}
