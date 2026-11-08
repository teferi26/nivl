#!/usr/bin/env node
// NIVL · Subida de capturas y vídeos a App Store Connect.
//
// Por defecto SOLO hace el plan: lee .tienda/salida/<sha7>/ y escribe qué
// archivo va a qué tipo de pantalla, plataforma, versión y locale. No habla
// con Apple y no necesita claves.
//
//   node scripts/tienda/asc.mjs [plan] --commit <sha> [--version 1.0.11] [--locale es-ES]
//   node scripts/tienda/asc.mjs --aplicar --confirmo-subida --commit <sha> [--reemplazar]
//
// --aplicar exige ASC_KEY_ID, ASC_ISSUER_ID y ASC_KEY_PATH (la clave .p8 fuera
// del repo, que es público), el flag --confirmo-subida y un informe con
// final:true y validación OK. Si una versión ya tiene capturas, se para salvo
// --reemplazar, que borra las de ese tipo antes de subir las nuevas.
//
// QUÉ ESTÁ VERIFICADO (documentación de Apple leída el 2026-11-08)
// - Flujo de reserva, subida por partes y commit con MD5: artículo «Uploading
//   assets to App Store Connect».
// - Rutas, atributos y relaciones de appScreenshotSets, appScreenshots,
//   appPreviewSets, appPreviews, appStoreVersions y sus localizaciones, y los
//   enumerados ScreenshotDisplayType, PreviewType y AppVersionState.
// - JWT: ES256, kid, iss, iat, exp a 20 minutos como máximo, aud.
//
// QUÉ NO ESTÁ VERIFICADO
// - DEPRECADO: desde la versión 4.5 del API, Apple marca todas estas rutas como
//   deprecadas en favor de App Asset Library (appAssetLibraryImages, placements).
//   No publica fecha de retirada ni dice hasta cuándo funcionan. Si responden
//   404 o 410, hay que migrar este archivo. Ver docs/tienda/PLATAFORMAS.md.
// - Qué resolución cae en qué tipo: Apple no publica esa tabla para el API
//   antiguo. Las de iPhone e iPad salen de fastlane (deliver/app_screenshot.rb);
//   las de TV y Watch son deducción por nombre del tipo.
// - iPhone Duo no tiene valor en ScreenshotDisplayType: solo existe IPHONE_DUO
//   en App Asset Library. El plan lo deja sin destino y hay que subirlo a mano.
// - Los estados editables (ESTADOS_EDITABLES) son criterio propio; Apple solo
//   nombra PREPARE_FOR_SUBMISSION como superficie editable.
// - Este archivo nunca se ha ejecutado contra Apple; el flujo está probado con
//   un fetch simulado en __tests__/asc.test.mjs.

