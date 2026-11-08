import { describe, expect, test } from '@jest/globals';
import { normalizarEntreno, reducirSerie, type PuntoRuta } from '../entrenoMedido';
import {
  desnivelSubidoM,
  distanciaEntreM,
  distanciaRutaM,
  formatoDuracion,
  formatoRitmo,
  parcialesPorKm,
  ritmoSKm,
} from '../medicion/rutaGps';

const METROS_GRADO = 111195.08;

/** Una recta hacia el norte, un punto cada `metros` y `segundos`. */
function recta(puntos: number, metros: number, segundos: number, alt: number | null = null): PuntoRuta[] {
  return Array.from({ length: puntos }, (_, i) => ({
    t: i * segundos,
    lat: 40 + (i * metros) / METROS_GRADO,
    lon: -3,
    alt,
  }));
}

const conAltitudes = (alts: (number | null)[]): PuntoRuta[] =>
  recta(alts.length, 10, 3).map((p, i) => ({ ...p, alt: alts[i] ?? null }));

describe('distancia', () => {
  test('un grado de latitud son unos 111,2 km', () => {
    expect(distanciaEntreM({ lat: 40, lon: -3 }, { lat: 41, lon: -3 })).toBeCloseTo(METROS_GRADO, 0);
  });

  test('suma los tramos de la ruta', () => {
    expect(distanciaRutaM(recta(11, 100, 25))).toBeCloseTo(1000, 0);
  });

  test('sin ruta o con un punto no hay cifra, no un cero', () => {
    expect(distanciaRutaM(null)).toBeNull();
    expect(distanciaRutaM([])).toBeNull();
    expect(distanciaRutaM(recta(1, 100, 25))).toBeNull();
  });

  test('un salto del GPS no añade kilómetros', () => {
    const ruta = recta(5, 100, 25);
    ruta[2] = { ...ruta[2]!, lat: 50 };
    expect(distanciaRutaM(ruta)!).toBeLessThan(250);
  });

  test('tiempos repetidos o coordenadas rotas no envenenan la suma', () => {
    const ruta = recta(4, 100, 25);
    ruta[2] = { ...ruta[2]!, t: ruta[1]!.t };
    expect(distanciaRutaM(ruta)!).toBeGreaterThan(0);
    const rota = recta(3, 100, 25);
    rota[1] = { ...rota[1]!, lat: Number.NaN };
    expect(distanciaRutaM(rota)).toBe(0);
  });
});

describe('desnivel con histéresis', () => {
  test('el baile de la altitud no suma', () => {
    expect(desnivelSubidoM(conAltitudes([100, 102, 99, 101, 100, 102]))).toBe(0);
  });

  test('una subida real suma lo subido', () => {
    expect(desnivelSubidoM(conAltitudes([100, 104, 108, 112]))).toBe(12);
  });

  test('bajar no resta y volver a subir cuenta', () => {
    expect(desnivelSubidoM(conAltitudes([100, 110, 95, 105]))).toBe(20);
  });

  test('sin altitud o con una sola es null, no cero', () => {
    expect(desnivelSubidoM(conAltitudes([null, null, null]))).toBeNull();
    expect(desnivelSubidoM(conAltitudes([100, null]))).toBeNull();
    expect(desnivelSubidoM(null)).toBeNull();
  });

  test('una altitud absurda se ignora', () => {
    expect(desnivelSubidoM(conAltitudes([100, 40000, 104, -9000, 108]))).toBe(8);
  });
});

