# NIVL 1.1.0: lista de salida

Fecha: 9 de noviembre de 2026. Estado de GitHub Actions leído a las 09:50 UTC. Para el dueño.

## 1. Veredicto

1. **Hoy no se puede enviar: el binario 1.1 no existe.** Falla al firmar: el perfil de la app no incluye HealthKit y los del reloj no existen. Crearlos exige que el dueño entre en su cuenta de Apple (PLAT-01). No hay ningún agente que pueda hacerlo.
2. **Con binario, se rechazaría.** Por este orden de probabilidad: la compra no funciona o los productos no van adjuntos (PAG-04, norma 2.1); los Términos que enlaza la compra venden planes retirados (PAG-01, norma 3.1.2).
3. Le seguirían una ficha y unas notas de otro producto (CON-05, norma 2.3) y una privacidad que calla HealthKit y GPS, con etiquetas sin Ubicación (P1 y ADV-1, normas 5.1.1 y 5.1.3).
4. Hay dos incumplimientos reales que el revisor quizá no vea, pero que no se deben enviar así: perfiles publicados sin filtro (CON-01, norma 1.2) y cambiar de modo sin avisar de que sustituye al actual antes de cobrar (PAG-02, norma 3.1.2).
5. Nada es insalvable: de los nueve bloqueantes, cinco son trabajo en tus cuentas y tu web, dos son de código y dos compartidos. Android no está en condiciones de ir a producción y no debe frenar a iOS.

**Riesgo principal de rechazo: la compra real queda sin probar.** Decisión del dueño (09/11/2026): no probará la compra en TestFlight salvo que sea obligatorio, y Apple no le obliga a hacerlo. Se sustituye por comprobaciones indirectas: los diez productos en `READY_TO_SUBMIT` y adjuntos, los ids de App Store Connect iguales a los de `planesmodo.ts` (comprobado), la clave de RevenueCat en el binario (en EAS, leído en el log) y `STORE_SANDBOX_ACCESS` (sin comprobar: es un secreto de Supabase). Ninguna demuestra que una compra funcione de principio a fin. Si el revisor compra y falla, es rechazo por 2.1.

**Cómo leer esto.** `[ARREGLABLE]`: código, tamaño pequeño, se hará a continuación. `[ARREGLABLE en parte]`: el código es pequeño, pero hace falta algo tuyo antes. "Binario": solo entra compilando de nuevo, así que va antes de la compilación final. Normas leídas hoy, con su enlace en cada entrada. Las rutas parten de la raíz del repo; un nombre suelto de archivo se localiza por nombre y `0140:47` es la línea 47 de la migración 0140.

**Estado de los arreglos (9/11/2026).** Hechos en `claude/tienda-1-1-b4864e`, los marcados `[HECHO…]`, con typecheck, 6625 tests, lint y exportación de iOS en verde. Ninguno está probado en un dispositivo real. Reparto en otras sesiones, sin confirmar aquí: CON-01 y P10 (`nivl-haiku`), P9 y PLAT-07 (`nivl-watch`), CON-14 (`nivl-tv`), Android, PLAT-08 y PLAT-09 (`nivl-adaptativo`), CON-08, CON-11, P2, P4 y FICHA-1 (`nivl-intuitivo`), PAG-01, P1, P13 y CON-13 (`nivl-legal-web`). Decidido por el dueño: CON-01 con filtro automático en servidor.

Otros documentos, sin repetirlos: [productos](PRODUCTOS.md) · [plataformas y comandos](MATRIZ-PLATAFORMAS.md) · [capturas](CAPTURAS.md) · [App Privacy](PRIVACIDAD-APP-STORE.md) · [Data safety](SEGURIDAD-DATOS-GOOGLE.md) · [notas Apple](NOTAS-APPLE.txt) · [notas Google](NOTAS-GOOGLE.md) · [fichas](fichas/es-ES.md).

## 2. Bloqueantes, en el orden en que hay que hacerlos

### 1. CON-01. Perfiles publicados al instante y sin filtro

- **Qué pasa:** cualquier alias, título o foto se ve al momento y se revisa una vez por semana. Apple pide un método para filtrar antes de publicar; el producto lo tenía y lo quitó. Atenuante real: no hay búsqueda pública, solo lo ven solicitudes, amigos y ludus. Va primero porque es tu decisión y de ella dependen textos, notas y capturas.
- **Norma:** [Apple 1.2][a-ugc], [Google UGC][g-ugc].
- **Evidencia:** `supabase/migrations/0087_perfiles_sin_revision_previa.sql:1-4,17-20`. Sin lista de términos ni análisis de imagen en migraciones ni en `src/lib/validation.ts`.
- **Quién:** ambos. Decides: (a) retener foto y alias hasta revisión, o (b) filtro automático en servidor. **Tamaño:** grande, con migración nueva.
- **Lo cierra:** con dos cuentas, un alias ofensivo se rechaza o no se ve desde la otra, una foto nueva no se ve hasta pasar el filtro, y `scripts/test-social-safety.mjs` actualizado.

### 2. PAG-02. Comprar otro modo sustituye al actual sin avisar antes de cobrar [HECHO en 5d15d86, falta la prueba indicada]

- **Qué pasa:** quien paga IRON y entra en FOCUS ve "Solo este modo y su coach" y nada dice que pierde IRON. En Apple, un cruce de igual duración es inmediato, y el código asume que siempre se aplica al renovar. Es incumplimiento real con dinero; App Review difícilmente lo probará.
- **Norma:** [Apple 3.1.2(c)][a-subs], [cruces de suscripción][a-cruces].
- **Evidencia:** `src/components/modos/pago/MundoCerrado.tsx:16-19` no pasa el plan actual; `useOfertaModos.ts:48` abre en "uno"; `src/i18n/es/oferta.json:80`; `planesmodo.ts:226-240`.
- **Quién:** código. **Tamaño:** pequeño.
- **Lo cierra:** test de `useOfertaModos` con `actual=nivl_iron_mensual`, y en sandbox IRON mensual a FOCUS mensual muestra el aviso antes de la hoja de Apple.

### 3. PLAT-01. El binario no firma [SOLO EL DUEÑO]

- **Qué pasa, leído en los logs:** con el reloj, EAS sin modo interactivo no crea los perfiles de los targets nuevos y con clave de API no asigna el App Group (run 42595812965). Sin el reloj, compila hasta firmar y Xcode lo para: el perfil de la app no incluye HealthKit (run 42598212172, build 40). Había además un entitlement de historiales clínicos que Apple exige aprobar: ya está quitado (`399608f`).
- **Norma:** sin norma de revisión, requisito de entrega: [subir builds][a-builds].
- **Quién:** el dueño, pasos 1 a 3 de la sección 7. La opción de compilar sin reloj ya existe en `ios-testflight.yml` (`sin_reloj`). **Tamaño:** pequeño, pero exige su cuenta.
- **Lo cierra:** run de `ios-testflight.yml` verde hasta "Subir a TestFlight" y build VALID en App Store Connect.

