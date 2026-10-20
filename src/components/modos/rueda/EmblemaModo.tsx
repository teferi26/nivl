// NIVL · Modos: el emblema del modo activo y su gesto (P01 + firmas de la P10).
//
//   · Mantener 300 ms: se abre la rueda (RuedaModos) y el mismo dedo arrastra
//     hasta el modo; soltar elige, soltar en el centro cancela.
//   · Toque corto: vuelve al modo anterior (solo la recarga, sin rueda). Si no
//     hay anterior, abre la rueda y se elige tocando.
//   · Lector de pantalla: acciones accesibles para elegir cada modo sin gesto.
//
// Los 4 puntos de color alrededor son la pista del gesto: cada uno está donde
// vive su modo en la rueda (gris si no está activado).
//
// `EmblemaModo` lee `useModo()` y no pinta nada con el interruptor
// `modos_activos` apagado. `EmblemaModoVista` es la pieza pura (galería /kit).
//
// Gesture Handler: la app no tiene GestureHandlerRootView en la raíz, así que
// el emblema y la rueda llevan el suyo.

import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { anunciar } from '@/components/ui/useAnunciar';
import { useMovimientoReducido } from '@/components/ui/motion';
import { vibrar } from '@/design/haptics';
import { ink, modoAcento, stroke } from '@/design/tokens';
import { t } from '@/i18n';
import { useModo } from '@/modos/ModoProvider';
import { ANGULO_MODO, destinoToqueCorto, mascaraDisponibles, modoDeIndice, puntoEn, sectorEn } from '@/modos/rueda';
import { MODOS_ETIQUETA, NOMBRE_MODO, type ModoId } from '@/modos/tipos';
import { GlifoModo } from './GlifoModo';
import { EVENTO_MODO, RuedaModos, type OrigenRueda } from './RuedaModos';
import { precargarSonidos, sonarModo } from './sonido';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Pulsación que abre la rueda (P01). */
export const MS_MANTENER = 300;
/** Radio muerto del pulgar: soltar dentro es «centro» y cancela. */
const RADIO_MUERTO = 22;

export interface EmblemaModoProps {
  /** Lado del emblema en pt (mínimo 44). Por defecto 56. */
  tamano?: number;
  /** Tras cambiar de modo (al encajar): aquí engancha el integrador la navegación al mundo del modo. */
  alCambiarModo?: (m: ModoId) => void;
}

/** El emblema conectado al modo de la cuenta. Con `modos_activos` apagado, nada. */
export function EmblemaModo({ tamano, alCambiarModo }: EmblemaModoProps) {
  const { activo, modo, anterior, disponibles, cambiar } = useModo();
  const alCambiar = useCallback(
    (m: ModoId) => {
      cambiar(m);
      alCambiarModo?.(m);
    },
    [cambiar, alCambiarModo],
  );
  if (!activo) return null;
  return <EmblemaModoVista tamano={tamano} modo={modo} anterior={anterior} disponibles={disponibles} alCambiar={alCambiar} />;
}

export interface EmblemaModoVistaProps {
  tamano?: number;
  modo: ModoId;
  anterior: ModoId | null;
  disponibles: readonly ModoId[];
  alCambiar: (m: ModoId) => void;
}

