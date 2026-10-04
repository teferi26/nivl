import {
  AJUSTES_POR_DEFECTO,
  codigoValido,
  comisionCents,
  enlaceCreador,
  factorOferta,
  estadoReto,
  fechaPago,
  importe,
  lineaPosicion,
  lineaRango,
  liquidacionCents,
  mensajeInvitacionCreador,
  motivoReferral,
  NOTA_OFERTA_SIN_REFERENCIA,
  netoCents,
  normalizarCodigo,
  pctEfectivo,
  pctLabel,
  porVentaAnual,
  progresoRango,
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

  it('el enlace es https://nivl.app/c/CODIGO (dominio de marca; AASA /c/* lo cierra Chat 1)', () => {
    expect(enlaceCreador(' pepe ')).toBe('https://nivl.app/c/PEPE');
  });

  it('el mensaje lleva el código y el enlace universal, sin esquema nivl://', () => {
    const m = mensajeInvitacionCreador('pepe');
    expect(m).toContain('PEPE');
    expect(m).toContain('https://nivl.app/c/PEPE');
    expect(m).not.toContain('nivl://');
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

describe('oferta rebajada: comisión proporcional (propuesta 1.0.9)', () => {
  it('sin oferta el factor es 1, aunque el precio regional sea menor', () => {
    expect(factorOferta({ currency: 'USD', precioCents: 16075, catalogoCents: 29900 })).toEqual({ factor: 1, nota: null });
    expect(factorOferta({ currency: 'EUR', precioCents: 14950, catalogoCents: 29900, periodType: 'NORMAL' })).toEqual({
      factor: 1,
      nota: null,
    });
  });

  it('oferta en EUR: pagado / catálogo, con tope 1', () => {
    expect(factorOferta({ offerCode: 'winback_50', currency: 'EUR', precioCents: 14950, catalogoCents: 29900 }).factor).toBe(0.5);
    expect(factorOferta({ periodType: 'INTRO', currency: 'EUR', precioCents: 650, catalogoCents: 1300 }).factor).toBe(0.5);
    expect(factorOferta({ periodType: 'PROMOTIONAL', currency: 'EUR', precioCents: 35000, catalogoCents: 29900 }).factor).toBe(1);
  });

  it('oferta sin referencia (otra moneda o sin catálogo): completa y con nota', () => {
    expect(factorOferta({ offerCode: 'x', currency: 'USD', precioCents: 16075, catalogoCents: 29900 })).toEqual({
      factor: 1,
      nota: NOTA_OFERTA_SIN_REFERENCIA,
    });
    expect(factorOferta({ offerCode: 'x', currency: 'EUR', precioCents: 10000, catalogoCents: null }).nota).toBe(
      NOTA_OFERTA_SIN_REFERENCIA,
    );
  });

  it('anual con oferta al 50 %: la mitad del tope; completo, el tope', () => {
    const base = { rangoPct: 50, producto: ELITE_ANUAL, netCents: 0, acumuladoCents: 0, ajustes: CON_SBP };
    expect(comisionCents({ ...base, factorPrecio: 0.5 })?.amountCents).toBe(2500);
    expect(comisionCents(base)?.amountCents).toBe(5000);
    // Pro anual a 49,995 €: 0,49995 × 5000 = 2499,75 → 2500.
    expect(comisionCents({ ...base, producto: PRO_ANUAL, factorPrecio: 4999.5 / 9999 })?.amountCents).toBe(2500);
  });

  it('anual con oferta y hueco menor: no pasa de lo que falta', () => {
    const c = comisionCents({ rangoPct: 50, producto: ELITE_ANUAL, netCents: 0, acumuladoCents: 4000, ajustes: CON_SBP, factorPrecio: 0.5 });
    expect(c?.amountCents).toBe(1000);
  });

  it('mensual: el factor no se aplica dos veces (ya es % del neto cobrado)', () => {
    const c = comisionCents({
      rangoPct: 50,
      producto: PRO_MENSUAL,
      netCents: netoCents(650, CON_SBP),
      acumuladoCents: 0,
      ajustes: CON_SBP,
      factorPrecio: 0.5,
    });
    expect(c?.amountCents).toBe(redondear(netoCents(650, CON_SBP) * 0.5));
  });

  it('renovación con renewal_pct y oferta al 50 %: la mitad', () => {
    const c = comisionCents({
      rangoPct: 50,
      producto: ELITE_ANUAL,
      netCents: 0,
      acumuladoCents: 5000,
      ajustes: { ...CON_SBP, renewalPct: 10 },
      factorPrecio: 0.5,
    });
    expect(c).toEqual({ kind: 'renovacion', pct: 10, capCents: 5000, amountCents: 500 });
  });

  it('un factor fuera de rango se recorta a 0–1', () => {
    const base = { rangoPct: 50, producto: ELITE_ANUAL, netCents: 0, acumuladoCents: 0, ajustes: CON_SBP };
    expect(comisionCents({ ...base, factorPrecio: 3 })?.amountCents).toBe(5000);
    expect(comisionCents({ ...base, factorPrecio: -1 })).toBeNull();
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

describe('progreso de rango (solo propone)', () => {
  const REGLAS = [
    { rank: 'pro' as const, minSales90d: 5, minMonthsActive: 2 },
    { rank: 'elite' as const, minSales90d: 20 },
  ];

  it('sin reglas: novato y sin siguiente', () => {
    expect(progresoRango(50, [])).toEqual({ merecido: 'novato', siguiente: null, umbral: null, faltan: null, fraccion: 1 });
  });

  it('cuenta lo que falta hasta el siguiente umbral', () => {
    expect(progresoRango(3, REGLAS, 2)).toEqual({ merecido: 'novato', siguiente: 'pro', umbral: 5, faltan: 2, fraccion: 0.6 });
  });

  it('el umbral de meses también cuenta', () => {
    expect(progresoRango(6, REGLAS, 1).merecido).toBe('novato');
    expect(progresoRango(6, REGLAS, 2)).toMatchObject({ merecido: 'pro', siguiente: 'elite', faltan: 14 });
  });

  it('élite: sin siguiente', () => {
    expect(progresoRango(25, REGLAS, 3)).toMatchObject({ merecido: 'elite', siguiente: null, fraccion: 1 });
  });

  it('salta un rango sin regla y descarta reglas raras', () => {
    const raras = [{ rank: 'dios' as never, minSales90d: 1 }, { rank: 'elite' as const, minSales90d: Number.NaN }];
    expect(progresoRango(9, [...raras, { rank: 'elite' as const, minSales90d: 10 }])).toMatchObject({ siguiente: 'elite', faltan: 1 });
    expect(progresoRango(-4, REGLAS).faltan).toBe(5);
  });
});

describe('estado de un reto', () => {
  const t0 = Date.parse('2026-10-10T12:00:00Z');
  const RETO = { startsAt: '2026-10-05T00:00:00Z', endsAt: '2026-10-15T00:00:00Z', goalSales: 3 };

  it('próximo, activo, cumplido y terminado', () => {
    expect(estadoReto(RETO, 0, Date.parse('2026-10-03T00:00:00Z'))).toMatchObject({ fase: 'proximo', dias: 2 });
    expect(estadoReto(RETO, 1, t0)).toEqual({
      fase: 'activo', fraccion: 1 / 3, faltan: 2, dias: 5, linea: '1 venta de 3. Quedan 5 días.',
    });
    expect(estadoReto(RETO, 3, t0)).toMatchObject({ fase: 'cumplido', fraccion: 1, faltan: 0 });
    expect(estadoReto(RETO, 4, Date.parse('2026-11-01T00:00:00Z')).fase).toBe('cumplido');
    expect(estadoReto(RETO, 2, new Date('2026-11-01T00:00:00Z'))).toMatchObject({ fase: 'terminado', dias: 0, faltan: 1 });
  });

  it('fechas inválidas nunca cuentan como activo', () => {
    expect(estadoReto({ startsAt: 'x', endsAt: 'y', goalSales: 2 }, 0, t0).fase).toBe('terminado');
    expect(estadoReto({ ...RETO, endsAt: RETO.startsAt }, 0, t0).fase).toBe('terminado');
  });
});
