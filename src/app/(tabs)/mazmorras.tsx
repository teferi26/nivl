import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { XPBar } from '@/components/XPBar';
import {
  avisar,
  Button,
  Card,
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
import { ink } from '@/design/tokens';
import { useAuth } from '@/lib/auth';
import { ensureProfile } from '@/lib/data';
import { createDungeon, fetchDungeons } from '@/lib/dungeons';
import { DUNGEON_CLEAR_XP, DUNGEON_RANKS, STATS } from '@/lib/game';
import { kindMeta } from '@/lib/kinds';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import type { Dungeon, DungeonRank, Stat } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';

interface DungeonWithProgress extends Dungeon {
  total: number;
  doneCount: number;
}

function diasHasta(fecha: string | null): { texto: string; urgente: boolean } | null {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(`${fecha}T00:00:00`);
  const dias = Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000);
  if (dias < 0) return { texto: `${-dias} d de retraso`, urgente: true };
  if (dias === 0) return { texto: 'Hoy', urgente: true };
  if (dias === 1) return { texto: 'Mañana', urgente: true };
  return { texto: `${dias} días`, urgente: dias <= 3 };
}

export default function Campañas() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [dungeons, setDungeons] = useState<DungeonWithProgress[]>([]);
  const [kind, setKind] = useState<unknown>('general');
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [rank, setRank] = useState<DungeonRank>('D');
  const [stat, setStat] = useState<Stat>('INT');
  const [saving, setSaving] = useState(false);
  // Hasta la primera carga se pintan huecos: nunca "Ninguna campaña abierta"
  // antes de saberlo (salía un instante al entrar).
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Las tres consultas no dependen entre sí: van a la vez.
      const [all, { data: tasks, error: tasksError }, p] = await Promise.all([
        fetchDungeons(),
        supabase.from('dungeon_tasks').select('dungeon_id, done'),
        userId ? ensureProfile(userId).catch(() => null) : Promise.resolve(null),
      ]);
      if (tasksError) throw tasksError;
      const rows = (tasks ?? []) as { dungeon_id: string; done: boolean }[];
      setDungeons(
        all.map((d) => ({
          ...d,
          total: rows.filter((t) => t.dungeon_id === d.id).length,
          doneCount: rows.filter((t) => t.dungeon_id === d.id && t.done).length,
        })),
      );
      if (p) setKind(p.profile_kind);
      setLoadError(null);
    } catch (e) {
      setLoadError(mensajeSistema(e));
    } finally {
      setLoaded(true);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useAlVolver(load);

  const onCreate = async () => {
    if (!userId || !title.trim() || saving) return;
    setSaving(true);
    try {
      const d = await createDungeon(userId, { title: title.trim(), rank, stat });
      setFormOpen(false);
      setTitle('');
      router.push({ pathname: '/dungeon/[id]', params: { id: d.id } });
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      setSaving(false);
    }
  };

  const meta = kindMeta(kind);
  const active = dungeons.filter((d) => d.status === 'active');
  const cleared = dungeons.filter((d) => d.status === 'cleared');
  const botinTotal = cleared.reduce((s, d) => s + DUNGEON_CLEAR_XP[d.rank], 0);

  return (
    <Screen>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            eyebrow="Campañas"
            title={meta.campaignsLabel}
            subtitle={meta.campaignsHint}
            action={{ icon: 'add', label: 'Abrir una campaña nueva', onPress: () => setFormOpen(true), solid: true }}
          />
        </FadeIn>

        {!loaded ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Cargando tus campañas">
            <Skeleton height={11} width={90} style={styles.skEyebrow} />
            <Skeleton height={104} style={styles.skCard} />
            <Skeleton height={104} style={styles.skCard} />
            <SkeletonRows rows={2} />
          </View>
        ) : null}

        {loaded && loadError && dungeons.length === 0 ? (
          <Card variant="outline">
            <EmptyState
              compact
              icon="cloud-offline-outline"
              title="El sistema no responde"
              body={loadError}
              action={{ label: 'Reintentar', onPress: load }}
            />
          </Card>
        ) : null}

        {loaded && !(loadError && dungeons.length === 0) ? (
          <FadeIn index={1}>
            <Section title="Abiertas" meta={active.length > 0 ? `${active.length}` : undefined}>
              {active.length === 0 ? (
                <Card variant="outline">
                  <EmptyState
                    icon="flag-outline"
                    title="Ninguna campaña abierta"
                    body="Cada proyecto u objetivo grande es una campaña: tareas, un jefe final y una fecha. Al despejarla hay botín."
                    action={{ label: 'Abrir la primera', onPress: () => setFormOpen(true), variant: 'solid' }}
                  />
                </Card>
              ) : (
                active.map((d, i) => {
                  const plazo = diasHasta(d.deadline);
                  const ratio = d.total > 0 ? d.doneCount / d.total : 0;
                  return (
                    <FadeIn key={d.id} index={i}>
                      <Card
                        onPress={() => router.push({ pathname: '/dungeon/[id]', params: { id: d.id } })}
                        accessibilityLabel={`Abrir la campaña ${d.title}, rango ${d.rank}`}
                      >
                        <View style={styles.row}>
                          <View style={styles.rankBox}>
                            <Text style={styles.rankLetter}>{d.rank}</Text>
                          </View>
                          <View style={styles.body}>
                            <Text style={styles.dungeonTitle} numberOfLines={2}>
                              {d.title}
                            </Text>
                            <View style={styles.metaRow}>
                              <Text style={styles.meta}>
                                {d.doneCount}/{d.total} tareas · {d.stat}
                              </Text>
                              {plazo ? (
                                plazo.urgente ? (
                                  <Tag tone="alerta">{plazo.texto}</Tag>
                                ) : (
                                  <View style={styles.plazo}>
                                    <Ionicons name="time-outline" size={12} color={ink.ink6} />
                                    <Text style={[styles.meta, styles.plazoTexto]}>{plazo.texto}</Text>
                                  </View>
                                )
                              ) : null}
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                        </View>
                        <View style={styles.progress}>
                          <XPBar ratio={ratio} height={5} />
                          <View style={styles.progressMeta}>
                            <Text style={styles.progressPct}>{Math.round(ratio * 100)}%</Text>
                            <Text style={styles.botin}>Botín {DUNGEON_CLEAR_XP[d.rank]} XP</Text>
                          </View>
                        </View>
                      </Card>
                    </FadeIn>
                  );
                })
              )}
            </Section>
          </FadeIn>
        ) : null}

        {loaded && cleared.length > 0 ? (
          <FadeIn index={2}>
            <Section title="Despejadas" meta={`${cleared.length} · ${botinTotal} XP`} tone="logro">
              <Card padded={false} style={styles.lista}>
                {cleared.map((d, i) => (
                  <Row
                    key={d.id}
                    first={i === 0}
                    leading={
                      <View style={styles.rankMini}>
                        <Text style={styles.rankMiniLetter}>{d.rank}</Text>
                      </View>
                    }
                    title={d.title}
                    muted
                    detail={d.cleared_at ? `Despejada el ${d.cleared_at.slice(0, 10)}` : undefined}
                    trailing={<RowValue tone="accent">+{DUNGEON_CLEAR_XP[d.rank]} XP</RowValue>}
                    onPress={() => router.push({ pathname: '/dungeon/[id]', params: { id: d.id } })}
                  />
                ))}
              </Card>
            </Section>
          </FadeIn>
        ) : null}
      </Stagger>

      <Sheet
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        eyebrow="Nueva campaña"
        title="¿Qué vas a conquistar?"
        footer={
          <>
            <Button title="Abrir campaña" size="lg" onPress={onCreate} loading={saving} disabled={!title.trim()} />
            <Button title="Cancelar" variant="ghost" onPress={() => setFormOpen(false)} />
          </>
        }
      >
        <Text style={[styles.label, styles.labelPrimero]}>Nombre</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Ej. Lanzar la web · Aprobar Cálculo · Media maratón"
          placeholderTextColor={colors.textFaint}
          autoFocus
          accessibilityLabel="Nombre de la campaña"
        />
        <Text style={styles.label}>Envergadura</Text>
        <ChipWrap>
          {DUNGEON_RANKS.map((r) => (
            <Chip key={r} label={r} selected={rank === r} onPress={() => setRank(r)} accessibilityLabel={`Rango ${r}`} />
          ))}
        </ChipWrap>
        <Text style={styles.hint}>De E (una semana) a S (una temporada entera). Botín al despejar: {DUNGEON_CLEAR_XP[rank]} XP.</Text>
        <Text style={styles.label}>Qué entrena</Text>
        <ChipWrap>
          {STATS.map((s) => (
            <Chip key={s} label={s} selected={stat === s} onPress={() => setStat(s)} accessibilityLabel={`Estadística ${s}`} />
          ))}
        </ChipWrap>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rankBox: {
    width: 46,
    height: 46,
    borderWidth: 1.5,
    borderColor: ink.ink6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankLetter: { fontFamily: fonts.brand, fontSize: 22, color: colors.text },
  body: { flex: 1, minWidth: 0 },
  dungeonTitle: { fontFamily: fonts.heading, fontSize: 16.5, lineHeight: 21, letterSpacing: -0.2, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  plazo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  plazoTexto: { color: ink.ink6 },
  progress: { marginTop: 14 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressPct: { fontFamily: fonts.number, fontSize: 12, color: colors.text },
  botin: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  rankMini: { width: 28, height: 28, borderWidth: 1, borderColor: ink.ink4, alignItems: 'center', justifyContent: 'center' },
  rankMiniLetter: { fontFamily: fonts.brand, fontSize: 13, color: ink.ink6 },
  skEyebrow: { marginBottom: 12 },
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