export function EmblemaModoVista({ tamano: pedido = 56, modo, anterior, disponibles, alCambiar }: EmblemaModoVistaProps) {
  const tamano = Math.max(44, pedido);
  const reducido = useMovimientoReducido();
  const [abierta, setAbierta] = useState(false);
  const [origen, setOrigen] = useState<OrigenRueda>('mantener');
  const [elegido, setElegido] = useState<ModoId | null>(null);
  const [cerrando, setCerrando] = useState(false);

  const vectorX = useSharedValue(0);
  const vectorY = useSharedValue(0);
  const resaltado = useSharedValue(-1);
  const carga = useSharedValue(0);
  const mascara = useMemo(() => mascaraDisponibles(disponibles), [disponibles]);

  // Lo que se llama desde el hilo de la interfaz pasa por aquí: siempre la
  // última versión, sin rehacer el gesto en cada render.
  const ultimo = useRef({ abierta, elegido, modo, anterior, disponibles, alCambiar });
  ultimo.current = { abierta, elegido, modo, anterior, disponibles, alCambiar };

  const abrir = useCallback(
    (o: OrigenRueda) => {
      vectorX.value = 0;
      vectorY.value = 0;
      resaltado.value = -1;
      precargarSonidos();
      setOrigen(o);
      setElegido(null);
      setCerrando(false);
      setAbierta(true);
      vibrar('ruedaAbre');
    },
    [vectorX, vectorY, resaltado],
  );

  const soltar = useCallback((indice: number) => {
    if (ultimo.current.elegido) return; // ya está recargando
    const m = modoDeIndice(indice);
    if (!m || m === ultimo.current.modo) setCerrando(true);
    else setElegido(m);
  }, []);

  /** Se perdió el dedo (el sistema canceló el toque): la rueda sigue abierta y se elige tocando. */
  const pasarAToque = useCallback(() => {
    if (!ultimo.current.abierta || ultimo.current.elegido) return;
    resaltado.value = -1;
    vectorX.value = 0;
    vectorY.value = 0;
    setOrigen('toque');
  }, [resaltado, vectorX, vectorY]);

  const toqueCorto = useCallback(() => {
    const { modo: actual, anterior: previo, disponibles: disp } = ultimo.current;
    const destino = destinoToqueCorto(actual, previo, disp);
    if (!destino) {
      abrir('toque');
      return;
    }
    precargarSonidos();
    setOrigen('recarga');
    setCerrando(false);
    setElegido(destino);
    setAbierta(true);
  }, [abrir]);

  const alEncajar = useCallback((m: ModoId) => {
    ultimo.current.alCambiar(m);
    anunciar(t('modos:rueda.activo', { modo: NOMBRE_MODO[m] }));
  }, []);

  const alCerrar = useCallback(() => {
    setAbierta(false);
    setElegido(null);
    setCerrando(false);
    resaltado.value = -1;
  }, [resaltado]);

  const gesto = useMemo(() => {
    const mantener = Gesture.Pan()
      .activateAfterLongPress(MS_MANTENER)
      .onBegin(() => {
        if (!reducido) carga.value = withTiming(1, { duration: MS_MANTENER });
      })
      .onStart(() => {
        scheduleOnRN(abrir, 'mantener');
      })
      .onUpdate((e) => {
        vectorX.value = e.translationX;
        vectorY.value = e.translationY;
        resaltado.value = sectorEn(e.translationX, e.translationY, RADIO_MUERTO, mascara);
      })
      .onEnd((_e, ok) => {
        if (ok) scheduleOnRN(soltar, resaltado.value);
        else scheduleOnRN(pasarAToque);
      })
      .onFinalize(() => {
        carga.value = 0;
      });
    const toque = Gesture.Tap()
      .maxDuration(MS_MANTENER)
      .onEnd((_e, ok) => {
        if (ok) scheduleOnRN(toqueCorto);
      });
    return Gesture.Exclusive(mantener, toque);
  }, [reducido, carga, abrir, vectorX, vectorY, resaltado, mascara, soltar, pasarAToque, toqueCorto]);

  // Lector de pantalla: cada modo es una acción, sin gesto ni animación.
  const otros = disponibles.filter((m) => m !== modo);
  const acciones = [
    { name: 'activate', label: anterior && otros.includes(anterior) ? t('modos:rueda.volver') : t('modos:rueda.abrir') },
    { name: 'longpress', label: t('modos:rueda.abrir') },
    ...otros.map((m) => ({ name: `modo:${m}`, label: t('modos:rueda.cambiarA', { modo: NOMBRE_MODO[m] }) })),
  ];
  const alAccion = (e: AccessibilityActionEvent) => {
    const nombre = e.nativeEvent.actionName;
    if (nombre === 'activate') return toqueCorto();
    if (nombre === 'longpress') return abrir('toque');
    const m = nombre.startsWith('modo:') ? (nombre.slice(5) as ModoId) : null;
    if (!m || !otros.includes(m)) return;
    sonarModo(m);
    vibrar(EVENTO_MODO[m]);
    alEncajar(m);
  };

  // Dibujo.
  const c = tamano / 2;
  const rDisco = tamano * 0.33;
  const rCarga = tamano * 0.4;
  const rPuntos = c - 3;
  const circunferencia = 2 * Math.PI * rCarga;
  const acento = modoAcento[modo];
  const propsCarga = useAnimatedProps(() => ({ strokeDashoffset: circunferencia * (1 - carga.value) }));

  return (
    <>
      <GestureHandlerRootView style={{ width: tamano, height: tamano }}>
        <GestureDetector gesture={gesto}>
          <View
            style={{ width: tamano, height: tamano }}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('modos:rueda.emblema', { modo: NOMBRE_MODO[modo] })}
            accessibilityHint={t('modos:rueda.pista')}
            accessibilityActions={acciones}
            onAccessibilityAction={alAccion}
          >
            <Svg width={tamano} height={tamano}>
              {MODOS_ETIQUETA.map((m) => {
                const p = puntoEn(c, c, rPuntos, ANGULO_MODO[m]);
                return <Circle key={m} cx={p.x} cy={p.y} r={2.5} fill={disponibles.includes(m) ? modoAcento[m] : ink.ink4} />;
              })}
              <AnimatedCircle
                cx={c}
                cy={c}
                r={rCarga}
                fill="none"
                stroke={acento}
                strokeWidth={stroke.rule}
                strokeDasharray={`${circunferencia} ${circunferencia}`}
                transform={`rotate(-90 ${c} ${c})`}
                animatedProps={propsCarga}
              />
              <Circle cx={c} cy={c} r={rDisco} fill={ink.ink1} stroke={acento} strokeWidth={stroke.rule} />
            </Svg>
            <View style={styles.glifo} pointerEvents="none">
              <GlifoModo modo={modo} tamano={Math.round(rDisco * 1.1)} color={acento} />
            </View>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
      {abierta ? (
        <RuedaModos
          origen={origen}
          modo={modo}
          disponibles={disponibles}
          vectorX={vectorX}
          vectorY={vectorY}
          resaltado={resaltado}
          elegido={elegido}
          cerrando={cerrando}
          reducido={reducido}
          alSoltar={soltar}
          alEncajar={alEncajar}
          alCerrar={alCerrar}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  glifo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});
