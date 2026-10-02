// NIVL · La cita del coach (L4, A2). Puro: sin React Native ni Supabase.
// Cuando el coach ha consultado datos antes de contestar, debajo del texto va
// una línea «Consultado: tu historial». Las consultas no se repiten en la
// lista de acciones: no han cambiado nada del sistema.
//
// Los nombres son los de supabase/functions/_shared/tools.ts.

const CONSULTAS: Record<string, string> = {
  consultar_historial: 'tu historial',
  consultar_dia: 'tu registro del día',
};

/** ¿Es una herramienta de solo lectura que se cita en vez de listarse? */
export function esConsulta(nombre: string): boolean {
  return Object.prototype.hasOwnProperty.call(CONSULTAS, nombre);
}

/** La línea de la cita, o null si no hubo consultas. Sin duplicados, en orden de llegada. */
export function citaDe(nombres: readonly string[]): string | null {
  const vistos: string[] = [];
  for (const n of nombres) {
    if (!esConsulta(n)) continue;
    const fuente = CONSULTAS[n];
    if (!vistos.includes(fuente)) vistos.push(fuente);
  }
  if (!vistos.length) return null;
  const lista = vistos.length === 1 ? vistos[0] : `${vistos.slice(0, -1).join(', ')} y ${vistos[vistos.length - 1]}`;
  return `Consultado: ${lista}`;
}

/** Los nombres que sí se pintan como acciones (todo lo que no es consulta). */
export function sinConsultas(nombres: readonly string[]): string[] {
  return nombres.filter((n) => !esConsulta(n));
}
