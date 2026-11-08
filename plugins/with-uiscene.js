// Xcode 27: una app enlazada con el SDK 27 debe usar el ciclo de vida UIScene o
// se cierra al abrir (___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption),
// y los pods con deployment target menor de 15 ya no compilan. La plantilla de
// Expo SDK 54 no hace ninguna de las dos cosas; este plugin las añade en cada
// prebuild.
//
// Si una versión nueva de Expo cambia la plantilla, el prebuild falla aquí con
// un mensaje claro: es mejor eso que un binario que se cierra al abrir. Y si la
// plantilla ya trae SceneDelegate, este plugin sobra y hay que retirarlo.

const { withAppDelegate, withInfoPlist, withPodfile } = require('expo/config-plugins');

const POD_MIN_IOS = '15.1';
const MARCA_POD = '# with-uiscene: deployment target minimo de los pods';

const ARRANQUE_EN_APPDELEGATE =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;

const SCENE_DELEGATE = `
// Generado por plugins/with-uiscene.js. Todo enlace pasa por AppDelegate para
// que lo sigan recibiendo RCTLinkingManager y los subscribers de Expo.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene, let appDelegate else { return }

    // iOS puede desconectar la escena en segundo plano sin matar el proceso. Al
    // volver, React Native sigue vivo: se reutiliza su vista, no se arranca otra.
    let reactViewController = appDelegate.window?.rootViewController
    appDelegate.window?.rootViewController = nil

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    // expo-system-ui y expo-updates buscan la ventana en el AppDelegate.
    appDelegate.window = window

    connectionOptions.urlContexts.forEach(openURL)
    connectionOptions.userActivities.forEach(continueActivity)

    if let reactViewController {
      window.rootViewController = reactViewController
      window.makeKeyAndVisible()
    } else {
      appDelegate.reactNativeFactory?.startReactNative(
        withModuleName: "main",
        in: window,
        launchOptions: launchOptions(from: connectionOptions))
    }
  }

  func scene(_ scene: UIScene, openURLContexts urlContexts: Set<UIOpenURLContext>) {
    urlContexts.forEach(openURL)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    continueActivity(userActivity)
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    appDelegate?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    appDelegate?.applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    appDelegate?.applicationDidEnterBackground(UIApplication.shared)
  }

  private func openURL(_ context: UIOpenURLContext) {
    _ = appDelegate?.application(UIApplication.shared, open: context.url)
  }

  private func continueActivity(_ userActivity: NSUserActivity) {
    _ = appDelegate?.application(UIApplication.shared, continue: userActivity) { _ in }
  }

  // RCTLinkingManager lee de aquí el enlace que abrió la app (getInitialURL).
  private func launchOptions(
    from options: UIScene.ConnectionOptions
  ) -> [UIApplication.LaunchOptionsKey: Any]? {
    if let url = options.urlContexts.first?.url {
      return [.url: url]
    }
    if let activity = options.userActivities.first(where: {
      $0.activityType == NSUserActivityTypeBrowsingWeb
    }) {
      return [
        .userActivityDictionary: [
          UIApplication.LaunchOptionsKey.userActivityType.rawValue: activity.activityType,
          "UIApplicationLaunchOptionsUserActivityKey": activity,
        ] as [String: Any]
      ]
    }
    return nil
  }
}
`;

function adoptarEscena(appDelegate) {
  if (appDelegate.includes('class SceneDelegate')) return appDelegate;
  if (!ARRANQUE_EN_APPDELEGATE.test(appDelegate)) {
    throw new Error(
      '[with-uiscene] La plantilla de AppDelegate.swift ha cambiado: no encuentro el arranque de React Native que debo mover al SceneDelegate.',
    );
  }
  return appDelegate.replace(ARRANQUE_EN_APPDELEGATE, '\n') + SCENE_DELEGATE;
}

function subirPods(podfile) {
  if (podfile.includes(MARCA_POD)) return podfile;
  const cierreRnPostInstall =
    /(\n\s*react_native_post_install\([\s\S]*?\n\s*\)\n)/;
  if (!cierreRnPostInstall.test(podfile)) {
    throw new Error(
      '[with-uiscene] La plantilla del Podfile ha cambiado: no encuentro react_native_post_install.',
    );
  }
  return podfile.replace(
    cierreRnPostInstall,
    `$1
    ${MARCA_POD}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        actual = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if actual && Gem::Version.new(actual) < Gem::Version.new('${POD_MIN_IOS}')
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${POD_MIN_IOS}'
        end
      end
    end
`,
  );
}

module.exports = function withUiScene(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return c;
  });

  config = withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') {
      throw new Error('[with-uiscene] Solo sabe modificar un AppDelegate en Swift.');
    }
    c.modResults.contents = adoptarEscena(c.modResults.contents);
    return c;
  });

  return withPodfile(config, (c) => {
    c.modResults.contents = subirPods(c.modResults.contents);
    return c;
  });
};