describe('parciales por km', () => {
  test('corta cada kilómetro y deja el resto real', () => {
    const parciales = parcialesPorKm(recta(26, 100, 20));
    expect(parciales.map((p) => p.n)).toEqual([1, 2, 3]);
    expect(parciales.every((p) => p.tipo === 'km')).toBe(true);
    expect(parciales[0]!.distancia_m).toBe(1000);
    expect(parciales[1]!.distancia_m).toBe(1000);
    expect(parciales[0]!.duracion_s).toBeCloseTo(200, 0);
    expect(parciales[2]!.distancia_m).toBeCloseTo(500, 0);
    expect(parciales[2]!.duracion_s).toBeCloseTo(100, 0);
  });

  test('un tramo largo de una ruta adelgazada cruza varios kilómetros', () => {
    const parciales = parcialesPorKm(recta(2, 3500, 1000));
    expect(parciales.map((p) => p.distancia_m)).toEqual([1000, 1000, 1000, 500]);
    expect(parciales.reduce((s, p) => s + p.duracion_s, 0)).toBeCloseTo(1000, 0);
  });

  test('la pausa no cuenta para el ritmo del kilómetro', () => {
    const ruta = recta(11, 100, 20);
    const conPausa = ruta.map((p, i) => (i >= 5 ? { ...p, t: p.t + 600 } : p));
    expect(parcialesPorKm(conPausa)[0]!.duracion_s).toBeCloseTo(180, 0);
  });

  test('el pulso sale de las muestras de ese kilómetro', () => {
    const serie = [
      { t: 10, bpm: 140 },
      { t: 150, bpm: 150 },
      { t: 250, bpm: 170 },
    ];
    const parciales = parcialesPorKm(recta(16, 100, 20), serie);
    expect(parciales[0]!.fc_media).toBe(145);
    expect(parciales[1]!.fc_media).toBe(170);
  });

  test('sin altitud ni pulso, null; con altitud llana, cero medido', () => {
    expect(parcialesPorKm(recta(11, 100, 20))[0]).toMatchObject({ desnivel_m: null, fc_media: null });
    expect(parcialesPorKm(recta(11, 100, 20, 500))[0]!.desnivel_m).toBe(0);
  });

  test('sin ruta no hay parciales y un resto mínimo se descarta', () => {
    expect(parcialesPorKm(null)).toEqual([]);
    expect(parcialesPorKm(recta(1, 100, 20))).toEqual([]);
    expect(parcialesPorKm(recta(2, 5, 3))).toEqual([]);
  });

  test('lo que produce pasa entero por la puerta del contrato', () => {
    const parciales = parcialesPorKm(recta(26, 100, 20, 600));
    const r = normalizarEntreno({
      origen: 'iphone_gps',
      externo_id: 'x',
      deporte: 'carrera',
      inicio: '2026-03-10T10:00:00Z',
      fin: '2026-03-10T10:10:00Z',
      duracion_s: 500,
      parciales,
    });
    expect(r.ok && r.entreno.parciales).toEqual(parciales);
  });

  test('adelgazar la ruta conserva casi toda la distancia', () => {
    const ruta = recta(4000, 2, 1);
    const fina = reducirSerie(ruta, 1500);
    expect(fina).toHaveLength(1500);
    expect(distanciaRutaM(fina)!).toBeCloseTo(distanciaRutaM(ruta)!, 0);
  });
});

describe('ritmo y formato', () => {
  test('segundos por kilómetro', () => {
    expect(ritmoSKm(5000, 1500)).toBe(300);
  });

  test('sin datos o absurdo, null', () => {
    expect(ritmoSKm(null, 100)).toBeNull();
    expect(ritmoSKm(1000, null)).toBeNull();
    expect(ritmoSKm(0, 100)).toBeNull();
    expect(ritmoSKm(1000, 0)).toBeNull();
    expect(ritmoSKm(1000, 5)).toBeNull();
    expect(ritmoSKm(1, 100000)).toBeNull();
  });

  test('el redondeo lleva el minuto', () => {
    expect(formatoRitmo(307)).toBe('5:07');
    expect(formatoRitmo(299.6)).toBe('5:00');
  });

  test('duración con y sin horas', () => {
    expect(formatoDuracion(725)).toBe('12:05');
    expect(formatoDuracion(3723)).toBe('1:02:03');
    expect(formatoDuracion(0)).toBe('0:00');
  });

  test('sin cifra, un guion corto', () => {
    expect(formatoRitmo(null)).toBe('-');
    expect(formatoRitmo(Number.NaN)).toBe('-');
    expect(formatoDuracion(null)).toBe('-');
    expect(formatoDuracion(-5)).toBe('-');
  });
});
