// NIVL · WORK: de los datos a lo que enseña Hoy y el bloque (puro, con tests).
//
// Lo usan la app (useWorkHoy) y la galería (demo.tsx): misma entrada, misma
// pantalla. Devuelve códigos y números, no frases; la vista pone el texto. Así
// el rediseño puede cambiar la pantalla sin tocar esto.

import { elegirAhora, type Ahora, type BloqueEnCurso } from './ahora';
import { restanteMs, minutosReales, transcurridoMs, cuentaComoBloque, type EstadoBloque, type FaseBloque } from './bloque';
import { calcularCarga, finEvento, type Carga } from './carga';
import type { ResultadoBloque } from './cierreBloque';
import { huecosDePrioridad, prioridadesDelDia, sePuedeSoltar } from './prioridades';
import {
  DURACIONES_BLOQUE,
  FRACCION_OBJETIVO,
  MIN_MINUTOS_MISION,
  MIN_MINUTOS_SESION,
  MINUTOS_BLOQUE_DEFECTO,
  type BloquePlan,
  type Entrega,
  type EventoTrabajo,
  type MisionTrabajo,
  type SesionTrabajo,
} from './tipos';

export interface MisionEntrada extends MisionTrabajo {
  /** Penalización con la recuperación aún cerrada. */
  bloqueada?: boolean;
}

export interface EntradaVistaWork {
  fecha: string;
  ahoraMin: number;
  ahoraMs: number;
  misiones: readonly MisionEntrada[];
  plan: readonly BloquePlan[];
  eventos: readonly EventoTrabajo[];
  entregas: readonly Entrega[];
  sesiones: readonly SesionTrabajo[];
  bloque: EstadoBloque | null;
  /** false: la 0115 aún no está en el servidor. */
  disponible: boolean;
  /** false: las misiones no se pudieron leer. Una lista vacía no significa que no haya nada. */
  misionesFiables?: boolean;
}

export interface FilaTrabajo {
  id: string;
  titulo: string;
  hecha: boolean;
  xp: number;
  /** Es lo que dice la tarjeta Ahora. */
  actual: boolean;
  puedeEmpezar: boolean;
  puedeSoltar: boolean;
  bloqueada: boolean;
}

export interface ReunionVista {
  titulo: string;
  inicio: number;
  fin: number;
  enCurso: boolean;
  /** Minutos hasta que empiece (0 si está en curso). */
  faltan: number;
}

export interface VistaWorkHoy {
  ahora: Ahora;
  carga: Carga;
  prioridades: FilaTrabajo[];
  /** Cuántas más hay fuera de las tres. */
  resto: FilaTrabajo[];
  penalizaciones: FilaTrabajo[];
  hechas: number;
  total: number;
  /** Cuántas prioridades caben aún hoy. */
  huecos: number;
  reunion: ReunionVista | null;
  duracionPropuesta: number;
  /** Mostrar el formulario de los 30 segundos. */
  pedirPlan: boolean;
  /** Sin la migración y sin nada que enseñar: estado vacío tranquilo. */
  preparando: boolean;
  /** Sin misiones fiables, «planificar» o «hecho» serían falsos: no se pinta la tarjeta. */
  ocultarAhora: boolean;
  /** Hay un bloque corriendo o en pausa. */
  bloqueActivo: boolean;
}

/** El bloque tal como lo necesita elegirAhora. */
export function bloqueEnCurso(e: EstadoBloque | null, ahoraMs: number): BloqueEnCurso | null {
  if (!e || e.fase === 'terminado') return null;
  return { titulo: e.titulo, questId: e.questId, fase: e.fase, restanteMin: Math.ceil(restanteMs(e, ahoraMs) / 60_000) };
}

/** La duración de las que se ofrecen que mejor encaja con lo sugerido, sin pasarse. */
export function duracionCercana(sugeridos: number | null): number {
  if (sugeridos === null) return MINUTOS_BLOQUE_DEFECTO;
  let mejor: number = DURACIONES_BLOQUE[0];
  for (const d of DURACIONES_BLOQUE) if (d <= sugeridos) mejor = d;
  return mejor;
}

/** El evento en curso o el siguiente de hoy, con hora. */
export function proximaReunion(eventos: readonly EventoTrabajo[], fecha: string, ahoraMin: number): ReunionVista | null {
  const hoy = eventos
    .filter((x) => x.fecha === fecha && x.inicio !== null)
    .map((x) => ({ x, inicio: x.inicio as number, fin: finEvento(x) as number }))
    .filter((v) => v.fin > ahoraMin)
    .sort((a, b) => a.inicio - b.inicio);
  const v = hoy[0];
  if (!v) return null;
  const enCurso = v.inicio <= ahoraMin;
  return { titulo: v.x.titulo, inicio: v.inicio, fin: v.fin, enCurso, faltan: enCurso ? 0 : v.inicio - ahoraMin };
}

