// NIVL · Antes de dictar por la red (L4, A3). Si el dispositivo no transcribe
// en local, el audio saldría a Apple o Google: se dice una vez, claro, y se
// deja elegir. «Escribir» no apunta nada: la próxima vez se vuelve a preguntar.

import { StyleSheet, Text } from 'react-native';
import { Button, Sheet } from '@/components/ui';
import { ink, space, type } from '@/design/tokens';
import { errorDictado } from '@/lib/coachvoz';

interface Props {
  visible: boolean;
  /** «Dictar igualmente»: quien abre la hoja apunta el permiso (aceptarRed) y avisa. */
  onAceptar: () => void;
  onClose: () => void;
}

export function HojaPrivacidadDictado({ visible, onAceptar, onClose }: Props) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow="PRIVACIDAD"
      title="Dictar por la red"
      scroll={false}
      footer={
        <>
          <Button title="Dictar igualmente" onPress={onAceptar} />
          <Button title="Escribir" variant="ghost" onPress={onClose} />
        </>
      }
    >
      <Text style={styles.texto}>{errorDictado('sin_dictado_local').mensaje}</Text>
      <Text style={[styles.texto, styles.segundo]}>
        Lo que dictes se escribe en el cuadro y llega al coach igual que si lo hubieras escrito tú, cuando lo envíes.
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  texto: { fontFamily: type.body.family, fontSize: type.body.size, lineHeight: type.body.lineHeight, color: ink.ink8 },
  segundo: { marginTop: space.s3 },
});
