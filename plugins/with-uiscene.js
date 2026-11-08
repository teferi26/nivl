// Xcode 27: los pods con deployment target menor de 15 ya no compilan. Este
// plugin los sube a 15.1 en cada prebuild. El ciclo de vida UIScene lo pone
// plugins/withEscenas.js: dos plugins tocando el AppDelegate rompían el prebuild.

const { withPodfile } = require('expo/config-plugins');

const POD_MIN_IOS = '15.1';
const MARCA_POD = '# with-uiscene: deployment target minimo de los pods';

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
  return withPodfile(config, (c) => {
    c.modResults.contents = subirPods(c.modResults.contents);
    return c;
  });
};
