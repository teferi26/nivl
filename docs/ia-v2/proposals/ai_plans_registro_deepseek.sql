-- UPDATE de datos (no migración): la ruta estrecha de Pro y la prueba va por DeepSeek.
-- Coherente con su consentimiento de IA («DeepSeek: NIVL Pro y la prueba de 7 días») y sin
-- depender del saldo de Anthropic. Élite y owner NO se tocan (su consentimiento es Anthropic).
-- Lo ejecuta el coordinador. Test: ai_plans_registro_deepseek.test.sql (en rollback).
update public.ai_plans
   set routes = jsonb_set(coalesce(routes, '{}'::jsonb), '{registro}', '"deepseek-v4-flash"'::jsonb, true)
 where plan in ('pro_mensual', 'pro_anual', 'mensual', 'anual', 'cortesia');
