# UX/UI Perfil

> Área PRF · auditoría de código NIVL · anclada al código real

Ámbito auditado: `src/app/(tabs)/perfil.tsx` (498 líneas, pestaña `Perfil`). Dependencias leídas para contexto: `lib/engine.ts` (`setFreeze`), `lib/data.ts` (`ensureProfile`, `updateProfile`, `completionStats`, `uploadAvatar`, `signedUrl`), `lib/achievements.ts` (`ACHIEVEMENTS`, `fetchUnlocked`), `lib/game.ts` (`levelFromXp`, `rankForLevel`, `statPoints`, `streakMultiplier`, `STATS`, `STAT_COLUMN`, `MAX_STONES`), `lib/dates.ts`, `lib/exporter.ts`, `lib/auth.tsx`, `lib/theme.ts`, `lib/types.ts`, componentes `Hexagon`, `SystemButton`, `SystemWindow`, `XPBar`. Comparado con `(tabs)/index.tsx` para consistencia.

La pantalla Perfil es la "ficha de cazador": avatar, nombre, título equipado, rango/nivel/XP, válvulas (piedras + pausa), estadísticas, vitrina de logros/títulos, KPIs y tres acciones de cuenta (compartir, exportar, cerrar sesión). Más una `share card` capturada como imagen para compartir, y un modal de pausa. Es un componente monolítico de 498 líneas con 10 piezas de estado: el principal candidato a modularizar de toda la app. Esta auditoría se centra en correción de las mutaciones (pausa, avatar, título, nombre), la fiabilidad de la captura de imagen, la viralidad de la share card, los estados (cargando/vacío/error) y la accesibilidad.

## Bugs y riesgos

### CRIT-PRF-01 · `pickAvatar` no tiene cerrojo: doble toque sube dos avatares y deja estado/BD descuadrados — `(tabs)/perfil.tsx:85-105,194` · severidad alta
**Problema:** el `Pressable` del avatar (línea 194) llama a `pickAvatar` sin ningún guard. `pickAvatar` es una secuencia `launchImageLibraryAsync` → `uploadAvatar` → `updateProfile` → `signedUrl` totalmente asíncrona y sin protección de reentrada (a diferencia de `onExport`, que sí usa `if (busy) return`, línea 163). Dos toques rápidos abren dos selectores; al elegir en ambos se lanzan dos cadenas de subida concurrentes. Cada `uploadAvatar` genera un path distinto (`avatar_${Date.now()}.jpg`, data.ts:110), así que se suben dos ficheros, se hacen dos `updateProfile` y dos `signedUrl`; el `avatar_url` final en BD y el `avatarUri` en pantalla pueden quedar descasados (gana el que resuelva último, que no tiene por qué ser el último que el usuario eligió). Además no hay indicador de "subiendo", así que en una subida lenta el usuario vuelve a tocar pensando que no respondió.
**Arreglo:** reutilizar el flag `busy` (o uno propio `avatarBusy`) con guard al entrar (`if (busy) return; setBusy(true)`) y `finally` que lo libere; mostrar un `ActivityIndicator`/overlay sobre el hexágono mientras sube. Idealmente revocar/limpiar el avatar anterior en Storage tras éxito.

### CRIT-PRF-02 · La captura de la share card puede salir en blanco/negra o sin avatar (capturar dentro de un `Modal` + `Image` async) — `(tabs)/perfil.tsx:151-160,363-373` · severidad alta
**Problema:** `shareProfile` hace `captureRef(shareRef, ...)` (línea 153) sobre una vista que vive DENTRO de un `<Modal transparent animationType="fade">` (línea 363). En Android, `react-native-view-shot` captura desde la jerarquía de la `Activity` y los `Modal` se montan en una ventana aparte; capturar un ref dentro de un Modal es una fuente conocida de PNG en blanco/negros o recortados. Súmese que el avatar es un `expo-image` con `source={{ uri: avatarUri }}` (signed URL remota, línea 369): si el usuario abre "Compartir" y pulsa "Compartir imagen" antes de que la imagen remota termine de decodificar, la captura sale con el hexágono vacío. No hay espera a `onLoad` ni fallback. El resultado es una imagen "viral" potencialmente rota justo en el momento de máxima exposición social.
**Arreglo:** (a) renderizar la share card FUERA del Modal, en una capa absolutamente posicionada fuera de pantalla (p. ej. `position:'absolute', left:-9999`) y capturarla desde ahí, no desde dentro del Modal; (b) precargar/`prefetch` el avatar (`Image.prefetch(avatarUri)`) y deshabilitar "Compartir imagen" (con spinner) hasta `onLoad`; (c) probar `captureRef` con `result:'tmpfile'` y `snapshotContentContainer:false`. Verificar en Android físico.

### CRIT-PRF-03 · `activateFreeze` y `deactivateFreeze` sin `try/catch`: un fallo de red deja excepción sin capturar y el modal de pausa "colgado" — `(tabs)/perfil.tsx:115-127` · severidad media
**Problema:** a diferencia de `pickAvatar`/`shareProfile`/`onExport`, las dos funciones de pausa llaman a `setFreeze` (que hace `updateProfile` + `insertEvent`, engine.ts:197-205) sin envolver en `try/catch`. Si la red falla, la promesa se rechaza: en `activateFreeze` el `setFreeze` lanza antes de `setFreezeOpen(false)` (línea 120), así que el modal se queda abierto sin feedback y el usuario no sabe si se activó; en `deactivateFreeze` queda una unhandled rejection y la UI sigue mostrando "Sistema en pausa" pese a que el usuario pidió reanudar. No hay `Alert` de error como en el resto de acciones de la pantalla.
**Arreglo:** envolver ambas en `try/catch` con `Alert.alert('Error del sistema', …)` igual que `pickAvatar` (líneas 102-104), y cerrar el modal solo tras éxito. Añadir estado `busy` para evitar doble activación.

### CRIT-PRF-04 · La pausa "desde hoy" no protege el día de hoy si aún no ha cerrado, y su semántica de duración confunde — `(tabs)/perfil.tsx:115-121` · `closing.ts:51-56` · severidad media
**Problema:** `activateFreeze` calcula `until = addDays(today, freezeDays - 1)` y persiste `freeze_until=until`. El cierre (`computeDayClose`) solo recorre días `day < today` y considera congelado `day <= freezeUntil` (closing.ts:51-52). Como `freeze_until ≥ today`, el efecto real solo aplica en cierres FUTUROS: la pausa "de 1 día" (`until = today`) cubrirá hoy cuando el cierre corra mañana — correcto—, pero la copy "Duración (desde hoy)" + "1 día/3 días…" sugiere al usuario un contador de días naturales que no se corresponde con cuántos cierres se saltan realmente, y no muestra el rango efectivo ("pausa del {hoy} al {until}"). Además no hay protección contra activar una pausa cuando ya hay una vigente (se sobrescribe `freeze_until`/`freeze_reason` sin avisar) ni contra fechas en el pasado. El usuario no tiene forma de saber qué días quedan exactamente cubiertos.
**Arreglo:** mostrar explícitamente el rango cubierto en el modal y en la válvula ("en pausa del DD/MM al DD/MM, N días"); recalcular `freezeDays` ↔ `until` de forma visible; bloquear/avisar si ya hay pausa activa al pulsar "Pausar sistema"; documentar que la pausa afecta a los cierres, no a poder o no completar misiones hoy.