### 4. PAG-04. Los diez productos [CREADOS en Apple y RevenueCat iOS; falta captura y prueba]

- **Hecho por API el 09/11/2026:** los diez en el grupo `NIVL`, 165 territorios como los de Pro, precios por equalización desde España, 7 días gratis solo en los cinco anuales. Localizados en es-ES, en-US, en-GB y fr-FR. Comprobado leyendo la API. Los antiguos, intactos.
- **RevenueCat iOS, configurado en el panel (lo comunica otra sesión, no comprobado aquí):** los diez productos, offering `modos` como Current con diez paquetes, `default` activa, In-App Purchase Key válida, Restore Behavior «Transfer to new App User ID», Sandbox access «Anybody», webhook activo. Sin comprobar: los entornos por evento del webhook. Android sin tocar.
- **Falta:** los diez siguen en `MISSING_METADATA` porque cada uno pide la captura de revisión de la pantalla de compra real, que hará el dueño desde TestFlight. Después, adjuntarlos a la 1.1 y comprar en sandbox.
- **Norma:** [Apple 2.1][a-compl] y [3.1.1][a-iap], [Play Billing][g-billing].
- **Quién:** el dueño, sección 7. **Lo cierra:** estado `READY_TO_SUBMIT` en los diez y compra sandbox de cada uno con `mis_modos` correcto.

### 5. PAG-01. Los Términos describen planes retirados

- **Qué pasa:** el enlace de la compra lleva a una página sin modos ni 14,99, con Pro 12,99 y Élite 29,99, y que dice que la prueba no se convierte en suscripción: lo contrario de la 1.1. Tampoco dice que no se tolera contenido objetable.
- **Norma:** [Apple 3.1.2(c)][a-subs].
- **Evidencia:** `proplans.ts:561`, `src/components/modos/pago/OfertaModosVista.tsx:305`, y `https://nivl.app/terminos` leída hoy.
- **Quién:** dueño, en el repo privado de la web. Diez productos, prueba de 7 días solo en anual que pasa a cobro, Pro y Élite como planes retirados vigentes hasta caducar, tolerancia cero. Idiomas de la ficha, o decir cuál rige. **Tamaño:** no aplica.
- **Lo cierra:** abrir Términos desde la compra del binario en cada idioma publicado y ver modos, precios y prueba reales.

### 6. P1. La política de privacidad no cuenta lo que hace la 1.1

- **Qué pasa:** no nombra HealthKit, Apple Watch, GPS, calendario, micrófono, extractos, TV ni Open-Meteo, y la app los usa. El aviso de salud de la app remite a esa política.
- **Norma:** [Apple 5.1.1(i) y 5.1.3][a-datos], [Google Data safety][g-ds].
- **Evidencia:** `https://nivl.app/privacidad` leída hoy, cero menciones. `modules/nivl-salud` (`LectorSalud.swift:34-51`, `GpsSesion.swift`), `src/work/calendarioDispositivo.ts:100`, `supabase/functions/prevision/handler.ts:67-80`, `app.json:24-28`.
- **Quién:** dueño, en la web: qué se lee, adónde va, cuánto se guarda y cómo retirarlo. **Tamaño:** no aplica.
- **Lo cierra:** buscar esos términos en la página publicada y compararla con [PRIVACIDAD-APP-STORE.md](PRIVACIDAD-APP-STORE.md).

### 7. ADV-1. Las etiquetas de privacidad no declaran Ubicación

- **Qué pasa:** la 1.1 sube rutas GPS y la ficha publicada no declara Ubicación. El documento viejo manda no declararla: ya no vale.
- **Norma:** [App privacy details][a-privacy], [Apple 5.1.1(i)][a-datos].
- **Evidencia:** sección Privacidad de apps.apple.com leída hoy; `GpsSesion.swift:368`, `targets/watch/ServicioEntreno.swift:125`, `app.json:26-28`; obsoleto `docs/appstore-review-2026-09-29/PRIVACIDAD-FICHA.md:23`.
- **Quién:** dueño, a mano: la API pública no tiene App Privacy (404 comprobado). Valores exactos en [PRIVACIDAD-APP-STORE.md](PRIVACIDAD-APP-STORE.md). **Tamaño:** no aplica.
- **Lo cierra:** captura de App Privacy guardada y comparada con ese documento.

### 8. CON-05. Ficha y notas [HECHO en App Store Connect; falta Google y repaso con el build final]

- **Hecho por API:** la versión pasa a 1.1.0 con build 42 asignado, ficha es-ES, en-US, en-GB y fr-FR, y notas de revisión sin marcas internas. No se ha enviado a revisión.
- **Falta:** cambiar al build final. Repasar notas contra ese build: describen el filtro de perfiles y el reloj. Sin vídeo, las notas no lo citan. de, pt-PT e it no se han creado: dependen de encender `idiomas_1011`, y sin él las fichas en-US, en-GB y fr-FR tampoco son ciertas (FICHA-2).
- **Norma:** [Apple 2.3.1 y 2.5.1][a-meta].

### 9. PLAT-04. Capturas de la 1.1 [SUBIDAS a App Store Connect, en es-ES]

- **Hecho por API:** tanda final del commit `010100a`: iPhone 6,9 (10), iPhone 6,3 (10), iPad 13 (10), reloj (5) y vídeos de iPhone e iPad. Las otras localizaciones usan las de es-ES. Quedaban en proceso en Apple al subirlas.
- **Falta:** si el binario final cambia pantallas visibles, repetir la tanda. Android no tiene capturas: su flujo de CI es de la 1.0.8. La rejilla de 28 días de Avance se pinta rota (`src/components/general/AvanceVista.tsx:355`): no sale en capturas, pero un revisor puede verla.
- **Norma:** [Apple 2.3 y 2.3.3][a-meta], [especificaciones][a-capt].

## 3. Riesgos, en orden

Formato: qué pasa · norma · evidencia · quién y tamaño · qué lo cierra.

### A. Decisiones tuyas que cambian el alcance

