import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LineaDeTiempo, type ItemAgenda } from '@/components/LineaDeTiempo';
import { SystemButton } from '@/components/SystemButton';
import {
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
  Stagger,
  Tag,
} from '@/components/ui';
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
import { cargaDelDia } from '@/lib/timeline';
import { colors, fonts } from '@/lib/theme';
import type { CalendarEvent, DungeonTask, Quest } from '@/lib/types';

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

export default function Agenda() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const today = dateKey();

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
  const rangeRef = useRef<{ from: string; to: string } | null>(null);

  const load = useCallback(async (center: string) => {
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
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(anchor);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

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
      Alert.alert('Fecha inválida', 'Usa el formato AAAA-MM-DD, ej. 2026-06-15');
      return;
    }
    saving.current = true;
    try {
      await createCalendarEvent(userId, { title: title.trim(), date, time: time.trim() || null });
      setTitle('');
      setTime('');
      setFormOpen(false);
      await load(anchor);
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      saving.current = false;
    }
  };

  const removeEvent = (e: CalendarEvent) =>
    Alert.alert('Eliminar evento', e.title, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteCalendarEvent(e.id).catch(() => {});
          await load(anchor);
        },
      },
    ]);

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
            subtitle={subtitulo}
            action={{ icon: 'add', label: 'Nuevo evento', onPress: abrirFormulario, solid: true }}
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
                      accessibilityLabel={nombreDia(day)}
                    >
                      <Text style={[styles.cellNum, esHoy && styles.cellNumToday, sel && styles.cellNumSel]}>
                        {Number(day.slice(8))}
                      </Text>
                      <View style={styles.dots}>
                        {c.dayEvents.length ? <View style={[styles.dot, { backgroundColor: colors.gold }]} /> : null}
                        {c.dayTasks.length ? <View style={[styles.dot, { backgroundColor: colors.steel }]} /> : null}
                        {n === 0 && c.dayQuests.length ? (
                          <View style={[styles.dot, { backgroundColor: colors.accentDim }]} />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </FadeIn>
        ) : null}

        {vacioTotal ? (
          <FadeIn index={3}>
            <Card variant="outline">
              <EmptyState
                icon="calendar-outline"
                title={anchor >= today ? 'Nada programado' : 'Un día en blanco'}
                body={
                  anchor >= today
                    ? 'Pídele al coach que planifique el día o añade un evento. Las misiones programadas aparecen aquí.'
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
                <Section title="Eventos" meta={`${eventosOrdenados.length}`} tone="gold">
                  <Card padded={false} style={styles.lista}>
                    {eventosOrdenados.map((e, i) => {
                      const min = horaAMinutos(e.time);
                      const hora = min === null ? 'Todo el día' : hhmm(min);
                      return (
                        <Row
                          key={e.id}
                          first={i === 0}
                          leading={<Ionicons name="calendar-outline" size={18} color={colors.gold} />}
                          title={e.title}
                          detail={e.notes ?? undefined}
                          trailing={
                            <RowValue tone="gold" strong>
                              {hora}
                            </RowValue>
                          }
                          onPress={() => removeEvent(e)}
                          accessibilityLabel={`${e.title}, ${min === null ? 'todo el día' : `a las ${hora}`}. Toca para eliminarlo.`}
                        />
                      );
                    })}
                  </Card>
                  <Text style={styles.nota}>Toca un evento para eliminarlo.</Text>
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
                          ? 'Pídele al coach que planifique el día, o añade un evento con hora.'
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
                      if (e) removeEvent(e);
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
                        leading={<Ionicons name="flag-outline" size={18} color={colors.steel} />}
                        title={t.title}
                        detail={t.is_boss ? 'Jefe final de campaña. Vence ese día.' : 'Tarea de campaña. Vence ese día.'}
                        trailing={t.is_boss ? <Tag tone="steel">Jefe</Tag> : <RowValue tone="steel">Plazo</RowValue>}
                      />
                    ))}
                    {dayQuests.map((q, i) => {
                      const hecha = doneSet.has(q.id);
                      return (
                        <Row
                          key={q.id}
                          first={dayTasks.length === 0 && i === 0}
                          leading={<Check checked={hecha} size={24} tone={q.is_penalty ? 'red' : 'accent'} />}
                          title={q.title}
                          done={hecha}
                          detail={`Misión · ${q.stat}`}
                          trailing={q.is_penalty && !hecha ? <Tag tone="red">Penalización</Tag> : undefined}
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

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            style={styles.backdropTap}
            onPress={() => setFormOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>NUEVO EVENTO</Text>
            <Text style={styles.sheetTitle}>¿Qué hay que recordar?</Text>
            <Text style={styles.label}>Nombre</Text>
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
            <SystemButton title="Añadir evento" onPress={addEvent} disabled={!title.trim()} style={{ marginTop: 22 }} />
            <SystemButton title="Cancelar" variant="ghost" onPress={() => setFormOpen(false)} style={{ marginTop: 6 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  diaSemanaLetra: { fontFamily: fonts.heading, fontSize: 10, letterSpacing: 1, color: colors.textFaint },
  diaSemanaLetraSel: { color: colors.accentText },
  diaSemanaNum: { fontFamily: fonts.number, fontSize: 15, color: colors.text, marginTop: 3 },
  diaSemanaNumSel: { color: colors.accent },
  diaHoy: { color: colors.gold },
  cargaPista: { width: 16, height: 18, backgroundColor: colors.track, marginTop: 6, justifyContent: 'flex-end' },
  cargaRelleno: { backgroundColor: colors.accentDim, width: '100%' },

  mes: { marginBottom: 22 },
  gridHeader: { flexDirection: 'row' },
  gridHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.heading,
    fontSize: 10.5,
    letterSpacing: 1,
    color: colors.textFaint,
    paddingBottom: 6,
  },
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
  cellNumToday: { color: colors.gold },
  cellNumSel: { color: colors.accent },
  dots: { flexDirection: 'row', gap: 3, marginTop: 3, height: 5 },
  dot: { width: 4, height: 4, borderRadius: 2 },

  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 2 },

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
  sheetEyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.gold },
  sheetTitle: {
    fontFamily: fonts.heading,
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.text,
    marginTop: 6,
    marginBottom: 4,
  },
  label: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 8, lineHeight: 17 },
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
