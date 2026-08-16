import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { SystemButton } from '@/components/SystemButton';
import { SystemWindow } from '@/components/SystemWindow';
import { useAuth } from '@/lib/auth';
import { questsScheduledOn } from '@/lib/closing';
import { fetchCompletionsForDate, fetchQuests } from '@/lib/data';
import { addDays, dateKey, isValidKey, weekdayOfKey } from '@/lib/dates';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  fetchPendingTasksWithDue,
} from '@/lib/dungeons';
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
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  return date
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
    .toUpperCase();
}

function weekStartOf(key: string): string {
  return addDays(key, -(weekdayOfKey(key) - 1));
}

function monthGrid(anchor: string): { cells: (string | null)[]; monthKey: string } {
  const [y, m] = anchor.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const daysInMonth = new Date(y!, m!, 0).getDate();
  const lead = weekdayOfKey(first) - 1; // huecos antes del día 1 (lunes=0)
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return { cells, monthKey: first.slice(0, 7) };
}

function addMonths(anchor: string, n: number): string {
  const [y, m] = anchor.split('-').map(Number);
  const date = new Date(y!, m! - 1 + n, 1);
  return dateKey(date);
}

export default function Agenda() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const today = dateKey();

  const [view, setView] = useState<ViewMode>('semana');
  const [anchor, setAnchor] = useState(today); // día seleccionado / referencia
  const [quests, setQuests] = useState<Quest[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [dueTasks, setDueTasks] = useState<DungeonTask[]>([]);
  const [doneToday, setDoneToday] = useState<Set<string>>(new Set());
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

  // Si la navegación sale del rango cargado, recarga centrado en el nuevo ancla.
  useEffect(() => {
    const r = rangeRef.current;
    if (r && (anchor < addDays(r.from, 7) || anchor > addDays(r.to, -7))) {
      load(anchor);
    }
  }, [anchor, load]);

  // Completadas del día seleccionado: sin esto, el historial de días pasados
  // parecería una lista de fallos.
  const [doneOnAnchor, setDoneOnAnchor] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (anchor === today) {
      setDoneOnAnchor(doneToday);
      return;
    }
    let cancelled = false;
    fetchCompletionsForDate(anchor)
      .then((done) => {
        if (!cancelled) setDoneOnAnchor(new Set(done.map((c) => c.quest_id)));
      })
      .catch(() => {
        if (!cancelled) setDoneOnAnchor(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [anchor, today, doneToday]);

  const contentFor = useCallback(
    (day: string) => {
      const dayQuests = questsScheduledOn(quests, day).filter(
        (q) => !q.is_penalty || day === today,
      );
      const dayEvents = events.filter((e) => e.date === day);
      const dayTasks = dueTasks.filter((t) => t.due_date === day);
      return { dayQuests, dayEvents, dayTasks };
    },
    [quests, events, dueTasks, today],
  );

  const hasContent = useCallback(
    (day: string) => {
      const c = contentFor(day);
      return c.dayQuests.length > 0 || c.dayEvents.length > 0 || c.dayTasks.length > 0;
    },
    [contentFor],
  );

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

  const removeEvent = (e: CalendarEvent) => {
    Alert.alert('Eliminar evento', e.title, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCalendarEvent(e.id);
            await load(anchor);
          } catch (err) {
            Alert.alert('Error del sistema', err instanceof Error ? err.message : 'Fallo');
          }
        },
      },
    ]);
  };

  // Panel de detalle de un día (compartido por las tres vistas)
  const renderDayDetail = (day: string) => {
    const { dayQuests, dayEvents, dayTasks } = contentFor(day);
    const doneSet = day === anchor ? doneOnAnchor : doneToday;
    const overdue =
      day === today ? dueTasks.filter((t) => t.due_date && t.due_date < today) : [];
    // Las misiones extra son opcionales por diseño: no cuentan como pendientes.
    const pendingQuests =
      day === today ? dayQuests.filter((q) => !q.is_bonus && !doneToday.has(q.id)) : [];
    const pendingCount = pendingQuests.length + overdue.length;
    const empty =
      dayQuests.length === 0 && dayEvents.length === 0 && dayTasks.length === 0 && overdue.length === 0;

    return (
      <SystemWindow color={day === today ? colors.cyanDim : colors.line}>
        <Text style={[styles.dayHeader, day === today && styles.dayHeaderToday]}>
          {dayLabel(day, today)}
        </Text>

        {day === today && pendingCount > 0 ? (
          <Text style={styles.pendingBanner}>
            {pendingCount === 1
              ? '1 objetivo pendiente antes del cierre.'
              : `${pendingCount} objetivos pendientes antes del cierre.`}
          </Text>
        ) : null}

        {overdue.map((t) => (
          <View key={`ov-${t.id}`} style={styles.row}>
            <Text style={[styles.tag, styles.tagOverdue]}>VENCIDA</Text>
            <Text style={[styles.rowText, { color: colors.red }]} numberOfLines={1}>
              {t.title}
            </Text>
          </View>
        ))}

        {dayEvents.map((e) => (
          <Pressable key={e.id} onLongPress={() => removeEvent(e)} style={styles.row}>
            <Text style={[styles.tag, styles.tagEvent]}>EVENTO</Text>
            <Text style={styles.rowText} numberOfLines={1}>
              {e.time ? `${e.time} · ` : ''}
              {e.title}
            </Text>
          </Pressable>
        ))}

        {dayTasks.map((t) => (
          <View key={t.id} style={styles.row}>
            <Text style={[styles.tag, styles.tagDungeon]}>MAZMORRA</Text>
            <Text style={[styles.rowText, { color: colors.purpleText }]} numberOfLines={1}>
              {t.is_boss ? 'JEFE · ' : ''}
              {t.title}
            </Text>
          </View>
        ))}

        {dayQuests.map((q) => {
          const done = doneSet.has(q.id);
          return (
            <View key={q.id} style={styles.row}>
              <Text style={[styles.tag, styles.tagQuest]}>MISIÓN</Text>
              <Text
                style={[styles.rowText, { color: colors.textDim }, done && styles.rowDone]}
                numberOfLines={1}
              >
                {q.title}
              </Text>
              {done ? <Ionicons name="checkmark" size={14} color={colors.cyan} /> : null}
            </View>
          );
        })}

        {empty ? <Text style={styles.empty}>Día libre de obligaciones.</Text> : null}
        {dayEvents.length > 0 ? (
          <Text style={styles.deleteHint}>mantén pulsado un evento para eliminarlo</Text>
        ) : null}
      </SystemWindow>
    );
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStartOf(anchor), i));
  const { cells } = monthGrid(anchor);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content}>
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
              setAnchor(
                view === 'mes' ? addMonths(anchor, -1) : addDays(anchor, view === 'semana' ? -7 : -1),
              )
            }
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Anterior"
          >
            <Ionicons name="chevron-back" size={22} color={colors.cyan} />
          </Pressable>
          <Pressable onPress={() => setAnchor(today)} accessibilityRole="button" accessibilityLabel="Ir a hoy">
            <Text style={styles.navLabel}>
              {view === 'mes' ? monthLabel(anchor) : dayLabel(anchor, today)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              setAnchor(
                view === 'mes' ? addMonths(anchor, 1) : addDays(anchor, view === 'semana' ? 7 : 1),
              )
            }
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Siguiente"
          >
            <Ionicons name="chevron-forward" size={22} color={colors.cyan} />
          </Pressable>
        </View>

        {view === 'mes' ? (
          <SystemWindow color={colors.cyanDim}>
            <View style={styles.gridHeader}>
              {DAY_HEADERS.map((d) => (
                <Text key={d} style={styles.gridHeaderText}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (!day) return <View key={`x-${i}`} style={styles.cell} />;
                const { dayQuests, dayEvents, dayTasks } = contentFor(day);
                const selected = day === anchor;
                const isToday = day === today;
                return (
                  <Pressable
                    key={day}
                    onPress={() => setAnchor(day)}
                    style={[styles.cell, selected && styles.cellSelected, isToday && styles.cellToday]}
                    accessibilityRole="button"
                    accessibilityLabel={`Día ${day}`}
                  >
                    <Text style={[styles.cellNum, isToday && styles.cellNumToday]}>
                      {Number(day.slice(8))}
                    </Text>
                    <View style={styles.dots}>
                      {dayQuests.length > 0 ? <View style={[styles.dot, { backgroundColor: colors.cyan }]} /> : null}
                      {dayTasks.length > 0 ? <View style={[styles.dot, { backgroundColor: colors.purple }]} /> : null}
                      {dayEvents.length > 0 ? <View style={[styles.dot, { backgroundColor: colors.text }]} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.legend}>
              <View style={[styles.dot, { backgroundColor: colors.cyan }]} />
              <Text style={styles.legendText}>misiones</Text>
              <View style={[styles.dot, { backgroundColor: colors.purple }]} />
              <Text style={styles.legendText}>mazmorras</Text>
              <View style={[styles.dot, { backgroundColor: colors.text }]} />
              <Text style={styles.legendText}>eventos</Text>
            </View>
          </SystemWindow>
        ) : null}

        {view === 'semana' ? (
          <View style={styles.weekStrip}>
            {weekDays.map((day) => {
              const selected = day === anchor;
              const isToday = day === today;
              return (
                <Pressable
                  key={day}
                  onPress={() => setAnchor(day)}
                  style={[styles.weekDay, selected && styles.weekDaySelected]}
                  accessibilityRole="button"
                  accessibilityLabel={`Seleccionar ${day}`}
                >
                  <Text style={styles.weekDayName}>{DAY_HEADERS[weekdayOfKey(day) - 1]}</Text>
                  <Text style={[styles.weekDayNum, isToday && styles.cellNumToday]}>
                    {Number(day.slice(8))}
                  </Text>
                  {hasContent(day) ? <View style={[styles.dot, { backgroundColor: colors.cyan }]} /> : <View style={styles.dotGhost} />}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {renderDayDetail(anchor)}

        {view !== 'dia' && anchor !== today && hasContent(today) ? (
          <Pressable onPress={() => setAnchor(today)}>
            <Text style={styles.backToToday}>← volver a hoy</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>NUEVO EVENTO</Text>
            <Text style={styles.label}>Título</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ej. Cita médico · Cena con Efrem"
              placeholderTextColor={colors.textFaint}
            />
            <Text style={styles.label}>Fecha (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder={today}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
            />
            <Text style={styles.label}>Hora (opcional)</Text>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              placeholder="Ej. 17:30"
              placeholderTextColor={colors.textFaint}
            />
            <SystemButton title="Añadir al calendario" onPress={addEvent} disabled={!title.trim()} style={{ marginTop: 18 }} />
            <SystemButton title="Cancelar" variant="outline" onPress={() => setFormOpen(false)} style={{ marginTop: 10 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: 4, color: colors.cyan },
  addButton: {
    width: 34,
    height: 34,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmented: { flexDirection: 'row', borderWidth: 1, borderColor: colors.cyanDim, marginBottom: 10 },
  segment: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  segmentOn: { backgroundColor: colors.cyanFaint },
  segmentText: { fontFamily: fonts.heading, fontSize: 12, letterSpacing: 2, color: colors.textDim },
  segmentTextOn: { color: colors.cyan },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navLabel: { fontFamily: fonts.heading, fontSize: 13, letterSpacing: 2, color: colors.text },
  gridHeader: { flexDirection: 'row', marginBottom: 6 },
  gridHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.heading,
    fontSize: 11,
    color: colors.textFaint,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 0.95,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  cellSelected: { backgroundColor: colors.cyanFaint },
  cellToday: { borderWidth: 1, borderColor: colors.cyan },
  cellNum: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  cellNumToday: { color: colors.cyan },
  dots: { flexDirection: 'row', gap: 3, marginTop: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotGhost: { width: 5, height: 5 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  legendText: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginRight: 8 },
  weekStrip: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 3,
  },
  weekDaySelected: { borderColor: colors.cyan, backgroundColor: colors.cyanFaint },
  weekDayName: { fontFamily: fonts.heading, fontSize: 11, color: colors.textFaint },
  weekDayNum: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  dayHeader: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.textFaint,
    marginBottom: 8,
  },
  dayHeaderToday: { color: colors.cyan },
  pendingBanner: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.cyanText,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  tag: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tagQuest: { color: colors.cyan, borderColor: colors.cyanDim },
  tagDungeon: { color: colors.purple, borderColor: colors.purpleDim },
  tagEvent: { color: colors.text, borderColor: colors.line },
  tagOverdue: { color: colors.red, borderColor: colors.redDim },
  rowText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  rowDone: { textDecorationLine: 'line-through', color: colors.textFaint },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.textFaint },
  deleteHint: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 8 },
  backToToday: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.cyanText,
    textAlign: 'center',
    marginTop: 4,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 14, 0.85)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.panel,
    borderTopWidth: 1.5,
    borderTopColor: colors.cyanDim,
    padding: 20,
    paddingBottom: 34,
  },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: 3, color: colors.cyan, marginBottom: 6 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.textDim,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cyanDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
