// NIVL · WORK: qué atacar ya y qué soltar (puro, con tests).
//
// Es el corazón de Hoy y funciona gratis, sin IA. Una sola respuesta, con su
// motivo. El coach recibe este mismo cálculo ya hecho (ESPEJO en
// supabase/functions/_shared/trabajo.ts: si tocas uno, toca el otro; misma tabla
// en trabajo_paridad.json): la IA decide qué decir, no qué toca.
//
// El orden de la decisión, de lo más firme a lo menos:
//   1. un bloque ya en marcha;   2. una reunión en curso o a punto;
//   3. un bloque de trabajo del plan que toca ahora;
//   4. un hueco demasiado corto para un bloque;
//   5. la siguiente prioridad;   6. una entrega que aprieta;
//   7. pedir el plan del día;    8. recuperar lo de ayer;
//   9. día cerrado.

import { finEvento, type NivelCarga } from './carga';
import { minAHora, sumarDias } from './fechas';
import { pendientes } from './prioridades';
import { DIAS_APRIETA, riesgoEntrega } from './proyectos';
import {
  FIN_JORNADA_MIN,
  MIN_MINUTOS_MISION,
  MINUTOS_BLOQUE_DEFECTO,
  type BloquePlan,
  type Entrega,
  type EventoTrabajo,
  type MisionTrabajo,
  type Motivo,
} from './tipos';

/** Con una reunión a estos minutos o menos ya no se empieza nada. */
export const AVISO_REUNION_MIN = 15;
/** Los tipos de bloque del plan que son trabajo. */
export const TIPOS_BLOQUE_TRABAJO: readonly string[] = ['deep_work', 'ventas', 'contenido'];
/** Los que no ocupan: se pueden pisar con trabajo. */
const TIPOS_LIBRES: readonly string[] = ['libre', 'deep_work', 'ventas', 'contenido', 'redes'];
const MAX_SOLTAR = 3;

export type TipoAhora = 'bloque' | 'reunion' | 'plan' | 'hueco' | 'mision' | 'entrega' | 'planificar' | 'recuperar' | 'cerrado';
export type AccionAhora = 'seguir_bloque' | 'empezar_bloque' | 'planificar' | 'ninguna';

export interface BloqueEnCurso {
  titulo: string | null;
  questId: string | null;
  fase: 'corriendo' | 'pausado';
  restanteMin: number;
}

export interface Soltable {
  tipo: 'mision';
  id: string;
  titulo: string;
  motivo: Motivo;
  /** true si es una prioridad de hoy: se puede soltar sin coste (soltarPrioridad). */
  sinCoste: boolean;
}

export interface Ahora {
  tipo: TipoAhora;
  titulo: string | null;
  motivo: Motivo;
  /** El único botón de la tarjeta. 'ninguna' = sin botón. */
  accion: AccionAhora;
  questId: string | null;
  entregaId: string | null;
  /** Duración que proponer al empezar el bloque; null si no aplica. */
  /** El bloque del plan que se ataca; null si no sale del plan. */
  bloquePlanId: string | null;
  minutosSugeridos: number | null;
  /** Minuto local hasta el que dura lo de ahora, o el próximo compromiso. */
  hastaMin: number | null;
  soltar: Soltable[];
}

export interface EntradaAhora {
  fecha: string;
  ahoraMin: number;
  misiones: readonly MisionTrabajo[];
  plan: readonly BloquePlan[];
  eventos: readonly EventoTrabajo[];
  entregas: readonly Entrega[];
  bloque?: BloqueEnCurso | null;
  nivelCarga?: NivelCarga;
  finJornadaMin?: number;
}

/** Estimación por dificultad (el XP base es su representante). */
export function esfuerzoMin(xp: number): number {
  if (xp <= 10) return 15;
  if (xp <= 25) return 25;
  if (xp <= 50) return MINUTOS_BLOQUE_DEFECTO;
  if (xp <= 100) return 90;
  return 180;
}

interface Tramo {
  inicio: number;
  fin: number;
}