### CRIT-PRF-05 · `load()` hace `setState` sin guard de desmontaje ni de concurrencia (fugas / "can't perform a React state update") — `(tabs)/perfil.tsx:63-83` · severidad media
**Problema:** `load` se dispara en cada foco vía `useFocusEffect` (líneas 79-83) y encadena cuatro `await` (`ensureProfile`, `completionStats`, `fetchUnlocked`, `signedUrl`) antes de varios `setProfile/setStats/setUnlocked/setAvatarUri`. Si el usuario sale de la pestaña (o cierra sesión, navegando a `/login`) mientras esas llamadas están en vuelo, los `setState` se ejecutan sobre un componente desmontado (warning y fuga de memoria). Tampoco hay protección contra dos `load()` solapados (dos focos rápidos): el segundo puede resolver antes que el primero y dejar datos de un estado anterior. En particular `signedUrl` (red, ~cientos de ms) es la más propensa.
**Arreglo:** patrón `let alive = true` dentro del `useCallback` del `useFocusEffect` con `return () => { alive = false }`, y comprobar `if (!alive) return` antes de cada `setState`; o un `AbortController`/token de secuencia para descartar respuestas obsoletas.

### CRIT-PRF-06 · Las mutaciones parten de un `profile` posiblemente obsoleto y pueden pisar campos actualizados por `load()` — `(tabs)/perfil.tsx:100,112,119,126,145` · severidad media
**Problema:** todas las escrituras optimistas hacen `setProfile({ ...profile, campoX })` usando el `profile` capturado en el closure, no la forma funcional `setProfile(p => …)`. Como `load()` puede refrescar `profile` en paralelo (al volver a enfocar), una mutación local que se resuelva después puede revertir cambios recién traídos del servidor. Ejemplo concreto: el usuario equipa un título (`onAchievementTap`, línea 145 hace `{ ...profile, equipped_title: next }`); si entremedias `load()` trajo un `profile` con `xp_total` mayor (cierre procesado en otra pestaña), el spread con el `profile` viejo del closure devuelve el XP al valor anterior en la UI hasta el siguiente refresco. Mismo riesgo en `pickAvatar` (avatar_url), `saveName` (name), `activateFreeze/deactivateFreeze` (freeze_*).
**Arreglo:** usar actualizaciones funcionales `setProfile(p => p ? { ...p, equipped_title: next } : p)` en las cinco mutaciones, partiendo siempre del estado más reciente.

### CRIT-PRF-07 · `equipped_title` puede quedar "huérfano" si se desbloquea un título y luego cambia la definición, sin validación contra los logros — `(tabs)/perfil.tsx:137-146,214-216,375-377` · severidad baja
**Problema:** el título equipado se guarda como string libre en `profile.equipped_title` (p. ej. "El Persistente"). La UI lo muestra incondicionalmente en la ficha (línea 215) y en la share card (línea 376) mientras `equipped_title` no sea null, sin volver a comprobar que el logro que lo otorga (`ACHIEVEMENTS[].title`) siga desbloqueado ni exista. Si en una futura versión se renombra un título o se revoca un logro (o si el valor llega corrupto desde otra ruta), el usuario puede seguir luciendo un título que ya no le corresponde, y `onAchievementTap` solo permite "Quitar" desde el logro concreto que coincide exactamente por string (línea 137). No es explotable hoy, pero es deuda de integridad de la vitrina de títulos.
**Arreglo:** al cargar, validar `equipped_title` contra `ACHIEVEMENTS.filter(a => unlocked.has(a.code)).map(a => a.title)` y limpiarlo si no está en la lista; o guardar el `code` del logro en vez del string del título y derivar el texto.

## Mejoras

### PRF-001 · Extraer la share card a su propio componente `ProfileShareCard`
**Qué:** sacar todo el bloque de la share card (líneas 365-391) a `components/ProfileShareCard.tsx` con props tipadas (`profile`, `avatarUri`, `rank`, `level`, `stats`), reenviando el `ref`. Reduce el monolito y permite testear/iterar el diseño aislado. **Dónde:** `(tabs)/perfil.tsx:363-394`. **Impacto:** 4 · **Esfuerzo:** M

### PRF-002 · Extraer el modal de pausa a `FreezeSheet`
**Qué:** mover el `Modal` de pausa (líneas 332-361) a `components/FreezeSheet.tsx` con props `visible/onActivate/onClose` y su estado de motivo/duración encapsulado. **Dónde:** `(tabs)/perfil.tsx:332-361`. **Impacto:** 3 · **Esfuerzo:** M

### PRF-003 · Extraer la válvula de pausa/piedras a `SystemValves`
**Qué:** el bloque "VÁLVULAS DEL SISTEMA" (líneas 234-258) es autónomo; encapsularlo facilita reutilizarlo y reduce ruido en la pantalla. **Dónde:** `(tabs)/perfil.tsx:234-258`. **Impacto:** 3 · **Esfuerzo:** M

### PRF-004 · Extraer la vitrina de logros a `AchievementGrid`
**Qué:** la rejilla de logros + `onAchievementTap` (líneas 129-149, 277-303) merece componente propio con su lógica de equipar título. **Dónde:** `(tabs)/perfil.tsx:277-303`. **Impacto:** 3 · **Esfuerzo:** M

### PRF-005 · Extraer KPIs ("REGISTRO DEL CAZADOR") a `HunterStatsGrid`
**Qué:** la rejilla de 4 KPIs (líneas 305-325) es presentacional pura; sacarla simplifica el render. **Dónde:** `(tabs)/perfil.tsx:305-325`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-006 · Mover `FREEZE_REASONS`/`FREEZE_DAYS` y copys a un módulo de constantes
**Qué:** centralizar literales de pausa (líneas 42-43) junto a la copy del sistema para mantener la voz consistente y permitir i18n futura. **Dónde:** `(tabs)/perfil.tsx:42-43`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-007 · Cerrojo `busy` en `pickAvatar`
**Qué:** guard de reentrada + `finally` para impedir subidas dobles (ver CRIT-PRF-01). **Dónde:** `(tabs)/perfil.tsx:85-105`. **Impacto:** 5 · **Esfuerzo:** S

### PRF-008 · Indicador de "subiendo foto" sobre el hexágono
**Qué:** overlay con `ActivityIndicator` mientras `uploadAvatar` está en curso; hoy no hay feedback y la subida puede tardar. **Dónde:** `(tabs)/perfil.tsx:194-203`. **Impacto:** 4 · **Esfuerzo:** S

### PRF-009 · Renderizar la share card fuera del Modal para capturar fiable
**Qué:** montar la card en una capa absoluta fuera de pantalla y capturarla desde ahí (ver CRIT-PRF-02). **Dónde:** `(tabs)/perfil.tsx:363-373`. **Impacto:** 5 · **Esfuerzo:** M

