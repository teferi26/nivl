// NIVL · Dictar al coach (L4, A3). Mantener pulsado graba; soltar escribe lo
// dictado en el cuadro de texto; deslizar arriba y soltar lo tira. Con el
// lector de pantalla activo, el botón pasa a tocar para empezar y tocar para
// terminar (mantener y deslizar no se puede hacer con un lector).
//
// Lo dictado NUNCA se envía solo: el coach ejecuta herramientas de gimnasio y
// de dinero, y un reconocimiento torcido no puede registrar nada sin que el
// usuario lo lea antes (decisión del Chat 4).

import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { vibrar } from '@/design/haptics';
import { ink, space, type } from '@/design/tokens';
import { cancelarDictado, detenerDictado, dictar, type ErrorDictado } from '@/lib/coachvoz';
import { alSoltar, formatoGrabacion, UMBRAL_CANCELAR } from './dictadoGesto';
import { redAceptada } from './redDictado';

interface OpcionesUseDictado {
  /** El texto definitivo: va al cuadro de texto (unirDictado), no se envía. */
  onTexto: (texto: string) => void;
  /** Un error ya escrito para el usuario (`mensaje`). */
  onError: (error: ErrorDictado) => void;
  /** El dispositivo no transcribe en local: hay que preguntar antes de usar la red. */
  onPedirPrivacidad: () => void;
  /** Una indicación que no es un fallo (micrófono recién concedido). */
  onAviso?: (mensaje: string) => void;
}

/** Tras el diálogo de permiso el gesto ya se ha perdido: se dice qué hacer. */
export const AVISO_MICROFONO_LISTO = 'Micrófono listo. Mantén pulsado para dictar.';
// Un arranque más lento que esto casi siempre ha pasado por un diálogo del
// sistema (el permiso), aunque la app no haya llegado a salir de primer plano.
const ARRANQUE_CON_DIALOGO_MS = 1200;

export interface Dictado {
  /** Hay una sesión de dictado escuchando. */
  grabando: boolean;
  /** Pidiendo permisos o arrancando el reconocimiento. */
  preparando: boolean;
  parcial: string;
  ms: number;
  /** El dedo está por encima del umbral: soltar ahora cancelaría. */
  cancelaria: boolean;
  empezar: () => Promise<boolean>;
  mover: (dy: number) => void;
  soltar: (dy: number) => void;
  /** Modo lector de pantalla: toca para empezar, toca para terminar. */
  alternar: () => void;
  /** Tira lo que haya (al perder el foco, al desmontar). */
  cancelar: () => void;
}

