// NIVL · Acceso: qué deja hacer el formulario (el alta corta de N6 y N9).
import { PASSWORD_MIN_LENGTH } from '@/lib/validation';
import { ESPERA_REENVIO_S, evaluarLogin, NOMBRE_POR_DEFECTO, segundosRestantes, SIN_TOCAR, type CamposLogin } from '../formulario';

const CORRECTA = 'el gato de mi abuela ronca';
const ALTA: CamposLogin = { correo: 'ana@example.com', contrasena: CORRECTA, aceptado: true };
const TOCADO = { correo: true, contrasena: true };

describe('formulario de login: crear cuenta', () => {
  test('correo, contraseña y casilla bastan: sin nombre ni repetición', () => {
    expect(evaluarLogin('signup', ALTA, SIN_TOCAR).puedeEnviar).toBe(true);
  });
  test('sin la casilla legal no se puede enviar', () => {
    expect(evaluarLogin('signup', { ...ALTA, aceptado: false }, SIN_TOCAR).puedeEnviar).toBe(false);
  });
  test('sin correo válido no se puede enviar, y el error sale solo tras tocarlo', () => {
    const c = { ...ALTA, correo: 'ana@' };
    expect(evaluarLogin('signup', c, SIN_TOCAR)).toMatchObject({ puedeEnviar: false, errorCorreo: null });
    expect(evaluarLogin('signup', c, TOCADO).errorCorreo).toEqual(expect.any(String));
  });
  test('la contraseña sigue entre 10 y 72 caracteres', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
    const de = (n: number) => evaluarLogin('signup', { ...ALTA, contrasena: 'gatoronca '.repeat(8).slice(0, n) }, SIN_TOCAR);
    expect(de(9).puedeEnviar).toBe(false);
    expect(de(10).puedeEnviar).toBe(true);
    expect(de(72).puedeEnviar).toBe(true);
    expect(de(73).puedeEnviar).toBe(false);
  });
  test('la contraseña no puede contener el correo', () => {
    const c = { ...ALTA, contrasena: `soy ana@example.com y ya` };
    expect(evaluarLogin('signup', c, SIN_TOCAR).puedeEnviar).toBe(false);
  });
  test('la fuerza solo aparece con algo escrito', () => {
    expect(evaluarLogin('signup', { ...ALTA, contrasena: '' }, SIN_TOCAR).fuerza).toBeNull();
    expect(evaluarLogin('signup', ALTA, SIN_TOCAR).fuerza).not.toBeNull();
  });
  test('el nombre por defecto es el de la base de datos', () => {
    expect(NOMBRE_POR_DEFECTO).toBe('Gladiador');
  });
});

describe('formulario de login: entrar y recuperar', () => {
  test('entrar no aplica las reglas de contraseña nueva ni pide casilla', () => {
    expect(evaluarLogin('signin', { correo: 'a@b.es', contrasena: 'x', aceptado: false }, SIN_TOCAR).puedeEnviar).toBe(true);
    expect(evaluarLogin('signin', { correo: 'a@b.es', contrasena: '', aceptado: false }, SIN_TOCAR).puedeEnviar).toBe(false);
  });
  test('recuperar solo pide el correo', () => {
    expect(evaluarLogin('recover', { correo: 'a@b.es', contrasena: '', aceptado: false }, SIN_TOCAR).puedeEnviar).toBe(true);
  });
});

describe('formulario de login: bloqueo de reenvío', () => {
  test('son 60 segundos y cuentan hacia arriba hasta cero', () => {
    expect(ESPERA_REENVIO_S).toBe(60);
    expect(segundosRestantes(60_000, 0)).toBe(60);
    expect(segundosRestantes(60_000, 59_001)).toBe(1);
    expect(segundosRestantes(60_000, 60_000)).toBe(0);
    expect(segundosRestantes(0, 12_345)).toBe(0);
  });
});
