// NIVL · Hoy: de los datos crudos a lo que pinta la vista (puro, con test).
//
// useHoy trae el perfil, las misiones, el plan y el marcador; aquí se decide
// qué se enseña: la misión que va SIGUIENTE (la inversión de Hoy), el informe
// del cierre, la línea de lo que hay en juego, el duelo de la semana y la
// línea del sistema bajo el nivel. `hoy` y `hora` llegan de fuera: así la
// función no lee el reloj y el test fija el día.
//
// Solo `import type` de los módulos con Supabase (engine, plan vía dayplan,
// social). Las frases de `voice` se eligen al azar: useHoy memoiza el
// resultado para que no cambien en cada render.

import { enJuegoHoy, rachaVisible, recuperacionDesbloqueada } from '@/lib/closing';
import { isValidKey, nombreDia } from '@/lib/dates';
import { levelFromXp } from '@/lib/game';
import { modulesFor, type ModuleMeta } from '@/lib/kinds';
import { cosmeticosDe, type RangoId } from '@/lib/progression';
import { clasificar, lineaRivalidad, quienVaDelante } from '@/lib/socialmath';
import { voice } from '@/lib/voice';
import type { DayCloseResult } from '@/lib/engine';
import type { DayBlock, DayPlan, PlanConBloques } from '@/lib/plan';
import type { BoardEntry } from '@/lib/social';
import type { Completion, Profile, Quest } from '@/lib/types';
import { lineaEnJuego, type LineaEnJuego } from './enJuego';

export interface RachaHoy {
  /** Racha que se enseña (cuenta hoy en cuanto queda cerrado). */
  valor: number;
  hoyCerrado: boolean;
  perfecto: boolean;
  /** Misiones que faltan para salvar el día. */
  faltan: number;
}

export interface EntradaHoy {
  /** Clave del día (dateKey). */
  hoy: string;
  /** Hora local 0..23: decide el saludo. */
  hora: number;
  profile: Profile | null;
  /** Rango vigente (estadoDe). null = aún no se sabe. */
  rango: RangoId | null;
  /** Título equipado ya renombrado (tituloVigente). null = el del rango. */
  tituloEquipado: string | null;
  /** Misiones programadas hoy (questsScheduledOn). */
  quests: Quest[];
  completions: Record<string, Completion>;
  dayResult: DayCloseResult | null;
  plan: PlanConBloques | null;
  esPro: boolean | null;
  board: BoardEntry[] | null;
  /** Días rotos seguidos antes de hoy (solo cuenta con la racha a cero). */
  rotosPrevios: number;
  /** La última misión del día se completó delante del usuario. */
  diaPerfecto: boolean;
  /** RET-03: la misión recién completada abrió la recuperación. */
  avisoRecuperacion: boolean;
}

export interface MisionHoy {
  quest: Quest;
  hecha: boolean;
  /** XP que pagó de verdad (solo hecha). */
  xpPagado?: number;
  /** Penalización con la recuperación aún cerrada (RET-03). */
  bloqueada: boolean;
  /** La primera pendiente que no es penalización ni extra: la inversión de Hoy. */
  siguiente: boolean;
}

export interface CierreHoy {
  /** XP perdido o racha rota: trama. Si no, informe en contorno. */
  alerta: boolean;
  lineas: string[];
}

export interface LadoDuelo {
  nombre: string;
  xp: number;
  /** 0..1 respecto al mayor de los dos. */
  ratio: number;
}

export interface DueloHoy {
  linea: string;
  yo: LadoDuelo;
  /** null = sin rival medible (sin dato): solo la línea. */
  rival: LadoDuelo | null;
}

export interface HeroHoy {
  nivel: number;
  xpEnNivel: number;
  /** 0 = nivel máximo. */
  xpSiguiente: number;
  rango: RangoId | null;
  titulo: string;
  racha: number;
  rachaCerrada: boolean;
  piedras: number;
  /** Saludo y estado del día: «Buenas tardes, Teferi. 2 misiones por delante.» */
  linea: string;
  /** «3/5»; vacío sin misiones (la franja pinta «-»). */
  misiones: string;
  avatar: { path: string | null; nombre: string };
}

