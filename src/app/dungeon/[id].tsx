import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { LevelUpOverlay } from '@/components/LevelUpOverlay';
import { SystemButton } from '@/components/SystemButton';
import {
  Card,
  Check,
  Chip,
  ChipWrap,
  EmptyState,
  FadeIn,
  ProgressRing,
  Row,
  RowValue,
  Screen,
  ScreenHeader,
  Section,
  Stagger,
  Stat,
  StatRow,
  Tag,
} from '@/components/ui';
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

/** Días que quedan hasta la fecha límite, en la voz del sistema. */
function plazo(fecha: string | null): { valor: string; label: string; tone: 'text' | 'red' } {
  if (!fecha) return { valor: '—', label: 'Sin fecha', tone: 'text' };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(`${fecha}T00:00:00`);
  const dias = Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000);
  if (dias < 0) return { valor: `${-dias}`, label: 'Días de retraso', tone: 'red' };
  if (dias === 0) return { valor: 'Hoy', label: 'Fecha límite', tone: 'red' };
  return { valor: `${dias}`, label: dias === 1 ? 'Día restante' : 'Días restantes', tone: dias <= 3 ? 'red' : 'text' };
}

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
  const saving = useRef(false);

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
      // max(position)+1 en vez de length: tras borrar una tarea del medio,
      // length colisionaba con una position ya existente.
      position: tasks.reduce((m, t) => Math.max(m, t.position), -1) + 1,
    });
    setTaskTitle('');
    setIsBoss(false);
    setFormOpen(false);
    await load();
  };

  const toggleTask = async (task: DungeonTask) => {
    // Cerrojo síncrono: el doble toque duplicaba el XP de la tarea.
    if (!userId || !dungeon || busy || saving.current || dungeon.status !== 'active') return;
    if (task.done) return;
    saving.current = true;
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
      saving.current = false;
      setBusy(false);
    }
  };

  const claimLoot = async () => {
    // El guard de status evita reclamar el botín dos veces (reentrada / doble pantalla).
    if (!userId || !dungeon || busy || dungeon.status !== 'active') return;
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
        'CAMPAÑA DESPEJADA',
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
    Alert.alert('Abandonar campaña', `¿Eliminar "${dungeon.title}" y todas sus tareas?`, [
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

  const removeTask = (t: DungeonTask) =>
    Alert.alert('Eliminar tarea', t.title, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteTask(t.id);
          await load();
        },
      },
    ]);

  if (!dungeon) {
    return (
      <Screen>
        <ScreenHeader onBack={() => router.back()} eyebrow="Campaña" title="Abriendo" />
        <EmptyState icon="flag-outline" title="El sistema busca la campaña" body="Un momento." />
      </Screen>
    );
  }

  const done = tasks.filter((t) => t.done).length;
  const bosses = tasks.filter((t) => t.is_boss);
  const bossesDone = bosses.filter((t) => t.done).length;
  const allDone = tasks.length > 0 && done === tasks.length;
  const active = dungeon.status === 'active';
  const cleared = dungeon.status === 'cleared';
  const ratio = tasks.length > 0 ? done / tasks.length : 0;
  const loot = DUNGEON_CLEAR_XP[dungeon.rank];
  const fecha = plazo(dungeon.deadline);

  const subtitulo = cleared
    ? `Despejada${dungeon.cleared_at ? ` el ${dungeon.cleared_at.slice(0, 10)}` : ''}. Botín cobrado: +${loot} XP.`
    : tasks.length === 0
      ? `Entrena ${dungeon.stat}. Botín al despejar: ${loot} XP.`
      : allDone
        ? 'Todas las tareas hechas. El botín espera.'
        : `${done}/${tasks.length} tareas · entrena ${dungeon.stat} · botín ${loot} XP`;

  return (
    <Screen>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            onBack={() => router.back()}
            eyebrow={`Campaña · Rango ${dungeon.rank}`}
            title={dungeon.title}
            subtitle={subtitulo}
            right={
              <View style={styles.rankBox} accessibilityLabel={`Rango ${dungeon.rank}`}>
                <Text style={styles.rankLetter}>{dungeon.rank}</Text>
              </View>
            }
            action={
              active
                ? { icon: 'add', label: 'Añadir una tarea', onPress: () => setFormOpen(true), solid: !allDone }
                : undefined
            }
          />
        </FadeIn>

        <FadeIn index={1}>
          <Card accent={cleared ? colors.gold : undefined}>
            <View style={styles.progressRow}>
              <ProgressRing ratio={ratio} size={84} stroke={5} color={cleared ? colors.gold : colors.steel} sublabel={cleared ? 'despejada' : 'hecho'} />
              <StatRow style={styles.stats}>
                <Stat value={`${done}/${tasks.length}`} label="Tareas" size="sm" />
                <Stat value={bosses.length > 0 ? `${bossesDone}/${bosses.length}` : '—'} label="Jefes" size="sm" tone="steel" />
                <Stat value={fecha.valor} label={fecha.label} size="sm" tone={active ? fecha.tone : 'text'} />
              </StatRow>
            </View>
          </Card>
        </FadeIn>

        {cleared ? (
          <FadeIn index={2}>
            <Card variant="outline" accent={colors.gold}>
              <View style={styles.clearedRow}>
                <Tag tone="gold">Despejada</Tag>
                <Text style={styles.clearedText}>{voice.dungeonCleared(dungeon.title)}</Text>
              </View>
            </Card>
          </FadeIn>
        ) : null}

        {allDone && active ? (
          <FadeIn index={2}>
            <Card variant="outline" accent={colors.gold}>
              <Text style={styles.lootEyebrow}>BOTÍN DISPONIBLE</Text>
              <Text style={styles.lootText}>Cada tarea y cada jefe han caído. Reclama lo que es tuyo.</Text>
              <SystemButton
                title={`Reclamar botín · +${loot} XP`}
                onPress={claimLoot}
                loading={busy}
                icon="trophy-outline"
                style={{ marginTop: 14 }}
              />
            </Card>
          </FadeIn>
        ) : null}

        <FadeIn index={3}>
          <Section title="Tareas" meta={tasks.length > 0 ? `${done}/${tasks.length}` : undefined} tone="steel">
            {tasks.length === 0 ? (
              <Card variant="outline">
                <EmptyState
                  compact
                  icon="list-outline"
                  title="Sin tareas todavía"
                  body="Desglosa la campaña: cada tarea es un paso y cada hito, un jefe que paga el doble."
                  action={active ? { label: 'Añadir la primera', onPress: () => setFormOpen(true) } : undefined}
                />
              </Card>
            ) : (
              <Card padded={false} style={styles.lista}>
                {tasks.map((t, i) => {
                  const xp = dungeonTaskXp(t.difficulty, t.is_boss);
                  return (
                    <Row
                      key={t.id}
                      first={i === 0}
                      leading={<Check checked={t.done} tone={t.is_boss ? 'steel' : 'accent'} />}
                      title={t.title}
                      done={t.done}
                      detail={
                        <View style={styles.taskMeta}>
                          {t.is_boss ? <Tag tone="steel">Jefe</Tag> : null}
                          <Text style={styles.taskMetaText}>{DIFFICULTY_LABEL[t.difficulty]}</Text>
                        </View>
                      }
                      trailing={
                        <RowValue tone={t.done ? 'steel' : 'dim'} strong={t.done}>
                          +{xp} XP
                        </RowValue>
                      }
                      onPress={() => toggleTask(t)}
                      onLongPress={() => removeTask(t)}
                      disabled={t.done}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: t.done, disabled: t.done }}
                      accessibilityLabel={`${t.title}${t.is_boss ? ', jefe' : ''}${t.done ? ', hecha' : `, pendiente, ${xp} XP`}. Mantén pulsado para eliminarla.`}
                    />
                  );
                })}
              </Card>
            )}
            {tasks.length > 0 && active ? (
              <Text style={styles.nota}>Toca una tarea para darla por hecha. Mantén pulsada para eliminarla.</Text>
            ) : null}
          </Section>
        </FadeIn>

        <FadeIn index={4}>
          <SystemButton
            title={cleared ? 'Borrar la campaña' : 'Abandonar la campaña'}
            variant="danger"
            icon="trash-outline"
            onPress={removeDungeon}
          />
        </FadeIn>
      </Stagger>

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdropTap} onPress={() => setFormOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar" />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>NUEVA TAREA</Text>
            <Text style={styles.sheetTitle}>¿Cuál es el siguiente paso?</Text>
            <Text style={styles.label}>Tarea</Text>
            <TextInput
              style={styles.input}
              value={taskTitle}
              onChangeText={setTaskTitle}
              placeholder="Ej. Redactar el capítulo 2"
              placeholderTextColor={colors.textFaint}
              autoFocus
              accessibilityLabel="Nombre de la tarea"
            />
            <Text style={styles.label}>Dificultad</Text>
            <ChipWrap>
              {DIFFICULTIES.map((d) => (
                <Chip
                  key={d}
                  label={DIFFICULTY_LABEL[d]}
                  selected={difficulty === d}
                  onPress={() => setDifficulty(d)}
                  tone="steel"
                  accessibilityLabel={`Dificultad ${DIFFICULTY_LABEL[d]}`}
                />
              ))}
            </ChipWrap>
            <Text style={styles.label}>Tipo</Text>
            <ChipWrap>
              <Chip label="Tarea" selected={!isBoss} onPress={() => setIsBoss(false)} tone="steel" accessibilityLabel="Tarea normal" />
              <Chip label="Jefe" icon="skull-outline" selected={isBoss} onPress={() => setIsBoss(true)} tone="steel" accessibilityLabel="Jefe: hito que paga el doble" />
            </ChipWrap>
            <Text style={styles.hint}>
              {isBoss ? 'Un jefe es un hito. Paga el doble: ' : 'Paga '}
              {dungeonTaskXp(difficulty, isBoss)} XP al caer.
            </Text>
            <SystemButton title="Añadir tarea" onPress={addTask} disabled={!taskTitle.trim()} style={{ marginTop: 22 }} />
            <SystemButton title="Cancelar" variant="ghost" onPress={() => setFormOpen(false)} style={{ marginTop: 6 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <LevelUpOverlay level={levelUp} onClose={() => setLevelUp(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rankBox: {
    width: 56,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.steelDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  rankLetter: { fontFamily: fonts.brand, fontSize: 30, lineHeight: 36, color: colors.steel },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stats: { flex: 1, minWidth: 0 },
  clearedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clearedText: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.text },
  lootEyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.gold },
  lootText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.text, marginTop: 6 },
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  taskMetaText: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
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
  sheetEyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.steel },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 24, letterSpacing: -0.5, color: colors.text, marginTop: 6, marginBottom: 4 },
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
});
