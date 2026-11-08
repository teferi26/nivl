// Especificaciones oficiales de capturas y App Preview de App Store Connect.
// Datos puros: sin imports ni efectos. Si Apple cambia algo, se toca aquí y en
// ningún otro sitio. Todo lo que no se ha podido confirmar está en VERIFICACION
// marcado como NO VERIFICADO, no se da por bueno en silencio.

export const FECHA_LECTURA = '2026-11-08';

export const FUENTES = Object.freeze({
  capturas:
    'https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications',
  previews:
    'https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications',
  notasVersion: 'https://developer.apple.com/help/app-store-connect/release-notes/',
  duoNoticia: 'https://developer.apple.com/news/?id=kkphp5qo',
  visionDisponibilidad:
    'https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-apple-vision-pro/',
  visionEnvio: 'https://developer.apple.com/visionos/submit/',
  macDisponibilidad:
    'https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-macs-with-apple-silicon/',
  apiDisplayType: 'https://developer.apple.com/documentation/appstoreconnectapi/screenshotdisplaytype',
  apiPreviewType: 'https://developer.apple.com/documentation/appstoreconnectapi/previewtype',
  apiOpenApi:
    'https://developer.apple.com/sample-code/app-store-connect/app-store-connect-openapi-specification.zip',
});

export const VERIFICADO = 'VERIFICADO';
export const NO_VERIFICADO = 'NO VERIFICADO';

/** Lo que se contrastó el día de la lectura y lo que no se pudo confirmar. */
export const VERIFICACION = Object.freeze([
  {
    tema: 'App iPhone/iPad compatible en Vision Pro: publicación y metadatos',
    estado: VERIFICADO,
    conclusion:
      'Se publica sola en la tienda de Vision Pro con los metadatos ya dados, salvo que se desactive en Precios y disponibilidad. El requisito de 3840x2160 se lee «Required for Apple Vision Pro» en la tabla de capturas.',
    fuente: FUENTES.visionEnvio,
  },
  {
    tema: 'App iPhone/iPad compatible en Vision Pro: ¿necesita capturas propias?',
    estado: NO_VERIFICADO,
    conclusion:
      'Ninguna página lo dice de forma literal para capturas; la de disponibilidad no las menciona. Lo razonable es que no, porque reutiliza los metadatos, pero es una inferencia.',
    fuente: FUENTES.visionDisponibilidad,
  },
  {
    tema: 'App iPhone/iPad en Mac con Apple silicon: ¿necesita capturas propias?',
    estado: NO_VERIFICADO,
    conclusion:
      'La página de disponibilidad no habla de capturas ni de metadatos. La tabla dice «Required for Mac apps» sin aclarar si incluye apps de iPhone/iPad; se entiende que son apps nativas de Mac, pero es una inferencia.',
    fuente: FUENTES.macDisponibilidad,
  },
  {
    tema: 'iPhone Duo: ¿hacen falta exterior e interior o basta una?',
    estado: NO_VERIFICADO,
    conclusion:
      'La tabla da los dos tamaños en la misma fila y no dice si hacen falta ambos. Ni la noticia, ni /iphone-duo/, ni las buenas prácticas de recursos, ni el foro lo aclaran. Se generan las dos para no depender de ello.',
    fuente: FUENTES.capturas,
  },
  {
    tema: 'iPhone Duo: cuándo es obligatorio',
    estado: VERIFICADO,
    conclusion:
      'Desde abril de 2027. Apple se contradice en el alcance: la tabla dice «any app using the iOS 27.1 SDK or later» y la noticia y las notas de versión dicen «any apps or games submitted». Entregar capturas de Duo da la insignia en la ficha.',
    fuente: FUENTES.duoNoticia,
  },
  {
    tema: 'API de App Store Connect: valores para iPhone Duo',
    estado: VERIFICADO,
    conclusion:
      'No existe ninguno ni en ScreenshotDisplayType ni en PreviewType (OpenAPI 4.6, archivo del 2026-11-04, y página de referencia). Por API no se pueden subir hoy; Duo va a mano por App Store Connect.',
    fuente: FUENTES.apiOpenApi,
  },
  {
    tema: 'API de App Store Connect: qué valor corresponde a cada tamaño',
    estado: NO_VERIFICADO,
    conclusion:
      'Los valores del enum no llevan descripción. No hay APP_IPHONE_69 ni APP_IPHONE_63 y la correspondencia de cada tamaño con un valor del enum de OBJETIVOS es una suposición por nombre; hay que comprobarla en una subida de prueba.',
    fuente: FUENTES.apiDisplayType,
  },
  {
    tema: 'App Preview de Vision Pro con H.264 nivel 4.0',
    estado: NO_VERIFICADO,
    conclusion:
      'Cálculo propio: el nivel 4.0 admite 8192 macrobloques por cuadro y 3840x2160 necesita 32400, así que ese límite y esa resolución no casan en H.264. La página admite también ProRes 422 HQ y no aclara el caso. Este validador solo implementa H.264.',
    fuente: FUENTES.previews,
  },
]);