- **PLAT-06. El reloj va en el binario sin probar en hardware.** El simulador no ejercita la entrega reloj a iPhone. · [2.1 y 2.4][a-guia] · `docs/APPLE_WATCH.md:66`, `docs/rediseno-1.1/INFORME-INTEGRACION.md:57,59` · Dueño, no aplica · Entreno en reloj real que aparece una sola vez en el iPhone y paga según `guardarEntrenoMedido`; si no llega, fuera de la 1.1.
- **CON-14. Apple TV no se puede publicar ni anunciar en la 1.1.** No existe la ruta de enlace y al proyecto le faltan piezas. El encargo la cita como novedad: no lo es para esta salida. · [2.1, 2.3.1 y 4.2][a-guia] · `src/app/tv` no existe; `tv/integracion/INSTRUCCIONES.md:18-21`; `tv/NIVLTV.xcodeproj/project.pbxproj:364,388` · Ambos, grande · Metadatos y notas sin Apple TV.
- **FICHA-2. Las cinco fichas traducidas solo son ciertas con idiomas encendido.** Por defecto está apagado y la app saldría en español. · [Apple 2.3][a-meta] · `supabase/migrations/0086_interruptores_1011.sql:30`, `src/lib/flagsmath.ts:53`, `src/i18n/index.ts:5`, `app.json:30` · Dueño, no aplica · Leer `app_flags()` en producción y abrir el binario en inglés.
- **CON-11. Se declaran seis idiomas y partes siguen en español.** Permisos, motivos de denuncia, reloj y legales. · [Apple 2.3.1 y 3.1.2][a-guia], [Google metadatos][g-meta] · `app.json:30`, `src/lib/socialSafety.ts:3-6`, `PantallaAmigos.tsx:94-97` · Ambos, pequeño `[ARREGLABLE en parte]`: primero decides si la ficha va solo en español · iPhone en inglés con denuncia, permisos y oferta completas, o ficha solo en español.
- **PLAT-09. Mac y Vision Pro quedarían publicados sin abrir la 1.1 allí.** · [Disponibilidad en Mac][a-mac] · `docs/DISPOSITIVOS.md:28-29`; casillas sin verificar · Dueño, no aplica · Casillas en el estado decidido y, si siguen, prueba real.
- **P9. El reloj usa el modo mindfulness para temporizadores.** No es atención plena. · [Apple 2.5.4][a-soft] · `targets/watch/Info.plist:14`, `targets/watch/Temporizador.swift:5,125` · Ambos, grande · Temporizador real sin el modo, o nota aceptada en revisión.
- **ADV-3. Cuenta individual con datos de salud y finanzas.** Apple usa "should" y ya aprobó versiones así: no es rechazo seguro, pero HealthKit aumenta la exposición. · [Apple 5.1.1(ix)][a-datos] · Ficha pública; `healthmath.ts` · Dueño, no aplica · Decisión escrita.
- **PAG-03. Retirar de la venta los antiguos corta sus renovaciones; PRECIOS.md dice lo contrario.** No pulses "Removing from Sale" el día de salida. · [Disponibilidad][a-venta] · `docs/PRECIOS.md:166-173` · Dueño, no aplica · Decisión escrita, suscriptores vivos leídos en RevenueCat y `PRECIOS.md` corregido.
- **PAG-15. Recarga de IA: crédito que solo sirve con plan activo.** Apple no quiere créditos que caduquen. No crear ese producto. · [Apple 3.1.1][a-iap] · `proplans.ts:112`, `src/components/UsoIa.tsx:57-59`, `0078:28-30` · Dueño, no aplica · Sin `nivl_ia_recarga_1` en App Store Connect ni en la offering.

### B. Código que solo entra compilando: antes de la compilación final

- **P5. Reloj y complicación sin Privacy Manifest.** Puede llegar el aviso ITMS-91053 al subir; si llega, bloquea. · [Required Reason API][a-manifest] · `targets/watch/Almacen.swift:29`, `targets/watch/BuzonEntrenos.swift:20`, `targets/watch-complicacion/NivlComplicacion.swift:61` · Código, pequeño `[HECHO en 5d15d86, falta la prueba indicada]` · Sin ITMS-91053 tras subir.
- **P6. Se declara ubicación Always sin pedirla, y el texto no dice pantalla apagada.** · [Apple 5.1.1(ii) y (iii)][a-datos], [2.5.4][a-soft] · `app.json:26-27`, `GpsSesion.swift:295`, `ServicioEntreno.swift:125` · Código, pequeño `[HECHO en 5d15d86, falta la prueba indicada]` · Info.plist sin la clave, subida sin ITMS-90683 y carrera real con indicador azul.
- **P7. Texto de Face ID por defecto para una función que no existe.** Riesgo bajo. · [Apple 5.1.1(ii)][a-datos] · `app.json:117` · Código, pequeño `[HECHO en 5d15d86, falta la prueba indicada]` · Info.plist sin la clave.
- **CON-16. Modo demo del reloj activo en Release por argumento.** Un usuario no puede pasar argumentos: riesgo bajo. · [Apple 2.5.19][a-soft] · `targets/watch/Almacen.swift:33-37`, `targets/watch/ServicioEntreno.swift:878-882` · Código, pequeño `[HECHO en 5d15d86, falta la prueba indicada]` · Release con `-nivlDemo` nunca entra en demo.
- **PLAT-07. Reloj con Cinzel y Mármol y tinta.** No causa rechazo, pero se vería en las capturas. · Norma interna, `AGENTS.md` · `targets/watch/Estilo.swift:24`, `targets/watch/Info.plist:9-10`, `NivlComplicacion.swift:90,103,125` · Código, pequeño `[ARREGLABLE]` · Sin Cinzel en `targets` y capturas de reloj en Ónix.

### C. Código en JavaScript: antes de enviar, en binario u OTA

