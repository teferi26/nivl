# Auth, sesión, privacidad y secretos

> Área SEC · auditoría de código NIVL · anclada al código real

Archivos auditados: `src/lib/supabase.ts`, `src/lib/auth.tsx`, `src/app/login.tsx`, `src/lib/exporter.ts`, `src/lib/oracle.ts`, `src/app/oraculo.tsx`, `src/app/_layout.tsx`, `src/app/(tabs)/perfil.tsx`, `src/app/(tabs)/_layout.tsx`, `src/app/index.tsx`, `src/lib/data.ts` (upload/storage), `app.json`, `.env`, `.gitignore`, `eas.json`.

Contexto de configuración verificado:
- `.env` contiene la **publishable** key (`sb_publishable_…`) y la URL — clave correcta para cliente, **no** es una fuga. `.env` y `.env*.local` están en `.gitignore`.
- No se usa el SDK de Anthropic; el Oráculo hace `fetch` crudo con la key del usuario en `x-api-key`. `output_config.format` con `json_schema` y el modelo `claude-haiku-4-5` son la forma canónica correcta de la API — ahí no hay bug de forma.
- No existe ningún `console.log/error` en `src/`, así que hoy la key no se imprime en logs; pero sí hay rutas donde podría acabar mostrándose al usuario (ver CRIT-SEC-04 y SEC-006).

## Bugs y riesgos

### CRIT-SEC-01 · `getSession()` sin `.catch`: splash infinito si falla la lectura de sesión — `auth.tsx:17-20` · severidad alta
**Problema:** En `AuthProvider`, `supabase.auth.getSession().then(({ data }) => { setSession(...); setLoading(false); })` no tiene `.catch`. `getSession()` toca AsyncStorage y, en SDKs recientes, puede intentar refrescar el token contra la red. Si esa promesa rechaza (storage corrupto, excepción de deserialización, fallo nativo), `setLoading(false)` nunca se ejecuta. `_layout.tsx` mantiene el splash hasta que las fuentes cargan, pero `index.tsx:9` hace `if (loading) return <SystemWindow…/>` (pantalla de carga) **para siempre**: la app queda colgada en "cargando" sin forma de entrar ni de ver el login. **Arreglo:** envolver en try/catch o añadir `.catch(() => { setSession(null); setLoading(false); })`. Idealmente: `const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));` y `finally { setLoading(false); }`.

### CRIT-SEC-02 · Pantallas stack sin guard de sesión: deep-link entra sin autenticar — `app/_layout.tsx:36-42`, `app/oraculo.tsx:24-26` · severidad alta
**Problema:** El único gate de sesión es `index.tsx` (`<Redirect href={session ? '/(tabs)' : '/login'} />`). Las pantallas del stack (`oraculo`, `gym`, `dieta`, `compra`, `diario`, `informe`, `dungeon/[id]`) cuelgan directamente del `<Stack>` raíz **sin** comprobar `session`. El `scheme: "nivl"` de `app.json` registra deep links, así que `nivl://oraculo` (o cualquier otra) monta la pantalla aunque no haya sesión. En `oraculo.tsx` `userId = session?.user.id` será `undefined` y `accept()` falla silenciosamente, pero la UI del panel de API key (incluida la key ya guardada) se renderiza igualmente. Es una fuga de superficie y un estado roto. **Arreglo:** crear un layout de grupo autenticado (p. ej. mover las pantallas stack a `app/(app)/_layout.tsx` que haga `const { session, loading } = useAuth(); if (loading) return <Splash/>; if (!session) return <Redirect href="/login" />;`), o añadir el guard en cada pantalla stack.

### CRIT-SEC-03 · Cerrar sesión no borra la API key de Anthropic del dispositivo — `app/(tabs)/perfil.tsx:174-177` · severidad alta
**Problema:** `signOut` hace `await supabase.auth.signOut(); router.replace('/login')`. La key de Anthropic vive en AsyncStorage bajo `nivl.anthropic_key` (`oracle.ts:10`) y **no se limpia**. Aunque NIVL sea "un usuario", el caso real es: dispositivo compartido/prestado, reventa del móvil, o que otra persona cree su cuenta en la misma instalación → hereda la key personal de pago del usuario anterior y puede gastar su saldo de Anthropic. La sesión de Supabase se cierra pero el secreto de mayor valor económico persiste. **Arreglo:** en `signOut`, antes del `replace`, `await setApiKey('')` (que ya hace `removeItem`). Considera además limpiar otras claves de AsyncStorage específicas del usuario. Idealmente la key debería estar en SecureStore (ver SEC-001).

