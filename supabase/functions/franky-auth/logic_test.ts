// Seguridad · franky-auth (parte pura). `deno test supabase/functions/franky-auth/logic_test.ts`
// Ver docs/security-audit/a-rls-auth.md (A-01).
import { deepEqual, equal, notEqual, ok, throws } from 'node:assert/strict';
import {
  accionDe,
  decidirVinculo,
  Freno,
  ipDe,
  limpiarEmail,
  limpiarPassword,
  passwordAleatoria,
  PuertaError,
} from './logic.ts';

Deno.test('vínculo: sin franky_id y SIN confirmar → vincular y reiniciar contraseña', () => {
  deepEqual(decidirVinculo({ app_metadata: { provider: 'email' }, email_confirmed_at: null }, 'f1'), {
    vinculo: 'vincular',
    reiniciarPassword: true,
  });
  deepEqual(decidirVinculo({ app_metadata: {} }, 'f1'), { vinculo: 'vincular', reiniciarPassword: true });
  deepEqual(decidirVinculo(null, 'f1'), { vinculo: 'vincular', reiniciarPassword: true });
  deepEqual(decidirVinculo({ app_metadata: {}, email_confirmed_at: '' }, 'f1'), { vinculo: 'vincular', reiniciarPassword: true });
});

Deno.test('vínculo: sin franky_id y confirmado → vincular sin tocar la contraseña', () => {
  deepEqual(decidirVinculo({ app_metadata: { provider: 'email' }, email_confirmed_at: '2026-09-01T10:00:00Z' }, 'f1'), {
    vinculo: 'vincular',
    reiniciarPassword: false,
  });
});

Deno.test('vínculo: mismo id → ok', () => {
  deepEqual(decidirVinculo({ app_metadata: { franky_id: 'f1' }, email_confirmed_at: null }, 'f1'), {
    vinculo: 'ok',
    reiniciarPassword: false,
  });
});

Deno.test('vínculo: otro id → conflicto (no se entrega sesión)', () => {
  deepEqual(decidirVinculo({ app_metadata: { franky_id: 'victima' }, email_confirmed_at: '2026-09-01T10:00:00Z' }, 'atacante'), {
    vinculo: 'conflicto',
    reiniciarPassword: false,
  });
});

Deno.test('vínculo: franky_id no textual no cuenta como vínculo', () => {
  equal(decidirVinculo({ app_metadata: { franky_id: 42 }, email_confirmed_at: 'x' }, '42').vinculo, 'vincular');
});

Deno.test('contraseña aleatoria: 32 bytes en base64url, distinta cada vez', () => {
  const a = passwordAleatoria();
  const b = passwordAleatoria();
  equal(a.length, 43);
  ok(/^[A-Za-z0-9_-]+$/.test(a));
  notEqual(a, b);
  // Determinista con una fuente fija: todos los bytes 0xFF → solo '_'.
  equal(passwordAleatoria((buf) => buf.fill(255)), '_'.repeat(42) + '8');
});

Deno.test('acción: desconocida se rechaza; ausente es login', () => {
  equal(accionDe(undefined), 'login');
  equal(accionDe('register'), 'register');
  equal(accionDe('admin'), null);
});

Deno.test('entradas', () => {
  equal(limpiarEmail(' Ana@Example.COM '), 'ana@example.com');
  throws(() => limpiarEmail('no'), PuertaError);
  throws(() => limpiarPassword(''), PuertaError);
  equal(limpiarPassword(' x '), ' x ');
});

Deno.test('frenos: IP del borde y freno por correo', () => {
  const h = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null });
  equal(ipDe(h({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.9' })), '1.1.1.1');
  equal(ipDe(h({ 'x-forwarded-for': '9.9.9.9, 3.3.3.3' })), '9.9.9.9');
  const f = new Freno(8, 1000);
  for (let i = 0; i < 8; i++) ok(f.intentar('v@x.es', 0));
  equal(f.intentar('v@x.es', 1), false);
  ok(f.intentar('v@x.es', 1001));
});
