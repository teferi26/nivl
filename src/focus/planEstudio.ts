// NIVL · FOCUS: el plan de estudio automático hacia cada examen (puro, con tests).
//
// Reparto, de hoy al día antes del examen:
//   · El último día antes del examen es de SIMULACRO (examen anterior o repaso
//     general de todo), si quedan 2 días o más.
//   · Los temas sin dominar se reparten en orden por los días que quedan,
//     equilibrando la carga: un tema pendiente pesa 2 y uno que ya se está
//     repasando pesa 1. Si sobran días, quedan huecos libres entre medias.
//   · Repetición espaciada dentro del plan: lo estudiado el día d vuelve como
//     repaso el d+1 y el d+3 (si caen antes del simulacro).
//   · Lo dominado no se estudia: se repasa una vez, repartido por los días.
// Determinista: misma entrada, mismo plan. Nada de esto paga XP.

import { diasEntre, sumarDias } from './fechas';
import type { ConfigPomodoro } from './pomodoro';
import type { EstadoTema } from './tipos';

export type TipoItem = 'estudiar' | 'repasar' | 'simulacro';

export interface ItemPlan {
  examenId: string;
  /** null en el simulacro (es de todo el temario). */
  temaId: string | null;
  tipo: TipoItem;
}

export interface DiaPlan {
  fecha: string;
  items: ItemPlan[];
}

export interface TemaParaPlan {
  id: string;
  estado: EstadoTema;
}

export interface EntradaPlan {
  examenId: string;
  /** Fecha del examen, 'YYYY-MM-DD'. */
  fecha: string;
  /** En el orden del temario. */
  temas: readonly TemaParaPlan[];
  hoy: string;
}

const PESO: Record<EstadoTema, number> = { pendiente: 2, repasando: 1, dominado: 0 };
const REPASOS_INTERNOS = [1, 3] as const;

/** Reparte `n` elementos con pesos en `d` días contiguos, en orden y equilibrados. */
function repartir(pesos: readonly number[], d: number): number[] {
  const total = pesos.reduce((s, p) => s + p, 0);
  if (d <= 0 || total <= 0) return pesos.map(() => 0);
  let antes = 0;
  return pesos.map((p) => {
    // El día en que EMPIEZA el tema: el primero cae hoy y, con más días que
    // temas, los demás quedan espaciados.
    const inicio = antes;
    antes += p;
    return Math.min(d - 1, Math.floor((inicio * d) / total));
  });
}

export function planHaciaExamen(e: EntradaPlan): DiaPlan[] {
  const dias = diasEntre(e.hoy, e.fecha);
  if (dias <= 0) return [];
  const conSimulacro = dias >= 2;
  const estudio = conSimulacro ? dias - 1 : dias;
  const plan: DiaPlan[] = Array.from({ length: dias }, (_, i) => ({ fecha: sumarDias(e.hoy, i), items: [] }));
  const poner = (dia: number, item: ItemPlan) => {
    const d = plan[dia];
    if (!d) return;
    if (d.items.some((x) => x.temaId === item.temaId && x.tipo === item.tipo)) return;
    d.items.push(item);
  };

  const porAprender = e.temas.filter((t) => t.estado !== 'dominado');
  const diaDe = repartir(
    porAprender.map((t) => PESO[t.estado]),
    estudio,
  );
  porAprender.forEach((t, i) => poner(diaDe[i]!, { examenId: e.examenId, temaId: t.id, tipo: 'estudiar' }));
  porAprender.forEach((t, i) => {
    for (const r of REPASOS_INTERNOS) {
      const d = diaDe[i]! + r;
      if (d < estudio) poner(d, { examenId: e.examenId, temaId: t.id, tipo: 'repasar' });
    }
  });

  const dominados = e.temas.filter((t) => t.estado === 'dominado');
  const diaDom = repartir(
    dominados.map(() => 1),
    estudio,
  );
  dominados.forEach((t, i) => poner(diaDom[i]!, { examenId: e.examenId, temaId: t.id, tipo: 'repasar' }));

  if (conSimulacro) poner(dias - 1, { examenId: e.examenId, temaId: null, tipo: 'simulacro' });

  // Dentro del día: primero lo nuevo, luego los repasos, el simulacro al final.
  const orden: Record<TipoItem, number> = { estudiar: 0, repasar: 1, simulacro: 2 };
  for (const d of plan) d.items.sort((a, b) => orden[a.tipo] - orden[b.tipo]);
  return plan;
}

const ORDEN: Record<TipoItem, number> = { estudiar: 0, repasar: 1, simulacro: 2 };

export interface ExamenConTemas {
  examenId: string;
  fecha: string;
  temas: readonly TemaParaPlan[];
}

/** Lo que toca HOY de todos los exámenes, primero el examen más cercano. */
export function planDeHoy(examenes: readonly ExamenConTemas[], hoy: string): ItemPlan[] {
  return [...examenes]
    .filter((x) => diasEntre(hoy, x.fecha) > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.examenId.localeCompare(b.examenId))
    .flatMap((x) => planHaciaExamen({ examenId: x.examenId, fecha: x.fecha, temas: x.temas, hoy })[0]?.items ?? [])
    // Lo nuevo de todos los exámenes primero; los repasos y el simulacro, detrás (orden estable).
    .map((item, i) => ({ item, i }))
    .sort((a, b) => ORDEN[a.item.tipo] - ORDEN[b.item.tipo] || a.i - b.i)
    .map((x) => x.item);
}

/** % del temario hecho: dominado cuenta entero, repasando la mitad. */
export function progresoTemario(temas: readonly { estado: EstadoTema }[]): number {
  if (temas.length === 0) return 0;
  const hecho = temas.reduce((s, t) => s + (t.estado === 'dominado' ? 1 : t.estado === 'repasando' ? 0.5 : 0), 0);
  return Math.round((hecho / temas.length) * 100);
}

const arribaMedia = (min: number) => Math.ceil(min / 30) * 30;

/**
 * La hora a la que empezar a estudiar hoy: la siguiente media hora a partir de
 * ahora y, si hay clase, media hora después de la última. Más tarde de las
 * 22:30 ya no se propone hora (null).
 */
export function inicioEstudio(ahoraMin: number, finUltimaClase: number | null): number | null {
  const base = Math.max(arribaMedia(ahoraMin), finUltimaClase === null ? 0 : arribaMedia(finUltimaClase + 30));
  return base > 22 * 60 + 30 ? null : base;
}

/**
 * La hora de cada bloque si se encadenan pomodoros desde `inicio`: un bloque
 * por elemento, con su descanso (el largo cada `cadaLargo`).
 */
export function horasDeBloques(n: number, inicio: number, c: Pick<ConfigPomodoro, 'foco' | 'descanso' | 'largo' | 'cadaLargo'>): number[] {
  const out: number[] = [];
  let t = inicio;
  for (let i = 0; i < n; i++) {
    out.push(t);
    t += c.foco + ((i + 1) % c.cadaLargo === 0 ? c.largo : c.descanso);
  }
  return out;
}
