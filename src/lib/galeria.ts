// NIVL · ¿Se compila la galería del kit (/kit)? Puro.
//
// Siempre en desarrollo. En un build de release, SOLO en un export web hecho
// con `EXPO_PUBLIC_GALERIA=1`: el despliegue de PREVIEW de app.nivl.app
// (scripts/web/desplegar.sh con GALERIA=1) para revisar las pantallas con
// datos de demo sin cuenta. El de producción no la lleva: el valor se fija al
// compilar (acceso literal a process.env, como en sitio.ts) y en iOS y
// Android no cuenta nunca. La galería no lee ni escribe datos: solo pinta los
// `demo.tsx`.
export const GALERIA: boolean = __DEV__ || (process.env.EXPO_OS === 'web' && process.env.EXPO_PUBLIC_GALERIA === '1');
