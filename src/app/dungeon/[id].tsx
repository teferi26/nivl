// El detalle de una campaña (la ruta conserva su nombre interno). Los datos,
// los cerrojos y la celebración viven en useCampana; lo que se ve, en
// CampanaVista (pura, también en /kit/pantallas). Aquí queda la hoja de
// añadir una tarea.
import { StyleSheet, Text, TextInput } from 'react-native';
import { CampanaVista } from '@/components/campanas/CampanaVista';
import { useCampana } from '@/components/campanas/useCampana';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { DIFFICULTIES, DIFFICULTY_LABEL, dungeonTaskXp } from '@/lib/game';
import { colors, fonts } from '@/lib/theme';

export default function DungeonDetail() {
  const { vista, hojas } = useCampana();
  const h = hojas.tarea;
  return (
    <>
      <CampanaVista {...vista} />
      <Sheet
        visible={h.visible}
        onClose={h.onClose}
        eyebrow="Nueva tarea"
        title="¿Cuál es el siguiente paso?"
        footer={
          <>
            <Button title="Añadir tarea" size="lg" onPress={h.addTask} loading={h.adding} disabled={!h.taskTitle.trim()} />
            <Button title="Cancelar" variant="ghost" onPress={h.onClose} />
          </>
        }
      >
        <Text style={[styles.label, styles.labelPrimero]}>Tarea</Text>
        <TextInput
          style={styles.input}
          value={h.taskTitle}
          onChangeText={h.setTaskTitle}
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
              selected={h.difficulty === d}
              onPress={() => h.setDifficulty(d)}
              accessibilityLabel={`Dificultad ${DIFFICULTY_LABEL[d]}`}
            />
          ))}
        </ChipWrap>
        <Text style={styles.label}>Tipo</Text>
        <ChipWrap>
          <Chip label="Tarea" selected={!h.isBoss} onPress={() => h.setIsBoss(false)} accessibilityLabel="Tarea normal" />
          <Chip label="Jefe" icon="skull-outline" selected={h.isBoss} onPress={() => h.setIsBoss(true)} accessibilityLabel="Jefe: hito que paga el doble" />
        </ChipWrap>
        <Text style={styles.hint}>
          {h.isBoss ? 'Un jefe es un hito. Paga el doble: ' : 'Paga '}
          {dungeonTaskXp(h.difficulty, h.isBoss)} XP al caer.
        </Text>
      </Sheet>
    </>
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
