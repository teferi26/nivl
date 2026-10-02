import { evaluateAchievements, tituloVigente } from '../achievements';
import { levelFromXp, xpCostForLevel } from '../game';
import {
  celebracionesEntre, celebrarCambio, colaDeCelebracion, codigosDeRangoPendientes, cosmeticosDe,
  estadoDe, RANGOS, rangoDeNivel, rangoRegistrado, titulosDisponibles,
} from '../progression';

jest.mock('../supabase', () => ({ supabase: {} }));

/** XP total para estar justo al inicio de un nivel. */
const xpDeNivel = (n: number) => { let c = 0; for (let l = 1; l < n; l++) c += xpCostForLevel(l); return c; };
const perfil = (nivel: number, extra = {}) => ({ xp_total: xpDeNivel(nivel), streak_days: 0, protection_stones: 0, ...extra });

describe('rangos v2', () => {
  test('los tramos son contiguos, crecientes y empiezan en el nivel 1', () => {
    expect(RANGOS[0]!.grados[0]).toBe(1);
    for (let i = 0; i < RANGOS.length; i++) {
      const g = RANGOS[i]!.grados;
      expect(g[0]).toBeLessThan(g[1]); expect(g[1]).toBeLessThan(g[2]);
      if (i > 0) expect(g[0]).toBeGreaterThan(RANGOS[i - 1]!.grados[2]);
    }
  });

  test('cada nivel cae en un rango y un grado', () => {
    expect(rangoDeNivel(1)).toMatchObject({ rango: { id: 'E' }, grado: 1 });
    expect(rangoDeNivel(5)).toMatchObject({ rango: { id: 'D' }, grado: 1 });
    expect(rangoDeNivel(9)).toMatchObject({ rango: { id: 'D' }, grado: 3 });
    expect(rangoDeNivel(13)).toMatchObject({ rango: { id: 'C' }, grado: 3 });
    expect(rangoDeNivel(22)).toMatchObject({ rango: { id: 'A' }, grado: 1 });
    expect(rangoDeNivel(99)).toMatchObject({ rango: { id: 'S' }, grado: 3 });
  });

  test('a ~270 XP/día los rangos llegan en semana 1, mes 1,5, mes 4, ~año y ~2 años', () => {
    const dias = (nivel: number) => Math.round(xpDeNivel(nivel) / 270);
    const inicio = Object.fromEntries(RANGOS.map((r) => [r.id, dias(r.grados[0])]));
    expect(inicio.D).toBeLessThanOrEqual(10);
    expect(inicio.C).toBeGreaterThanOrEqual(30); expect(inicio.C).toBeLessThanOrEqual(60);
    expect(inicio.B).toBeGreaterThanOrEqual(100); expect(inicio.B).toBeLessThanOrEqual(150);
    expect(inicio.A).toBeGreaterThanOrEqual(270); expect(inicio.A).toBeLessThanOrEqual(400);
    expect(inicio.S).toBeGreaterThanOrEqual(600); expect(inicio.S).toBeLessThanOrEqual(800);
  });

  test('el marco evoluciona y la corona aparece desde B', () => {
    expect(cosmeticosDe('C').corona).toBeNull();
    expect(cosmeticosDe('B').corona).toBe('casco');
    expect(new Set(RANGOS.map((r) => r.marco)).size).toBe(RANGOS.length);
  });
});

describe('el rango no baja nunca', () => {
  test('una penalización que baja el nivel no quita el rango registrado', () => {
    const e = estadoDe(perfil(9), ['rango_D', 'rango_C']);
    expect(e.nivel).toBe(9);
    expect(e.rango).toBe('C');
    expect(e.grado).toBe(1);
    expect(e.siguienteRango).toEqual({ rango: 'B', nombre: 'Campeón', nivel: 15, faltan: 6 });
    expect(estadoDe(perfil(31), ['rango_S']).siguienteRango).toBeNull();
  });

  test('evaluateAchievements registra los rangos alcanzados y no los repite', () => {
    expect(evaluateAchievements({ level: 12 })).toEqual(expect.arrayContaining(['rango_D', 'rango_C']));
    expect(evaluateAchievements({ level: 12, unlocked: new Set(['rango_D']) })).not.toContain('rango_D');
    expect(codigosDeRangoPendientes(3, new Set())).toEqual([]);
    expect(rangoRegistrado(['level_5', 'rango_B', 'rango_D'])).toBe('B');
  });

  test('títulos: los de cada rango alcanzado más los de logros, sin repetir', () => {
    expect(titulosDisponibles('C', ['Leyenda', 'Veterano'])).toEqual(['Tiro', 'Gladiador', 'Veterano', 'Leyenda']);
  });

  test('los títulos antiguos se ven con su nombre nuevo', () => {
    expect(tituloVigente('Élite')).toBe('Sangre de arena');
    expect(tituloVigente('El Constante')).toBe('El Constante');
    expect(tituloVigente(null)).toBeNull();
  });
});

