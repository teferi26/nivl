#!/usr/bin/env node
// NIVL · Siembra de la cuenta DEMO DE CAPTURAS de la App Store (1.0.8).
//
// Solo para el coordinador. NO es la cuenta revisora de Apple ni ninguna real.
// Guía completa: docs/qa-audit/CAPTURAS-108.md.
//
// Por defecto va EN SECO: calcula el plan e imprime el SQL equivalente sin
// conectar a nada. Escribe solo con --apply y estas variables de entorno, que
// nunca se guardan en el repo:
//
//   DEMO_USER_ID               uuid de la cuenta demo (obligatorio, también en seco)
//   PROTECTED_IDS              uuids separados por comas que el script se niega a
//                              tocar (revisora de Apple, cuentas reales…)
//   FRIEND_IDS                 opcional: 3–5 uuids de rivales ficticios a sembrar
//   DEMO_TZ                    zona para las fechas en seco (Europe/Madrid); con
//                              --apply manda la `timezone` del perfil
//   SUPABASE_URL               solo con --apply
//   SUPABASE_SERVICE_ROLE_KEY  solo con --apply
//   SUPABASE_ANON_KEY          solo con --sesiones
//
// Modos:
//   node scripts/seed-capturas.mjs                       en seco (por defecto)
//   node scripts/seed-capturas.mjs --apply               escribe con la clave de servicio
//   node scripts/seed-capturas.mjs --apply --sesiones    además abre una sesión de cada
//       cuenta (enlace mágico generado con la clave de servicio, como
//       scripts/session.mjs; no envía correo) y llama como el usuario a
//       sync_rank, friend_request/friend_respond y league_create/invite/accept.
//       Sin --sesiones esos pasos solo se imprimen.
//
// Idempotente: ids de misión deterministas (derivados del uuid de la cuenta),
// completions con on_conflict (user_id, quest_id, date) ignorando duplicados y
// el perfil con valores absolutos. No borra nada. No siembra salud, peso,
// gimnasio ni dieta: los títulos no enlazan con ningún módulo (infer_link de
// la 0019 los deja en 'ninguno').
//
// El rango NO se inserta a mano (la 0051 lo prohíbe al cliente y lo decide el
// servidor): lo registra sync_rank() con la sesión de la cuenta. Sin
// --sesiones, basta con abrir la app una vez con la cuenta demo: Hoy llama a
// sync_rank al cargar.
//
// Ninguna credencial ni correo se imprime nunca, tampoco en los errores.

import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

// ── Curva (espejo de src/lib/game.ts y de _nivel_de_xp en la 0051) ─────────
const XP_BY_DIFFICULTY = { trivial: 10, facil: 25, media: 50, dificil: 100, epica: 250 };
const xpCostForLevel = (level) => Math.round(100 * Math.pow(level, 1.5));
function levelFromXp(xpTotal) {
  let level = 1;
  let rest = Math.max(0, xpTotal);
  while (level < 999 && rest >= xpCostForLevel(level)) {
    rest -= xpCostForLevel(level);
    level += 1;
  }
  return level;
}
const xpParaEmpezarNivel = (n) => {
  let s = 0;
  for (let i = 1; i < n; i += 1) s += xpCostForLevel(i);
  return s;
};
const streakMultiplier = (d) => Math.min(1.5, 1 + 0.1 * Math.floor(Math.max(0, d) / 7));
// Espejo de _rango_merecido (0051) / rangoMerecido (progression.ts).
function rangoMerecido(nivel, dias) {
  const niv = nivel >= 30 ? 5 : nivel >= 22 ? 4 : nivel >= 15 ? 3 : nivel >= 10 ? 2 : nivel >= 5 ? 1 : 0;
  const dia = dias >= 600 ? 5 : dias >= 300 ? 4 : dias >= 110 ? 3 : dias >= 40 ? 2 : dias >= 7 ? 1 : 0;
  return ['E', 'D', 'C', 'B', 'A', 'S'][Math.min(niv, dia)];
}

