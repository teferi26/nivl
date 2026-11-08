# Integración 1.1 y rediseño Ónix: informe

Rama `claude/integracion-1-1-90cd1f`. Nada está subido, aplicado ni desplegado.

## Qué está integrado

Todo: UIScene (Xcode 27), cobro por modos con Haiku 5.5 y comisión de creadores sobre beneficio (0141, 0142), pausa del coach, primer uso, adaptativo web, WORK, IRON, Watch, FOCUS, gafas Meta, capturas y vídeo de tienda, y TV (1b35bea). Nada queda sin fusionar.

## Migraciones pendientes, por orden

0105 a 0109 (IRON) · 0110, 0111 (Watch, renumeradas: antes 0100 y 0101) · 0112 (FOCUS) · 0115 a 0118 (WORK) · 0125 a 0128 (TV) · 0135 (pausa) · 0136 (un solo modelo) · 0140 (cobro) · 0141, 0142 (comisión de creadores) · **0113 (FOCUS), al final y solo después de que la OTA esté adoptada**.

```bash
node scripts/apply-migrations.mjs --hasta=0112
```

Dos arreglos sobre migraciones sin aplicar:

- La 0108 reescribe `export_my_data` y el borrado de salud: las de Watch van después para no perder `salud_diaria`.
- La 0113 y la 0117 reescribían `link` y `health_row` con listas fijas: ahora valen en cualquier orden y conservan `trabajo` y `estudio`.

TV: para que alguien enlace una tele hay que aplicar sus migraciones y copiar `tv/integracion/confirmar-tv.tsx.plantilla` a `src/app/tv/[codigo].tsx`, y antes hacer los dos requisitos de `tv/integracion/INSTRUCCIONES.md` (Televisores enlazados en Perfil y aviso a la cuenta). Sin esa ruta la TV no se enlaza; la app de iOS no cambia.

**Permiso de salud (decidido el 09/11/2026):** nadie vuelve a aceptarlo. La versión sigue en v1, porque la 1.0.11 exige esa versión exacta. La 0111 añade una activación aparte para HealthKit, GPS y reloj: apagados hasta que la persona los conecta, con una explicación una sola vez, también para quien se registra ahora. El servidor la exige en `salud_diaria` y `entrenos_medidos`. El texto del permiso v1 para altas nuevas ya nombra reloj y GPS bajo el mismo identificador de versión; lo que queda registrado por fuente es la fila `2026-11-09-medicion-v1`.

## Estado de la salida (09/11/2026)

Autorizada por el dueño, pero **parada antes del paso 1**: en esta copia no están `.env` (`EXPO_PUBLIC_SUPABASE_URL`) ni `supabase-token.txt` (`SUPABASE_ACCESS_TOKEN`). No se ha aplicado ninguna migración, ni desplegado nada, ni hecho push. `apply-migrations.mjs` admite ya `--sin=0113`.

Comprobado en el código para quien sigue en la 1.0.11: la versión del permiso no cambia; sin `x-nivl-modo` el coach es el General; `x-nivl-mode` se ignora; los productos Pro y Élite que vende siguen abriendo todo. Sin credenciales no se ha podido comprobar en producción: si `ANTHROPIC_API_KEY` tiene acceso a `claude-haiku-5-5`, ni el valor remoto de `modos_1011`.

## Orden de salida

Migraciones → funciones (`coach`, `prevision`, `ritual`, `revenuecat-webhook`) → productos en tiendas → binario → OTA → 0113.

**Hace falta binario nuevo:** `expo-calendar`, `react-native-maps`, `expo-keep-awake`, HealthKit, ubicación en segundo plano, targets de Watch, UIScene. Sube `version` en `app.json` y regenera el lockfile con npm 10.9.2 si cambia alguna dependencia. Playfair Display por sí sola no pedía binario.

## Verificación

`npm run typecheck`, `npm test` (6615), `npm run lint` (0 errores), `npx expo export --platform ios` y `deno check` de `coach`, `prevision` y `ritual`. El permiso de salud y la activación de la medición se prueban además sobre todas las migraciones reales con `scripts/test-medicion-permiso.mjs` (PGlite): usuario antiguo, usuario antiguo que activa y usuario nuevo.

**Tras fusionar adaptativo.** Recorrido web en Chrome, 375 y 1280, General e IRON: 110 combinaciones, 0 problemas del arnés, 6 fallos de interacción. Cuatro son de las pestañas de login: el arnés espera que cambie el número de campos y el registro corto ya tiene los mismos dos. Dos son del coach, sin campo de texto visible con los datos simulados; lo más probable es la pausa del coach, que cambia el campo por su pie, pero no se ha confirmado. En iOS, tras la fusión, solo se ha comprobado el arranque y la portada: la pasada a toques queda pendiente.

