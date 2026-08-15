import { describe, expect, test } from '@jest/globals';
import {
  detectarSuscripciones,
  diasDelMes,
  mesesDeAire,
  mesesHastaObjetivo,
  normalizarCobrador,
  porCategoria,
  proyeccionMes,
  resumenPorMes,
  ritmoPresupuesto,
  tasaAhorro,
  type Movimiento,
} from '../moneymath';

function mov(p: Partial<Movimiento> & { date: string; amount: number }): Movimiento {
  return {
    category: p.amount >= 0 ? 'ingreso_negocio' : 'otros',
    counterparty: null,
    description: 'mov',
    is_internal: false,
    ...p,
  };
}

describe('resumenPorMes', () => {
  test('separa ingresos, gasto de consumo y lo apartado', () => {
    const [r] = resumenPorMes([
      mov({ date: '2026-08-01', amount: 3000 }),
      mov({ date: '2026-08-03', amount: -800, category: 'vivienda' }),
      mov({ date: '2026-08-05', amount: -200, category: 'super' }),
      mov({ date: '2026-08-06', amount: -500, category: 'ahorro' }),
    ]);
    expect(r!.ingresos).toBe(3000);
    expect(r!.gastos).toBe(1000);
    expect(r!.apartado).toBe(500);
    expect(r!.neto).toBe(1500);
  });

  test('los traspasos entre cuentas propias no cuentan como nada', () => {
    // El fallo clásico: mover 500 € de Revolut al banco aparece como si te
    // hubieras gastado 500 y hubieras cobrado 500 el mismo día.
    const r = resumenPorMes([
      mov({ date: '2026-08-01', amount: 2000 }),
      mov({ date: '2026-08-02', amount: -500, is_internal: true, category: 'transferencia' }),
      mov({ date: '2026-08-02', amount: 500, is_internal: true, category: 'transferencia' }),
    ]);
    expect(r[0]!.ingresos).toBe(2000);
    expect(r[0]!.gastos).toBe(0);
    expect(r[0]!.movimientos).toBe(1);
  });

  test('devuelve los meses en orden', () => {
    const r = resumenPorMes([
      mov({ date: '2026-08-01', amount: -10 }),
      mov({ date: '2026-06-01', amount: -10 }),
      mov({ date: '2026-07-01', amount: -10 }),
    ]);
    expect(r.map((x) => x.mes)).toEqual(['2026-06', '2026-07', '2026-08']);
  });
});

describe('tasaAhorro', () => {
  test('calcula el porcentaje que no se gasta', () => {
    expect(tasaAhorro(3000, 2100)).toBeCloseTo(30, 5);
  });

  test('gastar más de lo que entra da negativo, no cero', () => {
    expect(tasaAhorro(1000, 1500)).toBeCloseTo(-50, 5);
  });

  test('sin ingresos devuelve null, no 0 %', () => {
    // Un 0 % ahí se leería como "no ahorras" cuando lo que pasa es que no has
    // cobrado. Son dos diagnósticos distintos y dos órdenes distintas.
    expect(tasaAhorro(0, 800)).toBeNull();
  });
});

describe('mesesDeAire', () => {
  test('saldo entre gasto medio', () => {
    expect(mesesDeAire(6000, 2000)).toBe(3);
  });

  test('un saldo en negativo es cero meses, no meses negativos', () => {
    expect(mesesDeAire(-300, 2000)).toBe(0);
  });

  test('sin gasto medio no hay cuenta atrás', () => {
    expect(mesesDeAire(6000, 0)).toBeNull();
  });
});

describe('porCategoria', () => {
  test('agrega gastos en positivo y de mayor a menor', () => {
    const r = porCategoria([
      mov({ date: '2026-08-01', amount: -50, category: 'super' }),
      mov({ date: '2026-08-02', amount: -900, category: 'vivienda' }),
      mov({ date: '2026-08-03', amount: -70, category: 'super' }),
      mov({ date: '2026-08-04', amount: 3000, category: 'ingreso_negocio' }),
    ]);
    expect(r).toEqual([
      { categoria: 'vivienda', total: 900 },
      { categoria: 'super', total: 120 },
    ]);
  });
});

describe('normalizarCobrador', () => {
  test('junta los cargos del mismo comercio con referencia distinta', () => {
    const a = normalizarCobrador(mov({ date: '2026-08-01', amount: -12, description: 'AMZN Mktp ES*2K4L9' }));
    const b = normalizarCobrador(mov({ date: '2026-08-02', amount: -30, description: 'AMZN Mktp ES*7H1P2' }));
    expect(a).toBe(b);
    expect(a).toBe('AMZN MKTP ES');
  });

  test('prefiere la contraparte a la descripción', () => {
    const m = mov({ date: '2026-08-01', amount: -9.99, counterparty: 'Netflix', description: 'PAGO TARJETA 4455' });
    expect(normalizarCobrador(m)).toBe('NETFLIX');
  });
});

