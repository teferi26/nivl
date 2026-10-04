-- NIVL · PROPUESTA (NIVL - Seguridad, 04/10/2026) — número y huella del coordinador. Toca ai_status (0024, terreno de
-- Probada en producción con BEGIN…ROLLBACK (04/10/2026): pro → vision=false, elite → true, owner → true, free → false; sin la clave routes; grants intactos.
-- NIVL - Compras): revisada con él antes de aplicar.
-- Huella sugerida: coalesce(obj_description('public.ai_status()'::regprocedure,'pg_proc') like '%nivl:ai-status-vision%', false)
--
-- ai_status añade `vision` (boolean): ¿el coach de este plan ve fotos? Lo decide el MISMO criterio que el servidor
-- (coach/guard.ts fotosSinVision + routing.proveedorDe): el modelo de la ruta 'default' del plan empieza por
-- 'claude-'; sin 'default' se usa COACH_MODEL, que es Claude. Sin plan (entitled=false): false.
-- Las rutas siguen sin salir al cliente (se quitan como antes). Aditiva: solo añade una clave.

create or replace function public.ai_status()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with s as (select public.ai_state(auth.uid()) as j)
  select (s.j - 'routes') || jsonb_build_object('vision',
    coalesce((s.j->>'entitled')::boolean, false)
    and coalesce(lower(nullif(btrim(s.j->'routes'->>'default'), '')), 'claude-') like 'claude-%')
  from s;
$$;
comment on function public.ai_status() is
  'nivl:ai-status-vision — estado de IA del usuario sin rutas; vision = el coach de su plan ve fotos (modelo Claude).';
