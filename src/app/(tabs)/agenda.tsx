import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LineaDeTiempo, type ItemAgenda } from '@/components/LineaDeTiempo';
import {
  avisar,
  Button,
  Card,
  Check,
  Chip,
  ChipWrap,
  EmptyState,
  FadeIn,
  Row,
  RowValue,
  Screen,
  ScreenHeader,
  Section,
  Sheet,
  Skeleton,
  SkeletonRows,
  Stagger,
  Tag,
  useAlVolver,
} from '@/components/ui';
import { confirmar } from '@/components/ui/confirmar';
import { vibrar } from '@/design/haptics';
import { ink, stroke } from '@/design/tokens';
import { useNavActual } from '@/design/useSizeClass';
import { useAuth } from '@/lib/auth';
import { questsScheduledOn } from '@/lib/closing';
import { fetchCompletionsForDate, fetchQuests } from '@/lib/data';
import { fetchPlan, type PlanConBloques } from '@/lib/dayplan';
import { addDays, dateKey, isValidKey, nombreDia, relativoDe, weekdayOfKey } from '@/lib/dates';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  fetchPendingTasksWithDue,
} from '@/lib/dungeons';
import { hhmm, horaAMinutos, KIND_ICON, minutosAhora } from '@/lib/plan';
import { fetchAiStatus, isPro } from '@/lib/pro';
import { cargaDelDia } from '@/lib/timeline';
import { colors, fonts } from '@/lib/theme';
import type { CalendarEvent, DungeonTask, Quest } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';

type ViewMode = 'dia' | 'semana' | 'mes';

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
];

const DAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${y}`;
}

/** El título grande de la cabecera: "Hoy", "Mañana", "Ayer" o "Jueves 24". */
function tituloDelDia(key: string, today: string): string {
  if (key === today) return 'Hoy';
  if (key === addDays(today, 1)) return 'Mañana';
  if (key === addDays(today, -1)) return 'Ayer';
  const diaSemana = nombreDia(key).split(',')[0] ?? '';
  return `${diaSemana} ${Number(key.slice(8))}`;
}

function weekStartOf(key: string): string {
  return addDays(key, -(weekdayOfKey(key) - 1));
}

/** "14 – 20 de septiembre", o con los dos meses si la semana cruza de uno a otro. */
function rangoSemana(start: string): string {
  const end = addDays(start, 6);
  const m1 = Number(start.slice(5, 7));
  const m2 = Number(end.slice(5, 7));
  const d1 = Number(start.slice(8));
  const d2 = Number(end.slice(8));
  if (m1 === m2) return `${d1} – ${d2} de ${MONTH_NAMES[m1 - 1]}`;
  return `${d1} de ${MONTH_NAMES[m1 - 1]} – ${d2} de ${MONTH_NAMES[m2 - 1]}`;
}

function monthGrid(anchor: string): (string | null)[] {
  const [y, m] = anchor.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const daysInMonth = new Date(y!, m!, 0).getDate();
  const lead = weekdayOfKey(first) - 1;
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function addMonths(anchor: string, n: number): string {
  const [y, m] = anchor.split('-').map(Number);
  return dateKey(new Date(y!, m! - 1 + n, 1));
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Lo que dice en voz alta una celda del mes: el día y sus recuentos. */
function etiquetaCelda(day: string, eventos: number, plazos: number, misiones: number): string {
  const partes = [nombreDia(day)];
  if (eventos) partes.push(plural(eventos, 'evento', 'eventos'));
  if (plazos) partes.push(plural(plazos, 'plazo de campaña', 'plazos de campaña'));
  if (misiones) partes.push(plural(misiones, 'misión', 'misiones'));
  return partes.join(', ');
}

export default function Agenda() {
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

  const contentFor = useCallback(
    (day: string) => ({
      dayQuests: questsScheduledOn(quests, day).filter((q) => !q.is_penalty || day === today),
      dayEvents: events.filter((e) => e.date === day),
      dayTasks: dueTasks.filter((t) => t.due_date === day),
    }),
    [quests, events, dueTasks, today],
  );

  /**
   * Lo que va sobre el eje de horas: los bloques del plan y los eventos con
   * hora. Lo que no tiene hora (misiones del día, deadlines de campaña) va a
   * su propia lista, como el "todo el día" de cualquier calendario: meterlo
   * en el eje obligaría a inventarle una hora que no tiene.
   */
  const itemsConHora = useMemo((): ItemAgenda[] => {
    const items: ItemAgenda[] = [];
    for (const b of plan?.bloques ?? []) {
      items.push({
        id: `b-${b.id}`,
        inicio: b.start_min,
        fin: b.end_min,
        titulo: b.title,
        detalle: b.detail,
        tipo: 'bloque',
        hecho: b.done,
        icono: KIND_ICON[b.kind],
      });
    }
    for (const e of contentFor(anchor).dayEvents) {
      const min = horaAMinutos(e.time);
      if (min === null) continue;
      items.push({
        id: `e-${e.id}`,
        inicio: min,
        fin: min + 45,
        titulo: e.title,
        detalle: e.notes,
        tipo: 'evento',
      });
    }
    return items;
  }, [plan, contentFor, anchor]);

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

  const semana = Array.from({ length: 7 }, (_, i) => addDays(weekStartOf(anchor), i));
  const { dayQuests, dayEvents, dayTasks } = contentFor(anchor);
  const doneSet = anchor === today ? doneToday : doneOnAnchor;
  const bloques = plan?.bloques.length ?? 0;
  const misionesHechas = dayQuests.filter((q) => doneSet.has(q.id)).length;

  // Los eventos con hora primero y en orden; los de todo el día, al final.
  const eventosOrdenados = [...dayEvents].sort(
    (a, b) =>
      (horaAMinutos(a.time) ?? Number.MAX_SAFE_INTEGER) - (horaAMinutos(b.time) ?? Number.MAX_SAFE_INTEGER),
  );

  const titulo = tituloDelDia(anchor, today);
  const partes: string[] = [];
  if (bloques) partes.push(plural(bloques, 'bloque del plan', 'bloques del plan'));
  if (dayEvents.length) partes.push(plural(dayEvents.length, 'evento', 'eventos'));
  if (dayTasks.length) partes.push(plural(dayTasks.length, 'plazo', 'plazos'));
  if (dayQuests.length) partes.push(plural(dayQuests.length, 'misión', 'misiones'));
  const relativo =
    titulo === 'Hoy' || titulo === 'Mañana' || titulo === 'Ayer' ? null : relativoDe(anchor, today);
  const vacioTotal = partes.length === 0;
  const subtitulo = vacioTotal
    ? anchor >= today
      ? 'Nada programado todavía.'
      : 'Ese día no quedó nada registrado.'
    : `${relativo ? `${relativo} · ` : ''}${partes.join(' · ')}`;

  const navLabel =
    view === 'mes' ? monthLabel(anchor) : view === 'semana' ? rangoSemana(weekStartOf(anchor)) : nombreDia(anchor);
  const unidad = view === 'mes' ? 'Mes' : view === 'semana' ? 'Semana' : 'Día';
  const irAnterior = () =>
    setAnchor(view === 'mes' ? addMonths(anchor, -1) : addDays(anchor, view === 'semana' ? -7 : -1));
  const irSiguiente = () =>
    setAnchor(view === 'mes' ? addMonths(anchor, 1) : addDays(anchor, view === 'semana' ? 7 : 1));

  return (
    <Screen>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            eyebrow={monthLabel(anchor)}
            title={titulo}
            subtitle={loaded && !loadError ? subtitulo : undefined}
            action={{ icon: 'add', label: 'Nuevo evento', onPress: abrirFormulario, solid: true }}
            onBack={enBarraInferior ? () => router.navigate('/(tabs)') : undefined}
          />
        </FadeIn>

        <FadeIn index={1}>
          <View style={styles.selector}>
            <ChipWrap>
              {VIEWS.map((v) => (
                <Chip
                  key={v.id}
                  small
                  label={v.label}
                  selected={view === v.id}
                  onPress={() => setView(v.id)}
                  accessibilityLabel={`Vista por ${v.label.toLowerCase()}`}
                />
              ))}
            </ChipWrap>
            {anchor !== today ? (
              <Chip
                small
                icon="today-outline"
                label="Hoy"
                onPress={() => setAnchor(today)}
                accessibilityLabel="Volver a hoy"
              />
            ) : null}
          </View>
          <View style={styles.nav}>
            <Pressable
              onPress={irAnterior}
              hitSlop={8}
              style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${unidad} anterior`}
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.navLabel} numberOfLines={1}>
              {navLabel}
            </Text>
            <Pressable
              onPress={irSiguiente}
              hitSlop={8}
              style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${unidad} siguiente`}
            >
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </Pressable>
          </View>
        </FadeIn>

        {/* SEMANA y MES comparten idea: arriba se elige el día, abajo se ve ese
            día. La carga de cada día se pinta como una barra que crece hacia
            arriba: de un vistazo se ve qué día está cargado sin abrirlo. */}
        {view === 'semana' ? (
          <FadeIn index={2}>
            <View style={styles.tiraSemana}>
              {semana.map((d) => {
                const c = contentFor(d);
                const carga = cargaDelDia(
                  c.dayEvents
                    .map((e) => horaAMinutos(e.time))
                    .filter((m): m is number => m !== null)
                    .map((m) => ({ id: 'x', inicio: m, fin: m + 45 })),
                );
                const sel = d === anchor;
                const esHoy = d === today;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setAnchor(d)}
                    style={({ pressed }) => [styles.diaSemana, sel && styles.diaSemanaSel, pressed && styles.pressed]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: sel }}
                    accessibilityLabel={nombreDia(d)}
                  >
                    <Text style={[styles.diaSemanaLetra, sel && styles.diaSemanaLetraSel]}>
                      {DAY_HEADERS[weekdayOfKey(d) - 1]}
                    </Text>
                    <Text style={[styles.diaSemanaNum, esHoy && styles.diaHoy, sel && styles.diaSemanaNumSel]}>
                      {Number(d.slice(8))}
                    </Text>
                    <View style={styles.cargaPista}>
                      <View style={[styles.cargaRelleno, { height: `${Math.max(8, carga * 100)}%` }]} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </FadeIn>
        ) : null}

        {view === 'mes' ? (
          <FadeIn index={2}>
            <View style={styles.mes}>
              <View style={styles.gridHeader}>
                {DAY_HEADERS.map((d) => (
                  <Text key={d} style={styles.gridHeaderText}>
                    {d}
                  </Text>
                ))}
              </View>
              <View style={styles.grid}>
                {monthGrid(anchor).map((day, i) => {
                  if (!day) return <View key={`x-${i}`} style={styles.cell} />;
                  const c = contentFor(day);
                  const sel = day === anchor;
                  const esHoy = day === today;
                  const n = c.dayEvents.length + c.dayTasks.length;
                  return (
                    <Pressable
                      key={day}
                      onPress={() => setAnchor(day)}
                      style={({ pressed }) => [styles.cell, sel && styles.cellSelected, pressed && styles.pressed]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: sel }}
                      accessibilityLabel={etiquetaCelda(
                        day,
                        c.dayEvents.length,
                        c.dayTasks.length,
                        c.dayQuests.length,
                      )}
                    >
                      <Text style={[styles.cellNum, esHoy && styles.cellNumToday, sel && styles.cellNumSel]}>
                        {Number(day.slice(8))}
                      </Text>
                      {/* Por forma, no por color: evento = punto sólido, plazo
                          de campaña = aro hueco, solo misiones = guion. */}
                      <View style={styles.dots} accessible={false}>
                        {c.dayEvents.length ? <View style={styles.dotEvento} /> : null}
                        {c.dayTasks.length ? <View style={styles.dotPlazo} /> : null}
                        {n === 0 && c.dayQuests.length ? <View style={styles.dotMisiones} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </FadeIn>
        ) : null}

        {loaded && loadError ? (
          <Card variant="outline">
            <EmptyState
              compact
              icon="cloud-offline-outline"
              title="El sistema no responde"
              body={loadError}
              action={{ label: 'Reintentar', onPress: () => load(anchor) }}
            />
          </Card>
        ) : null}

        {!loaded ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Cargando tu agenda">
            <Skeleton height={11} width={100} style={styles.skEyebrow} />
            <SkeletonRows rows={3} />
            <Skeleton height={11} width={80} style={styles.skEyebrow} />
            <Skeleton height={160} />
          </View>
        ) : loadError ? null : vacioTotal ? (
          <FadeIn index={3}>
            <Card variant="outline">
              <EmptyState
                icon="calendar-outline"
                title={anchor >= today ? 'Nada programado' : 'Un día en blanco'}
                body={
                  anchor >= today
                    ? esPro === true
                      ? 'Pídele al coach que planifique el día o añade un evento. Las misiones programadas aparecen aquí.'
                      : 'Añade un evento. Las misiones programadas aparecen aquí.'
                    : 'El sistema no tiene nada registrado para ese día.'
                }
                action={anchor >= today ? { label: 'Añadir evento', onPress: abrirFormulario } : undefined}
              />
            </Card>
          </FadeIn>
        ) : (
          <>
            {eventosOrdenados.length > 0 ? (
              <FadeIn index={3}>
                <Section title="Eventos" meta={`${eventosOrdenados.length}`}>
                  <Card padded={false} style={styles.lista}>
                    {eventosOrdenados.map((e, i) => {
                      const min = horaAMinutos(e.time);
                      const hora = min === null ? 'Todo el día' : hhmm(min);
                      return (
                        <Row
                          key={e.id}
                          first={i === 0}
                          leading={<Ionicons name="ellipse" size={10} color={ink.ink9} />}
                          title={e.title}
                          detail={e.notes ?? undefined}
                          trailing={
                            <RowValue tone="accent" strong>
                              {hora}
                            </RowValue>
                          }
                          onPress={() => abrirDetalle(e)}
                          accessibilityLabel={`${e.title}, ${min === null ? 'todo el día' : `a las ${hora}`}. Toca para ver el detalle.`}
                        />
                      );
                    })}
                  </Card>
                  <Text style={styles.nota}>Toca un evento para ver su detalle.</Text>
                </Section>
              </FadeIn>
            ) : null}

            <FadeIn index={4}>
              <Section title="Por horas" meta={itemsConHora.length > 0 ? `${itemsConHora.length}` : undefined}>
                {itemsConHora.length === 0 ? (
                  <Card variant="outline">
                    <EmptyState
                      compact
                      icon="time-outline"
                      title="Sin nada a una hora concreta"
                      body={
                        anchor >= today
                          ? esPro === true
                            ? 'Pídele al coach que planifique el día, o añade un evento con hora.'
                            : 'Añade un evento con hora.'
                          : 'Ese día no tuvo plan por horas.'
                      }
                    />
                  </Card>
                ) : (
                  <LineaDeTiempo
                    items={itemsConHora}
                    ahoraMin={anchor === today ? minutosAhora() : null}
                    onPress={(item) => {
                      const e = contentFor(anchor).dayEvents.find((x) => `e-${x.id}` === item.id);
                      if (e) abrirDetalle(e);
                    }}
                  />
                )}
              </Section>
            </FadeIn>

            {dayTasks.length > 0 || dayQuests.length > 0 ? (
              <FadeIn index={5}>
                <Section
                  title="Misiones y plazos"
                  meta={dayQuests.length > 0 ? `${misionesHechas}/${dayQuests.length}` : `${dayTasks.length}`}
                >
                  <Card padded={false} style={styles.lista}>
                    {dayTasks.map((t, i) => (
                      <Row
                        key={t.id}
                        first={i === 0}
                        leading={<Ionicons name="ellipse-outline" size={10} color={ink.ink9} />}
                        title={t.title}
                        detail={t.is_boss ? 'Jefe final de campaña. Vence ese día.' : 'Tarea de campaña. Vence ese día.'}
                        trailing={t.is_boss ? <Tag tone="dim">Jefe</Tag> : <RowValue tone="dim">Plazo</RowValue>}
                      />
                    ))}
                    {dayQuests.map((q, i) => {
                      const hecha = doneSet.has(q.id);
                      return (
                        <Row
                          key={q.id}
                          first={dayTasks.length === 0 && i === 0}
                          leading={<Check checked={hecha} size={24} />}
                          title={q.title}
                          done={hecha}
                          detail={`Misión · ${q.stat}`}
                          trailing={q.is_penalty && !hecha ? <Tag tone="alerta">Penalización</Tag> : undefined}
                        />
                      );
                    })}
                  </Card>
                  <Text style={styles.nota}>Las misiones se completan desde Hoy.</Text>
                </Section>
              </FadeIn>
            ) : null}
          </>
        )}
      </Stagger>

      <Sheet
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        eyebrow="Nuevo evento"
        title="¿Qué hay que recordar?"
        footer={
          <>
            <Button title="Añadir evento" onPress={addEvent} loading={guardando} disabled={!title.trim()} />
            <Button title="Cancelar" variant="ghost" onPress={() => setFormOpen(false)} />
          </>
        }
      >
        <Text style={[styles.label, styles.labelPrimero]}>Nombre</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Llamada, cita, demo, examen"
          placeholderTextColor={colors.textFaint}
          accessibilityLabel="Nombre del evento"
          autoFocus
        />
        <Text style={styles.label}>Día</Text>
        <ChipWrap style={styles.chipsDia}>
          <Chip small label="Hoy" selected={date === today} onPress={() => setDate(today)} accessibilityLabel="Hoy" />
          <Chip
            small
            label="Mañana"
            selected={date === addDays(today, 1)}
            onPress={() => setDate(addDays(today, 1))}
            accessibilityLabel="Mañana"
          />
          {anchor !== today && anchor !== addDays(today, 1) ? (
            <Chip
              small
              label={tituloDelDia(anchor, today)}
              selected={date === anchor}
              onPress={() => setDate(anchor)}
              accessibilityLabel={`El día elegido, ${nombreDia(anchor)}`}
            />
          ) : null}
        </ChipWrap>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="AAAA-MM-DD"
          placeholderTextColor={colors.textFaint}
          accessibilityLabel="Fecha"
          autoCapitalize="none"
        />
        <Text style={styles.label}>Hora</Text>
        <View style={styles.inline}>
          <TextInput
            style={[styles.input, styles.inputHora]}
            value={time}
            onChangeText={setTime}
            placeholder="09:30"
            placeholderTextColor={colors.textFaint}
            accessibilityLabel="Hora"
            keyboardType="numbers-and-punctuation"
          />
          <Chip
            small
            label="Todo el día"
            selected={!time.trim()}
            onPress={() => setTime('')}
            accessibilityLabel="Sin hora, todo el día"
          />
        </View>
        <Text style={styles.hint}>
          Con hora, el evento se pinta sobre el eje del día. Sin hora, cuenta como de todo el día.
        </Text>
      </Sheet>

      <Sheet
        visible={detalleAbierto}
        onClose={() => setDetalleAbierto(false)}
        eyebrow="Evento"
        title={detalle?.title ?? ''}
        footer={
          <>
            <Button
              title="Eliminar evento"
              variant="danger"
              icon="trash-outline"
              loading={eliminando}
              onPress={() => {
                if (detalle) removeEvent(detalle);
              }}
            />
            <Button title="Cerrar" variant="ghost" onPress={() => setDetalleAbierto(false)} />
          </>
        }
      >
        {detalle ? (
          <>
            <Text style={[styles.label, styles.labelPrimero]}>Fecha</Text>
            <Text style={styles.detalleValor}>{nombreDia(detalle.date)}</Text>
            <Text style={styles.label}>Hora</Text>
            <Text style={styles.detalleValor}>
              {horaAMinutos(detalle.time) === null ? 'Todo el día' : hhmm(horaAMinutos(detalle.time) ?? 0)}
            </Text>
            {detalle.notes ? (
              <>
                <Text style={styles.label}>Nota</Text>
                <Text style={styles.detalleValor}>{detalle.notes}</Text>
              </>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 22 },
  navBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  pressed: { opacity: 0.7 },

  tiraSemana: { flexDirection: 'row', gap: 5, marginBottom: 22 },
  diaSemana: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  diaSemanaSel: { borderColor: colors.accent, backgroundColor: colors.accentFaint },
  diaSemanaLetra: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1, color: colors.textFaint },
  diaSemanaLetraSel: { color: colors.accentText },
  diaSemanaNum: { fontFamily: fonts.number, fontSize: 15, color: colors.text, marginTop: 3 },
  diaSemanaNumSel: { color: colors.accent },
  // Hoy se marca subrayando el número, no con un color.
  diaHoy: { textDecorationLine: 'underline' },
  cargaPista: { width: 16, height: 18, backgroundColor: colors.track, marginTop: 6, justifyContent: 'flex-end' },
  cargaRelleno: { backgroundColor: colors.accentDim, width: '100%' },

  mes: { marginBottom: 22 },
  gridHeader: { flexDirection: 'row' },
  gridHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textFaint,
    paddingBottom: 6,
  },
  skEyebrow: { marginBottom: 12, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1.15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: colors.line,
  },
  cellSelected: { backgroundColor: colors.accentFaint, borderColor: colors.accent },
  cellNum: { fontFamily: fonts.number, fontSize: 13, color: colors.textDim },
  cellNumToday: { textDecorationLine: 'underline', color: colors.text },
  cellNumSel: { color: colors.accent },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3, height: 5 },
  dotEvento: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: ink.ink9 },
  dotPlazo: { width: 5, height: 5, borderRadius: 2.5, borderWidth: stroke.hairline, borderColor: ink.ink9 },
  dotMisiones: { width: 6, height: 1.5, backgroundColor: ink.ink6 },

  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 2 },

  label: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  labelPrimero: { marginTop: 0 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 8, lineHeight: 17 },
  detalleValor: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.text },
  chipsDia: { marginBottom: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.accentDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputHora: { flex: 1, minWidth: 0 },
});
