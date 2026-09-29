import { PROFILE_KINDS } from '../kinds';
import {
  DEFAULT_PLAN,
  DEFAULT_TIER,
  ELITE_BENEFITS,
  PRO_BENEFITS,
  PRO_PLANS,
  SIN_IA,
  TIERS,
  compraReflejada,
  energiaAgotada,
  esProductoNivl,
  energiaRestante,
  euros,
  isElite,
  isPro,
  legalText,
  lineaProfundos,
  planDePago,
  planLabel,
  planPorDefecto,
  planesALaVenta,
  planesDeTienda,
  pitchVisible,
  precioVisible,
  productoBase,
  proEmphasis,
  proPlan,
  proSampleBrief,
  proToday,
  seleccionDeTienda,
  puedeProfundo,
  tierOffer,
  turnosProfundos,
  type AiStatus,
} from '../proplans';

const pro: AiStatus = {
  ...SIN_IA,
  entitled: true,
  plan: 'pro_anual',
  tier: 'pro',
  budget: 1_500_000,
  spent: 375_000,
  remaining: 1_125_000,
  renews: '2026-10-01',
};
const elite: AiStatus = {
  ...pro,
  plan: 'elite_anual',
  tier: 'elite',
  budget: 2_500_000,
  spent: 0,
  remaining: 2_500_000,
  deepAllowed: true,
  deepRemaining: 1_500_000,
  deepTurns: 6,
};
const gratis: AiStatus = { ...SIN_IA, trialAvailable: true };

