// QA Chat 5 · Simulación determinista de la economía: 30 y 90 días, y la vuelta
// en la semana 40 tras 14 o 30 días fuera. Usa SOLO las piezas puras que usa
// la app (closing.computeDayClose, game.questXp/levelFromXp), sin red.
// `QA_SIM_PRINT=1` imprime la tabla que va a docs/qa-audit/SIMULACION.md.

import { computeDayClose } from '../closing';
import { addDays } from '../dates';
import { levelFromXp, questXp, STAT_COLUMN } from '../game';
import type { Quest, Stat } from '../types';
import { mision } from './qa/servidor';

// Un día "normal" de 5 misiones: 2 fáciles, 2 medias, 1 difícil = 250 XP base,
// dentro del presupuesto diario de la skill (150–300).
const MISIONES: Quest[] = [
  mision({ id: 'm1', title: 'Leer 20 min', difficulty: 'facil', stat: 'INT' }),
  mision({ id: 'm2', title: 'Diario', difficulty: 'facil', stat: 'PER' }),
  mision({ id: 'm3', title: 'Gimnasio', difficulty: 'media', stat: 'FUE' }),
  mision({ id: 'm4', title: 'Comer limpio', difficulty: 'media', stat: 'VIT' }),
  mision({ id: 'm5', title: 'Bloque de trabajo profundo', difficulty: 'dificil', stat: 'INT' }),
];

interface Perfil {
  /** Fracción de misiones cumplidas en un día presente (determinista). */
  adherencia: number;
  /** ¿Completa la misión de penalización el día que aparece? */
  recupera: boolean;
  /** Días (índice desde 0) en los que no abre la app ni hace nada. */
  ausente?: (dia: number) => boolean;
}

interface Estado {
  xp: number;
  stats: Record<Stat, number>;
  streak: number;
  perfect: number;
  stones: number;
  perdido: number;
  recuperado: number;
  minStat: Record<Stat, number>;
}

/** Cumple las primeras ⌈adherencia·n⌉ misiones, rotando cuál falla cada día. */
function cumplidas(dia: number, adherencia: number): Set<string> {
  const n = MISIONES.length;
  const k = Math.round(adherencia * n);
  const hechas = new Set<string>();
  for (let i = 0; i < k; i++) hechas.add(MISIONES[(i + dia) % n]!.id);
  return hechas;
}

function simular(dias: number, p: Perfil, desde = '2026-10-01') {
  const e: Estado = { xp: 0, stats: { FUE: 0, VIT: 0, INT: 0, AGI: 0, PER: 0 }, streak: 0, perfect: 0,
    stones: 0, perdido: 0, recuperado: 0, minStat: { FUE: 0, VIT: 0, INT: 0, AGI: 0, PER: 0 } };
  const completadas = new Set<string>();
  let ultimoCerrado = addDays(desde, -1);
  const niveles: number[] = [];
  for (let d = 0; d < dias; d++) {
    const hoy = addDays(desde, d);
    const presente = !(p.ausente?.(d) ?? false);
    if (presente) {
      // Abrir la app cierra lo pendiente (engine.processPendingDays).
      if (ultimoCerrado < addDays(hoy, -1)) {
        const c = computeDayClose({ fromDate: addDays(ultimoCerrado, 1), today: hoy, quests: MISIONES,
          completedKeys: completadas, streak: e.streak, perfectStreak: e.perfect, stones: e.stones, freezeUntil: null });
        e.streak = c.streak; e.perfect = c.perfectStreak; e.stones = c.stones;
        e.xp = Math.max(0, e.xp - c.penaltyXp);
        e.perdido += c.penaltyXp;
        if (c.penaltyXp > 0 && p.recupera) {
          // La misión de penalización devuelve exacto, sin multiplicador ni stat.
          const pen = mision({ id: `pen${d}`, is_penalty: true, penalty_date: hoy, penalty_xp: c.penaltyXp, days_of_week: [] });
          const xp = questXp(pen, { evidence: false, streakDays: e.streak });
          e.xp += xp; e.recuperado += xp;
        }
      }
      ultimoCerrado = addDays(hoy, -1);
      for (const id of cumplidas(d, p.adherencia)) {
        const q = MISIONES.find((m) => m.id === id)!;
        const xp = questXp(q, { evidence: false, streakDays: e.streak });
        e.xp += xp;
        e.stats[q.stat] += xp;
        completadas.add(`${hoy}|${id}`);
      }
    }
    for (const s of Object.keys(STAT_COLUMN) as Stat[]) {
      expect(e.stats[s]).toBeGreaterThanOrEqual(e.minStat[s]); // invariante 1
      e.minStat[s] = e.stats[s];
    }
    niveles.push(levelFromXp(e.xp).level);
  }
  return { ...e, nivel: levelFromXp(e.xp).level, niveles };
}

