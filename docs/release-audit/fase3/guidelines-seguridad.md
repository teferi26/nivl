# Guidelines de Apple · parte de NIVL - Seguridad (1.0.8, build 23)

04/10/2026. **Texto de referencia:** developer.apple.com/app-store/review/guidelines, leído hoy; la página no muestra fecha.

**Código:** `winter2/integracion@477c545` y `winter2/chat3-ia` (arreglos). **Servidor:** producción en solo lectura (BEGIN…ROLLBACK).

**Evidencia:** [V] verificado en el código o en producción · [W] verificado en la web publicada · [H] hipótesis por comprobar.

**Resultado:**
- 1 INCUMPLE probable, en la configuración del binario;
- ningún INCUMPLE en privacidad ni en IA;
- 9 RIESGO, cada uno con su arreglo y su responsable.

## Bloqueante antes de compilar la build 23

| Regla | Estado | Prueba | Arreglo | Quién |
|---|---|---|---|---|
| 2.5 / 5.1.1 · `NSPhotoLibraryAddUsageDescription` | **INCUMPLE (probable)** [V falta, H cierre] | No está en `app.json` y ningún plugin lo añade (sí están NSCamera, NSPhotoLibrary y NSMicrophone, `app.json:19-22`). Las tarjetas de compartir abren la hoja del sistema (`share.ts:96-102`), y «Guardar imagen» necesita esa clave: sin ella, iOS cierra la app | Añadir a `ios.infoPlist`: «NIVL guarda en tu galería las tarjetas que tú decides guardar al compartir.» Requiere binario nuevo (no vale OTA). Probar «Guardar imagen» en un iPhone | Coordinador (config) |

## 5.1 Privacidad

