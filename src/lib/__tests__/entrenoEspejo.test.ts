import { espejoCardio, misionCasaConDeporte, mismoActo, restarDelEspejo, type EspejoFila } from '../entrenoEspejo';

const nueva: EspejoFila = {
  date: '2026-11-08',
  kind: 'correr',
  distance_km: 10,
  duration_min: 60,
  avg_hr: 150,
  rpe: 6,
  zone: 'Z2',
  notes: null,
  xp: 25,
};


describe('espejoCardio', () => {
  test('la fila válida pasa tal cual', () => {
    expect(espejoCardio(nueva)).toEqual(nueva);
  });
  test('distancia 0 es sin dato: un 0 se leería como medido', () => {
    expect(espejoCardio({ ...nueva, distance_km: 0 }).distance_km).toBeNull();
  });
  test('redondea y acota el pulso a lo que admite la tabla', () => {
    expect(espejoCardio({ ...nueva, avg_hr: 151.6 }).avg_hr).toBe(152);
    expect(espejoCardio({ ...nueva, avg_hr: 300 }).avg_hr).toBeNull();
  });
});

describe('misionCasaConDeporte', () => {
  it('descarta solo lo inequívoco', () => {
    expect(misionCasaConDeporte('Correr 10 km', 'bici')).toBe(false);
    expect(misionCasaConDeporte('Correr 10 km', 'carrera')).toBe(true);
    expect(misionCasaConDeporte('Nadar 2 km', 'bici')).toBe(false);
    expect(misionCasaConDeporte('Natación técnica', 'aguas_abiertas')).toBe(true);
    expect(misionCasaConDeporte('Salida en bicicleta', 'piscina')).toBe(false);
    expect(misionCasaConDeporte('Brick del sábado', 'carrera')).toBe(true);
    expect(misionCasaConDeporte('Brick del sábado', 'piscina')).toBe(false);
  });
  it('lo ambiguo sigue enlazando', () => {
    expect(misionCasaConDeporte('Cardio suave', 'piscina')).toBe(true);
    expect(misionCasaConDeporte('Z2 45 min', 'bici')).toBe(true);
    expect(misionCasaConDeporte('Triatlón', 'bici')).toBe(true);
  });
});

describe('mismoActo', () => {
  const a = { inicio: '2026-11-08T10:00:00Z', fin: '2026-11-08T11:00:00Z' };
  it('se solapan más de la mitad del más corto', () => {
    expect(mismoActo(a, { inicio: '2026-11-08T10:10:00Z', fin: '2026-11-08T11:05:00Z' })).toBe(true);
  });
  it('dos sesiones seguidas no son la misma', () => {
    expect(mismoActo(a, { inicio: '2026-11-08T11:00:00Z', fin: '2026-11-08T12:00:00Z' })).toBe(false);
    expect(mismoActo(a, { inicio: '2026-11-08T10:45:00Z', fin: '2026-11-08T11:45:00Z' })).toBe(false);
  });
  it('fechas rotas: no', () => {
    expect(mismoActo(a, { inicio: 'x', fin: 'y' })).toBe(false);
  });
});

describe('restarDelEspejo', () => {
  it('quita lo aportado y no baja del mínimo de la tabla', () => {
    expect(restarDelEspejo({ distance_km: 15, duration_min: 90 }, { distance_km: 10, duration_min: 60 })).toEqual({ distance_km: 5, duration_min: 30 });
    expect(restarDelEspejo({ distance_km: 10, duration_min: 60 }, { distance_km: 10, duration_min: 60 })).toEqual({ distance_km: null, duration_min: 0.01 });
  });
});
