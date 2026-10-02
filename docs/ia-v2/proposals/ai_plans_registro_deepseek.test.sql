create temp table antes as select plan, routes from public.ai_plans;
update public.ai_plans
   set routes = jsonb_set(coalesce(routes, '{}'::jsonb), '{registro}', '"deepseek-v4-flash"'::jsonb, true)
 where plan in ('pro_mensual', 'pro_anual', 'mensual', 'anual', 'cortesia');
select
  (select count(*) from public.ai_plans where plan in ('pro_mensual','pro_anual','mensual','anual','cortesia') and routes->>'registro' = 'deepseek-v4-flash') as pro_con_registro_5,
  (select bool_and((p.routes - 'registro') = (a.routes - 'registro')) from public.ai_plans p join antes a using (plan)) as resto_de_routes_intacto,
  (select bool_and(p.routes = a.routes) from public.ai_plans p join antes a using (plan) where p.plan not in ('pro_mensual','pro_anual','mensual','anual','cortesia')) as elite_y_owner_intactos,
  (select jsonb_object_agg(plan, routes) from public.ai_plans where plan in ('pro_mensual','cortesia')) as muestra;
