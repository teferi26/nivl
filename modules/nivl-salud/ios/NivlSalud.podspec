# NIVL · Apple Salud y GPS del iPhone (HealthKit y CoreLocation). Módulo local
# de Expo: lo enlaza el autolinking desde modules/. Solo iOS.
Pod::Spec.new do |s|
  s.name           = 'NivlSalud'
  s.version        = '1.0.0'
  s.summary        = 'Salud y GPS del iPhone para NIVL'
  s.description    = 'Lee Apple Salud, mide entrenos con el GPS del iPhone y los guarda en Salud.'
  s.author         = 'NIVL'
  s.homepage       = 'https://nivl.app'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'HealthKit', 'CoreLocation'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
