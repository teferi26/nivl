-- NIVL · 0109 · IRON Resistencia: infer_link reconoce brick, triatlón, tirada y ciclismo.
-- Huella: coalesce(obj_description(to_regprocedure('public.infer_link(text)'), 'pg_proc') like '%nivl:infer-link-0109%', false)
--
-- La 0019 ya reconocía natación y bici, salvo detrás de «entren…», que ganaba
-- como gimnasio: «Entreno de natación» lo saldaba una sesión de pesas. La rama
-- nueva va antes que la de gimnasio y solo con palabras inequívocas.
-- «Entreno de carrera» y «Entreno de piscina» son cardio; «carrera profesional» no.
--
-- Sigue siendo conservadora: «tirada» sola no enlaza (hay tiradas de cartas y
-- de libros), solo «tirada larga/corta/suave» o «tirada de N km».
--
-- Sin relleno: las misiones y reglas existentes conservan su `link`. Solo cambia
-- lo nuevo o lo renombrado. Efecto a saber: health_row() también consulta
-- infer_link, así que una misión antigua llamada «Triatlón» pasa a tratarse como
-- dato de salud (queda tras el permiso de salud, igual que las de cardio).
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
  'Deduce el acto que demuestra una misión o regla por su título. nivl:infer-link-0109';

commit;