// ── Utilidades ────────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fallo = (msg) => {
  console.error(`seed-capturas: ${msg}`);
  process.exit(1);
};
const lista = (v) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** uuid estable a partir de la cuenta y un nombre (forma de v5, sha-1). */
function uuidDe(userId, nombre) {
  const h = createHash('sha1').update(`nivl-capturas:${userId}:${nombre}`).digest('hex');
  const v = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${v}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** 'YYYY-MM-DD' de hoy en la zona dada. */
function hoyEn(tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function sumarDias(key, n) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;

// ── El plan (puro: no conecta a nada) ─────────────────────────────────────
/**
 * @param userId   cuenta a sembrar
 * @param tz       zona de las fechas locales (la del perfil al aplicar)
 * @param p        { nombre, nivel, ventana, racha, huecoCada, misionesHoy }
 *   ventana:   días de historia hacia atrás (sin contar hoy)
 *   racha:     días seguidos cumplidos que acaban AYER
 *   huecoCada: en la historia anterior a la racha, se salta 1 de cada N días
 */
function plan(userId, tz, p) {
  const hoy = hoyEn(tz);
  const ayer = sumarDias(hoy, -1);
  const historia = {
    id: uuidDe(userId, 'mision-historia'),
    title: p.misionHistoria,
    stat: 'INT',
    difficulty: 'media',
    created_at: `${sumarDias(hoy, -(p.ventana + 1))}T07:00:00Z`,
  };
  // Días de la ventana, del más antiguo al más reciente, con su racha previa.
  const completions = [];
  let racha = 0;
  for (let off = p.ventana; off >= 1; off -= 1) {
    const dia = sumarDias(hoy, -off);
    const enRacha = off <= p.racha;
    const corte = off === p.racha + 1; // el día que rompió la racha anterior
    const hueco = !enRacha && (corte || off % p.huecoCada === 0);
    if (hueco) {
      racha = 0;
      continue;
    }
    completions.push({
      quest_id: historia.id,
      date: dia,
      xp_awarded: Math.round(XP_BY_DIFFICULTY.media * streakMultiplier(racha)),
      completed_at: `${dia}T18:30:00Z`,
    });
    racha += 1;
  }
  const rachaAyer = racha; // = p.racha: los últimos p.racha días son seguidos
  // Misiones de hoy: la de la historia (cumplida hoy) y las demás, nuevas hoy.
  const nuevas = p.misionesHoy.map((m, i) => ({
    id: uuidDe(userId, `mision-hoy-${i}`),
    title: m.title,
    stat: m.stat,
    difficulty: m.difficulty,
    created_at: null, // now() en el servidor: no cuentan como falladas en días pasados
  }));
  completions.push({
    quest_id: historia.id,
    date: hoy,
    xp_awarded: Math.round(XP_BY_DIFFICULTY.media * streakMultiplier(rachaAyer)),
    completed_at: null, // now()
  });
  const diasActivos = new Set(completions.map((c) => c.date)).size;
  // XP: la de la historia es solo una parte; el resto representa misiones,
  // campañas y logros que no se siembran. Se fija para caer en mitad de `nivel`.
  const xpTotal = xpParaEmpezarNivel(p.nivel) + Math.round(xpCostForLevel(p.nivel) / 2);
  const reparto = { xp_fue: 0.15, xp_vit: 0.15, xp_int: 0.35, xp_agi: 0.15, xp_per: 0.2 };
  const stats = {};
  let usado = 0;
  for (const [k, f] of Object.entries(reparto)) {
    stats[k] = Math.round(xpTotal * f);
    usado += stats[k];
  }
  stats.xp_int += xpTotal - usado;
  const nivel = levelFromXp(xpTotal);
  return {
    userId,
    tz,
    hoy,
    ayer,
    quests: [historia, ...nuevas],
    completions,
    perfil: { name: p.nombre, xp_total: xpTotal, ...stats, streak_days: rachaAyer, last_day_processed: ayer, social_visible: true },
    resumen: {
      nivel,
      diasActivos,
      rachaAyer,
      xpHistoria: completions.reduce((s, c) => s + c.xp_awarded, 0),
      rangoEsperado: rangoMerecido(nivel, diasActivos),
    },
  };
}

const MISIONES_HOY = [
  { title: 'Planificar el día', stat: 'PER', difficulty: 'facil' },
  { title: 'Repasar inglés 15 minutos', stat: 'INT', difficulty: 'media' },
  { title: 'Ordenar el escritorio', stat: 'AGI', difficulty: 'trivial' },
  { title: 'Avanzar el proyecto una hora', stat: 'PER', difficulty: 'dificil' },
];

const PARAM_DEMO = {
  nombre: 'Gladiador demo',
  misionHistoria: 'Leer 20 páginas',
  nivel: 26, // ≥ 22 para A; < 30 para que no pida S
  ventana: 345,
  racha: 42,
  huecoCada: 9,
  misionesHoy: MISIONES_HOY,
};
// Rivales ficticios: menos nivel y menos días, para que la cuenta demo no
// parezca sola ni imbatible. Nombres genéricos, sin parecido con nadie.
const PARAM_RIVAL = (i) => ({
  nombre: `Rival demo ${i + 1}`,
  misionHistoria: 'Leer 10 páginas',
  nivel: [21, 18, 24, 15, 19][i % 5],
  ventana: [60, 45, 90, 30, 50][i % 5],
  racha: [12, 5, 20, 3, 8][i % 5],
  huecoCada: [4, 3, 5, 3, 4][i % 5],
  misionesHoy: MISIONES_HOY.slice(0, 2),
});

// ── Salida en seco ────────────────────────────────────────────────────────
function imprimirSQL(pl) {
  const u = sqlStr(pl.userId);
  const out = [];
  out.push(`-- Cuenta ${pl.userId} · zona ${pl.tz} · hoy ${pl.hoy}`);
  out.push('begin;');
  for (const q of pl.quests) {
    out.push(
      `insert into public.quests (id, user_id, title, stat, difficulty, days_of_week, created_at) values (${sqlStr(q.id)}, ${u}, ${sqlStr(q.title)}, ${sqlStr(q.stat)}, ${sqlStr(q.difficulty)}, '{1,2,3,4,5,6,7}', ${q.created_at ? sqlStr(q.created_at) : 'now()'}) on conflict (id) do nothing;`,
    );
  }
  const hist = pl.completions.filter((c) => c.completed_at);
  const deHoy = pl.completions.filter((c) => !c.completed_at);
  out.push(
    `insert into public.completions (user_id, quest_id, date, completed_at, xp_awarded)\n  select ${u}, ${sqlStr(pl.quests[0].id)}, d::date, (d || 'T18:30:00Z')::timestamptz, x\n  from unnest(\n    array[${hist.map((c) => `'${c.date}'`).join(',')}],\n    array[${hist.map((c) => c.xp_awarded).join(',')}]\n  ) as t(d, x)\n  on conflict (user_id, quest_id, date) do nothing;`,
  );
  for (const c of deHoy) {
    out.push(
      `insert into public.completions (user_id, quest_id, date, xp_awarded) values (${u}, ${sqlStr(c.quest_id)}, '${c.date}', ${c.xp_awarded}) on conflict (user_id, quest_id, date) do nothing;`,
    );
  }
  const sets = Object.entries(pl.perfil)
    .map(([k, v]) => `${k} = ${typeof v === 'string' ? sqlStr(v) : v}`)
    .join(', ');
  out.push(`update public.profiles set ${sets} where id = ${u};`);
  out.push('commit;');
  out.push('-- Después, CON LA SESIÓN DE ESA CUENTA (no con la de servicio): select public.sync_rank();');
  return out.join('\n');
}

function imprimirResumen(etiqueta, pl) {
  const r = pl.resumen;
  console.log(
    `${etiqueta}: nivel ${r.nivel} (xp_total ${pl.perfil.xp_total}), ${r.diasActivos} días activos, racha ${r.rachaAyer} hasta ${pl.ayer}, ` +
      `${pl.completions.length} completions (${r.xpHistoria} XP de historia), ${pl.quests.length} misiones hoy (1 cumplida), ` +
      `rango que registrará sync_rank: ${r.rangoEsperado}`,
  );
}

function pasosSociales(demo, rivales) {
  const p = [];
  p.push('Pasos con SESIÓN DE USUARIO (cada RPC exige auth.uid(); con --sesiones los ejecuta el script):');
  p.push(`  1. Como la demo:        rpc('sync_rank')  → rango ${demo.resumen.rangoEsperado}`);
  rivales.forEach((r) => p.push(`     Como ${r.perfil.name}: rpc('sync_rank')  → rango ${r.resumen.rangoEsperado}`));
  p.push("  2. Amistades: cada rival → rpc('friend_request', { p_code: <friend_code de la demo> });");
  p.push("     la demo → rpc('friend_respond', { p_friendship: <id>, p_accept: true }) por cada solicitud.");
  p.push("  3. Liga: la demo → rpc('league_create', { p_name: 'Liga demo' }) → <liga>;");
  p.push("     la demo → rpc('league_invite', { p_league: <liga>, p_friend: <rival> }) por cada rival;");
  p.push("     cada rival → rpc('league_accept', { p_league: <liga> }).");
  return p.join('\n');
}

// ── Escritura (--apply) ───────────────────────────────────────────────────
function cliente(url, key, jwt = key) {
  const headers = { apikey: key, authorization: `Bearer ${jwt}`, 'content-type': 'application/json' };
  const llamar = async (method, path, body, extra = {}) => {
    const r = await fetch(`${url}${path}`, { method, headers: { ...headers, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
    const texto = await r.text();
    if (!r.ok) throw new Error(`${method} ${path.split('?')[0]}: HTTP ${r.status} ${texto.slice(0, 200)}`);
    return texto ? JSON.parse(texto) : null;
  };
  return {
    select: (tabla, q) => llamar('GET', `/rest/v1/${tabla}?${q}`),
    insertar: (tabla, filas, onConflict) =>
      llamar('POST', `/rest/v1/${tabla}?on_conflict=${onConflict}`, filas, { prefer: 'resolution=ignore-duplicates,return=minimal' }),
    actualizar: (tabla, q, cambios) => llamar('PATCH', `/rest/v1/${tabla}?${q}`, cambios, { prefer: 'return=minimal' }),
    rpc: (fn, args = {}) => llamar('POST', `/rest/v1/rpc/${fn}`, args),
    auth: llamar,
  };
}

async function aplicarPlan(sb, pl) {
  await sb.insertar(
    'quests',
    pl.quests.map((q) => ({
      id: q.id,
      user_id: pl.userId,
      title: q.title,
      stat: q.stat,
      difficulty: q.difficulty,
      days_of_week: [1, 2, 3, 4, 5, 6, 7],
      ...(q.created_at ? { created_at: q.created_at } : {}),
    })),
    'id',
  );
  const filas = pl.completions.map((c) => ({
    user_id: pl.userId,
    quest_id: c.quest_id,
    date: c.date,
    xp_awarded: c.xp_awarded,
    ...(c.completed_at ? { completed_at: c.completed_at } : {}),
  }));
  // PostgREST exige las mismas claves en todas las filas de un lote.
  const conHora = filas.filter((f) => f.completed_at);
  const sinHora = filas.filter((f) => !f.completed_at);
  for (let i = 0; i < conHora.length; i += 200) await sb.insertar('completions', conHora.slice(i, i + 200), 'user_id,quest_id,date');
  if (sinHora.length) await sb.insertar('completions', sinHora, 'user_id,quest_id,date');
  // El perfil al final: last_day_processed dispara el marcador del día (0048).
  await sb.actualizar('profiles', `id=eq.${pl.userId}`, pl.perfil);
}

/** Sesión de usuario sin contraseña, como scripts/session.mjs. Nada se imprime. */
async function abrirSesion(url, service, anon, userId) {
  const admin = cliente(url, service);
  const user = await admin.auth('GET', `/auth/v1/admin/users/${userId}`);
  if (!user?.email) throw new Error('la cuenta no tiene correo');
  const link = await admin.auth('POST', '/auth/v1/admin/generate_link', { type: 'magiclink', email: user.email });
  const hashed = link?.properties?.hashed_token ?? link?.hashed_token;
  const r = await fetch(
    `${url}/auth/v1/verify?token=${encodeURIComponent(hashed)}&type=magiclink&redirect_to=${encodeURIComponent('http://localhost/')}`,
    { headers: { apikey: anon }, redirect: 'manual' },
  );
  const jwt = new URLSearchParams((r.headers.get('location') ?? '').split('#')[1] ?? '').get('access_token');
  if (!jwt) throw new Error(`no se obtuvo sesión (HTTP ${r.status})`);
  if (JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).sub !== userId) throw new Error('la sesión no es de esa cuenta');
  return cliente(url, anon, jwt);
}

async function social(url, service, anon, demo, rivales) {
  const admin = cliente(url, service);
  const yo = await abrirSesion(url, service, anon, demo.userId);
  console.log(`sync_rank (demo): ${JSON.stringify(await yo.rpc('sync_rank'))}`);
  const sesiones = [];
  for (const r of rivales) {
    const s = await abrirSesion(url, service, anon, r.userId);
    sesiones.push({ pl: r, s });
    const res = await s.rpc('sync_rank');
    console.log(`sync_rank (${r.perfil.name}): rango ${res?.rango}`);
  }
  const [perfilDemo] = await admin.select('profiles', `id=eq.${demo.userId}&select=friend_code`);
  for (const { pl, s } of sesiones) {
    const par = `or=(and(requester.eq.${demo.userId},addressee.eq.${pl.userId}),and(requester.eq.${pl.userId},addressee.eq.${demo.userId}))`;
    let [f] = await admin.select('friendships', `${par}&select=id,status`);
    if (!f) {
      await s.rpc('friend_request', { p_code: perfilDemo.friend_code });
      [f] = await admin.select('friendships', `${par}&select=id,status`);
    }
    if (f && f.status !== 'accepted') await yo.rpc('friend_respond', { p_friendship: f.id, p_accept: true });
    console.log(`amistad demo ↔ ${pl.perfil.name}: aceptada`);
  }
  let [liga] = await admin.select('private_leagues', `owner=eq.${demo.userId}&name=eq.${encodeURIComponent('Liga demo')}&select=id`);
  const ligaId = liga?.id ?? (await yo.rpc('league_create', { p_name: 'Liga demo' }));
  for (const { pl, s } of sesiones) {
    const [m] = await admin.select('league_members', `league_id=eq.${ligaId}&user_id=eq.${pl.userId}&select=user_id`);
    if (m) continue;
    await yo.rpc('league_invite', { p_league: ligaId, p_friend: pl.userId });
    await s.rpc('league_accept', { p_league: ligaId });
  }
  console.log(`liga «Liga demo»: ${rivales.length + 1} miembros`);
}

// ── Principal ─────────────────────────────────────────────────────────────
async function main() {
  const args = new Set(process.argv.slice(2));
  const aplicar = args.has('--apply');
  const conSesiones = args.has('--sesiones');
  if (conSesiones && !aplicar) fallo('--sesiones solo va junto a --apply.');

  const demoId = (process.env.DEMO_USER_ID ?? '').trim().toLowerCase();
  if (!demoId) fallo('falta DEMO_USER_ID (uuid de la cuenta demo de capturas). No hay valor por defecto.');
  if (!UUID_RE.test(demoId)) fallo('DEMO_USER_ID no es un uuid.');
  const protegidos = new Set(lista(process.env.PROTECTED_IDS));
  for (const id of protegidos) if (!UUID_RE.test(id)) fallo(`PROTECTED_IDS contiene algo que no es un uuid (${id.slice(0, 8)}…).`);
  const rivalIds = lista(process.env.FRIEND_IDS);
  if (rivalIds.length > 5) fallo('FRIEND_IDS admite como mucho 5 cuentas.');
  for (const id of [demoId, ...rivalIds]) {
    if (!UUID_RE.test(id)) fallo(`FRIEND_IDS contiene algo que no es un uuid (${id.slice(0, 8)}…).`);
    if (protegidos.has(id)) fallo(`${id} está en PROTECTED_IDS: no se toca.`);
  }
  if (new Set([demoId, ...rivalIds]).size !== rivalIds.length + 1) fallo('DEMO_USER_ID y FRIEND_IDS deben ser cuentas distintas.');
  if (aplicar && protegidos.size === 0) fallo('con --apply, PROTECTED_IDS es obligatorio (al menos la cuenta revisora de Apple).');

  let tz = process.env.DEMO_TZ || 'Europe/Madrid';
  let sb = null;
  let url = '';
  let service = '';
  if (aplicar) {
    url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
    service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    if (!/^https:\/\//.test(url) || !service) fallo('con --apply hacen falta SUPABASE_URL (https) y SUPABASE_SERVICE_ROLE_KEY en el entorno.');
    if (conSesiones && !process.env.SUPABASE_ANON_KEY) fallo('con --sesiones hace falta SUPABASE_ANON_KEY en el entorno.');
    sb = cliente(url, service);
  }

  const zonas = new Map();
  if (sb) {
    for (const id of [demoId, ...rivalIds]) {
      const [p] = await sb.select('profiles', `id=eq.${id}&select=id,onboarding_done,timezone`);
      if (!p) fallo(`no existe el perfil ${id}: da de alta la cuenta (y haz el onboarding) antes de sembrar.`);
      if (id === demoId && !p.onboarding_done)
        console.warn('AVISO: la demo no tiene onboarding_done. Hazlo en la app (contrato, edad, salud e IA) antes de las capturas.');
      zonas.set(id, p.timezone || tz);
    }
    tz = zonas.get(demoId);
  }

  const demo = plan(demoId, tz, PARAM_DEMO);
  const rivales = rivalIds.map((id, i) => plan(id, zonas.get(id) ?? tz, PARAM_RIVAL(i)));
  if (demo.resumen.diasActivos < 300 || demo.resumen.rachaAyer < 30 || demo.resumen.nivel < 24 || demo.resumen.rangoEsperado !== 'A')
    fallo('el plan no cumple nivel ≥ 24, 300 días, racha ≥ 30 y rango A: revisa PARAM_DEMO.');

  console.log(aplicar ? '== seed-capturas: APLICANDO ==' : '== seed-capturas: EN SECO (no conecta a nada) ==');
  imprimirResumen('Demo', demo);
  rivales.forEach((r) => imprimirResumen(r.perfil.name, r));
  if (!rivales.length) console.log('Sin FRIEND_IDS: no se siembran rivales (la captura de Amigos los necesita).');

  if (!aplicar) {
    console.log('\n-- SQL equivalente (referencia; el modo --apply usa la API REST con la clave de servicio)');
    console.log(imprimirSQL(demo));
    for (const r of rivales) console.log(`\n${imprimirSQL(r)}`);
    console.log(`\n${pasosSociales(demo, rivales)}`);
    return;
  }

  for (const pl of [demo, ...rivales]) {
    await aplicarPlan(sb, pl);
    console.log(`sembrada ${pl.perfil.name}`);
  }
  if (conSesiones) await social(url, service, process.env.SUPABASE_ANON_KEY, demo, rivales);
  else console.log(`\n${pasosSociales(demo, rivales)}\n(O abre la app con la demo: Hoy llama a sync_rank al cargar.)`);
}

main().catch((e) => fallo(e instanceof Error ? e.message : String(e)));
