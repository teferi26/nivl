// NIVL · Edge Function: Oráculo premium (punto de entrada).
//
// La lógica vive en handler.ts para poder probarla con un backend simulado.
//
// Despliegue:
//   supabase functions deploy oracle
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { handler } from './handler.ts';

Deno.serve(handler);
