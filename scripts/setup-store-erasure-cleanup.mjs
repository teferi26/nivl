// Reviewable setup for durable provider cleanup. Default prints SQL only.
// Apply ONLY after migrations 0063/0064, worker deployment and approval:
// node scripts/setup-store-erasure-cleanup.mjs --apply
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readToken } from './token.mjs';

const setupSql = `
begin;
do $$ begin
  if not exists(select 1 from pg_extension where extname='pg_cron')
     or not exists(select 1 from pg_extension where extname='pg_net')
     or to_regclass('vault.decrypted_secrets') is null
     or to_regprocedure('public.claim_store_erasure_cleanup(integer)') is null then
    raise exception 'Missing cleanup migration, pg_cron, pg_net or Vault';
  end if;
  if not exists(select 1 from vault.decrypted_secrets where name='nivl_ritual_secret')
     or not exists(select 1 from vault.decrypted_secrets where name='nivl_project_url') then
    raise exception 'Missing cleanup scheduler Vault references';
  end if;
end $$;
create or replace function public.dispatch_store_erasure_cleanup() returns bigint
language plpgsql security definer set search_path=public as $$
declare secret text; project_url text; request_id bigint;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name='nivl_ritual_secret';
  select decrypted_secret into project_url from vault.decrypted_secrets where name='nivl_project_url';
  if secret is null or project_url is null then
    raise exception 'Cleanup scheduler is missing Vault references';
  end if;
  select net.http_post(
    url:=rtrim(project_url,'/')||'/functions/v1/store-erasure-cleanup',
    headers:=jsonb_build_object('content-type','application/json','x-ritual-secret',secret),
    body:='{}'::jsonb, timeout_milliseconds:=120000
  ) into request_id;
  return request_id;
end $$;
revoke all on function public.dispatch_store_erasure_cleanup() from public,anon,authenticated,service_role;
select cron.unschedule('nivl-store-erasure-cleanup')
where exists(select 1 from cron.job where jobname='nivl-store-erasure-cleanup');
select cron.schedule('nivl-store-erasure-cleanup','*/15 * * * *','select public.dispatch_store_erasure_cleanup();');
commit;
`;

if (!process.argv.includes('--apply')) {
  console.log(setupSql);
} else {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const localEnv = {};
  try {
    for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (match) localEnv[match[1]] = match[2].trim();
    }
  } catch { /* environment can be provided by the caller */ }
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? localEnv.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/)?.[1];
  const token = readToken(root);
  if (!ref || !token) throw new Error('Missing project reference or management token.');
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: setupSql }),
    signal: AbortSignal.timeout(30_000),
  });
  // Do not print remote response bodies or Vault secret values.
  if (!response.ok) throw new Error(`Cleanup scheduler setup failed (${response.status}).`);
  console.log('Cleanup scheduler configured every 15 minutes.');
}
