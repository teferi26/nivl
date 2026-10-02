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
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
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
}

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

export function useDictado({ onTexto, onError, onPedirPrivacidad }: OpcionesUseDictado): Dictado {
  const [grabando, setGrabando] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [parcial, setParcial] = useState('');
  const [inicio, setInicio] = useState<number | null>(null);
  const [ahora, setAhora] = useState(0);
  const [cancelaria, setCancelaria] = useState(false);

  // Las últimas funciones de quien llama, sin rehacer la sesión.
  const cb = useRef({ onTexto, onError, onPedirPrivacidad });
  cb.current = { onTexto, onError, onPedirPrivacidad };

  const activo = useRef(false);
  const arrancando = useRef(false);
  const soltado = useRef(false);
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
    setPreparando(true);
    setParcial('');
    setCancelaria(false);
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
    });
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

/** El botón del micrófono: 46 × 46, en el sitio de «enviar» cuando no hay nada que enviar. */
export function BotonDictar({ dictado, disabled }: { dictado: Dictado; disabled?: boolean }) {
  const lector = useLectorPantalla();
  const y0 = useRef(0);
  const enMarcha = dictado.grabando || dictado.preparando;

  if (lector) {
    return (
      <Pressable
        onPress={dictado.alternar}
        disabled={disabled}
        style={({ pressed }) => [styles.boton, enMarcha && styles.botonOn, pressed && styles.pulsado]}
        accessibilityRole="button"
        accessibilityLabel={dictado.grabando ? 'Terminar el dictado' : 'Dictar un mensaje'}
        accessibilityHint={dictado.grabando ? 'Lo dictado se escribe en el cuadro de texto' : 'Toca para empezar a grabar'}
        accessibilityState={{ disabled: !!disabled, busy: dictado.grabando }}
      >
        <Ionicons name={dictado.grabando ? 'stop' : 'mic-outline'} size={20} color={enMarcha ? ink.ink0 : ink.ink8} />
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
      <Ionicons name="mic-outline" size={20} color={enMarcha ? ink.ink0 : ink.ink8} />
    </View>
  );
}

/** La franja sobre la barra mientras se graba. */
export function FranjaGrabacion({ dictado }: { dictado: Dictado }) {
  if (!dictado.grabando && !dictado.preparando) return null;
  const guia = dictado.cancelaria ? 'suelta para cancelar' : 'suelta para escribirlo, desliza arriba para cancelar';
  return (
    // Sin región viva: el reloj cambia cuatro veces por segundo y el lector lo
    // leería sin parar. El lector oye «Grabando» y «Dictado terminado».
    <View style={styles.franja}>
      <View style={styles.franjaFila}>
        <View style={[styles.punto, dictado.cancelaria && styles.puntoOff]} />
        <Text style={styles.franjaRotulo}>{dictado.preparando ? 'PREPARANDO' : `GRABANDO ${formatoGrabacion(dictado.ms)}`}</Text>
        <Text style={styles.franjaGuia} numberOfLines={1}>
          {' · '}
          {guia}
        </Text>
      </View>
      {dictado.parcial ? (
        <Text style={styles.parcial} numberOfLines={3}>
          {dictado.parcial}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  boton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: ink.ink1 },
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
  franjaGuia: { flex: 1, minWidth: 0, fontFamily: type.bodySm.family, fontSize: 12, color: ink.ink6 },
  parcial: {
    fontFamily: type.bodySm.family,
    fontSize: type.bodySm.size,
    lineHeight: type.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s2,
  },
});
