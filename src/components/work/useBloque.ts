// NIVL · WORK: el bloque de trabajo vivo (efectos). La lógica es src/work/bloque.ts.
//
// · El final se decide por la hora de pared: también se cierra al volver de
//   segundo plano aunque el bloque acabara fuera.
// · Se repinta cada segundo solo con la pantalla del bloque delante.
// · Al terminar, `cerrar` hace la secuencia (horas, misión, acto), una vez por
//   bloque: un cerrojo por clientId y lo guardado en el teléfono. Si faltó red,
//   se reintenta al volver a la app.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { vibrar } from '@/design/haptics';
import { t } from '@/i18n';
import { avanzar, cierreDe, finPrevisto, nuevoBloque, pausar, reanudar, terminar, type CierreBloque, type EstadoBloque } from '@/work/bloque';
import { avisarFinBloque, cancelarAvisoBloque, guardarBloque, leerBloque } from '@/work/bloqueAlmacen';
import { fundirResultado, type BloqueGuardado, type ResultadoBloque } from '@/work/cierreBloque';
import { fechaLocal, minutosLocal } from '@/work/fechas';

export interface AperturaBloque {
  titulo: string | null;
  questId: string | null;
  entregaId: string | null;
  proyectoId: string | null;
  bloquePlanId: string | null;
  minutos: number;
}

export type CerrarBloque = (c: CierreBloque, actoHecho: boolean, fijarActoHecho: () => Promise<void>) => Promise<ResultadoBloque>;

export interface UseBloque {
  listo: boolean;
  ahora: number;
  /** El bloque a la vista: corriendo, en pausa o terminado sin resumen visto. */
  estado: EstadoBloque | null;
  resultado: ResultadoBloque | null;
  /** Se están guardando las horas y pagando la misión. */
  cerrando: boolean;
  /** La pantalla del bloque está delante. */
  visible: boolean;
  abrir: () => void;
  minimizar: () => void;
  empezar: (a: AperturaBloque) => void;
  pausar: () => void;
  reanudar: () => void;
  /** Lo cierra a mano. Por debajo del mínimo no deja rastro y vuelve a Hoy. */
  terminar: () => void;
  /** Cierra el resumen. Devuelve lo que hay que celebrar. */
  cerrarResumen: () => ResultadoBloque | null;
}

const idNuevo = (n: number) => `b-${n}-${Math.random().toString(36).slice(2, 10)}`;

