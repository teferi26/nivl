import {
  AJUSTES_POR_DEFECTO,
  codigoValido,
  comisionCents,
  enlaceCreador,
  fechaPago,
  importe,
  lineaPosicion,
  lineaRango,
  liquidacionCents,
  motivoReferral,
  netoCents,
  normalizarCodigo,
  pctEfectivo,
  pctLabel,
  porVentaAnual,
  rangoLabel,
  redondear,
  topeCents,
  type Ajustes,
  type Comision,
  type Producto,
} from '../creatormath';

// Los productos de store_products (0025).
const PRO_MENSUAL: Producto = { period: 'mensual' };
const PRO_ANUAL: Producto = { period: 'anual', maxPctWithoutSbp: 35 };
const ELITE_MENSUAL: Producto = { period: 'mensual' };
const ELITE_ANUAL: Producto = { period: 'anual' };

const CON_SBP: Ajustes = { ...AJUSTES_POR_DEFECTO, smallBusinessProgram: true };
const SIN_SBP: Ajustes = { ...AJUSTES_POR_DEFECTO, smallBusinessProgram: false };

/**
 * Lo que hace record_sale cobro a cobro para UNA cuenta: el acumulado son las
 * comisiones primer_pago/mensual no anuladas. `reembolsar` anula una por índice.
 */
function simular(
  rangoPct: number,
  ajustes: Ajustes,
  cobros: { producto: Producto; precioCents: number }[],
): (Comision | null)[] {
  const vivas: Comision[] = [];
  return cobros.map(({ producto, precioCents }) => {
    const acumulado = vivas
      .filter((c) => c.kind === 'primer_pago' || c.kind === 'mensual')
      .reduce((s, c) => s + c.amountCents, 0);
    const c = comisionCents({
      rangoPct,
      producto,
      netCents: netoCents(precioCents, ajustes),
      acumuladoCents: acumulado,
      ajustes,
    });
    if (c) vivas.push(c);
    return c;
  });
}

describe('código de creador', () => {
  it('normaliza como claim_referral: mayúsculas y sin espacios', () => {
    expect(normalizarCodigo('  pepe gym ')).toBe('PEPEGYM');
    expect(normalizarCodigo(null)).toBe('');
  });

  it('valida la forma ^[A-Z0-9_]{3,20}$', () => {
    expect(codigoValido('pepe_01')).toBe('PEPE_01');
    expect(codigoValido('ab')).toBeNull();
    expect(codigoValido('a'.repeat(21))).toBeNull();
    expect(codigoValido('pé pe')).toBeNull();
    expect(codigoValido('')).toBeNull();
  });

  it('el enlace es nivl://c/CODIGO', () => {
    expect(enlaceCreador('pepe')).toBe('nivl://c/PEPE');
  });

  it('cada rechazo tiene su línea y lo desconocido cae en el genérico', () => {
    expect(motivoReferral('propio')).toMatch(/tuyo/);
    expect(motivoReferral('fuera_de_plazo')).toMatch(/plazo/);
    expect(motivoReferral('lo_que_sea')).toBe(motivoReferral('desconocido'));
  });
});

describe('redondeo como Postgres', () => {
  it('la mitad va hacia fuera del cero', () => {
    expect(redondear(456.5)).toBe(457);
    expect(redondear(0.5)).toBe(1);
    expect(redondear(-0.5)).toBe(-1);
    expect(redondear(912.4999)).toBe(912);
  });
});

describe('neto de un cobro (docs/PRECIOS.md, "Lo que entra limpio")', () => {
  it('con SBP, 15 %', () => {
    expect(netoCents(1299, CON_SBP)).toBe(913);
    expect(netoCents(9999, CON_SBP)).toBe(7024);
    expect(netoCents(2999, CON_SBP)).toBe(2107);
    expect(netoCents(29900, CON_SBP)).toBe(21004);
    expect(netoCents(24900, CON_SBP)).toBe(17492);
  });

  it('sin SBP, 30 %', () => {
    expect(netoCents(1299, SIN_SBP)).toBe(751);
    expect(netoCents(9999, SIN_SBP)).toBe(5785);
    expect(netoCents(2999, SIN_SBP)).toBe(1735);
    expect(netoCents(29900, SIN_SBP)).toBe(17298);
    expect(netoCents(24900, SIN_SBP)).toBe(14405);
  });
});

