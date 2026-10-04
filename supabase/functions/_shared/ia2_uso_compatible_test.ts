// L0 · Contabilidad de APIs compatibles (DeepSeek): la caché no se cobra dos veces.
import { assertEquals } from 'jsr:@std/assert@1';
import { usoCompatible } from './openai.ts';
import { costMicroUsd } from './anthropic.ts';

Deno.test('prompt_tokens incluye los cacheados: se restan de la entrada', () => {
  const u = usoCompatible({ prompt_tokens: 10000, completion_tokens: 500, prompt_tokens_details: { cached_tokens: 8000 } });
  assertEquals(u, { input_tokens: 2000, output_tokens: 500, cache_read_input_tokens: 8000, cache_creation_input_tokens: 0 });
});

Deno.test('formato propio de DeepSeek (prompt_cache_hit_tokens)', () => {
  const u = usoCompatible({ prompt_tokens: 3000, completion_tokens: 10, prompt_cache_hit_tokens: 1000 });
  assertEquals(u.input_tokens, 2000);
  assertEquals(u.cache_read_input_tokens, 1000);
});

Deno.test('datos absurdos no dan negativos ni más caché que entrada', () => {
  assertEquals(usoCompatible({ prompt_tokens: 100, prompt_cache_hit_tokens: 500 }).input_tokens, 0);
  assertEquals(usoCompatible({ prompt_tokens: 100, prompt_cache_hit_tokens: 500 }).cache_read_input_tokens, 100);
  assertEquals(usoCompatible(undefined).input_tokens, 0);
  assertEquals(usoCompatible({ prompt_tokens: -5 }).input_tokens, 0);
});

Deno.test('el coste ya no cobra dos veces la caché', () => {
  const conCache = costMicroUsd('deepseek-v4-flash', usoCompatible({ prompt_tokens: 10000, completion_tokens: 0, prompt_cache_hit_tokens: 10000 }));
  const sinCache = costMicroUsd('deepseek-v4-flash', usoCompatible({ prompt_tokens: 10000, completion_tokens: 0 }));
  // Todo leído de caché debe costar ~0,1× de todo sin caché.
  assertEquals(Math.round((conCache / sinCache) * 10), 1);
});

Deno.test('tarifa: el id fechado que devuelve la API cobra como su modelo (no como Opus)', async () => {
  const { tarifa, costMicroUsd: coste } = await import('./anthropic.ts');
  assertEquals(tarifa('claude-haiku-4-5-20251001'), tarifa('claude-haiku-4-5'));
  // El turno real del 02/10: 1342 entrada, 4456 escritura de caché, 108 salida.
  const u = { input_tokens: 1342, cache_creation_input_tokens: 4456, output_tokens: 108 };
  assertEquals(coste('claude-haiku-4-5-20251001', u), 7452);
  // Un modelo desconocido sigue cobrándose como Opus (el freno peca de caro).
  assertEquals(tarifa('modelo-raro'), tarifa('claude-opus-5'));
});