export const REGLAS_CAPTURAS = Object.freeze({
  extensiones: ['.png', '.jpg', '.jpeg'],
  minPorTamano: 1,
  maxPorTamano: 10,
  sinAlfa: true,
});

export const REGLAS_PREVIEW = Object.freeze({
  extensiones: ['.mov', '.m4v', '.mp4'],
  maxPorTamano: 3,
  duracionMin: 15,
  duracionMax: 30,
  pesoMaxBytes: 500 * 1000 * 1000,
  video: {
    codec: 'h264',
    // «up to High Profile Level 4.0»: valen los perfiles iguales o inferiores.
    // High 10, High 4:2:2 y High 4:4:4 quedan fuera a propósito.
    perfiles: ['Constrained Baseline', 'Baseline', 'Main', 'High'],
    nivelMax: 40,
    bitrateMin: 10_000_000,
    bitrateMax: 12_000_000,
    fpsMax: 30,
  },
  audio: {
    codec: 'aac',
    sampleRates: [44100, 48000],
    bitrateNominal: 256_000,
    // Decisión nuestra, Apple solo escribe «256kbps AAC». Ojo: una pista de
    // silencio digital con el AAC de ffmpeg mide unos 2 kbps y no pasa.
    toleranciaBitrate: 0.1,
  },
});

const giro = (lista) => lista.map(([a, b]) => [b, a]);

const PREVIEW_IPHONE = Object.freeze({ vertical: [[886, 1920]], apaisado: [[1920, 886]] });
const PREVIEW_IPAD = Object.freeze({ vertical: [[1200, 1600]], apaisado: [[1600, 1200]] });

const seccion = (vertical) => ({ vertical, apaisado: giro(vertical) });
const soloApaisado = (apaisado) => ({ vertical: [], apaisado });

/**
 * Un objetivo es un conjunto de tamaños que se valida junto.
 * capturas.ideal es el tamaño que debe producir el generador; el resto de la
 * lista también lo acepta Apple. orientacion es la que se exige por defecto:
 * NIVL solo funciona en vertical (app.json) aunque Apple admita ambas.
 */
