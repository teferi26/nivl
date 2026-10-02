# Revisión de coherencia · release-audit (Chat 1 · Tiendas, subagente c)

Fecha: 02/10/2026. Revisado en el worktree `winter-chat1`, rama `winter/chat1-tiendas`. La revisión empezó en `1185147`, pero durante ella entraron `5426dad`, `9ba448a` y `3ce681e`. Las líneas citadas corresponden a **`3ce681e`**. Solo lectura: no se ha cambiado ningún otro archivo ni se ha enviado nada a Apple ni a Google.

Fuente de verdad: [00-apple-rechazo-literal.md](00-apple-rechazo-literal.md). Prevalecen las decisiones del usuario del 02/10/2026: no hay Franky, hay 165 territorios, el dominio único es `nivl-web.vercel.app`, el copy de Élite no incluye acceso anticipado, la moderación la hace el dueño con aviso push, en Play se aplica la prueba cerrada 12×14 y se desmarcan Mac y Vision Pro.

## Resumen

**Veredicto: NO LISTO.** Faltan unas correcciones de texto antes de pasar solo a rellenar marcadores. Motivos:

1. **P0.** La escena 0 del guion muestra Ajustes y TestFlight *antes* de abrir la app. Apple exige que la grabación «must begin with launching the app», y la respuesta afirma que empieza así.
2. **P1.** La respuesta y las notas hacen tres afirmaciones que el código de este worktree no respalda y que no llevan marcador:
   - el aviso push al dueño por cada denuncia (la 0037 no está en el worktree);
   - el «warning» al denunciado (no existe esa acción);
   - «NIVL accounts are NIVL's own» (`src/app/login.tsx` todavía usa `frankyLogin` y `frankyRegister`).
3. **P1.** Hay dos riesgos que la respuesta no cubre: (a) `start_trial` falla si se rechazó la salud, según el propio guion; (b) las credenciales de la cuenta Gratis ya cargadas en ASC pueden ser de una cuenta creada con el puente de Franky.
4. **P1.** La interfaz que se va a grabar sigue diciendo «App Store o de Google Play», contra la 2.3.10, y en el código la tarjeta para compartir apunta a `nivl.app`.

Puntos en orden: las notas ocupan unos **3.535 caracteres** con valores realistas (credenciales de 30 caracteres, rutas de 70 y «build 21»), por debajo de 4.000. En los archivos versionados hay **cero credenciales y cero datos personales**. Los textos que se enviarían a Apple **no contienen** Franky, nivl.app, «acceso anticipado» ni Solo Leveling.

## Hallazgos

