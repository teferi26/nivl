import {
  briefDelMes,
  centimos,
  claveCategoria,
  fechaCobro,
  fijosDelMes,
  gastoPorCategoria,
  generadoHasta,
  grupoDe,
  leerImporte,
  mesDelBrief,
  mesMas,
  nuevoMovimiento,
  patasTransferencia,
  pendientesFijos,
  saldoCuenta,
  totalesFijos,
  totalesMes,
  vistaGeneral,
  type CuentaWork,
  type Fijo,
  type MovWork,
} from '../moneywork';

let n = 0;
function mov(date: string, amount: number, category = 'otros', extra: Partial<MovWork> = {}): MovWork {
  n += 1;
  return {
    id: `m${n}`,
    date,
    amount,
    category,
    counterparty: null,
    description: `mov ${n}`,
    is_internal: false,
    account_id: 'banco',
    ...extra,
  };
}

const cuenta = (id: string, opening_balance: number, opening_date = '2026-10-01', sort_order = 0): CuentaWork => ({
  id,
  name: id,
  provider: 'banco',
  currency: 'EUR',
  opening_balance,
  opening_date,
  sort_order,
  active: true,
});

const fijo = (extra: Partial<Fijo> = {}): Fijo => ({
  id: 'f1',
  account_id: 'banco',
  kind: 'gasto',
  name: 'Alquiler',
  amount: 750,
  day_of_month: 5,
  category: 'vivienda',
  user_category_id: null,
  start_date: '2026-08-01',
  end_date: null,
  active: true,
  ...extra,
});

describe('céntimos y grupos', () => {
  it('suma sin errores de coma flotante', () => {
    expect(centimos(0.1 + 0.2)).toBe(0.3);
    expect(saldoCuenta(cuenta('banco', 0.1), [mov('2026-10-02', 0.2)])).toBe(0.3);
  });
  it('las bases se agrupan en las ocho de WORK', () => {
    expect(grupoDe('super')).toBe('comida');
    expect(grupoDe('restaurante')).toBe('comida');
    expect(grupoDe('vivienda')).toBe('casa');
    expect(grupoDe('suministros')).toBe('casa');
    expect(grupoDe('formacion')).toBe('educacion');
    expect(grupoDe('impuestos')).toBe('otros');
    expect(grupoDe('sin_clasificar')).toBe('otros');
    expect(claveCategoria({ category: 'super', user_category_id: 'c9' })).toBe('u:c9');
  });
});

describe('cuentas y vista general', () => {
  it('saldo = inicial + movimientos desde la fecha de alta', () => {
    const c = cuenta('banco', 1000, '2026-10-01');
    const movs = [mov('2026-09-30', -500), mov('2026-10-01', -100), mov('2026-10-10', 50), mov('2026-10-11', -20, 'otros', { account_id: 'efectivo' })];
    expect(saldoCuenta(c, movs)).toBe(950);
  });
  it('los traspasos mueven el saldo de cada cuenta pero no el total', () => {
    const [sale, entra] = patasTransferencia({ id: 't1', origen: 'banco', destino: 'efectivo', importe: 200, fecha: '2026-10-05', concepto: 'Cajero' });
    const movs = [sale, entra].map((m, i) => ({ ...m, id: `x${i}`, counterparty: null }) as MovWork);
    const v = vistaGeneral([cuenta('banco', 1000), cuenta('efectivo', 50, '2026-10-01', 1)], movs);
    expect(v.total).toBe(1050);
    expect(v.cuentas.map((c) => [c.id, c.saldo])).toEqual([
      ['banco', 800],
      ['efectivo', 250],
    ]);
    expect(totalesMes(movs, '2026-10')).toEqual({ ingresos: 0, gastos: 0, neto: 0 });
  });
  it('orden, cuota y cuentas archivadas fuera', () => {
    const v = vistaGeneral(
      [cuenta('b', 300, '2026-10-01', 2), cuenta('a', 100, '2026-10-01', 1), { ...cuenta('z', 999), active: false }, cuenta('neg', -50, '2026-10-01', 3)],
      [],
    );
    expect(v.cuentas.map((c) => c.id)).toEqual(['a', 'b', 'neg']);
    expect(v.total).toBe(350);
    expect(v.cuentas[0]!.cuota).toBeCloseTo(0.25);
    expect(v.cuentas[2]!.cuota).toBe(0);
  });
});

