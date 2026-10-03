// Metro no invalida su caché al cambiar variables de entorno: el portal de
// creadores (EXPO_PUBLIC_SITIO=creadores) y la app comparten código, así que
// la caché se separa por sitio para que un export no salga con el árbol del otro.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.cacheVersion = `sitio:${process.env.EXPO_PUBLIC_SITIO ?? 'app'}`;

module.exports = config;