### PRF-010 · Esperar `onLoad`/prefetch del avatar antes de capturar
**Qué:** `Image.prefetch(avatarUri)` y deshabilitar "Compartir imagen" con spinner hasta que el avatar cargue, evitando hexágono vacío en la imagen. **Dónde:** `(tabs)/perfil.tsx:151-160,368-372`. **Impacto:** 4 · **Esfuerzo:** M

### PRF-011 · `try/catch` en `activateFreeze`/`deactivateFreeze`
**Qué:** capturar errores y alertar como el resto de acciones (ver CRIT-PRF-03). **Dónde:** `(tabs)/perfil.tsx:115-127`. **Impacto:** 4 · **Esfuerzo:** S

### PRF-012 · Guard de desmontaje en `load()`
**Qué:** `let alive = true` + comprobaciones antes de cada `setState` (ver CRIT-PRF-05). **Dónde:** `(tabs)/perfil.tsx:63-83`. **Impacto:** 4 · **Esfuerzo:** S

### PRF-013 · Actualizaciones funcionales de `profile`
**Qué:** pasar las 5 mutaciones a `setProfile(p => …)` para no pisar refrescos (ver CRIT-PRF-06). **Dónde:** `(tabs)/perfil.tsx:100,112,119,126,145`. **Impacto:** 3 · **Esfuerzo:** S

### PRF-014 · Validar `equipped_title` contra logros desbloqueados al cargar
**Qué:** limpiar títulos huérfanos en `load` (ver CRIT-PRF-07). **Dónde:** `(tabs)/perfil.tsx:63-77`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-015 · Mostrar el rango de días efectivo de la pausa
**Qué:** en el modal y en la válvula, indicar "del DD/MM al DD/MM" derivado de `until` (ver CRIT-PRF-04). **Dónde:** `(tabs)/perfil.tsx:249-251,347-356`. **Impacto:** 3 · **Esfuerzo:** S

### PRF-016 · Avisar si ya hay pausa activa antes de abrir otra
**Qué:** deshabilitar/condicionar "Pausar sistema" cuando `frozen`, o confirmar sobrescritura. **Dónde:** `(tabs)/perfil.tsx:255-257`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-017 · Estado de carga real en lugar de pantalla vacía
**Qué:** `if (!profile)` devuelve un `SafeAreaView` vacío (líneas 179-181); mostrar un esqueleto o spinner "Cargando ficha del cazador" para no parpadear en negro. **Dónde:** `(tabs)/perfil.tsx:179-181`. **Impacto:** 4 · **Esfuerzo:** S

### PRF-018 · Estado de error con reintento en `load`
**Qué:** ante fallo de `load`, además del `Alert` ofrecer un botón "Reintentar" en pantalla (hoy queda vacío si nunca llega `profile`). **Dónde:** `(tabs)/perfil.tsx:74-76,179-181`. **Impacto:** 3 · **Esfuerzo:** M

### PRF-019 · `RefreshControl` de "tirar para refrescar"
**Qué:** añadir pull-to-refresh al `ScrollView` (líneas 191) como en Sistema, para reconsultar stats/logros sin cambiar de pestaña. **Dónde:** `(tabs)/perfil.tsx:191`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-020 · Confirmación antes de "Cerrar sesión"
**Qué:** `signOut` (líneas 174-177) cierra sesión sin confirmar; un toque accidental expulsa al usuario. Añadir `Alert` de confirmación. **Dónde:** `(tabs)/perfil.tsx:329`. **Impacto:** 4 · **Esfuerzo:** S

### PRF-021 · Feedback de éxito al exportar datos
**Qué:** `onExport` no informa cuando termina bien (solo en error). Un `Alert`/toast "Datos exportados" cierra el bucle. **Dónde:** `(tabs)/perfil.tsx:162-172`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-022 · `accessibilityRole`/`accessibilityLabel` en el avatar
**Qué:** el `Pressable` del avatar (línea 194) no anuncia su acción; añadir `accessibilityRole="button"` y label "Cambiar foto de perfil". **Dónde:** `(tabs)/perfil.tsx:194`. **Impacto:** 3 · **Esfuerzo:** S

### PRF-023 · Roles de accesibilidad en los logros
**Qué:** cada logro es un `Pressable` (línea 285) sin label; anunciar nombre + estado ("desbloqueado/bloqueado") y rol botón. **Dónde:** `(tabs)/perfil.tsx:285-299`. **Impacto:** 3 · **Esfuerzo:** S

### PRF-024 · Chips de pausa como `radio`/`radiogroup`
**Qué:** los chips de motivo/duración (líneas 341-355) son selección única; exponerlos con `accessibilityRole="radio"` + `accessibilityState={{selected}}`. **Dónde:** `(tabs)/perfil.tsx:340-356`. **Impacto:** 3 · **Esfuerzo:** S

### PRF-025 · `accessibilityLabel` de las barras de estadística
**Qué:** las `XPBar` de stats (línea 268) no comunican valor a lectores; añadir label "FUE: N puntos" en el `statRow`. **Dónde:** `(tabs)/perfil.tsx:265-271`. **Impacto:** 3 · **Esfuerzo:** S

### PRF-026 · `accessibilityRole="header"` en los títulos de ventana
**Qué:** los `windowTitle` (VÁLVULAS, ESTADÍSTICAS, LOGROS, REGISTRO) deberían ser headers para navegación por encabezados. **Dónde:** `(tabs)/perfil.tsx:235,261,278,306`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-027 · Área táctil mínima en los chips
**Qué:** chips con `paddingVertical:8` (estilo `chip`, línea 494) quedan por debajo de 44pt de alto; subir padding o `hitSlop`. **Dónde:** `(tabs)/perfil.tsx:494`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-028 · Contraste del texto tenue sobre fondo
**Qué:** `textFaint (#56698A)` sobre `bg (#060B16)` en hints (líneas 450,455,469) roza el mínimo AA para texto pequeño; verificar y subir a `textDim` donde sea legible-crítico. **Dónde:** `(tabs)/perfil.tsx:450,455,469`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-029 · `numberOfLines` + `ellipsizeMode` en el título equipado
**Qué:** `equippedTitle` (línea 215) puede ser largo y empujar el layout; limitar a 1 línea con elipsis. **Dónde:** `(tabs)/perfil.tsx:214-216`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-030 · `numberOfLines` en el nombre de la ficha y de la share card
**Qué:** `shareName`/`name` no limitan líneas; un nombre de 24 chars en mayúsculas puede desbordar la card. **Dónde:** `(tabs)/perfil.tsx:374,516`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-031 · `maxFontSizeMultiplier` para no romper layout con texto del sistema grande
**Qué:** con accesibilidad de fuente XXL, los números (LV. 34px, KPIs) descuadran; fijar `maxFontSizeMultiplier` en los valores numéricos. **Dónde:** `(tabs)/perfil.tsx:439,472,519`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-032 · QR o handle en la share card para que sea accionable
**Qué:** la card actual no enlaza a nada; añadir un pequeño QR/tagline "Crea tu ficha en NIVL" la hace viral de verdad. **Dónde:** `(tabs)/perfil.tsx:388-390`. **Impacto:** 4 · **Esfuerzo:** M

