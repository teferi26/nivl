// Arranque del arnés, antes que la app. Sin cuenta real, sin red y con el reloj
// fijado para que cada captura salga igual.

// El gancho de DevTools tiene que existir ANTES de cargar el renderer: es la
// única forma de ver el árbol en Release para encontrar ScrollView y botones.
// `avisos`: lo que el arnés no supo servir. Viaja en tienda-estado.json.
global.__TIENDA__ = { raiz: null, plan: null, avisos: [] };
global.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
  supportsFiber: true,
  isDisabled: false,
  renderers: new Map(),
  inject() { return 1; },
  checkDCE() {},
  onScheduleFiberRoot() {},
  onCommitFiberUnmount() {},
  onPostCommitFiberRoot() {},
  onCommitFiberRoot(_id, raiz) { global.__TIENDA__.raiz = raiz; },
};

const RN = require('react-native');
const { Linking } = RN;
// La tienda solo se «abre» en las escenas con catálogo (ver app/purchases.ts). En
// la nueva arquitectura NativeModules es un objeto del host y no admite definir
// propiedades: se envuelve la exportación que lee el código de la app.
const modulosReales = RN.NativeModules;
const modulos = new Proxy(modulosReales, {
  get: (t, k) => (k === 'RNPurchases' ? (global.__TIENDA__.catalogo ? {} : undefined) : t[k]),
});
Object.defineProperty(RN, 'NativeModules', { configurable: true, enumerable: true, get: () => modulos });
const { RELOJ_ARNES } = require('./reloj');

const FechaReal = Date;
const desfase = new FechaReal(...RELOJ_ARNES).getTime() - FechaReal.now();
class FechaArnes extends FechaReal {
  constructor(...args) {
    if (args.length === 0) super(FechaReal.now() + desfase);
    else super(...args);
  }
  static now() { return FechaReal.now() + desfase; }
}
global.Date = FechaArnes;

const sinRed = () => {
  global.__TIENDA__.avisos.push('red bloqueada');
  throw new Error('ARNES_SIN_RED: esta build solo usa datos ficticios locales.');
};
global.fetch = async () => sinRed();
global.XMLHttpRequest = class { open() { sinRed(); } send() { sinRed(); } };
global.WebSocket = class { constructor() { sinRed(); } };

// Las URL de control (nivl://__tienda/...) no llegan a expo-router: se las
// queda control.ts. Las demás, como siempre.
const esControl = (url) => typeof url === 'string' && url.includes('://__tienda/');
const oyentesOriginal = Linking.addEventListener.bind(Linking);
Linking.addEventListener = (tipo, oyente, contexto) => oyentesOriginal(
  tipo,
  (e) => { if (!esControl(e?.url)) oyente.call(contexto, e); },
);
// En un arranque en frío expo-router pregunta por expo-linking, no por Linking:
// la URL de control se retira ahí para que no acabe en +not-found.
try {
  const nativo = require('expo-modules-core').requireNativeModule('ExpoLinking');
  const leerUrl = nativo.getLinkingURL.bind(nativo);
  nativo.getLinkingURL = () => {
    const url = leerUrl();
    return esControl(url) ? null : url;
  };
  const inicial = leerUrl();
  if (esControl(inicial)) require('./control').ejecutar(inicial);
} catch (e) {
  global.__TIENDA__.avisos.push(`arranque en frío: ${String(e)}`);
}
oyentesOriginal('url', (e) => {
  if (esControl(e?.url)) require('./control').ejecutar(e.url);
});
