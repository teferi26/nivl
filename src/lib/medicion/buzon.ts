// NIVL · El buzón de entrenos medidos (efectos).
//
// Todo lo que miden el reloj, el GPS y Salud entra por aquí, de uno en uno:
// se normaliza, se descartan los duplicados entre orígenes y se entrega al
// almacén. El buzón no decide XP: paga quien guarda, una sola vez.
//
// Sin permiso de salud no se sube nada y todo se queda donde estaba. Confirmar
// (`true`) solo significa «ya no hace falta reintentar»: guardado, duplicado o
// ilegible para siempre.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { conCerrojoCardio } from '@/lib/cerrojoCardio';
import { dateKey } from '@/lib/dates';
import { normalizarEntreno, type EntrenoMedido } from '@/lib/entrenoMedido';
import { fetchHealthConsent } from '@/lib/health';
import { duenoEntreno } from '@/watch/contrato';
import { alRecibirEntrenoReloj, vaciarEntrenosReloj } from '@/watch/puente';
import { almacenEntrenos, borrarAlmacenLocal } from './almacen';
import { filtrarNuevos } from './fusion';
import { subirResumenesSalud } from './saludDiaria';
import { confirmarAncla, disponible, entrenosNuevos, hayQuePreguntar, reiniciarAncla } from './saludNativa';

// El cerrojo serie: dos entrenos a la vez verían la misma lista de conocidos.
let cola: Promise<unknown> = Promise.resolve();
function enSerie<T>(fn: () => Promise<T>): Promise<T> {
  const resultado = cola.then(fn, fn);
  cola = resultado.catch(() => {});
  return resultado;
}

function leer(json: string): EntrenoMedido | null {
  try {
    const r = normalizarEntreno(JSON.parse(json));
    return r.ok ? r.entreno : null;
  } catch {
    return null;
  }
}

/** `retenido` es el único que hay que reintentar. */
export type ResultadoEntrega = 'guardado' | 'duplicado' | 'ilegible' | 'retenido';

function leerRespuesta(r: unknown): ResultadoEntrega {
  if (typeof r !== 'object' || r === null) return 'guardado';
  const { ok, nuevo } = r as { ok?: unknown; nuevo?: unknown };
  if (ok === false) return 'retenido';
  return nuevo === false ? 'duplicado' : 'guardado';
}

const confirmable = (r: ResultadoEntrega) => r !== 'retenido';

/** Un día de margen: un entreno puede cruzar la medianoche respecto a su duplicado. */
function desdeParaDuplicados(entrenos: EntrenoMedido[]): string {
  const minimo = Math.min(...entrenos.map((e) => Date.parse(e.inicio)));
  const d = new Date(minimo);
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}

/** Una respuesta por JSON, en orden. Sin permiso o sin poder comparar, todo se retiene. */
async function procesarLote(userId: string, jsons: string[]): Promise<ResultadoEntrega[]> {
  const retener = (): ResultadoEntrega[] => jsons.map(() => 'retenido');
  try {
    if (!(await fetchHealthConsent()).accepted) return retener();
  } catch {
    return retener();
  }

  const leidos = jsons.map(leer);
  const validos = leidos.filter((e): e is EntrenoMedido => e !== null);
  if (!validos.length) return jsons.map(() => 'ilegible');

  const almacen = almacenEntrenos();
  let conocidos: EntrenoMedido[];
  try {
    conocidos = await almacen.listarRecientes(userId, desdeParaDuplicados(validos));
  } catch {
    // Sin conocidos no se distingue un duplicado de otro origen, y cobraría dos veces.
    return retener();
  }

  const salida: ResultadoEntrega[] = [];
  for (const entreno of leidos) {
    if (entreno === null) {
      salida.push('ilegible');
      continue;
    }
    // Riesgo aceptado: si llega después el reloj con mejor dato que un duplicado
    // ya guardado, se descarta. Sustituirlo sin pagar pide una escritura que
    // hoy no existe en el almacén.
    if (filtrarNuevos([entreno], conocidos).length === 0) {
      salida.push('duplicado');
      continue;
    }
    try {
      // El mismo cerrojo que la hoja manual: ambos leen lo pagado hoy.
      const r = leerRespuesta(await conCerrojoCardio(userId, () => almacen.guardar(userId, entreno)));
      if (r === 'guardado') conocidos = [...conocidos, entreno];
      salida.push(r);
    } catch {
      salida.push('retenido');
    }
  }
  return salida;
}

/** true = se puede confirmar. false = dejarlo donde está y reintentar luego. */
export function procesarEntreno(userId: string, json: string): Promise<boolean> {
  return enSerie(async () => confirmable((await procesarLote(userId, [json]))[0] ?? 'retenido'));
}

// ── Entrenos sin copia nativa ─────────────────────────────────────────

// Lo que devuelve el GPS al parar solo existe en esta cadena: si falla la red
// y no se escribe en disco, la sesión se pierde.
const MAX_PENDIENTES = 20;
const clavePendientes = (userId: string) => `nivl:medicion:pendientes:${userId}`;

