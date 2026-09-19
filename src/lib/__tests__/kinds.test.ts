import { KINDS, MODULES, PROFILE_KINDS, isProfileKind, kindMeta, modulesFor } from '../kinds';

describe('perfiles de uso', () => {
  test('todo perfil propone hábitos y módulos válidos', () => {
    const ids = new Set(MODULES.map((m) => m.id));
    for (const kind of PROFILE_KINDS) {
      const meta = KINDS[kind];
      expect(meta.starterQuests.length).toBeGreaterThanOrEqual(4);
      expect(meta.primaryModules.length).toBeGreaterThanOrEqual(6);
      for (const m of meta.primaryModules) expect(ids.has(m)).toBe(true);
      for (const q of meta.starterQuests) {
        expect(q.days_of_week.length).toBeGreaterThan(0);
        for (const d of q.days_of_week) expect(d >= 1 && d <= 7).toBe(true);
      }
      // Sin duplicados: un módulo dos veces delante es un fallo de datos.
      expect(new Set(meta.primaryModules).size).toBe(meta.primaryModules.length);
    }
  });

  test('modulesFor reparte sin perder ni repetir módulos', () => {
    for (const kind of PROFILE_KINDS) {
      const { primary, secondary } = modulesFor(kind);
      const all = [...primary, ...secondary].map((m) => m.id).sort();
      expect(all).toEqual(MODULES.map((m) => m.id).sort());
    }
    expect(modulesFor('general').secondary).toHaveLength(0);
    expect(modulesFor('deportista').primary[0]?.id).toBe('gym');
    expect(modulesFor('emprendedor').primary[0]?.id).toBe('economia');
  });

  test('el profesional es un perfil de pleno derecho', () => {
    expect(PROFILE_KINDS).toContain('trabajador');
    expect(isProfileKind('trabajador')).toBe(true);
    expect(kindMeta('trabajador').label).toBe('Profesional');
    expect(kindMeta('trabajador').campaignsLabel).toBe('Objetivos');
    expect(modulesFor('trabajador').primary[0]?.id).toBe('informe');
    // Cuida el cuerpo además del trabajo: al menos un hábito físico propuesto.
    expect(KINDS.trabajador.starterQuests.some((q) => q.stat === 'FUE' || q.stat === 'VIT')).toBe(true);
  });

  test('amigos es un módulo de todos los perfiles', () => {
    const amigos = MODULES.find((m) => m.id === 'amigos');
    expect(amigos).toMatchObject({ label: 'Amigos', icon: 'people-outline', route: '/amigos' });
    for (const kind of PROFILE_KINDS) expect(KINDS[kind].primaryModules).toContain('amigos');
  });

  test('amigos va en la primera fila de la rejilla (puesto 2 o 3), no enterrado al final', () => {
    // La rejilla de Hoy tiene cuatro columnas: lo que no está en la primera
    // fila no existe para quien acaba de llegar, y los amigos son la retención.
    for (const kind of PROFILE_KINDS) {
      const i = KINDS[kind].primaryModules.indexOf('amigos');
      expect(i).toBeGreaterThanOrEqual(1);
      expect(i).toBeLessThanOrEqual(2);
    }
  });

  test('un valor desconocido cae en general en vez de romper', () => {
    expect(isProfileKind('piloto')).toBe(false);
    expect(isProfileKind(null)).toBe(false);
    expect(kindMeta('piloto').id).toBe('general');
    expect(kindMeta(undefined).id).toBe('general');
    expect(kindMeta('estudiante').campaignsLabel).toBe('Asignaturas');
  });
});
