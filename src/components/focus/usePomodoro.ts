// NIVL · FOCUS: el pomodoro vivo (efectos). La lógica es src/focus/pomodoro.ts.
//
// · Lee estado y configuración del teléfono al montar; los guarda en cada paso.
// · Con una fase en marcha, un reloj de 1 s solo para repintar. El final se
//   decide por la hora de pared (`finEn`), así que también se cierra al volver
//   de segundo plano (AppState) aunque la fase acabara fuera.
// · Al arrancar o reanudar, notificación local para el final; al pausar,
//   parar o cerrar, se cancela.
// · Con un foco en marcha la pantalla no se apaga, y se cuentan las salidas de
//   la app (informativo: nunca toca el pago).
// · Al acabar una fase: campana (si está activada) y `onFin` con lo que se
//   cerró. Un foco terminado entero lo registra y lo paga quien llama
//   (useFocusHoy), UNA vez por `idFase`.
// · Una fase acabada no se cierra hasta `puedeCerrar` (en frío, los datos de
//   FOCUS aún no han llegado): sigue guardada en el teléfono y no se pierde.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { vibrar } from '@/design/haptics';
import {
  CONFIG_POR_DEFECTO,
  ESTADO_INICIAL,
  OBJETIVO_LIBRE,
  acabada,
  arrancar,
  cerrarFase,
  detener,
  marcarSalida,
  marcarVuelta,
  pausar,
  situacion,
  type Cierre,
  type ConfigPomodoro,
  type EstadoPomodoro,
  type Objetivo,
} from '@/focus/pomodoro';
import { avisarFin, cancelarAvisoFin, guardarConfig, guardarEstado, leerConfig, leerEstado } from '@/focus/temporizador';
import { t } from '@/i18n';
import { MOTIVO_RELOJ, focusReloj } from '@/watch/contrato';
import { atenderReloj, publicarEnReloj } from '@/watch/puente';
import { mantenerDespierto } from './keepAwake';
import { prepararFin, sonarFin } from './sonidoFin';

export interface UsePomodoro {
  listo: boolean;
  config: ConfigPomodoro;
  estado: EstadoPomodoro;
  ahora: number;
  /** `minutos`: una duración distinta a la de los ajustes (el simulacro). Solo al arrancar de cero. */
  empezar: (objetivo?: Objetivo, minutos?: number) => void;
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

export function usePomodoro(uid: string | null, onFin: (c: Cierre, config: ConfigPomodoro) => void, puedeCerrar = true): UsePomodoro {
  const [listo, setListo] = useState(false);
  const [config, setConfig] = useState<ConfigPomodoro>(CONFIG_POR_DEFECTO);
  const [estado, setEstado] = useState<EstadoPomodoro>(ESTADO_INICIAL);
  const [ahora, setAhora] = useState(() => Date.now());
  const ref = useRef({ estado, config });
  ref.current = { estado, config };
  const onFinRef = useRef(onFin);
  onFinRef.current = onFin;
  const puedeCerrarRef = useRef(puedeCerrar);
  puedeCerrarRef.current = puedeCerrar;

  // Cargar lo guardado.
  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    void (async () => {
      const c = await leerConfig(uid);
      const e = await leerEstado(uid, c);
      if (!vivo) return;
      // Lo elegido y no empezado no sobrevive a cerrar la app: mañana manda el plan.
      const limpio = situacion(e) === 'parado' && e.fase === 'foco' ? { ...e, objetivo: OBJETIVO_LIBRE } : e;
      setConfig(c);
      setEstado(marcarVuelta(limpio, Date.now()));
      setAhora(Date.now());
      setListo(true);
    })();
    return () => {
      vivo = false;
    };
  }, [uid]);

  // Guarda sin tocar el aviso programado (salir y volver no cambian `finEn`).
  const guardar = useCallback(
    (e: EstadoPomodoro) => {
      ref.current = { ...ref.current, estado: e };
      setEstado(e);
      if (uid) void guardarEstado(uid, e);
    },
    [uid],
  );

  const poner = useCallback(
    (e: EstadoPomodoro) => {
      guardar(e);
      if (e.finEn !== null) {
        const { titulo, cuerpo } = textoAviso(e);
        void avisarFin(e.finEn, titulo, cuerpo);
      } else {
        void cancelarAvisoFin();
      }
    },
    [guardar],
  );

  // Cerrar la fase si ha acabado (al repintar o al volver a la app).
  const revisar = useCallback(() => {
    const n = Date.now();
    setAhora(n);
    const { estado: e, config: c } = ref.current;
    if (!puedeCerrarRef.current || !acabada(e, n)) return;
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

  const concentrado = enMarcha && estado.fase === 'foco';
  useEffect(() => {
    if (!concentrado) return;
    mantenerDespierto(true);
    return () => mantenerDespierto(false);
  }, [concentrado]);

  useEffect(() => {
    if (!listo) return;
    revisar();
    const sub = AppState.addEventListener('change', (s) => {
      const e = ref.current.estado;
      if (s === 'background') {
        const fuera = marcarSalida(e, Date.now());
        if (fuera !== e) guardar(fuera);
      } else if (s === 'active') {
        const vuelta = marcarVuelta(e, Date.now());
        if (vuelta !== e) guardar(vuelta);
        revisar();
      }
    });
    return () => sub.remove();
  }, [listo, revisar, guardar]);

  // La fase acabada mientras cargaban los datos se cierra en cuanto llegan.
  useEffect(() => {
    if (listo && puedeCerrar) revisar();
  }, [listo, puedeCerrar, revisar]);

  const empezar = useCallback(
    (objetivo?: Objetivo, minutos?: number) => {
      vibrar('seleccion');
      // Web: el gesto de empezar despierta el audio para la campana del final.
      if (ref.current.config.sonido) prepararFin();
      const e = ref.current.estado;
      const base = minutos !== undefined && e.idFase === null && e.pausaRestante === null ? { ...e, minutosFase: minutos } : e;
      poner(arrancar(base, ref.current.config, Date.now(), objetivo));
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
  const parar = useCallback(() => poner({ ...detener(ref.current.estado), objetivo: OBJETIVO_LIBRE }), [poner]);
  const fijarObjetivo = useCallback((o: Objetivo) => poner({ ...ref.current.estado, objetivo: o }), [poner]);
  const fijarConfig = useCallback(
    (c: ConfigPomodoro) => {
      setConfig(c);
      if (uid) void guardarConfig(uid, c);
      // Una fase parada toma la duración nueva; una en marcha sigue con la suya.
    },
    [uid],
  );

  // Apple Watch: el reloj sigue este pomodoro (fase, fin y bloque) y puede
  // arrancarlo, pausarlo o pararlo mientras FOCUS está montado. El reloj
  // cuenta solo con `finEn`: no hace falta publicar cada segundo.
  useEffect(() => {
    if (!listo) return;
    publicarEnReloj('focus', focusReloj(estado, config, Date.now()));
  }, [listo, estado, config]);
  useEffect(() => {
    if (!listo) return;
    return atenderReloj('focus', async (p) => {
      if (p.tipo !== 'focus') return { ok: false, motivo: MOTIVO_RELOJ.noReconocida };
      if (p.accion === 'empezar') empezar();
      else if (p.accion === 'pausar') pausarFn();
      else parar();
      return { ok: true };
    });
  }, [listo, empezar, pausarFn, parar]);

  return { listo, config, estado, ahora, empezar, pausar: pausarFn, saltar, parar, fijarObjetivo, fijarConfig };
}