### CRIT-SEC-04 · `fetch` al Oráculo sin timeout ni `AbortController`: la consulta puede colgarse indefinidamente — `oracle.ts:78-92` · severidad alta
**Problema:** `generateQuests` hace `await fetch('https://api.anthropic.com/v1/messages', …)` sin `signal` ni timeout. En móvil con red intermitente (túnel, ascensor, datos saturados) la petición puede quedar pendiente mucho tiempo. En `oraculo.tsx:64-73`, `consult()` pone `setBusy(true)` y solo lo revierte en `finally`; mientras el `fetch` no resuelva, el botón "Consultar al oráculo" queda en spinner permanente y el usuario no puede reintentar ni cancelar. **Arreglo:** añadir `AbortController` con timeout: `const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 30000);` pasar `signal: ctrl.signal` al `fetch`, `clearTimeout(t)` en finally, y mapear `AbortError` a un mensaje claro ("El oráculo tardó demasiado. Reintenta."). Aplica el mismo patrón a cualquier otra llamada a IA futura.

### CRIT-SEC-05 · `signedUrl` puede devolver `null` y `<Image>` recibe `uri: null` — `data.ts:118-121`, `perfil.tsx:71-72,196` · severidad media
**Problema:** `signedUrl` retorna `string | null` (`return data?.signedUrl ?? null`). En `perfil.tsx`, `setAvatarUri(await signedUrl('avatars', prof.avatar_url))` guarda ese posible `null`, y luego `avatarUri ? <Image source={{ uri: avatarUri }} … />` lo protege en el render principal — pero si `createSignedUrl` falla de forma transitoria (token caducado, fallo de red, RLS), el avatar simplemente no aparece y no hay reintento ni aviso. No es un crash, pero es un fallo de privacidad/UX silencioso: el usuario cree que su foto se subió y no la ve. Más relevante en seguridad: una URL firmada caduca a los **7 días** (`60*60*24*7`); si la sesión queda abierta una semana, el avatar deja de cargar sin explicación. **Arreglo:** manejar el `null` con un placeholder explícito y, para la caducidad, regenerar la URL firmada en cada `useFocusEffect` (ya se hace en `load`) o reducir TTL y refrescar bajo demanda.

### CRIT-SEC-06 · No existe borrado de cuenta (derecho de supresión RGPD) — `app/(tabs)/perfil.tsx` (toda la pantalla) · severidad media
**Problema:** El perfil ofrece "Exportar mis datos" y "Cerrar sesión" pero **no** "Eliminar cuenta". No hay ninguna función `deleteAccount` en todo `src/` (grep confirmado). El usuario no puede ejercer el derecho de supresión: borrar su fila de `profiles`, sus `completions/quests/…`, sus objetos de Storage (`evidence/`, `avatars/`) ni su usuario de `auth.users`. Para una app que almacena datos personales (fotos de evidencia, diario, peso corporal en `body.ts`) esto es un hueco RGPD real. **Arreglo:** añadir flujo "Eliminar cuenta" con doble confirmación que invoque un RPC `SECURITY DEFINER` (o Edge Function) que borre datos + objetos de Storage + `auth.users` del propio usuario. La 0004 planificada es el sitio natural para el RPC; el botón y la confirmación son trabajo de cliente.

### CRIT-SEC-07 · Export RGPD escribe el dump completo en caché sin cifrar y no lo limpia — `exporter.ts:37-45` · severidad media
**Problema:** `exportAllData` serializa **todas** las tablas del usuario (incluido `journal_entries`, datos corporales, etc.) a `new File(Paths.cache, 'nivl-export-<ts>.json')` y lo comparte. El JSON en claro queda en el directorio de caché de la app indefinidamente (solo se purga cuando el SO recupera espacio), y cada export crea un fichero nuevo (`Date.now()` distinto) → se acumulan copias en claro de todos los datos personales. Si el dispositivo se respalda en la nube o se inspecciona, esos ficheros son legibles. Además, si `Sharing.isAvailableAsync()` es `false`, el fichero se escribe pero nunca se comparte ni se borra. **Arreglo:** borrar el fichero tras compartir (`file.delete()` en un `finally`, idealmente tras que el share resuelva), o escribir en un directorio temporal de un solo uso; limpiar exports viejos al entrar. Documentar que el export contiene datos sensibles.

### CRIT-SEC-08 · `exporter` confía solo en RLS para acotar el export; sin `user_id` explícito una RLS floja exfiltra datos ajenos — `exporter.ts:31-35` · severidad media
**Problema:** El bucle hace `supabase.from(table).select('*')` **sin** `.eq('user_id', userId)` en ninguna de las 15 tablas. La correcta acotación depende 100% de que cada tabla tenga RLS `user_id = auth.uid()`. Como NIVL es monousuario hoy el riesgo práctico es bajo, pero es un patrón frágil: si una migración futura añade una tabla al array `TABLES` sin RLS de pertenencia (o con RLS permisiva), `exportAllData` volcará filas de **todos** los usuarios al JSON del que pulse "Exportar", y al ser un export "de mis datos" nadie lo revisará. **Arreglo:** filtrar explícitamente por `user_id`/`id` donde la columna exista (defensa en profundidad), y/o asociar un test que verifique que toda tabla en `TABLES` tiene RLS de pertenencia. No sustituye a RLS, la complementa.

## Mejoras

### SEC-001 · Migrar la API key de Anthropic a SecureStore (Keychain/Keystore)
**Qué:** `getApiKey/setApiKey` usan `AsyncStorage`, que guarda en claro (en Android, en el almacenamiento de la app, legible con root/backup). La key de pago debe ir en `expo-secure-store` (cifrado por hardware). **Dónde:** `oracle.ts:25-35` · **Impacto:** 5 · **Esfuerzo:** S

