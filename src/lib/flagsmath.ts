// NIVL · Interruptores del servidor (puro, con test).
//
// Los lee `app_flags()` (migración 0067 del equipo servidor, tabla
// `app_config` con `public = true`). Aquí solo vive la forma y la regla de
// oro del contrato de Modos F1: TODO APAGADO por defecto, y cualquier valor
// raro o ausente cuenta como apagado. Un interruptor solo se enciende con un
// `true` de verdad (ni "true", ni 1).
//
// Los efectos (RPC, caché en memoria y en el teléfono, refresco al volver a
// primer plano) están en flags.ts.

export interface Flags {
  /** Modos (IRON, FOCUS, WORK, FOUNDER): selector en Hoy, etiquetas, onboarding y niveles por modo. */
  modos_activos: boolean;
  /** Paso de idioma en el onboarding (y el resto de la interfaz traducida). */
  idiomas_activos: boolean;
  /** Prueba automática al registrarse (la decide el servidor). */
  prueba_auto_activa: boolean;
  prueba_auto_dias: number;
  prueba_ia_mensajes_dia: number;
  /** Petición de valoración en la tienda. */
  valoracion_activa: boolean;
}

/** Lo que vale todo mientras no se sabe, si la RPC no existe o si falla. */
export const FLAGS_APAGADOS: Readonly<Flags> = Object.freeze({
  modos_activos: false,
  idiomas_activos: false,
  prueba_auto_activa: false,
  prueba_auto_dias: 2,
  prueba_ia_mensajes_dia: 20,
  valoracion_activa: false,
});

const BOOLEANOS = ['modos_activos', 'idiomas_activos', 'prueba_auto_activa', 'valoracion_activa'] as const;
const NUMEROS = ['prueba_auto_dias', 'prueba_ia_mensajes_dia'] as const;

/**
 * De lo que devuelve `app_flags()` (un objeto jsonb) a `Flags`. Cualquier cosa
 * que no sea un objeto da todo apagado; cada clave que no tenga su tipo
 * exacto se queda con el valor apagado.
 */
export function normalizarFlags(raw: unknown): Flags {
  const out: Flags = { ...FLAGS_APAGADOS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  for (const k of BOOLEANOS) out[k] = r[k] === true;
  for (const k of NUMEROS) {
    const v = r[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  return out;
}

/** ¿Dos lecturas dicen lo mismo? (para no avisar a los oyentes en balde). */
export function mismosFlags(a: Flags, b: Flags): boolean {
  return (Object.keys(FLAGS_APAGADOS) as (keyof Flags)[]).every((k) => a[k] === b[k]);
}

/**
 * ¿El fallo de la RPC dice que la función no existe? (PostgREST PGRST202 o
 * Postgres 42883.) Entonces el servidor aún no tiene interruptores: apagado y
 * se olvida la caché. Cualquier otro fallo (sin red) deja lo último leído.
 */
export function faltaLaFuncion(error: { code?: string | null } | null | undefined): boolean {
  const code = error?.code ?? '';
  return code === 'PGRST202' || code === '42883';
}
