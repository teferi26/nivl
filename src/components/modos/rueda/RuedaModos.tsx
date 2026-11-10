// NIVL · Modos: la rueda a pantalla completa (propuesta P01, láminas 1 y 4).
//
// Se monta como overlay desde el emblema (EmblemaModo) y tiene dos fases:
//
//   · rueda («tiempo bala»): velo oscuro sobre la app, la ficha arriba y la
//     rueda: NIVL, la base, en el centro, y cada modo en su punto cardinal
//     (src/modos/rueda.ts). El sector apuntado se enciende con el hilo de oro
//     (los cuatro comparten acento; el nombre los distingue) y su icono crece. El
//     modo actual lleva la placa ACTUAL y el anterior, ANTERIOR.
//       - Abierta con un toque (camino principal): se queda abierta. Tocar un
//         modo lo elige; tocar fuera, tocar el actual o deslizar hacia abajo
//         la cierran sin cambiar.
//       - Abierta manteniendo el emblema (atajo): el mismo dedo apunta y al
//         soltar elige. Lo lleva el gesto del emblema; aquí solo se pinta.
//   · recarga (~600 ms): suena la firma del modo y vibra la suya (P10). El
//     fondo toma un velo de oro desde abajo (NIVL: desde el centro),
//     tres ondas suben, el tambor gira un cuarto y aparecen el nombre,
//     EQUIPADO y la barra. Al encajar se cambia de modo y el overlay se funde.
//
// Con «Reducir movimiento»: sin escala de la rueda, sin ondas ni giro; la
// recarga es un fundido de 200 ms.
//
// El velo es negro semitransparente: expo-blur no está en el proyecto y no se
// añade un módulo nativo solo para esto (la lámina desenfoca la app).
//
// Las piezas de dibujo (DiscoRueda, FichaRueda, RecargaModo) se exportan para
// la galería /kit/rueda, que las monta quietas para las capturas.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { vibrar, type EventoVibracion } from '@/design/haptics';
import { acentoRueda, ink, oro, radio, space, type as tipo, vidrio } from '@/design/tokens';
import { t } from '@/i18n';
import {
  ANGULO_MODO,
  ORDEN_RUEDA,
  RUEDA,
  UMBRAL_MOVIMIENTO,
  VISTA_RUEDA,
  finDeGesto,
  mascaraDisponibles,
  puntoEn,
  opacidadApuntado,
  sectorEn,
  sitioFicha,
  trazoSector,
  type SitioFicha,
} from '@/modos/rueda';
import { MODOS_ETIQUETA, NOMBRE_MODO, type ModoEtiqueta, type ModoId } from '@/modos/tipos';
import { conAlfa } from './color';
import { Desenfoque, hayDesenfoque } from './Desenfoque';
import { DibujoEmblema, type FormaEmblema } from './DibujoEmblema';
import { GlifoModo } from './GlifoModo';
import { sonarModo } from './sonido';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedView = Animated.View;

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

/** Playfair: los nombres de modo grandes. */
const TITULAR = tipo.title.family;
const OUTFIT_BOLD = tipo.label.family;
/** Outfit ExtraBold (la lámina: 800) para los rótulos de la rueda y la recarga. */
const OUTFIT_BLACK = 'Outfit_800ExtraBold';
/** Rótulos de la rueda sin apuntar. */
const HUESO = ink.ink10;
const OUTFIT_MEDIO = tipo.bodySm.family;

export type OrigenRueda = 'mantener' | 'toque';

/** El centro del emblema en la ventana (de ahí nace la estela). */
export interface OrigenEmblema {
  x: number;
  y: number;
}

/** Dónde va la rueda en una pantalla de w × h, y su escala respecto a la lámina. */
export function geometriaRueda(w: number, h: number) {
  // La lámina: 260 de 342 de ancho (76 %), con el centro a la mitad del alto.
  // En ventanas bajas (móvil tumbado, escritorio con poco alto) manda el alto.
  const D = Math.round(Math.min(w * 0.76, 340, h * 0.72));
  return { D, escala: D / VISTA_RUEDA, cx: w / 2, cy: Math.round(h * 0.51) };
}

export interface RuedaModosProps {
  /** Quién la abrió: un toque (se queda abierta) o el emblema mantenido (atajo). */
  origen: OrigenRueda;
  /** El modo a la vista y el anterior (se marca). */
  modo: ModoId;
  anterior: ModoId | null;
  disponibles: readonly ModoId[];
  /** El emblema que abrió la rueda: se repinta nítido encima del desenfoque. */
  emblema: (OrigenEmblema & { forma: FormaEmblema; tamano: number }) | null;
  /** Dónde está el dedo (coordenadas de la ventana): huella y estela. */
  dedoX: SharedValue<number>;
  dedoY: SharedValue<number>;
  /** El índice apuntado (ORDEN_RUEDA, -1 ninguno). */
  resaltado: SharedValue<number>;
  /** El centro de la rueda en la ventana y su escala: los lee el gesto del emblema. */
  centroX: SharedValue<number>;
  centroY: SharedValue<number>;
  escala: SharedValue<number>;
  /** El modo elegido: con él empieza la recarga. */
  elegido: ModoId | null;
  /** Cancelado: se funde y avisa con `alCerrar`. */
  cerrando: boolean;
  reducido: boolean;
  /** Origen «toque»: el índice tocado (-1 fuera o hueco vacío). */
  alElegir: (indice: number) => void;
  /** Deslizar hacia abajo, atrás de Android o escape del lector: cerrar sin cambiar. */
  alPedirCierre: () => void;
  /** Fin de la recarga: aquí se cambia de modo. */
  alEncajar: (m: ModoId) => void;
  /** El overlay ya no se ve: se desmonta. */
  alCerrar: () => void;
}

