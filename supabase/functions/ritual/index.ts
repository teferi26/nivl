// NIVL · Edge Function: LOS RITUALES (punto de entrada).
//
// La lógica vive en handler.ts para poder probarla con un backend simulado
// (`_shared/sec_coach_ritual_test.ts`).
//
// Despliegue:
//   supabase functions deploy ritual --no-verify-jwt
//   supabase secrets set RITUAL_SECRET=<cadena larga al azar>

import { handler } from './handler.ts';

Deno.serve(handler);
