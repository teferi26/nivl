// La voz del sistema: banco de mensajes. Dramatismo sobrio, segunda persona,
// frases cortas. El sistema constata; la calidez solo en momentos ganados.
// Arena, firme y adulta: sin amenazas, sin urgencia, sin culpa y sin «—».
//
// Puro: sin Supabase ni expo-notifications (los tests lo cargan tal cual).

import type { DatosAviso, TipoAviso } from './notifyPlan';
import { RANGOS, type RangoId } from './progression';

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)] ?? lines[0] ?? '';
}

/** Una parte de lo que ha pagado un mismo acto: «50 de la misión «Entrenar»». */
export interface ParteXp {
  xp: number;
  de: string;
}

/**
 * El desglose de lo que ha pagado un acto (sesión de gimnasio, diario…), para
 * que la cifra del aviso cuadre con la que luego enseña la misión enlazada:
 * «+15 XP: 10 de la misión «Diario» + 5 del diario». Las partes a cero no se
 * nombran; sin nada pagado devuelve cadena vacía y el que llama decide.
 */
export function desgloseXp(partes: ParteXp[]): string {
  const pagadas = partes.filter((p) => p.xp > 0);
  if (pagadas.length === 0) return '';
  if (pagadas.length === 1) return `+${pagadas[0].xp} XP ${pagadas[0].de}.`;
  const total = pagadas.reduce((s, p) => s + p.xp, 0);
  return `+${total} XP: ${pagadas.map((p) => `${p.xp} ${p.de}`).join(' + ')}.`;
}

/** «la misión «A»» o «las misiones «A», «B»», marcadas solas por el acto. */
export function deMisiones(titulos: string[]): string {
  const lista = titulos.map((t) => `«${t}»`).join(', ');
  return titulos.length === 1 ? `de la misión ${lista} (marcada sola)` : `de las misiones ${lista} (marcadas solas)`;
}

export const voice = {
  allDone: () =>
    pick([
      'Todas las misiones completadas. El sistema está satisfecho.',
      'Día cumplido, gladiador. Mañana, las siguientes.',
      'Misiones del día completadas. Descansa: lo has ganado.',
      'El sistema registra un día impecable.',
    ]),
  levelUp: () =>
    pick([
      'Subes de nivel. El sistema lo registra.',
      'El sistema reconoce tu progreso.',
      'Nivel nuevo. Sumado misión a misión.',
      'Un nivel más. La arena lo ha visto.',
    ]),
  penaltyApplied: (xp: number) =>
    pick([
      `El sistema ha restado ${xp} XP. Tienes una misión de recuperación en Hoy.`,
      `Día sin cerrar: −${xp} XP. La recuperación ya está en tu lista.`,
      `−${xp} XP registrados. La misión de recuperación está en Hoy.`,
    ]),
  stoneUsed: () =>
    pick([
      'Se ha gastado una Piedra de Protección. La racha sigue.',
      'El sistema ha usado una Piedra de Protección. La racha se mantiene.',
    ]),
  stoneEarned: () =>
    pick([
      'Semana impecable: has forjado una Piedra de Protección.',
      'El sistema te concede una Piedra de Protección. Guárdala para el mal día.',
    ]),
  frozen: (reason: string) =>
    pick([
      `Sistema en pausa (${reason}). Sin misiones, sin restas, sin juicio.`,
      `Pausa activa: ${reason}. Nada se resta mientras dure.`,
    ]),
  morningNotif: () =>
    pick([
      'El sistema ha asignado tus misiones de hoy. Empieza por la primera.',
      'Tus misiones de hoy están listas. La primera es la que cuesta.',
      'Misiones asignadas. Cada una suma XP hacia el siguiente rango.',
    ]),
  eveningNotif: () =>
    pick([
      'Quedan unas horas para el cierre. Mira qué te falta.',
      'El cierre se acerca. Revisa tus misiones pendientes.',
      'Antes de cerrar el día, un vistazo a lo pendiente.',
    ]),
  dungeonCleared: (title: string) =>
    pick([
      `Campaña «${title}» completada. Todas las etapas cerradas.`,
      `«${title}» ha caído. El sistema registra tu victoria.`,
    ]),
  pr: (exercise: string) =>
    pick([
      `Nuevo récord en ${exercise}. El sistema lo anota.`,
      `${exercise}: marca personal superada. Queda como referencia.`,
    ]),
  achievement: () =>
    pick([
      'Logro desbloqueado.',
      'Logro registrado. Ya está en tu perfil.',
      'Nueva entrada en tu leyenda.',
    ]),
  // Mensaje motivacional de racha para el perfil: lo primero que ve el gladiador.
  streakHype: (days: number) => {
    if (days <= 0) {
      return pick([
        'Sin racha por ahora. Cierra el día de hoy y empieza a contar.',
        'Racha a cero. Un día cerrado la pone en marcha.',
      ]);
    }
    if (days < 3) {
      return pick([
        'La racha está encendida. Cierra hoy y suma otro día.',
        `${days} ${plural(days, 'día', 'días')} de racha. Hoy toca uno más.`,
      ]);
    }
    if (days < 7) {
      return pick([
        `${days} días seguidos. La cadena crece. Mañana, uno más.`,
        `${days} días. El sistema empieza a fiarse de ti. Sigue.`,
      ]);
    }
    if (days < 14) {
      return pick([
        'Una semana entera en pie. Tu multiplicador ya paga: cada misión vale más.',
        `${days} días seguidos. Mañana, el siguiente.`,
      ]);
    }
    if (days < 30) {
      return pick([
        `${days} días seguidos. La racha la sostienes tú, día a día.`,
        `${days} días. Cada uno cerrado, ninguno regalado.`,
      ]);
    }
    return pick([
      `${days} días. El camino a ${nombreRango('S')} es este: un día más, cada día.`,
      `${days} días de racha. El sistema los ha contado todos.`,
    ]);
  },
};

