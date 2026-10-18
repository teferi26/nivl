# Modos F1 · Cliente

Rama `modos-f1/cliente`, sobre `winter2/modos-f1` @659714e. Solo commits locales. No hay push, ni OTA, ni EAS, y no se ha tocado `supabase/`.

**Regla de todo lo de aquí:** con `modos_activos` y `idiomas_activos` apagados (o sin `app_flags()` en el servidor), la app se ve y se comporta como la 1.0.10. No hay lecturas de `user_modes` ni de `mode_xp`, no se envía `x-nivl-modo`, no va la clave `modes` en los insert y update de misiones, y el onboarding tiene los siete pasos de siempre.

## Qué se ha hecho

### 1. Interruptores: `src/lib/flags.ts` + `src/lib/flagsmath.ts` (puro)
- `useFlags()` devuelve `Flags` (las claves del contrato). Está todo apagado hasta que se lee el servidor.
- Las lecturas siguen este orden:
  1. la caché en memoria;
  2. la del teléfono (AsyncStorage `nivl.flags.v1`), para pintar al arrancar sin red;
  3. `rpc('app_flags')`.
- Se refresca al volver a primer plano, como mucho una vez por minuto.
- Un interruptor solo se enciende con un `true` booleano. `"true"`, `1` o la basura cuentan como apagado.
- Si la función no existe (PGRST202 o 42883), se apaga todo y se borra la caché. Con un fallo de red se queda lo último que dijo el servidor y, si nunca se leyó, apagado.

### 2. Modos: `src/modos/`
- `tipos.ts` (puro) contiene:
  - `ModoId` y los nombres de marca (NIVL, IRON, FOCUS, WORK y FOUNDER, sin traducir);
  - el filtro de Hoy y la limpieza de `quests.modes`;
  - las filas de `user_modes` y `mode_xp`, y la cabecera del coach.
- `niveles.ts` (puro) calcula el nivel de cada modo con la misma curva que el global (`levelFromXp`).
- `datos.ts` lee y escribe `user_modes` (upsert de las cuatro filas con `enabled`) y lee `mode_xp`. Guarda en el teléfono el modo a la vista de cada cuenta.
- `ModoProvider` / `useModo()` está montado en `_layout.tsx`. Sin proveedor o con el interruptor apagado devuelve General y ninguna lectura.
- `coach.ts` del modo: el proveedor deja ahí el modo y `src/lib/coach.ts` añade `x-nivl-modo` en `authHeaders()`. Es decir, en el chat, los rituales, el resumen y la clasificación.
  - Solo con el interruptor encendido y un modo distinto de General. En General no va cabecera, para que el prompt sea idéntico.
  - Es `x-nivl-modo`, no `x-nivl-mode`: esa es la del modo profundo y sigue igual.
- `src/design/tokens.ts` lleva `modoAcento`: General = ink10, IRON #3D7BFF, FOCUS #8B6CFF, WORK #19C37D y FOUNDER #FF9F1C.
  - El test comprueba AA sobre #000, ink1 e ink2, y el texto negro sobre el acento.

### 3. Hoy
- `SelectorModo` va sobre el Hero. Aparece solo con el interruptor encendido y algún modo activado además de NIVL.
- La pestaña activa lleva su acento (texto y trazo). Es el único color de la pantalla.
- `derivarHoy` recibe `modo`:
  - la lista enseña las misiones con ese modo en `quests.modes`; en General, todas (la misma lista);
  - la penalización del día se ve en todos los modos, porque el cierre es global;
  - la «siguiente» se elige entre las visibles;
  - la sección cuenta las del modo.
- El Hero, la racha, el cierre y la línea de lo que hay en juego siguen siendo del día entero.
- Si el modo no tiene misiones hoy, aparece un vacío propio con «Ir a Hábitos».

### 4. Formulario de misión
- `QuestForm` acepta una prop `modos` opcional, que trae `EtiquetasModo` (selección múltiple con el acento de cada modo).
- Hábitos la pasa solo con el interruptor encendido:
  - ofrece los modos activados (los cuatro si no hay ninguno);
  - una misión nueva lleva marcado el modo a la vista.
