import { mejorVentana, puntuarHora, type ContextoSalida, type HoraClima } from '../mejorHora';

const DIA = '2026-06-10';
const hhmm = (h: number) => `${DIA}T${String(h).padStart(2, '0')}:00`;

/** Una hora perfecta: sin nada que restar. */
function hora(h: number, extra: Partial<HoraClima> = {}): HoraClima {
  return {
    hora: hhmm(h),
    temp: 18,
    sensacion: 18,
    lluvia_prob: 0,
    lluvia_mm: 0,
    viento_kmh: 5,
    racha_kmh: 10,
    uv: 2,
    codigo: 0,
    es_de_dia: true,
    ...extra,
  };
}

const dia = (peores: Record<number, Partial<HoraClima>> = {}, desde = 6, hasta = 21) =>
  Array.from({ length: hasta - desde + 1 }, (_, i) => hora(desde + i, peores[desde + i]));

const ctx = (extra: Partial<ContextoSalida> = {}): ContextoSalida => ({
  disciplina: 'carrera',
  duracion_min: 60,
  estado_forma: 'optimo',
  sueno_h: 8,
  fatiga: 2,
  dolor: false,
  franjas_ocupadas: [],
  desde: '06:00',
  hasta: '22:00',
  ...extra,
});

describe('puntuarHora', () => {
  it('una hora perfecta vale 100', () => {
    expect(puntuarHora(hora(10), 'carrera')).toEqual({ puntos: 100, motivos: ['buen_tiempo'], peligro: false });
  });

  it.each([95, 96, 99])('la tormenta %d es peligro y vale 0', (codigo) => {
    const r = puntuarHora(hora(10, { codigo }), 'carrera');
    expect(r.peligro).toBe(true);
    expect(r.puntos).toBe(0);
    expect(r.motivos).toContain('tormenta');
  });

  it('el calor por encima de 32 y el frío bajo -5 son peligro; el borde exacto no', () => {
    expect(puntuarHora(hora(10, { sensacion: 32.5 }), 'carrera').peligro).toBe(true);
    expect(puntuarHora(hora(10, { sensacion: 32 }), 'carrera').peligro).toBe(false);
    expect(puntuarHora(hora(10, { sensacion: -5.5 }), 'carrera').peligro).toBe(true);
    expect(puntuarHora(hora(10, { sensacion: -5 }), 'carrera').peligro).toBe(false);
  });

  it('el calor resta a mano: 30 de sensación son 16 puntos', () => {
    expect(puntuarHora(hora(10, { sensacion: 30 }), 'carrera').puntos).toBe(84);
  });

  it('sin sensación usa la temperatura', () => {
    expect(puntuarHora(hora(10, { sensacion: null, temp: 33 }), 'carrera').peligro).toBe(true);
  });

  it('el viento fuerte es peligro en bici y no corriendo', () => {
    expect(puntuarHora(hora(10, { viento_kmh: 50 }), 'bici').peligro).toBe(true);
    expect(puntuarHora(hora(10, { viento_kmh: 49, racha_kmh: 70 }), 'bici').peligro).toBe(true);
    expect(puntuarHora(hora(10, { viento_kmh: 30 }), 'bici').puntos).toBe(75);
    expect(puntuarHora(hora(10, { viento_kmh: 50 }), 'carrera')).toMatchObject({ peligro: false, puntos: 85 });
  });

  it('la noche resta más en bici y mucho más en aguas abiertas', () => {
    expect(puntuarHora(hora(23, { es_de_dia: false }), 'carrera').puntos).toBe(80);
    expect(puntuarHora(hora(23, { es_de_dia: false }), 'bici').puntos).toBe(65);
    expect(puntuarHora(hora(23, { es_de_dia: false }), 'aguas_abiertas').puntos).toBe(30);
  });

  it('el UV resta de día', () => {
    expect(puntuarHora(hora(13, { uv: 9 }), 'carrera')).toMatchObject({ puntos: 90, motivos: ['uv'] });
    expect(puntuarHora(hora(13, { uv: 6 }), 'carrera').puntos).toBe(95);
  });

  it('la lluvia resta acumulada', () => {
    expect(puntuarHora(hora(10, { lluvia_prob: 80, lluvia_mm: 3 }), 'carrera').puntos).toBe(55);
    expect(puntuarHora(hora(10, { lluvia_prob: 50 }), 'carrera').puntos).toBe(90);
  });

  it('nunca baja de 0 ni un dato ausente penaliza', () => {
    const horrible = hora(23, { sensacion: 31, lluvia_prob: 90, lluvia_mm: 10, viento_kmh: 49, es_de_dia: false, uv: 10, codigo: 75 });
    expect(puntuarHora(horrible, 'bici').puntos).toBeGreaterThanOrEqual(0);
    const vacia = puntuarHora(
      { hora: hhmm(10), temp: null, sensacion: null, lluvia_prob: null, lluvia_mm: null, viento_kmh: null, racha_kmh: null, uv: null, codigo: null, es_de_dia: null },
      'carrera',
    );
    expect(vacia.puntos).toBe(100);
  });
});

