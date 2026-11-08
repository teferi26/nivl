// Metro no invalida su caché al cambiar variables de entorno: el portal de
// creadores (EXPO_PUBLIC_SITIO=creadores) y la app comparten código, así que
// la caché se separa por sitio para que un export no salga con el árbol del otro.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Lo mismo con la galería del preview web (EXPO_PUBLIC_GALERIA, src/lib/galeria.ts).
config.cacheVersion = `sitio:${process.env.EXPO_PUBLIC_SITIO ?? 'app'}:galeria:${process.env.EXPO_PUBLIC_GALERIA ?? '0'}`;

module.exports = config;
