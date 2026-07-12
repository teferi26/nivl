import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { QuestInput } from '@/lib/data';
import { BONUS_BY_DIFFICULTY, DIFFICULTIES, DIFFICULTY_LABEL, STAT_LABEL, STATS, XP_BY_DIFFICULTY } from '@/lib/game';
import { colors, fonts } from '@/lib/theme';
import type { Difficulty, Stat } from '@/lib/types';
import { SystemButton } from './SystemButton';

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: QuestInput) => Promise<void>;
}

export function QuestForm({ visible, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [stat, setStat] = useState<Stat>('FUE');
  const [difficulty, setDifficulty] = useState<Difficulty>('media');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [requiresEvidence, setRequiresEvidence] = useState(false);
  const [isBonus, setIsBonus] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const reset = () => {
    setTitle('');
    setStat('FUE');
    setDifficulty('media');
    setDays([1, 2, 3, 4, 5, 6, 7]);
    setRequiresEvidence(false);
    setIsBonus(false);
  };

  const submit = async () => {
    if (!title.trim() || days.length === 0 || saving) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        stat,
        difficulty,
        days_of_week: days,
        requires_evidence: requiresEvidence,
        is_bonus: isBonus,
      });
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.heading}>NUEVA MISIÓN</Text>

            <Text style={styles.label}>Título</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ej. Gimnasio — pierna"
              placeholderTextColor={colors.textFaint}
            />

            <Text style={styles.label}>Estadística</Text>
            <View style={styles.chips}>
              {STATS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setStat(s)}
                  style={[styles.chip, stat === s && styles.chipOn]}
                >
                  <Text style={[styles.chipText, stat === s && styles.chipTextOn]}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>{STAT_LABEL[stat]}</Text>

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
            <Text style={styles.hint}>{XP_BY_DIFFICULTY[difficulty]} XP base</Text>

            <Text style={styles.label}>Días de la semana</Text>
            <View style={styles.chips}>
              {DAY_LABELS.map((label, i) => {
                const d = i + 1;
                const on = days.includes(d);
                return (
                  <Pressable
                    key={d}
                    onPress={() => toggleDay(d)}
                    style={[styles.day, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Evidencia obligatoria</Text>
                <Text style={styles.hint}>Exige foto al completar la misión</Text>
              </View>
              <Switch
                value={requiresEvidence}
                onValueChange={setRequiresEvidence}
                trackColor={{ false: colors.track, true: colors.cyanDim }}
                thumbColor={requiresEvidence ? colors.cyan : colors.textFaint}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Misión extra (Puntos Bonus)</Text>
                <Text style={styles.hint}>
                  Da {BONUS_BY_DIFFICULTY[difficulty]} PB canjeables por descanso, en vez de XP
                </Text>
              </View>
              <Switch
                value={isBonus}
                onValueChange={setIsBonus}
                trackColor={{ false: colors.track, true: '#5c4a12' }}
                thumbColor={isBonus ? colors.amber : colors.textFaint}
              />
            </View>

            <SystemButton
              title="Crear misión"
              onPress={submit}
              loading={saving}
              disabled={!title.trim() || days.length === 0}
              style={{ marginTop: 18 }}
            />
            <SystemButton title="Cancelar" variant="outline" onPress={onClose} style={{ marginTop: 10 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 14, 0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.panel,
    borderTopWidth: 1.5,
    borderTopColor: colors.cyanDim,
    padding: 20,
    paddingBottom: 34,
    maxHeight: '88%',
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 16,
    letterSpacing: 3,
    color: colors.cyan,
    marginBottom: 14,
  },
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.cyanDim,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  day: {
    borderWidth: 1,
    borderColor: colors.cyanDim,
    width: 38,
    paddingVertical: 7,
    alignItems: 'center',
  },
  chipOn: {
    backgroundColor: colors.cyanFaint,
    borderColor: colors.cyan,
  },
  chipText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textDim,
  },
  chipTextOn: {
    color: colors.cyan,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textFaint,
    marginTop: 5,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
  },
  switchLabel: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
});
