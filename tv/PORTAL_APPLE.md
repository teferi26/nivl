# Alta de NIVL TV en Apple

Lo que tiene que hacer el dueño en developer.apple.com y App Store Connect. Contrastado con la documentación de Apple el 8 de noviembre de 2026; lo que no se pudo contrastar va marcado **[sin contrastar]**. Nada de esto se ha probado todavía: no se ha firmado ni subido ningún binario de tvOS.

Antes de empezar, el servidor y el iPhone tienen que estar listos (`README.md`, pasos a, b y c). Apple revisa con el backend encendido.

## 1. Decisión: registro propio o añadir tvOS al de iOS

| | **A. App ID y registro propios** `com.teferi.nivl.tv` | **B. Plataforma tvOS en el registro** `com.teferi.nivl` |
|---|---|---|
| Bundle | El que ya tiene el proyecto | Hay que cambiar `PRODUCT_BUNDLE_IDENTIFIER` a `com.teferi.nivl` |
| Compra universal | No | Sí, en cuanto App Review aprueba dos plataformas |
| Ficha, nombre, valoraciones | Propias | Compartidas con iOS |
| Etiqueta de privacidad | Propia, ajustada a la TV | **[sin contrastar]** Apple describe una por app; sería la de iOS |
| Quitarlo luego | Se retira de la venta sin tocar iOS | Una vez universal, Apple no deja quitar una sola plataforma |

La Compra universal **exige el mismo bundle ID, Apple ID y SKU** que iOS, y un solo registro. Con otro bundle ID no hay Compra universal. Sirve para que quien paga una app no pague otra vez en otra plataforma y para compartir compras integradas.

**Recomendación: A.** La TV no vende nada: es gratis y lee datos de una cuenta que ya existe, así que la Compra universal no aporta casi nada. A cambio, A no toca el registro de iOS, que es el que cobra las suscripciones, no pide cambios en el proyecto y deja una etiqueta de privacidad propia. Lo que se pierde: una ficha aparte, y que quien tiene NIVL en el iPhone no vea la app de TV disponible sin más.

Ojo, es casi definitivo en los dos sentidos: Apple no fusiona registros separados. Para pasar de A a B habría que retirar la de TV de la venta, y se pierden sus valoraciones y las actualizaciones a quien la tenga.

## 2. developer.apple.com (Certificates, Identifiers & Profiles)

1. **Identifiers**, App IDs, tipo App, **Explicit**: `com.teferi.nivl.tv`.
2. **Capacidades: ninguna.** El proyecto no tiene archivo de entitlements. El Llavero sin grupo de acceso no pide capacidad, y no hay push, iCloud ni Iniciar sesión con Apple.
3. Certificado Apple Distribution: sirve el que haya; si no, lo crea Xcode con la firma automática. El proyecto ya usa `CODE_SIGN_STYLE = Automatic`, pero no fija equipo: hay que elegirlo en Xcode o pasar `DEVELOPMENT_TEAM`.
4. Un Apple TV físico solo hay que registrarlo para instalar desde Xcode. TestFlight no lo pide **[sin contrastar]**.

## 3. App Store Connect

**App nueva**, plataforma tvOS, bundle `com.teferi.nivl.tv`, SKU propio (`nivl-tv`). Si «NIVL» ya está cogido por la ficha de iOS, usa «NIVL TV» **[sin contrastar: Apple pide nombres únicos]**.

**Capturas.** Apple TV: 1920x1080 o 3840x2160, PNG o JPEG, sin canal alfa, de 1 a 10. Si la interfaz es la misma, basta la más grande. Están en `tv/capturas/`, a 3840x2160 y sin alfa. Apple pide que enseñen la app en uso, no solo el inicio de sesión (guideline 2.3.3), así que este orden: `arena`, `rutina-serie`, `rutina-descanso`, `semana`, `rutina-fin`, `cuenta`, `enlace`. Son datos inventados y el QR de `enlace` salió de un servidor local: no sirve en producción.

**URL de privacidad**: `https://nivl.app/privacidad` (la que ya usa la app). Comprueba que menciona la TV.

**Etiqueta de privacidad.** La TV manda al servidor el nombre del aparato, su token de sesión y la petición de datos. El servidor guarda nombre, huella del token y fechas de uso, ligados a la cuenta. Recibe y muestra entrenos, peso, XP y amigos. Propuesta prudente, a revisar por quien lleve lo legal:

- Identificadores: ID de usuario y de dispositivo, vinculados a la persona, para funcionalidad de la app.
- Salud y actividad física: declararla, vinculada, para funcionalidad. En sentido estricto la TV la lee y no la envía; marcarla es la opción honesta para una app de hábitos que enseña el peso.
- Sin seguimiento, sin publicidad.

