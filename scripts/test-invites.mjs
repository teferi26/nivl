// Isolated, in-memory SQL regression test for 0045 (invitaciones). Never connects to Supabase.
// Usage: node scripts/test-invites.mjs /path/to/@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Provide an existing PGlite module path; no dependencies are installed by this test.');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const root = fileURLToPath(new URL('..', import.meta.url));
// The proposal lives in docs until the coordinator copies it into supabase/migrations.
const migrationPath = ['supabase/migrations/0045_invitaciones.sql', 'docs/payment-audit/propuestas/0045_invitaciones.sql']
  .map((p) => resolve(root, p)).find((p) => existsSync(p));

let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const as = async (user, fn, role = 'authenticated') => {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('test.uid', $1, false)", [user ?? '']);
  try { return await fn(); } finally { await db.exec('reset role'); await db.query("select set_config('test.uid', '', false)"); }
};
const claim = (user, code) => as(user, () => scalar('select public.claim_invite($1)', [code]));
const settle = (user) => as(user, () => scalar('select public.settle_my_invites()'));
const mine = (user) => as(user, () => scalar('select public.my_invites()'));
const codeOf = (user) => scalar('select friend_code from profiles where id = $1', [user]);
let next = 1;
const newUser = async (ageDays = 0) => {
  const id = uid(next++);
  await db.query("insert into auth.users(id, created_at) values($1, now() - make_interval(days => $2))", [id, ageDays]);
  await db.query('insert into public.profiles(id) values($1)', [id]);
  await db.query('delete from friend_request_log where user_id = $1', [id]);
  return id;
};
// Backdate a claim, then give the invitee progress on `days` distinct server days since then.
const age = (invitee, days) => db.query("update invites set created_at = now() - make_interval(days => $2) where invitee = $1", [invitee, days]);
const progress = async (invitee, dayOffsets, via = 'completions') => {
  for (const d of dayOffsets) {
    if (via === 'completions') {
      await db.query(`insert into public.completions(user_id, quest_id, date, completed_at, xp_awarded)
        select $1, q.id, current_date, (select created_at from invites where invitee = $1) + make_interval(days => $2::int) + interval '1 hour', 10
        from public.quests q where q.user_id = $1 limit 1`, [invitee, d]);
    } else {
      await db.query(`insert into public.xp_daily_ledger(user_id, day, event, xp)
        values($1, ((select created_at from invites where invitee = $1) at time zone 'Europe/Madrid')::date + $2::int, 'gym_session', 50)`, [invitee, d]);
    }
  }
};
const quest = (user) => db.query("insert into public.quests(user_id, title) values($1, 'Misión')", [user]);

