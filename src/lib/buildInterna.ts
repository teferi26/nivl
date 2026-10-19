// NIVL · Build interna de TestFlight (perfil `interno` de eas.json).
//
// Solo para que Teferi vea lo nuevo en su iPhone: con
// EXPO_PUBLIC_NIVL_BUILD_INTERNA=1 (se fija al compilar) los interruptores
// booleanos van encendidos y se abre la galería de IRON. NUNCA se envía a
// revisión ni a la tienda: el perfil `production` no lleva la variable y el
// canal `interno` no recibe actualizaciones OTA.

export const BUILD_INTERNA = process.env.EXPO_PUBLIC_NIVL_BUILD_INTERNA === '1';
