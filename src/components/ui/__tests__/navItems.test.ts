import { destinoActivo, destinosDe, NAV_ITEMS } from '@/components/ui/navItems';

// La vibración no pinta nada aquí y arrastra módulos nativos: fuera (jest lo
// sube por encima del import).
jest.mock('@/design/haptics', () => ({ vibrar: jest.fn() }));

// El orden de (tabs)/_layout.tsx: la Agenda justo detrás de Hoy.
const RUTAS = ['index', 'agenda', 'coach', 'habitos', 'mazmorras', 'perfil'].map((name) => ({
  name,
  key: `${name}-k`,
}));

describe('destinosDe', () => {
  it('la barra inferior (compact) pinta 5 destinos, sin la Agenda', () => {
    const tabs = destinosDe(RUTAS, 'tabs').map((r) => r.name);
    expect(tabs).toHaveLength(5);
    expect(tabs).toEqual(['index', 'coach', 'habitos', 'mazmorras', 'perfil']);
  });

  it('el raíl y la barra lateral siguen pintando los 6', () => {
    expect(destinosDe(RUTAS, 'rail')).toHaveLength(6);
    expect(destinosDe(RUTAS, 'sidebar')).toHaveLength(6);
    expect(destinosDe(RUTAS, 'rail').map((r) => r.name)).toContain('agenda');
  });

  it('una ruta sin entrada en NAV_ITEMS se pinta (compact por defecto)', () => {
    expect(destinosDe([{ name: 'nueva' }], 'tabs')).toHaveLength(1);
  });
});

describe('destinoActivo', () => {
  it('en la Agenda, la barra inferior marca Hoy', () => {
    expect(NAV_ITEMS.agenda?.padre).toBe('index');
    expect(destinoActivo(RUTAS, 1, 'tabs')).toBe('index');
    expect(destinoActivo(RUTAS, 1)).toBe('index');
  });

  it('en el raíl y la barra lateral la Agenda se marca a sí misma', () => {
    expect(destinoActivo(RUTAS, 1, 'rail')).toBe('agenda');
    expect(destinoActivo(RUTAS, 1, 'sidebar')).toBe('agenda');
  });

  it('el resto de destinos se marcan a sí mismos', () => {
    expect(destinoActivo(RUTAS, 0, 'tabs')).toBe('index');
    expect(destinoActivo(RUTAS, 2, 'tabs')).toBe('coach');
    expect(destinoActivo(RUTAS, 5, 'tabs')).toBe('perfil');
  });

  it('un índice fuera de rango no marca nada', () => {
    expect(destinoActivo(RUTAS, 9)).toBeUndefined();
  });
});
