// Lógica PURA de la capa social (sin red ni Supabase) — testeable en aislamiento.
// social.ts trae los datos; aquí se ordenan, se etiquetan y se les pone voz.
//
// El marcador llega ya agregado desde la RPC friends_board (0021): de un amigo
// solo existen estas cifras. Aquí no se calcula nada que exija ver sus misiones.

import { XP_BY_DIFFICULTY } from './game';

export type Metrica = 'xp' | 'cumplimiento' | 'racha';
export type Ventana = 'semana' | 'mes';

export const DIAS_VENTANA: Record<Ventana, number> = { semana: 7, mes: 30 };

export const METRICA_LABEL: Record<Metrica, string> = {
  xp: 'XP',
  cumplimiento: 'Cumplimiento',
  racha: 'Racha',
};

/** Lo mínimo que hace falta de alguien para ponerle en una clasificación. */
export interface Competidor {
  userId: string;
  name: string;
  isMe: boolean;
  /** XP ganado con misiones dentro de la ventana. */
  xpWindow: number;
  /** % de misiones programadas cumplidas; null si no tenía ninguna programada. */
  compliancePct: number | null;
  completed: number;
  streakDays: number;
  xpTotal: number;
}

export interface Clasificado<T extends Competidor = Competidor> {
  posicion: number;
  competidor: T;
  /** El valor de la métrica elegida; null = sin dato (no se le puede medir). */
  valor: number | null;
}

export function valorDe(c: Competidor, metrica: Metrica): number | null {
  if (metrica === 'xp') return c.xpWindow;
  if (metrica === 'racha') return c.streakDays;
  return c.compliancePct;
}

// Desempates. La idea es que el orden nunca dependa del orden de llegada de la
// RPC: dos cargas seguidas del mismo marcador tienen que pintarse igual.
//   · XP          → cumplimiento → racha → XP total
//   · Cumplimiento → misiones completadas (un 100 % de 40 pesa más que un
//                    100 % de 3) → XP de la ventana → racha
//   · Racha       → XP de la ventana → cumplimiento → XP total
// Y al final el nombre y el id, para que el empate absoluto sea estable.
const DESEMPATE: Record<Metrica, ((c: Competidor) => number)[]> = {
  xp: [(c) => c.compliancePct ?? -1, (c) => c.streakDays, (c) => c.xpTotal],
  cumplimiento: [(c) => c.completed, (c) => c.xpWindow, (c) => c.streakDays],
  racha: [(c) => c.xpWindow, (c) => c.compliancePct ?? -1, (c) => c.xpTotal],
};

/**
 * Ordena de mejor a peor por la métrica. Quien no tiene dato (cumplimiento sin
 * misiones programadas) va SIEMPRE al final: no es un 0 %, es "sin medir", y
 * ponerle por delante de alguien con un 10 % real sería premiar no tener plan.
 *
 * Las posiciones son de competición (1, 2, 2, 4): con el mismo valor se
 * comparte puesto, porque decirle a alguien que va tercero con los mismos
 * puntos que el segundo es inventarse una derrota. El desempate solo decide
 * quién se pinta antes.
 */
export function clasificar<T extends Competidor>(lista: readonly T[], metrica: Metrica): Clasificado<T>[] {
  const ordenada = [...lista].sort((a, b) => {
    const va = valorDe(a, metrica);
    const vb = valorDe(b, metrica);
    if (va === null && vb !== null) return 1;
    if (vb === null && va !== null) return -1;
    if (va !== null && vb !== null && va !== vb) return vb - va;
    for (const f of DESEMPATE[metrica]) {
      const d = f(b) - f(a);
      if (d !== 0) return d;
    }
    return a.name.localeCompare(b.name, 'es') || a.userId.localeCompare(b.userId);
  });

  const salida: Clasificado<T>[] = [];
  ordenada.forEach((competidor, i) => {
    const valor = valorDe(competidor, metrica);
    const previo = salida[i - 1];
    const posicion = previo && previo.valor === valor ? previo.posicion : i + 1;
    salida.push({ posicion, competidor, valor });
  });
  return salida;
}

