# NIVL en el navegador (app.nivl.app)

Rama `nivl-1011/web-app`. La landing sigue en `nivl.app` (repo `nivl-web`); la app entera, con sesión real, se sirve como export estático de Expo (`web.output: single`) en un proyecto de Vercel aparte, **nivl-app**, del equipo `teferilaforga-gmailcoms-projects`.

Estado: **solo PREVIEW**. Producción (dominio, DNS, Supabase Auth y `--prod`) espera el OK de Teferi: ver §6.

Previews del 21/10/2026 (protegidos por Vercel Authentication: se abren con la sesión de Vercel del equipo):
- Como sería producción (sin galería): https://nivl-2w52osuv6-teferilaforga-gmailcoms-projects.vercel.app
- Con la galería `/kit` (datos de demo): https://nivl-imgy15wob-teferilaforga-gmailcoms-projects.vercel.app

Incidencia: el PRIMER despliegue del proyecto nuevo (`nivl-hk41gvmte…`, el mismo export sin galería) lo marcó Vercel como *Production* aunque no se pasó `--prod` (un proyecto sin producción manda ahí el primer `vercel deploy`). Solo tiene los alias `nivl-app.vercel.app` y `nivl-app-teferilaforga-gmailcoms-projects.vercel.app`: ni `app.nivl.app`, ni DNS, ni Supabase. El script ya pasa `--target preview` explícito. Si se quiere, se quitan esos dos alias desde el panel. Además, `vercel curl` creó un secreto de *Protection Bypass for Automation* en el proyecto `nivl-app` para poder probar el preview sin sesión de Vercel; se puede revocar en Settings, Deployment Protection.

## 1. Qué funciona en web y qué no

| Área | En el navegador | Cómo |
|---|---|---|
| Cuenta | Entrar, crear cuenta, recuperar contraseña, confirmar correo | Mismo `authFlow.ts` (PKCE). El verificador PKCE y la sesión van en `localStorage` (AsyncStorage web). Los enlaces del correo llevan a `https://app.nivl.app/auth/confirmar` y `/auth/restablecer` (`Linking.createURL` en web = origen + ruta): **hay que añadirlos a Supabase Auth** (§6). Como en el móvil, el enlace solo abre sesión en el navegador donde se pidió. |
| Hoy, hábitos, campañas, perfil, agenda | Igual que en la app | Barra inferior < 600, raíl 600 a 1023, barra lateral ≥ 1024 (ya existía). |
| Mundos IRON, FOCUS, WORK, FOUNDER y la rueda | Sí, con su barra lateral, acento y emblema | El gesto de la rueda funciona con ratón; sin hápticos. |
| Coach | Sí (chat, fotos con el selector del navegador) | Dictado: Web Speech API del navegador, con el permiso de red que ya pide la app. Voz: `speechSynthesis`. |
| Economía: importar CSV o PDF | Sí | `expo-document-picker` abre el selector del navegador; se lee el `blob:` local y se manda a la función como en el móvil. |
| FOCUS: pomodoro | Sí | Al acabar un bloque: **aviso en pantalla siempre** (`AvisosWeb`) y, con la pestaña oculta y permiso, **notificación del navegador**. El permiso se pide al pulsar Empezar (gesto), nunca al cargar. Campana con Web Audio. |
| Sonidos (rueda, fin de bloque) | Sí | Web Audio con los mismos `.m4a` (`src/lib/web/sonido.ts`), desbloqueado en el primer gesto. |
| Hápticos | No | `vibrar()` no hace nada en web (ya era así). |
| Push del coach y avisos programados (despertador, bloques del plan) | No | `registrarDispositivo` y el enrutado de notificaciones no corren en web. El coach te encuentra al abrir la pestaña. |
| Compras (Apple, Google) | **No** | `/pro` en web es **«Planes»**: planes de solo lectura y «la suscripción se contrata y se gestiona, por ahora, desde la app de NIVL para iPhone. En la web no se cobra nada.» Sin enlaces a tiendas ni a pagos, sin recoger interés. El pago web con Stripe lo prepara otro equipo. |
| Oráculo con clave propia | No | `getApiKey` es null en web (ya era así); solo el Oráculo del servidor. |
| Analítica | No se arranca en web | `arrancarAnalitica` ya sale si `Platform.OS === 'web'`. |