import { createHash, createPrivateKey, sign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const API = 'https://api.appstoreconnect.apple.com';
const MAX_CAPTURAS = 10;
const MAX_PREVIEWS = 3;
const MAX_BYTES_PREVIEW = 500 * 1024 * 1024;

/** Criterio propio, no publicado por Apple: lo demás se para antes de tocar nada. */
export const ESTADOS_EDITABLES = new Set([
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
]);

const dims = (...pares) => new Set(pares.map(([a, l]) => `${a}x${l}`));

/** Familia → plataforma de Apple. El reloj va con la app de iPhone (IOS). */
const PLATAFORMA = { iphone: 'IOS', ipad: 'IOS', watch: 'IOS', duo: 'IOS', tv: 'TV_OS' };

/**
 * Familias sin binario propio: lo que se captura no es el producto que se instala
 * (guideline 2.3) y no hay versión de esa plataforma donde colgarlo. Cuando exista
 * el target nativo, se quita de aquí y se añade a PLATAFORMA, CAPTURAS y PREVIEWS
 * (MAC_OS con APP_DESKTOP y DESKTOP, VISION_OS con APP_APPLE_VISION_PRO y APPLE_VISION_PRO).
 */
const SIN_BINARIO = {
  mac: 'Es la web de escritorio, no una app nativa de Mac, y NIVL no tiene binario de macOS: no se sube. En un Mac con Apple silicon la app de iPad usa las capturas de iPad. Queda como material web.',
  vision: 'Es la app de iPad en modo compatible y NIVL no tiene objetivo visionOS: no se sube. En Vision Pro la app de iPad usa las capturas de iPad.',
};

// ── Tablas de destino ────────────────────────────────────────────────
const CAPTURAS = {
  iphone: [
    { tipo: 'APP_IPHONE_67', tam: dims([1320, 2868], [1290, 2796], [1260, 2736]) },
    { tipo: 'APP_IPHONE_61', tam: dims([1206, 2622], [1179, 2556]) },
  ],
  ipad: [{ tipo: 'APP_IPAD_PRO_3GEN_129', tam: dims([2064, 2752], [2048, 2732]) }],
  tv: [{ tipo: 'APP_APPLE_TV', tam: dims([3840, 2160], [1920, 1080]), soloApaisado: true }],
  watch: [
    { tipo: 'APP_WATCH_ULTRA', tam: dims([422, 514], [410, 502]) },
    { tipo: 'APP_WATCH_SERIES_10', tam: dims([416, 496]) },
    { tipo: 'APP_WATCH_SERIES_7', tam: dims([396, 484]) },
    { tipo: 'APP_WATCH_SERIES_4', tam: dims([368, 448]) },
    { tipo: 'APP_WATCH_SERIES_3', tam: dims([312, 390]) },
  ],
};

const PREVIEWS = {
  iphone: { tipo: 'IPHONE_67', tam: dims([886, 1920]) },
  ipad: { tipo: 'IPAD_PRO_3GEN_129', tam: dims([1200, 1600]) },
  tv: { tipo: 'APPLE_TV', tam: dims([1920, 1080]), soloApaisado: true },
};

const casa = (regla, ancho, alto) => regla.tam.has(`${ancho}x${alto}`) || (!regla.soloApaisado && regla.tam.has(`${alto}x${ancho}`));

/** Deduce la familia del id y la familia declarados por el objetivo. Duo antes que iPhone. */
export function familiaDe(objetivo, familia = '') {
  const t = `${objetivo} ${familia}`.toLowerCase();
  if (/duo/.test(t)) return 'duo';
  if (/ipad/.test(t)) return 'ipad';
  if (/iphone/.test(t)) return 'iphone';
  if (/watch|reloj/.test(t)) return 'watch';
  if (/vision/.test(t)) return 'vision';
  if (/\btv\b|apple-?tv|tvos/.test(t)) return 'tv';
  if (/mac/.test(t)) return 'mac';
  return null;
}

/** Tipo de captura para esa familia y resolución, o el motivo por el que no lo hay. */
export function tipoCaptura(familia, ancho, alto) {
  if (familia === 'duo') {
    return { tipo: null, motivo: 'iPhone Duo no existe en ScreenshotDisplayType (solo en App Asset Library, IPHONE_DUO): subir a mano en App Store Connect.' };
  }
  if (SIN_BINARIO[familia]) return { tipo: null, motivo: SIN_BINARIO[familia] };
  const reglas = CAPTURAS[familia];
  if (!reglas) return { tipo: null, motivo: `Familia sin destino en App Store Connect: ${familia ?? 'desconocida'}.` };
  const r = reglas.find((x) => casa(x, ancho, alto));
  return r ? { tipo: r.tipo } : { tipo: null, motivo: `Resolución ${ancho}x${alto} no aceptada para ${familia}.` };
}

/** Tipo de App Preview. El Duo comparte 886x1920 con iPhone, pero sin tipo propio en este API. */
export function tipoPreview(familia, ancho, alto) {
  if (familia === 'duo') return { tipo: null, motivo: 'iPhone Duo sin PreviewType propio en este API: subir a mano.' };
  if (SIN_BINARIO[familia]) return { tipo: null, motivo: SIN_BINARIO[familia] };
  const r = PREVIEWS[familia];
  if (!r) return { tipo: null, motivo: `Familia sin App Preview: ${familia ?? 'desconocida'}.` };
  return casa(r, ancho, alto) ? { tipo: r.tipo } : { tipo: null, motivo: `Resolución ${ancho}x${alto} no aceptada para App Preview de ${familia}.` };
}

// ── Lectura de archivos ──────────────────────────────────────────────
/** Ancho, alto y si tiene alfa, de la cabecera IHDR de un PNG. */
export function cabeceraPng(buf) {
  const firma = '89504e470d0a1a0a';
  if (buf.length < 26 || buf.subarray(0, 8).toString('hex') !== firma) throw new Error('No es un PNG válido.');
  const tipoColor = buf[25];
  return { ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20), alfa: tipoColor === 4 || tipoColor === 6 };
}

