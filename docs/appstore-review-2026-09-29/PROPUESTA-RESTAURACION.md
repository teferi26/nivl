# Restauración de compras: corrección autorizada

Estado a 29 de septiembre de 2026: el usuario autorizó expresamente integrar la corrección, desplegarla en NIVL y preparar TestFlight con la respuesta **«Sí, autoriza la corrección y TestFlight»**. Esta autorización incluye las conexiones de compra/restauración y webhook descritas abajo, conservando las reglas actuales de cobros y comisiones. La integración está implementada y subida en la rama `fix/appstore-review-20260929`; la fuente final, incluidas las aclaraciones de copy, es `8d22e544464c617e614bed667b9d78d16ff27755`. 0033 y las funciones store-reconcile/revenuecat-webhook están desplegadas en NIVL. La [compilación definitiva de CI](https://github.com/teferi26/nivl/actions/runs/36557093900) terminó correctamente y **NIVL 1.0.7 (20) está disponible en TestFlight interno**, con estado VALID/IN_BETA_TESTING confirmado por Apple a las 13:23:35 de Madrid. No se ha efectuado ninguna compra real como parte de estas pruebas; la restauración física sigue pendiente.

La revisión automática había bloqueado las conexiones por requerir aprobación explícita; esa aprobación ya se recibió y las conexiones están implementadas. La primera propuesta más amplia que reescribía el procesamiento financiero fue descartada. Se conserva `apply_store_event` de 0027 dentro de la nueva transacción.

## Problema corregido y alcance

Al borrar una cuenta NIVL se elimina su fila en `subscriptions`. Crear una nueva cuenta NIVL genera otro UUID. El procesador anterior de `TRANSFER` necesitaba encontrar la fila original y, si no existía, el webhook respondía `200` con el evento ignorado. La app confirmaba que había una compra en RevenueCat, pero solo esperaba al webhook; por tanto podía quedarse pendiente aunque la suscripción siguiera pagada.

El servidor corregido ya está desplegado. La resolución completa sigue pendiente de distribuir el cliente nuevo y comprobar la restauración con StoreKit sandbox. Las pruebas descritas abajo no demuestran una compra o restauración real de App Store.

Archivos de la corrección:

- `supabase/functions/_shared/store-reconcile.ts`: valida la sesión, consulta RevenueCat desde servidor y valida el estado recibido.
- `supabase/functions/store-reconcile/index.ts`: entrada autenticada para comprobar únicamente las compras del usuario de esa sesión. Ignora cualquier usuario, producto, precio o clave enviados en el cuerpo.
- `supabase/migrations/0033_store_reconciliation.sql`: dos funciones internas y un registro de revisión por usuario para impedir respuestas atrasadas. La nueva función envuelve `apply_store_event` existente y aplica el estado verificado dentro de la misma transacción.
- `supabase/functions/_shared/store-reconcile_test.ts` y `scripts/test-store-reconciliation.mjs`: pruebas aisladas; sin acceso a servicios reales.

La corrección conserva la función de eventos de 0027 y sus reglas de cobros, devoluciones y comisiones. Restaurar no crea una venta ni una comisión. Tampoco borra o modifica Franky, recrea la cuenta eliminada, concede acceso a partir del teléfono o inventa identificadores de transacción.

## Cambios de conexión autorizados

1. **Compra y restauración nativas** — En `src/lib/pro.ts`, después de que RevenueCat SDK confirme la compra o una suscripción activa restaurada, invocar `store-reconcile` con cuerpo vacío y la sesión actual. Después seguir verificando `ai_status` como ahora. Una llamada fallida no concede acceso: continúa pendiente y puede reintentarse con Restaurar compras. La comparación del precio, el catálogo, la cancelación de la hoja y la compra integrada se mantienen.
2. **Webhook autenticado** — Mantener intacta su autenticación por cabecera y validación básica. Sustituir únicamente su llamada final directa a `apply_store_event` por `reconcileStore(adminClient(), eventUsers(event), apiKey, event)`. La función nueva obtiene el estado actual de todas las cuentas existentes del evento. La RPC nueva ejecuta `apply_store_event` y aplica esos estados en una sola transacción. Si RevenueCat falla o la respuesta ha sido superada por otra más reciente, devolver `503` para que RevenueCat reintente; nunca reconocer como completada una transferencia que sigue pendiente.
3. **Configuración del servidor** — Fijar `REVENUECAT_API_KEY` con la clave pública iOS v1 ya existente del proyecto (o el nombre alternativo `EXPO_PUBLIC_RC_IOS_KEY`). No se necesita generar otra clave secreta RevenueCat para este endpoint. La clave debe proceder de configuración del servidor, nunca de la petición del cliente. No hay valores de claves en este documento.

El orden autorizado fue verificar el cambio, configurar la clave del servidor, aplicar 0033, desplegar `store-reconcile` y `revenuecat-webhook`, y finalmente distribuir el cliente. El despliegue del servidor está completado; la distribución del cliente está pendiente del resultado de CI/TestFlight. La nueva ruta del webhook depende de que RevenueCat esté disponible; cualquier fallo se reintenta, sin cambiar las reglas financieras existentes.

## Comportamiento implementado

- Una transferencia cuyo usuario anterior ya no existe obtiene el acceso del nuevo UUID desde RevenueCat; no necesita conservar datos de la cuenta eliminada.
- Una transferencia entre dos cuentas existentes comprueba ambas: la anterior pierde el derecho transferido y la nueva lo recibe en la misma transacción.
- Devoluciones y caducidad se reflejan desde el estado vigente, incluso si la restauración no tiene `original_transaction_id`. La API v1 devuelve un identificador de la transacción actual; no se usa como si fuera el de la cadena original.
- Una respuesta HTTP antigua no puede reemplazar una comprobación iniciada posteriormente. Si hay conflicto, la operación queda pendiente.
- Una respuesta inválida, desconocida, demasiado antigua, futura o un error HTTP nunca se interpreta como una suscripción válida o como una ausencia confirmada.
- Solo productos del catálogo y tiendas nativas reconocidas conceden acceso. Las compras sandbox permiten revisar la app; un derecho activo de producción prevalece sobre uno sandbox. Las pruebas manuales/cortesías no desaparecen porque el usuario no tenga una compra de tienda. El plan `owner` queda protegido.
- Todas las escrituras de la reconciliación requieren `service_role`; los usuarios no pueden enviar un estado de compra propio directamente a SQL.
- Una cuenta con borrado pendiente no inicia una comprobación. Si el borrado comienza mientras llega la respuesta, esta queda pendiente sin modificar derechos ni registrar el evento.

## Evidencia y despliegue

- 11 pruebas Deno aprobadas: autenticación, identidad derivada del JWT, URL/clave fijadas en servidor, formatos, errores HTTP, respuesta obsoleta, transferencia con origen borrado, autenticación del webhook y reintentos.
- 45 comprobaciones SQL superadas sobre PGlite 0.5.8 en memoria: carga de la **migración 0027 real**, aplicación repetida de 0033, borrado/restauración, transferencias, devoluciones/caducidad sin identificador original, concurrencia, borrado pendiente, planes protegidos, prioridad de producción, ausencia de ventas por restaurar y denegación a `anon`/`authenticated`.
- Estas pruebas no conectan con Supabase, RevenueCat ni Apple. El test SQL recibe explícitamente la ruta de una instalación existente de PGlite; no instala dependencias ni modifica una base persistente.
- Revisión final de la aplicación: 29 suites/392 pruebas Jest aprobadas, tipos y ESLint correctos, exportación iOS completada con 1.523 módulos. La revisión independiente verificó además 10 escenarios con las migraciones reales hasta 0033, incluidos borrado pendiente y respuestas tardías tras eliminar Auth.
- Servidor NIVL: 0031–0034 y las seis funciones coach, oracle, ritual, account-erasure, store-reconcile y revenuecat-webhook desplegadas. El consentimiento IA 2026-09-29 de 0034 está aplicado. El QA real del servidor no incluyó cobros ni restauración StoreKit; sus resultados y límites de CDN constan en [AUDITORIA.md](AUDITORIA.md).
- La política actualizada está publicada mediante Vercel dpl_EmAc61jmk8kn7fdcMpgw3KXJpzvy, alias nivl-web, con HTTP 200 y copia idéntica a la preparada. El contraste de etiquetas de Apple continúa pendiente en [PRIVACIDAD-FICHA.md](PRIVACIDAD-FICHA.md).

Huella SHA-256 de `0033_store_reconciliation.sql`:

`67e83a8168c7e9cbee4a714747f7d60c806b1d8c3505bfb3045dfdf27a3062f8`

El detector `HUELLAS` está actualizado y la aplicación remota de 0033 ha sido confirmada por el despliegue de la tarea principal. La huella identifica el archivo revisado; las pruebas de StoreKit y el binario nuevo siguen pendientes.

## Verificación pendiente de extremo a extremo

El código y el orden de despliegue ya se revisaron. Sigue pendiente confirmar en RevenueCat `Transfer to new App User ID` tanto para producción como para cualquier anulación específica de sandbox, y eventos de ambos entornos. Después de verificar el nuevo build de TestFlight, probar con cuentas de prueba: compra, restauración en la misma cuenta, eliminación de la cuenta NIVL y creación de otra, transferencia, cancelación/renovación/caducidad y devolución. Confirmar que un fallo temporal de RevenueCat queda pendiente y se recupera al reintentar, sin doble comisión.

El vídeo físico solicitado por Apple y las siete respuestas de App Review siguen pendientes; ninguna de estas pruebas los sustituye. La demostración Élite/ludus está preparada con cinco cuentas ficticias y 38/38 comprobaciones reales, sin fabricar consentimientos ni compras; sus credenciales están fuera del repositorio. Se corrigió y verificó userGeneratedContent=true en Apple, pero esto no acredita las etiquetas App Privacy ni implica haber reenviado la revisión.

Fuentes oficiales consultadas: [API v1 Customers](https://www.revenuecat.com/docs/api-v1/customers), [Customer Info](https://www.revenuecat.com/docs/api-v1/customer-info-model), [Restore Behavior](https://www.revenuecat.com/docs/projects/restore-behavior), [sincronización por webhooks](https://www.revenuecat.com/docs/integrations/webhooks#syncing-subscription-status), [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser).
