// Prueba SQL aislada y en memoria de 0048 (competición) y 0051 (rango). Nunca
// se conecta a Supabase. Arnés de QA del Chat 5.
// Uso: node scripts/test-competicion.mjs /ruta/a/@electric-sql/pglite/dist/index.js
//
// Carga un esquema MÍNIMO previo (roles, auth, las tablas que leen 0048/0051 y
// dobles de las funciones de salud de 0030) y después las dos migraciones
// reales, DOS veces cada una (idempotencia).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Indica la ruta de un módulo PGlite existente; este test no instala nada.');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const root = fileURLToPath(new URL('..', import.meta.url));

let checks = 0;
const check = (actual, expected, msg) => { assert.deepEqual(actual, expected, msg); checks++; };
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const one = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0] ?? {})[0];
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const as = async (user, fn) => {
  await db.exec('set role authenticated');
  await db.query("select set_config('test.uid', $1, false)", [user]);
  try { return await fn(); } finally { await db.exec('reset role'); await db.query("select set_config('test.uid', '', false)"); }
};
const fails = async (fn, code) => {
  try { await fn(); } catch (e) { if (code) assert.equal(e.code, code, e.message); checks++; return; }
  assert.fail('se esperaba un error');
};

await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select case when nullif(current_setting('test.uid', true), '') is null then 'service_role' else 'authenticated' end $$;
  grant usage on schema auth to authenticated, anon;
  grant usage on schema public to authenticated, anon;

  create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    name text default 'Gladiador', avatar_url text, social_visible boolean default true,
    timezone text default 'Europe/Madrid', xp_total integer default 0,
    last_day_processed date
  );
  create table public.quests (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
    title text default 'Misión', difficulty text default 'media', days_of_week int[] default '{1,2,3,4,5,6,7}',
    active boolean default true, is_penalty boolean default false, is_bonus boolean default false,
    acquired_at timestamptz, created_at timestamptz default now() - interval '60 days', health_data boolean default false
  );
  create table public.completions (
    id uuid primary key default gen_random_uuid(), user_id uuid not null, quest_id uuid not null,
    date date not null, xp_awarded integer default 50, unique (user_id, quest_id, date)
  );
  create table public.friendships (
    id uuid primary key default gen_random_uuid(), requester uuid, addressee uuid, status text
  );
  create table public.social_blocks (blocker uuid, blocked uuid);
  create table public.achievements (
    id uuid primary key default gen_random_uuid(), user_id uuid not null, code text not null, unique (user_id, code)
  );
  alter table public.achievements enable row level security;
  create policy "own achievements" on public.achievements for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
  grant select, insert, update, delete on public.achievements to authenticated;
  create table public.xp_daily_ledger (user_id uuid, day date, event text, xp integer, primary key (user_id, day, event));
  create table public.events (id uuid primary key default gen_random_uuid(), user_id uuid, type text, payload jsonb, health_data boolean default false);
  grant select, insert on public.events to authenticated;
  create table public.health_erasure_jobs (user_id uuid, status text);
  create table public.rules (id uuid, user_id uuid, text text);
  create table public.dungeons (id uuid, user_id uuid, title text);
  create table public.goals (id uuid, user_id uuid, title text);
  create table public.social_profile_reviews (user_id uuid primary key, status text default 'pending', approved_name text, approved_avatar text);
  create function public.social_public_name(p_user uuid) returns text language sql stable security definer set search_path = public as $$
    select coalesce((select r.approved_name from public.social_profile_reviews r where r.user_id = p_user and r.status = 'approved'),
                    'Gladiador ' || left(p_user::text, 6)) $$;

  -- Dobles de 0030/0035 (la salud no es objeto de esta prueba).
  create function public.safe_tz(tz text) returns text language sql immutable as $$ select coalesce(tz, 'UTC') $$;
  create function public.health_row(t text, r jsonb) returns boolean language sql stable as $$ select coalesce((r->>'health_data')::boolean, false) $$;
  create function public.health_consent_active(u uuid) returns boolean language sql stable as $$ select true $$;
  create function public.assert_health_write(u uuid) returns void language plpgsql as $$ begin raise exception 'sin_consentimiento_salud' using errcode = '42501'; end $$;
  create function public.general_event_payload(p jsonb) returns jsonb language sql immutable as $$ select p $$;