function* cajas(buf, inicio, fin) {
  let p = inicio;
  while (p + 8 <= fin) {
    let tam = buf.readUInt32BE(p);
    const nombre = buf.toString('latin1', p + 4, p + 8);
    let cabecera = 8;
    if (tam === 1) {
      tam = Number(buf.readBigUInt64BE(p + 8));
      cabecera = 16;
    } else if (tam === 0) {
      tam = fin - p;
    }
    if (tam < cabecera || p + tam > fin) return;
    yield { nombre, ini: p + cabecera, fin: p + tam };
    p += tam;
  }
}

/** Dimensiones de la primera pista de vídeo, a partir del contenido de la caja moov. */
export function dimensionesMoov(moov) {
  for (const trak of cajas(moov, 0, moov.length)) {
    if (trak.nombre !== 'trak') continue;
    for (const c of cajas(moov, trak.ini, trak.fin)) {
      if (c.nombre !== 'tkhd') continue;
      const version = moov[c.ini];
      const base = c.ini + (version === 1 ? 88 : 76);
      const ancho = moov.readUInt32BE(base) >>> 16;
      const alto = moov.readUInt32BE(base + 4) >>> 16;
      if (ancho > 0 && alto > 0) return { ancho, alto };
    }
  }
  throw new Error('El MP4 no tiene pista de vídeo.');
}

function dimensionesMp4(ruta) {
  const fd = openSync(ruta, 'r');
  try {
    const total = statSync(ruta).size;
    const cab = Buffer.alloc(16);
    let p = 0;
    while (p + 8 <= total) {
      readSync(fd, cab, 0, 16, p);
      let tam = cab.readUInt32BE(0);
      const nombre = cab.toString('latin1', 4, 8);
      let hdr = 8;
      if (tam === 1) {
        tam = Number(cab.readBigUInt64BE(8));
        hdr = 16;
      } else if (tam === 0) {
        tam = total - p;
      }
      if (tam < hdr) break;
      if (nombre === 'moov') {
        const moov = Buffer.alloc(tam - hdr);
        readSync(fd, moov, 0, moov.length, p + hdr);
        return dimensionesMoov(moov);
      }
      p += tam;
    }
    throw new Error('El MP4 no tiene caja moov.');
  } finally {
    closeSync(fd);
  }
}

function leerCabeceraPng(ruta) {
  const fd = openSync(ruta, 'r');
  try {
    const buf = Buffer.alloc(26);
    readSync(fd, buf, 0, 26, 0);
    return cabeceraPng(buf);
  } finally {
    closeSync(fd);
  }
}

const subdirs = (d) => (existsSync(d) ? readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : []);

