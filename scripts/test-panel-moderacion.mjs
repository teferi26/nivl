// Prueba SQL local del panel de moderación (0088): autorización y efectos de cada RPC.
// Sin red, sin credenciales y sin tocar producción: PostgreSQL en memoria (PGlite).
//   PGLITE_PACKAGE_ROOT=<carpeta con @electric-sql/pglite> node scripts/test-panel-moderacion.mjs
//
// Se ejecuta el SQL real de 0037, del bloque de admins de 0072, de 0087 y de
// 0088. Lo demás (perfiles, amigos, el guard de borrado) son piezas mínimas.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(process.env.PGLITE_PACKAGE_ROOT || root, 'package.json'));
const { PGlite } = require('@electric-sql/pglite');
const leer = (n) => readFile(path.join(root, 'supabase/migrations', n), 'utf8');

const db = new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
grant usage on schema public,auth,storage to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;

create table public.profiles(id uuid primary key,name text,avatar_url text,equipped_title text,social_visible boolean default true);
create table public.social_profile_reviews(user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','approved','rejected','suspended')),
  approved_name text,approved_avatar text,approved_title text,updated_at timestamptz not null default now(),reviewed_at timestamptz,review_note text);
create table public.social_reports(id uuid primary key default gen_random_uuid(),reporter uuid,subject uuid not null,
  reason text not null,displayed_name text,displayed_avatar text,displayed_title text,status text not null default 'open',
  created_at timestamptz not null default now(),resolved_at timestamptz,resolution text);