const constante: Perfil = { adherencia: 0.8, recupera: true };
const irregular: Perfil = { adherencia: 0.6, recupera: false };

describe('progresión a 30 y 90 días', () => {
  test('el gladiador constante llega al nivel 8–12 el primer mes (objetivo de la skill)', () => {
    const r = simular(30, constante);
    if (process.env.QA_SIM_PRINT) console.log('constante 30d', { nivel: r.nivel, xp: r.xp, racha: r.streak, perdido: r.perdido });
    expect(r.nivel).toBeGreaterThanOrEqual(8);
    expect(r.nivel).toBeLessThanOrEqual(12);
  });

  test('a 90 días el ritmo de subida se frena (curva N^1.5) y no hay inflación', () => {
    const r30 = simular(30, constante);
    const r90 = simular(90, constante);
    if (process.env.QA_SIM_PRINT) console.log('constante 90d', { nivel: r90.nivel, xp: r90.xp, racha: r90.streak });
    const subidaMes1 = r30.nivel - 1;
    const subidaMeses23 = r90.nivel - r30.nivel;
    // Dos meses más dan menos niveles que el doble del primero: la curva frena.
    expect(subidaMeses23).toBeLessThan(2 * subidaMes1);
    // Techo de XP: ni con racha máxima un día pasa de 1,5 × 250.
    expect(r90.xp).toBeLessThanOrEqual(90 * 250 * 1.5);
  });

  test('el irregular (60 %, nunca recupera) progresa más lento pero no se hunde a cero', () => {
    const r = simular(90, irregular);
    if (process.env.QA_SIM_PRINT) console.log('irregular 90d', { nivel: r.nivel, xp: r.xp, perdido: r.perdido });
    expect(r.xp).toBeGreaterThan(0);
    expect(r.nivel).toBeLessThan(simular(90, constante).nivel);
  });
});

describe('vuelta en la semana 40 tras una ausencia', () => {
  const SEMANA40 = 7 * 39; // día 273
  for (const fuera of [14, 30]) {
    test(`${fuera} días fuera: pérdida topada, recuperable exacta, stats intactas`, () => {
      const ausente = (d: number) => d >= SEMANA40 && d < SEMANA40 + fuera;
      const antes = simular(SEMANA40, constante);
      const sinRecuperar = simular(SEMANA40 + fuera + 1, { ...constante, recupera: false, ausente });
      const recuperando = simular(SEMANA40 + fuera + 1, { ...constante, ausente });
      // 126 XP por día fallado: 2×13 + 2×25 + 50, bajo el tope de 150. Se
      // suma lo fallado el último día presente, que se cierra al volver.
      const extra = sinRecuperar.perdido - antes.perdido - fuera * 126;
      expect(extra).toBeGreaterThanOrEqual(0);
      expect(extra).toBeLessThan(126);
      // Recuperarla el día de la vuelta lo devuelve exacto (invariante 2).
      expect(recuperando.recuperado - recuperando.perdido).toBe(0);
      expect(recuperando.streak).toBe(0);
      if (process.env.QA_SIM_PRINT) {
        console.log(`vuelta tras ${fuera}d`, {
          nivelAntes: antes.nivel,
          nivelAlVolverSinRecuperar: levelFromXp(antes.xp - fuera * 126).level,
          xpPerdido: fuera * 126,
          diasNormalesParaReponer: +(fuera * 126 / 200).toFixed(1),
        });
      }
    });
  }
});