export interface HoyDatos {
  hoy: string;
  /** «Jueves, 2 de octubre». */
  fecha: string;
  perfil: Profile | null;
  rango: RangoId | null;
  /** null sin perfil (primera carga fallida). */
  hero: HeroHoy | null;
  /** Saludo suelto («Buenas tardes, Teferi.») o «Hoy» sin perfil. */
  saludo: string;
  /** Estado del día en una frase; undefined sin perfil. */
  subtitulo?: string;
  /** Sistema en pausa: el texto entero. null = no hay pausa. */
  pausa: string | null;
  cierre: CierreHoy | null;
  misiones: MisionHoy[];
  hechas: number;
  total: number;
  pendientes: number;
  racha: RachaHoy;
  enJuego: LineaEnJuego | null;
  /** Tono de la sección de misiones (sin repetir la trama del cierre). */
  tonoMisiones: 'alerta' | undefined;
  recuperacionAbierta: boolean;
  /** «La recuperación está abierta.» a la vista. */
  avisoRecuperacion: boolean;
  /** voice.allDone() con el día hecho; null si queda algo o no hay misiones. */
  todoHecho: string | null;
  /** RET-05 o «A medianoche…»; null cuando no es verdad o no toca. */
  notaPendiente: { texto: string; alerta: boolean } | null;
  /** «El plan del día lo escribe el coach · NIVL Pro». */
  lineaPro: boolean;
  /** Tarjeta de día perfecto a la vista. */
  celebrando: boolean;
  /** Orden del día; null = no se pinta (sin plan y sin coach). */
  orden: { plan: DayPlan | null; bloques: DayBlock[]; pro: boolean } | null;
  hayPlan: boolean;
  rivalidad: string | null;
  duelo: DueloHoy | null;
  modulos: { primary: ModuleMeta[]; secondary: ModuleMeta[] };
  esPro: boolean | null;
}

export function saludo(nombre: string, hora: number): string {
  const franja = hora < 6 ? 'Buenas noches' : hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';
  return `${franja}, ${nombre}.`;
}

/** Solo el primer nombre, como en la línea de rivalidad. */
function nombreCorto(name: string): string {
  const limpio = name.trim().split(/\s+/)[0] ?? '';
  return limpio.length > 0 ? limpio.slice(0, 16) : 'Tu rival';
}

/** Las líneas del informe del cierre, en el orden de siempre. */
function lineasCierre(r: DayCloseResult, alerta: boolean, streak: number, penalizacionPendiente: boolean): string[] {
  const lineas: string[] = [];
  if (r.stonesUsed > 0) lineas.push(voice.stoneUsed());
  if (r.penaltyXp > 0) {
    // Frase neutra: voice.penaltyApplied puede amenazar («será permanente»)
    // y la salida ya se dice al final.
    lineas.push(
      `El sistema ha aplicado −${r.penaltyXp} XP.${
        r.levelsLost > 0 ? ` Has perdido ${r.levelsLost} ${r.levelsLost === 1 ? 'nivel' : 'niveles'}.` : ''
      }`,
    );
  } else if (r.streakLost) {
    lineas.push('Racha perdida. El contador vuelve a cero.');
  }
  if (r.diasSinCobrar > 0) {
    lineas.push(
      `Solo se cobran los 3 primeros días: ${r.diasSinCobrar} ${
        r.diasSinCobrar === 1 ? 'día no te cuesta' : 'días no te cuestan'
      } XP.`,
    );
  }
  if (r.stonesEarned > 0) lineas.push(voice.stoneEarned());
  // Un cierre limpio sin nada que contar no deja la tarjeta vacía.
  const sinNada = !alerta && r.stonesUsed === 0 && r.diasSinCobrar === 0 && r.stonesEarned === 0;
  if (sinNada) lineas.push(`Día cerrado. Racha ${streak}.`);
  // La tarjeta termina SIEMPRE con la salida si hay algo que recuperar.
  if (penalizacionPendiente) lineas.push('Hoy puedes recuperarlo: completa una de tus misiones y se abre la arena.');
  return lineas;
}

