# L6-0 · Conectar planDeAvisos (Chat 4, contrato del Chat 5)

Hasta ahora `planDeAvisos` (`src/lib/notifyPlan.ts`) no lo llamaba nadie: solo sonaban los fijos (despertar, bloque, cierre). Este encargo lo conecta entero. Necesita `winter2/chat5-juego @5e1bd9e` (`fotosPendientesParaAviso`) integrado.

## Función

`programarAvisosDelPlan(estado)` en `src/lib/notifications.ts`. En cada llamada cancela solo los avisos del plan (ids `nivl.aviso.*`) y programa los nuevos. Los fijos no se tocan salvo lo indicado abajo.

## Entradas de EstadoPlanAvisos (todas puras)

- `ultimaApertura`: HOY (`dateKey()`): las vueltas +7 y +30 se cuentan desde aquí; reprogramar en cada apertura las desplaza solas.
- `wakeTime` / `sleepTime`: del perfil.
- `streakDays`, `questsHoy` (`questsScheduledOn`, CON penalizaciones), `completadasHoy`: lo mismo que usa Hoy.
- `rachaProtegida`: `enJuegoHoy(...).gastariaPiedra`, o congelación vigente (`freeze_until ≥ hoy`).
- `fotosPendientes`: `fotosPendientesParaAviso(fotos, hoy, { mayor18, consentimientoSalud })` (progressPhotos.ts); `fotos` = metadatos {id, fecha, pose}; `mayor18` de la confirmación de adulto (desconocido = null). Devuelve 0 sin 18+/salud, si nunca hizo una foto, entre semana o con la semana completa.
- `duelosPendientes`: los de `misDuelos()` aceptados o resueltos no vistos (una clave vista por duelo, como las celebraciones).
- `celebracionPendiente`: la principal de `colaDeCelebracion` no mostrada, o null.
- `historial`: los avisos LOCALES del plan que ya han sonado hoy. Guardar en AsyncStorage los programados con su `cuando`; los de `cuando < ahora` cuentan como disparados. Sin esto el tope de 2 al día no se cumple entre recargas.
- `pushesServidor`: `[]` en el cliente.

## Cuándo llamarlo

Al cargar Hoy, al volver a primer plano, después de completar una misión, aceptar un duelo o ver una celebración.

## Anti-spam

1. Si el plan devuelve un aviso `racha` para hoy, NO programar el fijo de «cierre» ese día (o fundirlos).
2. RET-06: despertar y bloque solo hasta `ultimoDiaConAvisos(hoy)` (hoy + 6): no siguen sonando si no se abre la app.

## Copy

Título vacío en el plan: lo pone `textoAviso` (voice.ts) por tipo, sin culpa, nada corporal en el de foto (`Fotos de la semana` / `Falta 1 / Faltan {n} de 3 para cerrar la semana.`). Rutas por `RUTA_AVISO` y `rutaSegura`.

## QA (Chat 5)

FOT-08 (domingo 11:00), tope de 2 al día, no duplicar racha y cierre, silencio tras 7 días sin abrir.
