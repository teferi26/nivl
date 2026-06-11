# Datos, privacidad y futuro del producto

> Categoría SEG · backlog NIVL · ordenadas por impacto

### SEG-001 · Bucket privado y URLs firmadas para evidencias
**Qué:** Mover las evidencias a un bucket privado de Supabase Storage con políticas por carpeta `{user_id}/` y servirlas con signed URLs de ~60 min generadas al vuelo. Las fotos de tu cuerpo, tu comida y tu escritorio dejan de ser accesibles para cualquiera que tenga o adivine una URL pública. Cero cambio visible en la app: misma velocidad, riesgo eliminado.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 2

### SEG-002 · RLS por usuario en todas las tablas
**Qué:** Activar Row Level Security con políticas `user_id = auth.uid()` en misiones, completados, log de XP, perfil y penalizaciones, más un test SQL que verifica que un segundo usuario ficticio no ve absolutamente nada. Hoy blinda la anon key expuesta en el cliente; mañana es el cimiento del multi-usuario sin reescribir el esquema.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 2

### SEG-003 · Compresión y tope de peso de evidencias en cliente
**Qué:** Redimensionar a ~1280 px y comprimir a JPEG ~70 % antes de subir (objetivo <300 KB por foto), con tope duro y aviso si se supera. El 1 GB gratis de Storage pasa de durar meses a durar años, y el check con cámara se siente instantáneo incluso con la cobertura mala del gimnasio.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 2

### SEG-004 · Borrado de EXIF y GPS antes de subir
**Qué:** Re-codificar cada evidencia en el cliente eliminando metadatos EXIF: coordenadas GPS, modelo de dispositivo y datos internos de captura. Una foto del desayuno no debe revelar dónde vives; es la mejora de privacidad más barata de todo el backlog.
**Impacto:** 5/5 · **Esfuerzo:** S · **Fase:** 2

### SEG-005 · «Exportar mi vida»: export total en un toque
**Qué:** Botón en Perfil que genera un ZIP con JSON estructurado (misiones, completados, XP, rachas, stats, penalizaciones) más todas las evidencias, entregado por share sheet con animación «VOLCADO DE DATOS COMPLETADO». Sensación de propiedad absoluta —años de progreso caben en un archivo que es tuyo— y deja el art. 20 RGPD resuelto para el día que NIVL se publique.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### SEG-006 · Backup automático cifrado fuera de Supabase
**Qué:** Copia semanal automática del export completo, cifrada con frase del usuario (AES-256) y guardada en iCloud/Google Drive o carpeta elegida. Perder nivel, rachas e historial por un fallo o borrado accidental de la nube sería la muerte del juego; esto lo hace estructuralmente imposible.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### SEG-007 · Offline-first: SQLite local como fuente de verdad
**Qué:** La app lee y escribe siempre en SQLite local y sincroniza con Supabase en segundo plano mediante cola de operaciones y resolución last-write-wins. Completar la misión del gym en un sótano sin cobertura cuenta al instante, con su animación de XP; un habit tracker que falla sin red rompe el hábito justo cuando más importa.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 3

### SEG-008 · Borrado total de cuenta in-app («Protocolo de desvinculación»)
**Qué:** Flujo con doble confirmación (escribir tu nombre de cazador + cuenta atrás de 10 s estilo autodestrucción) que invoca una edge function que purga Auth, todas las tablas y Storage en cascada, mostrando recibo de lo eliminado y ofreciendo el export previo en el mismo flujo. Obligatorio por la guideline 5.1.1(v) de Apple y el art. 17 RGPD antes de publicar.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 3

### SEG-009 · Bloqueo biométrico («Identifícate, cazador»)
**Qué:** FaceID/huella al abrir la app con pantalla de verificación estilo ventana del sistema y PIN de respaldo, configurable también solo para secciones sensibles. Imprescindible antes del diario de fase 4: nadie escribe verdades en una app que cualquiera con tu móvil puede abrir.
**Impacto:** 5/5 · **Esfuerzo:** M · **Fase:** 4

