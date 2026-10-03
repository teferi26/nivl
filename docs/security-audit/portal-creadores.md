# Portal web de creadores (creadores.nivl.app): revisión de seguridad previa al montaje

Chat 3 · 03/10/2026. Contrato revisado: `docs/payment-audit/PORTAL-CREADORES.md` (Chat 2, `839c52d`).
Base: `winter2/integracion@531dfb6`. El portal **no existe todavía**: esto es la revisión del diseño,
del código que se exportaría y de la configuración actual. **Nada queda cerrado** hasta repetir las
pruebas de §5 contra el preview desplegado.

## 1. Veredicto

**OK condicionado** a exponer importes propios en web, si se cumplen R1 a R6. Los datos están bien
cerrados en el servidor (probado, §2). El riesgo del portal no está en las RPC, sino en lo que se
publica junto a ellas: el export web de Expo es **la app entera** con la sesión en `localStorage`.

## 2. Datos: solo lo propio (PROBADO en producción, transacción revertida)

Prueba: `docs/security-audit/portal-creadores-rpc.sql` con `rosql.mjs` (BEGIN…ROLLBACK). Cuentas ficticias `@example.invalid`:
creador X, creador Y, usuario normal Z y anon. Ventas, comisiones y pagos distintos por creador; las
notas de pago llevan un marcador (`IBAN-X`, `NOTA-SECRETA-X`) para detectar fugas.

| Caso | Resultado |
|---|---|
| X: `creator_panel()` | solo lo suyo: pendiente 1234, pagado 3333, fijo 1111. Sin `note` del pago ni `notes` del creador |
| Y: `creator_panel()` | solo lo suyo: pendiente 5678, pagado 4444, fijo 2222 |
| X/Y: `creator_sales_history(1)` | cada uno sus céntimos; ningún `user_id` de comprador |
| X: `creator_board()` | alias, ventas, puesto e `is_me` de cada uno; nada de dinero ajeno |
| X: `creator_progress()` | lo propio; sin datos de otros |
| X: `select` directo de `creators`, `commissions` o `creator_payouts` | `42501 permission denied` |
| Z (no creador) | panel y progreso `NULL`; board, history y period 0 filas |
| anon | `creator_panel`, `creator_board` y `creator_sales_history`: `42501` |

Pregunta (3) del Chat 2: **`creator_panel` no necesita cambios para web.** Los pagos ya van limitados
a 12 y sin `note`, y no salen compradores. Un dato visible a cada creador es `creators` (el total de
creadores activos) junto a su puesto. Es una decisión de negocio que ya está en la app, no una fuga.

## 3. Hallazgos y requisitos

### R1 · P1 · El export expone la app entera, no solo el panel
- **Archivo:** `app.json` (`web.output: "single"`) y `src/app/_layout.tsx:97` (`router.replace('/')` tras el login).
- **Reproducción:** `npx expo export --platform web` produce un único `entry-*.js` (3,79 MB) con todas
  las rutas: coach, fotos, diario, salud, el Oráculo (que guarda una clave de IA en el navegador y
  llama a `api.anthropic.com` y `api.openai.com` desde el cliente), Pro, onboarding, borrar cuenta.
  Tras el login la app va a `/`, y `index.tsx` manda al onboarding o a Hoy, no a `/creador`.
- **Impacto:** se publica en un dominio nuevo una superficie web de la app que nadie ha revisado
  (datos de salud y fotos, flujos de consentimiento, compra), con la sesión completa de NIVL.
- **Fix:** al compilar el sitio (p. ej. `EXPO_PUBLIC_SITIO=creadores`), el layout raíz solo deja
  `login` y `creador`: cualquier otra ruta, incluida `/`, va a `/creador`. Además:
  - no montar `HealthConsentProvider` (abre realtime), `CelebracionProvider`, notificaciones ni tienda;
  - no hay registro (el contrato ya lo dice), ni restablecer contraseña: se remite a la app.

  La restricción en cliente no protege datos (eso lo hacen las RPC); sirve para que no se publique
  una superficie sin revisar.

### R2 · P1 · Sesión en localStorage: una XSS es la cuenta NIVL entera
- **Archivo:** `src/lib/supabase.ts:19-21` (en web, AsyncStorage es `localStorage`, con `persistSession: true`).
- **Impacto:** cualquier script inyectado lee el refresh token y entra en toda la cuenta (salud,
  coach, borrado), no solo en el panel.
- **Fix:** CSP obligatoria y sin `unsafe-eval` ni `unsafe-inline` en scripts (R4). Opcional (P2):
  `sessionStorage` en el sitio de creadores, para que la sesión no sobreviva al cierre de la pestaña
  (ordenadores compartidos). «Cerrar sesión» visible, que llame a `signOut()` y borre el estado del panel.