export function RuedaModos(props: RuedaModosProps) {
  const { origen, modo, anterior, disponibles, emblema, dedoX, dedoY, resaltado, centroX, centroY, escala } = props;
  const { elegido, cerrando, reducido, alElegir, alPedirCierre, alEncajar, alCerrar } = props;
  const ventana = useWindowDimensions();
  const [lienzo, setLienzo] = useState({ w: ventana.width, h: ventana.height });
  const [ficha, setFicha] = useState(-1);

  const { w, h } = lienzo;
  const geo = geometriaRueda(w, h);
  const mascara = useMemo(() => mascaraDisponibles(disponibles), [disponibles]);

  useEffect(() => {
    centroX.value = geo.cx;
    centroY.value = geo.cy;
    escala.value = geo.escala;
  }, [geo.cx, geo.cy, geo.escala, centroX, centroY, escala]);

  // Animaciones (hilo de la interfaz).
  const velo = useSharedValue(0);
  const abre = useSharedValue(reducido ? 1 : 0.86);
  const rueda = useSharedValue(0);
  const baja = useSharedValue(0);
  const progreso = useSharedValue(0);
  const recarga = useSharedValue(0);
  const x0 = useSharedValue(0);
  const y0 = useSharedValue(0);
  // ¿Llegó a activarse el arrastre? Un toque quieto y corto puede acabar sin
  // activar el Pan (en algunas plataformas no hay ni un evento de movimiento):
  // entonces onEnd no llega y el toque se elige en onFinalize.
  const panActivo = useSharedValue(0);

  // Abrir: tiempo bala.
  useEffect(() => {
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
        reducido ? 60 : 160,
        withTiming(0, { duration: reducido ? MS_FUNDIDO : 260 }, (ok) => {
          if (ok) scheduleOnRN(alCerrar);
        }),
      );
    };
    rueda.value = withTiming(0, { duration: reducido ? 0 : 140 });
    recarga.value = withTiming(1, { duration: reducido ? MS_FUNDIDO : 160 });
    if (reducido) {
      progreso.value = 1;
      recarga.value = withTiming(1, { duration: MS_FUNDIDO }, (ok) => {
        if (ok) scheduleOnRN(fin);
      });
    } else {
      progreso.value = withTiming(1, { duration: MS_RECARGA, easing: Easing.out(Easing.cubic) }, (ok) => {
        if (ok) scheduleOnRN(fin);
      });
    }
    // Una recarga por elección.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegido]);

  // Cancelar: la rueda baja y se funde.
  useEffect(() => {
    if (!cerrando) return;
    if (!reducido) baja.value = withTiming(baja.value + 60, { duration: 160 });
    velo.value = withTiming(0, { duration: reducido ? MS_FUNDIDO : 160 }, (ok) => {
      if (ok) scheduleOnRN(alCerrar);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cerrando]);

  // Abierta con un toque: se elige tocando; deslizar hacia abajo cierra.
  const { cx, cy } = geo;
  const esc = geo.escala;
  const tocar = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .enabled(origen === 'toque' && !elegido && !cerrando)
        .onBegin((e) => {
          panActivo.value = 0;
          x0.value = e.x;
          y0.value = e.y;
          dedoX.value = e.absoluteX;
          dedoY.value = e.absoluteY;
          resaltado.value = sectorEn(e.x - cx, e.y - cy, esc, mascara);
        })
        .onStart(() => {
          panActivo.value = 1;
        })
        .onUpdate((e) => {
          dedoX.value = e.absoluteX;
          dedoY.value = e.absoluteY;
          const dy = e.translationY;
          if (dy > UMBRAL_MOVIMIENTO && dy > Math.abs(e.translationX)) {
            baja.value = dy;
            resaltado.value = -1;
          } else {
            baja.value = 0;
            resaltado.value = sectorEn(e.x - cx, e.y - cy, esc, mascara);
          }
        })
        .onEnd((e) => {
          const fin = finDeGesto(e.translationX, e.translationY, e.velocityY);
          if (fin === 'deslizar') {
            scheduleOnRN(alPedirCierre);
          } else if (fin === 'toque') {
            scheduleOnRN(alElegir, sectorEn(x0.value - cx, y0.value - cy, esc, mascara));
          } else if (baja.value > 0) {
            baja.value = withSpring(0, { damping: 18, stiffness: 220 });
            resaltado.value = -1;
          } else {
            scheduleOnRN(alElegir, resaltado.value);
          }
        })
        .onFinalize(() => {
          // Tocar un modo con la rueda abierta, sin arrastrar: si el Pan no
          // llegó a activarse, el toque elige aquí (TAREA 2, General v2).
          if (panActivo.value === 0) scheduleOnRN(alElegir, sectorEn(x0.value - cx, y0.value - cy, esc, mascara));
          panActivo.value = 0;
        }),
    [origen, elegido, cerrando, cx, cy, esc, mascara, x0, y0, panActivo, dedoX, dedoY, baja, resaltado, alElegir, alPedirCierre],
  );

  const estiloVelo = useAnimatedStyle(() => ({ opacity: velo.value }));
  const estiloRueda = useAnimatedStyle(() => ({
    opacity: rueda.value * interpolate(baja.value, [0, 220], [1, 0.2], 'clamp'),
    transform: [{ translateY: baja.value }, { scale: abre.value }],
  }));
  const estiloRecarga = useAnimatedStyle(() => ({ opacity: recarga.value }));

  const alMedir = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - w) > 0.5 || Math.abs(height - h) > 0.5) setLienzo({ w: width, h: height });
  };

  const fichaModo = ficha >= 0 ? ORDEN_RUEDA[ficha] : null;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={alPedirCierre}>
      <GestureHandlerRootView style={styles.lleno}>
        <GestureDetector gesture={tocar}>
          <Animated.View
            style={[styles.lleno, estiloVelo]}
            onLayout={alMedir}
            accessibilityViewIsModal
            accessibilityLabel={t('modos:rueda.a11y')}
            onAccessibilityEscape={alPedirCierre}
          >
            <VeloRueda resaltado={resaltado} />
            {!elegido ? (
              <GuiaDedo ancho={w} alto={h} emblema={emblema} modo={modo} disponibles={disponibles} dedoX={dedoX} dedoY={dedoY} resaltado={resaltado} mantener={origen === 'mantener'} capa="fondo" />
            ) : null}

            {!elegido ? (
              <Animated.View style={[StyleSheet.absoluteFill, estiloRueda]} pointerEvents="none">
                <FichaRueda
                  modo={fichaModo}
                  actual={modo}
                  anterior={anterior}
                  ancho={w}
                  sitio={sitioFicha(w, geo, topFicha(geo), space.s8)}
                  arribaRueda={geo.cy - geo.D / 2}
                />
                <View style={{ position: 'absolute', left: cx - geo.D / 2, top: cy - geo.D / 2 }}>
                  <DiscoRueda lado={geo.D} modo={modo} anterior={anterior} mascara={mascara} resaltado={resaltado} />
                </View>
              </Animated.View>
            ) : null}

            {!elegido ? (
              <GuiaDedo ancho={w} alto={h} emblema={emblema} modo={modo} disponibles={disponibles} dedoX={dedoX} dedoY={dedoY} resaltado={resaltado} mantener={origen === 'mantener'} capa="dedo" />
            ) : null}

            {Platform.OS === 'web' && !elegido && !cerrando ? (
              <SectoresTeclado cx={cx} cy={cy} escala={esc} mascara={mascara} resaltado={resaltado} alElegir={alElegir} />
            ) : null}

            {elegido ? (
              <Animated.View style={[StyleSheet.absoluteFill, estiloRecarga]} pointerEvents="none">
                <RecargaModo modo={elegido} ancho={w} alto={h} progreso={progreso} reducido={reducido} />
              </Animated.View>
            ) : null}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** ¿El foco llegó por teclado? Un navegador sin `:focus-visible` lanza: se da por sí. */
