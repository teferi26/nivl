// Local PostgreSQL/RLS tests. No network, credentials or production changes.
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(process.env.PGLITE_PACKAGE_ROOT || root, 'package.json'));
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage; create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('sub',auth.uid(),'role',auth.role()) $$;
create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,
  updated_at timestamptz default now(),metadata jsonb default '{}');
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
create publication supabase_realtime;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
grant all on all tables in schema storage to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
`);
const migrations = path.join(root, 'supabase/migrations');
for (const name of (await readdir(migrations)).filter(n => /^\d{4}.*\.sql$/.test(n) && +n.slice(0, 4) <= 31 && !n.startsWith('0010')).sort()) {
  try { await db.exec(await readFile(path.join(migrations, name), 'utf8')); }
  catch (e) { throw new Error(`Bootstrap ${name}: ${e.message}`, { cause: e }); }
}
const sql = await readFile(path.join(migrations, '0032_social_safety.sql'), 'utf8');
await db.exec(sql);
await db.exec(sql); // Re-executable without erasing decisions or reports.
await db.exec(await readFile(path.join(migrations, '0087_perfiles_sin_revision_previa.sql'), 'utf8'));
await db.exec(await readFile(path.join(migrations, '0143_filtro_perfiles.sql'), 'utf8'));
const A='10000000-0000-4000-8000-000000000001', B='20000000-0000-4000-8000-000000000002', C='30000000-0000-4000-8000-000000000003';
async function role(r,u='') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[u,r]);
  if (r!=='postgres') await db.exec('set role '+r);
}
async function scalar(sql,args=[]) { return Object.values((await db.query(sql,args)).rows[0])[0]; }
async function denied(sql,args=[]) {
  let error;
  try { await db.query(sql,args); } catch(e) { error=e; }
  assert.ok(error,'Expected server denial: '+sql);
  assert.ok(['42501','P0001','23503'].includes(error.code),error.code+': '+error.message);
}
let count=0;
async function test(name,fn) { await fn(); console.log('PASS',name); count++; }
async function approve(id,decision='approved') {
  await role('postgres');
  const p=(await db.query('select p.name,p.avatar_url,p.equipped_title,o.updated_at from profiles p left join storage.objects o on o.bucket_id=$2 and o.name=p.avatar_url where p.id=$1',[id,'avatars'])).rows[0];
  await role('service_role');
  await db.query('select social_review_profile($1,$2,$3,$4,$5,$6,$7)',[id,p.name,p.avatar_url,p.equipped_title,p.updated_at,decision,'Manual test decision']);
}
await db.query("insert into auth.users(id,email) values($1,'a@example.invalid'),($2,'b@example.invalid'),($3,'c@example.invalid')",[A,B,C]);
await db.query("insert into subscriptions(user_id,status,plan,provider) values($1,'active','owner','manual'),($2,'active','owner','manual'),($3,'active','owner','manual')",[A,B,C]);
await db.query("update profiles set name='Unreviewed user text',equipped_title='Unreviewed title',avatar_url=id::text||'/photo.jpg' where id=$1",[B]);
await db.query("insert into storage.objects(bucket_id,name,owner) values('avatars',$1,$2)",[B+'/photo.jpg',B]);
await db.query("insert into friendships(requester,addressee,status) values($1,$2,'accepted')",[A,B]);
const G=await scalar("insert into elite_groups(name,goal) values('Test ludus','general') returning id");
await db.query('insert into elite_group_members(group_id,user_id) values($1,$2),($1,$3),($1,$4)',[G,A,B,C]);

await test('Unreviewed UGC never leaves either ranking; own profile remains visible',async()=>{
  await role('authenticated',A);
  for (const fn of ['friends_board','elite_group_board']) {
    const row=(await db.query(`select * from ${fn}(7) where user_id=$1`,[B])).rows[0];
    assert.match(row.name,/^Gladiador /); assert.equal(row.avatar_url,null); assert.equal(row.equipped_title,null);
  }
  assert.equal(await scalar("select count(*)::int from storage.objects where name=$1",[B+'/photo.jpg']),0);
  await role('authenticated',B);
  assert.equal(await scalar('select name from friends_board(7) where is_me'),'Unreviewed user text');
  assert.equal(await scalar('select count(*)::int from storage.objects where name=$1',[B+'/photo.jpg']),1);
});
await test('Only administration can review or access reports/blocks/queue',async()=>{
  for (const who of ['anon','authenticated']) {
    await role(who,who==='authenticated'?A:'');
    for(const table of ['social_reports','social_blocks','social_profile_reviews','social_avatar_paths']) await denied('select * from '+table);
    await denied('select social_review_profile($1,null,null,null,null,$2,$3)',[B,'approved','bypass']);
  }
  await role('anon');
  for(const fn of ['social_blocked_users','friend_requests_safe']) await denied('select * from '+fn+'()');
  await denied('select social_block_user($1)',[B]);
  await denied('select social_report_user($1,$2)',[B,'avatar']);
});
await test('Snapshot approval publishes exact profile and ludus avatar without friendship',async()=>{
  await approve(B);
  for(const uid of [A,C]) {
    await role('authenticated',uid);
    const row=(await db.query('select * from elite_group_board(7) where user_id=$1',[B])).rows[0];
    assert.equal(row.name,'Unreviewed user text');assert.equal(row.avatar_url,B+'/photo.jpg');
    assert.equal(await scalar('select count(*)::int from storage.objects where name=$1',[B+'/photo.jpg']),1);
  }
});
await test('Editing title revokes approval and stale review cannot approve a changed profile',async()=>{
  await role('authenticated',B);await db.query("update profiles set equipped_title='New user content' where id=$1",[B]);
  await role('authenticated',A);assert.equal(await scalar('select equipped_title from friends_board(7) where user_id=$1',[B]),null);
  await role('service_role');await denied('select social_review_profile($1,$2,$3,$4,null,$5,$6)',[B,'Old name',B+'/photo.jpg','Unreviewed title','approved','stale review']);
  await approve(B);
});
await test('Avatar bytes are immutable even via service writes or delete/reupload',async()=>{
  await role('authenticated',B);
  await db.query("update storage.objects set metadata='{\"version\":2}',updated_at=now()+interval '1 second' where name=$1",[B+'/photo.jpg']);
  await role('postgres');assert.deepEqual(await scalar('select metadata from storage.objects where name=$1',[B+'/photo.jpg']),{});
  await role('service_role');await denied("update storage.objects set updated_at=now()+interval '1 second' where name=$1",[B+'/photo.jpg']);
  await role('authenticated',B);
  await db.query("insert into storage.objects(bucket_id,name,owner) values('avatars',$1,$2)",[B+'/replacement.jpg',B]);
  await db.query('delete from storage.objects where name=$1',[B+'/replacement.jpg']);
  await denied("insert into storage.objects(bucket_id,name,owner) values('avatars',$1,$2)",[B+'/replacement.jpg',B]);
  await db.query("insert into storage.objects(bucket_id,name,owner) values('avatars',$1,$2)",[B+'/new.jpg',B]);
  await db.query('update profiles set avatar_url=$1 where id=$2',[B+'/new.jpg',B]);
  await role('authenticated',A);
  assert.equal(await scalar('select avatar_url from friends_board(7) where user_id=$1',[B]),null);
  assert.equal(await scalar('select count(*)::int from storage.objects where name=$1',[B+'/new.jpg']),0);
  await role('authenticated',B);await db.query('update profiles set avatar_url=$1 where id=$2',[B+'/photo.jpg',B]);
  await approve(B);
});
await test('0143: two accounts, offensive alias never reaches the other one and only the server applies verdicts',async()=>{
  const antes=(await (async()=>{await role('postgres');return (await db.query('select name,equipped_title from profiles where id=$1',[B])).rows[0];})());
  await role('authenticated',B);await db.query("update profiles set name='H1tl3r' where id=$1",[B]);
  await role('postgres');assert.equal(await scalar('select nombre_estado from social_profile_reviews where user_id=$1',[B]),'rechazado');
  await role('authenticated',A);assert.match(await scalar('select name from friends_board(7) where user_id=$1',[B]),/^Gladiador /);
  assert.equal(await scalar('select equipped_title from friends_board(7) where user_id=$1',[B]),antes.equipped_title,'title stays published');
  await role('service_role');await scalar('select social_filtro_aplicar($1,$2,$3,null,$4,null,null)',[B,'H1tl3r',antes.equipped_title,'ok']);
  await role('authenticated',A);assert.match(await scalar('select name from friends_board(7) where user_id=$1',[B]),/^Gladiador /,'a rejected term cannot be approved by the filter');
  await role('authenticated',B);await denied('select social_filtro_aplicar($1,$2,null,null,$3,null,null)',[B,'x','ok']);
  await denied('select social_filtro_reservar($1,1)',[B]);
  await db.query('update profiles set name=$1 where id=$2',['Marco',B]);
  await role('authenticated',A);assert.match(await scalar('select name from friends_board(7) where user_id=$1',[B]),/^Gladiador /,'clean alias waits for the filter');
  await role('service_role');await scalar('select social_filtro_aplicar($1,$2,$3,null,$4,null,null)',[B,'stale',antes.equipped_title,'ok']);
  await role('authenticated',A);assert.match(await scalar('select name from friends_board(7) where user_id=$1',[B]),/^Gladiador /,'stale verdict is ignored');
  await role('service_role');await scalar('select social_filtro_aplicar($1,$2,$3,null,$4,null,null)',[B,'Marco',antes.equipped_title,'ok']);
  await role('authenticated',A);assert.equal(await scalar('select name from friends_board(7) where user_id=$1',[B]),'Marco');
  await role('authenticated',B);await db.query('update profiles set name=$1 where id=$2',[antes.name,B]);
  await approve(B);
});
await test('0143: a new photo stays hidden until the filter passes it and needs its own permission',async()=>{
  const F=B+'/filtro.jpg';
  await role('authenticated',B);
  await db.query("insert into storage.objects(bucket_id,name,owner) values('avatars',$1,$2)",[F,B]);
  await db.query('update profiles set avatar_url=$1 where id=$2',[F,B]);
  const p=async()=>{await role('postgres');return (await db.query('select name,equipped_title from profiles where id=$1',[B])).rows[0];};
  const q=await p();
  const visto=async()=>{await role('authenticated',A);return [await scalar('select avatar_url from friends_board(7) where user_id=$1',[B]),await scalar('select count(*)::int from storage.objects where name=$1',[F])];};
  assert.deepEqual(await visto(),[null,0]);
  await role('service_role');await scalar('select social_filtro_aplicar($1,$2,$3,$4,null,null,$5)',[B,q.name,q.equipped_title,F,'ok']);
  assert.deepEqual(await visto(),[null,0],'without permission an ok verdict goes to manual review');
  await role('postgres');assert.equal(await scalar('select foto_estado from social_profile_reviews where user_id=$1',[B]),'revision');
  await role('authenticated',A);await denied('select social_filtro_permitir_foto($1)',[F]);
  await role('authenticated',B);await scalar('select social_filtro_permitir_foto($1)',[F]);
  await role('service_role');await scalar('select social_filtro_aplicar($1,$2,$3,$4,null,null,$5)',[B,q.name,q.equipped_title,F,'revision']);
  assert.deepEqual(await visto(),[null,0],'a model failure keeps it hidden');
  await role('service_role');await scalar('select social_filtro_aplicar($1,$2,$3,$4,null,null,$5)',[B,q.name,q.equipped_title,F,'ok']);
  assert.deepEqual(await visto(),[F,1]);
  await role('authenticated',B);await db.query('update profiles set avatar_url=$1 where id=$2',[B+'/photo.jpg',B]);
  await approve(B);
});
await test('0143: the daily brake stops model calls for one person',async()=>{
  await role('service_role');
  let ok=0;for(let i=0;i<31;i++) if(await scalar('select social_filtro_reservar($1,10)',[C])) ok++;
  assert.equal(ok,30);
});
await test('0143: term list catches the obvious and leaves normal names alone',async()=>{
  await role('postgres');
  for(const t of ['H1TLER','hijo de puta','www.spam.com','llama 6001234567','@micuenta']) assert.equal(await scalar('select social_texto_prohibido($1)',[t]),true,t);
  for(const t of ['Disputa','Nazim','María José','Gladiador 7','Sangre de arena']) assert.equal(await scalar('select social_texto_prohibido($1)',[t]),false,t);
});
await test('Report persists approved snapshot, deduplicates and rejects invalid/self reports',async()=>{
  await role('authenticated',A);
  await scalar('select social_report_user($1,$2)',[B,'avatar']);
  await scalar('select social_report_user($1,$2)',[B,'avatar']);
  await denied('select social_report_user($1,$2)',[B,'arbitrary']);
  await denied('select social_report_user($1,$2)',[A,'name']);
  await role('postgres');
  assert.equal(await scalar('select count(*)::int from social_reports'),1);
  assert.equal(await scalar('select displayed_avatar from social_reports'),B+'/photo.jpg');
});
await test('Block removes friendship and enforces both directions across all social paths',async()=>{
  await role('authenticated',A);await scalar('select social_block_user($1)',[B]);
  for (const [uid,other] of [[A,B],[B,A]]) {
    await role('authenticated',uid);
    for(const fn of ['friends_board','elite_group_board']) assert.equal(await scalar(`select count(*)::int from ${fn}(7) where user_id=$1`,[other]),0);
    assert.equal(await scalar('select count(*)::int from elite_badges() where user_id=$1',[other]),0);
    assert.equal(await scalar('select count(*)::int from friendships'),0);
    assert.equal(await scalar('select count(*)::int from storage.objects where name=$1',[other+'/photo.jpg']),0);
    await role('postgres');const code=await scalar('select friend_code from profiles where id=$1',[other]);
    await role('authenticated',uid);assert.equal((await scalar('select friend_request($1)',[code])).ok,false);
  }
  await role('authenticated',A);assert.equal(await scalar('select count(*)::int from social_blocked_users()'),1);
  assert.equal(await scalar('select name from social_blocked_users() where user_id=$1',[B]),'Unreviewed user text'); // approved snapshot remains recognizable
  await role('authenticated',B);assert.equal(await scalar('select count(*)::int from social_blocked_users()'),0);
});
await test('Block works without friendship; unblocking cannot remove inverse block or restore friendship',async()=>{
  await role('authenticated',B);await scalar('select social_block_user($1)',[A]); // common ludus remains
  assert.equal(await scalar('select name from social_blocked_users() where user_id=$1',[A]),'Gladiador '+A.slice(0,6)); // unreviewed names stay hidden
  await role('authenticated',A);await scalar('select social_unblock_user($1)',[B]);
  assert.equal(await scalar('select count(*)::int from elite_group_board(7) where user_id=$1',[B]),0);
  await role('authenticated',B);await scalar('select social_unblock_user($1)',[A]);
  await role('authenticated',A);
  assert.equal(await scalar('select count(*)::int from friends_board(7) where user_id=$1',[B]),0);
  assert.equal(await scalar('select count(*)::int from elite_group_board(7) where user_id=$1',[B]),1);
});
await test('Pending requests expose safe identity, can be reported and disappear when blocked',async()=>{
  await role('postgres');const code=await scalar('select friend_code from profiles where id=$1',[B]);
  await role('authenticated',A);assert.equal((await scalar('select friend_request($1)',[code])).ok,true);
  await role('authenticated',B);
  const request=(await db.query('select * from friend_requests_safe()')).rows[0];
  assert.equal(request.user_id,A);assert.match(request.name,/^Gladiador /);
  await scalar('select social_report_user($1,$2)',[A,'harassment']);
  await scalar('select social_block_user($1)',[A]);
  assert.equal(await scalar('select count(*)::int from friend_requests()'),0);
  await denied('select friend_respond($1,true)',[request.friendship_id]);
});
await test('Suspension cannot be cleared by editing own name and is enforced for ludus',async()=>{
  await approve(B,'suspended');
  await role('authenticated',B);await db.query("update profiles set name='Changed after suspension' where id=$1",[B]);
  await role('authenticated',C);assert.equal(await scalar('select count(*)::int from elite_group_board(7) where user_id=$1',[B]),0);
  await role('postgres');assert.equal(await scalar('select status from social_profile_reviews where user_id=$1',[B]),'suspended');
});
await test('Account deletion cascades moderation, blocks and reports without leaking personal data',async()=>{
  await role('postgres');await db.query('delete from auth.users where id=$1',[B]);
  for(const sql of ['select count(*)::int from social_profile_reviews where user_id=$1','select count(*)::int from social_reports where subject=$1 or reporter=$1','select count(*)::int from social_blocks where blocker=$1 or blocked=$1']) assert.equal(await scalar(sql,[B]),0);
});
console.log(`${count} social safety SQL/RLS scenarios passed.`);
await db.close();