### R3 · P2 · Auth: sin URLs de redirección nuevas; login público sin CAPTCHA
- **Estado actual** (lectura de la configuración de Auth; solo campos no secretos):
  - `uri_allow_list` = `nivl://auth/confirmar`, `nivl://auth/restablecer` y `https://nivl-web.vercel.app/**`;
  - `security_captcha_enabled=false`, `password_hibp_enabled=false`, `jwt_exp=3600`;
  - sin timebox ni caducidad por inactividad de sesión.
- Con `signInWithPassword` **no hace falta añadir `creadores.nivl.app` a la lista**. No añadirlo con
  comodín. Si algún día hay restablecer contraseña en el portal: la ruta exacta
  `https://creadores.nivl.app/auth/callback`, PKCE y canje manual (como la app).
- Un formulario de login público y nuevo atrae relleno de credenciales contra cuentas NIVL.
  **Decisión del coordinador (03/10): CAPTCHA NO por ahora.** Supabase lo exige en todo
  `signIn`/`signUp` del proyecto, y las builds 21 y 1.0.8 no mandan `captchaToken`: se rompería el
  login de la app y el del revisor de Apple. HIBP pide plan de pago. Se revisa cuando la 1.0.9 mande
  el token de Turnstile. **Riesgo aceptado** hasta entonces, con lo que hay:
  - los límites por IP de Auth por defecto;
  - `noindex`, sin enlaces públicos;
  - errores genéricos: `traducirErrorAuth` da el mismo mensaje para cuenta inexistente y contraseña mala.
- **El rate limit o la Firewall de Vercel en `/creador` NO protege el login.** El navegador llama a
  `https://dueyufxxkiixdxighpaz.supabase.co/auth/v1/token` directamente, sin pasar por Vercel, y un
  atacante ni siquiera necesita cargar el portal: puede atacar ese endpoint de Auth hoy mismo, con o
  sin portal. Limitar en Vercel solo frena la descarga del HTML, así que no es una alternativa al
  CAPTCHA. El portal apenas añade riesgo a lo que ya existe: es un formulario más contra el mismo endpoint.
- **CORS:** PostgREST y Auth de Supabase responden `Access-Control-Allow-Origin: *` y no se puede
  configurar. No es un control: el control es JWT más RPC con `auth.uid()` (§2). El portal no llama a
  Edge Functions, así que no hay CORS propio que tocar.

### R4 · P1 · Cabeceras en Vercel (proyecto propio, no el de nivl-web)
Para el `index.html` y para todo el sitio:

```
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src https://dueyufxxkiixdxighpaz.supabase.co wss://dueyufxxkiixdxighpaz.supabase.co; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Cross-Origin-Opener-Policy: same-origin
X-Robots-Tag: noindex, nofollow
Cache-Control: no-store            (solo index.html; /_expo/static/* inmutable)
```

- **`style-src 'unsafe-inline'`:** es necesario porque react-native-web inyecta estilos en tiempo de
  ejecución y el `index.html` de Expo trae `<style id="expo-reset">`. No afecta a los scripts.
- **El `index.html` exportado no tiene scripts en línea:** solo `<script src=… defer>`, así que
  `script-src 'self'` basta.
- **Hay 2 `eval(` en el bundle:** el cargador de bundles partidos de Metro y un respaldo de uuid
  cuando no hay `crypto`. Con `output: single` no deberían ejecutarse; se verifica en el preview
  (consola sin violaciones de CSP).
- **Las fuentes se sirven desde `/assets`:** las 17 referencias a `fonts.gstatic.com` del bundle son
  metadatos de `@expo-google-fonts`, por eso `font-src 'self'`. Si el preview muestra fuentes
  bloqueadas, se mira antes de abrir la CSP.
- **Reescritura de SPA:** todo lo que no exista va a `/index.html`.
- **`frame-ancestors 'none'`:** sustituye a X-Frame-Options.

### R5 · P2 · Bundle sin secretos (PROBADO sobre un export local; repetir sobre el desplegado)
Busqué en el `entry-*.js` las cadenas `service_role`, `sbp_`, `sb_secret`, `sk-ant`, `sk-proj` y el
ref de Franky:
- `sk-ant` y `sk-proj` solo aparecen como texto de ayuda del Oráculo;
- el resto no aparece;
- solo están la URL y la clave publicable (`sb_publishable_…`), que son públicas por diseño;
- no hay datos de creadores (vienen solo por RPC con sesión).

**Requisito:** el proyecto de Vercel lleva **solo** `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_KEY` y la variable del sitio. Ni `EXPO_PUBLIC_DEFAULT_AI_KEY` (aunque
`__DEV__` la ignore, se incrustaría en el bundle), ni `EXPO_PUBLIC_STRIPE_PAYMENT_LINK` /
`EXPO_PUBLIC_PAYWALL` (el portal no vende), ni las claves de RevenueCat.