function focoDeTeclado(destino: unknown): boolean {
  try {
    return (destino as Element).matches(':focus-visible');
  } catch {
    return true;
  }
}

/** Lado de la parada de teclado de cada hueco, en unidades de la lámina. */
const LADO_SECTOR_TECLADO = 56;

/**
 * Web: una parada de tabulador sobre cada hueco de la rueda, porque el gesto no
 * llega al teclado. Tabular enciende el sector (como apuntarlo) y Enter lo
 * elige; Escape cierra (onRequestClose). Con `pointerEvents: none` el ratón
 * sigue yendo al gesto, sin dos caminos para un mismo clic.
 */
function SectoresTeclado({ cx, cy, escala, mascara, resaltado, alElegir }: {
  cx: number;
  cy: number;
  escala: number;
  mascara: readonly boolean[];
  resaltado: SharedValue<number>;
  alElegir: (indice: number) => void;
}) {
  const lado = LADO_SECTOR_TECLADO * escala;
  return (
    <>
      {ORDEN_RUEDA.map((m, i) => {
        if (!mascara[i]) return null;
        const p = m === 'general' ? { x: cx, y: cy } : puntoEn(cx, cy, RUEDA.icono * escala, ANGULO_MODO[m]);
        return (
          <Pressable
            key={m}
            pointerEvents="none"
            onPress={() => alElegir(i)}
            onFocus={(e) => {
              // La rueda abierta con ratón también recibe el foco (la trampa
              // del Modal): solo enciende el sector si se ha llegado con teclado.
              if (focoDeTeclado(e.target)) resaltado.value = i;
            }}
            onBlur={() => {
              resaltado.value = -1;
            }}
            accessibilityRole="button"
            accessibilityLabel={t('modos:rueda.cambiarA', { modo: NOMBRE_MODO[m] })}
            style={{ position: 'absolute', left: p.x - lado / 2, top: p.y - lado / 2, width: lado, height: lado, borderRadius: lado / 2 }}
          />
        );
      })}
    </>
  );
}