try {
  // Minimal preceding schema (Supabase roles, auth, the 0001 tables 0045 reads).
  // The REAL 0021 (friend codes + request log), 0031 (account erasure) and
  // 0041 (xp_daily_ledger) are loaded, then 0045 twice.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, created_at timestamptz not null default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select 'authenticated' $$;
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
    grant usage on schema auth, storage to anon, authenticated;
    create table public.profiles(
      id uuid primary key references auth.users(id) on delete cascade,
      name text not null default 'Gladiador', avatar_url text, timezone text,
      xp_total integer not null default 0, xp_fue integer not null default 0, xp_vit integer not null default 0,
      xp_int integer not null default 0, xp_agi integer not null default 0, xp_per integer not null default 0,
      streak_days integer not null default 0, created_at timestamptz not null default now()
    );
    create table public.quests(id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade, title text not null);
    create table public.completions(id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      quest_id uuid not null references public.quests(id) on delete cascade,
      date date not null, completed_at timestamptz not null default now(), xp_awarded integer not null,
      evidence_url text);
    create table public.events(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
      type text not null, payload jsonb not null default '{}', created_at timestamptz not null default now());
    create table public.subscriptions(user_id uuid primary key references auth.users(id) on delete cascade,
      status text not null default 'none', plan text not null default 'cortesia', provider text not null default 'manual',
      current_period_end timestamptz);
    grant select on all tables in schema public to authenticated;
    set check_function_bodies = off;
  `);
  for (const m of ['0021_amigos.sql', '0031_account_erasure.sql', '0041_xp_topes.sql']) {
    await db.exec(await readFile(resolve(root, 'supabase/migrations', m), 'utf8'));
  }
  await db.exec('set check_function_bodies = on');
  const migration = await readFile(migrationPath, 'utf8');
  await db.exec(migration);
  await db.exec(migration); // re-runnable
  check(await scalar("select coalesce(obj_description(to_regprocedure('public.claim_invite(text)'), 'pg_proc') like '%nivl:invites-0045%', false)"), true);

  const A = await newUser(400); // inviter, veteran account
  const codeA = await codeOf(A);
  await db.query("insert into subscriptions(user_id, status, plan) values($1, 'active', 'pro_anual')", [A]);
  const subsBefore = await scalar('select jsonb_agg(to_jsonb(s) order by user_id) from subscriptions s');
  const xpBefore = await scalar('select jsonb_agg(jsonb_build_object($$id$$, id, $$xp$$, xp_total) order by id) from profiles');

  // Rejections.
  check(await claim(A, codeA), { ok: false, reason: 'propio' });
  const B = await newUser(1);
  check(await claim(B, 'ZZZZZZZZ'), { ok: false, reason: 'desconocido' });
  check(await claim(B, 'abc'), { ok: false, reason: 'formato' });
  const old = await newUser(8);
  check(await claim(old, codeA), { ok: false, reason: 'fuera_de_plazo' });
  check(await claim(null, codeA), { ok: false, reason: 'sin_sesion' });
  // Accepted with spaces/lowercase, then double claim (same or another code).
  check(await claim(B, ` ${codeA.slice(0, 4).toLowerCase()}-${codeA.slice(4)} `), { ok: true, reason: null });
  check(await claim(B, codeA), { ok: false, reason: 'ya_invitado' });
  const C = await newUser(0);
  check(await claim(B, await codeOf(C)), { ok: false, reason: 'ya_invitado' });
  check(await scalar('select count(*)::int from invites where invitee = $1', [B]), 1);
  // Reciprocal: B (new) claimed A; A cannot claim B (also blocked by age), and C↔D reciprocity.
  const D = await newUser(0);
  check(await claim(C, await codeOf(D)), { ok: true, reason: null });
  check(await claim(D, await codeOf(C)), { ok: false, reason: 'reciproca' });
  // Pending erasure: own → said; inviter's → hidden as unknown.
  const E = await newUser(0);
  await db.query('insert into account_erasure_jobs(user_id) values($1)', [E]);
  check(await claim(E, codeA), { ok: false, reason: 'borrado_pendiente' });
  const F = await newUser(0);
  check(await claim(F, await codeOf(E)), { ok: false, reason: 'desconocido' });
  // Shared brake with friend_request (30/hour).
  const G = await newUser(0);
  for (let i = 0; i < 30; i++) await claim(G, 'ZZZZZZZZ');
  check(await claim(G, codeA), { ok: false, reason: 'limite' });

  // Settle: too early (<7 days) even with progress stays pending.
  await quest(B);
  await age(B, 3);
  await progress(B, [0, 1, 2]);
  check(await settle(A), { ok: true, activos: 0, activas: 0, pendientes: 1, nuevas_insignias: [] });
  // 7 days + 3 distinct days → activa + 'reclutador'; idempotent.
  await age(B, 8);
  check(await settle(A), { ok: true, activos: 1, activas: 1, pendientes: 0, nuevas_insignias: ['reclutador'] });
  check(await settle(A), { ok: true, activos: 1, activas: 1, pendientes: 0, nuevas_insignias: [] });
  // Same day twice counts once; backdated `date` is ignored (server completed_at used).
  const H = await newUser(0);
  const I = await newUser(0);
  check(await claim(H, codeA), { ok: true, reason: null });
  check(await claim(I, codeA), { ok: true, reason: null });
  await quest(H); await quest(I);
  await age(H, 10); await progress(H, [0, 0, 1]);
  await age(I, 10); await progress(I, [0], 'completions'); await progress(I, [3, 5], 'ledger');
  check((await settle(A)).activos, 2); // I via completions+ledger; H only 2 days → pending
  check(await scalar("select status from invites where invitee = $1", [H]), 'pendiente');
  // Inactive past 21 days → caducada.
  await age(H, 22);
  await settle(A);
  check(await scalar("select status from invites where invitee = $1", [H]), 'caducada');
  // Progress outside the 21-day window does not count.
  const J = await newUser(0);
  check(await claim(J, codeA), { ok: true, reason: null });
  await quest(J); await age(J, 30); await progress(J, [1, 22, 25]);
  await settle(A);
  check(await scalar("select status from invites where invitee = $1", [J]), 'caducada');

  // Anti-fraud cap: ≤3 activations / 30 days → the 4th becomes 'tope' and no badge.
  const K = await newUser(0);
  check(await claim(K, codeA), { ok: true, reason: null });
  await quest(K); await age(K, 8); await progress(K, [0, 1, 2]);
  let s = await settle(A);
  check([s.activos, s.nuevas_insignias], [3, ['lanista']]);
  const L = await newUser(0);
  check(await claim(L, codeA), { ok: true, reason: null });
  await quest(L); await age(L, 8); await progress(L, [0, 1, 2]);
  s = await settle(A);
  check([s.activos, s.nuevas_insignias], [3, []]);
  check(await scalar("select status from invites where invitee = $1", [L]), 'tope');
  // 365-day cap: with activations spread over the year, the 13th is 'tope'; 10 → 'senor_del_ludus'.
  await db.query("update invites set settled_at = now() - interval '60 days' where inviter = $1 and status = 'activa'", [A]);
  const batch = [];
  for (let i = 0; i < 9; i++) batch.push(await newUser(0));
  for (const [i, u] of batch.entries()) {
    await db.query("insert into invites(invitee, inviter, created_at) values($1, $2, now() - interval '9 days')", [u, A]);
    await quest(u); await progress(u, [0, 1, 2]);
    if (i % 3 === 2) { // three per settle, then move them back in time
      await settle(A);
      await db.query("update invites set settled_at = now() - make_interval(days => 40 * $2) where inviter = $1 and status = 'activa' and settled_at > now() - interval '1 day'", [A, i]);
    }
  }
  check(await scalar("select count(*)::int from invites where inviter = $1 and status = 'activa'", [A]), 12);
  check(await scalar("select count(*)::int from invites where inviter = $1 and status = 'tope'", [A]), 1);
  check(await scalar('select array_agg(kind order by id) from invite_rewards where user_id = $1', [A]), ['reclutador', 'lanista', 'senor_del_ludus']);
  const M = await newUser(0);
  await db.query("insert into invites(invitee, inviter, created_at) values($1, $2, now() - interval '9 days')", [M, A]);
  await quest(M); await progress(M, [0, 1, 2]);
  await settle(A);
  check(await scalar("select status from invites where invitee = $1", [M]), 'tope');
  check(await scalar('select count(*)::int from invite_rewards where user_id = $1', [A]), 3);

  // my_invites: own counters only, no ids.
  const my = await mine(A);
  check(my, { activos: 12, pendientes: 0, caducadas: 2, tope: 2, insignias: ['reclutador', 'lanista', 'senor_del_ludus'], siguiente_umbral: null, invitado: false });
  check(JSON.stringify(my).includes(B), false);
  check(await mine(B), { activos: 0, pendientes: 0, caducadas: 0, tope: 0, insignias: [], siguiente_umbral: 1, invitado: true });

  // Daily cap per code: 10 new claims per 24 h.
  const N = await newUser(400);
  const codeN = await codeOf(N);
  for (let i = 0; i < 10; i++) check((await claim(await newUser(0), codeN)).ok, true);
  check(await claim(await newUser(0), codeN), { ok: false, reason: 'tope' });

  // Cascade: deleting an invitee or inviter removes rows; badges go with their owner.
  await db.query('delete from auth.users where id = $1', [K]);
  check(await scalar('select count(*)::int from invites where invitee = $1', [K]), 0);
  await db.query('delete from auth.users where id = $1', [A]);
  check(await scalar('select count(*)::int from invites where inviter = $1', [A]), 0);
  check(await scalar('select count(*)::int from invite_rewards where user_id = $1', [A]), 0);

  // Permissions: anon cannot execute; authenticated cannot read tables or internals.
  for (const fn of ['claim_invite($1)', 'settle_my_invites()', 'my_invites()']) {
    await assert.rejects(as(null, () => db.query(`select public.${fn}`, fn.includes('$1') ? ['X'] : []), 'anon'), /permission denied/); checks++;
  }
  for (const t of ['invites', 'invite_rewards']) {
    await assert.rejects(as(B, () => db.query(`select * from public.${t}`)), /permission denied/); checks++;
    await assert.rejects(as(B, () => db.query(`insert into public.${t} default values`)), /permission denied/); checks++;
  }
  await assert.rejects(as(B, () => db.query('select public.invite_progress_days($1, now(), now())', [B])), /permission denied/); checks++;
  check(await scalar("select relrowsecurity from pg_class where oid = 'public.invites'::regclass"), true);
  check(await scalar("select relrowsecurity from pg_class where oid = 'public.invite_rewards'::regclass"), true);

  // No XP, no Pro days: subscriptions and xp_total unchanged for remaining rows.
  check(await scalar('select coalesce(jsonb_agg(to_jsonb(s) order by user_id), $$[]$$::jsonb) from subscriptions s'),
    subsBefore.filter((r) => r.user_id !== A));
  check(await scalar('select sum(xp_total)::int from profiles'), 0);
  check(xpBefore.every((r) => r.xp === 0), true);
  check(await scalar("select count(*)::int from events where type like 'invite%'"), 0);

  console.log(JSON.stringify({ ok: true, checks, database: 'PGlite in memory', productionTouched: false }));
} finally { await db.close(); }
