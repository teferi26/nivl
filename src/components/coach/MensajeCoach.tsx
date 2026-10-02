// NIVL · Un mensaje del coach (L4, A2): sin burbuja, con la galea a la
// izquierda. Orden: texto, la cita de lo consultado, las acciones que cambió
// y una fila de texto con «Escuchar» / «Parar» y «Denunciar respuesta».

import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextoSistema } from '@/components/TextoSistema';
import { ink, space, stroke, type } from '@/design/tokens';
import { CoachMark } from './CoachMark';

export interface VozMensaje {
  estado: 'quieto' | 'hablando';
  onEscuchar: () => void;
  onParar: () => void;
}

interface Props {
  texto?: string;
  acciones: { texto: string; ok: boolean }[];
  pensando?: boolean;
  /** «Consultado: tu historial» (citaDe), o null. */
  cita: string | null;
  /** Solo si el dispositivo puede hablar y el mensaje está cerrado. */
  voz?: VozMensaje;
  onDenunciar?: () => void;
}

export function MensajeCoach({ texto, acciones, pensando, cita, voz, onDenunciar }: Props) {
  const conTexto = !!texto;
  const hablando = voz?.estado === 'hablando';
  const filaPie = conTexto && (voz || onDenunciar);
  return (
    <View style={styles.fila}>
      <View style={styles.marca}>
        <CoachMark size={24} />
      </View>
      <View style={styles.cuerpo}>
        {pensando && !texto ? (
          <View style={styles.pensandoFila}>
            <ActivityIndicator size="small" color={ink.ink8} />
            <Text style={styles.pensando}>El sistema piensa</Text>
          </View>
        ) : null}
        {texto ? <TextoSistema texto={texto} /> : null}
        {cita ? <Text style={styles.cita}>{cita}</Text> : null}
        {acciones.length > 0 ? (
          <View style={styles.acciones}>
            {acciones.map((a, i) => (
              <View key={i} style={styles.accion}>
                <Ionicons name={a.ok ? 'checkmark-circle' : 'alert-circle'} size={13} color={a.ok ? ink.ink8 : ink.ink10} />
                <Text style={styles.accionTexto}>{a.texto}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {filaPie ? (
          <View style={styles.pie}>
            {voz ? (
              <Pressable
                onPress={hablando ? voz.onParar : voz.onEscuchar}
                hitSlop={8}
                style={({ pressed }) => [styles.enlace, pressed && styles.pulsado]}
                accessibilityRole="button"
                accessibilityLabel={hablando ? 'Parar la lectura' : 'Escuchar la respuesta'}
                accessibilityState={{ busy: hablando }}
              >
                <Ionicons name={hablando ? 'stop-outline' : 'volume-medium-outline'} size={13} color={ink.ink6} />
                <Text style={styles.enlaceTexto}>{hablando ? 'Parar' : 'Escuchar'}</Text>
              </Pressable>
            ) : null}
            {onDenunciar ? (
              <Pressable
                onPress={onDenunciar}
                hitSlop={8}
                style={({ pressed }) => [styles.enlace, pressed && styles.pulsado]}
                accessibilityRole="button"
                accessibilityLabel="Denunciar respuesta"
              >
                <Ionicons name="flag-outline" size={12} color={ink.ink6} />
                <Text style={styles.enlaceTexto}>Denunciar respuesta</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', gap: space.s3, marginBottom: space.s5 },
  marca: { marginTop: 1 },
  cuerpo: { flex: 1, minWidth: 0 },
  pensandoFila: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  pensando: { fontFamily: type.bodySm.family, fontSize: 13, color: ink.ink8 },
  cita: {
    fontFamily: type.bodySm.family,
    fontSize: type.bodySm.size,
    lineHeight: type.bodySm.lineHeight,
    color: ink.ink6,
    borderLeftWidth: stroke.rule,
    borderLeftColor: ink.ink4,
    paddingLeft: space.s2 + 2,
    marginTop: space.s2,
  },
  acciones: { marginTop: space.s2, borderLeftWidth: stroke.hairline, borderLeftColor: ink.ink3, paddingLeft: 10, gap: space.s1 },
  accion: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accionTexto: { fontFamily: type.bodySm.family, fontSize: 12.5, color: ink.ink8, flexShrink: 1 },
  pie: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s5, marginTop: space.s2 },
  enlace: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 2 },
  enlaceTexto: { fontFamily: type.bodySm.family, fontSize: 11, color: ink.ink6 },
  pulsado: { opacity: 0.6 },
});
