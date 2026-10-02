// Seguridad · la cuenta propia de NIVL (src/lib/authFlow.ts), con Supabase simulado.
// Ver docs/security-audit/a-rls-auth.md.

import {
  cambiarContrasena,
  cerrarSesion,
  completarEnlace,
  entrar,
  MSG_CREDENCIALES,
  MSG_DEBIL,
  MSG_DEMASIADOS,
  MSG_ENLACE,
  MSG_ENLACE_OTRO_DISPOSITIVO,
  MSG_SIN_CONFIRMAR,
  MSG_SIN_SESION,
  pedirRecuperacion,
  registrar,
  traducirErrorAuth,
  urlConfirmar,
  urlRestablecer,
} from '../authFlow';
import { olvidarDispositivo } from '../push';
import { ErrorVisible, mensajeSistema, MENSAJE_FALLO, MENSAJE_SIN_CONEXION } from '../validation';

// Un binario de tienda (no Expo Go) con el esquema de app.json.
jest.mock('expo-constants', () => {
  const ExecutionEnvironment = { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' };
  return {
    __esModule: true,
    ExecutionEnvironment,
    default: {
      executionEnvironment: 'standalone',
      expoConfig: { name: 'NIVL', slug: 'nivl', scheme: 'nivl', ios: { bundleIdentifier: 'app.nivl' }, android: { package: 'app.nivl' } },
    },
  };
});

const mockAuth = {
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  exchangeCodeForSession: jest.fn(),
  setSession: jest.fn(),
  getSession: jest.fn(),
  updateUser: jest.fn(),
  signOut: jest.fn(),
};
jest.mock('../supabase', () => ({
  supabase: {
    get auth() {
      return mockAuth;
    },
  },
}));

const mockOrden: string[] = [];
jest.mock('../push', () => ({ olvidarDispositivo: jest.fn(async () => { mockOrden.push('push'); }) }));
jest.mock('../notifications', () => ({ cancelarTodo: jest.fn(async () => { mockOrden.push('locales'); }) }));
jest.mock('../oracle', () => ({ setApiKey: jest.fn(async (k: string) => { mockOrden.push(`oraculo:${k}`); }) }));
jest.mock('../creators', () => ({ olvidarCodigoPendiente: jest.fn(async () => { mockOrden.push('creador'); }) }));
jest.mock('../consent', () => ({ olvidarConsentimiento: jest.fn(() => { mockOrden.push('consentimiento'); }) }));

const apiError = (message: string, status: number, code?: string) =>
  Object.assign(new Error(message), { name: 'AuthApiError', status, code });
const redError = () => Object.assign(new Error('Network request failed'), { name: 'AuthRetryableFetchError', status: 0 });

async function errorDe(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('se esperaba un error');
}

beforeEach(() => {
  Object.values(mockAuth).forEach((f) => f.mockReset());
  mockOrden.length = 0;
});

describe('rutas de los enlaces', () => {
  test('en el binario son exactamente nivl://auth/confirmar y nivl://auth/restablecer', () => {
    expect(urlConfirmar()).toBe('nivl://auth/confirmar');
    expect(urlRestablecer()).toBe('nivl://auth/restablecer');
  });
});

describe('registrar', () => {
  test('pide confirmar el correo cuando no hay sesión y manda el redirect correcto', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { user: { id: 'u' }, session: null }, error: null });
    await expect(registrar(' Ana@Example.com ', 'el gato de mi abuela ronca', 'Ana')).resolves.toBe('confirmar_email');
    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'el gato de mi abuela ronca',
      options: { emailRedirectTo: 'nivl://auth/confirmar', data: { full_name: 'Ana' } },
    });
  });
  test('devuelve sesion si el servidor ya la abre', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { user: { id: 'u' }, session: { access_token: 'x' } }, error: null });
    await expect(registrar('a@b.es', 'el gato de mi abuela ronca', 'Ana')).resolves.toBe('sesion');
  });
  test('un correo que ya tiene cuenta NO se delata', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: apiError('User already registered', 422, 'user_already_exists') });
    await expect(registrar('a@b.es', 'el gato de mi abuela ronca', 'Ana')).resolves.toBe('confirmar_email');
  });
  test('contraseña corta o que contiene el correo: se para antes del servidor', async () => {
    const e1 = await errorDe(registrar('ana.garcia@b.es', 'corta', 'Ana'));
    expect(e1).toBeInstanceOf(ErrorVisible);
    const e2 = await errorDe(registrar('ana.garcia@b.es', 'soy ana.garcia y ya', 'Ana'));
    expect((e2 as Error).message).toContain('que no contenga tu correo');
    expect(mockAuth.signUp).not.toHaveBeenCalled();
  });
  test('contraseña rechazada por el servidor (filtrada) → débil', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: apiError('Password is known to be weak', 422, 'weak_password') });
    const e = await errorDe(registrar('a@b.es', 'el gato de mi abuela ronca', 'Ana'));
    expect(e).toEqual(new ErrorVisible(MSG_DEBIL));
  });
  test('correo o nombre no válidos', async () => {
    await expect(registrar('no-es-correo', 'el gato de mi abuela ronca', 'Ana')).rejects.toBeInstanceOf(ErrorVisible);
    await expect(registrar('a@b.es', 'el gato de mi abuela ronca', '   ')).rejects.toBeInstanceOf(ErrorVisible);
  });
});

