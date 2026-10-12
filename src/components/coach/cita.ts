// NIVL · La cita del coach (L4, A2). Puro: sin React Native ni Supabase.
// Cuando el coach ha consultado datos antes de contestar, debajo del texto va
// una línea «Consultado: tu historial». Las consultas no se repiten en la
// lista de acciones: no han cambiado nada del sistema.
//
// Los nombres son los de supabase/functions/_shared/tools.ts.

import { t } from '@/i18n';

// Las herramientas que se citan; su nombre legible está en coach:cita.fuente.
const CONSULTAS = ['consultar_historial', 'consultar_dia'] as const;
type Consulta = (typeof CONSULTAS)[number];

/** ¿Es una herramienta de solo lectura que se cita en vez de listarse? */
export function esConsulta(nombre: string): nombre is Consulta {
  return (CONSULTAS as readonly string[]).includes(nombre);
}

/** La línea de la cita, o null si no hubo consultas. Sin duplicados, en orden de llegada. */
export function citaDe(nombres: readonly string[]): string | null {
  const vistos: string[] = [];
  for (const n of nombres) {
    if (!esConsulta(n)) continue;
    const fuente = t(`coach:cita.fuente.${n}`);
    if (!vistos.includes(fuente)) vistos.push(fuente);
  }
  if (!vistos.length) return null;
  if (vistos.length === 1) return t('coach:cita.consultado', { lista: vistos[0] });
  return t('coach:cita.consultadoVarias', { primeras: vistos.slice(0, -1).join(', '), ultima: vistos[vistos.length - 1] });
}

/** Los nombres que sí se pintan como acciones (todo lo que no es consulta). */
export function sinConsultas(nombres: readonly string[]): string[] {
  return nombres.filter((n) => !esConsulta(n));
}
