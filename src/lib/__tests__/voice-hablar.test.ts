// La voz del coach (TTS): elección de voz, cola, parar, segundo plano y
// degradación sin módulo nativo. expo-speech y react-native van simulados.

type Opts = {
  language?: string;
  rate?: number;
  pitch?: number;
  voice?: string;
  onStart?: () => void;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (e: Error) => void;
};

const mockEstado = {
  auto: true, // true: cada trozo arranca y termina solo
  actual: null as Opts | null,
  dichos: [] as { texto: string; opts: Opts }[],
};

const mockSpeech = {
  speak: jest.fn((texto: string, opts: Opts) => {
    mockEstado.dichos.push({ texto, opts });
    mockEstado.actual = opts;
    if (mockEstado.auto) {
      setTimeout(() => {
        opts.onStart?.();
        setTimeout(() => {
          if (mockEstado.actual === opts) mockEstado.actual = null;
          opts.onDone?.();
        }, 0);
      }, 0);
    } else {
      setTimeout(() => opts.onStart?.(), 0);
    }
  }),
  stop: jest.fn(async () => {
    const o = mockEstado.actual;
    mockEstado.actual = null;
    o?.onStopped?.();
  }),
  getAvailableVoicesAsync: jest.fn(async () => [] as unknown[]),
};

const mockRequireOptional = jest.fn((_nombre: string): unknown => ({}));
const mockAppState = {
  currentState: 'active' as string | null,
  oyentes: [] as ((s: string) => void)[],
  addEventListener: jest.fn((_ev: string, cb: (s: string) => void) => {
    mockAppState.oyentes.push(cb);
    return { remove: jest.fn() };
  }),
};
const mockPlatform = { OS: 'ios' as string };

jest.mock('expo', () => ({ requireOptionalNativeModule: (n: string) => mockRequireOptional(n) }));
jest.mock('expo-speech', () => mockSpeech);
jest.mock('react-native', () => ({ AppState: mockAppState, Platform: mockPlatform }));

type Hablar = typeof import('../coachvoz/hablar');

function cargar(): Hablar {
  let m!: Hablar;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    m = require('../coachvoz/hablar');
  });
  return m;
}

const espera = () => new Promise((r) => setTimeout(r, 5));

const VOCES = [
  { identifier: 'com.apple.voice.compact.es-ES.Monica', name: 'Mónica', quality: 'Default', language: 'es-ES' },
  { identifier: 'com.apple.voice.enhanced.es-ES.Jorge', name: 'Jorge', quality: 'Enhanced', language: 'es-ES' },
  { identifier: 'com.apple.voice.enhanced.es-MX.Paulina', name: 'Paulina', quality: 'Enhanced', language: 'es-MX' },
  { identifier: 'com.apple.speech.synthesis.voice.Grandpa', name: 'Grandpa', quality: 'Enhanced', language: 'es-ES' },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockEstado.auto = true;
  mockEstado.actual = null;
  mockEstado.dichos = [];
  mockAppState.currentState = 'active';
  mockAppState.oyentes = [];
  mockPlatform.OS = 'ios';
  mockRequireOptional.mockImplementation(() => ({}));
  mockSpeech.getAvailableVoicesAsync.mockImplementation(async () => VOCES);
});

describe('elegirVoz', () => {
  const { elegirVoz } = cargar();
  it('prefiere la Enhanced es-ES', () => {
    expect(elegirVoz(VOCES as never)).toBe('com.apple.voice.enhanced.es-ES.Jorge');
  });
  it('descarta otros idiomas y las voces de novedad', () => {
    expect(elegirVoz([VOCES[2], VOCES[3]] as never)).toBeNull();
  });
  it('se queda con la compacta si es la única es-ES', () => {
    expect(elegirVoz([VOCES[0], VOCES[2]] as never)).toBe('com.apple.voice.compact.es-ES.Monica');
  });
  it('Android: local antes que de red, acepta es_ES', () => {
    const v = [
      { identifier: 'es-es-x-eed-network', name: 'n', quality: 'Enhanced', language: 'es_ES' },
      { identifier: 'es-es-x-eed-local', name: 'l', quality: 'Enhanced', language: 'es_ES' },
    ];
    expect(elegirVoz(v as never)).toBe('es-es-x-eed-local');
  });
  it('premium por encima de enhanced', () => {
    const v = [
      { identifier: 'com.apple.voice.enhanced.es-ES.Jorge', name: 'Jorge', quality: 'Enhanced', language: 'es-ES' },
      { identifier: 'com.apple.voice.premium.es-ES.Monica', name: 'Mónica', quality: 'Enhanced', language: 'es-ES' },
    ];
    expect(elegirVoz(v as never)).toBe('com.apple.voice.premium.es-ES.Monica');
  });
  it('lista vacía o rara → null', () => {
    expect(elegirVoz([])).toBeNull();
    expect(elegirVoz([{ identifier: '', name: '', quality: 'Default', language: 'es-ES' }] as never)).toBeNull();
  });
});

