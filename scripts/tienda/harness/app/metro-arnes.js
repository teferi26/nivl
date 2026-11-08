// Envuelve el metro.config.js del commit: sustituye Supabase, RevenueCat, avisos
// y expo/fetch por adaptadores locales. Solo se usa en la copia del arnés.
const path = require('node:path');

module.exports = function arnes(config, raiz) {
  const dir = path.join(raiz, 'scripts/tienda-arnes');
  const directos = {
    'expo-notifications': 'notifications.ts',
    'expo/fetch': 'fetch.ts',
    'react-native-purchases': 'purchases.ts',
  };
  // La caché de Metro no mira el entorno y aquí los EXPO_PUBLIC_ son otros.
  config.cacheVersion = 'arnes-tienda-1';
  const anterior = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (directos[moduleName]) {
      return { type: 'sourceFile', filePath: path.join(dir, directos[moduleName]) };
    }
    const resuelto = (anterior ?? context.resolveRequest)(context, moduleName, platform);
    if (resuelto.type === 'sourceFile' && resuelto.filePath.replaceAll('\\', '/').endsWith('/src/lib/supabase.ts')) {
      return { type: 'sourceFile', filePath: path.join(dir, 'supabase.ts') };
    }
    return resuelto;
  };
  return config;
};