### PRF-033 · Mostrar logros destacados en la share card
**Qué:** incluir 3 logros/título top en la card aumenta el "flex" y el deseo de compartir. **Dónde:** `(tabs)/perfil.tsx:380-387`. **Impacto:** 3 · **Esfuerzo:** M

### PRF-034 · Fondo/gradiente de rango en la share card
**Qué:** teñir la card según `rank` (E…S) con un acento de color refuerza identidad y progresión. **Dónde:** `(tabs)/perfil.tsx:505-513`. **Impacto:** 3 · **Esfuerzo:** M

### PRF-035 · Resolución de captura fija (1080×1350) para feeds sociales
**Qué:** `captureRef` captura al tamaño de pantalla; forzar dimensiones de la card a un ratio social (4:5) y alta densidad para que no salga pixelada en IG/stories. **Dónde:** `(tabs)/perfil.tsx:153,505-513`. **Impacto:** 3 · **Esfuerzo:** M

### PRF-036 · Texto compartido con `Sharing` ya incluye mensaje
**Qué:** `shareAsync` solo manda la imagen; muchos targets ignoran `dialogTitle`. Considerar copiar al portapapeles un caption ("LV.X · Rango Y · {N} misiones — NIVL"). **Dónde:** `(tabs)/perfil.tsx:154-156`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-037 · Fallback cuando `Sharing.isAvailableAsync()` es falso
**Qué:** si compartir no está disponible (línea 154), no pasa nada y el usuario no entiende por qué; mostrar `Alert` explicativo o guardar a galería. **Dónde:** `(tabs)/perfil.tsx:154`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-038 · Igual fallback en `exportAllData`
**Qué:** mismo caso que PRF-037 en el export (exporter.ts:40); avisar si no hay forma de compartir el JSON. **Dónde:** `(tabs)/perfil.tsx:166`, `exporter.ts:40`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-039 · Barra de progreso "para el siguiente título" en la vitrina
**Qué:** además de logros desbloqueados, mostrar el progreso al próximo título (p. ej. racha 23/30) motiva. **Dónde:** `(tabs)/perfil.tsx:277-303`. **Impacto:** 3 · **Esfuerzo:** L

### PRF-040 · Agrupar/filtrar logros por categoría
**Qué:** 21 logros en rejilla plana; agrupar por familia (misiones/racha/nivel/evidencia/mazmorras/gym/diario) mejora lectura. **Dónde:** `(tabs)/perfil.tsx:281-302`. **Impacto:** 3 · **Esfuerzo:** M

### PRF-041 · Distinguir visualmente logros con título de los normales
**Qué:** hoy solo una etiqueta "título" pequeña (línea 298); un borde dorado en logros con título los hace deseables. **Dónde:** `(tabs)/perfil.tsx:295-298,466-469`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-042 · Indicar el título actualmente equipado dentro de la rejilla
**Qué:** resaltar en la rejilla el logro cuyo título está equipado (marca "equipado") para cerrar el bucle de feedback. **Dónde:** `(tabs)/perfil.tsx:282-301`. **Impacto:** 3 · **Esfuerzo:** S

### PRF-043 · Selector dedicado de títulos en vez de `Alert`
**Qué:** `onAchievementTap` usa `Alert` para equipar (líneas 138-148); un sheet "Tus títulos" con todos los disponibles es más usable que ir logro a logro. **Dónde:** `(tabs)/perfil.tsx:129-149`. **Impacto:** 3 · **Esfuerzo:** M

### PRF-044 · Feedback al equipar/quitar título
**Qué:** tras `updateProfile(equipped_title)` (línea 144) no hay confirmación; un toast/haptic refuerza el cambio. **Dónde:** `(tabs)/perfil.tsx:142-145`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-045 · Haptics en acciones clave (equipar, pausar, compartir)
**Qué:** el resto de la app usa `expo-haptics` (index.tsx:112); Perfil no da ninguno. Añadir feedback táctil en equipar título, activar pausa y compartir. **Dónde:** `(tabs)/perfil.tsx:118,144,151`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-046 · Tooltip/desc al tocar un logro bloqueado
**Qué:** `onAchievementTap` retorna sin más si el logro no está desbloqueado (línea 132); mostrar la descripción + criterio ("Te faltan X") da rumbo. **Dónde:** `(tabs)/perfil.tsx:129-132`. **Impacto:** 3 · **Esfuerzo:** S

### PRF-047 · Mostrar fecha de desbloqueo de cada logro
**Qué:** `achievements` guarda `unlocked_at` (types.ts:154-159); enseñarlo en el detalle del logro añade nostalgia/registro. **Dónde:** `(tabs)/perfil.tsx:133-136`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-048 · Contador de progreso global de logros con barra
**Qué:** el título "LOGROS · n/21" (líneas 278-280) podría llevar una `XPBar` con el ratio para visualizar completitud. **Dónde:** `(tabs)/perfil.tsx:277-280`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-049 · Texto de piedras a 0 con copy distinta
**Qué:** "Piedras: 0/3" (línea 239) se lee igual que tenerlas; cuando es 0, una copy ("Sin piedras: el próximo fallo penaliza") aclara el riesgo. **Dónde:** `(tabs)/perfil.tsx:238-240`. **Impacto:** 3 · **Esfuerzo:** S

### PRF-050 · Visualizar las piedras como iconos en vez de "n/3"
**Qué:** pintar 3 escudos (llenos/vacíos) en lugar del texto comunica mejor el recurso. **Dónde:** `(tabs)/perfil.tsx:236-241`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-051 · Días restantes de pausa en la válvula
**Qué:** cuando `frozen`, además de "hasta {fecha}" (línea 250) mostrar "(N días restantes)" calculado desde hoy. **Dónde:** `(tabs)/perfil.tsx:248-251`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-052 · Confirmar antes de reanudar el sistema
**Qué:** "Reanudar el sistema" (línea 253) es destructivo (vuelven las penalizaciones); pedir confirmación. **Dónde:** `(tabs)/perfil.tsx:253`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-053 · Formatear `freeze_until` a fecha legible
**Qué:** se muestra el ISO crudo `2026-06-20` (línea 250); usar `formatLongDate`/`DD/MM` para humanizarlo. **Dónde:** `(tabs)/perfil.tsx:250`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-054 · Duración de pausa personalizable
**Qué:** además de [1,3,7,14] (línea 43) permitir elegir una fecha fin concreta (date picker) para viajes largos. **Dónde:** `(tabs)/perfil.tsx:43,347-356`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-055 · Motivo de pausa libre
**Qué:** los motivos son fijos (línea 42); permitir uno propio cubre casos no contemplados. **Dónde:** `(tabs)/perfil.tsx:42,340-346`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-056 · `keyboardShouldPersistTaps` y scroll en el modal de pausa
**Qué:** el sheet no es desplazable; con teclado o pantallas bajas los chips/botones pueden quedar tapados. Envolver en `ScrollView`. **Dónde:** `(tabs)/perfil.tsx:333-359`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-057 · `KeyboardAvoidingView` para el `TextInput` del nombre
**Qué:** al editar el nombre (línea 205) el teclado puede tapar el campo en dispositivos pequeños; el campo está arriba, pero conviene en general. **Dónde:** `(tabs)/perfil.tsx:191,205`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-058 · Indicar visualmente que el nombre es editable
**Qué:** el `TextInput` parece texto estático (solo borde inferior, línea 206); un icono de lápiz comunica la edición. **Dónde:** `(tabs)/perfil.tsx:205-213`. **Impacto:** 3 · **Esfuerzo:** S

