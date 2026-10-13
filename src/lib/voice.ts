// La voz del sistema: banco de mensajes. Dramatismo sobrio, segunda persona,
// frases cortas. El sistema constata; la calidez solo en momentos ganados.
// Arena, firme y adulta: sin amenazas, sin urgencia, sin culpa y sin «—».
//
// Puro: sin Supabase ni expo-notifications (los tests lo cargan tal cual).
// Los textos viven en src/i18n/es/voz.json: cada línea del banco es un array
// del catálogo y pick() elige una al azar (t() con returnObjects), al llamar.

import { t } from '@/i18n';
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
  const lista = titulos.map((titulo) => t('voz:deMisiones.titulo', { titulo })).join(', ');
  return t(titulos.length === 1 ? 'voz:deMisiones.una' : 'voz:deMisiones.varias', { lista });
}

/** Las variantes de una línea del banco (un array del catálogo `voz`). */
function lineas(clave: LineaVoz, opciones: Record<string, unknown> = {}): string[] {
  const v: unknown = t(`voz:${clave}`, { ...opciones, returnObjects: true });
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

type LineaVoz =
  | 'allDone'
  | 'levelUp'
  | 'penaltyApplied'
  | 'stoneUsed'
  | 'stoneEarned'
  | 'frozen'
  | 'morningNotif'
  | 'eveningNotif'
  | 'dungeonCleared'
  | 'pr'
  | 'achievement'
  | 'streakHype.sinRacha'
  | 'streakHype.encendida'
  | 'streakHype.primeros'
  | 'streakHype.semana'
  | 'streakHype.quincena'
  | 'streakHype.larga';

export const voice = {
  allDone: () => pick(lineas('allDone')),
  levelUp: () => pick(lineas('levelUp')),
  penaltyApplied: (xp: number) => pick(lineas('penaltyApplied', { xp })),
  stoneUsed: () => pick(lineas('stoneUsed')),
  stoneEarned: () => pick(lineas('stoneEarned')),
  frozen: (reason: string) => pick(lineas('frozen', { motivo: reason })),
  morningNotif: () => pick(lineas('morningNotif')),
  eveningNotif: () => pick(lineas('eveningNotif')),
  dungeonCleared: (title: string) => pick(lineas('dungeonCleared', { titulo: title })),
  pr: (exercise: string) => pick(lineas('pr', { ejercicio: exercise })),
  achievement: () => pick(lineas('achievement')),
  // Mensaje motivacional de racha para el perfil: lo primero que ve el gladiador.
  streakHype: (days: number) => {
    if (days <= 0) return pick(lineas('streakHype.sinRacha'));
    if (days < 3) {
      return pick([...lineas('streakHype.encendida'), t('voz:streakHype.encendidaDias', { count: days })]);
    }
    if (days < 7) return pick(lineas('streakHype.primeros', { dias: days }));
    if (days < 14) return pick(lineas('streakHype.semana', { dias: days }));
    if (days < 30) return pick(lineas('streakHype.quincena', { dias: days }));
    return pick(lineas('streakHype.larga', { dias: days, rango: nombreRango('S') }));
  },
};

function nombreRango(id: RangoId): string {
  return RANGOS.find((r) => r.id === id)?.nombre ?? id;
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
        titulo: t('voz:aviso.racha.titulo', { count: d.racha }),
        cuerpo: t('voz:aviso.racha.cuerpo', { count: faltan }),
      };
    }
    case 'recuperacion':
      if (!d.desbloqueada) {
        return { titulo: t('voz:aviso.recuperacion.titulo'), cuerpo: t('voz:aviso.recuperacion.cuerpoBloqueada') };
      }
      return {
        titulo: t('voz:aviso.recuperacion.tituloAbierta'),
        cuerpo: d.xp > 0
          ? t('voz:aviso.recuperacion.cuerpoXp', { xp: d.xp })
          : t('voz:aviso.recuperacion.cuerpoLista'),
      };
    case 'duelo': {
      const n = Math.max(1, Math.trunc(d.pendientes));
      return {
        // «Tu duelo» / «Tus duelos» no lleva la cifra: dos frases enteras.
        titulo: t(n === 1 ? 'voz:aviso.duelo.tituloUno' : 'voz:aviso.duelo.tituloVarios'),
        cuerpo: t('voz:aviso.duelo.cuerpo', { count: n }),
      };
    }
    case 'foto': {
      const n = Math.min(3, Math.max(1, Math.trunc(d.pendientes)));
      return {
        titulo: t('voz:aviso.foto.titulo'),
        cuerpo: t('voz:aviso.foto.cuerpo', { count: n }),
      };
    }
    case 'rango': {
      const id = d.clave?.startsWith('rango:') ? d.clave.slice(6) : null;
      const def = RANGOS.find((r) => r.id === id);
      if (def) return { titulo: t('voz:aviso.rango.titulo'), cuerpo: t('voz:aviso.rango.cuerpo', { rango: def.nombre }) };
      return { titulo: t('voz:aviso.rango.tituloGenerico'), cuerpo: t('voz:aviso.rango.cuerpoGenerico') };
    }
    case 'vuelta':
      return d.dias === 7
        ? { titulo: t('voz:aviso.vuelta.titulo7'), cuerpo: t('voz:aviso.vuelta.cuerpo7') }
        : { titulo: t('voz:aviso.vuelta.titulo30'), cuerpo: t('voz:aviso.vuelta.cuerpo30') };
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
