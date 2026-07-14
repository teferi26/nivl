import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LevelUpOverlay } from '@/components/LevelUpOverlay';
import { QuestForm } from '@/components/QuestForm';
import { SystemWindow } from '@/components/SystemWindow';
import { XpToast } from '@/components/XpToast';
import { useAuth } from '@/lib/auth';
import {
  createQuest,
  deleteQuest,
  ensureProfile,
  fetchCompletionsForDate,
  fetchQuests,
  setQuestActive,
  updateQuest,
  type QuestInput,
} from '@/lib/data';
import { dateKey } from '@/lib/dates';
import { completeQuest } from '@/lib/engine';
import { BONUS_BY_DIFFICULTY, DIFFICULTY_LABEL, XP_BY_DIFFICULTY } from '@/lib/game';
import { colors, fonts } from '@/lib/theme';
import type { Profile, Quest } from '@/lib/types';

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function daysSummary(days: number[]): string {
  const valid = days.filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  if (valid.length === 7) return 'Todos los días';
  if (valid.length === 0) return '—';
  return valid.map((d) => DAY_LABELS[d - 1]).join(' · ');
}

export default function Misiones() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [doneToday, setDoneToday] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Quest | null>(null);
  const [toast, setToast] = useState<{ xp: number; bonus: boolean; unit: 'XP' | 'PB' } | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const completing = useRef<Set<string>>(new Set());
  const clearToast = useCallback(() => setToast(null), []);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [prof, all, done] = await Promise.all([
        ensureProfile(userId),
        fetchQuests(),
        fetchCompletionsForDate(dateKey()),
      ]);
      setProfile(prof);
      setQuests(all.filter((q) => !q.is_penalty));
      setDoneToday(new Set(done.map((c) => c.quest_id)));
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onSubmit = async (input: QuestInput) => {
    if (!userId) return;
    if (editing) {
      await updateQuest(editing.id, input);
    } else {
      await createQuest(userId, input);
    }
    setEditing(null);
    await load();
  };

  const onDelete = async (quest: Quest) => {
    await deleteQuest(quest.id);
    setEditing(null);
    await load();
  };

  const onToggle = async (quest: Quest, active: boolean) => {
    setQuests((prev) => prev.map((q) => (q.id === quest.id ? { ...q, active } : q)));
    try {
      await setQuestActive(quest.id, active);
    } catch (e) {
      // Revierte el optimista: si no, el switch miente respecto a la BD.
      setQuests((prev) => prev.map((q) => (q.id === quest.id ? { ...q, active: !active } : q)));
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'No se pudo cambiar');
    }
  };

  // Completar desde aquí mismo (sin pasar por Sistema), con cerrojo anti doble-toque.
  const markDone = async (quest: Quest) => {
    if (!profile || doneToday.has(quest.id) || completing.current.has(quest.id)) return;
    completing.current.add(quest.id);
    setBusyId(quest.id);
    try {
      const res = await completeQuest(profile, quest, null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setProfile(res.profile);
      setDoneToday((prev) => new Set(prev).add(quest.id));
      setToast(
        res.bonusEarned > 0
          ? { xp: res.bonusEarned, bonus: false, unit: 'PB' }
          : { xp: res.xp, bonus: false, unit: 'XP' },
      );
      if (res.leveledUp) setLevelUp(res.newLevel);
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      completing.current.delete(quest.id);
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>MISIONES</Text>
          <Pressable
            onPress={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            style={styles.addButton}
            accessibilityRole="button"
            accessibilityLabel="Crear misión"
          >
            <Ionicons name="add" size={22} color={colors.bg} />
          </Pressable>
        </View>

        <Text style={styles.helper}>
          Toca el círculo para marcarla hecha hoy · toca la misión para editarla
        </Text>

        {quests.length === 0 ? (
          <SystemWindow color={colors.cyanDim}>
            <Text style={styles.empty}>Sin misiones todavía. Pulsa + para crear la primera.</Text>
          </SystemWindow>
        ) : (
          quests.map((q) => {
            const done = doneToday.has(q.id);
            return (
              <SystemWindow key={q.id} color={q.active ? colors.cyanDim : colors.line}>
                <View style={styles.questRow}>
                  <Pressable
                    onPress={() => markDone(q)}
                    disabled={done || busyId === q.id || !q.active}
                    style={[styles.doneCircle, done && styles.doneCircleOn, !q.active && styles.doneCircleOff]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done, disabled: done || !q.active }}
                    accessibilityLabel={done ? `${q.title}, completada hoy` : `Marcar ${q.title} como hecha hoy`}
                  >
                    {done ? <Ionicons name="checkmark" size={18} color={colors.cyan} /> : null}
                  </Pressable>
                  <Pressable
                    style={styles.questBody}
                    onPress={() => {
                      setEditing(q);
                      setFormOpen(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar misión ${q.title}`}
                  >
                    <Text style={[styles.questTitle, !q.active && styles.questTitleOff]} numberOfLines={1}>
                      {q.title}
                    </Text>
                    <Text style={styles.questMeta}>
                      {q.stat} · {DIFFICULTY_LABEL[q.difficulty]} ·{' '}
                      {q.is_bonus ? `${BONUS_BY_DIFFICULTY[q.difficulty]} PB` : `${XP_BY_DIFFICULTY[q.difficulty]} XP`}
                      {done ? ' · hecha hoy' : ''}
                    </Text>
                    <Text style={styles.questDays}>
                      {daysSummary(q.days_of_week)}
                      {q.requires_evidence ? '  ·  evidencia obligatoria' : ''}
                    </Text>
                  </Pressable>
                  <View style={styles.actions}>
                    <Switch
                      value={q.active}
                      onValueChange={(v) => onToggle(q, v)}
                      trackColor={{ false: colors.track, true: colors.cyanDim }}
                      thumbColor={q.active ? colors.cyan : colors.textFaint}
                      accessibilityLabel={`Misión ${q.active ? 'activa' : 'inactiva'}`}
                    />
                    <Ionicons name="create-outline" size={17} color={colors.textFaint} />
                  </View>
                </View>
              </SystemWindow>
            );
          })
        )}
      </ScrollView>

      <QuestForm
        visible={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={onSubmit}
        initial={editing}
        onDelete={onDelete}
      />
      <XpToast xp={toast?.xp ?? null} bonus={toast?.bonus} unit={toast?.unit} onDone={clearToast} />
      <LevelUpOverlay level={levelUp} onClose={() => setLevelUp(null)} />
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
    marginBottom: 6,
  },
  title: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: 4, color: colors.cyan },
  addButton: {
    width: 34,
    height: 34,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helper: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginBottom: 12 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
  questRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doneCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.cyanDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCircleOn: { backgroundColor: colors.cyanFaint, borderColor: colors.cyan },
  doneCircleOff: { borderColor: colors.line },
  questBody: { flex: 1, minWidth: 0 },
  questTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  questTitleOff: { color: colors.textFaint },
  questMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.cyanText, marginTop: 2 },
  questDays: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 2 },
  actions: { alignItems: 'center', gap: 8 },
});
