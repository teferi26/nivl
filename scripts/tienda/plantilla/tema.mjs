// Tema del diseño comercial: colores, tipos, marca y textos en un solo sitio.
// Puro. Para otro aspecto (el rediseño 1.1, por ejemplo) no se toca nada de la
// plantilla: se crea un módulo con solo lo que cambia y se indica su ruta:
//
//   NIVL_TIENDA_TEMA=/ruta/tema-1.1.mjs node scripts/tienda/tienda.mjs --commit <sha>
//
//   export default {
//     color: { titular: '#ffffff' },
//     tipos: { titular: { familia: 'Otra', peso: 800 } },
//     archivosFuente: [{ familia: 'Otra', peso: 800, ruta: '/ruta/Otra-800.ttf' }],
//     textos: { hoy: { titular: ['UNA LÍNEA', 'Y OTRA'], sub: ['Primera parte.', 'Segunda parte.'] } },
//   };
//
// `ruta` de una fuente: absoluta o relativa a node_modules. `archivosFuente`
// sustituye a la lista entera; el resto se mezcla clave a clave.

export const TEMA = {
  marca: 'NIVL',
  // Valores de ink en src/design/tokens.ts.
  color: {
    fondo: '#000000',
    arcos: '#242424',
    meandro: '#3a3a3a',
    marca: '#8c8c8c',
    titular: '#ffffff',
    subtitulo: '#bdbdbd',
    marcoExterior: '#8c8c8c',
    marcoInterior: '#242424',
  },
  tipos: {
    marca: { familia: 'Cinzel', peso: 600, tracking: '0.34em' },
    titular: { familia: 'Cinzel', peso: 700, tracking: '0.005em' },
    subtitulo: { familia: 'Outfit', peso: 300, tracking: '0em' },
  },
  archivosFuente: [
    { familia: 'Cinzel', peso: 700, ruta: '@expo-google-fonts/cinzel/700Bold/Cinzel_700Bold.ttf' },
    { familia: 'Cinzel', peso: 600, ruta: '@expo-google-fonts/cinzel/600SemiBold/Cinzel_600SemiBold.ttf' },
    { familia: 'Outfit', peso: 300, ruta: '@expo-google-fonts/outfit/300Light/Outfit_300Light.ttf' },
  ],
  // Por escena; lo que no esté aquí sale de textos.mjs.
  textos: {},
};

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Mezcla profunda de objetos; los arrays y valores simples se sustituyen. */
export function mezclarTema(base, cambios = {}) {
  const salida = { ...base };
  for (const [clave, valor] of Object.entries(cambios)) {
    salida[clave] = esObjeto(valor) && esObjeto(base[clave]) ? mezclarTema(base[clave], valor) : valor;
  }
  return salida;
}

/** Bloque :root con las variables que usa estilos.css. */
export function cssTema(tema) {
  const c = tema.color;
  const t = tema.tipos;
  const filas = {
    '--colorFondo': c.fondo,
    '--colorArcos': c.arcos,
    '--colorMeandro': c.meandro,
    '--colorMarca': c.marca,
    '--colorTitular': c.titular,
    '--colorSubtitulo': c.subtitulo,
    '--colorMarcoExterior': c.marcoExterior,
    '--colorMarcoInterior': c.marcoInterior,
    '--marcaFamilia': `'${t.marca.familia}'`,
    '--marcaPeso': t.marca.peso,
    '--marcaTracking': t.marca.tracking,
    '--titularFamilia': `'${t.titular.familia}'`,
    '--titularPeso': t.titular.peso,
    '--titularTracking': t.titular.tracking,
    '--subtituloFamilia': `'${t.subtitulo.familia}'`,
    '--subtituloPeso': t.subtitulo.peso,
    '--subtituloTracking': t.subtitulo.tracking,
  };
  return `:root{${Object.entries(filas).map(([k, v]) => `${k}:${v}`).join(';')}}`;
}
