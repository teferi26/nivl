# Fase 2 · Dominio nivl.app y cumplimiento de la 1.0.8

Redactado el 02/10/2026 por un subagente del Chat 1. Base: worktree `w2-chat1`, rama `winter2/chat1-compartir` @ `99729ea` (app 1.0.8, `supportsTablet: true`, `applinks:nivl.app`).
Solo lectura: no se ha tocado código, `app.json`, la web ni ninguna consola. Todo lo que exige una build, un dispositivo o una consola figura como **NO PROBADO**.

Leyenda: **PASS** · **FAIL** · **NO PROBADO** · **PROPUESTA** (la decide su dueño).
Dueños: **Coord.** (app.json, eas.json, configuración, consolas con el usuario) · **Chat 2** (pro, proplans, subscription, storepolicy, ProOffer) · **Chat 3** (auth, account, consent, health, social, photos, exporter, socialSafety) · **Chat 4** (resto de src/app y src/components, theme, notifications, nivl-web) · **Chat 5** (game, links y similares) · **Usuario**.

---

## Parte A · Migración a nivl.app

### A.1 Archivos de asociación en vivo (curl, 02/10/2026)

| URL | Código | Content-Type | Redirección | Contenido | Estado |
|---|---|---|---|---|---|
| `https://nivl.app/.well-known/apple-app-site-association` | 200 | `application/json` | no | `appID`/`appIDs` = `X5D8A42K4R.com.teferi.nivl`, `paths: ["/c/*"]`, `components: [{"/": "/c/*"}]` | **PASS** |
| `https://nivl.app/.well-known/assetlinks.json` | 200 | `application/json; charset=utf-8` | no | `com.teferi.nivl`, `sha256_cert_fingerprints: ["PENDIENTE_SHA256_FINGERPRINT"]` | **FAIL** (huella pendiente) |
| `https://www.nivl.app/.well-known/*` (los dos) | 308 → `https://nivl.app/...` | `text/plain` | sí | — | Correcto mientras **no** se declare `applinks:www.nivl.app`: Apple no sigue redirecciones. No añadir `www` a associatedDomains ni a intentFilters |
| `http://nivl.app/.well-known/apple-app-site-association` | 308 → https | — | sí | — | Irrelevante (Apple y Google piden https) |
| `https://nivl-web.vercel.app/.well-known/apple-app-site-association` | 200 | `application/json` | no | idéntico al de nivl.app | PASS |
| `https://nivl-web.vercel.app/.well-known/assetlinks.json` | 200 | `application/json; charset=utf-8` | no | huella PENDIENTE | FAIL |

Comprobaciones de terceros:
- **CDN de Apple** (`https://app-site-association.cdn-apple.com/a/v1/nivl.app`): 200 con el mismo JSON. Apple ya lo ha cacheado, así que la 1.0.8 verificará `applinks:nivl.app` al instalarse. **PASS**.
- **Google Digital Asset Links API** (`statements:list?source.web.site=https://nivl.app`): `ERROR_CODE_MALFORMED_CONTENT` («malformed cert fingerprint: PENDIENTE_SHA256_FINGERPRINT»). Con `autoVerify: true`, la verificación de App Links **falla** hasta que se ponga la huella real. **FAIL** · Chat 4 (archivo) + Usuario/Coord. (sacar la huella de Play Console → Integridad de la app → firma de apps; añadir también la de la clave de subida de EAS si se distribuyen builds fuera de Play).
- Cosmético: el `comment` del AASA dice «Enlace de creador nivl-web.vercel.app/c/CODIGO» (`nivl-web/.well-known/apple-app-site-association:10`). Cambiar a `nivl.app/c/CODIGO` · Chat 4.
- Páginas: `/`, `/privacidad`, `/terminos`, `/soporte`, `/borrar-cuenta` y `/c/TEST` responden 200 en **los dos** dominios. `/banco-ok` da 404 en los dos (ver A.2).

