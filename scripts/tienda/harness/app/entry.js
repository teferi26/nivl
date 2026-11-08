// Punto de entrada del arnés. Solo existe en la copia de .tienda/cache.
if (process.env.EXPO_PUBLIC_SCREENSHOT_MODE !== '1') {
  throw new Error('El arnés de la tienda no puede arrancar fuera de su modo.');
}
require('./bootstrap');
require('expo-router/entry');