| Regla | Estado | Prueba | Arreglo | Quién |
|---|---|---|---|---|
| 5.1.1(i) Política accesible en la app | CUMPLE [V][W] | Enlazada en el login, Perfil, la oferta Pro, la hoja de IA y la de salud (`proplans.ts:452`). `nivl.app/privacidad`, `/terminos` y `/soporte` devuelven 200 (comprobado hoy) | — | — |
| 5.1.1(i) Los terceros con «igual protección» | RIESGO [W] | La política cita DPF y SCC por proveedor, pero no tiene la frase de igual protección. Para China ya se reconoce la protección inferior, y lo cubre el consentimiento explícito | Añadir a §4: «Todos los encargados están obligados por contrato (art. 28 RGPD) a proteger tus datos con un nivel igual al de esta política.» | Experiencia (web) |
| 5.1.1(ii) Consentimientos explícitos y retirables | CUMPLE [V] | IA: «Acepto…» y «Ahora no» con el mismo peso; versión guardada en el servidor; se retira en Perfil. Salud: casilla sin marcar y botón apagado hasta marcarla; retirarla borra los datos | — | — |
| 5.1.1(ii) «Paid functionality must not be dependent on» conceder datos | RIESGO [V] | La compra de Pro se bloquea sin el consentimiento de IA (`ProOffer.tsx:203`). El coach exige además el permiso de salud (`coach/handler.ts:594`) | Dejar comprar sin consentimiento y pedirlo en el primer uso del coach (ya se hace en `useCoach.ts:369`). Para la salud: explicar en las Notas que un coach de entreno y nutrición necesita esos datos; el resto de la app (hábitos, agenda, juego) es gratis y no pide ninguno | Compras (ProOffer); Tiendas (Notas) |
| 5.1.1(iii) Minimización y permisos en contexto | CUMPLE [V] | Cámara al pulsar; galería con el selector del sistema; micrófono solo al mantener el botón; sin ubicación, contactos ni rastreo publicitario | — | — |
| 5.1.1(v) Borrado de cuenta real en la app | CUMPLE [V] | Perfil → Eliminar cuenta (escribir «ELIMINAR» y confirmar). `account-erasure` borra Storage, hace `deleteUser` definitivo y borra en RevenueCat. Creadores: código desactivado y saldo pagado (0056) | — | — |
| 5.1.1(ix) Datos sensibles con cuenta de desarrollador individual | RIESGO bajo [H] | Hay salud y finanzas, pero NIVL no presta servicios sanitarios ni financieros: es un registro personal | Notas: «Herramienta de registro personal; no presta servicios médicos ni financieros.» Si la cuenta es individual, a medio plazo valorar una persona jurídica | Tiendas / usuario |
| 5.1.2(i) IA de terceros: revelar y pedir permiso explícito antes | CUMPLE [V] (arreglo de precisión hecho) | La hoja de IA nombra Anthropic y DeepSeek (China), con el aviso fuera del EEE y el consentimiento explícito. **Todas** las funciones que llaman a una IA comprueban `consentimientoIa` en el servidor antes de llamar: coach, oracle, ritual (titular y check-in), recap, resumenhilo y clasificar. No hay más proveedores (solo api.anthropic.com y COACH_BASE_URL). Las fotos con DeepSeek se cortan en el servidor (`fotosSinVision`). **4efd3b2**: el texto de Anthropic dice ahora qué recibe en todos los planes (fotos, resúmenes, avisos, clasificación y tareas cortas). Es una aclaración, no un cambio de alcance; no se sube la versión del consentimiento para no romper la 1.0.7 | Hecho (OTA) | Seguridad |
| 5.1.2(i) Notas de revisión coherentes | RIESGO [V] | `ficha-108.md:138`: «DeepSeek (Pro, trial) and Anthropic (Élite)» deja fuera que Pro también usa Anthropic | «Anthropic (Élite coach; for all tiers: photos, summaries, notification texts and short tasks) and DeepSeek (Pro/trial standard coach text). Explicit in-app consent before any AI call.» | Tiendas |
| 5.1.2 Voz | CUMPLE [V], con matiz en el texto | El audio no llega a NIVL ni a la IA: sin `persist`, solo el reconocedor del sistema; a NIVL llega el texto. App Privacy: Audio = No | En la política, un párrafo de dictado: «el audio lo transcribe Apple (en el dispositivo cuando es posible); NIVL solo recibe el texto». En el texto del permiso de voz, mencionar a Apple | Experiencia (web); coordinador (texto del plugin) |
| 5.1.2 Sin publicidad ni rastreo | CUMPLE [V] | Sin SDK de anuncios ni de analítica; `AD_ID` bloqueado; «NIVL no los utiliza para publicidad» | — | — |
| 5.1.3 Salud sin publicidad, sin iCloud, sin HealthKit | CUMPLE [V] | No hay HealthKit ni iCloud en `app.json`. Datos en Supabase (Fráncfort). La IA solo ve metadatos de las fotos de progreso | Repetir cuando llegue HealthKit (1.0.9) | — |
| 5.1.4 Menores | CUMPLE [V] | Mínimo 16 (`EDAD_MINIMA`, puerta sin marcar); fotos 18+ exigidas en el servidor (0050); no es app infantil | Menor: `bodymath.ts:71` acepta 14 años; igualar a 16 | Juego y QA / Experiencia |
| Cuestionario de edad en ASC | RIESGO [H] | Sin respuestas documentadas para la 1.0.8 | 16+ como mínimo: chatbot de IA, contenido de usuarios moderado, información de bienestar | Tiendas |

## 1.1 / 1.2 Contenido y 1.4.1 Daño físico