- **PAG-10. NIVL Pro y Élite se siguen nombrando como lo que se compra.** El revisor lo verá en Perfil. · [Apple 3.1.2 y 2.3][a-guia] · `src/components/perfil/PerfilVista.tsx:173`, `comun.json:15`, `coach.json:12,57,77,83`, `ayuda.json:140-158`, `pro.tsx:182-291`, `proplans.ts:832-879` · Código, pequeño `[HECHO en 5d15d86, falta la prueba indicada]` · Ampliar `paywall-copy.test.ts` y recorrer con cuenta gratis.
- **PAG-09. Tope de IA sin declarar y "Úsalo cuanto quieras".** Hay freno real, y la prueba tiene IA limitada. · [Apple 3.1.2(c)][a-subs] · `src/app/pro.tsx:274`, `proplans.ts:435`, `0140:47-60`, `supabase/functions/coach/handler.ts:943` · Código, pequeño `[HECHO en 5d15d86, falta la prueba indicada]` · Test de `legalModo` que exija el aviso y prohíba "cuanto quieras".
- **PAG-06. Tienda sana sin productos: pantalla muerta sin explicación.** · [Apple 2.1][a-compl] · `useOfertaModos.ts:66-72` · Código, pequeño `[HECHO en 5d15d86, falta la prueba indicada]` · Test con precios vacíos: error y Reintentar.
- **PAG-07. El botón puede decir "Empezar mis 1 semana gratis".** Depende de lo que devuelva la tienda; la letra legal sigue bien. · [Apple 3.1.2(c)][a-subs], [ofertas][a-intro] · `proplans.ts:662-667` · Código, pequeño `[HECHO en 5d15d86, falta la prueba indicada]` · Test con WEEK y captura sandbox.
- **PAG-08. La letra no dice qué incluye un modo.** Incluye el coach General; parte de lo que vende también existe gratis. · [Apple 3.1.2(c)][a-subs] · `supabase/functions/coach/handler.ts:915-925`, `oferta.json:80,152-155` · Ambos, pequeño `[HECHO en código, falta lo indicado]`: fijas qué es gratis · Comprobar en dispositivo con cuenta gratis cada función citada.
- **PAG-11. /pro con plan y errores de compra solo en español.** La letra traducida espera revisión legal. · [Apple 3.1.2 y 2.3][a-guia] · `pro.tsx:191-331`, `planesmodo.ts:256`, `INFORME-INTEGRACION.md:72` · Ambos, pequeño `[HECHO en código, falta lo indicado]`: la revisión legal es tuya · Recorrido en pseudolocalización y revisión firmada, o ficha solo en español.
- **CON-02. Amigos afirma una revisión previa que no existe.** Es falso, aunque una línea no provocará rechazo. Depende de CON-01. · [Apple 2.3.1][a-meta], [Google, engaño][g-engano] · `src/i18n/es/amigos.json:169`, `AmigosVista.tsx:709` · Código, pequeño `[HECHO en 5d15d86, falta la prueba indicada]` · Convivencia y seguridad, en cada idioma, describe la moderación real.
- **P2. La hoja de permiso de IA no nombra pulso, reloj ni GPS.** La activación de medición sí avisa, repartido. · [Apple 5.1.2(i)][a-uso] · `consentmath.ts:17,28-34`, `supabase/functions/_shared/estudioResistencia.ts:297`, `tools.ts:1784`, `0111:31` · Ambos, pequeño `[ARREGLABLE en parte]`: decides si se sube versión de consentimiento, que corta el coach a la 1.0.11 · Leer la explicación en el binario y test del catálogo en seis idiomas.
- **P3. Conectar el calendario no dice que los títulos llegan a la IA.** Atenuante: el permiso de IA ya declara agenda. · [Apple 5.1.2(i)][a-uso], [Google, datos de usuario][g-datos] · `context.ts:346`, `trabajo.ts:742`, `trabajoagenda.json:4`, `app.json:131` · Código, pequeño `[HECHO en 5d15d86, falta la prueba indicada]`; el texto nativo requiere binario · Test del catálogo y captura de la hoja.
- **CON-07. Plantilla del Contrato con dieta y ejercicio como castigo.** Opcional, pero en una app 16+. · [Apple 1.4.1 y 1.4.5][a-seg] · `src/i18n/es/contrato.json:91,112-128`, `useContrato.ts:50-54` · Código, pequeño `[HECHO en 5d15d86, falta la prueba indicada]` · Test que falle con dieta, ayuno o correr en cualquier idioma.
- **CON-08. Promesas de resultado en la entrada.** Riesgo bajo. · [Apple 2.3.1 y 1.1.6][a-guia], [Google, engaño][g-engano] · `src/i18n/es/onboarding.json:239,290-291,333` · Código, pequeño `[ARREGLABLE]` · Recorrer `/empezar` con meta dura: nada garantiza llegar.
- **FICHA-1. Dictado y voz fijos en español.** Las fichas traducidas ya no los anuncian. · [Apple 2.3][a-meta], [Google metadatos][g-meta] · `src/lib/coachvoz/dictar.ts:24,279`, `src/lib/coachvoz/hablar.ts:23` · Código, pequeño `[ARREGLABLE]` · Test por idioma y prueba en iPhone real.
- **P11. Android arrastra servicios en primer plano que no usa.** · [Google, primer plano][g-fgs] · `node_modules/expo-audio/android/src/main/AndroidManifest.xml:4-5,8,16` · Código, pequeño `[HECHO en 5d15d86, falta la prueba indicada]` · `aapt dump permissions` sobre el AAB.
- **P12. Android declara SYSTEM_ALERT_WINDOW y almacenamiento heredado.** · [Google, permisos][g-perm] · `app.json:76-82` · Código, pequeño `[HECHO en 5d15d86, falta la prueba indicada]` · `bundletool dump manifest` sin ese permiso.
- **P10. Menores: el freno del coach es parcial y depende de un año opcional.** Edad mínima 16 declarativa, sin regla por edad en la doctrina y suelo calórico solo para hombre. Va por despliegue de función. · [Apple 1.4.1][a-seg], [Google, clasificación][g-iarc] · `consentmath.ts:20`, `supabase/functions/_shared/tools.ts:1240-1247`, `_shared/knowledge.ts:114` · Ambos, grande · `scripts/eval-coach.mjs` con ficha de 16 años y sin año: no pauta déficit ni cifras.
- **P4. Permisos de salud e IA solo en español y crisis con teléfonos de España.** · [Apple 5.1.2(i)][a-uso] y [1.4.1][a-seg], [RGPD art. 7 y 9][rgpd] · `healthmath.ts:19-26`, `consentmath.ts:28-68`, `PerfilAjustes.tsx:316` · Ambos, grande · Abrir ambos permisos con el dispositivo en inglés, o fichas solo en español.
- **PLAT-12. `tienda.mjs --final` no puede completarse.** Herramienta interna. · Sin norma · `docs/tienda/TUBERIA.md:21,74,83` · Ambos, pequeño `[ARREGLABLE en parte]` · Capturas en App Store Connect comprobadas una a una.

### D. Tus cuentas y comprobaciones, antes de enviar