Formato propuesto para assetlinks (Chat 4, cuando el usuario dé la huella):

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.teferi.nivl",
    "sha256_cert_fingerprints": [
      "AA:BB:...:FF (clave de firma de Play App Signing)",
      "11:22:...:99 (clave de subida de EAS, opcional)"
    ]
  }
}]
```

### A.2 URLs hardcodeadas en el worktree (sin `docs/` ni `node_modules`)

| Archivo:línea | Valor actual | Dueño | Sustitución propuesta |
|---|---|---|---|
| `src/lib/proplans.ts:426` | `terminos: 'https://nivl-web.vercel.app/terminos'` | Chat 2 | `'https://nivl.app/terminos'` |
| `src/lib/proplans.ts:427` | `privacidad: 'https://nivl-web.vercel.app/privacidad'` | Chat 2 | `'https://nivl.app/privacidad'` |
| `src/lib/socialmath.ts:236` | `export const URL_NIVL = 'https://nivl-web.vercel.app'` | Chat 3 (social) | `'https://nivl.app'` (`DOMINIO_NIVL`, l. 239, se deriva solo → `nivl.app`) |
| `src/lib/socialmath.ts:238` | comentario `"nivl-web.vercel.app"` | Chat 3 | `"nivl.app"` |
| `src/lib/__tests__/socialmath.test.ts:231` | `'… · https://nivl-web.vercel.app'` | Chat 3 | `'… · https://nivl.app'` (va en el mismo commit que l. 236 o el test falla) |
| `src/lib/socialSafety.ts:15` | `SOCIAL_SUPPORT_URL = 'https://nivl-web.vercel.app/soporte'` | Chat 3 | `'https://nivl.app/soporte'` |
| `src/lib/consentmath.ts:9` | comentario con `nivl-web.vercel.app/privacidad` | Chat 3 | `nivl.app/privacidad` (no cambia el texto del consentimiento: no sube `AI_CONSENT_VERSION`) |
| `src/lib/creatormath.ts:31` | `return \`nivl://c/${…}\`` (esquema propio, no enlace universal) | Chat 5 (links; creadores no figura en el reparto: confirmar con coord.) | **PROPUESTA**: `\`https://nivl.app/c/${…}\`` para que el enlace compartido abra la app si está instalada y la web `/c/CODIGO` si no. Actualizar `creatormath.test.ts:74-75`. Requiere que la ruta `src/app/c/[code].tsx` siga resolviendo `/c/CODIGO` (lo hace: expo-router mapea el path del enlace universal igual que el del esquema) |
| `scripts/setup-banco.mjs:144` | `redirect: 'https://nivl.app/banco-ok'` | Coord. | Ya usa nivl.app, pero `/banco-ok` da **404** en los dos dominios. O se crea la página (Chat 4) o se cambia a una existente. Script local, no afecta a la tienda |
| `app.json:14` | `"applinks:nivl.app", "applinks:nivl-web.vercel.app"` | Coord. | Ver A.3 |
| `app.json:37` | intent filter `host: nivl.app`, `pathPrefix: /c/` | Coord. | Ver A.3 |
| `nivl-web/terminos.html:115` | texto visible `nivl-web.vercel.app/soporte` (el `href` ya es relativo) | Chat 4 | `nivl.app/soporte` |
| `nivl-web/.well-known/apple-app-site-association:10` | comment | Chat 4 | ver A.1 |

Sin cambio necesario (consumen `LEGAL_URLS`, se arreglan solos al cambiar `proplans.ts`): `src/app/login.tsx:294-295,362,371` (Chat 3), `src/app/(tabs)/perfil.tsx:897,905` (Chat 4), `src/components/ProOffer.tsx:583,592,604` (Chat 2), `ConsentimientoSalud.tsx:117` y `ConsentimientoIA.tsx:114` (Chat 3), `amigos.tsx:400-401` (consume `SOCIAL_SUPPORT_URL`). `src/lib/__tests__/validation.test.ts:15` usa `gladiador@nivl.app` como correo de prueba: no tocar. No existe ninguna constante `supportUrl` en el código.

