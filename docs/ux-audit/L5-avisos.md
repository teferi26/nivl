# L5 · C. El diccionario de avisos

Chat 4 (Experiencia), 2026-10-03. Base: rama `winter2/chat4-experiencia` @8e05aec.

Voz del sistema en un aviso: arena, firme y adulta. Constata y señala la puerta. Sin amenazas, sin urgencia, sin culpa, sin desprecio, sin «—» ni «–», títulos de campañas entre «» (nunca `"…"`), concordancia de número correcta y nada en la pantalla de bloqueo que no quieras que lea otro (ni «cuerpo» ni «peso»).

## 1. Inventario de hoy (antes de este cambio)

Líneas de `HEAD` (8e05aec).

### Cliente: avisos locales

| Archivo:línea | Dónde sale | Texto |
|---|---|---|
| `src/lib/notifications.ts:193` | despertador, título | Arriba, gladiador |
| `src/lib/voice.ts:72-74` (`morningNotif`) | despertador, cuerpo | El sistema ha asignado tus misiones de hoy. Complétalas antes de medianoche. · Nuevas misiones disponibles. El día es una campaña: entra primero. · Tus misiones esperan. Cada una completada te acerca al siguiente rango. |
| `src/lib/notifications.ts:245` | bloque del plan, título | `{hh:mm} · {título del bloque}` |
| `src/lib/notifications.ts:248` | bloque del plan, cuerpo de respaldo | El sistema espera ejecución. |
| `src/lib/notifications.ts:269` | cierre, título | El cierre del día se acerca |
| `src/lib/voice.ts:78-80` (`eveningNotif`) | cierre, cuerpo | Quedan pocas horas. Las misiones incompletas serán penalizadas a medianoche. · El cierre se acerca. Revisa tus misiones pendientes. · Última llamada del sistema: completa lo pendiente antes del cierre. |
| `src/lib/useNotificationRouting.ts:39-40` | «Posponer 10 min», respaldo | El sistema insiste / Sigue pendiente. |
| `src/lib/notifications.ts:94, 102, 108, 113` | canales de Android | Despertador · Bloques del día · Cierre del día · El sistema |
| `src/lib/notifications.ts:123, 124, 127` | botones | Hecho · Posponer 10 min · Reportar |
| `src/lib/notifyPlan.ts` | racha, recuperación, duelo, foto, rango, vuelta | Sin copy (`titulo` vacío a propósito): lo pone el Chat 4. |

### Cliente: banco de `voice.ts` que se ve dentro de la app

| Archivo:línea | Línea | Uso |
|---|---|---|
| `voice.ts:47` (`levelUp`) | Los débiles esperan. Tú avanzas. | sin uso hoy |
| `voice.ts:51-53` (`penaltyApplied`) | El sistema ha aplicado −{xp} XP. La misión de penalización espera. · Fallo registrado: −{xp} XP. Redímete hoy o la pérdida será permanente. · −{xp} XP. El sistema no olvida, pero ofrece redención. | sin uso hoy (`derivarHoy.ts:167` la evita por amenazar) |
| `voice.ts:67` (`frozen`) | Sistema en pausa ({motivo}). Sin misiones, sin penalizaciones, sin juicio. | Hoy, Perfil |
| `voice.ts:84-85` (`dungeonCleared`) | Campaña "{título}" despejada. El botín es tuyo. · "{título}" ha caído. El sistema registra tu victoria. | `CampanaVista.tsx:55` |
| `voice.ts:114` (`streakHype`, 3-6 días) | {n} días seguidos. La cadena crece. Que no seas tú quien la rompa. | Perfil |
| `voice.ts:131` (`streakHype`, 30+) | {n} días. Los rangos S se construyen así: un día más, cada día. Imparable. | Perfil |

### Servidor: `supabase/functions/ritual/handler.ts` (solo lectura, es de otro chat)

| Línea | Push | Título | Cuerpo | `data.ruta` |
|---|---|---|---|---|
| 614 | cierre mensual | Cierre del mes | titular del texto del coach (`titular`, l. 124-160) | `/(tabs)/coach` |
| 627 | revisión semanal | Revisión de la semana | titular | `/(tabs)/coach` |
| 639 | brief diario | Órdenes del día | titular | `/(tabs)` |
| 660 | escalada (4 días sin escribir) | El sistema te espera | titular | `/(tabs)/coach` |
| 776-777 | cierre mensual con pase de fotos | Tu mes en imágenes | `{n} fotos. El sistema ha montado el pase y cerrado el mes: toca para verlo.` | `/resumen` |
| 781 | respaldo del titular | (el de la decisión) | El sistema tiene algo para ti. | (el de la decisión) |
| 554 | checkin (L6) | El sistema | la pregunta del coach (`limpiarCheckin`) | `/(tabs)/coach` |
| 210, 219 | moderación (solo owners) | Moderación | `{nuevos} denuncias o revisiones nuevas · {abiertos} abiertas` | ninguna |

