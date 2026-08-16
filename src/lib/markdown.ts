// NIVL · El poco markdown que el sistema escribe, convertido en algo pintable.
//
// El coach responde con markdown porque así piensa: **negrita** para el número
// que importa, viñetas para las órdenes, ## para separar bloques. En pantalla
// eso salía tal cual, con los asteriscos a la vista, y quedaba a medio hacer.
//
// No se mete una librería de markdown por dos razones: pesan, y la suya trae su
// propia tipografía y sus propios márgenes, que pelearían con el sistema de
// diseño. Aquí solo se soporta lo que el coach usa de verdad.

export interface Trozo {
  texto: string;
  negrita: boolean;
}

export type TipoLinea = 'parrafo' | 'titulo' | 'vineta' | 'numerada';

export interface Linea {
  tipo: TipoLinea;
  /** Para las numeradas: el número que ya venía escrito. */
  marca?: string;
  trozos: Trozo[];
}

/**
 * Parte una línea en trozos de negrita y normal.
 *
 * `**` es lo que usa el coach. El `*` suelto NO se trata como cursiva a
 * propósito: aparece constantemente en cifras y multiplicaciones ("3*10", "×1,5")
 * y convertirlo en formato dejaba frases mutiladas.
 */
export function trocear(linea: string): Trozo[] {
  const trozos: Trozo[] = [];
  let resto = linea;

  while (resto.length) {
    const abre = resto.indexOf('**');
    if (abre === -1) {
      trozos.push({ texto: resto, negrita: false });
      break;
    }
    const cierra = resto.indexOf('**', abre + 2);
    if (cierra === -1) {
      // Asteriscos sin pareja: se dejan tal cual. Ocultarlos cambiaría lo que
      // el sistema dijo, y eso es peor que un asterisco suelto.
      trozos.push({ texto: resto, negrita: false });
      break;
    }
    if (abre > 0) trozos.push({ texto: resto.slice(0, abre), negrita: false });
    const dentro = resto.slice(abre + 2, cierra);
    // `****` no es negrita vacía, es literal.
    if (dentro) trozos.push({ texto: dentro, negrita: true });
    resto = resto.slice(cierra + 2);
  }

  return trozos.filter((t) => t.texto.length > 0);
}

/** Convierte el texto del coach en líneas ya clasificadas. */
export function parsear(texto: string): Linea[] {
  return texto
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((cruda): Linea | null => {
      const l = cruda.trim();
      if (!l) return null;

      // Encabezados: se pintan como título de sección, sin las almohadillas.
      const titulo = /^#{1,6}\s+(.*)$/.exec(l);
      if (titulo) return { tipo: 'titulo', trozos: trocear(titulo[1]!) };

      // Una línea entera en negrita también es un título: es como el coach
      // separa bloques cuando no usa almohadillas.
      // Los dos puntos finales caen, vayan dentro o fuera de los asteriscos:
      // un título ya separa por sí mismo y "LEGS:" en versalitas queda sucio.
      const soloNegrita = /^\*\*(.+?)\*\*:?$/.exec(l);
      if (soloNegrita) {
        return { tipo: 'titulo', trozos: [{ texto: soloNegrita[1]!.replace(/:$/, ''), negrita: true }] };
      }

      const numerada = /^(\d{1,2})[.)]\s+(.*)$/.exec(l);
      if (numerada) return { tipo: 'numerada', marca: numerada[1], trozos: trocear(numerada[2]!) };

      const vineta = /^[-*·•]\s+(.*)$/.exec(l);
      if (vineta) return { tipo: 'vineta', trozos: trocear(vineta[1]!) };

      return { tipo: 'parrafo', trozos: trocear(l) };
    })
    .filter((l): l is Linea => l !== null);
}