### PRF-059 · Validar nombre vacío con feedback
**Qué:** `saveName` ignora silenciosamente un nombre vacío (línea 110) y el campo queda en blanco; restaurar el anterior o avisar. **Dónde:** `(tabs)/perfil.tsx:107-113`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-060 · Restaurar el nombre en el campo si se cancela la edición
**Qué:** si el usuario borra y desenfoca, `name` (estado) queda vacío aunque `profile.name` no cambie; resincronizar `name` con `profile.name` cuando no se guarda. **Dónde:** `(tabs)/perfil.tsx:107-113,207`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-061 · `saveName` solo en `onBlur` (evitar doble disparo con `onSubmitEditing`)
**Qué:** `onBlur` y `onSubmitEditing` (líneas 209-210) llaman ambos a `saveName`; aunque el guard `=== profile.name` lo mitiga, dejar uno solo es más limpio. **Dónde:** `(tabs)/perfil.tsx:209-210`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-062 · `autoCapitalize`/`autoCorrect` en el nombre
**Qué:** el `TextInput` no configura capitalización; para nombres conviene `autoCapitalize="words"` y `autoCorrect={false}`. **Dónde:** `(tabs)/perfil.tsx:205-213`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-063 · Recortar/normalizar avatar a tamaño máximo antes de subir
**Qué:** `pickAvatar` usa `quality:0.5` pero no limita dimensiones (líneas 87-93); imágenes enormes inflan Storage. Redimensionar con `expo-image-manipulator`. **Dónde:** `(tabs)/perfil.tsx:87-93`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-064 · Permitir quitar el avatar (volver a la inicial)
**Qué:** no hay forma de borrar la foto una vez puesta; añadir "Quitar foto" que ponga `avatar_url:null`. **Dónde:** `(tabs)/perfil.tsx:85-105`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-065 · Manejar permiso denegado de galería
**Qué:** `launchImageLibraryAsync` no comprueba permisos (líneas 87-93); en denegación el usuario no recibe explicación (a diferencia de la cámara en Sistema). **Dónde:** `(tabs)/perfil.tsx:87-93`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-066 · Cachear/optimizar `signedUrl` del avatar
**Qué:** cada `load` (cada foco) re-firma la URL del avatar (línea 72) con TTL de 7 días; podría cachearse y no re-pedirse en cada foco. **Dónde:** `(tabs)/perfil.tsx:71-73`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-067 · `recyclingKey`/`cachePolicy` en `expo-image`
**Qué:** el avatar (línea 197) no fija `cachePolicy`; con `cachePolicy="memory-disk"` evita recargas y parpadeos al refrescar. **Dónde:** `(tabs)/perfil.tsx:197,369`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-068 · `placeholder`/transición en la carga del avatar
**Qué:** mientras carga el avatar remoto se ve la inicial y luego salta a la imagen; usar `transition`/`placeholder` de expo-image suaviza. **Dónde:** `(tabs)/perfil.tsx:196-200`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-069 · Memoizar derivados costosos (`maxStatXp`, `evidencePct`, `lvl`, `rank`)
**Qué:** se recalculan en cada render (líneas 183-187); `useMemo` los estabiliza, sobre todo si la pantalla se modulariza. **Dónde:** `(tabs)/perfil.tsx:183-187`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-070 · `maxStatXp` puede dar barras todas llenas con XP bajo
**Qué:** `Math.max(100, ...statsXp)` (línea 185) normaliza al máximo stat; si un stat domina, los demás se ven minúsculos y el que manda, lleno. Plantear escala absoluta (p. ej. siguiente "punto") por stat. **Dónde:** `(tabs)/perfil.tsx:185,268`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-071 · Mostrar XP exacto de cada stat, no solo puntos
**Qué:** `statPoints` muestra enteros (línea 270); añadir "(NN/100)" hacia el próximo punto da granularidad. **Dónde:** `(tabs)/perfil.tsx:270`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-072 · Nombre completo del stat además de la abreviatura
**Qué:** "FUE/VIT/INT/AGI/PER" (línea 266) puede no ser obvio; `STAT_LABEL` (game.ts:23) permite mostrar "Fuerza" en detalle o accesibilidad. **Dónde:** `(tabs)/perfil.tsx:266`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-073 · Radar/hexágono de stats
**Qué:** un gráfico de radar de los 5 stats (en vez de 5 barras) es más "Solo Leveling" y vistoso, alineado con el sello hexagonal. **Dónde:** `(tabs)/perfil.tsx:260-275`. **Impacto:** 3 · **Esfuerzo:** L

### PRF-074 · Animar las barras de stat/XP al cargar
**Qué:** las `XPBar` son estáticas; animar el llenado al entrar refuerza el progreso. **Dónde:** `(tabs)/perfil.tsx:225,268`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-075 · Mostrar el porcentaje de progreso de nivel junto a la barra
**Qué:** además de "into/next XP" (línea 228) un "%" rápido ayuda a leer el avance. **Dónde:** `(tabs)/perfil.tsx:226-230`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-076 · Estado especial de NIVEL MÁXIMO
**Qué:** al llegar a 999 se muestra "NIVEL MÁXIMO ALCANZADO" (línea 229) pero la barra queda llena sin distinción; añadir un acento (dorado/animación) para celebrarlo. **Dónde:** `(tabs)/perfil.tsx:224-230`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-077 · Mostrar el siguiente rango y cuánto falta
**Qué:** la ficha muestra el rango actual (línea 217) pero no el umbral del siguiente; "Rango D en LV.11" motiva. **Dónde:** `(tabs)/perfil.tsx:217`. **Impacto:** 3 · **Esfuerzo:** M

### PRF-078 · Tendencia de racha (mejor racha histórica)
**Qué:** se muestra racha actual (línea 317) pero no la mejor histórica; un KPI "récord de racha" añade orgullo. **Dónde:** `(tabs)/perfil.tsx:316-319`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-079 · KPI de mazmorras despejadas / PRs / entradas de diario
**Qué:** el registro solo cubre misiones/evidencia/racha/multiplicador (líneas 307-324); añadir contadores de otras mecánicas da visión completa. **Dónde:** `(tabs)/perfil.tsx:307-324`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-080 · Etiqueta de unidades/contexto en KPIs
**Qué:** "×{mult}" y "%" (líneas 313,321) se entienden, pero "Multiplicador XP" sin contexto de cómo crece (racha) podría enlazar a explicación. **Dónde:** `(tabs)/perfil.tsx:320-322`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-081 · Tooltip explicando la racha y el multiplicador
**Qué:** un `?` que abra la regla "+0,1 por semana, máx ×1,5" educa al usuario. **Dónde:** `(tabs)/perfil.tsx:320-323`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-082 · Evitar `%` con división por cero ya cubierto, pero documentar `evidencePct`
**Qué:** `evidencePct` ya protege `total>0` (línea 186); añadir test de borde y comentario para que no regrese. **Dónde:** `(tabs)/perfil.tsx:186`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-083 · `completionStats` hace 2 consultas count: combinarlas
**Qué:** `completionStats` (data.ts:76-85) lanza dos `count`; podría ser una sola consulta agregada para reducir latencia del `load`. **Dónde:** `(tabs)/perfil.tsx:69`, `data.ts:76-85`. **Impacto:** 1 · **Esfuerzo:** M

