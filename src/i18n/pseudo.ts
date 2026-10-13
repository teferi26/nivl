// NIVL · Idiomas: el pseudoidioma `xx` (solo en desarrollo).
//
// Cada texto del catálogo sale entre ⟦ ⟧, con las vocales acentuadas y un 30 %
// más largo. En la galería (`/kit/pantallas?...&idioma=xx`) todo lo que se lea
// sin ⟦ ⟧ es un literal que se ha quedado fuera del catálogo, y lo que se
// corte es un hueco que no aguantará el alemán. Las variables {{x}}, las
// negritas <b></b> y los anidados $t(...) se dejan intactos.

const MAPA: Record<string, string> = {
  a: 'á',
  e: 'ë',
  i: 'ï',
  o: 'ô',
  u: 'ü',
  A: 'Å',
  E: 'Ë',
  I: 'Ï',
  O: 'Ö',
  U: 'Ü',
  n: 'ñ',
  c: 'ç',
};

const INTACTO = /(\{\{[^}]*\}\}|<\/?b>|\$t\([^)]*\))/g;

export function pseudoTexto(s: string): string {
  const partes = s.split(INTACTO);
  let letras = 0;
  const cuerpo = partes
    .map((p, i) => {
      if (i % 2 === 1) return p;
      letras += p.length;
      return p.replace(/[aeiouAEIOUnc]/g, (c) => MAPA[c] ?? c);
    })
    .join('');
  const relleno = '·'.repeat(Math.ceil(letras * 0.3));
  return `⟦${cuerpo}${relleno}⟧`;
}

type Arbol = { [clave: string]: string | string[] | Arbol };

/** El catálogo entero en pseudoidioma. */
export function pseudoArbol<T extends Arbol>(arbol: T): T {
  const out: Arbol = {};
  for (const [clave, valor] of Object.entries(arbol)) {
    out[clave] =
      typeof valor === 'string'
        ? pseudoTexto(valor)
        : Array.isArray(valor)
          ? valor.map(pseudoTexto)
          : pseudoArbol(valor);
  }
  return out as T;
}

export function pseudoRecursos(es: Record<string, Arbol>): Record<string, Arbol> {
  const out: Record<string, Arbol> = {};
  for (const [ns, arbol] of Object.entries(es)) out[ns] = pseudoArbol(arbol);
  return out;
}
