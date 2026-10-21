// NIVL · Modos: el emblema del modo activo y su gesto (P01 + firmas de la P10).
//
//   · Toque: ABRE la rueda y se queda abierta; se toca el modo y recarga.
//     Tocar fuera o deslizar hacia abajo la cierra sin cambiar (RuedaModos).
//   · Mantener 300 ms (atajo): se abre la rueda y el mismo dedo arrastra hasta
//     el modo; soltar elige. Soltar fuera de la rueda cancela; soltar sin
//     haber movido el dedo deja la rueda abierta, como un toque.
//   · Lector de pantalla: «activar» abre la rueda y cada modo es una acción.
//
// Dos formas, las de la lámina P01:
//   · 'disco' (Hoy de NIVL, la barra): círculo negro con el aro del acento, su
//     halo y los cuatro puntos de los modos donde viven en la rueda.
//   · 'placa' (cabecera de cada mundo): la placa redondeada con el acento al
//     14 % y el halo. El marco de la marca MK lo pone EmblemaMundo.
//
// `EmblemaModo` lee `useModo()` y no pinta nada con el interruptor
// `modos_activos` apagado. `EmblemaModoVista` es la pieza pura (galería /kit).
//
// Gesture Handler: el GestureHandlerRootView está en la raíz (src/app/_layout.tsx).
// La rueda lleva además el suyo porque va en un Modal (en Android, otra raíz).