/** Lo que ocupa hoy (eventos con hora y bloques del plan que no son trabajo), ordenado. */
function ocupaciones(e: EntradaAhora): Tramo[] {
  const deEventos = e.eventos
    .filter((x) => x.fecha === e.fecha && x.inicio !== null)
    .map((x) => ({ inicio: x.inicio as number, fin: finEvento(x) as number }));
  const dePlan = e.plan.filter((b) => !TIPOS_LIBRES.includes(b.tipo) && !b.hecho && b.fin > b.inicio).map((b) => ({ inicio: b.inicio, fin: b.fin }));
  return [...deEventos, ...dePlan].sort((a, b) => a.inicio - b.inicio);
}

/** Minutos libres entre `desde` y `hasta`, descontando lo ocupado (sin contar dos veces los solapes). */
export function minutosLibres(tramos: readonly Tramo[], desde: number, hasta: number): number {
  if (hasta <= desde) return 0;
  let libre = 0;
  let cursor = desde;
  for (const t of tramos) {
    if (t.fin <= cursor) continue;
    if (t.inicio >= hasta) break;
    if (t.inicio > cursor) libre += t.inicio - cursor;
    cursor = Math.max(cursor, Math.min(t.fin, hasta));
    if (cursor >= hasta) break;
  }
  return libre + Math.max(0, hasta - cursor);
}

/**
 * Lo que hoy no cabe, empezando por el final de la lista. La primera pendiente
 * nunca se suelta: siempre queda algo que atacar. Si no sobra nada y la carga
 * es alta, se propone soltar la última.
 */
export function queSoltar(e: EntradaAhora, tramos: readonly Tramo[]): Soltable[] {
  const lista = pendientes(e.misiones, e.fecha);
  if (lista.length < 2) return [];
  const fin = e.finJornadaMin ?? FIN_JORNADA_MIN;
  let queda = minutosLibres(tramos, e.ahoraMin, Math.max(fin, e.ahoraMin));
  const noCaben: MisionTrabajo[] = [];
  lista.forEach((m, i) => {
    const coste = esfuerzoMin(m.xp);
    if (i > 0 && coste > queda) noCaben.push(m);
    else queda -= coste;
  });
  const fila = (m: MisionTrabajo, codigo: 'soltar_no_cabe' | 'soltar_carga'): Soltable => ({
    tipo: 'mision',
    id: m.id,
    titulo: m.titulo,
    motivo: { codigo },
    sinCoste: m.diaPrioridad === e.fecha,
  });
  if (noCaben.length) return noCaben.reverse().slice(0, MAX_SOLTAR).map((m) => fila(m, 'soltar_no_cabe'));
  if (e.nivelCarga === 'alta') return [fila(lista[lista.length - 1]!, 'soltar_carga')];
  return [];
}

