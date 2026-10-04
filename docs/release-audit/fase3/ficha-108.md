# Ficha de la App Store y de Google Play: NIVL 1.0.8 (PROPUESTA)

Redactada por NIVL - Tiendas el 04/10/2026 para el envío de la 1.0.8. **No se ha aplicado en ninguna consola.** La aplica el coordinador con el usuario cuando se cree la versión 1.0.8 en ASC, **nunca durante la revisión de la 1.0.7**.

Cada afirmación sale del inventario de funciones de `winter2/integracion` del 04/10 (archivo:línea en el informe del subagente; resumen en la sección «Lo que NO se promete»). Sin rayas «—», según la regla de la fase 3.

## Medidas

| Campo | Longitud | Estado |
|---|---|---|
| App Store · nombre | 26 / 30 caracteres | OK |
| App Store · subtítulo | 27 / 30 caracteres | OK |
| App Store · palabras clave | 93 / 100 bytes | OK |
| App Store · texto promocional | 152 / 170 caracteres | OK |
| App Store · descripción | 2673 / 4000 caracteres | OK |
| App Store · novedades | 575 / 4000 caracteres | OK |
| Google Play · título | 26 / 30 caracteres | OK |
| Google Play · descripción breve | 80 / 80 caracteres | OK |
| Google Play · descripción completa | 2576 / 4000 caracteres | OK |

## App Store (es-ES)

**Nombre** (sin cambios): `NIVL: Hábitos y Disciplina`

**Subtítulo** (antes «Coach IA, misiones y rachas»): `Misiones, rachas y coach IA`

**Palabras clave** (sin repetir palabras del nombre ni del subtítulo): `rutina,productividad,gimnasio,dieta,metas,objetivos,motivación,estudio,diario,ligas,progreso`

**Texto promocional** (se puede cambiar sin versión nueva):

```
Nuevo diseño en blanco y negro, coach con voz, ligas y duelos con tus amigos y fotos de progreso. Usa NIVL gratis y añade el coach con NIVL Pro o Élite.
```

**Descripción:**

```
NIVL convierte tus hábitos en misiones diarias. Cumples, subes de nivel y avanzas de rango. Fallas, y el sistema te lo dice sin rodeos.

TU DÍA, EN MISIONES
Crea hábitos y misiones, organiza campañas para tus objetivos largos y planifica la agenda. Cada mañana sabes qué toca hoy. Cada noche el sistema cierra el día y cuenta tu racha.

PROGRESO QUE SE NOTA
Gana XP, sube de nivel y asciende de rango, de E a S, con su título y su marco en el avatar. Cada ascenso tiene su ceremonia, y puedes saltarla con un toque.

GIMNASIO, CARDIO, NUTRICIÓN Y DIARIO
Registra entrenamientos, cardio, comidas, peso y tu diario. Al registrar, la misión enlazada se marca sola.

FOTOS DE PROGRESO
Guarda fotos de frente, de lado y de espalda y compáralas a 30, 90 o 180 días. Son privadas, solo para mayores de 18 años y piden tu permiso de datos de salud.

AMIGOS, LIGAS Y DUELOS
Reta a tus amigos en duelos semanales y ligas privadas que miden la constancia, no quién paga más. Puedes denunciar y bloquear a cualquier usuario.

COMPARTE TU AVANCE
Crea tarjetas de tu nivel, tu rango, tu semana o tu antes y después en formato historia o publicación. Tú eliges qué se ve: las fotos y el peso van apagados por defecto.

COACH DE IA (NIVL PRO Y ÉLITE)
Un coach que consulta tus datos antes de responder, te ayuda a planificar el día y te escribe de vez en cuando, con un tope. Puedes hablarle y escuchar sus respuestas en español. Antes de usarlo te pide permiso para enviar tus datos a los proveedores de IA, y puedes retirarlo cuando quieras. La energía del coach es mensual.

NIVL Pro: coach de IA estándar. NIVL Élite: modelo de mayor capacidad, modo profundo, revisión semanal ampliada, insignia de laurel y la opción de solicitar plaza en un ludus, un grupo privado de entre 5 y 8 miembros Élite. Los grupos se forman de manera gradual; la solicitud no garantiza una plaza inmediata. Las cuentas que nunca han tenido coach pueden probarlo 7 días sin datos de pago ni renovación automática.

PARA IPHONE Y IPAD
Diseño en blanco y negro pensado para leerse de un vistazo. En iPad, con navegación lateral.

NIVL es para personas de 16 años o más. Puedes exportar tus datos y eliminar tu cuenta desde Perfil.

SUSCRIPCIONES
Las suscripciones se cobran a tu cuenta de Apple y se renuevan automáticamente salvo que las canceles al menos 24 horas antes de que termine el periodo. Puedes gestionarlas en Ajustes > tu nombre > Suscripciones. Borrar tu cuenta de NIVL no cancela una suscripción de Apple.

Condiciones de uso: https://nivl.app/terminos
Privacidad: https://nivl.app/privacidad
Acuerdo de licencia de Apple (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
```

