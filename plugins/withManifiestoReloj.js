// NIVL · El reloj declara su propio Privacy Manifest.
//
// Por qué: en `pod install`, React Native agrega ios/NIVL/PrivacyInfo.xcprivacy
// (PrivacyManifestUtils) y lo añade a TODO target de tipo aplicación, también a
// NivlReloj. Como targets/watch/PrivacyInfo.xcprivacy entra solo en ese target,
// Xcode falla con «Multiple commands produce .../NivlReloj.app/PrivacyInfo.xcprivacy».
//
// Qué hace: justo después de react_native_post_install, saca ese recurso del
// target del reloj. El iPhone conserva su manifiesto agregado.

const { withPodfile } = require('expo/config-plugins');

const MARCA = '# NIVL: withManifiestoReloj';

const BLOQUE = `
    ${MARCA}
    installer.aggregate_targets.map(&:user_project).compact.uniq.each do |proyecto|
      reloj = proyecto.targets.find { |t| t.name == 'NivlReloj' }
      next unless reloj
      copias = reloj.resources_build_phase.files.select { |f| f.display_name == 'PrivacyInfo.xcprivacy' }
      copias.each { |f| reloj.resources_build_phase.remove_build_file(f) }
      proyecto.save unless copias.empty?
    end
`;

module.exports = (config) =>
  withPodfile(config, (c) => {
    if (c.modResults.contents.includes(MARCA)) return c;
    const llamada = /react_native_post_install\([\s\S]*?\n\s*\)\n/;
    if (!llamada.test(c.modResults.contents)) {
      throw new Error('withManifiestoReloj: no encuentro react_native_post_install en el Podfile');
    }
    c.modResults.contents = c.modResults.contents.replace(llamada, (m) => m + BLOQUE);
    return c;
  });