### SEC-002 · Añadir `expo-secure-store` como dependencia y fallback web
**Qué:** SecureStore no existe en web; encapsular en un `secureStorage.ts` con fallback a AsyncStorage solo fuera de móvil, igual que el patrón `isServer` de `supabase.ts`. **Dónde:** nuevo `src/lib/secrets.ts` consumido por `oracle.ts` · **Impacto:** 4 · **Esfuerzo:** S

### SEC-003 · Limpiar la API key en `signOut` (mientras no esté en SecureStore con borrado por sesión)
**Qué:** `await setApiKey('')` dentro de `signOut` antes de `router.replace`. **Dónde:** `perfil.tsx:174-177` · **Impacto:** 5 · **Esfuerzo:** S

### SEC-004 · `AbortController` + timeout en `generateQuests`
**Qué:** evita spinner colgado y libera recursos. **Dónde:** `oracle.ts:78-92` · **Impacto:** 4 · **Esfuerzo:** S

### SEC-005 · Reintento/backoff explícito para 429/529 del Oráculo
**Qué:** ya se mapean 429/529 a mensajes, pero no hay reintento; un backoff corto con jitter mejora la robustez sin SDK. **Dónde:** `oracle.ts:94-100` · **Impacto:** 2 · **Esfuerzo:** M

### SEC-006 · No reflejar el cuerpo de error de la API en un Alert
**Qué:** `body.slice(0, 200)` se mete en el `Error` y acaba en `Alert` (`oraculo.tsx:70`). Si Anthropic alguna vez refleja parte de la petición o headers, podría mostrar fragmentos sensibles. Mostrar un mensaje genérico y registrar el detalle solo en un canal de diagnóstico opt-in. **Dónde:** `oracle.ts:98-99` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-007 · Flujo "Eliminar cuenta" con doble confirmación
**Qué:** botón en perfil + `Alert` de confirmación que invoque el RPC de borrado total. **Dónde:** `perfil.tsx:327-329` (junto a Exportar/Cerrar sesión) · **Impacto:** 5 · **Esfuerzo:** M

### SEC-008 · Borrar el fichero de export tras compartir
**Qué:** `file.delete()` en `finally`, y manejar el caso `Sharing` no disponible. **Dónde:** `exporter.ts:40-45` · **Impacto:** 4 · **Esfuerzo:** S

### SEC-009 · Limpiar exports antiguos al abrir perfil
**Qué:** al entrar, barrer `Paths.cache` y borrar `nivl-export-*.json` previos para no acumular copias en claro. **Dónde:** `perfil.tsx:load` / `exporter.ts` · **Impacto:** 3 · **Esfuerzo:** S

### SEC-010 · Filtro explícito `user_id` en `exportAllData`
**Qué:** defensa en profundidad además de RLS. **Dónde:** `exporter.ts:31-35` · **Impacto:** 3 · **Esfuerzo:** M

### SEC-011 · Incluir manifiesto de privacidad en el export
**Qué:** añadir al JSON una sección que liste qué datos contiene y recuerde que es sensible (útil para RGPD y para el propio usuario). **Dónde:** `exporter.ts:26-30` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-012 · Incluir las evidencias (Storage) opcionalmente en el export
**Qué:** hoy solo se exportan las rutas (`// Las evidencias … solo sus rutas`); un export RGPD completo debería poder incluir los binarios o URLs firmadas con caducidad. **Dónde:** `exporter.ts:23-24` · **Impacto:** 2 · **Esfuerzo:** L

### SEC-013 · `getSession` con `.catch` y `finally`
**Qué:** robustez del arranque (ver CRIT-SEC-01). **Dónde:** `auth.tsx:17-20` · **Impacto:** 5 · **Esfuerzo:** S

### SEC-014 · `onAuthStateChange` también debería poder marcar `loading=false`
**Qué:** hoy solo `getSession` apaga `loading`; si por alguna razón `getSession` resuelve tarde pero `onAuthStateChange` emite antes, conviene reconciliar el estado. **Dónde:** `auth.tsx:21-23` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-015 · Grupo de rutas autenticado para el stack
**Qué:** mover pantallas stack a un grupo con guard (ver CRIT-SEC-02). **Dónde:** `app/_layout.tsx:36-42` · **Impacto:** 5 · **Esfuerzo:** M

### SEC-016 · Redirigir a login ante señal de sesión expirada global
**Qué:** suscribirse a `onAuthStateChange` con evento `SIGNED_OUT`/`TOKEN_REFRESHED` fallido y forzar `replace('/login')` desde un punto central, en vez de depender de que cada pantalla lo note. **Dónde:** `auth.tsx` + `_layout.tsx` · **Impacto:** 3 · **Esfuerzo:** M