**Novedades de la versión 1.0.8:**

```
NIVL 1.0.8 es la mayor actualización hasta ahora.

- Nuevo diseño en blanco y negro.
- Rangos de E a S con grados, títulos y ceremonia de ascenso.
- Coach con voz: háblale y escucha sus respuestas (Pro y Élite).
- El coach consulta tus datos antes de responder.
- Fotos de progreso privadas con comparación antes y después (18+).
- Ligas privadas y duelos semanales con tus amigos.
- Tarjetas para compartir tu nivel, rango, semana o progreso.
- Acceso propio de NIVL con correo y contraseña.
- Ahora también en iPad.
- Recordatorios con tope y vibraciones que puedes apagar.
```

**URLs de la versión 1.0.8** (cambian a nivl.app con este envío; nivl-web.vercel.app sigue viva para los binarios 1.0.7):
- Soporte: https://nivl.app/soporte
- Marketing: https://nivl.app
- Política de privacidad (información de la app): https://nivl.app/privacidad

## Notas de App Review 1.0.8 (3173 caracteres sin credenciales; límite 4.000)

Marcadores: `[BUILD]` (la build 23 o la que se envíe) y las credenciales de Pro y Élite (solo en ASC). **Rutas que hay que confirmar en la build final:** «Avances > Fotos» y «Perfil > "Amigos"» con la navegación v2. Si cambian, se corrigen aquí antes de pegar.