describe('hablar', () => {
  it('lee los trozos en orden con la voz del coach', async () => {
    const v = cargar();
    const fin = jest.fn();
    const largo = `## Hoy\n${'El sistema constata que has cumplido la misión del día con 4×10. '.repeat(6)}`;
    await v.hablar(largo, { onFin: fin });
    expect(mockSpeech.speak.mock.calls.length).toBeGreaterThan(1);
    for (const { texto, opts } of mockEstado.dichos) {
      expect(texto.length).toBeLessThanOrEqual(200);
      expect(texto).not.toMatch(/[#×]/);
      expect(opts.language).toBe('es-ES');
      expect(opts.rate).toBe(0.95);
      expect(opts.pitch).toBe(0.9);
      expect(opts.voice).toBe('com.apple.voice.enhanced.es-ES.Jorge');
    }
    expect(mockEstado.dichos[0].texto.startsWith('Hoy.')).toBe(true);
    expect(fin).toHaveBeenCalledWith('terminado');
    expect(v.estaHablando()).toBe(false);
  });

  it('cachea la voz: una sola consulta para varias respuestas', async () => {
    const v = cargar();
    await v.hablar('Uno.');
    await v.hablar('Dos.');
    expect(mockSpeech.getAvailableVoicesAsync).toHaveBeenCalledTimes(1);
  });

  it('no cachea una lista vacía (Android aún cargando voces)', async () => {
    const v = cargar();
    mockSpeech.getAvailableVoicesAsync.mockImplementationOnce(async () => []);
    await v.hablar('Uno.');
    expect(mockEstado.dichos[0].opts.voice).toBeUndefined();
    await v.hablar('Dos.');
    expect(mockSpeech.getAvailableVoicesAsync).toHaveBeenCalledTimes(2);
    expect(mockEstado.dichos[1].opts.voice).toBe('com.apple.voice.enhanced.es-ES.Jorge');
  });

  it('si fallan las voces, habla igual con language es-ES', async () => {
    const v = cargar();
    mockSpeech.getAvailableVoicesAsync.mockImplementationOnce(async () => {
      throw new Error('x');
    });
    await v.hablar('Hola.');
    expect(mockEstado.dichos[0].opts).toMatchObject({ language: 'es-ES' });
    expect(mockEstado.dichos[0].opts.voice).toBeUndefined();
  });

  it('estaHablando y suscribirHablando siguen el estado', async () => {
    const v = cargar();
    mockEstado.auto = false;
    const estados: boolean[] = [];
    const baja = v.suscribirHablando((h) => estados.push(h));
    const p = v.hablar('Uno. Dos.');
    await espera();
    expect(v.estaHablando()).toBe(true);
    v.parar();
    await p;
    expect(v.estaHablando()).toBe(false);
    expect(estados).toEqual([true, false]);
    baja();
  });

  it('parar() vacía la cola: no se dice nada más', async () => {
    const v = cargar();
    mockEstado.auto = false;
    const fin = jest.fn();
    const inicio = jest.fn();
    const p = v.hablar(`${'a'.repeat(150)}. ${'b'.repeat(150)}. ${'c'.repeat(150)}.`, { onFin: fin, onInicio: inicio });
    await espera();
    expect(mockSpeech.speak).toHaveBeenCalledTimes(1);
    expect(inicio).toHaveBeenCalledTimes(1);
    v.parar();
    await p;
    await espera();
    expect(mockSpeech.speak).toHaveBeenCalledTimes(1);
    expect(mockSpeech.stop).toHaveBeenCalled();
    expect(fin).toHaveBeenCalledWith('parado');
    expect(fin).toHaveBeenCalledTimes(1);
  });

  it('una respuesta nueva corta la anterior', async () => {
    const v = cargar();
    mockEstado.auto = false;
    const fin1 = jest.fn();
    const p1 = v.hablar(`${'a'.repeat(150)}. ${'b'.repeat(150)}.`, { onFin: fin1 });
    await espera();
    mockEstado.auto = true;
    await v.hablar('Nueva.');
    await p1;
    expect(fin1).toHaveBeenCalledWith('parado');
    expect(mockEstado.dichos.map((d) => d.texto)).toEqual([`${'a'.repeat(150)}.`, 'Nueva.']);
  });

  it('error del nativo → termina con error, sin lanzar', async () => {
    const v = cargar();
    mockSpeech.speak.mockImplementationOnce((_t: string, o: Opts) => {
      setTimeout(() => o.onError?.(new Error('tts')), 0);
    });
    const fin = jest.fn();
    await expect(v.hablar('Uno.', { onFin: fin })).resolves.toBeUndefined();
    expect(fin).toHaveBeenCalledWith('error');
  });

  it('texto vacío o solo emojis → no habla', async () => {
    const v = cargar();
    const fin = jest.fn();
    await v.hablar('🔥💪', { onFin: fin });
    expect(mockSpeech.speak).not.toHaveBeenCalled();
    expect(fin).toHaveBeenCalledWith('nada');
  });

  it('crudo: no limpia pero trocea', async () => {
    const v = cargar();
    await v.hablar('**hola**', { crudo: true });
    expect(mockEstado.dichos[0].texto).toBe('**hola**');
  });
});

describe('sin módulo nativo', () => {
  it('requireOptionalNativeModule null → disponible false y hablar no hace nada', async () => {
    mockRequireOptional.mockImplementation(() => null);
    const v = cargar();
    expect(v.disponible()).toBe(false);
    const fin = jest.fn();
    await expect(v.hablar('Hola.', { onFin: fin })).resolves.toBeUndefined();
    expect(fin).toHaveBeenCalledWith('nada');
    expect(mockSpeech.speak).not.toHaveBeenCalled();
    expect(() => v.parar()).not.toThrow();
    expect(v.estaHablando()).toBe(false);
  });

  it('si la carga del paquete lanza, degrada igual', async () => {
    mockRequireOptional.mockImplementation(() => {
      throw new Error('no native');
    });
    const v = cargar();
    expect(v.disponible()).toBe(false);
    await expect(v.hablar('Hola.')).resolves.toBeUndefined();
  });

  it('web sin speechSynthesis → no disponible; con él, sí', () => {
    mockPlatform.OS = 'web';
    expect(cargar().disponible()).toBe(false);
    (globalThis as { speechSynthesis?: unknown }).speechSynthesis = {};
    try {
      expect(cargar().disponible()).toBe(true);
      expect(mockRequireOptional).not.toHaveBeenCalled();
    } finally {
      delete (globalThis as { speechSynthesis?: unknown }).speechSynthesis;
    }
  });
});

describe('segundo plano', () => {
  it('pararAlSegundoPlano es idempotente y calla al pasar a fondo', async () => {
    const v = cargar();
    v.pararAlSegundoPlano();
    v.pararAlSegundoPlano();
    await v.hablar('Uno.');
    expect(mockAppState.addEventListener).toHaveBeenCalledTimes(1);
    mockEstado.auto = false;
    const p = v.hablar('Dos. Tres.');
    await espera();
    mockSpeech.stop.mockClear();
    mockAppState.oyentes[0]('background');
    await p;
    expect(mockSpeech.stop).toHaveBeenCalled();
    expect(v.estaHablando()).toBe(false);
  });

  it('volver a primer plano no hace hablar', () => {
    const v = cargar();
    v.pararAlSegundoPlano();
    mockAppState.oyentes[0]('active');
    expect(mockSpeech.stop).not.toHaveBeenCalled();
    expect(mockSpeech.speak).not.toHaveBeenCalled();
  });

  it('con la app en segundo plano no empieza a hablar', async () => {
    const v = cargar();
    mockAppState.currentState = 'background';
    await v.hablar('Hola.');
    expect(mockSpeech.speak).not.toHaveBeenCalled();
  });
});

describe('silencio (dictado en marcha)', () => {
  it('fijarSilencio(true) calla y bloquea; false lo libera', async () => {
    const v = cargar();
    v.fijarSilencio(true);
    expect(mockSpeech.stop).toHaveBeenCalled();
    await v.hablar('Hola.');
    expect(mockSpeech.speak).not.toHaveBeenCalled();
    v.fijarSilencio(false);
    await v.hablar('Hola.');
    expect(mockSpeech.speak).toHaveBeenCalledTimes(1);
  });
});