export function useDictado({ onTexto, onError, onPedirPrivacidad, onAviso }: OpcionesUseDictado): Dictado {
  const [grabando, setGrabando] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [parcial, setParcial] = useState('');
  const [inicio, setInicio] = useState<number | null>(null);
  const [ahora, setAhora] = useState(0);
  const [cancelaria, setCancelaria] = useState(false);

  // Las últimas funciones de quien llama, sin rehacer la sesión.
  const cb = useRef({ onTexto, onError, onPedirPrivacidad, onAviso });
  cb.current = { onTexto, onError, onPedirPrivacidad, onAviso };

  const activo = useRef(false);
  const arrancando = useRef(false);
  const soltado = useRef(false);
  // Tirado desde fuera (perder el foco, desmontar): no es que el dedo soltara.
  const descartado = useRef(false);
  const montado = useRef(true);

  const limpiar = useCallback(() => {
    activo.current = false;
    if (!montado.current) return;
    setGrabando(false);
    setPreparando(false);
    setParcial('');
    setInicio(null);
    setCancelaria(false);
  }, []);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      cancelarDictado();
    };
  }, []);

  // El reloj de la franja.
  useEffect(() => {
    if (!grabando || inicio === null) return;
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(t);
  }, [grabando, inicio]);

  const empezar = useCallback(async (): Promise<boolean> => {
    if (activo.current || arrancando.current) return false;
    arrancando.current = true;
    soltado.current = false;
    descartado.current = false;
    setPreparando(true);
    setParcial('');
    setCancelaria(false);
    // La primera vez, el diálogo de permiso del sistema se queda el gesto: la
    // app deja de estar activa y el dedo ya no está cuando vuelve.
    const t0 = Date.now();
    let dialogo = false;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') dialogo = true;
    });
    const red = await redAceptada();
    const r = await dictar({
      permitirRed: red,
      onParcial: (t) => {
        if (montado.current) setParcial(t);
      },
      onFinal: (t) => cb.current.onTexto(t),
      // Los errores de arranque llegan también por el resultado: se atienden
      // ahí, una sola vez.
      onError: (e) => {
        if (!arrancando.current) cb.current.onError(e);
      },
      onFin: limpiar,
    }).finally(() => sub.remove());
    arrancando.current = false;
    if (!r.ok) {
      limpiar();
      if (r.error.codigo === 'sin_dictado_local') cb.current.onPedirPrivacidad();
      else cb.current.onError(r.error);
      return false;
    }
    // Soltó mientras el sistema pedía permiso: no se queda escuchando solo.
    if (soltado.current || !montado.current) {
      cancelarDictado();
      limpiar();
      // Sin esto la sesión se cancelaba en silencio y parecía que el botón no
      // hacía nada. Ya hay permiso: el próximo pulsado graba.
      const tras = dialogo || Date.now() - t0 > ARRANQUE_CON_DIALOGO_MS;
      if (montado.current && !descartado.current && tras) cb.current.onAviso?.(AVISO_MICROFONO_LISTO);
      return false;
    }
    activo.current = true;
    setPreparando(false);
    setGrabando(true);
    setInicio(Date.now());
    vibrar('seleccion');
    return true;
  }, [limpiar]);

  const mover = useCallback((dy: number) => {
    const c = alSoltar(dy) === 'cancelar';
    setCancelaria((prev) => (prev === c ? prev : c));
  }, []);

  const soltar = useCallback(
    (dy: number) => {
      soltado.current = true;
      if (!activo.current) return; // si aún arranca, empezar() lo cancela
      if (alSoltar(dy) === 'cancelar') {
        cancelarDictado();
        limpiar();
      } else {
        detenerDictado();
      }
    },
    [limpiar],
  );

  const alternar = useCallback(() => {
    if (activo.current) {
      detenerDictado();
      AccessibilityInfo.announceForAccessibility('Dictado terminado');
      return;
    }
    void empezar().then((ok) => {
      if (ok) AccessibilityInfo.announceForAccessibility('Grabando');
    });
  }, [empezar]);

  const cancelar = useCallback(() => {
    soltado.current = true;
    descartado.current = true;
    cancelarDictado();
    limpiar();
  }, [limpiar]);

  return {
    grabando,
    preparando,
    parcial,
    ms: grabando && inicio !== null ? Math.max(0, ahora - inicio) : 0,
    cancelaria,
    empezar,
    mover,
    soltar,
    alternar,
    cancelar,
  };
}

/** ¿Hay un lector de pantalla encendido? Se actualiza si cambia. */
function useLectorPantalla(): boolean {
  const [activo, setActivo] = useState(false);
  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => {
        if (vivo) setActivo(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setActivo);
    return () => {
      vivo = false;
      sub.remove();
    };
  }, []);
  return activo;
}

/**
 * El botón del micrófono: círculo de 48 con aro de 3 en ink10 sobre negro (L-RADICAL
 * §B.2), en el sitio de «enviar» cuando no hay nada que enviar. Grabando se
 * enciende en blanco: enviar no está en pantalla, la inversión sigue siendo una.
 */
