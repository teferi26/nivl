import {
  diasEntre,
  estadoSemanal,
  FotoProgreso,
  HITOS_RACHA,
  lineaTemporal,
  lunesDe,
  metadatosParaCoach,
  parAntesDespues,
  pesoCercano,
  Pose,
  rachaFotosSemanal,
  semanaIso,
} from '../progressPhotos';
import { addDays } from '../dates';

let n = 0;
const foto = (fecha: string, pose: Pose, pesoKg?: number | null): FotoProgreso => ({
  id: `f${++n}`,
  fecha,
  pose,
  pesoKg,
});
const tres = (lunesOAlgo: string): FotoProgreso[] => [
  foto(lunesOAlgo, 'frente'),
  foto(lunesOAlgo, 'lado'),
  foto(lunesOAlgo, 'espalda'),
];
/** N semanas completas seguidas que terminan en la semana de `ultima`. */
const semanasCompletas = (ultima: string, cuantas: number): FotoProgreso[] =>
  Array.from({ length: cuantas }, (_, i) => tres(addDays(ultima, -7 * i))).flat();

const PROHIBIDO = /path|url|uri|progress\/|https?:|storage|bucket/i;

describe('fechas ISO', () => {
  it('el lunes de cualquier día de la semana', () => {
    expect(lunesDe('2026-09-28')).toBe('2026-09-28'); // lunes
    expect(lunesDe('2026-10-04')).toBe('2026-09-28'); // domingo
    expect(lunesDe('2026-10-01')).toBe('2026-09-28');
  });

  it('el cambio de hora (25/10/2026) no mueve la semana ni cuenta días de 23 o 25 horas', () => {
    expect(lunesDe('2026-10-25')).toBe('2026-10-19');
    expect(lunesDe('2026-10-26')).toBe('2026-10-26');
    expect(diasEntre('2026-10-24', '2026-10-26')).toBe(2);
    expect(diasEntre('2026-03-28', '2026-03-30')).toBe(2); // DST de primavera
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });

  it('2026 tiene semana 53, que cruza el año', () => {
    expect(lunesDe('2027-01-03')).toBe('2026-12-28');
    expect(semanaIso('2026-12-28')).toEqual({ anio: 2026, semana: 53 });
    expect(semanaIso('2027-01-03')).toEqual({ anio: 2026, semana: 53 });
    expect(semanaIso('2027-01-04')).toEqual({ anio: 2027, semana: 1 });
    expect(semanaIso('2026-01-01')).toEqual({ anio: 2026, semana: 1 });
    expect(semanaIso('2021-01-03')).toEqual({ anio: 2020, semana: 53 });
  });
});

describe('pesoCercano (±3 días)', () => {
  const pesos = [
    { fecha: '2026-09-01', kg: 80 },
    { fecha: '2026-09-10', kg: 79 },
  ];
  it('casa dentro de ±3 y no fuera', () => {
    expect(pesoCercano('2026-09-04', pesos)).toBe(80); // +3
    expect(pesoCercano('2026-09-07', pesos)).toBe(79); // -3
    expect(pesoCercano('2026-09-05', pesos)).toBe(null); // a 4 y 5 días: fuera
    expect(pesoCercano('2026-08-28', pesos)).toBe(null); // 4 días antes
    expect(pesoCercano('2026-09-14', pesos)).toBe(null); // 4 días después
  });
  it('a igual distancia gana el anterior', () => {
    const p = [
      { fecha: '2026-09-02', kg: 81 },
      { fecha: '2026-09-06', kg: 79 },
    ];
    expect(pesoCercano('2026-09-04', p)).toBe(81);
  });
  it('sin pesos o con pesos corruptos, null', () => {
    expect(pesoCercano('2026-09-04', [])).toBe(null);
    expect(pesoCercano('2026-09-04', [{ fecha: 'ayer', kg: 80 }, { fecha: '2026-09-04', kg: NaN }])).toBe(null);
  });
});