export const OBJETIVOS = Object.freeze([
  {
    id: 'iphone-69',
    familia: 'iphone',
    nombre: 'iPhone con Dynamic Island, pantalla grande (6,9 pulgadas)',
    orientacion: 'vertical',
    capturas: {
      ideal: [1320, 2868],
      ...seccion([[1320, 2868], [1290, 2796], [1260, 2736]]),
    },
    preview: PREVIEW_IPHONE,
    requisito: 'condicional',
    notaRequisito:
      'Apple exige al menos una de Dynamic Island medio; las de este tamaño bajan a Face ID grande y de ahí a Dynamic Island medio.',
    asc: { screenshotDisplayType: 'APP_IPHONE_67', previewType: 'IPHONE_67', estado: NO_VERIFICADO },
  },
  {
    id: 'iphone-63',
    familia: 'iphone',
    nombre: 'iPhone con Dynamic Island, pantalla media (6,3 y 6,1 pulgadas)',
    orientacion: 'vertical',
    capturas: {
      ideal: [1206, 2622],
      ...seccion([[1206, 2622], [1179, 2556]]),
    },
    preview: PREVIEW_IPHONE,
    requisito: 'obligatorio',
    notaRequisito: '«At least one screenshot for iPhone with Dynamic Island (medium display).»',
    asc: { screenshotDisplayType: 'APP_IPHONE_61', previewType: 'IPHONE_61', estado: NO_VERIFICADO },
  },
  {
    id: 'iphone-duo-exterior',
    familia: 'iphone-duo',
    nombre: 'iPhone Duo, pantalla exterior',
    orientacion: 'vertical',
    capturas: { ideal: [1398, 2034], ...seccion([[1398, 2034]]) },
    preview: PREVIEW_IPHONE,
    requisito: 'opcional',
    notaRequisito: 'Obligatorio desde abril de 2027. Da insignia en la ficha.',
    asc: { screenshotDisplayType: null, previewType: null, estado: VERIFICADO },
  },
  {
    id: 'iphone-duo-interior',
    familia: 'iphone-duo',
    nombre: 'iPhone Duo, pantalla interior',
    orientacion: 'vertical',
    capturas: { ideal: [2007, 2853], ...seccion([[2007, 2853]]) },
    preview: PREVIEW_IPHONE,
    requisito: 'opcional',
    notaRequisito: 'Obligatorio desde abril de 2027. Da insignia en la ficha.',
    asc: { screenshotDisplayType: null, previewType: null, estado: VERIFICADO },
  },
  {
    id: 'ipad-13',
    familia: 'ipad',
    nombre: 'iPad de 13 pulgadas',
    orientacion: 'vertical',
    capturas: {
      ideal: [2064, 2752],
      ...seccion([[2064, 2752], [2048, 2732]]),
    },
    preview: PREVIEW_IPAD,
    requisito: 'condicional',
    notaRequisito: 'Obligatorio si la app corre en iPad; NIVL declara supportsTablet en app.json.',
    asc: {
      screenshotDisplayType: 'APP_IPAD_PRO_3GEN_129',
      previewType: 'IPAD_PRO_3GEN_129',
      estado: NO_VERIFICADO,
    },
  },
  {
    id: 'mac',
    familia: 'mac',
    nombre: 'Mac (16:10)',
    orientacion: 'apaisado',
    capturas: {
      ideal: [2880, 1800],
      ...soloApaisado([[2880, 1800], [2560, 1600], [1440, 900], [1280, 800]]),
    },
    preview: { vertical: [], apaisado: [[1920, 1080]] },
    requisito: 'condicional',
    notaRequisito: 'Obligatorio en apps de Mac. Para una app de iPhone/iPad: NO VERIFICADO.',
    asc: { screenshotDisplayType: 'APP_DESKTOP', previewType: 'DESKTOP', estado: NO_VERIFICADO },
  },
  {
    id: 'apple-tv',
    familia: 'tv',
    nombre: 'Apple TV',
    orientacion: 'apaisado',
    capturas: { ideal: [3840, 2160], ...soloApaisado([[3840, 2160], [1920, 1080]]) },
    preview: { vertical: [], apaisado: [[1920, 1080]] },
    requisito: 'condicional',
    notaRequisito: 'Obligatorio en apps de Apple TV.',
    asc: { screenshotDisplayType: 'APP_APPLE_TV', previewType: 'APPLE_TV', estado: NO_VERIFICADO },
  },
  {
    id: 'vision-pro',
    familia: 'vision',
    nombre: 'Apple Vision Pro',
    orientacion: 'apaisado',
    capturas: { ideal: [3840, 2160], ...soloApaisado([[3840, 2160]]) },
    preview: { vertical: [], apaisado: [[3840, 2160]] },
    requisito: 'condicional',
    notaRequisito: 'Obligatorio en apps de visionOS. Para una app compatible: NO VERIFICADO.',
    asc: {
      screenshotDisplayType: 'APP_APPLE_VISION_PRO',
      previewType: 'APPLE_VISION_PRO',
      estado: NO_VERIFICADO,
    },
  },
  {
    id: 'watch',
    familia: 'watch',
    nombre: 'Apple Watch (una sola clase de tamaño)',
    orientacion: 'vertical',
    capturas: {
      ideal: [422, 514],
      vertical: [[422, 514], [410, 502], [416, 496], [396, 484], [368, 448], [312, 390]],
      apaisado: [],
      mismoTamanoEnTodas: true,
    },
    // La página de App Preview no incluye Apple Watch.
    preview: null,
    requisito: 'condicional',
    notaRequisito: 'Obligatorio en apps de Apple Watch. Mismo tamaño en todas las localizaciones.',
    asc: {
      // 422x514 no tiene valor claro en el enum: se deja sin asignar.
      screenshotDisplayTypePorTamano: {
        '410x502': 'APP_WATCH_ULTRA',
        '416x496': 'APP_WATCH_SERIES_10',
        '396x484': 'APP_WATCH_SERIES_7',
        '368x448': 'APP_WATCH_SERIES_4',
        '312x390': 'APP_WATCH_SERIES_3',
      },
      estado: NO_VERIFICADO,
    },
  },
]);