**Binario Debug de verdad en simulador iOS 27.2 (Xcode 27.2), contra un servidor falso local.** Qué ha corrido contra ese servidor falso, no contra Supabase: autenticación, perfiles, misiones, permisos de salud e IA, derechos de modos, firma, pausa y el coach (respuesta fija, sin modelo). Lo verificado en iPhone:

- Portada, cuestionario entero, «Voy a ser crudo contigo», curva, cuenta, bienvenida, nombre, modos, permiso de salud aceptado, seis misiones marcadas, plan de 90 días, oferta sin tienda, Hoy (sin «Novedad» y sin petición de avisos).
- El evento `onboarding_goal` llega bien al servidor falso.
- Completar misión, tarjeta de firma, `/firma` con huella larga: `seal_letter` y `commitment_signed`.
- Rueda de modos, Hoy de IRON, FOCUS (arranque guiado), WORK y FOUNDER; modo cerrado sin pagar; pausa, compromiso y reactivación del coach.

Dos fallos de binario que el navegador no podía ver, ya corregidos: dos plugins hacían lo mismo en `AppDelegate` y el prebuild fallaba; y sin clave de Recordatorios `expo-calendar` tiraba la app al arrancar.

iPhone Duo y Apple Watch: la app arranca y sigue viva en los dos (Watch emparejado, Hoy vacío porque no le llegan datos). En Duo solo se ha visto la portada, no el recorrido ni el cambio de pantalla.

**No verificado:** Supabase real, compra real (el binario no lleva clave de RevenueCat, solo se ha visto la oferta sin tienda), correo real, IA real, HealthKit y GPS reales, VoiceOver, entrega Watch a iPhone (Apple no la soporta en simulador: exige reloj real), iPad, Android, y la app de TV dentro de este binario. La suite Deno completa no corrió en este entorno (solo `deno check`). El Release no se ha compilado: lo probado es Debug.

## La entrada, en orden

`/empezar` (portada con aviso de salud y edad, cuestionario, «Voy a ser crudo contigo», curva) → cuenta (correo, contraseña, casilla) → confirmación de correo → edad y medición → nombre → modos → permiso de salud si hace falta → misiones → plan de 90 días → oferta → Hoy. La firma pasa a `/firma` y se ofrece en Hoy cuando ya se ha hecho algo.

Las respuestas viven solo en el teléfono hasta que hay cuenta. Una meta de salud sin permiso no se guarda. El detalle del cuestionario va en la clave `reason` de `onboarding_goal`, sin migración nueva.

## Para decidir (dueño)

1. Copys de la maqueta que se han suavizado por no poder cumplirlos: «en 2 minutos» (el recorrido real llega a 24 pantallas), «Otra persona» en el día 90, «Preparando a tu coach» y «Para eso estoy yo».
2. El plan de 90 días llega tras el correo. Se puede adelantar a antes de la cuenta: la maqueta lo pone después.
3. Quien rechaza salud y es deportista empieza sin misiones (6 de 6 piden permiso). Ahora la acción principal es revisar el permiso.
4. La letra de compra traducida necesita revisión legal por idioma.
5. La cara «ya tienes plan» de `/pro`, `copyUpsell` y parte del catálogo de oferta siguen con Pro y Élite o solo en español.
6. Nota de IRON sobre la cabecera y FOUNDER: cifras reales (hechas, racha, XP) en lugar de las inventadas en la maqueta.

## Pendiente

- Skill `nivl-design-system` (no se puede escribir desde aquí): sustituir paleta, tipos (Playfair y Outfit, sin Cinzel), «esquinas rectas», `SystemWindow` y el vocabulario por Ónix, según `docs/design-v2/SISTEMA.md`.
- **Watch y TV (SwiftUI)**: llevar fondo #09090B, botón hueso #EDEAE3, oro #C9A961 en cifras y detalles, cifras en Playfair y radios de 22, con el mismo orden que Hoy (héroe, coach, ahora, tres cifras).
- FOCUS en escritorio va en una columna: al fusionar se perdió `DosColumnas`.
- La pantalla de arranque nativa sigue con el escudo hueso antiguo: cambia con el binario.
- Capturas en la carpeta de notas: `capturas-onix/` (`simulador/`, `movil/`, `web/`, `onboarding-real/`). La hoja del permiso de salud no se guarda porque contiene datos del responsable.
- Auditoría UX: hallazgos altos corregidos. Sin aplicar: rotular el veredicto como «Tu punto de partida» (se deja «El veredicto», pedido en la maqueta) y ocultar el código de creador salvo enlace (es dato protegido).