import { useCallback, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { anunciar } from '@/components/ui/useAnunciar';
import { useMovimientoReducido } from '@/components/ui/motion';
import { vibrar } from '@/design/haptics';
import { t } from '@/i18n';
import { useModo } from '@/modos/ModoProvider';
import { mascaraDisponibles, resultadoEleccion, sectorEn, seMovio } from '@/modos/rueda';
import { NOMBRE_MODO, type ModoId } from '@/modos/tipos';
import { DibujoEmblema, type FormaEmblema } from './DibujoEmblema';
import { EVENTO_MODO, geometriaRueda, RuedaModos, type OrigenEmblema, type OrigenRueda } from './RuedaModos';
import { precargarSonidos, sonarModo } from './sonido';

/** Pulsación que abre la rueda con el atajo (P01). */
export const MS_MANTENER = 300;

export type { FormaEmblema } from './DibujoEmblema';

export interface EmblemaModoProps {
  /** Lado del emblema en pt (mínimo 44). Por defecto 56. */
  tamano?: number;
  forma?: FormaEmblema;
  /**
   * Al encajar un modo. Si se pasa, es QUIEN cambia el modo (EmblemaMundo pasa
   * `irAlMundo`: cambio y navegación en un solo paso); sin él, solo `cambiar`.
   */
  alCambiarModo?: (m: ModoId) => void;
}

/** El emblema conectado al modo de la cuenta. Con `modos_activos` apagado, nada. */
export function EmblemaModo({ tamano, forma, alCambiarModo }: EmblemaModoProps) {
  const { activo, modo, anterior, disponibles, cambiar } = useModo();
  const alCambiar = useCallback(
    (m: ModoId) => {
      if (alCambiarModo) alCambiarModo(m);
      else cambiar(m);
    },
    [cambiar, alCambiarModo],
  );
  if (!activo) return null;
  return (
    <EmblemaModoVista tamano={tamano} forma={forma} modo={modo} anterior={anterior} disponibles={disponibles} alCambiar={alCambiar} />
  );
}

export interface EmblemaModoVistaProps {
  tamano?: number;
  forma?: FormaEmblema;
  modo: ModoId;
  anterior: ModoId | null;
  disponibles: readonly ModoId[];
  alCambiar: (m: ModoId) => void;
}

export function EmblemaModoVista({ tamano: pedido = 56, forma = 'disco', modo, anterior, disponibles, alCambiar }: EmblemaModoVistaProps) {
  const tamano = Math.max(44, pedido);
  const reducido = useMovimientoReducido();
  const ventana = useWindowDimensions();
  const [abierta, setAbierta] = useState(false);
  const [origen, setOrigen] = useState<OrigenRueda>('toque');
  const [elegido, setElegido] = useState<ModoId | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [origenEmblema, setOrigenEmblema] = useState<OrigenEmblema | null>(null);
  const vista = useRef<View>(null);

  // Dónde está la rueda (la mide RuedaModos; hasta entonces, la ventana).
  const geo = geometriaRueda(ventana.width, ventana.height);
  const centroX = useSharedValue(geo.cx);
  const centroY = useSharedValue(geo.cy);
  const escala = useSharedValue(geo.escala);
  const dedoX = useSharedValue(0);
  const dedoY = useSharedValue(0);
  const resaltado = useSharedValue(-1);
  const carga = useSharedValue(0);
  const mascara = useMemo(() => mascaraDisponibles(disponibles), [disponibles]);

  // Lo que se llama desde el hilo de la interfaz pasa por aquí: siempre la
  // última versión, sin rehacer el gesto en cada render.
  const ultimo = useRef({ abierta, elegido, modo, alCambiar });
  ultimo.current = { abierta, elegido, modo, alCambiar };

  const abrir = useCallback(
    (o: OrigenRueda) => {
      if (ultimo.current.abierta) return;
      dedoX.value = 0;
      dedoY.value = 0;
      resaltado.value = -1;
      precargarSonidos();
      setOrigen(o);
      setElegido(null);
      setCerrando(false);
      // Dónde está el emblema en la ventana: la rueda lo repinta nítido encima
      // del desenfoque y tira de él la estela hasta el dedo.
      vista.current?.measureInWindow((x, y, ancho) => {
        if (ancho > 0) setOrigenEmblema({ x: x + ancho / 2, y: y + ancho / 2 });
      });
      setAbierta(true);
      vibrar('ruedaAbre');
    },
    [dedoX, dedoY, resaltado],
  );

  /** Elegir el índice `i` de la rueda: recarga o cierre sin cambio. */
  const elegir = useCallback((i: number) => {
    if (ultimo.current.elegido) return; // ya está recargando
    const r = resultadoEleccion(i, ultimo.current.modo);
    if (r === 'cerrar') setCerrando(true);
    else setElegido(r);
  }, []);

  const pedirCierre = useCallback(() => {
    if (!ultimo.current.elegido) setCerrando(true);
  }, []);

  /** Se soltó sin mover el dedo (o el sistema canceló el toque): la rueda sigue abierta y se elige tocando. */
  const pasarAToque = useCallback(() => {
    if (!ultimo.current.abierta || ultimo.current.elegido) return;
    resaltado.value = -1;
    dedoX.value = 0;
    dedoY.value = 0;
    setOrigen('toque');
  }, [resaltado, dedoX, dedoY]);

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
      .onStart((e) => {
        dedoX.value = e.absoluteX;
        dedoY.value = e.absoluteY;
        scheduleOnRN(abrir, 'mantener');
      })
      .onUpdate((e) => {
        dedoX.value = e.absoluteX;
        dedoY.value = e.absoluteY;
        resaltado.value = seMovio(e.translationX, e.translationY)
          ? sectorEn(e.absoluteX - centroX.value, e.absoluteY - centroY.value, escala.value, mascara)
          : -1;
      })
      .onEnd((e, ok) => {
        if (ok && seMovio(e.translationX, e.translationY)) scheduleOnRN(elegir, resaltado.value);
        else scheduleOnRN(pasarAToque);
      })
      .onFinalize(() => {
        carga.value = 0;
      });
    const toque = Gesture.Tap()
      .maxDuration(MS_MANTENER)
      .onEnd((_e, ok) => {
        if (ok) scheduleOnRN(abrir, 'toque');
      });
    return Gesture.Exclusive(mantener, toque);
  }, [reducido, carga, abrir, dedoX, dedoY, resaltado, centroX, centroY, escala, mascara, elegir, pasarAToque]);

  // Lector de pantalla: abrir la rueda o ir directo a cada modo, sin gesto ni animación.
  const otros = disponibles.filter((m) => m !== modo);
  const acciones = [
    { name: 'activate', label: t('modos:rueda.abrir') },
    ...otros.map((m) => ({ name: `modo:${m}`, label: t('modos:rueda.cambiarA', { modo: NOMBRE_MODO[m] }) })),
  ];
  const alAccion = (e: AccessibilityActionEvent) => {
    const nombre = e.nativeEvent.actionName;
    if (nombre === 'activate') return abrir('toque');
    const m = nombre.startsWith('modo:') ? (nombre.slice(5) as ModoId) : null;
    if (!m || !otros.includes(m)) return;
    sonarModo(m);
    vibrar(EVENTO_MODO[m]);
    alEncajar(m);
  };

  return (
    <>
      <GestureDetector gesture={gesto}>
        <View
          ref={vista}
          collapsable={false}
          style={{ width: tamano, height: tamano }}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('modos:rueda.emblema', { modo: NOMBRE_MODO[modo] })}
          accessibilityHint={t('modos:rueda.pista')}
          accessibilityActions={acciones}
          onAccessibilityAction={alAccion}
        >
          <DibujoEmblema forma={forma} tamano={tamano} modo={modo} disponibles={disponibles} carga={carga} />
        </View>
      </GestureDetector>
      {abierta ? (
        <RuedaModos
          origen={origen}
          modo={modo}
          anterior={anterior}
          disponibles={disponibles}
          emblema={origenEmblema ? { ...origenEmblema, forma, tamano } : null}
          dedoX={dedoX}
          dedoY={dedoY}
          resaltado={resaltado}
          centroX={centroX}
          centroY={centroY}
          escala={escala}
          elegido={elegido}
          cerrando={cerrando}
          reducido={reducido}
          alElegir={elegir}
          alPedirCierre={pedirCierre}
          alEncajar={alEncajar}
          alCerrar={alCerrar}
        />
      ) : null}
    </>
  );
}
