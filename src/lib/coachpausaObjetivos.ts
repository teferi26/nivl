// NIVL · Los objetivos que se recuerdan al reactivar el coach (puro).

export const MAX_OBJETIVOS_PAUSA = 5;

function limpio(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 160) : '';
}

/**
 * Primero los objetivos abiertos (`goals`, los que ya usa el coach) y después
 * lo que escribió al entrar (`events.onboarding_goal`), sin repetir.
 */
export function objetivosDePausa(
  abiertos: readonly { title?: unknown }[],
  metas: readonly { payload?: unknown }[],
): string[] {
  const vistos = new Set<string>();
  const lista: string[] = [];
  const candidatos = [
    ...abiertos.map((g) => limpio(g.title)),
    ...metas.map((m) => limpio((m.payload as { goal?: unknown } | null | undefined)?.goal)),
  ];
  for (const c of candidatos) {
    const clave = c.toLocaleLowerCase();
    if (!c || vistos.has(clave)) continue;
    vistos.add(clave);
    lista.push(c);
    if (lista.length === MAX_OBJETIVOS_PAUSA) break;
  }
  return lista;
}
