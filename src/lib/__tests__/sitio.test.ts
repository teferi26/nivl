import { destinoPortal, esSitioCreadores, SITIO_CREADORES } from '../sitio';

describe('sitio: qué se compila', () => {
  it('solo «creadores» en web activa el portal', () => {
    expect(esSitioCreadores('creadores', 'web')).toBe(true);
    expect(esSitioCreadores(' Creadores ', 'web')).toBe(true);
    expect(esSitioCreadores(undefined, 'web')).toBe(false);
    expect(esSitioCreadores(null, 'web')).toBe(false);
    expect(esSitioCreadores('', 'web')).toBe(false);
    expect(esSitioCreadores('app', 'web')).toBe(false);
    expect(esSitioCreadores('creador', 'web')).toBe(false);
  });

  it('en iOS y Android nunca es el portal, aunque la variable se cuele', () => {
    expect(esSitioCreadores('creadores', 'ios')).toBe(false);
    expect(esSitioCreadores('creadores', 'android')).toBe(false);
    expect(esSitioCreadores('creadores', undefined)).toBe(false);
  });

  it('sin la variable, la app es la de siempre', () => {
    expect(process.env.EXPO_PUBLIC_SITIO).toBeUndefined();
    expect(SITIO_CREADORES).toBe(false);
  });
});

describe('portal de creadores: rutas (R1)', () => {
  it('solo se pinta el login sin sesión y el panel con ella (nombres de pantalla)', () => {
    const pinta = (r: string, s: boolean) => destinoPortal(r, s) === null;
    expect(pinta('login', false)).toBe(true);
    expect(pinta('creador', true)).toBe(true);
    // /creador sin sesión no se pinta: llamaría a las RPC sin token.
    expect(pinta('creador', false)).toBe(false);
    expect(pinta('login', true)).toBe(false);
    for (const r of ['index', '(tabs)', 'coach', 'fotos', 'oraculo', 'pro', 'onboarding', 'diario', 'c/[code]', 'auth/restablecer', 'kit', '+not-found']) {
      expect(pinta(r, false)).toBe(false);
      expect(pinta(r, true)).toBe(false);
    }
  });

  it('sin sesión, todo acaba en el login', () => {
    expect(destinoPortal('login', false)).toBeNull();
    for (const s of [undefined, 'creador', '(tabs)', 'coach', 'fotos', 'oraculo', 'pro', 'onboarding', 'c', 'auth', '+not-found']) {
      expect(destinoPortal(s, false)).toBe('/login');
    }
  });

  it('con sesión, todo acaba en /creador (también el login)', () => {
    expect(destinoPortal('creador', true)).toBeNull();
    for (const s of [undefined, 'login', '(tabs)', 'coach', 'fotos', 'oraculo', 'pro', 'onboarding', 'c', 'auth', '+not-found']) {
      expect(destinoPortal(s, true)).toBe('/creador');
    }
  });
});
