import { PROFILE_KINDS } from '../kinds';
import {
  DEFAULT_PLAN,
  PRO_BENEFITS,
  PRO_PLANS,
  energiaAgotada,
  energiaRestante,
  euros,
  isPro,
  legalText,
  planLabel,
  proEmphasis,
  proPlan,
  proSampleBrief,
  proToday,
  type AiStatus,
} from '../proplans';

const pro: AiStatus = { entitled: true, plan: 'anual', budget: 2_500_000, spent: 625_000, remaining: 1_875_000, renews: '2026-10-01' };
const gratis: AiStatus = { entitled: false, plan: null, budget: 0, spent: 0, remaining: 0 };

describe('NIVL Pro · la oferta', () => {
  test('los precios cuadran con docs/PRECIOS.md', () => {
    const anual = proPlan('nivl_pro_anual');
    const mensual = proPlan('nivl_pro_mensual');
    expect(mensual.price).toBe('9,99 €');
    expect(anual.price).toBe('79,99 €');
    expect(anual.perMonth).toBe('6,67 €');
    expect(anual.savings).toBe('−33 %');
    expect(anual.pitch).toBe('4 meses gratis · 6,67 €/mes');
    expect(mensual.savings).toBeNull();
  });

  test('el anual va delante y preseleccionado', () => {
    expect(DEFAULT_PLAN).toBe('nivl_pro_anual');
    expect(PRO_PLANS[0]?.id).toBe('nivl_pro_anual');
    expect(PRO_PLANS.map((p) => p.id).sort()).toEqual(['nivl_pro_anual', 'nivl_pro_mensual']);
  });

  test('euros usa coma decimal', () => {
    expect(euros(999)).toBe('9,99 €');
    expect(euros(7999 / 12)).toBe('6,67 €');
  });

  test('la letra pequeña dice precio, periodo, renovación y cómo cancelar', () => {
    for (const p of PRO_PLANS) {
      const t = legalText(p.id);
      expect(t).toContain(p.price);
      expect(t).toContain(`cada ${p.period}`);
      expect(t).toMatch(/renovación automática/);
      expect(t).toMatch(/cancelas cuando quieras/);
    }
  });

  test('todo perfil tiene su énfasis y su "hoy"', () => {
    for (const kind of PROFILE_KINDS) {
      expect(proEmphasis(kind).length).toBeGreaterThan(20);
      expect(proToday(kind).length).toBe(3);
    }
    expect(proEmphasis('piloto')).toBe(proEmphasis('general'));
    expect(PRO_BENEFITS.length).toBe(7);
  });
});

describe('NIVL Pro · el brief de muestra', () => {
  test('cuatro líneas por perfil, con cifras concretas y sin exclamaciones', () => {
    for (const kind of PROFILE_KINDS) {
      const brief = proSampleBrief(kind);
      expect(brief.length).toBe(4);
      expect(brief.some((l) => /\d/.test(l))).toBe(true);
      for (const linea of brief) {
        expect(linea.length).toBeGreaterThan(20);
        expect(linea).not.toMatch(/[!¡]/);
      }
    }
  });

  test('un perfil desconocido cae en el general', () => {
    expect(proSampleBrief('astronauta')).toEqual(proSampleBrief('general'));
  });
});

describe('NIVL Pro · el estado de la IA', () => {
  test('isPro lo decide el servidor', () => {
    expect(isPro(pro)).toBe(true);
    expect(isPro(gratis)).toBe(false);
    expect(isPro(null)).toBe(false);
  });

  test('la energía es lo que queda, entre 0 y 1', () => {
    expect(energiaRestante(pro)).toBeCloseTo(0.75);
    expect(energiaRestante(gratis)).toBe(0);
    expect(energiaRestante({ ...pro, remaining: 9_999_999 })).toBe(1);
    expect(energiaRestante({ ...pro, budget: 0 })).toBe(0);
  });

  test('agotada por debajo del umbral del candado', () => {
    expect(energiaAgotada(pro)).toBe(false);
    expect(energiaAgotada({ ...pro, remaining: 19_999 })).toBe(true);
    // Una cuenta gratuita no está "agotada": no tiene coach.
    expect(energiaAgotada(gratis)).toBe(false);
  });

  test('nombres de plan', () => {
    expect(planLabel('anual')).toBe('Anual');
    expect(planLabel('owner')).toBe('Fundador');
    expect(planLabel(null)).toBe('Gratis');
  });
});
