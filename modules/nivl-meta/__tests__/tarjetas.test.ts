import {
  acotarTarjeta,
  LIMITES,
  MAX_LINEAS,
  recortar,
  tarjetaCardio,
  tarjetaEstudio,
  tarjetaMision,
  tarjetaSerie,
} from '../src/tarjetas';
import type { Tarjeta } from '../src/tipos';

const RAYA = /[\u2014\u2013]/;
const textos = (t: Tarjeta) => t.lineas.map((l) => l.texto);

function cumpleLimites(t: Tarjeta) {
  expect(t.lineas.length).toBeLessThanOrEqual(MAX_LINEAS);
  for (const l of t.lineas) {
    expect(Array.from(l.texto).length).toBeLessThanOrEqual(LIMITES[l.estilo]);
    expect(l.texto).not.toMatch(RAYA);
  }
  expect(Array.from(t.hablado).length).toBeLessThanOrEqual(LIMITES.hablado);
  expect(t.hablado).not.toMatch(RAYA);
  expect(t.hablado).not.toContain('\u2026');
}

describe('recortar', () => {
  it('deja intacto lo que cabe y aprieta los espacios', () => {
    expect(recortar('  Press   banca ', 20)).toBe('Press banca');
  });

  it('corta por palabras y no deja un conector colgando', () => {
    expect(recortar('Repasar el tema de la semana pasada', 22)).toBe('Repasar el tema\u2026');
  });

  it('parte la palabra si no hay otra forma', () => {
    const r = recortar('Electroencefalografista', 10);
    expect(Array.from(r)).toHaveLength(10);
    expect(r.endsWith('\u2026')).toBe(true);
  });

  it('no parte un emoji', () => {
    expect(recortar('\u{1F4AA}\u{1F4AA}\u{1F4AA}\u{1F4AA}', 3)).toBe('\u{1F4AA}\u{1F4AA}\u2026');
  });

  it('quita las rayas de lo que escribió otro', () => {
    expect(recortar('Gym \u2014 pierna', 30)).not.toMatch(RAYA);
    expect(recortar('Series 8\u201312', 30)).toBe('Series 8-12');
  });
});

describe('tarjetaSerie', () => {
  const base = {
    ejercicio: 'Press banca',
    serie: 2,
    totalSeries: 4,
    kilos: 62.5,
    repeticiones: '8',
    descansoSeg: 90,
  };

  it('dice ejercicio, posición, carga y descanso', () => {
    const t = tarjetaSerie(base);
    expect(textos(t)).toEqual(['Press banca', '62,5 kg x 8', 'Serie 2 de 4 \u00b7 Descanso 1:30']);
    expect(t.lineas.map((l) => l.estilo)).toEqual(['heading', 'body', 'meta']);
    expect(t.boton).toEqual({ id: 'hecho', texto: 'Hecho' });
    expect(t.hablado).toBe(
      'Press banca. Serie 2 de 4. 62,5 kilos por 8 repeticiones. Descansa 1 minuto 30 segundos.',
    );
  });

  it('lee los rangos de repeticiones de la prescripción', () => {
    const t = tarjetaSerie({ ...base, repeticiones: '8-12' });
    expect(textos(t)[1]).toBe('62,5 kg x 8-12');
    expect(t.hablado).toContain('8 a 12 repeticiones');
  });

  it('peso corporal: sin kilos', () => {
    for (const kilos of [null, 0]) {
      const t = tarjetaSerie({ ...base, kilos, repeticiones: 12 });
      expect(textos(t)[1]).toBe('12 reps');
      expect(t.hablado).not.toContain('kilos');
    }
  });

  it('sin carga ni repeticiones no inventa nada', () => {
    expect(textos(tarjetaSerie({ ...base, kilos: null, repeticiones: null }))[1]).toBe(
      'Sin carga fijada',
    );
  });

  it('descanso corto en segundos y sin descanso no lo nombra', () => {
    expect(textos(tarjetaSerie({ ...base, descansoSeg: 45 }))[2]).toContain('Descanso 45 s');
    expect(textos(tarjetaSerie({ ...base, descansoSeg: null }))[2]).toBe('Serie 2 de 4');
  });
});

