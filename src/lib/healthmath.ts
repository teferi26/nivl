// Purpose/version kept independent from age and the permission to send to AI.
export const HEALTH_CONSENT_VERSION = '2026-09-27-salud-v1';
export interface HealthConsent {
  accepted: boolean;
  revision: number;
  erasurePending: boolean;
}
export function readHealthConsent(value: unknown): HealthConsent {
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    accepted: v.accepted === true && v.version === HEALTH_CONSENT_VERSION && v.current_version === HEALTH_CONSENT_VERSION && v.erasure_pending !== true,
    revision: typeof v.revision === 'number' && Number.isSafeInteger(v.revision) && v.revision >= 0 ? v.revision : 0,
    erasurePending: v.erasure_pending === true,
  };
}
export const HEALTH_COPY = {
  title: 'Tus datos de salud',
  purpose: 'Con tu permiso, NIVL guarda y utiliza tu peso, ficha física, entrenamientos, alimentación y diario de bienestar para mostrar tu evolución y ofrecerte las funciones del coach. El diario, las fotos, los planes, su memoria y los registros que crea o modifica el coach pueden mezclar salud con otros datos.',
  storage: 'El responsable es Teferi Samuel Laforga Ena (teferilaforga@gmail.com). Los datos se alojan en Supabase, en Frankfurt. Este permiso no activa la IA ni autoriza por sí solo envíos a sus proveedores: el coach pide un consentimiento separado.',
  choice: 'Es opcional. Sin aceptarlo puedes seguir con hábitos generales, campañas, metas generales y economía. El coach y el oráculo requieren este permiso porque su conversación e historial pueden incluir datos de salud.',
  withdrawal: 'Puedes retirar este permiso desde Perfil y borrar los datos identificados como salud, TODO el diario, las fotos, la memoria y los registros marcados por el coach. Antes podrás exportarlos. Se conservan tus puntos, los importes y cuentas de Economía y los registros generales sin esas marcas. En Economía se retiran las anotaciones y se desactivan las reglas automáticas marcadas como texto de IA. El texto general anterior que no esté identificado como salud no se borra automáticamente.',
  checkbox: 'Consiento explícitamente que NIVL guarde y utilice mis datos de salud para estas finalidades.',
  erase: 'Se eliminarán tu ficha física, peso, entrenamiento, alimentación, metas físicas, objetivos y cartas marcados como salud, hábitos y reglas físicos con sus registros, TODO el diario y sus fotos, fotos de misiones, conversaciones, memoria, resúmenes y planes. También los hábitos, reglas, campañas, agenda, compras y metas creados o modificados por el coach y marcados como contenido mixto. Pueden mezclar salud con otros datos: se elimina el registro completo. En Economía se retiran las anotaciones y se desactivan las reglas automáticas marcadas como texto de IA; se conservan las cuentas, movimientos e importes. Tus puntos y los registros generales sin marcas de salud o del coach se conservan. El texto general anterior no identificado como salud no se borra automáticamente. Exporta antes si quieres una copia. Esta acción no se puede deshacer.',
} as const;
export const HEALTH_ROUTES = new Set(['gym', 'cardio', 'dieta', 'nutricion', 'diario', 'archivo', 'memoria', 'resumen', 'coach', 'oraculo', 'informe', 'fotos']);
