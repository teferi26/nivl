// NIVL · Los avisos del sistema.
//
// Reescrito entero. Lo que había antes tenía cinco fallos que la auditoría
// marcó como críticos y que hacían que la app no avisara de forma fiable:
//
//   1. El texto se congelaba al programar la notificación, así que decía lo
//      mismo el día 1 que el día 200.
//   2. Se creaba un canal de Android y luego nunca se pasaba como channelId,
//      así que Android usaba el suyo por defecto.
//   3. shouldPlaySound iba a false en global: el aviso de cierre no sonaba.
//   4. cancelAllScheduledNotificationsAsync() en cada montaje de la pestaña
//      Sistema: bastaba abrir la app para borrar todo lo programado.
//   5. Todo dentro de un catch vacío: si fallaba, nadie se enteraba nunca.
//
// Ahora los avisos se derivan del plan del día que escribe el coach, se
// reconcilian en vez de borrarse a lo bruto, y el estado es consultable.

import type AsyncStorageTipo from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  clavesDuelo,
  dentroDeRet06,
  diasDespertador,
  fechasSinCierre,
  historialAGuardar,
  historialDisparado,
  parsearHistorialAvisos,
  type AvisoGuardado,
} from './avisosPlan';
import type { Duelo } from './competicionData';
import { dateKey } from './dates';
import { cuandoDe, fechaDeAviso, momentoDe, planDeAvisos, type EstadoPlanAvisos } from './notifyPlan';
import type { DayBlock } from './plan';
import { hhmm } from './plan';
import { RUTA_AVISO, rutaSegura, textoAviso, voice } from './voice';
import { requireHealthConsent } from './health';
import { MENSAJE_FALLO, mensajeSistema } from './validation';

export const CANALES = {
  despertar: 'despertar',
  bloque: 'bloque',
  sistema: 'sistema',
  cierre: 'cierre',
} as const;

export const CATEGORIAS = {
  bloque: 'BLOQUE',
  cierre: 'CIERRE',
} as const;

// Identificadores estables: permiten cancelar solo lo de un día concreto sin
// tocar el resto de lo programado.
// El despertador de antes era un único DAILY sin fin (`nivl.despertar`); ahora
// es uno por día hasta ultimoDiaConAvisos (RET-06). El id viejo se cancela.
const ID_DESPERTAR = 'nivl.despertar';
const PREFIJO_DESPERTAR = 'nivl.despertar.';
const PREFIJO_AVISO = 'nivl.aviso.';
const idBloque = (fecha: string, blockId: string) => `nivl.bloque.${fecha}.${blockId}`;
const idCierre = (fecha: string) => `nivl.cierre.${fecha}`;
let healthGeneration = 0;
let accountGeneration = 0;
let cancellationDepth = 0;
const planJobs = new Set<Promise<number>>();

// Lo que deriva de datos de salud: el plan del coach (bloques y cierre) y el
// aviso de las fotos de progreso (planDeAvisos: `nivl.aviso.foto.<fecha>`).
const PREFIJOS_SALUD = ['nivl.bloque.', 'nivl.cierre.', 'nivl.aviso.foto.'];
const RUTAS_SALUD = ['/resumen', '/(tabs)/coach', '/fotos'];

/** Retira copias locales del plan/coach y de las fotos cuando se pierde el permiso. */
export async function cancelarAvisosSalud(): Promise<void> {
  healthGeneration++;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter(n => PREFIJOS_SALUD.some(p => n.identifier.startsWith(p)))
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    const delivered = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(delivered.filter(n => RUTAS_SALUD.includes(String(n.request.content.data?.ruta)) || PREFIJOS_SALUD.some(p => n.request.identifier.startsWith(p)))
      .map(n => Notifications.dismissNotificationAsync(n.request.identifier)));
  } catch { /* El permiso de salud sigue retirado aunque el SO no responda. */ }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface EstadoAvisos {
  permitido: boolean;
  puedePreguntar: boolean;
  programados: number;
  error: string | null;
}