### SEC-017 · `signOut` debería envolverse en try/catch
**Qué:** si `supabase.auth.signOut()` lanza (red caída), `router.replace('/login')` no se ejecuta y el usuario queda atrapado en perfil. Mover el `replace` a `finally`. **Dónde:** `perfil.tsx:174-177` · **Impacto:** 3 · **Esfuerzo:** S

### SEC-018 · Botón "Cerrar sesión" con confirmación
**Qué:** evita cierres accidentales (es `variant="danger"` pero sin diálogo). **Dónde:** `perfil.tsx:329` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-019 · Estado de carga/disabled en "Cerrar sesión"
**Qué:** `signOut` es async pero el botón no pasa `loading`; doble toque podría disparar dos `signOut`. **Dónde:** `perfil.tsx:329` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-020 · Validación de formato de email en login
**Qué:** `signIn`/`signUp` solo hacen `email.trim()`; un regex/`isValidEmail` mínimo da feedback inmediato antes de la llamada de red y evita errores crípticos de Supabase. **Dónde:** `login.tsx:28,41` · **Impacto:** 3 · **Esfuerzo:** S

### SEC-021 · Reglas de contraseña visibles y validadas
**Qué:** el botón "Crear cuenta" exige `password.length < 6` (`login.tsx:99`) pero el usuario no lo sabe hasta intentarlo; mostrar el requisito y validar también longitud máxima. **Dónde:** `login.tsx:75-83,99` · **Impacto:** 3 · **Esfuerzo:** S

### SEC-022 · Indicador de fuerza de contraseña en signUp
**Qué:** medidor simple (longitud + variedad) para fomentar contraseñas robustas. **Dónde:** `login.tsx:75-83` · **Impacto:** 2 · **Esfuerzo:** M

### SEC-023 · Mensajes de error de login localizados y no técnicos
**Qué:** `setError(err.message)` muestra el texto crudo de Supabase (a veces en inglés, p. ej. "Invalid login credentials"). Mapear los códigos comunes a español sobrio del sistema. **Dónde:** `login.tsx:31,44` · **Impacto:** 3 · **Esfuerzo:** M

### SEC-024 · No revelar si el email existe (anti-enumeración)
**Qué:** mensajes distintos para "credenciales inválidas" vs "email no registrado" permiten enumerar cuentas. Unificar a un mensaje genérico. **Dónde:** `login.tsx:30-33` · **Impacto:** 3 · **Esfuerzo:** S

### SEC-025 · Rate-limit local de intentos de login
**Qué:** tras N fallos seguidos, introducir un pequeño backoff en el cliente (además del de Supabase) para frenar fuerza bruta desde el propio dispositivo. **Dónde:** `login.tsx:24-35` · **Impacto:** 3 · **Esfuerzo:** M

### SEC-026 · Flujo de recuperación de contraseña ("¿Olvidaste tu contraseña?")
**Qué:** no existe `resetPasswordForEmail` en ningún sitio (grep confirmado). Sin él, perder la contraseña = perder la cuenta y todos los datos. Añadir enlace en login → `supabase.auth.resetPasswordForEmail`. **Dónde:** `login.tsx` (zona de formulario) · **Impacto:** 4 · **Esfuerzo:** M

### SEC-027 · Reenviar email de confirmación
**Qué:** `signUp` muestra "Confirma tu correo" (`login.tsx:50`) pero no hay forma de reenviar si no llega. Añadir `supabase.auth.resend`. **Dónde:** `login.tsx:47-51` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-028 · Toggle de visibilidad de contraseña en login
**Qué:** ojo para mostrar/ocultar; reduce errores de tecleo. **Dónde:** `login.tsx:76-83` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-029 · `textContentType`/`autoComplete` en los inputs de login
**Qué:** marcar email como `username`/`emailAddress` y contraseña como `password`/`newPassword` para integrar gestores de contraseñas y autofill. **Dónde:** `login.tsx:66-83` · **Impacto:** 3 · **Esfuerzo:** S

### SEC-030 · `autoComplete="off"`/`textContentType="none"` en el input de API key
**Qué:** evitar que el gestor de contraseñas o el teclado guarden/sugieran la key de Anthropic. **Dónde:** `oraculo.tsx:129-137` · **Impacto:** 3 · **Esfuerzo:** S

### SEC-031 · La key se muestra en claro hasta que se guarda
**Qué:** `secureTextEntry={keySaved}` (`oraculo.tsx:136`): mientras `keySaved` es `false` (primera vez), la key se ve en pantalla → riesgo de mirada por encima del hombro y de capturas. Hacerla `secureTextEntry` siempre, con un botón de "mostrar" explícito. **Dónde:** `oraculo.tsx:136` · **Impacto:** 3 · **Esfuerzo:** S

### SEC-032 · No precargar la key completa en el `TextInput`
**Qué:** `useEffect` hace `setKey(k)` con la key entera (`oraculo.tsx:38-43`); aunque enmascarada, está en memoria del componente y en el árbol. Mostrar solo un indicador "key guardada" + sufijo (p. ej. `sk-ant-…AB12`) y pedir reescribir para cambiarla. **Dónde:** `oraculo.tsx:28,37-44` · **Impacto:** 3 · **Esfuerzo:** M

