// NIVL · Medición: formato y decisiones de las pantallas.
import { SIN_DATO } from '@/components/ui/sinDato';
import {
  calidadGps,
  deporteDeCardio,
  esDeOtroDia,
  kmDe,
  motivoNoDisponible,
  velocidadDe,
} from '../puro';

describe('motivoNoDisponible', () => {
  it('la plataforma va antes que el módulo', () => {
    expect(motivoNoDisponible('web', false, false)).toBe('web');
    expect(motivoNoDisponible('android', false, false)).toBe('android');
  });
  it('en iOS: sin módulo, sin servicio o disponible', () => {
    expect(motivoNoDisponible('ios', false, false)).toBe('sin_modulo');
    expect(motivoNoDisponible('ios', true, false)).toBe('sin_salud');
    expect(motivoNoDisponible('ios', true, true)).toBeNull();
  });
});

describe('cifras', () => {
  it('sin medir es sin dato, nunca cero', () => {
    expect(kmDe(null)).toBe(SIN_DATO);
    expect(velocidadDe(null)).toBe(SIN_DATO);
    expect(velocidadDe(0)).toBe(SIN_DATO);
  });
  it('velocidad y kilómetros', () => {
    expect(velocidadDe(120)).toBe('30,0');
    expect(kmDe(5230)).toBe('5,23');
  });
  it('calidad de la señal', () => {
    expect(calidadGps(null)).toBeNull();
    expect(calidadGps(-1)).toBeNull();
    expect(calidadGps(8)).toBe('buena');
    expect(calidadGps(25)).toBe('media');
    expect(calidadGps(60)).toBe('debil');
  });
});

describe('fechas locales', () => {
  // Hora local construida a mano: el test vale en cualquier zona.
  const local = new Date(2026, 10, 8, 0, 30).toISOString();
  it('compara por el día local de fin', () => {
    expect(esDeOtroDia(local, '2026-11-08')).toBe(false);
    expect(esDeOtroDia(local, '2026-11-09')).toBe(true);
    expect(esDeOtroDia('no es fecha', '2026-11-09')).toBe(false);
  });
});

describe('deporteDeCardio', () => {
  it('lo que no tiene equivalente se contrasta como otro', () => {
    expect(deporteDeCardio('correr')).toBe('carrera');
    expect(deporteDeCardio('nadar')).toBe('piscina');
    expect(deporteDeCardio('caminar')).toBe('otro');
  });
});
