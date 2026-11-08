import {
  DISTANCIAS,
  faseDeSemana,
  generarPlan,
  semanaActual,
  sesionesDeHoy,
  type DistanciasPrueba,
  type PlanCarrera,
  type SemanaPlan,
  type TipoPrueba,
} from '../planCarrera';

// 2026-03-02 es lunes; 83 días después, 2026-05-24, domingo: doce semanas justas
// que además cruzan el cambio de hora del 29 de marzo.
const HOY = '2026-03-02';
const OLIMPICO = '2026-05-24';

const plan = (
  tipo: TipoPrueba,
  fecha_prueba: string,
  extra: Partial<{ hoy: string; horas_semana: number; nivel: 'principiante' | 'intermedio' | 'avanzado'; distancias: DistanciasPrueba }> = {},
): PlanCarrera => generarPlan({ tipo, fecha_prueba, hoy: HOY, horas_semana: 8, nivel: 'intermedio', ...extra });

const olimpico = plan('olimpico', OLIMPICO);
const de = (s: SemanaPlan, d: string) => s.sesiones.filter((x) => x.disciplina === d);
const ultima = (p: PlanCarrera) => {
  const s = p.semanas[p.semanas.length - 1]!;
  return s.sesiones[s.sesiones.length - 1]!;
};

describe('DISTANCIAS', () => {
  it('las de cada prueba', () => {
    expect(DISTANCIAS.sprint).toEqual({ natacion_m: 750, bici_m: 20000, carrera_m: 5000 });
    expect(DISTANCIAS.olimpico).toEqual({ natacion_m: 1500, bici_m: 40000, carrera_m: 10000 });
    expect(DISTANCIAS.medio).toEqual({ natacion_m: 1900, bici_m: 90000, carrera_m: 21100 });
    expect(DISTANCIAS.ironman).toEqual({ natacion_m: 3800, bici_m: 180000, carrera_m: 42200 });
    expect(DISTANCIAS.maraton).toEqual({ natacion_m: 0, bici_m: 0, carrera_m: 42200 });
  });
});

describe('faseDeSemana', () => {
  it('doce semanas: 4 de base, 4 de construcción, 2 de pico, afinado y carrera', () => {
    const fases = Array.from({ length: 12 }, (_, i) => faseDeSemana(i + 1, 12));
    expect(fases).toEqual([
      'base', 'base', 'base', 'base',
      'construccion', 'construccion', 'construccion', 'construccion',
      'pico', 'pico',
      'afinado',
      'carrera',
    ]);
  });

  it('la última semana siempre es la de carrera', () => {
    for (const total of [1, 2, 3, 6, 20, 52]) expect(faseDeSemana(total, total)).toBe('carrera');
  });

  it('nunca retrocede de fase', () => {
    const orden = ['base', 'construccion', 'pico', 'afinado', 'carrera'];
    for (let total = 1; total <= 52; total++) {
      const f = Array.from({ length: total }, (_, i) => orden.indexOf(faseDeSemana(i + 1, total)));
      expect(f).toEqual(f.slice().sort((a, b) => a - b));
    }
  });
});