describe('lineaTemporal', () => {
  it('agrupa por semana ISO y pose, en orden descendente', () => {
    const fotos = [
      foto('2026-09-14', 'frente'),
      foto('2026-09-20', 'lado'), // domingo, misma semana
      foto('2026-09-21', 'espalda'), // lunes, semana siguiente
      foto('2026-09-07', 'frente'),
    ];
    const t = lineaTemporal(fotos, [], []);
    expect(t.map((s) => s.semana)).toEqual(['2026-09-21', '2026-09-14', '2026-09-07']);
    expect(t[1].fotos.map((f) => f.pose)).toEqual(['frente', 'lado']);
    expect(t[1].faltan).toEqual(['espalda']);
    expect(t[1].completa).toBe(false);
  });

  it('dos fotos de la misma pose en la semana: queda la más reciente', () => {
    const vieja = foto('2026-09-14', 'frente');
    const nueva = foto('2026-09-17', 'frente');
    const t = lineaTemporal([vieja, nueva]);
    expect(t).toHaveLength(1);
    expect(t[0].fotos).toHaveLength(1);
    expect(t[0].fotos[0].id).toBe(nueva.id);
  });

  it('el peso de la foto manda; si no hay, el registro más cercano en ±3', () => {
    const pesos = [{ fecha: '2026-09-16', kg: 78.4 }];
    const t = lineaTemporal(
      [foto('2026-09-14', 'frente', 79), foto('2026-09-14', 'lado'), foto('2026-09-10', 'espalda')],
      pesos,
    );
    const [s2, s1] = t;
    expect(s2.fotos[0]).toMatchObject({ pesoKg: 79, fuentePeso: 'foto' });
    expect(s2.fotos[1]).toMatchObject({ pesoKg: 78.4, fuentePeso: 'registro' });
    expect(s1.fotos[0]).toMatchObject({ pose: 'espalda', pesoKg: null, fuentePeso: null }); // 6 días
  });

  it('sin pesos ni nutrición no rompe: peso null y adherencia null', () => {
    const [s] = lineaTemporal([foto('2026-09-14', 'frente')]);
    expect(s.fotos[0].pesoKg).toBeNull();
    expect(s.adherencia).toBeNull();
    expect(s.diasRegistrados).toBe(0);
  });

  it('adherencia = días cumplidos / días registrados de esa semana', () => {
    const nutricion = [
      { fecha: '2026-09-13', cumplido: false }, // domingo anterior: fuera
      { fecha: '2026-09-14', cumplido: true },
      { fecha: '2026-09-15', cumplido: true },
      { fecha: '2026-09-16', cumplido: false },
      { fecha: '2026-09-20', cumplido: true }, // domingo: dentro
      { fecha: '2026-09-21', cumplido: false }, // lunes siguiente: fuera
    ];
    const [s] = lineaTemporal([foto('2026-09-17', 'lado')], [], nutricion);
    expect(s.diasRegistrados).toBe(4);
    expect(s.diasCumplidos).toBe(3);
    expect(s.adherencia).toBeCloseTo(0.75);
  });

  it('un parte de nutrición repetido el mismo día cuenta una vez (manda el último)', () => {
    const [s] = lineaTemporal(
      [foto('2026-09-17', 'lado')],
      [],
      [
        { fecha: '2026-09-15', cumplido: false },
        { fecha: '2026-09-15', cumplido: true },
      ],
    );
    expect(s.diasRegistrados).toBe(1);
    expect(s.adherencia).toBe(1);
  });

  it('semana 53: fotos del 28/12/2026 y del 03/01/2027 van juntas', () => {
    const t = lineaTemporal([foto('2026-12-28', 'frente'), foto('2027-01-03', 'lado'), foto('2027-01-04', 'espalda')]);
    expect(t.map((s) => [s.semana, s.anioIso, s.numeroIso])).toEqual([
      ['2027-01-04', 2027, 1],
      ['2026-12-28', 2026, 53],
    ]);
    expect(t[1].fotos).toHaveLength(2);
  });

  it('semana del cambio de hora: del lunes 19 al domingo 25/10 es una sola', () => {
    const t = lineaTemporal([foto('2026-10-19', 'frente'), foto('2026-10-25', 'lado'), foto('2026-10-26', 'espalda')]);
    expect(t.map((s) => s.semana)).toEqual(['2026-10-26', '2026-10-19']);
    expect(t[1].fotos.map((f) => f.fecha)).toEqual(['2026-10-19', '2026-10-25']);
  });

  it('ignora fotos con fecha o pose corruptas', () => {
    const malas = [
      { id: 'x', fecha: '2026-13-01', pose: 'frente' },
      { id: 'y', fecha: '2026-09-14', pose: 'perfil' },
    ] as unknown as FotoProgreso[];
    expect(lineaTemporal(malas)).toEqual([]);
    expect(lineaTemporal([])).toEqual([]);
  });
});