export function elegirAhora(e: EntradaAhora): Ahora {
  const tramos = ocupaciones(e);
  const soltar = queSoltar(e, tramos);
  const base = { questId: null, entregaId: null, bloquePlanId: null, minutosSugeridos: null, hastaMin: null, soltar };

  if (e.bloque) {
    return {
      ...base,
      tipo: 'bloque',
      titulo: e.bloque.titulo,
      motivo: { codigo: e.bloque.fase === 'pausado' ? 'bloque_pausado' : 'bloque_en_curso', vars: { minutos: e.bloque.restanteMin } },
      accion: 'seguir_bloque',
      questId: e.bloque.questId,
    };
  }

  const eventosHoy = e.eventos
    .filter((x) => x.fecha === e.fecha && x.inicio !== null)
    .sort((a, b) => (a.inicio as number) - (b.inicio as number));
  const enCurso = eventosHoy.find((x) => (x.inicio as number) <= e.ahoraMin && e.ahoraMin < (finEvento(x) as number));
  if (enCurso) {
    const hasta = finEvento(enCurso) as number;
    return { ...base, tipo: 'reunion', titulo: enCurso.titulo, motivo: { codigo: 'reunion_en_curso', vars: { minutos: hasta - e.ahoraMin } }, accion: 'ninguna', hastaMin: hasta };
  }
  const proxima = eventosHoy.find((x) => (x.inicio as number) > e.ahoraMin);
  const aReunion = proxima ? (proxima.inicio as number) - e.ahoraMin : null;
  if (proxima && aReunion !== null && aReunion <= AVISO_REUNION_MIN) {
    return { ...base, tipo: 'reunion', titulo: proxima.titulo, motivo: { codigo: 'reunion_cerca', vars: { minutos: aReunion } }, accion: 'ninguna', hastaMin: proxima.inicio };
  }

  const lista = pendientes(e.misiones, e.fecha);
  const delPlan = e.plan.find((b) => !b.hecho && TIPOS_BLOQUE_TRABAJO.includes(b.tipo) && b.inicio <= e.ahoraMin && e.ahoraMin < b.fin);
  const siguiente = tramos.find((t) => t.inicio > e.ahoraMin)?.inicio ?? null;
  const hueco = siguiente === null ? null : siguiente - e.ahoraMin;
  const cabe = (min: number) => (hueco === null ? min : Math.min(min, hueco));

  if (delPlan && cabe(delPlan.fin - e.ahoraMin) >= MIN_MINUTOS_MISION) {
    // Sin misión propia, el bloque ataca la primera pendiente, y la tarjeta dice cuál: lo que paga se ve.
    const mision = delPlan.questId ? lista.find((m) => m.id === delPlan.questId) : lista[0];
    return {
      ...base,
      tipo: 'plan',
      titulo: delPlan.questId ? delPlan.titulo : (mision?.titulo ?? delPlan.titulo),
      motivo: { codigo: 'plan_ahora', vars: { hasta: minAHora(delPlan.fin) } },
      accion: 'empezar_bloque',
      questId: mision?.id ?? null,
      bloquePlanId: delPlan.id,
      minutosSugeridos: cabe(delPlan.fin - e.ahoraMin),
      hastaMin: delPlan.fin,
    };
  }

  const primera = lista[0];
  if (primera && hueco !== null && hueco < MIN_MINUTOS_MISION) {
    return { ...base, tipo: 'hueco', titulo: primera.titulo, motivo: { codigo: 'hueco_corto', vars: { minutos: hueco } }, accion: 'ninguna', questId: primera.id, hastaMin: siguiente };
  }

  const fin = e.finJornadaMin ?? FIN_JORNADA_MIN;
  if (primera) {
    const hechasHoy = e.misiones.some((m) => m.hecha && !m.penalizacion);
    const codigo =
      e.ahoraMin >= fin ? 'fuera_de_jornada' : primera.diaPrioridad !== e.fecha ? 'mision_fija' : hechasHoy ? 'prioridad_siguiente' : 'prioridad_primera';
    return {
      ...base,
      tipo: 'mision',
      titulo: primera.titulo,
      motivo: { codigo, vars: { restantes: lista.length - 1 } },
      accion: 'empezar_bloque',
      questId: primera.id,
      minutosSugeridos: cabe(Math.max(MIN_MINUTOS_MISION, esfuerzoMin(primera.xp))),
      hastaMin: siguiente,
    };
  }

  const entrega = e.entregas
    .filter((x) => !x.hecha && x.fecha !== null)
    .map((x) => ({ x, r: riesgoEntrega(x, e.fecha) }))
    .filter(({ r, x }) => r === 'atrasada' || r === 'hoy' || (r === 'en_riesgo' && x.fecha! <= sumarDias(e.fecha, DIAS_APRIETA)))
    .sort((a, b) => a.x.fecha!.localeCompare(b.x.fecha!) || a.x.posicion - b.x.posicion)[0];
  if (entrega) {
    return {
      ...base,
      tipo: 'entrega',
      titulo: entrega.x.titulo,
      motivo: { codigo: entrega.r === 'atrasada' ? 'entrega_atrasada' : entrega.r === 'hoy' ? 'entrega_hoy' : 'entrega_cerca' },
      accion: 'empezar_bloque',
      entregaId: entrega.x.id,
      minutosSugeridos: cabe(MINUTOS_BLOQUE_DEFECTO),
      hastaMin: siguiente,
    };
  }

  const huboAlgoHoy = e.misiones.some((m) => !m.penalizacion);
  const pena = e.misiones.find((m) => m.penalizacion && !m.hecha);
  if (huboAlgoHoy && pena) return { ...base, tipo: 'recuperar', titulo: pena.titulo, motivo: { codigo: 'recuperar' }, accion: 'ninguna', questId: pena.id };
  if (huboAlgoHoy) return { ...base, tipo: 'cerrado', titulo: null, motivo: { codigo: 'dia_cerrado' }, accion: 'ninguna' };
  return { ...base, tipo: 'planificar', titulo: null, motivo: { codigo: 'planificar' }, accion: 'planificar' };
}
