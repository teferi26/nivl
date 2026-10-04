# Auditoría de guidelines · Experiencia (1.0.8, build 24)

Fecha: 4 de octubre de 2026. Base: `winter2/integracion @477c545`; arreglos en `winter2/chat4-experiencia` hasta `2d375cb`.
Fuente: App Review Guidelines vigentes, consultadas el 04/10/2026 en developer.apple.com/app-store/review/guidelines (2.4.1, 4, 4.1, 4.2, 4.5.4, 4.8, 4.10). HIG: áreas táctiles de 44 pt, Dynamic Type, contraste y VoiceOver.
Método: lectura de código con evidencia (archivo:línea y grep), capturas de la galería (`/kit/pantallas`, export web `--dev`) y revisión cruzada por el dueño de cada parte (Juego y QA, Seguridad, Compras). **Nada probado en dispositivo**: VoiceOver, teclado de Android y rotación real del iPad quedan para la prueba física (`docs/qa-audit/PRUEBA-108-BUILD24.md`).

Estados: **CUMPLE** · **RIESGO** (no incumple, pero conviene vigilarlo o explicarlo en las notas) · **INCUMPLE** (arreglado en el SHA indicado, o pendiente si no lo hay).

## 4 · Diseño

| Regla | Estado | Prueba | Arreglo |
|---|---|---|---|
| 4.1 (a)(c) Nombre e icono propios | CUMPLE | `app.json` name «NIVL»; icono propio (octógono con chevrón). Los assets de la plantilla de Expo no se usan en `src/`. | Opcional: borrar los assets de plantilla que sobran. |
| 4.1 (b) Sin suplantar a otra app | CUMPLE | Interfaz de arena y gladiadores; sin «cazador» ni «mazmorra» visibles (las rutas `mazmorras` y `dungeon` no se ven en nativo). | — |
| 4.1 Referencias a Solo Leveling en prompts de IA | INCUMPLE → arreglado | `src/lib/oracle.ts:202` y `supabase/functions/_shared/recap.ts:35` nombraban la obra y el modelo podía repetirlo. | `4b9b31a` (oracle) y `72e7d7d` de Seguridad (recap y oracle). Sale con el despliegue `6a5654a`. |
| 4.1 Restos de Franky | RIESGO → arreglado | `src/lib/frankyAuth.ts` y `colors.franky`: código muerto que entraba en el binario. | `4b9b31a`. Queda `supabase/functions/franky-auth/`, que es del servidor y lo decide el coordinador. |
| 4.2 Funcionalidad mínima | CUMPLE | Sin WebView. La versión gratis trae hábitos, gimnasio, cardio, dieta, diario, campañas y amigos. La oferta del onboarding se salta con «Seguir gratis por ahora». | — |
| 4.2 Uso sin cuenta | RIESGO | Sin sesión todo lleva a `/login` (`_layout.tsx:98-100`). Se justifica por la sincronización y los amigos. | Notas de revisión: cuenta demo y por qué hace falta cuenta. |
| 4.2.3 (i)(ii) Recursos y otras apps | CUMPLE | Las fuentes van en el binario. Al arrancar no se descarga nada salvo la OTA estándar de expo-updates. No hace falta ninguna otra app. | — |
| 2.1 / 4.2 Funciones que no llegan | INCUMPLE → arreglado | «Los extractos del banco llegan pronto» (Economía). La insignia Reclutador era imposible porque `settleMyInvites` no se llamaba nunca. | `a7c8d4f` (sin «próximamente» en la interfaz) y `7fddd80` (liquidar antes de leer). |
| 2.1 Funciones sin moderar (ligas) | RIESGO → mitigado | Las ligas no tenían moderación propia. | `f6c530d`: ligas ocultas en 1.0.8 (vuelven en 1.0.9). Pendiente del servidor: el coach todavía puede mencionarlas (`my_league_standing`); avisado al coordinador. |
| 1.2 (relacionado) Duelos: denunciar y bloquear | INCUMPLE → arreglado | Las filas de duelo no ofrecían denunciar ni bloquear. | `f6c530d` + `e7d86b4`: menú «…» con «Enviar denuncia» y «Bloquear usuario»; se ocultan los duelos cuyo rival ya no está en el marcador o es ambiguo. |
| 4.5.4 Push no obligatorio | CUMPLE | Sin permiso, `programarAvisosDelPlan` devuelve 0 y la app sigue. El onboarding no pide push. Perfil enseña el estado y «Activar avisos». | — |
| 4.5.4 Sin promoción ni marketing | CUMPLE | Inventario completo: avisos locales (`notifications.ts`, `voice.ts textoAviso`) y remotos (`ritual/handler.ts`). Ninguno ofrece Pro, Élite, descuentos ni creadores. | — |
| 4.5.4 Sin datos sensibles en el texto | INCUMPLE → arreglado (cliente) / asignado (servidor) | El aviso de bloque usaba `b.detail` (cargas, gramos). El titular del ritual y el checkin podían llevar peso, kcal o dinero. | `b44cf6b`: cuerpo fijo («Es la hora de este bloque. El detalle está en Hoy.»). Ritual y checkin: Seguridad (despliegue del coordinador). |
| 4.5.4 Apagar los avisos desde la app | RIESGO (bajo) | No hay interruptor por tipo; «Pausar el sistema» corta los del coach. Al no ser promoción, la regla no lo exige. | 1.0.9: interruptor en Perfil › Avisos. |
| 4.8 Servicios de login | CUMPLE | Solo cuenta propia con correo y contraseña (`authFlow.ts`). Ni Google, ni Apple, ni Facebook, ni OAuth (grep vacío). El puente de Franky era código muerto y ya está borrado. | — |
| 4.10 Monetizar capacidades del sistema | CUMPLE | Push, cámara, galería y vibración son gratis (`features.ts` vacío). Pro y Élite venden IA y estatus. «Fotos al coach» de Élite es el análisis con un modelo de visión (`ai_status.vision`), no la cámara. | Compras: que el copy diga «análisis de fotos por IA». |

