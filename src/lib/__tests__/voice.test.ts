import type { DatosAviso } from '../notifyPlan';
import { deMisiones, desgloseXp, RUTA_AVISO, RUTAS_PERMITIDAS, rutaSegura, textoAviso, voice } from '../voice';

describe('desgloseXp', () => {
  it('sin nada pagado no dice nada', () => {
    expect(desgloseXp([])).toBe('');
    expect(desgloseXp([{ xp: 0, de: 'del diario' }])).toBe('');
  });

  it('una sola parte va sin suma', () => {
    expect(desgloseXp([{ xp: 50, de: 'a FUE por la sesión' }])).toBe('+50 XP a FUE por la sesión.');
  });

  it('el diario con misión enlazada cuadra con lo que enseña la misión', () => {
    // Misión de 10 + resto del módulo hasta 15: el caso del vídeo del 01/10.
    expect(
      desgloseXp([
        { xp: 10, de: deMisiones(['Escribir el diario']) },
        { xp: 5, de: 'a PER por el diario' },
      ]),
    ).toBe('+15 XP: 10 de la misión «Escribir el diario» (marcada sola) + 5 a PER por el diario.');
  });

  it('omite las partes a cero aunque haya varias', () => {
    expect(
      desgloseXp([
        { xp: 50, de: deMisiones(['Entrenar']) },
        { xp: 0, de: 'a FUE por la sesión' },
        { xp: 25, de: 'a FUE por 1 récord' },
      ]),
    ).toBe('+75 XP: 50 de la misión «Entrenar» (marcada sola) + 25 a FUE por 1 récord.');
  });
});

describe('deMisiones', () => {
  it('concuerda en número', () => {
    expect(deMisiones(['A'])).toBe('de la misión «A» (marcada sola)');
    expect(deMisiones(['A', 'B'])).toBe('de las misiones «A», «B» (marcadas solas)');
  });
});

/** Todas las variantes de una línea del banco: fuerza cada índice de pick(). */
function variantes(f: () => string): string[] {
  const out = new Set<string>();
  const spy = jest.spyOn(Math, 'random');
  try {
    for (let i = 0; i < 20; i++) {
      spy.mockReturnValue(i / 20);
      out.add(f());
    }
  } finally {
    spy.mockRestore();
  }
  return [...out];
}

const DATOS: DatosAviso[] = [
  { tipo: 'racha', racha: 1, faltan: 1 },
  { tipo: 'racha', racha: 12, faltan: 3 },
  { tipo: 'recuperacion', desbloqueada: false, pista: 'completa_una_mision', xp: 40 },
  { tipo: 'recuperacion', desbloqueada: true, pista: null, xp: 40 },
  { tipo: 'recuperacion', desbloqueada: true, pista: null, xp: 0 },
  { tipo: 'duelo', pendientes: 1 },
  { tipo: 'duelo', pendientes: 2 },
  { tipo: 'foto', pendientes: 1 },
  { tipo: 'foto', pendientes: 3 },
  { tipo: 'rango', clave: 'rango:D' },
  { tipo: 'rango', clave: 'insignia:x:3' },
  { tipo: 'rango', clave: null },
  { tipo: 'vuelta', dias: 7 },
  { tipo: 'vuelta', dias: 30 },
];

function todasLasLineas(): string[] {
  const banco = [
    voice.allDone, voice.levelUp, () => voice.penaltyApplied(30), voice.stoneUsed, voice.stoneEarned,
    () => voice.frozen('vacaciones'), voice.morningNotif, voice.eveningNotif,
    () => voice.dungeonCleared('Mes de hierro'), () => voice.pr('Sentadilla'), voice.achievement,
    ...[0, 1, 2, 3, 6, 7, 13, 14, 29, 30, 365].map((d) => () => voice.streakHype(d)),
  ].flatMap(variantes);
  const avisos = DATOS.flatMap((d) => {
    const t = textoAviso(d);
    return [t.titulo, t.cuerpo];
  });
  return [...banco, ...avisos];
}

describe('la voz del sistema', () => {
  const lineas = todasLasLineas();

  it('recorre de verdad el banco', () => {
    expect(lineas.length).toBeGreaterThan(50);
  });

  it.each(lineas)('sin guiones largos: %s', (l) => {
    expect(l).not.toMatch(/[—–]/);
  });

  it.each(lineas)('sin amenazas, urgencia ni desprecio: %s', (l) => {
    expect(l).not.toMatch(/penaliz|perder|perderás|no olvida|última|débiles/i);
  });

  it('sin comillas rectas: los títulos van entre «»', () => {
    expect(lineas.filter((l) => l.includes('"'))).toEqual([]);
    expect(variantes(() => voice.dungeonCleared('A'))).toEqual(
      expect.arrayContaining(['Campaña «A» completada. Todas las etapas cerradas.']),
    );
  });

  it('la racha larga nombra el rango de la arena, no la marca antigua', () => {
    const largas = variantes(() => voice.streakHype(40)).join(' ');
    expect(largas).not.toMatch(/rangos? S\b/);
    expect(largas).toContain('Leyenda');
  });
});

