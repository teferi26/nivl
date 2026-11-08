// NIVL · FOCUS: simulacro tipo test con penalización (puro, con tests).
//
// neto = aciertos − fallos × penalización (fracción de pregunta: 1/3, 1/4, 0).
// Los blancos ni suman ni restan. La nota es sobre 10 respecto al total de
// preguntas. El neto negativo solo se deja si esa convocatoria lo permite.

export interface EntradaSimulacroTest {
  aciertos: number;
  fallos: number;
  blancos: number;
  /** Lo que resta cada fallo (fracción de una pregunta). */
  penalizacion: number;
  netoNegativo?: boolean;
}

export interface ResultadoSimulacroTest {
  total: number;
  neto: number;
  /** Sobre 10. */
  nota: number;
  /** Porcentaje del total. */
  porcentaje: number;
}

const dos = (x: number) => Math.round(x * 100) / 100;
const entero = (x: number) => Number.isInteger(x) && x >= 0;

/** null si los datos no valen (negativos, decimales o ninguna pregunta). */
export function resultadoSimulacroTest(e: EntradaSimulacroTest): ResultadoSimulacroTest | null {
  if (!entero(e.aciertos) || !entero(e.fallos) || !entero(e.blancos)) return null;
  if (!Number.isFinite(e.penalizacion) || e.penalizacion < 0 || e.penalizacion > 1) return null;
  const total = e.aciertos + e.fallos + e.blancos;
  if (total === 0) return null;
  const crudo = e.aciertos - e.fallos * e.penalizacion;
  const neto = e.netoNegativo ? crudo : Math.max(0, crudo);
  return { total, neto: dos(neto), nota: dos((neto / total) * 10), porcentaje: dos((neto / total) * 100) };
}

/** Lee «1/3», «0,33» o «0.25». null si no es una fracción válida. */
export function leerPenalizacion(s: string): number | null {
  const t = s.trim().replace(',', '.');
  const f = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(t);
  if (f) {
    const d = Number(f[2]);
    if (d === 0) return null;
    const v = Number(f[1]) / d;
    return v <= 1 ? v : null;
  }
  if (!/^\d(\.\d{1,4})?$/.test(t)) return null;
  const v = Number(t);
  return v <= 1 ? v : null;
}

export interface PuntoSimulacro {
  fecha: string;
  nota: number;
  sobre: number;
}

export interface EvolucionSimulacros {
  puntos: { fecha: string; nota: number }[];
  ultima: number | null;
  mejor: number | null;
  media: number | null;
  /** La última menos la anterior; null con menos de dos. */
  cambio: number | null;
}

/** La curva de simulacros, de más antiguo a más reciente, sobre 10. */
export function evolucionSimulacros(lista: readonly PuntoSimulacro[]): EvolucionSimulacros {
  const puntos = lista
    .filter((p) => Number.isFinite(p.nota) && Number.isFinite(p.sobre) && p.sobre > 0)
    .map((p) => ({ fecha: p.fecha, nota: dos((p.nota / p.sobre) * 10) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (puntos.length === 0) return { puntos, ultima: null, mejor: null, media: null, cambio: null };
  const notas = puntos.map((p) => p.nota);
  const ultima = notas[notas.length - 1] as number;
  return {
    puntos,
    ultima,
    mejor: Math.max(...notas),
    media: dos(notas.reduce((s, x) => s + x, 0) / notas.length),
    cambio: notas.length >= 2 ? dos(ultima - (notas[notas.length - 2] as number)) : null,
  };
}
