// NIVL · La hoja de completar una misión.
//
// Sustituye a las alertas del sistema operativo encadenadas: antes una misión
// con módulo enlazado pedía tres toques (fila → "Marcar sin registrar" →
// "Sin foto"). Ahora es siempre fila → opción, con todas las salidas a la vez:
// completar, completar con foto (+25 %) y, si la misión se demuestra en un
// módulo, ir a registrarlo allí (que la marca sola, con su regla y su bloque).
//
// La hoja NO completa nada: devuelve la opción elegida. El cerrojo por misión
// y el pago siguen en la pantalla que la abre (ver `onComplete` en Hoy).

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SystemButton } from '@/components/SystemButton';
import { MODULO_DE_ACTO, NOMBRE_DE_ACTO } from '@/lib/links';
import { colors, fonts } from '@/lib/theme';
import type { Quest } from '@/lib/types';

export type ModoCompletar = 'directo' | 'foto' | 'registrar';

interface Props {
  /** La misión que se está completando; null = hoja cerrada. */
  quest: Quest | null;
  onElegir: (modo: ModoCompletar) => void;
  onClose: () => void;
}

export function CompletarSheet({ quest, onElegir, onClose }: Props) {
  const acto = quest?.link && quest.link !== 'ninguno' ? quest.link : null;
  const exigeFoto = !!quest?.requires_evidence;

  return (
    <Modal visible={quest !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetEyebrow}>COMPLETAR MISIÓN</Text>
          <Text style={styles.sheetTitle} numberOfLines={2}>
            {quest?.title ?? ''}
          </Text>
          <Text style={styles.hint}>
            {exigeFoto
              ? 'Esta misión exige evidencia: se completa con una foto hecha ahora.'
              : 'Con foto suma un 25 % de XP y el domingo entra en tu resumen.'}
            {acto ? ` También se marca sola al registrar ${NOMBRE_DE_ACTO[acto]}.` : ''}
          </Text>

          {exigeFoto ? (
            <SystemButton title="Completar con foto" icon="camera-outline" size="lg" onPress={() => onElegir('foto')} style={styles.first} />
          ) : (
            <>
              <SystemButton title="Completar" icon="checkmark" size="lg" onPress={() => onElegir('directo')} style={styles.first} />
              <SystemButton
                title="Con foto · +25 %"
                icon="camera-outline"
                variant="outline"
                size="lg"
                onPress={() => onElegir('foto')}
                style={styles.next}
              />
            </>
          )}
          {acto ? (
            <SystemButton
              title={`Registrar en ${MODULO_DE_ACTO[acto]}`}
              icon="arrow-forward"
              variant="outline"
              size="lg"
              onPress={() => onElegir('registrar')}
              style={styles.next}
            />
          ) : null}
          <SystemButton title="Cancelar" variant="ghost" onPress={onClose} style={styles.cancel} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  sheetEyebrow: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2.5, color: colors.textFaint },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 27, letterSpacing: -0.4, color: colors.text, marginTop: 6 },
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textDim, marginTop: 8 },
  first: { marginTop: 20 },
  next: { marginTop: 10 },
  cancel: { marginTop: 6 },
});
