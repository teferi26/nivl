// NIVL · Agenda: datos, efectos y cerrojos (L-RADICAL §C, FASE3 Lote C).
// Cortado y pegado de la ruta sin reescribir la lógica. Devuelve las props de
// AgendaVista (pura) y las de las dos hojas (nuevo evento y detalle), que se
// quedan en la ruta.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { avisar, useAlVolver } from '@/components/ui';
import { confirmar } from '@/components/ui/confirmar';
import { vibrar } from '@/design/haptics';
import { useNavActual } from '@/design/useSizeClass';
import { useAuth } from '@/lib/auth';
import { fetchCompletionsForDate, fetchQuests } from '@/lib/data';
import { fetchPlan, type PlanConBloques } from '@/lib/dayplan';
import { addDays, dateKey, isValidKey } from '@/lib/dates';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  fetchPendingTasksWithDue,
} from '@/lib/dungeons';
import { fetchAiStatus, isPro } from '@/lib/pro';
import type { CalendarEvent, DungeonTask, Quest } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';
import type { AgendaVistaProps, ViewMode } from './AgendaVista';
import type { HojaDetalleProps, HojaEventoProps } from './HojasAgenda';

export function useAgenda(): { vista: AgendaVistaProps; hojaEvento: HojaEventoProps; hojaDetalle: HojaDetalleProps } {
  const { session } = useAuth();
  const userId = session?.user.id;
  const today = dateKey();
  const router = useRouter();
  // Con la barra inferior la Agenda no tiene pestaña: es un destino secundario
  // de Hoy (navItems.ts), así que lleva su flecha de vuelta. En el raíl y la
  // barra lateral es un destino más y no la necesita. Se mira la navegación
  // que hay de verdad (ancho de la ventana), no la clase del hueco: entre 600
  // y 671 el hueco es compact pero se pinta el raíl.
  const enBarraInferior = useNavActual() === 'tabs';

  const [view, setView] = useState<ViewMode>('dia');
  const [anchor, setAnchor] = useState(today);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [dueTasks, setDueTasks] = useState<DungeonTask[]>([]);
  const [doneToday, setDoneToday] = useState<Set<string>>(new Set());
  const [doneOnAnchor, setDoneOnAnchor] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState<PlanConBloques | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('');
  const saving = useRef(false);
  // Espejo del cerrojo para el botón: el ref no repinta.
  const [guardando, setGuardando] = useState(false);
  // Evento de la hoja de detalle. Se queda puesto al cerrarla para que el
  // título no se vacíe durante la animación de salida.
  const [detalle, setDetalle] = useState<CalendarEvent | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const borrando = useRef(false);
  const [eliminando, setEliminando] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Solo con coach se sugiere "pídele al coach": sin Pro esa puerta no existe.
  // null mientras no se sabe (no se sugiere nada).
  const [esPro, setEsPro] = useState<boolean | null>(null);
  const rangeRef = useRef<{ from: string; to: string } | null>(null);

  const load = useCallback(async (center: string) => {
    // Accesorio: si la cuenta tiene coach. Nunca bloquea ni tumba la agenda.
    fetchAiStatus()
      .then((s) => setEsPro(isPro(s)))
      .catch(() => {});
    try {
      const from = addDays(center, -45);
      const to = addDays(center, 75);
      rangeRef.current = { from, to };
      const [qs, evs, tasks, done] = await Promise.all([
        fetchQuests(),
        fetchCalendarEvents(from, to),
        fetchPendingTasksWithDue(),
        fetchCompletionsForDate(dateKey()),
      ]);
      setQuests(qs);
      setEvents(evs);
      setDueTasks(tasks);
      setDoneToday(new Set(done.map((c) => c.quest_id)));
      setLoadError(null);
    } catch (e) {
      setLoadError(mensajeSistema(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(anchor);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );
  // Quien miraba "hoy" sigue mirando hoy al volver al día siguiente; quien
  // había navegado a otro día, se queda en él.
  const hoyVisto = useRef(today);
  useAlVolver(() => {
    const hoy = dateKey();
    const seguiaEnHoy = anchor === hoyVisto.current;
    hoyVisto.current = hoy;
    if (seguiaEnHoy && hoy !== anchor) setAnchor(hoy);
    load(seguiaEnHoy ? hoy : anchor);
  });

  useEffect(() => {
    const r = rangeRef.current;
    if (r && (anchor < addDays(r.from, 7) || anchor > addDays(r.to, -7))) {
      load(anchor);
    }
  }, [anchor, load]);

  // El plan por horas del día seleccionado. Es lo que el coach escribe cada
  // mañana y hasta ahora la agenda ni lo miraba, que era el mayor absurdo:
  // la app tenía el día planificado hora a hora y el calendario no lo pintaba.
  useEffect(() => {
    let cancelado = false;
    fetchPlan(anchor)
      .then((p) => {
        if (!cancelado) setPlan(p);
      })
      .catch(() => {
        if (!cancelado) setPlan(null);
      });
    return () => {
      cancelado = true;
    };
  }, [anchor]);

  useEffect(() => {
    if (anchor === today) {
      setDoneOnAnchor(doneToday);
      return;
    }
    let cancelado = false;
    fetchCompletionsForDate(anchor)
      .then((done) => {
        if (!cancelado) setDoneOnAnchor(new Set(done.map((c) => c.quest_id)));
      })
      .catch(() => {
        if (!cancelado) setDoneOnAnchor(new Set());
      });
    return () => {
      cancelado = true;
    };
  }, [anchor, today, doneToday]);

  const addEvent = async () => {
    if (!userId || !title.trim() || saving.current) return;
    if (!isValidKey(date)) {
      avisar('Fecha inválida', 'Usa el formato AAAA-MM-DD, ej. 2026-06-15');
      return;
    }
    saving.current = true;
    setGuardando(true);
    try {
      await createCalendarEvent(userId, { title: title.trim(), date, time: time.trim() || null });
      setTitle('');
      setTime('');
      setFormOpen(false);
      await load(anchor);
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      saving.current = false;
      setGuardando(false);
    }
  };

  /**
   * Tocar un evento abre su detalle; borrar se hace desde ahí, con «Eliminar»
   * y su confirmación. Antes el toque borraba (tras confirmar) y no había forma
   * de ver la nota ni la hora completa.
   */
  const abrirDetalle = (e: CalendarEvent) => {
    setDetalle(e);
    setDetalleAbierto(true);
  };

  const removeEvent = async (e: CalendarEvent) => {
    if (borrando.current) return;
    const ok = await confirmar({ titulo: 'Eliminar evento', mensaje: e.title, confirmar: 'Eliminar', destructivo: true });
    if (!ok || borrando.current) return;
    borrando.current = true;
    setEliminando(true);
    try {
      await deleteCalendarEvent(e.id);
      // La háptica de borrado, solo si se ha borrado de verdad.
      vibrar('destructiva');
      setDetalleAbierto(false);
      await load(anchor);
    } catch (err) {
      avisar('Error del sistema', mensajeSistema(err));
    } finally {
      borrando.current = false;
      setEliminando(false);
    }
  };

  const abrirFormulario = () => {
    setDate(anchor);
    setFormOpen(true);
  };

  const vista: AgendaVistaProps = {
    estado: loaded ? 'listo' : 'cargando',
    error: loadError,
    hoy: today,
    dia: anchor,
    modo: view,
    quests,
    events,
    dueTasks,
    hechas: anchor === today ? doneToday : doneOnAnchor,
    plan,
    esPro,
    onVolver: enBarraInferior ? () => router.navigate('/(tabs)') : undefined,
    acciones: {
      onModo: setView,
      onDia: setAnchor,
      onNuevo: abrirFormulario,
      onDetalle: abrirDetalle,
      onReintentar: () => load(anchor),
    },
  };

  const hojaEvento: HojaEventoProps = {
    visible: formOpen,
    hoy: today,
    dia: anchor,
    titulo: title,
    fecha: date,
    hora: time,
    guardando,
    onTitulo: setTitle,
    onFecha: setDate,
    onHora: setTime,
    onGuardar: addEvent,
    onCerrar: () => setFormOpen(false),
  };

  const hojaDetalle: HojaDetalleProps = {
    visible: detalleAbierto,
    evento: detalle,
    eliminando,
    onEliminar: () => {
      if (detalle) removeEvent(detalle);
    },
    onCerrar: () => setDetalleAbierto(false),
  };

  return { vista, hojaEvento, hojaDetalle };
}
