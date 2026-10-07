# NIVL: cierre de lógica y limpieza de proveedor

Actualizado: 7 de octubre de 2026, 12:09, Europe/Madrid.
Estado: PROBADO LOCALMENTE, NO DESPLEGADO. Auditoría cruzada final a cargo del coordinador y el chat de seguridad asignado. Responsable: Codex, frente runtime y proveedor.

## Correcciones y evidencia

- Coach: un stream que termina sin evento done deja de considerarse éxito; SSE con CRLF y separadores partidos se procesa. Regresiones en src/lib/__tests__/sec-coach-client.test.ts.
- Avisos: salir invalida cargas pendientes de la fuente, lecturas de permisos, listado nativo y escrituras iniciadas. El cierre espera esas operaciones antes de borrar historial y cancelar avisos. Pruebas en notifications-lifecycle.test.ts; 29/29 con avisosPlan.test.ts.
- RevenueCat: la reconciliación comprueba cuenta existente y ausencia de borrado pendiente antes y después de la lectura, también tras aplicar SQL. Los fallos de consulta de estado nunca se interpretan como autorización para borrar proveedor.
- Borrado: la cola persistente debe confirmarse antes de tocar Storage o eliminar Auth. Sin clave secreta válida no se confirma el borrado del proveedor ni se elimina Auth.
- Worker: secreto de servidor comparado sin salida anticipada por carácter; no acepta UUID ni límite del cuerpo. Lotes de 20 identidades elegidas por leases de base de datos. Solo devuelve conteos, nunca UUID, secretos ni errores del proveedor.

La regresión del GET remoto tardío está en supabase/functions/_shared/store-erasure-cleanup_test.ts: GET abortado localmente, DELETE404 ya terminado, GET remoto recrea cliente después, worker vuelve a borrarlo con Auth ausente. El tombstone se mantiene después de 404 y otro GET tardío vuelve a limpiarse.

Comandos ejecutados con éxito desde este worktree:

```text
npx deno test --allow-read supabase/functions/_shared/store-erasure-cleanup_test.ts supabase/functions/_shared/account-erasure_test.ts supabase/functions/_shared/sec_priv_account_erasure_test.ts supabase/functions/_shared/ia2_fotos_erasure_test.ts supabase/functions/_shared/store-reconcile_test.ts supabase/functions/_shared/store-audit_test.ts
npx deno check supabase/functions/store-erasure-cleanup/index.ts supabase/functions/account-erasure/index.ts supabase/functions/store-reconcile/index.ts supabase/functions/revenuecat-webhook/index.ts
```

Resultado propio: 60/60 tests Deno, cuatro entrypoints verificados. Regresión integrada repetida por el coordinador: todos los tests _shared, 248 PASS y 2 omitidos; entrypoints de worker, reconcile, account-erasure y coach PASS; arnés SQL de cola PGlite PASS. Ninguna llamada a RevenueCat o Supabase reales; proveedores y base de datos simulados en estas pruebas. Las RPC reales se prueban por separado con PGlite en scripts/test-store-erasure-queue.mjs (responsable: frente backend).

## Archivos y dependencias

Lógica: src/lib/coach.ts, src/lib/notifications.ts; supabase/functions/_shared/store-reconcile.ts, account-erasure.ts y store-erasure-cleanup.ts; nuevo supabase/functions/store-erasure-cleanup/index.ts.

Base de datos: nueva 0063 para store_account_active; nueva 0064 para cola sin FK a Auth, triggers transaccionales, claim/finish y exportación. Las migraciones anteriores no se modifican. Responsable: frente backend.

## Pendiente antes de publicar

Responsable: coordinador y operador, con autorización de despliegue.

1. Aplicar y verificar 0063/0064 antes de desplegar las funciones que llaman a las nuevas RPC.
2. Configurar una REVENUECAT_API_KEY secreta válida del proyecto antes del release. Las claves públicas del SDK no sirven para eliminar clientes.
3. Desplegar store-erasure-cleanup con --no-verify-jwt y RITUAL_SECRET correcto, y las versiones corregidas de account-erasure, store-reconcile y revenuecat-webhook.
4. Revisar y activar scripts/setup-store-erasure-cleanup.mjs --apply solo después de desplegar el worker. Por defecto el script imprime SQL y no activa nada. Reutiliza referencias Vault nivl_ritual_secret y nivl_project_url.
5. Comprobar autorización, leases y drenaje en entorno de prueba; comprobar ejecución cron y errores antes de release. La ausencia de scheduler impide la recuperación automática.
6. Mantener pendientes las pruebas físicas de app y los criterios de Apple que corresponden al coordinador. Este cierre no certifica todas las pantallas ni modifica front.

## Límite operativo

Tras un DELETE exitoso, el UUID vuelve a ser elegible para otro intento a los 15 minutos durante una ventana de 30 días. El scheduler se invoca cada 15 minutos y cada ejecución reclama hasta 20 trabajos. Esa frecuencia no garantiza un intento por cuenta cada 15 minutos: una cola de más de 20 trabajos o incidencias del servicio pueden retrasar su drenaje. Los fallos sin resolver se conservan más allá del plazo. Un DELETE404 no retira anticipadamente la protección. Las leases de 5 minutos permiten reclamar trabajo tras una caída. El UUID mínimo persiste sin Auth exclusivamente para limpiar el proveedor.

Esto cubre las carreras demostradas dentro de la ventana con scheduler operativo; no demuestra una garantía ilimitada si el proveedor ejecuta un GET remoto después de vencer la retención, si faltan credenciales o si el scheduler permanece detenido. El operador debe supervisar trabajos fallidos y disponibilidad. No se ha activado cron ni desplegado nada en producción.


Puerta obligatoria del worker: este repositorio no incluye supabase/config.toml que desactive verificación JWT. El scheduler manda x-ritual-secret y no Authorization. Por tanto debe usarse `supabase functions deploy store-erasure-cleanup --no-verify-jwt` al desplegar con aprobación, o configurar equivalentemente verify_jwt=false. Si se despliega con el valor por defecto, la pasarela responderá 401 antes del handler y no habrá drenaje automático. Las pruebas de autenticación del handler no prueban esta pasarela: comprobar esa invocación en el entorno de prueba es condición de publicación. Esta receta no se ha ejecutado.


Actualización de evidencia, 7 de octubre de 2026 a las 12:09 (Madrid): el coordinador confirma PASS del arnés PGlite tras corregir el intento final a partir del horizonte y la cobertura/huellas de exportación de 0064. La revisión documentada a las 12:06 conserva esas correcciones. La repetición independiente final del auditor está pendiente; este archivo no la presenta como completada. Estado de producción sin cambios.
