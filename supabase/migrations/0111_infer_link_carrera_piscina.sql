-- NIVL · 0111 · infer_link: «Entreno de carrera» y «Entreno de piscina» son cardio.
-- Huella: coalesce(obj_description(to_regprocedure('public.infer_link(text)'), 'pg_proc') like '%nivl:infer-link-0111%', false)
--
-- La 0109 arregló «Entreno de natación» y dejó carrera y piscina en la rama de
-- gimnasio: esa misión la saldaba una sesión de pesas. «Carrera profesional» se
-- excluye: no es un entreno de correr. Sin relleno, como la 0109.
begin;

create or replace function public.infer_link(p_title text)
returns text
language sql
immutable
as $$
  select case
    when p_title ~* '(venta|pitch|llamada)' then 'ninguno'
    when p_title ~* '(\mbrick\M|\mtriatl[oó]n\M|\mciclismo\M|\mtirada\s+(larga|corta|suave|de\s+[0-9]+([.,][0-9]+)?\s*(km|kil[oó]metros)\M)|\mentren\w*\s+(de\s+|en\s+)?(nataci[oó]n|\mbici|\mnadar\M|\mcorrer\M|\mrunning\M|\mpiscina\M|\mcarrera\M(?!\s+profesional)))' then 'cardio'
    when p_title ~* '(\mgym\M|gimnasio|\mentren|\mpesas\M|\mpush\M|\mpull\M|\mlegs\M)' then 'gym'
    when p_title ~* '(\mcorrer\M|\mcardio\M|aer[oó]bic|\mnadar\M|nataci[oó]n|\mbici|\mz2\M)' then 'cardio'
    when p_title ~* '(\mpesar(se|me)?\M|b[aá]scula|peso corporal)' then 'peso'
    when p_title ~* '(^diario|diario del d[ií]a|escribir (en )?(el )?diario|reporte nocturno|\mjournal\M)' then 'diario'
    when p_title ~* '(registrar (las )?comidas|\mdieta\M|nutrici[oó]n|\mmacros\M|\mkcal\M|calor[ií]as)' then 'nutricion'
    else 'ninguno'
  end
$$;

-- Conserva la marca de la 0109: su huella la busca en este mismo comentario.
comment on function public.infer_link(text) is
  'Deduce el acto que demuestra una misión o regla por su título. nivl:infer-link-0109 nivl:infer-link-0111';

commit;
