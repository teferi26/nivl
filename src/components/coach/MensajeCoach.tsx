// NIVL · Un mensaje del coach (L-RADICAL §B.2.4): una losa de la arena, no
// una burbuja de chat. Superficie ink1 con filete ink3 y una regla izquierda
// de 2 en ink10: se distingue de un vistazo de la burbuja del usuario (ink2,
// sin marco). El primero de cada bloque seguido va firmado: la galea y
// «EL SISTEMA» grabado en Cinzel encima de la losa. Orden dentro: texto, la
// cita de lo consultado, las acciones que cambió y una fila de texto con
// «Escuchar» / «Parar» y «Denunciar respuesta». Sin animación por mensaje.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useMovimientoReducido } from '@/components/ui/motion';
import { TextoSistema } from '@/components/TextoSistema';
import { usePiel } from '@/design/piel';
import { ink, space, stroke, type } from '@/design/tokens';
import { t } from '@/i18n';
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
  /** Bajo la losa: los avisos «Ir a {modo}» de este turno (AvisosModo). */
  avisos?: ReactNode;
}

// Los enlaces del pie miden 28 de alto: con esto llegan a 44 de zona táctil.
const ZONA_ENLACE = { top: 10, bottom: 10, left: 8, right: 8 };

export function MensajeCoach({ texto, acciones, pensando, cita, voz, onDenunciar, firma, avisos }: Props) {
  const conTexto = !!texto;
  const hablando = voz?.estado === 'hablando';
  const filaPie = conTexto && (voz || onDenunciar);
  // La piel de un mundo (IRON): el avatar a la izquierda y la burbuja
  // redondeada (la tarjeta del coach de la lámina), sin la firma grabada.
  const pc = usePiel()?.coach;
  if (pc) {
    return (
      <View style={[styles.fila, !firma && styles.filaSeguida, styles.filaPiel]}>
        <View style={{ width: pc.ladoAvatar }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {firma ? pc.avatar : null}
        </View>
        <View style={styles.flex}>
          <View style={[styles.losa, styles.losaPiel, { backgroundColor: pc.burbuja, borderRadius: pc.radioBurbuja }]}>
            {pensando && !texto ? <Pensando /> : null}
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
            {filaPie ? <PieMensaje voz={voz} onDenunciar={onDenunciar} /> : null}
          </View>
          {avisos}
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.fila, !firma && styles.filaSeguida]}>
      {firma ? (
        <View style={styles.firma}>
          <CoachMark size={24} />
          <Text style={styles.firmaTexto} maxFontSizeMultiplier={1.35}>
            {t('coach:mensaje.firma')}
          </Text>
        </View>
      ) : null}
      <View style={styles.losa}>
        {pensando && !texto ? <Pensando /> : null}
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
                accessibilityLabel={hablando ? t('coach:mensaje.pararA11y') : t('coach:mensaje.escucharA11y')}
                accessibilityState={{ busy: hablando }}
              >
                <Ionicons name={hablando ? 'stop-outline' : 'volume-medium-outline'} size={13} color={ink.ink6} />
                <Text style={styles.enlaceTexto}>{hablando ? t('coach:mensaje.parar') : t('coach:mensaje.escuchar')}</Text>
              </Pressable>
            ) : null}
            {onDenunciar ? (
              <Pressable
                onPress={onDenunciar}
                hitSlop={ZONA_ENLACE}
                style={({ pressed }) => [styles.enlace, pressed && styles.pulsado]}
                accessibilityRole="button"
                accessibilityLabel={t('comun:denunciarRespuesta')}
              >
                <Ionicons name="flag-outline" size={12} color={ink.ink6} />
                <Text style={styles.enlaceTexto}>{t('comun:denunciarRespuesta')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      {avisos}
    </View>
  );
}

/** «Escuchar» / «Parar» y «Denunciar respuesta» (la misma fila; la usa la piel de un mundo). */
function PieMensaje({ voz, onDenunciar }: { voz?: VozMensaje; onDenunciar?: () => void }) {
  const hablando = voz?.estado === 'hablando';
  return (
    <View style={styles.pie}>
      {voz ? (
        <Pressable
          onPress={hablando ? voz.onParar : voz.onEscuchar}
          hitSlop={ZONA_ENLACE}
          style={({ pressed }) => [styles.enlace, pressed && styles.pulsado]}
          accessibilityRole="button"
          accessibilityLabel={hablando ? t('coach:mensaje.pararA11y') : t('coach:mensaje.escucharA11y')}
          accessibilityState={{ busy: hablando }}
        >
          <Ionicons name={hablando ? 'stop-outline' : 'volume-medium-outline'} size={13} color={ink.ink6} />
          <Text style={styles.enlaceTexto}>{hablando ? t('coach:mensaje.parar') : t('coach:mensaje.escuchar')}</Text>
        </Pressable>
      ) : null}
      {onDenunciar ? (
        <Pressable
          onPress={onDenunciar}
          hitSlop={ZONA_ENLACE}
          style={({ pressed }) => [styles.enlace, pressed && styles.pulsado]}
          accessibilityRole="button"
          accessibilityLabel={t('comun:denunciarRespuesta')}
        >
          <Ionicons name="flag-outline" size={12} color={ink.ink6} />
          <Text style={styles.enlaceTexto}>{t('comun:denunciarRespuesta')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Lo que se ve desde que sale el mensaje hasta el primer texto del coach.
 * Tres puntos que laten en sucesión; con «reducir movimiento», quietos. Se
 * anuncia una vez al lector de pantalla (región viva educada en Android y
 * anuncio explícito en iOS, que no tiene regiones vivas).
 */
function Pensando() {
  const pensando = t('coach:mensaje.pensando');
  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(t('coach:mensaje.pensando'));
  }, []);
  return (
    <View
      style={styles.pensandoFila}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={pensando}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.puntos}>
        <Punto indice={0} />
        <Punto indice={1} />
        <Punto indice={2} />
      </View>
      <Text style={styles.pensando} maxFontSizeMultiplier={1.35}>
        {pensando}
      </Text>
    </View>
  );
}

function Punto({ indice }: { indice: number }) {
  const reducido = useMovimientoReducido();
  const o = useSharedValue(reducido ? 1 : 0.25);
  useEffect(() => {
    if (reducido) {
      cancelAnimation(o);
      o.value = 1;
      return;
    }
    o.value = 0.25;
    o.value = withDelay(
      indice * 180,
      withRepeat(withSequence(withTiming(1, { duration: 360 }), withTiming(0.25, { duration: 360 })), -1, false),
    );
    return () => cancelAnimation(o);
  }, [reducido, indice, o]);
  const estilo = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.punto, estilo]} />;
}

const styles = StyleSheet.create({
  fila: { marginBottom: space.s5 },
  flex: { flex: 1, minWidth: 0 },
  filaPiel: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s2 },
  losaPiel: { borderWidth: 0, borderLeftWidth: 0, borderTopLeftRadius: 4, paddingLeft: space.s3 + 2 },
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
  pensandoFila: { flexDirection: 'row', alignItems: 'center', gap: space.s2, minHeight: 24 },
  puntos: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  punto: { width: 6, height: 6, borderRadius: 3, backgroundColor: ink.ink8 },
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