### R6 · P2 · Textos legales
Las condiciones §4 y la política deben decir que el portal muestra solo datos del propio creador y
que no recoge datos bancarios ni fiscales. Lo redacta el Chat 4 y lo reviso yo antes de publicar.

## 4. Lo que no se ha comprobado
- No hay preview: R1, R2, R4 y R5 están revisados en código y en un export local, **no** en el despliegue.
- No he leído el límite de inicio de sesión por IP de Auth (no estaba entre los campos que pedí).

## 5. Pruebas que exijo sobre el preview desplegado (antes del DNS)
Con cuentas ficticias de creador X, creador Y, un usuario normal y sin sesión. Se dan de alta con
`scripts/creadores.mjs` en datos de prueba y se borran después; nunca cuentas reales.

1. Sin sesión: cualquier ruta (`/`, `/coach`, `/fotos`, `/oraculo`, `/pro`, `/perfil`, `/onboarding`,
   `/(tabs)`, `/creador`) muestra solo el login. En la red no sale ninguna llamada a `/rest/v1/` con datos.
2. Creador X: tras el login va a `/creador`. Las respuestas de `creator_panel`,
   `creator_sales_history`, `creator_progress` y `creator_board(_period)` en la pestaña de red llevan
   solo sus importes; de Y, como mucho alias y ventas. Las rutas del punto 1 redirigen a `/creador`.
3. Creador Y: lo simétrico. Repetir el punto 2 con X e Y logueados uno tras otro en la misma pestaña
   (cerrar sesión entre medias) y comprobar que no queda nada de X en pantalla ni en `localStorage`.
4. Usuario normal: estado vacío neutro, y ninguna llamada a tablas de salud, coach ni fotos.
5. Cabeceras: `curl -sI https://<preview>/` y `/creador` devuelven exactamente las de R4. La consola
   no tiene violaciones de CSP en los flujos 1 a 4.
6. Bundle desplegado: repetir la búsqueda de R5 sobre el `entry-*.js` servido.
7. El preview no es indexable y Vercel no lo enlaza públicamente (Deployment Protection o noindex).

Cuando estén, lo marco como cerrado con la evidencia redactada.

## 6. Resultados sobre el preview (03/10/2026, https://nivl-creadores.vercel.app)

Build `entry-9a884d88…` (de `2f081a5`, **sin** los ajustes `38b0f27`).

| § | Prueba | Resultado |
|---|---|---|
| 5.1 | Sin sesión: `/`, `/creador`, `/fotos`, `/oraculo`, `/pro`, `/onboarding`, `/auth/confirmar?code=…`, `/c/ABC`, `/kit/pantallas` | **PASS.** Todas terminan en `/login`. La redirección tarda 3–8 s por el fallo de fuentes (abajo). No hay ninguna petición a `supabase.co`. `localStorage`, `sessionStorage` y cookies están vacíos |
| 5.5 | Cabeceras (`curl -sI` de `/`, `/creador`, `/coach`, `/robots.txt`) | **PASS.** CSP, HSTS, nosniff, no-referrer, Permissions-Policy y X-Robots-Tag son exactamente los de R4. `frame-ancestors 'none'` comprobado: el navegador bloquea un iframe incluso desde el mismo origen. Consola sin violaciones de CSP |
| 5.6 | Bundle desplegado | **PASS.** Sin `service_role`, `sb_secret`, `sbp_`, el ref de Franky, `appl_`/`goog_` ni Stripe. `sk-ant-`/`sk-proj-` solo aparecen como texto de ayuda. Sin Vercel Analytics ni Speed Insights |
| 5.7 | No indexable | **PASS.** `X-Robots-Tag` en todas las respuestas, `robots.txt` con `Disallow: /` y la meta robots puesta por JS |
| 5.2–5.4 | Creador X, creador Y y usuario normal con sesión | **NO HECHO.** No puedo introducir contraseñas ni crear cuentas en un sitio desplegado; tiene que hacerlo una persona (pasos en el mensaje al coordinador). La parte de servidor está PROBADA en §2 |

Pendiente antes del DNS:
1. Volver a desplegar con `38b0f27` o posterior. El preview cierra sesión con alcance global (echaría al creador de la app del móvil) y el login todavía dice «Cámbiala».
2. Fuentes: `/assets/node_modules/**` no se sube y el fallback SPA devuelve `index.html` («OTS parsing error»). No es de seguridad, pero retrasa la redirección y llena la consola.
3. Pruebas 5.2–5.4 por una persona, sobre el despliegue corregido.