describe('entrar', () => {
  test('credenciales', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    await entrar('A@B.es', 'x');
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.es', password: 'x' });
  });
  test.each([
    [apiError('Invalid login credentials', 400, 'invalid_credentials'), MSG_CREDENCIALES],
    [apiError('Email not confirmed', 400, 'email_not_confirmed'), MSG_SIN_CONFIRMAR],
    [apiError('Request rate limit reached', 429, 'over_request_rate_limit'), MSG_DEMASIADOS],
  ])('errores en español: %s', async (err, msg) => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: {}, error: err });
    const e = await errorDe(entrar('a@b.es', 'x'));
    expect(e).toEqual(new ErrorVisible(msg));
    expect(mensajeSistema(e)).toBe(msg);
  });
  test('lo desconocido no llega crudo: mensajeSistema lo convierte', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: {}, error: apiError('Database error querying schema', 500, 'unexpected_failure') });
    expect(mensajeSistema(await errorDe(entrar('a@b.es', 'x')))).toBe(MENSAJE_FALLO);
    mockAuth.signInWithPassword.mockResolvedValue({ data: {}, error: redError() });
    expect(mensajeSistema(await errorDe(entrar('a@b.es', 'x')))).toBe(MENSAJE_SIN_CONEXION);
  });
});

describe('pedirRecuperacion (anti-enumeración)', () => {
  test('manda el redirect de restablecer', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    await pedirRecuperacion('A@b.es');
    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.es', { redirectTo: 'nivl://auth/restablecer' });
  });
  test('responde igual exista o no, y aunque el servidor limite envíos', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: apiError('User not found', 404, 'user_not_found') });
    await expect(pedirRecuperacion('nadie@b.es')).resolves.toBeUndefined();
    mockAuth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: apiError('For security purposes…', 429, 'over_email_send_rate_limit') });
    await expect(pedirRecuperacion('alguien@b.es')).resolves.toBeUndefined();
    mockAuth.resetPasswordForEmail.mockRejectedValue(apiError('boom', 500));
    await expect(pedirRecuperacion('alguien@b.es')).resolves.toBeUndefined();
  });
  test('un fallo de red sí se propaga (no dice nada de la cuenta)', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: redError() });
    expect(mensajeSistema(await errorDe(pedirRecuperacion('a@b.es')))).toBe(MENSAJE_SIN_CONEXION);
  });
});

