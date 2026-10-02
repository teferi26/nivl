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
  avisoColor,
  cifrasSemana,
  codigoVisible,
  BN_VERIFICADO,
  fotosEnBN,
  reticulaRacha,
  tarjetaDeCelebracion,
  type OpcionesTarjeta,
  type Tarjeta,
} from '../sharecard';
import { DOMINIO_NIVL, URL_NIVL } from '../socialmath';

const todo: OpcionesTarjeta = { mostrarNombre: true, mostrarFotos: true, mostrarPeso: true, incluirInvitacion: true, mostrarTextoCoach: true };
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

  it('el alias solo aparece con permiso', () => {
    expect(textos({ tipo: 'racha', dias: 7 }, todo, 'Ana').firma).toBe(`Ana · ${DOMINIO_NIVL}`);
    expect(textos({ tipo: 'racha', dias: 7 }, todo, 'Ana').alias).toBe('Ana');
    expect(textos({ tipo: 'racha', dias: 7 }, OPCIONES_POR_DEFECTO, 'Ana').alias).toBeNull();
    expect(textos({ tipo: 'racha', dias: 7 }, todo, '   ').firma).toBe(DOMINIO_NIVL);
    expect(textos({ tipo: 'racha', dias: 7 }).dominio).toBe(DOMINIO_NIVL);
  });

  it('nivel 1 y niveles no enteros', () => {
    expect(textos({ tipo: 'nivel', nivel: 0 }).titular).toBe('NIVEL 1');
    expect(textos({ tipo: 'nivel', nivel: 12.7, rango: 'C' }).titular).toBe('NIVEL 12');
    expect(textos({ tipo: 'nivel', nivel: 12, rango: 'C' }).detalle).toBe('Rango C');
    expect(textos({ tipo: 'nivel', nivel: 12, rango: 'B', nombreRango: 'Campeón' }).detalle).toBe('Rango B · Campeón');
    expect(textos({ tipo: 'nivel', nivel: 12 }).antetitulo).toBe('NUEVO NIVEL');
  });

  it('racha de 0, 1 y n días', () => {
    expect(textos({ tipo: 'racha', dias: 0 }).titular).toBe('0 DÍAS');
    expect(textos({ tipo: 'racha', dias: 0 }).detalle).toBe('Hoy empieza la cuenta.');
    expect(textos({ tipo: 'racha', dias: 1 }).titular).toBe('1 DÍA');
    expect(textos({ tipo: 'racha', dias: -3 }).titular).toBe('0 DÍAS');
  });

  it('el peso del antes/después solo sale con permiso', () => {
    expect(textos(progreso, { ...todo, mostrarPeso: false }).detalle).toBe('13 semanas');
    expect(textos(progreso, todo).detalle).toBe('13 semanas · 84,3 kg → 80 kg');
    expect(textos(progreso, todo).fechas).toEqual(['1 jul 2026', '1 oct 2026']);
    expect(textos({ ...progreso, despues: { uri: 'x', fecha: '2026-07-04' } } as Tarjeta).detalle).toBe('3 días');
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
  const adulto = { puedeCompartirFotos: true };

  it('antes/después sin permiso de fotos no se genera', () => {
    expect(bloqueo(progreso, OPCIONES_POR_DEFECTO, adulto)).toMatch(/permitir las fotos/);
    expect(fotosVisibles(progreso, OPCIONES_POR_DEFECTO, adulto)).toEqual([]);
    expect(bloqueo(progreso, todo, adulto)).toBeNull();
    expect(fotosVisibles(progreso, todo, adulto)).toHaveLength(2);
  });

  it('las fotos de progreso solo se comparten con 18 años o más, y por defecto no', () => {
    expect(bloqueo(progreso, todo)).toMatch(/18 años/);
    expect(bloqueo(progreso, todo, { puedeCompartirFotos: false })).toMatch(/18 años/);
    expect(fotosVisibles(progreso, todo)).toEqual([]);
    expect(formatoArchivo(progreso, todo).formato).toBe('png');
  });

  it('rechaza fotos sin URI o en orden inverso', () => {
    expect(bloqueo({ ...progreso, antes: { uri: '', fecha: '2026-07-01' } } as Tarjeta, todo, adulto)).toMatch(/Faltan fotos/);
    expect(bloqueo({ ...progreso, antes: progreso.despues, despues: progreso.antes } as Tarjeta, todo, adulto)).toMatch(/posterior/);
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
    expect(formatoArchivo(progreso, todo, { puedeCompartirFotos: true })).toEqual({ formato: 'jpg', calidad: 0.9 });
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

describe('celebraciones del juego', () => {
  it('nivel, rango, logro con título y racha ≥ 30 dan tarjeta', () => {
    expect(tarjetaDeCelebracion({ tipo: 'nivel', clave: 'nivel:12', nivel: 12 })).toEqual({ tipo: 'nivel', nivel: 12 });
    expect(tarjetaDeCelebracion({ tipo: 'rango', clave: 'rango:C', rango: 'C', nombre: 'Veterano', titulo: 'Hierro' })).toEqual({
      tipo: 'rango',
      rango: 'C',
      titulo: 'Hierro',
    });
    expect(
      tarjetaDeCelebracion({ tipo: 'logro', clave: 'logro:x', codigo: 'x', nombre: 'Primer paso', desc: 'Una misión', titulo: 'Novato' }),
    ).toEqual({ tipo: 'logro', titulo: 'Primer paso', descripcion: 'Una misión' });
    expect(tarjetaDeCelebracion({ tipo: 'racha', clave: 'racha:30:2026-10-02', dias: 30 })).toEqual({ tipo: 'racha', dias: 30 });
  });

  it('lo demás se celebra dentro, sin tarjeta', () => {
    expect(tarjetaDeCelebracion({ tipo: 'racha', clave: 'racha:7:2026-10-02', dias: 7 })).toBeNull();
    expect(tarjetaDeCelebracion({ tipo: 'logro', clave: 'l', codigo: 'l', nombre: 'Algo', titulo: null })).toBeNull();
    for (const tipo of ['grado', 'insignia', 'recuperacion', 'piedra']) {
      expect(tarjetaDeCelebracion({ tipo, clave: tipo })).toBeNull();
    }
  });
});

describe('diseño v2 (SISTEMA.md §10)', () => {
  it('nivel y rango llevan «Día N de racha» si hay racha', () => {
    expect(textos({ tipo: 'nivel', nivel: 9, rachaDias: 12 }).racha).toBe('Día 12 de racha');
    expect(textos({ tipo: 'rango', rango: 'B', rachaDias: 0 }).racha).toBeNull();
    expect(textos({ tipo: 'racha', dias: 40 }).racha).toBeNull();
  });

  it('retícula de 30 días: el detalle real o los últimos N hechos', () => {
    const r = reticulaRacha({ tipo: 'racha', dias: 7 });
    expect(r).toHaveLength(30);
    expect(r.filter(Boolean)).toHaveLength(7);
    expect(r.slice(-7).every(Boolean)).toBe(true);
    expect(reticulaRacha({ tipo: 'racha', dias: 400 }).every(Boolean)).toBe(true);
    const real = Array.from({ length: 30 }, (_, i) => i % 2 === 0);
    expect(reticulaRacha({ tipo: 'racha', dias: 1, ultimos30: real })).toEqual(real);
    expect(reticulaRacha({ tipo: 'racha', dias: 3, ultimos30: [true] }).filter(Boolean)).toHaveLength(3);
  });
});

describe('B/N solo donde está comprobado', () => {
  it('hoy solo web; iOS y Android hasta la prueba física', () => {
    expect(BN_VERIFICADO).toEqual({ ios: false, android: false, web: true });
    expect(fotosEnBN('web')).toBe(true);
    expect(fotosEnBN('ios')).toBe(false);
    expect(fotosEnBN('windows')).toBe(false);
  });

  it('la hoja avisa cuando las fotos saldrán en color', () => {
    const adulto = { puedeCompartirFotos: true };
    expect(avisoColor(progreso, todo, adulto, 'ios')).toBe('Las fotos se compartirán en color.');
    expect(avisoColor(progreso, todo, adulto, 'web')).toBeNull();
    expect(avisoColor(progreso, OPCIONES_POR_DEFECTO, adulto, 'ios')).toBeNull();
    expect(avisoColor({ tipo: 'racha', dias: 3 }, todo, adulto, 'ios')).toBeNull();
  });
});

describe('semana y recuerdo (migración de ShareCardSemana y resumen)', () => {
  const semana: Tarjeta = { tipo: 'semana', xpSemana: 1240, nivel: 9, cumplimientoPct: 85.4, diasActivos: 5, rachaDias: 12, posicion: '2.º de 5' };

  it('semana: XP de la semana o el nivel si no hubo XP', () => {
    expect(textos(semana).titular).toBe('+1240 XP'.replace('1240', (1240).toLocaleString('es-ES')));
    expect(textos({ ...semana, xpSemana: 0 } as Tarjeta).titular).toBe('NIVEL 9');
    expect(textos(semana).antetitulo).toBe('PARTE DE LA SEMANA');
  });

  it('semana: cumplimiento, racha y puesto', () => {
    expect(cifrasSemana(semana as Extract<Tarjeta, { tipo: 'semana' }>)).toEqual([
      { valor: '85 %', rotulo: 'CUMPLIMIENTO' },
      { valor: '12', rotulo: 'DÍAS DE RACHA' },
      { valor: '2.º', rotulo: 'PUESTO DE 5' },
    ]);
    const sinPlan = { ...semana, cumplimientoPct: null, posicion: null, rachaDias: 1 } as Extract<Tarjeta, { tipo: 'semana' }>;
    expect(cifrasSemana(sinPlan)).toEqual([
      { valor: '5/7', rotulo: 'DÍAS ACTIVOS' },
      { valor: '1', rotulo: 'DÍA DE RACHA' },
    ]);
  });

  it('el código de amigo solo se pinta si se elige invitar', () => {
    expect(codigoVisible(OPCIONES_POR_DEFECTO, 'ABCD2345')).toBeNull();
    expect(codigoVisible({ ...OPCIONES_POR_DEFECTO, incluirInvitacion: true }, 'abcd2345')).toBe('ABCD2345');
    expect(codigoVisible({ ...OPCIONES_POR_DEFECTO, incluirInvitacion: true }, null)).toBeNull();
  });

  const recuerdo: Tarjeta = {
    tipo: 'recuerdo',
    etiqueta: 'Evidencia',
    dato: '4 de 5',
    titulo: 'La semana que no fallaste el gimnasio',
    texto: 'El coach vio que entrenaste cuatro días y comiste mejor.',
    foto: { uri: 'file:///cache/e.jpg', fecha: '2026-10-01' },
  };

  it('recuerdo: el texto del coach y la foto, solo si se eligen', () => {
    expect(textos(recuerdo).detalle).toBeNull();
    expect(textos(recuerdo, todo).detalle).toContain('entrenaste');
    expect(textos(recuerdo).antetitulo).toBe('EVIDENCIA');
    expect(fotosVisibles(recuerdo, todo, { puedeCompartirFotos: true })).toHaveLength(1);
    expect(fotosVisibles(recuerdo, todo, { puedeCompartirFotos: false })).toEqual([]);
    expect(fotosVisibles(recuerdo, OPCIONES_POR_DEFECTO, { puedeCompartirFotos: true })).toEqual([]);
    expect(bloqueo(recuerdo, OPCIONES_POR_DEFECTO)).toBeNull();
    expect(bloqueo({ ...recuerdo, titulo: ' ' } as Tarjeta, OPCIONES_POR_DEFECTO)).not.toBeNull();
  });
});
