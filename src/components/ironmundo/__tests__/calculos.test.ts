import {
  entrenoDeHoy,
  minutosEntreno,
  mlAlTocarVaso,
  resumenCardio,
  resumenPeso,
  vasosDe,
  type DiaRutina,
  type EjercicioRutina,
} from '../calculos';

const DIAS: DiaRutina[] = [
  { id: 'd1', day_of_week: 1, name: 'Empuje' },
  { id: 'd2', day_of_week: 2, name: 'Pierna A · Fuerza' },
];
const ej = (id: string, dia: string, name: string, sets: number, reps: number, weight: number | null, position: number): EjercicioRutina => ({
  id,
  gym_day_id: dia,
  name,
  sets,
  reps,
  weight,
  position,
});
const EJ = [
  ej('e2', 'd2', 'Peso muerto rumano', 3, 8, 80, 1),
  ej('e1', 'd2', 'Sentadilla trasera', 4, 5, 102.5, 0),
  ej('e3', 'd1', 'Press banca', 4, 8, 70, 0),
];

describe('entrenoDeHoy', () => {
  it('el día de la rutina de hoy, en su orden, con series y minutos', () => {
    const r = entrenoDeHoy({ dias: DIAS, ejercicios: EJ, prescrito: [], hoyDia: 2 });
    expect(r.dia?.name).toBe('Pierna A · Fuerza');
    expect(r.filas.map((f) => f.nombre)).toEqual(['Sentadilla trasera', 'Peso muerto rumano']);
    expect(r.series).toBe(7);
    expect(r.minutos).toBe(25);
    expect(r.delCoach).toBe(false);
  });

  it('lo prescrito por el coach manda sobre la rutina', () => {
    const r = entrenoDeHoy({
      dias: DIAS,
      ejercicios: EJ,
      prescrito: [{ id: 'p1', exercise_name: 'Sentadilla trasera', sets: 4, reps: '5', weight: 105, position: 0 }],
      hoyDia: 2,
    });
    expect(r.delCoach).toBe(true);
    expect(r.filas).toEqual([{ clave: 'p1', nombre: 'Sentadilla trasera', series: 4, reps: '5', kg: 105 }]);
  });

  it('sin día de rutina hoy: descanso, sin filas', () => {
    const r = entrenoDeHoy({ dias: DIAS, ejercicios: EJ, prescrito: [], hoyDia: 6 });
    expect(r.dia).toBeNull();
    expect(r.filas).toEqual([]);
    expect(r.minutos).toBe(0);
  });

  it('minutos: 17 series son unos 60 min; nunca menos de 10', () => {
    expect(minutosEntreno(17)).toBe(60);
    expect(minutosEntreno(1)).toBe(10);
    expect(minutosEntreno(0)).toBe(0);
  });
});

describe('resumenPeso', () => {
  it('último peso, cambio en 30 días y la serie en orden', () => {
    const r = resumenPeso([
      { date: '2026-10-20', weight_kg: 78.4 },
      { date: '2026-09-10', weight_kg: 81 },
      { date: '2026-09-22', weight_kg: 80.1 },
      { date: '2026-10-05', weight_kg: 79.2 },
    ]);
    expect(r.ultimo).toBe(78.4);
    expect(r.fecha).toBe('2026-10-20');
    expect(r.cambio30).toBe(-1.7);
    expect(r.serie).toEqual([81, 80.1, 79.2, 78.4]);
    expect(r.min).toBe(78.4);
    expect(r.max).toBe(81);
  });

  it('un solo pesaje: sin cambio; ninguno: todo vacío', () => {
    expect(resumenPeso([{ date: '2026-10-20', weight_kg: 70 }]).cambio30).toBeNull();
    expect(resumenPeso([]).ultimo).toBeNull();
  });
});

describe('resumenCardio', () => {
  it('suma las 4 últimas semanas y reparte los minutos por semana', () => {
    const r = resumenCardio(
      [
        { date: '2026-10-20', kind: 'correr', zone: 'Z2', distance_km: 5, duration_min: 30 },
        { date: '2026-10-12', kind: 'bici', zone: 'Z2', distance_km: 20, duration_min: 60 },
        { date: '2026-09-24', kind: 'remo', zone: 'Z3', distance_km: null, duration_min: 20 },
        { date: '2026-08-01', kind: 'correr', zone: 'Z2', distance_km: 10, duration_min: 60 },
      ],
      '2026-10-20',
      70,
    );
    expect(r.sesiones).toBe(3);
    expect(r.km).toBe(25);
    expect(r.minutos).toBe(110);
    // 350 (correr 5 km) + 420 (bici Z2 1 h) + 175 (remo Z3 20 min)
    expect(r.kcal).toBe(945);
    expect(r.semanas).toEqual([20, 0, 60, 30]);
  });
});

describe('agua', () => {
  it('vasos de 250 ml', () => {
    expect(vasosDe(1600)).toBe(6);
    expect(vasosDe(0)).toBe(0);
  });
  it('tocar un vaso llena hasta él; tocar el último lleno lo vacía', () => {
    expect(mlAlTocarVaso(500, 4)).toBe(1250);
    expect(mlAlTocarVaso(1250, 4)).toBe(1000);
    expect(mlAlTocarVaso(1250, 1)).toBe(500);
  });
});
