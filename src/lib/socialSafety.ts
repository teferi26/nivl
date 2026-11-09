import { t } from '@/i18n';
import { conTextos } from './textosVivos';

const reason = <V extends string>(value: V) =>
  conTextos({ value }, { label: () => t(`amigos:seguridad.motivos.${value}` as 'amigos:seguridad.motivos.name') });

/** Closed report vocabulary; the server validates the same values. */
export const REPORT_REASONS = [reason('name'), reason('avatar'), reason('harassment'), reason('impersonation')] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

export function isReportReason(value: unknown): value is ReportReason {
  return REPORT_REASONS.some((reason) => reason.value === value);
}

export const SOCIAL_SUPPORT_URL = 'https://nivl.app/soporte';
