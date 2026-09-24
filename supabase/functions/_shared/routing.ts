// NIVL · Qué modelo atiende cada turno y con quién se habla.
//
// Módulo PURO (sin Deno ni red): lo importa la función `coach` y también los
// tests de `src/lib/__tests__/routing.test.ts`.
//
// El mapa sale de `ai_plans.routes` (migración 0024), así que cambiar el
// modelo de un plan es un `update`, no un despliegue. El proveedor se deduce
// del NOMBRE del modelo: así Pro (DeepSeek) y Élite (Anthropic) conviven en la
// misma función a la vez, en vez de depender de un proveedor global.

export type Modo = 'estandar' | 'profundo';

/** Claves: 'default', un kind del coach (chat, brief…) o 'profundo'. */
export type Routes = Record<string, unknown>;

function nombre(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * El modelo del turno. En profundo manda `routes.profundo`; si no, el del kind,
 * el `default` del plan y, al final, lo que digan los secrets (`fallbackEnv`,
 * que es lo que usa el owner: su plan no fija modelo estándar).
 */
export function elegirModelo(
  routes: Routes | null | undefined,
  kind: string,
  modo: Modo,
  fallbackEnv: () => string,
): string {
  const r = routes && typeof routes === 'object' ? routes : {};
  if (modo === 'profundo') {
    const p = nombre(r.profundo);
    if (p) return p;
  }
  return nombre(r[kind]) ?? nombre(r.default) ?? fallbackEnv();
}

/** Anthropic para `claude-*`; cualquier otro, la API compatible de COACH_BASE_URL. */
export function proveedorDe(model: string): 'anthropic' | 'compat' {
  return model.trim().toLowerCase().startsWith('claude-') ? 'anthropic' : 'compat';
}

/** Lo que llega en la cabecera `x-nivl-mode`: solo 'profundo' exacto abre el bolsillo caro. */
export function modoDeCabecera(valor: string | null | undefined): Modo {
  return valor?.trim().toLowerCase() === 'profundo' ? 'profundo' : 'estandar';
}