### PRF-084 · Paralelizar las llamadas de `load`
**Qué:** `completionStats`/`fetchUnlocked`/`signedUrl` se hacen en serie (líneas 69-73); `Promise.all` reduce el tiempo de carga. **Dónde:** `(tabs)/perfil.tsx:66-73`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-085 · Suspense/skeleton por sección
**Qué:** mostrar las ventanas con placeholders mientras llegan stats/logros, en vez de bloquear toda la pantalla hasta tener `profile`. **Dónde:** `(tabs)/perfil.tsx:179-181`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-086 · `testID` en elementos clave para tests E2E
**Qué:** avatar, input de nombre, botones de pausa/compartir/exportar no tienen `testID`; añadirlos habilita pruebas automatizadas. **Dónde:** `(tabs)/perfil.tsx:194,205,327-329`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-087 · Test unitario de `frozen` (límite `freeze_until == today`)
**Qué:** `frozen = freeze_until != null && >= today` (línea 187); cubrir con test el caso igualdad y `null`. **Dónde:** `(tabs)/perfil.tsx:187`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-088 · Test de `evidencePct` redondeo
**Qué:** verificar `Math.round` en bordes (1/3 → 33%, 2/3 → 67%). **Dónde:** `(tabs)/perfil.tsx:186`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-089 · Extraer lógica de `activateFreeze` (cálculo de `until`) a función pura testeable
**Qué:** mover `addDays(today, freezeDays-1)` (línea 117) a un helper `freezeRange(today, days)` con tests, evitando off-by-one. **Dónde:** `(tabs)/perfil.tsx:117`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-090 · Test de `onAchievementTap` (equipar/quitar/bloqueado)
**Qué:** la rama de equipar/quitar título (líneas 129-149) merece test de la transición `equipped_title`. **Dónde:** `(tabs)/perfil.tsx:129-149`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-091 · Inicial del avatar segura ante nombre vacío
**Qué:** `profile.name.charAt(0).toUpperCase()` (líneas 199,371) da '' si el nombre está vacío (la inicial desaparece); usar fallback ('?'/'N'). **Dónde:** `(tabs)/perfil.tsx:199,371`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-092 · Soportar inicial multibyte (emoji/acentos) en el avatar
**Qué:** `charAt(0)` rompe pares surrogate (un nombre que empiece por emoji muestra medio glifo); usar `[...name][0]`. **Dónde:** `(tabs)/perfil.tsx:199,371`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-093 · `equipped_title.toUpperCase()` con locale español
**Qué:** mayúsculas de títulos (líneas 215,376) podrían usar `toLocaleUpperCase('es-ES')` por consistencia con caracteres especiales. **Dónde:** `(tabs)/perfil.tsx:215,376`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-094 · Unificar el render de identidad ficha/Sistema
**Qué:** la cabecera de perfil (líneas 204-222) y la de Sistema (index.tsx:210-226) duplican lógica nombre/rango/nivel; un componente `HunterHeader` compartido evita divergencias. **Dónde:** `(tabs)/perfil.tsx:204-222`. **Impacto:** 3 · **Esfuerzo:** M

### PRF-095 · Consistencia del avatar: imagen en Perfil pero solo inicial en Sistema
**Qué:** Sistema muestra siempre la inicial (index.tsx:211-213) aunque haya foto; Perfil sí muestra la foto. Unificar para que el avatar real aparezca en ambos. **Dónde:** `(tabs)/perfil.tsx:195-201`. **Impacto:** 3 · **Esfuerzo:** M

### PRF-096 · Consistencia del orden rango/título en la cabecera
**Qué:** Perfil muestra título arriba y "CAZADOR · RANGO" debajo (líneas 214-217); Sistema mezcla título+rango en una línea (index.tsx:216-220). Alinear el patrón. **Dónde:** `(tabs)/perfil.tsx:214-217`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-097 · Tamaño del avatar de la share card vs hexágono
**Qué:** `Hexagon size={84}` con `shareAvatar 58×58` (líneas 367,515) deja holgura; en la ficha es 92 con 64 (línea 195,404). Revisar proporción para que la foto llene mejor el hexágono. **Dónde:** `(tabs)/perfil.tsx:367,515`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-098 · La foto no recorta a forma de hexágono
**Qué:** el avatar es un círculo (`borderRadius:32`, línea 404) dentro de un hexágono; recortar a hexágono real (clip SVG/máscara) sería más coherente con el sello visual. **Dónde:** `(tabs)/perfil.tsx:404,515`. **Impacto:** 2 · **Esfuerzo:** L

### PRF-099 · Separadores/jerarquía entre acciones de cuenta
**Qué:** "Compartir/Exportar/Cerrar sesión" (líneas 327-329) van seguidos sin agrupar; separar "cuenta" de "compartir" con un divisor o sección mejora jerarquía. **Dónde:** `(tabs)/perfil.tsx:327-329`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-100 · Iconos en los botones de acción
**Qué:** los `SystemButton` de acción son solo texto; un icono (share/download/logout) acelera el reconocimiento. **Dónde:** `(tabs)/perfil.tsx:327-329`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-101 · Acción "Compartir perfil" duplica función con "Compartir imagen"
**Qué:** "Compartir perfil" abre el modal (línea 327) y dentro "Compartir imagen" hace la captura (línea 392); el doble paso es fricción. Permitir compartir directo desde el botón principal. **Dónde:** `(tabs)/perfil.tsx:327,392`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-102 · Vista previa de la share card sin abrir modal
**Qué:** mostrar una miniatura de la card en la pantalla (no solo en el modal) invita a compartir. **Dónde:** `(tabs)/perfil.tsx:305-325`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-103 · Cerrar el modal de compartir tras compartir con éxito
**Qué:** tras `shareAsync` (línea 155) el modal sigue abierto; cerrarlo (o dejar elegir) cierra el flujo. **Dónde:** `(tabs)/perfil.tsx:151-160`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-104 · Texto alternativo/descripción del estado vacío de logros
**Qué:** si no hay logros desbloqueados, la rejilla se ve toda gris sin explicación; un texto "Completa misiones para desbloquear" anima. **Dónde:** `(tabs)/perfil.tsx:281-302`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-105 · Animación de desbloqueo de logro en la vitrina
**Qué:** los logros aparecen ya desbloqueados sin transición; un brillo al abrir la pestaña tras desbloquear uno nuevo refuerza la recompensa. **Dónde:** `(tabs)/perfil.tsx:282-301`. **Impacto:** 2 · **Esfuerzo:** L