### SEG-010 · Diario cifrado de extremo a extremo
**Qué:** Las entradas del diario se cifran en el dispositivo (clave derivada de una frase, custodiada en Keychain/Keystore) y Supabase solo almacena blobs ilegibles: ni el administrador de la BD puede leerlas. La promesa visible «ni siquiera el servidor puede leer esto» es lo que desbloquea la escritura honesta que alimenta PER.
**Impacto:** 5/5 · **Esfuerzo:** L · **Fase:** 4

### SEG-011 · Anti-pausa del proyecto Supabase free
**Qué:** El free tier pausa proyectos tras ~1 semana sin actividad: añadir un ping semanal (cron externo o GitHub Action) que lo mantiene despierto, y una pantalla «SISTEMA EN HIBERNACIÓN — reactivando núcleo» si la app detecta el proyecto pausado, en vez de errores crípticos. Evita el peor escenario de churn: volver de una semana de vacaciones y que el Sistema entero parezca muerto.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### SEG-012 · Panel «Estado del Núcleo»: consumo vs free tier
**Qué:** Pantalla en ajustes con barras estilo HUD: MB de Storage usados, filas por tabla, egress estimado del mes y % de cada límite del free tier de Supabase. Control de costes real: la certeza visual de que NIVL cabe en 0 €/mes mientras sea personal, y la base para decidir cuándo purgar.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### SEG-013 · Caducidad automática configurable de evidencias
**Qué:** Política por defecto «conservar fotos 90 días» (configurable 30/90/365/siempre): pasado el plazo, un job borra el archivo y conserva el registro del completado con fecha y hash. El historial no pierde verdad, el Storage deja de crecer sin límite y tus fotos antiguas dejan de existir en la nube.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### SEG-014 · Sesión en SecureStore, no en AsyncStorage
**Qué:** Mover los tokens de Supabase Auth a expo-secure-store (Keychain/Keystore cifrado por hardware) como almacenamiento del cliente de auth. Quick win que cierra el vector más tonto de robo de sesión en un dispositivo comprometido o un backup sin cifrar.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### SEG-015 · Miniaturas en cliente + original bajo demanda
**Qué:** Generar al capturar un thumbnail de ~200 px que es lo que se lista en historial y detalle de misiones; el original solo se descarga al tocar la miniatura. Los 5 GB/mes de egress gratis pasan a durar años y el scroll del historial vuela.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 3

### SEG-016 · Evidencias sin rastro en la galería
**Qué:** La cámara de evidencias guarda directo en el sandbox de la app y sube a Storage sin escribir jamás en el carrete del teléfono. Tus 365 selfies de gym no aparecen en Google Fotos, ni en los «recuerdos» automáticos, ni al pasar el móvil para enseñar una foto.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### SEG-017 · Modo «evidencia solo local» por misión
**Qué:** Interruptor por misión: su evidencia nunca sube a la nube, se guarda cifrada solo en el dispositivo y se marca con un candado en el detalle. Para misiones íntimas (peso, foto de progreso corporal) desaparece la fricción mental de «esto va a un servidor», así que las registras de verdad.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### SEG-018 · Sync multi-dispositivo en tiempo real
**Qué:** Canales de Supabase Realtime para que móvil y tablet reflejen completados, XP y nivel al segundo, integrados con la cola offline. Marcar la misión en el móvil y ver la barra de XP subir sola en la tablet del escritorio refuerza la fantasía de un Sistema omnipresente.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 5

### SEG-019 · Modo 100 % local sin cuenta
**Qué:** Opción al arrancar: «Jugar sin Sistema Central» — NIVL completo sobre SQLite, sin crear cuenta ni tocar Supabase, con migración posterior a la nube si se quiere. Privacidad máxima demostrable, coste de servidor cero por usuario y argumento killer si se publica: «tus datos no salen de tu móvil salvo que tú quieras».
**Impacto:** 4/5 · **Esfuerzo:** L · **Fase:** 5