function dueloDe(board: BoardEntry[] | null): { rivalidad: string | null; duelo: DueloHoy | null } {
  // La rivalidad solo existe con al menos un amigo visible en el marcador.
  const visibles = (board ?? []).filter((b) => b.visible);
  if (!visibles.some((b) => !b.isMe) || !visibles.some((b) => b.isMe)) return { rivalidad: null, duelo: null };
  const clasificados = clasificar(visibles, 'xp');
  const linea = lineaRivalidad(clasificados, 'xp', 'semana');
  const r = quienVaDelante(clasificados);
  const yo = visibles.find((b) => b.isMe)!;
  const rival = r.tipo === 'lider' || r.tipo === 'empate' || r.tipo === 'persigue' ? r.rival : null;
  const max = Math.max(yo.xpWindow, rival?.xpWindow ?? 0);
  const ratio = (xp: number) => (max > 0 ? Math.min(1, Math.max(0, xp / max)) : 0);
  return {
    rivalidad: linea,
    duelo: {
      linea,
      yo: { nombre: 'Tú', xp: yo.xpWindow, ratio: ratio(yo.xpWindow) },
      rival: rival ? { nombre: nombreCorto(rival.name), xp: rival.xpWindow, ratio: ratio(rival.xpWindow) } : null,
    },
  };
}

