import type { Duelo, FilaTablero } from '@/lib/competicionData';
import {
  datosRival,
  detalleResuelto,
  diasRestantes,
  etiquetaDuelo,
  faltanDatos,
  lineaDuelo,
  nombreRival,
  ordenarTablero,
  quienVaDelante,
  repartirDuelos,
  RIVAL_OCULTO,
  rivalOculto,
  semanaCerrada,
  textoQuedan,
  textoRitmo,
  type DueloAmpliado,
} from '../competicionVista';

const duelo = (p: Partial<Duelo>): Duelo => ({
  id: 'd',
  soy_retador: true,
  rival: 'Gladiador 1',
  week_start: '2026-09-28',
  status: 'accepted',
  mi_indice: 70,
  su_indice: 70,
  mis_dias: 0,
  sus_dias: 0,
  resultado: null,
  ...p,
});

describe('diasRestantes', () => {
  it('cuenta hoy incluido, de lunes a domingo', () => {
    expect(diasRestantes('2026-09-28', '2026-09-28')).toBe(7);
    expect(diasRestantes('2026-09-28', '2026-10-02')).toBe(3);
    expect(diasRestantes('2026-09-28', '2026-10-04')).toBe(1);
    expect(diasRestantes('2026-09-28', '2026-10-05')).toBe(0);
  });
  it('con fechas raras no inventa días', () => {
    expect(diasRestantes('x', '2026-10-02')).toBe(0);
  });
});

describe('quienVaDelante', () => {
  it('manda el índice y desempatan los días', () => {
    expect(quienVaDelante({ mi_indice: 80, su_indice: 75, mis_dias: 1, sus_dias: 5 })).toBe('yo');
    expect(quienVaDelante({ mi_indice: 70, su_indice: 70, mis_dias: 2, sus_dias: 3 })).toBe('rival');
    expect(quienVaDelante({ mi_indice: 70, su_indice: 70, mis_dias: 3, sus_dias: 3 })).toBe('empate');
  });
});

describe('repartirDuelos', () => {
  const hoy = '2026-10-02';
  it('separa por estado y descarta anulados, rechazados y retos caducados', () => {
    const v = repartirDuelos(
      [
        duelo({ id: 'a' }),
        duelo({ id: 'b', status: 'pending', soy_retador: false }),
        duelo({ id: 'c', status: 'pending' }),
        duelo({ id: 'd', status: 'declined' }),
        duelo({ id: 'e', status: 'cancelled' }),
        duelo({ id: 'f', status: 'pending', week_start: '2026-09-21' }),
        duelo({ id: 'g', status: 'done', week_start: '2026-09-21', resultado: 'gano' }),
      ],
      hoy,
    );
    expect(v.activos.map((d) => d.id)).toEqual(['a']);
    expect(v.porResponder.map((d) => d.id)).toEqual(['b']);
    expect(v.enviados.map((d) => d.id)).toEqual(['c']);
    expect(v.resueltos.map((d) => d.id)).toEqual(['g']);
  });
});

