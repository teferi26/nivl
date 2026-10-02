import {
  bloqueo,
  DIMENSIONES,
  enlace,
  formatoArchivo,
  fotosVisibles,
  lienzo,
  MAX_TITULAR,
  mensaje,
  nombreArchivo,
  OPCIONES_POR_DEFECTO,
  recortar,
  textos,
  type OpcionesTarjeta,
  type Tarjeta,
} from '../sharecard';
import { DOMINIO_NIVL, URL_NIVL } from '../socialmath';

const todo: OpcionesTarjeta = { mostrarNombre: true, mostrarFotos: true, mostrarPeso: true, incluirInvitacion: true };
const progreso: Tarjeta = {
  tipo: 'antesDespues',
  antes: { uri: 'file:///cache/a.jpg', fecha: '2026-07-01' },
  despues: { uri: 'file:///cache/b.jpg', fecha: '2026-10-01' },
  pesoAntesKg: 84.3,
  pesoDespuesKg: 79.95,
};

describe('lienzo', () => {
  it('a 1080 de ancho es el archivo final 1:1', () => {
    for (const f of ['stories', 'post'] as const) {
      const l = lienzo(f);
      expect(l.ancho).toBe(DIMENSIONES[f].ancho);
      expect(l.alto).toBe(DIMENSIONES[f].alto);
      expect(l.escalaArchivo).toBe(1);
      expect(l.u).toBeCloseTo(10.8);
    }
  });

  it('mantiene 9:16 y 4:5 a cualquier escala', () => {
    expect(lienzo('stories', 360).alto / 360).toBeCloseTo(16 / 9);
    expect(lienzo('post', 300).alto / 300).toBeCloseTo(5 / 4);
    expect(lienzo('stories', 360).escalaArchivo).toBeCloseTo(3);
  });

  it('reserva la zona que Instagram tapa solo en Stories', () => {
    expect(lienzo('stories').seguro.arriba).toBe(250);
    expect(lienzo('stories').seguro.abajo).toBe(250);
    expect(lienzo('post').seguro.arriba).toBe(80);
    expect(lienzo('stories', 540).seguro.arriba).toBe(125);
  });

  it('un ancho inválido cae al tamaño final', () => {
    expect(lienzo('post', 0).ancho).toBe(1080);
    expect(lienzo('post', Number.NaN).ancho).toBe(1080);
  });
});

describe('recortar', () => {
  it('no toca lo que cabe y normaliza espacios', () => {
    expect(recortar('  Primer   paso ', 20)).toBe('Primer paso');
  });
  it('corta por palabra con «…»', () => {
    const r = recortar('Constancia de hierro durante todo el invierno', 20);
    expect([...r].length).toBeLessThanOrEqual(20);
    expect(r.endsWith('…')).toBe(true);
    expect(r).not.toMatch(/\s…$/);
  });
  it('cuenta caracteres, no bytes', () => {
    expect(recortar('ÉÉÉÉÉÉ', 6)).toBe('ÉÉÉÉÉÉ');
  });
});

describe('textos', () => {
  it('logro: titular recortado y sin nombre por defecto', () => {
    const x = textos({ tipo: 'logro', titulo: 'Un título de logro larguísimo que no cabe en la tarjeta', descripcion: 'Completa 30 misiones.' }, OPCIONES_POR_DEFECTO, 'Ana');
    expect(x.antetitulo).toBe('LOGRO DESBLOQUEADO');
    expect([...x.titular].length).toBeLessThanOrEqual(MAX_TITULAR);
    expect(x.firma).toBe(DOMINIO_NIVL);
    expect(x.firma).not.toContain('Ana');
  });

  it('el nombre solo aparece con permiso', () => {
    expect(textos({ tipo: 'racha', dias: 7 }, todo, 'Ana').firma).toBe(`Ana · ${DOMINIO_NIVL}`);
    expect(textos({ tipo: 'racha', dias: 7 }, todo, '   ').firma).toBe(DOMINIO_NIVL);
  });

  it('nivel 1 y niveles no enteros', () => {
    expect(textos({ tipo: 'nivel', nivel: 0 }).titular).toBe('NIVEL 1');
    expect(textos({ tipo: 'nivel', nivel: 12.7, rango: 'C' }).titular).toBe('NIVEL 12');
    expect(textos({ tipo: 'nivel', nivel: 12, rango: 'C' }).detalle).toBe('Gladiador de rango C.');
  });

  it('racha de 0, 1 y n días', () => {
    expect(textos({ tipo: 'racha', dias: 0 }).titular).toBe('0 DÍAS');
    expect(textos({ tipo: 'racha', dias: 0 }).detalle).toBe('Hoy empieza la cuenta.');
    expect(textos({ tipo: 'racha', dias: 1 }).titular).toBe('1 DÍA');
    expect(textos({ tipo: 'racha', dias: -3 }).titular).toBe('0 DÍAS');
  });

  it('el peso del antes/después solo sale con permiso', () => {
    expect(textos(progreso, { ...todo, mostrarPeso: false }).detalle).toBe('1 jul 2026 → 1 oct 2026');
    expect(textos(progreso, todo).detalle).toBe('1 jul 2026 → 1 oct 2026 · 84,3 kg → 80 kg');
  });

  it('la voz del sistema no grita', () => {
    const tarjetas: Tarjeta[] = [
      { tipo: 'logro', titulo: 'Primer paso' },
      { tipo: 'nivel', nivel: 5 },
      { tipo: 'rango', rango: 'B' },
      { tipo: 'racha', dias: 30 },
      progreso,
    ];
    for (const t of tarjetas) {
      const x = textos(t, todo, 'Ana');
      expect(`${x.antetitulo} ${x.titular} ${x.detalle ?? ''}`).not.toMatch(/!|¡|cazador/i);
    }
  });
});

