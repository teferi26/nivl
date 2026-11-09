#!/bin/bash
# NIVL TV · Archiva para App Store Connect. Necesita tv/Config/Servidor.local.xcconfig
# con la URL, la clave pública y DEVELOPMENT_TEAM, y una sesión de Apple en Xcode.
#   tv/herramientas/archivar.sh [numero-de-compilacion]
# Sube el .ipa resultante con Transporter o con: xcrun altool --upload-app.
set -euo pipefail
cd "$(dirname "$0")/.."
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
BUILD="${1:-$(date +%Y%m%d%H%M)}"
SALIDA=".build/archivo"
rm -rf "$SALIDA"
xcodebuild -project NIVLTV.xcodeproj -scheme NIVLTV -configuration Release \
  -destination 'generic/platform=tvOS' -archivePath "$SALIDA/NIVLTV.xcarchive" \
  -allowProvisioningUpdates CURRENT_PROJECT_VERSION="$BUILD" archive
xcodebuild -exportArchive -archivePath "$SALIDA/NIVLTV.xcarchive" \
  -exportOptionsPlist Config/ExportOptions.plist -exportPath "$SALIDA/exportado" -allowProvisioningUpdates
echo "Listo: tv/$SALIDA/exportado (compilación $BUILD)"