### SEG-020 · Borrado selectivo por categorías
**Qué:** En ajustes de datos: borrar solo evidencias (todas o por rango de fechas), solo historial antiguo o solo el diario, con preview de filas y MB que se liberan antes de confirmar. Control granular para limpiar sin tener que apretar el botón nuclear de eliminar la cuenta.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 4

### SEG-021 · Datos en región UE + DPA archivado
**Qué:** Verificar que el proyecto Supabase vive en una región europea (eu-central) o migrarlo, y archivar en /docs el Data Processing Agreement y la lista de subprocesadores de Supabase. Residencia de datos europea y papeleo RGPD resueltos antes de que exista el segundo usuario; migrar después sería diez veces más doloroso.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 2

### SEG-022 · «Protocolo de privacidad» visible
**Qué:** Pantalla en ajustes (y página espejo en nivl.app) en lenguaje claro y voz del Sistema: qué se guarda, dónde, cuánto tiempo, y la lista de lo que NIVL no hará nunca — ads, venta de datos, trackers de terceros. En una app que ve toda tu vida, la confianza explícita es retención.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 5

### SEG-023 · Monetización definida: pago único «Licencia de Cazador»
**Qué:** Documento de decisión que fija el modelo si NIVL se publica: compra única (~7,99 €) que desbloquea todo para siempre, sin suscripciones, sin ads, sin pay-to-win, con cosméticos opcionales como única extensión. Fijarlo ahora por escrito evita que decisiones de fases 6-8 (features «premium») corrompan el diseño del juego.
**Impacto:** 4/5 · **Esfuerzo:** S · **Fase:** 6

### SEG-024 · Fichas de privacidad de las stores desde inventario real
**Qué:** Construir la tabla dato → propósito → retención → terceros del producto real y volcarla en App Privacy (Apple) y Data Safety (Google). Sin esto no hay publicación posible, y el ejercicio de inventario es en sí la mejor auditoría interna de datos de NIVL.
**Impacto:** 4/5 · **Esfuerzo:** M · **Fase:** 6

### SEG-025 · Traspaso a móvil nuevo con QR
**Qué:** Flujo «Transferir el Sistema»: el dispositivo viejo muestra un QR de un solo uso, el nuevo lo escanea, hereda la sesión y precarga la base local completa. Cambiar de móvil sin perder rachas ni configuración es el momento exacto donde la mayoría de trackers pierden a sus usuarios.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### SEG-026 · Indicador de sync estilo sistema
**Qué:** Chip en la pantalla Sistema: «SINCRONIZADO» / «MODO AUTÓNOMO» (offline, con nº de operaciones en cola) / «TRANSMITIENDO…», con hora del último sync. Quita la ansiedad de «¿se habrá guardado mi check?» y convierte un estado técnico en lore del juego.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### SEG-027 · Alertas al 80 % del free tier
**Qué:** Notificación y banner cuando Storage, filas o egress crucen el 80 % de los límites gratuitos, enlazando al panel del Núcleo con acciones sugeridas (purgar evidencias viejas, bajar calidad de foto). Nunca una factura sorpresa ni un proyecto bloqueado a mitad de racha.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### SEG-028 · Simulacro de restauración trimestral
**Qué:** Flujo «Restaurar desde archivo» que reconstruye toda la cuenta desde un backup, más una misión épica trimestral generada por el Sistema («SIMULACRO DE RECUPERACIÓN») que obliga a probarlo de verdad. Un backup cuya restauración nunca se ha ensayado no existe.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 3

### SEG-029 · Export CSV para análisis propio
**Qué:** Además del ZIP completo, CSVs limpios por entidad (misiones, completados, log de XP, rachas) listos para pandas o Google Sheets. Como estudiante de informática, poder graficar tu propia vida con tus herramientas es motivación gratuita a coste casi cero de desarrollo.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 3

### SEG-030 · Sello de integridad en evidencias
**Qué:** Al capturar, se calcula SHA-256 + timestamp del servidor y se guarda junto a la foto; la evidencia luce el sello «VERIFICADO POR EL SISTEMA». Hace tangible y auditable el bonus +25 % de cámara en el momento y blinda el anti-trampas frente a fotos recicladas de galería.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 4