Todo lo anterior es JS: puede salir por OTA sobre 1.0.7, pero **no conviene durante la revisión de 1.0.7** (el revisor podría ver URLs que no casan con la ficha). Lo limpio es meterlo en la 1.0.8 y que las URLs de la ficha cambien a la vez (A.4). La web en `nivl-web.vercel.app` debe seguir viva al menos hasta que no queden binarios 1.0.7 en uso (los enlaces viejos y las tarjetas ya compartidas apuntan ahí).

### A.3 app.json (diff PROPUESTO para el coordinador)

Estado actual:
- `scheme: "nivl"` — PASS (lo usan `nivl://c/…` y el retorno de OAuth).
- `ios.associatedDomains: ["applinks:nivl.app", "applinks:nivl-web.vercel.app"]` — PASS. Mantener los dos en 1.0.8: el AASA de vercel es válido y así los enlaces ya compartidos con el dominio viejo siguen abriendo la app. Retirar `nivl-web.vercel.app` en una versión posterior.
- `android.intentFilters`: un único filtro `autoVerify: true` con `https://nivl.app/c/`. Bien formado, pero **no verificará** hasta la huella (A.1). No incluye `nivl-web.vercel.app`; no añadirlo (otro dominio con autoVerify obliga a que **todos** verifiquen en Android < 12).
- `permissions` y `blockedPermissions` con duplicados; **falta** bloquear `AD_ID`.
- `orientation: "portrait"` con `supportsTablet: true`: ver B.1 (iPad).

```diff
       "permissions": [
         "android.permission.POST_NOTIFICATIONS",
-        "android.permission.SCHEDULE_EXACT_ALARM",
-        "android.permission.POST_NOTIFICATIONS",
         "android.permission.SCHEDULE_EXACT_ALARM"
       ],
       "blockedPermissions": [
         "android.permission.RECORD_AUDIO",
-        "android.permission.RECORD_AUDIO"
+        "com.google.android.gms.permission.AD_ID"
       ]
```

Si la 1.0.8 trae **dictado por voz** (STT con micrófono), el bloque cambia (B.4): quitar `RECORD_AUDIO` de `blockedPermissions`, poner `microphonePermission` con texto en el plugin de `expo-image-picker` o en el plugin de la librería de voz, y añadir en `ios.infoPlist`:

```diff
       "infoPlist": {
         "NSCameraUsageDescription": "…",
         "NSPhotoLibraryUsageDescription": "…",
+        "NSMicrophoneUsageDescription": "NIVL usa el micrófono solo mientras mantienes pulsado el botón de dictar, para pasar tu voz a texto.",
+        "NSSpeechRecognitionUsageDescription": "NIVL convierte tu voz en texto para escribir al coach o en tu diario. El audio no se guarda.",
         "ITSAppUsesNonExemptEncryption": false
       },
```

(El texto de `NSSpeechRecognitionUsageDescription` debe decir la verdad sobre dónde se procesa: si se usa el reconocedor de Apple en servidor, el audio sale a Apple; si es `requiresOnDeviceRecognition`, no. Lo decide quien implemente la voz.) **TTS con `expo-speech` no pide ningún permiso.** Hoy no hay ninguna librería de voz en `package.json`.

Todo cambio de `app.json` exige binario nuevo (es la 1.0.8, no OTA).

### A.4 URLs de App Store Connect (privacidad, soporte, marketing)

- **Durante la revisión de 1.0.7: no tocar.** Siguen en `nivl-web.vercel.app`, igual que el binario 1.0.7 y las notas de revisión. Cambiarlas a mitad de revisión crea una incoherencia gratuita y la URL de privacidad del nivel de app cambia para todas las versiones.
- **Cuándo cambiarlas:** al preparar la versión 1.0.8 en ASC, **en el mismo envío** en que sube el binario 1.0.8 con `LEGAL_URLS` en nivl.app. Orden: (1) 1.0.7 aprobada y publicada; (2) crear la versión 1.0.8; (3) cambiar URL de soporte y marketing (son de la versión) a `https://nivl.app/soporte` y `https://nivl.app`; (4) cambiar la URL de la política de privacidad (es de la app) a `https://nivl.app/privacidad`; (5) en Play, lo mismo en la ficha y en Data Safety (URL de borrado: `https://nivl.app/borrar-cuenta`). Dueño: Coord. + Usuario.
- Requisito previo: que `nivl.app/privacidad`, `/soporte` y `/borrar-cuenta` sean idénticas a las de vercel (hoy responden 200; el contenido lo garantiza Chat 4).

