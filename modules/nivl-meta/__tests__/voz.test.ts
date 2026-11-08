import {
  aclarar,
  candidataDeVoz,
  detectarIntencion,
  interpretarRespuesta,
  normalizar,
} from '../src/voz';
import type { Candidata, MisionPendiente } from '../src/tipos';

const m = (id: string, titulo: string): MisionPendiente => ({ id, titulo });
const PENDIENTES = [
  m('gym', 'Ir al gimnasio'),
  m('cama', 'Hacer la cama'),
  m('flex', '50 flexiones'),
  m('hist', 'Estudiar historia'),
  m('mates', 'Estudiar matemáticas'),
];

function confirmada(c: Candidata): string | null {
  return c.tipo === 'confirmar' ? c.mision.id : null;
}

describe('normalizar', () => {
  it('quita tildes, signos y mayúsculas', () => {
    expect(normalizar('¡Ya está, HECHO!')).toBe('ya esta hecho');
    expect(normalizar('Matemáticas ¿sí?')).toBe('matematicas si');
  });

  it('quita muletillas, también seguidas y de varias palabras', () => {
    expect(normalizar('eh eh pues o sea he terminado')).toBe('he terminado');
    expect(normalizar('Hey Meta, a ver, la siguiente por favor')).toBe('la siguiente');
  });

  it('no se come las palabras que las contienen', () => {
    expect(normalizar('emparejar')).toBe('emparejar');
  });

  it('vacío, null y undefined son cadena vacía', () => {
    expect(normalizar('')).toBe('');
    expect(normalizar(null)).toBe('');
    expect(normalizar(undefined)).toBe('');
  });
});

describe('detectarIntencion', () => {
  it.each([
    ['he terminado el gimnasio', 'completar'],
    ['Ya está la cama', 'completar'],
    ['marca las flexiones', 'completar'],
    ['fui al gym', 'completar'],
    ['¿cuál es la siguiente?', 'siguiente'],
    ['qué me toca ahora', 'siguiente'],
    ['repítelo', 'repetir'],
    ['otra vez', 'repetir'],
    ['no te he oído', 'repetir'],
    ['cancela', 'cancelar'],
    ['déjalo', 'cancelar'],
    ['olvídalo, he terminado', 'cancelar'],
    ['no', 'cancelar'],
    ['qué buen día hace', 'nada'],
    ['', 'nada'],
    ['eh', 'nada'],
  ])('%s: %s', (frase, esperada) => {
    expect(detectarIntencion(frase)).toBe(esperada);
  });

  it.each([
    'no he hecho la cama',
    'todavía no he ido al gimnasio',
    'no lo he terminado aún',
    'nunca he hecho flexiones',
  ])('la negación no completa: %s', (frase) => {
    expect(detectarIntencion(frase)).toBe('nada');
  });

  it.each(['voy a terminar el gym', 'luego hago la cama', 'tengo que hacer flexiones'])(
    'lo que aún no ha pasado no completa: %s',
    (frase) => {
      expect(detectarIntencion(frase)).toBe('nada');
    },
  );
});

