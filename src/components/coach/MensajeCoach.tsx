// NIVL · Un mensaje del coach (L-RADICAL §B.2.4): una losa de la arena, no
// una burbuja de chat. Superficie ink1 con filete ink3 y una regla izquierda
// de 2 en ink10: se distingue de un vistazo de la burbuja del usuario (ink2,
// sin marco). El primero de cada bloque seguido va firmado: la galea y
// «EL SISTEMA» grabado en Cinzel encima de la losa. Orden dentro: texto, la
// cita de lo consultado, las acciones que cambió y una fila de texto con
// «Escuchar» / «Parar» y «Denunciar respuesta». Sin animación por mensaje.

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
  /** El primero de un bloque seguido del coach: lleva la firma encima. */
  firma?: boolean;
}

// Los enlaces del pie miden 28 de alto: con esto llegan a 44 de zona táctil.
const ZONA_ENLACE = { top: 10, bottom: 10, left: 8, right: 8 };

export function MensajeCoach({ texto, acciones, pensando, cita, voz, onDenunciar, firma }: Props) {
  const conTexto = !!texto;
  const hablando = voz?.estado === 'hablando';
  const filaPie = conTexto && (voz || onDenunciar);
  return (
    <View style={[styles.fila, !firma && styles.filaSeguida]}>
      {firma ? (
        <View style={styles.firma}>
          <CoachMark size={24} />
          <Text style={styles.firmaTexto} maxFontSizeMultiplier={1.35}>
            EL SISTEMA
          </Text>
        </View>
      ) : null}
      <View style={styles.losa}>
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
                <Ionicons name={a.ok ? 'checkmark-circle' : 'alert-circle'} size={14} color={a.ok ? ink.ink8 : ink.ink10} />
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
                hitSlop={ZONA_ENLACE}
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
                hitSlop={ZONA_ENLACE}
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
  fila: { marginBottom: space.s5 },
  // Dentro de un bloque seguido, las losas van más juntas.
  filaSeguida: { marginTop: -space.s2 },
  firma: { flexDirection: 'row', alignItems: 'center', gap: space.s2, marginBottom: space.s2 },
  firmaTexto: {
    fontFamily: type.inscripcion.family,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: type.inscripcion.tracking - 1,
    color: ink.ink8,
  },
  losa: {
    minWidth: 0,
    backgroundColor: ink.ink1,
    borderWidth: stroke.hairline,
    borderColor: ink.ink3,
    borderLeftWidth: stroke.rule,
    borderLeftColor: ink.ink10,
    paddingVertical: space.s3,
    paddingLeft: space.s3 + 2,
    paddingRight: space.s4,
  },
  pensandoFila: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  pensando: { fontFamily: type.bodySm.family, fontSize: type.bodySm.size, lineHeight: type.bodySm.lineHeight, color: ink.ink8 },
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
  accionTexto: {
    fontFamily: type.bodySm.family,
    fontSize: type.bodySm.size,
    lineHeight: type.bodySm.lineHeight,
    color: ink.ink8,
    flexShrink: 1,
  },
  pie: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s5, marginTop: space.s2 },
  // 28 de alto + 10 arriba y abajo de hitSlop = 48 de zona táctil.
  enlace: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 28 },
  enlaceTexto: { fontFamily: type.bodySm.family, fontSize: type.bodySm.size, lineHeight: type.bodySm.lineHeight, color: ink.ink6 },
  pulsado: { opacity: 0.6 },
});