describe('parAntesDespues', () => {
  const hoy = '2026-10-02';

  it('null con una sola foto o ninguna', () => {
    expect(parAntesDespues([], 'frente', { hoy })).toBeNull();
    expect(parAntesDespues([foto('2026-09-01', 'frente')], 'frente', { hoy })).toBeNull();
  });

  it('null si las dos son del mismo día o de otra pose', () => {
    expect(parAntesDespues([foto('2026-09-01', 'frente'), foto('2026-09-01', 'frente')], 'frente', { hoy })).toBeNull();
    expect(parAntesDespues([foto('2026-07-01', 'lado'), foto('2026-09-01', 'frente')], 'frente', { hoy })).toBeNull();
  });

  it('la más reciente y la más cercana a hoy − 90', () => {
    // hoy − 90 = 2026-07-04
    const fotos = [
      foto('2026-06-01', 'frente'),
      foto('2026-07-06', 'frente'), // a 2 días del objetivo
      foto('2026-08-15', 'frente'),
      foto('2026-09-30', 'frente'),
      foto('2026-07-04', 'lado'), // otra pose
    ];
    const par = parAntesDespues(fotos, 'frente', { hoy })!;
    expect(addDays(hoy, -90)).toBe('2026-07-04');
    expect(par.antes.fecha).toBe('2026-07-06');
    expect(par.despues.fecha).toBe('2026-09-30');
    expect(par.dias).toBe(86);
    expect(par.difPesoKg).toBeNull();
  });

  it('sin pasar de la primera: si el objetivo es anterior, el antes es la primera foto', () => {
    const par = parAntesDespues(
      [foto('2026-09-01', 'frente'), foto('2026-09-15', 'frente'), foto('2026-09-30', 'frente')],
      'frente',
      { hoy, dias: 365 },
    )!;
    expect(par.antes.fecha).toBe('2026-09-01');
    expect(par.dias).toBe(29);
  });

  it('dias personalizado y empate de distancia: gana la más antigua', () => {
    // hoy − 30 = 2026-09-02; 08-31 y 09-04 están a 2 días
    const par = parAntesDespues(
      [foto('2026-08-31', 'lado'), foto('2026-09-04', 'lado'), foto('2026-10-01', 'lado')],
      'lado',
      { hoy, dias: 30 },
    )!;
    expect(par.antes.fecha).toBe('2026-08-31');
  });

  it('ignora fotos posteriores a hoy', () => {
    const par = parAntesDespues(
      [foto('2026-07-01', 'frente'), foto('2026-09-01', 'frente'), foto('2026-12-01', 'frente')],
      'frente',
      { hoy },
    )!;
    expect(par.despues.fecha).toBe('2026-09-01');
  });

  it('diferencia de peso con el peso de la foto o el registro en ±3', () => {
    const par = parAntesDespues(
      [foto('2026-07-04', 'espalda', 84.2), foto('2026-09-30', 'espalda')],
      'espalda',
      { hoy, pesos: [{ fecha: '2026-10-02', kg: 80.1 }] },
    )!;
    expect(par.antes.pesoKg).toBe(84.2);
    expect(par.despues).toMatchObject({ pesoKg: 80.1, fuentePeso: 'registro' });
    expect(par.difPesoKg).toBe(-4.1);
  });

  it('si falta un peso, la diferencia es null', () => {
    const par = parAntesDespues(
      [foto('2026-07-04', 'espalda', 84.2), foto('2026-09-30', 'espalda')],
      'espalda',
      { hoy, pesos: [{ fecha: '2026-09-20', kg: 80 }] }, // 10 días: fuera
    )!;
    expect(par.difPesoKg).toBeNull();
  });

  it('cruza el cambio de hora sin perder ni ganar un día', () => {
    const par = parAntesDespues([foto('2026-10-24', 'frente'), foto('2026-10-26', 'frente')], 'frente', {
      hoy: '2026-10-26',
      dias: 2,
    })!;
    expect(par.dias).toBe(2);
  });
});