### SEC-033 · Validar formato de la key antes de guardarla
**Qué:** `saveKey` acepta cualquier string no vacío; comprobar prefijo `sk-ant-` y longitud mínima evita guardar basura y da feedback. **Dónde:** `oracle.ts:29-35`, `oraculo.tsx:46-50` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-034 · Botón "Borrar key" explícito en el Oráculo
**Qué:** hoy borrar implica vaciar el campo y guardar; un botón dedicado (`setApiKey('')`) es más claro y reduce el tiempo que la key vive en el dispositivo. **Dónde:** `oraculo.tsx:138` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-035 · No enviar el objetivo del usuario a Anthropic sin avisar de la salida de datos
**Qué:** `generateQuests` manda el `goal` (texto libre, potencialmente sensible: salud, estudios) a un tercero. Un aviso breve la primera vez ("tu objetivo se envía a la API de Claude") es buena práctica de privacidad. **Dónde:** `oraculo.tsx:52-65` · **Impacto:** 3 · **Esfuerzo:** S

### SEC-036 · `max_tokens` y modelo configurables / documentados
**Qué:** `MODEL` y `max_tokens: 2000` están hardcodeados; exponerlos (o al menos comentarlos junto al coste) ayuda a controlar gasto del usuario. **Dónde:** `oracle.ts:9,87` · **Impacto:** 1 · **Esfuerzo:** S

### SEC-037 · Verificar `stop_reason` de la respuesta del Oráculo
**Qué:** se lee `stop_reason` en el tipo pero no se actúa; si es `max_tokens` el JSON puede venir truncado y `JSON.parse` lanza un error genérico. Detectar y mensaje específico. **Dónde:** `oracle.ts:102-109` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-038 · `JSON.parse(text)` del Oráculo envuelto con mensaje claro
**Qué:** si la IA no devuelve JSON válido pese al schema, `JSON.parse` lanza `SyntaxError` crudo. Envolver en try/catch con mensaje del sistema. **Dónde:** `oracle.ts:109` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-039 · No confiar en `detectSessionInUrl:false` para web sin más
**Qué:** en `supabase.ts` se desactiva la detección de sesión por URL; si algún día se habilita el login web/OAuth habrá que revisarlo. Dejar comentario de intención. **Dónde:** `supabase.ts:22` · **Impacto:** 1 · **Esfuerzo:** S

### SEC-040 · Validar variables de entorno con mensaje accionable
**Qué:** `supabase.ts:9-11` lanza si faltan URL/KEY — bien; añadir comprobación de que la URL parezca `https://…supabase.co` y la key tenga prefijo esperado, para detectar `.env` mal copiado. **Dónde:** `supabase.ts:6-11` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-041 · Asegurar que `.env` nunca entre en el bundle de logs/errores
**Qué:** las `EXPO_PUBLIC_*` se inyectan en el bundle (es su naturaleza); documentar que la key publishable es pública por diseño y que **ninguna** secret/service key debe llevar prefijo `EXPO_PUBLIC_`. **Dónde:** `supabase.ts:6-7`, `.env.example` · **Impacto:** 3 · **Esfuerzo:** S

### SEC-042 · `startAutoRefresh/stopAutoRefresh` con guarda de plataforma
**Qué:** el listener de `AppState` está bajo `if (!isServer)` — correcto; añadir manejo si `AppState` no existe en algún entorno de test para no romper imports. **Dónde:** `supabase.ts:26-34` · **Impacto:** 1 · **Esfuerzo:** S

### SEC-043 · Bloqueo síncrono anti doble-submit en `signIn`/`signUp`
**Qué:** `busy` se setea de forma async; "Entrar" usa `disabled={!email||!password}` pero **no** `disabled={busy}` (sí lo hace "Crear cuenta"). Un doble toque rápido puede lanzar dos `signInWithPassword`. Añadir `disabled={busy || …}` y/o `useRef` síncrono. **Dónde:** `login.tsx:88-94` · **Impacto:** 3 · **Esfuerzo:** S

### SEC-044 · `keyboardType` y `autoCapitalize` en API key
**Qué:** el input de key permite autocorrección del teclado en algunos dispositivos; añadir `autoCorrect={false}` además de `autoCapitalize="none"` para no corromper la key. **Dónde:** `oraculo.tsx:129-137` · **Impacto:** 3 · **Esfuerzo:** S

### SEC-045 · `accessibilityLabel` en inputs y botones de login
**Qué:** los `TextInput` de email/contraseña no tienen label accesible explícito para lectores de pantalla. **Dónde:** `login.tsx:66-83` · **Impacto:** 3 · **Esfuerzo:** S

### SEC-046 · `accessibilityLabel`/`accessibilityHint` en el campo de API key
**Qué:** anunciar que es un campo seguro y de qué se trata; importante porque está enmascarado. **Dónde:** `oraculo.tsx:129-137` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-047 · Anunciar errores de login a accesibilidad
**Qué:** el `<Text style={styles.error}>` no usa `accessibilityLiveRegion`/`AccessibilityInfo.announceForAccessibility`; un usuario con lector no se entera del fallo. **Dónde:** `login.tsx:85-86` · **Impacto:** 3 · **Esfuerzo:** S

