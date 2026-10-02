// El dictado al coach: permisos solo al dictar, local frente a red
// (sin_dictado_local), eventos, parar la voz, cancelar y sin módulo.

type Cb = (ev: unknown) => void;

const mockReco = {
  oyentes: new Map<string, Set<Cb>>(),
  emitir(nombre: string, ev: unknown) {
    for (const cb of [...(mockReco.oyentes.get(nombre) ?? [])]) cb(ev);
  },
  isRecognitionAvailable: jest.fn(() => true),
  supportsOnDeviceRecognition: jest.fn(() => true),
  getSupportedLocales: jest.fn(async (_o: unknown) => ({ locales: ['en-US', 'es-ES'], installedLocales: ['es-ES'] })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  requestMicrophonePermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  getPermissionsAsync: jest.fn(),
  addListener: jest.fn((nombre: string, cb: Cb) => {
    if (!mockReco.oyentes.has(nombre)) mockReco.oyentes.set(nombre, new Set());
    mockReco.oyentes.get(nombre)!.add(cb);
    return { remove: () => mockReco.oyentes.get(nombre)?.delete(cb) };
  }),
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
};

const mockSpeech = {
  speak: jest.fn((_t: string, o: { onStart?: () => void; onDone?: () => void }) => {
    setTimeout(() => {
      o.onStart?.();
      o.onDone?.();
    }, 0);
  }),
  stop: jest.fn(async () => undefined),
  getAvailableVoicesAsync: jest.fn(async () => []),
};

const mockNativos = new Set(['ExpoSpeech', 'ExpoSpeechRecognition']);
const mockPlatform = { OS: 'ios' as string };

jest.mock('expo', () => ({
  requireOptionalNativeModule: (n: string) => (mockNativos.has(n) ? {} : null),
}));
jest.mock('expo-speech', () => mockSpeech);
jest.mock('expo-speech-recognition', () => ({ ExpoSpeechRecognitionModule: mockReco }));
jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
  Platform: mockPlatform,
}));

type Voz = typeof import('../coachvoz');

function cargar(): Voz {
  let m!: Voz;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    m = require('../coachvoz');
  });
  return m;
}

const permisosPedidos = () =>
  mockReco.requestPermissionsAsync.mock.calls.length + mockReco.requestMicrophonePermissionsAsync.mock.calls.length;

beforeEach(() => {
  jest.clearAllMocks();
  mockReco.oyentes.clear();
  mockNativos.clear();
  mockNativos.add('ExpoSpeech');
  mockNativos.add('ExpoSpeechRecognition');
  mockPlatform.OS = 'android';
  mockReco.isRecognitionAvailable.mockImplementation(() => true);
  mockReco.supportsOnDeviceRecognition.mockImplementation(() => true);
  mockReco.getSupportedLocales.mockImplementation(async () => ({ locales: ['en-US', 'es-ES'], installedLocales: ['es-ES'] }));
  mockReco.requestPermissionsAsync.mockImplementation(async () => ({ granted: true, status: 'granted' }));
  mockReco.requestMicrophonePermissionsAsync.mockImplementation(async () => ({ granted: true, status: 'granted' }));
});

describe('permisos solo al dictar', () => {
  it('cargar, consultar disponibilidad y soporte local no pide permisos', async () => {
    const v = cargar();
    expect(v.disponibleDictado()).toBe(true);
    expect(await v.dictadoLocalDisponible()).toBe(true);
    expect(permisosPedidos()).toBe(0);
    expect(mockReco.start).not.toHaveBeenCalled();
  });

  it('Android local: pide permisos al dictar y arranca en el dispositivo', async () => {
    const v = cargar();
    const r = await v.dictar({});
    expect(r).toEqual({ ok: true, local: true });
    expect(mockReco.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockReco.start).toHaveBeenCalledWith(
      expect.objectContaining({ lang: 'es-ES', interimResults: true, requiresOnDeviceRecognition: true }),
    );
  });

  it('permiso denegado → sin_permiso y no arranca', async () => {
    mockReco.requestPermissionsAsync.mockImplementation(async () => ({ granted: false, status: 'denied' }));
    const v = cargar();
    const onError = jest.fn();
    const r = await v.dictar({ onError });
    expect(r).toMatchObject({ ok: false, error: { codigo: 'sin_permiso' } });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'sin_permiso' }));
    expect(mockReco.start).not.toHaveBeenCalled();
    expect(v.dictando()).toBe(false);
  });

  it('si pedir permisos lanza → sin_permiso, sin lanzar', async () => {
    mockReco.requestPermissionsAsync.mockImplementation(async () => {
      throw new Error('x');
    });
    const v = cargar();
    await expect(v.dictar({})).resolves.toMatchObject({ ok: false, error: { codigo: 'sin_permiso' } });
  });
});

