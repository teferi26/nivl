import { t } from '@/i18n';
import { HEALTH_CONSENT_VERSION, readHealthConsent } from './healthmath';
import { supabase } from './supabase';
import { ErrorVisible } from './validation';
export * from './healthmath';

export async function fetchHealthConsent() {
  const { data, error } = await supabase.rpc('my_health_consent');
  if (error) throw error;
  return readHealthConsent(data);
}
export async function acceptHealthConsent() {
  const { data, error } = await supabase.rpc('accept_health_consent', { p_version: HEALTH_CONSENT_VERSION });
  if (error) throw error;
  if (data?.ok !== true) throw new ErrorVisible(data?.reason === 'version_obsoleta'
    ? t('legal:errores.versionObsoleta')
    : data?.reason === 'borrado_pendiente' ? t('legal:errores.borradoPendiente') : t('legal:errores.noGuardado'));
}
/** Una vez por concesión del permiso, tras explicar qué se lee y para qué. */
export async function aceptarMedicion() {
  const { data, error } = await supabase.rpc('activar_medicion');
  if (error) throw error;
  if (data?.ok !== true) throw new Error('activar_medicion');
}
export async function requireHealthConsent() {
  if (!(await fetchHealthConsent()).accepted) throw new ErrorVisible(t('legal:errores.activaSalud'));
}
export async function withdrawAndEraseHealth() {
  const { data, error } = await supabase.functions.invoke('health-erasure', { body: { confirm: 'BORRAR_SALUD_DIARIO_FOTOS_COACH' } });
  if (error || data?.ok !== true) throw new ErrorVisible(t('legal:errores.borradoIncompleto'));
}
