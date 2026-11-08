import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

import { objetivoPorId } from '../specs.mjs';
import {
  interpretarFfprobe,
  leerImagen,
  leerJpeg,
  leerPng,
  principal,
  validarDirectorio,
  validarVideo,
} from '../validar.mjs';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'validar.mjs');
const carpetas = [];

function carpeta() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'nivl-validar-'));
  carpetas.push(dir);
  return dir;
}

after(() => carpetas.forEach((d) => rmSync(d, { recursive: true, force: true })));

function chunk(tipo, datos = Buffer.alloc(0)) {
  const nombre = Buffer.from(tipo, 'latin1');
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([nombre, datos])));
  return Buffer.concat([largo, nombre, datos, crc]);
}

const CANALES = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** PNG real y decodificable, generado en memoria. */
function png(ancho, alto, { tipoColor = 2, extra = [] } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;
  ihdr[9] = tipoColor;
  const crudo = Buffer.alloc((ancho * CANALES[tipoColor] + 1) * alto);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...extra,
    chunk('IDAT', zlib.deflateSync(crudo, { level: 1 })),
    chunk('IEND'),
  ]);
}

function segmento(marcador, datos) {
  const cabecera = Buffer.from([0xff, marcador, 0, 0]);
  cabecera.writeUInt16BE(datos.length + 2, 2);
  return Buffer.concat([cabecera, datos]);
}

function sof(ancho, alto, marcador = 0xc0) {
  const d = Buffer.alloc(6);
  d[0] = 8;
  d.writeUInt16BE(alto, 1);
  d.writeUInt16BE(ancho, 3);
  d[5] = 3;
  return segmento(marcador, d);
}

const SOI = Buffer.from([0xff, 0xd8]);
const jpeg = (ancho, alto, previos = []) => Buffer.concat([SOI, ...previos, sof(ancho, alto), Buffer.from([0xff, 0xd9])]);

function directorio(archivos) {
  const dir = carpeta();
  for (const [nombre, contenido] of Object.entries(archivos)) writeFileSync(path.join(dir, nombre), contenido);
  return dir;
}

const erroresDe = (informe) => informe.archivos.flatMap((a) => a.errores).concat(informe.errores);

describe('leerPng', () => {
  it('lee ancho, alto y tipo de color de un PNG opaco', () => {
    const info = leerPng(png(1320, 2868));
    assert.equal(info.formato, 'png');
    assert.equal(info.ancho, 1320);
    assert.equal(info.alto, 2868);
    assert.equal(info.tipoColor, 2);
    assert.equal(info.tieneAlfa, false);
  });

  for (const tipoColor of [4, 6]) {
    it(`marca alfa con tipo de color ${tipoColor}`, () => {
      const info = leerPng(png(10, 10, { tipoColor }));
      assert.equal(info.tieneAlfa, true);
      assert.match(info.motivoAlfa, new RegExp(`tipo de color ${tipoColor}`));
    });
  }

  it('marca alfa por chunk tRNS en color verdadero', () => {
    const info = leerPng(png(10, 10, { extra: [chunk('tRNS', Buffer.alloc(6))] }));
    assert.equal(info.tieneAlfa, true);
    assert.equal(info.motivoAlfa, 'chunk tRNS');
  });

  it('marca alfa por chunk tRNS en paleta', () => {
    const extra = [chunk('PLTE', Buffer.alloc(3)), chunk('tRNS', Buffer.from([0]))];
    assert.equal(leerPng(png(10, 10, { tipoColor: 3, extra })).tieneAlfa, true);
  });

  it('no marca alfa en gris ni en paleta sin tRNS', () => {
    assert.equal(leerPng(png(10, 10, { tipoColor: 0 })).tieneAlfa, false);
    assert.equal(leerPng(png(10, 10, { tipoColor: 3, extra: [chunk('PLTE', Buffer.alloc(3))] })).tieneAlfa, false);
  });

  it('rechaza firma mala, truncado y tipo de color inexistente', () => {
    assert.ok(leerPng(Buffer.from('no soy un png, de verdad que no')).error);
    const bueno = png(10, 10);
    assert.match(leerPng(bueno.subarray(0, bueno.length - 12)).error, /IEND/);
    assert.match(leerPng(bueno.subarray(0, 40)).error, /truncado/);
    const raro = Buffer.from(bueno);
    raro[25] = 5;
    assert.match(leerPng(raro).error, /inválido/);
  });
});