describe('local frente a red', () => {
  it('sin soporte local → sin_dictado_local, sin pedir permisos ni arrancar', async () => {
    mockReco.supportsOnDeviceRecognition.mockImplementation(() => false);
    const v = cargar();
    const onError = jest.fn();
    const r = await v.dictar({ onError });
    expect(r).toMatchObject({ ok: false, error: { codigo: 'sin_dictado_local' } });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(permisosPedidos()).toBe(0);
    expect(mockReco.start).not.toHaveBeenCalled();
  });

  it('Android: es-ES soportado pero NO instalado → sin_dictado_local', async () => {
    mockPlatform.OS = 'android';
    mockReco.getSupportedLocales.mockImplementation(async () => ({ locales: ['es-ES'], installedLocales: ['en-US'] }));
    const v = cargar();
    await expect(v.dictar({})).resolves.toMatchObject({ ok: false, error: { codigo: 'sin_dictado_local' } });
  });

  it('Android: es-ES instalado → local con permisos completos', async () => {
    mockPlatform.OS = 'android';
    mockReco.getSupportedLocales.mockImplementation(async () => ({ locales: [], installedLocales: ['es_ES'] }));
    const v = cargar();
    await expect(v.dictar({})).resolves.toEqual({ ok: true, local: true });
    expect(mockReco.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('getSupportedLocales falla (Android ≤ 12) → no se da por local', async () => {
    mockPlatform.OS = 'android';
    mockReco.getSupportedLocales.mockImplementation(async () => {
      throw new Error('unsupported');
    });
    const v = cargar();
    expect(await v.dictadoLocalDisponible()).toBe(false);
  });

  it('con permitirRed (la UI ya avisó) dicta por la red', async () => {
    mockReco.supportsOnDeviceRecognition.mockImplementation(() => false);
    const v = cargar();
    const r = await v.dictar({ permitirRed: true });
    expect(r).toEqual({ ok: true, local: false });
    expect(mockReco.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockReco.start).toHaveBeenCalledWith(expect.objectContaining({ requiresOnDeviceRecognition: false }));
  });

  it('web: nunca es local', async () => {
    mockPlatform.OS = 'web';
    mockReco.supportsOnDeviceRecognition.mockImplementation(() => false);
    const v = cargar();
    await expect(v.dictar({})).resolves.toMatchObject({ ok: false, error: { codigo: 'sin_dictado_local' } });
  });
});

describe('sesión', () => {
  it('parciales, final y fin; suelta los oyentes', async () => {
    const v = cargar();
    const onParcial = jest.fn();
    const onFinal = jest.fn();
    const onFin = jest.fn();
    await v.dictar({ onParcial, onFinal, onFin });
    expect(v.dictando()).toBe(true);
    mockReco.emitir('result', { isFinal: false, results: [{ transcript: 'hoy he ' }] });
    mockReco.emitir('result', { isFinal: true, results: [{ transcript: 'hoy he entrenado' }] });
    mockReco.emitir('end', null);
    expect(onParcial).toHaveBeenCalledWith('hoy he');
    expect(onFinal).toHaveBeenCalledWith('hoy he entrenado');
    expect(onFin).toHaveBeenCalledTimes(1);
    expect(v.dictando()).toBe(false);
    for (const set of mockReco.oyentes.values()) expect(set.size).toBe(0);
  });

  it('errores del módulo → códigos propios; aborted no es error', async () => {
    const v = cargar();
    const onError = jest.fn();
    await v.dictar({ onError });
    mockReco.emitir('error', { error: 'no-speech', message: 'x' });
    mockReco.emitir('error', { error: 'aborted', message: 'x' });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'sin_voz', original: 'no-speech' }));
  });

  it('traducirError: language-not-supported depende de si era local', () => {
    const v = cargar();
    expect(v.traducirError('language-not-supported', true)).toBe('sin_dictado_local');
    expect(v.traducirError('language-not-supported', false)).toBe('no_disponible');
    expect(v.traducirError('not-allowed', true)).toBe('sin_permiso');
    expect(v.traducirError('network', false)).toBe('red');
    expect(v.traducirError('raro', false)).toBe('fallo');
    expect(v.traducirError('aborted', false)).toBeNull();
  });

  it('el mensaje de error es apto para la UI', () => {
    const v = cargar();
    const e = v.errorDictado('sin_dictado_local');
    expect(e.mensaje).toMatch(/local/);
    expect(e.mensaje).not.toMatch(/!!/);
  });

  it('detenerDictado pide el final; cancelarDictado lo tira', async () => {
    const v = cargar();
    const onFinal = jest.fn();
    const onFin = jest.fn();
    await v.dictar({ onFinal, onFin });
    v.detenerDictado();
    expect(mockReco.stop).toHaveBeenCalledTimes(1);
    v.cancelarDictado();
    expect(mockReco.abort).toHaveBeenCalledTimes(1);
    expect(onFin).toHaveBeenCalledTimes(1);
    mockReco.emitir('result', { isFinal: true, results: [{ transcript: 'tarde' }] });
    expect(onFinal).not.toHaveBeenCalled();
    expect(v.dictando()).toBe(false);
  });

  it('dictar de nuevo cancela la sesión anterior', async () => {
    const v = cargar();
    const fin1 = jest.fn();
    await v.dictar({ onFin: fin1 });
    await v.dictar({});
    expect(mockReco.abort).toHaveBeenCalledTimes(1);
    expect(fin1).toHaveBeenCalledTimes(1);
    expect(v.dictando()).toBe(true);
  });

  it('si start lanza → fallo, sin sesión colgada', async () => {
    mockReco.start.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const v = cargar();
    await expect(v.dictar({})).resolves.toMatchObject({ ok: false, error: { codigo: 'fallo' } });
    expect(v.dictando()).toBe(false);
  });

  it('reconocimiento no disponible → no_disponible sin permisos', async () => {
    mockReco.isRecognitionAvailable.mockImplementation(() => false);
    const v = cargar();
    expect(v.disponibleDictado()).toBe(false);
    await expect(v.dictar({})).resolves.toMatchObject({ ok: false, error: { codigo: 'no_disponible' } });
    expect(permisosPedidos()).toBe(0);
  });
});