async function leerPendientes(userId: string): Promise<string[]> {
  try {
    const crudo = await AsyncStorage.getItem(clavePendientes(userId));
    const lista = crudo ? (JSON.parse(crudo) as unknown) : [];
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function escribirPendientes(userId: string, lista: string[]): Promise<void> {
  try {
    if (lista.length) await AsyncStorage.setItem(clavePendientes(userId), JSON.stringify(lista));
    else await AsyncStorage.removeItem(clavePendientes(userId));
  } catch {
    // Sin disco queda el intento en memoria que ya está en curso.
  }
}

async function drenarLista(userId: string, lista: string[]): Promise<ResultadoEntrega[]> {
  const hechos = await procesarLote(userId, lista);
  await escribirPendientes(userId, lista.filter((_, i) => !confirmable(hechos[i] ?? 'retenido')));
  return hechos;
}

async function drenarPendientes(userId: string): Promise<void> {
  const lista = await leerPendientes(userId);
  if (lista.length) await drenarLista(userId, lista);
}

/** Para el GPS: lo escribe en disco antes de intentarlo y dice qué ha pasado con él. */
export function entregarEntreno(userId: string, json: string): Promise<ResultadoEntrega> {
  return enSerie(async () => {
    const previos = await leerPendientes(userId);
    const lista = [...previos, json].slice(-MAX_PENDIENTES);
    await escribirPendientes(userId, lista);
    const hechos = await drenarLista(userId, lista);
    return hechos[lista.length - 1] ?? 'retenido';
  });
}

/**
 * Tras retirar el permiso y borrar, o eliminar la cuenta: ni una copia que al
 * volver a aceptar se suba otra vez. Un permiso sin aceptar, sin más, retiene.
 */
export async function borrarCopiasLocales(userId: string): Promise<void> {
  await enSerie(async () => {
    await escribirPendientes(userId, []);
    await borrarAlmacenLocal(userId);
    vaciarEntrenosReloj(userId);
  }).catch(() => {});
}

// ── Salud ─────────────────────────────────────────────────────────────

const POR_PAGINA = 50;
const MAX_PAGINAS = 40;

export interface ResultadoImportacion {
  /** Entrenos que ya no hay que reintentar. */
  procesados: number;
  /** false si algo quedó sin guardar: el ancla no avanzó y se reintentará. */
  completa: boolean;
  /** Salud no ha respondido: que no parezca que no había nada. */
  fallo?: boolean;
}

// El ancla vive en el teléfono, no en la cuenta: otra persona que entre en este
// iPhone empieza desde cero en vez de heredar lo que la anterior ya vio.
const CLAVE_DUENO_ANCLA = 'nivl:medicion:duenoAncla';

async function asegurarAnclaDe(userId: string): Promise<void> {
  const previo = await AsyncStorage.getItem(CLAVE_DUENO_ANCLA);
  if (previo === userId) return;
  if (previo) reiniciarAncla();
  await AsyncStorage.setItem(CLAVE_DUENO_ANCLA, userId);
}

/** Trae lo nuevo de Salud. El ancla solo avanza con la página entera guardada. */
export async function importarDeSalud(userId: string): Promise<ResultadoImportacion> {
  let procesados = 0;
  try {
    await asegurarAnclaDe(userId);
  } catch {
    // Sin saber de quién es el ancla no se importa con ella.
    return { procesados, completa: false, fallo: true };
  }
  for (let i = 0; i < MAX_PAGINAS; i++) {
    const pagina = await entrenosNuevos(POR_PAGINA);
    if (pagina.fallo) return { procesados, completa: false, fallo: true };
    if (!pagina.entrenos.length) {
      // Solo cambió el ancla (borrados en Salud, entrenos propios excluidos).
      if (pagina.ancla) confirmarAncla(pagina.ancla);
      return { procesados, completa: true };
    }
    const hechos = await enSerie(() => procesarLote(userId, pagina.entrenos));
    procesados += hechos.filter(confirmable).length;
    if (!hechos.every(confirmable)) return { procesados, completa: false };
    if (pagina.ancla) confirmarAncla(pagina.ancla);
    if (pagina.entrenos.length < POR_PAGINA) return { procesados, completa: true };
  }
  return { procesados, completa: false };
}

// ── Arranque ──────────────────────────────────────────────────────────

/** Al volver a primer plano no se relee Salud más que cada 15 minutos. */
const INTERVALO_SALUD_MS = 15 * 60 * 1000;

/**
 * Se llama con sesión y permiso de salud vigentes. Devuelve la función que lo
 * suelta (cierre de sesión o permiso retirado).
 */
export function arrancarBuzon(userId: string): () => void {
  const alEntreno = async (_id: string, json: string) => {
    const dueno = duenoEntreno(json);
    // De otra cuenta de este iPhone: se queda hasta que entre quien lo midió.
    if (dueno !== null && dueno !== userId) return false;
    return procesarEntreno(userId, json);
  };
  let soltarReloj = alRecibirEntrenoReloj(alEntreno);
  let ultimaSalud = 0;
  let activo = true;

  const repasar = async () => {
    const ahora = Date.now();
    if (ahora - ultimaSalud < INTERVALO_SALUD_MS) return;
    ultimaSalud = ahora;
    await enSerie(() => drenarPendientes(userId)).catch(() => {});
    if (!activo || !disponible()) return;
    // Sin haber pasado por el diálogo de Salud no se toca HealthKit.
    if (!(await hayQuePreguntar(['entrenos'])) && activo) await importarDeSalud(userId).catch(() => null);
    if (activo) await subirResumenesSalud(userId);
  };

  void repasar();
  const estado = AppState.addEventListener('change', (s) => {
    if (s !== 'active') return;
    // Apuntarse otra vez drena lo que quedó retenido sin conexión.
    soltarReloj();
    soltarReloj = alRecibirEntrenoReloj(alEntreno);
    void repasar();
  });

  return () => {
    activo = false;
    soltarReloj();
    estado.remove();
  };
}
