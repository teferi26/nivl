import { codigosDeRangoPendientes } from './progression';
import { supabase } from './supabase';

export interface AchievementDef {
  code: string;
  name: string;
  desc: string;
  title?: string;
  /** Registro interno (p. ej. rango alcanzado): no se lista como logro. */
  oculto?: boolean;
}

// Logros cualitativos: sin XP (anti-inflación). Algunos desbloquean títulos equipables.
export const ACHIEVEMENTS: AchievementDef[] = [
  { code: 'first_quest', name: 'Primer paso', desc: 'Completa tu primera misión' },
  { code: 'first_day', name: 'Primer día en la arena', desc: 'Cierra tu primer día con las misiones cumplidas' },
  { code: 'quests_10', name: 'Gladiador novato', desc: '10 misiones completadas' },
  { code: 'quests_50', name: 'Gladiador veterano', desc: '50 misiones completadas', title: 'El Persistente' },
  { code: 'quests_100', name: 'Centurión', desc: '100 misiones completadas' },
  { code: 'quests_500', name: 'Leyenda del gremio', desc: '500 misiones completadas', title: 'Leyenda' },
  { code: 'streak_7', name: 'Una semana imparable', desc: 'Racha de 7 días' },
  { code: 'streak_30', name: 'Mes de hierro', desc: 'Racha de 30 días', title: 'El Constante' },
  { code: 'streak_100', name: 'Voluntad de acero', desc: 'Racha de 100 días', title: 'Inquebrantable' },
  { code: 'level_5', name: 'Despertar', desc: 'Alcanza el nivel 5' },
  { code: 'level_10', name: 'Doble dígito', desc: 'Alcanza el nivel 10', title: 'Forjado' },
  { code: 'level_25', name: 'Sangre de arena', desc: 'Alcanza el nivel 25', title: 'Sangre de arena' },
  { code: 'level_50', name: 'Señor de la arena', desc: 'Alcanza el nivel 50', title: 'Señor de la arena' },
  { code: 'first_evidence', name: 'Sin palabras, pruebas', desc: 'Primera misión con evidencia' },
  { code: 'evidence_50', name: 'Archivo del gladiador', desc: '50 evidencias registradas', title: 'El Verificado' },
  { code: 'penalty_redeemed', name: 'Redención', desc: 'Completa una misión de penalización' },
  { code: 'first_dungeon', name: 'Primera campaña', desc: 'Despeja tu primera campaña' },
  { code: 'dungeons_5', name: 'Limpiador de campañas', desc: 'Despeja 5 campañas', title: 'Asesino de Jefes' },
  { code: 'first_pr', name: 'Nuevo récord', desc: 'Tu primer récord personal en el gym' },
  { code: 'pr_10', name: 'Rompe límites', desc: '10 récords personales', title: 'Rompe Límites' },
  { code: 'first_journal', name: 'La pluma del gladiador', desc: 'Primera entrada del diario' },
  { code: 'journal_30', name: 'Cronista', desc: '30 entradas del diario', title: 'El Cronista' },
  // Sistema v2 (progression.ts): el rango alcanzado se registra aquí para que
  // no baje nunca aunque una penalización baje el nivel. Sin XP.
  { code: 'rango_D', name: 'Rango Gladiador', desc: 'Alcanza el rango D', oculto: true },
  { code: 'rango_C', name: 'Rango Veterano', desc: 'Alcanza el rango C', oculto: true },
  { code: 'rango_B', name: 'Rango Campeón', desc: 'Alcanza el rango B', oculto: true },
  { code: 'rango_A', name: 'Rango Héroe de la arena', desc: 'Alcanza el rango A', oculto: true },
  { code: 'rango_S', name: 'Rango Leyenda', desc: 'Alcanza el rango S', oculto: true },
];

/**
 * Títulos renombrados en el sistema v2. «Élite» chocaba con el plan de pago
 * y «Despertado»/«Monarca» eran de la marca antigua. Quien ya llevaba uno
 * equipado (profiles.equipped_title) lo ve con el nombre nuevo.
 */
export const TITULOS_RENOMBRADOS: Record<string, string> = {
  'Élite': 'Sangre de arena',
  'Despertado': 'Forjado',
  'Monarca': 'Señor de la arena',
};