---

## Parte B · Cumplimiento de la 1.0.8

Fuentes oficiales consultadas el 02/10/2026:
- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/ (la página no muestra fecha de actualización en el extracto obtenido).
- Especificación de capturas: https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/
- Límites de metadatos: https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information
- Ofertas de suscripción (códigos de oferta y referidos): https://developer.apple.com/app-store/subscriptions/
- iPad, fin de `UIRequiresFullScreen` (TN3192): https://developer.apple.com/documentation/technotes/tn3192-migrating-your-app-from-the-deprecated-uirequiresfullscreen-key (el cuerpo no se pudo extraer; contexto en https://developer.apple.com/forums/thread/793406)
- Micrófono y voz: https://developer.apple.com/documentation/bundleresources/information-property-list/nsspeechrecognitionusagedescription
- Play, recursos gráficos de la ficha: https://support.google.com/googleplay/android-developer/answer/9866151
- Play, pruebas cerradas: https://support.google.com/googleplay/android-developer/answer/14151465 (resumido en `winter-chat1/docs/release-audit/play-checklist.md`)

### B.1 iPad (2.4.1, 4.2 y capturas) — el cambio más grande de la 1.0.8

`supportsTablet: true` cambia la naturaleza de la app: deja de ser «app de iPhone en modo compatibilidad» y pasa a ser app nativa de iPad. Consecuencias:

| # | Punto | Estado | Detalle | Dueño |
|---|---|---|---|---|
| B1.1 | Capturas de iPad 13" | **FAIL** (no existen) | «Required if app runs on iPad». 2064 × 2752 (o 2048 × 2732) en vertical; de 1 a 10; sin alfa. Sin ellas ASC no deja enviar | Chat 1 + Coord. |
| B1.2 | Orientación en iPad | **NO PROBADO / riesgo alto** | Desde iPadOS 26 se ignora `UIRequiresFullScreen` y el sistema avisa de que habrá que admitir todas las orientaciones; las ventanas son redimensionables (Split View, Stage Manager, de ~320 pt a 1366 pt). El `orientation: "portrait"` de `app.json` **no garantiza** vertical en iPad. Hay que ver el `Info.plist` generado (`UISupportedInterfaceOrientations~ipad`) en el artefacto del workflow de CI o con un `expo prebuild` en una carpeta temporal | Coord. (verificar) |
| B1.3 | Diseño a pantalla completa y en ventana estrecha | **NO PROBADO** | Apple revisa en iPad. Debe verse bien a 1024-1366 pt de ancho (columnas centradas con ancho máximo, nada estirado a todo lo ancho), en apaisado, en Split View 1/3 (~320-375 pt) y al redimensionar en caliente. Pantallas con `useWindowDimensions`/orientación: `(tabs)/index.tsx`, `(tabs)/perfil.tsx`, `avances.tsx`, `diario.tsx`, `ShareCardSemana.tsx`. Revisar hojas (`CompletarSheet`), pie fijo del onboarding, `ProOffer`, teclado con teclado físico | Chat 4 (UI) con Chats 2/3 en sus pantallas |
| B1.4 | Funcionalidad completa en iPad | **NO PROBADO** | Login, compra (StoreKit en iPad), restaurar, borrar cuenta, cámara/fotos, notificaciones, compartir tarjeta (`expo-sharing` en iPad necesita ancla del popover: probar que no se cuelga) | Coord. (QA) |
| B1.5 | Ficha y notas de revisión | PROPUESTA | Quitar de las notas de revisión la frase de «iPhone compatibility mode» de `matriz-dispositivos.md` (deja de ser verdad). Indicar «Reviewed on iPad [modelo/iPadOS]» solo si se ha probado | Chat 1 |
| B1.6 | Alternativa | PROPUESTA | Si no da tiempo a B1.2-B1.4 con calidad, volver a `supportsTablet: false` en 1.0.8 y dejar el iPad para 1.0.9. Una app de iPad que se ve mal se rechaza por 4.2/2.1 y además se queda con malas reseñas | Coord. (decisión) |

