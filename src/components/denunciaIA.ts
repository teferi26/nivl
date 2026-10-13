// NIVL · Denunciar una respuesta de la IA (requisito de Google Play para IA
// generativa). Lógica pura, sin Supabase, para poder testearla: motivos, el
// recorte del extracto y el correo de respaldo mientras no exista la RPC.
//
// Contrato con el Chat 3 (seguridad y datos):
//   supabase.rpc('report_ai_message', { p_source, p_message_id, p_reason, p_excerpt })
// El extracto es el texto de la burbuja (el Oráculo no guarda mensajes en el
// servidor). Si la RPC aún no existe, el respaldo es un correo a soporte con
// el id y el motivo, SIN el contenido.

import { t } from '@/i18n';

export type FuenteIA = 'coach' | 'oraculo';
export type MotivoIA = 'danino' | 'salud' | 'dinero' | 'incorrecto' | 'ofensivo' | 'otro';

/** Los motivos, en orden. El texto es `etiquetaMotivo(value)`. */
export const MOTIVOS_IA: { value: MotivoIA }[] = [
  { value: 'danino' },
  { value: 'salud' },
  { value: 'dinero' },
  { value: 'incorrecto' },
  { value: 'ofensivo' },
  { value: 'otro' },
];

/** El nombre de un motivo, en el idioma de la interfaz. */
export function etiquetaMotivo(motivo: MotivoIA): string {
  return t(`puertas:denuncia.motivos.${motivo}`);
}

export const MAX_EXTRACTO = 2000;
export const CORREO_SOPORTE = 'teferilaforga@gmail.com';

/** El extracto que viaja con la denuncia: sin espacios sobrantes y con tope. */
export function extractoDenuncia(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ').slice(0, MAX_EXTRACTO);
}

/** ¿El error dice que la función aún no existe en el servidor? */
export function faltaLaRpc(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  return /could not find the function|does not exist/i.test(error.message ?? '');
}

/** El correo de respaldo: id y motivo, nunca el contenido de la respuesta. */
export function correoDenuncia(
  fuente: FuenteIA,
  motivo: MotivoIA,
  messageId: string | null,
  contexto?: string,
): string {
  const asunto = encodeURIComponent(t('puertas:denuncia.correo.asunto'));
  const cuerpo = encodeURIComponent(
    [
      t('puertas:denuncia.correo.origen', { origen: t(`puertas:denuncia.correo.fuente.${fuente}`) }),
      t('puertas:denuncia.correo.motivo', { motivo: etiquetaMotivo(motivo) }),
      t('puertas:denuncia.correo.mensaje', { id: messageId ?? t('puertas:denuncia.correo.sinId') }),
      // Sin id de servidor (respuesta recién llegada), el hilo y la hora la localizan.
      ...(contexto ? [t('puertas:denuncia.correo.contexto', { contexto })] : []),
    ].join('\n'),
  );
  return `mailto:${CORREO_SOPORTE}?subject=${asunto}&body=${cuerpo}`;
}