describe('tarjetaCardio', () => {
  const base = { ritmoActualSegKm: 342, ritmoObjetivoSegKm: 330, distanciaKm: 6.24 };

  it('compara con el objetivo y da la distancia', () => {
    const t = tarjetaCardio(base);
    expect(textos(t)).toEqual(['5:42 /km', 'Objetivo 5:30 \u00b7 12 s lento', 'Cardio \u00b7 6,2 km']);
    expect(t.boton).toBeNull();
    expect(t.hablado).toContain('Vas 12 segundos más lento');
    expect(t.hablado).toContain('6,2 kilómetros');
  });

  it('más rápido y dentro de la tolerancia', () => {
    expect(textos(tarjetaCardio({ ...base, ritmoActualSegKm: 320 }))[1]).toContain('10 s rápido');
    expect(textos(tarjetaCardio({ ...base, ritmoActualSegKm: 332 }))[1]).toContain('En ritmo');
  });

  it('59,7 segundos no se pinta como 5:60', () => {
    expect(textos(tarjetaCardio({ ...base, ritmoActualSegKm: 359.7 }))[0]).toBe('6:00 /km');
  });

  it('sin datos no pinta ceros ni NaN', () => {
    const t = tarjetaCardio({
      ritmoActualSegKm: null,
      ritmoObjetivoSegKm: Number.NaN,
      distanciaKm: 0,
    });
    expect(textos(t)).toEqual(['Sin ritmo aún', 'Sin objetivo', 'Cardio']);
    expect(t.hablado).toBe('Sin ritmo aún.');
  });

  it('un kilómetro en singular', () => {
    expect(tarjetaCardio({ ...base, distanciaKm: 1 }).hablado).toContain('1 kilómetro.');
  });
});

describe('tarjetaMision', () => {
  const pendientes = [
    { id: 'a', titulo: 'Leer 20 páginas' },
    { id: 'b', titulo: 'Ir al gym' },
    { id: 'c', titulo: 'Hacer la cama' },
  ];

  it('la siguiente pendiente y cuántas quedan', () => {
    const t = tarjetaMision(pendientes);
    expect(t.id).toBe('mision:a');
    expect(t.misionId).toBe('a');
    expect(textos(t)).toEqual(['Leer 20 páginas', 'Quedan 3 hoy.', 'Misión del día']);
    expect(t.boton?.texto).toBe('Hecho');
    expect(t.hablado).toBe('Siguiente misión: Leer 20 páginas. Quedan 3.');
  });

  it('la última lo dice', () => {
    expect(textos(tarjetaMision([pendientes[1]]))[1]).toBe('Es la última de hoy.');
  });

  it('sin pendientes no hay botón', () => {
    const t = tarjetaMision([]);
    expect(t.tipo).toBe('vacia');
    expect(t.boton).toBeNull();
    expect(t.misionId).toBeUndefined();
  });
});

describe('tarjetaEstudio', () => {
  const base = { titulo: 'Historia: Tema 4', inicioMin: 600, finMin: 650, ahoraMin: 627 };

  it('bloque en curso con sus minutos', () => {
    const t = tarjetaEstudio(base);
    expect(textos(t)).toEqual(['Historia: Tema 4', 'Quedan 23 min de 50', 'Bloque de estudio']);
    expect(t.boton?.id).toBe('hecho');
    expect(t.hablado).toBe('Estudio: Historia: Tema 4. Quedan 23 minutos de 50.');
  });

  it('antes de empezar no se puede dar por hecho', () => {
    const t = tarjetaEstudio({ ...base, ahoraMin: 590 });
    expect(textos(t)[1]).toBe('Empieza en 10 min');
    expect(t.boton).toBeNull();
  });

  it('pasada la hora', () => {
    expect(textos(tarjetaEstudio({ ...base, ahoraMin: 650 }))[1]).toBe('Bloque terminado');
  });
});

describe('límites de la pantalla', () => {
  const largo = 'Entrenamiento de hipertrofia con énfasis excéntrico \u2014 '.repeat(8);

  it('ninguna tarjeta se sale, por largo que venga el texto', () => {
    cumpleLimites(
      tarjetaSerie({
        ejercicio: largo,
        serie: 12,
        totalSeries: 12,
        kilos: 1234.56,
        repeticiones: largo,
        descansoSeg: 3599,
      }),
    );
    cumpleLimites(
      tarjetaCardio({ ritmoActualSegKm: 3599, ritmoObjetivoSegKm: 200, distanciaKm: 1000.5 }),
    );
    cumpleLimites(tarjetaMision([{ id: 'x', titulo: largo }]));
    cumpleLimites(tarjetaEstudio({ titulo: largo, inicioMin: 0, finMin: 1439, ahoraMin: 1 }));
  });

  it('el audio conserva las cifras aunque el nombre sea enorme', () => {
    const t = tarjetaSerie({
      ejercicio: largo,
      serie: 1,
      totalSeries: 3,
      kilos: 40,
      repeticiones: 10,
    });
    expect(t.hablado).toContain('40 kilos por 10 repeticiones');
  });

  it('un título vacío no deja la tarjeta sin cabecera', () => {
    expect(textos(tarjetaMision([{ id: 'x', titulo: '   ' }]))[0]).toBe('Misión');
  });

  it('acotarTarjeta recorta también lo hecho a mano', () => {
    const t = acotarTarjeta({
      id: 'x',
      tipo: 'mision',
      lineas: Array.from({ length: 9 }, () => ({ estilo: 'heading' as const, texto: largo })),
      boton: { id: 'hecho', texto: 'Hecho' },
      hablado: largo,
    });
    cumpleLimites(t);
    expect(t.lineas).toHaveLength(MAX_LINEAS);
  });
});
