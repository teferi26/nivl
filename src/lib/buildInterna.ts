// NIVL · Build interna de TestFlight (perfil `interno` de eas.json).
//
// Solo para que Teferi vea lo nuevo en su iPhone: con
// EXPO_PUBLIC_NIVL_BUILD_INTERNA=1 (se fija al compilar) los interruptores
// booleanos van encendidos y se abre la galería de IRON. NUNCA se envía a
// revisión ni a la tienda: el perfil `production` no lleva la variable y el
// canal `interno` no recibe actualizaciones OTA.
//
// 1.0.11, interruptores por versión (0085): lo que se enciende aquí son los
// campos de `Flags` (flagsEstado.ts → conInterna), que en esta versión salen
// de las claves `modos_1011`, `idiomas_1011`, `prueba_auto_1011` y
// `valoracion_1011` (flagsmath.ts → CLAVE_SERVIDOR). Las claves viejas de la
// 1.0.10 no se leen ni se encienden nunca. `analitica_1011` y `opinion_1011`
// (flagsServidor.ts) NO se fuerzan: siguen al servidor, también aquí.

export const BUILD_INTERNA = process.env.EXPO_PUBLIC_NIVL_BUILD_INTERNA === '1';