describe('plan de olímpico a doce semanas', () => {
  it('tiene doce semanas desde el lunes de hoy, sin aviso', () => {
    expect(olimpico.semanas).toHaveLength(12);
    expect(olimpico.aviso).toBeNull();
    expect(olimpico.fecha).toBe(OLIMPICO);
    expect(olimpico.semanas.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(olimpico.semanas[0]!.lunes).toBe(HOY);
  });

  it('los lunes siguen siéndolo a través del cambio de hora', () => {
    expect(olimpico.semanas.map((s) => s.lunes)).toEqual([
      '2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23', '2026-03-30', '2026-04-06',
      '2026-04-13', '2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18',
    ]);
  });

  it('cada sesión cae en el día de la semana que dice', () => {
    for (const s of olimpico.semanas) {
      for (const x of s.sesiones) {
        const diaUtc = new Date(`${x.fecha}T00:00:00Z`).getUTCDay();
        expect(x.dia).toBe(diaUtc === 0 ? 7 : diaUtc);
        expect(x.semana).toBe(s.n);
      }
    }
  });

  it('las fases son las de la tabla', () => {
    expect(olimpico.semanas.map((s) => s.fase)).toEqual([
      'base', 'base', 'base', 'base',
      'construccion', 'construccion', 'construccion', 'construccion',
      'pico', 'pico',
      'afinado',
      'carrera',
    ]);
  });

  it('descarga las semanas 4 y 8, un 30 % sobre la anterior', () => {
    expect(olimpico.semanas.filter((s) => s.descarga).map((s) => s.n)).toEqual([4, 8]);
    for (const n of [4, 8]) {
      const ratio = olimpico.semanas[n - 1]!.horas / olimpico.semanas[n - 2]!.horas;
      expect(ratio).toBeGreaterThan(0.64);
      expect(ratio).toBeLessThan(0.76);
    }
  });

  it('el volumen sube menos del 10 % semana a semana, sin contar la vuelta de la descarga', () => {
    const carga = olimpico.semanas.filter((s) => !s.descarga && ['base', 'construccion', 'pico'].includes(s.fase));
    for (let i = 1; i < carga.length; i++) {
      expect(carga[i]!.horas / carga[i - 1]!.horas).toBeLessThanOrEqual(1.1);
    }
  });

  it('llega al pico con las horas pedidas y no las supera', () => {
    expect(Math.max(...olimpico.semanas.map((s) => s.horas))).toBeLessThanOrEqual(8.2);
    expect(olimpico.semanas[9]!.horas).toBeGreaterThanOrEqual(7.5);
  });

  it('brick semanal desde construcción y ninguno antes', () => {
    for (const n of [1, 2, 3, 4]) expect(de(olimpico.semanas[n - 1]!, 'brick')).toHaveLength(0);
    for (const n of [5, 6, 7, 8, 9, 10, 11]) expect(de(olimpico.semanas[n - 1]!, 'brick')).toHaveLength(1);
  });

  it('transiciones solo en pico', () => {
    const conTransicion = olimpico.semanas.filter((s) => de(s, 'transicion').length > 0).map((s) => s.n);
    expect(conTransicion).toEqual([9, 10]);
  });

  it('entrena las tres disciplinas', () => {
    for (const s of olimpico.semanas.slice(0, 11)) {
      expect(de(s, 'natacion').length).toBeGreaterThan(0);
      expect(de(s, 'carrera').length).toBeGreaterThan(0);
      expect(de(s, 'bici').length + de(s, 'brick').length).toBeGreaterThan(0);
    }
  });

  it('80/20: la calidad no pasa del 20 % del tiempo', () => {
    for (const s of olimpico.semanas.slice(0, 11)) {
      const total = s.sesiones.reduce((a, x) => a + x.duracion_min, 0);
      const duro = s.sesiones.filter((x) => ['Z3', 'Z4', 'Z5'].includes(x.zona ?? '')).reduce((a, x) => a + x.duracion_min, 0);
      expect(duro / total).toBeLessThanOrEqual(0.2);
    }
  });

  it('sin calidad en base ni en descarga', () => {
    for (const n of [1, 2, 3, 4, 8]) {
      expect(olimpico.semanas[n - 1]!.sesiones.some((x) => ['Z3', 'Z4', 'Z5'].includes(x.zona ?? ''))).toBe(false);
    }
  });

  it('el último día es el Día de carrera, con la disciplina carrera y el detalle de la prueba', () => {
    const fin = ultima(olimpico);
    expect(fin.fecha).toBe(OLIMPICO);
    expect(fin.titulo).toBe('Día de carrera');
    expect(fin.disciplina).toBe('carrera');
    expect(fin.clave).toBe(true);
    expect(fin.zona).toBeNull();
    expect(fin.detalle).toContain('1500 m de natación, 40 km de bici y 10 km de carrera');
    // 1500 m a 2:05/100 (31,25) + 40 km a 27 (88,9) + 10 km a 5:45 (57,5) + 8 = 185,6.
    expect(fin.duracion_min).toBe(185);
  });

  it('la semana de la carrera no acumula: solo activación y descanso', () => {
    const s = olimpico.semanas[11]!;
    expect(s.horas).toBeLessThan(3);
    expect(s.sesiones.map((x) => x.dia)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(s.sesiones[5]!.titulo).toBe('Activación');
    expect(s.sesiones[4]!.disciplina).toBe('descanso');
  });

  it('ningún texto lleva guion largo', () => {
    const textos = olimpico.semanas.flatMap((s) => s.sesiones.flatMap((x) => [x.titulo, x.detalle]));
    for (const t of textos) expect(t).not.toMatch(/[—–]/);
  });

  it('es determinista', () => {
    expect(plan('olimpico', OLIMPICO)).toEqual(olimpico);
  });
});

describe('plazo corto', () => {
  const corto = plan('olimpico', '2026-03-22');

  it('tres semanas: comprimido, con aviso y acabando en carrera', () => {
    expect(corto.semanas.map((s) => s.fase)).toEqual(['construccion', 'afinado', 'carrera']);
    expect(corto.aviso).toMatch(/comprimido/);
    expect(corto.aviso).not.toMatch(/[—–]/);
    expect(ultima(corto).titulo).toBe('Día de carrera');
    expect(ultima(corto).fecha).toBe('2026-03-22');
  });

  it('el borde: seis semanas de lunes a domingo no avisan; una menos, sí', () => {
    expect(plan('olimpico', '2026-04-12').aviso).toBeNull();
    expect(plan('olimpico', '2026-04-12', { hoy: '2026-03-03' }).aviso).not.toBeNull();
  });

  it('hoy mismo: solo el día de la carrera', () => {
    const hoyMismo = plan('sprint', HOY);
    expect(hoyMismo.semanas).toHaveLength(1);
    expect(hoyMismo.semanas[0]!.sesiones.map((s) => s.titulo)).toEqual(['Día de carrera']);
  });

  it('una fecha pasada o imposible: plan vacío y aviso', () => {
    expect(plan('sprint', '2026-03-01').semanas).toEqual([]);
    expect(plan('sprint', '2026-03-01').aviso).not.toBeNull();
    expect(plan('sprint', '2026-02-31').semanas).toEqual([]);
  });
});

describe('carreras a pie', () => {
  for (const tipo of ['5k', '10k', 'media', 'maraton'] as const) {
    const p = plan(tipo, OLIMPICO);

    it(`${tipo}: sin natación, sin bici, sin brick ni transición; con fuerza`, () => {
      const todas = p.semanas.flatMap((s) => s.sesiones);
      for (const d of ['natacion', 'bici', 'brick', 'transicion']) {
        expect(todas.filter((x) => x.disciplina === d)).toHaveLength(0);
      }
      expect(todas.filter((x) => x.disciplina === 'fuerza').length).toBeGreaterThan(0);
      expect(ultima(p).titulo).toBe('Día de carrera');
      expect(ultima(p).disciplina).toBe('carrera');
    });

    it(`${tipo}: la tirada larga no pasa del 35 % de la semana`, () => {
      for (const s of p.semanas) {
        const larga = s.sesiones.find((x) => x.titulo === 'Tirada larga');
        if (!larga) continue;
        const total = s.sesiones.reduce((a, x) => a + x.duracion_min, 0);
        expect(larga.duracion_min / total).toBeLessThanOrEqual(0.36);
      }
    });
  }

  it('la tirada de un 5K tiene tope aunque sobren horas', () => {
    const p = plan('5k', OLIMPICO, { horas_semana: 20 });
    const largas = p.semanas.flatMap((s) => s.sesiones).filter((x) => x.titulo === 'Tirada larga');
    expect(Math.max(...largas.map((x) => x.duracion_min))).toBeLessThanOrEqual(75);
  });
});

describe('afinado por prueba', () => {
  const afinadas = (p: PlanCarrera) => p.semanas.filter((s) => s.fase === 'afinado').length;
  // 2026-08-30 es domingo: 26 semanas desde HOY.
  const FECHA_LARGA = '2026-08-30';

  it('sprint 1 semana, ironman 3', () => {
    expect(afinadas(plan('sprint', FECHA_LARGA))).toBe(1);
    expect(afinadas(plan('ironman', FECHA_LARGA))).toBe(3);
  });

  it('el afinado baja progresivamente', () => {
    const h = plan('ironman', FECHA_LARGA).semanas.filter((s) => s.fase === 'afinado').map((s) => s.horas);
    expect(h[0]!).toBeGreaterThan(h[1]!);
    expect(h[1]!).toBeGreaterThan(h[2]!);
  });

  it('en plan corto el afinado cede', () => {
    expect(afinadas(plan('ironman', '2026-03-22'))).toBe(1);
  });
});

describe('fechas y bordes', () => {
  it('máximo 52 semanas: recorta el inicio y termina en la carrera', () => {
    const p = plan('ironman', '2028-05-28');
    expect(p.semanas).toHaveLength(52);
    expect(p.semanas[0]!.fase).toBe('base');
    expect(ultima(p).fecha).toBe('2028-05-28');
    expect(p.aviso).toBeNull();
  });

  it('empezando un jueves no planifica los días ya pasados', () => {
    const p = plan('olimpico', OLIMPICO, { hoy: '2026-03-05' });
    expect(p.semanas[0]!.lunes).toBe('2026-03-02');
    expect(p.semanas[0]!.sesiones.every((s) => s.fecha >= '2026-03-05')).toBe(true);
    expect(p.semanas[0]!.sesiones[0]!.dia).toBe(4);
  });

  it('una carrera en martes no deja una tirada larga el domingo anterior', () => {
    const p = plan('10k', '2026-05-26');
    const domingo = p.semanas.flatMap((s) => s.sesiones).find((s) => s.fecha === '2026-05-24')!;
    expect(domingo.titulo).not.toBe('Tirada larga');
    expect(domingo.duracion_min).toBeLessThanOrEqual(30);
    expect(ultima(p).dia).toBe(2);
    expect(p.semanas[p.semanas.length - 1]!.sesiones.map((s) => s.fecha)).toEqual(['2026-05-25', '2026-05-26']);
  });

  it('otra con distancias propias: reparte solo en lo que hay', () => {
    const p = plan('otra', OLIMPICO, { distancias: { natacion_m: 0, bici_m: 100000, carrera_m: 0 } });
    const todas = p.semanas.flatMap((s) => s.sesiones);
    expect(todas.filter((s) => s.disciplina === 'natacion')).toHaveLength(0);
    expect(todas.filter((s) => s.disciplina === 'brick')).toHaveLength(0);
    expect(todas.filter((s) => s.disciplina === 'bici').length).toBeGreaterThan(0);
    expect(ultima(p).disciplina).toBe('carrera');
    expect(ultima(p).detalle).toContain('100 km de bici');
  });

  it('otra sin distancias se trata como una carrera a pie', () => {
    const p = plan('otra', OLIMPICO);
    expect(p.semanas.flatMap((s) => s.sesiones).some((s) => s.disciplina === 'natacion')).toBe(false);
  });

  it('con pocas horas o principiante hay menos sesiones', () => {
    const contar = (p: PlanCarrera) => p.semanas[0]!.sesiones.filter((s) => s.disciplina !== 'descanso').length;
    expect(contar(olimpico)).toBe(6);
    expect(contar(plan('olimpico', OLIMPICO, { nivel: 'principiante' }))).toBe(5);
    expect(contar(plan('olimpico', OLIMPICO, { horas_semana: 3 }))).toBe(4);
  });

  it('principiante hace la calidad en Z3 y avanzado llega a Z5 en pico', () => {
    const zonas = (p: PlanCarrera, n: number) => p.semanas[n - 1]!.sesiones.map((s) => s.zona);
    expect(zonas(plan('olimpico', OLIMPICO, { nivel: 'principiante' }), 5)).toContain('Z3');
    expect(zonas(plan('olimpico', OLIMPICO, { nivel: 'principiante' }), 5)).not.toContain('Z4');
    expect(zonas(plan('olimpico', OLIMPICO, { nivel: 'avanzado' }), 9)).toContain('Z5');
  });

  it('el volumen nunca sube más de un 10 %, con cualquier dedicación', () => {
    for (const tipo of ['sprint', 'olimpico', 'medio', 'ironman', '10k', 'maraton'] as const) {
      for (const horas_semana of [5, 6, 7, 8, 9, 10, 12, 15]) {
        const p = plan(tipo, '2026-08-30', { horas_semana });
        const carga = p.semanas.filter((s) => !s.descarga && ['base', 'construccion', 'pico'].includes(s.fase));
        for (let i = 1; i < carga.length; i++) {
          expect(carga[i]!.horas / carga[i - 1]!.horas).toBeLessThanOrEqual(1.1);
        }
      }
    }
  });
});

describe('semanaActual y sesionesDeHoy', () => {
  it('encuentra la semana por sus extremos', () => {
    expect(semanaActual(olimpico, '2026-03-02')!.n).toBe(1);
    expect(semanaActual(olimpico, '2026-03-08')!.n).toBe(1);
    expect(semanaActual(olimpico, '2026-03-09')!.n).toBe(2);
    expect(semanaActual(olimpico, '2026-05-24')!.n).toBe(12);
  });

  it('fuera del plan, null', () => {
    expect(semanaActual(olimpico, '2026-03-01')).toBeNull();
    expect(semanaActual(olimpico, '2026-05-25')).toBeNull();
    expect(semanaActual(olimpico, 'mañana')).toBeNull();
  });

  it('las sesiones de hoy son las de esa fecha', () => {
    const martes = sesionesDeHoy(olimpico, '2026-03-03');
    expect(martes).toHaveLength(1);
    expect(martes[0]!.disciplina).toBe('natacion');
    expect(sesionesDeHoy(olimpico, OLIMPICO)[0]!.titulo).toBe('Día de carrera');
    expect(sesionesDeHoy(olimpico, '2027-01-01')).toEqual([]);
  });

  it('en pico un día puede tener dos sesiones', () => {
    const viernes = olimpico.semanas[8]!.sesiones.filter((s) => s.dia === 5);
    expect(viernes.map((s) => s.disciplina).sort()).toEqual(['natacion', 'transicion']);
  });
});

describe('80/20 sobre el total real', () => {
  const pruebas = ['sprint', 'olimpico', 'medio', 'ironman', '5k', '10k', 'media', 'maraton'] as const;
  const niveles = ['principiante', 'intermedio', 'avanzado'] as const;
  it('ninguna semana pasa del 20 % de calidad ni de 75 min por sesión', () => {
    for (const tipo of pruebas) {
      for (const nivel of niveles) {
        for (const horas_semana of [2, 3, 4, 6, 8, 10, 14, 20, 30]) {
          const p = generarPlan({ tipo, fecha_prueba: '2027-03-08', hoy: '2026-11-08', horas_semana, nivel });
          for (const s of p.semanas) {
            if (s.fase === 'carrera') continue;
            const fuertes = s.sesiones.filter((x) => x.zona === 'Z3' || x.zona === 'Z4' || x.zona === 'Z5');
            const total = s.sesiones.reduce((a, x) => a + x.duracion_min, 0);
            const q = fuertes.reduce((a, x) => a + x.duracion_min, 0);
            expect(fuertes.every((x) => x.duracion_min <= 75)).toBe(true);
            if (total > 0) expect(q / total).toBeLessThanOrEqual(0.2);
          }
        }
      }
    }
  });
});