describe('completarEnlace', () => {
  test('PKCE de confirmación', async () => {
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    await expect(completarEnlace('nivl://auth/confirmar?code=abc')).resolves.toBe('confirmado');
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
  });
  test('PKCE de recuperación', async () => {
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    await expect(completarEnlace('nivl://auth/restablecer?code=abc')).resolves.toBe('recuperacion');
  });
  test('flujo implícito por fragmento: se rechaza (enlace fabricado con la sesión de otra cuenta)', async () => {
    await expect(completarEnlace('nivl://auth/confirmar#access_token=AT&refresh_token=RT&type=recovery')).rejects.toEqual(new ErrorVisible(MSG_ENLACE));
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });
  test.each([
    'https://evil.example/auth/confirmar?code=abc',
    'nivl://auth/otra?code=abc',
    'otraapp://auth/confirmar?code=abc',
    'nivl://auth/confirmar/../../x?code=abc',
    'nivl://auth/confirmar',
    'nivl://auth/confirmar#access_token=solo',
  ])('rechaza sin tocar la sesión: %s', async (url) => {
    await expect(completarEnlace(url)).rejects.toEqual(new ErrorVisible(MSG_ENLACE));
    expect(mockAuth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });
  test('enlace con error (caducado) → mensaje de enlace', async () => {
    await expect(completarEnlace('nivl://auth/confirmar#error=access_denied&error_code=otp_expired')).rejects.toEqual(new ErrorVisible(MSG_ENLACE));
  });
  test('código sin verificador (otro móvil) → pista de entrar con contraseña', async () => {
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: apiError('invalid request: both auth code and code verifier should be non-empty', 400, 'validation_failed') });
    await expect(completarEnlace('nivl://auth/confirmar?code=abc')).rejects.toEqual(new ErrorVisible(MSG_ENLACE_OTRO_DISPOSITIVO));
  });
  test('ni los tokens ni el código salen por consola', async () => {
    const espias = (['log', 'warn', 'error', 'info', 'debug'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: apiError('bad code', 400) });
    await errorDe(completarEnlace('nivl://auth/confirmar?code=SECRETO_CODE#access_token=SECRETO_AT&refresh_token=SECRETO_RT'));
    for (const s of espias) {
      expect(JSON.stringify(s.mock.calls)).not.toContain('SECRETO');
      s.mockRestore();
    }
  });
});

describe('cambiarContrasena', () => {
  test('exige sesión', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    await expect(cambiarContrasena('el gato de mi abuela ronca')).rejects.toEqual(new ErrorVisible(MSG_SIN_SESION));
  });
  test('valida contra el correo de la sesión y cambia', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { email: 'pepe.perez@b.es' } } } });
    await expect(cambiarContrasena('hola pepe.perez 2026')).rejects.toBeInstanceOf(ErrorVisible);
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
    mockAuth.updateUser.mockResolvedValue({ data: {}, error: null });
    await cambiarContrasena('el gato de mi abuela ronca');
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'el gato de mi abuela ronca' });
  });
  test('misma contraseña o débil según el servidor', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { email: 'a@b.es' } } } });
    mockAuth.updateUser.mockResolvedValue({ data: {}, error: apiError('New password should be different', 422, 'same_password') });
    await expect(cambiarContrasena('el gato de mi abuela ronca')).rejects.toBeInstanceOf(ErrorVisible);
  });
});

describe('traducirErrorAuth', () => {
  test('deja pasar lo que no conoce', () => {
    const e = new Error('otra cosa');
    expect(traducirErrorAuth(e)).toBe(e);
  });
});

describe('cerrarSesion', () => {
  beforeEach(() => {
    mockAuth.signOut.mockImplementation(async () => {
      mockOrden.push('signOut');
      return { error: null };
    });
  });
  test('borra token push, avisos locales, key, código y consentimiento ANTES del signOut global', async () => {
    await cerrarSesion();
    expect(mockOrden.slice(0, -1).sort()).toEqual(['consentimiento', 'creador', 'locales', 'oraculo:', 'push'].sort());
    expect(mockOrden[mockOrden.length - 1]).toBe('signOut');
    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
    expect(mockAuth.signOut).toHaveBeenCalledWith();
  });
  test('un paso de limpieza que falla no impide cerrar la sesión', async () => {
    jest.mocked(olvidarDispositivo).mockRejectedValueOnce(new Error('sin red'));
    await cerrarSesion();
    expect(mockOrden).toContain('signOut');
  });
  test('si el signOut global falla o lanza, se cierra al menos en local', async () => {
    mockAuth.signOut.mockImplementationOnce(async () => ({ error: new Error('network') }));
    await cerrarSesion();
    expect(mockAuth.signOut).toHaveBeenLastCalledWith({ scope: 'local' });
    mockAuth.signOut.mockImplementationOnce(async () => {
      throw new Error('boom');
    });
    await cerrarSesion();
    expect(mockAuth.signOut).toHaveBeenLastCalledWith({ scope: 'local' });
  });
});