describe('tope y porcentaje', () => {
  it('base 100 € × % del rango', () => {
    expect(topeCents(10_000, 25)).toBe(2500);
    expect(topeCents(10_000, 35)).toBe(3500);
    expect(topeCents(10_000, 50)).toBe(5000);
  });

  it('fuera del SBP, el Pro anual se limita a 35 %; el resto no', () => {
    expect(pctEfectivo(50, PRO_ANUAL, SIN_SBP)).toBe(35);
    expect(pctEfectivo(25, PRO_ANUAL, SIN_SBP)).toBe(25);
    expect(pctEfectivo(50, PRO_ANUAL, CON_SBP)).toBe(50);
    expect(pctEfectivo(50, ELITE_ANUAL, SIN_SBP)).toBe(50);
    expect(pctEfectivo(50, PRO_MENSUAL, SIN_SBP)).toBe(50);
  });
});

describe('comisión por cobro (espejo de record_sale)', () => {
  it('anual: el tope entero en el primer cobro, sea Pro o Élite', () => {
    const [pro] = simular(50, CON_SBP, [{ producto: PRO_ANUAL, precioCents: 9999 }]);
    expect(pro).toEqual({ kind: 'primer_pago', pct: 50, capCents: 5000, amountCents: 5000 });
    const [elite] = simular(25, CON_SBP, [{ producto: ELITE_ANUAL, precioCents: 29900 }]);
    expect(elite?.amountCents).toBe(2500);
  });

  it('sin SBP, un Pro anual de creador élite paga 35 € y no 50 €', () => {
    const [c] = simular(50, SIN_SBP, [{ producto: PRO_ANUAL, precioCents: 9999 }]);
    expect(c).toEqual({ kind: 'primer_pago', pct: 35, capCents: 3500, amountCents: 3500 });
    // El Élite anual no lleva ese límite.
    const [e] = simular(50, SIN_SBP, [{ producto: ELITE_ANUAL, precioCents: 29900 }]);
    expect(e?.amountCents).toBe(5000);
  });

  it('mensual: su % del neto de cada mes hasta el tope, y después nada', () => {
    const meses = Array.from({ length: 13 }, () => ({ producto: PRO_MENSUAL, precioCents: 1299 }));
    const r = simular(50, CON_SBP, meses);
    // 913 × 50 % = 456,5 → 457 (mitad hacia fuera, como Postgres).
    expect(r.slice(0, 10).every((c) => c?.kind === 'mensual' && c.amountCents === 457)).toBe(true);
    expect(r[10]?.amountCents).toBe(430); // lo que falta: 5000 − 10 × 457
    expect(r[11]).toBeNull();
    expect(r[12]).toBeNull();
    const total = r.reduce((s, c) => s + (c?.amountCents ?? 0), 0);
    expect(total).toBe(5000);
  });

  it('mensual y después anual: el anual paga lo que falte hasta el tope', () => {
    const r = simular(50, CON_SBP, [
      { producto: PRO_MENSUAL, precioCents: 1299 },
      { producto: PRO_MENSUAL, precioCents: 1299 },
      { producto: PRO_MENSUAL, precioCents: 1299 },
      { producto: PRO_ANUAL, precioCents: 9999 },
    ]);
    expect(r[3]).toEqual({ kind: 'primer_pago', pct: 50, capCents: 5000, amountCents: 5000 - 3 * 457 });
  });

  it('un cambio Pro→Élite no reinicia el tope', () => {
    const r = simular(50, CON_SBP, [
      { producto: PRO_MENSUAL, precioCents: 1299 },
      { producto: ELITE_MENSUAL, precioCents: 2999 },
      { producto: ELITE_ANUAL, precioCents: 29900 },
      { producto: ELITE_ANUAL, precioCents: 29900 },
    ]);
    expect(r[0]?.amountCents).toBe(457);
    expect(r[1]?.amountCents).toBe(1054); // 2107 × 50 % = 1053,5 → 1054
    expect(r[2]?.amountCents).toBe(5000 - 457 - 1054);
    // Renovación con el tope lleno y renewal_pct = 0: nada.
    expect(r[3]).toBeNull();
  });

  it('renovación anual con renewal_pct: % sobre la base', () => {
    const ajustes = { ...CON_SBP, renewalPct: 10 };
    const r = simular(35, ajustes, [
      { producto: PRO_ANUAL, precioCents: 9999 },
      { producto: PRO_ANUAL, precioCents: 9999 },
    ]);
    expect(r[0]?.amountCents).toBe(3500);
    expect(r[1]).toEqual({ kind: 'renovacion', pct: 10, capCents: 3500, amountCents: 1000 });
  });

  it('un reembolso anulado devuelve hueco al tope', () => {
    // record_refund deja la comisión 'anulada' y deja de contar en el acumulado.
    const acumuladoTrasReembolso = 457 * 2; // de tres mensuales, uno reembolsado
    const c = comisionCents({
      rangoPct: 50,
      producto: PRO_MENSUAL,
      netCents: 913,
      acumuladoCents: acumuladoTrasReembolso,
      ajustes: CON_SBP,
    });
    expect(c?.amountCents).toBe(457);
  });

  it('bajar de rango con el tope ya lleno no paga más', () => {
    const c = comisionCents({ rangoPct: 25, producto: PRO_MENSUAL, netCents: 913, acumuladoCents: 3000, ajustes: CON_SBP });
    expect(c).toBeNull();
  });

  it('una base propia del producto manda sobre la de los ajustes', () => {
    const c = comisionCents({
      rangoPct: 50,
      producto: { period: 'anual', commissionBaseCents: 6000 },
      netCents: 0,
      acumuladoCents: 0,
      ajustes: CON_SBP,
    });
    expect(c?.amountCents).toBe(3000);
  });
});

