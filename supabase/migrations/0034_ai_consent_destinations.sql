-- Correct the disclosed Anthropic processing destinations. Existing acceptance
-- must not silently count as acceptance of materially expanded information.
-- No history is deleted and provider routing is unchanged.
begin;
create or replace function public.ai_consent_version()
returns text language sql immutable as $$ select '2026-09-29'::text $$;
revoke all on function public.ai_consent_version() from public, anon;
grant execute on function public.ai_consent_version() to authenticated, service_role;
-- Stable migration fingerprint survives later CREATE OR REPLACE version bumps.
comment on function public.ai_consent_version() is 'Current AI disclosure version; nivl:consent-destinations-20260929';
notify pgrst, 'reload schema';
commit;
