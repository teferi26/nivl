// La política de push del servidor vive sin imports para espejarla en Deno.
import { readFileSync } from 'fs';
import { join } from 'path';
import { pushDelServidorPermitido } from '../pushPolicy';

test('pushPolicy.ts no importa nada (espejo Deno del ritual)', () => {
  const src = readFileSync(join(__dirname, '..', 'pushPolicy.ts'), 'utf8');
  expect(src).not.toMatch(/^import /m);
});

test('casos de paridad para el ritual', () => {
  const base = { wakeTime: '08:00:00', sleepTime: '23:00:00', pushesHoy: 0 };
  expect(pushDelServidorPermitido({ ...base, ultimaApertura: '2026-10-10' }, '2026-10-10T12:00').ok).toBe(true);
  expect(pushDelServidorPermitido({ ...base, ultimaApertura: '2026-10-10', pushesHoy: 1 }, '2026-10-10T12:00').motivo).toBe('tope');
  expect(pushDelServidorPermitido({ ...base, ultimaApertura: '2026-10-10' }, '2026-10-10T23:30').motivo).toBe('silencio');
  expect(pushDelServidorPermitido({ ...base, ultimaApertura: '2026-10-03' }, '2026-10-10T12:00').motivo).toBe('caducada');
  expect(pushDelServidorPermitido({ ...base, ultimaApertura: null }, '2026-10-10T12:00').ok).toBe(true); // cliente antiguo
});