describe('detectarSuscripciones', () => {
  const tres = (nombre: string, importes: number[]) =>
    importes.map((v, i) =>
      mov({ date: `2026-0${i + 5}-14`, amount: -v, counterparty: nombre, category: 'suscripciones' }),
    );

  test('encuentra un cargo mensual estable y calcula su coste anual', () => {
    const [s] = detectarSuscripciones(tres('Netflix', [13.99, 13.99, 15.99]));
    expect(s!.cobrador).toBe('NETFLIX');
    expect(s!.meses).toBe(3);
    expect(s!.anual).toBeCloseTo(s!.importeMedio * 12, 5);
  });

  test('dos meses no bastan para llamarlo suscripción', () => {
    expect(detectarSuscripciones(tres('Spotify', [11.99, 11.99]).slice(0, 2))).toEqual([]);
  });

  test('importes dispares no son una suscripción', () => {
    // El súper aparece todos los meses y no es una cuota: sin el filtro de
    // importe, la lista de "suscripciones" se llena de compras normales.
    expect(detectarSuscripciones(tres('Mercadona', [40, 180, 95]))).toEqual([]);
  });

  test('muchos cargos al mes son un hábito, no una cuota', () => {
    const cafes: Movimiento[] = [];
    for (const mes of ['05', '06', '07']) {
      for (const dia of ['02', '09', '16']) {
        cafes.push(mov({ date: `2026-${mes}-${dia}`, amount: -3.2, counterparty: 'Cafeteria Sol' }));
      }
    }
    expect(detectarSuscripciones(cafes)).toEqual([]);
  });

  test('ordena por lo que cuesta al año', () => {
    const r = detectarSuscripciones([
      ...tres('Netflix', [13.99, 13.99, 13.99]),
      ...tres('Adobe', [60.49, 60.49, 60.49]),
    ]);
    expect(r.map((s) => s.cobrador)).toEqual(['ADOBE', 'NETFLIX']);
  });

  test('los ingresos recurrentes no son suscripciones', () => {
    const nomina = [5, 6, 7].map((m) =>
      mov({ date: `2026-0${m}-01`, amount: 2400, counterparty: 'Springmarket' }),
    );
    expect(detectarSuscripciones(nomina)).toEqual([]);
  });
});

describe('ritmoPresupuesto y proyección', () => {
  test('ir justo en el guion es 1', () => {
    expect(ritmoPresupuesto(150, 300, 15, 30)).toBeCloseTo(1, 5);
  });

  test('detecta el desborde antes de que se agote el saldo', () => {
    // Día 10 de 30 con el 40 % gastado: hoy queda dinero, pero el mes acaba en
    // 1.200 sobre un tope de 1.000. El aviso llega ahora, no el día 30.
    const r = ritmoPresupuesto(400, 1000, 10, 30)!;
    expect(r).toBeCloseTo(1.2, 5);
    expect(proyeccionMes(400, 10, 30)).toBeCloseTo(1200, 5);
  });

  test('sin tope no hay ritmo que medir', () => {
    expect(ritmoPresupuesto(100, 0, 10, 30)).toBeNull();
  });

  test('el día 0 no divide por cero', () => {
    expect(ritmoPresupuesto(100, 1000, 0, 30)).toBeCloseTo(3, 5);
  });
});

describe('diasDelMes', () => {
  test('meses de 30, 31 y febrero', () => {
    expect(diasDelMes('2026-04')).toBe(30);
    expect(diasDelMes('2026-08')).toBe(31);
    expect(diasDelMes('2026-02')).toBe(28);
    expect(diasDelMes('2028-02')).toBe(29);
  });
});

describe('mesesHastaObjetivo', () => {
  test('cuenta los meses al ritmo de ahorro actual', () => {
    expect(mesesHastaObjetivo(2000, 12000, 2500)).toBeCloseTo(4, 5);
  });

  test('objetivo ya alcanzado es cero', () => {
    expect(mesesHastaObjetivo(15000, 12000, 500)).toBe(0);
  });

  test('sin ahorro no hay fecha', () => {
    expect(mesesHastaObjetivo(2000, 12000, 0)).toBeNull();
    expect(mesesHastaObjetivo(2000, 12000, -300)).toBeNull();
  });

  test('un plan de siglos se declara inviable en vez de dar un número', () => {
    // 1.000.000 € ahorrando 10 € al mes son 8.333 años. Decirlo con decimales
    // es una forma cara de no decir que el plan no funciona.
    expect(mesesHastaObjetivo(0, 1_000_000, 10)).toBeNull();
  });
});