### SEC-048 · `accessibilityRole="button"` y estados en botones de auth
**Qué:** reforzar semántica de los `SystemButton` de Entrar/Crear/Cerrar sesión para TalkBack/VoiceOver. **Dónde:** `login.tsx:88-101`, `perfil.tsx:327-329` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-049 · Contraste del placeholder en inputs
**Qué:** `placeholderTextColor={colors.textFaint}` puede quedar por debajo de AA sobre `colors.panel`/`colors.bg`; verificar ratio. **Dónde:** `login.tsx:73,82`, `oraculo.tsx:134,151` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-050 · Foco automático al primer campo en login
**Qué:** `autoFocus` en email mejora el flujo; combinar con `returnKeyType="next"` y `onSubmitEditing` para saltar a contraseña. **Dónde:** `login.tsx:66-83` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-051 · `onSubmitEditing` en contraseña dispara `signIn`
**Qué:** pulsar "done" en el teclado debería intentar entrar; hoy hay que tocar el botón. **Dónde:** `login.tsx:76-83` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-052 · Tipar la respuesta de la API en `oracle.ts` con un esquema en runtime
**Qué:** el cast `as { content: …; stop_reason: string }` (`oracle.ts:102-105`) no garantiza la forma; un validador ligero (zod/valibot) evita accesos a `undefined` si la API cambia. **Dónde:** `oracle.ts:102-106` · **Impacto:** 2 · **Esfuerzo:** M

### SEC-053 · Centralizar lectura de `session?.user.id` en un hook `useUserId()`
**Qué:** el patrón `const userId = session?.user.id` se repite en muchas pantallas (oraculo, perfil, gym, dieta, etc.); un hook que además gestione el caso `undefined` reduce errores. **Dónde:** transversal, anclar en `auth.tsx` · **Impacto:** 2 · **Esfuerzo:** M

### SEC-054 · `useAuth` debería exponer helpers `signOut`/`signIn`
**Qué:** hoy las pantallas llaman a `supabase.auth.*` directamente (perfil, login); centralizar en el contexto evita lógica duplicada y facilita limpiar secretos en un solo sitio (enlaza con CRIT-SEC-03). **Dónde:** `auth.tsx:12-28` · **Impacto:** 3 · **Esfuerzo:** M

### SEC-055 · Test unitario: `signOut` limpia la API key
**Qué:** test que verifique que tras `signOut` no queda `nivl.anthropic_key` en storage. **Dónde:** nuevo test junto a `perfil`/`auth` · **Impacto:** 3 · **Esfuerzo:** M

### SEC-056 · Test: `AuthProvider` apaga `loading` aunque `getSession` rechace
**Qué:** mock de `getSession` que lanza → el provider no debe quedar en `loading`. **Dónde:** nuevo test de `auth.tsx` · **Impacto:** 4 · **Esfuerzo:** M

### SEC-057 · Test: deep-link a pantalla stack sin sesión redirige a login
**Qué:** asegurar el guard de CRIT-SEC-02. **Dónde:** nuevo test de navegación · **Impacto:** 3 · **Esfuerzo:** M

### SEC-058 · Test: `getApiKey/setApiKey` round-trip y borrado
**Qué:** cubrir que `setApiKey('')` elimina y que `getApiKey` devuelve `null`. **Dónde:** nuevo test de `oracle.ts` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-059 · Test: `generateQuests` aborta por timeout
**Qué:** mock de `fetch` que nunca resuelve + fake timers → debe rechazar con mensaje de timeout (enlaza CRIT-SEC-04). **Dónde:** nuevo test de `oracle.ts` · **Impacto:** 3 · **Esfuerzo:** M

### SEC-060 · Test: `generateQuests` filtra propuestas con stat/difficulty inválidos
**Qué:** ya hay validación (`oracle.ts:115-124`); fijarla con un test que pase basura y verifique que se descarta. **Dónde:** nuevo test de `oracle.ts` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-061 · Test: `exportAllData` no incluye tablas sin filtrar datos ajenos
**Qué:** con mock de supabase, verificar que se consulta cada tabla y (si se aplica SEC-010) con filtro de usuario. **Dónde:** nuevo test de `exporter.ts` · **Impacto:** 2 · **Esfuerzo:** M

### SEC-062 · Manejar fallo de `exportAllData` cuando una tabla no existe
**Qué:** si una tabla del array `TABLES` se renombra/elimina en una migración, el `throw` corta el export entero; considerar acumular errores por tabla y seguir, informando al final. **Dónde:** `exporter.ts:31-35` · **Impacto:** 2 · **Esfuerzo:** M

### SEC-063 · Nombre de fichero de export con marca temporal legible
**Qué:** `nivl-export-<epoch>.json` no es amigable; usar `YYYY-MM-DD-HHmm` ayuda al usuario a identificar exports. **Dónde:** `exporter.ts:37` · **Impacto:** 1 · **Esfuerzo:** S