| Sev. | Archivo:línea | Problema | Corrección exacta |
|---|---|---|---|
| P0 | apple-guion-video.md:43 | La escena 0 («Antes de abrir la app, mostrar Ajustes… y la ficha de TestFlight») hace que el vídeo **no empiece lanzando la app**. Contradice la línea 11 del propio guion, la línea 34 de la respuesta y el texto literal de Apple | Sustituir la escena 0 por: «**0. Identificación (fuera del vídeo).** El modelo, el iOS y la build se anotan en la respuesta (`[DEVICE]`, `[IOS]`, `[BUILD]`). Si se quieren enseñar, se graban en un clip aparte que no se adjunta al principio del recorrido. El vídeo empieza en la pantalla de inicio con la app cerrada.» |
| P1 | apple-respuesta-resolution-center.md:64; apple-notas-revisor.txt:21 | «receives a notification when a new report arrives» / «is notified of each new one» depende del push de `ritual` (migración 0037, «pendiente de integrar» según la línea 16 de la respuesta). En el worktree las migraciones acaban en `0034` y `supabase/functions/ritual/index.ts` no trata las denuncias | Añadir el marcador `[MOD_PUSH]` a la tabla de cabecera («Solo si la 0037 está integrada y desplegada desde `[SHA_INTEGRADO]` y se ha probado un aviso real»). Si no se cumple, en la respuesta: `The developer reviews every report personally, receives a notification when a new report arrives and acts within 24 hours` → `The developer reviews the report queue personally every day and acts within 24 hours`; y en las notas: `is notified of each new one and acts within 24 hours` → `checks the queue daily and acts within 24 hours` |
| P1 | apple-respuesta-resolution-center.md:64 | «hiding content, warning or blocking the reported account»: `docs/MODERACION-SOCIAL.md` solo prevé `rejected` (representación neutra) y `suspended` (fuera de las funciones sociales). No hay acción de aviso | → `for example by replacing the reported name, title or photo with a neutral one, or by suspending the account from social features` |
| P1 | apple-respuesta-resolution-center.md:56 | «NIVL accounts are NIVL's own; no third-party account is needed» es falso en el código actual (`src/app/login.tsx:16-21`, `:84`, `:88` usan Franky). Depende de la integración de los chats 3 y 4 | Que la sustitución de `[LOGIN_ROUTE]` y `[SIGNUP_ROUTE]` (fila de la línea 14) arrastre también esta frase: «Esta frase solo se mantiene si la build `[BUILD]` ya no llama a `franky.es`; si no, se borra». Añadir esa condición al texto de la línea 14 |
| P1 | apple-notas-revisor.txt:15; apple-respuesta-resolution-center.md:60-62; apple-guion-video.md:58 | El guion reconoce que «`start_trial` falla si se rechazó el consentimiento de salud (trigger 0030)». Las notas dicen «Declining keeps the free features. Then open Coach». Si el revisor rechaza la salud y luego toca «Probar el coach 7 días», ve un error, y la 2.1 lo trata como fallo | Puerta en apple-build-y-reenvio.md: «[ ] Integrado el arreglo del Chat 3 a `start_trial` (o probado en A5 que la prueba arranca con la salud rechazada)». Mientras no esté, en las notas: `Declining keeps the free features. Then open Coach` → `Declining keeps the free features. To try the coach, accept both, then open Coach` |
| P1 | cuentas-demo.md:9; pruebas-fisicas-minimas.md:13 (A3) | Los campos de acceso de ASC «ya cargados» pueden ser de una cuenta creada con el puente de Franky. Según el Chat 3 (apple-privacidad-datos.md, §10, fila 8), «no hay migración». Con Auth propio, esa cuenta podría no entrar | Añadir a cuentas-demo.md, en «Antes de enviar»: «[ ] La cuenta Gratis de los campos de acceso de ASC entra con la build `[BUILD]` (sin Franky). Si no entra, crear una nueva y sustituir las credenciales en ASC» |
| P1 | src/lib/proplans.ts:446; src/app/pro.tsx:174-175; src/app/(tabs)/perfil.tsx:921-922 | La interfaz que se va a grabar dice «App Store o de Google Play» / «Apple ID o de Google Play» (riesgo 2.3.10, ya señalado en apple-ficha-capturas-productos.md:97). El vídeo lo mostraría | Puerta en apple-build-y-reenvio.md: «[ ] Sin "Google Play" en la UI iOS (7.2-1, 4 y 5 de la ficha)». Dueños: Chat 2 y Chat 4 |
| P1 | src/lib/socialmath.ts:236; src/components/ShareCardSemana.tsx:5 | `URL_NIVL = 'https://nivl.app'` (el dominio no resuelve) contradice la decisión de dominio único | Para Chat 4: `URL_NIVL = 'https://nivl-web.vercel.app'`. Revisar también `associatedDomains` en `app.json:14` (coordinador) |
| P1 | apple-respuesta-resolution-center.md:72; apple-notas-revisor.txt:27 | «DeepSeek (Pro coach and the 7-day trial)» solo es cierto si el dueño confirma `COACH_BASE_URL` (privacidad §10, fila 2). La puerta está en apple-build-y-reenvio.md:35, pero la cabecera de la respuesta no tiene marcador | Añadir a la tabla de cabecera la fila «`[AI_ROUTING]` (interno): no enviar mientras no se marque la puerta de apple-build-y-reenvio.md:35». «some shorter tasks» no está acreditado: → `Anthropic (Claude: Élite coach and other requests that use Claude, as listed in the consent screen)`, que coincide con `src/lib/consentmath.ts:40` |
| P1 | apple-notas-revisor.txt (todo el archivo) | Apple pide añadir «this information» (los puntos 1 a 7) a las notas. El punto 1 (el vídeo) no aparece en las notas | Añadir tras la línea 1: `Screen recording: [VIDEO] (physical [DEVICE], iOS [IOS], build [BUILD]).` (unos 80 caracteres; el total sigue por debajo de 4.000) |
| P2 | apple-guion-video.md:72; respuesta:40 | La respuesta dice «blocking/unblocking them», pero el guion solo *enseña* «Desbloquear». La prueba A9 sí incluye el desbloqueo | Guion: «enseñar «Desbloquear»» → «tocar «Desbloquear» → confirmar «Desbloquear» en la alerta» |
| P2 | apple-respuesta-resolution-center.md:58 | «Campaigns» en inglés y sin comillas. La pestaña se llama «Campañas» (`src/app/(tabs)/_layout.tsx:11`) | `Campaigns and "Agenda"` → `"Campañas" and "Agenda"` |
| P2 | apple-respuesta-resolution-center.md:94; notas:18 | «limited availability»: en la tienda el producto no tiene tope; el límite de 100 plazas es del servidor (NO PROBADO, ficha:82) | → `Élite at a founder price, shown only while founder places remain; auto-renewable, not lifetime` |
| P2 | apple-respuesta-resolution-center.md:66 | «as described in the Privacy Policy»: la política publicada habla de 6 años (privacidad:137) y el Chat 3 dice «no declarar 6 años» (privacidad §10, fila 6) | Chat 4 alinea `/privacidad` con lo que se conserva de verdad, o se quita «as described in the Privacy Policy» |
| P2 | apple-respuesta-resolution-center.md:101 | «the Apple Standard EULA also applies» es cierto en ASC, pero `/terminos` no la cita (ficha:109, P1-4) | Chat 4 añade el párrafo de ficha:122 en `/terminos` antes del envío |
| P2 | cuentas-demo.md:11 y :19 | La Élite de demostración vence el 28/11/2026. La regla de «al menos 60 días desde el reenvío» exige que dure hasta diciembre | «Si se reutiliza la Élite existente, ampliar la concesión hasta al menos `[fecha de reenvío + 60 días]`» |
| P2 | cuentas-demo.md:9; respuesta:52 | Si la cuenta Gratis ya gastó la prueba, el texto «Eligible accounts can start…» (respuesta:98) no avisa al revisor | Añadir a la tabla de cabecera `[TRIAL_STATE]`: si la prueba no se puede restablecer, añadir a las notas «The Free account has already used its trial; the paywall shows the paid plans directly.» |
| P2 | apple-notas-revisor.txt:11 | `[LOGIN_ROUTE_SHORT]` y `[SIGNUP_ROUTE_SHORT]` no se definen en ninguna tabla de marcadores | Añadirlos a la fila de la línea 14 de la respuesta: «versión de ≤ 70 caracteres para las notas» |
| P2 | apple-notas-revisor.txt (no aparece) | Si `[AI_REPORT]` se rellena en la respuesta, las notas no lo recogen | Si se rellena, añadir a REPORT AND BLOCK: `AI coach replies can also be reported from the reply.` |
| P2 | apple-build-y-reenvio.md:12, :39, :41, :49-50 | Datos desfasados: «175 → 173… pendiente retirar 8 más», «Resuelto el borrado de la cuenta Franky», «Territorios decididos y `[N]`» y la «Propuesta firme / A decidir» | :12 → «175 → 165 (02/10: retirados CHN, RUS, HKG, MAC, BLR, VEN, MMR, AFG, YEM y XKS; se mantienen 6 territorios británicos de ultramar). Pendiente aplicar en ASC y comprobarlo con GET». Marcar :41 como hecho. :39 → «[ ] franky-auth retirado y la build sin llamadas a franky.es (ya en :34)». Encabezar :47-53 con «DECIDIDO el 02/10: se retiran los 8; se mantienen AIA, BMU, VGB, CYM, MSR y TCA» |
| P2 | apple-ficha-capturas-productos.md:25, :119, :124, :147 | «175 territorios»; «quitar China (y valorar Rusia)»; «añadir la ruta de borrado de la cuenta Franky» en las notas; «enlace para borrar la cuenta de Franky». Contradicen la nota de :101 | :124 → «Notas: sin Franky (decisión del 02/10)». :147 → borrar «y enlace para borrar la cuenta de Franky en la hoja de borrado». :119 → «Hecho por decisión del 02/10 (165)» |
| P2 | apple-ficha-capturas-productos.md:39, :113 | P2-3 «modelo de mayor capacidad NO PROBADO». El Chat 3 ya ha leído las rutas: `elite_*` → `claude-sonnet-5` y `pro_*` → `deepseek-v4-flash` (privacidad §10, fila 2) | Cerrar P2-3: «Rutas confirmadas por el Chat 3 el 02/10; queda pendiente `COACH_BASE_URL`» |
| P2 | apple-ficha-capturas-productos.md:72-76 frente a 00-apple-rechazo-literal.md:7 y apple-build-y-reenvio.md:10 | El estado de los productos aparece como READY_TO_SUBMIT en un documento y como «Listo para revisión» / READY_FOR_REVIEW en los otros dos | Volver a hacer el GET y unificar. Si es READY_TO_SUBMIT, la línea 26 de apple-build-y-reenvio.md («siguen… READY») tiene que exigir que vayan en el envío |
| P2 | apple-ficha-capturas-productos.md:5; apple-privacidad-datos.md:7 | Citan el SHA `58f4c60`, que no es ni la base ni el HEAD actual | Actualizarlo a `3ce681e` (o al SHA integrado) cuando se vuelvan a comprobar las líneas |
| P2 | apple-privacidad-datos.md:22, :70, :116, :124-125, :127 | Franky como proveedor, borrado «solo NIVL», D4, R-PRIV-2 «175 territorios», R-PRIV-3 y R-PRIV-5 (`nivl.app`), todos desfasados. La nota de :3 los salva en parte | Marcar R-PRIV-2 y R-PRIV-3 como «resueltos por decisión del 02/10» y R-PRIV-5 como «decidido: dominio único; pendiente de código (Chat 4)» |
| P2 | play-checklist.md:81, :98 | Franky en Data Safety (correo, «compartir») | «Sin Franky si la build ya no lo usa (privacidad §10, fila 8)» |
| P2 | play-checklist.md:115, :121, :175 | `nivl.app` como host en la fila de enlaces, en 6.1 y en el diff P-A (lo mantiene en `intentFilters`) | Diff P-A: sustituir el host `nivl.app` por `nivl-web.vercel.app` en lugar de añadirlo. Fila :115 → «Fuera de alcance: dominio único `nivl-web.vercel.app` (decisión del 02/10)» |
| P2 | play-checklist.md:145, :158 | «Aplica si la cuenta es personal…» y «12×14 si la cuenta es personal» | → «Aplica: la cuenta es personal y reciente (decisión del 02/10)» |
| P2 | play-checklist.md:129 frente a cuentas-demo.md y respuesta:54 | En Play, la cuenta demo «ya ha confirmado la edad y los consentimientos»; en Apple, ninguna los tiene aceptados | Decidirlo a propósito y dejarlo escrito. Recomendación: el mismo criterio que Apple, sin aceptar nada, con los pasos en las instrucciones de acceso |
| P2 | matriz-dispositivos.md:34-35, :52; pruebas-fisicas-minimas.md:37 | «PROPUESTA M… las decide el coordinador» y «o se prueba (B4-Mac) o se propone desactivar»: ya está aprobado desmarcar (apple-build-y-reenvio.md, sección Mac). El caso B4-Mac no existe | matriz:52 → «APROBADA el 02/10: se desmarcan Mac y Vision Pro (lo ejecuta el coordinador)». pruebas:37 → «Mac y Vision Pro se desmarcan en ASC (decisión del 02/10); no se prueban» |
| P2 | src/lib/proplans.ts:332 | El copy aprobado «Solicita plaza en un ludus (5-8)» no está en el código («Plaza en un ludus» + detalle). La respuesta es neutra y no se contradice | Para Chat 2/Chat 4 (no bloquea la respuesta) |
| P2 | src/lib/oracle.ts:188 | El prompt del Oráculo dice «estilo Solo Leveling». Es BYOK y solo de desarrollo (privacidad:24), así que no está en la tienda | Para Chat 4: quitar la referencia al rediseñar la marca |