/** "1.º", "2.º"… El ordinal español lleva punto antes de la volada. */
export function etiquetaPosicion(posicion: number): string {
  return `${Math.max(1, Math.round(posicion))}.º`;
}

/** Para la tarjeta de compartir: "1.º de 5". Sin amigos no hay puesto que contar. */
export function posicionEntreAmigos(clasificados: readonly Clasificado[]): string | null {
  if (clasificados.length < 2) return null;
  const yo = clasificados.find((c) => c.competidor.isMe);
  if (!yo || yo.valor === null) return null;
  return `${etiquetaPosicion(yo.posicion)} de ${clasificados.length}`;
}

export function formatoValor(valor: number | null, metrica: Metrica): string {
  if (valor === null) return '—';
  if (metrica === 'xp') return `${valor.toLocaleString('es-ES')} XP`;
  if (metrica === 'cumplimiento') return `${valor} %`;
  return valor === 1 ? '1 día' : `${valor} días`;
}

export type Rivalidad =
  | { tipo: 'solo' }
  | { tipo: 'sin_dato' }
  | { tipo: 'lider'; rival: Competidor; diferencia: number }
  | { tipo: 'empate'; rival: Competidor; diferencia: 0 }
  | { tipo: 'persigue'; rival: Competidor; diferencia: number };

/**
 * Quién va por delante y por cuánto, visto desde mí.
 *
 * El rival no es el líder: es el que tengo INMEDIATAMENTE delante. "Te sacan
 * 4.000 XP" no mueve a nadie; "Marta te saca 120" sí, porque se arregla hoy.
 * Si voy primero, el rival es quien me pisa los talones.
 */
export function quienVaDelante(clasificados: readonly Clasificado[]): Rivalidad {
  const i = clasificados.findIndex((c) => c.competidor.isMe);
  if (i < 0 || clasificados.length < 2) return { tipo: 'solo' };
  const yo = clasificados[i]!;
  if (yo.valor === null) return { tipo: 'sin_dato' };

  const medidos = clasificados.filter((c) => c.valor !== null);
  if (medidos.length < 2) return { tipo: 'solo' };
  const j = medidos.findIndex((c) => c.competidor.isMe);

  // Empatado con alguien (delante o detrás): el mensaje es el empate.
  const igual = medidos.find((c, k) => k !== j && c.valor === yo.valor);
  if (igual) return { tipo: 'empate', rival: igual.competidor, diferencia: 0 };

  if (j === 0) {
    const segundo = medidos[1]!;
    return { tipo: 'lider', rival: segundo.competidor, diferencia: yo.valor - segundo.valor! };
  }
  const delante = medidos[j - 1]!;
  return { tipo: 'persigue', rival: delante.competidor, diferencia: delante.valor! - yo.valor };
}

const VENTANA_TEXTO: Record<Ventana, string> = { semana: 'esta semana', mes: 'este mes' };

/** Solo el primer nombre: "María del Carmen López" no cabe en una línea de rivalidad. */
function nombreCorto(name: string): string {
  const limpio = name.trim().split(/\s+/)[0] ?? '';
  return limpio.length > 0 ? limpio.slice(0, 16) : 'Tu rival';
}

/** Cuántas misiones difíciles hacen falta para pasar a alguien que te saca `xp`. */
export function misionesParaAdelantar(xp: number): number {
  return Math.max(1, Math.ceil((xp + 1) / XP_BY_DIFFICULTY.dificil));
}

const NUMERO: Record<number, string> = { 1: 'Una', 2: 'Dos', 3: 'Tres', 4: 'Cuatro', 5: 'Cinco' };

