#!/usr/bin/env node
// Monta una copia desechable del repo con el módulo de gafas activado.
//
//   node modules/nivl-meta/scripts/variante-interna.mjs <destino>
//   (en el destino) npx expo prebuild --platform ios --no-install
//   node modules/nivl-meta/scripts/variante-interna.mjs <destino> --tras-prebuild
//   (en el destino/ios) pod install
//
// Todo cambio ocurre en el destino, que debe estar fuera del repo. Esta variante lleva
// Mock Device Kit y claves que Apple rechaza: no se publica ni se sube a ningún sitio.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const BUNDLE_ID = 'com.teferi.nivl.gafasinterno';
const NOMBRE = 'NIVL Gafas Interno';
const ESQUEMA = 'nivlgafas';
const IOS_MINIMO = '17.2';
const MARCA = '.variante-interna';
const DAT_URL = 'https://github.com/facebook/meta-wearables-dat-ios';
const DAT_VERSION = '1.0.1';
const DAT_PRODUCTOS = ['MWDATCore', 'MWDATDisplay', 'MWDATMockDevice'];
const SIN_COPIAR = new Set([
  'node_modules',
  '.git',
  'ios',
  'android',
  '.expo',
  'dist',
  '.claude',
  'supabase-token.txt',
]);
const TEXTO_PERMISO = 'Solo para la prueba interna del puente con las gafas.';
const MANIFIESTO_ESCENAS = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: 'Default Configuration',
        UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
      },
    ],
  },
};

function morir(mensaje) {
  console.error(`variante-interna: ${mensaje}`);
  process.exit(1);
}

/** Ruta real aunque el final aún no exista. */
function real(ruta) {
  let actual = path.resolve(ruta);
  const resto = [];
  while (!fs.existsSync(actual)) {
    resto.unshift(path.basename(actual));
    actual = path.dirname(actual);
  }
  return path.join(fs.realpathSync(actual), ...resto);
}

function contiene(padre, hijo) {
  const relativa = path.relative(padre, hijo);
  return relativa === '' || (!relativa.startsWith('..') && !path.isAbsolute(relativa));
}

/** El repo y, si esto es un worktree, también el repo principal que lo contiene. */
function raicesProtegidas() {
  const raices = [real(REPO)];
  try {
    const comun = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: REPO,
      encoding: 'utf8',
    }).trim();
    raices.push(path.dirname(real(path.resolve(REPO, comun))));
  } catch {
    // Sin git (o sin permiso) queda la comprobación contra REPO.
  }
  return raices;
}

function validarDestino(destino) {
  for (const raiz of raicesProtegidas()) {
    if (contiene(raiz, destino)) morir(`el destino está dentro del repo (${raiz}). Me niego.`);
    if (contiene(destino, raiz)) morir(`el destino contiene el repo (${raiz}). Me niego.`);
  }
}

function leerJson(ruta) {
  return JSON.parse(fs.readFileSync(ruta, 'utf8'));
}

function escribirJson(ruta, datos) {
  fs.writeFileSync(ruta, `${JSON.stringify(datos, null, 2)}\n`);
}

function sustituir(ruta, buscado, nuevo) {
  const texto = fs.readFileSync(ruta, 'utf8');
  if (!texto.includes(buscado)) morir(`no encuentro el texto a cambiar en ${ruta}: ${buscado}`);
  fs.writeFileSync(ruta, texto.replace(buscado, nuevo));
}