describe('fijos: generación idempotente', () => {
  it('día de cobro: 31 en febrero cae el último día', () => {
    expect(fechaCobro('2026-02', 31)).toBe('2026-02-28');
    expect(fechaCobro('2028-02', 31)).toBe('2028-02-29');
    expect(fechaCobro('2026-10', 5)).toBe('2026-10-05');
    expect(mesMas('2026-01', -1)).toBe('2025-12');
    expect(mesMas('2026-12', 1)).toBe('2027-01');
  });
  it('genera cada mes desde el alta hasta hoy, con su huella y su signo', () => {
    const p = pendientesFijos([fijo()], '2026-10-21', new Set());
    expect(p.map((m) => [m.date, m.amount, m.dedup_hash])).toEqual([
      ['2026-08-05', -750, 'rec|f1|2026-08'],
      ['2026-09-05', -750, 'rec|f1|2026-09'],
      ['2026-10-05', -750, 'rec|f1|2026-10'],
    ]);
    expect(p[0]!.source).toBe('recurrente');
    expect(p[0]!.recurring_id).toBe('f1');
  });
  it('dos veces seguidas no duplica nada (lo ya guardado no vuelve a salir)', () => {
    const primera = pendientesFijos([fijo()], '2026-10-21', new Set());
    const segunda = pendientesFijos([fijo()], '2026-10-21', new Set(primera.map((m) => m.dedup_hash)));
    expect(segunda).toEqual([]);
  });
  it('nada futuro, nada antes del alta y nada tras la baja', () => {
    const sueldo = fijo({ id: 's', kind: 'ingreso', name: 'Nómina', amount: 2150, day_of_month: 28, start_date: '2026-10-10' });
    expect(pendientesFijos([sueldo], '2026-10-21', new Set())).toEqual([]);
    expect(pendientesFijos([sueldo], '2026-10-28', new Set()).map((m) => [m.date, m.amount])).toEqual([['2026-10-28', 2150]]);
    // Alta el 10 con cobro el 5: el de este mes ya pasó, empieza el mes que viene.
    expect(pendientesFijos([fijo({ start_date: '2026-10-10' })], '2026-10-21', new Set())).toEqual([]);
    const baja = fijo({ end_date: '2026-08-31' });
    expect(pendientesFijos([baja], '2026-10-21', new Set()).map((m) => m.date)).toEqual(['2026-08-05']);
    expect(pendientesFijos([fijo({ active: false })], '2026-10-21', new Set())).toEqual([]);
  });
  it('tras una ausencia larga recupera como mucho 24 meses', () => {
    const p = pendientesFijos([fijo({ start_date: '2020-01-01' })], '2026-10-21', new Set());
    expect(p).toHaveLength(24);
    expect(p[0]!.date).toBe('2024-11-05');
  });
  it('estado del mes y totales', () => {
    const f = [fijo(), fijo({ id: 'f2', name: 'Netflix', amount: 12.99, day_of_month: 15, category: 'suscripciones' }), fijo({ id: 's', kind: 'ingreso', name: 'Nómina', amount: 2150, day_of_month: 1 })];
    const movs = [mov('2026-10-05', -750, 'vivienda', { recurring_id: 'f1' }), mov('2026-09-15', -12.99, 'suscripciones', { recurring_id: 'f2' })];
    const mes = fijosDelMes(f, movs, '2026-10-12');
    expect(mes.map((x) => [x.fijo.id, x.fecha, x.hecho])).toEqual([
      ['s', '2026-10-01', false],
      ['f1', '2026-10-05', true],
      ['f2', '2026-10-15', false],
    ]);
    expect(totalesFijos(f)).toEqual({ ingresos: 2150, gastos: 762.99 });
  });
});

describe('fijos: lo borrado a mano no vuelve', () => {
  it('no genera nada hasta el último mes ya generado', () => {
    const f = fijo({ generated_through: '2026-09' });
    expect(pendientesFijos([f], '2026-10-21', new Set()).map((m) => m.date)).toEqual(['2026-10-05']);
    expect(pendientesFijos([fijo({ generated_through: '2026-10' })], '2026-10-21', new Set())).toEqual([]);
  });
  it('generado hasta: el mes en curso si su día ya llegó', () => {
    expect(generadoHasta({ day_of_month: 5 }, '2026-10-21')).toBe('2026-10');
    expect(generadoHasta({ day_of_month: 28 }, '2026-10-21')).toBe('2026-09');
    expect(generadoHasta({ day_of_month: 31 }, '2026-02-28')).toBe('2026-02');
  });
});

