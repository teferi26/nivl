# Restauración de compras: corrección autorizada

Estado a 29 de septiembre de 2026: el usuario autorizó expresamente integrar la corrección, desplegarla en NIVL y preparar TestFlight con la respuesta **«Sí, autoriza la corrección y TestFlight»**. Esta autorización incluye las conexiones de compra/restauración y webhook descritas abajo, conservando las reglas actuales de cobros y comisiones. La integración está implementada en local; el despliegue lo coordina la tarea principal. No se ha efectuado ninguna compra real como parte de estas pruebas.

La revisión automática había bloqueado las conexiones por requerir aprobación explícita; esa aprobación ya se recibió y las conexiones están implementadas. La primera propuesta más amplia que reescribía el procesamiento financiero fue descartada. Se conserva `apply_store_event` de 0027 dentro de la nueva transacción.

## Problema actual y alcance

Al borrar una cuenta NIVL se elimina su fila en `subscriptions`. Volver a entrar con Franky crea una cuenta NIVL con otro UUID. El procesador actual de `TRANSFER` necesita encontrar la fila original y, si no existe, devuelve `200` con el evento ignorado. La app confirma que hay una compra en RevenueCat, pero solo espera al webhook; por tanto puede quedarse pendiente aunque la suscripción siga pagada.

El defecto no se considera resuelto en producción hasta desplegar servidor y cliente y comprobar la restauración con StoreKit sandbox. Las pruebas descritas abajo no demuestran una compra o restauración real de App Store.

Archivos de la propuesta:

- `supabase/functions/_shared/store-reconcile.ts`: valida la sesión, consulta RevenueCat desde servidor y valida el estado recibido.
- `supabase/functions/store-reconcile/index.ts`: entrada autenticada para comprobar únicamente las compras del usuario de esa sesión. Ignora cualquier usuario, producto, precio o clave enviados en el cuerpo.
- `supabase/migrations/0033_store_reconciliation.sql`: dos funciones internas y un registro de revisión por usuario para impedir respuestas atrasadas. La nueva función envuelve `apply_store_event` existente y aplica el estado verificado dentro de la misma transacción.
- `supabase/functions/_shared/store-reconcile_test.ts` y `scripts/test-store-reconciliation.mjs`: pruebas aisladas; sin acceso a servicios reales.

La propuesta conserva la función de eventos de 0027 y sus reglas de cobros, devoluciones y comisiones. Restaurar no crea una venta ni una comisión. Tampoco borra o modifica Franky, recrea la cuenta eliminada, concede acceso a partir del teléfono o inventa identificadores de transacción.

## Cambios de conexión autorizados

1. **Compra y restauración nativas** — En `src/lib/pro.ts`, después de que RevenueCat SDK confirme la compra o una suscripción activa restaurada, invocar `store-reconcile` con cuerpo vacío y la sesión actual. Después seguir verificando `ai_status` como ahora. Una llamada fallida no concede acceso: continúa pendiente y puede reintentarse con Restaurar compras. La comparación del precio, el catálogo, la cancelación de la hoja y la compra integrada se mantienen.
2. **Webhook autenticado** — Mantener intacta su autenticación por cabecera y validación básica. Sustituir únicamente su llamada final directa a `apply_store_event` por `reconcileStore(adminClient(), eventUsers(event), apiKey, event)`. La función nueva obtiene el estado actual de todas las cuentas existentes del evento. La RPC nueva ejecuta `apply_store_event` y aplica esos estados en una sola transacción. Si RevenueCat falla o la respuesta ha sido superada por otra más reciente, devolver `503` para que RevenueCat reintente; nunca reconocer como completada una transferencia que sigue pendiente.
3. **Configuración del servidor** — Fijar `REVENUECAT_API_KEY` con la clave pública iOS v1 ya existente del proyecto (o el nombre alternativo `EXPO_PUBLIC_RC_IOS_KEY`). No se necesita generar otra clave secreta RevenueCat para este endpoint. La clave debe proceder de configuración del servidor, nunca de la petición del cliente. No hay valores de claves en este documento.