export const IDS_OBJETIVOS = Object.freeze(OBJETIVOS.map((o) => o.id));

export function objetivoPorId(id) {
  return OBJETIVOS.find((o) => o.id === id) ?? null;
}

/** Valores del enum tal como salen en la OpenAPI 4.6 de Apple. */
export const ASC_SCREENSHOT_DISPLAY_TYPES = Object.freeze([
  'APP_IPHONE_67', 'APP_IPHONE_61', 'APP_IPHONE_65', 'APP_IPHONE_58', 'APP_IPHONE_55',
  'APP_IPHONE_47', 'APP_IPHONE_40', 'APP_IPHONE_35', 'APP_IPAD_PRO_3GEN_129',
  'APP_IPAD_PRO_3GEN_11', 'APP_IPAD_PRO_129', 'APP_IPAD_105', 'APP_IPAD_97', 'APP_DESKTOP',
  'APP_WATCH_ULTRA', 'APP_WATCH_SERIES_10', 'APP_WATCH_SERIES_7', 'APP_WATCH_SERIES_4',
  'APP_WATCH_SERIES_3', 'APP_APPLE_TV', 'APP_APPLE_VISION_PRO', 'IMESSAGE_APP_IPHONE_67',
  'IMESSAGE_APP_IPHONE_61', 'IMESSAGE_APP_IPHONE_65', 'IMESSAGE_APP_IPHONE_58',
  'IMESSAGE_APP_IPHONE_55', 'IMESSAGE_APP_IPHONE_47', 'IMESSAGE_APP_IPHONE_40',
  'IMESSAGE_APP_IPAD_PRO_3GEN_129', 'IMESSAGE_APP_IPAD_PRO_3GEN_11', 'IMESSAGE_APP_IPAD_PRO_129',
  'IMESSAGE_APP_IPAD_105', 'IMESSAGE_APP_IPAD_97',
]);

export const ASC_PREVIEW_TYPES = Object.freeze([
  'IPHONE_67', 'IPHONE_61', 'IPHONE_65', 'IPHONE_58', 'IPHONE_55', 'IPHONE_47', 'IPHONE_40',
  'IPHONE_35', 'IPAD_PRO_3GEN_129', 'IPAD_PRO_3GEN_11', 'IPAD_PRO_129', 'IPAD_105', 'IPAD_97',
  'DESKTOP', 'APPLE_TV', 'APPLE_VISION_PRO',
]);
