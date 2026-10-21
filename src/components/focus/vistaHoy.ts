// NIVL · FOCUS: de los datos a las props de FocusHoyVista. Lo usan la app
// (useFocusHoy) y la galería (demo.tsx): misma entrada, misma pantalla.

import { minutosDe, progreso, restanteMs, formatoReloj, situacion, type ConfigPomodoro, type EstadoPomodoro } from '@/focus/pomodoro';
import {
  asignaturaFoco,
  examenesProximos,
  planDeHoyConHoras,
  repasosDeHoy,
  temasDeAsignatura,
  ventanaTemario,
  type BloquePlan,
  type ExamenVista,
} from '@/focus/resumen';
import type { DatosFocus } from '@/focus/tipos';
import { t } from '@/i18n';
import type { FocusHoyVistaProps, MisionFila, SesionVista } from './FocusHoyVista';

export interface MisionEnlazable {
  id: string;
  titulo: string;
  hecha: boolean;
  xp: number;
  penalizacion: boolean;
}

export interface EntradaVistaHoy {
  datos: DatosFocus;
  hoy: string;
  /** Minutos desde medianoche (para las horas del plan). */
  ahoraMin: number;
  /** ms de época (para el reloj). */
  ahora: number;
  config: ConfigPomodoro;
  pomodoro: EstadoPomodoro;
  misiones: MisionEnlazable[] | null;
}

/** «Tema 4 · Árboles binarios»: el número es su sitio en el temario de la asignatura. */
export function temaConNumero(d: DatosFocus, temaId: string | null): string | null {
  if (!temaId) return null;
  const tema = d.temas.find((x) => x.id === temaId);
  if (!tema) return null;
  const n = temasDeAsignatura(d, tema.asignaturaId).findIndex((x) => x.id === temaId) + 1;
  return t('focus:hoy.temaN', { n, nombre: tema.nombre });
}

/** La línea del coach en la tarjeta de Hoy: un consejo del sistema según lo que toca. */
export function fraseCoach(examenes: ExamenVista[], plan: BloquePlan[], repasos: number, sinAsignaturas: boolean): string {
  if (sinAsignaturas) return t('focus:coach.empezar');
  const x = examenes[0];
  if (x && x.dias <= 2) return t('focus:coach.simulacro', { asignatura: x.asignatura, count: Math.max(1, x.dias) });
  if (repasos > 0) return t('focus:coach.repasos', { count: repasos });
  const nuevo = plan.find((b) => b.tipo === 'estudiar' && b.tema);
  if (nuevo) return t('focus:coach.tema', { tema: nuevo.tema });
  if (x) return t('focus:coach.examen', { asignatura: x.asignatura, count: x.dias });
  return t('focus:coach.libre');
}

export function vistaHoy(e: EntradaVistaHoy): Omit<FocusHoyVistaProps, 'cabecera' | 'estado' | 'error' | 'disponible' | 'acciones' | 'refrescando'> {
  const d = e.datos;
  const p = e.pomodoro;
  const c = e.config;
  const examenes = examenesProximos(d, e.hoy);
  const plan = planDeHoyConHoras(d, e.hoy, e.ahoraMin, c);
  const foco = asignaturaFoco(d, e.hoy);
  const temasFoco = foco ? temasDeAsignatura(d, foco.id) : [];
  const repasos = repasosDeHoy(d, e.hoy);

  // Qué estudia el bloque: lo elegido; si no hay nada elegido, el primero del plan.
  const elegido = p.objetivo.asignaturaId ? p.objetivo : null;
  const primero = plan.find((b) => b.tipo !== 'simulacro') ?? plan[0];
  const asignaturaId = elegido?.asignaturaId ?? primero?.asignaturaId ?? null;
  const temaId = elegido ? elegido.temaId : (primero?.temaId ?? null);
  const asignatura = asignaturaId ? (d.asignaturas.find((a) => a.id === asignaturaId)?.nombre ?? null) : null;

  const mision = p.objetivo.misionId ? (e.misiones ?? []).find((m) => m.id === p.objetivo.misionId && !m.hecha) : undefined;
  const sesion: SesionVista = {
    fase: p.fase,
    bloque: p.bloque,
    cadaLargo: c.cadaLargo,
    situacion: situacion(p),
    reloj: formatoReloj(restanteMs(p, c, e.ahora)),
    // Parado, el anillo dice en qué punto de la tanda se está (bloque 3 de 4: tres cuartos).
    ratio: situacion(p) === 'parado' ? (p.fase === 'foco' ? p.bloque / c.cadaLargo : 0) : progreso(p, c, e.ahora),
    asignatura,
    tema: temaConNumero(d, temaId),
    mision: mision ? { titulo: mision.titulo, xp: mision.xp } : null,
    hayMisiones: (e.misiones ?? []).some((m) => !m.hecha && !m.penalizacion),
    foco: minutosDe('foco', c),
    descanso: minutosDe('descanso', c),
  };

  const misiones: MisionFila[] | null = e.misiones
    ? e.misiones.filter((m) => !m.penalizacion).map((m) => ({ id: m.id, titulo: m.titulo, hecha: m.hecha, xp: m.xp, ocupada: false }))
    : null;

  return {
    sesion,
    examenes,
    temario: foco
      ? { asignatura: foco.nombre, temas: ventanaTemario(temasFoco).map((x) => ({ id: x.id, nombre: x.nombre, estado: x.estado })), total: temasFoco.length }
      : null,
    plan,
    misiones,
    coach: fraseCoach(examenes, plan, repasos.temas.length + repasos.tarjetas, d.asignaturas.length === 0),
    sinAsignaturas: d.asignaturas.length === 0,
  };
}
