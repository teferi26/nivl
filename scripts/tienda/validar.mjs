#!/usr/bin/env node
// Validador de capturas y App Preview contra specs.mjs. Sin dependencias.
//
//   node scripts/tienda/validar.mjs <dir> --objetivo <id> [--orientacion vertical|apaisado|cualquiera]
//
// Salida: 0 todo correcto, 1 algún archivo no cumple, 2 error de uso.

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { IDS_OBJETIVOS, objetivoPorId, REGLAS_CAPTURAS, REGLAS_PREVIEW } from './specs.mjs';

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TIPOS_COLOR_PNG = new Set([0, 2, 3, 4, 6]);

/** Lee un PNG recorriendo sus chunks. Si no es válido devuelve { error }. */
export function leerPng(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(FIRMA_PNG)) return { error: 'no es un PNG válido' };
  if (buf.length < 33 || buf.toString('latin1', 12, 16) !== 'IHDR') {
    return { error: 'PNG sin chunk IHDR al principio' };
  }
  const info = {
    formato: 'png',
    ancho: buf.readUInt32BE(16),
    alto: buf.readUInt32BE(20),
    profundidad: buf[24],
    tipoColor: buf[25],
    tieneAlfa: false,
    motivoAlfa: null,
  };
  if (!TIPOS_COLOR_PNG.has(info.tipoColor)) return { error: `PNG con tipo de color ${info.tipoColor} inválido` };
  if (info.tipoColor === 4 || info.tipoColor === 6) {
    info.tieneAlfa = true;
    info.motivoAlfa = `tipo de color ${info.tipoColor}`;
  }
  let pos = 8;
  while (pos + 12 <= buf.length) {
    const largo = buf.readUInt32BE(pos);
    const tipo = buf.toString('latin1', pos + 4, pos + 8);
    if (pos + 12 + largo > buf.length) return { error: `PNG truncado en el chunk ${tipo}` };
    if (tipo === 'tRNS') {
      info.tieneAlfa = true;
      info.motivoAlfa ??= 'chunk tRNS';
    }
    if (tipo === 'IEND') return info;
    pos += 12 + largo;
  }
  return { error: 'PNG truncado: falta IEND' };
}

// Marcadores SOF: C0 a CF menos DHT (C4), JPG (C8) y DAC (CC).
const esSof = (m) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
const sinLongitud = (m) => m === 0x01 || (m >= 0xd0 && m <= 0xd8);

/** Lee la cabecera de un JPEG. Salta segmentos por longitud (una miniatura EXIF no engaña). */
export function leerJpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return { error: 'no es un JPEG válido' };
  let pos = 2;
  while (pos < buf.length) {
    if (buf[pos] !== 0xff) return { error: 'JPEG corrupto: se esperaba un marcador' };
    while (pos < buf.length && buf[pos] === 0xff) pos += 1;
    if (pos >= buf.length) break;
    const marcador = buf[pos];
    pos += 1;
    if (sinLongitud(marcador)) continue;
    if (marcador === 0xd9 || marcador === 0xda) return { error: 'JPEG sin marcador SOF antes de los datos' };
    if (pos + 2 > buf.length) break;
    const largo = buf.readUInt16BE(pos);
    if (largo < 2 || pos + largo > buf.length) return { error: 'JPEG truncado' };
    if (esSof(marcador)) {
      if (largo < 8) return { error: 'JPEG con SOF inválido' };
      return {
        formato: 'jpeg',
        profundidad: buf[pos + 2],
        alto: buf.readUInt16BE(pos + 3),
        ancho: buf.readUInt16BE(pos + 5),
        componentes: buf[pos + 7],
        tieneAlfa: false,
        motivoAlfa: null,
      };
    }
    pos += largo;
  }
  return { error: 'JPEG truncado: falta SOF' };
}

export function leerImagen(buf) {
  if (buf.length >= 2 && buf[0] === 0x89 && buf[1] === 0x50) return leerPng(buf);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return leerJpeg(buf);
  return { error: 'ni PNG ni JPEG' };
}

const textoTamano = ([a, b]) => `${a}x${b}`;

function tamanosAdmitidos(seccion, orientacion) {
  if (orientacion === 'cualquiera') return [...seccion.vertical, ...seccion.apaisado];
  return seccion[orientacion] ?? [];
}

function comprobarTamano(info, seccion, objetivo, orientacion) {
  const admitidos = tamanosAdmitidos(seccion, orientacion);
  if (admitidos.some(([a, b]) => a === info.ancho && b === info.alto)) return [];
  return [
    `tamaño ${info.ancho}x${info.alto} no admitido en ${objetivo.id} ` +
      `(${orientacion}: ${admitidos.map(textoTamano).join(', ') || 'ninguno'})`,
  ];
}

