// Tamaños de salida y medidas de cada formato. Puro.
// Las medidas son fracciones del ANCHO del lienzo, salvo donde se indica.
// Salen de medir la ficha 1.0.10 (iPhone 598 de ancho, iPad 900).

/** Copia de PATH_MEANDRO (src/components/arena/geometria.ts): unidad de 10. */
export const PATH_MEANDRO = 'M0 9.5H10 M0.5 9.5V0.5H8.5V6.5H3.5V3.5H6';

const TELEFONO = {
  modo: 'apilada',
  lineas: 2,
  subLineas: 2,
  margen: 0.055,
  padTop: 0.1,
  marcaFs: 0.0235,
  marcaGap: 0.05,
  tituloFs: 0.079,
  tituloLh: 1.05,
  subGap: 0.028,
  subFs: 0.0365,
  subLh: 1.36,
  meandroGap: 0.032,
  meandroAlto: 0.0125,
  meandroAncho: 0.49,
  marcoTop: 0.578,
  marcoAncho: 0.793,
  radio: 0.118,
  trazo: 0.0026,
  bisel: 0.0135,
  arcoCentro: 0.31,
  arcoRx: [0.5, 0.71, 0.85],
  arcoRatio: 0.69,
  arcoTrazo: 0.0016,
};

const TABLETA = {
  ...TELEFONO,
  lineas: 1,
  subLineas: 1,
  margen: 0.065,
  padTop: 0.057,
  marcaFs: 0.02,
  marcaGap: 0.02,
  tituloFs: 0.0655,
  subGap: 0.022,
  subFs: 0.0292,
  meandroGap: 0.026,
  meandroAlto: 0.0098,
  meandroAncho: 0.34,
  marcoTop: 0.291,
  marcoAncho: 0.834,
  radio: 0.05,
  trazo: 0.0019,
  bisel: 0.0125,
  arcoCentro: 0.2,
  arcoRx: [0.46, 0.63, 0.8, 0.98, 1.17],
  arcoRatio: 0.62,
  arcoTrazo: 0.0012,
};

const DUO_EXTERIOR = {
  ...TELEFONO,
  subLineas: 1,
  padTop: 0.066,
  marcaFs: 0.0195,
  marcaGap: 0.03,
  tituloFs: 0.075,
  subGap: 0.022,
  subFs: 0.0295,
  meandroGap: 0.026,
  meandroAlto: 0.0105,
  meandroAncho: 0.36,
  marcoTop: 0.44,
  marcoAncho: 0.8,
  radio: 0.085,
  trazo: 0.0022,
  bisel: 0.0115,
  arcoCentro: 0.22,
  arcoRx: [0.5, 0.68, 0.87, 1.07, 1.28],
  arcoRatio: 0.62,
};

const APAISADA = {
  ...TABLETA,
  padTop: 0.03,
  marcaFs: 0.0108,
  marcaGap: 0.0115,
  tituloFs: 0.044,
  subGap: 0.0115,
  subFs: 0.0195,
  meandroGap: 0.0135,
  meandroAlto: 0.0056,
  meandroAncho: 0.2,
  marcoTop: 0.17,
  marcoAncho: 0.82,
  radio: 0.0125,
  trazo: 0.0011,
  bisel: 0.0052,
  arcoCentro: 0.1,
  arcoRx: [0.38, 0.5, 0.62, 0.75, 0.89],
  arcoRatio: 0.42,
  arcoTrazo: 0.0008,
};

const DIVIDIDA = {
  ...APAISADA,
  modo: 'dividida',
  lineas: 2,
  subLineas: 2,
  margen: 0.065,
  cabeceraAncho: 0.4,
  marcaFs: 0.0155,
  marcaGap: 0.026,
  tituloFs: 0.0585,
  subGap: 0.022,
  subFs: 0.0232,
  meandroGap: 0.026,
  meandroAlto: 0.0085,
  meandroAncho: 0.3,
  marcoTop: 0.052,
  marcoIzq: 0.5,
  marcoAncho: 0.6,
  radio: 0.016,
  trazo: 0.0016,
  bisel: 0.0075,
  retratoAncho: 0.24,
  retratoRadio: 0.036,
  retratoBisel: 0.0085,
  retratoCentro: 0.76,
  arcoX: 0.76,
  arcoCentro: 0.5,
  arcoRx: [0.3, 0.42, 0.55, 0.7],
  arcoRatio: 0.62,
  arcoTrazo: 0.0014,
};

const DIVIDIDA_WEB = { ...DIVIDIDA, marcoTop: 0.08, retratoAncho: 0.27, retratoRadio: 0.04, arcoCentro: 0.56 };

