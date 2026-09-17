import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Platform,
  KeyboardAvoidingView,
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
import { XPBar } from '@/components/XPBar';
import { useAuth } from '@/lib/auth';
import { createDungeon, fetchDungeons } from '@/lib/dungeons';
import { DUNGEON_CLEAR_XP, DUNGEON_RANKS, STATS } from '@/lib/game';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import type { Dungeon, DungeonRank, Stat } from '@/lib/types';

interface DungeonWithProgress extends Dungeon {
  total: number;
  doneCount: number;
}

export default function Campañas() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [dungeons, setDungeons] = useState<DungeonWithProgress[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [rank, setRank] = useState<DungeonRank>('D');
  const [stat, setStat] = useState<Stat>('INT');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await fetchDungeons();
      const { data: tasks } = await supabase.from('dungeon_tasks').select('dungeon_id, done');
      const rows = (tasks ?? []) as { dungeon_id: string; done: boolean }[];
      setDungeons(
        all.map((d) => ({
          ...d,
          total: rows.filter((t) => t.dungeon_id === d.id).length,
          doneCount: rows.filter((t) => t.dungeon_id === d.id && t.done).length,
        })),
      );
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onCreate = async () => {
    if (!userId || !title.trim() || saving) return;
    setSaving(true);
    try {
      const d = await createDungeon(userId, { title: title.trim(), rank, stat });
      setFormOpen(false);
      setTitle('');
      router.push({ pathname: '/dungeon/[id]', params: { id: d.id } });
    } catch (e) {
      Alert.alert('Error del sistema', e instanceof Error ? e.message : 'Fallo desconocido');
    } finally {
      setSaving(false);
    }
  };

  const active = dungeons.filter((d) => d.status === 'active');
  const cleared = dungeons.filter((d) => d.status === 'cleared');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>CAMPAÑAS</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir una campaña nueva"
            onPress={() => setFormOpen(true)}
            style={styles.addButton}
          >
            <Ionicons name="add" size={22} color={colors.bg} />
          </Pressable>
        </View>

        {active.length === 0 ? (
          <SystemWindow color={colors.steelDim} fill={colors.panelDeep}>
            <Text style={styles.empty}>
              No hay campañas abiertas. Cada proyecto u objetivo grande de tu vida es una campaña:
              créala y desglósala en monstruos (tareas) y jefes (hitos).
            </Text>
          </SystemWindow>
        ) : (
          active.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => router.push({ pathname: '/dungeon/[id]', params: { id: d.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Abrir la campaña ${d.title}, rango ${d.rank}`}
            >
              <SystemWindow color={colors.steelDim} fill={colors.panelDeep}>
                <View style={styles.row}>
                  <View style={styles.rankBox}>
                    <Text style={styles.rankLetter}>{d.rank}</Text>
                  </View>
                  <View style={styles.body}>
                    <Text style={styles.dungeonTitle} numberOfLines={1}>
                      {d.title}
                    </Text>
                    <Text style={styles.meta}>
                      {d.doneCount}/{d.total} objetivos · stat {d.stat} · botín {DUNGEON_CLEAR_XP[d.rank]} XP
                    </Text>
                    <View style={{ marginTop: 8 }}>
                      <XPBar ratio={d.total > 0 ? d.doneCount / d.total : 0} color={colors.steel} trackColor={colors.track} />
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </View>
              </SystemWindow>
            </Pressable>
          ))
        )}

        {cleared.length > 0 ? (
          <SystemWindow color={colors.line}>
            <Text style={styles.clearedHeader}>DESPEJADAS · {cleared.length}</Text>
            {cleared.map((d) => (
              <Text key={d.id} style={styles.clearedRow}>
                {d.rank} · {d.title}
              </Text>
            ))}
          </SystemWindow>
        ) : null}
      </ScrollView>

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>NUEVA CAMPAÑA</Text>
            <Text style={styles.label}>Nombre del objetivo o proyecto</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ej. Aprobar INGP · Terminar el TFG"
              placeholderTextColor={colors.textFaint}
            />
            <Text style={styles.label}>Rango (envergadura)</Text>
            <View style={styles.chips}>
              {DUNGEON_RANKS.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setRank(r)}
                  style={[styles.chip, rank === r && styles.chipOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: rank === r }}
                  accessibilityLabel={`Rango ${r}`}
                >
                  <Text style={[styles.chipText, rank === r && styles.chipTextOn]}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Stat que entrena</Text>
            <View style={styles.chips}>
              {STATS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setStat(s)}
                  style={[styles.chip, stat === s && styles.chipOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: stat === s }}
                  accessibilityLabel={`Estadística ${s}`}
                >
                  <Text style={[styles.chipText, stat === s && styles.chipTextOn]}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <SystemButton
              title="Abrir campaña"
              onPress={onCreate}
              loading={saving}
              disabled={!title.trim()}
              style={{ marginTop: 20 }}
            />
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
    marginBottom: 14,
  },
  title: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: 4, color: colors.steel },
  addButton: {
    width: 34,
    height: 34,
    backgroundColor: colors.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankBox: {
    width: 42,
    height: 42,
    borderWidth: 1.5,
    borderColor: colors.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankLetter: { fontFamily: fonts.brand, fontSize: 20, color: colors.steel },
  body: { flex: 1, minWidth: 0 },
  dungeonTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, marginTop: 2 },
  clearedHeader: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 2.5,
    color: colors.textFaint,
    marginBottom: 8,
  },
  clearedRow: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, paddingVertical: 3 },
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 14, 0.85)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.panelDeep,
    borderTopWidth: 1.5,
    borderTopColor: colors.steelDim,
    padding: 20,
    paddingBottom: 34,
  },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: 3, color: colors.steel, marginBottom: 6 },
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
    borderColor: colors.steelDim,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.steelDim, paddingHorizontal: 14, paddingVertical: 7 },
  chipOn: { backgroundColor: colors.accentFaint, borderColor: colors.steel },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDim },
  chipTextOn: { color: colors.steel },
});