describe('mejorVentana', () => {
  it('con todo igual elige la primera hora que encaja', () => {
    const v = mejorVentana(dia(), ctx());
    expect(v.tipo).toBe('salir');
    if (v.tipo !== 'salir') return;
    expect(v.ventana.inicio).toBe(hhmm(6));
    expect(v.ventana.fin).toBe(hhmm(7));
    expect(v.ventana.puntuacion).toBe(100);
    expect(v.ventana.motivos).toEqual(['buen_tiempo']);
    expect(v.ventana.clima).toEqual({ temp: 18, lluvia_prob: 0, viento_kmh: 5 });
  });

  it('la tormenta saca de la ventana todas las horas que toca', () => {
    // Noventa minutos ocupan dos horas: con tormenta a las 9, ni las 8 ni las 9.
    const horas = [8, 9, 10, 11, 12].map((h) => hora(h, h === 9 ? { codigo: 95 } : { lluvia_prob: h === 10 ? 0 : 50 }));
    const v = mejorVentana(horas, ctx({ duracion_min: 90 }));
    expect(v.tipo).toBe('salir');
    if (v.tipo !== 'salir') return;
    expect(v.ventana.inicio).toBe(hhmm(10));
    expect(v.ventana.fin).toBe(`${DIA}T11:30`);
    // Horas 10 (100) y 11 (90): media 95, peor 90 → (95 + 90) / 2 = 92,5 → 93.
    expect(v.ventana.puntuacion).toBe(93);
  });

  it('tormenta todo el día: sin ventana por clima', () => {
    const horas = Array.from({ length: 16 }, (_, i) => hora(6 + i, { codigo: 96 }));
    expect(mejorVentana(horas, ctx())).toEqual({ tipo: 'sin_ventana', motivo: 'clima' });
  });

  it('una nota de menos de 40 tampoco se recomienda', () => {
    const horas = [hora(10, { es_de_dia: false })];
    expect(mejorVentana(horas, ctx({ disciplina: 'aguas_abiertas' }))).toEqual({ tipo: 'sin_ventana', motivo: 'clima' });
  });

  describe('dolor', () => {
    it('con dolor es descanso aunque el día sea perfecto', () => {
      expect(mejorVentana(dia(), ctx({ dolor: true }))).toEqual({ tipo: 'descanso', motivo: 'dolor' });
    });

    it('el dolor gana a cualquier otra condición y nunca recomienda salir', () => {
      for (const estado_forma of ['fresco', 'optimo', 'riesgo']) {
        for (const sueno_h of [null, 3, 9]) {
          for (const horas of [dia(), [], dia({ 8: { codigo: 96 } })]) {
            expect(mejorVentana(horas, ctx({ dolor: true, estado_forma, sueno_h }))).toEqual({ tipo: 'descanso', motivo: 'dolor' });
          }
        }
      }
    });
  });

  describe('franjas ocupadas y horario', () => {
    it('salta la franja ocupada', () => {
      const v = mejorVentana(dia(), ctx({ desde: '09:00', franjas_ocupadas: [{ desde: '08:30', hasta: '13:15' }] }));
      expect(v.tipo).toBe('salir');
      if (v.tipo === 'salir') expect(v.ventana.inicio).toBe(hhmm(14));
    });

    it('la ventana puede acabar justo cuando empieza lo ocupado', () => {
      const v = mejorVentana(dia(), ctx({ desde: '07:00', franjas_ocupadas: [{ desde: '08:00', hasta: '09:00' }] }));
      if (v.tipo !== 'salir') throw new Error('debía salir');
      expect(v.ventana.inicio).toBe(hhmm(7));
    });

    it('todo ocupado: sin ventana por horario', () => {
      expect(mejorVentana(dia(), ctx({ franjas_ocupadas: [{ desde: '00:00', hasta: '23:59' }] }))).toEqual({
        tipo: 'sin_ventana',
        motivo: 'horario',
      });
    });

    it('respeta desde y hasta, y una duración que no cabe no encaja', () => {
      const v = mejorVentana(dia(), ctx({ desde: '10:30', hasta: '12:00' }));
      if (v.tipo !== 'salir') throw new Error('debía salir');
      expect(v.ventana.inicio).toBe(hhmm(11));
      expect(mejorVentana(dia(), ctx({ desde: '10:00', hasta: '11:00', duracion_min: 90 }))).toEqual({
        tipo: 'sin_ventana',
        motivo: 'horario',
      });
    });

    it('sin previsión o con horario imposible: sin ventana por horario', () => {
      expect(mejorVentana([], ctx())).toEqual({ tipo: 'sin_ventana', motivo: 'horario' });
      expect(mejorVentana(dia(), ctx({ desde: 'pronto' }))).toEqual({ tipo: 'sin_ventana', motivo: 'horario' });
    });

    it('un hueco en la previsión no se salta', () => {
      const v = mejorVentana([hora(8), hora(10)], ctx({ duracion_min: 120 }));
      expect(v).toEqual({ tipo: 'sin_ventana', motivo: 'horario' });
    });

    it('solo mira el primer día recibido', () => {
      const manana: HoraClima = { ...hora(10), hora: '2026-06-11T10:00' };
      const v = mejorVentana([hora(21, { codigo: 96 }), manana], ctx());
      expect(v).toEqual({ tipo: 'sin_ventana', motivo: 'clima' });
    });

    it('da igual el orden en que lleguen las horas', () => {
      const v = mejorVentana(dia().reverse(), ctx());
      if (v.tipo !== 'salir') throw new Error('debía salir');
      expect(v.ventana.inicio).toBe(hhmm(6));
    });
  });

  describe('la forma y el cuerpo', () => {
    it('forma en riesgo: suave, con ventana', () => {
      const v = mejorVentana(dia(), ctx({ estado_forma: 'riesgo' }));
      expect(v.tipo).toBe('suave');
      if (v.tipo === 'suave') {
        expect(v.motivo).toBe('forma_riesgo');
        expect(v.ventana.inicio).toBe(hhmm(6));
      }
    });

    it('riesgo y además poco sueño o agotamiento: descanso', () => {
      expect(mejorVentana(dia(), ctx({ estado_forma: 'riesgo', sueno_h: 4.5 }))).toEqual({ tipo: 'descanso', motivo: 'riesgo' });
      expect(mejorVentana(dia(), ctx({ estado_forma: 'riesgo', fatiga: 5 }))).toEqual({ tipo: 'descanso', motivo: 'riesgo' });
    });

    it('sueño por debajo de 5: suave; por debajo de 4: descanso; 5 justo, normal', () => {
      const v = mejorVentana(dia(), ctx({ sueno_h: 4.9 }));
      expect(v.tipo).toBe('suave');
      if (v.tipo === 'suave') expect(v.motivo).toBe('poco_sueno');
      expect(mejorVentana(dia(), ctx({ sueno_h: 3.9 }))).toEqual({ tipo: 'descanso', motivo: 'sueno' });
      expect(mejorVentana(dia(), ctx({ sueno_h: 5 })).tipo).toBe('salir');
    });

    it('sin dato de sueño no penaliza', () => {
      expect(mejorVentana(dia(), ctx({ sueno_h: null })).tipo).toBe('salir');
      expect(mejorVentana(dia(), ctx({ sueno_h: null, fatiga: null })).tipo).toBe('salir');
    });

    it('fatiga alta: suave', () => {
      const v = mejorVentana(dia(), ctx({ fatiga: 4 }));
      expect(v.tipo).toBe('suave');
      if (v.tipo === 'suave') expect(v.motivo).toBe('fatiga');
    });

    it('suave con el clima imposible sigue sin ventana', () => {
      const horas = Array.from({ length: 16 }, (_, i) => hora(6 + i, { codigo: 96 }));
      expect(mejorVentana(horas, ctx({ estado_forma: 'riesgo' }))).toEqual({ tipo: 'sin_ventana', motivo: 'clima' });
    });
  });

  describe('alternativas', () => {
    it('hasta dos y sin solaparse con la elegida ni entre ellas', () => {
      const horas = dia({ 6: { uv: 6 }, 7: { uv: 6 }, 8: { uv: 6 } });
      const v = mejorVentana(horas, ctx({ duracion_min: 120 }));
      if (v.tipo !== 'salir') throw new Error('debía salir');
      expect(v.ventana.inicio).toBe(hhmm(9));
      expect(v.alternativas.map((a) => a.inicio)).toEqual([hhmm(11), hhmm(13)]);
    });

    it('la peor hora de la ventana pesa', () => {
      // A las 11, lluvia (-25) y lluvia fuerte (-20): 55. Ventana de las 10: media 77,5,
      // peor 55 → 66,25 → 66. La de las 12 está limpia y gana; la de las 10 queda de alternativa.
      const horas = [10, 11, 12, 13].map((h) => hora(h, h === 11 ? { lluvia_prob: 90, lluvia_mm: 5 } : {}));
      const v = mejorVentana(horas, ctx({ duracion_min: 120 }));
      if (v.tipo !== 'salir') throw new Error('debía salir');
      expect(v.ventana.inicio).toBe(hhmm(12));
      expect(v.alternativas.map((x) => [x.inicio, x.puntuacion])).toEqual([[hhmm(10), 66]]);
    });
  });
});