## 2. Lo que incumple la voz

| Dónde | Texto | Fallo |
|---|---|---|
| `voice.ts:78` | …serán penalizadas a medianoche. | amenaza |
| `voice.ts:80` | Última llamada del sistema… | urgencia |
| `voice.ts:72` | Complétalas antes de medianoche. | urgencia (leve) |
| `voice.ts:52` | Redímete hoy o la pérdida será permanente. | amenaza y culpa |
| `voice.ts:53` | El sistema no olvida… | amenaza |
| `voice.ts:51` | La misión de penalización espera. | culpa; el juego la llama recuperación |
| `voice.ts:47` | Los débiles esperan. | desprecio |
| `voice.ts:114` | Que no seas tú quien la rompa. | culpa anticipada |
| `voice.ts:131` | Los rangos S… Imparable. | marca antigua (Solo Leveling); los rangos son Tiro, Gladiador, Veterano, Campeón, Héroe de la arena y Leyenda |
| `voice.ts:67` | sin penalizaciones | vocabulario de castigo |
| `voice.ts:84-85` | "{título}" | comillas rectas; van «» |
| `notifications.ts:248` | El sistema espera ejecución. | orden seca, sin información |
| `useNotificationRouting.ts:39` | El sistema insiste | presión |
| `ritual/handler.ts:660` | El sistema te espera | culpa por silencio; quien escribe es el coach |
| `ritual/handler.ts:554` | El sistema | no dice qué es |
| `ritual/handler.ts:777` | {n} fotos | «1 fotos» |
| `ritual/handler.ts:210` | {n} denuncias o revisiones nuevas · {m} abiertas | «1 denuncias… 1 abiertas» |
| `ritual/handler.ts:124-160` | titular | el recorte de respaldo (`plano.slice`) no pasa por `sinGuiones` |
| `useNotificationRouting.ts:46` | `ir(datos.ruta)` | seguridad: un push remoto podía abrir cualquier ruta |

## 3. Diccionario final

`RUTA_AVISO`, `RUTAS_PERMITIDAS` y `rutaSegura` viven en `src/lib/voice.ts`. Al tocar, cualquier ruta fuera de la lista lleva a `/(tabs)`.

### Locales

| id | Cuándo | Título | Cuerpo | Ruta |
|---|---|---|---|---|
| `nivl.despertar` | a la hora de despertar | Arriba, gladiador | `voice.morningNotif()`: El sistema ha asignado tus misiones de hoy. Empieza por la primera. · Nuevas misiones disponibles. El día es una campaña: entra primero. · Tus misiones esperan. Cada una completada te acerca al siguiente rango. | `/(tabs)` |
| `nivl.bloque.{fecha}.{id}` | inicio de un bloque del plan con aviso | `{hh:mm} · {bloque}` | el detalle del bloque, o «Es la hora de este bloque.» | `/(tabs)` |
| `nivl.posponer.{id}` | 10 min después de «Posponer» | el del bloque, o «Recordatorio» | el del bloque, o «Sigue pendiente.» | la del bloque, filtrada |
| `nivl.cierre.{fecha}` | hora de cierre | El cierre del día se acerca | `voice.eveningNotif()`: Quedan unas horas para el cierre. Mira qué te falta. · El cierre se acerca. Revisa tus misiones pendientes. · Antes de cerrar el día, un vistazo a lo pendiente. | `/diario` |
| `nivl.aviso.racha.{fecha}` | racha en juego y misiones por hacer | Racha de {n} día / días | Te falta 1 misión para cerrar el día. · Te faltan {n} misiones para cerrar el día. | `/(tabs)` |
| `nivl.aviso.recuperacion.{fecha}` (cerrada) | penalización de hoy sin hacer y sin misión normal hecha | Recuperación | Completa una misión de hoy y la recuperación se abre. | `/(tabs)` |
| `nivl.aviso.recuperacion.{fecha}` (abierta) | la recuperación ya se puede hacer | Recuperación abierta | Completa la misión de recuperación y vuelven {xp} XP. (sin XP: La misión de recuperación está lista en Hoy.) | `/(tabs)` |
| `nivl.aviso.duelo.{fecha}` | duelos aceptados o resueltos sin ver | Tu duelo / Tus duelos | Hay novedades en 1 duelo. · Hay novedades en {n} duelos. | `/amigos` |
| `nivl.aviso.foto.{fecha}` | domingo con poses por hacer | Fotos de la semana | Falta 1 de 3 para cerrar la semana. · Faltan {n} de 3 para cerrar la semana. | `/fotos` |
| `nivl.aviso.rango.{fecha}` (clave `rango:X`) | celebración de rango sin ver | Nuevo rango | Ya eres {nombre del rango}. Entra a verlo. | `/(tabs)` |
| `nivl.aviso.rango.{fecha}` (otra épica) | celebración épica sin ver | La arena te reconoce | Tienes algo nuevo que ver. Entra cuando quieras. | `/(tabs)` |
| `nivl.aviso.vuelta7.{fecha}` | 7 días sin abrir | La arena sigue aquí | Un paso basta para volver. | `/(tabs)` |
| `nivl.aviso.vuelta30.{fecha}` | 30 días sin abrir (la última) | La puerta sigue abierta | Cuando quieras, empiezas por una misión. | `/(tabs)` |