### PRF-106 · Marcar logros "nuevos" no vistos
**Qué:** un badge "nuevo" sobre logros desbloqueados desde la última visita crea retorno. **Dónde:** `(tabs)/perfil.tsx:282-301`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-107 · Subtítulo/voz del sistema en la cabecera de Perfil
**Qué:** las demás pantallas usan la "voz del sistema"; Perfil no tiene copy de bienvenida. Un microcopy ("Ficha del cazador") da identidad. **Dónde:** `(tabs)/perfil.tsx:192-232`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-108 · Padding inferior insuficiente con 3 botones de acción
**Qué:** `paddingBottom:32` (estilo `content`, línea 402) puede dejar el último botón pegado a la tab bar en pantallas bajas; aumentar o usar safe-area inferior. **Dónde:** `(tabs)/perfil.tsx:402`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-109 · `SafeAreaView edges` no cubre el borde inferior
**Qué:** `edges={['top']}` (línea 190) ignora el inferior; en dispositivos con gesture bar el contenido del scroll puede quedar tras ella. **Dónde:** `(tabs)/perfil.tsx:190`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-110 · El backdrop del sheet de pausa no cierra al tocar fuera
**Qué:** el `backdrop` (líneas 333-360) no es `Pressable`; tocar fuera no cierra el modal (solo "Cancelar" o back). Añadir cierre por toque en el backdrop. **Dónde:** `(tabs)/perfil.tsx:332-360`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-111 · El backdrop de compartir tampoco cierra al tocar fuera
**Qué:** mismo caso en `shareBackdrop` (líneas 364-394). **Dónde:** `(tabs)/perfil.tsx:363-394`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-112 · `Modal` sin `statusBarTranslucent`
**Qué:** en Android el modal puede no cubrir la status bar; añadir `statusBarTranslucent` para un sheet a pantalla completa coherente. **Dónde:** `(tabs)/perfil.tsx:332,363`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-113 · Animación de entrada del sheet vs preferencias de reduce-motion
**Qué:** `animationType="slide"/"fade"` (líneas 332,363) no respeta "reducir movimiento"; condicionar a `AccessibilityInfo.isReduceMotionEnabled`. **Dónde:** `(tabs)/perfil.tsx:332,363`. **Impacto:** 1 · **Esfuerzo:** M

### PRF-114 · Foco de accesibilidad al abrir los modales
**Qué:** al abrir el sheet no se mueve el foco del lector al título; usar `accessibilityViewIsModal` y enfocar el `sheetTitle`. **Dónde:** `(tabs)/perfil.tsx:333-335,364-366`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-115 · `accessibilityState` en chips seleccionados
**Qué:** los chips activos solo cambian color (líneas 342,350); exponer `selected` para lectores. **Dónde:** `(tabs)/perfil.tsx:342,350`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-116 · Contraste del `chipText` no seleccionado
**Qué:** `chipText` usa `textDim` sobre panel (línea 496); validar contraste y estado deshabilitado/seleccionado. **Dónde:** `(tabs)/perfil.tsx:496`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-117 · Tamaño de toque de "Cambiar foto"
**Qué:** el texto "Cambiar foto" (línea 202) está dentro del `Pressable` del avatar pero es pequeño; asegurar que toda el área (hex + texto) sea tocable y ≥44pt. **Dónde:** `(tabs)/perfil.tsx:202`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-118 · Deshabilitar acciones mientras `busy`
**Qué:** durante el export (`busy`, línea 328) los demás botones (compartir/cerrar sesión) siguen activos; considerar bloquearlos para evitar acciones concurrentes. **Dónde:** `(tabs)/perfil.tsx:327-329`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-119 · Indicador de progreso del export (puede tardar)
**Qué:** `exportAllData` recorre 15 tablas (exporter.ts:5-21); además del `loading` del botón, un texto "Exportando…" calma la espera. **Dónde:** `(tabs)/perfil.tsx:328`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-120 · Confirmar el tamaño/recuento del export al usuario
**Qué:** tras exportar, indicar cuántos registros/qué se incluyó (las evidencias no, exporter.ts:24) gestiona expectativas. **Dónde:** `(tabs)/perfil.tsx:162-172`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-121 · Borrar ficheros de export temporales
**Qué:** `exportAllData` escribe en cache (exporter.ts:37) y no limpia; con uso repetido se acumulan. Limpiar tras compartir. **Dónde:** `exporter.ts:37-45`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-122 · Borrar la imagen temporal tras compartir el perfil
**Qué:** `captureRef` (línea 153) genera un PNG temporal que no se elimina; limpiar tras `shareAsync`. **Dónde:** `(tabs)/perfil.tsx:153-156`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-123 · Opción de "Eliminar cuenta / borrar todos mis datos"
**Qué:** existe export pero no borrado; por privacidad (un solo usuario, datos personales) conviene una acción de wipe con confirmación fuerte. **Dónde:** `(tabs)/perfil.tsx:327-329`. **Impacto:** 3 · **Esfuerzo:** L

### PRF-124 · Mostrar el email/identidad de la sesión
**Qué:** `useAuth` expone `session.user` (auth.tsx); mostrar el email logado da contexto antes de "Cerrar sesión". **Dónde:** `(tabs)/perfil.tsx:46,329`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-125 · Versión de la app / build en el pie del perfil
**Qué:** un pequeño "NIVL vX (build Y)" al final ayuda a soporte y da remate al perfil. **Dónde:** `(tabs)/perfil.tsx:326-329`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-126 · Enlace a ajustes de notificaciones
**Qué:** la app usa notificaciones (`notifications.ts`); un acceso desde Perfil para activarlas/silenciarlas tendría sentido. **Dónde:** `(tabs)/perfil.tsx:234-258`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-127 · Fecha de "cazador desde" (created_at)
**Qué:** `profile.created_at` (types.ts:23) existe; mostrar "Cazador desde {fecha}" añade pertenencia. **Dónde:** `(tabs)/perfil.tsx:204-222`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-128 · Internacionalizar/centralizar todos los literales de la pantalla
**Qué:** la pantalla tiene muchos textos hardcodeados (títulos de ventana, copys de pausa, hints); centralizarlos prepara i18n y mantiene la voz coherente. **Dónde:** `(tabs)/perfil.tsx` (todo el render). **Impacto:** 2 · **Esfuerzo:** M

### PRF-129 · Reordenar/colapsar secciones largas (logros) con "ver todo"
**Qué:** con 21 logros la sección es alta; mostrar 6 y un "ver todos" reduce scroll en la primera vista. **Dónde:** `(tabs)/perfil.tsx:277-303`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-130 · Sombras/acento de profundidad en las `SystemWindow` del perfil
**Qué:** todas las ventanas usan el mismo `cyanDim` plano; variar acento (p. ej. dorado en logros con título) crea jerarquía visual. **Dónde:** `(tabs)/perfil.tsx:192,234,260,277,305`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-131 · Evitar que el `TextInput` del nombre pierda el valor al refrescar
**Qué:** `load` hace `setName(prof.name)` en cada foco (línea 68); si el usuario está editando y la pantalla recarga, se le sobrescribe lo tecleado. Solo re-set si el campo no está enfocado/dirty. **Dónde:** `(tabs)/perfil.tsx:68`. **Impacto:** 3 · **Esfuerzo:** S

