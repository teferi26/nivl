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

  test('un valor desconocido cae en general en vez de romper', () => {
    expect(isProfileKind('piloto')).toBe(false);
    expect(isProfileKind(null)).toBe(false);
    expect(kindMeta('piloto').id).toBe('general');
    expect(kindMeta(undefined).id).toBe('general');
    expect(kindMeta('estudiante').campaignsLabel).toBe('Asignaturas');
  });
});
