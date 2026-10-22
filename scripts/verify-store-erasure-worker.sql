-- ROOT ONLY: manual worker smoke test; may process real queued erasures.
-- Run through the existing protected Management SQL helper, not a shell with secrets.
-- Result contains ONLY request_id. Never SELECT decrypted_secret.
do $$ begin
  if not exists (select 1 from vault.decrypted_secrets
    where name='nivl_ritual_secret' and length(decrypted_secret)>0)
    or not exists (select 1 from vault.decrypted_secrets
      where name='nivl_project_url'
        and rtrim(decrypted_secret,'/')='https://dueyufxxkiixdxighpaz.supabase.co') then
    raise exception 'Vault worker configuration missing or wrong target';
  end if;
end $$;
select net.http_post(
  url := 'https://dueyufxxkiixdxighpaz.supabase.co/functions/v1/store-erasure-cleanup',
  headers := jsonb_build_object('content-type','application/json','x-ritual-secret',
    (select decrypted_secret from vault.decrypted_secrets where name='nivl_ritual_secret')),
  body := '{}'::jsonb,
  timeout_milliseconds := 120000
) as request_id;

-- Separate subsequent query after the POST transaction commits:
-- Replace REQUEST_ID with the returned integer. A missing row is still pending.
-- Do not output request headers, queue UUIDs, Vault values or raw response bodies.
-- select id,status_code,timed_out,error_msg is not null as transport_error,
--   case when status_code=200 then (content::jsonb->>'ok')::boolean else null end as worker_ok
-- from net._http_response where id=REQUEST_ID;
-- HTTP200 + worker_ok=true is required before scheduling.
-- HTTP401: mismatch of Edge RITUAL_SECRET/Vault or gateway verify_jwt setting.
-- HTTP503: provider/RPC/lease work failed; inspect safe aggregate diagnostics.
-- Only after success, Root: node scripts/setup-store-erasure-cleanup.mjs --apply

-- Read-only cron postcondition after setup:
-- select jobname,schedule,active,
--   command='select public.dispatch_store_erasure_cleanup();' as expected_command
-- from cron.job where jobname='nivl-store-erasure-cleanup';