export function tituloVigente(equipado: string | null | undefined): string | null {
  if (!equipado) return null;
  return TITULOS_RENOMBRADOS[equipado] ?? equipado;
}

/** Logros que se enseñan en la vitrina (sin los registros internos). */
export const ACHIEVEMENTS_VISIBLES = (): AchievementDef[] => ACHIEVEMENTS.filter((a) => !a.oculto);

export const ACHIEVEMENT_BY_CODE: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.code, a]),
);

export interface AchievementContext {
  totalCompletions?: number;
  evidenceCount?: number;
  streak?: number;
  level?: number;
  dungeonsCleared?: number;
  prCount?: number;
  journalCount?: number;
  penaltyRedeemed?: boolean;
  /** El cierre acaba de dar por cumplido al menos un día (DayCloseResult.diasCumplidos > 0). */
  diaCumplido?: boolean;
  /** Logros ya desbloqueados: para registrar el rango (progression.ts). */
  unlocked?: ReadonlySet<string>;
}

export function evaluateAchievements(ctx: AchievementContext): string[] {
  const codes: string[] = [];
  const c = ctx.totalCompletions ?? 0;
  if (c >= 1) codes.push('first_quest');
  if (c >= 10) codes.push('quests_10');
  if (c >= 50) codes.push('quests_50');
  if (c >= 100) codes.push('quests_100');
  if (c >= 500) codes.push('quests_500');
  if (ctx.diaCumplido) codes.push('first_day');
  const s = ctx.streak ?? 0;
  if (s >= 7) codes.push('streak_7');
  if (s >= 30) codes.push('streak_30');
  if (s >= 100) codes.push('streak_100');
  const l = ctx.level ?? 0;
  if (l >= 5) codes.push('level_5');
  if (l >= 10) codes.push('level_10');
  if (l >= 25) codes.push('level_25');
  if (l >= 50) codes.push('level_50');
  const e = ctx.evidenceCount ?? 0;
  if (e >= 1) codes.push('first_evidence');
  if (e >= 50) codes.push('evidence_50');
  if (ctx.penaltyRedeemed) codes.push('penalty_redeemed');
  const d = ctx.dungeonsCleared ?? 0;
  if (d >= 1) codes.push('first_dungeon');
  if (d >= 5) codes.push('dungeons_5');
  const p = ctx.prCount ?? 0;
  if (p >= 1) codes.push('first_pr');
  if (p >= 10) codes.push('pr_10');
  const j = ctx.journalCount ?? 0;
  if (j >= 1) codes.push('first_journal');
  if (j >= 30) codes.push('journal_30');
  // Rango v2: se registra en cuanto el nivel lo alcanza y ya no se pierde.
  if (l > 0) codes.push(...codigosDeRangoPendientes(l, ctx.unlocked ?? new Set()));
  return codes;
}

export async function fetchUnlocked(): Promise<Set<string>> {
  const { data } = await supabase.from('achievements').select('code');
  return new Set((data ?? []).map((r) => r.code as string));
}

// Inserta los códigos que aún no estén desbloqueados; devuelve los nuevos.
export async function unlockAchievements(
  userId: string,
  codes: string[],
): Promise<AchievementDef[]> {
  if (codes.length === 0) return [];
  const unlocked = await fetchUnlocked();
  const fresh = codes.filter((code) => !unlocked.has(code) && ACHIEVEMENT_BY_CODE[code]);
  if (fresh.length === 0) return [];
  // upsert idempotente: un duplicado por carrera (gym + campaña casi a la vez)
  // ya no aborta el lote entero ni traga logros nuevos en silencio. .select()
  // devuelve solo los realmente insertados.
  const { data, error } = await supabase
    .from('achievements')
    .upsert(
      fresh.map((code) => ({ user_id: userId, code })),
      { onConflict: 'user_id,code', ignoreDuplicates: true },
    )
    .select('code');
  if (error) {
    console.warn('NIVL: no se pudieron registrar logros:', error.message);
    return [];
  }
  const inserted = new Set((data ?? []).map((r) => r.code as string));
  return fresh.filter((code) => inserted.has(code)).map((code) => ACHIEVEMENT_BY_CODE[code]!);
}
