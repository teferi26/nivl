import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { vibrar } from '@/design/haptics';
import { ink } from '@/design/tokens';
import type { QuestInput } from '@/lib/data';
import {
  BONUS_BY_DIFFICULTY,
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  STAT_LABEL,
  STATS,
  XP_BY_DIFFICULTY,
} from '@/lib/game';
import { colors, fonts } from '@/lib/theme';
import { mensajeSistema } from '@/lib/validation';
import type { Difficulty, Quest, Stat } from '@/lib/types';

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIARIA = [1, 2, 3, 4, 5, 6, 7];
const LABORABLES = [1, 2, 3, 4, 5];
const FINDE = [6, 7];

const mismosDias = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d));

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: QuestInput) => Promise<void>;
  // Modo edición: precarga la misión y muestra Guardar/Eliminar.
  initial?: Quest | null;
  onDelete?: (quest: Quest) => Promise<void>;
}

/**
 * El formulario de misión, en la hoja del kit (Sheet): la misma gramática que
 * la hoja de campañas para que crear una misión y abrir una campaña se sientan
 * el mismo gesto. El teclado lo gestiona la hoja; las acciones van en su pie.
 */
export function QuestForm({ visible, onClose, onSubmit, initial, onDelete }: Props) {
  const [title, setTitle] = useState('');
  const [stat, setStat] = useState<Stat>('FUE');
  const [difficulty, setDifficulty] = useState<Difficulty>('media');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [requiresEvidence, setRequiresEvidence] = useState(false);
  const [isBonus, setIsBonus] = useState(false);
  const [saving, setSaving] = useState(false);

  const editing = !!initial;

  useEffect(() => {
    if (!visible) return;
    if (initial) {
      setTitle(initial.title);
      setStat(initial.stat);
      setDifficulty(initial.difficulty);
      setDays(initial.days_of_week);
      setRequiresEvidence(initial.requires_evidence);
      setIsBonus(initial.is_bonus);
    } else {
      setTitle('');
      setStat('FUE');
      setDifficulty('media');
      setDays([1, 2, 3, 4, 5, 6, 7]);
      setRequiresEvidence(false);
      setIsBonus(false);
    }
  }, [visible, initial]);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
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
      onClose();
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!initial || !onDelete) return;
    const ok = await confirmar({
      titulo: 'Eliminar misión',
      mensaje: `"${initial.title}" y todo su historial de completadas. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar',
      destructivo: true,
    });
    if (!ok) return;
    vibrar('destructiva');
    try {
      // La hoja solo se cierra si se ha borrado de verdad.
      await onDelete(initial);
      onClose();
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    }
  };

  const pago = isBonus
    ? `${BONUS_BY_DIFFICULTY[difficulty]} PB al completarla, canjeables por descanso.`
    : `${XP_BY_DIFFICULTY[difficulty]} XP base. Con foto, +25 %; la racha lo multiplica.`;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={editing ? 'Editar misión' : 'Nueva misión'}
      title={editing ? 'Ajusta la misión' : '¿Qué vas a exigirte?'}
      footer={
        <>
          <Button
            title={editing ? 'Guardar cambios' : 'Crear misión'}
            size="lg"
            onPress={submit}
            loading={saving}
            disabled={!title.trim() || days.length === 0}
          />
          {editing && onDelete ? (
            <Button title="Eliminar misión" variant="danger" icon="trash-outline" onPress={confirmDelete} />
          ) : null}
          <Button title="Cancelar" variant="ghost" onPress={onClose} />
        </>
      }
    >
      <Text style={[styles.label, styles.labelPrimero]}>Misión</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Ej. Gimnasio · pierna"
        placeholderTextColor={colors.textFaint}
        autoFocus={!editing}
        accessibilityLabel="Nombre de la misión"
      />

      <Text style={styles.label}>Qué entrena</Text>
      <ChipWrap>
        {STATS.map((s) => (
          <Chip key={s} label={s} selected={stat === s} onPress={() => setStat(s)} accessibilityLabel={STAT_LABEL[s]} />
        ))}
      </ChipWrap>
      <Text style={styles.hint}>{STAT_LABEL[stat]}</Text>

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
      <Text style={styles.hint}>{pago}</Text>

      <Text style={styles.label}>Días</Text>
      <View style={styles.days}>
        {DAY_LABELS.map((label, i) => {
          const d = i + 1;
          const on = days.includes(d);
          return (
            <Pressable
              key={d}
              onPress={() => toggleDay(d)}
              style={({ pressed }) => [styles.day, on && styles.dayOn, pressed && styles.pressed]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={DAY_NAMES[i]}
            >
              <Text style={[styles.dayText, on && styles.dayTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <ChipWrap style={{ marginTop: 10 }}>
        <Chip small label="Diaria" selected={mismosDias(days, DIARIA)} onPress={() => setDays(DIARIA)} accessibilityLabel="Todos los días" />
        <Chip small label="Entre semana" selected={mismosDias(days, LABORABLES)} onPress={() => setDays(LABORABLES)} accessibilityLabel="De lunes a viernes" />
        <Chip small label="Finde" selected={mismosDias(days, FINDE)} onPress={() => setDays(FINDE)} accessibilityLabel="Sábado y domingo" />
      </ChipWrap>
      {days.length === 0 ? <Text style={[styles.hint, styles.hintAviso]}>Elige al menos un día.</Text> : null}

      <Text style={styles.label}>Evidencia</Text>
      <ChipWrap>
        <Chip label="Sin foto" selected={!requiresEvidence} onPress={() => setRequiresEvidence(false)} accessibilityLabel="Sin evidencia obligatoria" />
        <Chip
          label="Foto obligatoria"
          icon="camera-outline"
          selected={requiresEvidence}
          onPress={() => setRequiresEvidence(true)}
          accessibilityLabel="Exigir foto al completar la misión"
        />
      </ChipWrap>
      <Text style={styles.hint}>{requiresEvidence ? 'No se podrá completar sin foto. Paga un 25 % más.' : 'La foto es opcional al completar.'}</Text>

      <Text style={styles.label}>Qué paga</Text>
      <ChipWrap>
        <Chip label="XP" selected={!isBonus} onPress={() => setIsBonus(false)} accessibilityLabel="Misión normal: paga XP" />
        <Chip label="Puntos bonus" selected={isBonus} onPress={() => setIsBonus(true)} accessibilityLabel="Misión extra: paga puntos bonus" />
      </ChipWrap>
      <Text style={styles.hint}>
        {isBonus
          ? 'Misión extra: no da XP ni cuenta para la racha. Sus PB se canjean por descanso en el contrato.'
          : 'Misión del día: cuenta para la racha y se penaliza si queda sin hacer.'}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
  hintAviso: { fontFamily: fonts.semibold, color: ink.ink9 },
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
  days: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayText: { fontFamily: fonts.heading, fontSize: 13, color: colors.text },
  dayTextOn: { color: colors.bg },
  pressed: { opacity: 0.7 },
});