/** El velo: la app se apaga y, al apuntar, toma el tinte del modo (lámina 1, cuadro 03). */
export function VeloRueda({ resaltado }: { resaltado: SharedValue<number> }) {
  const tintes = ORDEN_RUEDA.map((m) => conAlfa(acentoRueda[m], 0.1));
  // Con desenfoque (expo-blur o web) la app se intuye debajo; sin él, el velo tapa más.
  const negro = hayDesenfoque() ? 0.55 : 0.7;
  const sinTinte = conAlfa(ink.ink0, 0);
  const estiloTinte = useAnimatedStyle(() => {
    const i = resaltado.value;
    return { backgroundColor: i >= 0 && i < tintes.length ? tintes[i] : sinTinte };
  });
  return (
    <>
      <Desenfoque />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: conAlfa(ink.ink0, negro) }]} pointerEvents="none" />
      <Animated.View style={[StyleSheet.absoluteFill, estiloTinte]} pointerEvents="none" />
    </>
  );
}

/** Dónde va la ficha de arriba. */
export function topFicha(geo: { cy: number; D: number }): number {
  return Math.max(space.s14, geo.cy - geo.D / 2 - 150);
}

export interface GuiaDedoProps {
  ancho: number;
  alto: number;
  emblema: (OrigenEmblema & { forma: FormaEmblema; tamano: number }) | null;
  modo: ModoId;
  disponibles: readonly ModoId[];
  dedoX: SharedValue<number>;
  dedoY: SharedValue<number>;
  resaltado: SharedValue<number>;
  /** Con el emblema mantenido la huella va siempre; con la rueda tocada, solo al apuntar. */
  mantener: boolean;
  /** 'fondo': emblema nítido y estela (debajo de la rueda y la ficha); 'dedo': la huella (encima). */
  capa: 'fondo' | 'dedo';
}

/**
 * Lámina 1, cuadro 03: el emblema de donde nace el gesto, nítido sobre el
 * desenfoque; la estela punteada del emblema al dedo y la huella del dedo.
 */