Cosas comprobadas que **sí** tienen respaldo en `src/`: «Hoy», «Coach», «Hábitos», «Agenda» y «Perfil» (`(tabs)/_layout.tsx:8-13`); la fila «NIVL Pro» (`perfil.tsx:588-590`); «Suscribirme» y «Ver NIVL Élite» (`pro.tsx:207`); «Probar el coach 7 días» (`ProOffer.tsx:438`); «Restaurar compras» y los enlaces Términos/Privacidad (`ProOffer.tsx:494-521`); «Revisar permiso de salud», la casilla, «Aceptar y activar salud», «Ahora no» y «Retirar y borrar salud» (`ConsentimientoSalud.tsx:91, 119-125, 147`); «Acepto y activo el coach» (`consentmath.ts:56`); «Envío de datos al coach» (`perfil.tsx:847`); el botón «…» y la fila de ranking (`amigos.tsx:181, 191-195`); «Enviar denuncia», «Bloquear usuario», «Bloquear», «Desbloquear», «Convivencia y seguridad» y «Contactar con soporte» (`amigos.tsx:339-361, 987-1040`); «Cuenta», «Exportar mis datos», «Eliminar cuenta» y «Eliminar para siempre» ×2 (`perfil.tsx:860-930, 397`); los cinco IDs y los precios en céntimos (`proplans.ts:151-184`); los proveedores y lugares de IA (`consentmath.ts:38-42`); el descargo de salud (`consentmath.ts:61-65`); la URL de soporte (`socialSafety.ts:15`). Frankfurt: PASS según el Chat 3 (privacidad §10, fila 1). Nada atribuye a Apple defectos que no señaló, y nada garantiza la aprobación.