- **P8. El borrado de cuenta depende de una clave de RevenueCat sin comprobar.** Si no es `sk_`, ni borrado ni restauración funcionan y sube a bloqueante. · [Apple 5.1.1(v)][a-datos], [Google, borrado][g-borrado] · `supabase/functions/_shared/account-erasure.ts:42-46,98`, `store-config.ts:16-18` · Dueño, no aplica · Borrar una cuenta desechable de producción desde la app y mirar Auth, tablas, Storage y RevenueCat.
- **CON-06. Interruptores de servidor que encienden el producto después del binario.** Modos e idiomas encendidos antes de enviar, prueba automática apagada, y no tocarlos. · [Apple 2.5.19 y 2.1][a-soft] · `0086_interruptores_1011.sql:29-34`, `flagsmath.ts:52-59`, `src/modos/ModoProvider.tsx:65` · Dueño, no aplica · Lectura de `app_config` y cuenta nueva en TestFlight viendo rueda y oferta.
- **ADV-2. La cuenta de prueba no cubre la 1.1 y las de demostración caducan.** El acceso actual llega al 28/11/2026 y es Élite. Hace falta una gratis y una con los cuatro modos. · [Apple 2.1][a-compl] · `docs/appstore-review-2026-09-29/ANTES-DE-REENVIAR.md:12`, `LayoutMundo.tsx:9-12`, `0111:31-40` · Dueño, no aplica · Entrar con cada cuenta siguiendo solo las notas.
- **NOT-2. Denunciar y bloquear no se puede probar sin otra persona visible.** Las cuentas necesitan un amigo de demostración. · [Apple 1.2][a-ugc] y [2.1][a-compl] · `src/components/amigos/AmigosVista.tsx:405,432` · Dueño, no aplica · Ver una fila con los tres puntos en `/amigos`.
- **NOT-3. Emblema de modos y Arsenal no salen sin modos activados.** Dejarlos activados en la cuenta de pago. · [Apple 2.1 y 2.5.19][a-guia] · `src/components/modos/EmblemaMundo.tsx:61-64`, `src/components/general/Arsenal.tsx:98` · Ambos, no aplica · Con la cuenta de pago, abrir la rueda y entrar en un modo.
- **NOT-4. La compra exige aceptar antes el permiso de IA.** Es coherente; las notas lo declaran. Falta tu visto bueno. · [Apple 5.1.1 y 5.1.2(i)][a-uso] · `useOfertaModos.ts:114-123`, `OfertaModosVista.tsx:255` · Dueño, no aplica · En sandbox: rechazar no cobra, aceptar lleva a la hoja de Apple.
- **PAG-12. Restaurar tras borrar y recrear cuenta, nunca probado con StoreKit.** · [Apple 3.1.1][a-iap], [RevenueCat][rc-restore] · `pro.ts:755-774`, `supabase/functions/_shared/store-reconcile.ts:14` · Ambos, pequeño `[ARREGLABLE en parte]`: la etiqueta es opcional, la prueba es tuya · Compra sandbox, borrado, cuenta nueva y Restaurar.
- **PAG-05. Clave de RevenueCat de iOS en EAS; falta verla en el binario.** · [Apple 2.1][a-compl] · `MATRIZ-PLATAFORMAS.md:163`, `pro.ts:194-211` · Dueño, no aplica · En TestFlight, `/pro` con selector, precios y Restaurar.
- **CON-10. Cuestionario de edad por rehacer.** No hay discrepancia: la tienda muestra 16+. · [Apple, edades][a-edad], [Google, clasificación][g-iarc] · `consentmath.ts:20`, `src/lib/age.ts:25` · Dueño, no aplica · Captura del cuestionario y certificado IARC.
- **CON-15. Moderación sin suplente y documento desactualizado.** · [Apple 1.2][a-ugc], [Google UGC][g-ugc] · `docs/MODERACION-SOCIAL.md:7,73` · Dueño, no aplica · Denuncia de prueba: push en menos de 1 hora y cierre en `/moderacion`.
- **P14. Permiso de salud v1 con dos textos y un mismo identificador.** Aceptable si guardas copia fechada de cada texto. · [RGPD art. 7.1][rgpd], [Apple 5.1.3(i)][a-datos] · `healthmath.ts:2,21`, `INFORME-INTEGRACION.md:24` · Dueño, no aplica · Poder enseñar qué texto vio cada aceptación.
- **P13. Borrado y soporte publican una dirección personal.** · [Google, borrado][g-borrado], [Apple 1.5][a-seg] · `https://nivl.app/borrar-cuenta` y `/soporte`, leídas hoy · Dueño, no aplica · Leer las páginas publicadas.
- **CON-13. Página /c con prelanzamiento y soporte con lista de espera.** · [Apple 2.1, 2.3.1 y 1.5][a-guia] · `https://nivl.app/c/PRUEBA` y `/soporte`, leídas hoy · Dueño, no aplica · Abrirlas sin la app: ningún texto de prelanzamiento.

### E. Pruebas con el binario en la mano

- **PLAT-02. `withEscenas` y los targets nunca se han compilado con Xcode 26.3 en Release.** Si fallara, la app se cerraría al abrir. · [Apple 2.1][a-compl], [requisitos][a-sdk] · `docs/DISPOSITIVOS.md:199`, `docs/APPLE_WATCH.md:60`, `INFORME-INTEGRACION.md:59` · Ambos, no aplica · IPA de TestFlight en iPhone físico: abre, y enlaces `nivl://` en frío y en caliente.
- **PLAT-08. iPad 1.1 Ónix sin ver; capturas de 13 pulgadas obligatorias.** La regresión de iPad del run 42592144091 también falló, y el log no es legible desde aquí. App Review suele abrir en iPad. · [Apple 2.4.1][a-guia], [especificaciones][a-capt] · `app.json:13,31-37`, `INFORME-INTEGRACION.md:59`, job 129077399591 paso 15 · Ambos, no aplica · Recorrido en iPad con TestFlight y capturas 2064x2752 validadas.
- **PLAT-05. Vídeo en dispositivo físico: ya no se exige, pero conviene.** Ver [CAPTURAS.md](CAPTURAS.md), sección de vídeo. · [Apple 2.1, respuestas a revisión][a-reply] · `docs/appstore-review-2026-09-29/AUDITORIA.md:9`, `VIDEO-IPHONE.md` · Dueño, no aplica · Vídeo del build enviado: compra por modo, restaurar, borrado, Salud, GPS con pantalla apagada y reloj.

### F. Android, si entra en el plan

- **ADV-4. Producción exige 12 testers 14 días y las declaraciones están sin hacer.** · [Requisitos de prueba][g-testers], [Data safety][g-ds] · `MATRIZ-PLATAFORMAS.md:211`, `SEGURIDAD-DATOS-GOOGLE.md` · Dueño, no aplica · Consola sin tareas pendientes y acceso a producción aceptado.
- **PLAT-03. Android saldría sin venta: falta `EXPO_PUBLIC_RC_ANDROID_KEY`.** No incumple nada, pero no vende. · [Pagos de Google Play][g-pagos] · `MATRIZ-PLATAFORMAS.md:163`, `pro.ts:209`, `OfertaModosVista.tsx:136-156` · Dueño, no aplica · El log de "Compilar el AAB" la lista y se ven precios de Google.
- **CON-12. `assetlinks.json` con huella de relleno.** No causa rechazo: el enlace abriría en navegador. · [App Links][g-links] · `https://nivl.app/.well-known/assetlinks.json` leído hoy; `app.json:54-70` · Dueño, no aplica · `adb shell pm get-app-links`: dominio verified.

