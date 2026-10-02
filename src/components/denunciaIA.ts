// NIVL · Denunciar una respuesta de la IA (requisito de Google Play para IA
// generativa). Lógica pura, sin Supabase, para poder testearla: motivos, el
// recorte del extracto y el correo de respaldo mientras no exista la RPC.
//
// Contrato con el Chat 3 (seguridad y datos):
//   supabase.rpc('report_ai_message', { p_source, p_message_id, p_reason, p_excerpt })
// El extracto es el texto de la burbuja (el Oráculo no guarda mensajes en el
// servidor). Si la RPC aún no existe, el respaldo es un correo a soporte con
// el id y el motivo, SIN el contenido.

export type FuenteIA = 'coach' | 'oraculo';
export type MotivoIA = 'danino' | 'salud' | 'dinero' | 'incorrecto' | 'ofensivo' | 'otro';

export const MOTIVOS_IA: { value: MotivoIA; label: string }[] = [
  { value: 'danino', label: 'Puede hacer daño' },
  { value: 'salud', label: 'Consejo de salud peligroso' },
  { value: 'dinero', label: 'Consejo de dinero peligroso' },
  { value: 'incorrecto', label: 'Información falsa' },
  { value: 'ofensivo', label: 'Ofensivo o inapropiado' },
  { value: 'otro', label: 'Otro motivo' },
];

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
export function correoDenuncia(fuente: FuenteIA, motivo: MotivoIA, messageId: string | null): string {
  const asunto = encodeURIComponent('Denuncia de respuesta de IA · NIVL');
  const cuerpo = encodeURIComponent(
    [
      `Origen: ${fuente === 'coach' ? 'coach' : 'Oráculo'}`,
      `Motivo: ${MOTIVOS_IA.find((m) => m.value === motivo)?.label ?? motivo}`,
      `Mensaje: ${messageId ?? 'sin identificador'}`,
    ].join('\n'),
  );
  return `mailto:${CORREO_SOPORTE}?subject=${asunto}&body=${cuerpo}`;
}
