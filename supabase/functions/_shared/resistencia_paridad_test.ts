// Paridad de los módulos puros de Resistencia: el empaquetado de la Edge
// Function no sube nada de fuera de supabase/, así que cada uno vive dos veces.
// Son copias byte a byte; si tocas uno, toca el otro.
import { assertEquals } from 'jsr:@std/assert@1';

const MODULOS = ['entrenoMedido', 'entrenoEspejo', 'entrenomath', 'cargamath', 'planCarrera', 'mejorHora'];

for (const modulo of MODULOS) {
  Deno.test(`resistencia: _shared/${modulo}.ts es byte a byte src/lib/${modulo}.ts`, async () => {
    const copia = await Deno.readFile(new URL(`./${modulo}.ts`, import.meta.url));
    const original = await Deno.readFile(new URL(`../../../src/lib/${modulo}.ts`, import.meta.url));
    assertEquals(copia, original);
  });

  Deno.test(`resistencia: ${modulo}.ts no importa nada`, async () => {
    const texto = await Deno.readTextFile(new URL(`./${modulo}.ts`, import.meta.url));
    assertEquals(/^\s*import\s|^\s*export\s.*\sfrom\s/m.test(texto), false);
  });
}