## 2. Diseño web

- **Escritorio**: barra lateral (`NavSidebar`) con la marca o el nombre del mundo y su acento. Las pantallas de inicio de FOCUS, WORK y FOUNDER y la economía de WORK van a **dos columnas** desde un hueco de 1000 (ventana ≥ 1240): lo principal a la izquierda, el coach y lo de consulta a la derecha (`DosColumnas` + `<Screen amplio>`, columna de 1120). En el móvil nativo no cambia nada (ambos solo actúan en web).
- **Acceso**: a partir de 1024, fachada a la izquierda (marca, lema, «Tu arena, también aquí» y tres líneas sobre el graderío) y el formulario de siempre a la derecha (`FachadaAcceso`, que pone `ColumnaWeb`). El formulario no repite la portada.
- **«Planes»** (`PlanesWeb`): planes a la izquierda; cómo se contrata y la salida a la derecha.
- **Avisos en pantalla** (`AvisosWeb`): arriba a la derecha (todo el ancho en móvil), tarjeta ink1 con regla de 2 en ink10; no gastan la inversión.
- **`public/index.html`**: fondo negro desde el primer fotograma, `color-scheme: dark`, foco de teclado visible (2 px blanco), selección invertida, barras de desplazamiento finas en ink4, autocompletado sin amarillo, `lang="es"`.
- Tipografías (Cinzel y Outfit) servidas desde el propio dominio (`/assets/nm/...`), como en la app.

Galería (desarrollo y preview con galería): `/kit/web?mundo=general|iron|focus|work&quieto=1`, `/kit/web?pantalla=planes`, `&aviso=1` para ver el aviso del fin de bloque. El resto: `/kit/pantallas`, `/kit/focus`, `/kit/work`, `/kit/iron`, `/kit/rueda`.

Capturas: `coordinacion-winter-arc/propuestas_modos/fidelidad/web-*.png` (1440 × 900 y 390 × 844), hechas sobre el preview con galería.

Comprobado en el preview: cabeceras y CSP servidas (la única violación de consola es la barra de comentarios de Vercel, que solo existe en los previews), fuentes propias, login, registro rellenado sin enviar (validación de la contraseña en vivo), `/kit` redirige a `/login` en el build sin galería, avisos en pantalla, dos columnas y «Planes».

## 3. Build y despliegue

```bash
# PREVIEW (por defecto): solo URL y clave publicable de Supabase, nada más del .env
VERCEL_SCOPE=teferilaforga-gmailcoms-projects SALIDA=/tmp/nivl-web scripts/web/desplegar.sh
# PREVIEW con la galería /kit (datos de demo, sin cuenta)
GALERIA=1 VERCEL_SCOPE=… SALIDA=… scripts/web/desplegar.sh
# PRODUCCIÓN: solo con el OK de Teferi (§6). Nunca con GALERIA=1 (el script lo impide).
PRODUCCION=1 VERCEL_SCOPE=… SALIDA=… scripts/web/desplegar.sh
```

El script: `expo export --platform web --clear` con `EXPO_NO_DOTENV=1`, copia `scripts/web/vercel.json` y `robots.txt`, renombra `assets/node_modules` (Vercel no sube carpetas con ese nombre), busca secretos y JWT de `service_role` en el bundle y aborta si hay un script en línea. `metro.config.js` separa la caché por `EXPO_PUBLIC_SITIO` y `EXPO_PUBLIC_GALERIA`.

`EXPO_PUBLIC_GALERIA=1` (`src/lib/galeria.ts`) solo compila `/kit` en un export **web**; en iOS y Android no cuenta, y producción no lo lleva.

## 4. Seguridad (`scripts/web/vercel.json`)

