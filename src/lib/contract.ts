import { decode } from 'base64-arraybuffer';
import { awardXpRpc } from './data';
import { addDays, dateKey } from './dates';
import { RULE_BREAK_XP } from './game';
import { supabase } from './supabase';
import type { BonusRedemption, JournalPhoto, Letter, Profile, Rule } from './types';
import { ErrorVisible } from './validation';

// ── Reglas del juego ────────────────────────────────────────────────
// Solo las VIGENTES. Una regla eliminada (por el coach o desde Contrato) se
// archiva con active=false para conservar su historial de roturas, y antes
// esta función las devolvía todas: Hábitos las seguía pintando y el cierre del
// día seguía cobrando 25 XP por cada una, aunque ya no existieran para él.
// Filtrar aquí y no en cada pantalla es lo que impide que vuelva a pasar.
export async function fetchRules(): Promise<Rule[]> {
  const { data, error } = await supabase
    .from('rules')
    .select('*')
    .eq('active', true)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Rule[];
}

export async function createRule(
  userId: string,
  input: { text: string; consequence: string; position: number },
): Promise<Rule> {
  const { data, error } = await supabase
    .from('rules')
    .insert({ user_id: userId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as Rule;
}

export async function setRuleActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('rules').update({ active }).eq('id', id);
  if (error) throw error;
}

export async function deleteRule(id: string): Promise<void> {
  const { error } = await supabase.from('rules').delete().eq('id', id);
  if (error) throw error;
}

// Editar una regla SIN reescribir el pasado: la regla vieja se archiva
// (active=false) con su historial de marcas y roturas intacto, y la nueva la
// sustituye desde hoy (closing.reglasIncumplidas no la juzga antes de su
// creación). Si hoy ya estaba marcada, la marca pasa a la nueva.
//
// Solo con los días ya cerrados (last_day_processed ≥ ayer): editar una regla
// rota antes de que se cierren los días pendientes la libraría del cobro.
export async function editarRegla(
  profile: Pick<Profile, 'id' | 'last_day_processed'>,
  rule: Rule,
  cambios: { text?: string; consequence?: string },
): Promise<Rule> {
  const hoy = dateKey();
  if (!profile.last_day_processed || profile.last_day_processed < addDays(hoy, -1)) {
    throw new ErrorVisible('Abre Hoy para cerrar los días pendientes antes de editar una regla.');
  }
  const text = (cambios.text ?? rule.text).trim();
  const consequence = (cambios.consequence ?? rule.consequence).trim();
  if (!text || !consequence) throw new ErrorVisible('La regla y su consecuencia no pueden quedar vacías.');
  if (text === rule.text && consequence === rule.consequence) return rule;

  // Primero la nueva; si falla, la vieja sigue vigente.
  const { data, error } = await supabase
    .from('rules')
    .insert({
      user_id: profile.id,
      text,
      consequence,
      position: rule.position,
      ...(rule.health_data ? { health_data: true } : {}),
    })
    .select()
    .single();
  if (error) throw error;
  const nueva = data as Rule;

  const { error: archivar } = await supabase.from('rules').update({ active: false }).eq('id', rule.id);
  if (archivar) {
    // Sin dos reglas vigentes para lo mismo: se deshace la nueva.
    await supabase.from('rules').delete().eq('id', nueva.id);
    throw archivar;
  }

  const marcadasHoy = await fetchRuleChecks(hoy).catch(() => new Set<string>());
  if (marcadasHoy.has(rule.id)) {
    await marcarReglaCumplida(profile.id, nueva.id, hoy).catch(() => {
      /* la regla ya está editada; la marca de hoy se puede volver a poner */
    });
  }
  return nueva;
}

// Romper una regla: −25 XP inmediatos (recuperables) + misión de consecuencia
// con el castigo que el propio usuario definió ("Correr 5 km"), válida solo hoy.
export async function breakRule(
  profile: Profile,
  rule: Rule,
): Promise<{ profile: Profile; penaltyXp: number }> {
  const today = dateKey();

  const { error: breakErr } = await supabase.from('rule_breaks').insert({
    user_id: profile.id,
    rule_id: rule.id,
    date: today,
  });
  if (breakErr) throw breakErr;

  // Delta negativo por RPC: el suelo de 0 lo pone el servidor.
  const updated = await awardXpRpc(-RULE_BREAK_XP, null, 'rule_broken', {
    rule: rule.text,
    consequence: rule.consequence,
  });

  const { error: questErr } = await supabase.from('quests').insert({
    health_data: rule.health_data === true,
    user_id: profile.id,
    title: `Consecuencia: ${rule.consequence}`,
    stat: 'AGI',
    difficulty: 'media',
    days_of_week: [],
    requires_evidence: false,
    is_penalty: true,
    penalty_date: today,
    penalty_xp: RULE_BREAK_XP,
  });
  if (questErr) throw questErr;

  return { profile: updated, penaltyXp: RULE_BREAK_XP };
}

// ── Las reglas se marcan cada día ───────────────────────────────────
//
// Antes una regla solo existía cuando confesabas haberla roto, y eso deja el
// contrato en manos de la honestidad del peor momento del día. Ahora se marca
// lo CUMPLIDO y el silencio cuenta como rota, igual que ya pasaba con las
// misiones en el cierre.

export async function fetchRuleChecks(date: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('rule_checks')
    .select('rule_id')
    .eq('date', date);
  if (error) throw error;
  return new Set((data ?? []).map((r) => (r as { rule_id: string }).rule_id));
}

/**
 * ¿Ha marcado alguna vez una regla? El juicio diario de las reglas arranca con
 * la primera marca (closing.reglasIncumplidas): antes, nada cuenta como roto.
 */
export async function haMarcadoReglas(): Promise<boolean> {
  const { count, error } = await supabase.from('rule_checks').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Marcas de un rango, agrupadas por fecha. Para el cierre de varios días. */
export async function fetchRuleChecksRange(desde: string, hasta: string): Promise<Map<string, Set<string>>> {
  const { data, error } = await supabase
    .from('rule_checks')
    .select('rule_id, date')
    .gte('date', desde)
    .lte('date', hasta);
  if (error) throw error;
  const mapa = new Map<string, Set<string>>();
  for (const r of (data ?? []) as { rule_id: string; date: string }[]) {
    const set = mapa.get(r.date) ?? new Set<string>();
    set.add(r.rule_id);
    mapa.set(r.date, set);
  }
  return mapa;
}

export async function marcarReglaCumplida(userId: string, ruleId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('rule_checks')
    .upsert({ user_id: userId, rule_id: ruleId, date }, { onConflict: 'user_id,rule_id,date' });
  if (error) throw error;
}

export async function desmarcarRegla(ruleId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('rule_checks')
    .delete()
    .eq('rule_id', ruleId)
    .eq('date', date);
  if (error) throw error;
}

export async function countBreaks(ruleId: string): Promise<number> {
  const { count } = await supabase
    .from('rule_breaks')
    .select('*', { count: 'exact', head: true })
    .eq('rule_id', ruleId);
  return count ?? 0;
}

// ── Puntos Bonus (RPC atómicas, nada de read-modify-write) ──────────
export async function awardBonus(amount: number): Promise<number> {
  const { data, error } = await supabase.rpc('award_bonus', { p_amount: amount });
  if (error) throw error;
  return data as number;
}

export async function redeemBonus(amount: number, reward: string): Promise<number> {
  const { data, error } = await supabase.rpc('redeem_bonus', { p_amount: amount, p_reward: reward });
  if (error) throw error;
  return data as number;
}

export async function fetchRedemptionsThisWeek(): Promise<BonusRedemption[]> {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data, error } = await supabase
    .from('bonus_redemptions')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BonusRedemption[];
}

// ── Carta al yo del futuro ──────────────────────────────────────────
export async function fetchLetter(): Promise<Letter | null> {
  const { data, error } = await supabase
    .from('letters')
    .select('*')
    .order('sealed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Letter) ?? null;
}

export async function sealLetter(userId: string, body: string, openAt: string, healthData = false): Promise<Letter> {
  const { data, error } = await supabase
    .from('letters')
    .insert({ user_id: userId, body, open_at: openAt, health_data: healthData })
    .select()
    .single();
  if (error) throw error;
  return data as Letter;
}

export async function openLetter(letter: Letter): Promise<Letter> {
  const { data, error } = await supabase
    .from('letters')
    .update({ opened_at: new Date().toISOString() })
    .eq('id', letter.id)
    .select()
    .single();
  if (error) throw error;
  return data as Letter;
}

// ── Fotos comprobante del diario (bucket evidence, carpeta del usuario) ──
export async function uploadJournalPhoto(
  userId: string,
  date: string,
  base64: string,
): Promise<JournalPhoto> {
  // Aquí la marca de tiempo SÍ va: un día admite varias fotos comprobante y
  // son una galería, no un único archivo. No es una fuga como lo era en las
  // evidencias porque deleteJournalPhoto borra fila y objeto a la vez, y un
  // fallo al insertar la fila compensa borrando la subida.
  const path = `${userId}/journal/${date}_${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from('evidence')
    .upload(path, decode(base64), { contentType: 'image/jpeg' });
  if (upErr) throw upErr;
  const { data, error } = await supabase
    .from('journal_photos')
    .insert({ user_id: userId, date, path })
    .select()
    .single();
  if (error) {
    // Compensación: no dejar la foto huérfana en Storage si la fila falla.
    await supabase.storage.from('evidence').remove([path]);
    throw error;
  }
  return data as JournalPhoto;
}

export async function fetchJournalPhotos(date: string): Promise<JournalPhoto[]> {
  const { data, error } = await supabase
    .from('journal_photos')
    .select('*')
    .eq('date', date)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as JournalPhoto[];
}

/** Las fotos de varios días en UNA consulta: el Archivo del diario pinta veinte
 *  tarjetas y no puede preguntar día a día. Las URL firmadas se piden aparte y
 *  solo para las tarjetas que las enseñan. */
export async function fetchJournalPhotosForDates(dates: string[]): Promise<JournalPhoto[]> {
  if (dates.length === 0) return [];
  const { data, error } = await supabase
    .from('journal_photos')
    .select('*')
    .in('date', dates)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as JournalPhoto[];
}

export async function deleteJournalPhoto(photo: JournalPhoto): Promise<void> {
  const { error } = await supabase.from('journal_photos').delete().eq('id', photo.id);
  if (error) throw error;
  await supabase.storage.from('evidence').remove([photo.path]);
}

export async function journalPhotoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('evidence').createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
