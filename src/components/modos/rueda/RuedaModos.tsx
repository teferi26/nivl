// NIVL · Modos: la rueda radial a pantalla completa (propuesta P01).
//
// Se monta como overlay desde el emblema (EmblemaModo) y tiene dos fases:
//
//   · rueda: «tiempo bala». Velo oscuro sobre la app y la rueda con NIVL arriba
//     y cada modo SIEMPRE en su punto (src/modos/rueda.ts). Los huecos de los
//     modos sin activar quedan vacíos (trazo discontinuo) y no se eligen. El
//     sector apuntado se rellena con el color del modo y vibra al cambiar.
//     Con el emblema mantenido, el gesto lo lleva el emblema (el mismo dedo
//     sigue arrastrando); abierta con un toque, se elige tocando aquí.
//   · recarga (~600 ms): suena la firma del modo y vibra la suya (P10), el
//     color del modo barre la pantalla en círculo y el emblema gira 90°. Al
//     encajar se cambia de modo (golpe fuerte en el mapa de vibraciones) y el
//     overlay se funde.
//
// Con «Reducir movimiento»: sin escala de la rueda, sin barrido ni giro; la
// recarga es un fundido de 200 ms con el color del modo.
//
// El velo es negro semitransparente: expo-blur no está en el proyecto y no se
// añade un módulo nativo solo para esto.

import { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { vibrar, type EventoVibracion } from '@/design/haptics';
import { ink, modoAcento, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import {
  ANGULO_MODO,
  ORDEN_RUEDA,
  mascaraDisponibles,
  puntoEn,
  radioCubre,
  sectorEn,
  trazoSector,
} from '@/modos/rueda';
import { NOMBRE_MODO, type ModoId } from '@/modos/tipos';
import { GlifoModo } from './GlifoModo';
import { sonarModo } from './sonido';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** La firma de vibración de cada modo (hapticsMap). */
export const EVENTO_MODO: Record<ModoId, EventoVibracion> = {
  general: 'modoGeneral',
  iron: 'modoIron',
  focus: 'modoFocus',
  work: 'modoWork',
  founder: 'modoFounder',
};

/** Duración de la recarga (P01: 600 ms) y del fundido con «Reducir movimiento». */
export const MS_RECARGA = 600;
export const MS_FUNDIDO = 200;

export type OrigenRueda = 'mantener' | 'toque' | 'recarga';

export interface RuedaModosProps {
  /** Quién la abrió: el emblema mantenido, un toque (se elige tocando) o el toque corto (solo la recarga). */
  origen: OrigenRueda;
  /** El modo a la vista. */
  modo: ModoId;
  disponibles: readonly ModoId[];
  /** El vector del pulgar desde donde se mantuvo el emblema (origen «mantener»). */
  vectorX: SharedValue<number>;
  vectorY: SharedValue<number>;
  /** El sector apuntado (índice de ORDEN_RUEDA, -1 ninguno). */
  resaltado: SharedValue<number>;
  /** El modo elegido: con él empieza la recarga. */
  elegido: ModoId | null;
  /** Cancelado: se funde y avisa con `alCerrar`. */
  cerrando: boolean;
  reducido: boolean;
  /** Origen «toque»: el dedo se levanta sobre un sector (o el centro, -1). */
  alSoltar: (indice: number) => void;
  /** Fin de la recarga: aquí se cambia de modo. */
  alEncajar: (m: ModoId) => void;
  /** El overlay ya no se ve: se desmonta. */
  alCerrar: () => void;
}

export function RuedaModos(props: RuedaModosProps) {
  const { origen, modo, disponibles, vectorX, vectorY, resaltado, elegido, cerrando, reducido } = props;
  const { alSoltar, alEncajar, alCerrar } = props;
  const ventana = useWindowDimensions();
  const [lienzo, setLienzo] = useState({ w: ventana.width, h: ventana.height });
  const [ficha, setFicha] = useState(-1);

  const { w, h } = lienzo;
  const D = Math.min(w - 2 * space.s6, 340);
  const c = D / 2;
  const rFuera = c - 2;
  const rCentro = Math.round(D * 0.2);
  const rDentro = rCentro + 6;
  const rRotulo = (rDentro + rFuera) / 2;
  const cx = w / 2;
  const cy = h * 0.5;
  const radioBarrido = radioCubre(cx, cy, w, h);
  const mascara = useMemo(() => mascaraDisponibles(disponibles), [disponibles]);

  // Animaciones (hilo de la interfaz).
  const velo = useSharedValue(0);
  const abre = useSharedValue(reducido ? 1 : 0.86);
  const rueda = useSharedValue(0);
  const barrido = useSharedValue(0);
  const giro = useSharedValue(0);
  const sello = useSharedValue(0);

  // Abrir: tiempo bala.
  useEffect(() => {
    if (origen === 'recarga') {
      velo.value = 1;
      return;
    }
    velo.value = withTiming(1, { duration: reducido ? MS_FUNDIDO : 120 });
    rueda.value = withTiming(1, { duration: reducido ? MS_FUNDIDO : 180 });
    if (!reducido) abre.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
    // Solo al montar: cada apertura es un montaje nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El sector apuntado: vibración de selección al cambiar y la ficha de arriba.
  useAnimatedReaction(
    () => resaltado.value,
    (actual, previo) => {
      if (actual === previo) return;
      if (actual >= 0 && previo !== null) scheduleOnRN(vibrar, 'seleccion');
      scheduleOnRN(setFicha, actual);
    },
  );

  // Recarga.
  useEffect(() => {
    if (!elegido) return;
    sonarModo(elegido);
    vibrar(EVENTO_MODO[elegido]);
    const fin = () => {
      alEncajar(elegido);
      velo.value = withDelay(
        reducido ? 60 : 140,
        withTiming(0, { duration: reducido ? MS_FUNDIDO : 260 }, (ok) => {
          if (ok) scheduleOnRN(alCerrar);
        }),
      );
    };
    rueda.value = withTiming(0, { duration: reducido ? 0 : 140 });
    sello.value = withTiming(1, { duration: reducido ? MS_FUNDIDO : 220 });
    if (reducido) {
      barrido.value = withTiming(1, { duration: MS_FUNDIDO }, (ok) => {
        if (ok) scheduleOnRN(fin);
      });
    } else {
      giro.value = withTiming(90, { duration: MS_RECARGA, easing: Easing.out(Easing.back(1.4)) });
      barrido.value = withTiming(1, { duration: MS_RECARGA, easing: Easing.inOut(Easing.cubic) }, (ok) => {
        if (ok) scheduleOnRN(fin);
      });
    }
    // Una recarga por elección.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegido]);

  // Cancelar: fundido corto.
  useEffect(() => {
    if (!cerrando) return;
    velo.value = withTiming(0, { duration: reducido ? MS_FUNDIDO : 140 }, (ok) => {
      if (ok) scheduleOnRN(alCerrar);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cerrando]);

  // Abierta con un toque: se elige tocando (o arrastrando) sobre la rueda.
  const tocar = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .enabled(origen === 'toque' && !elegido && !cerrando)
        .onBegin((e) => {
          vectorX.value = e.x - cx;
          vectorY.value = e.y - cy;
          resaltado.value = sectorEn(e.x - cx, e.y - cy, rCentro, mascara);
        })
        .onUpdate((e) => {
          vectorX.value = e.x - cx;
          vectorY.value = e.y - cy;
          resaltado.value = sectorEn(e.x - cx, e.y - cy, rCentro, mascara);
        })
        .onEnd(() => {
          scheduleOnRN(alSoltar, resaltado.value);
        }),
    [origen, elegido, cerrando, cx, cy, rCentro, mascara, vectorX, vectorY, resaltado, alSoltar],
  );

  const estiloVelo = useAnimatedStyle(() => ({ opacity: velo.value }));
  const estiloRueda = useAnimatedStyle(() => ({ opacity: rueda.value, transform: [{ scale: abre.value }] }));
  const estiloSello = useAnimatedStyle(() => ({
    opacity: sello.value,
    transform: [{ rotate: `${giro.value}deg` }],
  }));
  const estiloNombre = useAnimatedStyle(() => ({ opacity: sello.value }));
  const estiloFundido = useAnimatedStyle(() => ({ opacity: barrido.value }));
  const propsBarrido = useAnimatedProps(() => ({ r: barrido.value * radioBarrido }));

  // El puntero: dónde apunta el pulgar dentro de la rueda.
  const enToque = origen === 'toque';
  const estiloPuntero = useAnimatedStyle(() => {
    const escala = enToque ? 1 : 1.8;
    let x = vectorX.value * escala;
    let y = vectorY.value * escala;
    const d = Math.sqrt(x * x + y * y);
    const tope = rRotulo;
    if (d > tope) {
      x = (x / d) * tope;
      y = (y / d) * tope;
    }
    return { opacity: d > 4 ? 1 : 0, transform: [{ translateX: x }, { translateY: y }] };
  });

  const alMedir = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - w) > 0.5 || Math.abs(height - h) > 0.5) setLienzo({ w: width, h: height });
  };

  const fichaModo = ficha >= 0 ? ORDEN_RUEDA[ficha] : null;
  const acento = elegido ? modoAcento[elegido] : ink.ink10;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => alSoltar(-1)}
    >
      <GestureHandlerRootView style={styles.lleno}>
        <GestureDetector gesture={tocar}>
          <Animated.View
            style={[styles.lleno, estiloVelo]}
            onLayout={alMedir}
            accessibilityViewIsModal
            accessibilityLabel={t('modos:rueda.a11y')}
            onAccessibilityEscape={() => alSoltar(-1)}
          >
            {/* Tiempo bala: la app se queda quieta detrás de un velo oscuro. */}
            <View style={[StyleSheet.absoluteFill, styles.velo]} pointerEvents="none" />

            {/* La ficha: qué se va a cargar. */}
            {!elegido ? (
              <Animated.View
                style={[styles.ficha, { top: Math.max(space.s14, cy - c - 132), width: w }, estiloRueda]}
                pointerEvents="none"
              >
                <Text style={styles.eyebrow} maxFontSizeMultiplier={1.35}>
                  {t('modos:rueda.eyebrow')}
                </Text>
                <Text
                  style={[styles.nombreFicha, { color: fichaModo ? modoAcento[fichaModo] : ink.ink9 }]}
                  maxFontSizeMultiplier={1}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {NOMBRE_MODO[fichaModo ?? modo]}
                </Text>
                <Text style={styles.descripcion} maxFontSizeMultiplier={1.35} numberOfLines={2}>
                  {t(`modos:descripcion.${fichaModo ?? modo}`)}
                </Text>
              </Animated.View>
            ) : null}

            {/* La rueda. */}
            <Animated.View
              style={[styles.rueda, { left: cx - c, top: cy - c, width: D, height: D }, estiloRueda]}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Svg width={D} height={D}>
                {ORDEN_RUEDA.map((m, i) => (
                  <Sector
                    key={m}
                    indice={i}
                    modo={m}
                    d={trazoSector(c, c, rDentro, rFuera, ANGULO_MODO[m])}
                    disponible={mascara[i]}
                    activo={m === modo}
                    resaltado={resaltado}
                  />
                ))}
                <Circle cx={c} cy={c} r={rCentro} fill={ink.ink0} stroke={ink.ink3} strokeWidth={stroke.hairline} />
              </Svg>
              {ORDEN_RUEDA.map((m, i) => {
                const p = puntoEn(c, c, rRotulo, ANGULO_MODO[m]);
                return <Rotulo key={m} indice={i} modo={m} x={p.x} y={p.y} disponible={mascara[i]} resaltado={resaltado} />;
              })}
              <View style={[styles.centro, { left: c - rCentro, top: c - rCentro, width: rCentro * 2, height: rCentro * 2 }]}>
                <GlifoModo modo={modo} tamano={Math.round(rCentro * 0.9)} color={modoAcento[modo]} />
              </View>
              {/* El puntero del pulgar. */}
              <Animated.View style={[styles.puntero, { left: c - 6, top: c - 6 }, estiloPuntero]} />
            </Animated.View>

            {!elegido ? (
              <Animated.Text
                style={[styles.pista, { top: cy + c + space.s6, width: w }, estiloRueda]}
                maxFontSizeMultiplier={1.35}
              >
                {t('modos:rueda.cancelar')}
              </Animated.Text>
            ) : null}

            {/* Recarga: el color del modo barre la pantalla y el emblema gira. */}
            {elegido ? (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {reducido ? (
                  <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: acento }, estiloFundido]} />
                ) : (
                  <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
                    <AnimatedCircle cx={cx} cy={cy} fill={acento} animatedProps={propsBarrido} />
                  </Svg>
                )}
                <Animated.View style={[styles.sello, { left: cx - 48, top: cy - 48 }, estiloSello]}>
                  <GlifoModo modo={elegido} tamano={64} color={ink.ink0} />
                </Animated.View>
                <Animated.Text
                  style={[styles.nombreSello, { top: cy + 64, width: w }, estiloNombre]}
                  maxFontSizeMultiplier={1}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {NOMBRE_MODO[elegido]}
                </Animated.Text>
              </View>
            ) : null}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

function Sector({
  indice,
  modo,
  d,
  disponible,
  activo,
  resaltado,
}: {
  indice: number;
  modo: ModoId;
  d: string;
  disponible: boolean;
  activo: boolean;
  resaltado: SharedValue<number>;
}) {
  const props = useAnimatedProps(() => ({ fillOpacity: resaltado.value === indice ? 1 : 0 }));
  if (!disponible) {
    return <Path d={d} fill="none" stroke={ink.ink3} strokeWidth={stroke.hairline} strokeDasharray="3 5" />;
  }
  return (
    <>
      <Path
        d={d}
        fill={ink.ink1}
        stroke={activo ? modoAcento[modo] : ink.ink3}
        strokeWidth={activo ? stroke.rule : stroke.hairline}
      />
      <AnimatedPath d={d} fill={modoAcento[modo]} animatedProps={props} />
    </>
  );
}

function Rotulo({
  indice,
  modo,
  x,
  y,
  disponible,
  resaltado,
}: {
  indice: number;
  modo: ModoId;
  x: number;
  y: number;
  disponible: boolean;
  resaltado: SharedValue<number>;
}) {
  const encendido = useAnimatedStyle(() => ({ opacity: resaltado.value === indice ? 1 : 0 }));
  const apagado = useAnimatedStyle(() => ({ opacity: resaltado.value === indice ? 0 : 1 }));
  return (
    <View style={[styles.rotulo, { left: x - 50, top: y - 22 }]}>
      <View style={[styles.punto, { backgroundColor: disponible ? modoAcento[modo] : ink.ink4 }]} />
      <View>
        <Animated.Text style={[styles.nombreRotulo, { color: disponible ? ink.ink9 : ink.ink6 }, apagado]} maxFontSizeMultiplier={1}>
          {NOMBRE_MODO[modo]}
        </Animated.Text>
        {disponible ? (
          <Animated.Text style={[styles.nombreRotulo, styles.encima, { color: ink.ink0 }, encendido]} maxFontSizeMultiplier={1}>
            {NOMBRE_MODO[modo]}
          </Animated.Text>
        ) : null}
      </View>
      {!disponible ? (
        <Text style={styles.sinActivar} maxFontSizeMultiplier={1} numberOfLines={1}>
          {t('modos:rueda.sinActivar')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lleno: { flex: 1 },
  velo: { backgroundColor: ink.ink0, opacity: 0.86 },
  rueda: { position: 'absolute' },
  centro: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  puntero: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ink.ink10,
    borderWidth: stroke.rule,
    borderColor: ink.ink0,
  },
  rotulo: { position: 'absolute', width: 100, height: 44, alignItems: 'center', justifyContent: 'center', gap: space.s1 },
  punto: { width: 6, height: 6, borderRadius: 3 },
  nombreRotulo: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textAlign: 'center',
  },
  encima: { position: 'absolute', left: 0, right: 0, top: 0 },
  sinActivar: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
  },
  ficha: { position: 'absolute', left: 0, alignItems: 'center', paddingHorizontal: space.s6, gap: space.s1 },
  eyebrow: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  nombreFicha: {
    fontFamily: tipo.rank.family,
    fontSize: tipo.rank.size,
    lineHeight: tipo.rank.lineHeight,
    letterSpacing: tipo.rank.tracking,
  },
  descripcion: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    textAlign: 'center',
  },
  pista: {
    position: 'absolute',
    left: 0,
    textAlign: 'center',
    paddingHorizontal: space.s6,
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
  },
  sello: { position: 'absolute', width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  nombreSello: {
    position: 'absolute',
    left: 0,
    textAlign: 'center',
    paddingHorizontal: space.s6,
    fontFamily: tipo.display.family,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: tipo.display.tracking,
    color: ink.ink0,
  },
});
