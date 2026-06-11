import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LevelUpOverlay } from '@/components/LevelUpOverlay';
import { SystemButton } from '@/components/SystemButton';
import { SystemWindow } from '@/components/SystemWindow';
import { XPBar } from '@/components/XPBar';
import { evaluateAchievements, unlockAchievements } from '@/lib/achievements';
import { useAuth } from '@/lib/auth';
import { ensureProfile } from '@/lib/data';
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
import { DIFFICULTIES, DIFFICULTY_LABEL, DUNGEON_CLEAR_XP, dungeonTaskXp } from '@/lib/game';
import { colors, fonts } from '@/lib/theme';
import { voice } from '@/lib/voice';
import type { Difficulty, Dungeon, DungeonTask } from '@/lib/types';

export default function DungeonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [dungeon, setDungeon] = useState<Dungeon | null>(null);
  const [tasks, setTasks] = useState<DungeonTask[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('media');
  const [isBoss, setIsBoss] = useState(false);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setDungeon(await fetchDungeon(id));
      setTasks(await fetchTasks(id));
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const addTask = async () => {
    if (!userId || !id || !taskTitle.trim()) return;
    await createTask(userId, id, {
      title: taskTitle.trim(),
      difficulty,
      is_boss: isBoss,
      position: tasks.length,
    });
    setTaskTitle('');
    setIsBoss(false);
    setFormOpen(false);
    await load();
  };

  const toggleTask = async (task: DungeonTask) => {
    if (!userId || !dungeon || busy || dungeon.status !== 'active') return;
    if (task.done) return;
    setBusy(true);
    try {
      await setTaskDone(task.id, true);
      const profile = await ensureProfile(userId);
      const xp = dungeonTaskXp(task.difficulty, task.is_boss);
      const res = await awardXp(profile, xp, dungeon.stat, 'dungeon_task', {
        dungeon: dungeon.title,
        task: task.title,
        boss: task.is_boss,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (res.leveledUp) setLevelUp(res.newLevel);
      await load();
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      setBusy(false);
    }
  };

  const claimLoot = async () => {
    if (!userId || !dungeon || busy) return;
    setBusy(true);
    try {
      await updateDungeon(dungeon.id, { status: 'cleared', cleared_at: new Date().toISOString() });
      const profile = await ensureProfile(userId);
      const loot = DUNGEON_CLEAR_XP[dungeon.rank];
      const res = await awardXp(profile, loot, dungeon.stat, 'dungeon_cleared', {
        dungeon: dungeon.title,
        rank: dungeon.rank,
      });
      const cleared = await countClearedDungeons();
      const fresh = await unlockAchievements(userId, evaluateAchievements({ dungeonsCleared: cleared }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'MAZMORRA DESPEJADA',
        `${voice.dungeonCleared(dungeon.title)}\n\nBotín: +${loot} XP${fresh.length > 0 ? `\n${voice.achievement()} ${fresh.map((a) => a.name).join(', ')}` : ''}`,
      );
      if (res.leveledUp) setLevelUp(res.newLevel);
      await load();
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      setBusy(false);
    }
  };

  const removeDungeon = () => {
    if (!dungeon) return;
    Alert.alert('Abandonar mazmorra', `¿Eliminar "${dungeon.title}" y todas sus tareas?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteDungeon(dungeon.id);
          router.back();
        },
      },
    ]);
  };

  if (!dungeon) {
    return <SafeAreaView style={styles.screen} edges={['top']} />;
  }

  const done = tasks.filter((t) => t.done).length;
  const allDone = tasks.length > 0 && done === tasks.length;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={colors.purple} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            MAZMORRA · RANGO {dungeon.rank}
          </Text>
          <Pressable onPress={removeDungeon} hitSlop={10}>
            <Ionicons name="trash-outline" size={20} color={colors.textFaint} />
          </Pressable>
        </View>

        <SystemWindow color={colors.purpleDim} fill={colors.panelDeep}>
          <Text style={styles.dungeonTitle}>{dungeon.title}</Text>
          <Text style={styles.meta}>
            {done}/{tasks.length} objetivos · stat {dungeon.stat} · botín al despejar: {DUNGEON_CLEAR_XP[dungeon.rank]} XP
          </Text>
          <View style={{ marginTop: 10 }}>
            <XPBar ratio={tasks.length > 0 ? done / tasks.length : 0} color={colors.purple} trackColor="#191D3D" height={8} />
          </View>
          {dungeon.status === 'cleared' ? (
            <Text style={styles.clearedTag}>DESPEJADA</Text>
          ) : null}
        </SystemWindow>

        <SystemWindow color={colors.purpleDim} fill={colors.panelDeep}>
          <View style={styles.taskHeader}>
            <Text style={styles.windowTitle}>OBJETIVOS</Text>
            {dungeon.status === 'active' ? (
              <Pressable onPress={() => setFormOpen(true)} hitSlop={8}>
                <Ionicons name="add" size={22} color={colors.purple} />
              </Pressable>
            ) : null}
          </View>
          {tasks.length === 0 ? (
            <Text style={styles.empty}>
              Sin objetivos todavía. Desglosa la mazmorra: cada tarea es un monstruo, cada hito un jefe.
            </Text>
          ) : (
            tasks.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => toggleTask(t)}
                onLongPress={() =>
                  Alert.alert('Eliminar objetivo', t.title, [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Eliminar',
                      style: 'destructive',
                      onPress: async () => {
                        await deleteTask(t.id);
                        await load();
                      },
                    },
                  ])
                }
                style={styles.taskRow}
              >
                <View style={[styles.box, t.done && styles.boxDone, t.is_boss && styles.boxBoss]}>
                  {t.done ? <Ionicons name="checkmark" size={14} color={colors.purple} /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.taskTitle, t.done && styles.taskDone]} numberOfLines={1}>
                    {t.title}
                  </Text>
                  <Text style={styles.taskMeta}>
                    {t.is_boss ? 'JEFE · ' : ''}
                    {DIFFICULTY_LABEL[t.difficulty]}
                  </Text>
                </View>
                <Text style={[styles.xp, t.done && styles.xpDone]}>
                  +{dungeonTaskXp(t.difficulty, t.is_boss)} XP
                </Text>
              </Pressable>
            ))
          )}
        </SystemWindow>

        {allDone && dungeon.status === 'active' ? (
          <SystemButton title={`Reclamar botín · +${DUNGEON_CLEAR_XP[dungeon.rank]} XP`} onPress={claimLoot} loading={busy} />
        ) : null}
      </ScrollView>

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>NUEVO OBJETIVO</Text>
            <TextInput
              style={styles.input}
              value={taskTitle}
              onChangeText={setTaskTitle}
              placeholder="Ej. Redactar capítulo 2"
              placeholderTextColor={colors.textFaint}
            />
            <Text style={styles.label}>Dificultad</Text>
            <View style={styles.chips}>
              {DIFFICULTIES.map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setDifficulty(d)}
                  style={[styles.chip, difficulty === d && styles.chipOn]}
                >
                  <Text style={[styles.chipText, difficulty === d && styles.chipTextOn]}>
                    {DIFFICULTY_LABEL[d]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Es un jefe (hito) · XP ×2</Text>
              <Switch
                value={isBoss}
                onValueChange={setIsBoss}
                trackColor={{ false: colors.track, true: '#191D3D' }}
                thumbColor={isBoss ? colors.purple : colors.textFaint}
              />
            </View>
            <SystemButton title="Añadir" onPress={addTask} disabled={!taskTitle.trim()} style={{ marginTop: 18 }} />
            <SystemButton title="Cancelar" variant="outline" onPress={() => setFormOpen(false)} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Modal>

      <LevelUpOverlay level={levelUp} onClose={() => setLevelUp(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 14,
    letterSpacing: 3,
    color: colors.purple,
    textAlign: 'center',
  },
  dungeonTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, marginTop: 4 },
  clearedTag: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.purple,
    marginTop: 8,
  },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  windowTitle: { fontFamily: fonts.heading, fontSize: 12, letterSpacing: 2.5, color: '#A697F0' },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, lineHeight: 19 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#15182E',
  },
  box: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.purpleDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: { backgroundColor: '#191D3D', borderColor: colors.purple },
  boxBoss: { borderWidth: 2, borderColor: colors.purple },
  taskTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  taskDone: { color: colors.textDim, textDecorationLine: 'line-through' },
  taskMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 1 },
  xp: { fontFamily: fonts.heading, fontSize: 13, color: colors.textFaint },
  xpDone: { color: colors.purple },
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 14, 0.85)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.panelDeep,
    borderTopWidth: 1.5,
    borderTopColor: colors.purpleDim,
    padding: 20,
    paddingBottom: 34,
  },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: 3, color: colors.purple, marginBottom: 12 },
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
    borderColor: colors.purpleDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.purpleDim, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: '#191D3D', borderColor: colors.purple },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDim },
  chipTextOn: { color: colors.purple },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  switchLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
});
