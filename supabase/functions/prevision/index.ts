// NIVL · Edge Function: previsión (punto de entrada). La lógica, en handler.ts.
//
// Despliegue (pendiente del OK del dueño; la 0106 va ANTES):
//   supabase functions deploy prevision
// Con verificación de JWT (no lleva --no-verify-jwt). Secret opcional:
// OPEN_METEO_API_KEY, necesario para uso comercial de Open-Meteo.

import { crearHandler } from './handler.ts';

Deno.serve(crearHandler());