export function BotonDictar({ dictado, disabled }: { dictado: Dictado; disabled?: boolean }) {
  const lector = useLectorPantalla();
  const y0 = useRef(0);
  const enMarcha = dictado.grabando || dictado.preparando;

  if (lector) {
    // El gesto de escape del lector (frotar con dos dedos en iOS) tira lo
    // dictado, como deslizar arriba sin lector.
    const descartar = () => {
      if (!enMarcha) return;
      dictado.cancelar();
      AccessibilityInfo.announceForAccessibility('Dictado cancelado');
    };
    return (
      <Pressable
        onPress={dictado.alternar}
        disabled={disabled}
        style={({ pressed }) => [styles.boton, enMarcha && styles.botonOn, pressed && styles.pulsado]}
        accessibilityRole="button"
        accessibilityLabel={dictado.grabando ? 'Terminar el dictado' : 'Dictar un mensaje'}
        accessibilityHint={dictado.grabando ? 'Lo dictado se escribe en el cuadro de texto' : 'Toca para empezar a grabar'}
        accessibilityState={{ disabled: !!disabled, busy: dictado.grabando }}
        accessibilityActions={enMarcha ? [{ name: 'escape', label: 'Cancelar el dictado' }] : undefined}
        onAccessibilityEscape={descartar}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'escape') descartar();
        }}
      >
        <Ionicons name={dictado.grabando ? 'stop' : 'mic-outline'} size={20} color={enMarcha ? ink.ink0 : ink.ink10} />
      </Pressable>
    );
  }

  const dy = (e: GestureResponderEvent) => e.nativeEvent.pageY - y0.current;
  return (
    <View
      style={[styles.boton, enMarcha && styles.botonOn, disabled && styles.apagado]}
      onStartShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        y0.current = e.nativeEvent.pageY;
        void dictado.empezar();
      }}
      onResponderMove={(e) => dictado.mover(dy(e))}
      onResponderRelease={(e) => dictado.soltar(dy(e))}
      // Otro gesto se ha quedado el toque (un scroll): se tira lo dictado.
      onResponderTerminate={() => dictado.soltar(UMBRAL_CANCELAR)}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Dictar un mensaje"
      accessibilityHint="Mantén pulsado para grabar y suelta para escribirlo"
      accessibilityState={{ disabled: !!disabled, busy: dictado.grabando }}
    >
      <Ionicons name="mic-outline" size={20} color={enMarcha ? ink.ink0 : ink.ink10} />
    </View>
  );
}

/**
 * La franja sobre la barra mientras se graba. Fuera de la grabación enseña
 * `aviso` (un fallo del dictado o qué hacer ahora) mientras quien llama lo
 * mantenga: aquí, junto al micrófono, y no en la cola de celebraciones.
 */
export function FranjaGrabacion({ dictado, aviso }: { dictado: Dictado; aviso?: string | null }) {
  const lector = useLectorPantalla();
  if (!dictado.grabando && !dictado.preparando) {
    if (!aviso) return null;
    return (
      <View style={styles.franja}>
        <Text style={styles.aviso}>{aviso}</Text>
      </View>
    );
  }
  // Con lector se toca para empezar y para terminar: no hay soltar ni deslizar.
  const guia = lector
    ? 'toca el micrófono para terminar'
    : dictado.cancelaria
      ? 'suelta para cancelar'
      : 'suelta para escribirlo, desliza arriba para cancelar';
  return (
    // Sin región viva: el reloj cambia cuatro veces por segundo y el lector lo
    // leería sin parar. El lector oye «Grabando» y «Dictado terminado».
    <View style={styles.franja}>
      <View style={styles.franjaFila}>
        <View style={[styles.punto, dictado.cancelaria && styles.puntoOff]} />
        <Text style={styles.franjaRotulo}>{dictado.preparando ? 'PREPARANDO' : `GRABANDO ${formatoGrabacion(dictado.ms)}`}</Text>
      </View>
      {/* Debajo y entera: a 375 en la misma fila se cortaba con puntos suspensivos. */}
      <Text style={styles.franjaGuia}>{guia}</Text>
      {dictado.parcial ? (
        <Text style={styles.parcial} numberOfLines={3}>
          {dictado.parcial}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  boton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: ink.ink10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ink.ink0,
  },
  botonOn: { backgroundColor: ink.ink10 },
  apagado: { opacity: 0.35 },
  pulsado: { opacity: 0.8 },
  franja: {
    paddingHorizontal: space.s5,
    paddingTop: space.s3,
    paddingBottom: space.s2,
    borderTopWidth: 1,
    borderTopColor: ink.ink3,
    backgroundColor: ink.ink0,
  },
  franjaFila: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: ink.ink10 },
  puntoOff: { backgroundColor: ink.ink4 },
  franjaRotulo: { fontFamily: type.label.family, fontSize: type.label.size, letterSpacing: type.label.tracking, color: ink.ink10 },
  franjaGuia: { marginTop: space.s1, fontFamily: type.bodySm.family, fontSize: type.bodySm.size, lineHeight: type.bodySm.lineHeight, color: ink.ink6 },
  aviso: { fontFamily: type.bodySm.family, fontSize: type.bodySm.size, lineHeight: type.bodySm.lineHeight, color: ink.ink9 },
  parcial: {
    fontFamily: type.bodySm.family,
    fontSize: type.bodySm.size,
    lineHeight: type.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s2,
  },
});
