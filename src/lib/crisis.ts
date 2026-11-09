// NIVL · Líneas de crisis y emergencias por país (puro, con test).
//
// Regla: aquí solo entra un número comprobado en su fuente oficial, citada en
// la fila. El país sale de la región del teléfono, que puede no ser donde está
// la persona: por eso, si no hay dato, el texto remite a «el número de
// emergencias de tu país» y nunca se inventa uno.
//
// Copia para el coach en supabase/functions/_shared/crisis.ts (el empaquetado
// de la Edge Function no sube nada de fuera de supabase/). Si tocas una, toca
// la otra: lo comprueba src/lib/__tests__/crisis.test.ts. Última revisión de
// las fuentes: 2026-11-09.

export interface LineasPais {
  /** Línea de crisis o conducta suicida, disponible las 24 horas. */
  crisis?: string;
  /** Emergencias. */
  emergencias?: string;
}

const FUENTE_112_UE = 'https://digital-strategy.ec.europa.eu/en/policies/112';

const POR_PAIS: Readonly<Record<string, LineasPais & { fuente: string }>> = {
  ES: { crisis: '024', emergencias: '112', fuente: 'https://www.sanidad.gob.es/linea024/home.htm' },
  MX: { crisis: '800 911 2000', fuente: 'https://www.gob.mx/salud/prensa/239-linea-de-la-vida-celebra-25-anos-de-servicio-humano-para-poblacion-con-problemas-de-salud-mental' },
  FR: { crisis: '3114', emergencias: '112', fuente: 'https://3114.fr/' },
  BE: { crisis: '0800 32 123', emergencias: '112', fuente: 'https://www.health.belgium.be/fr/chercher-de-laide' },
  CH: { crisis: '143', emergencias: '112', fuente: 'https://www.143.ch/ · https://www.ch.ch/en/safety-and-justice/emergencies-and-danger/' },
  CA: { crisis: '9-8-8', fuente: 'https://988.ca/' },
  DE: { crisis: '0800 1110111', emergencias: '112', fuente: 'https://www.telefonseelsorge.de/' },
  AT: { crisis: '142', emergencias: '112', fuente: 'https://www.telefonseelsorge.at/' },
  PT: { crisis: '1411', emergencias: '112', fuente: 'https://www.sns24.gov.pt/servico/linha-nacional-de-prevencao-do-suicidio' },
  BR: { crisis: '188', emergencias: '192', fuente: 'https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/s/suicidio-prevencao' },
  GB: { crisis: '116 123', emergencias: '999', fuente: 'https://www.nhs.uk/nhs-services/mental-health-services/where-to-get-urgent-help-for-mental-health/' },
  IE: { crisis: '116 123', emergencias: '112', fuente: 'https://www2.hse.ie/mental-health/services-support/supports-services/' },
  US: { crisis: '988', emergencias: '911', fuente: 'https://988lifeline.org/ · https://www.911.gov/calling-911/' },
  AU: { crisis: '13 11 14', emergencias: '000', fuente: 'https://www.healthdirect.gov.au/mental-health-crisis-support' },
};

/** Países de la UE sin línea de crisis comprobada: solo el 112, que vale en toda la Unión. */
const UE_SOLO_112 = ['BG', 'CY', 'CZ', 'DK', 'EE', 'FI', 'GR', 'HR', 'HU', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'RO', 'SE', 'SI', 'SK'] as const;

export const LINEAS_CRISIS: Readonly<Record<string, LineasPais & { fuente: string }>> = {
  ...POR_PAIS,
  ...Object.fromEntries(UE_SOLO_112.map((p) => [p, { emergencias: '112', fuente: FUENTE_112_UE }])),
};

/** Las líneas del país, o vacío si no hay ninguna comprobada. */
export function lineasDe(region: string | null | undefined): LineasPais {
  if (!region) return {};
  const fila = LINEAS_CRISIS[region.toUpperCase()];
  return fila ? { crisis: fila.crisis, emergencias: fila.emergencias } : {};
}