## 4. Hecho

Comprobado leyendo código y migraciones. **Nada de esto se ha ejecutado en un dispositivo real**; la última columna dice qué prueba falta.

| ID | Qué está bien | Evidencia | Falta |
|---|---|---|---|
| PAG-16 | La compra integra lo que pide [3.1.2(c)][a-subs] | `planesmodo.ts:329-349`, `OfertaModosVista.tsx:119-122,304-307`, `pro.ts:451,681` | Caso 1 de PRODUCTOS, sección 12 |
| PAG-17 | Sin camino a pagar fuera en iOS ni Android ([3.1.1][a-iap]) | `storepolicy.ts:21-28`, `subscription.ts:27-29` | Release con `EXPO_PUBLIC_PAYWALL=on`, opcional |
| PAG-18 | Sin ahorros ni tachados visibles ([Directiva UE 2019/2161][ue-precios]) | `proplans.ts:300-301,716`, solo en código no montado | Test tras limpiar ese código |
| PAG-19 | Derecho por modo correcto en servidor ([RevenueCat][rc-subs]) | `0140:90-91,117-120`, `store-reconcile.ts:14`, `planesmodo.ts:122-128` | Casos 5, 6 y 9 en sandbox |
| ADV-5 | Permisos con contexto; Salud y GPS accesibles sin pagar ([2.5.1 y 5.1.1][a-guia]) | `PerfilAjustes.tsx:320,330,352-366`, `useCardio.ts:256`, `dictar.ts:251`, `notifications.ts:165,196` | iPhone real denegando cada permiso |
| H1 | Ubicación solo en sesión que arranca la persona ([2.5.4][a-soft]) | `GpsSesion.swift:295,368-369,379`, `useEntrenoGps.ts:124-136` | Carrera real con pantalla apagada |
| H2 | HealthKit sin publicidad ni iCloud; funciona si se rechaza ([5.1.3][a-datos]) | `app.json:39-43`, `GpsSesion.swift:182`, `0111:19-64` | iPhone real denegando todo |
| H3 | Borrado y exportación cubren lo nuevo ([5.1.1(v)][a-datos]) | Cascadas de 0105 a 0125; exportación en 0108, 0110, 0118, 0127; `account-erasure.ts` | `docs/security-audit/humo-produccion.md`; ver P8 |
| H4 | Doble permiso antes de llamar al modelo; sin rutas ni correo a Anthropic ([5.1.2(i)][a-uso]) | `coach/handler.ts:905,1112`, `ritual/handler.ts:271,523`, `oracle/handler.ts:103,108`, `tools.ts:1783` | Coach real con Haiku 5.5 |
| H5 | Aviso médico y línea de crisis presentes ([1.4.1][a-seg]) | `CoachVista.tsx:235`, `PerfilAjustes.tsx:316`, `knowledge.ts:264-285` | Respuestas reales; ver P4 |
| H6 | ATT no hace falta; sin contactos | `src/lib/analitica.ts:1-22`, sin `expo-contacts` | Lista de SDK del binario |
| H7 | Android sin medición, Salud ni GPS ([Data safety][g-ds]) | `modules/nivl-salud/expo-module.config.json`, `useCardio.ts:256` | `aapt dump permissions` |
| CON-17 | Denunciar, bloquear y contacto siguen ([1.2][a-ugc]) | `Competicion.tsx:165`, `PantallaAmigos.tsx:90-121`, `social.ts:200-216` | QA con dos cuentas en iPhone físico |
| CON-18 | Reporte de respuestas de IA ([Google IA][g-ia]) | `MensajeCoach.tsx:126-135,164-173`, `useCoach.ts:684-691` | Denunciar en cada mundo |
| CON-19 | Rutas internas protegidas ([2.5.19][a-soft]) | `src/app/kit.tsx:109`, `galeria.ts:10`, `useCreador.ts:66` | Deep links con cuenta normal en Release |
| CON-20 | Sin regresión en el resto del rechazo de septiembre ([2.1, 3.1.1, 5.1.2][a-guia]) | `pro.ts:521`, `planesmodo.ts:92`, `proplans.ts:560` | Compra y restauración en sandbox |
| CON-21 | Sin datos inventados ni banca conectada ([2.1, 4.2][a-guia]) | `useFocusDatos.ts:106`, `useWorkDatos.ts:106`, `economia.json:208,314,317` | Recorrido en TestFlight |
| CON-22 | Marcas y nombre sin problema ([5.2.1][a-guia]) | `medicion.json`; prescindible `economia.json:280` | Revisar capturas finales |
| NOT-1 | La ruta a Amigos de las notas ya está corregida ([1.2][a-ugc]) | `src/components/general/arena/ArenaConectada.tsx:62`, `ArenaGeneralVista.tsx:122` | Seguirla en el build |
| NOT-5 | Métricas sin entrada desde el Perfil actual, declarado en notas ([2.5.19][a-soft]) | `src/components/perfil/PerfilVista.tsx:206` | Con cuenta admin, aceptar o añadir entrada |
| PLAT-11 | No se suben capturas de iPhone Duo ([especificaciones][a-capt]) | `docs/DISPOSITIVOS.md:111-117`, `scripts/tienda/objetivos/duo.mjs:1-7` | Ficha sin material Duo |
| PLAT-15 | El código encaja con [Target SDK 36][g-target]; **AAB 1.1 sin compilar** | `MATRIZ-PLATAFORMAS.md:155,164` | Artefacto y `zipalign -c -P 16` |
| PLAT-16 | La ficha de Google no promete GPS ni Salud ([ubicación][g-ubic]) | `useCardio.ts:256`, `components/medicion/puro.ts:26` | `bundletool dump manifest` |
| PLAT-17 | Gafas Meta fuera de todo binario ([2.3.1][a-meta]) | `modules/nivl-meta` sin `expo-module.config.json`, `docs/GAFAS-META.md:22` | Autolinking antes de cada binario |
| PLAT-18 | App web sin publicar y sin pagos ([3.1.1][a-iap]) | `src/lib/storepolicy.ts`, `src/components/web/PlanesWeb.tsx:3-8` | Fichas sin mencionarla |

## 5. Sin verificar

No se ha podido comprobar desde aquí. Nada de esta lista está dado por bueno.

