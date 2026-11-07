// NIVL · Ciclo de vida por escenas (UIScene) en iOS.
//
// Por qué: compilada con el SDK de iOS 27 (Xcode 27), una app que no adopta
// UIScene muere al arrancar en iOS 27 (EXC_BREAKPOINT en
// `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`). Se ha
// visto en el simulador del iPhone Duo y en el del iPad mini (iOS 27.2). La
// plantilla de Expo SDK 54 crea la ventana en el AppDelegate, sin escenas.
// Además, las escenas son lo que da ventanas redimensionables de verdad en
// iPad (Split View, Stage Manager), en el Mac («Designed for iPad») y en
// Vision Pro, y lo que deja al iPhone Duo pasar de pantalla sin relanzar.
//
// Qué hace (CNG: ios/ no está en el repo, esto se aplica en cada prebuild):
//  1. Info.plist: UIApplicationSceneManifest con una sola escena (sin
//     multiventana) y la clase `SceneDelegate`.
//  2. AppDelegate.swift: deja de crear la ventana y arrancar React Native al
//     lanzar; guarda las opciones de arranque.
//  3. Añade `SceneDelegate` al final de AppDelegate.swift (sin tocar el
//     .xcodeproj): crea la ventana de la escena, arranca React Native en ella
//     y reenvía al AppDelegate los enlaces (esquema nivl:// y enlaces
//     universales) para que RCTLinkingManager y Expo los sigan recibiendo,
//     también en frío (van en las opciones de arranque).
//
// Si una versión de Expo trae escenas de serie, este plugin sobra: el paso 2
// falla a propósito si no encuentra el bloque de la plantilla, para que se
// note en el prebuild y no se aplique a medias.

const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const BLOQUE_VENTANA = /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n\s*withModuleName: "main",\n\s*in: window,\n\s*launchOptions: launchOptions\)\n#endif/;

const MARCA = '// NIVL: escenas (plugins/withEscenas.js)';

const ESCENA = `
${MARCA}
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else { return }
    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    // Un enlace que abre la app en frío llega aquí y no a application(_:open:):
    // va en las opciones de arranque, que es donde lo busca Linking.getInitialURL.
    var opciones = appDelegate.opcionesDeArranque ?? [:]
    if let url = connectionOptions.urlContexts.first?.url {
      opciones[.url] = url
    }
    if let actividad = connectionOptions.userActivities.first {
      opciones[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType: actividad.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": actividad,
      ]
    }
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: opciones)
  }

  // Con la app abierta, los enlaces llegan a la escena: se reenvían al AppDelegate.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let contexto = URLContexts.first else { return }
    var opciones: [UIApplication.OpenURLOptionsKey: Any] = [:]
    if let origen = contexto.options.sourceApplication {
      opciones[.sourceApplication] = origen
    }
    _ = UIApplication.shared.delegate?.application?(UIApplication.shared, open: contexto.url, options: opciones)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = UIApplication.shared.delegate?.application?(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;

function conEscenasEnAppDelegate(contenido) {
  if (contenido.includes(MARCA)) return contenido;
  if (!BLOQUE_VENTANA.test(contenido)) {
    throw new Error('withEscenas: AppDelegate.swift no tiene el bloque de ventana de la plantilla de Expo SDK 54. Revisa el plugin.');
  }
  let s = contenido.replace(
    BLOQUE_VENTANA,
    '    // La ventana y React Native los arranca SceneDelegate (escenas, iOS 27).\n    opcionesDeArranque = launchOptions',
  );
  s = s.replace(
    '  var reactNativeFactory: RCTReactNativeFactory?\n',
    '  var reactNativeFactory: RCTReactNativeFactory?\n  var opcionesDeArranque: [UIApplication.LaunchOptionsKey: Any]?\n',
  );
  return s + ESCENA;
}

module.exports = function withEscenas(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
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
    return c;
  });
  return withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') {
      throw new Error('withEscenas: solo sabe tocar un AppDelegate en Swift.');
    }
    c.modResults.contents = conEscenasEnAppDelegate(c.modResults.contents);
    return c;
  });
};

module.exports.conEscenasEnAppDelegate = conEscenasEnAppDelegate;