describe('liquidación', () => {
  it('disponible menos clawbacks; si no queda nada, no hay pago', () => {
    expect(liquidacionCents(5000, 1200)).toBe(3800);
    expect(liquidacionCents(1000, 1000)).toBeNull();
    expect(liquidacionCents(0, 0)).toBeNull();
  });
});

describe('el panel', () => {
  it('rangos en pantalla (§11.7)', () => {
    expect(rangoLabel('novato')).toBe('Creador novato');
    expect(rangoLabel('pro')).toBe('Creador pro');
    expect(rangoLabel('elite')).toBe('Creador élite');
    expect(rangoLabel('raro')).toBe('Creador novato');
  });

  it('porcentajes y línea de rango', () => {
    expect(pctLabel(35)).toBe('35 %');
    expect(pctLabel(12.5)).toBe('12,5 %');
    expect(lineaRango('pro', 35, 10_000)).toBe('Creador pro · 35 % sobre 100,00 €');
    expect(porVentaAnual(50, 10_000)).toBe('50,00 €');
  });

  it('importes y fechas de pago', () => {
    expect(importe(3500)).toBe('35,00');
    expect(importe(457)).toBe('4,57');
    expect(fechaPago('2026-09-19T12:00:00')).toBe('19 sept 2026');
    expect(fechaPago('no')).toBe('');
  });

  it('posición en el ranking del mes', () => {
    expect(lineaPosicion(1, 4, 0)).toMatch(/sin ventas/);
    expect(lineaPosicion(1, 4, 3)).toBe('Primero del mes de 4.');
    expect(lineaPosicion(2, 4, 1)).toBe('Puesto 2 de 4 este mes.');
    expect(lineaPosicion(1, 1, 1)).toBe('Primero del mes.');
  });
});