describe('textoAviso', () => {
  it('racha: singular y plural', () => {
    expect(textoAviso({ tipo: 'racha', racha: 1, faltan: 1 })).toEqual({
      titulo: 'Racha de 1 día',
      cuerpo: 'Te falta 1 misión para cerrar el día.',
    });
    expect(textoAviso({ tipo: 'racha', racha: 12, faltan: 2 })).toEqual({
      titulo: 'Racha de 12 días',
      cuerpo: 'Te faltan 2 misiones para cerrar el día.',
    });
  });

  it('recuperación: bloqueada da la pista; abierta, lo que vuelve', () => {
    expect(textoAviso({ tipo: 'recuperacion', desbloqueada: false, pista: 'completa_una_mision', xp: 40 }).cuerpo).toBe(
      'Completa una misión de hoy y la recuperación se abre.',
    );
    expect(textoAviso({ tipo: 'recuperacion', desbloqueada: true, pista: null, xp: 40 })).toEqual({
      titulo: 'Recuperación abierta',
      cuerpo: 'Completa la misión de recuperación y vuelven 40 XP.',
    });
  });

  it('duelo: singular y plural', () => {
    expect(textoAviso({ tipo: 'duelo', pendientes: 1 })).toEqual({ titulo: 'Tu duelo', cuerpo: 'Hay novedades en 1 duelo.' });
    expect(textoAviso({ tipo: 'duelo', pendientes: 3 })).toEqual({ titulo: 'Tus duelos', cuerpo: 'Hay novedades en 3 duelos.' });
  });

  it('foto: singular y plural, sin nombrar el cuerpo', () => {
    expect(textoAviso({ tipo: 'foto', pendientes: 1 })).toEqual({
      titulo: 'Fotos de la semana',
      cuerpo: 'Falta 1 de 3 para cerrar la semana.',
    });
    expect(textoAviso({ tipo: 'foto', pendientes: 2 }).cuerpo).toBe('Faltan 2 de 3 para cerrar la semana.');
    expect(textoAviso({ tipo: 'foto', pendientes: 9 }).cuerpo).toBe('Faltan 3 de 3 para cerrar la semana.');
    const t = textoAviso({ tipo: 'foto', pendientes: 2 });
    expect(`${t.titulo} ${t.cuerpo}`).not.toMatch(/cuerpo|peso/i);
  });

  it('rango: con clave de rango lo nombra; si no, genérico', () => {
    expect(textoAviso({ tipo: 'rango', clave: 'rango:D' })).toEqual({ titulo: 'Nuevo rango', cuerpo: 'Ya eres Gladiador. Entra a verlo.' });
    expect(textoAviso({ tipo: 'rango', clave: 'rango:Z' }).titulo).toBe('La arena te reconoce');
    expect(textoAviso({ tipo: 'rango', clave: null }).titulo).toBe('La arena te reconoce');
  });

  it('vuelta: una puerta abierta, sin culpa', () => {
    expect(textoAviso({ tipo: 'vuelta', dias: 7 }).titulo).toBe('La arena sigue aquí');
    expect(textoAviso({ tipo: 'vuelta', dias: 30 }).titulo).toBe('La puerta sigue abierta');
    for (const dias of [7, 30] as const) {
      const t = textoAviso({ tipo: 'vuelta', dias });
      expect(`${t.titulo} ${t.cuerpo}`).not.toMatch(/racha|XP|echamos|rota/i);
    }
  });
});

describe('rutas de los avisos', () => {
  it('cada ruta de RUTA_AVISO está permitida', () => {
    for (const r of Object.values(RUTA_AVISO)) expect(RUTAS_PERMITIDAS).toContain(r);
  });

  it('rutaSegura deja pasar las permitidas', () => {
    for (const r of RUTAS_PERMITIDAS) expect(rutaSegura(r)).toBe(r);
  });

  it('rutaSegura manda a Hoy lo que no está en la lista', () => {
    expect(rutaSegura('/pro')).toBe('/(tabs)');
    expect(rutaSegura(42)).toBe('/(tabs)');
    expect(rutaSegura('https://x')).toBe('/(tabs)');
    expect(rutaSegura(undefined)).toBe('/(tabs)');
    expect(rutaSegura('/(tabs)/coach?x=1')).toBe('/(tabs)');
  });
});