describe('rival oculto (0055: lo del rival llega null)', () => {
  const hoy = '2026-10-02';
  const oculto = (p: Partial<DueloAmpliado> = {}): DueloAmpliado => ({
    ...duelo({}),
    rival: null,
    su_indice: null,
    sus_dias: null,
    mi_suficiente: true,
    su_suficiente: null,
    semana_cerrada: false,
    ...p,
  });

  it('el nombre visible es «Rival oculto» y no hay datos que pintar', () => {
    expect(nombreRival(oculto())).toBe(RIVAL_OCULTO);
    expect(nombreRival(oculto({ rival: '  ' }))).toBe(RIVAL_OCULTO);
    expect(nombreRival(duelo({}))).toBe('Gladiador 1');
    expect(datosRival(oculto())).toBeNull();
    expect(rivalOculto(oculto())).toBe(true);
    expect(datosRival(duelo({ su_indice: 64, sus_dias: 3 }))).toEqual({ nombre: 'Gladiador 1', indice: 64, dias: 3 });
  });

  it('basta un campo null para que el rival quede oculto', () => {
    expect(rivalOculto(oculto({ rival: 'Marta', sus_dias: 2 }))).toBe(true);
    expect(rivalOculto(oculto({ rival: 'Marta', su_indice: 60 }))).toBe(true);
    expect(rivalOculto(oculto({ su_indice: 60, sus_dias: 2 }))).toBe(true);
    expect(rivalOculto(oculto({ rival: 'Marta', su_indice: 60, sus_dias: 2 }))).toBe(false);
  });

  it('quienVaDelante con null devuelve el caso sin datos', () => {
    expect(quienVaDelante({ mi_indice: 80, su_indice: null, mis_dias: 3, sus_dias: null })).toBe('sin_datos');
    expect(quienVaDelante({ mi_indice: 80, su_indice: 10, mis_dias: 3, sus_dias: null })).toBe('sin_datos');
    expect(quienVaDelante({ mi_indice: 80, su_indice: null, mis_dias: 3, sus_dias: 1 })).toBe('sin_datos');
  });

  it('lineaDuelo no dice quién va delante ni nombra a nadie', () => {
    expect(faltanDatos(oculto())).toBe(true);
    expect(lineaDuelo(oculto({ mi_indice: 99 }))).toBe('Aún sin datos suficientes');
    // Con nombre pero sin cifras tampoco.
    expect(lineaDuelo(oculto({ rival: 'Marta', mi_indice: 99 }))).toBe('Aún sin datos suficientes');
    // Con cifras pero sin nombre (servidor anterior, bloqueo) tampoco.
    expect(lineaDuelo(oculto({ su_indice: 10, sus_dias: 0 }))).toBe('Aún sin datos suficientes');
  });

  it('detalleResuelto con null va como «-», con o sin revancha', () => {
    expect(detalleResuelto(oculto({ resultado: 'gano', status: 'done' }), false)).toBe('Semana pasada · - frente a -');
    expect(detalleResuelto(oculto({ resultado: 'pierdo', status: 'done' }), true)).toBe(
      'Semana pasada · - frente a - · Perdiste',
    );
  });

  it('la etiqueta accesible no anuncia nada del rival', () => {
    const t = etiquetaDuelo(oculto({ mi_indice: 72 }), 3);
    expect(t).toBe('Duelo con Rival oculto, quedan 3 días. Tu disciplina 72. Sin datos del rival.');
    expect(t).not.toMatch(/delante|la suya/);
    expect(etiquetaDuelo(duelo({ mi_indice: 80, su_indice: 60 }), 1)).toBe(
      'Duelo con Gladiador 1, último día. Tu disciplina 80, la suya 60. Vas delante.',
    );
  });

  it('el duelo con rival oculto no desaparece; el reto recibido de alguien oculto sí', () => {
    const v = repartirDuelos(
      [
        oculto({ id: 'a' }),
        oculto({ id: 'b', status: 'pending', soy_retador: false }),
        oculto({ id: 'c', status: 'pending', soy_retador: true }),
        oculto({ id: 'r', status: 'done', week_start: '2026-09-21', resultado: 'pierdo' }),
        oculto({ id: 'x', status: 'cancelled' }),
      ],
      hoy,
    );
    expect(v.activos.map((d) => d.id)).toEqual(['a']);
    expect(v.porResponder).toEqual([]);
    expect(v.enviados.map((d) => d.id)).toEqual(['c']);
    expect(v.resueltos.map((d) => d.id)).toEqual(['r']);
  });
});

describe('lineaDuelo', () => {
  it('sin los campos de mínimo, dice quién va delante como antes', () => {
    expect(lineaDuelo(duelo({ mi_indice: 80, su_indice: 60 }))).toBe('Vas delante');
    expect(lineaDuelo(duelo({ mi_indice: 60, su_indice: 80 }))).toBe('Gladiador 1 va delante');
    expect(lineaDuelo(duelo({}))).toBe('Vais empatados');
  });
  it('si a alguno le faltan datos, no dice quién va delante', () => {
    const a: DueloAmpliado = { ...duelo({ mi_indice: 80, su_indice: 60 }), su_suficiente: false, mi_suficiente: true };
    expect(lineaDuelo(a)).toBe('Aún sin datos suficientes');
    const b: DueloAmpliado = { ...duelo({ mi_indice: 60, su_indice: 80 }), mi_suficiente: false, su_suficiente: true };
    expect(lineaDuelo(b)).toBe('Aún sin datos suficientes');
    const c: DueloAmpliado = { ...duelo({ mi_indice: 80, su_indice: 60 }), mi_suficiente: true, su_suficiente: true };
    expect(lineaDuelo(c)).toBe('Vas delante');
  });
});

