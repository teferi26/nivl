-- PROPUESTA (Chat 3 · subagente a «RLS y auth»). NO es una migración aplicada.
-- Test: docs/security-audit/proposals/a-02_truncate_y_higiene.test.sql
--
-- A-05 (P2): TRUNCATE concedido a anon/authenticated en 47 tablas de public y
-- en las futuras (pg_default_acl). TRUNCATE no pasa por la RLS: hoy PostgREST
-- no lo expone, pero cualquier vía futura de SQL con esos roles vaciaría la
-- tabla de todos los usuarios. La 0035 lo quita solo de profiles y completions.
-- Higiene: handle_new_user (función de trigger) era ejecutable por anon.
-- Compatibilidad: ningún cliente usa TRUNCATE ni llama a handle_new_user.
begin;

revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate on tables from anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

commit;
