// Pruebas de la función `economia` con un backend simulado (sin red).
// deno test --allow-env supabase/functions/economia/handler_test.ts
import { assert, assertEquals } from 'jsr:@std/assert@1';
import type { Db } from '../_shared/db.ts';
import { cerrarBrief, costeMaximo, crearHandler, leerCuerpo, MAX_COSTE_PDF_MICRO_USD, paginasPdf, type Deps } from './handler.ts';

const pdf = (cuerpo: string) => btoa(`%PDF-1.7\n${cuerpo}\n%%EOF`);

Deno.test('paginasPdf: árbol, objetos, sin contar y no PDF', () => {
  assertEquals(paginasPdf(pdf('<< /Type /Pages /Kids [1 0 R] /Count 3 >>')), 3);
  assertEquals(paginasPdf(pdf('<< /Type /Page >> << /Type /Page >>')), 2);
  // Object streams: nada legible en claro. 0 = «no lo sé».
  assertEquals(paginasPdf(pdf('xref stream comprimido')), 0);
  assertEquals(paginasPdf(btoa('hola')), -1);
});

Deno.test('costeMaximo: el tope corta antes de llamar', () => {
  assert(costeMaximo('claude-haiku-4-5', 60_000, 8000) <= MAX_COSTE_PDF_MICRO_USD);
  assert(costeMaximo('claude-haiku-4-5', 200_000, 8000) > MAX_COSTE_PDF_MICRO_USD);
});

Deno.test('leerCuerpo corta sin content-length', async () => {
  const stream = new ReadableStream({
    start(c) {
      for (let i = 0; i < 10; i++) c.enqueue(new Uint8Array(1000));
      c.close();
    },
  });
  assertEquals(await leerCuerpo(new Request('http://x', { method: 'POST', body: stream }), 5000), null);
  assertEquals(await leerCuerpo(new Request('http://x', { method: 'POST', body: '{"a":1}' }), 5000), '{"a":1}');
});

Deno.test('cerrarBrief: sin guiones y siempre con el aviso', () => {
  const t = cerrarBrief('Gastaste más — sobre todo en comida.');
  assert(!/[–—]/.test(t));
  assert(t.endsWith('Esto no es asesoramiento financiero.'));
});

function deps(over: Partial<Deps> = {}): { deps: Deps; llamadas: string[] } {
  const llamadas: string[] = [];
  const consulta = {
    select: () => consulta,
    eq: () => consulta,
    gte: () => consulta,
    maybeSingle: () => Promise.resolve({ data: null }),
    insert: () => Promise.resolve({ error: null }),
    upsert: () => Promise.resolve({ error: null }),
    then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
  };
  const admin = {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null }) },
    rpc: (n: string) => {
      llamadas.push(n);
      if (n === 'ai_consent_ok') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: { allowed: true }, error: null });
    },
    from: () => consulta,
  } as unknown as Db;
  return {
    llamadas,
    deps: {
      admin,
      userClient: () => ({ from: () => consulta }) as unknown as Db,
      llamarModelo: () => {
        llamadas.push('modelo');
        return Promise.resolve({ content: [{ type: 'text', text: '2026-10-02|-45,20|MERCADONA' }], stopReason: 'end_turn', usage: {}, model: 'claude-haiku-4-5' });
      },
      contarFichas: () => Promise.resolve(1000),
      leerPdf: () =>
        Promise.resolve({
          paginas: 2,
          texto: 'IBAN ES91 2100 0418 4502 0005 1332\n02/10/2026 COMPRA TARJ. MERCADONA 4471 -45,20\n03/10/2026 NOMINA 2.150,00',
        }),
      ...over,
    },
  };
}

const peticion = (cuerpo: unknown) =>
  new Request('http://x', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(cuerpo) });

Deno.test('el CSV no se acepta en el servidor', async () => {
  const { deps: d, llamadas } = deps();
  const r = await crearHandler(d)(peticion({ accion: 'extracto', tipo: 'csv', contenido: 'a;b', cuenta: 'X' }));
  assertEquals(r.status, 400);
  assertEquals(llamadas.includes('modelo'), false);
});