describe('candidataDeVoz', () => {
  it('propone confirmar la que casa', () => {
    const c = candidataDeVoz('he hecho la cama', PENDIENTES);
    expect(c).toEqual({
      tipo: 'confirmar',
      mision: PENDIENTES[1],
      pregunta: '¿Confirmas Hacer la cama? Di sí o no.',
    });
  });

  it('tolera tildes y plurales en los dos sentidos', () => {
    expect(confirmada(candidataDeVoz('he terminado de estudiar matematicas', PENDIENTES))).toBe(
      'mates',
    );
    expect(confirmada(candidataDeVoz('hechas las flexión 50', PENDIENTES))).toBe('flex');
    const clases = [m('c', 'Repasar las clases')];
    expect(confirmada(candidataDeVoz('he acabado de repasar la clase', clases))).toBe('c');
    const luz = [m('l', 'Apagar la luz')];
    expect(confirmada(candidataDeVoz('hecho apagar las luces', luz))).toBe('l');
  });

  it('gym y gimnasio son lo mismo', () => {
    expect(confirmada(candidataDeVoz('he ido al gym', PENDIENTES))).toBe('gym');
  });

  it('una palabra de una misión larga basta si la frase es solo eso', () => {
    const lista = [m('s', '100 sentadillas antes de desayunar'), m('c', 'Hacer la cama')];
    expect(confirmada(candidataDeVoz('he hecho las sentadillas', lista))).toBe('s');
  });

  it('empate: pregunta y da las opciones', () => {
    const c = candidataDeVoz('he terminado de estudiar', PENDIENTES);
    expect(c.tipo).toBe('ambigua');
    if (c.tipo === 'ambigua') {
      expect(c.opciones.map((o) => o.id)).toEqual(['hist', 'mates']);
      expect(c.pregunta).toBe('¿Estudiar historia o Estudiar matemáticas?');
    }
  });

  it('dos misiones en una frase son un empate', () => {
    const c = candidataDeVoz('he hecho el gym y la cama', PENDIENTES);
    expect(c.tipo).toBe('ambigua');
  });

  it('baja confianza: no se arriesga aunque haya una sola parecida', () => {
    const lista = [m('h', 'Estudiar historia del arte')];
    const c = candidataDeVoz('he terminado de estudiar química orgánica', lista);
    expect(c.tipo).toBe('ambigua');
    if (c.tipo === 'ambigua') expect(c.opciones).toEqual(lista);
  });

  it('nada casa: pide aclarar sin opciones', () => {
    const c = candidataDeVoz('he terminado de pintar la valla', PENDIENTES);
    expect(c.tipo).toBe('ambigua');
    if (c.tipo === 'ambigua') expect(c.opciones).toEqual([]);
  });

  it('«hecho» a secas pregunta, también con una sola pendiente', () => {
    expect(candidataDeVoz('hecho', [PENDIENTES[0]]).tipo).toBe('ambigua');
  });

  it('sin pendientes lo dice', () => {
    const c = candidataDeVoz('he hecho la cama', []);
    expect(c.tipo === 'ambigua' && c.pregunta).toBe('No quedan misiones pendientes.');
  });

  it('los otros gestos pasan tal cual, sin misión', () => {
    expect(candidataDeVoz('la siguiente', PENDIENTES)).toEqual({ tipo: 'siguiente' });
    expect(candidataDeVoz('repite', PENDIENTES)).toEqual({ tipo: 'repetir' });
    expect(candidataDeVoz('cancela', PENDIENTES)).toEqual({ tipo: 'cancelar' });
    expect(candidataDeVoz('', PENDIENTES)).toEqual({ tipo: 'nada' });
    expect(candidataDeVoz(null, PENDIENTES)).toEqual({ tipo: 'nada' });
  });

  it('nombrar una misión sin decir que está hecha no propone nada', () => {
    expect(candidataDeVoz('la cama', PENDIENTES)).toEqual({ tipo: 'nada' });
    expect(candidataDeVoz('no he hecho la cama', PENDIENTES)).toEqual({ tipo: 'nada' });
  });

  it('es determinista', () => {
    const a = candidataDeVoz('he hecho la cama', PENDIENTES);
    expect(candidataDeVoz('he hecho la cama', PENDIENTES)).toEqual(a);
  });
});

describe('aclarar', () => {
  it('con una sola opción, el sí lleva a confirmar y el no cancela', () => {
    const una = [{ id: 'x', titulo: 'Leer 30 minutos' }];
    expect(aclarar('sí', una).tipo).toBe('confirmar');
    expect(aclarar('no', una)).toEqual({ tipo: 'cancelar' });
  });

  it('el mismo acierto en dos títulos es ambiguo', () => {
    const dos = [
      { id: 'a', titulo: 'Leer 30 minutos' },
      { id: 'b', titulo: 'Leer el libro' },
    ];
    expect(candidataDeVoz('marca leer', dos).tipo).toBe('ambigua');
  });

  const opciones = [PENDIENTES[3], PENDIENTES[4]];

  it('basta con nombrarla', () => {
    expect(confirmada(aclarar('la de historia', opciones))).toBe('hist');
  });

  it('sigue pidiendo confirmar, no completa', () => {
    expect(aclarar('matemáticas', opciones).tipo).toBe('confirmar');
  });

  it('cancelar o el silencio cortan', () => {
    expect(aclarar('déjalo', opciones)).toEqual({ tipo: 'cancelar' });
    expect(aclarar('', opciones)).toEqual({ tipo: 'nada' });
  });
});

describe('interpretarRespuesta', () => {
  it.each(['sí', 'Sí, confirmo', 'vale', 'claro', 'de acuerdo', 'bueno, sí', 'sí sí'])(
    'afirma: %s',
    (r) => {
      expect(interpretarRespuesta(r, true)).toBe('si');
    },
  );

  it.each(['no', 'No, espera', 'mejor no', 'sí, no', 'cancela', 'todavía', 'vale, no'])(
    'niega: %s',
    (r) => {
      expect(interpretarRespuesta(r, true)).toBe('no');
    },
  );

  it.each([null, undefined, '', '   ', 'eh', 'si quieres luego', 'qué hora es', 'sí mañana', 'hecho', '¿sí?', '¿vale?', 'a ver, vale', 'eh, sí'])(
    'el silencio y la duda no son un sí: %s',
    (r) => {
      expect(interpretarRespuesta(r, true)).toBe('nada');
    },
  );

  it('un parcial nunca afirma', () => {
    expect(interpretarRespuesta('si', false)).toBe('nada');
  });
});
