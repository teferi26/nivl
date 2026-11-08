# Solo se enlaza en la variante interna: sin expo-module.config.json el autolinking
# no mira este directorio y el binario de producción no cambia.
Pod::Spec.new do |s|
  s.name           = 'NivlMeta'
  s.version        = '0.1.0'
  s.summary        = 'Puente de NIVL con las gafas Meta sobre DAT 1.0.1'
  s.description    = 'Puente de NIVL con las gafas Meta sobre el Wearables Device Access Toolkit'
  s.license        = { :type => 'UNLICENSED' }
  s.author         = 'NIVL'
  s.homepage       = 'https://nivl.app'
  s.platforms      = { :ios => '17.2' }
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,mm,swift}'

  # react_native_pods.rb define spm_dependency; lo aplica react_native_post_install.
  if respond_to?(:spm_dependency, true)
    spm_dependency(
      s,
      url: 'https://github.com/facebook/meta-wearables-dat-ios',
      requirement: { kind: 'exactVersion', version: '1.0.1' },
      products: ['MWDATCore', 'MWDATDisplay']
    )
  end
end