describe('semana cerrada sin resultado', () => {
  it('sin semana_cerrada: el lunes el duelo de la semana pasada queda «resolviendo»', () => {
    const lunes = '2026-10-05';
    const d = duelo({ id: 'z', week_start: '2026-09-28' });
    expect(semanaCerrada(d, lunes)).toBe(true);
    const v = repartirDuelos([d], lunes);
    expect(v.activos).toEqual([]);
    expect(v.cerrados.map((x) => x.id)).toEqual(['z']);
  });
  it('con semana_cerrada manda el servidor', () => {
    const abierta: DueloAmpliado = { ...duelo({ id: 'a' }), semana_cerrada: false };
    const cerrada: DueloAmpliado = { ...duelo({ id: 'c' }), semana_cerrada: true };
    const v = repartirDuelos([abierta, cerrada], '2026-10-05');
    expect(v.activos.map((x) => x.id)).toEqual(['a']);
    expect(v.cerrados.map((x) => x.id)).toEqual(['c']);
  });
  it('con resultado ya no está cerrado: está resuelto', () => {
    const v = repartirDuelos([duelo({ id: 'r', status: 'done', resultado: 'empate' })], '2026-10-05');
    expect(v.cerrados).toEqual([]);
    expect(v.resueltos.map((x) => x.id)).toEqual(['r']);
  });
});

describe('detalleResuelto', () => {
  it('sin datos: índices como «-» y el resultado no se repite', () => {
    const d = duelo({ mi_indice: 70, su_indice: 64, resultado: 'sin_datos' });
    expect(detalleResuelto(d, false)).toBe('Semana pasada · - frente a -');
  });
  it('el resultado va en el detalle solo si la revancha ocupa la derecha', () => {
    const d = duelo({ mi_indice: 60, su_indice: 64, resultado: 'pierdo' });
    expect(detalleResuelto(d, true)).toBe('Semana pasada · 60 frente a 64 · Perdiste');
    expect(detalleResuelto(d, false)).toBe('Semana pasada · 60 frente a 64');
  });
});

describe('textoRitmo', () => {
  it('dos decimales con coma: 1,15 y 1,10 ya no salen iguales', () => {
    expect(textoRitmo(1.25)).toBe('×1,25');
    expect(textoRitmo(1.15)).not.toBe(textoRitmo(1.1));
    expect(textoRitmo(1.1)).toBe('×1,10');
    expect(textoRitmo(Number.NaN)).toBe('×0,00');
  });
});

describe('ordenarTablero', () => {
  const fila = (p: Partial<FilaTablero>): FilaTablero => ({
    es_yo: false,
    alias: 'x',
    retrato: null,
    indice: 70,
    velocidad: 1,
    dias_activos: 3,
    sin_datos: false,
    ...p,
  });
  it('ordena, comparte puesto en empate y deja sin datos al final con puesto 0', () => {
    const t = ordenarTablero([
      fila({ alias: 'c', sin_datos: true, indice: 99 }),
      fila({ alias: 'a', indice: 80 }),
      fila({ alias: 'b', indice: 90 }),
      fila({ alias: 'd', indice: 80 }),
    ]);
    expect(t.map((f) => [f.alias, f.puesto])).toEqual([
      ['b', 1],
      ['a', 2],
      ['d', 2],
      ['c', 0],
    ]);
  });
});

describe('textoQuedan', () => {
  it('habla claro del último día', () => {
    expect(textoQuedan(1)).toBe('último día');
    expect(textoQuedan(4)).toBe('quedan 4 días');
  });
});
