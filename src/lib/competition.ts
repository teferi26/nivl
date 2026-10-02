// NIVL · Competición entre amigos (sistema de juego v2). Lógica PURA.
//
// Principios (no negociables):
// - No se apuesta ni se gana XP compitiendo. La competición mide; no paga.
// - Justa entre perfiles distintos: un estudiante con 3 misiones y un
//   deportista con 9 compiten en ADHERENCIA (qué parte de lo suyo cumplen),
//   no en volumen. La velocidad se mide contra el propio histórico.
// - Sin ligas públicas. Solo amigos, sin bloqueos entre miembros (lo hace
//   cumplir el servidor, 0045 + 0032).
// - El servidor calcula las puntuaciones con estas mismas fórmulas (espejo
//   SQL); el cliente solo las enseña. Si tocas una, toca la otra.

// ── Índice de disciplina ───────────────────────────────────────────────

/**
 * Media a priori y peso del prior, en XP BASE (game.XP_BY_DIFFICULTY, sin
 * racha ni evidencia): un día con 3 triviales al 100 % no puede ganar a quien
 * cumple el 90 % de un día exigente (revisión de nivl-game-balancer). El peso
 * equivale a un día normal (250 XP base).
 */
export const PRIOR_ADHERENCIA = 0.7;
export const PESO_PRIOR_XP = 250;

/**
 * Adherencia suavizada (bayesiana) de 0 a 100, ponderada por la dificultad:
 * `cumplidasXp` y `programadasXp` son la suma del XP base de lo cumplido y de
 * lo programado. Con poco programado el valor se acerca al 70 %.
 */
export function indiceDisciplina(cumplidasXp: number, programadasXp: number): number {
  const c = Math.max(0, Math.min(cumplidasXp, programadasXp));
  const p = Math.max(0, programadasXp);
  return Math.round((100 * (c + PRIOR_ADHERENCIA * PESO_PRIOR_XP)) / (p + PESO_PRIOR_XP));
}

// ── Velocidad de progreso ──────────────────────────────────────────────

export const VELOCIDAD_MAX = 2;

/**
 * Ritmo de XP de la ventana frente al propio ritmo de las 4 semanas previas,
 * con tope ×2. Sin histórico (cuenta nueva) vale 1: neutral, ni premio ni
 * castigo. Así no gana quien más misiones se pone, sino quien mejora.
 */
export function velocidad(xpVentana: number, diasVentana: number, xpBase: number, diasBase = 28): number {
  if (diasVentana <= 0) return 1;
  const ritmo = Math.max(0, xpVentana) / diasVentana;
  const base = Math.max(0, xpBase) / Math.max(1, diasBase);
  if (base <= 0) return 1;
  return Math.round(Math.min(VELOCIDAD_MAX, ritmo / base) * 100) / 100;
}

// ── Duelos semanales ───────────────────────────────────────────────────

export interface MarcadorSemana {
  /**
   * XP base programado y cumplido en la semana (lunes–domingo local). Lo
   * programado sale de la FOTO FIJA que guarda el servidor al cerrar cada
   * día, no de las misiones actuales: desactivar una misión fallada no
   * borra el fallo de la semana.
   */
  programadasXp: number;
  cumplidasXp: number;
  /** Días con al menos una misión cumplida. */
  diasActivos: number;
}

/** XP base mínimo programado para que la semana cuente (≈ 3 misiones medias). */
export const MIN_XP_DUELO = 150;

export type ResultadoDuelo =
  | { estado: 'ganador'; ganador: 'a' | 'b'; motivo: 'disciplina' | 'dias_activos'; a: number; b: number }
  | { estado: 'empate'; a: number; b: number }
  | { estado: 'sin_datos'; falta: ('a' | 'b')[] };

/**
 * Gana el mayor índice de disciplina; a igualdad, más días activos; si no,
 * empate. Una semana con menos de 150 XP base programados no se puede
 * juzgar: crear muy pocas misiones para tener un 100 % no sirve.
 */
export function resolverDuelo(a: MarcadorSemana, b: MarcadorSemana): ResultadoDuelo {
  const falta: ('a' | 'b')[] = [];
  if (a.programadasXp < MIN_XP_DUELO) falta.push('a');
  if (b.programadasXp < MIN_XP_DUELO) falta.push('b');
  if (falta.length) return { estado: 'sin_datos', falta };
  const ia = indiceDisciplina(a.cumplidasXp, a.programadasXp);
  const ib = indiceDisciplina(b.cumplidasXp, b.programadasXp);
  if (ia !== ib) return { estado: 'ganador', ganador: ia > ib ? 'a' : 'b', motivo: 'disciplina', a: ia, b: ib };
  if (a.diasActivos !== b.diasActivos) {
    return { estado: 'ganador', ganador: a.diasActivos > b.diasActivos ? 'a' : 'b', motivo: 'dias_activos', a: ia, b: ib };
  }
  return { estado: 'empate', a: ia, b: ib };
}

