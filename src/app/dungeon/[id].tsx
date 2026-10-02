import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { LevelUpOverlay } from '@/components/LevelUpOverlay';
import {
  avisar,
  Button,
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
  Sheet,
  Skeleton,
  SkeletonRows,
  Stagger,
  Stat,
  StatRow,
  Tag,
  volver,
} from '@/components/ui';
import { confirmar } from '@/components/ui/confirmar';
import { vibrar } from '@/design/haptics';
import { ink } from '@/design/tokens';
import { evaluateAchievements, sincronizarRango, unlockAchievements } from '@/lib/achievements';
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
import { mensajeSistema } from '@/lib/validation';

/**
 * Días que quedan hasta la fecha límite, en la voz del sistema. `vencida`
 * (la fecha ya pasó) pone la tarjeta de progreso en alerta; `urgente` solo
 * sube el dato a blanco puro.
 */
function plazo(fecha: string | null): { valor: string; label: string; urgente: boolean; vencida: boolean } {
  if (!fecha) return { valor: '—', label: 'Sin fecha', urgente: false, vencida: false };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(`${fecha}T00:00:00`);
  const dias = Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000);
  if (dias < 0) return { valor: `${-dias}`, label: 'Días de retraso', urgente: true, vencida: true };
  if (dias === 0) return { valor: 'Hoy', label: 'Fecha límite', urgente: true, vencida: false };
  return { valor: `${dias}`, label: dias === 1 ? 'Día restante' : 'Días restantes', urgente: dias <= 3, vencida: false };
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
  // Cerrojos síncronos: el estado de React llega tarde a un doble toque.
  const cobrando = useRef(false);
  const anadiendo = useRef(false);
  const [adding, setAdding] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setLoaded(true);
      return;
    }
    try {
      const [d, t] = await Promise.all([fetchDungeon(id), fetchTasks(id)]);
      setDungeon(d);
      setTasks(t);
      setLoadError(null);
    } catch (e) {
      setLoadError(mensajeSistema(e));
    } finally {
      setLoaded(true);
    }
  }, [id]);

  const reintentar = () => {
    setLoaded(false);
    load();
  };

  useEffect(() => {
    load();
  }, [load]);

  const addTask = async () => {
    if (!userId || !id || !taskTitle.trim() || anadiendo.current) return;
    anadiendo.current = true;
    setAdding(true);
    try {
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
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      anadiendo.current = false;
      setAdding(false);
    }
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
        dungeon_id: dungeon.id,
        task_id: task.id,
        dungeon: dungeon.title,
        task: task.title,
        boss: task.is_boss,
      });
      // El rango se recalcula en segundo plano: no bloquea ni rompe el cobro.
      sincronizarRango().catch(() => []);
      vibrar(task.is_boss ? 'misionExtra' : 'mision');
      if (res.leveledUp) setLevelUp(res.newLevel);
      await load();
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const claimLoot = async () => {
    // El guard de status evita reclamar el botín dos veces (reentrada / doble
    // pantalla) y el cerrojo, tomado antes del primer await, el doble toque:
    // `busy` es estado y no llega a tiempo al segundo toque.
    if (!userId || !dungeon || busy || cobrando.current || dungeon.status !== 'active') return;
    cobrando.current = true;
    setBusy(true);
    try {
      await updateDungeon(dungeon.id, { status: 'cleared', cleared_at: new Date().toISOString() });
      const profile = await ensureProfile(userId);
      const loot = DUNGEON_CLEAR_XP[dungeon.rank];
      const res = await awardXp(profile, loot, dungeon.stat, 'dungeon_cleared', {
        dungeon_id: dungeon.id,
        dungeon: dungeon.title,
        rank: dungeon.rank,
      });
      sincronizarRango().catch(() => []);
      const cleared = await countClearedDungeons();
      const fresh = await unlockAchievements(userId, evaluateAchievements({ dungeonsCleared: cleared }));
      vibrar('misionExtra');
      avisar(
        'CAMPAÑA DESPEJADA',
        `${voice.dungeonCleared(dungeon.title)}\n\nBotín: +${Math.max(0, res.profile.xp_total - profile.xp_total)} XP${fresh.length > 0 ? `\n${voice.achievement()} ${fresh.map((a) => a.name).join(', ')}` : ''}`,
      );
      if (res.leveledUp) setLevelUp(res.newLevel);
      await load();
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      cobrando.current = false;
      setBusy(false);
    }
  };

  const removeDungeon = async () => {
    if (!dungeon) return;
    const ok = await confirmar({
      titulo: 'Abandonar campaña',
      mensaje: `¿Eliminar "${dungeon.title}" y todas sus tareas?`,
      confirmar: 'Eliminar',
      destructivo: true,
    });
    if (!ok) return;
    vibrar('destructiva');
    try {
      await deleteDungeon(dungeon.id);
      volver(router);
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    }
  };

  const removeTask = async (t: DungeonTask) => {
    const ok = await confirmar({ titulo: 'Eliminar tarea', mensaje: t.title, confirmar: 'Eliminar', destructivo: true });
    if (!ok) return;
    vibrar('destructiva');
    try {
      await deleteTask(t.id);
      await load();
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    }
  };

  if (!dungeon) {
    // Cargando: huecos. Fallo: el motivo y una salida. Nunca un "un momento"
    // que no acaba.
    return (
      <Screen>
        <ScreenHeader onBack={() => volver(router)} eyebrow="Campaña" title={loaded ? 'Campaña' : 'Abriendo'} />
        {!loaded ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Cargando la campaña">
            <Skeleton height={116} style={styles.skCard} />
            <Skeleton height={11} width={90} style={styles.skEyebrow} />
            <SkeletonRows rows={4} />
          </View>
        ) : (
          <Card variant="outline">
            <EmptyState
              compact
              icon={loadError ? 'cloud-offline-outline' : 'flag-outline'}
              title={loadError ? 'El sistema no responde' : 'La campaña no está'}
              body={loadError ?? 'Puede que se haya borrado desde otro dispositivo.'}
              action={loadError ? { label: 'Reintentar', onPress: reintentar } : { label: 'Volver', onPress: () => volver(router) }}
            />
          </Card>
        )}
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
            onBack={() => volver(router)}
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
          <Card variant={cleared ? 'logro' : active && fecha.vencida ? 'alerta' : 'surface'}>
            <View style={styles.progressRow}>
              <ProgressRing ratio={ratio} size={84} stroke={5} sublabel={cleared ? 'despejada' : 'hecho'} />
              <StatRow style={styles.stats}>
                <Stat value={`${done}/${tasks.length}`} label="Tareas" size="sm" />
                <Stat value={bosses.length > 0 ? `${bossesDone}/${bosses.length}` : '—'} label="Jefes" size="sm" />
                <Stat value={fecha.valor} label={fecha.label} size="sm" tone={active && fecha.urgente ? 'accent' : 'text'} />
              </StatRow>
            </View>
          </Card>
        </FadeIn>

        {cleared ? (
          <FadeIn index={2}>
            <Card variant="logro">
              <View style={styles.clearedRow}>
                <Tag tone="dim">Despejada</Tag>
                <Text style={styles.clearedText}>{voice.dungeonCleared(dungeon.title)}</Text>
              </View>
            </Card>
          </FadeIn>
        ) : null}

        {allDone && active ? (
          <FadeIn index={2}>
            {/* La única inversión de la pantalla: el Button primario de dentro
                se invierte solo (SuperficieContext) y queda negro sobre blanco. */}
            <Card variant="inverse">
              <Text style={styles.lootEyebrow}>Botín disponible</Text>
              <Text style={styles.lootText}>Cada tarea y cada jefe han caído. Reclama lo que es tuyo.</Text>
              <Button
                title={`Reclamar botín · +${loot} XP`}
                size="lg"
                onPress={claimLoot}
                loading={busy}
                icon="trophy-outline"
                style={{ marginTop: 14 }}
              />
            </Card>
          </FadeIn>
        ) : null}

        <FadeIn index={3}>
          <Section title="Tareas" meta={tasks.length > 0 ? `${done}/${tasks.length}` : undefined}>
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
                      leading={<Check checked={t.done} />}
                      title={t.title}
                      done={t.done}
                      detail={
                        <View style={styles.taskMeta}>
                          {t.is_boss ? <Tag tone="dim">Jefe</Tag> : null}
                          <Text style={styles.taskMetaText}>{DIFFICULTY_LABEL[t.difficulty]}</Text>
                        </View>
                      }
                      trailing={
                        <RowValue tone={t.done ? 'accent' : 'dim'} strong={t.done}>
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
          <Button
            title={cleared ? 'Borrar la campaña' : 'Abandonar la campaña'}
            variant="danger"
            icon="trash-outline"
            onPress={removeDungeon}
          />
        </FadeIn>
      </Stagger>

      <Sheet
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        eyebrow="Nueva tarea"
        title="¿Cuál es el siguiente paso?"
        footer={
          <>
            <Button title="Añadir tarea" size="lg" onPress={addTask} loading={adding} disabled={!taskTitle.trim()} />
            <Button title="Cancelar" variant="ghost" onPress={() => setFormOpen(false)} />
          </>
        }
      >
        <Text style={[styles.label, styles.labelPrimero]}>Tarea</Text>
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
              accessibilityLabel={`Dificultad ${DIFFICULTY_LABEL[d]}`}
            />
          ))}
        </ChipWrap>
        <Text style={styles.label}>Tipo</Text>
        <ChipWrap>
          <Chip label="Tarea" selected={!isBoss} onPress={() => setIsBoss(false)} accessibilityLabel="Tarea normal" />
          <Chip label="Jefe" icon="skull-outline" selected={isBoss} onPress={() => setIsBoss(true)} accessibilityLabel="Jefe: hito que paga el doble" />
        </ChipWrap>
        <Text style={styles.hint}>
          {isBoss ? 'Un jefe es un hito. Paga el doble: ' : 'Paga '}
          {dungeonTaskXp(difficulty, isBoss)} XP al caer.
        </Text>
      </Sheet>

      <LevelUpOverlay level={levelUp} onClose={() => setLevelUp(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rankBox: {
    width: 56,
    height: 56,
    borderWidth: 1.5,
    borderColor: ink.ink6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  rankLetter: { fontFamily: fonts.brand, fontSize: 30, lineHeight: 36, color: colors.text },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stats: { flex: 1, minWidth: 0 },
  clearedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clearedText: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.text },
  // Sobre la tarjeta inverse (blanca): texto en negro.
  lootEyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', color: ink.ink0 },
  lootText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: ink.ink0, marginTop: 6 },
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  taskMetaText: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 2 },
  skEyebrow: { marginBottom: 12, marginTop: 16 },
  skCard: { marginBottom: 10 },
  label: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  labelPrimero: { marginTop: 4 },
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