### B.2 Checklist por directriz

| # | Directriz | Punto | Estado | Acción | Dueño |
|---|---|---|---|---|---|
| 1 | 4.2 Funcionalidad mínima | App nativa con juego, coach, módulos | PASS | Nada; cuidar que las capturas de iPad no parezcan una web | — |
| 2 | 2.3.3 Capturas | «Screenshots should show the app in use», no portada ni login | NO PROBADO | Escenas reales (lista en B.3) | Chat 1 |
| 3 | 5.1.1 Privacidad y consentimiento | Hoja de consentimiento de IA (`ConsentimientoIA`, versión `2026-09-29`) y de salud (`ConsentimientoSalud`, `requireHealthConsent` en `photos.ts`) | PASS en código | Comprobar que las URLs de la hoja apuntan a nivl.app en 1.0.8 y que la política de nivl.app dice lo mismo | Chat 3 + Chat 4 |
| 4 | 5.1.1(iv) Permisos | «must respect the user's permission settings»: cámara y fotos con texto de propósito | PASS | Si se añaden micrófono y voz, textos de propósito (A.3) y pedirlos solo al pulsar dictar | quien implemente la voz + Coord. |
| 5 | 5.1.3 Salud y fotos corporales | Datos de salud y fotos de progreso: no se usan para publicidad ni minería; solo mejora de la salud | PASS (no hay SDK de anuncios) | Mantener; en la etiqueta de privacidad de ASC declarar Salud y Fotos, «vinculados al usuario», no seguimiento. Si se añaden fotos corporales nuevas en 1.0.8, deben ir tras `requireHealthConsent` y fuera de cualquier tarjeta compartible por defecto | Chat 3 |
| 6 | 1.2 Contenido generado (duelos, ligas, amigos, ludus) | Filtro, denuncia con respuesta rápida, bloqueo y contacto publicado | PASS parcial en código: `amigos.tsx` tiene denunciar/bloquear (`reportSocialUser`, `blockSocialUser`, `REPORT_REASONS`) y soporte (`SOCIAL_SUPPORT_URL`) | **Cualquier pantalla nueva de duelos o ligas** de la 1.0.8 que muestre nombres, apodos o texto de otros usuarios debe llevar el mismo «Denunciar o bloquear» y filtrar los bloqueados. Nombres y apodos con filtro de palabras. Contacto: `nivl.app/soporte` | Chat 3 (social) + Chat 4/5 (pantallas) |
| 7 | 1.2 / IA generativa | Denuncia de respuestas del coach (`DenunciarIA.tsx`) | PASS en código | Mantener visible en Coach | Chat 3/4 |
| 8 | 3.1.1 Recompensas por invitar | ¿Días de Pro por referir? | **PROPUESTA (riesgo medio)** | Apple prohíbe «their own mechanisms to unlock content or functionality» (3.1.1) y obliga a desbloquear contenido de pago por IAP. Conceder Pro por el servidor sin pasar por StoreKit es la zona gris. La vía que Apple **avala de forma explícita** son los **códigos de oferta**: «Create a peer-to-peer member referral program that enables current subscribers to share an offer code and receive a benefit». Propuesta: (a) invitado: código de oferta de Apple / código promocional de Play (p. ej. 1 mes gratis de Pro); (b) quien invita: oferta promocional (hasta 10 por suscripción) o recompensa no monetaria (insignia, laurel, título). Evitar «X días de Pro» concedidos solo por base de datos a usuarios de iOS | Chat 2 + Chat 5 |
| 9 | 3.2.2(x) Incentivos prohibidos | No forzar ni premiar valorar, reseñar o descargar otras apps | Verificar | Ninguna recompensa (XP, Pro, insignia) por valorar, reseñar, compartir en redes como condición ni por instalar otra app. El aviso de valoración solo con `SKStoreReviewController`/`expo-store-review`, sin premio y sin preguntar antes «¿te gusta?» para filtrar. La recompensa por referir no puede depender de que el invitado valore | Chat 5 + Chat 4 |
| 10 | 5.6 Código de conducta | No manipular reseñas ni rankings; nada de patrones oscuros en el paywall | PASS (paywall con precios y legales) | Revisar que la invitación no ofrezca premio por reseñas ni por reclutar en masa | Chat 2 |
| 11 | 2.5.1 / 2.5.14 Voz | APIs públicas; consentimiento explícito e indicación visual o audible mientras se graba | NO APLICA hoy (no hay librería de voz) | Si llega STT: indicador de grabación visible (onda o punto rojo), grabar solo mientras se mantiene pulsado, `NSMicrophoneUsageDescription` + `NSSpeechRecognitionUsageDescription`, desbloquear `RECORD_AUDIO` en Android y declararlo en Data Safety y en la etiqueta de ASC (Audio). TTS con `expo-speech`: sin permisos; respetar el modo silencio y no hablar sin acción del usuario | quien implemente la voz + Coord. |
| 12 | Enlaces universales | `/c/*` en nivl.app | PASS iOS / FAIL Android (huella) | A.1 | Chat 4 + Usuario |
| 13 | Play: AD_ID | Declarar «no usa ID de publicidad» y bloquearlo | FAIL (no bloqueado) | Diff A.3 | Coord. |
| 14 | Play: tablet | Con target 36, en `sw ≥ 600dp` se ignora `portrait` | NO PROBADO | Probar apaisado en tablet. Las capturas de tablet de Play solo si se prueba de verdad (ver B.3) | Coord. |
| 15 | Play: prueba cerrada | 12 testers 14 días seguidos (cuenta personal reciente) | NO HECHO | Plan existente en `winter-chat1/docs/release-audit/play-checklist.md` §«Plan de la prueba cerrada»: abrir cuanto antes, reclutar 15 o más, registro privado de altas, uso diario real. Si la 1.0.8 es la build de la prueba cerrada, debe llevar ya la huella en assetlinks y `AD_ID` bloqueado | Usuario + Coord. |

