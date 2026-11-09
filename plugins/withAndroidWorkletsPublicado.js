// NIVL · Android: reanimated enlaza contra libworklets.so en una ruta fija.
//
// react-native-reanimated 4.1 importa la biblioteca desde
// `react-native-worklets/android/build/intermediates/cmake/<tipo>/obj/<abi>/`,
// pero con AGP 8.11 esa carpeta no recibe `libworklets.so` (se queda en
// `intermediates/cxx/`), y la compilación del AAB muere en ninja con
// «missing and no known rule to make it». Comprobado con las cuatro
// arquitecturas y con una sola. Aquí, al terminar la parte nativa de worklets,
// se publica la biblioteca donde reanimated la espera y se garantiza ese orden.
//
// Solo para compilar en local. En CI (EAS local en Linux) la carpeta ya se
// rellena sola, y con esta copia reanimated moría al enlazar con «undefined
// symbol: worklets::…» (run 42701320246); sin ella, la 1.0.11 compiló con estas
// mismas versiones.

const { withProjectBuildGradle } = require('expo/config-plugins');

const MARCA = '// NIVL: withAndroidWorkletsPublicado';

const BLOQUE = `
${MARCA}
if (System.getenv('CI') == null && System.getenv('EAS_BUILD') == null) subprojects { sub ->
  if (sub.name == 'react-native-worklets') {
    sub.afterEvaluate {
      [Debug: ['Debug', 'debug'], Release: ['RelWithDebInfo', 'release']].each { variante, carpetas ->
        // matching y no findByName: AGP aún no ha creado la tarea en este punto.
        sub.tasks.matching { it.name == "externalNativeBuild\${variante}" }.all { tarea ->
          tarea.doLast {
            def base = new File(sub.buildDir, 'intermediates')
            sub.fileTree(new File(base, "cxx/\${carpetas[0]}")) { include '*/obj/*/libworklets.so' }.each { so ->
              def destino = new File(base, "cmake/\${carpetas[1]}/obj/\${so.parentFile.name}")
              destino.mkdirs()
              sub.copy { from so; into destino }
            }
          }
        }
      }
    }
  }
  if (sub.name == 'react-native-reanimated') {
    sub.afterEvaluate {
      sub.tasks.matching { it.name.startsWith('buildCMake') }.all { t ->
        t.dependsOn(":react-native-worklets:externalNativeBuild\${t.name.contains('Debug') ? 'Debug' : 'Release'}")
      }
    }
  }
}
`;

module.exports = function withAndroidWorkletsPublicado(config) {
  return withProjectBuildGradle(config, (c) => {
    if (c.modResults.language !== 'groovy') throw new Error('withAndroidWorkletsPublicado: se esperaba build.gradle en Groovy');
    if (!c.modResults.contents.includes(MARCA)) c.modResults.contents += BLOQUE;
    return c;
  });
};
