// El enrutado del coach vive en el lado Deno (supabase/functions/_shared) pero
// es puro: se prueba aquí para que la regla "el proveedor sale del nombre del
// modelo" no se rompa sin que nadie se entere.
import { elegirModelo, modoDeCabecera, proveedorDe } from '../../../supabase/functions/_shared/routing';

const env = () => 'modelo-de-los-secrets';
const pro = { default: 'deepseek-v4-flash' };
const elite = { default: 'claude-sonnet-5', profundo: 'claude-sonnet-5', revision_semanal: 'claude-sonnet-5' };
const owner = { profundo: 'claude-sonnet-5' };

describe('coach · elegir modelo', () => {
  test('Pro va por DeepSeek en todo', () => {
    expect(elegirModelo(pro, 'chat', 'estandar', env)).toBe('deepseek-v4-flash');
    expect(elegirModelo(pro, 'brief', 'estandar', env)).toBe('deepseek-v4-flash');
  });

  test('el kind manda sobre el default, y profundo sobre ambos', () => {
    const r = { default: 'a', brief: 'b', profundo: 'c' };
    expect(elegirModelo(r, 'brief', 'estandar', env)).toBe('b');
    expect(elegirModelo(r, 'chat', 'estandar', env)).toBe('a');
    expect(elegirModelo(r, 'brief', 'profundo', env)).toBe('c');
    expect(elegirModelo(elite, 'revision_semanal', 'estandar', env)).toBe('claude-sonnet-5');
  });

  test('sin modelo en el plan, los secrets (el owner en estándar)', () => {
    expect(elegirModelo(owner, 'chat', 'estandar', env)).toBe('modelo-de-los-secrets');
    expect(elegirModelo(owner, 'chat', 'profundo', env)).toBe('claude-sonnet-5');
    expect(elegirModelo({}, 'chat', 'estandar', env)).toBe('modelo-de-los-secrets');
    expect(elegirModelo(null, 'chat', 'profundo', env)).toBe('modelo-de-los-secrets');
  });

  test('valores vacíos o que no son texto no cuentan', () => {
    expect(elegirModelo({ default: '  ', chat: 3 }, 'chat', 'estandar', env)).toBe('modelo-de-los-secrets');
  });

  test('el proveedor sale del nombre', () => {
    expect(proveedorDe('claude-sonnet-5')).toBe('anthropic');
    expect(proveedorDe('claude-opus-5')).toBe('anthropic');
    expect(proveedorDe('deepseek-v4-flash')).toBe('compat');
    expect(proveedorDe('gemini-2.5-flash')).toBe('compat');
  });

  test('solo "profundo" exacto abre el bolsillo caro', () => {
    expect(modoDeCabecera('profundo')).toBe('profundo');
    expect(modoDeCabecera(' Profundo ')).toBe('profundo');
    expect(modoDeCabecera('estandar')).toBe('estandar');
    expect(modoDeCabecera('max')).toBe('estandar');
    expect(modoDeCabecera(null)).toBe('estandar');
  });
});