## Marcadores pendientes

| Archivo | Marcador (líneas) | Quién lo resuelve |
|---|---|---|
| apple-respuesta-resolution-center.md | `[BUILD]` (27, 32) | Coordinador (la build asociada en ASC) |
| | `[VIDEO]` (31), `[DEVICE]`, `[IOS]`, `[DATE]` (32), `[TIMESTAMPS]` (35) | Coordinador con el usuario, después de grabar |
| | `[LOGIN_ROUTE]`, `[SIGNUP_ROUTE]` (56) | Chats 3 y 4 (rótulos de Auth propio) → coordinador |
| | `[AI_REPORT]` (64) | Chat 4 (o borrarlo) |
| | `[PAYWALL]` (96) | Chat 2 (confirmar los 5 planes en `[BUILD]`) |
| | `[SHA_INTEGRADO]` (18, interno) | Coordinador (redespliegue) |
| | **Propuestos:** `[MOD_PUSH]`, `[AI_ROUTING]`, `[TRIAL_STATE]` | Chat 3 / dueño / coordinador |
| | `[PLAZO]` resuelto (24 hours); `[N]` resuelto (165); `[DELETION]` eliminado | — |
| apple-notas-revisor.txt | `[BUILD]` (1), `[PRO_USER]`, `[PRO_PASS]` (8), `[ELITE_USER]`, `[ELITE_PASS]` (9) | Coordinador con el usuario, **solo en ASC** |
| | `[LOGIN_ROUTE_SHORT]`, `[SIGNUP_ROUTE_SHORT]` (11) | Chats 3 y 4 → coordinador |
| | **Propuesto:** `[VIDEO]` y `[DEVICE]`/`[IOS]` en una línea nueva | Coordinador |
| apple-guion-video.md | `[BUILD]` (32, 43), `[SIGNUP_ROUTE]` (48), `[LOGIN_ROUTE]` (50), `[PAYWALL]` (67), `[TIMESTAMPS]` (89) | Los mismos dueños que en la respuesta |
| cuentas-demo.md | `[PRO_*]`, `[ELITE_*]` (10, 11, 22), `[SIGNUP_ROUTE]` (12), `[LOGIN_ROUTE]`, `[BUILD]` (18) | Coordinador con el usuario (en ASC y `privado/`) |
| apple-build-y-reenvio.md | `[BUILD]` (23, 37, 38, 40), `[SHA_INTEGRADO]` (34) | Coordinador |
| pruebas-fisicas-minimas.md | `[BUILD]` (5) | Coordinador; los resultados, Chat 5 |
| Resto (00, ficha, privacidad, play, matriz) | Ninguno | — |