export function GuiaDedo({ ancho, alto, emblema, modo, disponibles, dedoX, dedoY, resaltado, mantener, capa }: GuiaDedoProps) {
  const visible = useDerivedValue(() => (dedoX.value > 0 || dedoY.value > 0) && (mantener || resaltado.value >= 0));
  const propsEstela = useAnimatedProps(() => ({
    x2: dedoX.value,
    y2: dedoY.value,
    strokeOpacity: visible.value ? 0.7 : 0,
  }));
  const estiloHuella = useAnimatedStyle(() => ({
    opacity: visible.value ? 1 : 0,
    transform: [{ translateX: dedoX.value - HUELLA / 2 }, { translateY: dedoY.value - HUELLA / 2 }],
  }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {capa === 'dedo' && emblema ? (
        <Svg width={ancho} height={alto} style={StyleSheet.absoluteFill}>
            <AnimatedLine
              x1={emblema.x}
              y1={emblema.y}
              stroke={ink.ink9}
              strokeWidth={2}
              strokeDasharray="4 6"
              strokeLinecap="round"
              animatedProps={propsEstela}
            />
        </Svg>
      ) : null}
      {capa === 'fondo' && emblema ? (
        <View style={{ position: 'absolute', left: emblema.x - emblema.tamano / 2, top: emblema.y - emblema.tamano / 2 }}>
          <DibujoEmblema forma={emblema.forma} tamano={emblema.tamano} modo={modo} disponibles={disponibles} />
        </View>
      ) : null}
      {capa === 'dedo' ? <AnimatedView style={[styles.huella, estiloHuella]} /> : null}
    </View>
  );
}

const HUELLA = 64;

// ─────────────────────────────── La rueda ───────────────────────────────

export interface DiscoRuedaProps {
  /** Lado en pt (la lámina: 260 de 342 de pantalla). */
  lado: number;
  modo: ModoId;
  anterior: ModoId | null;
  mascara: readonly boolean[];
  resaltado: SharedValue<number>;
}

/** La rueda de la lámina: disco con regla de muescas, cuatro sectores y la base en el centro. */
export function DiscoRueda({ lado, modo, anterior, mascara, resaltado }: DiscoRuedaProps) {
  const k = lado / VISTA_RUEDA;
  const v = VISTA_RUEDA / 2;
  const muescas = useMemo(
    () =>
      Array.from({ length: 72 }, (_, i) => {
        const a = (i * 5 * Math.PI) / 180;
        const r1 = RUEDA.fuera;
        const r2 = i % 6 ? 101 : 97;
        return { x1: Math.cos(a) * r1, y1: Math.sin(a) * r1, x2: Math.cos(a) * r2, y2: Math.sin(a) * r2, fuerte: i % 6 === 0 };
      }),
    [],
  );
  const hilo = acentoRueda.general;

  return (
    <View style={{ width: lado, height: lado }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={lado} height={lado} viewBox={`${-v} ${-v} ${VISTA_RUEDA} ${VISTA_RUEDA}`}>
        <Circle r={RUEDA.fuera} fill={conAlfa(ink.ink0, 0.55)} stroke={vidrio.linea} strokeWidth={1} />
        {muescas.map((m, i) => (
          <Line key={i} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke={m.fuerte ? oro.borde : vidrio.linea} strokeWidth={1} />
        ))}
        {MODOS_ETIQUETA.map((m, j) => (
          <SectorRueda key={m} modo={m} disponible={mascara[j + 1]} />
        ))}
        <Circle r={RUEDA.centro} fill={ink.ink0} stroke={hilo} strokeOpacity={0.55} strokeWidth={1.5} />
      </Svg>

      {/* Lo encendido va en capas aparte y la opacidad la anima una View, no
          el SVG: en iOS react-native-svg a veces no repinta un G animado al
          volver a 0 y los sectores se quedaban marcados hasta pasar el dedo. */}
      {MODOS_ETIQUETA.map((m, j) =>
        mascara[j + 1] ? <SectorEncendido key={m} modo={m} indice={j + 1} lado={lado} resaltado={resaltado} /> : null,
      )}
      <CentroEncendido lado={lado} resaltado={resaltado} />

      {/* Iconos y nombres (texto de la app, no del SVG: así usa Outfit). */}
      {MODOS_ETIQUETA.map((m, j) => (
        <RotuloSector key={m} modo={m} indice={j + 1} k={k} lado={lado} disponible={mascara[j + 1]} resaltado={resaltado} />
      ))}

      {/* La base. */}
      <View style={[styles.centroCaja, { left: lado / 2 - RUEDA.centro * k, top: lado / 2 - RUEDA.centro * k, width: RUEDA.centro * 2 * k, height: RUEDA.centro * 2 * k }]} pointerEvents="none">
        <View style={{ marginTop: -4 * k }}>
          <GlifoModo modo="general" tamano={Math.round(25 * k)} color={hilo} />
        </View>
        <Text style={[styles.base, { color: hilo, fontSize: Math.max(11, 7 * k), letterSpacing: 1.4 * k }]} maxFontSizeMultiplier={1}>
          {t('modos:rueda.base')}
        </Text>
      </View>

      {/* ACTUAL y ANTERIOR (lámina 4). */}
      <PlacaRueda modo={modo} tipo="actual" k={k} lado={lado} resaltado={resaltado} />
      {anterior && anterior !== modo ? <PlacaRueda modo={anterior} tipo="anterior" k={k} lado={lado} resaltado={resaltado} /> : null}
    </View>
  );
}

function SectorRueda({ modo, disponible }: { modo: ModoEtiqueta; disponible: boolean }) {
  const d = trazoSector(0, 0, RUEDA.sectorDentro, RUEDA.sectorFuera, ANGULO_MODO[modo], 90, 2);
  if (!disponible) {
    return <Path d={d} fill="none" stroke={vidrio.borde} strokeWidth={1} strokeDasharray="3 4" />;
  }
  return <Path d={d} fill={vidrio.tarjeta} stroke={vidrio.borde} strokeWidth={1} />;
}

/** Una capa encima del disco, del mismo lado y la misma caja de vista, que solo se ve cuando su índice está apuntado. */
function CapaEncendida({ indice, lado, resaltado, children }: { indice: number; lado: number; resaltado: SharedValue<number>; children: ReactNode }) {
  const v = VISTA_RUEDA / 2;
  const estilo = useAnimatedStyle(() => ({ opacity: opacidadApuntado(resaltado.value, indice) }));
  return (
    <Animated.View style={[styles.capaEncendida, { width: lado, height: lado, opacity: 0 }, estilo]} pointerEvents="none">
      <Svg width={lado} height={lado} viewBox={`${-v} ${-v} ${VISTA_RUEDA} ${VISTA_RUEDA}`}>
        {children}
      </Svg>
    </Animated.View>
  );
}

function SectorEncendido({ modo, indice, lado, resaltado }: { modo: ModoEtiqueta; indice: number; lado: number; resaltado: SharedValue<number> }) {
  const col = acentoRueda[modo];
  const ang = ANGULO_MODO[modo];
  const d = trazoSector(0, 0, RUEDA.sectorDentro, RUEDA.sectorFuera, ang, 90, 2);
  const dHalo = trazoSector(0, 0, RUEDA.filoDentro, RUEDA.filoFuera, ang, 90, 5);
  // Filo exterior de 3 pt de pantalla con la rueda a ~1,35 de escala.
  const dFilo = trazoSector(0, 0, RUEDA.filoDentro + 0.6, RUEDA.filoDentro + 2.8, ang, 90, 4);
  return (
    <CapaEncendida indice={indice} lado={lado} resaltado={resaltado}>
      {/* Halo corto del filo (la lámina lo desenfoca). */}
      <Path d={dHalo} fill="none" stroke={col} strokeOpacity={0.14} strokeWidth={6} strokeLinejoin="round" />
      <Path d={d} fill={oro.tenue} stroke={oro.hilo} strokeWidth={1.5} />
      <Path d={dFilo} fill={col} />
    </CapaEncendida>
  );
}

function CentroEncendido({ lado, resaltado }: { lado: number; resaltado: SharedValue<number> }) {
  const hilo = acentoRueda.general;
  return (
    <CapaEncendida indice={0} lado={lado} resaltado={resaltado}>
      <Circle r={RUEDA.centro + 5} fill="none" stroke={hilo} strokeOpacity={0.18} strokeWidth={8} />
      <Circle r={RUEDA.centro} fill={hilo} fillOpacity={0.25} stroke={hilo} strokeWidth={2.5} />
    </CapaEncendida>
  );
}

function RotuloSector({
  modo,
  indice,
  k,
  lado,
  disponible,
  resaltado,
}: {
  modo: ModoEtiqueta;
  indice: number;
  k: number;
  lado: number;
  disponible: boolean;
  resaltado: SharedValue<number>;
}) {
  const col = acentoRueda[modo];
  const p = puntoEn(lado / 2, lado / 2, RUEDA.icono * k, ANGULO_MODO[modo]);
  const lado24 = Math.round(24 * k);
  const caja = 100;
  const estiloOn = useAnimatedStyle(() => ({ opacity: opacidadApuntado(resaltado.value, indice) }));
  const estiloOff = useAnimatedStyle(() => ({ opacity: 1 - opacidadApuntado(resaltado.value, indice) }));
  const nombre = { fontSize: Math.max(11, 8 * k), lineHeight: Math.max(14, 10 * k), letterSpacing: 1.4 * k };
  return (
    <View style={[styles.rotulo, { left: p.x - caja / 2, top: p.y - 6 * k - lado24 / 2, width: caja }]} pointerEvents="none">
      <View style={{ width: lado24, height: lado24, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.medio, estiloOff]}>
          <GlifoModo modo={modo} tamano={Math.round(lado24 * 0.85)} color={disponible ? col : ink.ink4} />
        </Animated.View>
        {disponible ? (
          <Animated.View style={[StyleSheet.absoluteFill, styles.medio, styles.apagadoInicio, estiloOn]}>
            <GlifoModo modo={modo} tamano={Math.round(lado24 * 1.05)} color={ink.ink10} />
          </Animated.View>
        ) : null}
      </View>
      <View style={{ marginTop: 5 * k }}>
        <Animated.Text
          style={[styles.nombreSector, nombre, { color: disponible ? HUESO : ink.ink4 }, estiloOff]}
          maxFontSizeMultiplier={1}
        >
          {NOMBRE_MODO[modo]}
        </Animated.Text>
        {disponible ? (
          <Animated.Text style={[styles.nombreSector, styles.encima, nombre, { color: ink.ink10 }, styles.apagadoInicio, estiloOn]} maxFontSizeMultiplier={1}>
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

/** La placa ACTUAL (blanca) o ANTERIOR (de trazo) sobre el borde de su sector, o bajo la base. */
function PlacaRueda({
  modo,
  tipo: clase,
  k,
  lado,
  resaltado,
}: {
  modo: ModoId;
  tipo: 'actual' | 'anterior';
  k: number;
  lado: number;
  resaltado: SharedValue<number>;
}) {
  const p = modo === 'general' ? { x: lado / 2, y: lado / 2 + RUEDA.centro * k } : puntoEn(lado / 2, lado / 2, 86 * k, ANGULO_MODO[modo]);
  const actual = clase === 'actual';
  const propio = ORDEN_RUEDA.indexOf(modo);
  // Mientras se apunta a otro sector, las placas se apartan (lámina 1, cuadro 03).
  const estilo = useAnimatedStyle(() => ({ opacity: resaltado.value >= 0 && resaltado.value !== propio ? 0 : 1 }));
  return (
    <AnimatedView style={[styles.placaCaja, { left: p.x - 50, top: p.y - 9 }, estilo]} pointerEvents="none">
      <View style={[styles.placa, actual ? styles.placaActual : styles.placaAnterior]}>
        <Text style={actual ? styles.placaTexto : styles.placaTextoAnterior} maxFontSizeMultiplier={1}>
          {actual ? t('modos:rueda.actual') : t('modos:rueda.anterior')}
        </Text>
      </View>
    </AnimatedView>
  );
}

// ─────────────────────────────── La ficha ───────────────────────────────

export interface FichaRuedaProps {
  /** El modo apuntado (null: aún nada, «ELIGE MODO»). */
  modo: ModoId | null;
  actual: ModoId;
  anterior: ModoId | null;
  ancho: number;
  /** Dónde va la ficha (sitioFicha); null: no cabe y no se pinta. */
  sitio: SitioFicha | null;
  /** Dónde empieza la rueda (y del disco): «ELIGE MODO» va 24 pt por encima. */
  arribaRueda: number;
}

/** Arriba de la rueda: «ELIGE MODO» y, al apuntar, la ficha de lo que se va a cargar (lámina 1, cuadro 03). */
export function FichaRueda({ modo, actual, anterior, ancho, sitio, arribaRueda }: FichaRuedaProps) {
  if (!modo) {
    return (
      <View style={[styles.fichaVacia, { top: arribaRueda - 24 - 14, width: ancho }]} pointerEvents="none">
        <Text style={styles.eyebrow} maxFontSizeMultiplier={1.35}>
          {t('modos:rueda.eyebrow')}
        </Text>
      </View>
    );
  }
  if (!sitio) return null;
  const estado = modo === actual ? t('modos:rueda.actual') : modo === anterior ? t('modos:rueda.anterior') : null;
  return (
    <View
      style={[
        styles.ficha,
        {
          ...sitio,
          borderColor: oro.borde,
          backgroundColor: conAlfa(ink.ink1, 0.94),
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.fichaFila}>
        <Text style={styles.fichaNombre} maxFontSizeMultiplier={1} numberOfLines={1}>
          {NOMBRE_MODO[modo]}
        </Text>
        {estado ? (
          <View style={[styles.placa, modo === actual ? styles.placaActual : styles.placaAnterior]}>
            <Text style={modo === actual ? styles.placaTexto : styles.placaTextoAnterior} maxFontSizeMultiplier={1}>
              {estado}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.fichaSub} maxFontSizeMultiplier={1.35} numberOfLines={1}>
        {t(`modos:rueda.subtitulo.${modo}`)}
      </Text>
      <Text style={styles.fichaLinea} maxFontSizeMultiplier={1.35} numberOfLines={2}>
        {t(`modos:descripcion.${modo}`)}
      </Text>
    </View>
  );
}

// ─────────────────────────────── La recarga ───────────────────────────────

export interface RecargaModoProps {
  modo: ModoId;
  ancho: number;
  alto: number;
  /** 0 a 1 a lo largo de la recarga. */
  progreso: SharedValue<number>;
  reducido: boolean;
}

/** Lámina 1, cuadro 04 (y lámina 4, «recarga dorada» para NIVL). */
export function RecargaModo({ modo, ancho: w, alto: h, progreso, reducido }: RecargaModoProps) {
  const col = acentoRueda[modo];
  const base = modo === 'general';
  const k = w / 342;
  const yOnda = h * 0.93;
  const estiloFondo = useAnimatedStyle(() => ({ opacity: interpolate(progreso.value, [0, 0.45], [0.25, 1], 'clamp') }));
  const estiloTambor = useAnimatedStyle(() => ({
    transform: [{ rotate: `${reducido ? 20 : interpolate(progreso.value, [0, 1], [-70, 20])}deg` }],
  }));
  const estiloTexto = useAnimatedStyle(() => ({ opacity: interpolate(progreso.value, [0, 0.3], [0, 1], 'clamp') }));
  const anchoBarra = Math.round(150 * k);
  const estiloBarra = useAnimatedStyle(() => ({ width: anchoBarra * Math.min(1, progreso.value) }));
  const lado = Math.round(130 * k);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: ink.ink0 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, estiloFondo]}>
        <Svg width={w} height={h}>
          <Defs>
            {base ? (
              <RadialGradient id="recarga" cx="0.5" cy="0.5" r="0.5">
                <Stop offset="0" stopColor={col} stopOpacity={0.24} />
                <Stop offset="0.32" stopColor={col} stopOpacity={0.1} />
                <Stop offset="0.72" stopColor={col} stopOpacity={0} />
                <Stop offset="1" stopColor={col} stopOpacity={0} />
              </RadialGradient>
            ) : (
              <RadialGradient id="recarga" cx="0.5" cy="0.5" r="0.5">
                <Stop offset="0" stopColor={col} stopOpacity={0.24} />
                <Stop offset="0.3" stopColor={col} stopOpacity={0.14} />
                <Stop offset="0.58" stopColor={col} stopOpacity={0.04} />
                <Stop offset="0.75" stopColor={col} stopOpacity={0} />
                <Stop offset="1" stopColor={col} stopOpacity={0} />
              </RadialGradient>
            )}
          </Defs>
          {/* radial-gradient(420px 520px at …) de la lámina: la elipse es la caja del degradado. */}
          <Rect x={w / 2 - 420 * k} y={(base ? 0.5 : 0.92) * h - 520 * k} width={840 * k} height={1040 * k} fill="url(#recarga)" />
          {!base ? [0, 1, 2].map((i) => <Onda key={i} i={i} cx={w / 2} cy={yOnda} k={k} progreso={progreso} reducido={reducido} />) : null}
        </Svg>
      </Animated.View>

      <View style={[styles.recargaCentro, { top: (base ? 0.31 * h + 15 : 0.337 * h), width: w }]}>
        {base ? (
          <View style={{ width: lado, height: lado, alignItems: 'center', justifyContent: 'center' }}>
            <GlifoModo modo="general" tamano={Math.round(130 * k)} color={ink.ink10} trazo={1.25} relleno={ink.ink0} colorN={col} trazoN={2} />
          </View>
        ) : (
          <View style={{ width: lado, height: lado }}>
            <Animated.View style={[StyleSheet.absoluteFill, estiloTambor]}>
              <Svg width={lado} height={lado} viewBox="-60 -60 120 120">
                <Circle r={52} fill={ink.ink0} stroke={oro.hilo} strokeWidth={2} />
                {Array.from({ length: 6 }, (_, i) => {
                  const a = ((i * 60 - 30) * Math.PI) / 180;
                  return <Circle key={i} cx={30 * Math.cos(a)} cy={30 * Math.sin(a)} r={9} fill={ink.ink0} stroke={oro.borde} strokeWidth={2} />;
                })}
              </Svg>
            </Animated.View>
            <Svg width={lado} height={lado} viewBox="-60 -60 120 120" style={StyleSheet.absoluteFill}>
              <Path d="M-58 -10 A58 58 0 0 1 -20 -54" fill="none" stroke={oro.claro} strokeWidth={2} strokeLinecap="round" />
              <Path d="M58 10 A58 58 0 0 1 20 54" fill="none" stroke={oro.claro} strokeWidth={2} strokeLinecap="round" />
            </Svg>
            <View style={[StyleSheet.absoluteFill, styles.medio]}>
              <GlifoModo modo={modo} tamano={Math.round(31 * k)} color={col} trazo={2.2} />
            </View>
          </View>
        )}
        <Animated.View style={[styles.medio, estiloTexto]}>
          <Text
            style={[styles.recargaNombre, { fontSize: Math.round(30 * k), lineHeight: Math.round(36 * k), marginTop: (base ? 4 : 14) * k, textShadowColor: conAlfa(col, 0.3) },
              // react-native-web ya no traduce textShadow*: en web, la sombra en CSS.
              Platform.OS === 'web' ? ({ textShadow: `0px 0px 18px ${conAlfa(col, 0.3)}` } as object) : null,
            ]}
            maxFontSizeMultiplier={1}
          >
            {NOMBRE_MODO[modo]}
          </Text>
          <Text
            style={[styles.recargaSub, base ? styles.recargaSubBase : null, { fontSize: Math.max(11, 11 * k) }]}
            maxFontSizeMultiplier={1}
          >
            {base ? t('modos:rueda.recargaBase') : t('modos:rueda.equipado')}
          </Text>
          {!base ? (
            <View style={[styles.barra, { width: anchoBarra, marginTop: 16 * k }]}>
              <Animated.View style={[styles.barraRelleno, estiloBarra]} />
            </View>
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}

function Onda({ i, cx, cy, k, progreso, reducido }: { i: number; cx: number; cy: number; k: number; progreso: SharedValue<number>; reducido: boolean }) {
  const r = (103 + i * 70) * k;
  const props = useAnimatedProps(() => ({ r: reducido ? r : r * interpolate(progreso.value, [0, 0.6], [0.35, 1], 'clamp') }));
  return <AnimatedCircle cx={cx} cy={cy} fill="none" stroke={oro.hilo} strokeOpacity={0.35 - i * 0.1} strokeWidth={2 - i * 0.5} animatedProps={props} />;
}

const styles = StyleSheet.create({
  /** Lo «apuntado» nace apagado; el estilo animado lo enciende bajo el dedo. */
  apagadoInicio: { opacity: 0 },
  lleno: { flex: 1 },
  medio: { alignItems: 'center', justifyContent: 'center' },
  centroCaja: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  capaEncendida: { position: 'absolute', left: 0, top: 0 },
  base: { fontFamily: OUTFIT_BLACK, marginTop: 1, textAlign: 'center' },
  rotulo: { position: 'absolute', alignItems: 'center' },
  nombreSector: { fontFamily: OUTFIT_BLACK, textAlign: 'center' },
  encima: { position: 'absolute', left: 0, right: 0, top: 0 },
  sinActivar: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    color: ink.ink6,
  },
  placaCaja: { position: 'absolute', width: 100, alignItems: 'center' },
  placa: { paddingHorizontal: space.s2, height: 18, borderRadius: radio.pastilla, alignItems: 'center', justifyContent: 'center' },
  placaActual: { backgroundColor: ink.ink10 },
  placaAnterior: { backgroundColor: conAlfa(ink.ink0, 0.6), borderWidth: 1, borderColor: vidrio.borde, height: 16, paddingHorizontal: 5 },
  placaTexto: { fontFamily: OUTFIT_BLACK, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, color: ink.ink0 },
  placaTextoAnterior: { fontFamily: OUTFIT_BOLD, fontSize: 10, lineHeight: 12, letterSpacing: 1, color: ink.ink6 },
  fichaVacia: { position: 'absolute', left: 0, alignItems: 'center' },
  eyebrow: {
    fontFamily: OUTFIT_BOLD,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: ink.ink8,
  },
  ficha: { position: 'absolute', borderWidth: 1, borderRadius: radio.control, paddingHorizontal: 14, paddingVertical: 12 },
  fichaFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s2 },
  fichaNombre: { fontFamily: TITULAR, fontSize: 21, lineHeight: 26, letterSpacing: 1.3, color: ink.ink10, flexShrink: 1 },
  fichaSub: { fontFamily: OUTFIT_MEDIO, fontSize: 12, lineHeight: 16, marginTop: 1, color: oro.claro },
  fichaLinea: { fontFamily: tipo.micro.family, fontSize: 13, lineHeight: 18, color: ink.ink10, marginTop: 6 },
  huella: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: HUELLA,
    height: HUELLA,
    borderRadius: HUELLA / 2,
    backgroundColor: vidrio.pista,
    borderWidth: 2,
    borderColor: ink.ink9,
  },
  recargaCentro: { position: 'absolute', left: 0, alignItems: 'center' },
  recargaNombre: {
    fontFamily: TITULAR,
    color: ink.ink10,
    letterSpacing: 3,
    textAlign: 'center',
    // El halo va solo en el texto: sin fondo, sin recorte (sin numberOfLines,
    // que en web pone overflow hidden) y con aire para que no se corte.
    paddingHorizontal: 24,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  recargaSub: { fontFamily: OUTFIT_BLACK, marginTop: 4, textAlign: 'center', color: ink.ink8, letterSpacing: 4.2 },
  recargaSubBase: { color: ink.ink9, letterSpacing: 3 },
  barra: { height: 4, borderRadius: radio.pastilla, backgroundColor: vidrio.pista, overflow: 'hidden' },
  barraRelleno: { height: 4, backgroundColor: oro.hilo },
});
