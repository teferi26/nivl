// NIVL · Edge Function: EL COACH (punto de entrada).
//
// La lógica vive en handler.ts para que los tests de seguridad
// (`_shared/sec_coach_*_test.ts`) puedan ejercitarla entera con un backend
// simulado, sin desplegar ni llamar a ningún proveedor de IA real.
//
// Despliegue:
//   supabase functions deploy coach
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { handler } from './handler.ts';

Deno.serve(handler);