function nombreRango(id: RangoId): string {
  return RANGOS.find((r) => r.id === id)?.nombre ?? id;
}

function plural(n: number, uno: string, varios: string): string {
  return n === 1 ? uno : varios;
}

// ─── Avisos locales del plan (notifyPlan.ts) ────────────────────────────────

/** Lo que se ve en la notificación: título y cuerpo, ya en la voz del sistema. */
export interface TextoAviso {
  titulo: string;
  cuerpo: string;
}

/**
 * El copy de cada aviso de `planDeAvisos`. Determinista (sin azar): el mismo
 * dato da el mismo texto, así el test fija cada caso. Reglas de PLAN-AVISOS:
 * la racha dice qué falta y nada más; la vuelta no culpa; la foto no nombra
 * el cuerpo (se lee en la pantalla de bloqueo).
 */
export function textoAviso(d: DatosAviso): TextoAviso {
  switch (d.tipo) {
    case 'racha': {
      const faltan = Math.max(1, Math.trunc(d.faltan));
      return {
        titulo: `Racha de ${d.racha} ${plural(d.racha, 'día', 'días')}`,
        cuerpo: plural(
          faltan,
          'Te falta 1 misión para cerrar el día.',
          `Te faltan ${faltan} misiones para cerrar el día.`,
        ),
      };
    }
    case 'recuperacion':
      if (!d.desbloqueada) {
        return { titulo: 'Recuperación', cuerpo: 'Completa una misión de hoy y la recuperación se abre.' };
      }
      return {
        titulo: 'Recuperación abierta',
        cuerpo: d.xp > 0
          ? `Completa la misión de recuperación y vuelven ${d.xp} XP.`
          : 'La misión de recuperación está lista en Hoy.',
      };
    case 'duelo': {
      const n = Math.max(1, Math.trunc(d.pendientes));
      return {
        titulo: plural(n, 'Tu duelo', 'Tus duelos'),
        cuerpo: plural(n, 'Hay novedades en 1 duelo.', `Hay novedades en ${n} duelos.`),
      };
    }
    case 'foto': {
      const n = Math.min(3, Math.max(1, Math.trunc(d.pendientes)));
      return {
        titulo: 'Fotos de la semana',
        cuerpo: plural(n, 'Falta 1 de 3 para cerrar la semana.', `Faltan ${n} de 3 para cerrar la semana.`),
      };
    }
    case 'rango': {
      const id = d.clave?.startsWith('rango:') ? d.clave.slice(6) : null;
      const def = RANGOS.find((r) => r.id === id);
      if (def) return { titulo: 'Nuevo rango', cuerpo: `Ya eres ${def.nombre}. Entra a verlo.` };
      return { titulo: 'La arena te reconoce', cuerpo: 'Tienes algo nuevo que ver. Entra cuando quieras.' };
    }
    case 'vuelta':
      return d.dias === 7
        ? { titulo: 'La arena sigue aquí', cuerpo: 'Un paso basta para volver.' }
        : { titulo: 'La puerta sigue abierta', cuerpo: 'Cuando quieras, empiezas por una misión.' };
  }
}

// ─── Rutas al tocar un aviso ─────────────────────────────────────────────────

/** Adónde lleva cada aviso local al tocarlo (PLAN-AVISOS, punto 6). */
export const RUTA_AVISO: Record<TipoAviso | 'despertar' | 'bloque' | 'cierre', string> = {
  despertar: '/(tabs)',
  bloque: '/(tabs)',
  cierre: '/diario',
  racha: '/(tabs)',
  recuperacion: '/(tabs)',
  duelo: '/amigos',
  foto: '/fotos',
  rango: '/(tabs)',
  vuelta: '/(tabs)',
};

/**
 * Las únicas rutas a las que puede llevar un aviso, local o remoto. Un push
 * lleva `data.ruta` escrita por el servidor: sin esta lista, cualquiera que
 * pudiera mandar un push abriría cualquier pantalla (compra, enlaces, web).
 */
export const RUTAS_PERMITIDAS: readonly string[] = [
  '/(tabs)',
  '/(tabs)/coach',
  '/diario',
  '/resumen',
  '/amigos',
  '/fotos',
  '/avances',
];

/** La ruta del aviso si está permitida; si no, Hoy. */
export function rutaSegura(r: unknown): string {
  return typeof r === 'string' && RUTAS_PERMITIDAS.includes(r) ? r : '/(tabs)';
}