**Cifrado.** Solo HTTPS del sistema. El Info.plist declara `ITSAppUsesNonExemptEncryption = NO`, así que no preguntará en cada build.

**Manifiesto de privacidad.** No hay `PrivacyInfo.xcprivacy`. Una búsqueda en `tv/NIVLTV` no encuentra `UserDefaults` ni las otras API de razón obligatoria, y no hay SDK de terceros. Si el validador lo pide, se añade.

## 4. Qué lleva ya el proyecto

- **Icono en capas y Top Shelf**: `App Icon & Top Shelf Image.brandassets`, generado con `tv/herramientas/generar-iconos.swift`. Dos capas (escudo con la N delante, fondo Ónix detrás), a 400x240, 800x480 y 1280x768; Top Shelf a 1920x720 y 2320x720, @1x y @2x, sin alfa.
- **Versión** 1.1.0, cifrado no exento declarado en el Info.plist (`ITSAppUsesNonExemptEncryption = NO`).
- **Archivo Release**: comprobado sin firma para `appletvos` (el catálogo compila y el Info.plist lleva icono y Top Shelf). La validación final de Apple solo se ve al subir.
- **Para archivar** necesitas `tv/Config/Servidor.local.xcconfig` con URL, clave pública y `DEVELOPMENT_TEAM`, y tu sesión de Apple en Xcode. Luego:

```bash
tv/herramientas/archivar.sh
```

## 5. Revisión: cómo probará Apple el enlace

Este es el punto delicado. Para llegar a cualquier pantalla con datos, la TV necesita que un iPhone con NIVL confirme el código.

Notas de revisión propuestas:

> NIVL for Apple TV shows the data of an existing NIVL account in read only mode. It needs no keyboard or password on the TV. To link: 1) Install NIVL on an iPhone (App Store) and sign in with the demo account below. Open the app twice so the latest update applies. 2) Open NIVL on Apple TV. A code and a QR appear. 3) Scan the QR with the iPhone camera and confirm that the code matches. The TV loads the account. To unlink, use Account, then Sign out.

Y además:

- **Cuenta de prueba** real en producción, con rutina para hoy, amigos e historial, creada a mano. Sus credenciales van en el campo de App Store Connect. **Nunca en el repo.**
- **Un vídeo corto** del enlace con iPhone y TV, enlazado en las notas.
- **La pantalla del iPhone tiene que estar publicada antes** de mandar la TV a revisión: en Perfil, Televisores, y en el QR.

Riesgos a tener claros:

- La guideline **4.2.3(i)** dice que una app debe funcionar sin requerir que se instale otra, y la **2.4.3** que el Apple TV se use sin más hardware que el mando. El enlace con el móvil es un patrón común, pero aquí **depende de la app de iPhone** y no hay alternativa web. Puede haber rechazo. El arreglo sería una página `https://nivl.app/tv/CODIGO`, con iniciar sesión en cualquier navegador (no existe; va en `nivl-web`).
- La guideline **2.1** admite un modo demo integrado en lugar de cuenta **con aprobación previa de Apple**. Hoy la demo no se compila en Release: habilitarla es un cambio de código y una decisión, no un ajuste.

## 6. TestFlight, firma y compilación

- TestFlight admite tvOS. Internos: hasta 100, sin revisión. Externos: el primer build pasa revisión beta. Cada build dura 90 días. El Apple TV necesita la app TestFlight.
- Apple exige **Xcode 26 o superior** para compilar apps de tvOS. Aquí se ha compilado para simulador con Xcode 27.2.
- **El CI no cubre tvOS.** `.github/workflows/ios-testflight.yml` solo construye la app de Expo con EAS. Hoy el binario se archiva a mano en un Mac. Tampoco vale EAS, que no conoce este proyecto.
- En un Mac: `tv/herramientas/archivar.sh`, y sube lo exportado con Transporter. También vale Xcode: destino «Any tvOS Device», Product, Archive, Distribute App.

## Fuentes

[Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) · [Add platforms](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-platforms/) · [Universal Purchase](https://developer.apple.com/support/universal-purchase/) · [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/) · [TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/) · [App privacy details](https://developer.apple.com/app-store/app-privacy-details/) · [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · [HIG App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons) · [HIG Top Shelf](https://developer.apple.com/design/human-interface-guidelines/top-shelf) · [Brand Assets (archivo)](https://developer.apple.com/library/archive/documentation/Xcode/Reference/xcode_ref-Asset_Catalog_Format/BrandAssetsType.html)