describe('privacidad', () => {
  it('antes/después sin permiso de fotos no se genera', () => {
    expect(bloqueo(progreso, OPCIONES_POR_DEFECTO)).toMatch(/permitir las fotos/);
    expect(fotosVisibles(progreso, OPCIONES_POR_DEFECTO)).toEqual([]);
    expect(bloqueo(progreso, todo)).toBeNull();
    expect(fotosVisibles(progreso, todo)).toHaveLength(2);
  });

  it('rechaza fotos sin URI o en orden inverso', () => {
    expect(bloqueo({ ...progreso, antes: { uri: '', fecha: '2026-07-01' } } as Tarjeta, todo)).toMatch(/Faltan fotos/);
    expect(bloqueo({ ...progreso, antes: progreso.despues, despues: progreso.antes } as Tarjeta, todo)).toMatch(/posterior/);
  });

  it('las tarjetas sin fotos nunca enseñan fotos', () => {
    expect(fotosVisibles({ tipo: 'racha', dias: 3 }, todo)).toEqual([]);
  });

  it('un logro sin nombre no se genera', () => {
    expect(bloqueo({ tipo: 'logro', titulo: '  ' }, todo)).not.toBeNull();
  });
});

describe('archivo y enlace', () => {
  it('JPG con foto, PNG sin ella', () => {
    expect(formatoArchivo(progreso, todo)).toEqual({ formato: 'jpg', calidad: 0.9 });
    expect(formatoArchivo(progreso, OPCIONES_POR_DEFECTO).formato).toBe('png');
    expect(formatoArchivo({ tipo: 'nivel', nivel: 3 }, todo).formato).toBe('png');
  });

  it('nombre de archivo sin datos personales', () => {
    expect(nombreArchivo(progreso, 'post', 'jpg', '2026-10-02T10:00:00Z')).toBe('nivl-progreso-2026-10-02-post.jpg');
    expect(nombreArchivo({ tipo: 'racha', dias: 3 }, 'stories', 'png', 'x')).toBe('nivl-racha-hoy-stories.png');
  });

  it('el código de invitación solo sale si se elige', () => {
    expect(enlace('abcd2345')).toBe(URL_NIVL);
    expect(enlace('abcd2345', true)).toBe(`${URL_NIVL}/c/ABCD2345`);
    expect(enlace('ab', true)).toBe(URL_NIVL);
    expect(enlace('../x', true)).toBe(URL_NIVL);
    expect(enlace(null, true)).toBe(URL_NIVL);
  });

  it('el mensaje lleva el titular y el enlace', () => {
    expect(mensaje({ tipo: 'nivel', nivel: 7 })).toBe(`Nivel 7 en NIVL. ${URL_NIVL}`);
    expect(mensaje({ tipo: 'logro', titulo: 'Primer paso' }, OPCIONES_POR_DEFECTO, 'ABCD2345')).toBe(
      `Logro desbloqueado: Primer paso en NIVL. ${URL_NIVL}`,
    );
    expect(mensaje({ tipo: 'logro', titulo: 'Primer paso' }, todo, 'ABCD2345')).toBe(
      `Logro desbloqueado: Primer paso en NIVL. ${URL_NIVL}/c/ABCD2345`,
    );
  });
});