- Al editar se ofrecen también las etiquetas que ya tiene la misión.
- La misión es una sola fila: se marca una vez y la XP por modo la suma el trigger del servidor.

### 5. Onboarding
- `components/onboarding/pasos.ts` (puro) da la secuencia de pasos.
  - Los pasos nuevos caen entre los números de siempre: idioma = -1 y modos = 2,5. Así no se renumera nada.
  - Con los dos interruptores apagados, la secuencia es 0..6 y avanzar es sumar uno, como hasta ahora.
- **«Elige tus modos»** (con `modos_activos`) va tras «Para qué»:
  - NIVL aparece fijo y hay que elegir al menos un modo más;
  - se propone el modo del perfil de uso (deportista → IRON, estudiante → FOCUS, profesional → WORK, emprendedor → FOUNDER);
  - se guarda en `user_modes`.
- **Idioma** (con `idiomas_activos`) es el primer paso, antes de la portada:
  - se propone el idioma del teléfono si NIVL lo habla;
  - al continuar se ejecutan `fijarPreferencia` y `asegurarIdiomaPerfil` (como la hoja de Perfil).
- `src/components/idioma/SelectorIdioma.tsx` es un **stub** con la firma del contrato `{ valor, alCambiar }`. Al integrar, gana el del equipo idiomas.

### 6. Perfil
- `NivelesModo` va bajo el camino de rangos y no pinta nada con el interruptor apagado.
- Arriba está tu nivel global. Debajo, una fila por modo (los activados y los que ya tienen XP) con su acento, su nivel y su barra.
- Mientras carga hay huecos. Un fallo se dice en una línea y no tumba Perfil.
- «Elegir modos» abre una hoja (`HojaModos`) que guarda en `user_modes`. Ahí se pueden quitar todos, y entonces queda NIVL.
  - Es la vía para las cuentas que ya hicieron el onboarding.

### 7. Plan `prueba_auto` (lo pidió el coordinador)
- Está en `PlanKey` y en `PLAN_LABEL`.
- `planLabel('prueba_auto')` sale del catálogo (`perfil:planes.pruebaAuto`, «Prueba gratuita»).
- `planDePago` lo excluye.

### Textos
- El catálogo nuevo es `src/i18n/es/modos.json`, registrado en `recursos.ts`.
- Hay dos ampliaciones: `onboarding:idioma.*` y `perfil:planes.pruebaAuto`.
- No se ha cambiado ningún texto existente en español. Lo nuevo está aceptado en `docs/i18n/textos-es.aceptados.tsv`, en el bloque «# Modos F1» al final.
- No hay «—» ni «–».

### Galería
`/kit/pantallas?pantalla=modos` tiene estos estados:
- Hoy en IRON, en NIVL, con dos modos y en un modo sin misiones;
- el formulario nuevo y el de edición;
- los pasos de modos y de idioma;
- los niveles (llenos y cargando);
- la hoja de elegir modos.

Revisado a 360 y 375.

## Cómo probarlo

```bash
npx tsc --noEmit && npx eslint src --quiet && CI=true npx jest --ci && node scripts/i18n/verificar-es.mjs
```

Los tests nuevos son:
- `src/lib/__tests__/flags.test.ts`: apagado por defecto, basura, función inexistente, sin red y caché;
- `src/lib/__tests__/coach-modo.test.ts`: con el interruptor apagado van las cabeceras de siempre; en General no va cabecera; en IRON y en los rituales va `x-nivl-modo`;
- `src/modos/__tests__/tipos.test.ts` y `niveles.test.ts`: filtro por modo, misión con dos modos, `user_modes`, `mode_xp` y el formulario;
- `src/components/hoy/__tests__/derivarHoyModos.test.ts`:
  - sin modo, la salida es idéntica a la de General;
  - el filtro;
  - el Hero no cambia;
  - una misión con dos modos marcada una vez sale hecha en WORK, en FOUNDER y en NIVL;
