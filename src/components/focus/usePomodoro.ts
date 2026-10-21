// NIVL · FOCUS: el pomodoro vivo (efectos). La lógica es src/focus/pomodoro.ts.
//
// · Lee estado y configuración del teléfono al montar; los guarda en cada paso.
// · Con una fase en marcha, un reloj de 1 s solo para repintar. El final se
//   decide por la hora de pared (`finEn`), así que también se cierra al volver
//   de segundo plano (AppState) aunque la fase acabara fuera.
// · Al arrancar o reanudar, notificación local para el final; al pausar,
//   parar o cerrar, se cancela.
// · Al acabar una fase: campana (si está activada) y `onFin` con lo que se
//   cerró. Un foco terminado entero lo registra y lo paga quien llama
//   (useFocusHoy), UNA vez por `idFase`.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { vibrar } from '@/design/haptics';
import {
  CONFIG_POR_DEFECTO,
  ESTADO_INICIAL,
  acabada,
  arrancar,
  cerrarFase,
  detener,
  pausar,
  type Cierre,
  type ConfigPomodoro,
  type EstadoPomodoro,
  type Objetivo,
} from '@/focus/pomodoro';
import { avisarFin, cancelarAvisoFin, guardarConfig, guardarEstado, leerConfig, leerEstado } from '@/focus/temporizador';
import { t } from '@/i18n';
import { prepararFin, sonarFin } from './sonidoFin';

export interface UsePomodoro {
  listo: boolean;
  config: ConfigPomodoro;
  estado: EstadoPomodoro;
  ahora: number;
  empezar: (objetivo?: Objetivo) => void;
  pausar: () => void;
  saltar: () => void;
  parar: () => void;
  fijarObjetivo: (o: Objetivo) => void;
  fijarConfig: (c: ConfigPomodoro) => void;
}

function textoAviso(e: EstadoPomodoro): { titulo: string; cuerpo: string } {
  if (e.fase === 'foco') return { titulo: t('focus:aviso.focoTitulo'), cuerpo: t('focus:aviso.focoCuerpo') };
  return { titulo: t('focus:aviso.descansoTitulo'), cuerpo: t('focus:aviso.descansoCuerpo') };
}

export function usePomodoro(uid: string | null, onFin: (c: Cierre, config: ConfigPomodoro) => void): UsePomodoro {
  const [listo, setListo] = useState(false);
  const [config, setConfig] = useState<ConfigPomodoro>(CONFIG_POR_DEFECTO);
  const [estado, setEstado] = useState<EstadoPomodoro>(ESTADO_INICIAL);
  const [ahora, setAhora] = useState(() => Date.now());
  const ref = useRef({ estado, config });
  ref.current = { estado, config };
  const onFinRef = useRef(onFin);
  onFinRef.current = onFin;

  // Cargar lo guardado.
  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    void (async () => {
      const c = await leerConfig(uid);
      const e = await leerEstado(uid, c);
      if (!vivo) return;
      setConfig(c);
      setEstado(e);
      setAhora(Date.now());
      setListo(true);
    })();
    return () => {
      vivo = false;
    };
  }, [uid]);

  const poner = useCallback(
    (e: EstadoPomodoro) => {
      setEstado(e);
      if (uid) void guardarEstado(uid, e);
      if (e.finEn !== null) {
        const { titulo, cuerpo } = textoAviso(e);
        void avisarFin(e.finEn, titulo, cuerpo);
      } else {
        void cancelarAvisoFin();
      }
    },
    [uid],
  );

  // Cerrar la fase si ha acabado (al repintar o al volver a la app).
  const revisar = useCallback(() => {
    const n = Date.now();
    setAhora(n);
    const { estado: e, config: c } = ref.current;
    if (!acabada(e, n)) return;
    const cierre = cerrarFase(e, c, n);
    poner(cierre.estado);
    // La campana solo si acaba con la app delante (fuera ya sonó el aviso). En
    // la web también con la pestaña detrás: la notificación del navegador puede
    // ir muda o no tener permiso.
    if (c.sonido && (Platform.OS === 'web' || AppState.currentState === 'active') && n - (e.finEn ?? n) < 5000) sonarFin();
    vibrar('seleccion');
    onFinRef.current(cierre, c);
  }, [poner]);

  const enMarcha = estado.finEn !== null;
  useEffect(() => {
    if (!enMarcha) return;
    const reloj = setInterval(revisar, 1000);
    return () => clearInterval(reloj);
  }, [enMarcha, revisar]);

  useEffect(() => {
    if (!listo) return;
    revisar();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') revisar();
    });
    return () => sub.remove();
  }, [listo, revisar]);

  const empezar = useCallback(
    (objetivo?: Objetivo) => {
      vibrar('seleccion');
      // Web: el gesto de empezar despierta el audio para la campana del final.
      if (ref.current.config.sonido) prepararFin();
      poner(arrancar(ref.current.estado, ref.current.config, Date.now(), objetivo));
      setAhora(Date.now());
    },
    [poner],
  );
  const pausarFn = useCallback(() => {
    poner(pausar(ref.current.estado, Date.now()));
    setAhora(Date.now());
  }, [poner]);
  const saltar = useCallback(() => {
    const cierre = cerrarFase(ref.current.estado, ref.current.config, Date.now(), true);
    poner(cierre.estado);
  }, [poner]);
  const parar = useCallback(() => poner(detener(ref.current.estado)), [poner]);
  const fijarObjetivo = useCallback((o: Objetivo) => poner({ ...ref.current.estado, objetivo: o }), [poner]);
  const fijarConfig = useCallback(
    (c: ConfigPomodoro) => {
      setConfig(c);
      if (uid) void guardarConfig(uid, c);
      // Una fase parada toma la duración nueva; una en marcha sigue con la suya.
    },
    [uid],
  );

  return { listo, config, estado, ahora, empezar, pausar: pausarFn, saltar, parar, fijarObjetivo, fijarConfig };
}