## Matriz de cobertura

| Exigencia de Apple | Respuesta | Notas | Guion | Prueba física |
|---|---|---|---|---|
| Vídeo en un dispositivo físico | :31-32 | **No** (P1: añadir línea) | :9, prep. 1-2 | A1-A11 (iPhone con iOS ≥ 27.0.1) |
| Último sistema operativo | :32 `[IOS]` | No | :10, prep. 2 | A1 |
| Empieza lanzando la app | :34 | — | :11, :45, prep. 6; **contradicho por :43 (P0)** | A1 |
| Flujo típico | :37, :58 | WHAT IT IS | escena 3 (:52-56) | A4 |
| Registro | :36, :56 `[SIGNUP_ROUTE]` | :11 | escena 2 (:48) | A2 |
| Login | :36, :56 `[LOGIN_ROUTE]` | :11 | escena 2 (:49-50) | A3 |
| Borrado de cuenta | :41, :66 | ACCOUNT DELETION :24 | escena 7 (:78-79) | A10 |
| UGC: denuncia | :40, :64 | :21 | escena 6 (:70) | A9 |
| UGC: bloqueo | :40, :64 | :21 | escena 6 (:71-72; desbloqueo solo enseñado, P2) | A9 |
| Suscripciones: título, duración y precio | :39, :88-96 `[PAYWALL]` | PURCHASES :18 | escena 5 (:62) | A6 |
| Enlaces a Términos y Privacidad | :39, :96, :101-102 | :18, :36-37 | escena 5 (:64) | A6 |
| Acceso al contenido de pago | :39, :53 | :10 | escena 5 (:65) | A7, A8, A11 |
| 2. Propósito y público | :45 | WHAT IT IS :4 | — | — |
| 3. Instrucciones y credenciales | :49-66 | ACCOUNTS, PERMISSIONS | escenas 2-4 | A3, A5 (riesgo de la prueba con la salud rechazada, P1) |
| Credenciales por tipo de cuenta | :51-53 | :7-9 | — | A3, A11 |
| 4. Servicios externos | :70-74 | SERVICES :27 | escena 4 (consentimiento con proveedores) | — (Chat 3, §10) |
| 5. Diferencias regionales | :78 | REGIONS :30 | — | — |
| 6. Regulación y material de terceros | :82 | :33 | — | — |
| 7. Qué se compra y cómo llegar | :86-98 | PURCHASES :18 | escena 5 | A6-A8 |