describe('contrato de celebraciones', () => {
  const fecha = '2026-10-10';

  test('subir un nivel: una celebración media con el XP del nivel', () => {
    const r = celebrarCambio({ perfilAntes: perfil(6), perfilDespues: { ...perfil(7), xp_total: xpDeNivel(7) + 10 }, logrosAntes: ['rango_D'], fecha });
    expect(r).toEqual([expect.objectContaining({ tipo: 'nivel', nivel: 7, intensidad: 'media', clave: 'nivel:7', xpEnNivel: 10 })]);
    expect(levelFromXp(xpDeNivel(7) + 10).level).toBe(7);
  });

  test('varios niveles de golpe = una sola celebración, la del último', () => {
    const r = celebrarCambio({ perfilAntes: perfil(22), perfilDespues: perfil(24), logrosAntes: ['rango_D', 'rango_C', 'rango_B', 'rango_A'], fecha });
    expect(r.filter((c) => c.tipo === 'nivel')).toHaveLength(1);
    expect(r[0]).toMatchObject({ nivel: 24 });
  });

  test('entrar en un rango es UNA ceremonia épica que absorbe nivel y grado', () => {
    const r = celebrarCambio({ perfilAntes: perfil(4), perfilDespues: perfil(5), logrosAntes: [], fecha,
      logrosNuevos: [{ codigo: 'rango_D', nombre: 'x', desc: 'x' }, { codigo: 'level_5', nombre: 'Despertar', desc: 'Alcanza el nivel 5' }] });
    expect(r[0]).toMatchObject({ tipo: 'rango', rango: 'D', intensidad: 'epica', clave: 'rango:D', marco: 'doble' });
    expect(r.some((c) => c.tipo === 'nivel' || c.tipo === 'grado')).toBe(false);
    expect(r.filter((c) => c.tipo === 'logro').map((c) => c.clave)).toEqual(['logro:level_5']);
  });

  test('cambio de grado dentro del rango: celebración media', () => {
    const r = celebrarCambio({ perfilAntes: perfil(10), perfilDespues: perfil(11), logrosAntes: ['rango_D', 'rango_C'], fecha });
    expect(r[0]).toMatchObject({ tipo: 'grado', rango: 'C', grado: 2, intensidad: 'media' });
  });

  test('recuperar nivel tras una penalización no repite la ceremonia de rango', () => {
    const r = celebrarCambio({ perfilAntes: perfil(9), perfilDespues: perfil(10), logrosAntes: ['rango_D', 'rango_C'], fecha, recuperadoXp: 300 });
    expect(r.some((c) => c.tipo === 'rango')).toBe(false);
    expect(r.some((c) => c.tipo === 'recuperacion')).toBe(true);
  });

  test('bajar de nivel no se celebra', () => {
    expect(celebrarCambio({ perfilAntes: perfil(8), perfilDespues: perfil(7), logrosAntes: ['rango_D'], fecha })).toEqual([]);
  });

  test('hitos de racha con clave por fecha (se pueden volver a ganar)', () => {
    const r = celebrarCambio({ perfilAntes: perfil(3, { streak_days: 29 }), perfilDespues: perfil(3, { streak_days: 30 }), logrosAntes: [], fecha });
    expect(r).toEqual([expect.objectContaining({ tipo: 'racha', dias: 30, intensidad: 'media', clave: 'racha:30:2026-10-10' })]);
  });

  test('como mucho una épica; orden rango, racha, logro, recuperación, piedra', () => {
    const a = estadoDe(perfil(4, { streak_days: 6, protection_stones: 0 }), []);
    const b = estadoDe(perfil(5, { streak_days: 7, protection_stones: 1 }), ['rango_D']);
    const r = celebracionesEntre(a, b, { fecha, logrosNuevos: [{ codigo: 'streak_7', nombre: 'Una semana imparable', desc: '' }], recuperadoXp: 20 });
    expect(r.map((c) => c.tipo)).toEqual(['rango', 'racha', 'logro', 'recuperacion', 'piedra']);
    expect(r.filter((c) => c.intensidad === 'epica')).toHaveLength(1);
  });

  test('la cola no repite lo ya visto y agrupa el resto', () => {
    const r = celebrarCambio({ perfilAntes: perfil(4, { streak_days: 6 }), perfilDespues: perfil(5, { streak_days: 7 }), logrosAntes: [], fecha });
    const { principal, resto } = colaDeCelebracion(r, new Set(['rango:D']));
    expect(principal).toMatchObject({ tipo: 'racha' });
    expect(resto).toEqual([]);
  });
});

describe('insignia Reclutador y primer día', () => {
  test('sube a 1, 3 y 10 invitados activos; nunca da XP', () => {
    const { celebracionInsignia, nivelInsignia } = jest.requireActual('../progression');
    expect(nivelInsignia('reclutador', 0)).toBe(0);
    expect(celebracionInsignia('reclutador', 0, 1)).toMatchObject({ tipo: 'insignia', nivel: 1, nombre: 'Reclutador', clave: 'insignia:reclutador:1' });
    expect(celebracionInsignia('reclutador', 1, 2)).toBeNull();
    expect(celebracionInsignia('reclutador', 9, 10)).toMatchObject({ nivel: 3, intensidad: 'epica' });
  });

  test('first_day se desbloquea con el primer día cumplido', () => {
    expect(evaluateAchievements({ diaCumplido: true })).toContain('first_day');
    expect(evaluateAchievements({})).not.toContain('first_day');
  });
});
