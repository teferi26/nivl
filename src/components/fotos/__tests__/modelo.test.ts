import {
  bytesDeBase64,
  cabe,
  fechaCorta,
  fechaFotoValida,
  MENSAJE_GATE,
  MENSAJE_LIMITE,
  MENSAJE_PESO,
  mensajeErrorFotos,
  rutaFoto,
  tarjetaAntesDespues,
  textoDifKg,
  textoKg,
  textoSemanas,
  TOPE_BYTES,
  uuidV4,
} from '@/components/fotos/modelo';
import type { ParAntesDespues } from '@/lib/progressPhotos';
import { ErrorVisible, MENSAJE_FALLO } from '@/lib/validation';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidV4', () => {
  it('con una fuente fija da un v4 válido y determinista', () => {
    const a = uuidV4(() => 0.5);
    expect(a).toMatch(UUID_V4);
    expect(uuidV4(() => 0.5)).toBe(a);
    expect(uuidV4(() => 0)).toBe('00000000-0000-4000-8000-000000000000');
    expect(uuidV4(() => 0.999999)).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });
  it('sin fuente, ids distintos y válidos', () => {
    const ids = new Set(Array.from({ length: 50 }, () => uuidV4()));
    expect(ids.size).toBe(50);
    ids.forEach((id) => expect(id).toMatch(UUID_V4));
  });
  it('sin crypto cae en Math.random', () => {
    const g = globalThis as { crypto?: unknown };
    const antes = g.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    try {
      expect(uuidV4()).toMatch(UUID_V4);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: antes, configurable: true, writable: true });
    }
  });
});

describe('rutaFoto', () => {
  it('es {uid}/{id}.jpg, la regla de 0050', () => {
    expect(rutaFoto('u-1', 'f-2')).toBe('u-1/f-2.jpg');
  });
});

describe('cabe', () => {
  it('cuenta los bytes reales del base64', () => {
    expect(bytesDeBase64('QUJD')).toBe(3);
    expect(bytesDeBase64('QUI=')).toBe(2);
    expect(bytesDeBase64('QQ==')).toBe(1);
  });
  it('acepta hasta el tope y rechaza lo vacío o lo que pasa', () => {
    const justo = 'A'.repeat((TOPE_BYTES / 3) * 4);
    expect(bytesDeBase64(justo)).toBe(TOPE_BYTES);
    expect(cabe(justo)).toBe(true);
    expect(cabe(justo + 'AAAA')).toBe(false);
    expect(cabe('')).toBe(false);
  });
});

describe('fechaFotoValida', () => {
  it('hoy o antes, nunca futuro ni corrupta', () => {
    expect(fechaFotoValida('2026-10-03', '2026-10-03')).toBe(true);
    expect(fechaFotoValida('2026-10-02', '2026-10-03')).toBe(true);
    expect(fechaFotoValida('2026-10-04', '2026-10-03')).toBe(false);
    expect(fechaFotoValida('1999-12-31', '2026-10-03')).toBe(false);
    expect(fechaFotoValida('2026-13-01', '2026-10-03')).toBe(false);
    expect(fechaFotoValida('ayer', '2026-10-03')).toBe(false);
  });
});

describe('textos', () => {
  it('fecha corta con año solo si cambia', () => {
    expect(fechaCorta('2026-10-02', '2026-10-03')).toBe('2 oct');
    expect(fechaCorta('2025-09-14', '2026-10-03')).toBe('14 sept 2025');
    expect(fechaCorta('x')).toBe('-');
  });
  it('semanas y kilos', () => {
    expect(textoSemanas(1)).toBe('1 semana seguida');
    expect(textoSemanas(4)).toBe('4 semanas seguidas');
    expect(textoKg(78.44)).toBe('78,4 kg');
    expect(textoKg(null)).toBe('-');
    expect(textoDifKg(-1.26)).toBe('-1,3 kg');
    expect(textoDifKg(2)).toBe('+2 kg');
  });
  it('ningún texto lleva raya', () => {
    expect([MENSAJE_LIMITE, MENSAJE_GATE, MENSAJE_PESO].join(' ')).not.toMatch(/[—–]/);
  });
});

describe('mensajeErrorFotos', () => {
  it('el tope diario', () => {
    expect(mensajeErrorFotos({ message: 'limite_fotos_progreso', code: '54000' })).toEqual({
      mensaje: 'Has guardado 12 fotos en las últimas 24 horas. Podrás seguir más tarde.',
      refrescar: false,
    });
  });
  it('los del gate piden refresco', () => {
    for (const m of ['sin_consentimiento_salud', 'sin_confirmacion_adulto', 'sin_permiso_fotos_progreso']) {
      expect(mensajeErrorFotos(new Error(m))).toEqual({ mensaje: MENSAJE_GATE, refrescar: true });
    }
  });
  it('el tamaño del bucket', () => {
    expect(mensajeErrorFotos({ message: 'Payload too large', statusCode: '413' }).mensaje).toBe(MENSAJE_PESO);
  });
  it('lo visible pasa tal cual y lo demás es genérico', () => {
    expect(mensajeErrorFotos(new ErrorVisible('Hola')).mensaje).toBe('Hola');
    expect(mensajeErrorFotos(new Error('xyz')).mensaje).toBe(MENSAJE_FALLO);
  });
});

describe('tarjetaAntesDespues', () => {
  const par: ParAntesDespues = {
    antes: { id: 'a', fecha: '2026-07-01', pose: 'frente', pesoKg: 82, fuentePeso: 'registro' },
    despues: { id: 'b', fecha: '2026-10-01', pose: 'frente', pesoKg: 78.5, fuentePeso: 'foto' },
    dias: 92,
    difPesoKg: -3.5,
  };
  it('sin peso por defecto y con URIs locales', () => {
    const t = tarjetaAntesDespues(par, 'file:///a.jpg', 'file:///b.jpg');
    expect(t).toEqual({
      tipo: 'antesDespues',
      antes: { uri: 'file:///a.jpg', fecha: '2026-07-01' },
      despues: { uri: 'file:///b.jpg', fecha: '2026-10-01' },
    });
    expect('pesoAntesKg' in t).toBe(false);
  });
  it('con peso solo si se pide', () => {
    const t = tarjetaAntesDespues(par, 'file:///a.jpg', 'file:///b.jpg', true);
    expect(t.pesoAntesKg).toBe(82);
    expect(t.pesoDespuesKg).toBe(78.5);
  });
  it('no lleva ids', () => {
    expect(JSON.stringify(tarjetaAntesDespues(par, 'x', 'y', true))).not.toMatch(/"id"/);
  });
});