describe('leerJpeg', () => {
  it('lee ancho y alto, sin alfa', () => {
    const info = leerJpeg(jpeg(1320, 2868));
    assert.deepEqual([info.ancho, info.alto, info.tieneAlfa, info.formato], [1320, 2868, false, 'jpeg']);
  });

  it('no se deja engañar por un SOF dentro de la miniatura EXIF', () => {
    const app1 = segmento(0xe1, Buffer.concat([Buffer.from('Exif\0\0'), sof(160, 120)]));
    const info = leerJpeg(jpeg(2064, 2752, [app1]));
    assert.deepEqual([info.ancho, info.alto], [2064, 2752]);
  });

  it('admite bytes de relleno y SOF progresivo', () => {
    const b = Buffer.concat([SOI, Buffer.from([0xff, 0xff]), sof(100, 50, 0xc2), Buffer.from([0xff, 0xd9])]);
    assert.deepEqual([leerJpeg(b).ancho, leerJpeg(b).alto], [100, 50]);
  });

  it('no confunde DHT con SOF', () => {
    const dht = segmento(0xc4, Buffer.alloc(20, 7));
    assert.deepEqual([leerJpeg(jpeg(30, 40, [dht])).ancho, leerJpeg(jpeg(30, 40, [dht])).alto], [30, 40]);
  });

  it('rechaza truncados y SOS antes de SOF', () => {
    assert.match(leerJpeg(Buffer.concat([SOI, segmento(0xe0, Buffer.alloc(30))]).subarray(0, 12)).error, /truncado/);
    assert.match(leerJpeg(Buffer.concat([SOI, segmento(0xda, Buffer.alloc(4))])).error, /SOF/);
  });
});

it('leerImagen rechaza lo que no es PNG ni JPEG', () => {
  assert.ok(leerImagen(Buffer.from('RIFFxxxxWEBP')).error);
});

