import { t } from '@/i18n';
import { registroVivo } from './textosVivos';
// Purpose/version kept independent from age and the permission to send to AI.
export const HEALTH_CONSENT_VERSION = '2026-09-27-salud-v1';
export interface HealthConsent {
  accepted: boolean;
  revision: number;
  /** HealthKit, GPS y reloj: se activan aparte y el permiso antiguo no los enciende (0111). */
  medicionActiva: boolean;
  erasurePending: boolean;
}
export function readHealthConsent(value: unknown): HealthConsent {
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    accepted: v.accepted === true && v.version === HEALTH_CONSENT_VERSION && v.current_version === HEALTH_CONSENT_VERSION && v.erasure_pending !== true,
    revision: typeof v.revision === 'number' && Number.isSafeInteger(v.revision) && v.revision >= 0 ? v.revision : 0,
    medicionActiva: v.medicion_activa === true,
    erasurePending: v.erasure_pending === true,
  };
}
/** Titular del tratamiento: fuera del catálogo para no repetirlo en seis idiomas. */
const RESPONSABLE = 'Teferi Samuel Laforga Ena';

const CLAVES_SALUD = ['title', 'purpose', 'storage', 'choice', 'withdrawal', 'checkbox', 'erase'] as const;

export const HEALTH_COPY = registroVivo(CLAVES_SALUD, (c) =>
  c === 'storage' ? t('legal:salud.storage', { responsable: RESPONSABLE }) : t(`legal:salud.${c}` as 'legal:salud.title'),
);
export const HEALTH_ROUTES = new Set(['gym', 'cardio', 'dieta', 'nutricion', 'diario', 'archivo', 'memoria', 'resumen', 'coach', 'oraculo', 'informe', 'fotos', 'salud-conexion', 'entreno-gps']);

/**
 * La siguiente `epoch` del consentimiento: la llave que remonta el contenido de
 * una ruta cuando cambian la cuenta, el «sí» o la revisión, para que no quede
 * nada de salud a la vista.
 *
 * La PRIMERA lectura tras entrar (`anterior.uid` null) no es un cambio: no había
 * nada de otra cuenta que borrar. Remontar ahí tiraba los navegadores recién
 * montados y, si la lectura llegaba después de pintar, una URL directa a una
 * pestaña de mundo acababa en otra (React Navigation limpia el estado anidado).
 */
export function siguienteEpoch(
  anterior: { uid: string | null; value: { accepted: boolean; revision: number; epoch: number } },
  uid: string,
  lectura: { accepted: boolean; revision: number } | null,
): number {
  if (anterior.uid === null) return anterior.value.epoch;
  const cambio = lectura === null || anterior.uid !== uid || anterior.value.accepted !== lectura.accepted || anterior.value.revision !== lectura.revision;
  return anterior.value.epoch + (cambio ? 1 : 0);
}