/** Errores de una imagen ya leída. Puro. */
export function validarImagen(info, objetivo, { orientacion = objetivo.orientacion } = {}) {
  if (info.error) return [info.error];
  const errores = comprobarTamano(info, objetivo.capturas, objetivo, orientacion);
  if (info.tieneAlfa) errores.push(`tiene canal alfa (${info.motivoAlfa}); Apple no lo admite`);
  return errores;
}

function fraccion(texto) {
  if (!texto) return null;
  const [a, b = '1'] = String(texto).split('/');
  const n = Number(a);
  const d = Number(b);
  return Number.isFinite(n) && Number.isFinite(d) && d !== 0 ? n / d : null;
}

function numero(valor) {
  if (valor === undefined || valor === null || valor === 'N/A' || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** Convierte el JSON de ffprobe en los campos que importan. Puro. */
export function interpretarFfprobe(datos) {
  const pistas = datos.streams ?? [];
  const videos = pistas.filter((p) => p.codec_type === 'video' && !p.disposition?.attached_pic);
  const audios = pistas.filter((p) => p.codec_type === 'audio');
  const v = videos[0];
  const audio = audios.map((p) => ({
    codec: p.codec_name ?? null,
    canales: numero(p.channels),
    sampleRate: numero(p.sample_rate),
    bitrate: numero(p.bit_rate),
    activa: p.disposition?.default !== 0,
  }));
  const bitrateAudio = audio.reduce((s, a) => s + (a.bitrate ?? 0), 0);
  const bitrateFormato = numero(datos.format?.bit_rate);
  return {
    duracion: numero(datos.format?.duration),
    pesoBytes: numero(datos.format?.size),
    pistasVideo: videos.length,
    ancho: numero(v?.width),
    alto: numero(v?.height),
    codec: v?.codec_name ?? null,
    perfil: v?.profile ?? null,
    nivel: numero(v?.level),
    fps: fraccion(v?.avg_frame_rate),
    fpsMaxima: fraccion(v?.r_frame_rate),
    entrelazado: Boolean(v?.field_order && !['progressive', 'unknown'].includes(v.field_order)),
    bitrate: numero(v?.bit_rate) ?? (bitrateFormato === null ? null : bitrateFormato - bitrateAudio),
    videoActiva: v ? v.disposition?.default !== 0 : true,
    audio,
  };
}

const mbps = (b) => `${(b / 1e6).toFixed(2)} Mbps`;
const kbps = (b) => `${Math.round(b / 1000)} kbps`;

function erroresAudio(audio) {
  const r = REGLAS_PREVIEW.audio;
  if (audio.length === 0) return ['sin pista de audio; Apple la exige'];
  const errores = [];
  const estereo =
    (audio.length === 1 && audio[0].canales === 2) ||
    (audio.length === 2 && audio.every((a) => a.canales === 1));
  if (!estereo) {
    errores.push(
      `audio no estéreo (${audio.map((a) => a.canales).join('+')} canales): ` +
        'hace falta 1 pista de 2 canales o 2 pistas de 1',
    );
  }
  audio.forEach((a, i) => {
    const pista = `pista de audio ${i + 1}`;
    if (a.codec !== r.codec) errores.push(`${pista}: códec ${a.codec}, se exige AAC`);
    if (!r.sampleRates.includes(a.sampleRate)) {
      errores.push(`${pista}: muestreo ${a.sampleRate} Hz, se exige 44100 o 48000`);
    }
    if (!a.activa) errores.push(`${pista}: desactivada; todas deben estar activas`);
  });
  if (audio.some((a) => a.bitrate === null)) {
    errores.push('tasa de bits del audio desconocida');
  } else {
    const total = audio.reduce((s, a) => s + a.bitrate, 0);
    const margen = r.bitrateNominal * r.toleranciaBitrate;
    if (Math.abs(total - r.bitrateNominal) > margen) {
      errores.push(`audio a ${kbps(total)}, se exigen ${kbps(r.bitrateNominal)}`);
    }
  }
  return errores;
}

const TOLERANCIA_FPS = 0.01;

/** Errores de un vídeo ya interpretado. Puro. */
export function validarVideo(meta, objetivo, { orientacion = objetivo.orientacion } = {}) {
  if (!objetivo.preview) return [`${objetivo.id} no admite App Preview`];
  const r = REGLAS_PREVIEW;
  if (meta.pistasVideo === 0) return ['sin pista de vídeo'];
  const errores = comprobarTamano(meta, objetivo.preview, objetivo, orientacion);
  if (meta.pistasVideo > 1) errores.push(`${meta.pistasVideo} pistas de vídeo, se espera una`);
  if (!meta.videoActiva) errores.push('pista de vídeo desactivada; todas deben estar activas');

  if (meta.duracion === null) errores.push('duración desconocida');
  else if (meta.duracion < r.duracionMin || meta.duracion > r.duracionMax) {
    errores.push(`duración ${meta.duracion.toFixed(2)} s, se exige de ${r.duracionMin} a ${r.duracionMax} s`);
  }
  if (meta.pesoBytes !== null && meta.pesoBytes > r.pesoMaxBytes) {
    errores.push(`pesa ${Math.round(meta.pesoBytes / 1e6)} MB, máximo 500 MB`);
  }

  if (meta.codec !== r.video.codec) errores.push(`códec ${meta.codec}, se exige H.264`);
  if (!r.video.perfiles.includes(meta.perfil)) errores.push(`perfil ${meta.perfil}, máximo High`);
  if (meta.nivel === null || meta.nivel <= 0) errores.push('nivel H.264 desconocido');
  else if (meta.nivel > r.video.nivelMax) errores.push(`nivel ${meta.nivel / 10}, máximo 4.0`);
  if (meta.entrelazado) errores.push('vídeo entrelazado, se exige progresivo');

  if (meta.fps === null) errores.push('fotogramas por segundo desconocidos');
  else if (Math.max(meta.fps, meta.fpsMaxima ?? 0) > r.video.fpsMax + TOLERANCIA_FPS) {
    errores.push(`${Math.max(meta.fps, meta.fpsMaxima ?? 0).toFixed(2)} fps, máximo ${r.video.fpsMax}`);
  }

  if (meta.bitrate === null) errores.push('tasa de bits del vídeo desconocida');
  else if (meta.bitrate < r.video.bitrateMin || meta.bitrate > r.video.bitrateMax) {
    errores.push(`vídeo a ${mbps(meta.bitrate)}, se exigen de 10 a 12 Mbps`);
  }

  return errores.concat(erroresAudio(meta.audio));
}

/** Pasa ffprobe por un archivo. Devuelve el JSON o { error }. */
export function sondearVideo(ruta) {
  const r = spawnSync(
    'ffprobe',
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', ruta],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  if (r.error) return { error: `no se pudo ejecutar ffprobe: ${r.error.message}` };
  if (r.status !== 0) return { error: `ffprobe no pudo leerlo: ${r.stderr.trim() || 'sin detalle'}` };
  return JSON.parse(r.stdout);
}

const EXT_IMAGEN_NO_ADMITIDA = new Set(['.webp', '.heic', '.heif', '.gif', '.tif', '.tiff', '.bmp', '.avif']);
const EXT_VIDEO_NO_ADMITIDA = new Set(['.webm', '.mkv', '.avi', '.m2v']);
// El vídeo largo es para web y redes, no para la ficha: no le aplican estas reglas.
const esVideoLargo = (nombre) => /^largo([^a-z0-9]|$)/i.test(nombre);

function clasificar(nombre) {
  const ext = path.extname(nombre).toLowerCase();
  if (REGLAS_CAPTURAS.extensiones.includes(ext)) return 'imagen';
  if (REGLAS_PREVIEW.extensiones.includes(ext)) return esVideoLargo(nombre) ? 'ignorado' : 'video';
  if (EXT_IMAGEN_NO_ADMITIDA.has(ext) || EXT_VIDEO_NO_ADMITIDA.has(ext)) return 'no-admitido';
  return 'ignorado';
}

function extensionCuadra(nombre, formato) {
  const ext = path.extname(nombre).toLowerCase();
  return formato === 'png' ? ext === '.png' : ext === '.jpg' || ext === '.jpeg';
}

function examinarImagen(dir, archivo, objetivo, opciones) {
  const info = leerImagen(readFileSync(path.join(dir, archivo)));
  const errores = validarImagen(info, objetivo, opciones);
  if (!info.error && !extensionCuadra(archivo, info.formato)) {
    errores.push(`la extensión no corresponde: en realidad es ${info.formato.toUpperCase()}`);
  }
  return { archivo, tipo: 'imagen', info, errores };
}

function examinarVideo(dir, archivo, objetivo, opciones, sondear) {
  const ruta = path.join(dir, archivo);
  const datos = sondear(ruta);
  if (datos.error) return { archivo, tipo: 'video', info: null, errores: [datos.error] };
  const info = interpretarFfprobe(datos);
  info.pesoBytes ??= statSync(ruta).size;
  return { archivo, tipo: 'video', info, errores: validarVideo(info, objetivo, opciones) };
}

/**
 * Valida un directorio contra un objetivo. Lanza si el objetivo no existe.
 * @returns {{ok:boolean, objetivo:string, archivos:Array, errores:string[], ignorados:string[]}}
 */
export function validarDirectorio(dir, idObjetivo, opciones = {}) {
  const objetivo = objetivoPorId(idObjetivo);
  if (!objetivo) throw new Error(`objetivo desconocido: ${idObjetivo} (hay: ${IDS_OBJETIVOS.join(', ')})`);
  const { sondear = sondearVideo, ...opcionesValidacion } = opciones;

  const nombres = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();

  const archivos = [];
  const ignorados = [];
  for (const archivo of nombres) {
    const clase = clasificar(archivo);
    if (clase === 'imagen') archivos.push(examinarImagen(dir, archivo, objetivo, opcionesValidacion));
    else if (clase === 'video') archivos.push(examinarVideo(dir, archivo, objetivo, opcionesValidacion, sondear));
    else if (clase === 'no-admitido') {
      archivos.push({ archivo, tipo: 'otro', info: null, errores: ['formato no admitido por App Store Connect'] });
    } else ignorados.push(archivo);
  }

  const errores = [];
  const imagenes = archivos.filter((a) => a.tipo === 'imagen');
  const videos = archivos.filter((a) => a.tipo === 'video');
  if (archivos.length === 0) errores.push('no hay capturas ni vídeos que validar');
  if (imagenes.length > REGLAS_CAPTURAS.maxPorTamano) {
    errores.push(`${imagenes.length} capturas, máximo ${REGLAS_CAPTURAS.maxPorTamano} por tamaño`);
  }
  if (videos.length > REGLAS_PREVIEW.maxPorTamano) {
    errores.push(`${videos.length} App Preview, máximo ${REGLAS_PREVIEW.maxPorTamano} por tamaño`);
  }
  if (objetivo.capturas.mismoTamanoEnTodas) {
    const tamanos = new Set(imagenes.filter((a) => !a.info.error).map((a) => `${a.info.ancho}x${a.info.alto}`));
    if (tamanos.size > 1) errores.push(`${objetivo.id} exige el mismo tamaño en todas: hay ${[...tamanos].join(', ')}`);
  }

  const ok = errores.length === 0 && archivos.every((a) => a.errores.length === 0);
  return { ok, objetivo: objetivo.id, archivos, errores, ignorados };
}

const USO =
  'Uso: node scripts/tienda/validar.mjs <dir> --objetivo <id> [--orientacion vertical|apaisado|cualquiera]\n' +
  `Objetivos: ${IDS_OBJETIVOS.join(', ')}`;

function leerArgumentos(argv) {
  const opciones = { dir: null, objetivo: null, orientacion: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--objetivo') opciones.objetivo = argv[(i += 1)];
    else if (a === '--orientacion') opciones.orientacion = argv[(i += 1)];
    else if (a.startsWith('--') || opciones.dir !== null) return null;
    else opciones.dir = a;
  }
  if (!opciones.dir || !opciones.objetivo) return null;
  if (opciones.orientacion && !['vertical', 'apaisado', 'cualquiera'].includes(opciones.orientacion)) return null;
  return opciones;
}

export function principal(argv, salida = console.log, fallo = console.error) {
  const args = leerArgumentos(argv);
  if (!args) {
    fallo(USO);
    return 2;
  }
  if (!objetivoPorId(args.objetivo)) {
    fallo(`Objetivo desconocido: ${args.objetivo}\n${USO}`);
    return 2;
  }
  let informe;
  try {
    if (!statSync(args.dir).isDirectory()) throw new Error('no es un directorio');
    const opciones = args.orientacion ? { orientacion: args.orientacion } : {};
    informe = validarDirectorio(args.dir, args.objetivo, opciones);
  } catch (e) {
    fallo(`No se puede leer ${args.dir}: ${e.message}`);
    return 2;
  }

  for (const a of informe.archivos) {
    if (a.errores.length === 0) salida(`OK     ${a.archivo}`);
    for (const e of a.errores) fallo(`ERROR  ${a.archivo}: ${e}`);
  }
  for (const e of informe.errores) fallo(`ERROR  ${args.dir}: ${e}`);
  for (const nombre of informe.ignorados) salida(`IGNORADO  ${nombre}`);

  const correctos = informe.archivos.filter((a) => a.errores.length === 0).length;
  const resumen = `${informe.objetivo}: ${correctos} de ${informe.archivos.length} archivos correctos`;
  if (informe.ok) salida(resumen);
  else fallo(resumen);
  return informe.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = principal(process.argv.slice(2));
}
