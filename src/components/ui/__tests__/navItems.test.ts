import { destinoActivo, destinosDe, NAV_ITEMS } from '@/components/ui/navItems';

// La vibración no pinta nada aquí y arrastra módulos nativos: fuera (jest lo
// sube por encima del import).
jest.mock('@/design/haptics', () => ({ vibrar: jest.fn() }));

// El orden de (tabs)/_layout.tsx (General v2, docs/modos/GENERAL.md): las
// cuatro de la barra inferior primero y detrás las que se abren desde Hoy.
const RUTAS = ['index', 'avance', 'mazmorras', 'arena', 'coach', 'habitos', 'agenda', 'perfil'].map((name) => ({
  name,
  key: `${name}-k`,
}));

describe('destinosDe', () => {
  it('la barra inferior (compact) pinta 4 destinos, como los mundos: Hoy, Avance, Campañas y Arena', () => {
    const tabs = destinosDe(RUTAS, 'tabs').map((r) => r.name);
    expect(tabs).toEqual(['index', 'avance', 'mazmorras', 'arena']);
  });

  it('el raíl y la barra lateral pintan los 8', () => {
    expect(destinosDe(RUTAS, 'rail')).toHaveLength(8);
    expect(destinosDe(RUTAS, 'sidebar')).toHaveLength(8);
    expect(destinosDe(RUTAS, 'rail').map((r) => r.name)).toContain('agenda');
  });

  it('una ruta sin entrada en NAV_ITEMS se pinta (compact por defecto)', () => {
    expect(destinosDe([{ name: 'nueva' }], 'tabs')).toHaveLength(1);
  });
});

describe('destinoActivo', () => {
  it('en lo que se abre desde Hoy (coach, hábitos, agenda, perfil), la barra inferior marca Hoy', () => {
    for (const r of ['coach', 'habitos', 'agenda', 'perfil']) {
      expect(NAV_ITEMS[r]?.padre).toBe('index');
      const i = RUTAS.findIndex((x) => x.name === r);
      expect(destinoActivo(RUTAS, i, 'tabs')).toBe('index');
    }
  });

  it('en el raíl y la barra lateral se marcan a sí mismos', () => {
    expect(destinoActivo(RUTAS, 6, 'rail')).toBe('agenda');
    expect(destinoActivo(RUTAS, 4, 'sidebar')).toBe('coach');
  });

  it('las cuatro pestañas se marcan a sí mismas', () => {
    expect(destinoActivo(RUTAS, 0, 'tabs')).toBe('index');
    expect(destinoActivo(RUTAS, 1, 'tabs')).toBe('avance');
    expect(destinoActivo(RUTAS, 2, 'tabs')).toBe('mazmorras');
    expect(destinoActivo(RUTAS, 3, 'tabs')).toBe('arena');
  });

  it('un índice fuera de rango no marca nada', () => {
    expect(destinoActivo(RUTAS, 9)).toBeUndefined();
  });
});
