import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineaDeTiempo, type ItemAgenda } from '@/components/LineaDeTiempo';
import { SystemButton } from '@/components/SystemButton';
import { SystemWindow } from '@/components/SystemWindow';
import { useAuth } from '@/lib/auth';
import { questsScheduledOn } from '@/lib/closing';
import { fetchCompletionsForDate, fetchQuests } from '@/lib/data';
import { fetchPlan, type PlanConBloques } from '@/lib/dayplan';
import { addDays, dateKey, isValidKey, nombreDia, weekdayOfKey } from '@/lib/dates';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  fetchPendingTasksWithDue,
} from '@/lib/dungeons';
import { horaAMinutos, KIND_ICON, minutosAhora } from '@/lib/plan';
import { cargaDelDia } from '@/lib/timeline';
import { colors, fonts } from '@/lib/theme';
import type { CalendarEvent, DungeonTask, Quest } from '@/lib/types';

type ViewMode = 'dia' | 'semana' | 'mes';

const DAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${y}`.toUpperCase();
}

function dayLabel(key: string, today: string): string {
  if (key === today) return 'HOY';
  if (key === addDays(today, 1)) return 'MAÑANA';
  if (key === addDays(today, -1)) return 'AYER';
  return nombreDia(key).toUpperCase();
}

function weekStartOf(key: string): string {
  return addDays(key, -(weekdayOfKey(key) - 1));
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
   * hora. Lo que no tiene hora (misiones del día, deadlines de mazmorra) va a
   * la tira de arriba, como el "todo el día" de cualquier calendario: meterlo
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

  const sinHora = useMemo(() => {
    const { dayQuests, dayEvents, dayTasks } = contentFor(anchor);
    return {
      quests: dayQuests,
      eventos: dayEvents.filter((e) => horaAMinutos(e.time) === null),
      tareas: dayTasks,
    };
  }, [contentFor, anchor]);

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

  const semana = Array.from({ length: 7 }, (_, i) => addDays(weekStartOf(anchor), i));

  /** La tira de "sin hora": lo que ocurre ese día pero no a una hora concreta. */
  const TiraSinHora = () => {
    const total = sinHora.quests.length + sinHora.eventos.length + sinHora.tareas.length;
    if (!total) return null;
    const doneSet = anchor === today ? doneToday : doneOnAnchor;
    return (
      <View style={styles.tira}>
        {sinHora.tareas.map((t) => (
          <View key={t.id} style={[styles.chip, { borderColor: colors.purpleDim }]}>
            <Text style={[styles.chipTexto, { color: colors.purpleText }]} numberOfLines={1}>
              {t.is_boss ? 'JEFE · ' : ''}
              {t.title}
            </Text>
          </View>
        ))}
        {sinHora.eventos.map((e) => (
          <Pressable
            key={e.id}
            onLongPress={() => removeEvent(e)}
            style={[styles.chip, { borderColor: colors.amberDim }]}
          >
            <Text style={[styles.chipTexto, { color: colors.amber }]} numberOfLines={1}>
              {e.title}
            </Text>
          </Pressable>
        ))}
        {sinHora.quests.map((q) => {
          const hecha = doneSet.has(q.id);
          return (
            <View key={q.id} style={[styles.chip, hecha && styles.chipHecho]}>
              <Text style={[styles.chipTexto, hecha && styles.chipTextoHecho]} numberOfLines={1}>
                {q.title}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>AGENDA</Text>
        <Pressable
          onPress={() => {
            setDate(anchor);
            setFormOpen(true);
          }}
          style={styles.addButton}
          accessibilityRole="button"
          accessibilityLabel="Añadir evento"
        >
          <Ionicons name="add" size={22} color={colors.bg} />
        </Pressable>
      </View>

      <View style={styles.segmented}>
        {(['dia', 'semana', 'mes'] as ViewMode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => setView(m)}
            style={[styles.segment, view === m && styles.segmentOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: view === m }}
          >
            <Text style={[styles.segmentText, view === m && styles.segmentTextOn]}>
              {m === 'dia' ? 'DÍA' : m === 'semana' ? 'SEMANA' : 'MES'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.navRow}>
        <Pressable
          onPress={() =>
            setAnchor(view === 'mes' ? addMonths(anchor, -1) : addDays(anchor, view === 'semana' ? -7 : -1))
          }
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Anterior"
        >
          <Ionicons name="chevron-back" size={22} color={colors.cyan} />
        </Pressable>
        <Pressable onPress={() => setAnchor(today)} accessibilityRole="button" accessibilityLabel="Ir a hoy">
          <Text style={styles.navLabel}>
            {view === 'mes' ? monthLabel(anchor) : dayLabel(anchor, today)}
          </Text>
          {anchor !== today ? <Text style={styles.navVolver}>toca para volver a hoy</Text> : null}
        </Pressable>
        <Pressable
          onPress={() =>
            setAnchor(view === 'mes' ? addMonths(anchor, 1) : addDays(anchor, view === 'semana' ? 7 : 1))
          }
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Siguiente"
        >
          <Ionicons name="chevron-forward" size={22} color={colors.cyan} />
        </Pressable>
      </View>

      {/* SEMANA y MES comparten idea: arriba se elige el día, abajo se ve ese
          día en el eje de horas. Antes las tres vistas apilaban la misma lista
          de tarjetas y no se distinguían entre sí. */}
      {view === 'semana' ? (
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
            return (
              <Pressable
                key={d}
                onPress={() => setAnchor(d)}
                style={[styles.diaSemana, sel && styles.diaSemanaSel]}
                accessibilityRole="button"
                accessibilityLabel={nombreDia(d)}
              >
                <Text style={[styles.diaSemanaLetra, sel && styles.diaSemanaTextoSel]}>
                  {DAY_HEADERS[weekdayOfKey(d) - 1]}
                </Text>
                <Text
                  style={[
                    styles.diaSemanaNum,
                    d === today && styles.diaHoy,
                    sel && styles.diaSemanaTextoSel,
                  ]}
                >
                  {Number(d.slice(8))}
                </Text>
                <View style={styles.cargaPista}>
                  <View style={[styles.cargaRelleno, { height: `${Math.max(8, carga * 100)}%` }]} />
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {view === 'mes' ? (
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
                  style={[styles.cell, sel && styles.cellSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={nombreDia(day)}
                >
                  <Text style={[styles.cellNum, esHoy && styles.cellNumToday, sel && styles.cellNumSel]}>
                    {Number(day.slice(8))}
                  </Text>
                  <View style={styles.dots}>
                    {c.dayEvents.length ? <View style={[styles.dot, { backgroundColor: colors.amber }]} /> : null}
                    {c.dayTasks.length ? <View style={[styles.dot, { backgroundColor: colors.purple }]} /> : null}
                    {n === 0 && c.dayQuests.length ? (
                      <View style={[styles.dot, { backgroundColor: colors.cyanFaint }]} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.subcabecera}>{dayLabel(anchor, today)}</Text>
        <TiraSinHora />

        {itemsConHora.length === 0 ? (
          <SystemWindow color={colors.line}>
            <Text style={styles.vacio}>
              Sin nada a una hora concreta.
              {anchor >= today
                ? ' Pídele al coach que planifique el día, o añade un evento con el +.'
                : ''}
            </Text>
          </SystemWindow>
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
      </ScrollView>

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>NUEVO EVENTO</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Llamada, cita, demo…"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Título del evento"
            />
            <View style={styles.inline}>
              <View style={{ flex: 2 }}>
                <Text style={styles.label}>Fecha</Text>
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={colors.textFaint}
                  accessibilityLabel="Fecha"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Hora</Text>
                <TextInput
                  style={styles.input}
                  value={time}
                  onChangeText={setTime}
                  placeholder="09:30"
                  placeholderTextColor={colors.textFaint}
                  accessibilityLabel="Hora"
                />
              </View>
            </View>
            <Text style={styles.hint}>
              Sin hora, el evento va a la tira de arriba junto a lo que no tiene momento fijo.
            </Text>
            <SystemButton title="Añadir" onPress={addEvent} disabled={!title.trim()} style={{ marginTop: 16 }} />
            <SystemButton
              title="Cancelar"
              variant="outline"
              onPress={() => setFormOpen(false)}
              style={{ marginTop: 10 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    marginBottom: 12,
  },
  title: { fontFamily: fonts.heading, fontSize: 15, letterSpacing: 3, color: colors.text },
  addButton: {
    width: 34,
    height: 34,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmented: { flexDirection: 'row', marginHorizontal: 16, borderWidth: 1, borderColor: colors.cyanFaint },
  segment: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  segmentOn: { backgroundColor: colors.cyanFaint },
  segmentText: { fontFamily: fonts.heading, fontSize: 11.5, letterSpacing: 2, color: colors.textDim },
  segmentTextOn: { color: colors.cyan },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navLabel: { fontFamily: fonts.heading, fontSize: 14, letterSpacing: 1.5, color: colors.text, textAlign: 'center' },
  navVolver: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textFaint, textAlign: 'center' },

  tiraSemana: { flexDirection: 'row', paddingHorizontal: 16, gap: 5, marginBottom: 6 },
  diaSemana: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.line,
  },
  diaSemanaSel: { borderColor: colors.cyan, backgroundColor: colors.cyanFaint },
  diaSemanaLetra: { fontFamily: fonts.heading, fontSize: 10, letterSpacing: 1, color: colors.textFaint },
  diaSemanaNum: { fontFamily: fonts.number, fontSize: 14, color: colors.text, marginTop: 2 },
  diaSemanaTextoSel: { color: colors.cyan },
  diaHoy: { color: colors.amber },
  // La carga se pinta como una barra que crece hacia arriba: de un vistazo se
  // ve qué día está cargado sin tener que abrirlo.
  cargaPista: { width: 16, height: 18, backgroundColor: colors.track, marginTop: 5, justifyContent: 'flex-end' },
  cargaRelleno: { backgroundColor: colors.cyanDim, width: '100%' },

  mes: { paddingHorizontal: 16, marginBottom: 6 },
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
  cellSelected: { backgroundColor: colors.cyanFaint, borderColor: colors.cyan },
  cellNum: { fontFamily: fonts.number, fontSize: 13, color: colors.textDim },
  cellNumToday: { color: colors.amber },
  cellNumSel: { color: colors.cyan },
  dots: { flexDirection: 'row', gap: 3, marginTop: 3, height: 5 },
  dot: { width: 4, height: 4, borderRadius: 2 },

  subcabecera: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2.5,
    color: colors.cyanText,
    marginTop: 10,
    marginBottom: 8,
  },
  tira: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    borderWidth: 1,
    borderColor: colors.cyanFaint,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  chipHecho: { opacity: 0.45 },
  chipTexto: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textDim },
  chipTextoHecho: { textDecorationLine: 'line-through' },
  vacio: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textDim },

  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 14, 0.85)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.panel,
    borderTopWidth: 1.5,
    borderTopColor: colors.cyanDim,
    padding: 20,
    paddingBottom: 34,
  },
  sheetTitle: {
    fontFamily: fonts.heading,
    fontSize: 13,
    letterSpacing: 2.5,
    color: colors.cyanText,
    marginBottom: 12,
  },
  inline: { flexDirection: 'row', gap: 10 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.textDim,
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 10, lineHeight: 15 },
});
