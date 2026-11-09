// Filtro de perfiles (0143): alias y título fallan abiertos, la foto falla cerrada y sin permiso no sale.
import { deepEqual, equal, ok } from 'node:assert/strict';
import { RefusalError, type Turn } from '../_shared/anthropic.ts';
import { crearHandler, tipoImagen } from './handler.ts';

Deno.env.set('SUPABASE_URL', 'http://fake.local');

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

interface Caso {
  perfil?: Record<string, unknown>;
  revision?: Record<string, unknown>;
  consiente?: boolean;
  cupo?: boolean;
  foto?: Uint8Array | null;
  modelo?: (o: any) => Promise<Turn>;
}

function montar(c: Caso) {
  const rpcs: Record<string, any>[] = [];
  const llamadas: any[] = [];
  const admin = {
    auth: { getUser: (t: string) => Promise.resolve(t === 'bueno' ? { data: { user: { id: 'u1' } }, error: null } : { data: { user: null }, error: { message: 'x' } }) },
    from: (tabla: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => {
            if (tabla === 'profiles') return Promise.resolve({ data: { id: 'u1', name: 'Marco', avatar_url: 'u1/a.jpg', equipped_title: null, ...c.perfil }, error: null });
            if (tabla === 'social_profile_reviews') return Promise.resolve({ data: { status: 'approved', nombre_estado: 'pendiente', titulo_estado: null, foto_estado: 'pendiente', foto_permiso_path: 'u1/a.jpg', ...c.revision }, error: null });
            return Promise.resolve({ data: { accepted_at: c.consiente === false ? null : 'x', ai_consent_at: c.consiente === false ? null : 'x', ai_consent_version: 'x' }, error: null });
          },
        }),
      }),
    }),
    storage: { from: () => ({ download: () => Promise.resolve(c.foto === null ? { data: null, error: { message: 'x' } } : { data: new Blob([(c.foto ?? JPEG) as BlobPart]), error: null }) }) },
    rpc: (nombre: string, args: any) => {
      rpcs.push({ nombre, ...args });
      if (nombre === 'social_filtro_reservar') return Promise.resolve({ data: c.cupo !== false, error: null });
      if (nombre === 'social_filtro_aplicar') return Promise.resolve({ data: { nombre: args.p_nombre, titulo: args.p_titulo, foto: args.p_foto }, error: null });
      if (nombre === 'ai_consent_ok' || nombre.includes('consent')) return Promise.resolve({ data: c.consiente !== false, error: null });
      return Promise.resolve({ data: null, error: null });
    },
  };
  const llamarModelo = (o: any) => {
    llamadas.push(o);
    if (c.modelo) return c.modelo(o);
    const campos = Object.keys(o.formato.schema.properties);
    return Promise.resolve({ content: [{ type: 'text', text: JSON.stringify(Object.fromEntries(campos.map((k) => [k, 'aceptar']))) }], stopReason: 'end_turn', usage: {}, model: 'claude-haiku-5-5' } as Turn);
  };
  return { h: crearHandler({ admin: admin as never, llamarModelo: llamarModelo as never }), rpcs, llamadas };
}

const pedir = (token = 'bueno') => new Request('http://x/', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: '{}' });
const aplicado = (r: Record<string, any>[]) => r.find((x) => x.nombre === 'social_filtro_aplicar')!;

Deno.test('sin sesión válida no hace nada', async () => {
  const m = montar({});
  equal((await m.h(pedir('malo'))).status, 401);
  equal(m.llamadas.length, 0);
});

Deno.test('todo en regla: alias y foto salen al modelo con Haiku 5.5 y se publican', async () => {
  const m = montar({});
  deepEqual(await (await m.h(pedir())).json(), { nombre: 'ok', titulo: null, foto: 'ok' });
  equal(m.llamadas.length, 2);
  for (const l of m.llamadas) {
    equal(l.model, 'claude-haiku-5-5');
    equal(l.effort, 'low');
    equal(l.formato.type, 'json_schema');
  }
  ok(m.llamadas.some((l) => l.messages[0].content[0].type === 'image'));
});

Deno.test('sin permiso para esa foto, no sale y queda para revisión manual', async () => {
  const m = montar({ revision: { foto_permiso_path: null } });
  await m.h(pedir());
  equal(aplicado(m.rpcs).p_foto, 'revision');
  equal(m.llamadas.some((l) => l.messages[0].content[0].type === 'image'), false);
});

Deno.test('sin consentimiento de IA, el alias no sale y vale con la lista de la base', async () => {
  const m = montar({ consiente: false, revision: { foto_estado: null } });
  await m.h(pedir());
  equal(aplicado(m.rpcs).p_nombre, 'ok');
  equal(m.llamadas.length, 0);
});

Deno.test('modelo caído: el texto falla abierto y la foto falla cerrada', async () => {
  const m = montar({ modelo: () => Promise.reject(new Error('anthropic 500: x')) });
  await m.h(pedir());
  equal(aplicado(m.rpcs).p_nombre, 'ok');
  equal(aplicado(m.rpcs).p_foto, 'revision');
});

Deno.test('rechazo del clasificador: el texto no se publica y la foto queda oculta', async () => {
  const m = montar({ modelo: () => Promise.reject(new RefusalError('general_harms')) });
  await m.h(pedir());
  equal(aplicado(m.rpcs).p_nombre, 'rechazado');
  equal(aplicado(m.rpcs).p_foto, 'revision');
});

Deno.test('el modelo rechaza: se aplica su veredicto; una respuesta rara en la foto no aprueba', async () => {
  const m = montar({ modelo: (o) => Promise.resolve({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(Object.fromEntries(Object.keys(o.formato.schema.properties).map((k) => [k, k === 'foto' ? 'quizas' : 'rechazar']))) }], stopReason: 'end_turn', usage: {}, model: 'claude-haiku-5-5' } as Turn) });
  await m.h(pedir());
  equal(aplicado(m.rpcs).p_nombre, 'rechazado');
  equal(aplicado(m.rpcs).p_foto, 'revision');
});

Deno.test('foto ilegible, formato raro o suspendido: no se aprueba nada', async () => {
  for (const foto of [null, new Uint8Array([1, 2, 3, 4])]) {
    const m = montar({ foto, revision: { nombre_estado: 'ok' } });
    await m.h(pedir());
    equal(aplicado(m.rpcs).p_foto, 'revision');
    equal(m.llamadas.length, 0);
  }
  const m = montar({ revision: { status: 'suspended' } });
  await m.h(pedir());
  equal(aplicado(m.rpcs), undefined);
});

Deno.test('nada pendiente: ni modelo ni escritura', async () => {
  const m = montar({ revision: { nombre_estado: 'ok', foto_estado: 'ok' } });
  deepEqual(await (await m.h(pedir())).json(), { nombre: 'ok', titulo: null, foto: 'ok' });
  equal(m.llamadas.length, 0);
  equal(aplicado(m.rpcs), undefined);
});

Deno.test('tipoImagen mira los bytes', () => {
  equal(tipoImagen(JPEG), 'image/jpeg');
  equal(tipoImagen(new Uint8Array([0x3c, 0x73, 0x76, 0x67])), null);
});
