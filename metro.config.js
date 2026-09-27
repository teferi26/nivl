const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// This branch is a capture harness. Without the explicit flag, Metro behaves
// exactly like the release application and never loads the local fixtures.
if (process.env.EXPO_PUBLIC_SCREENSHOT_MODE === '1') {
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'react-native-purchases') {
      return { type: 'sourceFile', filePath: path.resolve(__dirname, 'scripts/screenshots/purchases.ts') };
    }
    const resolved = context.resolveRequest(context, moduleName, platform);
    if (resolved.type === 'sourceFile' && resolved.filePath.replaceAll('\\', '/').endsWith('/src/lib/supabase.ts')) {
      return { type: 'sourceFile', filePath: path.resolve(__dirname, 'scripts/screenshots/supabase.ts') };
    }
    return resolved;
  };
}

module.exports = config;
