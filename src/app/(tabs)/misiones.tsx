import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QuestForm } from '@/components/QuestForm';
import { SystemWindow } from '@/components/SystemWindow';
import { useAuth } from '@/lib/auth';
import { createQuest, deleteQuest, fetchQuests, setQuestActive, type QuestInput } from '@/lib/data';
import { DIFFICULTY_LABEL, XP_BY_DIFFICULTY } from '@/lib/game';
import { colors, fonts } from '@/lib/theme';
import type { Quest } from '@/lib/types';

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function daysSummary(days: number[]): string {
  if (days.length === 7) return 'Todos los días';
  return days.map((d) => DAY_LABELS[d - 1]).join(' · ');
}

export default function Misiones() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [quests, setQuests] = useState<Quest[]>([]);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await fetchQuests();
      setQuests(all.filter((q) => !q.is_penalty));
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onCreate = async (input: QuestInput) => {
    if (!userId) return;
    await createQuest(userId, input);
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

  const onDelete = (quest: Quest) => {
    Alert.alert('Eliminar misión', `¿Eliminar "${quest.title}" y todo su historial?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteQuest(quest.id);
          await load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>MISIONES</Text>
          <Pressable onPress={() => setFormOpen(true)} style={styles.addButton}>
            <Ionicons name="add" size={22} color={colors.bg} />
          </Pressable>
        </View>

        {quests.length === 0 ? (
          <SystemWindow color={colors.cyanDim}>
            <Text style={styles.empty}>
              Sin misiones todavía. Pulsa + para crear la primera.
            </Text>
          </SystemWindow>
        ) : (
          quests.map((q) => (
            <SystemWindow key={q.id} color={q.active ? colors.cyanDim : colors.line}>
              <View style={styles.questRow}>
                <View style={styles.questBody}>
                  <Text style={[styles.questTitle, !q.active && styles.questTitleOff]}>
                    {q.title}
                  </Text>
                  <Text style={styles.questMeta}>
                    {q.stat} · {DIFFICULTY_LABEL[q.difficulty]} · {XP_BY_DIFFICULTY[q.difficulty]} XP
                  </Text>
                  <Text style={styles.questDays}>
                    {daysSummary(q.days_of_week)}
                    {q.requires_evidence ? '  ·  evidencia obligatoria' : ''}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <Switch
                    value={q.active}
                    onValueChange={(v) => onToggle(q, v)}
                    trackColor={{ false: colors.track, true: colors.cyanDim }}
                    thumbColor={q.active ? colors.cyan : colors.textFaint}
                  />
                  <Pressable onPress={() => onDelete(q)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={19} color={colors.textFaint} />
                  </Pressable>
                </View>
              </View>
            </SystemWindow>
          ))
        )}
      </ScrollView>

      <QuestForm visible={formOpen} onClose={() => setFormOpen(false)} onSubmit={onCreate} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 16,
    letterSpacing: 4,
    color: colors.cyan,
  },
  addButton: {
    width: 34,
    height: 34,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textDim,
  },
  questRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  questBody: {
    flex: 1,
    minWidth: 0,
  },
  questTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
  },
  questTitleOff: {
    color: colors.textFaint,
  },
  questMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.cyanText,
    marginTop: 2,
  },
  questDays: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textFaint,
    marginTop: 2,
  },
  actions: {
    alignItems: 'center',
    gap: 10,
  },
});