describe('no hablar mientras se dicta', () => {
  it('dictar calla al coach y no le deja hablar hasta el final', async () => {
    const v = cargar();
    await v.dictar({});
    expect(mockSpeech.stop).toHaveBeenCalled();
    await v.hablar('Hola.');
    expect(mockSpeech.speak).not.toHaveBeenCalled();
    mockReco.emitir('end', null);
    await v.hablar('Hola.');
    expect(mockSpeech.speak).toHaveBeenCalledTimes(1);
  });

  it('un permiso denegado no deja la voz bloqueada', async () => {
    mockReco.requestPermissionsAsync.mockImplementation(async () => ({ granted: false, status: 'denied' }));
    const v = cargar();
    await v.dictar({});
    await v.hablar('Hola.');
    expect(mockSpeech.speak).toHaveBeenCalledTimes(1);
  });
});

describe('sin módulo nativo', () => {
  it('disponibleDictado false y dictar → sin_modulo, sin tocar nada', async () => {
    mockNativos.delete('ExpoSpeechRecognition');
    const v = cargar();
    expect(v.disponibleDictado()).toBe(false);
    expect(await v.dictadoLocalDisponible()).toBe(false);
    const r = await v.dictar({});
    expect(r).toMatchObject({ ok: false, error: { codigo: 'sin_modulo' } });
    expect(permisosPedidos()).toBe(0);
    expect(() => v.detenerDictado()).not.toThrow();
    expect(() => v.cancelarDictado()).not.toThrow();
  });

  it('sin ningún módulo de voz, el índice carga y todo degrada', async () => {
    mockNativos.clear();
    const v = cargar();
    expect(v.disponible()).toBe(false);
    expect(v.disponibleDictado()).toBe(false);
    await expect(v.hablar('Hola.')).resolves.toBeUndefined();
    await expect(v.dictar({})).resolves.toMatchObject({ ok: false });
  });
});

describe('iOS: nunca se promete dictado local (privacidad)', () => {
  // supportsOnDeviceRecognition mira el idioma del sistema y el nativo ignora
  // requiresOnDeviceRecognition si es-ES no tiene modelo local: el audio podría
  // salir a Apple sin aviso. En iOS la UI siempre avisa antes.
  beforeEach(() => {
    mockPlatform.OS = 'ios';
  });

  it('dictadoLocalDisponible es false en iOS aunque el sistema diga que sí', async () => {
    expect(await cargar().dictadoLocalDisponible()).toBe(false);
  });

  it('sin permitirRed devuelve sin_dictado_local y no pide permisos', async () => {
    const r = await cargar().dictar({});
    expect(r).toMatchObject({ ok: false, error: { codigo: 'sin_dictado_local' } });
    expect(permisosPedidos()).toBe(0);
  });

  it('con permitirRed pide el modo local igualmente cuando el sistema lo anuncia', async () => {
    const r = await cargar().dictar({ permitirRed: true });
    expect(r).toEqual({ ok: true, local: false });
    expect(mockReco.start).toHaveBeenCalledWith(expect.objectContaining({ requiresOnDeviceRecognition: true }));
    expect(mockReco.requestPermissionsAsync).toHaveBeenCalled();
  });
});
