// node --test scripts/tienda/__tests__/asc.test.mjs
// Nada de esto habla con Apple: el fetch de aplicarPlan es simulado.
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  aplicarPlan,
  cabeceraPng,
  construirPlan,
  dimensionesMoov,
  familiaDe,
  firmarJwt,
  inventariar,
  motivosAplicar,
  motivosInforme,
  tipoCaptura,
  tipoPreview,
} from '../asc.mjs';

function png(ancho, alto, tipoColor = 2) {
  const b = Buffer.alloc(33);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'latin1');
  b.writeUInt32BE(ancho, 16);
  b.writeUInt32BE(alto, 20);
  b[24] = 8;
  b[25] = tipoColor;
  return b;
}

function caja(nombre, cuerpo) {
  const b = Buffer.alloc(8);
  b.writeUInt32BE(cuerpo.length + 8, 0);
  b.write(nombre, 4, 'latin1');
  return Buffer.concat([b, cuerpo]);
}

function moov(ancho, alto) {
  const tkhd = Buffer.alloc(84);
  tkhd.writeUInt32BE(ancho << 16 >>> 0, 76);
  tkhd.writeUInt32BE(alto << 16 >>> 0, 80);
  return caja('trak', caja('tkhd', tkhd));
}

const OK = { final: true, validacion: { ok: true }, commit: 'abc1234' };

test('familia: Duo gana a iPhone, iPad no es iPhone', () => {
  assert.equal(familiaDe('iphone-duo-exterior'), 'duo');
  assert.equal(familiaDe('ipad-13'), 'ipad');
  assert.equal(familiaDe('iphone-69'), 'iphone');
  assert.equal(familiaDe('apple-tv'), 'tv');
  assert.equal(familiaDe('vision-pro'), 'vision');
  assert.equal(familiaDe('mac-16-10'), 'mac');
  assert.equal(familiaDe('android-telefono'), null);
});

test('captura: cada tamaño oficial cae en su tipo', () => {
  assert.equal(tipoCaptura('iphone', 1320, 2868).tipo, 'APP_IPHONE_67');
  assert.equal(tipoCaptura('iphone', 1206, 2622).tipo, 'APP_IPHONE_61');
  assert.equal(tipoCaptura('ipad', 2064, 2752).tipo, 'APP_IPAD_PRO_3GEN_129');
  assert.equal(tipoCaptura('tv', 3840, 2160).tipo, 'APP_APPLE_TV');
  assert.equal(tipoCaptura('watch', 416, 496).tipo, 'APP_WATCH_SERIES_10');
});

test('captura: Duo sin destino, tamaño ajeno rechazado, TV solo apaisado', () => {
  assert.equal(tipoCaptura('duo', 1398, 2034).tipo, null);
  assert.match(tipoCaptura('duo', 1398, 2034).motivo, /a mano/);
  assert.equal(tipoCaptura('iphone', 1000, 2000).tipo, null);
  assert.equal(tipoCaptura('tv', 2160, 3840).tipo, null);
});

test('preview: tamaños de App Preview', () => {
  assert.equal(tipoPreview('iphone', 886, 1920).tipo, 'IPHONE_67');
  assert.equal(tipoPreview('ipad', 1200, 1600).tipo, 'IPAD_PRO_3GEN_129');
  assert.equal(tipoPreview('tv', 1920, 1080).tipo, 'APPLE_TV');
  assert.equal(tipoPreview('watch', 416, 496).tipo, null);
});

test('cabeceras: PNG con alfa y dimensiones de MP4 v0', () => {
  assert.deepEqual(cabeceraPng(png(10, 20, 6)), { ancho: 10, alto: 20, alfa: true });
  assert.equal(cabeceraPng(png(10, 20, 2)).alfa, false);
  assert.throws(() => cabeceraPng(Buffer.alloc(40)));
  assert.deepEqual(dimensionesMoov(moov(886, 1920)), { ancho: 886, alto: 1920 });
});

test('informe: sin final, de muestra, sin validar o de otro commit no se sube', () => {
  assert.deepEqual(motivosInforme(OK, 'abc1234'), []);
  assert.equal(motivosInforme(null, 'abc1234').length, 1);
  assert.match(motivosInforme({ ...OK, final: false }, 'abc1234')[0], /final:true/);
  assert.match(motivosInforme({ ...OK, muestra: true }, 'abc1234')[0], /muestra/);
  assert.match(motivosInforme({ ...OK, validacion: { ok: false } }, 'abc1234')[0], /validación/);
  assert.match(motivosInforme(OK, 'fff0000')[0], /commit/);
});