- **App Store Connect:** productos, grupo y niveles, Paid Applications Agreement, Small Business Program, App Privacy actual, cuestionario de edad, `userGeneratedContent`, casillas de Mac y Vision, cuentas de revisión, si existen 30,00 € y 99,00 € como puntos de precio, si un suscriptor ve productos antiguos en Ajustes, tamaño de la captura de revisión.
- **Apple Developer y EAS:** App Group, capacidades y perfiles; **por qué ha fallado el run de hoy** (el log exige acceso al repo); si `EXPO_NO_CAPABILITY_SYNC=1` lo resuelve; valor de `EXPO_PUBLIC_RC_IOS_KEY`.
- **RevenueCat:** offering, Restore Behavior, webhook, suscriptores vivos de `nivl_pro_*` y `nivl_elite_*`, si la 1.0.11 lee todas las offerings.
- **Supabase:** valor de `REVENUECAT_API_KEY`, `REVENUECAT_WEBHOOK_AUTH`, `STORE_SANDBOX_ACCESS`; interruptores `modos`, `idiomas`, `prueba_auto` y `analitica`; migraciones aplicadas, incluida la 0087, y filas de `store_products`: solo lo afirma `INFORME-INTEGRACION.md`.
- **Google Play:** estado de la consola (la ficha pública da 404), tipo de cuenta, 12 testers, Data safety, IARC, productos, clave Android (si fuera "secret" los logs no la listarían), `google-services.json` para el push.
- **Binarios:** compilación Release de iOS con Xcode 26.3; compilación Gradle del AAB y 16 KB; Info.plist y manifiesto solo salen de `expo prebuild`; `PrivacyInfo` agregado y aviso ITMS-91053; permisos de dependencias Maven.
- **Nada probado en real:** compra, restauración, subida y cruce con StoreKit o Play Billing; HealthKit, GPS y Apple Watch; deep links en Release; denuncia y bloqueo en iPhone; Android entero; `/gym`, `/dieta` y `/economia` sin pagar (visto por rutas).
- **IA:** ninguna respuesta real de Haiku 5.5 comprobada, incluido el tono sin filtros.
- **Terceros y legal:** DPA de Anthropic y retención (la respuesta "no compartido" de Google depende de ello), marca NIVL en OEPM y EUIPO, suplente de moderación y llegada del push.
- **Detalles:** formato de la prueba de Apple, 1 WEEK o 7 DAY (PAG-07); límites de 30 y 45 caracteres, tomados del encargo; capturas de Mac y Vision; `tienda.mjs` contra la 1.1, sin ejecutar; `eas-cli config` de Android, que pide login.
- **Normas:** `normas-apple.md` y `normas-google.md` no existían en el scratchpad. Se han contrastado en las páginas oficiales de Apple, Google y RevenueCat. La de funciones financieras de Google no se pudo leer.

## 6. Orden de envío

Todos estos pasos los ejecutas tú o quien autorices. Sin plazos: cada uno empieza cuando el anterior está cerrado. **No subas `version` en `app.json`:** la OTA dejaría de llegar a los binarios 1.1.

### Apple

1. **Decide:** reloj sí o no (PLAT-06), idiomas (FICHA-2, CON-11), Mac y Vision (PLAT-09), antiguos (PAG-03).
2. **Arreglos de código** sobre `claude/integracion-1-1-90cd1f`, los `[ARREGLABLE]` y los de la sección 3.B antes de compilar. Verificación:
   ```bash
   npm run typecheck && npm test && npm run lint && npx expo export --platform ios
   ```
3. **Servidor antes que app.** Si CON-01 trae migración (con su huella en `HUELLAS`): `node scripts/apply-migrations.mjs`. Si se toca una función: `npx deno check supabase/functions/<nombre>/index.ts` y desplegar.
4. **Portal de Apple:** capacidades y perfiles de PLAT-01 ([detalle](MATRIZ-PLATAFORMAS.md)). Perfil: `npx eas-cli credentials --platform ios`.
5. **Compilar y subir a TestFlight**, desde la pestaña Actions o desde el repo (`gh` necesita `gh auth login`):
   ```bash
   gh workflow run ios-testflight.yml --ref claude/integracion-1-1-90cd1f -f compilar=true -f enviar=true
   ```
6. **Productos:** Paid Applications Agreement, diez productos, RevenueCat ([PRODUCTOS.md](PRODUCTOS.md), secciones 7, 9 y 11). PAG-15: sin recarga.
7. **Web:** Términos (PAG-01), Privacidad (P1), dirección de soporte (P13), `/c` y `/soporte` (CON-13).
8. **Prueba en TestFlight** con iPhone físico e iPad: PLAT-02, PLAT-08, sandbox de PRODUCTOS sección 12, borrado real (P8), reloj (PLAT-06). Grabar el vídeo (PLAT-05).
9. **Capturas** sobre el commit final, fuera del sandbox de agentes:
   ```bash
   NIVL_TIENDA_TEMA=/ruta/tema-onix.mjs node scripts/tienda/tienda.mjs --commit <sha> --objetivos iphone-69,iphone-63,ipad-13,watch
   node scripts/tienda/validar.mjs .tienda/salida/<sha7>/tienda/iphone-63 --objetivo iphone-63
   ```
   Se suben a mano (PLAT-12).
10. **App Store Connect, versión 1.1.0:** elegir el build, capturas, [ficha](fichas/es-ES.md), [notas](NOTAS-APPLE.txt) sin líneas `[INTERNO]` ni `[CAMPOS]`, App Privacy (ADV-1), cuestionario de edad (CON-10), diez productos adjuntos, cuentas de revisión (ADV-2, NOT-2, NOT-3).
11. **Interruptores** según CON-06, y no tocarlos durante la revisión.
12. **Enviar a revisión**, solo con la lista de bloqueantes vacía.
13. Los cambios solo de JS que falten pueden ir por OTA, pero antes de la revisión, nunca durante:
    ```bash
    npx eas-cli update --channel production --platform ios --environment production --message "…" --non-interactive
    ```
14. Tras aprobar: nada de "Removing from Sale" hasta cerrar PAG-03.

### Google

1. **Decide si Android entra ahora.** iOS no depende de esto.
2. Crear la clave pública de Android en RevenueCat y añadirla a EAS, entorno production (PLAT-03). Arreglos P11 y P12.
3. Compilar el AAB (no publica nada; gasta un `versionCode`):
   ```bash
   gh workflow run android-play.yml --ref claude/integracion-1-1-90cd1f
   gh run download <run-id> --name nivl-aab
   ```
   El artefacto dura 3 días y es descargable por cualquiera con cuenta de GitHub, porque el repo es público.