```
NIVL 1.0.8 (build [BUILD]). Spanish-language habit and organisation app for individual users aged 16+. Habits, missions, campaigns, calendar, training, nutrition, journal, finances, progress photos, friends, leagues and duels are free. Optional auto-renewable subscriptions (Pro, Élite) add an AI coach.

ACCOUNTS
Free account: credentials in the sign-in fields. Use it for the purchase, sandbox payment and "Restaurar compras".
Pro account: [PRO_USER] / [PRO_PASS]
Élite account: [ELITE_USER] / [ELITE_PASS]
Pro and Élite access was granted manually on our server. Please do not buy or restore with these two accounts.
Sign in (all accounts): "ENTRAR" tab > email and password > "ENTRAR". New account: "CREAR CUENTA" > details > tick Terms/Privacy > "CREAR CUENTA" > open the email confirmation link on the device > sign in.
None of the accounts has accepted the age declaration or the health and AI consents; the app asks on first use.

PERMISSIONS AND COACH
Health: Perfil > "Salud y bienestar" > "Revisar permiso de salud" > tick the box > "Aceptar y activar salud". AI: separate consent, "Acepto y activo el coach". To try the coach, accept both. Voice (Pro/Élite): hold the microphone button in Coach to dictate; "Escuchar" reads a reply aloud. The microphone is used only while the button is held.

PURCHASES
Perfil > "NIVL Pro" > "Pro" or "Élite" and a plan. Products: nivl_pro_mensual, nivl_pro_anual, nivl_elite_mensual, nivl_elite_anual, nivl_elite_fundador (1 year). The screen shows title, duration, price, renewal terms, "Restaurar compras", Terms, Privacy and Apple EULA. "Probar el coach 7 días": one-time Pro-level trial, no payment details, no renewal.

PROGRESS PHOTOS (18+)
Avances > Fotos. Requires an 18+ confirmation and the health consent. Photos are private (signed URLs), screenshots are blocked on that screen, and the AI never analyses them.

FRIENDS, LEAGUES AND DUELS
Perfil > "Amigos": friend ranking, private leagues and weekly duels based on consistency (no XP or money at stake). Any user can be reported ("Enviar denuncia") or blocked ("Bloquear usuario"); "Convivencia y seguridad" has "Desbloquear" and support. AI coach replies can be reported with "Denunciar respuesta". The developer checks the queue daily and acts within 24 hours. No user-to-user messaging.

SHARING
Level, rank, week, before/after and recap cards (9:16 or 4:5) through the system share sheet. Alias, photos and weight are off by default; photos need 18+ and health consent.

IPAD
Supported in portrait with side navigation.

ACCOUNT DELETION
Perfil > "Cuenta" > "Eliminar cuenta" > "Eliminar para siempre" (sheet) > "Eliminar para siempre" (alert). It deletes the NIVL account, its data and files. Please use a new account to test it.

CREATORS
Invite-only creator accounts see a read-only progress panel. Earnings are handled outside the app; no payments in the app.

SERVICES
Supabase (Frankfurt), Resend (account emails), Apple IAP + RevenueCat, DeepSeek (Pro, trial) and Anthropic (Élite) after AI consent, Expo/APNs. No analytics, ads or tracking SDKs.

Support: https://nivl.app/soporte
Terms: https://nivl.app/terminos
Privacy: https://nivl.app/privacidad

```

## Google Play (es-ES)

**Título:** `NIVL: Hábitos y Disciplina`

**Descripción breve:** `Hábitos en misiones diarias: sube de nivel, reta a tus amigos y usa un coach IA.`

**Descripción completa** (como la de Apple, pero con la gestión de suscripciones de Google Play, el enlace web de borrado de cuenta y sin la sección de iPad):

```
NIVL convierte tus hábitos en misiones diarias. Cumples, subes de nivel y avanzas de rango. Fallas, y el sistema te lo dice sin rodeos.

TU DÍA, EN MISIONES
Crea hábitos y misiones, organiza campañas para tus objetivos largos y planifica la agenda. Cada mañana sabes qué toca hoy. Cada noche el sistema cierra el día y cuenta tu racha.

PROGRESO QUE SE NOTA
Gana XP, sube de nivel y asciende de rango, de E a S, con su título y su marco en el avatar. Cada ascenso tiene su ceremonia, y puedes saltarla con un toque.

GIMNASIO, CARDIO, NUTRICIÓN Y DIARIO
Registra entrenamientos, cardio, comidas, peso y tu diario. Al registrar, la misión enlazada se marca sola.

FOTOS DE PROGRESO
Guarda fotos de frente, de lado y de espalda y compáralas a 30, 90 o 180 días. Son privadas, solo para mayores de 18 años y piden tu permiso de datos de salud.

AMIGOS, LIGAS Y DUELOS
Reta a tus amigos en duelos semanales y ligas privadas que miden la constancia, no quién paga más. Puedes denunciar y bloquear a cualquier usuario.

COMPARTE TU AVANCE
Crea tarjetas de tu nivel, tu rango, tu semana o tu antes y después en formato historia o publicación. Tú eliges qué se ve: las fotos y el peso van apagados por defecto.

COACH DE IA (NIVL PRO Y ÉLITE)
Un coach que consulta tus datos antes de responder, te ayuda a planificar el día y te escribe de vez en cuando, con un tope. Puedes hablarle y escuchar sus respuestas en español. Antes de usarlo te pide permiso para enviar tus datos a los proveedores de IA, y puedes retirarlo cuando quieras. La energía del coach es mensual.

NIVL Pro: coach de IA estándar. NIVL Élite: modelo de mayor capacidad, modo profundo, revisión semanal ampliada, insignia de laurel y la opción de solicitar plaza en un ludus, un grupo privado de entre 5 y 8 miembros Élite. Los grupos se forman de manera gradual; la solicitud no garantiza una plaza inmediata. Las cuentas que nunca han tenido coach pueden probarlo 7 días sin datos de pago ni renovación automática.

DISEÑO EN BLANCO Y NEGRO
Pensado para leerse de un vistazo.

NIVL es para personas de 16 años o más. Puedes exportar tus datos y eliminar tu cuenta desde Perfil.

SUSCRIPCIONES
Las suscripciones se cobran a tu cuenta de Google Play y se renuevan automáticamente salvo que las canceles antes de que termine el periodo. Puedes gestionarlas en Play Store > Pagos y suscripciones > Suscripciones. Borrar tu cuenta de NIVL no cancela una suscripción de Google Play.

Condiciones de uso: https://nivl.app/terminos
Privacidad: https://nivl.app/privacidad
Borrar tu cuenta: https://nivl.app/borrar-cuenta
```

