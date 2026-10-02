// Minimización del resumen visual: la IA no ve la ruta de Storage (lleva el uuid)
// ni el nombre real; ve referencias F1, F2… que se traducen de vuelta.
import { assertEquals } from 'jsr:@std/assert@1';
import { refFoto, rutaDeRef } from './recap.ts';

const FOTOS = [{ path: 'uuid-de-a/f1.jpg' }, { path: 'uuid-de-a/f2.jpg' }];

Deno.test('refFoto numera desde F1', () => {
  assertEquals([0, 1, 9].map(refFoto), ['F1', 'F2', 'F10']);
});

Deno.test('rutaDeRef traduce referencias válidas y descarta inventos', () => {
  assertEquals(rutaDeRef('F1', FOTOS), 'uuid-de-a/f1.jpg');
  assertEquals(rutaDeRef(' f2 ', FOTOS), 'uuid-de-a/f2.jpg');
  assertEquals(rutaDeRef('F3', FOTOS), undefined);
  assertEquals(rutaDeRef('uuid-de-a/f1.jpg', FOTOS), undefined, 'una ruta cruda ya no se acepta');
  assertEquals(rutaDeRef(undefined, FOTOS), undefined);
});

Deno.test('lo que se manda a la IA no lleva rutas ni el nombre real', async () => {
  const fuente = await Deno.readTextFile(new URL('./recap.ts', import.meta.url));
  assertEquals(/select\('name/.test(fuente), false, 'no se lee profiles.name');
  assertEquals(/ruta: \$\{f\.path\}/.test(fuente), false, 'no se manda la ruta de Storage');
});