4. Comprobar 16 KB y permisos:
   ```bash
   bundletool dump config --bundle=nivl.aab | grep alignment
   bundletool build-apks --bundle=nivl.aab --output=nivl.apks --mode=universal
   unzip -o nivl.apks universal.apk
   zipalign -c -P 16 -v 4 universal.apk
   bundletool dump manifest --bundle=nivl.aab
   ```
5. Play Console, a mano: productos ([PRODUCTOS.md](PRODUCTOS.md), sección 8), [Data safety](SEGURIDAD-DATOS-GOOGLE.md), [declaraciones](NOTAS-GOOGLE.md), ficha sin GPS, HealthKit ni reloj, capturas y URL de borrado.
6. Prueba cerrada con el AAB. Si la cuenta entra en la regla: 12 testers durante 14 días seguidos.
7. Publicar la huella SHA-256 en `assetlinks.json` (CON-12).
8. Pedir acceso a producción y enviar: lo haces tú.

### Lo que NO se ha hecho

Nada se ha enviado a ninguna tienda ni publicado. No se ha tocado App Store Connect, Google Play, RevenueCat ni Supabase; no hay OTA, migraciones ni despliegues; no se han aceptado acuerdos ni usado cuentas de revisor. Sí se ha hecho: push de `claude/tienda-1-1-b4864e` y un intento de compilar sin reloj, que falló antes de subir (run 42598212172) y gastó el build 40.

Fuera del repo, por los runs: el identificador de la complicación registrado en Apple y el contador de build subido. TestFlight no ha recibido ningún binario 1.1.

## 7. Lo que solo puede hacer el dueño, en orden

1. **Portal de Apple, con tu sesión:** activa HealthKit en `com.teferi.nivl`. Si el reloj va: crea el App Group `group.com.teferi.nivl`, asígnalo a `.watchkitapp` y `.watchkitapp.complicacion`, y activa HealthKit en `.watchkitapp`.
2. **Regenera los perfiles**, en tu terminal y contestando tú:
   ```bash
   npx eas-cli credentials:configure-build --platform ios --profile production
   ```
3. **Compila y sube a TestFlight** (añade `-f sin_reloj=true` si el reloj no va):
   ```bash
   gh workflow run ios-testflight.yml --ref claude/integracion-1-1-90cd1f -f compilar=true -f enviar=true
   ```
4. **App Store Connect, a mano:** App Privacy con Ubicación (ADV-1), cuestionario de edad (CON-10), Paid Applications Agreement, cuentas de revisión gratis y de cuatro modos con un amigo de demostración (ADV-2, NOT-2, NOT-3), casillas de Mac y Vision (PLAT-09). Captura de la pantalla de compra real en cada uno de los diez productos, y adjuntarlos a la 1.1.
5. **Supabase y RevenueCat:** comprobar `STORE_SANDBOX_ACCESS`, que `REVENUECAT_API_KEY` empieza por `sk_` (P8), los interruptores (CON-06) y los entornos por evento del webhook. RevenueCat Android sigue sin configurar.
6. **Con un iPhone real, opcional:** Salud, GPS con pantalla apagada, reloj e iPad. La compra no se prueba por decisión tuya; ver el riesgo principal arriba.
7. **Google Play:** crea la clave de Android en RevenueCat y añádela a EAS (PLAT-03), productos, Data safety, declaraciones, huella en `assetlinks.json`, y 12 testers durante 14 días si tu cuenta entra en la regla (ADV-4).
8. **Decisiones:** reloj sí o no (PLAT-06), idiomas de la ficha (FICHA-2), productos antiguos (PAG-03), revisión legal de la letra traducida (PAG-11).

[a-guia]: https://developer.apple.com/app-store/review/guidelines/
[a-ugc]: https://developer.apple.com/app-store/review/guidelines/#user-generated-content
[a-subs]: https://developer.apple.com/app-store/review/guidelines/#subscriptions
[a-iap]: https://developer.apple.com/app-store/review/guidelines/#in-app-purchase
[a-compl]: https://developer.apple.com/app-store/review/guidelines/#app-completeness
[a-datos]: https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage
[a-uso]: https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing
[a-meta]: https://developer.apple.com/app-store/review/guidelines/#accurate-metadata
[a-soft]: https://developer.apple.com/app-store/review/guidelines/#software-requirements
[a-seg]: https://developer.apple.com/app-store/review/guidelines/#safety
[a-cruces]: https://developer.apple.com/app-store/subscriptions/
[a-builds]: https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/
[a-privacy]: https://developer.apple.com/app-store/app-privacy-details/
[a-capt]: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
[a-mac]: https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-macs-with-apple-silicon/
[a-venta]: https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-availability-for-an-auto-renewable-subscription
[a-manifest]: https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
[a-intro]: https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions
[a-edad]: https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/
[a-sdk]: https://developer.apple.com/news/upcoming-requirements/
[a-reply]: https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/reply-to-app-review-messages/
[g-ugc]: https://support.google.com/googleplay/android-developer/answer/9876937
[g-billing]: https://support.google.com/googleplay/android-developer/answer/140504
[g-pagos]: https://support.google.com/googleplay/android-developer/answer/9858738
[g-ds]: https://support.google.com/googleplay/android-developer/answer/10787469?hl=es
[g-meta]: https://support.google.com/googleplay/android-developer/answer/9898842
[g-engano]: https://support.google.com/googleplay/android-developer/answer/9888077?hl=es
[g-datos]: https://support.google.com/googleplay/android-developer/answer/10144311?hl=es
[g-iarc]: https://support.google.com/googleplay/android-developer/answer/9859655?hl=es
[g-borrado]: https://support.google.com/googleplay/android-developer/answer/13327111?hl=es
[g-testers]: https://support.google.com/googleplay/android-developer/answer/14151465
[g-fgs]: https://support.google.com/googleplay/android-developer/answer/13392821
[g-perm]: https://support.google.com/googleplay/android-developer/answer/9888170
[g-ia]: https://support.google.com/googleplay/android-developer/answer/13985936
[g-ubic]: https://support.google.com/googleplay/android-developer/answer/9799150
[g-target]: https://developer.android.com/google/play/requirements/target-sdk
[g-links]: https://developer.android.com/training/app-links/verify-android-applinks
[rc-restore]: https://www.revenuecat.com/docs/projects/restore-behavior
[rc-subs]: https://www.revenuecat.com/docs/subscription-guidance/managing-subscriptions
[rgpd]: https://eur-lex.europa.eu/eli/reg/2016/679/oj
[ue-precios]: https://eur-lex.europa.eu/eli/dir/2019/2161/oj