## 2.4.1 · iPad

| Regla | Estado | Prueba | Arreglo |
|---|---|---|---|
| La app funciona en iPad | INCUMPLE → arreglado | `supportsTablet`; el usuario la ha probado en un iPad real. El barrido de 624 capturas encontró el onboarding a todo el ancho (~1320 pt) y la barra del coach dentro de la zona del gesto de inicio. | `2d375cb`. Detalle en el anexo. |

## HIG básicos

| Área | Estado | Prueba | Arreglo |
|---|---|---|---|
| Áreas táctiles de 44 pt | RIESGO → arreglado | Las piezas del kit ya llegaban a 44. `Row` (una línea), las filas del onboarding y «Buscar actualización» se quedaban cortos. | `cf133e4` (`Row` y onboarding con `minHeight: 44`). `a7c8d4f`: el pie de versión sale de las pantallas de acceso y pasa a pulsación larga en Perfil. |
| Dynamic Type | CUMPLE | Ningún texto de lectura con `allowFontScaling={false}`. El cuerpo nunca se limita por debajo de ×1,35; las puertas y el acceso llegan a ×1,6. | Opcional: ×1,6 en las lecturas largas. |
| Contraste | CUMPLE | Calculado: ink6 sobre ink0/1/2 da 6,25 / 5,85 / 5,38; ink8 ≥ 9,6; ink9 ≥ 13,3. Sobre superficie invertida, ink0–ink4 > 11:1. ink6 no se usa como texto sobre blanco. | `cf133e4`: el botón desactivado sobre superficie invertida pasa a ink4 (≈11,6:1). |
| VoiceOver: registro y login | INCUMPLE → arreglado | Los controles estaban etiquetados, pero los errores solo usaban `role="alert"`, que VoiceOver no lee en RN. | `cf133e4`: `useAnunciar` en ErrorSistema, Campo, login y enlaces de cuenta. |
| VoiceOver: paywall | CUMPLE (controles) / RIESGO (avisos) | Radiogroup de planes y enlaces legales etiquetados. Los avisos de compra son de Compras. | Compras: anunciar el resultado de compra y restauración. |
| VoiceOver: denuncia | INCUMPLE → arreglado | El resultado no se anunciaba y los motivos no formaban grupo. | `cf133e4`: anuncia el resultado y los motivos van en un radiogroup «Motivo». |
| VoiceOver: borrado de cuenta | RIESGO → arreglado | No se anunciaba el botón al habilitarse ni el final del borrado. | `cf133e4`: «El botón Eliminar para siempre ya está activo.» y «Cuenta eliminada.» |
| Acciones solo con gesto | RIESGO → arreglado | Pulsaciones largas sin acción accesible: quitar amigo, borrar tarea, reactivar. | `cf133e4`: `Row` expone `longpress` con etiqueta propia. |

