// NIVL · L6-0: lo que necesita `planDeAvisos` para llamarse de verdad.
//
// Lógica PURA (sin red, sin expo-notifications, sin AsyncStorage): arma el
// EstadoPlanAvisos con lo que ya tiene Hoy y lo que se pide aparte (duelos,
// fotos, edad, salud), filtra el historial de avisos guardado y decide las dos
// reglas anti-spam de los avisos fijos. Quien programa es notifications.ts.
//
// Contrato: docs/design-v2/L6-0-avisos.md.
//   · ultimaApertura = hoy: cada apertura desplaza solas las vueltas +7 y +30.
//   · Cualquier dato que no se pudo leer llega aquí como null y el campo va
//     neutro (0 o null): un fallo no tumba el resto del plan.
//   · Si el plan da un aviso de racha un día, ese día no hay «cierre» fijo.
//   · RET-06: despertar y bloques solo hasta ultimoDiaConAvisos(hoy).

import { enJuegoHoy } from './closing';
import type { Duelo } from './competicionData';
import {
  diasEntre,
  momentoDeCuando,
  sumarDias,
  ultimoDiaConAvisos,
  type Aviso,
  type AvisoPasado,
  type EstadoPlanAvisos,
} from './notifyPlan';
import { fotosPendientesParaAviso, type FotoProgreso } from './progressPhotos';
import { celebracionesEntre, colaDeCelebracion, estadoDe } from './progression';
import type { Quest } from './types';

// ─── Armado del estado ───────────────────────────────────────────────────────

export interface PerfilAvisos {
  wake_time: string | null;
  sleep_time: string | null;
  streak_days: number;
  protection_stones: number;
  freeze_until: string | null;
  xp_total: number;
}

export interface EntradaEstadoAvisos {
  hoy: string;
  perfil: PerfilAvisos;
  /** questsScheduledOn(quests, hoy): con las penalizaciones de hoy. */
  questsHoy: Quest[];
  completadasHoy: Set<string>;
  /** rotosSeguidosAntes de hoy (RET-02), como en Hoy. */
  rotosPrevios: number;
  /** Lo que se pide aparte: null = no se pudo leer (campo neutro). */
  fotos: readonly FotoProgreso[] | null;
  mayor18: boolean | null;
  consentimientoSalud: boolean | null;
  duelos: readonly Duelo[] | null;
  duelosVistos: ReadonlySet<string> | null;
  /** Códigos de logro (de ellos sale el rango registrado). */
  logros: ReadonlySet<string> | null;
  /** Claves ya celebradas (CelebracionProvider). null = nunca guardadas. */
  celebradas: ReadonlySet<string> | null;
}

/** La piedra salvaría hoy o hay congelación vigente: no se avisa de la racha. */
export function rachaProtegidaDe(e: Pick<EntradaEstadoAvisos, 'hoy' | 'perfil' | 'questsHoy' | 'completadasHoy' | 'rotosPrevios'>): boolean {
  const congelada = !!e.perfil.freeze_until && e.perfil.freeze_until.slice(0, 10) >= e.hoy;
  if (congelada) return true;
  return enJuegoHoy({
    questsHoy: e.questsHoy,
    completadasHoy: e.completadasHoy,
    streak: e.perfil.streak_days,
    stones: e.perfil.protection_stones,
    rotosSeguidosPrevios: e.rotosPrevios,
  }).gastariaPiedra;
}

/**
 * Las claves «visto» de un duelo: una por novedad. Que el rival acepte TU reto
 * es una; que salga el resultado, otra. Aceptar tú no es novedad para ti.
 */
export function clavesDuelo(d: Duelo): string[] {
  // Con la 0055 el rival puede llegar null (oculto): no se avisa de alguien
  // que se ha ocultado (Juego y QA); tampoco de los anulados.
  if (d.rival === null || d.status === 'declined' || d.status === 'cancelled') return [];
  if (d.resultado) return [`${d.id}:resultado`];
  if (d.status === 'accepted' && d.soy_retador) return [`${d.id}:aceptado`];
  return [];
}

/** Un resultado de hace más de dos semanas ya no es novedad (cuentas antiguas). */
const DIAS_RESULTADO_RECIENTE = 14;

/** Duelos aceptados o resueltos que aún no ha visto. */
export function duelosPendientesDe(
  duelos: readonly Duelo[] | null,
  vistos: ReadonlySet<string> | null,
  hoy: string,
): number {
  if (!duelos) return 0;
  let n = 0;
  for (const d of duelos) {
    const claves = clavesDuelo(d);
    if (claves.length === 0) continue;
    let semana: number;
    try {
      semana = diasEntre(d.week_start.slice(0, 10), hoy);
    } catch {
      continue;
    }
    // Un aceptado solo cuenta con la semana en juego; un resultado, si es reciente.
    if (d.resultado ? semana > DIAS_RESULTADO_RECIENTE : semana >= 7) continue;
    if (claves.some((c) => !vistos?.has(c))) n++;
  }
  return n;
}

/**
 * La celebración principal sin ver, en la forma del plan ({ clave }), o null.
 * Lo que puede quedar pendiente fuera de la app es el rango que registró el
 * servidor (sync_rank) y que la cola no ha llegado a enseñar. Sin claves
 * guardadas nunca (instalación nueva o fallo de lectura) no se avisa: sería
 * anunciar como nuevo un rango antiguo.
 */
