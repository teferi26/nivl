import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
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
import { fetchQuests } from '@/lib/data';
import { addDays, dateKey } from '@/lib/dates';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  fetchPendingTasksWithDue,
} from '@/lib/dungeons';
import { colors, fonts } from '@/lib/theme';
import type { CalendarEvent, DungeonTask, Quest } from '@/lib/types';

const DAYS_AHEAD = 14;

function dayLabel(key: string, today: string): string {
  if (key === today) return 'HOY';
  if (key === addDays(today, 1)) return 'MAÑANA';
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  const s = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
  return s.toUpperCase();
}

export default function Agenda() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [quests, setQuests] = useState<Quest[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [dueTasks, setDueTasks] = useState<DungeonTask[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dateKey());
  const [time, setTime] = useState('');

  const today = dateKey();

  const load = useCallback(async () => {
    try {
      const [qs, evs, tasks] = await Promise.all([
        fetchQuests(),
        fetchCalendarEvents(today, addDays(today, DAYS_AHEAD)),
        fetchPendingTasksWithDue(),
      ]);
      setQuests(qs);
      setEvents(evs);
      setDueTasks(tasks);
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const addEvent = async () => {
    if (!userId || !title.trim()) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Fecha inválida', 'Usa el formato AAAA-MM-DD, ej. 2026-06-15');
      return;
    }
    await createCalendarEvent(userId, {
      title: title.trim(),
      date,
      time: time.trim() || null,
    });
    setTitle('');
    setTime('');
    setFormOpen(false);
    await load();
  };

  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>AGENDA</Text>
          <Pressable onPress={() => setFormOpen(true)} style={styles.addButton}>
            <Ionicons name="add" size={22} color={colors.bg} />
          </Pressable>
        </View>

        {days.map((day) => {
          const dayQuests = questsScheduledOn(quests, day).filter((q) => !q.is_penalty || day === today);
          const dayEvents = events.filter((e) => e.date === day);
          const dayTasks = dueTasks.filter((t) => t.due_date === day);
          const overdue = day === today ? dueTasks.filter((t) => t.due_date && t.due_date < today) : [];
          const hasContent = dayQuests.length > 0 || dayEvents.length > 0 || dayTasks.length > 0 || overdue.length > 0;
          if (!hasContent && day !== today) return null;

          return (
            <SystemWindow key={day} color={day === today ? colors.cyanDim : colors.line}>
              <Text style={[styles.dayHeader, day === today && styles.dayHeaderToday]}>
                {dayLabel(day, today)}
              </Text>

              {overdue.map((t) => (
                <View key={t.id} style={styles.row}>
                  <Ionicons name="alert-circle-outline" size={15} color={colors.red} />
                  <Text style={[styles.rowText, { color: colors.red }]} numberOfLines={1}>
                    VENCIDA · {t.title}
                  </Text>
                </View>
              ))}

              {dayEvents.map((e) => (
                <Pressable
                  key={e.id}
                  onLongPress={() =>
                    Alert.alert('Eliminar evento', e.title, [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Eliminar',
                        style: 'destructive',
                        onPress: async () => {
                          await deleteCalendarEvent(e.id);
                          await load();
                        },
                      },
                    ])
                  }
                  style={styles.row}
                >
                  <Ionicons name="calendar-outline" size={15} color={colors.amber} />
                  <Text style={styles.rowText} numberOfLines={1}>
                    {e.time ? `${e.time} · ` : ''}
                    {e.title}
                  </Text>
                </Pressable>
              ))}

              {dayTasks.map((t) => (
                <View key={t.id} style={styles.row}>
                  <Ionicons name="map-outline" size={15} color={colors.purple} />
                  <Text style={styles.rowText} numberOfLines={1}>
                    {t.is_boss ? 'JEFE · ' : ''}
                    {t.title}
                  </Text>
                </View>
              ))}

              {dayQuests.map((q) => (
                <View key={q.id} style={styles.row}>
                  <Ionicons name="ellipse-outline" size={13} color={colors.cyanDim} />
                  <Text style={[styles.rowText, { color: colors.textDim }]} numberOfLines={1}>
                    {q.title}
                  </Text>
                </View>
              ))}

              {!hasContent ? <Text style={styles.empty}>Día libre de obligaciones.</Text> : null}
            </SystemWindow>
          );
        })}
      </ScrollView>

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>NUEVO EVENTO</Text>
            <Text style={styles.label}>Título</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ej. Examen INGP · Cita médico"
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
        </View>
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
    marginBottom: 14,
  },
  title: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: 4, color: colors.cyan },
  addButton: {
    width: 34,
    height: 34,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHeader: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.textFaint,
    marginBottom: 6,
  },
  dayHeaderToday: { color: colors.cyan },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  rowText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.textFaint },
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