### SEG-031 · Contenido oculto en el selector de apps
**Qué:** FLAG_SECURE en Android y overlay de blur con el logo al pasar a segundo plano en iOS. Nadie ve tu diario, tu peso ni tus stats en una multitarea proyectada en clase o compartiendo pantalla en una llamada.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 4

### SEG-032 · Gestión de dispositivos y cierre remoto
**Qué:** Lista de sesiones activas (modelo, último acceso) con botón «revocar acceso»; si pierdes el móvil, lo expulsas del Sistema desde la tablet o la web. Pieza de seguridad básica en cuanto exista el multi-dispositivo.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### SEG-033 · Notificaciones sin duplicados entre dispositivos
**Qué:** Con 2+ dispositivos, solo el designado «terminal principal» programa las notificaciones locales de 8:00 y 21:30 (o se migra a push con deduplicación por servidor). El doble ping simultáneo es la vía rápida para que silencies NIVL para siempre.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 5

### SEG-034 · Archivado en frío del historial antiguo
**Qué:** Los completados de hace más de 12 meses se compactan en JSON comprimido (un archivo por trimestre, en Storage o local) y se purgan de Postgres, conservando agregados de perfil y récords. La BD se mantiene de por vida bajo los 500 MB del free tier sin perder ni un dato.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 6

### SEG-035 · Auditoría «0 rastreadores» y permisos mínimos
**Qué:** Pasada estilo Exodus sobre las dependencias para certificar cero SDKs de tracking/ads, y revisión de manifests para pedir únicamente cámara y notificaciones. El resultado se publica en el Protocolo de privacidad: «compruébalo tú mismo».
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 6

### SEG-036 · Telemetría: nada por defecto, opt-in si algún día llega
**Qué:** Decisión de producto escrita: NIVL no lleva analytics; si al publicar hiciera falta medir uso, será una herramienta UE/self-hosted (Plausible o PostHog EU), agregada, opt-in explícito y sin IDs publicitarios. Cierra de antemano la puerta por la que los buenos productos se vuelven espías.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 6

### SEG-037 · Informes de fallos sin datos personales
**Qué:** Si se añade crash reporting para la beta pública, configurarlo con scrubbing (beforeSend) que elimina emails, URLs firmadas de evidencias y rutas con nombres de archivo. Estabilidad para los testers sin pagar con su privacidad.
**Impacto:** 3/5 · **Esfuerzo:** S · **Fase:** 6

### SEG-038 · Empezar sin email: cuenta anónima vinculable
**Qué:** Alta con auth anónima de Supabase —juegas al segundo de instalar— y vinculación posterior a email/passkey conservando nivel, rachas e historial. Para futuros usuarios elimina la fricción nº 1 del onboarding; para ti, deja resuelta la migración limpia de datos entre identidades.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 6

### SEG-039 · Login sin contraseña (passkeys / magic link)
**Qué:** Sustituir la contraseña por passkey ligada a la biometría del dispositivo, con magic link como respaldo. Menos superficie de ataque, cero «olvidé mi contraseña» y un login que se siente como autenticarse ante el Sistema.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 6