/** Lo que hay en disco. La verdad son los archivos; el informe solo autoriza. */
export function inventariar(dirSha) {
  const capturas = [];
  const previews = [];
  const descartes = [];
  const dirTienda = join(dirSha, 'tienda');
  for (const objetivo of subdirs(dirTienda)) {
    // El reloj trae una subcarpeta por clase de tamaño: tienda/watch/<clase>/NN.png.
    const base = join(dirTienda, objetivo);
    const nombres = [...subdirs(base).flatMap((c) => readdirSync(join(base, c)).sort().map((n) => join(c, n))), ...readdirSync(base).filter((n) => !statSync(join(base, n)).isDirectory()).sort()];
    for (const nombre of nombres) {
      if (basename(nombre).startsWith('.')) continue;
      const ruta = join(base, nombre);
      if (!nombre.toLowerCase().endsWith('.png')) {
        descartes.push({ archivo: ruta, motivo: 'Solo se suben PNG.' });
        continue;
      }
      try {
        capturas.push({ objetivo, archivo: ruta, bytes: statSync(ruta).size, ...leerCabeceraPng(ruta) });
      } catch (e) {
        descartes.push({ archivo: ruta, motivo: e.message });
      }
    }
  }
  const dirVideos = join(dirSha, 'videos');
  for (const objetivo of subdirs(dirVideos)) {
    const ruta = join(dirVideos, objetivo, 'preview.mp4');
    if (existsSync(ruta)) {
      try {
        previews.push({ objetivo, archivo: ruta, bytes: statSync(ruta).size, ...dimensionesMp4(ruta) });
      } catch (e) {
        descartes.push({ archivo: ruta, motivo: e.message });
      }
    }
    if (existsSync(join(dirVideos, objetivo, 'largo.mp4'))) {
      descartes.push({ archivo: join(dirVideos, objetivo, 'largo.mp4'), motivo: 'El vídeo largo no es App Preview: no se sube.' });
    }
  }
  return { capturas, previews, descartes };
}

// ── Autorización ─────────────────────────────────────────────────────
/** La validación puede venir como {ok:true}, 'OK' o validacionOk:true. Lo demás es no. */
export function validacionOk(informe) {
  const v = informe?.validacion;
  if (informe?.validacionOk === true) return true;
  if (v === 'OK') return true;
  return !!v && typeof v === 'object' && v.ok === true;
}

/** Motivos por los que este informe no se puede subir. Vacío = se puede. */
export function motivosInforme(informe, sha7) {
  const m = [];
  if (!informe || typeof informe !== 'object') return ['No hay informe.json legible.'];
  if (informe.final !== true) m.push('El informe no dice final:true (es una tanda de muestra o sin terminar).');
  if (informe.muestra === true) m.push('El informe es de una tanda de muestra.');
  if (!validacionOk(informe)) m.push('El informe no trae la validación en OK.');
  const commit = typeof informe.commit === 'string' ? informe.commit : informe.sha7;
  if (typeof commit === 'string' && commit.slice(0, 7) !== sha7) m.push(`El informe es del commit ${commit.slice(0, 7)}, no de ${sha7}.`);
  return m;
}

/** Faltas para poder usar --aplicar: flag explícito y las tres variables, sin claves dentro del repo. */
export function motivosAplicar({ flags, env, raizRepo = RAIZ_REPO }) {
  const m = [];
  if (!flags.has('--confirmo-subida')) m.push('Falta el flag explícito --confirmo-subida.');
  for (const v of ['ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_PATH']) {
    if (!env[v]) m.push(`Falta la variable ${v}.`);
  }
  if (env.ASC_KEY_PATH) {
    const ruta = resolve(env.ASC_KEY_PATH);
    if (ruta === raizRepo || ruta.startsWith(raizRepo + sep)) m.push('ASC_KEY_PATH apunta dentro del repo, que es público: mueve la clave .p8 fuera.');
    else if (!existsSync(ruta)) m.push(`No existe el archivo de ASC_KEY_PATH: ${ruta}.`);
  }
  return m;
}

// ── El plan ──────────────────────────────────────────────────────────
function agrupar(destinos) {
  const mapa = new Map();
  for (const d of destinos) {
    const k = `${d.plataforma}|${d.clase}|${d.tipo}`;
    if (!mapa.has(k)) mapa.set(k, { plataforma: d.plataforma, clase: d.clase, tipo: d.tipo, archivos: [] });
    mapa.get(k).archivos.push(d.archivo);
  }
  return [...mapa.values()];
}

/**
 * Convierte el inventario en destinos. Puro. `familias` trae las declaradas en
 * el informe por id de objetivo; si no, se deducen del nombre de la carpeta.
 */