test('aplicar: exige flag y variables, y la clave fuera del repo', () => {
  const m = motivosAplicar({ flags: new Set(['--aplicar']), env: {}, raizRepo: '/r' });
  assert.equal(m.length, 4);
  const dentro = motivosAplicar({
    flags: new Set(['--confirmo-subida']),
    env: { ASC_KEY_ID: 'x', ASC_ISSUER_ID: 'y', ASC_KEY_PATH: '/r/clave.p8' },
    raizRepo: '/r',
  });
  assert.match(dentro[0], /dentro del repo/);
});

test('JWT: cabecera, claims a menos de 20 minutos y firma ES256 válida', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const clavePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const jwt = firmarJwt({ keyId: 'KID', issuerId: 'ISS', clavePem, ahora: 1000 });
  const [c, p, f] = jwt.split('.');
  const cab = JSON.parse(Buffer.from(c, 'base64url'));
  const cuerpo = JSON.parse(Buffer.from(p, 'base64url'));
  assert.deepEqual(cab, { alg: 'ES256', kid: 'KID', typ: 'JWT' });
  assert.equal(cuerpo.aud, 'appstoreconnect-v1');
  assert.ok(cuerpo.exp - cuerpo.iat <= 20 * 60);
  assert.equal(Buffer.from(f, 'base64url').length, 64);
  const ok = verify('sha256', Buffer.from(`${c}.${p}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(f, 'base64url'));
  assert.equal(ok, true);
});

function tanda() {
  const dir = mkdtempSync(join(tmpdir(), 'asc-test-'));
  mkdirSync(join(dir, 'tienda', 'iphone-69'), { recursive: true });
  mkdirSync(join(dir, 'tienda', 'iphone-duo'), { recursive: true });
  mkdirSync(join(dir, 'videos', 'iphone-69'), { recursive: true });
  writeFileSync(join(dir, 'tienda', 'iphone-69', '02-b.png'), png(1320, 2868));
  writeFileSync(join(dir, 'tienda', 'iphone-69', '01-a.png'), png(1320, 2868));
  writeFileSync(join(dir, 'tienda', 'iphone-duo', '01-a.png'), png(1398, 2034));
  const ftyp = caja('ftyp', Buffer.alloc(8));
  writeFileSync(join(dir, 'videos', 'iphone-69', 'preview.mp4'), Buffer.concat([ftyp, caja('moov', moov(886, 1920))]));
  writeFileSync(join(dir, 'videos', 'iphone-69', 'largo.mp4'), ftyp);
  return dir;
}

const base = { sha7: 'abc1234', version: '1.0.11', locale: 'es-ES', ascAppId: '6801825007' };

test('plan: agrupa en orden, separa el Duo y el vídeo largo, avisa de lo que falta', (t) => {
  const dir = tanda();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const plan = construirPlan({ ...base, informe: OK, inventario: inventariar(dir) });
  assert.equal(plan.subible, true);
  const cap = plan.conjuntos.find((s) => s.tipo === 'APP_IPHONE_67');
  assert.deepEqual(cap.archivos.map((a) => a.split('/').pop()), ['01-a.png', '02-b.png']);
  assert.equal(cap.plataforma, 'IOS');
  assert.ok(plan.conjuntos.some((s) => s.tipo === 'IPHONE_67' && s.clase === 'preview'));
  assert.equal(plan.sinDestino.length, 2);
  assert.ok(plan.avisos.some((a) => a.includes('APP_IPHONE_61')));
  assert.ok(plan.avisos.some((a) => a.includes('iPad')));
});

test('plan: más de 10 capturas o una con alfa impiden subir', () => {
  const capturas = Array.from({ length: 11 }, (_, i) => ({ objetivo: 'iphone-69', archivo: `/x/${i}.png`, ancho: 1320, alto: 2868, alfa: i === 0, bytes: 1 }));
  const plan = construirPlan({ ...base, informe: OK, inventario: { capturas, previews: [], descartes: [] } });
  assert.equal(plan.subible, false);
  assert.equal(plan.errores.length, 2);
});

function apple({ estadoVersion = 'PREPARE_FOR_SUBMISSION', previos = [] } = {}) {
  const llamadas = [];
  let n = 0;
  const json = (o, status = 200) => ({ ok: status < 400, status, json: async () => o });
  const f = async (url, init) => {
    llamadas.push({ url, method: init.method, body: init.body, headers: init.headers });
    if (url.startsWith('https://blob.test')) return { ok: true, status: 200 };
    const ruta = url.replace('https://api.appstoreconnect.apple.com', '');
    const p = ruta.split('?')[0];
    if (p.endsWith('/appStoreVersions')) return json({ data: [{ id: 'V', attributes: { appVersionState: estadoVersion } }] });
    if (p.endsWith('/appStoreVersionLocalizations')) return json({ data: [{ id: 'L', attributes: { locale: 'es-ES' } }] });
    if (p.endsWith('/L/appScreenshotSets')) return json({ data: previos.length ? [{ id: 'S' }] : [] });
    if (p.endsWith('/S/appScreenshots')) return json({ data: previos.map((id) => ({ id })) });
    if (init.method === 'DELETE') return { ok: true, status: 204 };
    if (init.method === 'POST' && p === '/v1/appScreenshotSets') return json({ data: { id: 'S' } }, 201);
    if (init.method === 'POST' && p === '/v1/appScreenshots') {
      const size = JSON.parse(init.body).data.attributes.fileSize;
      return json({ data: { id: `A${++n}`, attributes: { uploadOperations: [
        { method: 'PUT', url: 'https://blob.test/1', offset: 0, length: 10, requestHeaders: [{ name: 'Content-Type', value: 'image/png' }] },
        { method: 'PUT', url: 'https://blob.test/2', offset: 10, length: size - 10, requestHeaders: [] },
      ] } } }, 201);
    }
    if (init.method === 'PATCH') return json({ data: {} });
    if (init.method === 'GET' && p.startsWith('/v1/appScreenshots/')) return json({ data: { attributes: { assetDeliveryState: { state: 'COMPLETE' } } } });
    throw new Error(`Llamada inesperada: ${init.method} ${ruta}`);
  };
  return { f, llamadas };
}

test('flujo: reserva, partes sin JWT, commit con MD5 y sondeo', async (t) => {
  const dir = tanda();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const inv = inventariar(dir);
  const plan = construirPlan({ ...base, informe: OK, inventario: { ...inv, previews: [], capturas: inv.capturas.filter((c) => c.objetivo === 'iphone-69').slice(0, 1) } });
  const { f, llamadas } = apple();
  const ids = await aplicarPlan({ plan, token: () => 'TOKEN', fetch: f, esperar: async () => {} });
  assert.deepEqual(ids, ['A1']);
  const partes = llamadas.filter((l) => l.url.startsWith('https://blob.test'));
  assert.equal(partes.length, 2);
  assert.ok(partes.every((p) => !p.headers.Authorization));
  assert.equal(partes[0].body.length + partes[1].body.length, png(1320, 2868).length);
  const commit = JSON.parse(llamadas.find((l) => l.method === 'PATCH').body).data;
  assert.equal(commit.attributes.uploaded, true);
  assert.equal(commit.attributes.sourceFileChecksum, createHash('md5').update(png(1320, 2868)).digest('hex'));
  const set = JSON.parse(llamadas.find((l) => l.url.endsWith('/v1/appScreenshotSets')).body).data;
  assert.equal(set.attributes.screenshotDisplayType, 'APP_IPHONE_67');
  assert.equal(set.relationships.appStoreVersionLocalization.data.id, 'L');
});

test('flujo: con material previo se para sin tocar nada; --reemplazar lo borra', async (t) => {
  const dir = tanda();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const inv = inventariar(dir);
  const plan = construirPlan({ ...base, informe: OK, inventario: { ...inv, previews: [], capturas: inv.capturas.filter((c) => c.objetivo === 'iphone-69') } });
  const a = apple({ previos: ['VIEJA'] });
  await assert.rejects(aplicarPlan({ plan, token: () => 'T', fetch: a.f, esperar: async () => {} }), /--reemplazar/);
  assert.ok(a.llamadas.every((l) => l.method === 'GET'));
  const b = apple({ previos: ['VIEJA'] });
  await aplicarPlan({ plan, token: () => 'T', fetch: b.f, reemplazar: true, esperar: async () => {} });
  assert.ok(b.llamadas.some((l) => l.method === 'DELETE' && l.url.endsWith('/v1/appScreenshots/VIEJA')));
});

test('flujo: versión ya enviada o informe no final, ni una escritura', async (t) => {
  const dir = tanda();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const inv = inventariar(dir);
  const capturas = inv.capturas.filter((c) => c.objetivo === 'iphone-69');
  const plan = construirPlan({ ...base, informe: OK, inventario: { ...inv, previews: [], capturas } });
  const a = apple({ estadoVersion: 'READY_FOR_DISTRIBUTION' });
  await assert.rejects(aplicarPlan({ plan, token: () => 'T', fetch: a.f, esperar: async () => {} }), /no se puede editar/);
  assert.ok(a.llamadas.every((l) => l.method === 'GET'));
  const muestra = construirPlan({ ...base, informe: { ...OK, final: false }, inventario: { ...inv, previews: [], capturas } });
  const b = apple();
  await assert.rejects(aplicarPlan({ plan: muestra, token: () => 'T', fetch: b.f, esperar: async () => {} }), /No se sube/);
  assert.equal(b.llamadas.length, 0);
});

test('el inventario entra en las subcarpetas de clase del reloj', () => {
  const dir = mkdtempSync(join(tmpdir(), 'asc-reloj-'));
  try {
    mkdirSync(join(dir, 'tienda/watch/ultra-4'), { recursive: true });
    const png = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]).copy(png);
    png.writeUInt32BE(422, 16);
    png.writeUInt32BE(514, 20);
    png[24] = 8;
    png[25] = 2;
    writeFileSync(join(dir, 'tienda/watch/ultra-4/01-hoy.png'), png);
    const inv = inventariar(dir);
    assert.deepEqual(inv.descartes, []);
    assert.equal(inv.capturas.length, 1);
    assert.equal(inv.capturas[0].objetivo, 'watch');
    assert.equal(inv.capturas[0].ancho, 422);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('dos objetivos con el mismo tipo de preview: se queda el de 6,9', () => {
  const previews = ['iphone-63', 'iphone-69'].map((objetivo) => ({ objetivo, archivo: `${objetivo}.mp4`, bytes: 1, ancho: 886, alto: 1920 }));
  const plan = construirPlan({ informe: {}, inventario: { capturas: [], previews, descartes: [] }, sha7: 'abc1234', version: '1', locale: 'es-ES', ascAppId: '1' });
  const conjunto = plan.conjuntos.find((s) => s.clase === 'preview');
  assert.deepEqual(conjunto.archivos, ['iphone-69.mp4']);
  assert.match(plan.sinDestino[0].motivo, /se sube uno/);
});

test('Mac y Vision no tienen binario: nunca entran en el plan', () => {
  assert.match(tipoCaptura('mac', 2880, 1800).motivo, /no una app nativa de Mac/);
  assert.equal(tipoCaptura('mac', 2880, 1800).tipo, null);
  assert.match(tipoCaptura('vision', 3840, 2160).motivo, /modo compatible/);
  assert.equal(tipoCaptura('vision', 3840, 2160).tipo, null);
  assert.equal(tipoPreview('mac', 1920, 1080).tipo, null);
  assert.equal(tipoPreview('vision', 3840, 2160).tipo, null);
  const capturas = [
    { objetivo: 'mac', archivo: '/x/mac.png', ancho: 2880, alto: 1800, alfa: false, bytes: 1 },
    { objetivo: 'vision-pro', archivo: '/x/vision.png', ancho: 3840, alto: 2160, alfa: false, bytes: 1 },
    { objetivo: 'ipad-13', archivo: '/x/ipad.png', ancho: 2064, alto: 2752, alfa: false, bytes: 1 },
  ];
  const informe = { ...OK, objetivos: [{ id: 'mac', familia: 'mac' }, { id: 'vision-pro', familia: 'vision' }, { id: 'ipad-13', familia: 'ipad' }] };
  const plan = construirPlan({ ...base, informe, inventario: { capturas, previews: [], descartes: [] } });
  assert.deepEqual([...new Set(plan.conjuntos.map((s) => s.plataforma))], ['IOS']);
  assert.deepEqual(plan.sinDestino.map((d) => d.archivo), ['/x/mac.png', '/x/vision.png']);
  assert.ok(plan.sinDestino.every((d) => /no se sube/.test(d.motivo)));
});