## Inglés de la respuesta y de las notas (propuestas; no aplicadas)

| Archivo:línea | Antes | Después |
|---|---|---|
| respuesta:27 | `The submission now uses NIVL 1.0.7 ([BUILD]).` | `This submission now includes NIVL 1.0.7 (build [BUILD]).` |
| respuesta:32 | `App: NIVL 1.0.7 ([BUILD]), installed from TestFlight.` | `App: NIVL 1.0.7 (build [BUILD]), installed from TestFlight.` |
| notas:1 | `NIVL 1.0.7 ([BUILD]). Full answers to your 29 Sep message (Guideline 2.1) are in our App Review reply.` | `NIVL 1.0.7 (build [BUILD]). Full answers to your 29 September message (Guideline 2.1) are in our Resolution Center reply.` |
| respuesta:34-35 | `…shows, in order:` + `[TIMESTAMPS]` on its own line | `…shows, in order (times refer to the recording):` and one time per bullet: `- [00:00] launch…`, `- [mm:ss] registration…` |
| respuesta:45 | `users plan in one place, see each day what to do and track their progress.` | `users plan in one place, see what to do each day and track their progress.` |
| respuesta:51 | `The credentials of each account are in the App Review sign-in fields and in the notes.` | `The Free account's credentials are in the App Review sign-in fields; the Pro and Élite credentials are in the App Review notes.` |
| respuesta:53 | `a sandbox purchase would replace the granted access, and that access would expire.` | `a sandbox purchase would replace the granted access, which would then expire.` |
| respuesta:56 | `Signing in. [LOGIN_ROUTE] To create a new account instead, [SIGNUP_ROUTE]` | `Signing in: on the access screen, enter the credentials and tap "[LOGIN_LABEL]". To create a new account, tap "[SIGNUP_LABEL]" and follow the steps.` (update the marker table) |
| respuesta:58 | `Campaigns and "Agenda" organise longer goals and scheduled activities.` | `"Campañas" and "Agenda" organise longer-term goals and scheduled activities.` |
| respuesta:64 | `after confirming "Bloquear", the users no longer see each other` | `after confirming "Bloquear", the two users no longer see each other` |
| respuesta:64 | `acts within 24 hours: hiding content, warning or blocking the reported account.` | `acts within 24 hours, for example by replacing the reported name, title or photo with a neutral one, or by suspending the account from social features.` |
| respuesta:66 | `subscriptions are managed in the Apple ID settings.` | `subscriptions are managed in Settings > [your name] > Subscriptions.` |
| respuesta:72 | `Anthropic (Claude: Élite coach and some shorter tasks)` | `Anthropic (Claude: the Élite coach and other requests listed in the consent screen)` |
| respuesta:82 | `the icon resources are under open-source licences.` | `the icons come from open-source icon sets (Ionicons, MIT licence).` |
| respuesta:94 | `Élite at a founder price; limited availability; auto-renewable, not lifetime` | `Élite at a founder price, shown only while founder places remain; auto-renewable, not lifetime` |
| notas:12 | `No permission has been accepted for you: the age declaration and the health and AI consents are asked in the app.` | `None of the accounts has accepted the age declaration or the health and AI consents; the app asks for them on first use.` |
| notas:15 | `Declining keeps the free features. Then open Coach and send…` | `Declining keeps the free features. To try the coach, accept both, then open Coach and send…` |
| notas:21 | `is notified of each new one and acts within 24 hours.` | (if `[MOD_PUSH]` is not met) `checks the queue daily and acts within 24 hours.` |

