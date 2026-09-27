// NIVL · Clientes de Supabase para las Edge Functions.
//
// El proyecto no genera tipos de la base de datos, así que el esquema se deja
// explícitamente en `any`. Sin esto, supabase-js resuelve las tablas a `never`
// y cualquier insert o update no compila.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// deno-lint-ignore no-explicit-any
export type Db = SupabaseClient<any, 'public', any>;

/**
 * Cliente con la service role: solo para validar el JWT y para trabajos del
 * servidor (cron). Se salta RLS, así que nunca debe usarse para ejecutar lo
 * que pida el modelo.
 */
export function adminClient(healthRevision?: number): Db {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    healthRevision === undefined ? undefined : { global: { headers: { 'x-nivl-health-revision': String(healthRevision) } } },
  ) as Db;
}

/**
 * Cliente con el JWT del usuario: RLS sigue aplicando. Es el que ejecuta las
 * herramientas del coach, de modo que el modelo no puede alcanzar datos que
 * su dueño no podría alcanzar.
 */
export function userClient(token: string, healthRevision?: number): Db {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}`,
      ...(healthRevision === undefined ? {} : { 'x-nivl-health-revision': String(healthRevision) }),
    } } },
  ) as Db;
}