Deno.test('PDF sin páginas contables y grande: rechazado sin IA', async () => {
  const { deps: d, llamadas } = deps();
  const grande = pdf('x'.repeat(1_200_000));
  const r = await crearHandler(d)(peticion({ accion: 'extracto', tipo: 'pdf', contenido: grande, cuenta: 'X' }));
  assertEquals(r.status, 413);
  assertEquals(llamadas.includes('modelo'), false);
});

Deno.test('PDF con demasiadas fichas: rechazado sin llamar al modelo y soltando el turno', async () => {
  const { deps: d, llamadas } = deps({ contarFichas: () => Promise.resolve(150_000) });
  const r = await crearHandler(d)(peticion({ accion: 'extracto', tipo: 'pdf', contenido: pdf('pequeño'), cuenta: 'X' }));
  assertEquals(r.status, 413);
  assertEquals(llamadas.includes('modelo'), false);
  assert(llamadas.includes('ai_end_turn'));
});

Deno.test('páginas reales por encima del tope (object streams incluidos): rechazado sin IA', async () => {
  const { deps: d, llamadas } = deps({ leerPdf: () => Promise.resolve({ paginas: 40, texto: 'x'.repeat(500) }) });
  const r = await crearHandler(d)(peticion({ accion: 'extracto', tipo: 'pdf', contenido: pdf('comprimido'), cuenta: 'X' }));
  assertEquals(r.status, 413);
  assertEquals(llamadas.includes('modelo'), false);
});

Deno.test('PDF escaneado (sin texto): no se manda a la IA', async () => {
  const { deps: d, llamadas } = deps({ leerPdf: () => Promise.resolve({ paginas: 2, texto: '  ' }) });
  const r = await crearHandler(d)(peticion({ accion: 'extracto', tipo: 'pdf', contenido: pdf('imagen'), cuenta: 'X' }));
  assertEquals(r.status, 422);
  assertEquals(llamadas.includes('modelo'), false);
});

Deno.test('a la IA llega el texto con el IBAN enmascarado, nunca el PDF', async () => {
  let enviado = '';
  const { deps: d } = deps({
    llamarModelo: (o) => {
      enviado = JSON.stringify(o.messages);
      return Promise.resolve({ content: [{ type: 'text', text: '2026-10-02|-45,20|MERCADONA' }], stopReason: 'end_turn', usage: {}, model: 'claude-haiku-4-5' });
    },
  });
  const r = await crearHandler(d)(peticion({ accion: 'extracto', tipo: 'pdf', contenido: pdf('pequeño'), cuenta: 'X' }));
  assertEquals(r.status, 200);
  assert(!enviado.includes('2100 0418'));
  assert(enviado.includes('ES** **** 1332'));
  assert(!enviado.includes('"document"'));
});

Deno.test({
  name: 'unpdf: páginas y texto reales de un PDF de prueba',
  ignore: Deno.env.get('SIN_RED') === '1',
  fn: async () => {
    const { leerPdfUnpdf } = await import('./handler.ts');
    const bytes = await Deno.readFile(new URL('./fixtures/extracto-prueba.pdf', import.meta.url));
    const r = await leerPdfUnpdf(bytes);
    assertEquals(r.paginas, 3);
    assert(r.texto.includes('MERCADONA'));
  },
});

Deno.test('PDF dentro de los topes: propuesta', async () => {
  const { deps: d, llamadas } = deps();
  const r = await crearHandler(d)(peticion({ accion: 'extracto', tipo: 'pdf', contenido: pdf('pequeño'), cuenta: 'Revolut' }));
  assertEquals(r.status, 200);
  const body = await r.json();
  assertEquals(body.filas.length, 1);
  assertEquals(body.filas[0].categoria, 'super');
  assert(llamadas.includes('modelo'));
  assert(llamadas.includes('ai_end_turn'));
});