export const OBJETIVOS = {
  'iphone-69': { ancho: 1320, alto: 2868, medidas: TELEFONO, marco: 'telefono' },
  'iphone-63': { ancho: 1206, alto: 2622, medidas: TELEFONO, marco: 'telefono' },
  android: { ancho: 1080, alto: 1920, medidas: { ...TELEFONO, padTop: 0.075, marcaGap: 0.04, marcoTop: 0.52, marcoAncho: 0.8, radio: 0.052 }, marco: 'telefono' },
  'duo-exterior': { ancho: 1398, alto: 2034, medidas: DUO_EXTERIOR, marco: 'telefono' },
  'duo-interior': { ancho: 2007, alto: 2853, medidas: TABLETA, marco: 'telefono' },
  'ipad-13': { ancho: 2064, alto: 2752, medidas: TABLETA, marco: 'tableta' },
  mac: { ancho: 2880, alto: 1800, medidas: APAISADA, marco: 'ventana' },
  'apple-tv': { ancho: 3840, alto: 2160, medidas: { ...APAISADA, radio: 0, bisel: 0 }, marco: 'pantalla' },
  vision: { ancho: 3840, alto: 2160, medidas: { ...APAISADA, radio: 0.022 }, marco: 'ventana' },
  web: { ancho: 2880, alto: 1800, medidas: APAISADA, marco: 'ventana', siRetrato: DIVIDIDA_WEB },
  'web-social': { ancho: 1200, alto: 630, medidas: DIVIDIDA, marco: 'ventana' },
};

/** Los ids de specs.mjs que aquí tienen nombre corto. */
export const ALIAS_OBJETIVO = {
  'iphone-duo-exterior': 'duo-exterior',
  'iphone-duo-interior': 'duo-interior',
  'vision-pro': 'vision',
};

/** Lo de Apple Watch no se compone: la captura va tal cual, sin alfa. */
export function esReloj(objetivo) {
  return String(objetivo).startsWith('watch');
}

const SANGRE = 40; // px que el marco se pasa del lienzo para que nunca se vea su final.

/**
 * Convierte fracciones en píxeles y decide el encaje según la forma de la
 * captura cruda. La pantalla siempre llega más allá del borde inferior.
 */
export function maquetar(objetivo, crudaAncho, crudaAlto) {
  const obj = OBJETIVOS[ALIAS_OBJETIVO[objetivo] ?? objetivo];
  if (!obj) throw new Error(`Objetivo sin maqueta: ${objetivo}. Hay: ${Object.keys(OBJETIVOS).join(', ')}`);
  const retrato = crudaAlto > crudaAncho;
  const f = retrato && obj.siRetrato ? obj.siRetrato : obj.medidas;
  const W = obj.ancho;
  const H = obj.alto;
  const px = (v) => Math.round(v * W);

  let marcoAncho = px(f.marcoAncho);
  let marcoIzq;
  let radio = px(f.radio);
  let bisel = px(f.bisel);
  if (f.modo === 'dividida') {
    if (retrato) {
      marcoAncho = px(f.retratoAncho);
      marcoIzq = px(f.retratoCentro) - Math.round(marcoAncho / 2);
      radio = px(f.retratoRadio);
      bisel = px(f.retratoBisel);
    } else {
      marcoIzq = px(f.marcoIzq);
    }
  } else {
    marcoIzq = Math.round((W - marcoAncho) / 2);
  }

  const marcoTop = px(f.marcoTop);
  const trazo = Math.max(1, Math.round(f.trazo * W));
  const interiorAncho = marcoAncho - 2 * (trazo + bisel);
  const visible = H - marcoTop + SANGRE;
  const natural = Math.round((interiorAncho * crudaAlto) / crudaAncho);

  const meandroUnidad = Math.max(6, px(f.meandroAlto));
  const meandroAncho = Math.round(px(f.meandroAncho) / meandroUnidad) * meandroUnidad;

  return {
    W,
    H,
    modo: f.modo,
    marcoTipo: obj.marco,
    lineas: f.lineas,
    subLineas: f.subLineas,
    margen: px(f.margen),
    padTop: px(f.padTop),
    cabeceraAncho: f.cabeceraAncho ? px(f.cabeceraAncho) : W - 2 * px(f.margen),
    marcaFs: px(f.marcaFs),
    marcaGap: px(f.marcaGap),
    tituloFs: px(f.tituloFs),
    tituloLh: f.tituloLh,
    subGap: px(f.subGap),
    subFs: px(f.subFs),
    subLh: f.subLh,
    meandroGap: px(f.meandroGap),
    meandroUnidad,
    meandroAncho,
    marcoTop,
    marcoIzq,
    marcoAncho,
    marcoAlto: visible,
    radio,
    bisel,
    trazo,
    pantallaAlto: Math.max(natural, visible),
    radioInterior: Math.max(0, radio - bisel - trazo),
    arcos: {
      cx: Math.round((f.arcoX ?? 0.5) * W),
      cy: marcoTop + px(f.arcoCentro),
      rx: f.arcoRx.map(px),
      ratio: f.arcoRatio,
      trazo: Math.max(1, Math.round(f.arcoTrazo * W)),
    },
  };
}