- SPA: todo lo que no es `/_expo/`, `/assets/`, `favicon.ico` o `robots.txt` va a `/index.html`.
- CSP: `default-src 'none'; script-src 'self'` (el `index.html` no lleva scripts en línea); `style-src 'self' 'unsafe-inline'` (react-native-web inyecta estilos); `connect-src 'self' blob: data:` + Supabase (`https` y `wss`); `img-src` y `media-src` con Supabase (avatares y fotos firmadas); `font-src 'self'`; `frame-ancestors 'none'`, `form-action 'none'`, `base-uri 'none'`, `object-src 'none'`.
- HSTS 2 años, `nosniff`, `Referrer-Policy: no-referrer` (el `?code=` del enlace del correo no sale a nadie), `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy` sin cámara (las fotos van por el selector de archivos), sin geolocalización ni pago; micrófono solo propio (dictado).
- `X-Robots-Tag: noindex, nofollow` y `robots.txt` cerrado: lo que se indexa es la landing.
- `_expo/static` y `assets` inmutables (llevan hash); el resto `no-cache`.
- Riesgo que ya estaba descrito para el portal (`docs/security-audit/portal-creadores.md`, R2): la sesión vive en `localStorage`; una XSS sería la cuenta entera. Por eso la CSP no lleva `unsafe-eval` ni `unsafe-inline` en scripts. CAPTCHA del login: sigue la decisión del 03/10 (no hasta que la app mande el token).

## 5. Política y privacidad

- **Apple**: la web no es la app ni se enlaza desde ella. No vende nada: «Planes» enseña lo mismo que la app con la tienda cerrada y no lleva a ningún pago. No enseña nada que la app de iPhone de la UE no pueda enseñar. La app no menciona la web como sitio de compra (anti-steering: nada cambia en el binario). Cuando exista el pago web (Stripe), la app seguirá sin enlazarlo salvo que se decida aplicar el régimen de enlaces externos de la UE: es otra decisión.
- **Almacenamiento**: la web guarda en `localStorage` la sesión de Supabase (y el verificador PKCE), el estado del pomodoro y preferencias del dispositivo. Es almacenamiento **estrictamente necesario** para el servicio que pide la persona (art. 22.2 LSSI, excepción): no requiere banner de consentimiento. No hay cookies propias ni de terceros.
- **Analítica**: no se arranca en web. Si algún día se activa, pasa por el consentimiento que ya existe (`nivl.analitica.consentimiento.v1`), nunca por defecto.
- **Notificaciones del navegador**: el permiso se pide solo al empezar un bloque de FOCUS; no hay suscripción push ni datos que salgan del navegador.
- **Dictado**: la Web Speech API manda el audio al proveedor del navegador; la app ya lo trata como dictado «en red» y pide el permiso (`permitirRed`) antes.
- Pendiente para el equipo legal (no bloquea el preview): añadir a la política de privacidad una línea sobre la versión web («En la versión web, tu sesión se guarda en el almacenamiento local de tu navegador para mantenerte dentro; no usamos cookies de seguimiento»).

## 6. Pasos de producción (esperan el OK de Teferi)

1. **Vercel**: en el proyecto `nivl-app`, añadir el dominio `app.nivl.app` (Settings, Domains).
2. **DNS** (donde viva la zona de `nivl.app`): `CNAME app → cname.vercel-dns.com.` (si la zona está en Vercel, el paso 1 lo crea solo). No tocar el apex ni `www`.
3. **Supabase Auth** (proyecto de NIVL, Authentication, URL Configuration, Redirect URLs): añadir exactamente
   - `https://app.nivl.app/auth/confirmar`
   - `https://app.nivl.app/auth/restablecer`

   Sin comodines. El Site URL no cambia. Mientras no estén, los correos de alta y recuperación pedidos desde la web caen al Site URL y no abren sesión en la web (el resto funciona: entrar con contraseña no necesita redirect).
   - Opcional, solo para probar el correo desde un preview: la URL concreta de ese preview con las dos rutas. Quitarla después. No añadir `https://*.vercel.app/**`.
4. **Despliegue**: `PRODUCCION=1 VERCEL_SCOPE=teferilaforga-gmailcoms-projects SALIDA=… scripts/web/desplegar.sh` desde la rama ya fusionada.
5. **Comprobar** en `https://app.nivl.app`: cabeceras (`curl -sI`), consola sin violaciones de CSP, fuentes cargadas, entrar con una cuenta real, pedir recuperación y abrir el enlace en el mismo navegador, `/kit` redirige a `/` (sin galería), un bloque de FOCUS corto con la pestaña oculta.
6. Opcional (equipo de la landing): un enlace «Abrir en el navegador» desde `nivl.app` a `app.nivl.app`.