/** La línea de rivalidad, en la voz del sistema: constata y señala el camino. */
export function lineaRivalidad(clasificados: readonly Clasificado[], metrica: Metrica, ventana: Ventana): string {
  const r = quienVaDelante(clasificados);
  const cuando = VENTANA_TEXTO[ventana];

  if (r.tipo === 'solo') return 'Sin rival no hay marcador. Invita a alguien que te apriete.';
  if (r.tipo === 'sin_dato') {
    return 'No tenías misiones programadas en este periodo. El sistema no puede medirte.';
  }

  const rival = nombreCorto(r.rival.name);

  if (r.tipo === 'empate') {
    if (metrica === 'xp') return `${rival} y tú vais empatados ${cuando}. La próxima misión desempata.`;
    if (metrica === 'cumplimiento') return `${rival} y tú cumplís lo mismo ${cuando}. El primero que falle, pierde.`;
    return `${rival} y tú lleváis la misma racha. Gana quien no falle mañana.`;
  }

  if (r.tipo === 'lider') {
    if (metrica === 'xp') return `Lideras ${cuando}. ${rival} te sigue a ${r.diferencia.toLocaleString('es-ES')} XP.`;
    if (metrica === 'cumplimiento') return `Nadie cumple más que tú ${cuando}. ${rival} está a ${r.diferencia} puntos.`;
    return `Tu racha manda. ${rival} está a ${formatoValor(r.diferencia, 'racha')}.`;
  }

  if (metrica === 'xp') {
    const n = misionesParaAdelantar(r.diferencia);
    const camino =
      n === 1
        ? 'Una misión difícil y pasas delante.'
        : n <= 5
          ? `${NUMERO[n]} misiones difíciles y pasas delante.`
          : 'Se recorta día a día, no de golpe.';
    return `${rival} te saca ${r.diferencia.toLocaleString('es-ES')} XP ${cuando}. ${camino}`;
  }
  if (metrica === 'cumplimiento') {
    return `${rival} cumple ${r.diferencia} puntos más que tú ${cuando}. Un día sin fallos recorta la distancia.`;
  }
  return `${rival} te saca ${formatoValor(r.diferencia, 'racha')} de racha. Eso no se compra: se cierra día a día.`;
}

// ── El código de amigo ──────────────────────────────────────────────
// El mismo alfabeto que gen_friend_code (0021): sin 0/O/1/I. Si tocas uno,
// toca el otro.
export const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LARGO_CODIGO = 8;

/** Lo que la gente pega de un mensaje: minúsculas, espacios, guiones, un punto medio. */
export function normalizarCodigo(entrada: string): string {
  return entrada.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LARGO_CODIGO);
}

export function codigoValido(codigo: string): boolean {
  if (codigo.length !== LARGO_CODIGO) return false;
  return [...codigo].every((ch) => ALFABETO_CODIGO.includes(ch));
}

/** Por qué no vale, en una frase; null si vale. Evita gastar un intento del freno del servidor. */
export function errorDeCodigo(entrada: string, miCodigo?: string | null): string | null {
  const codigo = normalizarCodigo(entrada);
  if (codigo.length < LARGO_CODIGO) return `Faltan ${LARGO_CODIGO - codigo.length} caracteres. Son ${LARGO_CODIGO}.`;
  if (!codigoValido(codigo)) return 'Ese código no existe: no usan 0, 1, O ni I.';
  if (miCodigo && codigo === miCodigo) return 'Ese código es el tuyo. El rival tiene que ser otro.';
  return null;
}

/** "ABCD 2345": en dos bloques se lee y se dicta sin perderse. */
export function codigoLegible(codigo: string): string {
  return codigo.length === LARGO_CODIGO ? `${codigo.slice(0, 4)} ${codigo.slice(4)}` : codigo;
}

/** La web de NIVL. ÚNICA definición: la invitación y la tarjeta salen de aquí. */
export const URL_NIVL = 'https://nivl.app';

/** "nivl.app": la URL sin protocolo, como se escribe en una tarjeta. */
export const DOMINIO_NIVL = URL_NIVL.replace(/^https?:\/\//, '');

export function mensajeInvitacion(codigo: string): string {
  return `Mídete conmigo en NIVL. Mi código: ${codigo} · ${URL_NIVL}`;
}