let ultimoError: string | null = null;

/**
 * Lo que se guarda como «Último error» (se enseña en Perfil): nunca el
 * `e.message` crudo de la librería. Pasa por `mensajeSistema` y, si este solo
 * sabe decir el fallo genérico, se queda la frase del contexto, que dice más.
 */
function errorDeAvisos(e: unknown, contexto: string): string {
  const m = mensajeSistema(e);
  return m === MENSAJE_FALLO ? contexto : m;
}

export function ultimoErrorDeAvisos(): string | null {
  return ultimoError;
}

async function prepararCanales(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const { AndroidImportance, AndroidNotificationVisibility } = Notifications;
  await Notifications.setNotificationChannelAsync(CANALES.despertar, {
    name: 'Despertador',
    importance: AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 200, 400],
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });
  await Notifications.setNotificationChannelAsync(CANALES.bloque, {
    name: 'Bloques del día',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250],
  });
  await Notifications.setNotificationChannelAsync(CANALES.cierre, {
    name: 'Cierre del día',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(CANALES.sistema, {
    name: 'El sistema',
    importance: AndroidImportance.DEFAULT,
  });
}

async function prepararCategorias(): Promise<void> {
  // Acciones desde la propia notificación. Si la app está viva se aplican al
  // instante; si no, expo-notifications entrega la respuesta en el siguiente
  // arranque y se aplica entonces (ver manejarRespuestas).
  await Notifications.setNotificationCategoryAsync(CATEGORIAS.bloque, [
    { identifier: 'HECHO', buttonTitle: 'Hecho', options: { opensAppToForeground: false } },
    { identifier: 'POSPONER', buttonTitle: 'Posponer 10 min', options: { opensAppToForeground: false } },
  ]);
  await Notifications.setNotificationCategoryAsync(CATEGORIAS.cierre, [
    { identifier: 'REPORTAR', buttonTitle: 'Reportar', options: { opensAppToForeground: true } },
  ]);
}

/**
 * Pide permiso si hace falta. Comprueba antes el estado actual: volver a pedir
 * cuando ya está denegado no muestra nada y hace creer que se preguntó.
 */
export async function asegurarPermiso(): Promise<boolean> {
  const actual = await Notifications.getPermissionsAsync();
  if (actual.granted) return true;
  if (!actual.canAskAgain) return false;
  const pedido = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return pedido.granted;
}

export async function estadoAvisos(): Promise<EstadoAvisos> {
  try {
    const permiso = await Notifications.getPermissionsAsync();
    const programados = await Notifications.getAllScheduledNotificationsAsync();
    return {
      permitido: permiso.granted,
      puedePreguntar: permiso.canAskAgain,
      programados: programados.length,
      error: ultimoError,
    };
  } catch (e) {
    return {
      permitido: false,
      puedePreguntar: false,
      programados: 0,
      error: errorDeAvisos(e, 'Fallo leyendo el estado de los avisos.'),
    };
  }
}

/** Inicializa canales, categorías y permiso. Idempotente. */
export async function inicializarAvisos(): Promise<boolean> {
  try {
    ultimoError = null;
    await prepararCanales();
    await prepararCategorias();
    return await asegurarPermiso();
  } catch (e) {
    // Antes esto se tragaba en silencio: en Expo Go las notificaciones no
    // están disponibles y no había forma de saberlo. Ahora queda registrado.
    ultimoError = errorDeAvisos(e, 'Los avisos no están disponibles aquí.');
    return false;
  }
}

function fechaLocal(fecha: string, minutos: number): Date {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(a, m - 1, d, Math.floor(minutos / 60), minutos % 60, 0, 0);
}

/** Lo último que se programó del despertador: no se rehace si no cambia. */
let despertadorHecho: string | null = null;

/**
 * El despertador, a la hora pactada, de hoy a ultimoDiaConAvisos(hoy): uno por
 * día (`nivl.despertar.<fecha>`). RET-06: si no se abre la app, deja de sonar
 * a los 7 días. Cada apertura lo vuelve a extender. El DAILY antiguo
 * (`nivl.despertar`) se cancela.
 */
export async function programarDespertador(horaMin: number | null): Promise<void> {
  try {
    const ahora = momentoDe(new Date());
    const firma = `${ahora.fecha}|${horaMin}`;
    if (despertadorHecho === firma) return;
    despertadorHecho = firma;
    await Notifications.cancelScheduledNotificationAsync(ID_DESPERTAR).catch(() => {});
    const programadas = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      programadas
        .filter((n) => n.identifier?.startsWith(PREFIJO_DESPERTAR))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
    if (horaMin === null) return;
    for (const fecha of diasDespertador(ahora.fecha, ahora.min, horaMin)) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIJO_DESPERTAR}${fecha}`,
        content: {
          title: 'Arriba, gladiador',
          body: voice.morningNotif(),
          sound: 'default',
          interruptionLevel: 'timeSensitive',
          data: { ruta: RUTA_AVISO.despertar },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fechaLocal(fecha, horaMin),
          channelId: CANALES.despertar,
        },
      });
    }
  } catch (e) {
    despertadorHecho = null;
    ultimoError = errorDeAvisos(e, 'No se pudo programar el despertador.');
  }
}

// Anti-spam del cierre (L6-0): los días con aviso de racha del plan no llevan
// «cierre» fijo. Lo decide programarAvisosDelPlan; reconciliarAvisosDelDia lo
// respeta y apunta su último cierre para poder quitarlo o devolverlo.
let diasSinCierre = new Set<string>();
let ultimoCierre: { fecha: string; min: number; generation: number } | null = null;

async function programarCierre(fecha: string, horaCierreMin: number): Promise<boolean> {
  const cuando = fechaLocal(fecha, horaCierreMin);
  if (cuando <= new Date()) return false;
  await Notifications.scheduleNotificationAsync({
    identifier: idCierre(fecha),
    content: {
      title: 'El cierre del día se acerca',
      body: voice.eveningNotif(),
      sound: 'default',
      categoryIdentifier: CATEGORIAS.cierre,
      data: { ruta: RUTA_AVISO.cierre },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: cuando,
      channelId: CANALES.cierre,
    },
  });
  return true;
}

/**
 * Reconcilia los avisos de un día con su plan.
 *
 * Cancela SOLO los de esa fecha (por identificador estable) y reprograma los
 * que siguen en el futuro. Nada de borrar todo lo programado: el despertador y
 * los avisos de otros días sobreviven. RET-06: un día más allá de
 * ultimoDiaConAvisos(hoy) no lleva bloques; y sin cierre si ese día hay aviso
 * de racha.
 */
export async function reconciliarAvisosDelDia(
  fecha: string,
  bloques: DayBlock[],
  horaCierreMin: number | null,
): Promise<number> {
  try {
    await requireHealthConsent();
    const generation = healthGeneration;
    const programadas = await Notifications.getAllScheduledNotificationsAsync();
    const prefijo = `nivl.bloque.${fecha}.`;
    await Promise.all(
      programadas
        .filter((n) => n.identifier?.startsWith(prefijo) || n.identifier === idCierre(fecha))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );

    const ahora = new Date();
    let puestas = 0;
    const conBloques = dentroDeRet06(fecha, dateKey(ahora));

    for (const b of bloques) {
      if (!conBloques) break;
      if (!b.notify || b.done) continue;
      const cuando = fechaLocal(fecha, b.start_min);
      if (cuando <= ahora) continue;
      if (generation !== healthGeneration) return 0;
      await Notifications.scheduleNotificationAsync({
        identifier: idBloque(fecha, b.id),
        content: {
          title: `${hhmm(b.start_min)} · ${b.title}`,
          // Cuerpo fijo a propósito (Apple 4.5.4): el detalle del plan lleva
          // cargas, gramos o cifras de salud y no debe verse en la pantalla
          // bloqueada. El detalle se lee dentro de la app, en Hoy.
          body: 'Es la hora de este bloque. El detalle está en Hoy.',
          sound: 'default',
          interruptionLevel: 'timeSensitive',
          categoryIdentifier: CATEGORIAS.bloque,
          data: { ruta: RUTA_AVISO.bloque, blockId: b.id, fecha },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: cuando,
          channelId: CANALES.bloque,
        },
      });
      puestas++;
    }

    ultimoCierre = horaCierreMin === null ? null : { fecha, min: horaCierreMin, generation };
    if (horaCierreMin !== null && !diasSinCierre.has(fecha) && (await programarCierre(fecha, horaCierreMin))) {
      puestas++;
    }

    if (generation !== healthGeneration) { await cancelarAvisosSalud(); return 0; }
    return puestas;
  } catch (e) {
    ultimoError = errorDeAvisos(e, 'No se pudieron programar los avisos del día.');
    return 0;
  }
}

/** Aviso puntual: racha en peligro, deadline, fin de congelación… */
export async function avisarEn(
  id: string,
  cuando: Date,
  titulo: string,
  cuerpo: string,
  ruta?: string,
): Promise<void> {
  try {
    if (cuando <= new Date()) return;
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: titulo,
        body: cuerpo,
        sound: 'default',
        data: ruta ? { ruta } : {},
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: cuando,
        channelId: CANALES.sistema,
      },
    });
  } catch (e) {
    ultimoError = errorDeAvisos(e, 'No se pudo programar el aviso.');
  }
}

export async function cancelarTodo(): Promise<void> {
  // Al salir de la cuenta: invalida también una lectura pendiente de Hoy.
  sourceGeneration++;
  healthGeneration++;
  accountGeneration++;
  cancellationDepth++;
  const pendientes = [...planJobs];
  fuente = null;
  otraVez = false;
  if (reloj) clearTimeout(reloj);
  reloj = null;
  despertadorHecho = null;
  diasSinCierre = new Set();
  ultimoCierre = null;
  // Espera las operaciones nativas iniciadas antes de borrar definitivamente.
  await Promise.allSettled(pendientes);
  try {
    await almacen().removeItem(CLAVE_HISTORIAL);
  } catch {
    /* sin almacenamiento no hay historial que borrar */
  }
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    /* nada que cancelar */
  } finally {
    cancellationDepth--;
  }
}

// ─── L6-0 · El plan de avisos (notifyPlan.planDeAvisos), conectado ──────────
//
// Contrato: docs/design-v2/L6-0-avisos.md. El estado lo arma avisosPlan.ts
// (puro) con lo que da la fuente que registra Hoy; aquí solo se programa.

// Carga perezosa (require en la llamada), como en pro.ts: un import estático
// arrastraría el módulo nativo a todos los tests que importan notifications.
type Almacen = Pick<typeof AsyncStorageTipo, 'getItem' | 'setItem' | 'removeItem'>;
function almacen(): Almacen {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('@react-native-async-storage/async-storage') as { default?: Almacen } & Almacen;
  return m.default ?? m;
}

/** Los avisos del plan programados, con su `cuando`: sin esto el tope de 2 al día no aguanta una recarga. */
const CLAVE_HISTORIAL = 'nivl:avisos:historial';
/** Las novedades de duelos ya vistas en Amigos (claves de clavesDuelo). */
const CLAVE_DUELOS_VISTOS = 'nivl:duelos:vistos';
const MAX_DUELOS_VISTOS = 300;

async function leerHistorial(): Promise<AvisoGuardado[]> {
  try {
    return parsearHistorialAvisos(await almacen().getItem(CLAVE_HISTORIAL));
  } catch {
    return [];
  }
}

async function guardarHistorial(h: AvisoGuardado[]): Promise<void> {
  try {
    await almacen().setItem(CLAVE_HISTORIAL, JSON.stringify(h));
  } catch {
    /* sin almacenamiento, el tope solo vale dentro de la sesión */
  }
}

async function leerLista(clave: string): Promise<Set<string> | null> {
  const raw = await almacen().getItem(clave);
  if (raw === null) return null;
  const x: unknown = JSON.parse(raw);
  return new Set(Array.isArray(x) ? x.filter((k): k is string => typeof k === 'string') : []);
}

/** Novedades de duelos ya vistas. Nunca lanza: si no se puede leer, null. */
export async function leerDuelosVistos(): Promise<Set<string> | null> {
  try {
    return await leerLista(CLAVE_DUELOS_VISTOS);
  } catch {
    return null;
  }
}

/** Apunta como vistas las novedades de los duelos que se acaban de enseñar. Nunca lanza. */
export async function marcarDuelosVistos(duelos: readonly Duelo[]): Promise<void> {
  try {
    const nuevas = duelos.flatMap(clavesDuelo);
    if (nuevas.length === 0) return;
    const previas = (await leerDuelosVistos()) ?? new Set<string>();
    if (nuevas.every((c) => previas.has(c))) return;
    const todas = [...previas, ...nuevas.filter((c) => !previas.has(c))].slice(-MAX_DUELOS_VISTOS);
    await almacen().setItem(CLAVE_DUELOS_VISTOS, JSON.stringify(todas));
  } catch {
    /* sin almacenamiento, el aviso de duelo puede repetirse (24 h de enfriamiento) */
  }
}

/** Las claves que ya enseñó la cola de celebraciones (CelebracionProvider). null = nunca guardadas o ilegibles. */
export async function leerClavesCelebradas(userId: string): Promise<Set<string> | null> {
  try {
    return await leerLista(`nivl:celebradas:${userId}`);
  } catch {
    return null;
  }
}

/** Devuelve el cierre fijo o lo quita según los días con aviso de racha. */
async function ajustarCierre(sin: Set<string>): Promise<void> {
  const antes = diasSinCierre;
  diasSinCierre = sin;
  const c = ultimoCierre;
  if (!c) return;
  if (sin.has(c.fecha)) {
    await Notifications.cancelScheduledNotificationAsync(idCierre(c.fecha)).catch(() => {});
    return;
  }
  // Se había quitado y ya no hay racha (día cerrado a tiempo): vuelve, salvo
  // que entretanto se haya retirado el permiso de salud.
  if (antes.has(c.fecha) && c.generation === healthGeneration) await programarCierre(c.fecha, c.min);
}

/**
 * Programa los avisos del plan. Cancela SOLO los `nivl.aviso.*` y pone los
 * que da planDeAvisos ahora, con el copy de textoAviso y la ruta de
 * RUTA_AVISO pasada por rutaSegura. El historial (lo ya sonado) sale del
 * dispositivo si el estado no lo trae. Aplica la regla «racha sí, cierre no».
 * En web o sin permiso no hace nada. Nunca lanza: devuelve cuántos puso.
 */
export async function programarAvisosDelPlan(estado: EstadoPlanAvisos): Promise<number> {
  if (Platform.OS === 'web' || cancellationDepth > 0) return 0;
  const job = programarPlanVigente(estado, accountGeneration);
  planJobs.add(job);
  try {
    return await job;
  } finally {
    planJobs.delete(job);
  }
}

async function programarPlanVigente(estado: EstadoPlanAvisos, account: number): Promise<number> {
  const vigente = () => account === accountGeneration;
  try {
    const permiso = await Notifications.getPermissionsAsync();
    if (!permiso.granted || !vigente()) return 0;
    const generation = healthGeneration;
    const ahora = momentoDe(new Date());
    const ahoraCuando = cuandoDe(ahora);
    const guardados = await leerHistorial();
    if (!vigente()) return 0;
    const disparados = historialDisparado(guardados, ahoraCuando);
    const avisos = planDeAvisos({ ...estado, historial: estado.historial ?? disparados }, ahora);

    const programadas = await Notifications.getAllScheduledNotificationsAsync();
    if (!vigente()) return 0;
    await Promise.all(
      programadas
        .filter((n) => n.identifier?.startsWith(PREFIJO_AVISO))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );

    if (!vigente()) return 0;
    const puestos: typeof avisos = [];
    for (const a of avisos) {
      if (!vigente()) return 0;
      const cuando = fechaDeAviso(a.cuando);
      if (!cuando || cuando <= new Date()) continue;
      // La foto es dato de salud: si el permiso se retiró a mitad, no sale.
      if (a.tipo === 'foto' && generation !== healthGeneration) continue;
      const { titulo, cuerpo } = textoAviso(a.datos);
      await Notifications.scheduleNotificationAsync({
        identifier: a.id,
        content: {
          title: titulo,
          body: cuerpo,
          sound: 'default',
          data: { ruta: rutaSegura(RUTA_AVISO[a.tipo]) },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: cuando,
          channelId: CANALES.sistema,
        },
      });
      if (!vigente()) return 0;
      if (a.tipo === 'foto' && generation !== healthGeneration) {
        await Notifications.cancelScheduledNotificationAsync(a.id);
        continue;
      }
      puestos.push(a);
    }

    if (!vigente()) return 0;
    await guardarHistorial(historialAGuardar(guardados, puestos, ahoraCuando));
    if (!vigente()) return 0;
    await ajustarCierre(fechasSinCierre(puestos, disparados));
    return vigente() ? puestos.length : 0;
  } catch (e) {
    ultimoError = errorDeAvisos(e, 'No se pudieron programar los avisos del sistema.');
    return 0;
  }
}

/** Quien sabe armar el estado (Hoy, con sus datos ya cargados). */
export type FuenteAvisos = () => Promise<EstadoPlanAvisos | null>;

/** Debounce: varias llamadas seguidas (cargar, volver, completar) programan una vez. */
export const ESPERA_AVISOS_MS = 2000;

let fuente: FuenteAvisos | null = null;
let sourceGeneration = 0;
let reloj: ReturnType<typeof setTimeout> | null = null;
let enCurso = false;
let otraVez = false;

/** Hoy registra su fuente al montarse; la función devuelta la quita. */
export function registrarFuenteAvisos(f: FuenteAvisos): () => void {
  sourceGeneration++;
  fuente = f;
  return () => {
    if (fuente === f) {
      sourceGeneration++;
      fuente = null;
    }
  };
}

async function ejecutarReprogramacion(): Promise<void> {
  if (enCurso) {
    otraVez = true;
    return;
  }
  const f = fuente;
  if (!f) return;
  const generation = sourceGeneration;
  enCurso = true;
  try {
    // Sin permiso no se pide nada a la red.
    if (
      (await Notifications.getPermissionsAsync()).granted &&
      generation === sourceGeneration &&
      fuente === f
    ) {
      const estado = await f();
      if (estado && generation === sourceGeneration && fuente === f) {
        await programarAvisosDelPlan(estado);
      }
    }
  } catch (e) {
    ultimoError = errorDeAvisos(e, 'No se pudieron programar los avisos del sistema.');
  } finally {
    enCurso = false;
  }
  if (otraVez) {
    otraVez = false;
    reprogramarAvisosDelPlan();
  }
}

/**
 * Pide recalcular el plan de avisos (al cargar Hoy, al volver, al completar,
 * al aceptar un duelo, al ver una celebración). No bloquea ni lanza: corre en
 * segundo plano ESPERA_AVISOS_MS después de la última llamada. En web, nada.
 */
export function reprogramarAvisosDelPlan(): void {
  if (Platform.OS === 'web') return;
  if (reloj) clearTimeout(reloj);
  reloj = setTimeout(() => {
    reloj = null;
    void ejecutarReprogramacion();
  }, ESPERA_AVISOS_MS);
}