### PRF-132 · `returnKeyType` y teclado adecuado del nombre
**Qué:** ya usa `returnKeyType="done"` (línea 211); revisar `keyboardType="default"` y `blurOnSubmit` para cerrar bien tras guardar. **Dónde:** `(tabs)/perfil.tsx:211`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-133 · Anunciar cambios de estado (pausa activada) a lectores
**Qué:** al activar/desactivar pausa no hay `AccessibilityInfo.announceForAccessibility`; anunciar "Sistema en pausa hasta X" mejora accesibilidad. **Dónde:** `(tabs)/perfil.tsx:118,125`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-134 · Mostrar cuántas piedras faltan para la siguiente
**Qué:** junto a "Piedras n/3" (línea 239) indicar "siguiente en N días de racha" usando `STONE_EVERY_STREAK_DAYS`. **Dónde:** `(tabs)/perfil.tsx:238-243`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-135 · Color de la barra de stat por stat (identidad por atributo)
**Qué:** todas las `XPBar` de stats usan el cian por defecto (línea 268); un color por stat (FUE rojo, INT azul…) mejora lectura y estética. **Dónde:** `(tabs)/perfil.tsx:267-269`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-136 · Evitar recomputar `today` en cada render
**Qué:** `const today = dateKey()` (línea 61) corre en cada render; con la pantalla modularizada conviene memoizar o derivar una vez. **Dónde:** `(tabs)/perfil.tsx:61`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-137 · `keyExtractor` estable y `FlatList` para la rejilla de logros
**Qué:** la rejilla mapea 21 `Pressable` en un `View` (líneas 282-301); con futuras ampliaciones conviene virtualizar o al menos memoizar cada celda. **Dónde:** `(tabs)/perfil.tsx:281-302`. **Impacto:** 1 · **Esfuerzo:** M

### PRF-138 · Memoizar celdas de logro (`React.memo`)
**Qué:** cada celda recibe closures nuevas (`onPress`); extraer `AchievementCell` memoizado evita re-render de las 21 al cambiar cualquier estado. **Dónde:** `(tabs)/perfil.tsx:282-301`. **Impacto:** 1 · **Esfuerzo:** M

### PRF-139 · Manejo de `avatarUri` null tras fallo de `signedUrl`
**Qué:** `signedUrl` puede devolver `null` (data.ts:121); si falla, `avatarUri` queda null y se muestra la inicial aunque haya foto, sin avisar. Reintentar o indicar "no se pudo cargar la foto". **Dónde:** `(tabs)/perfil.tsx:71-73`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-140 · No re-pedir `signedUrl` si `avatar_url` no cambió
**Qué:** comparar el `avatar_url` actual con el ya firmado para no regenerar la URL en cada foco. **Dónde:** `(tabs)/perfil.tsx:71-73`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-141 · Mensajería de error específica por acción
**Qué:** todos los `catch` usan el mismo "Error del sistema" genérico (líneas 75,103,158,168); mensajes por contexto (subir foto, pausar, compartir) ayudan a diagnosticar. **Dónde:** `(tabs)/perfil.tsx:75,103,158,168`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-142 · Reutilizar la inicial/avatar en un único helper
**Qué:** la lógica "imagen o inicial" se repite en ficha (195-200) y card (368-372); un componente `Avatar` único elimina duplicación. **Dónde:** `(tabs)/perfil.tsx:195-200,368-372`. **Impacto:** 2 · **Esfuerzo:** S

### PRF-143 · Mostrar bonus de evidencia en el KPI "Con evidencia"
**Qué:** "evidencePct%" (línea 313) es informativo; enlazarlo a "+25% XP por evidencia" educa sobre la mecánica. **Dónde:** `(tabs)/perfil.tsx:312-315`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-144 · Estado de "sin conexión" al cargar
**Qué:** si no hay red, `load` falla con `Alert` y la pantalla queda vacía; detectar offline y mostrar un estado dedicado con reintento. **Dónde:** `(tabs)/perfil.tsx:63-77`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-145 · Persistir el `profile` en caché local para arranque instantáneo
**Qué:** mostrar el último `profile` cacheado (AsyncStorage) mientras `load` refresca evita la pantalla en negro inicial. **Dónde:** `(tabs)/perfil.tsx:50,179-181`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-146 · Animación/contador al actualizar XP o nivel en la ficha
**Qué:** al volver a Perfil tras ganar XP, los números cambian sin transición; un count-up sutil refuerza el progreso. **Dónde:** `(tabs)/perfil.tsx:220,225`. **Impacto:** 1 · **Esfuerzo:** M

### PRF-147 · Distinguir el `SystemButton` "Compartir perfil" como acción primaria
**Qué:** es `solid` por defecto (línea 327) frente a los `outline`; reforzar con icono/posición para destacar la acción social principal. **Dónde:** `(tabs)/perfil.tsx:327`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-148 · Comprobar permisos de notificación/recordatorio de pausa al reanudar
**Qué:** al reanudar el sistema (línea 123) podría reactivar recordatorios silenciados durante la pausa; coordinar con `notifications.ts`. **Dónde:** `(tabs)/perfil.tsx:123-127`. **Impacto:** 2 · **Esfuerzo:** M

### PRF-149 · Limitar `maxLength` también en la share card si el nombre se trunca
**Qué:** el nombre se limita a 24 (línea 212) pero en mayúsculas en la card (línea 374) puede seguir siendo ancho; medir y ajustar `adjustsFontSizeToFit`. **Dónde:** `(tabs)/perfil.tsx:374`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-150 · `adjustsFontSizeToFit` en valores numéricos grandes
**Qué:** "LV. {n}" (línea 220, fuente 34) y los KPIs pueden desbordar con valores de 3 dígitos o fuentes grandes; permitir autoescala. **Dónde:** `(tabs)/perfil.tsx:220,472`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-151 · Tests de snapshot de la share card
**Qué:** una vez extraída (PRF-001), un snapshot test asegura que cambios de estilo no rompen el layout viral. **Dónde:** `(tabs)/perfil.tsx:365-391`. **Impacto:** 1 · **Esfuerzo:** M

### PRF-152 · Documentar el contrato de pausa en código
**Qué:** añadir comentario en `activateFreeze` explicando qué cierres cubre `until` (alinea con CRIT-PRF-04 y evita regresiones). **Dónde:** `(tabs)/perfil.tsx:115-121`. **Impacto:** 1 · **Esfuerzo:** S

### PRF-153 · Evitar `FREEZE_REASONS[0]!`/`FREEZE_DAYS` no-null assertion
**Qué:** `useState(FREEZE_REASONS[0]!)` (línea 56) usa `!`; con `as const` en los arrays se evita la aserción y se gana seguridad de tipos. **Dónde:** `(tabs)/perfil.tsx:42-43,56`. **Impacto:** 1 · **Esfuerzo:** S

Total: 153 mejoras, 7 bugs.
