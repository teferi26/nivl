// NIVL · Glosario: la lista casa con los catálogos y las cifras con las reglas reales.
import ayudaEs from '@/i18n/es/ayuda.json';
import { IDIOMAS_TRADUCIDOS, RECURSOS_LOCALES } from '@/i18n/traducidos';
import { TOLERANCIA_DIA, DIAS_COBRADOS_SEGUIDOS } from '../closing';
import { LUDUS_MAX, LUDUS_MIN } from '../elite';
import {
  BOSS_MULTIPLIER,
  DAILY_PENALTY_CAP,
  DUNGEON_CLEAR_XP,
  EVIDENCE_BONUS,
  HABIT_ACQUIRED_XP,
  MAX_STONES,
  PENALTY_FACTOR,
  REDEEM_COST,
  REDEEM_WEEKLY_CAP,
  RULE_BREAK_XP,
  STONE_EVERY_STREAK_DAYS,
  XP_BY_DIFFICULTY,
  statPoints,
  streakMultiplier,
} from '../game';
import {
  esTermino,
  GRUPOS_GLOSARIO,
  terminosDeGrupo,
  TERMINOS,
  tieneDetalle,
  type TerminoId,
} from '../glosario';
import { HABIT_TARGET_DAYS } from '../habits';

interface Entrada {
  titulo: string;
  definicion: string;
  detalle?: string;
}
const terminosDe = (cat: unknown) => (cat as { terminos: Record<string, Entrada> }).terminos;
const ES = terminosDe(ayudaEs);
const texto = (id: TerminoId) => `${ES[id]!.definicion} ${ES[id]!.detalle ?? ''}`;
const frases = (s: string) => s.split(/[.?](?:\s|$)/).filter((p) => p.trim()).length;
const cifras = (s: string) => [...s.matchAll(/\d+/g)].map((m) => m[0]);

describe('la lista', () => {
  it('sin ids repetidos, y todos en un grupo conocido', () => {
    const ids = TERMINOS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of TERMINOS) expect(GRUPOS_GLOSARIO).toContain(e.grupo);
    expect(GRUPOS_GLOSARIO.flatMap(terminosDeGrupo).sort()).toEqual([...ids].sort());
  });

  it('esTermino y tieneDetalle', () => {
    expect(esTermino('xp')).toBe(true);
    expect(esTermino('FUE')).toBe(true);
    expect(esTermino('nada')).toBe(false);
    expect(esTermino(undefined)).toBe(false);
    expect(tieneDetalle('racha')).toBe(true);
    expect(tieneDetalle('jefe')).toBe(false);
  });

  it('el catálogo tiene exactamente estos términos, y detalle solo si la lista lo dice', () => {
    expect(Object.keys(ES).sort()).toEqual(TERMINOS.map((e) => e.id).sort());
    for (const e of TERMINOS) {
      expect([e.id, !!ES[e.id]!.detalle]).toEqual([e.id, e.detalle]);
    }
  });
});

describe('los textos', () => {
  it('definición de una o dos frases, detalle de tres como mucho', () => {
    const largos: string[] = [];
    for (const [id, e] of Object.entries(ES)) {
      if (frases(e.definicion) > 2) largos.push(id);
      if (e.detalle && frases(e.detalle) > 3) largos.push(`${id} detalle`);
    }
    expect(largos).toEqual([]);
  });

  it('el vocabulario prohibido no aparece', () => {
    expect(JSON.stringify(ayudaEs)).not.toMatch(/mazmorra|cazador|escuadra/i);
  });

  it.each(IDIOMAS_TRADUCIDOS)('%s: las mismas cifras que el español', (lng) => {
    const otro = terminosDe((RECURSOS_LOCALES[lng] as { ayuda: unknown }).ayuda);
    const distintos: string[] = [];
    for (const [id, e] of Object.entries(ES)) {
      const o = otro[id]!;
      if (cifras(e.definicion).join() !== cifras(o.definicion).join()) distintos.push(id);
      if (cifras(e.detalle ?? '').join() !== cifras(o.detalle ?? '').join()) distintos.push(`${id} detalle`);
    }
    expect(distintos).toEqual([]);
  });
});

describe('las definiciones no se inventan mecánicas', () => {
  it('XP por dificultad', () => {
    for (const xp of Object.values(XP_BY_DIFFICULTY)) expect(cifras(texto('xp'))).toContain(String(xp));
  });

  it('evidencia', () => {
    expect(texto('evidencia')).toContain(`${EVIDENCE_BONUS * 100} %`);
  });

  it('racha: tolerancia y multiplicador', () => {
    expect(texto('racha')).toContain(`${TOLERANCIA_DIA * 100} %`);
    expect(streakMultiplier(7)).toBeCloseTo(1.1);
    expect(texto('racha')).toContain('Cada 7 días');
    expect(texto('racha')).toContain('10 %');
    expect(streakMultiplier(9999)).toBeCloseTo(1.5);
    expect(texto('racha')).toContain('50 %');
  });

  it('penalización: la mitad, tope y días cobrados', () => {
    expect(PENALTY_FACTOR).toBe(0.5);
    expect(texto('penalizacion')).toContain('la mitad');
    expect(texto('penalizacion')).toContain(`${DAILY_PENALTY_CAP} XP`);
    expect(DIAS_COBRADOS_SEGUIDOS).toBe(3);
    expect(texto('penalizacion')).toContain('desde el cuarto');
  });

  it('piedras', () => {
    expect(texto('piedras')).toContain(`hasta ${MAX_STONES}`);
    expect(texto('piedras')).toContain(`cada ${STONE_EVERY_STREAK_DAYS} días`);
  });

  it('atributos', () => {
    expect(statPoints(100)).toBe(1);
    expect(statPoints(99)).toBe(0);
    expect(texto('stats')).toContain('100 XP');
  });

  it('hábitos', () => {
    expect(texto('forja')).toContain(String(HABIT_TARGET_DAYS));
    expect(texto('adquirido')).toContain(`${HABIT_TARGET_DAYS} días`);
    expect(texto('adquirido')).toContain(`${HABIT_ACQUIRED_XP} XP`);
  });

  it('contrato y puntos bonus', () => {
    expect(texto('contrato')).toContain(`${RULE_BREAK_XP} XP`);
    expect(texto('puntosBonus')).toContain(`${REDEEM_COST} PB`);
    expect(texto('puntosBonus')).toContain(`${REDEEM_WEEKLY_CAP} PB`);
  });

  it('campañas', () => {
    expect(BOSS_MULTIPLIER).toBe(2);
    expect(texto('jefe')).toContain('el doble');
    expect(texto('botin')).toContain(`${DUNGEON_CLEAR_XP.E} a ${DUNGEON_CLEAR_XP.S} XP`);
  });

  it('ludus', () => {
    expect(texto('ludus')).toContain(`${LUDUS_MIN} a ${LUDUS_MAX}`);
  });
});
