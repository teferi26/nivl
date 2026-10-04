// Auditoría 1.0.8: las fotos del chat solo van a Claude. Con DeepSeek (Pro) el
// adaptador compatible las mandaba como image_url.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { fotosSinVision, MSG_FOTOS_SOLO_CLAUDE } from '../coach/guard.ts';
import { proveedorDe } from './routing.ts';

const compatDe = (model: string) => (proveedorDe(model) === 'compat' ? { baseUrl: 'https://x', apiKey: 'k' } : null);

Deno.test('Pro (deepseek) con fotos: se corta antes de llamar al modelo', () => {
  assertEquals(fotosSinVision(1, compatDe('deepseek-v4-flash')), MSG_FOTOS_SOLO_CLAUDE);
  assert(/foto/i.test(MSG_FOTOS_SOLO_CLAUDE), 'el cliente solo enseña tal cual los 400 que hablan de fotos');
  assert(!/[—–]/.test(MSG_FOTOS_SOLO_CLAUDE));
});

Deno.test('Élite (claude) con fotos y Pro sin fotos: siguen', () => {
  assertEquals(fotosSinVision(2, compatDe('claude-sonnet-5')), null);
  assertEquals(fotosSinVision(0, compatDe('deepseek-v4-flash')), null);
});
