# NIVL · puente con el Apple Watch (WatchConnectivity). Módulo local de Expo:
# lo enlaza el autolinking desde modules/. Solo iOS.
Pod::Spec.new do |s|
  s.name           = 'NivlWatch'
  s.version        = '1.0.0'
  s.summary        = 'Puente de NIVL con su app de Apple Watch'
  s.description    = 'Publica el estado del día en el reloj y recibe lo que pide.'
  s.author         = 'NIVL'
  s.homepage       = 'https://nivl.app'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WatchConnectivity'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