// ── Ligas privadas ─────────────────────────────────────────────────────

export const LIGA_MIN = 3;
export const LIGA_MAX = 20;
export const NOMBRE_LIGA_MAX = 40;

/** Nombre de liga limpio: una línea, sin espacios de sobra, ≤40 caracteres. */
export function nombreDeLiga(raw: string): string | null {
  const limpio = raw.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NOMBRE_LIGA_MAX).trim();
  return limpio.length >= 2 ? limpio : null;
}

export interface FilaLiga extends MarcadorSemana {
  id: string;
  alias: string;
  xpSemana: number;
  xpBase28: number;
}

export interface PuestoLiga {
  id: string;
  alias: string;
  puesto: number;
  indice: number;
  velocidad: number;
  diasActivos: number;
  /** Sin datos suficientes esta semana: aparece al final, sin puesto numérico. */
  sinDatos: boolean;
}

/**
 * Clasificación semanal: índice de disciplina, luego velocidad, luego días
 * activos. Los empates comparten puesto (1, 1, 3). Quien no llega al mínimo
 * de misiones queda al final sin puesto: no se le humilla con un «último».
 */
export function tablaLiga(filas: FilaLiga[]): PuestoLiga[] {
  const calc = filas.map((f) => ({
    id: f.id, alias: f.alias,
    indice: indiceDisciplina(f.cumplidasXp, f.programadasXp),
    velocidad: velocidad(f.xpSemana, 7, f.xpBase28),
    diasActivos: f.diasActivos,
    sinDatos: f.programadasXp < MIN_XP_DUELO,
  }));
  const con = calc.filter((c) => !c.sinDatos).sort((x, y) =>
    y.indice - x.indice || y.velocidad - x.velocidad || y.diasActivos - x.diasActivos || x.alias.localeCompare(y.alias));
  const sin = calc.filter((c) => c.sinDatos).sort((x, y) => x.alias.localeCompare(y.alias));
  const out: PuestoLiga[] = [];
  con.forEach((c, i) => {
    const prev = out[i - 1];
    const empata = prev && prev.indice === c.indice && prev.velocidad === c.velocidad && prev.diasActivos === c.diasActivos;
    out.push({ ...c, puesto: empata ? prev.puesto : i + 1 });
  });
  for (const c of sin) out.push({ ...c, puesto: 0 });
  return out;
}

// ── Invitar → reto conjunto ────────────────────────────────────────────

export const DIAS_RETO = 7;
export const DIAS_PARA_CUMPLIR_RETO = 5;

export type PasoEmbudo = 'invitado' | 'aceptado' | 'reto_en_curso' | 'reto_cumplido' | 'reto_fallido';

/**
 * Reto conjunto de 7 días tras aceptar una invitación: se cumple si LOS DOS
 * tienen al menos 5 días cumplidos. Lo que da es identidad (cuenta para la
 * insignia Reclutador si el invitado llega a «activo», que decide el servidor
 * del Chat 2), nunca XP ni días de Pro.
 */
export function estadoReto(diasA: boolean[], diasB: boolean[], diaActual: number): {
  paso: PasoEmbudo;
  cumplidosA: number;
  cumplidosB: number;
  quedan: number;
} {
  const n = Math.min(DIAS_RETO, Math.max(0, diaActual));
  const cumplidosA = diasA.slice(0, n).filter(Boolean).length;
  const cumplidosB = diasB.slice(0, n).filter(Boolean).length;
  const quedan = DIAS_RETO - n;
  const alcanzable = (c: number) => c + quedan >= DIAS_PARA_CUMPLIR_RETO;
  let paso: PasoEmbudo = 'reto_en_curso';
  if (cumplidosA >= DIAS_PARA_CUMPLIR_RETO && cumplidosB >= DIAS_PARA_CUMPLIR_RETO) paso = 'reto_cumplido';
  else if (!alcanzable(cumplidosA) || !alcanzable(cumplidosB)) paso = 'reto_fallido';
  else if (n >= DIAS_RETO) paso = 'reto_fallido';
  return { paso, cumplidosA, cumplidosB, quedan };
}