function copiarRepo(destino) {
  fs.mkdirSync(destino, { recursive: true });
  if (fs.readdirSync(destino).length > 0) morir(`el destino no está vacío: ${destino}`);
  fs.writeFileSync(path.join(destino, MARCA), '');
  // Lo que git ignora (tokens, notas locales) no sale del repo, esté donde esté.
  const ignorados = new Set(
    execFileSync('git', ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory'], {
      cwd: REPO,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      .map((r) => path.join(REPO, r.replace(/\/$/, ''))),
  );
  for (const entrada of fs.readdirSync(REPO)) {
    // Un .env real podría acabar empaquetado en el bundle.
    if (SIN_COPIAR.has(entrada) || entrada.startsWith('.env')) continue;
    fs.cpSync(path.join(REPO, entrada), path.join(destino, entrada), {
      recursive: true,
      verbatimSymlinks: true,
      filter: (origen) =>
        !ignorados.has(origen) && path.basename(origen) !== 'harness' && !origen.includes('/.build/'),
    });
  }
}

/** Clon APFS: no ocupa disco y, a diferencia del symlink, nada escribe en el del repo. */
function enlazarDependencias(destino) {
  const origen = fs.realpathSync(path.join(REPO, 'node_modules'));
  const final = path.join(destino, 'node_modules');
  try {
    execFileSync('cp', ['-cR', origen, final], { stdio: 'inherit' });
  } catch {
    fs.rmSync(final, { recursive: true, force: true });
    fs.symlinkSync(origen, final);
  }
}

function activarModulo(destino) {
  const modulo = path.join(destino, 'modules/nivl-meta');
  const interno = path.join(modulo, 'expo-module.config.interno.json');
  const config = leerJson(interno);
  config.apple.modules = [...config.apple.modules, 'NivlMetaLabModule'];
  config.apple.appDelegateSubscribers = [
    'NivlMetaAppDelegateSubscriber',
    'NivlMetaLabAppDelegateSubscriber',
  ];
  escribirJson(path.join(modulo, 'expo-module.config.json'), config);
  fs.rmSync(interno);

  fs.copyFileSync(
    path.join(modulo, 'lab/NivlMetaLabModule.swift'),
    path.join(modulo, 'ios/NivlMetaLabModule.swift'),
  );
  sustituir(
    path.join(modulo, 'ios/NivlMeta.podspec'),
    "products: ['MWDATCore', 'MWDATDisplay']",
    "products: ['MWDATCore', 'MWDATDisplay', 'MWDATMockDevice']",
  );
}

function ajustarAppJson(destino) {
  const ruta = path.join(destino, 'app.json');
  const app = leerJson(ruta);
  const expo = app.expo;
  expo.name = NOMBRE;
  expo.scheme = ESQUEMA;
  expo.ios.bundleIdentifier = BUNDLE_ID;
  // Sin dominios asociados: esta variante no debe capturar los enlaces de nivl.app.
  delete expo.ios.associatedDomains;
  // Sin OTA ni vínculo con EAS: no puede bajar una actualización de producción.
  expo.updates = { enabled: false };
  delete expo.owner;
  delete expo.extra.eas;
  Object.assign(expo.ios.infoPlist, {
    MWDAT: {
      AppLinkURLScheme: `${ESQUEMA}://`,
      MetaAppID: '',
      Analytics: { OptOut: true },
      CrashReporting: { OptOut: true },
    },
    UIBackgroundModes: [
      'processing',
      'bluetooth-central',
      'bluetooth-peripheral',
      'external-accessory',
    ],
    UISupportedExternalAccessoryProtocols: ['com.meta.ar.wearable'],
    NSBluetoothAlwaysUsageDescription: TEXTO_PERMISO,
    NSLocalNetworkUsageDescription: TEXTO_PERMISO,
    NSBonjourServices: ['_bonjour._tcp'],
    UIApplicationSceneManifest: MANIFIESTO_ESCENAS,
  });
  // Wearables.configure() falla con "Internal error" sin un grupo de llavero.
  expo.ios.entitlements = { 'keychain-access-groups': [BUNDLE_ID] };
  escribirJson(ruta, app);
}

function anadirRutaLab(destino) {
  const lab = fs.readFileSync(path.join(destino, 'modules/nivl-meta/lab/gafas-lab.tsx'), 'utf8');
  const importe = "from '../src';";
  if (!lab.includes(importe)) morir('gafas-lab.tsx ya no importa de ../src');
  fs.writeFileSync(
    path.join(destino, 'src/app/gafas-lab.tsx'),
    lab.replace(importe, "from '../../modules/nivl-meta/src';"),
  );
  // Sin sesión y sin confirmar la edad, la puerta única llevaría al login.
  sustituir(
    path.join(destino, 'src/app/_layout.tsx'),
    "(__DEV__ && segments[0] === 'kit')",
    "segments[0] === 'gafas-lab' || (__DEV__ && segments[0] === 'kit')",
  );
  sustituir(
    path.join(destino, 'src/components/EdadMinima.tsx'),
    "if (routeName === 'login' ||",
    "if (routeName === 'gafas-lab' || routeName === 'login' ||",
  );
  // Sin claves reales: src/lib/supabase.ts solo exige que existan.
  fs.writeFileSync(
    path.join(destino, '.env.local'),
    'EXPO_PUBLIC_SUPABASE_URL=https://lab.invalid\nEXPO_PUBLIC_SUPABASE_KEY=sin-clave\n',
  );
}

function insertar(texto, ancla, nuevo) {
  if (!ancla.test(texto)) morir(`project.pbxproj no tiene lo esperado: ${ancla}`);
  return texto.replace(ancla, (hallado) => `${hallado}${nuevo}`);
}

/**
 * Pone DAT también en el target de la app. El pod NivlMeta es estático y el SDK son
 * frameworks dinámicos: spm_dependency enlaza, pero nadie los empotra, y la app muere
 * al arrancar con "Library not loaded: @rpath/MWDATCore.framework/MWDATCore".
 */
function empotrarDat(texto) {
  if (texto.includes(DAT_URL)) return texto;
  const paquete = 'D47000000000000000000000';
  const id = (prefijo, i) => `${prefijo}${String(i).padStart(22, '0')}`;
  const objetos = DAT_PRODUCTOS.map(
    (nombre, i) => `
		${id('D1', i)} /* ${nombre} in Frameworks */ = {isa = PBXBuildFile; productRef = ${id('D2', i)} /* ${nombre} */; };
		${id('D2', i)} /* ${nombre} */ = {
			isa = XCSwiftPackageProductDependency;
			package = ${paquete} /* XCRemoteSwiftPackageReference "meta-wearables-dat-ios" */;
			productName = ${nombre};
		};`,
  ).join('');
  const paqueteObjeto = `
		${paquete} /* XCRemoteSwiftPackageReference "meta-wearables-dat-ios" */ = {
			isa = XCRemoteSwiftPackageReference;
			repositoryURL = "${DAT_URL}";
			requirement = {
				kind = exactVersion;
				version = ${DAT_VERSION};
			};
		};`;
  const enFase = DAT_PRODUCTOS.map(
    (nombre, i) => `\n				${id('D1', i)} /* ${nombre} in Frameworks */,`,
  ).join('');
  const dependencias = DAT_PRODUCTOS.map((nombre, i) => `${id('D2', i)} /* ${nombre} */, `).join('');

  let salida = insertar(texto, /objects = \{/, objetos + paqueteObjeto);
  salida = insertar(salida, /isa = PBXFrameworksBuildPhase;\s+buildActionMask = \d+;\s+files = \(/, enFase);
  salida = insertar(salida, /isa = PBXNativeTarget;/, `\n			packageProductDependencies = (${dependencias});`);
  return insertar(salida, /isa = PBXProject;/, `\n			packageReferences = (${paquete} /* XCRemoteSwiftPackageReference "meta-wearables-dat-ios" */, );`);
}

/**
 * El SDK de iOS 27 exige UIScene: compilada con Xcode 27, la plantilla de Expo 54 muere
 * en el arranque (UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption). No tiene
 * que ver con DAT. El arranque de React Native pasa del AppDelegate a la escena.
 */
function adoptarEscenas(ios) {
  const nombre = fs.readdirSync(ios).find((f) => f.endsWith('.xcodeproj')).replace('.xcodeproj', '');
  const ruta = path.join(ios, nombre, 'AppDelegate.swift');
  const texto = fs.readFileSync(ruta, 'utf8');
  if (texto.includes('class SceneDelegate')) return;
  const arranque = /    window = UIWindow\(frame: UIScreen\.main\.bounds\)\n    factory\.startReactNative\(\n      withModuleName: "main",\n      in: window,\n      launchOptions: launchOptions\)\n/;
  if (!arranque.test(texto)) morir('AppDelegate.swift no tiene el arranque esperado');
  fs.writeFileSync(
    ruta,
    `${texto.replace(arranque, '')}
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let escena = scene as? UIWindowScene,
      let app = UIApplication.shared.delegate as? AppDelegate
    else { return }
    let ventana = UIWindow(windowScene: escena)
    window = ventana
    app.window = ventana
    var opciones: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url { opciones[.url] = url }
    app.reactNativeFactory?.startReactNative(
      withModuleName: "main",
      in: ventana,
      launchOptions: opciones)
    self.scene(scene, openURLContexts: connectionOptions.urlContexts)
  }

  // Con escenas, iOS ya no llama a application(_:open:options:): se reenvía a mano.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let app = UIApplication.shared.delegate as? AppDelegate else { return }
    for contexto in URLContexts {
      _ = app.application(UIApplication.shared, open: contexto.url, options: [:])
    }
  }
}
`,
  );
}

function trasPrebuild(destino) {
  if (!fs.existsSync(path.join(destino, MARCA))) morir(`${destino} no es una variante interna`);
  const ios = path.join(destino, 'ios');
  const propiedades = path.join(ios, 'Podfile.properties.json');
  escribirJson(propiedades, { ...leerJson(propiedades), 'ios.deploymentTarget': IOS_MINIMO });
  const proyecto = fs.readdirSync(ios).find((f) => f.endsWith('.xcodeproj'));
  if (!proyecto) morir('no hay .xcodeproj: ¿se ha hecho el prebuild?');
  const pbx = path.join(ios, proyecto, 'project.pbxproj');
  fs.writeFileSync(
    pbx,
    empotrarDat(
      fs
        .readFileSync(pbx, 'utf8')
        .replace(/IPHONEOS_DEPLOYMENT_TARGET = [\d.]+;/g, `IPHONEOS_DEPLOYMENT_TARGET = ${IOS_MINIMO};`),
    ),
  );
  adoptarEscenas(ios);
  console.log(`Listo: iOS ${IOS_MINIMO} y DAT ${DAT_VERSION} en ${proyecto}; Podfile.properties.json al día.`);
}

const argumentos = process.argv.slice(2);
const soloTras = argumentos.includes('--tras-prebuild');
const [bruto] = argumentos.filter((a) => !a.startsWith('--'));
if (!bruto) morir('falta el directorio de destino');

const destino = real(bruto);
validarDestino(destino);

if (soloTras) {
  trasPrebuild(destino);
} else {
  copiarRepo(destino);
  enlazarDependencias(destino);
  activarModulo(destino);
  ajustarAppJson(destino);
  anadirRutaLab(destino);
  console.log(`Variante interna lista en ${destino}`);
}