export function construirPlan({ informe, inventario, sha7, version, locale, ascAppId }) {
  const familias = new Map((Array.isArray(informe?.objetivos) ? informe.objetivos : []).filter((o) => o && o.id).map((o) => [o.id, o.familia]));
  const sinDestino = [...inventario.descartes];
  const errores = [];
  const destinos = [];
  for (const c of inventario.capturas) {
    const familia = familiaDe(c.objetivo, familias.get(c.objetivo));
    if (c.alfa) errores.push(`${c.archivo}: tiene canal alfa y Apple lo rechaza.`);
    const r = tipoCaptura(familia, c.ancho, c.alto);
    if (!r.tipo) {
      sinDestino.push({ archivo: c.archivo, motivo: r.motivo });
      continue;
    }
    destinos.push({ clase: 'captura', plataforma: PLATAFORMA[familia], tipo: r.tipo, archivo: c.archivo });
  }
  // iPhone 6,9 y 6,3 graban 886x1920 y caen en el mismo tipo: se sube uno, el del mayor.
  const previews = [...inventario.previews].sort((a, b) => b.objetivo.includes('69') - a.objetivo.includes('69'));
  const tiposPreview = new Set();
  for (const p of previews) {
    const familia = familiaDe(p.objetivo, familias.get(p.objetivo));
    if (p.bytes > MAX_BYTES_PREVIEW) errores.push(`${p.archivo}: supera 500 MB.`);
    const r = tipoPreview(familia, p.ancho, p.alto);
    if (!r.tipo) {
      sinDestino.push({ archivo: p.archivo, motivo: r.motivo });
      continue;
    }
    if (tiposPreview.has(r.tipo)) {
      sinDestino.push({ archivo: p.archivo, motivo: `Otro objetivo ya ocupa ${r.tipo}: se sube uno por tipo.` });
      continue;
    }
    tiposPreview.add(r.tipo);
    destinos.push({ clase: 'preview', plataforma: PLATAFORMA[familia], tipo: r.tipo, archivo: p.archivo });
  }
  const conjuntos = agrupar(destinos);
  for (const s of conjuntos) {
    const max = s.clase === 'captura' ? MAX_CAPTURAS : MAX_PREVIEWS;
    if (s.archivos.length > max) errores.push(`${s.tipo}: ${s.archivos.length} archivos, el máximo es ${max}.`);
  }
  const hay = (t) => conjuntos.some((s) => s.tipo === t);
  const avisos = [];
  if (!hay('APP_IPHONE_61')) avisos.push('Sin capturas de iPhone con Dynamic Island medio (APP_IPHONE_61): Apple pide al menos una para enviar a revisión.');
  if (!hay('APP_IPAD_PRO_3GEN_129')) avisos.push('Sin capturas de iPad 13": obligatorias porque la app corre en iPad (supportsTablet).');
  const motivos = motivosInforme(informe, sha7);
  return {
    commit: sha7,
    ascAppId,
    version,
    locale,
    subible: motivos.length === 0 && errores.length === 0,
    bloqueos: motivos,
    errores,
    avisos,
    conjuntos,
    sinDestino,
    nota: 'API de sets deprecado por Apple desde la 4.5 (App Asset Library). Ver docs/tienda/PLATAFORMAS.md.',
  };
}

// ── JWT ──────────────────────────────────────────────────────────────
const b64url = (v) => Buffer.from(v).toString('base64url');

/** JWT ES256 de equipo. Apple rechaza los que duran más de 20 minutos; aquí, 19. */
export function firmarJwt({ keyId, issuerId, clavePem, ahora = Math.floor(Date.now() / 1000) }) {
  const cab = b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const cuerpo = b64url(JSON.stringify({ iss: issuerId, iat: ahora, exp: ahora + 19 * 60, aud: 'appstoreconnect-v1' }));
  const datos = `${cab}.${cuerpo}`;
  const firma = sign('sha256', Buffer.from(datos), { key: createPrivateKey(clavePem), dsaEncoding: 'ieee-p1363' });
  return `${datos}.${firma.toString('base64url')}`;
}

