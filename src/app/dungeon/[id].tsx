// El detalle de una campaña (la ruta conserva su nombre interno). Los datos,
// los cerrojos y la celebración viven en useCampana; lo que se ve, en
// CampanaVista (pura, también en /kit/pantallas). Aquí queda la hoja de
// añadir una tarea (con Campo y rótulos de la arena, FASE3 Lote B2).
import { StyleSheet, Text, View } from 'react-native';
import { Campo } from '@/components/arena';
import { CampanaVista } from '@/components/campanas/CampanaVista';
import { useCampana } from '@/components/campanas/useCampana';
import { FondoGeneral } from '@/components/general/piezas';
import { PielGeneral } from '@/components/general/piel';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { DIFFICULTIES, DIFFICULTY_LABEL, dungeonTaskXp } from '@/lib/game';

export default function DungeonDetail() {
  const { vista, hojas } = useCampana();
  const h = hojas.tarea;
  return (
    // La piel y el fondo de NIVL (General): el detalle de siempre en oro.
    <FondoGeneral>
      <PielGeneral>
      <CampanaVista {...vista} />
      <Sheet
        visible={h.visible}
        onClose={h.onClose}
        eyebrow={t('campanas:hojas.nuevaTarea')}
        title={t('campanas:hojas.siguientePaso')}
        footer={
          <>
            <Button
              title={t('campanas:hojas.anadirTarea')}
              size="lg"
              onPress={h.addTask}
              loading={h.adding}
              disabled={!h.taskTitle.trim()}
            />
            <Button title={t('comun:cancelar')} variant="ghost" onPress={h.onClose} />
          </>
        }
      >
        <View style={styles.pila}>
          <Campo
            etiqueta={t('campanas:hojas.tarea')}
            value={h.taskTitle}
            onChangeText={h.setTaskTitle}
            placeholder={t('campanas:hojas.placeholderTarea')}
            autoFocus
            accessibilityLabel={t('campanas:hojas.nombreTareaA11y')}
          />
          <View style={styles.grupo}>
            <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
              {t('campanas:hojas.dificultad')}
            </Text>
            <ChipWrap>
              {DIFFICULTIES.map((d) => (
                <Chip
                  key={d}
                  label={DIFFICULTY_LABEL[d]}
                  selected={h.difficulty === d}
                  onPress={() => h.setDifficulty(d)}
                  accessibilityLabel={t('campanas:hojas.dificultadA11y', { dificultad: DIFFICULTY_LABEL[d] })}
                />
              ))}
            </ChipWrap>
          </View>
          <View style={styles.grupo}>
            <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
              {t('campanas:hojas.tipo')}
            </Text>
            <ChipWrap>
              <Chip
                label={t('campanas:hojas.tarea')}
                selected={!h.isBoss}
                onPress={() => h.setIsBoss(false)}
                accessibilityLabel={t('campanas:hojas.tareaNormalA11y')}
              />
              <Chip
                label={t('campanas:hojas.jefe')}
                icon="skull-outline"
                selected={h.isBoss}
                onPress={() => h.setIsBoss(true)}
                accessibilityLabel={t('campanas:hojas.jefeA11y')}
              />
            </ChipWrap>
            <Text style={styles.ayuda}>
              {t(h.isBoss ? 'campanas:hojas.ayudaJefe' : 'campanas:hojas.ayudaTarea', {
                xp: dungeonTaskXp(h.difficulty, h.isBoss),
              })}
            </Text>
          </View>
        </View>
      </Sheet>
      </PielGeneral>
    </FondoGeneral>
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