El tono general es claro, educado y factual. La ortografía británica (organisation, licence) es coherente en todo el texto, y no hay errores gramaticales graves.

## Seguimiento (Chat 1, 02/10/2026)

Aplicado después de la revisión:
- **P0:** el guion ya empieza lanzando la app; la identificación va fuera del vídeo.
- **P1 de texto:**
  - moderación descrita de forma conservadora («reviews the report queue personally every day»), con `[MOD_PUSH]` opcional;
  - acciones de moderación reales («neutral» y «suspending»);
  - la frase sin Franky queda condicionada en la tabla;
  - `[AI_ROUTING]` y `[TRIAL_STATE]` añadidos;
  - «to try the coach, accept both» en la respuesta y en las notas;
  - el vídeo, añadido a las notas (3.464 caracteres con marcadores);
  - la cuenta Gratis se prueba con Auth propio;
  - ampliación de la Élite de demostración;
  - puertas nuevas en apple-build-y-reenvio.md: start_trial, «Google Play» en iOS, /privacidad y /terminos.
- **Inglés:** aplicadas las propuestas, salvo «Ionicons, MIT licence» (no verificado; se mantiene la frase genérica).
- **P2 de documentos:** 165 territorios, sin Franky, `nivl.app` fuera de alcance, prueba cerrada aplicable, Mac y Vision Pro aprobados, P2-3 cerrado y estado de los productos aclarado (READY_TO_SUBMIT como producto, READY_FOR_REVIEW en el envío).

Enviado a sus dueños: `URL_NIVL = nivl.app` (`socialmath.ts:236` y `ShareCardSemana.tsx:5`) y la coherencia de `/privacidad` y `/terminos` al Chat 4; el copy «Solicita plaza en un ludus (5-8)» en `proplans.ts:332` al Chat 2.

Sin aplicar a propósito: SHA citados en ficha y privacidad (se actualizan al revisar sobre el SHA integrado) y `[AI_REPORT]` (pendiente del Chat 4).