describe('estadoSemanal', () => {
  it('semana vacía, entre semana: faltan las tres y no se avisa', () => {
    const e = estadoSemanal([], '2026-09-30');
    expect(e).toEqual({
      semana: '2026-09-28',
      hechas: [],
      faltan: ['frente', 'lado', 'espalda'],
      completa: false,
      recordar: false,
      claveAviso: null,
    });
  });

  it('domingo incompleto: un aviso con clave de la semana', () => {
    const e = estadoSemanal([foto('2026-09-28', 'frente')], '2026-10-04');
    expect(e.faltan).toEqual(['lado', 'espalda']);
    expect(e.recordar).toBe(true);
    expect(e.claveAviso).toBe('fotos-progreso:2026-09-28');
  });

  it('domingo completo: nada', () => {
    const e = estadoSemanal(tres('2026-09-29'), '2026-10-04');
    expect(e.completa).toBe(true);
    expect(e.recordar).toBe(false);
    expect(e.claveAviso).toBeNull();
  });

  it('las fotos de la semana anterior no cuentan (límite domingo/lunes)', () => {
    const e = estadoSemanal(tres('2026-09-27'), '2026-09-28');
    expect(e.hechas).toEqual([]);
  });

  it('el domingo del cambio de hora es domingo', () => {
    const e = estadoSemanal([], '2026-10-25');
    expect(e.semana).toBe('2026-10-19');
    expect(e.recordar).toBe(true);
  });

  it('semana 53: el domingo 03/01/2027 ve las fotos del 28/12/2026', () => {
    const e = estadoSemanal([foto('2026-12-28', 'frente'), foto('2026-12-31', 'lado')], '2027-01-03');
    expect(e.semana).toBe('2026-12-28');
    expect(e.faltan).toEqual(['espalda']);
    expect(e.claveAviso).toBe('fotos-progreso:2026-12-28');
  });
});

describe('rachaFotosSemanal', () => {
  it('sin fotos: cero y el primer hito es 4', () => {
    expect(rachaFotosSemanal([], '2026-10-02')).toEqual({
      semanas: 0,
      actualCompleta: false,
      mejor: 0,
      hitos: [],
      siguienteHito: 4,
    });
  });

  it('la semana en curso incompleta no rompe la racha', () => {
    const fotos = [...semanasCompletas('2026-09-21', 3), foto('2026-09-28', 'frente')];
    const r = rachaFotosSemanal(fotos, '2026-10-02');
    expect(r.semanas).toBe(3);
    expect(r.actualCompleta).toBe(false);
  });

  it('la semana en curso completa suma', () => {
    const r = rachaFotosSemanal(semanasCompletas('2026-09-28', 4), '2026-10-02');
    expect(r.semanas).toBe(4);
    expect(r.actualCompleta).toBe(true);
    expect(r.hitos).toEqual([4]);
    expect(r.siguienteHito).toBe(12);
  });

  it('una semana pasada sin las tres poses corta la racha, pero el mejor se conserva', () => {
    const fotos = [
      ...semanasCompletas('2026-08-31', 5), // 5 seguidas hasta el 31/08
      foto('2026-09-07', 'frente'), // semana rota
      ...semanasCompletas('2026-09-21', 2),
    ];
    const r = rachaFotosSemanal(fotos, '2026-10-02');
    expect(r.semanas).toBe(2);
    expect(r.mejor).toBe(5);
    expect(r.hitos).toEqual([4]);
    expect(r.siguienteHito).toBe(4);
  });

  it('una semana completa a mitad de semana (poses en días distintos) cuenta', () => {
    const fotos = [foto('2026-09-21', 'frente'), foto('2026-09-24', 'lado'), foto('2026-09-27', 'espalda')];
    expect(rachaFotosSemanal(fotos, '2026-09-28').semanas).toBe(1);
  });

  it('cruza la semana 53 y el cambio de año sin cortarse', () => {
    const r = rachaFotosSemanal(semanasCompletas('2027-01-11', 4), '2027-01-12');
    // 2026-12-21, 2026-12-28 (S53), 2027-01-04, 2027-01-11
    expect(r.semanas).toBe(4);
  });

  it('cruza el cambio de hora sin cortarse', () => {
    const r = rachaFotosSemanal(semanasCompletas('2026-11-02', 3), '2026-11-03');
    expect(r.semanas).toBe(3); // 19/10, 26/10, 02/11
  });

  it('52 semanas: los tres hitos y ninguno siguiente', () => {
    const r = rachaFotosSemanal(semanasCompletas('2026-09-28', 52), '2026-10-04');
    expect(r.semanas).toBe(52);
    expect(r.hitos).toEqual([...HITOS_RACHA]);
    expect(r.siguienteHito).toBeNull();
  });

  it('fotos del futuro no cuentan', () => {
    const r = rachaFotosSemanal(tres('2026-10-10'), '2026-10-02');
    expect(r.semanas).toBe(0);
    expect(r.mejor).toBe(0);
  });

  it('no devuelve XP ni nada parecido', () => {
    const r = rachaFotosSemanal(semanasCompletas('2026-09-28', 12), '2026-10-02');
    expect(Object.keys(r).sort()).toEqual(['actualCompleta', 'hitos', 'mejor', 'semanas', 'siguienteHito']);
    expect(JSON.stringify(r)).not.toMatch(/xp/i);
  });
});