### B.3 Capturas necesarias para la 1.0.8

**App Store (obligatorias):**

| Serie | Tamaño | Cantidad | Estado |
|---|---|---|---|
| iPhone 6,9" | 1320 × 2868 (también vale 1290 × 2796 o 1260 × 2736), vertical, sin alfa | 1-10 (recomendado 7, las de la 1.0.7 sirven si la UI no cambia; rehacer si cambian Hoy o Amigos) | Existe para 1.0.7 (`privado/appstore-capturas-1.0.7/`). Revisar |
| iPad 13" | 2064 × 2752 (o 2048 × 2732) vertical; opcional apaisado 2752 × 2064 | 1-10 (recomendado 6-7) | **No existe. Obligatoria** con `supportsTablet: true` |

Se capturan en un simulador o dispositivo **iPad Pro 13" (M4/M5) o iPad Air 13"** con la build 1.0.8 real y datos de la cuenta demo, sin marco de iPhone.

**Google Play:**

| Serie | Tamaño | Cantidad | Estado |
|---|---|---|---|
| Teléfono | 320-3840 px, lado mayor ≤ 2 × lado menor; para promoción, 4 o más a ≥ 1080 px | mín. 2, recomendado 4-8 a 1080 × 2400 aprox. | No existe (las de iOS tienen marco de iPhone) |
| Tablet 7" | 1080-7680 px, 9:16 o 16:9 | 4 o más | **Solo si se prueba en tablet**; si no, no subir |
| Tablet 10" | 1080-7680 px, 9:16 o 16:9 | 4 o más | Igual |
| Gráfico destacado | 1024 × 500, JPEG o PNG de 24 bits | 1 | No existe |