describe('validarDirectorio con capturas', () => {
  it('acepta PNG y JPEG con tamaño exacto y sin alfa', () => {
    const informe = validarDirectorio(
      directorio({ '01-hoy.png': png(1320, 2868), '02-coach.jpg': jpeg(1320, 2868) }),
      'iphone-69',
    );
    assert.deepEqual(erroresDe(informe), []);
    assert.equal(informe.ok, true);
  });

  it('distingue objetivos por su tamaño exacto', () => {
    const grande = directorio({ 'a.png': png(1320, 2868) });
    const medio = directorio({ 'a.png': png(1206, 2622) });
    assert.equal(validarDirectorio(grande, 'iphone-69').ok, true);
    assert.equal(validarDirectorio(grande, 'iphone-63').ok, false);
    assert.equal(validarDirectorio(medio, 'iphone-63').ok, true);
    assert.equal(validarDirectorio(medio, 'iphone-69').ok, false);
  });

  it('separa exterior e interior de iPhone Duo', () => {
    const exterior = directorio({ 'a.png': png(1398, 2034) });
    const interior = directorio({ 'a.png': png(2007, 2853) });
    assert.equal(validarDirectorio(exterior, 'iphone-duo-exterior').ok, true);
    assert.equal(validarDirectorio(exterior, 'iphone-duo-interior').ok, false);
    assert.equal(validarDirectorio(interior, 'iphone-duo-interior').ok, true);
    assert.equal(validarDirectorio(interior, 'iphone-duo-exterior').ok, false);
  });

  it('nombra el archivo y el tamaño en el error de un tamaño malo', () => {
    const informe = validarDirectorio(directorio({ '03-mal.png': png(1000, 2000) }), 'ipad-13');
    assert.equal(informe.ok, false);
    assert.equal(informe.archivos[0].archivo, '03-mal.png');
    assert.match(informe.archivos[0].errores[0], /1000x2000 no admitido en ipad-13/);
    assert.match(informe.archivos[0].errores[0], /2064x2752/);
  });

  it('rechaza alfa aunque el tamaño sea bueno', () => {
    const informe = validarDirectorio(directorio({ 'a.png': png(1320, 2868, { tipoColor: 6 }) }), 'iphone-69');
    assert.equal(informe.ok, false);
    assert.match(informe.archivos[0].errores[0], /canal alfa/);
  });

  it('rechaza apaisado salvo que se pida', () => {
    const dir = directorio({ 'a.png': png(2868, 1320) });
    assert.equal(validarDirectorio(dir, 'iphone-69').ok, false);
    assert.equal(validarDirectorio(dir, 'iphone-69', { orientacion: 'apaisado' }).ok, true);
    assert.equal(validarDirectorio(dir, 'iphone-69', { orientacion: 'cualquiera' }).ok, true);
  });

  it('Mac exige apaisado', () => {
    assert.equal(validarDirectorio(directorio({ 'a.png': png(2880, 1800) }), 'mac').ok, true);
    assert.equal(validarDirectorio(directorio({ 'a.png': png(1800, 2880) }), 'mac').ok, false);
  });

  it('Watch exige el mismo tamaño en todas', () => {
    const iguales = directorio({ 'a.png': png(416, 496), 'b.png': png(416, 496) });
    const mezcla = directorio({ 'a.png': png(416, 496), 'b.png': png(396, 484) });
    assert.equal(validarDirectorio(iguales, 'watch').ok, true);
    const informe = validarDirectorio(mezcla, 'watch');
    assert.equal(informe.ok, false);
    assert.match(informe.errores[0], /mismo tamaño/);
  });

  it('admite 10 capturas y rechaza 11', () => {
    const pieza = jpeg(1320, 2868);
    const lote = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${i}.jpg`, pieza]));
    assert.equal(validarDirectorio(directorio(lote(10)), 'iphone-69').ok, true);
    const informe = validarDirectorio(directorio(lote(11)), 'iphone-69');
    assert.equal(informe.ok, false);
    assert.match(informe.errores[0], /máximo 10/);
  });

  it('falla si no hay nada que validar', () => {
    assert.equal(validarDirectorio(directorio({ 'notas.txt': 'hola' }), 'iphone-69').ok, false);
  });

  it('rechaza extensión que no corresponde y formatos no admitidos', () => {
    const informe = validarDirectorio(
      directorio({ 'a.png': jpeg(1320, 2868), 'b.webp': 'RIFF' }),
      'iphone-69',
    );
    assert.match(informe.archivos[0].errores[0], /extensión/);
    assert.match(informe.archivos[1].errores[0], /no admitido/);
  });

  it('lanza con un objetivo desconocido', () => {
    assert.throws(() => validarDirectorio(carpeta(), 'iphone-99'), /objetivo desconocido/);
  });
});

function ffprobeBueno(cambios = {}, audio = {}) {
  return {
    format: { duration: '20.000000', size: '27500000', bit_rate: '11256000' },
    streams: [
      {
        codec_type: 'video',
        codec_name: 'h264',
        profile: 'High',
        level: 40,
        width: 886,
        height: 1920,
        avg_frame_rate: '30/1',
        r_frame_rate: '30/1',
        field_order: 'progressive',
        bit_rate: '11000000',
        disposition: { default: 1, attached_pic: 0 },
        ...cambios,
      },
      {
        codec_type: 'audio',
        codec_name: 'aac',
        channels: 2,
        sample_rate: '48000',
        bit_rate: '256000',
        avg_frame_rate: '0/0',
        disposition: { default: 1 },
        ...audio,
      },
    ],
  };
}

describe('validarVideo', () => {
  const iphone = objetivoPorId('iphone-69');
  const errores = (json, objetivo = iphone) => validarVideo(interpretarFfprobe(json), objetivo);

  it('acepta un App Preview correcto', () => {
    assert.deepEqual(errores(ffprobeBueno()), []);
  });

  it('interpreta los campos de ffprobe', () => {
    const m = interpretarFfprobe(ffprobeBueno({ avg_frame_rate: '30000/1001' }));
    assert.equal(m.perfil, 'High');
    assert.equal(m.nivel, 40);
    assert.equal(m.bitrate, 11_000_000);
    assert.ok(Math.abs(m.fps - 29.97) < 0.01);
    assert.deepEqual(m.audio, [{ codec: 'aac', canales: 2, sampleRate: 48000, bitrate: 256000, activa: true }]);
  });

  const casos = [
    ['resolución', ffprobeBueno({ width: 1179, height: 2556 }), /no admitido/],
    ['códec', ffprobeBueno({ codec_name: 'hevc' }), /códec hevc/],
    ['perfil High 10', ffprobeBueno({ profile: 'High 10' }), /perfil High 10/],
    ['nivel 5.1', ffprobeBueno({ level: 51 }), /nivel 5\.1/],
    ['60 fps', ffprobeBueno({ avg_frame_rate: '60/1', r_frame_rate: '60/1' }), /60\.00 fps/],
    ['fotograma variable por encima de 30', ffprobeBueno({ r_frame_rate: '120/1' }), /120\.00 fps/],
    ['entrelazado', ffprobeBueno({ field_order: 'tt' }), /entrelazado/],
    ['tasa baja', ffprobeBueno({ bit_rate: '4000000' }), /4\.00 Mbps/],
    ['tasa alta', ffprobeBueno({ bit_rate: '13000000' }), /13\.00 Mbps/],
    ['vídeo desactivado', ffprobeBueno({ disposition: { default: 0 } }), /desactivada/],
    ['audio no AAC', ffprobeBueno({}, { codec_name: 'mp3' }), /códec mp3/],
    ['audio mono', ffprobeBueno({}, { channels: 1 }), /no estéreo/],
    ['muestreo', ffprobeBueno({}, { sample_rate: '22050' }), /22050/],
    ['audio silencioso de 2 kbps', ffprobeBueno({}, { bit_rate: '2272' }), /2 kbps/],
    ['audio desactivado', ffprobeBueno({}, { disposition: { default: 0 } }), /desactivada/],
  ];
  for (const [nombre, json, patron] of casos) {
    it(`rechaza: ${nombre}`, () => {
      const lista = errores(json);
      assert.ok(lista.some((e) => patron.test(e)), lista.join(' | '));
    });
  }

  it('exige pista de audio', () => {
    const json = ffprobeBueno();
    json.streams.pop();
    assert.match(errores(json).join(), /sin pista de audio/);
  });

  it('admite dos pistas mono y suma su tasa', () => {
    const json = ffprobeBueno({}, { channels: 1, bit_rate: '128000' });
    json.streams.push({ ...json.streams[1] });
    assert.deepEqual(errores(json), []);
  });

  it('comprueba duración mínima y máxima, incluidos los extremos', () => {
    const conDuracion = (d) => {
      const json = ffprobeBueno();
      json.format.duration = String(d);
      return errores(json);
    };
    assert.deepEqual(conDuracion(15), []);
    assert.deepEqual(conDuracion(30), []);
    assert.match(conDuracion(14.9).join(), /duración/);
    assert.match(conDuracion(30.1).join(), /duración/);
  });

  it('rechaza más de 500 MB', () => {
    const json = ffprobeBueno();
    json.format.size = '500000001';
    assert.match(errores(json).join(), /500 MB/);
  });

  it('calcula la tasa desde el contenedor si la pista no la trae', () => {
    const json = ffprobeBueno({ bit_rate: undefined });
    assert.equal(interpretarFfprobe(json).bitrate, 11_000_000);
  });

  it('ignora una carátula incrustada', () => {
    const json = ffprobeBueno();
    json.streams.push({ codec_type: 'video', codec_name: 'mjpeg', disposition: { attached_pic: 1 } });
    assert.deepEqual(errores(json), []);
  });

  it('usa 1200x1600 en iPad y falla Watch porque no tiene App Preview', () => {
    assert.deepEqual(errores(ffprobeBueno({ width: 1200, height: 1600 }), objetivoPorId('ipad-13')), []);
    assert.match(errores(ffprobeBueno(), objetivoPorId('watch'))[0], /no admite App Preview/);
  });
});

describe('validarDirectorio con vídeos', () => {
  it('valida preview, ignora largo y cuenta el máximo de 3', () => {
    const sondear = () => ffprobeBueno();
    const dir = directorio({ 'preview.mp4': 'x', 'largo.mp4': 'x' });
    const informe = validarDirectorio(dir, 'iphone-69', { sondear });
    assert.equal(informe.ok, true);
    assert.deepEqual(informe.ignorados, ['largo.mp4']);
    assert.deepEqual(informe.archivos.map((a) => a.archivo), ['preview.mp4']);

    const cuatro = directorio({ 'a.mp4': 'x', 'b.mp4': 'x', 'c.mov': 'x', 'd.m4v': 'x' });
    assert.match(validarDirectorio(cuatro, 'iphone-69', { sondear }).errores[0], /máximo 3/);
  });

  it('informa por archivo si ffprobe no puede leerlo', () => {
    const informe = validarDirectorio(directorio({ 'a.mp4': 'x' }), 'iphone-69', {
      sondear: () => ({ error: 'ffprobe no pudo leerlo' }),
    });
    assert.equal(informe.ok, false);
    assert.match(informe.archivos[0].errores[0], /ffprobe/);
  });
});

const hayFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

describe('con archivos reales de ffmpeg', { skip: !hayFfmpeg }, () => {
  function ffmpeg(args) {
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  }

  const video = (salida, tamano, segundos) => [
    '-f', 'lavfi', '-i', `testsrc2=s=${tamano}:r=30:d=${segundos}`,
    // Ruido inaudible: el silencio digital se queda en unos 2 kbps.
    '-f', 'lavfi', '-i', `anoisesrc=r=48000:c=white:a=0.001:d=${segundos}`,
    '-ac', '2',
    '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high', '-level', '4.0',
    '-pix_fmt', 'yuv420p', '-b:v', '11M', '-minrate', '11M', '-maxrate', '11M', '-bufsize', '11M',
    '-c:a', 'aac', '-b:a', '256k', '-shortest', salida,
  ];

  it('lee PNG con y sin alfa y JPEG escritos por ffmpeg', () => {
    const dir = carpeta();
    const uno = (nombre, fmt) =>
      ffmpeg(['-f', 'lavfi', '-i', 'color=s=64x48:c=white:d=1', '-frames:v', '1', '-pix_fmt', fmt, path.join(dir, nombre)]);
    uno('rgb.png', 'rgb24');
    uno('rgba.png', 'rgba');
    uno('foto.jpg', 'yuvj420p');
    const leer = (n) => leerImagen(readFileSync(path.join(dir, n)));
    assert.deepEqual([leer('rgb.png').ancho, leer('rgb.png').alto, leer('rgb.png').tieneAlfa], [64, 48, false]);
    assert.equal(leer('rgba.png').tieneAlfa, true);
    assert.deepEqual([leer('foto.jpg').ancho, leer('foto.jpg').alto, leer('foto.jpg').formato], [64, 48, 'jpeg']);
  });

  it('da por bueno un App Preview que cumple', () => {
    const dir = carpeta();
    ffmpeg(video(path.join(dir, 'preview.mp4'), '886x1920', 16));
    const informe = validarDirectorio(dir, 'iphone-69');
    assert.deepEqual(erroresDe(informe), []);
    assert.equal(informe.archivos[0].info.codec, 'h264');
    assert.equal(informe.archivos[0].info.perfil, 'High');
    assert.equal(informe.archivos[0].info.nivel, 40);
  });

  it('señala un vídeo corto y con resolución de iPad en un objetivo iPhone', () => {
    const dir = carpeta();
    ffmpeg(video(path.join(dir, 'preview.mp4'), '1200x1600', 1));
    const lista = erroresDe(validarDirectorio(dir, 'iphone-69')).join(' | ');
    assert.match(lista, /1200x1600 no admitido/);
    assert.match(lista, /duración 1\.00 s/);
  });
});

describe('CLI', () => {
  const lanzar = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });

  it('sale con 0 si todo cumple', () => {
    const r = lanzar(directorio({ '01.png': png(1206, 2622) }), '--objetivo', 'iphone-63');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /OK\s+01\.png/);
    assert.match(r.stdout, /1 de 1 archivos correctos/);
  });

  it('sale con 1 y da un mensaje por archivo', () => {
    const r = lanzar(
      directorio({
        '01-bueno.png': png(1206, 2622),
        '02-alfa.png': png(1206, 2622, { tipoColor: 6 }),
        '03-tamano.png': png(1320, 2868),
      }),
      '--objetivo',
      'iphone-63',
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /02-alfa\.png: tiene canal alfa/);
    assert.match(r.stderr, /03-tamano\.png: tamaño 1320x2868/);
    assert.doesNotMatch(r.stderr, /01-bueno/);
  });

  it('respeta --orientacion', () => {
    const dir = directorio({ 'a.png': png(2622, 1206) });
    assert.equal(lanzar(dir, '--objetivo', 'iphone-63').status, 1);
    assert.equal(lanzar(dir, '--objetivo', 'iphone-63', '--orientacion', 'apaisado').status, 0);
  });

  it('sale con 2 en errores de uso', () => {
    assert.equal(lanzar().status, 2);
    assert.equal(lanzar(carpeta()).status, 2);
    assert.equal(lanzar(carpeta(), '--objetivo', 'nokia').status, 2);
    assert.equal(lanzar('/no/existe', '--objetivo', 'mac').status, 2);
    assert.equal(lanzar(carpeta(), '--objetivo', 'mac', '--orientacion', 'diagonal').status, 2);
  });

  it('principal devuelve el código sin tocar el proceso', () => {
    const lineas = [];
    const codigo = principal([directorio({ 'a.png': png(10, 10) }), '--objetivo', 'mac'], () => {}, (l) => lineas.push(l));
    assert.equal(codigo, 1);
    assert.match(lineas[0], /a\.png/);
  });
});
