// NIVL · Apple Watch: la app del reloj (SwiftUI, una sola app acompañante).
// La genera @bacons/apple-targets en `npx expo prebuild`; el código vive aquí,
// fuera de ios/ (CNG). Contrato con el iPhone: src/watch/contrato.ts.

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch',
  name: 'NivlReloj',
  displayName: 'NIVL',
  bundleIdentifier: '.watchkitapp',
  deploymentTarget: '11.0',
  icon: '../../assets/images/icon.png',
  colors: {
    $accent: '#FFFFFF',
  },
  frameworks: ['SwiftUI', 'WatchConnectivity', 'WidgetKit', 'UserNotifications', 'HealthKit', 'CoreLocation'],
  entitlements: {
    // La complicación lee lo que guarda la app del reloj.
    'com.apple.security.application-groups': [`group.${config.ios.bundleIdentifier}`],
    // Medir entrenos con HKWorkoutSession.
    'com.apple.developer.healthkit': true,
  },
});