### SEG-040 · Landing nivl.app v1 con lista de espera
**Qué:** One-pager con estética de ventana del sistema (esquinas cortadas, #37C8F0 sobre #060B16): claim «Sube de nivel en la vida real», tres capturas, manifiesto de privacidad y waitlist por email (tabla en Supabase + envío transaccional). Mide interés real con números antes de invertir un euro en publicar.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 6

### SEG-041 · Beta privada por TestFlight / Play Internal
**Qué:** Distribución a 5-10 amigos vía TestFlight y pista interna de Play Console, con botón in-app «Informe al Administrador» (bug o idea + captura adjunta). Primer contacto de NIVL con humanos que no son su creador: el feedback que ningún backlog puede inventar.
**Impacto:** 3/5 · **Esfuerzo:** M · **Fase:** 6

### SEG-042 · Checklist de publicación en stores
**Qué:** Documento vivo en /docs: cuentas developer (99 $/año Apple, 25 $ únicos Google), bundle IDs definitivos, iconos y splash finales, screenshots con marcos por idioma, age rating, categorías y keywords ES/EN. Convierte «algún día lo publico» en una lista de casillas tachables.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 6

### SEG-043 · Privacidad y términos publicados y versionados
**Qué:** nivl.app/privacidad y nivl.app/terminos en español e inglés, generados desde markdown versionado en el repo con fecha de versión visible. Requisito duro de ambas stores y del proveedor de pagos; mantenerlo como código evita que se pudra.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 6

### SEG-044 · Importador desde otros habit trackers
**Qué:** Importar CSV de Loop Habit Tracker, Streaks o Habitica: un asistente mapea hábitos → misiones (stat + dificultad) y siembra el historial para arrancar con racha y nivel justos. El día que NIVL se publique, «no quiero perder mi historial» será la objeción nº 1 al cambio: esto la elimina.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 7

### SEG-045 · Puerta de edad y consentimiento en el alta
**Qué:** Al abrir el registro a terceros: confirmación de edad mínima (16 en la UE, configurable por región) y aceptación explícita de términos y privacidad registrada con timestamp. Evita cuentas de menores que dispararían obligaciones COPPA/RGPD imposibles de asumir en solitario.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 7

### SEG-046 · Invitaciones «El Sistema te ha elegido»
**Qué:** Beta cerrada por códigos de invitación limitados que cada cazador genera desde su perfil (3 al mes), con onboarding especial para invitados. Crea deseo por escasez muy al estilo Solo Leveling y mantiene el crecimiento dentro de los límites del free tier.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 7

### SEG-047 · Internacionalización para el lanzamiento
**Qué:** Extraer todos los strings a i18n (español como base, inglés como segunda lengua), incluidas las voces del Sistema, las fichas de store y la landing. Publicar solo en español reduce el mercado potencial a una fracción; prepararlo antes de fase 7 evita re-tocar cada pantalla después.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 7

### SEG-048 · Tip jar «Apoya al Administrador»
**Qué:** Compra in-app de propina única (1,99/4,99/9,99 €) con animación de gratitud del Sistema y absolutamente ninguna ventaja de juego. Valida la disposición a pagar de la beta y financia las cuentas de developer sin tocar el diseño del juego.
**Impacto:** 2/5 · **Esfuerzo:** S · **Fase:** 7

### SEG-049 · Cosméticos de pago único (temas del sistema)
**Qué:** Packs de tema comprables una sola vez —«Monarca de la Sombra» (púrpura/negro), «Protocolo Carmesí», «Verde Estado»— que recolorean la UI; jamás XP, slots ni ventajas. La única extensión de monetización compatible con la filosofía de NIVL: pagar por identidad, nunca por progreso.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 8

### SEG-050 · Ranking anónimo opt-in entre cazadores
**Qué:** Con multi-usuario: liga semanal por XP con alias y avatar genérico de cazador, opt-in explícito, sin foto ni datos reales, y RLS que solo expone alias y XP semanal. Comparación social que motiva sin convertir NIVL en una red social que filtra tu vida.
**Impacto:** 2/5 · **Esfuerzo:** L · **Fase:** 8

### SEG-051 · Party/gremio con privacidad por diseño
**Qué:** Grupos de 2-5 amigos con retos compartidos («raid semanal: 5 entrenos entre todos») donde las evidencias solo son visibles dentro del party, caducan a las 48 h y todo es opt-in por misión. La presión social positiva es la mayor apuesta de retención a largo plazo, y aquí nace con los límites de privacidad ya puestos.
**Impacto:** 2/5 · **Esfuerzo:** L · **Fase:** 8

### SEG-052 · Cliente open source (modelo open core)
**Qué:** Decidir licencia y, si procede, liberar el cliente React Native en GitHub (manteniendo privadas configuración e infraestructura), con badge «código auditable» en la landing. Para una app que ve toda tu vida, «no me creas: lee el código» es el argumento de confianza definitivo.
**Impacto:** 2/5 · **Esfuerzo:** M · **Fase:** 8

Total: 52 mejoras.
