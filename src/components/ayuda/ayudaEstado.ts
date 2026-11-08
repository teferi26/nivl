// NIVL · Ayuda contextual: el almacén de módulo (una copia por dispositivo).
//
// Se lee una vez de AsyncStorage y se mantiene en memoria para que todas las
// pistas de la app se enteren a la vez (useSyncExternalStore). AsyncStorage se
// carga con import() dentro de un try, igual que src/i18n/preferencia.ts: sin
// módulo nativo, leer da null y guardar no hace nada.

import {
  apagarTodas,
  descartarPista,
  ESTADO_INICIAL,
  parsearEstado,
  reactivarTodas,
  serializarEstado,
  type EstadoAyuda,
  type RegistroPista,
} from './ayudaMath';

export const CLAVE_AYUDA = 'nivl.ayuda.v1';

export interface InstantaneaAyuda {
  /** false hasta leer el almacén: mientras tanto ninguna pista se pinta. */
  cargado: boolean;
  estado: EstadoAyuda;
  registros: readonly RegistroPista[];
}

interface Almacen {
  getItem(clave: string): Promise<string | null>;
  setItem(clave: string, valor: string): Promise<void>;
}

let almacenDePrueba: Almacen | null = null;

async function almacen(): Promise<Almacen | null> {
  if (almacenDePrueba) return almacenDePrueba;
  try {
    const mod = await import('@react-native-async-storage/async-storage');
    return (mod.default ?? null) as Almacen | null;
  } catch {
    return null;
  }
}

const INICIAL: InstantaneaAyuda = { cargado: false, estado: ESTADO_INICIAL, registros: [] };

let actual = INICIAL;
let carga: Promise<void> | null = null;
let colaEscritura: Promise<void> = Promise.resolve();
const oyentes = new Set<() => void>();

function publicar(siguiente: InstantaneaAyuda): void {
  actual = siguiente;
  oyentes.forEach((avisar) => avisar());
}

function cargar(): Promise<void> {
  carga ??= (async () => {
    let crudo: string | null = null;
    try {
      const a = await almacen();
      crudo = a ? await a.getItem(CLAVE_AYUDA) : null;
    } catch {
      // Sin lectura se empieza de cero: como mucho, una pista repetida.
    }
    publicar({ ...actual, cargado: true, estado: parsearEstado(crudo) });
  })();
  return carga;
}

/** En fila, para que dos escrituras seguidas no lleguen al revés. Nunca lanza. */
function guardar(estado: EstadoAyuda): void {
  const valor = serializarEstado(estado);
  colaEscritura = colaEscritura
    .then(async () => {
      const a = await almacen();
      if (a) await a.setItem(CLAVE_AYUDA, valor);
    })
    .catch(() => {});
}

/** Cambia el estado cuando ya se ha leído lo guardado, para no pisarlo. */
function mutar(cambio: (estado: EstadoAyuda) => EstadoAyuda): void {
  void cargar().then(() => {
    const estado = cambio(actual.estado);
    if (estado === actual.estado) return;
    publicar({ ...actual, estado });
    guardar(estado);
  });
}

export function suscribirAyuda(oyente: () => void): () => void {
  oyentes.add(oyente);
  void cargar();
  return () => {
    oyentes.delete(oyente);
  };
}

export const instantaneaAyuda = (): InstantaneaAyuda => actual;

export const descartarPistaGuardada = (id: string): void => mutar((e) => descartarPista(e, id));
export const apagarPistasGuardado = (): void => mutar(apagarTodas);
export const reactivarPistasGuardado = (): void => mutar(reactivarTodas);

/** Anota una pista de un grupo montada en pantalla. Devuelve cómo borrarla. */
export function registrarPista(registro: RegistroPista): () => void {
  publicar({ ...actual, registros: [...actual.registros, registro] });
  return () => {
    publicar({ ...actual, registros: actual.registros.filter((r) => r !== registro) });
  };
}

/** Solo pruebas. */
export function __reiniciarAyudaParaTest(prueba: Almacen | null = null): void {
  almacenDePrueba = prueba;
  actual = INICIAL;
  carga = null;
  colaEscritura = Promise.resolve();
  oyentes.clear();
}

/** Solo pruebas: se resuelve cuando la lectura y las escrituras han terminado. */
export async function __esperarAyudaParaTest(): Promise<void> {
  await cargar();
  await new Promise((listo) => setTimeout(listo, 0));
  await colaEscritura;
}