describe('metadatosParaCoach', () => {
  it('solo fecha, pose y peso; más reciente primero', () => {
    const m = metadatosParaCoach(
      [foto('2026-09-01', 'lado'), foto('2026-09-14', 'espalda', 79.5), foto('2026-09-14', 'frente')],
      [{ fecha: '2026-09-12', kg: 80 }],
    );
    expect(m).toEqual([
      { fecha: '2026-09-14', pose: 'frente', pesoKg: 80 },
      { fecha: '2026-09-14', pose: 'espalda', pesoKg: 79.5 },
      { fecha: '2026-09-01', pose: 'lado', pesoKg: null },
    ]);
    for (const x of m) expect(Object.keys(x).sort()).toEqual(['fecha', 'pesoKg', 'pose']);
  });

  it('sin pesos funciona', () => {
    expect(metadatosParaCoach([foto('2026-09-01', 'lado')])).toEqual([
      { fecha: '2026-09-01', pose: 'lado', pesoKg: null },
    ]);
  });
});

describe('ninguna función devuelve rutas ni URL', () => {
  // La capa de datos podría pasar la fila entera: path, url firmada, user_id.
  const filas = [
    { id: 'a1', fecha: '2026-07-04', pose: 'frente', pesoKg: 82, path: 'uid-123/uuid-abc', url: 'https://x.supabase.co/storage/v1/object/sign/progress/uid-123/uuid-abc', user_id: 'uid-123' },
    { id: 'a2', fecha: '2026-09-28', pose: 'frente', path: 'uid-123/uuid-def', signedUrl: 'https://x/progress/uid-123/uuid-def' },
    { id: 'a3', fecha: '2026-09-29', pose: 'lado', path: 'uid-123/uuid-ghi' },
    { id: 'a4', fecha: '2026-09-30', pose: 'espalda', path: 'uid-123/uuid-jkl' },
  ] as unknown as FotoProgreso[];
  const hoy = '2026-10-04';
  const salidas: [string, unknown][] = [
    ['lineaTemporal', lineaTemporal(filas, [{ fecha: '2026-09-29', kg: 80 }], [{ fecha: '2026-09-29', cumplido: true }])],
    ['parAntesDespues', parAntesDespues(filas, 'frente', { hoy })],
    ['estadoSemanal', estadoSemanal(filas, hoy)],
    ['rachaFotosSemanal', rachaFotosSemanal(filas, hoy)],
    ['metadatosParaCoach', metadatosParaCoach(filas, [])],
  ];

  it.each(salidas)('%s', (_nombre, salida) => {
    expect(salida).not.toBeNull();
    const json = JSON.stringify(salida);
    expect(json).not.toMatch(PROHIBIDO);
    expect(json).not.toContain('uid-123');
    expect(json).not.toContain('uuid-');
  });

  it('el coach tampoco recibe el id', () => {
    expect(JSON.stringify(metadatosParaCoach(filas))).not.toMatch(/"id"|a1|a2/);
  });
});