## Textos visibles

| Comprobación | Estado | Prueba | Arreglo |
|---|---|---|---|
| Sin «—» ni «–» | CUMPLE | De las 66 apariciones, ninguna es texto visible (son comentarios y expresiones regulares). | — |
| Sin lorem, TODO, localhost ni comandos | INCUMPLE → arreglado | El vacío de Economía pedía ejecutar `node scripts/import-revolut.mjs`. | `82e78b0` (publicado en OTA). |
| Sin «Franky», «Algún plan no está disponible» ni «Error del sistema» | CUMPLE | Grep vacío en la interfaz. «Error del sistema» pasó a «El sistema no responde» (`3136eec`). | — |
| Sin texto de desarrollo en el acceso | INCUMPLE → arreglado | El pie VERSIÓN/CANAL/PAQUETE/«BUSCAR ACTUALIZACIÓN» se veía en el login. | `a7c8d4f`: solo en Perfil, como «Versión 1.0.8 (23)»; el detalle va en pulsación larga. |
| Sin «próximamente» | INCUMPLE → arreglado | «Los extractos del banco llegan pronto». | `a7c8d4f`. «Pagos aún no configurados» (PerfilAjustes) solo sale en la web: `stripePermitido` devuelve false siempre en iOS y Android (confirmado por Compras). |
| Fechas ISO en la interfaz | RIESGO (bajo) | Corregidas en Economía, Cardio, Perfil y Memoria (`2734873`, `82e78b0`). Queda el campo «AAAA-MM-DD» en la hoja de la agenda. | 1.0.9: selector de fecha. |

## Estados para una cuenta nueva

| Pantalla | Estado | Prueba | Arreglo |
|---|---|---|---|
| agenda, diario (día), gimnasio, cardio, nutrición, dieta, compra, avances, informe, resumen, contrato, oráculo, memoria, economía, pro, arranque | CUMPLE | Cada una tiene CargaArena, un vacío con acción y ErrorSistema con «Reintentar» (patrón de la Fase 3). | — |
| Archivo del diario | INCUMPLE → arreglado | Un fallo de carga se veía como «Tu archivo empieza hoy». | `cf133e4`. |
| Login al arrancar | INCUMPLE → arreglado | Mostraba el error y la contraseña de un intento anterior (la pantalla seguía viva en segundo plano). | `a7c8d4f`. |
| Hoy con cuenta nueva | INCUMPLE → arreglado | «NIVEL 2 · Siguiente 2»: se animaba desde el nivel de la cuenta anterior. | `a7c8d4f`: el hero queda ligado al usuario. |
| Coach esperando respuesta | INCUMPLE → arreglado | ~20 s sin indicador (DeepSeek no emite el evento «thinking»). | `a7c8d4f`: «El sistema está pensando…» desde el envío, con el botón bloqueado. |
| Perfil, Campañas, Fotos y Hoy con fallo parcial | RIESGO (bajo) | Funcionan, pero el error de recarga sobre datos ya cargados no siempre se ve, o la tarjeta está hecha a mano. | 1.0.9: ErrorSistema compacto. |

## El revisor nunca se atasca

| Caso | Estado | Prueba | Arreglo |
|---|---|---|---|
| Sin conexión: arranque, sesión, login, onboarding, Hoy, coach | CUMPLE | El splash se cierra aunque falle la carga; hay «Reintentar» en cada caso. | — |
| Red que se cuelga (sin respuesta) | RIESGO → arreglado | `ensureProfile`, `fetchEdadConfirmada` y `getOfferings` no tenían tiempo límite (~60 s girando). | `35fcb7e` y `c9e21e1`: 12 s y error de red con «Reintentar» (PASS de Compras y Seguridad). |
| Permiso de avisos denegado | CUMPLE | No se pide en el onboarding; Hoy lo pide una vez sin bloquear; Perfil abre los Ajustes. | — |
| Cámara o fotos denegadas | CUMPLE | Diálogo con «Abrir ajustes», «Ahora no» y la galería como alternativa. | — |
| Adjuntar fotos en el coach | RIESGO → arreglado | Pedía permiso de toda la fototeca sin salida si se negaba. | `cf133e4`: selector del sistema (PHPicker) sin permiso. |
| Guardar la tarjeta de compartir en Fotos | INCUMPLE → arreglado | Faltaba `NSPhotoLibraryAddUsageDescription` (cierre probable de la app). | `eda459c` (coordinador): necesita la build 24. |
| Salud: «Ahora no» | CUMPLE | Solo se bloquean las rutas de salud y la pestaña del coach, con Volver e Ir a Perfil. Se puede dar después en Perfil › Ajustes. | Notas de revisión: el coach necesita el consentimiento de salud. |
| IA: «Ahora no» | RIESGO | El resto de la app sigue, pero comprar Pro necesita el consentimiento de IA (`ProOffer.tsx:203` volvía sin decir nada). | Asignado a Compras. Notas de revisión. |
| Puerta de edad | CUMPLE | Casilla y «Confirmar y continuar»; la salida es «Cerrar sesión». Si se agota el tiempo, falla cerrada con «Reintentar». | — |
| Onboarding sin aceptar nada opcional | CUMPLE | Obligatorios: nombre, perfil, objetivo y firma. Misiones, código y Pro son opcionales. Ni pago ni push. | — |

