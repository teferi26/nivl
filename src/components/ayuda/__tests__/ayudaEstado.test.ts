// NIVL · Ayuda contextual: el almacén de módulo sobre AsyncStorage.
import {
  __esperarAyudaParaTest,
  __reiniciarAyudaParaTest,
  apagarPistasGuardado,
  CLAVE_AYUDA,
  descartarPistaGuardada,
  instantaneaAyuda,
  reactivarPistasGuardado,
  registrarPista,
  suscribirAyuda,
} from '../ayudaEstado';

const disco = new Map<string, string>();
let fallaLectura = false;

const almacenFalso = {
  getItem: async (k: string) => {
    if (fallaLectura) throw new Error('sin almacén');
    return disco.get(k) ?? null;
  },
  setItem: async (k: string, v: string) => {
    disco.set(k, v);
  },
};

beforeEach(() => {
  disco.clear();
  fallaLectura = false;
  __reiniciarAyudaParaTest(almacenFalso);
});

it('no se considera cargado hasta leer el almacén', async () => {
  expect(instantaneaAyuda().cargado).toBe(false);
  suscribirAyuda(() => {});
  await __esperarAyudaParaTest();
  expect(instantaneaAyuda().cargado).toBe(true);
});

it('recupera lo guardado', async () => {
  disco.set(CLAVE_AYUDA, JSON.stringify({ descartadas: ['hoy.a'], apagadas: true }));
  await __esperarAyudaParaTest();
  expect(instantaneaAyuda().estado).toEqual({ descartadas: ['hoy.a'], apagadas: true });
});

it('si la lectura falla se empieza de cero, sin lanzar', async () => {
  fallaLectura = true;
  await __esperarAyudaParaTest();
  expect(instantaneaAyuda()).toMatchObject({ cargado: true, estado: { descartadas: [], apagadas: false } });
});

it('una escritura antes de cargar no pisa lo que había', async () => {
  disco.set(CLAVE_AYUDA, JSON.stringify({ descartadas: ['hoy.a'], apagadas: false }));
  descartarPistaGuardada('hoy.b');
  await __esperarAyudaParaTest();
  expect(instantaneaAyuda().estado.descartadas).toEqual(['hoy.a', 'hoy.b']);
  expect(JSON.parse(disco.get(CLAVE_AYUDA)!).descartadas).toEqual(['hoy.a', 'hoy.b']);
});

it('apagar y reactivar persisten y avisan a quien escucha', async () => {
  const oyente = jest.fn();
  suscribirAyuda(oyente);
  await __esperarAyudaParaTest();
  oyente.mockClear();

  apagarPistasGuardado();
  await __esperarAyudaParaTest();
  expect(oyente).toHaveBeenCalledTimes(1);
  expect(JSON.parse(disco.get(CLAVE_AYUDA)!).apagadas).toBe(true);

  reactivarPistasGuardado();
  await __esperarAyudaParaTest();
  expect(instantaneaAyuda().estado).toEqual({ descartadas: [], apagadas: false });
  expect(JSON.parse(disco.get(CLAVE_AYUDA)!).apagadas).toBe(false);
});

it('registrar y desmontar una pista la quita solo a ella', () => {
  const quitarA = registrarPista({ id: 'a.a', grupo: 'g', prioridad: 0 });
  registrarPista({ id: 'a.b', grupo: 'g', prioridad: 1 });
  expect(instantaneaAyuda().registros.map((r) => r.id)).toEqual(['a.a', 'a.b']);
  quitarA();
  expect(instantaneaAyuda().registros.map((r) => r.id)).toEqual(['a.b']);
});