describe('NIVL Pro y Élite · la oferta', () => {
  test('los precios de Pro cuadran con docs/PRECIOS.md', () => {
    const anual = proPlan('nivl_pro_anual');
    const mensual = proPlan('nivl_pro_mensual');
    expect(mensual.price).toBe('12,99 €');
    expect(anual.price).toBe('99,99 €');
    expect(anual.perMonth).toBe('8,33 €');
    expect(anual.savings).toBe('−36 %');
    expect(anual.pitch).toBe('4 meses gratis · 8,33 €/mes');
    expect(mensual.savings).toBeNull();
  });

  test('los precios de Élite cuadran con docs/PRECIOS.md', () => {
    const mensual = proPlan('nivl_elite_mensual');
    const anual = proPlan('nivl_elite_anual');
    const fundador = proPlan('nivl_elite_fundador');
    expect(mensual.price).toBe('29,99 €');
    expect(anual.price).toBe('299,00 €');
    // Frente a 12 × 29,99 €.
    expect(anual.savings).toBe('−17 %');
    expect(fundador.price).toBe('249,00 €');
    expect(fundador.pitch).toMatch(/100 plazas/);
    expect(fundador.pitch).toMatch(/precio congelado/);
  });

  test('cinco productos, cada uno con su nivel y su plan de servidor', () => {
    expect(PRO_PLANS.map((p) => p.id).sort()).toEqual([
      'nivl_elite_anual',
      'nivl_elite_fundador',
      'nivl_elite_mensual',
      'nivl_pro_anual',
      'nivl_pro_mensual',
    ]);
    for (const p of PRO_PLANS) {
      expect(p.id).toBe(`nivl_${p.plan}`);
      expect(p.id.startsWith(`nivl_${p.tier}_`)).toBe(true);
    }
  });

  test('cada nivel lleva su preseleccionado primero; Pro anual por defecto', () => {
    expect(DEFAULT_TIER).toBe('pro');
    expect(DEFAULT_PLAN).toBe('nivl_pro_anual');
    for (const t of TIERS) {
      expect(t.plans[0]?.id).toBe(t.defaultPlan);
      expect(t.plans.every((p) => p.tier === t.id)).toBe(true);
    }
    expect(tierOffer('elite').name).toBe('NIVL Élite');
  });

  test('euros usa coma decimal', () => {
    expect(euros(1299)).toBe('12,99 €');
    expect(euros(9999 / 12)).toBe('8,33 €');
  });

  test('la letra pequeña dice nivel, precio, periodo, renovación y cómo cancelar', () => {
    for (const p of PRO_PLANS) {
      const t = legalText(p.id, p.price);
      expect(t).toContain(p.price);
      expect(t).toContain(tierOffer(p.tier).name);
      expect(t).toContain(`cada ${p.period === 'mes' ? 'mes' : 'año'}`);
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
    // Solo lo que existe (Apple 3.1.2): potencia y modo profundo (fase 1);
    // revisión a fondo, ludus e insignia (fase 3).
    expect(ELITE_BENEFITS.length).toBe(5);
    for (const b of ELITE_BENEFITS) expect(`${b.title} ${b.detail}`).not.toMatch(/escuadra|XP gratis|!/i);
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
  test('isPro e isElite los decide el servidor', () => {
    expect(isPro(pro)).toBe(true);
    expect(isPro(gratis)).toBe(false);
    expect(isPro(null)).toBe(false);
    expect(isElite(elite)).toBe(true);
    expect(isElite(pro)).toBe(false);
    // Un tier 'elite' sin derecho vigente no es Élite.
    expect(isElite({ ...elite, entitled: false })).toBe(false);
  });

  test('la energía es lo que queda del bolsillo estándar, entre 0 y 1', () => {
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

  test('modo profundo: lo abre el bolsillo, no el redondeo de turnos', () => {
    expect(puedeProfundo(elite)).toBe(true);
    expect(turnosProfundos(elite)).toBe(6);
    expect(puedeProfundo(pro)).toBe(false);
    expect(turnosProfundos(pro)).toBe(0);
    expect(puedeProfundo({ ...elite, deepRemaining: 19_999, deepTurns: 0 })).toBe(false);
    // Queda bolsillo pero menos que un turno medio: se puede, y se dice.
    const casi = { ...elite, deepRemaining: 100_000, deepTurns: 0 };
    expect(puedeProfundo(casi)).toBe(true);
    expect(lineaProfundos(casi)).toMatch(/menos de un turno/);
    expect(lineaProfundos(elite)).toBe('Te quedan 6 turnos profundos este mes.');
    expect(lineaProfundos({ ...elite, deepTurns: 1 })).toBe('Te queda 1 turno profundo este mes.');
    expect(lineaProfundos({ ...elite, deepRemaining: 0, deepTurns: 0 })).toMatch(/estándar sigue disponible/);
  });

  test('nombres de plan, con valor por defecto para uno desconocido', () => {
    expect(planLabel('pro_anual')).toBe('Pro anual');
    expect(planLabel('anual')).toBe('Pro anual');
    expect(planLabel('elite_fundador')).toBe('Élite fundador');
    // El dueño ya no es "Fundador": chocaría con el Élite fundador.
    expect(planLabel('owner')).toBe('Dueño');
    expect(planLabel(null)).toBe('Gratis');
    expect(planLabel('plan_del_futuro')).toBe('NIVL Pro');
  });

  test('de pago: todo menos cortesía, dueño y lo desconocido', () => {
    expect(planDePago('mensual')).toBe(true);
    expect(planDePago('elite_mensual')).toBe(true);
    expect(planDePago('cortesia')).toBe(false);
    expect(planDePago('owner')).toBe(false);
    expect(planDePago(null)).toBe(false);
    expect(planDePago('plan_del_futuro')).toBe(false);
  });
});

describe('NIVL Pro · la tienda abierta (fase 4)', () => {
  test('el id de producto se limpia del plan base de Google Play', () => {
    expect(productoBase('nivl_pro_anual')).toBe('nivl_pro_anual');
    expect(productoBase('nivl_pro_anual:anual-base')).toBe('nivl_pro_anual');
    expect(productoBase(null)).toBe('');
    expect(esProductoNivl('nivl_elite_fundador:p1y')).toBe(true);
    expect(esProductoNivl('rc_promo_pro_monthly')).toBe(false);
  });

  test('el fundador desaparece sin plazas y el preseleccionado cae al anual', () => {
    expect(planesALaVenta('elite', null).map((p) => p.id)).toContain('nivl_elite_fundador');
    expect(planesALaVenta('elite', 3).map((p) => p.id)).toContain('nivl_elite_fundador');
    expect(planesALaVenta('elite', 0).map((p) => p.id)).toEqual(['nivl_elite_anual', 'nivl_elite_mensual']);
    expect(planPorDefecto('elite', 0)).toBe('nivl_elite_anual');
    expect(planPorDefecto('elite', 12)).toBe('nivl_elite_fundador');
    expect(planPorDefecto('pro', 0)).toBe('nivl_pro_anual');
  });

  test('con el precio de la tienda en otra moneda no se enseñan cifras en euros', () => {
    const anual = proPlan('nivl_pro_anual');
    expect(precioVisible()).toBeNull();
    expect(precioVisible('  ')).toBeNull();
    expect(legalText(anual.id)).toBeNull();
    expect(precioVisible('$99.99')).toBe('$99.99');
    expect(pitchVisible(anual)).not.toMatch(/€|gratis|%/);
    expect(pitchVisible(proPlan('nivl_elite_fundador'))).toMatch(/plazas/);
    expect(legalText('nivl_pro_anual', '$99.99')).toContain('$99.99 cada año');
  });

  test('selecciona solo productos que la tienda ofrece, respetando plazas y nivel', () => {
    const precios = { nivl_pro_mensual: '$14.99', nivl_elite_anual: '$349.99', nivl_elite_fundador: '$299.99' };
    const pro = planesDeTienda('pro', 10, precios);
    expect(pro.map((p) => p.id)).toEqual(['nivl_pro_mensual']);
    expect(seleccionDeTienda(pro, 'nivl_pro_anual')?.id).toBe('nivl_pro_mensual');
    const elite = planesDeTienda('elite', 0, precios);
    expect(elite.map((p) => p.id)).toEqual(['nivl_elite_anual']);
    expect(seleccionDeTienda(elite, 'nivl_elite_fundador')?.id).toBe('nivl_elite_anual');
    expect(seleccionDeTienda(planesDeTienda('pro', null, {}), 'nivl_pro_anual')).toBeNull();
  });

  test('una compra está reflejada cuando el servidor da el nivel comprado', () => {
    expect(compraReflejada(gratis, 'nivl_pro_anual')).toBe(false);
    expect(compraReflejada(pro, 'nivl_pro_anual')).toBe(true);
    // Pro no basta para una compra de Élite: el webhook aún no ha llegado.
    expect(compraReflejada(pro, 'nivl_elite_anual')).toBe(false);
    expect(compraReflejada(elite, 'nivl_elite_anual')).toBe(true);
    // La prueba de 7 días no es la compra.
    expect(compraReflejada({ ...pro, plan: 'cortesia', trial: true }, 'nivl_pro_mensual')).toBe(false);
  });
});