`);

// Mientras el Chat 3 no dé el PASS, viven en docs/game-v2/propuestas; después,
// en supabase/migrations. Se usa la que exista (preferencia: migrations).
const { existsSync } = await import('node:fs');
const { readdirSync } = await import('node:fs');
const amigos = [...readdirSync(resolve(root, 'supabase/migrations')).filter((x) => /rango_amigos\.sql$/.test(x)), 'rango_amigos.sql'][0];
const ajustes = [...readdirSync(resolve(root, 'supabase/migrations')).filter((x) => /competicion_ajustes\.sql$/.test(x)), 'competicion_ajustes.sql'][0];
for (const f of ['0048_competicion.sql', '0051_rango.sql', amigos, ajustes]) {
  const ruta = ['supabase/migrations', 'docs/game-v2/propuestas'].map((d) => resolve(root, d, f)).find((x) => existsSync(x));
  if (!ruta) throw new Error(`No encuentro ${f}`);
  const sql = await readFile(ruta, 'utf8');
  await db.exec(sql);
  await db.exec(sql); // idempotente
}
await db.exec(`create trigger events_health before insert on public.events for each row execute function public.require_health_write();`);

// ── Datos ───────────────────────────────────────────────────────────────
const [A, B, C, D] = [1, 2, 3, 4].map(uid);
for (const u of [A, B, C, D]) {
  await db.query('insert into auth.users(id) values ($1)', [u]);
  await db.query("insert into public.profiles(id, name, timezone) values ($1, $2, 'Europe/Madrid')", [u, 'U' + u.slice(-1)]);
}
const friends = async (x, y) => db.query("insert into public.friendships(requester, addressee, status) values ($1, $2, 'accepted')", [x, y]);
await friends(A, B); await friends(A, C); await friends(A, D);
const hoy = await one("select (now() at time zone 'Europe/Madrid')::date::text");

// ── Ligas ───────────────────────────────────────────────────────────────
const liga = await as(A, () => one("select public.league_create('  Los\n del gym ')"));
check(await one('select name from public.private_leagues where id = $1', [liga]), 'Los del gym', 'nombre limpio');
// Consentimiento: el dueño INVITA y el amigo acepta (P1-3 del Chat 3).
await as(A, () => db.query('select public.league_invite($1, $2)', [liga, B]));
check(Number(await as(B, () => one('select count(*) from public.league_members where league_id = $1', [liga]))), 0, 'invitar no mete a nadie');
check((await as(B, () => rows('select nombre, de from public.my_league_invites()'))).length, 1, 'B ve su invitación');
await as(B, () => db.query('select public.league_accept($1)', [liga]));
await fails(() => as(C, () => db.query('select public.league_accept($1)', [liga])), '42501'); // sin invitación
await fails(() => as(B, () => db.query('select public.league_invite($1, $2)', [liga, C])), '42501'); // solo el dueño
await fails(() => as(A, () => db.query('select public.league_invite($1, $2)', [liga, uid(9)])), '42501'); // no amigo
await db.query('insert into public.social_blocks values ($1, $2)', [B, D]);
await as(A, () => db.query('select public.league_invite($1, $2)', [liga, D]));
await fails(() => as(D, () => db.query('select public.league_accept($1)', [liga])), '42501'); // bloqueo con un miembro
// Un ex-amigo del dueño no entra aunque tuviera invitación.
const F = uid(6);
await db.query('insert into auth.users(id) values ($1)', [F]);
await db.query("insert into public.profiles(id) values ($1)", [F]);
await friends(A, F);
await as(A, () => db.query('select public.league_invite($1, $2)', [liga, F]));
await db.query("delete from public.friendships where addressee = $1", [F]);
await fails(() => as(F, () => db.query('select public.league_accept($1)', [liga])), '42501');
// Rechazar impide reinvitar durante 7 días.
await friends(A, F);
await as(A, () => db.query('select public.league_invite($1, $2)', [liga, F]));
await as(F, () => db.query('select public.league_decline($1)', [liga]));
await fails(() => as(A, () => db.query('select public.league_invite($1, $2)', [liga, F])), '22023');
check((await as(F, () => rows('select * from public.my_league_invites()'))).length, 0, 'rechazada no aparece');
// RLS sin recursión ni sondeo: un miembro ve los miembros; un ajeno no ve nada.
check(Number(await as(B, () => one('select count(*) from public.league_members where league_id = $1', [liga]))), 2, 'miembro ve la liga');
check(Number(await as(C, () => one('select count(*) from public.league_members'))), 0, 'ajeno no ve nada');
check(Number(await as(C, () => one('select count(*) from public.private_leagues'))), 0, 'ajeno no ve ligas');
await fails(() => as(C, () => one('select public._es_miembro($1, $2)', [liga, A])), '42501'); // sin sondeo
await fails(() => as(B, () => db.query("insert into public.league_members values ($1, $2)", [liga, C])));  // sin escritura directa
// Límite de 3 ligas nuevas al día.
await as(C, () => one("select public.league_create('L1')")); await as(C, () => one("select public.league_create('L2')"));
await as(C, () => one("select public.league_create('L3')"));
await fails(() => as(C, () => one("select public.league_create('L4')")), '22023');

// Tablero: alias y métricas, sin uuid ajenos.
const qa = (await rows("insert into public.quests(user_id) values ($1) returning id", [A]))[0].id;
await db.query('insert into public.completions(user_id, quest_id, date) values ($1, $2, $3)', [A, qa, hoy]);
const tablero = await as(B, () => rows('select * from public.league_board($1)', [liga]));
check(tablero.length, 2, 'tablero con dos');
check(Object.keys(tablero[0]).includes('user_id'), false, 'sin uuid');
await fails(() => as(C, () => rows('select * from public.league_board($1)', [liga])), '42501');
// El tablero usa el alias APROBADO, no profiles.name.
check(tablero.find((t) => !t.es_yo).alias.startsWith('Gladiador '), true, 'alias aprobado o genérico');
// Un miembro suspendido desaparece del tablero ajeno.
await db.query("insert into public.social_profile_reviews(user_id, status) values ($1, 'suspended')", [A]);
check((await as(B, () => rows('select * from public.league_board($1)', [liga]))).length, 1, 'suspendido oculto');
await db.query('delete from public.social_profile_reviews where user_id = $1', [A]);
// my_league_standing funciona en una transacción de SOLO LECTURA (GET de PostgREST).
await db.exec('begin read only');
await as(A, () => rows('select * from public.my_league_standing()'));
await db.exec('commit');
checks++;
const pos = await as(A, () => rows('select * from public.my_league_standing()'));
check(pos.length, 1, 'mi liga');
check(Object.keys(pos[0]).sort(), ['indice', 'league_id', 'miembros', 'nombre', 'puesto', 'velocidad'], 'columnas de standing');

// ── Foto fija diaria: desactivar una misión fallada no reescribe la semana ─
const ayer = await one("select ((now() at time zone 'Europe/Madrid')::date - 1)::text");
const qb = (await rows("insert into public.quests(user_id, difficulty) values ($1, 'dificil') returning id", [B]))[0].id;
await db.query("update public.profiles set last_day_processed = ($2::date - 1) where id = $1", [B, ayer]);
await db.query('update public.profiles set last_day_processed = $2::date where id = $1', [B, ayer]); // cierre de ayer
const foto = await rows('select programadas_xp, cumplidas_xp from public.daily_scorecards where user_id = $1 and day = $2', [B, ayer]);
check(foto, [{ programadas_xp: 100, cumplidas_xp: 0 }], 'foto fija con la misión fallada');
await db.query('update public.quests set active = false where id = $1', [qb]);
const m = await rows('select programadas_xp, cumplidas_xp from public._marcador($1, $2::date, $2::date)', [B, ayer]);
check(m, [{ programadas_xp: 100, cumplidas_xp: 0 }], 'desactivar no borra el fallo');
// Desactivar HOY una misión de hoy, antes del cierre, tampoco la saca de hoy.
const qhoy = (await rows("insert into public.quests(user_id, difficulty) values ($1, 'epica') returning id", [C]))[0].id;
await db.query('update public.quests set active = false where id = $1', [qhoy]);
check(await one('select programadas_xp from public._dia_en_vivo($1, $2::date)', [C, hoy]), 250, 'desactivada hoy sigue contando hoy');
check(await one("select programadas_xp from public._dia_en_vivo($1, ($2::date + 1))", [C, hoy]), 0, 'mañana ya no');

// P1-h: borrar la misión fallada, o quitarle el día, ANTES del cierre no
// saca el fallo (se congela el día pendiente con la misión como estaba).
const E = uid(5);
await db.query('insert into auth.users(id) values ($1)', [E]);
await db.query("insert into public.profiles(id, timezone, last_day_processed) values ($1, 'Europe/Madrid', $2::date - 2)", [E, hoy]);
const qe1 = (await rows("insert into public.quests(user_id, difficulty) values ($1, 'media') returning id", [E]))[0].id;
const qe2 = (await rows("insert into public.quests(user_id, difficulty) values ($1, 'dificil') returning id", [E]))[0].id;
await db.query('delete from public.quests where id = $1', [qe2]);           // borrar la fallada
await db.query("update public.quests set days_of_week = '{}' where id = $1", [qe1]); // quitarle el día
await db.query('update public.quests set days_of_week = $2 where id = $1', [qe1, '{1,2,3,4,5,6,7}']);
await db.query('update public.profiles set last_day_processed = $2::date - 1 where id = $1', [E, hoy]); // cierre de ayer
check(await one('select programadas_xp from public.daily_scorecards where user_id = $1 and day = $2::date - 1', [E, hoy]), 150, 'borrar o editar antes del cierre no saca el fallo');
// deactivated_at no se fija al insertar.
const qx = (await rows("insert into public.quests(user_id, active, deactivated_at) values ($1, true, now() - interval '9 days') returning deactivated_at", [E]))[0];
check(qx.deactivated_at, null, 'deactivated_at ignorado al insertar');
// El borrado de cuenta en cascada no choca con el congelado.
await db.query('alter table public.quests drop constraint if exists quests_user_id_fkey');
await db.query('alter table public.quests add constraint quests_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade');
await db.query('alter table public.profiles drop constraint if exists profiles_id_fkey');
await db.query('alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade');
await db.query('delete from auth.users where id = $1', [E]);
check(Number(await one('select count(*) from public.quests where user_id = $1', [E])), 0, 'borrado de cuenta en cascada OK');

// ── Duelos ──────────────────────────────────────────────────────────────
const duelo = await as(A, () => one('select public.duel_challenge($1)', [B]));
await fails(() => as(B, () => one('select public.duel_challenge($1)', [A])), '22023'); // uno por pareja y semana
await fails(() => as(A, () => one('select public.duel_challenge($1)', [uid(9)])), '42501');
await fails(() => as(C, () => db.query('select public.duel_respond($1, true)', [duelo])), '42501'); // solo el retado
await as(B, () => db.query('select public.duel_respond($1, true)', [duelo]));
check((await as(A, () => rows('select status from public.my_duels()')))[0].status, 'accepted', 'duelo aceptado');
check(Number(await as(C, () => one('select count(*) from public.duels'))), 0, 'tercero no ve duelos');
// Un bloqueo posterior anula el duelo y oculta el nombre del rival.
await db.query('insert into public.social_blocks values ($1, $2)', [A, B]);
const anulado = (await as(A, () => rows('select status, rival from public.my_duels()')))[0];
check([anulado.status, anulado.rival], ['cancelled', null], 'bloqueo anula y oculta');
await db.query('delete from public.social_blocks where blocker = $1 and blocked = $2', [A, B]);

// ── last_open_on ────────────────────────────────────────────────────────
check(await as(A, () => one('select public.touch_open()::text')), hoy, 'touch_open devuelve hoy local');
check(await one('select last_open_on::text from public.profiles where id = $1', [A]), hoy, 'guardado');

// ── Eventos nuevos sin salud ────────────────────────────────────────────
await as(A, () => db.query("insert into public.events(user_id, type, payload) values ($1, 'duel_won', '{}')", [A]));
check(await one("select health_data from public.events where type = 'duel_won'"), false, 'duel_won es general');
await fails(() => as(A, () => db.query("insert into public.events(user_id, type, payload) values ($1, 'tipo_raro', '{}')", [A])), '42501');

// ── 0051 rango ──────────────────────────────────────────────────────────
await fails(() => as(A, () => db.query("insert into public.achievements(user_id, code) values ($1, 'rango_S')", [A])), '42501');
await fails(() => as(A, async () => {
  await db.query("select set_config('nivl.sync_rank', 'on', false)");
  await db.query("insert into public.achievements(user_id, code) values ($1, 'rango_S')", [A]);
}), '42501'); // ya no hay bandera que valga
await as(A, () => db.query("insert into public.achievements(user_id, code) values ($1, 'first_quest')", [A])); // lo de 1.0.7 sigue
// Nivel 31 de XP pero 1 día activo → rango E (los días mandan).
await db.query('update public.profiles set xp_total = 200000 where id = $1', [A]);
let r = await as(A, () => one('select public.sync_rank()'));
check([r.rango, r.nuevos, r.nivel >= 30], ['E', [], true], 'mucho XP, pocos días: E');
// 45 días activos → C.
for (let i = 1; i <= 45; i++) {
  await db.query("insert into public.completions(user_id, quest_id, date) values ($1, $2, current_date - $3::int)", [A, qa, i]);
}
r = await as(A, () => one('select public.sync_rank()'));
check([r.rango, r.nuevos], ['C', ['rango_D', 'rango_C']], 'sync_rank registra D y C');
r = await as(A, () => one('select public.sync_rank()'));
check(r.nuevos, [], 'idempotente');
await db.query('update public.profiles set xp_total = 0 where id = $1', [A]);
r = await as(A, () => one('select public.sync_rank()'));
check(r.rango, 'C', 'el rango no baja');
check(await one('select public._nivel_de_xp(0)'), 1, 'nivel 1');
check(await one('select public._nivel_de_xp(1703)'), 5, 'curva igual que game.ts (nivel 5 = 1703)');

// ── Rango de mis amigos (propuesta rango_amigos.sql) ────────────────────
// A ya tiene rango C registrado; B es amiga de A y lo ve; C (amiga) también;
// tras un bloqueo, B deja de verlo.
const rangoDe = async (yo, otro) => (await as(yo, () => rows('select rango from public.friends_ranks() where user_id = $1', [otro])))[0]?.rango;
check(await rangoDe(B, A), 'C', 'amiga ve el rango registrado');
check(await rangoDe(C, B), undefined, 'no amigos: nada');
await db.query('insert into public.social_blocks values ($1, $2)', [A, B]);
check(await rangoDe(B, A), undefined, 'bloqueo: oculto');
await db.query('delete from public.social_blocks where blocker = $1 and blocked = $2', [A, B]);
await db.query("update public.profiles set social_visible = false where id = $1", [A]);
check(await rangoDe(B, A), undefined, 'no visible: oculto');

// ── Ajustes de la auditoría de coherencia (competicion_ajustes.sql) ─────
// Sin datos esta semana: puesto 0, no «último».
const ligaX = await as(F, () => one("select public.league_create('Sin datos')"));
check((await as(F, () => rows('select puesto from public.my_league_standing() where league_id = $1', [ligaX])))[0].puesto, 0, 'sin datos → puesto 0');
// my_duels trae suficiencia y semana_cerrada; un duelo de hace dos semanas se resuelve.
const viejo = (await rows("insert into public.duels(challenger, opponent, week_start, status) values ($1, $2, date_trunc('week', now())::date - 14, 'accepted') returning id", [A, C]))[0].id;
const md = (await as(A, () => rows('select * from public.my_duels() where id = $1', [viejo])))[0];
check([md.semana_cerrada, md.mi_suficiente === true || md.mi_suficiente === false, md.resultado !== null], [true, true, true], 'duelo pasado resuelto con suficiencia y semana cerrada');

console.log(`OK: ${checks} comprobaciones (0048 + 0051 + 0052 + ajustes, cada una aplicada dos veces)`);