Orden autorizado: verificar el cambio, configurar la clave del servidor, aplicar 0033, desplegar `store-reconcile` y `revenuecat-webhook`, y finalmente distribuir el cliente. La nueva ruta del webhook depende de que RevenueCat esté disponible; cualquier fallo se reintenta, sin cambiar las reglas financieras existentes.

## Comportamiento propuesto

- Una transferencia cuyo usuario anterior ya no existe obtiene el acceso del nuevo UUID desde RevenueCat; no necesita conservar datos de la cuenta eliminada.
- Una transferencia entre dos cuentas existentes comprueba ambas: la anterior pierde el derecho transferido y la nueva lo recibe en la misma transacción.
- Devoluciones y caducidad se reflejan desde el estado vigente, incluso si la restauración no tiene `original_transaction_id`. La API v1 devuelve un identificador de la transacción actual; no se usa como si fuera el de la cadena original.
- Una respuesta HTTP antigua no puede reemplazar una comprobación iniciada posteriormente. Si hay conflicto, la operación queda pendiente.
- Una respuesta inválida, desconocida, demasiado antigua, futura o un error HTTP nunca se interpreta como una suscripción válida o como una ausencia confirmada.
- Solo productos del catálogo y tiendas nativas reconocidas conceden acceso. Las compras sandbox permiten revisar la app; un derecho activo de producción prevalece sobre uno sandbox. Las pruebas manuales/cortesías no desaparecen porque el usuario no tenga una compra de tienda. El plan `owner` queda protegido.
- Todas las escrituras de la propuesta requieren `service_role`; los usuarios no pueden enviar un estado de compra propio directamente a SQL.
- Una cuenta con borrado pendiente no inicia una comprobación. Si el borrado comienza mientras llega la respuesta, esta queda pendiente sin modificar derechos ni registrar el evento.

## Evidencia local

- Pruebas Deno: autenticación, identidad derivada del JWT, URL/clave fijadas en servidor, formatos, errores HTTP, respuesta obsoleta, transferencia con origen borrado, autenticación del webhook y reintentos.
- 45 comprobaciones SQL superadas sobre PGlite 0.5.8 en memoria: carga de la **migración 0027 real**, aplicación repetida de 0033, borrado/restauración, transferencias, devoluciones/caducidad sin identificador original, concurrencia, borrado pendiente, planes protegidos, prioridad de producción, ausencia de ventas por restaurar y denegación a `anon`/`authenticated`.
- Estas pruebas no conectan con Supabase, RevenueCat ni Apple. El test SQL recibe explícitamente la ruta de una instalación existente de PGlite; no instala dependencias ni modifica una base persistente.

Huella SHA-256 de `0033_store_reconciliation.sql`:

`67e83a8168c7e9cbee4a714747f7d60c806b1d8c3505bfb3045dfdf27a3062f8`

El detector local `HUELLAS` está actualizado; esto no implica que la migración esté aplicada. Comprobar el estado remoto antes de ejecutar el orden de despliegue autorizado.

## Verificación requerida antes de dar la corrección por activada

Revisar conjuntamente el código y el orden de despliegue. Confirmar en RevenueCat `Transfer to new App User ID` tanto para producción como para cualquier anulación específica de sandbox, y eventos de ambos entornos. Probar con cuentas de prueba: compra, restauración en la misma cuenta, eliminación de la cuenta NIVL y reentrada, transferencia, cancelación/renovación/caducidad y devolución. Confirmar que un fallo temporal de RevenueCat queda pendiente y se recupera al reintentar, sin doble comisión.

El video físico solicitado por Apple y las siete respuestas de App Review siguen siendo una verificación diferente; ninguna de estas pruebas los sustituye.

Fuentes oficiales consultadas: [API v1 Customers](https://www.revenuecat.com/docs/api-v1/customers), [Customer Info](https://www.revenuecat.com/docs/api-v1/customer-info-model), [Restore Behavior](https://www.revenuecat.com/docs/projects/restore-behavior), [sincronización por webhooks](https://www.revenuecat.com/docs/integrations/webhooks#syncing-subscription-status), [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser).