export function celebracionPendienteDe(
  perfil: PerfilAvisos,
  logros: ReadonlySet<string> | null,
  celebradas: ReadonlySet<string> | null,
  hoy: string,
): { clave: string } | null {
  if (!logros || !celebradas) return null;
  const p = { xp_total: perfil.xp_total, streak_days: perfil.streak_days, protection_stones: perfil.protection_stones };
  const lista = celebracionesEntre(estadoDe(p, []), estadoDe(p, logros), { fecha: hoy })
    .filter((c) => c.tipo === 'rango');
  const { principal } = colaDeCelebracion(lista, celebradas);
  return principal ? { clave: principal.clave } : null;
}

/** El EstadoPlanAvisos completo salvo `historial` (lo pone quien programa). */
export function armarEstadoPlanAvisos(e: EntradaEstadoAvisos): EstadoPlanAvisos {
  return {
    ultimaApertura: e.hoy,
    wakeTime: e.perfil.wake_time,
    sleepTime: e.perfil.sleep_time,
    streakDays: e.perfil.streak_days,
    questsHoy: e.questsHoy,
    completadasHoy: e.completadasHoy,
    rachaProtegida: rachaProtegidaDe(e),
    fotosPendientes: e.fotos
      ? fotosPendientesParaAviso(e.fotos, e.hoy, { mayor18: e.mayor18, consentimientoSalud: e.consentimientoSalud === true })
      : 0,
    duelosPendientes: duelosPendientesDe(e.duelos, e.duelosVistos, e.hoy),
    // AV-05 (Chat 5): un aviso nunca promete lo que la app no enseña. Hoy no
    // saca al entrar una ceremonia pendiente, así que no hay aviso de rango:
    // el rango nuevo ya se celebra en la propia acción, con la app abierta.
    // celebracionPendienteDe queda lista para cuando Hoy la muestre al cargar.
    celebracionPendiente: null,
    pushesServidor: [],
  };
}

// ─── Historial de avisos locales ─────────────────────────────────────────────

export interface AvisoGuardado extends AvisoPasado {
  id: string;
}

/** Lo guardado en el dispositivo; con JSON roto o forma rara, vacío. */
export function parsearHistorialAvisos(raw: string | null): AvisoGuardado[] {
  if (!raw) return [];
  try {
    const x: unknown = JSON.parse(raw);
    if (!Array.isArray(x)) return [];
    return x.filter((h): h is AvisoGuardado => {
      const o = h as Partial<AvisoGuardado> | null;
      return !!o && typeof o.id === 'string' && typeof o.tipo === 'string' && typeof o.cuando === 'string'
        && momentoDeCuando(o.cuando) !== null;
    });
  } catch {
    return [];
  }
}

/**
 * Los que ya han sonado: `cuando` ya pasado. Basta con ayer y hoy (tope del
 * día, 3 h entre avisos y 24 h por tipo).
 */
export function historialDisparado(guardados: readonly AvisoGuardado[], ahora: string): AvisoGuardado[] {
  const m = momentoDeCuando(ahora);
  if (!m) return [];
  const desde = sumarDias(m.fecha, -1);
  return guardados.filter((h) => h.cuando <= ahora && h.cuando.slice(0, 10) >= desde);
}

/** Lo que se guarda tras programar: lo ya sonado y lo que queda por sonar. */
export function historialAGuardar(
  guardados: readonly AvisoGuardado[],
  programados: readonly Pick<Aviso, 'id' | 'tipo' | 'cuando'>[],
  ahora: string,
): AvisoGuardado[] {
  const out = historialDisparado(guardados, ahora);
  for (const a of programados) {
    if (a.cuando <= ahora) continue;
    if (out.some((h) => h.id === a.id && h.cuando === a.cuando)) continue;
    out.push({ id: a.id, tipo: a.tipo, cuando: a.cuando });
  }
  return out;
}

// ─── Anti-spam de los fijos ──────────────────────────────────────────────────

/**
 * Días sin el «cierre» fijo: los que tienen aviso de racha, programado ahora o
 * ya sonado. El de racha dice lo mismo y más concreto.
 */
export function fechasSinCierre(
  avisos: readonly Pick<Aviso, 'tipo' | 'cuando'>[],
  historial: readonly AvisoPasado[] = [],
): Set<string> {
  const out = new Set<string>();
  for (const a of [...avisos, ...historial]) if (a.tipo === 'racha') out.add(a.cuando.slice(0, 10));
  return out;
}

/** RET-06: ¿puede sonar un aviso fijo (despertar, bloque) ese día? */
export function dentroDeRet06(fecha: string, hoy: string): boolean {
  try {
    return diasEntre(hoy, fecha) >= 0 && diasEntre(fecha, ultimoDiaConAvisos(hoy)) >= 0;
  } catch {
    return false;
  }
}

/**
 * Los días con despertador: de hoy (si la hora no ha pasado) a
 * ultimoDiaConAvisos(hoy). Ya no es diario e infinito: si no se abre la app,
 * deja de sonar a los 7 días.
 */
export function diasDespertador(hoy: string, minAhora: number, horaMin: number): string[] {
  const out: string[] = [];
  const ultimo = ultimoDiaConAvisos(hoy);
  for (let f = hoy; diasEntre(f, ultimo) >= 0; f = sumarDias(f, 1)) {
    if (f === hoy && horaMin <= minAhora) continue;
    out.push(f);
  }
  return out;
}
