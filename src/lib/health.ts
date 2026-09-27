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
    ? 'El texto ha cambiado. Actualiza NIVL para revisarlo.'
    : data?.reason === 'borrado_pendiente' ? 'Termina el borrado pendiente antes de volver a activar salud.' : 'No se ha podido guardar el permiso.');
}
export async function requireHealthConsent() {
  if (!(await fetchHealthConsent()).accepted) throw new ErrorVisible('Activa el permiso de salud en Perfil antes de utilizar este registro.');
}
export async function withdrawAndEraseHealth() {
  const { data, error } = await supabase.functions.invoke('health-erasure', { body: { confirm: 'BORRAR_SALUD_DIARIO_FOTOS_COACH' } });
  if (error || data?.ok !== true) throw new ErrorVisible('El borrado no ha terminado. Los datos quedan bloqueados cuando se registra la retirada. Puedes comprobarlo y reintentar desde Perfil.');
}
