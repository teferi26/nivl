// NIVL · Filtro de alias, títulos y fotos antes de que los vean otros (0143).
// Despliegue: supabase functions deploy perfil-filtro
import { adminClient } from '../_shared/db.ts';
import { callClaude } from '../_shared/anthropic.ts';
import { crearHandler } from './handler.ts';

Deno.serve(crearHandler({ admin: adminClient(), llamarModelo: callClaude }));
