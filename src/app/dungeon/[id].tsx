// El detalle de una campaña (la ruta conserva su nombre interno). Los datos,
// los cerrojos y la celebración viven en useCampana; lo que se ve, en
// CampanaVista (pura, también en /kit/pantallas). Aquí queda la hoja de
// añadir una tarea (con Campo y rótulos de la arena, FASE3 Lote B2).
import { StyleSheet, Text, View } from 'react-native';
import { Campo } from '@/components/arena';
import { CampanaVista } from '@/components/campanas/CampanaVista';
import { useCampana } from '@/components/campanas/useCampana';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { DIFFICULTIES, DIFFICULTY_LABEL, dungeonTaskXp } from '@/lib/game';

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
        <View style={styles.pila}>
          <Campo
            etiqueta="Tarea"
            value={h.taskTitle}
            onChangeText={h.setTaskTitle}
            placeholder="Ej. Redactar el capítulo 2"
            autoFocus
            accessibilityLabel="Nombre de la tarea"
          />
          <View style={styles.grupo}>
            <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
              Dificultad
            </Text>
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
          </View>
          <View style={styles.grupo}>
            <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
              Tipo
            </Text>
            <ChipWrap>
              <Chip label="Tarea" selected={!h.isBoss} onPress={() => h.setIsBoss(false)} accessibilityLabel="Tarea normal" />
              <Chip label="Jefe" icon="skull-outline" selected={h.isBoss} onPress={() => h.setIsBoss(true)} accessibilityLabel="Jefe: hito que paga el doble" />
            </ChipWrap>
            <Text style={styles.ayuda}>
              {h.isBoss ? 'Un jefe es un hito. Paga el doble: ' : 'Paga '}
              {dungeonTaskXp(h.difficulty, h.isBoss)} XP al caer.
            </Text>
          </View>
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s5 },
  grupo: { gap: space.s2 },
  etiqueta: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  ayuda: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
  },
});