export function derivarHoy(e: EntradaHoy): HoyDatos {
  const { hoy, profile, quests, completions } = e;
  const hechasSet = new Set(Object.keys(completions));
  const frozen = profile?.freeze_until != null && profile.freeze_until >= hoy;
  // Las penalizaciones primero: es lo que hay que ver antes que nada.
  const sorted = [...quests].sort((a, b) => Number(b.is_penalty) - Number(a.is_penalty));
  // RET-03 «Regreso a la arena»: la penalización de hoy se abre al completar
  // una misión normal de hoy (no vale una creada hoy). Cero XP extra.
  const recuperacionAbierta = recuperacionDesbloqueada(quests, hechasSet, hoy);
  const hechas = sorted.filter((q) => completions[q.id]).length;
  const total = sorted.length;
  const pendientes = total - hechas;
  // La racha que se enseña cuenta el día de hoy en cuanto queda cerrado. El
  // multiplicador sigue saliendo de los días CERRADOS.
  const racha = rachaVisible(profile?.streak_days ?? 0, sorted, hechasSet);

  const siguienteId = sorted.find((q) => !q.is_penalty && !q.is_bonus && !completions[q.id])?.id ?? null;
  const misiones: MisionHoy[] = sorted.map((q) => ({
    quest: q,
    hecha: !!completions[q.id],
    xpPagado: completions[q.id]?.xp_awarded,
    bloqueada: q.is_penalty && !recuperacionAbierta,
    siguiente: q.id === siguienteId,
  }));

  // RET-05: lo que hay en juego hoy, con el criterio del cierre. Congelado no
  // se juzga, así que no se calcula.
  const enJuego =
    profile && !frozen
      ? lineaEnJuego(
          enJuegoHoy({
            questsHoy: quests,
            completadasHoy: hechasSet,
            streak: profile.streak_days,
            stones: profile.protection_stones,
            rotosSeguidosPrevios: profile.streak_days === 0 ? e.rotosPrevios : 0,
          }),
          profile.streak_days,
        )
      : null;

  const r = e.dayResult;
  const cierreAlerta = !!r && (r.penaltyXp > 0 || r.streakLost);
  const penalizacionPendiente = quests.some((q) => q.is_penalty && !completions[q.id]);
  // Quedan misiones normales (ni extra ni penalización) sin hacer: solo
  // entonces tiene sentido «A medianoche, lo pendiente se penaliza».
  const quedanNormales = sorted.some((q) => !q.is_penalty && !q.is_bonus && !completions[q.id]);
  const celebrando = e.diaPerfecto && pendientes === 0 && total > 0;
  const hayPlan = !!e.plan && e.plan.bloques.length > 0;
  const { rivalidad, duelo } = dueloDe(e.board);
  const hastaCuando =
    profile?.freeze_until && isValidKey(profile.freeze_until) ? nombreDia(profile.freeze_until).toLowerCase() : null;

  const todoHecho = total > 0 && pendientes === 0 ? voice.allDone() : null;
  const subtitulo = !profile
    ? undefined
    : frozen
      ? 'Sistema en pausa. Hoy no se juzga.'
      : total === 0
        ? 'Sin misiones programadas para hoy.'
        : pendientes === 0
          ? (todoHecho ?? voice.allDone())
          : pendientes === 1
            ? 'Una misión por delante. Cierra el día.'
            : `${pendientes} misiones por delante.`;

  const nivel = profile ? levelFromXp(profile.xp_total) : null;
  const hero: HeroHoy | null =
    profile && nivel
      ? {
          nivel: nivel.level,
          xpEnNivel: nivel.into,
          xpSiguiente: nivel.next,
          rango: e.rango,
          titulo: e.tituloEquipado ?? cosmeticosDe(e.rango ?? 'E').titulo,
          racha: racha.valor,
          rachaCerrada: racha.hoyCerrado,
          piedras: profile.protection_stones,
          linea: `${saludo(profile.name, e.hora)} ${
            frozen
              ? 'Sistema en pausa. Hoy no se juzga.'
              : total === 0
                ? 'Sin misiones programadas para hoy.'
                : pendientes === 0
                  ? 'Día cerrado. No queda nada.'
                  : pendientes === 1
                    ? 'Una misión por delante. Cierra el día.'
                    : `${pendientes} misiones por delante.`
          }`,
          misiones: total > 0 ? `${hechas}/${total}` : '',
          avatar: { path: profile.avatar_url, nombre: profile.name },
        }
      : null;

  return {
    hoy,
    fecha: nombreDia(hoy),
    perfil: profile,
    rango: e.rango,
    hero,
    saludo: profile ? saludo(profile.name, e.hora) : 'Hoy',
    subtitulo,
    pausa:
      frozen && profile
        ? `${voice.frozen(profile.freeze_reason ?? 'pausa')}${hastaCuando ? ` Hasta el ${hastaCuando}.` : ''}`
        : null,
    cierre: r ? { alerta: cierreAlerta, lineas: lineasCierre(r, cierreAlerta, profile?.streak_days ?? 0, penalizacionPendiente) } : null,
    misiones,
    hechas,
    total,
    pendientes,
    racha,
    enJuego,
    // La tarjeta de alerta del cierre lleva la trama de la pantalla: la
    // sección de misiones no la repite (SISTEMA §0, sin acumular).
    tonoMisiones: enJuego?.alerta && !cierreAlerta ? 'alerta' : undefined,
    recuperacionAbierta,
    avisoRecuperacion: e.avisoRecuperacion && recuperacionAbierta && penalizacionPendiente,
    todoHecho,
    // Sin línea RET-05 y con solo extras o la penalización por hacer,
    // «A medianoche…» no es verdad: no se pinta.
    notaPendiente:
      pendientes > 0 && !frozen && (enJuego || quedanNormales)
        ? enJuego
          ? { texto: enJuego.texto, alerta: enJuego.alerta }
          : { texto: 'A medianoche, lo pendiente se penaliza.', alerta: false }
        : null,
    // Una sola línea, callada y DEBAJO de las misiones: lo gratis va primero.
    lineaPro: e.esPro === false && !hayPlan,
    celebrando,
    // Sin plan, el hueco de «Orden del día» solo se le enseña a quien tiene
    // coach (puede pedirlo): a una cuenta gratuita le abría un callejón.
    orden:
      hayPlan || e.esPro === true
        ? { plan: e.plan?.plan ?? null, bloques: e.plan?.bloques ?? [], pro: e.esPro === true }
        : null,
    hayPlan,
    rivalidad,
    duelo,
    modulos: modulesFor(profile?.profile_kind),
    esPro: e.esPro,
  };
}