alter table public.social_profile_reviews enable row level security;
alter table public.social_reports enable row level security;
revoke all on public.social_profile_reviews,public.social_reports from public,anon,authenticated;
create table public.subscriptions(user_id uuid primary key,plan text);
create function public.user_tier(u uuid) returns text language sql stable as $$ select coalesce((select plan from public.subscriptions where user_id=u),'free') $$;
create table public.friendships(requester uuid,addressee uuid,status text);
create table public.elite_group_members(group_id uuid,user_id uuid);
create function public.social_pair_allowed(a uuid,b uuid) returns boolean language sql stable as $$ select false $$;
create table public.erasure_pending(u uuid primary key);
create function public.account_erasure_pending(p uuid) returns boolean language sql stable as $$ select exists(select 1 from public.erasure_pending where u=p) $$;
create function public.require_account_active() returns trigger language plpgsql security definer set search_path=public as $$
declare u uuid := (to_jsonb(new)->>tg_argv[0])::uuid;
begin if public.account_erasure_pending(u) then raise exception 'borrado_cuenta_pendiente' using errcode='42501'; end if; return new; end $$;
`);

await db.exec(await leer('0037_moderacion.sql'));
const m72 = await leer('0072_admin_metricas.sql');
const ini = m72.indexOf('-- ── Admins'), fin = m72.indexOf('-- Ventana de fechas');
assert.ok(ini > 0 && fin > ini, 'no encuentro el bloque de admins en 0072');
await db.exec(m72.slice(ini, fin));
await db.exec(await leer('0087_perfiles_sin_revision_previa.sql'));
const m88 = await leer('0088_panel_moderacion.sql');
await db.exec(m88);
await db.exec(m88); // Reejecutable.
await db.exec(`create trigger pendiente after insert or update on public.profiles for each row execute function public.social_profile_pending();`);

const ADMIN = 'a0000000-0000-4000-8000-000000000001', NORMAL = 'b0000000-0000-4000-8000-000000000002',
  MALO = 'c0000000-0000-4000-8000-000000000003', OWNER = 'd0000000-0000-4000-8000-000000000004',
  R1 = 'e0000000-0000-4000-8000-000000000001', R2 = 'e0000000-0000-4000-8000-000000000002',
  IA1 = 'f0000000-0000-4000-8000-000000000001', IA2 = 'f0000000-0000-4000-8000-000000000002';

async function como(rol, uid = '') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)", [uid, rol]);
  if (rol !== 'postgres') await db.exec('set role ' + rol);
}
const uno = async (q, a = []) => Object.values((await db.query(q, a)).rows[0])[0];
async function negado(q, a = []) {
  let err;
  try { await db.query(q, a); } catch (e) { err = e; }
  assert.ok(err, 'tenía que negarse: ' + q);
  assert.equal(err.code, '42501', err.code + ': ' + err.message);
}
let n = 0;
async function test(nombre, fn) { await como('postgres'); await fn(); console.log('PASS', nombre); n++; }

await db.query("insert into auth.users(id) values($1),($2),($3),($4)", [ADMIN, NORMAL, MALO, OWNER]);
await db.query("insert into public.admins(user_id) values($1)", [ADMIN]);
await db.query("insert into public.subscriptions values($1,'owner')", [OWNER]);
await db.query("insert into public.profiles(id,name,avatar_url,equipped_title) values($1,'Admin',null,null),($2,'Normal',null,null),($3,'Insulto',$5,'Título feo'),($4,'Dueño',null,null)",
  [ADMIN, NORMAL, MALO, OWNER, MALO + '/a.jpg']);
await db.exec(`update public.social_profile_reviews set updated_at = now() - interval '1 hour'`);
await db.query("insert into public.social_reports(id,reporter,subject,reason,displayed_name,displayed_avatar,displayed_title) values($1,$3,$4,'avatar','Insulto',$5,'Título feo'),($2,$3,$4,'name','Insulto',null,null)",
  [R1, R2, NORMAL, MALO, MALO + '/a.jpg']);
await db.query("insert into public.ai_reports(id,reporter,source,reason,excerpt) values($1,$3,'coach','salud','Deja de comer tres días'),($2,$4,'oraculo','otro','Otra cosa')",
  [IA1, IA2, NORMAL, OWNER]);

const LLAMADAS = [
  ['select admin_moderacion_bandeja()', []],
  ['select admin_moderacion_bandeja(10)', []],
  ["select admin_moderacion_descartar('perfil',$1,'x')", [R1]],
  ["select admin_moderacion_resolver('ia',$1,'x')", [IA1]],
  ["select admin_moderacion_suspender($1,'motivo largo')", [MALO]],
  ["select admin_moderacion_levantar($1,now(),'motivo largo')", [MALO]],
  ['select admin_moderacion_marcar_revisado($1,now())', [MALO]],
];
const INTERNAS = [
  "select moderacion_registro('a','b')",
  "select moderacion_motivo('ia','salud')",
  "select moderacion_cerrar_denuncia('ia','" + IA1 + "','resolved','a','b')",
];

await test('anon no puede listar ni actuar', async () => {
  await como('anon');
  for (const [q, a] of LLAMADAS) await negado(q, a);
});
await test('un no-admin no puede listar ni actuar', async () => {
  await como('authenticated', NORMAL);
  for (const [q, a] of LLAMADAS) await negado(q, a);
  await negado('select * from public.social_reports');
  await negado('select * from public.ai_reports');
  await negado('select * from public.social_profile_reviews');
  await negado('select * from public.admins');
  await negado("update public.social_reports set status='dismissed'");
  assert.equal(await uno('select es_admin()'), false);
});
await test('un owner que no está en admins tampoco', async () => {
  await como('authenticated', OWNER);
  for (const [q, a] of LLAMADAS) await negado(q, a);
});
await test('las piezas internas no se pueden llamar, ni siendo admin', async () => {
  for (const u of [NORMAL, ADMIN]) {
    await como('authenticated', u);
    for (const q of INTERNAS) await negado(q);
  }
});
await test('nada cambió tras los intentos negados', async () => {
  assert.equal(await uno("select count(*)::int from public.social_reports where status='open'"), 2);
  assert.equal(await uno("select count(*)::int from public.ai_reports where status='open'"), 2);
  assert.equal(await uno("select status from public.social_profile_reviews where user_id=$1", [MALO]), 'approved');
});
await test('la foto: el admin puede leerla, el resto no', async () => {
  await como('authenticated', ADMIN);
  assert.equal(await uno('select social_avatar_readable($1)', [MALO + '/a.jpg']), true);
  await como('authenticated', NORMAL);
  assert.equal(await uno('select social_avatar_readable($1)', [MALO + '/a.jpg']), false);
});
await test('la bandeja trae todo el contexto', async () => {
  await como('authenticated', ADMIN);
  const b = await uno('select admin_moderacion_bandeja()');
  assert.deepEqual(b.recuento, { denuncias_perfil: 2, denuncias_ia: 2, perfiles: 4, suspendidos: 0 });
  const d = b.denuncias_perfil.find((x) => x.id === R1);
  assert.equal(d.motivo_texto, 'Foto inapropiada');
  assert.equal(d.denunciante.nombre, 'Normal');
  assert.equal(d.denunciado.nombre, 'Insulto');
  assert.equal(d.mostrado.foto, MALO + '/a.jpg');
  assert.equal(d.mostrado.titulo, 'Título feo');
  const ia = b.denuncias_ia.find((x) => x.id === IA1);
  assert.equal(ia.texto, 'Deja de comer tres días');
  assert.equal(ia.motivo_texto, 'Consejo de salud peligroso');
  assert.equal(ia.origen_texto, 'Coach');
});
await test('descartar registra quién y cómo, y repetir no pisa', async () => {
  await como('authenticated', ADMIN);
  assert.deepEqual(await uno("select admin_moderacion_descartar('perfil',$1,'No infringe')", [R2]), { ok: true });
  assert.equal((await uno("select admin_moderacion_descartar('perfil',$1,'Otra')", [R2])).motivo, 'ya_cerrada');
  await como('postgres');
  const f = (await db.query('select status,resolved_at,resolution from public.social_reports where id=$1', [R2])).rows[0];
  assert.equal(f.status, 'dismissed');
  assert.ok(f.resolved_at);
  assert.match(f.resolution, new RegExp('^descartada · admin ' + ADMIN + ' · .* UTC · No infringe$'));
});
await test('resolver una denuncia de IA', async () => {
  await como('authenticated', ADMIN);
  assert.deepEqual(await uno("select admin_moderacion_resolver('ia',$1,null)", [IA1]), { ok: true });
  await como('postgres');
  assert.match(await uno('select resolution from public.ai_reports where id=$1', [IA1]), new RegExp('^resuelta · admin ' + ADMIN));
});
await test('si quien denunció borra su cuenta, responde sin romper', async () => {
  await db.query('insert into public.erasure_pending values($1)', [OWNER]);
  await como('authenticated', ADMIN);
  assert.equal((await uno("select admin_moderacion_descartar('ia',$1,'x')", [IA2])).motivo, 'borrado_pendiente');
  await como('postgres');
  await db.exec('delete from public.erasure_pending');
});
await test('tipo inválido y suspender sin motivo se rechazan', async () => {
  await como('authenticated', ADMIN);
  await assert.rejects(db.query("select admin_moderacion_descartar('x',$1,'a')", [R1]), { code: '22023' });
  await assert.rejects(db.query("select admin_moderacion_suspender($1,' ')", [MALO]), { code: '22023' });
});
let version;
await test('suspender oculta el perfil y cierra la denuncia que lo motivó', async () => {
  await como('authenticated', ADMIN);
  assert.deepEqual(await uno("select admin_moderacion_suspender($1,'Foto ofensiva',$2)", [MALO, R1]), { ok: true });
  await como('postgres');
  const r = (await db.query('select * from public.social_profile_reviews where user_id=$1', [MALO])).rows[0];
  assert.equal(r.status, 'suspended');
  assert.equal(r.approved_name, null);
  assert.equal(r.approved_avatar, null);
  assert.match(r.review_note, new RegExp('^suspendido · admin ' + ADMIN + ' .* Foto ofensiva$'));
  assert.equal(await uno('select status from public.social_reports where id=$1', [R1]), 'resolved');
});
await test('editar un perfil suspendido no borra el registro', async () => {
  const antes = await uno('select review_note from public.social_profile_reviews where user_id=$1', [MALO]);
  await db.query("update public.profiles set name='Otro nombre' where id=$1", [MALO]);
  const r = (await db.query('select * from public.social_profile_reviews where user_id=$1', [MALO])).rows[0];
  assert.equal(r.status, 'suspended');
  assert.equal(r.review_note, antes);
  assert.ok(r.reviewed_at);
  version = (await uno("select (select to_jsonb(updated_at) from public.social_profile_reviews where user_id=$1)", [MALO]));
});
await test('levantar exige la versión vista', async () => {
  await como('authenticated', ADMIN);
  assert.equal((await uno("select admin_moderacion_levantar($1,'2020-01-01','Ya corregido')", [MALO])).motivo, 'perfil_cambio');
  assert.deepEqual(await uno("select admin_moderacion_levantar($1,$2::timestamptz,'Ya corregido')", [MALO, version]), { ok: true });
  assert.equal((await uno("select admin_moderacion_levantar($1,$2::timestamptz,'Otra vez')", [MALO, version])).motivo, 'no_suspendido');
  await como('postgres');
  const r = (await db.query('select * from public.social_profile_reviews where user_id=$1', [MALO])).rows[0];
  assert.equal(r.status, 'approved');
  assert.equal(r.approved_name, 'Otro nombre');
  assert.match(r.review_note, /^suspensión levantada · admin /);
});
await test('marcar revisado saca el perfil de la cola, y un cambio posterior lo devuelve', async () => {
  await como('postgres');
  await db.query("update public.profiles set name='Nombre tres' where id=$1", [NORMAL]);
  const v = await uno('select to_jsonb(updated_at) from public.social_profile_reviews where user_id=$1', [NORMAL]);
  assert.equal(await uno('select review_note from public.social_profile_reviews where user_id=$1', [NORMAL]), 'auto');
  await como('authenticated', ADMIN);
  const cola = async () => (await uno('select admin_moderacion_bandeja()')).perfiles.map((p) => p.user_id);
  assert.ok((await cola()).includes(NORMAL));
  assert.equal((await uno("select admin_moderacion_marcar_revisado($1,'2020-01-01')", [NORMAL])).motivo, 'perfil_cambio');
  assert.deepEqual(await uno('select admin_moderacion_marcar_revisado($1,$2::timestamptz)', [NORMAL, v]), { ok: true });
  assert.ok(!(await cola()).includes(NORMAL));
  await como('postgres');
  await db.query("update public.profiles set name='Nombre cuatro' where id=$1", [NORMAL]);
  await como('authenticated', ADMIN);
  assert.ok((await cola()).includes(NORMAL));
});
await test('moderation_digest: solo service_role, detalle sin contenido y avisa a owner y admin', async () => {
  await db.exec(`update public.moderation_alert_state set last_alert_at = now()`);
  await new Promise((r) => setTimeout(r, 5));
  await db.query("insert into public.social_reports(reporter,subject,reason,displayed_name) values($1,$2,'avatar','SECRETO')", [NORMAL, MALO]);
  await como('authenticated', ADMIN);
  await negado('select moderation_digest()');
  await como('service_role', '');
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
  const d = await uno('select moderation_digest()');
  assert.equal(d.nuevos, 1);
  assert.equal(d.denuncias, 1);
  assert.equal(d.perfiles, 0);
  assert.deepEqual(d.detalle, { tipo: 'perfil', motivo: 'avatar' });
  assert.deepEqual([...d.owners].sort(), [ADMIN, OWNER].sort());
  assert.ok(!JSON.stringify(d).includes('SECRETO'));
  assert.equal((await uno('select moderation_digest()')).nuevos, 0);
});
console.log(`\n${n} pruebas superadas.`);
