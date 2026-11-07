// NIVL · Apple Watch: el puente con el reloj (efectos).
//
// Habla con el módulo nativo local `NivlWatch` (modules/nivl-watch, Swift con
// WatchConnectivity). Sin módulo (Expo Go, web, Android, binarios anteriores)
// todo esto es un no-op silencioso: ninguna pantalla depende del reloj.
//
// · Cada pantalla publica SU parte (Hoy, FOCUS, IRON) con `publicarEnReloj`.
//   Aquí se juntan y se mandan como applicationContext, agrupadas en una sola
//   escritura cada 400 ms (el contexto es «el último gana»: no hace falta más).
// · Lo que pide el reloj llega como petición; la atiende quien se haya
//   apuntado con `atenderReloj(tipo, fn)` (Hoy completa misiones, el pomodoro
//   arranca o pausa). Sin nadie apuntado, se contesta con el motivo.

import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import {
  MOTIVO_RELOJ,
  PARTES_VACIAS,
  componerEstado,
  leerPeticion,
  type PartesReloj,
  type PeticionReloj,
  type RespuestaReloj,
} from './contrato';

interface PendienteNativo {
  /** Id para `responder`; vacío si la petición llegó en cola (sin respuesta). */
  id: string;
  json: string;
}

interface ModuloNivlWatch {
  disponible(): boolean;
  actualizarContexto(json: string): void;
  tomarPendientes(): PendienteNativo[];
  responder(id: string, json: string): void;
  addListener(evento: 'onMensaje', fn: () => void): { remove: () => void };
}

const nativo: ModuloNivlWatch | null =
  Platform.OS === 'ios' ? requireOptionalNativeModule<ModuloNivlWatch>('NivlWatch') : null;

let disponibleCache: boolean | null = null;
function disponible(): boolean {
  if (!nativo) return false;
  if (disponibleCache === null) {
    try {
      disponibleCache = nativo.disponible();
    } catch {
      disponibleCache = false;
    }
  }
  return disponibleCache;
}

// ── Publicar ──────────────────────────────────────────────────────────

let partes: PartesReloj = { ...PARTES_VACIAS };
let sesion = true;
let temporizador: ReturnType<typeof setTimeout> | null = null;
let ultimoEnviado = '';

function enviar() {
  temporizador = null;
  if (!nativo || !disponible()) return;
  const estado = componerEstado(partes, Date.now(), sesion);
  // generadoEn cambia siempre: se compara sin él para no reescribir lo mismo.
  const firma = JSON.stringify({ ...estado, generadoEn: 0 });
  if (firma === ultimoEnviado) return;
  ultimoEnviado = firma;
  try {
    nativo.actualizarContexto(JSON.stringify(estado));
  } catch {
    // Sin reloj emparejado o la app del reloj sin instalar: nada que hacer.
  }
}

function programarEnvio() {
  if (!nativo) return;
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(enviar, 400);
}

/** Publica una parte del estado del día. `null` la retira (p. ej. sesión IRON terminada). */
export function publicarEnReloj<K extends keyof PartesReloj>(parte: K, valor: PartesReloj[K]): void {
  if (!nativo) return;
  sesion = true;
  partes = { ...partes, [parte]: valor };
  programarEnvio();
}

/** Tras cerrar sesión: el reloj borra misiones, racha y todo lo demás. */
export function limpiarReloj(): void {
  if (!nativo) return;
  partes = { ...PARTES_VACIAS };
  sesion = false;
  programarEnvio();
}

// ── Atender lo que pide el reloj ──────────────────────────────────────

type Atencion = (p: PeticionReloj) => Promise<RespuestaReloj>;
const atenciones = new Map<PeticionReloj['tipo'], Atencion>();
/** Peticiones en cola que llegaron sin nadie que las atienda (máx. 20). */
let retenidas: PendienteNativo[] = [];

const SIN_PANTALLA: Record<PeticionReloj['tipo'], string> = {
  completar: 'Abre NIVL en el iPhone y vuelve a intentarlo.',
  focus: 'Abre FOCUS en el iPhone para mandar en su pomodoro.',
  estado: '',
};

async function atender(p: PendienteNativo) {
  const peticion = leerPeticion(p.json);
  let respuesta: RespuestaReloj;
  if (!peticion) {
    respuesta = { ok: false, motivo: MOTIVO_RELOJ.noReconocida };
  } else if (peticion.tipo === 'estado') {
    // El reloj acaba de abrirse: se le reenvía lo último aunque no haya cambiado.
    ultimoEnviado = '';
    programarEnvio();
    respuesta = { ok: true };
  } else {
    const fn = atenciones.get(peticion.tipo);
    // En cola (sin nadie esperando respuesta) y sin pantalla que la atienda:
    // se guarda hasta que se apunte alguien (Hoy al montarse).
    if (!fn && !p.id) {
      retenidas.push(p);
      return;
    }
    try {
      respuesta = fn ? await fn(peticion) : { ok: false, motivo: SIN_PANTALLA[peticion.tipo] };
    } catch {
      respuesta = { ok: false, motivo: MOTIVO_RELOJ.sistema };
    }
  }
  if (p.id && nativo) {
    try {
      nativo.responder(p.id, JSON.stringify(respuesta));
    } catch {
      // El reloj ya no espera la respuesta (se cansó a los pocos segundos).
    }
  }
}

function vaciarCola() {
  if (!nativo) return;
  let cola: PendienteNativo[] = [];
  try {
    cola = nativo.tomarPendientes();
  } catch {
    return;
  }
  for (const p of cola) void atender(p);
}

let escucha: { remove: () => void } | null = null;
function escuchar() {
  if (escucha || !nativo || !disponible()) return;
  try {
    escucha = nativo.addListener('onMensaje', vaciarCola);
  } catch {
    escucha = null;
  }
}

/**
 * Apunta quién atiende un tipo de petición. Devuelve la función para soltarlo.
 * Solo hay uno por tipo: el último que se apunta gana (la pantalla montada).
 */
export function atenderReloj(tipo: 'completar' | 'focus', fn: Atencion): () => void {
  if (!nativo) return () => {};
  escuchar();
  atenciones.set(tipo, fn);
  // Lo que llegó mientras nadie escuchaba (el iPhone despertado por el reloj).
  const antes = retenidas.slice(-20);
  retenidas = [];
  for (const p of antes) void atender(p);
  vaciarCola();
  return () => {
    if (atenciones.get(tipo) === fn) atenciones.delete(tipo);
  };
}
