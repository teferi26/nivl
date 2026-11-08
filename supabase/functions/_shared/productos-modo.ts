// NIVL · Los productos del cobro por modos (0140), para las Edge Functions.
//
// Copia a propósito de `src/lib/planesmodo.ts`: el empaquetado de una Edge
// Function no sube nada de fuera de `supabase/`. El test de paridad
// (`src/lib/__tests__/planesmodo.test.ts`) avisa si divergen.

export const PRODUCTOS_MODO: readonly string[] = [
  'nivl_iron_mensual', 'nivl_iron_anual',
  'nivl_focus_mensual', 'nivl_focus_anual',
  'nivl_work_mensual', 'nivl_work_anual',
  'nivl_founder_mensual', 'nivl_founder_anual',
  'nivl_todos_mensual', 'nivl_todos_anual',
];

/**
 * El plan de un precio de Stripe. El precio lleva como `lookup_key` el id del
 * producto. Sin clave reconocible, null: es un precio antiguo o mal configurado
 * y quien llama conserva lo que ya hacía.
 */
export function planDeStripe(lookupKey: string | null | undefined): string | null {
  const id = (lookupKey ?? '').trim();
  return PRODUCTOS_MODO.includes(id) ? id.replace(/^nivl_/, '') : null;
}