Recursos gráficos de Play: icono de 512 × 512, gráfico destacado de 1024 × 500 y capturas de teléfono. Las capturas de tablet de 7" y 10" solo se suben si se ha probado en una tablet de verdad (`play-checklist.md`). Todavía no existe ninguno; los genera el workflow de capturas (iOS) más una tanda de Android que falta definir.

## Lo que NO se promete (inventario del 04/10)

1. **Análisis de fotos por IA:** no existe en la 1.0.8.
2. **Recompensas por invitar:** la sección «Tus invitados» existe, pero `claimInvite` y `settleMyInvites` no se llaman desde ninguna pantalla, así que la insignia no se gana. Pasado a Juego y QA y a Compras.
3. **Tarjetas de logro y racha:** existen en `sharecard.ts`, pero no hay ningún botón que las abra. La ficha solo nombra nivel, rango, semana y antes/después.
4. **Voz o coach en el plan gratuito:** la voz es solo del coach (Pro, Élite o prueba). No hay voz premium.
5. **Horizontal en iPad:** la app es solo vertical (`orientation: portrait`) y el panel lateral solo está en Hoy. La ficha dice «En iPad, con navegación lateral».
6. **«Todas las pantallas rediseñadas»:** varias solo están recoloreadas. La ficha dice «nuevo diseño en blanco y negro».
7. **Sonidos en los ascensos:** no hay.
8. **Apple Salud, Health Connect, Strava, Sign in with Apple o Google:** no hay (las integraciones de salud son para la 1.0.9).
9. **Pagos a creadores en la app, coach sin límites:** no hay pagos en la app y la energía del coach es mensual.
10. **Otros idiomas, plazos de rango concretos o resultados físicos garantizados:** nada de eso.

## Riesgos de revisión detectados en el inventario (pasados a sus dueños)

- **Micrófono:** dos plugins declaran `NSMicrophoneUsageDescription` con textos distintos (image-picker para vídeo de evidencia y expo-speech-recognition para dictado). Solo queda uno en el Info.plist. Si gana el del dictado, el texto no cubre el vídeo de evidencia (guideline 5.1.1). → Coordinador (app.json): un único texto que cubra los dos usos.
- **Android `SCHEDULE_EXACT_ALARM`:** Google Play lo restringe a apps de alarma o calendario y exige declaración. → Coordinador, antes de la prueba cerrada.
- **iPad solo en vertical:** desde iPadOS 26 no se puede forzar la pantalla completa, así que la app tiene que verse bien al cambiar el tamaño de la ventana. Lo prueba Juego y QA (B4) en un iPad o un simulador.
