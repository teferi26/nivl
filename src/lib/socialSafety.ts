/** Closed report vocabulary; the server validates the same values. */
export const REPORT_REASONS = [
  { value: 'name', label: 'Nombre o título ofensivo' },
  { value: 'avatar', label: 'Foto inapropiada' },
  { value: 'harassment', label: 'Acoso o amenazas' },
  { value: 'impersonation', label: 'Suplantación de identidad' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

export function isReportReason(value: unknown): value is ReportReason {
  return REPORT_REASONS.some((reason) => reason.value === value);
}

export const SOCIAL_SUPPORT_URL = 'https://nivl-web.vercel.app/soporte';
