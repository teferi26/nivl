// NIVL · Los datos de la tarjeta semana.
//
// Aquí ya no se pinta nada: se reúne el parte de los últimos 7 días
// (prepararDatosSemana) y se convierte en la tarjeta 'semana' de la hoja de
// compartir unificada (tarjetaDeSemana). La pieza visual y la captura las pone
// HojaCompartir, que se abre por la cola de celebraciones (useCelebracion().compartir).

import { levelFromXp } from '@/lib/game';
import type { Tarjeta } from '@/lib/sharecard';
import { fetchBoard, fetchSocialSelf, type BoardEntry } from '@/lib/social';
import { clasificar, DIAS_VENTANA, posicionEntreAmigos } from '@/lib/socialmath';

export interface DatosSemana {
  name: string;
  avatarPath: string | null;
  equippedTitle: string | null;
  profileKind: unknown;
  xpTotal: number;
  streakDays: number;
  /** XP ganado con misiones en los últimos 7 días. */
  xpSemana: number;
  /** null = no tenía misiones programadas: se enseñan los días activos en su lugar. */
  compliancePct: number | null;
  daysActive: number;
  /** "2.º de 5", o null si todavía no hay amigos con los que medirse. */
  posicion: string | null;
  friendCode: string;
}

/**
 * Reúne lo que pinta la tarjeta. La tarjeta es SIEMPRE de los últimos 7 días y
 * por XP: si quien llama ya tiene el marcador semanal lo pasa y se ahorra la
 * lectura; si no, se pide aquí. La usan Amigos y el "día perfecto" de Hoy.
 */
export async function prepararDatosSemana(
  userId: string,
  opciones: { semana?: readonly BoardEntry[]; friendCode?: string } = {},
): Promise<DatosSemana> {
  const [semana, codigo] = await Promise.all([
    opciones.semana ? Promise.resolve(opciones.semana) : fetchBoard(DIAS_VENTANA.semana),
    opciones.friendCode ? Promise.resolve(opciones.friendCode) : fetchSocialSelf(userId).then((s) => s.friendCode),
  ]);
  const mio = semana.find((b) => b.isMe);
  if (!mio) throw new Error('El sistema no encuentra tu fila en el marcador.');
  return {
    name: mio.name,
    avatarPath: mio.avatarPath,
    equippedTitle: mio.equippedTitle,
    profileKind: mio.profileKind,
    xpTotal: mio.xpTotal,
    streakDays: mio.streakDays,
    xpSemana: mio.xpWindow,
    compliancePct: mio.compliancePct,
    daysActive: mio.daysActive,
    posicion: posicionEntreAmigos(clasificar(semana.filter((b) => b.visible), 'xp')),
    friendCode: codigo,
  };
}

/**
 * Los datos de la semana como tarjeta de la hoja de compartir unificada
 * (HojaCompartir, tipo 'semana'). Ni el nombre ni el código viajan aquí: el
 * alias y la invitación los decide la hoja con sus interruptores.
 */
export function tarjetaDeSemana(d: DatosSemana): Extract<Tarjeta, { tipo: 'semana' }> {
  return {
    tipo: 'semana',
    xpSemana: d.xpSemana,
    nivel: levelFromXp(d.xpTotal).level,
    cumplimientoPct: d.compliancePct,
    diasActivos: d.daysActive,
    rachaDias: d.streakDays,
    posicion: d.posicion,
  };
}
