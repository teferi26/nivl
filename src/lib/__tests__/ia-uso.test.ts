// IA barata (0078): cuánta IA queda, los avisos del 80 / 95 % y la recarga. Lógica pura de proplans.ts.
import { carteraDe, porcentajeIa, RECARGA_IA_ID, SIN_IA, usoIa, type AiStatus } from '../proplans';

const base: AiStatus = { ...SIN_IA, entitled: true, tier: 'elite', plan: 'elite_mensual', budget: 6_000_000, remaining: 6_000_000 };
const con = (usado: number, motivo: string | null = null, tope = 8_000_000): AiStatus => ({
  ...base,
  ia: { tope, usado, recarga: 0, limiteHoy: 800_000, usadoHoy: 0, renueva: '2026-11-01', motivo },
});

describe('usoIa', () => {
  it('sin cartera o sin derecho, nada (la app usa la energía de antes)', () => {
    expect(usoIa(null)).toBeNull();
    expect(usoIa(base)).toBeNull();
    expect(usoIa({ ...con(0), entitled: false })).toBeNull();
    expect(usoIa(con(0, null, 0))).toBeNull();
  });
  it('umbrales del 80 y 95 % usados', () => {
    expect(usoIa(con(1_000_000))).toEqual({ queda: 0.875, nivel: 'normal' });
    expect(usoIa(con(6_399_999))?.nivel).toBe('normal');
    expect(usoIa(con(6_400_000))?.nivel).toBe('aviso80');
    expect(usoIa(con(7_600_000))?.nivel).toBe('aviso95');
    expect(usoIa(con(8_000_000))?.nivel).toBe('agotada');
  });
  it('la puerta del servidor manda: tope del mes = agotada; ritmo del día = hoy', () => {
    expect(usoIa(con(7_700_000, 'tope_mes'))?.nivel).toBe('agotada');
    expect(usoIa(con(1_000_000, 'ritmo_diario'))?.nivel).toBe('hoy');
  });
  it('nunca pasa de 0 a 1 aunque el servidor mande cifras raras', () => {
    expect(usoIa(con(9_000_000))?.queda).toBe(0);
    expect(usoIa(con(-5))?.queda).toBe(1);
  });
});

describe('porcentajeIa', () => {
  it('nunca 0 mientras quede algo y nunca 100 si se usó algo', () => {
    expect(porcentajeIa(0.001)).toBe(1);
    expect(porcentajeIa(0.999)).toBe(99);
    expect(porcentajeIa(0)).toBe(0);
    expect(porcentajeIa(1)).toBe(100);
    expect(porcentajeIa(0.734)).toBe(73);
  });
});

describe('carteraDe', () => {
  it('lee ai_status.ia y descarta lo que no tiene derecho o no es objeto', () => {
    expect(carteraDe(undefined)).toBeNull();
    expect(carteraDe({ entitled: false })).toBeNull();
    expect(carteraDe({ entitled: true, tope: '8000000', usado: 10, recarga: null, limite_hoy: 5, usado_hoy: 1, renueva: '2026-11-01', motivo: null }))
      .toEqual({ tope: 8_000_000, usado: 10, recarga: 0, limiteHoy: 5, usadoHoy: 1, renueva: '2026-11-01', motivo: null });
  });
  it('el producto de recarga es el que Teferi crea en las tiendas', () => {
    expect(RECARGA_IA_ID).toBe('nivl_ia_recarga_1');
  });
});