describe('movimientos y transferencias', () => {
  it('lee importes escritos a mano', () => {
    expect(leerImporte('12,50')).toBe(12.5);
    expect(leerImporte('1.234,56')).toBe(1234.56);
    expect(leerImporte('1,234.56')).toBe(1234.56);
    expect(leerImporte('1.500')).toBe(1500);
    expect(leerImporte('-3')).toBe(3);
    expect(leerImporte('7 €')).toBe(7);
    expect(leerImporte('0')).toBeNull();
    expect(leerImporte('abc')).toBeNull();
    expect(leerImporte('')).toBeNull();
  });
  it('un gasto sale en negativo, un ingreso en positivo, cada uno con su huella', () => {
    const g = nuevoMovimiento({ cuentaId: 'banco', tipo: 'gasto', importe: 12.5, fecha: '2026-10-21', concepto: ' Café ', categoria: 'super', categoriaPropia: null, id: 'u1' });
    expect([g.amount, g.description, g.dedup_hash, g.source]).toEqual([-12.5, 'Café', 'app|u1', 'manual']);
    const i = nuevoMovimiento({ cuentaId: 'banco', tipo: 'ingreso', importe: 40, fecha: '2026-10-21', concepto: 'Bizum', categoria: 'ingreso_otro', categoriaPropia: 'c1', id: 'u2' });
    expect([i.amount, i.user_category_id]).toEqual([40, 'c1']);
  });
  it('la transferencia son dos patas internas enlazadas', () => {
    const [a, b] = patasTransferencia({ id: 't', origen: 'banco', destino: 'revolut', importe: 300, fecha: '2026-10-21', concepto: 'Ahorro' });
    expect([a.amount, b.amount]).toEqual([-300, 300]);
    expect(a.is_internal && b.is_internal).toBe(true);
    expect(a.transfer_id).toBe('t');
    expect(b.transfer_id).toBe('t');
    expect(a.dedup_hash).not.toBe(b.dedup_hash);
    expect(() => patasTransferencia({ id: 't', origen: 'x', destino: 'x', importe: 1, fecha: '2026-10-21', concepto: '' })).toThrow('misma_cuenta');
    expect(() => patasTransferencia({ id: 't', origen: 'x', destino: 'y', importe: 0, fecha: '2026-10-21', concepto: '' })).toThrow('importe');
  });
});

describe('el mes y el brief', () => {
  const movs = [
    mov('2026-09-01', 2000, 'ingreso_nomina'),
    mov('2026-09-03', -700, 'vivienda'),
    mov('2026-09-10', -100, 'super'),
    mov('2026-09-12', -50, 'restaurante'),
    mov('2026-09-20', -300, 'ahorro'),
    mov('2026-10-01', 2000, 'ingreso_nomina'),
    mov('2026-10-03', -700, 'vivienda'),
    mov('2026-10-10', -180, 'super'),
    mov('2026-10-12', -90, 'restaurante'),
    mov('2026-10-14', -40, 'sin_clasificar'),
    mov('2026-10-15', -25, 'ocio', { user_category_id: 'c1' }),
    mov('2026-10-16', -500, 'transferencia', { is_internal: true }),
  ];
  it('gasto por categoría sin traspasos ni ahorro', () => {
    const g = gastoPorCategoria(movs, '2026-10');
    expect(g.map((l) => [l.clave, l.total])).toEqual([
      ['casa', 700],
      ['comida', 270],
      ['otros', 40],
      ['u:c1', 25],
    ]);
    expect(g.reduce((a, l) => a + l.cuota, 0)).toBeCloseTo(1);
    expect(totalesMes(movs, '2026-09')).toEqual({ ingresos: 2000, gastos: 850, neto: 1150 });
  });
  it('cifras, comparación y alertas deterministas', () => {
    const b = briefDelMes(movs, '2026-10', [{ nombre: 'Efectivo', saldo: -5 }], [fijo({ amount: 1100 })]);
    expect(b.anterior).toBe('2026-09');
    expect(b.este).toEqual({ ingresos: 2000, gastos: 1035, neto: 965 });
    expect(b.gastoDeltaPct).toBe(22);
    const comida = b.categorias.find((c) => c.clave === 'comida')!;
    expect([comida.total, comida.anterior, comida.deltaPct]).toEqual([270, 150, 80]);
    expect(b.alertas).toEqual([
      { tipo: 'categoria_sube', clave: 'comida', pct: 80, total: 270 },
      { tipo: 'fijos_pesan', pct: 55 },
      { tipo: 'cuenta_en_negativo', cuenta: 'Efectivo', saldo: -5 },
      { tipo: 'sin_clasificar', movimientos: 1, total: 40 },
    ]);
  });
  it('avisa si se gasta más de lo que entra', () => {
    const b = briefDelMes([mov('2026-10-01', 100, 'ingreso_otro'), mov('2026-10-02', -160, 'ocio')], '2026-10', [], []);
    expect(b.alertas[0]).toEqual({ tipo: 'gasta_mas_de_lo_que_entra', diferencia: 60 });
    expect(b.gastoDeltaPct).toBeNull();
  });
  it('el brief toca del mes anterior salvo desde el día 25', () => {
    expect(mesDelBrief('2026-10-21')).toBe('2026-09');
    expect(mesDelBrief('2026-10-25')).toBe('2026-10');
    expect(mesDelBrief('2026-01-03')).toBe('2025-12');
  });
});