- `src/components/onboarding/__tests__/pasos.test.ts`: con los interruptores apagados, los siete pasos de siempre;
- `src/design/__tests__/tokens.test.ts`: AA de los acentos.

A mano, contra una base con 0066-0069:
1. `update app_config set value='true' where key='modos_activos'`.
2. Una cuenta nueva ve «Elige tus modos». Una existente va a Perfil, «Elegir modos».
3. En Hoy aparece el selector. Etiqueta en Hábitos una misión con dos modos y márcala una vez: sale hecha en los dos modos y en NIVL, y Perfil suma a los dos niveles.
4. El coach en IRON lleva la cabecera `x-nivl-modo: iron` (se ve en los registros de la función).
5. Vuelve a apagar el interruptor: todo como antes en el siguiente refresco (al volver a primer plano).

La galería en web, para capturas: `/kit/pantallas?pantalla=modos&estado=<id>&ancho=375&quieto=1&solo=1`.
- En este worktree, `node_modules` es un enlace a `w2-1010` y Metro sirve el punto de entrada fuera de la raíz (404).
- Para verlo hizo falta un apaño local que **no está en la rama**: `main` apuntando a un `entrada-local.js` con `import 'expo-router/entry'` y `watchFolders` hacia `../w2-1010/node_modules`.
- Con un `node_modules` real no hace falta nada.

## Riesgos
- **Interruptor encendido con el servidor viejo.** Es imposible por diseño, porque los interruptores viven en la 0067. Si se encendiera sin la 0068, las lecturas de `user_modes` y `mode_xp` fallarían con calma (todo en General) y crear una misión con etiquetas fallaría por la columna. **La 0068 tiene que ir antes de encender `modos_activos`.**
- **El refresco de interruptores no es inmediato.** Se leen al arrancar y al volver a primer plano (como mucho cada 60 s). Apagar en el servidor tarda hasta la siguiente vuelta, y mientras tanto vale la caché del teléfono.
- **La penalización se ve en todos los modos.** Es una decisión de este equipo: el cierre es global y es lo primero que hay que ver. Si se quiere solo en NIVL, es una línea en `misionEnModo`.
- **El mínimo de modos** se ha leído como «al menos uno además de NIVL» en el onboarding. En Perfil se pueden quitar todos.
- **General no envía cabecera.** Si el servidor quiere distinguir «General elegido» de «sin modos», habría que enviarla también con `general`. El servidor ya trata `general` como sin cabecera.
- **El selector de idioma es un stub.** Al integrar, la versión del equipo idiomas lo sustituye con la misma firma. El paso solo existe con `idiomas_activos`.
- **Conflictos previsibles al integrar** (todos pequeños):
  - `src/lib/coach.ts` (`authHeaders`, idiomas añadirá `x-nivl-locale`);
  - `src/i18n/recursos.ts` (namespace `modos`);
  - `onboarding.json` y `perfil.json` (claves nuevas al final);
  - el bloque final de `textos-es.aceptados.tsv`.

## Lo que necesito de otros equipos
- **Servidor** (ya entregado, @1c4748d):
  - `app_flags()`;
  - `user_modes` con RLS de dueño y upsert por `(user_id, mode)`;
  - `mode_xp` de solo lectura;
  - `quests.modes` (NULL pasa a `{}`);
  - el coach con `x-nivl-modo`.
  - **Orden:** migraciones y la función `coach` antes de encender `modos_activos`.
- **Idiomas:**
  - el `SelectorIdioma` de verdad (misma firma);
  - las traducciones del namespace `modos`, de `onboarding:idioma` y de `perfil:planes`;
  - `x-nivl-locale` en `authHeaders`, junto a la cabecera de modo.
- **Analítica:** si se quieren eventos del embudo (paso de modos visto o completado, cambio de modo), los puntos de enganche son `saveModos` y `saveIdioma` en `onboarding.tsx` y `cambiar` en `ModoProvider`. Aquí no se ha añadido ninguno.
