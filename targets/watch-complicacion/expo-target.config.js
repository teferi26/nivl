// NIVL · Apple Watch: la complicación (WidgetKit en la esfera). Va dentro de
// la app del reloj y lee lo que esta guarda en el App Group.

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch-widget',
  name: 'NivlComplicacion',
  displayName: 'NIVL',
  bundleIdentifier: `${config.ios.bundleIdentifier}.watchkitapp.complicacion`,
  deploymentTarget: '11.0',
  colors: {
    $accent: '#EDEAE3',
    $widgetBackground: '#09090B',
  },
  frameworks: ['SwiftUI', 'WidgetKit'],
  entitlements: {
    'com.apple.security.application-groups': [`group.${config.ios.bundleIdentifier}`],
  },
});