export function vistaWorkHoy(e: EntradaVistaWork): VistaWorkHoy {
  // Una prioridad de otro día es residuo: la retira retirarPrioridadesCaducadas.
  const misiones = e.misiones.filter((m) => m.diaPrioridad === null || m.diaPrioridad === e.fecha);
  const carga = calcularCarga({ fecha: e.fecha, eventos: [...e.eventos], sesiones: [...e.sesiones] });
  const curso = bloqueEnCurso(e.bloque, e.ahoraMs);
  const ahora = elegirAhora({
    fecha: e.fecha,
    ahoraMin: e.ahoraMin,
    misiones,
    plan: e.plan,
    eventos: e.eventos,
    entregas: e.entregas,
    bloque: curso,
    nivelCarga: carga.nivel,
  });
  const p = prioridadesDelDia(misiones, e.fecha);
  const fila = (m: MisionEntrada): FilaTrabajo => ({
    id: m.id,
    titulo: m.titulo,
    hecha: m.hecha,
    xp: m.xp,
    actual: !m.hecha && m.id === ahora.questId,
    puedeEmpezar: !m.hecha && !m.penalizacion && curso === null,
    puedeSoltar: sePuedeSoltar(m, e.fecha) && m.id !== curso?.questId,
    bloqueada: m.bloqueada === true,
  });
  const huecos = huecosDePrioridad(misiones, e.fecha);
  const fiables = e.misionesFiables !== false;
  const pedirPlan = ahora.accion === 'planificar' && e.disponible && fiables;
  return {
    ahora,
    carga,
    prioridades: p.visibles.map(fila),
    resto: p.resto.map(fila),
    penalizaciones: p.penalizaciones.map(fila),
    hechas: p.hechas,
    total: p.total,
    huecos: e.disponible && fiables ? huecos : 0,
    reunion: proximaReunion(e.eventos, e.fecha, e.ahoraMin),
    duracionPropuesta: duracionCercana(ahora.minutosSugeridos),
    pedirPlan,
    preparando: ahora.accion === 'planificar' && !e.disponible && fiables,
    ocultarAhora: !fiables && (ahora.accion === 'planificar' || ahora.tipo === 'cerrado' || ahora.tipo === 'recuperar'),
    bloqueActivo: curso !== null,
  };
}

// ── La pantalla del bloque ────────────────────────────────────────────

export interface VistaBloque {
  fase: FaseBloque;
  titulo: string | null;
  objetivoMin: number;
  /** «24:59». Por encima de una hora siguen siendo minutos: «89:59». */
  reloj: string;
  restanteMin: number;
  /** 0 a 1. */
  avance: number;
  minutosHechos: number;
  /** Si se para ahora, ¿contaría como bloque de verdad? */
  yaCuenta: boolean;
  /** Si se para ahora, ¿se guardarían las horas? */
  seGuarda: boolean;
  /** Los minutos desde los que cuenta. */
  minutosParaContar: number;
  conMision: boolean;
}

/** A partir de cuántos minutos un bloque de este objetivo cuenta. */
export function minutosParaContar(objetivoMin: number): number {
  return Math.max(MIN_MINUTOS_MISION, Math.ceil(objetivoMin * FRACCION_OBJETIVO));
}

export function formatoReloj(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
}

export function vistaBloque(e: EstadoBloque, ahoraMs: number): VistaBloque {
  const objetivo = e.objetivoMin * 60_000;
  const minutos = minutosReales(e, ahoraMs);
  const resto = restanteMs(e, ahoraMs);
  return {
    fase: e.fase,
    titulo: e.titulo,
    objetivoMin: e.objetivoMin,
    reloj: formatoReloj(resto),
    restanteMin: Math.ceil(resto / 60_000),
    avance: objetivo > 0 ? Math.min(1, transcurridoMs(e, ahoraMs) / objetivo) : 0,
    minutosHechos: minutos,
    yaCuenta: cuentaComoBloque(minutos, e.objetivoMin),
    seGuarda: minutos >= MIN_MINUTOS_SESION,
    minutosParaContar: minutosParaContar(e.objetivoMin),
    conMision: e.questId !== null,
  };
}

export type DesenlaceBloque = 'pendiente' | 'pagado' | 'marcado' | 'no_guardado' | 'sin_xp' | 'mision_abierta' | 'solo_horas';

/** Qué se le cuenta al terminar. Siempre lo que pasó de verdad. */
export function desenlaceBloque(r: ResultadoBloque, conMision: boolean): DesenlaceBloque {
  if (r.xp > 0) return 'pagado';
  if (r.marcadas.length > 0) return 'marcado';
  // Sin red el reintento aún puede guardar y pagar: no se da por cerrado.
  if (r.reintentar) return 'pendiente';
  if (!r.guardado) return 'no_guardado';
  if (r.cuenta && conMision) return 'sin_xp';
  if (conMision) return 'mision_abierta';
  return 'solo_horas';
}
