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

import { useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { MODULO_DE_ACTO, NOMBRE_DE_ACTO } from '@/lib/links';
import type { Quest } from '@/lib/types';

export type ModoCompletar = 'directo' | 'foto' | 'registrar';

interface Props {
  /** La misión que se está completando; null = hoja cerrada. */
  quest: Quest | null;
  onElegir: (modo: ModoCompletar) => void;
  onClose: () => void;
}

export function CompletarSheet({ quest, onElegir, onClose }: Props) {
  // La última misión mostrada: al cerrar, `quest` pasa a null en el acto pero
  // la hoja aún se está fundiendo. Sin esto el título y los botones se
  // vaciaban a mitad del fundido.
  const ultima = useRef<Quest | null>(null);
  if (quest) ultima.current = quest;
  const q = quest ?? ultima.current;
  const acto = q?.link && q.link !== 'ninguno' ? q.link : null;
  const exigeFoto = !!q?.requires_evidence;

  return (
    <Sheet
      visible={quest !== null}
      onClose={onClose}
      eyebrow="COMPLETAR MISIÓN"
      title={q?.title ?? ''}
      footer={
        <>
          {exigeFoto ? (
            <Button title="Completar con foto" icon="camera-outline" size="lg" onPress={() => onElegir('foto')} />
          ) : (
            <>
              <Button title="Completar" icon="checkmark" size="lg" onPress={() => onElegir('directo')} />
              <Button
                title="Con foto · +25 %"
                icon="camera-outline"
                variant="secondary"
                size="lg"
                onPress={() => onElegir('foto')}
              />
            </>
          )}
          {acto ? (
            <Button
              title={`Registrar en ${MODULO_DE_ACTO[acto]}`}
              icon="arrow-forward"
              variant="secondary"
              size="lg"
              onPress={() => onElegir('registrar')}
            />
          ) : null}
        </>
      }
    >
      <Text style={styles.hint}>
        {exigeFoto
          ? 'Esta misión exige evidencia: se completa con una foto hecha ahora.'
          : 'Con foto suma un 25 % de XP y el domingo entra en tu resumen.'}
        {acto ? ` También se marca sola al registrar ${NOMBRE_DE_ACTO[acto]}.` : ''}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    paddingBottom: space.s2,
  },
});
