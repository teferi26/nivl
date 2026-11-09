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
  // Valores de Ónix en src/design/tokens.ts (FONDO_ONIX, ink y oro).
  color: {
    fondo: '#09090b',
    degradado: 'linear-gradient(180deg, #121214 0%, #09090b 55%, #050506 100%)',
    velo: 'radial-gradient(70% 40% at 50% 0%, rgba(201, 169, 97, 0.09) 0%, rgba(201, 169, 97, 0) 100%)',
    arcos: '#2a2a2c',
    hilo: '#c9a961',
    meandro: '#4a494c',
    marca: '#c9a961',
    titular: '#f5f2ec',
    subtitulo: '#b8b4ab',
    marcoExterior: '#4a494c',
    marcoInterior: '#2a2a2c',
  },
  tipos: {
    marca: { familia: 'Outfit', peso: 700, tracking: '0.34em' },
    titular: { familia: 'Playfair Display', peso: 700, tracking: '0em' },
    subtitulo: { familia: 'Outfit', peso: 500, tracking: '0em' },
  },
  archivosFuente: [
    { familia: 'Playfair Display', peso: 700, ruta: '@expo-google-fonts/playfair-display/700Bold/PlayfairDisplay_700Bold.ttf' },
    { familia: 'Outfit', peso: 700, ruta: '@expo-google-fonts/outfit/700Bold/Outfit_700Bold.ttf' },
    { familia: 'Outfit', peso: 500, ruta: '@expo-google-fonts/outfit/500Medium/Outfit_500Medium.ttf' },
  ],
  // Ónix no lleva graderíos ni meandro: en su sitio, un hilo de oro.
  motivos: { arcos: false, meandro: false, hilo: true },
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
    '--fondoDegradado': c.degradado,
    '--fondoVelo': c.velo,
    '--colorHilo': c.hilo,
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