| Regla | Estado | Prueba | Arreglo | Quién |
|---|---|---|---|---|
| 1.2 Filtro: alias, foto y título | CUMPLE [V] | 0032: todo cambio vuelve a «pending» y se ve «Gladiador xxxxxx» hasta aprobar; la aprobación es solo de service_role. Tarjetas con alias genérico (0057) | — | — |
| 1.2 Filtro: **nombre de liga** | RIESGO [V] | `league_create` (0048) admite texto libre de 2 a 40 caracteres sin revisión, visible para invitados y miembros | Filtro en el servidor: palabras prohibidas, URL, teléfonos y correos. Más seguro: nombre de una lista fija. Puedo hacer la migración si me das número | Juego y QA / Seguridad |
| 1.2 Denunciar y bloquear a **miembros de liga que no son amigos** | RIESGO [V] | `league_board` no da id, y `social_report_user`/`social_block_user` exigen relación conocida (`social_known_user`, 0032). Solo queda salir de la liga | Ampliar `social_known_user` a quien comparte liga, más un botón de seguridad en el tablero | Juego y QA / Seguridad |
| 1.2 Denuncia y respuesta a tiempo | CUMPLE [V] (arreglo listo) | Aviso horario al owner **verificado** en producción. Plazo de 24 h y responsable en `docs/MODERACION-SOCIAL.md` (9fd66c6). **0062** (e914ef7): las denuncias sobreviven, anónimas, al borrado de la cuenta de quien denuncia | Aplicar la 0062. **El usuario tiene que designar un suplente.** Publicar el plazo de 24 h en soporte o en los términos | Coordinador / usuario / Experiencia |
| 1.2 Bloqueo | CUMPLE [V] | `social_block_user`: bloquea en los dos sentidos y borra la amistad; lista para desbloquear | — | — |
| 1.2 Contacto publicado | CUMPLE [W], mejorable | `nivl.app/soporte` da 200; contacto en Amigos | Fila «Soporte» en Perfil. Correo de soporte no personal | Experiencia / usuario |
| 1.1 / 1.2 Contenido de la IA | CUMPLE [V] | `ai-safety.ts` en todas las superficies; «Denunciar respuesta» en el coach y el Oráculo (`ai_reports`, con aviso horario) | — | — |
| 1.4.1 Aviso médico, crisis y no diagnosticar | CUMPLE [V] | `DESCARGO_SALUD`, 024 y 112 en el onboarding, el coach, el perfil y la hoja de IA. Con síntomas de alarma se para y deriva (`ai-safety.ts`, `knowledge.ts`) | — | — |
| 1.4.1 Límites de dieta y precisión | CUMPLE [V] | Tope en el servidor de 1.500–6.000 kcal; ritmo de 0,5–1 kg por semana; Mifflin presentado como «±10 %»; e1RM ≤12 repeticiones | — | — |

## 2.5 Requisitos de software

| Regla | Estado | Prueba | Arreglo | Quién |
|---|---|---|---|---|
| 2.5.1 / 2.5.2 APIs públicas y código descargado | CUMPLE [V] | Sin `ios/` propio, sin `eval`. OTA con expo-updates | Por OTA solo correcciones, sin funciones nuevas sin revisión | Coordinador |
| 2.5.4 Modos de fondo | CUMPLE [V] | Sin `UIBackgroundModes` | — | — |
| 2.5.14 Grabación con indicador | CUMPLE [V] | Se graba mientras se mantiene pulsado, con franja de grabación visible. Con VoiceOver, tocar para empezar y para parar | Texto del micro: «solo mientras dictas» en lugar de «mientras mantienes pulsado» (con VoiceOver es tocar) | Coordinador (config) |
| Textos de cámara y galería | CUMPLE [V] | En español, concretos; solo imágenes | — | — |
| Avisos time-sensitive | CUMPLE [V] | Solo el despertador y los bloques que programa el usuario | Explicarlo en las Notas | Tiendas |
| `ITSAppUsesNonExemptEncryption=false` | CUMPLE [V] | Solo HTTPS del sistema | — | — |

## App Privacy (ASC)

La lista de hoy cuadra con el código: Audio = No; Fotos, Salud, Contenido de juego y Otros datos con los motivos ampliados; sin categorías nuevas.

Añadido tras esta auditoría: **ninguno**. Que se pueda guardar una tarjeta en la galería no cambia la ficha: es el usuario quien guarda en su propio dispositivo.

## Arreglos hechos en `winter2/chat3-ia`

- **4efd3b2** · Texto de Anthropic en el consentimiento de IA (5.1.2(i)). Jest consentmath 9/9.
- **e914ef7** · Migración 0062: denuncias anónimas al borrar la cuenta (1.2). Probada con ROLLBACK. Pendiente de aplicar.
- **9fd66c6** · Moderación: aviso, responsable y plazo documentados (1.2).