### SEC-064 · Versionar el esquema del export
**Qué:** `version: 1` está hardcodeado; documentar el contrato y subirlo al añadir/quitar tablas para que importadores futuros lo entiendan. **Dónde:** `exporter.ts:28` · **Impacto:** 1 · **Esfuerzo:** S

### SEC-065 · Feedback de progreso en el export
**Qué:** son 15 consultas secuenciales; en conexiones lentas el botón queda en `loading` sin indicación de avance. Mostrar "Exportando N/15" o usar `Promise.all` acotado. **Dónde:** `exporter.ts:31-35`, `perfil.tsx:162-172` · **Impacto:** 2 · **Esfuerzo:** M

### SEC-066 · Imagen compartida del perfil puede filtrar datos sin querer
**Qué:** `shareProfile` (`perfil.tsx:151-160`) genera un PNG con nombre, rango, nivel y stats; está bien, pero conviene asegurarse de no incluir el avatar si contiene datos sensibles y borrar el PNG temporal tras compartir (mismo problema de caché que el export). **Dónde:** `perfil.tsx:151-160` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-067 · Borrar el PNG de `captureRef` tras compartir
**Qué:** `captureRef` escribe un fichero temporal; limpiarlo en `finally`. **Dónde:** `perfil.tsx:152-156` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-068 · Reducir TTL de la URL firmada de avatar y refrescar bajo demanda
**Qué:** 7 días es largo para una URL firmada (`data.ts:119`); con la regeneración en `useFocusEffect` basta un TTL más corto (p. ej. 1h), reduciendo la ventana en que una URL filtrada es válida. **Dónde:** `data.ts:118-120` · **Impacto:** 3 · **Esfuerzo:** S

### SEC-069 · Validar tamaño/MIME del avatar también en cliente antes de subir
**Qué:** `pickAvatar` sube `base64` con `quality: 0.5` pero sin límite de tamaño en cliente; un check evita subidas grandes y complementa los límites de Storage de la 0003. **Dónde:** `perfil.tsx:85-105`, `data.ts:109-116` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-070 · No mantener el `base64` del avatar en memoria más de lo necesario
**Qué:** `pickAvatar` pide `base64: true` y lo pasa a `uploadAvatar`; tras subir, liberar referencias (no guardarlo en estado). Hoy no se guarda en estado — bien — pero documentarlo y evitar regresiones. **Dónde:** `perfil.tsx:95-98` · **Impacto:** 1 · **Esfuerzo:** S

### SEC-071 · Sanitizar el nombre de perfil antes de mostrarlo en imágenes compartidas
**Qué:** `profile.name` se renderiza en la tarjeta compartible; aunque es propio, limitar longitud/caracteres evita layouts rotos y contenido inesperado. **Dónde:** `perfil.tsx:374, 516` · **Impacto:** 1 · **Esfuerzo:** S

### SEC-072 · Confirmar antes de subir avatar (uso de cámara/galería)
**Qué:** `pickAvatar` abre la galería directamente; un paso de confirmación o previsualización antes de subir da control al usuario sobre qué imagen sale del dispositivo. **Dónde:** `perfil.tsx:85-105` · **Impacto:** 1 · **Esfuerzo:** S

### SEC-073 · Indicador de "subiendo" durante `pickAvatar`
**Qué:** la subida del avatar no muestra estado de carga; en redes lentas parece que no pasa nada. **Dónde:** `perfil.tsx:85-105` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-074 · `saveName` debería manejar errores de red
**Qué:** `await updateProfile(...)` sin try/catch (`perfil.tsx:107-113`); si falla, el nombre local cambia pero no persiste y no hay aviso. **Dónde:** `perfil.tsx:107-113` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-075 · No exponer el `user.id` en la tarjeta compartible ni en logs
**Qué:** revisar que ningún render incluya el UUID del usuario; hoy no se ve, pero dejar una nota para no añadirlo a la imagen de SEC-066. **Dónde:** `perfil.tsx:363-395` · **Impacto:** 1 · **Esfuerzo:** S

### SEC-076 · Política de privacidad accesible desde la app
**Qué:** una pantalla/enlace que explique qué datos se guardan, dónde (Supabase), y la salida a Anthropic, requerida para tiendas y RGPD. **Dónde:** `perfil.tsx` (sección de cuenta) · **Impacto:** 3 · **Esfuerzo:** M

### SEC-077 · Consentimiento explícito para fotos de evidencia
**Qué:** las evidencias son datos personales (imágenes); un aviso/consentimiento la primera vez que se sube una evidencia refuerza el cumplimiento. **Dónde:** flujo de evidencias (`data.ts:95-107`) + UI que lo invoque · **Impacto:** 2 · **Esfuerzo:** M

### SEC-078 · Revisar permisos de cámara/galería declarados
**Qué:** `app.json` declara `NSCameraUsageDescription`; asegurarse de declarar también el uso de galería (`NSPhotoLibraryUsageDescription`) si `launchImageLibraryAsync` lo requiere en iOS. **Dónde:** `app.json:14-16,36-39` · **Impacto:** 3 · **Esfuerzo:** S

