// NIVL · Lista de espera. Desplegar con --no-verify-jwt (la web no tiene sesión).
// Requiere la migración 0054 (waitlist_join, solo service_role).
import { adminClient } from '../_shared/db.ts';
import { esperaHandler, type ResultadoAlta } from './handler.ts';

const db = adminClient();

Deno.serve(esperaHandler(async (email, version, origen, ip) => {
  const { data, error } = await db.rpc('waitlist_join', {
    p_email: email,
    p_consent_version: version,
    p_source: origen,
    p_ip: ip,
  });
  if (error) throw new Error(error.message);
  if (data !== 'ok' && data !== 'correo' && data !== 'frenado') throw new Error('respuesta inesperada');
  return data as ResultadoAlta;
}));