// ── Cliente ──────────────────────────────────────────────────────────
function crearCliente({ fetch: f, token, esperar }) {
  return async function pedir(metodo, ruta, cuerpo) {
    for (let intento = 0; ; intento++) {
      const res = await f(`${API}${ruta}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${token()}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      if (res.status === 429 && intento < 5) {
        await esperar(2000 * 2 ** intento);
        continue;
      }
      if (!res.ok) {
        let detalle = '';
        try {
          detalle = ((await res.json()).errors ?? []).map((e) => e.detail ?? e.title).join(' | ');
        } catch {
          // Sin cuerpo JSON: basta el estado.
        }
        throw new Error(`${metodo} ${ruta.split('?')[0]} respondió ${res.status}${detalle ? `: ${detalle}` : ''}`);
      }
      return res.status === 204 ? null : res.json();
    }
  };
}

async function subirPartes({ f, datos, operaciones, esperar }) {
  for (const op of operaciones) {
    const parte = datos.subarray(op.offset, op.offset + op.length);
    const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
    for (let intento = 0; ; intento++) {
      // Las URL de subida son presignadas: Apple pide no enviar el JWT.
      const res = await f(op.url, { method: op.method, headers, body: parte });
      if (res.ok) break;
      if (intento >= 2) throw new Error(`Parte en offset ${op.offset} rechazada con ${res.status}.`);
      await esperar(1500 * (intento + 1));
    }
  }
}

const RECURSO = {
  captura: {
    set: 'appScreenshotSets', item: 'appScreenshots', relSet: 'appScreenshotSet', campoTipo: 'screenshotDisplayType',
    extra: () => ({}), estado: (a) => a.assetDeliveryState,
  },
  preview: {
    set: 'appPreviewSets', item: 'appPreviews', relSet: 'appPreviewSet', campoTipo: 'previewType',
    extra: () => ({ mimeType: 'video/mp4' }), estado: (a) => a.videoDeliveryState ?? a.assetDeliveryState,
  },
};

async function subirArchivo({ pedir, f, esperar, clase, setId, ruta, log, maxSondeos = 120 }) {
  const R = RECURSO[clase];
  const datos = readFileSync(ruta);
  const nombre = basename(ruta);
  const reserva = await pedir('POST', `/v1/${R.item}`, {
    data: {
      type: R.item,
      attributes: { fileName: nombre, fileSize: datos.length, ...R.extra() },
      relationships: { [R.relSet]: { data: { type: R.set, id: setId } } },
    },
  });
  const id = reserva.data.id;
  await subirPartes({ f, datos, operaciones: reserva.data.attributes.uploadOperations ?? [], esperar });
  await pedir('PATCH', `/v1/${R.item}/${id}`, {
    data: { type: R.item, id, attributes: { uploaded: true, sourceFileChecksum: createHash('md5').update(datos).digest('hex') } },
  });
  for (let i = 0; i < maxSondeos; i++) {
    const a = (await pedir('GET', `/v1/${R.item}/${id}`)).data.attributes;
    const e = R.estado(a);
    if (e?.state === 'COMPLETE') {
      log(`  listo ${nombre}`);
      return id;
    }
    if (e?.state === 'FAILED') {
      throw new Error(`${nombre}: Apple lo rechazó al procesarlo: ${(e.errors ?? []).map((x) => x.description ?? x.code).join(' | ') || 'sin detalle'}`);
    }
    await esperar(5000);
  }
  throw new Error(`${nombre}: Apple no terminó de procesarlo a tiempo.`);
}

/** Localiza versión y locale de cada plataforma y comprueba que se pueden editar. */
async function resolverLocalizaciones({ pedir, plan }) {
  const porPlataforma = new Map();
  for (const plataforma of new Set(plan.conjuntos.map((s) => s.plataforma))) {
    const q = `filter[platform]=${plataforma}&filter[versionString]=${encodeURIComponent(plan.version)}&limit=1`;
    const v = (await pedir('GET', `/v1/apps/${plan.ascAppId}/appStoreVersions?${q}`)).data?.[0];
    if (!v) throw new Error(`No existe la versión ${plan.version} para ${plataforma} en App Store Connect. Si la plataforma no está dada de alta, retira ese objetivo o añádela (docs/tienda/PLATAFORMAS.md).`);
    const estado = v.attributes.appVersionState ?? v.attributes.appStoreState;
    if (!ESTADOS_EDITABLES.has(estado)) throw new Error(`La versión ${plan.version} de ${plataforma} está en ${estado}: no se puede editar.`);
    const locs = (await pedir('GET', `/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations?limit=200`)).data ?? [];
    const loc = locs.find((l) => l.attributes.locale === plan.locale);
    if (!loc) throw new Error(`La versión ${plan.version} de ${plataforma} no tiene locale ${plan.locale}.`);
    porPlataforma.set(plataforma, loc.id);
  }
  return porPlataforma;
}

/** Busca cada set y lo que ya contiene. No modifica nada. */
async function leerExistentes({ pedir, plan, porPlataforma }) {
  const estado = [];
  for (const s of plan.conjuntos) {
    const R = RECURSO[s.clase];
    const loc = porPlataforma.get(s.plataforma);
    const q = `filter[${R.campoTipo}]=${s.tipo}&limit=1`;
    const set = (await pedir('GET', `/v1/appStoreVersionLocalizations/${loc}/${R.set}?${q}`)).data?.[0] ?? null;
    const items = set ? ((await pedir('GET', `/v1/${R.set}/${set.id}/${R.item}?limit=200`)).data ?? []) : [];
    estado.push({ s, R, loc, setId: set?.id ?? null, previos: items.map((i) => i.id) });
  }
  return estado;
}

/**
 * Ejecuta el plan. Todo lo que pueda fallar sin consecuencias (versión, locale,
 * sets ocupados) se comprueba ANTES del primer cambio. `fetch` se inyecta.
 */
export async function aplicarPlan({ plan, token, fetch: f, reemplazar = false, log = () => {}, esperar = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const motivos = [...plan.bloqueos, ...plan.errores];
  if (motivos.length) throw new Error(`No se sube:\n- ${motivos.join('\n- ')}`);
  if (plan.conjuntos.length === 0) throw new Error('El plan no tiene ningún archivo que subir.');
  const pedir = crearCliente({ fetch: f, token, esperar });
  const porPlataforma = await resolverLocalizaciones({ pedir, plan });
  const estado = await leerExistentes({ pedir, plan, porPlataforma });
  const ocupados = estado.filter((e) => e.previos.length > 0);
  if (ocupados.length && !reemplazar) {
    throw new Error(`Ya hay material en: ${ocupados.map((e) => `${e.s.tipo} (${e.previos.length})`).join(', ')}. Revisa la ficha y repite con --reemplazar para borrarlo y subir lo nuevo.`);
  }
  const subidos = [];
  for (const e of estado) {
    log(`${e.s.plataforma} · ${e.s.tipo} · ${e.s.archivos.length} archivo(s)`);
    for (const id of e.previos) await pedir('DELETE', `/v1/${e.R.item}/${id}`);
    let setId = e.setId;
    if (!setId) {
      const creado = await pedir('POST', `/v1/${e.R.set}`, {
        data: {
          type: e.R.set,
          attributes: { [e.R.campoTipo]: e.s.tipo },
          relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: e.loc } } },
        },
      });
      setId = creado.data.id;
    }
    // Una a una y en orden: es el orden en que quedan en la ficha (NN-escena).
    for (const ruta of e.s.archivos) {
      subidos.push(await subirArchivo({ pedir, f, esperar, clase: e.s.clase, setId, ruta, log }));
    }
  }
  return subidos;
}

// ── CLI ──────────────────────────────────────────────────────────────
function opcion(args, nombre) {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : undefined;
}

function shaCorto(args) {
  const dado = opcion(args, '--commit');
  if (dado) {
    if (!/^[0-9a-f]{7,40}$/i.test(dado)) throw new Error('--commit debe ser un sha.');
    return dado.slice(0, 7).toLowerCase();
  }
  return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: RAIZ_REPO, encoding: 'utf8' }).trim();
}

function leerJson(ruta) {
  try {
    return JSON.parse(readFileSync(ruta, 'utf8'));
  } catch {
    return null;
  }
}

function imprimir(plan, rutaPlan) {
  const rel = (p) => (p.startsWith(RAIZ_REPO + sep) ? relative(RAIZ_REPO, p) : p);
  console.log(`Plan para ${plan.commit} · versión ${plan.version} · ${plan.locale} · app ${plan.ascAppId}`);
  if (plan.conjuntos.length === 0) console.log('Sin archivos con destino.');
  for (const s of plan.conjuntos) {
    console.log(`\n${s.plataforma} · ${s.tipo} (${s.clase})`);
    for (const a of s.archivos) console.log(`  ${rel(a)}`);
  }
  if (plan.sinDestino.length) {
    console.log('\nSin destino:');
    for (const d of plan.sinDestino) console.log(`  ${rel(d.archivo)}: ${d.motivo}`);
  }
  for (const a of plan.avisos) console.log(`\nAviso: ${a}`);
  for (const e of plan.errores) console.log(`\nError: ${e}`);
  console.log(plan.subible ? '\nSubible con --aplicar.' : `\nNo subible todavía:${plan.bloqueos.map((b) => `\n- ${b}`).join('')}`);
  console.log(`\nPlan escrito en ${rel(rutaPlan)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const sha7 = shaCorto(args);
  const dirSha = resolve(opcion(args, '--salida') ?? join(RAIZ_REPO, '.tienda', 'salida', sha7));
  const rutaInforme = join(dirSha, 'informe.json');
  if (!existsSync(dirSha)) throw new Error(`No existe ${dirSha}. Genera antes la tanda con scripts/tienda/tienda.mjs.`);
  const informe = leerJson(rutaInforme);
  const eas = leerJson(join(RAIZ_REPO, 'eas.json'));
  const appJson = leerJson(join(RAIZ_REPO, 'app.json'));
  const ios = eas?.submit?.production?.ios ?? {};
  if (!ios.ascAppId) throw new Error('eas.json no trae submit.production.ios.ascAppId.');
  const plan = construirPlan({
    informe,
    inventario: inventariar(dirSha),
    sha7,
    version: opcion(args, '--version') ?? informe?.version ?? appJson?.expo?.version,
    locale: opcion(args, '--locale') ?? ios.language ?? 'es-ES',
    ascAppId: ios.ascAppId,
  });
  mkdirSync(dirSha, { recursive: true });
  const rutaPlan = join(dirSha, 'asc-plan.json');
  writeFileSync(rutaPlan, `${JSON.stringify(plan, null, 2)}\n`);
  imprimir(plan, rutaPlan);
  if (!flags.has('--aplicar')) return;

  const faltas = motivosAplicar({ flags, env: process.env });
  if (faltas.length) throw new Error(`No se sube nada:\n- ${faltas.join('\n- ')}`);
  const clavePem = readFileSync(resolve(process.env.ASC_KEY_PATH), 'utf8');
  let cache = { valor: '', caduca: 0 };
  const token = () => {
    const ahora = Math.floor(Date.now() / 1000);
    if (ahora > cache.caduca) {
      cache = { valor: firmarJwt({ keyId: process.env.ASC_KEY_ID, issuerId: process.env.ASC_ISSUER_ID, clavePem, ahora }), caduca: ahora + 15 * 60 };
    }
    return cache.valor;
  };
  const subidos = await aplicarPlan({ plan, token, fetch: globalThis.fetch, reemplazar: flags.has('--reemplazar'), log: console.log });
  console.log(`\nSubidos ${subidos.length} archivos. Revísalos en App Store Connect antes de enviar a revisión.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
