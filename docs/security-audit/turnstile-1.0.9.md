# Turnstile en login y registro (1.0.9)

NIVL - Seguridad · 04/10/2026.

**Objetivo:** frenar el relleno de credenciales y las altas automáticas contra Supabase Auth. Hoy el CAPTCHA del proyecto está apagado (decisión del 03/10), porque encenderlo rompería los binarios que no mandan token.

## 1. Lo que ya está (a002ce8)

`src/lib/authFlow.ts` acepta un token **opcional**:

| Función | Llamada a Supabase con token |
|---|---|
| `entrar(email, pass, captcha?)` | `signInWithPassword({ …, options: { captchaToken } })` |
| `registrar(email, pass, nombre, captcha?)` | `signUp({ options: { …, captchaToken } })` |
| `pedirRecuperacion(email, captcha?)` | `resetPasswordForEmail(correo, { redirectTo, captchaToken })` |

- Sin token, las llamadas son idénticas a la 1.0.8 (hay un test que lo comprueba).
- `captcha_failed` → `ErrorVisible(MSG_CAPTCHA)`.
- En recuperar, el fallo de CAPTCHA ya no se traga: así no se finge que el correo salió.
- Tests: `sec-auth-flow.test.ts` (3 nuevos).

**Qué NO necesita token:**
- refrescar la sesión;
- `exchangeCodeForSession` (los enlaces del correo);
- `updateUser` (cambiar contraseña);
- `signOut`.

Quien ya tiene sesión no se ve afectado nunca.

## 2. Widget en la app (NIVL - Experiencia)

Turnstile no tiene SDK nativo; se usa en una WebView.

1. **Dependencia nativa:** `react-native-webview`, así que hace falta binario: va en la 1.0.9, no por OTA.
2. **Página propia:** `https://nivl.app/turnstile`, en la web (repo aparte).
   - HTML mínimo que carga `https://challenges.cloudflare.com/turnstile/v0/api.js` con la *sitekey* pública, en modo `managed`/invisible.
   - En el callback hace `window.ReactNativeWebView.postMessage(JSON.stringify({ token }))`.
   - Sin otros scripts. Con su propia CSP:
     `script-src https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com; default-src 'none'; style-src 'unsafe-inline'`.
   - El hostname `nivl.app` se registra en el widget de Cloudflare.
3. **En la app** (login, registro y recuperar):
   - una WebView oculta, o una hoja pequeña si Cloudflare pide interacción;
   - `originWhitelist` solo con `https://nivl.app` y `https://challenges.cloudflare.com`;
   - `onMessage` acepta solo mensajes con `event.nativeEvent.url` de `https://nivl.app/turnstile`;
   - sin `injectedJavaScript` ni acceso a archivos.
4. **El token:**
   - es de **un solo uso** y caduca a los **300 s**: se pide justo antes de enviar y se descarta tras cada intento, incluso fallido;
   - nunca se guarda ni se registra en logs;
   - con `MSG_CAPTCHA`, se pide un token nuevo y se reintenta una vez.
5. **Sin red hacia Cloudflare:** el botón queda deshabilitado con «No se ha podido comprobar la conexión». Nunca se envía sin token cuando el CAPTCHA está activo.
6. **Variable de entorno:** `EXPO_PUBLIC_TURNSTILE_SITEKEY` es pública. Sin ella, la app no pide token: es el comportamiento de la 1.0.8.

**Portal de creadores (web):** el widget va directo en la página. Hay que cambiar su CSP (R4): `script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com`. Lo reviso cuando se haga.

## 3. Servidor (coordinador; es configuración, no código)

- En Cloudflare: un widget Turnstile con los hostnames `nivl.app` y `creadores.nivl.app`.
- En Supabase, Auth → Bot and Abuse Protection: proveedor **Turnstile** y la *secret key*. La secret **no entra en el repo**; la sitekey sí puede.

## 4. Orden de activación (lo importante)

Supabase aplica el CAPTCHA a **todo** `signIn`, `signUp`, OTP y `recover` del proyecto, sin excepciones por cliente.

1. Publicar la 1.0.9 con el widget y con `EXPO_PUBLIC_TURNSTILE_SITEKEY`, con el CAPTCHA todavía **apagado**. La 1.0.9 manda token y el servidor lo ignora: no rompe nada.
2. Portal de creadores con el widget, desplegado.
3. Esperar a que la 1.0.9 tenga la adopción suficiente y que **Apple revise ya una build con token**: la cuenta demo del revisor entra con contraseña.
4. **Encender** el CAPTCHA en Supabase.

**Efecto en los binarios viejos (1.0.7 y 1.0.8):**
- las sesiones abiertas siguen;
- quien esté fuera no puede entrar, registrarse ni recuperar: ve el fallo genérico.

No existe ningún mecanismo de versión mínima: no lo hay en `src` ni en las migraciones. Recomiendo añadirlo en la 1.0.9: una tabla pública de solo lectura con `min_version` y una pantalla «Actualiza NIVL». Así el paso 4 enseña un mensaje claro en vez de un error.

**Marcha atrás:** apagar el CAPTCHA en Supabase. Es inmediato y no necesita build.

**Scripts que no se ven afectados** (usan `service_role` o el admin `generate_link`): `smoke-coach.mjs`, `eval-coach.mjs`, `seed-capturas`.

## 5. Pruebas antes del paso 4

Con la cuenta de prueba, contra el proyecto real:
1. Con el CAPTCHA activo en un **proyecto de pruebas**, o en una ventana corta acordada:
   - sin token → `captcha_failed` y `MSG_CAPTCHA`;
   - con token válido → entra;
   - token reutilizado → `captcha_failed`.
2. La 1.0.9 en iPhone y Android con el modo avión a mitad del widget: el botón queda deshabilitado y no se envía nada.
3. La 1.0.8 con el CAPTCHA activo: la sesión abierta sigue; un login nuevo da el fallo genérico. Es el comportamiento esperado y documentado.
