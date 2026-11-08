// NIVL · FOCUS: un solo gesto del estudio (efectos). Al acabar un bloque o una
// tanda de repaso: las sesiones entran en la cola del teléfono (colaSesiones.ts)
// y se envían; con lo que ya está guardado se suman los minutos reales del día,
// se calcula qué misiones quedan cubiertas (mision.ts) y se propaga el acto
// (misión, regla del contrato y bloque del plan).
//
// FOCUS no tiene XP base: paga solo `complete_quest`, una vez por misión y día.
// Sin red no se paga nada aún: se paga al llegar la sesión al servidor (nunca
// XP sin sesión detrás). Un bloque cerrado otro día guarda su sesión en su
// fecha, pero no marca nada de hoy.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { questsScheduledOn } from '@/lib/closing';
import { ensureProfile, fetchCompletionsForDate, fetchQuests } from '@/lib/data';
import { dateKey } from '@/lib/dates';
import { propagarActo, type Propagado } from '@/lib/links';
import type { Profile } from '@/lib/types';
import { COLA_VACIA, anadirACola, normalizarCola, vaciarCola, type ColaEstudio } from './colaSesiones';
import { leerMinutosDelDia, registrarSesion, type NuevaSesion } from './datos';
import { esDeOtroActo, misionesCumplidas, reglaCubierta } from './mision';
import type { Asignatura } from './tipos';

type Asignaturas = readonly Pick<Asignatura, 'id' | 'nombre'>[];

export interface EntradaActoEstudio {
  uid: string;
  sesiones: readonly NuevaSesion[];
  asignaturas: Asignaturas;
}

export interface ResultadoActoEstudio {
  antes: Profile;
  propagado: Propagado;
}

export interface Reenvio {
  enviadas: number;
  acto: ResultadoActoEstudio | null;
}

const claveCola = (uid: string) => `nivl.focus.cola.${uid}`;

async function leerCola(uid: string): Promise<ColaEstudio> {
  try {
    const v = await AsyncStorage.getItem(claveCola(uid));
    return v ? normalizarCola(JSON.parse(v)) : COLA_VACIA;
  } catch {
    return COLA_VACIA;
  }
}

async function guardarCola(uid: string, c: ColaEstudio): Promise<void> {
  try {
    if (c.sesiones.length === 0 && c.pago === null) await AsyncStorage.removeItem(claveCola(uid));
    else await AsyncStorage.setItem(claveCola(uid), JSON.stringify(c));
  } catch {
    // Sin almacenamiento, la cola vive lo que esta llamada.
  }
}

// La cola se lee y se reescribe: dos llamadas a la vez se pisarían.
let turno: Promise<unknown> = Promise.resolve();
function enSerie<T>(fn: () => Promise<T>): Promise<T> {
  const r = turno.then(fn, fn);
  turno = r.catch(() => undefined);
  return r;
}

/** Minutos reales guardados de hoy → misiones, regla y bloque del plan. null si no se ha podido. */
async function propagar(uid: string, fecha: string, elegidas: readonly string[], asignaturas: Asignaturas): Promise<ResultadoActoEstudio | null> {
  const sesiones = await leerMinutosDelDia(fecha);
  if (sesiones === null) return null;
  const [quests, completions] = await Promise.all([fetchQuests(), fetchCompletionsForDate(fecha)]);
  const hechas = new Set(completions.map((c) => c.quest_id));
  // Una misión elegida a mano cuenta aunque no esté enlazada, salvo que sea de otro acto.
  const candidatas = questsScheduledOn(quests, fecha).filter((q) => !q.is_penalty && (q.link === 'estudio' || (elegidas.includes(q.id) && !esDeOtroActo(q.link))));
  const soloMisiones = misionesCumplidas(
    candidatas.map((q) => ({ id: q.id, titulo: q.title, hecha: hechas.has(q.id), penalizacion: q.is_penalty })),
    sesiones,
    asignaturas,
  );
  const total = sesiones.reduce((s, x) => s + x.minutos, 0);
  const antes = await ensureProfile(uid);
  const propagado = await propagarActo(antes, 'estudio', fecha, {
    soloMisiones,
    cubreRegla: (texto) => reglaCubierta(texto, sesiones, asignaturas),
    cubreBloque: (minutos, yaMarcados) => total >= yaMarcados + minutos,
  });
  return { antes, propagado };
}

/** Lo común: añadir a la cola, enviar lo que se pueda y pagar lo guardado hoy. */
function procesar(uid: string, nuevas: readonly NuevaSesion[], asignaturas: Asignaturas): Promise<Reenvio> {
  return enSerie(async () => {
    const previa = await leerCola(uid);
    const sesiones = anadirACola(previa.sesiones, nuevas);
    if (sesiones.length === 0 && previa.pago === null) return { enviadas: 0, acto: null };
    await guardarCola(uid, { ...previa, sesiones });

    const { enviadas, quedan } = await vaciarCola(sesiones, registrarSesion);
    const hoy = dateKey();
    const deHoy = enviadas.filter((s) => s.fecha === hoy);
    const anterior = previa.pago?.fecha === hoy ? previa.pago.misiones : null;
    const pago =
      deHoy.length === 0 && anterior === null
        ? null
        : { fecha: hoy, misiones: [...new Set([...(anterior ?? []), ...deHoy.flatMap((s) => s.misionId ?? [])])] };
    await guardarCola(uid, { sesiones: quedan, pago });
    if (!pago) return { enviadas: enviadas.length, acto: null };

    let acto: ResultadoActoEstudio | null = null;
    try {
      acto = await propagar(uid, hoy, pago.misiones, asignaturas);
    } catch {
      acto = null;
    }
    if (acto) await guardarCola(uid, { sesiones: quedan, pago: null });
    return { enviadas: enviadas.length, acto };
  });
}

/** Tras un bloque o una tanda. Nunca lanza: un fallo aquí no tumba lo estudiado. */
export async function trasEstudiar(a: EntradaActoEstudio): Promise<ResultadoActoEstudio | null> {
  try {
    return (await procesar(a.uid, a.sesiones, a.asignaturas)).acto;
  } catch {
    return null;
  }
}

/** Reintenta lo que quedó sin enviar o sin pagar. Sin nada pendiente solo lee el teléfono. */
export async function reenviarEstudio(uid: string, asignaturas: Asignaturas): Promise<Reenvio> {
  try {
    return await procesar(uid, [], asignaturas);
  } catch {
    return { enviadas: 0, acto: null };
  }
}