export function useBloque(uid: string | null, cerrar: CerrarBloque): UseBloque {
  const [listo, setListo] = useState(false);
  const [guardado, setGuardado] = useState<BloqueGuardado | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const ref = useRef<BloqueGuardado | null>(null);
  const enCurso = useRef(new Set<string>());
  const cerrarRef = useRef(cerrar);
  cerrarRef.current = cerrar;

  const fijar = useCallback((g: BloqueGuardado | null) => {
    ref.current = g;
    setGuardado(g);
  }, []);

  const poner = useCallback(
    (g: BloqueGuardado | null) => {
      fijar(g);
      if (uid) void guardarBloque(uid, g);
    },
    [fijar, uid],
  );

  const programarAviso = useCallback((e: EstadoBloque) => {
    const fin = finPrevisto(e, Date.now());
    if (fin === null) void cancelarAvisoBloque();
    else void avisarFinBloque(fin, t('trabajo:bloque.avisoTitulo'), t('trabajo:bloque.avisoCuerpo', { minutos: e.objetivoMin }));
  }, []);

  const lanzarCierre = useCallback(async () => {
    const g = ref.current;
    if (!g) return;
    const c = cierreDe(g.estado);
    if (!c || (g.resultado && !g.resultado.reintentar) || enCurso.current.has(c.clientId)) return;
    enCurso.current.add(c.clientId);
    setCerrando(true);
    try {
      const nuevo = await cerrarRef.current(c, g.actoHecho, async () => {
        const a = ref.current;
        if (!a || a.estado.clientId !== c.clientId) return;
        const conActo = { ...a, actoHecho: true };
        fijar(conActo);
        // Con await: tiene que estar escrito ANTES de propagar.
        if (uid) await guardarBloque(uid, conActo);
      });
      const a = ref.current;
      if (a && a.estado.clientId === c.clientId) {
        const resultado = fundirResultado(a.resultado, nuevo);
        poner(a.visto && !resultado.reintentar ? null : { ...a, resultado });
      }
    } finally {
      enCurso.current.delete(c.clientId);
      setCerrando(false);
    }
  }, [fijar, poner, uid]);

  const revisar = useCallback(() => {
    const n = Date.now();
    setAhora(n);
    const g = ref.current;
    if (!g || g.estado.fase !== 'corriendo') return;
    const sig = avanzar(g.estado, n);
    if (sig.fase === 'terminado') {
      vibrar('seleccion');
      void cancelarAvisoBloque();
      poner({ ...g, estado: sig });
      void lanzarCierre();
    } else {
      fijar({ ...g, estado: sig });
    }
  }, [fijar, lanzarCierre, poner]);

  /** Al abrir o volver a la app: el reloj y lo que quedó a medias. */
  const alVolver = useCallback(() => {
    revisar();
    void lanzarCierre();
  }, [lanzarCierre, revisar]);

  useEffect(() => {
    setListo(false);
    fijar(null);
    if (!uid) return;
    let vivo = true;
    void leerBloque(uid).then((g) => {
      if (!vivo) return;
      fijar(g);
      setAhora(Date.now());
      setListo(true);
    });
    return () => {
      vivo = false;
    };
  }, [fijar, uid]);

  useEffect(() => {
    if (!listo) return;
    alVolver();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') alVolver();
    });
    return () => sub.remove();
  }, [alVolver, listo]);

  const fase = guardado && !guardado.visto ? guardado.estado.fase : null;
  const visible = (abierto && fase !== null) || fase === 'terminado';
  // Con la pantalla delante, cada segundo. Detrás basta con que Hoy no se quede viejo.
  const paso = visible && fase === 'corriendo' ? 1000 : 30_000;
  useEffect(() => {
    if (!listo) return;
    const reloj = setInterval(revisar, paso);
    return () => clearInterval(reloj);
  }, [listo, paso, revisar]);

  const empezar = useCallback(
    (a: AperturaBloque) => {
      const previo = ref.current;
      if (previo && previo.estado.fase !== 'terminado') {
        setAbierto(true);
        return;
      }
      // Un cierre que quedó sin red: último intento antes de pisarlo.
      const pendiente = previo?.resultado?.reintentar ? cierreDe(previo.estado) : null;
      if (pendiente) void cerrarRef.current(pendiente, true, async () => {}).catch(() => {});
      const n = Date.now();
      const d = new Date(n);
      const estado = nuevoBloque({
        clientId: idNuevo(n),
        ahora: n,
        fecha: fechaLocal(d),
        inicioMin: minutosLocal(d),
        objetivoMin: a.minutos,
        titulo: a.titulo,
        questId: a.questId,
        proyectoId: a.proyectoId,
        entregaId: a.entregaId,
        bloquePlanId: a.bloquePlanId,
      });
      vibrar('seleccion');
      setAhora(n);
      setAbierto(true);
      poner({ estado, actoHecho: false, resultado: null, visto: false });
      programarAviso(estado);
    },
    [poner, programarAviso],
  );

  const pausarFn = useCallback(() => {
    const g = ref.current;
    if (!g) return;
    const estado = pausar(g.estado, Date.now());
    poner({ ...g, estado });
    programarAviso(estado);
    setAhora(Date.now());
    if (estado.fase === 'terminado') void lanzarCierre();
  }, [lanzarCierre, poner, programarAviso]);

  const reanudarFn = useCallback(() => {
    const g = ref.current;
    if (!g) return;
    const estado = reanudar(g.estado, Date.now());
    poner({ ...g, estado });
    programarAviso(estado);
    setAhora(Date.now());
  }, [poner, programarAviso]);

  const terminarFn = useCallback(() => {
    const g = ref.current;
    if (!g || g.estado.fase === 'terminado') return;
    const estado = terminar(g.estado, Date.now());
    void cancelarAvisoBloque();
    setAhora(Date.now());
    if (!cierreDe(estado)?.guardar) {
      setAbierto(false);
      poner(null);
      return;
    }
    poner({ ...g, estado });
    void lanzarCierre();
  }, [lanzarCierre, poner]);

  const cerrarResumen = useCallback(() => {
    const g = ref.current;
    if (!g || g.estado.fase !== 'terminado') return null;
    setAbierto(false);
    const r = g.resultado;
    poner(r && !r.reintentar ? null : { ...g, visto: true });
    return r;
  }, [poner]);

  return {
    listo,
    ahora,
    estado: guardado && !guardado.visto ? guardado.estado : null,
    resultado: guardado?.resultado ?? null,
    cerrando,
    visible,
    abrir: useCallback(() => setAbierto(true), []),
    minimizar: useCallback(() => setAbierto(false), []),
    empezar,
    pausar: pausarFn,
    reanudar: reanudarFn,
    terminar: terminarFn,
    cerrarResumen,
  };
}