## Pendiente fuera de Experiencia

- **Coordinador:** desplegar el coach con `6a5654a` (Seguridad) y `f8e69e3` (`context.ts`, edad mínima 16). Decidir sobre `supabase/functions/franky-auth/` y sobre las menciones de ligas en el coach.
- **Seguridad:** push del ritual y del checkin con cuerpo fijo (4.5.4).
- **Compras:** «Comprar» con el consentimiento de IA rechazado; anuncios de VoiceOver en el paywall; copy «análisis de fotos por IA».
- **Notas para App Review:** cuenta demo; uso con cuenta (sincronización y amigos); el coach necesita los consentimientos de salud e IA; las ligas no están en esta versión.

## Anexo · iPad

**Configuración.** `app.json`: `orientation: portrait`, `supportsTablet: true`, sin `requireFullScreen`. El plugin de Expo escribe `UIRequiresFullScreen = false` y las cuatro orientaciones en `UISupportedInterfaceOrientations~ipad`. El retrato fijo vale solo para el iPhone; en el iPad la app gira y admite Split View, Slide Over y Stage Manager, que es lo que pide la 2.4.1. Ningún componente lee el tamaño una sola vez (`Dimensions.get`), así que el giro y el Split View se recolocan en vivo.

**Barrido.** 208 estados de la galería × 1024×768, 768×1024 y 1366×1024, con una segunda captura desplazada al final cuando había más contenido: 624 capturas. Un script en cada página comprobó desbordes horizontales, elementos fuera del marco, texto cortado y solapes. Giro probado en vivo en hoy, agenda y coach (1024×768 ↔ 768×1024).

| Hallazgo | Estado | Arreglo |
|---|---|---|
| Sin desbordes, sin nada tapado por la barra lateral, sin texto cortado | CUMPLE | — |
| Sheets en iPad: centradas, de 560 de ancho y 85 % de alto como mucho, con el pie visible en horizontal | CUMPLE | — |
| P1 · Onboarding sin ancho máximo (botones y tablilla de ~1320 pt; es la primera pantalla tras el registro) | INCUMPLE → arreglado | `2d375cb`: columna centrada de 608 pt con `TopeAncho` 560 |
| P2 · Barra del coach sin margen seguro inferior con raíl o barra lateral (dentro de la zona del gesto de inicio) | INCUMPLE → arreglado | `2d375cb`: `insets.bottom` si no hay TabBar y el teclado está cerrado |
| P3 · Pie del diario con el margen inferior también con el teclado abierto (~20 pt de más) | RIESGO → arreglado | `2d375cb` |
| P4 · Exportar datos: el menú de compartir sale sin ancla en iPad (`src/lib/exporter.ts:91`) | RIESGO (bajo, no se cierra la app) | Para el dueño de `lib`: `anchor` como en `share.ts:101` |
| P5 · Agenda en retrato a 768: columna derecha de ~275 pt; los títulos largos se cortan con «…» | RIESGO (bajo, legible) | Opcional en 1.0.9 |
| Teclado: cada pantalla con campos tiene un solo mecanismo y los pies fijos siguen alcanzables en horizontal | CUMPLE | Teclado flotante y Stage Manager: límite conocido de RN, menor |

Capturas: `scratchpad/cap-ipad/` (fuera del repo). La galería suma 768 y 1366 (`VERIFY_WIDTHS`).