**Escenas (las mismas en todas las series, en este orden):**
1. Hoy: misiones del día con XP y racha (la promesa en una pantalla).
2. Completar misión: `CompletarSheet` abierta o el aviso de XP.
3. Coach: una conversación real que reorganiza el día (sin datos personales).
4. Progreso: nivel, estadísticas y avances (`avances.tsx`).
5. Amigos / duelos / ligas: ranking con laurel de Élite (mostrar a la vez el acceso a denunciar no es necesario, pero sí que no haya nombres reales).
6. Cuerpo: gimnasio o nutrición con los estudios (e1RM, tendencia de peso).
7. NIVL Pro: la oferta con precios (solo si la tienda está abierta; si no, sustituir por Diario o Contrato).
En iPad, la escena 3 o 4 en apaisado si B1.2 confirma que la app rota.

### B.4 ASO es-ES (límites oficiales)

| Campo | Límite | Nota |
|---|---|---|
| Nombre | 30 caracteres | «NIVL» + descriptor, p. ej. «NIVL: hábitos y disciplina» (26) |
| Subtítulo | 30 caracteres | p. ej. «Tu coach de IA en la arena» (26) |
| Palabras clave | **100 bytes** (no caracteres: cada tilde o ñ ocupa 2 bytes), separadas por comas sin espacios, sin repetir nombre ni subtítulo | |
| Texto promocional | 170 caracteres; se cambia **sin** versión nueva | Útil para anunciar iPad y el Winter Arc sin enviar build |
| Descripción | 4000 caracteres | No decir «optimizada para iPad» hasta B1.3 PASS |
| Novedades | 4000 caracteres | Obligatorio desde la 2.ª versión |
| Play: nombre / breve | 30 / 80 caracteres | |

---

## Resumen

- AASA en `nivl.app`: 200, `application/json`, sin redirección, appID `X5D8A42K4R.com.teferi.nivl`, `/c/*`; ya está en la CDN de Apple. `www` hace 308 (correcto si no se declara).
- `assetlinks.json` (en los dos dominios) sigue con `PENDIENTE_SHA256_FINGERPRINT`; la API de Google lo da por malformado → App Links sin verificar. Huella: Usuario; archivo: Chat 4.
- URLs que hay que cambiar a nivl.app: `proplans.ts:426-427` (Chat 2), `socialmath.ts:236` + test `:231`, `socialSafety.ts:15`, `consentmath.ts:9` (Chat 3), `terminos.html:115` y comentario del AASA (Chat 4). Propuesta: `enlaceCreador` → `https://nivl.app/c/…` (Chat 5). `/banco-ok` da 404.
- app.json: associatedDomains y intentFilters bien; quitar duplicados y bloquear `AD_ID`; si hay STT, micrófono y reconocimiento de voz (diff en A.3).
- ASC: URLs de privacidad, soporte y marketing a nivl.app **al crear la versión 1.0.8**, nunca durante la revisión de 1.0.7.
- iPad es el mayor riesgo: hacen falta capturas de 13" (2064 × 2752), y desde iPadOS 26 la app debe funcionar rotada y redimensionada; `orientation: portrait` no lo asegura. Si no da tiempo, volver a `supportsTablet: false`.
- Referidos: usar códigos de oferta de Apple (Apple los avala para «peer-to-peer member referral»), no días de Pro concedidos por la base de datos. Nada premiado por valorar o reseñar.
- UGC: duelos y ligas nuevos necesitan denunciar, bloquear y filtrar como `amigos.tsx`.
- Capturas: iPhone 6,9" (revisar las de 1.0.7), iPad 13" (nuevas), Play teléfono y gráfico 1024 × 500 (nuevos); tablet de Play solo si se prueba.
