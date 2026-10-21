// NIVL · Edge Function: economía de WORK (punto de entrada).
//
// La lógica vive en handler.ts para poder probarla con un backend simulado.
//
// Despliegue (pendiente del OK del dueño; la 0075 va ANTES):
//   supabase functions deploy economia
// Usa los secrets que ya tiene el proyecto (ANTHROPIC_API_KEY, SUPABASE_*).

import { crearHandler } from './handler.ts';

Deno.serve(crearHandler());