El copy de los `nivl.aviso.*` sale de `textoAviso(d)` (puro y determinista). Programarlos con `planDeAvisos` en Hoy es L6, fuera de este encargo.

### Servidor (propuesta para el ritual)

| kind | Cuándo | Título | Cuerpo | Ruta |
|---|---|---|---|---|
| `brief` | hora de despertar | Órdenes del día | titular del brief, sin «—» | `/(tabs)` |
| `revision_semanal` | domingo 20:00 | Revisión de la semana | titular, sin «—» | `/(tabs)/coach` |
| `cierre_mensual` | día 1, hora de despertar | Cierre del mes | titular, sin «—» | `/(tabs)/coach` |
| `cierre_mensual` con fotos | día 1, si hubo fotos | Tu mes en imágenes | 1 foto. El sistema ha montado el pase y cerrado el mes: toca para verlo. · {n} fotos. … | `/resumen` |
| `escalada` | 4 días sin escribir al coach, 11:00 | Tu coach te ha escrito | titular, sin «—» | `/(tabs)/coach` |
| `checkin` | L6, con tope | Una pregunta del coach | la pregunta | `/(tabs)/coach` |
| moderación | denuncias nuevas (owners) | Moderación | 1 denuncia o revisión nueva · 1 abierta · {n} denuncias o revisiones nuevas · {m} abiertas | `/(tabs)` |

## 4. Para el coordinador / Chat 5

Todo en `supabase/functions/ritual/handler.ts`; el Chat 4 no lo toca.

1. **`sinGuiones` en el titular.** `titular()` devuelve `plano.slice(…)` en tres salidas (texto corto, sin consentimiento de IA, fallo de Haiku) sin pasar por `sinGuiones`. Callar el «—» depende de que el coach ya lo limpiara. Pedido: `return sinGuiones(…)` en las tres salidas, y también en el respaldo «El sistema tiene algo para ti.» por simetría. `sinGuiones` ya está en `_shared/singuiones.ts`.
2. **Plural de fotos (l. 777).** `${fotosMes} fotos` da «1 fotos». Pedido: `${fotosMes} ${fotosMes === 1 ? 'foto' : 'fotos'}.`
3. **Títulos.** Escalada (l. 660): «El sistema te espera» pasa a «Tu coach te ha escrito» (sin culpa por el silencio; quien escribe es el coach). Checkin (l. 554): «El sistema» pasa a «Una pregunta del coach».
4. **`data.ruta` en moderación (l. 216-224).** Hoy el push no lleva `data`. Pedido: `data: { ruta: '/(tabs)' }`. Si algún día hay pantalla de moderación, su ruta entra a la vez en `RUTAS_PERMITIDAS` (`src/lib/voice.ts`), o el cliente la mandará a Hoy. De paso, el plural: «1 denuncia o revisión nueva · 1 abierta».
5. **Lista de rutas.** El cliente ya solo navega a `/(tabs)`, `/(tabs)/coach`, `/diario`, `/resumen`, `/amigos`, `/fotos` y `/avances`. Cualquier ruta nueva en un push tiene que añadirse ahí primero, o se cae a Hoy sin error.
6. **Binario (no es del ritual):** los textos de permisos de cámara y galería de `app.json` no nombran las fotos de cuerpo (ya pedido en L5).
