import fs from 'fs';
import path from 'path';

import type { Tarjeta } from '../src/tipos';

let mockNativo: Record<string, unknown> | null = null;

jest.mock('expo', () => ({
  requireOptionalNativeModule: jest.fn(() => mockNativo),
}));

const MODULO = path.join(__dirname, '..');
const REPO = path.join(MODULO, '..', '..');

const TARJETA: Tarjeta = {
  id: 'x',
  tipo: 'mision',
  lineas: [{ estilo: 'heading', texto: 'Hacer la cama' }],
  boton: { id: 'hecho', texto: 'Hecho' },
  hablado: 'Hacer la cama.',
};

function cargar(nativo: Record<string, unknown> | null): typeof import('../src/index') {
  mockNativo = nativo;
  jest.resetModules();
  return jest.requireActual('../src/index');
}

function archivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    return e.isDirectory() ? archivos(ruta) : [ruta];
  });
}

describe('sin el módulo nativo', () => {
  it('disponible es false y nada lanza', async () => {
    const m = cargar(null);
    expect(m.disponible()).toBe(false);
    await expect(m.estado()).resolves.toBe('no_disponible');
    await expect(m.registrar()).resolves.toBe(false);
    await expect(m.mostrar(TARJETA)).resolves.toBe(false);
    await expect(m.cerrar()).resolves.toBe(false);
  });

  it('hablarTexto no existe', () => {
    const m = cargar(null);
    expect(m.hablarTexto).toBeUndefined();
  });

  it('suscribir devuelve una baja inofensiva y el callback nunca salta', () => {
    const m = cargar(null);
    const cb = jest.fn();
    const baja = m.suscribir('estado', cb);
    expect(() => baja()).not.toThrow();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('con el módulo nativo', () => {
  it('pasa la tarjeta ya acotada', async () => {
    const mostrar = jest.fn();
    const m = cargar({ mostrar });
    const larga = {
      ...TARJETA,
      lineas: [{ estilo: 'heading' as const, texto: 'palabra '.repeat(40) }],
    };
    await expect(m.mostrar(larga)).resolves.toBe(true);
    const enviada = mostrar.mock.calls[0][0] as Tarjeta;
    expect(enviada.lineas[0].texto.length).toBeLessThanOrEqual(m.LIMITES.heading);
  });

  it('hablarTexto solo aparece si el nativo la trae', async () => {
    const hablarTexto = jest.fn();
    const m = cargar({ hablarTexto });
    await expect(m.hablarTexto?.('Quedan 3.')).resolves.toBe(true);
    expect(hablarTexto).toHaveBeenCalledWith('Quedan 3.');
    await expect(m.hablarTexto?.('   ')).resolves.toBe(false);
    expect(hablarTexto).toHaveBeenCalledTimes(1);
  });

  it('un estado desconocido es no_disponible', async () => {
    const m = cargar({ estado: () => 'raro' });
    await expect(m.estado()).resolves.toBe('no_disponible');
  });

  it('un fallo del nativo no sube', async () => {
    const falla = () => {
      throw new Error('sesión interrumpida');
    };
    const m = cargar({
      estado: falla,
      registrar: falla,
      mostrar: () => Promise.reject(new Error('x')),
      hablarTexto: falla,
      cerrar: falla,
      addListener: falla,
    });
    await expect(m.estado()).resolves.toBe('no_disponible');
    await expect(m.registrar()).resolves.toBe(false);
    await expect(m.mostrar(TARJETA)).resolves.toBe(false);
    await expect(m.hablarTexto?.('hola')).resolves.toBe(false);
    await expect(m.cerrar()).resolves.toBe(false);
    expect(() => m.suscribir('boton', jest.fn())()).not.toThrow();
  });

  it('suscribir engancha y da de baja', () => {
    const remove = jest.fn();
    const addListener = jest.fn(() => ({ remove }));
    const m = cargar({ addListener });
    const cb = jest.fn();
    const baja = m.suscribir('transcripcion', cb);
    expect(addListener).toHaveBeenCalledWith('transcripcion', cb);
    baja();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('el módulo sigue apagado en producción', () => {
  it('no existe expo-module.config.json', () => {
    expect(fs.existsSync(path.join(MODULO, 'expo-module.config.json'))).toBe(false);
  });

  it('la configuración interna sigue guardada con su nombre', () => {
    const ruta = path.join(MODULO, 'expo-module.config.interno.json');
    expect(JSON.parse(fs.readFileSync(ruta, 'utf8'))).toEqual({
      platforms: ['apple'],
      apple: { modules: ['NivlMetaModule'] },
    });
  });

  it('ningún archivo de src/ del repo lo importa', () => {
    const culpables = archivos(path.join(REPO, 'src')).filter((a) => {
      if (!/\.(ts|tsx|js|jsx)$/.test(a)) return false;
      return /nivl-meta|NivlMeta/.test(fs.readFileSync(a, 'utf8'));
    });
    expect(culpables).toEqual([]);
  });
});
