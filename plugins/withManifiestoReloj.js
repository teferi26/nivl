// NIVL · El reloj declara su propio Privacy Manifest.
//
// Por qué: en cada prebuild, ios/NIVL/PrivacyInfo.xcprivacy (el del iPhone)
// acaba también en la fase de recursos del target NivlReloj. Como
// targets/watch/PrivacyInfo.xcprivacy entra solo en ese mismo target, Xcode
// falla con «Multiple commands produce .../NivlReloj.app/PrivacyInfo.xcprivacy».
//
// Qué hace: saca el del iPhone de los recursos de NivlReloj. Corre después del
// resto de la cadena de xcodeproj (espera a `nextMod`), porque ese recurso se
// añade en algún paso de esa misma cadena.

const { withBaseMod } = require('expo/config-plugins');

const TARGET_RELOJ = 'NivlReloj';
const NOMBRE = 'PrivacyInfo.xcprivacy';

function quitarDelReloj(project) {
  const objetos = project.hash.project.objects;
  const targets = objetos.PBXNativeTarget ?? {};
  const clave = Object.keys(targets).find(
    (k) => typeof targets[k] === 'object' && String(targets[k].name).replace(/"/g, '') === TARGET_RELOJ,
  );
  if (!clave) return;
  const fases = objetos.PBXResourcesBuildPhase ?? {};
  for (const { value } of targets[clave].buildPhases ?? []) {
    const fase = fases[value];
    if (!fase?.files) continue;
    const fuera = fase.files.filter((f) => String(f.comment).startsWith(NOMBRE));
    for (const f of fuera) {
      delete objetos.PBXBuildFile[f.value];
      delete objetos.PBXBuildFile[`${f.value}_comment`];
    }
    fase.files = fase.files.filter((f) => !String(f.comment).startsWith(NOMBRE));
  }
}

module.exports = (config) =>
  withBaseMod(config, {
    platform: 'ios',
    mod: 'xcodeproj',
    skipEmptyMod: true,
    isProvider: false,
    action: async ({ modRequest: { nextMod, ...modRequest }, ...resto }) => {
      const resultado = await nextMod({ modRequest, ...resto });
      quitarDelReloj(resultado.modResults);
      return resultado;
    },
  });