### SEC-079 · Bloqueo biométrico opcional de la app
**Qué:** dado que NIVL guarda diario, peso y una API key de pago, ofrecer un bloqueo con `expo-local-authentication` al abrir protege todo el conjunto en un dispositivo compartido. **Dónde:** nuevo, gating en `_layout.tsx`/`AuthProvider` · **Impacto:** 3 · **Esfuerzo:** L

### SEC-080 · Expiración/renovación de sesión visible para el usuario
**Qué:** cuando el refresh token caduca, el usuario es expulsado sin contexto; un mensaje ("tu sesión ha expirado, vuelve a entrar") mejora la experiencia. **Dónde:** `auth.tsx` + `login.tsx` · **Impacto:** 2 · **Esfuerzo:** M

### SEC-081 · No registrar el cuerpo de la petición del Oráculo
**Qué:** si en el futuro se añade logging, excluir explícitamente headers (`x-api-key`) y el `goal`. Dejar un comentario/utilidad de redacción preparada. **Dónde:** `oracle.ts:78-92` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-082 · Utilidad de redacción de secretos para mensajes de error
**Qué:** función `redact(str)` que elimine patrones tipo `sk-ant-…` antes de mostrarlos en cualquier `Alert`. **Dónde:** nuevo `src/lib/redact.ts`, usado por `oracle.ts` · **Impacto:** 3 · **Esfuerzo:** S

### SEC-083 · Manejar `APIError`/red en `signInWithPassword`/`signUp`
**Qué:** hoy solo se distingue `err` truthy; diferenciar error de red (sin conexión) de credenciales inválidas para un mensaje útil. **Dónde:** `login.tsx:28-33,41-46` · **Impacto:** 3 · **Esfuerzo:** M

### SEC-084 · Deshabilitar inputs mientras `busy` en login
**Qué:** durante el envío, los `TextInput` siguen editables; bloquearlos (`editable={!busy}`) evita cambios a mitad de petición. **Dónde:** `login.tsx:66-83` · **Impacto:** 1 · **Esfuerzo:** S

### SEC-085 · `keyboardDismissMode`/cerrar teclado al enviar
**Qué:** al pulsar Entrar, cerrar el teclado mejora la visibilidad del estado de error/notice. **Dónde:** `login.tsx:60,88` · **Impacto:** 1 · **Esfuerzo:** S

### SEC-086 · Limpiar el campo contraseña tras un login fallido por credenciales
**Qué:** por seguridad/UX, vaciar `password` (no el email) al fallar evita reintentos con la misma cadena pegada. **Dónde:** `login.tsx:30-33` · **Impacto:** 1 · **Esfuerzo:** S

### SEC-087 · No persistir el email entre sesiones salvo opt-in
**Qué:** si en el futuro se recuerda el email, hacerlo con consentimiento; hoy no se persiste (bien), documentarlo. **Dónde:** `login.tsx:18` · **Impacto:** 1 · **Esfuerzo:** S

### SEC-088 · Revisar que `EXPO_PUBLIC_SUPABASE_KEY` sea siempre la publishable, nunca la service
**Qué:** añadir comprobación en arranque o lint que rechace una key con prefijo de service-role en `.env`, para evitar un error catastrófico de configuración. **Dónde:** `supabase.ts:6-11`, `.env.example` · **Impacto:** 4 · **Esfuerzo:** S

### SEC-089 · Documentar en README/AGENTS la regla de secretos y SecureStore
**Qué:** dejar por escrito que (a) solo la publishable va en `.env`, (b) la API key de Anthropic debe migrarse a SecureStore, (c) ningún secreto lleva `EXPO_PUBLIC_`. **Dónde:** `AGENTS.md` / `docs/` · **Impacto:** 2 · **Esfuerzo:** S

### SEC-090 · Asegurar `detectSessionInUrl` y deep links no permitan inyección de tokens
**Qué:** con `scheme: "nivl"` y posibles enlaces `nivl://`, revisar que ningún parámetro de URL pueda fijar/forzar una sesión (session fixation) si se habilita OAuth/magic link en el futuro. **Dónde:** `supabase.ts:22`, `app.json:8` · **Impacto:** 3 · **Esfuerzo:** M

### SEC-091 · `signOut({ scope: 'local' })` explícito si se quiere cerrar solo el dispositivo
**Qué:** decidir y documentar el `scope` del signOut (local vs global); por defecto Supabase invalida en el servidor. Para monousuario, `local` puede bastar y es más rápido offline. **Dónde:** `perfil.tsx:175` · **Impacto:** 1 · **Esfuerzo:** S

### SEC-092 · Evitar condición de carrera entre `getSession` y el primer render de pantallas
**Qué:** pantallas que usan `session?.user.id` pueden renderizar con `undefined` en el primer frame antes de que `AuthProvider` resuelva; estandarizar un patrón de "esperar a `!loading`" reduce estados intermedios raros. **Dónde:** transversal, origen en `auth.tsx`/`index.tsx` · **Impacto:** 2 · **Esfuerzo:** M

Total: 92 mejoras, 8 bugs.
