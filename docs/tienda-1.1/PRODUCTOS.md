# NIVL 1.1: productos de tienda

Fecha: 9 de noviembre de 2026. Sale del código de esta rama (`src/lib/planesmodo.ts`, `src/lib/pro.ts`, migración 0140). Este documento no da fe de lo que hay en App Store Connect, Google Play ni RevenueCat: desde aquí no se han abierto. Cada casilla de la tabla final la marca quien lo compruebe en el panel.

## 1. Lo que el código espera

| Dónde | Qué lee | Consecuencia |
|---|---|---|
| `pro.ts:357-364` `todosLosPaquetes` | Los paquetes de la offering `current` y de todas las demás | El producto tiene que estar como paquete en una offering. Da igual el nombre de la offering y del paquete |
| `pro.ts:419-428` `preciosModosDeTienda` | `product.identifier`, sin lo que va tras `:` | El id del producto ha de ser exacto. En Google Play llega como `producto:baseplan` y se corta |
| `pro.ts:435-456` `pruebasModosDeTienda` | `product.introPrice` y, en iOS, elegibilidad 2 (ELIGIBLE) | Sin oferta introductoria configurada, o con elegibilidad desconocida, la pantalla no promete prueba |
| `pro.ts:610-636` `suscripcionesNivl` | `subscriptionsByProductIdentifier`, `activeSubscriptions` y entitlements activos: basta uno | El nombre del entitlement no se lee en ningún sitio |
| `store-reconcile.ts:14` y 0140 `store_products` | Id de producto | El servidor decide por producto. No usa entitlements. Un producto fuera de la lista no da derecho |
| `useDerechos.ts`, RPC `mis_modos` y `ai_modos` (0140) | `store_products.modos` del `store_product_id` | La prueba se guarda como plan `cortesia`, pero manda el producto |

Offering, paquetes y entitlements pueden llamarse como se quiera. Los diez ids de producto, no.

## 2. Los diez productos

Todos en el grupo de suscripción existente, de nombre de referencia `NIVL` (`docs/payment-audit/CLIENTE.md:85`). Los precios son los de `PRECIOS_CENTS` (`planesmodo.ts:48-51`).

| # | Product ID (idéntico en Apple, Google y RevenueCat iOS) | Base plan Google | Id en RevenueCat Android | Periodo | Precio EUR, IVA incl. | Prueba | Nivel Apple | `subscriptions.plan` | Abre |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `nivl_iron_mensual` | `mensual` | `nivl_iron_mensual:mensual` | 1 mes | 14,99 € | no | 4 | `iron_mensual` | iron |
| 2 | `nivl_iron_anual` | `anual` | `nivl_iron_anual:anual` | 1 año | 59,99 € | 7 días | 4 | `iron_anual` | iron |
| 3 | `nivl_focus_mensual` | `mensual` | `nivl_focus_mensual:mensual` | 1 mes | 14,99 € | no | 4 | `focus_mensual` | focus |
| 4 | `nivl_focus_anual` | `anual` | `nivl_focus_anual:anual` | 1 año | 59,99 € | 7 días | 4 | `focus_anual` | focus |
| 5 | `nivl_work_mensual` | `mensual` | `nivl_work_mensual:mensual` | 1 mes | 14,99 € | no | 4 | `work_mensual` | work |
| 6 | `nivl_work_anual` | `anual` | `nivl_work_anual:anual` | 1 año | 59,99 € | 7 días | 4 | `work_anual` | work |
| 7 | `nivl_founder_mensual` | `mensual` | `nivl_founder_mensual:mensual` | 1 mes | 14,99 € | no | 4 | `founder_mensual` | founder |
| 8 | `nivl_founder_anual` | `anual` | `nivl_founder_anual:anual` | 1 año | 59,99 € | 7 días | 4 | `founder_anual` | founder |
| 9 | `nivl_todos_mensual` | `mensual` | `nivl_todos_mensual:mensual` | 1 mes | 30 € | no | 1 | `todos_mensual` | los cuatro |
| 10 | `nivl_todos_anual` | `anual` | `nivl_todos_anual:anual` | 1 año | 99 € | 7 días | 1 | `todos_anual` | los cuatro |

Durante la prueba de un anual la fila queda como `cortesia` + `trialing` con su `store_product_id`, y `mis_modos` responde según el producto.

## 3. El grupo y sus niveles

**Un solo grupo, el que ya existe.** En un grupo solo puede haber una suscripción activa por persona, y Apple recomienda un grupo para evitar compras duplicadas ([grupos y niveles](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions)). Dos grupos permitirían pagar IRON y FOCUS a la vez sin que el código lo sepa. Por el mismo motivo no se venden combinaciones de dos o tres modos.

La consecuencia hay que asumirla: **comprar otro modo sustituye al actual, no lo suma.** Solo los cuatro abren más de un mundo.

| Nivel | Productos | Por qué |
|---|---|---|
| 1 | `nivl_todos_mensual`, `nivl_todos_anual` | Lo que más ofrece |
| 2 | `nivl_elite_mensual`, `nivl_elite_anual`, `nivl_elite_fundador` | Antiguos: abren los cuatro modos |
| 3 | `nivl_pro_mensual`, `nivl_pro_anual` | Antiguos: abren los cuatro modos |
| 4 | Los ocho de un modo | De antiguo a un modo es bajada: no se pierde lo ya pagado |

Efecto de cada cambio según la [documentación de Apple](https://developer.apple.com/app-store/subscriptions/):

| Cambio | Tipo en Apple | Cuándo | Google Play con este código (`modoReemplazoGoogle`) |
|---|---|---|---|
| Un modo a los cuatro | Subida | Inmediato, con devolución proporcional | `CHARGE_PRORATED_PRICE` |
| Los cuatro a un modo | Bajada | En la siguiente renovación | `DEFERRED` |
| IRON mensual a FOCUS mensual, o IRON anual a FOCUS anual | Cruce, misma duración | **Inmediato: IRON se pierde en el acto** | `DEFERRED`, en la siguiente renovación |
| IRON mensual a FOCUS anual, o a la inversa | Cruce, otra duración | En la siguiente renovación | `DEFERRED` |
| IRON mensual a IRON anual | Cruce, otra duración | En la siguiente renovación | `DEFERRED` |

Apple y Google se comportan distinto en los cruces de misma duración. El comentario de `tipoCambioModo` (`planesmodo.ts:226-229`) dice que todo lo que no sea subida se aplica al renovar: en Apple no es así.

## 4. Precios en otros territorios

**Decisión propuesta:** España como país de referencia, EUR, y dejar la equalización automática de Apple para el resto de territorios ([precios](https://developer.apple.com/help/app-store-connect/manage-subscriptions/manage-pricing-for-auto-renewable-subscriptions)). El código no depende del importe: enseña y cobra `priceString` y aborta si cambia entre la oferta y el cobro (`pro.ts:681`).

Tres avisos:

1. **30 € y 99 € exactos.** Sin verificar que existan como punto de precio en EUR. Mirar la lista y "See Additional Prices". Si no están, es decisión del dueño (29,99 € o 99,99 €) y entonces hay que tocar `PRECIOS_CENTS`, `docs/PRECIOS.md` y el freno de la 0140.
2. **Freno de IA.** `ai_plans.monthly_budget_micro_usd` está calculado sobre el precio en EUR. En un territorio donde el precio equalizado rinda menos, el freno puede superar lo que deja la cuota. Revisarlo con los primeros datos.
3. **Territorios.** La lista la limita qué proveedores de IA admiten cada país. Esa comprobación no es de este documento. Solo el titular de la cuenta puede quitar países y eso afecta a suscriptores existentes.

En Google Play: precio base en EUR por país y conversión automática para el resto, con revisión manual de los importes.

## 5. Prueba de 7 días

- **Solo en los cinco anuales.** Mensuales sin oferta.
- **Apple:** oferta introductoria, tipo "Free", duración **1 semana**. Apple no ofrece "7 días": las duraciones son 3 días, 1 o 2 semanas, 1, 2, 3 o 6 meses y 1 año ([ofertas introductorias](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions)).
- **Elegibilidad en Apple:** una oferta introductoria por persona y por grupo, también para quien vuelve. Con cinco anuales en el mismo grupo, quien ya usó la prueba en IRON no la tiene en los cuatro. La app lo respeta: en iOS solo promete la prueba con elegibilidad confirmada (`pro.ts:451`).
- **Google Play:** oferta de 7 días gratis, elegibilidad "Nueva adquisición de clientes", opción **nunca ha tenido ninguna suscripción en la app**. Con la opción "esta suscripción" una persona podría encadenar cinco pruebas seguidas. Ids de oferta con minúsculas, números y guiones ([ids](https://support.google.com/googleplay/android-developer/answer/140504)): `prueba-7d`.
- **La prueba tiene 0,50 $ de IA** (plan `cortesia`, `docs/PRECIOS.md:86`) y la pantalla de compra no lo dice. Ver hallazgos.

## 6. Nombres y descripciones visibles

Nombre visible: tiene que coincidir con `tituloProducto` (`planesmodo.ts:259-263`), que es lo que sale en la letra de compra. Comprobado por script: ninguno pasa de 30 caracteres. El más justo, `NIVL Tutte le modalità mensile`, tiene exactamente 30.

| Producto | es | en | fr | de | pt-PT | it |
|---|---|---|---|---|---|---|
| IRON mensual | NIVL IRON mensual | NIVL IRON monthly | NIVL IRON mensuel | NIVL IRON monatlich | NIVL IRON mensal | NIVL IRON mensile |
| IRON anual | NIVL IRON anual | NIVL IRON annual | NIVL IRON annuel | NIVL IRON jährlich | NIVL IRON anual | NIVL IRON annuale |
| FOCUS mensual | NIVL FOCUS mensual | NIVL FOCUS monthly | NIVL FOCUS mensuel | NIVL FOCUS monatlich | NIVL FOCUS mensal | NIVL FOCUS mensile |
| FOCUS anual | NIVL FOCUS anual | NIVL FOCUS annual | NIVL FOCUS annuel | NIVL FOCUS jährlich | NIVL FOCUS anual | NIVL FOCUS annuale |
| WORK mensual | NIVL WORK mensual | NIVL WORK monthly | NIVL WORK mensuel | NIVL WORK monatlich | NIVL WORK mensal | NIVL WORK mensile |
| WORK anual | NIVL WORK anual | NIVL WORK annual | NIVL WORK annuel | NIVL WORK jährlich | NIVL WORK anual | NIVL WORK annuale |
| FOUNDER mensual | NIVL FOUNDER mensual | NIVL FOUNDER monthly | NIVL FOUNDER mensuel | NIVL FOUNDER monatlich | NIVL FOUNDER mensal | NIVL FOUNDER mensile |
| FOUNDER anual | NIVL FOUNDER anual | NIVL FOUNDER annual | NIVL FOUNDER annuel | NIVL FOUNDER jährlich | NIVL FOUNDER anual | NIVL FOUNDER annuale |
| Los cuatro, mensual | NIVL Todos los modos mensual | NIVL All modes monthly | NIVL Tous les modes mensuel | NIVL Alle Modi monatlich | NIVL Todos os modos mensal | NIVL Tutte le modalità mensile |
| Los cuatro, anual | NIVL Todos los modos anual | NIVL All modes annual | NIVL Tous les modes annuel | NIVL Alle Modi jährlich | NIVL Todos os modos anual | NIVL Tutte le modalità annuale |

Descripción, máximo 45 caracteres, la misma para mensual y anual. Comprobado por script: la más larga tiene 43. Las traducciones son propuesta y necesitan revisión de un nativo.

| Alcance | es | en | fr |
|---|---|---|---|
| IRON | IRON y su coach. Entreno y dieta guiados. | IRON and its coach. Training and nutrition. | IRON et son coach. Entraînement, nutrition. |
| FOCUS | FOCUS y su coach. Estudio y exámenes. | FOCUS and its coach. Study and exams. | FOCUS et son coach. Études et examens. |
| WORK | WORK y su coach. Jornada y economía. | WORK and its coach. Workday and finances. | WORK et son coach. Journée et finances. |
| FOUNDER | FOUNDER y su coach. Agenda y negocio. | FOUNDER and its coach. Agenda and business. | FOUNDER et son coach. Agenda et business. |
| Los cuatro | IRON, FOCUS, WORK y FOUNDER con su coach. | IRON, FOCUS, WORK and FOUNDER with coach. | IRON, FOCUS, WORK, FOUNDER et leur coach. |

| Alcance | de | pt-PT | it |
|---|---|---|---|
| IRON | IRON und sein Coach. Training, Ernährung. | IRON e o seu coach. Treino e nutrição. | IRON e il suo coach. Allenamento e dieta. |
| FOCUS | FOCUS und sein Coach. Lernen und Prüfungen. | FOCUS e o seu coach. Estudo e exames. | FOCUS e il suo coach. Studio ed esami. |
| WORK | WORK und sein Coach. Arbeitstag, Finanzen. | WORK e o seu coach. Jornada e finanças. | WORK e il suo coach. Giornata e finanze. |
| FOUNDER | FOUNDER und sein Coach. Termine, Business. | FOUNDER e o seu coach. Agenda e negócio. | FOUNDER e il suo coach. Agenda e business. |
| Los cuatro | IRON, FOCUS, WORK, FOUNDER mit Coach. | IRON, FOCUS, WORK e FOUNDER com coach. | IRON, FOCUS, WORK e FOUNDER con coach. |

El catálogo `pt` está en portugués de Portugal ("subscrição"). Si la ficha se publica también en pt-BR, usar estos mismos textos o revisarlos. No poner precios, "ahorra" ni "gratis" en estos campos.

## 7. App Store Connect, paso a paso

Antes: Acuerdos, impuestos y banca con el Paid Applications Agreement activo; datos bancarios y fiscales completos. Sin verificar desde aquí.

1. Apps > NIVL > Monetization > Subscriptions. Abrir el grupo `NIVL`. No crear otro.
2. Por cada uno de los diez, pulsar "+". Reference Name: el mismo id. Product ID: el id exacto de la sección 2. El Product ID no se puede cambiar ni reutilizar.
3. Subscription Duration: 1 Month o 1 Year. No se puede cambiar tras enviarlo a revisión.
4. Availability: todos los territorios decididos.
5. Family Sharing: desactivado. El derecho va por cuenta de NIVL y las ventas familiares no generan cobro (`0027_tienda.sql:211`).
6. Subscription Prices > Add Subscription Price. Spain, EUR, importe de la sección 2. Revisar la equalización y guardar.
7. Solo en los cinco anuales: Subscription Prices > "+" > Create Introductory Offer. Todos los países, fecha de inicio, sin fecha de fin, Free, 1 Week.
8. App Store Localization: añadir es-ES como principal y en, fr, de, pt-PT e it con los textos de la sección 6, solo los idiomas en que se publique la ficha.
9. Tax Category: la que corresponda; sin verificar cuál tienen los productos actuales. Copiar la de `nivl_pro_mensual`.
10. Review Information: una captura de la pantalla de compra real con el producto visible (`docs/payment-audit/FASE3-CAPTURAS-SUSCRIPCIONES.md` explica el formato) y una nota de cómo llegar. Las capturas de los cinco productos antiguos enseñan otro paywall: no reutilizarlas.
11. Volver al grupo > Edit Order. Colocar los niveles de la sección 3. Save.
12. Localización del grupo: comprobar que existe el nombre visible en cada idioma publicado.
13. Comprobar que los diez están en "Ready to Submit". Si alguno dice "Missing Metadata", falta un paso.
14. En la página de la versión 1.1.0 > "In-App Purchases and Subscriptions" > marcar los diez. Se envían con la versión.
15. **No pulsar "Removing from Sale" en los antiguos en este paso.** Ver sección 10.
16. App Store Server Notifications: en App Information, URL de producción y de sandbox que da RevenueCat, versión 2.

Small Business Program: comisión del 15 %, hay que solicitarlo ([programa](https://developer.apple.com/app-store/small-business-program/)). `docs/PRECIOS.md` calcula con 15 %. Estado sin verificar. Sin él, el primer año de cada suscripción va al 30 %.

## 8. Google Play, paso a paso

Solo cuando haya binario Android. Android no se ha probado en esta versión (`docs/rediseno-1.1/INFORME-INTEGRACION.md:59`). Sin verificar si existen ya los productos antiguos en Play.

1. Play Console > la app > Monetizar > Productos > Suscripciones > Crear suscripción.
2. Product ID: el id exacto. Válido: empieza por minúscula o número, admite minúsculas, números, guion bajo y punto, hasta 40 caracteres. Todos cumplen. No se puede cambiar ni reutilizar.
3. Nombre y ventajas localizadas.
4. **Un producto por cada id, con un solo base plan.** Dos base plans en un producto limitarían los modos de sustitución (`docs/payment-audit/CLIENTE.md:82`).
5. Añadir base plan. ID: `mensual` o `anual`. Tipo: renovación automática. Periodo: 1 mes o 1 año. Precio EUR y conversión del resto. Activar.
6. Solo en los cinco anuales: Añadir oferta al base plan. ID `prueba-7d`. Elegibilidad: nueva adquisición, nunca ha tenido ninguna suscripción en la app. Fase: prueba gratis, 7 días. Activar.
7. Notificaciones en tiempo real (Pub/Sub) con el topic que indica RevenueCat. `DEFERRED` las exige ([RevenueCat](https://www.revenuecat.com/docs/subscription-guidance/managing-subscriptions)).
8. Cuenta de servicio con permisos financieros cargada en RevenueCat.

## 9. RevenueCat, paso a paso

1. Comprobar que la app iOS tiene In-App Purchase Key y que la de Android tiene su cuenta de servicio. Sin verificar.
2. Product catalog > Products. Importar o crear los diez de iOS con el id exacto. En Android, con la forma `producto:baseplan` de la sección 2.
3. Entitlements: **no hace falta ninguno nuevo.** Ni servidor ni cliente leen su nombre. Si los antiguos cuelgan de uno existente, no se toca.
4. Offerings: crear una nueva con identificador `modos`.
5. Dentro de `modos`, diez paquetes con identificador custom: `iron_mensual`, `iron_anual`, `focus_mensual`, `focus_anual`, `work_mensual`, `work_anual`, `founder_mensual`, `founder_anual`, `todos_mensual`, `todos_anual`. Custom porque hay cinco del mismo periodo. Asociar el producto de cada plataforma.
6. Marcar `modos` como Current.
7. La offering antigua se queda como está, sin Current. La app actual lee todas las offerings. Sin verificar si la 1.0.11 las lee igual: comprobarlo antes de vaciarla.
8. Project settings > General > Restore Behavior: **Transfer to new App User ID**, tanto producción como cualquier ajuste distinto de sandbox. Es la opción por defecto, pero nunca se ha leído este panel (`docs/appstore-review-2026-09-29/ANTES-DE-REENVIAR.md:7`).
9. Integrations > Webhooks. URL: `https://<proyecto>.supabase.co/functions/v1/revenuecat-webhook`. Authorization: el valor del secreto `REVENUECAT_WEBHOOK_AUTH`. Entornos: producción y sandbox. Eventos: todos.
10. En Supabase, sin escribir valores en el repositorio, comprobar que existen:
    - `REVENUECAT_API_KEY`: clave secreta v1, formato `sk_`. Con una clave pública, webhook y `store-reconcile` responden 503 (`store-config.ts:15-18`).
    - `REVENUECAT_WEBHOOK_AUTH`.
    - `STORE_SANDBOX_ACCESS` vacío o `all`. Con `none` o una lista, el revisor de Apple pagaría en sandbox y no recibiría nada (`store-config.ts:32-39`).
11. En EAS, entorno `production`: `EXPO_PUBLIC_RC_IOS_KEY`. Sin ella la app enseña lista de solo lectura y no vende (`pro.ts:194-211`). El binario Debug probado no la llevaba.

## 10. Los cinco productos antiguos

`nivl_pro_mensual`, `nivl_pro_anual`, `nivl_elite_mensual`, `nivl_elite_anual`, `nivl_elite_fundador`.

**`docs/PRECIOS.md:172-173` está mal.** Dice que al retirarlos de la venta las suscripciones vivas siguen renovando. Apple dice lo contrario: se retira de la venta "to stop additional sign-ups and renewals", con un mínimo de 31 días antes de dejar de dar el servicio y aviso previo a los suscriptores ([disponibilidad](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-availability-for-an-auto-renewable-subscription)). En Google Play, en cambio, un base plan inactivo deja de venderse y las suscripciones existentes continúan ([base plans](https://support.google.com/googleplay/android-developer/answer/12154973)).

Lo que hace el servidor con ellos no cambia: siguen en `store-reconcile.ts:14` y abren los cuatro modos (`ai_modos`, 0140). La app no les vende nada: `parcial` es false (`pro.tsx:234`).

Hay que elegir, y es decisión del dueño:

| Opción | Qué se hace | A favor | En contra |
|---|---|---|---|
| A. Dejar de ofrecerlos en la app | Fuera de la offering Current. En Apple, siguen a la venta | Quien paga sigue renovando sin tocar nada | Por tiempo indefinido pagan 12,99 € por los cuatro modos. Sin verificar: desde Ajustes de iOS, un suscriptor del grupo podría pasar a Pro y pagar menos que un modo |
| B. Retirarlos de la venta | A + "Removing from Sale" tras avisar con 31 días o más | Cierra la vía de Ajustes. Es lo que dice la decisión "hasta que caduque" | Dejan de renovar. Quien no se pase a un modo pierde el coach al caducar. Obliga a dar servicio hasta el final de cada periodo, anuales incluidos |

Propuesta: **A el día de salida** y B cuando la 1.1 esté adoptada, después de contar cuántos suscriptores vivos hay y avisarles. Nunca borrar productos ni quitar países. Mirar antes en RevenueCat cuántos hay: sin verificar.

`nivl_ia_recarga_1` (consumible, `docs/IA_TOPE.md:32`) no es de estos diez. Propuesta: no crearlo para la 1.1. Si no existe, el botón no sale (`UsoIa.tsx:59`).

## 11. Orden correcto

1. Hecho, según el informe de integración: migraciones hasta 0142 sin 0113 y funciones desplegadas.
2. Actualizar `nivl.app/terminos`, que hoy describe los planes retirados (ver hallazgos). La página de compra enlaza ahí.
3. Paid Applications Agreement, Small Business Program, secretos del paso 9.
4. Crear los diez en App Store Connect (sección 7, pasos 1 a 13).
5. RevenueCat (sección 9).
6. Confirmar que el binario que sube a TestFlight se compiló con `EXPO_PUBLIC_RC_IOS_KEY`. Si no, recompilar.
7. Prueba completa en sandbox (sección 12). No enviar nada antes.
8. Aplicar los arreglos de código que salgan de la auditoría. Los de JavaScript pueden ir por OTA al binario 1.1, pero deben estar antes de la revisión.
9. Enviar la versión 1.1.0 con los diez productos marcados.
10. Tras la aprobación: nada de "Removing from Sale" hasta decidir la sección 10.
11. OTA de 1.1 si procede y 0113 solo con decisión expresa.

El binario no incluye los productos. Se puede compilar antes de crearlos, pero no probar ni enviar.

## 12. Cómo comprobarlo en sandbox

Con un iPhone real, build de TestFlight y un Sandbox Apple Account nuevo por cada ronda. Las pruebas gratuitas se reinician borrando el historial de compras del probador en App Store Connect. El sandbox acelera los periodos. Después de cada compra mirar en `/pro` el plan y los modos, y en RevenueCat el evento del cliente.

| # | Caso | Resultado esperado |
|---|---|---|
| 1 | Cuenta nueva, abrir `/pro` en anual | Diez precios de la tienda al cambiar opciones, "7 días" o "1 semana" tal como lo diga el texto arreglado, letra completa, Restaurar, Términos, Privacidad, EULA |
| 2 | Comprar `nivl_iron_anual` | Hoja con la prueba. IRON se abre y los otros tres siguen cerrados. `/pro` dice prueba y próxima renovación |
| 3 | Dejar pasar la prueba | Evento RENEWAL, plan `iron_anual`, sigue abierto IRON |
| 4 | Con prueba usada, ver otro anual | La pantalla no promete prueba; la hoja de Apple tampoco |
| 5 | Comprar `nivl_iron_mensual` en cuenta limpia y subir a `nivl_todos_mensual` | Inmediato. Los cuatro abiertos sin reabrir la app |
| 6 | `nivl_iron_anual` a `nivl_todos_mensual` | Inmediato. Los cuatro abiertos aunque el periodo nuevo sea más corto |
| 7 | IRON mensual a FOCUS mensual | Antes de la hoja, aviso de que sustituye. IRON se cierra y FOCUS se abre |
| 8 | Los cuatro a un modo | Se avisa de que es al renovar y hasta entonces siguen los cuatro |
| 9 | Subir durante la prueba | Apple puede tener dos productos activos a la vez; manda el de más nivel |
| 10 | Cancelar la hoja de pago | Sin error ni cambios |
| 11 | Restaurar en la misma cuenta, sin compras | "Esta cuenta de la tienda no tiene ninguna suscripción" |
| 12 | Restaurar en la misma cuenta, con compra | Modos correctos |
| 13 | Comprar, borrar la cuenta de NIVL, crear otra y restaurar | Mismos modos en el uuid nuevo. Es el defecto de `PROPUESTA-RESTAURACION.md`: no se ha probado nunca con StoreKit |
| 14 | Restaurar en otra cuenta viva de NIVL | La anterior pierde el derecho y la nueva lo recibe |
| 15 | Reembolso desde el panel de sandbox | Modos cerrados. Sin venta creada en sandbox |
| 16 | Caducar sin renovar | Mundo cerrado, datos intactos |
| 17 | Modo avión con la oferta abierta | Error con Reintentar, nunca precio inventado |
| 18 | Cuenta de revisión en cada idioma publicado | Letra, botones y errores en ese idioma |

Tras cada compra, en Supabase: fila de `subscriptions` con `store_product_id` correcto y `store_environment = SANDBOX`, evento en `store_events` y ninguna fila nueva en `store_sales`.

## 13. Comprobación final por producto

Marcar solo tras verlo en el panel o en el iPhone.

| Producto | ASC listo | Nivel | Precio | Intro 1 semana | 6 idiomas | Captura | Marcado en 1.1.0 | RC producto | RC paquete en Current | Play (producto + base plan + oferta) | Compra sandbox | `mis_modos` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `nivl_iron_mensual` | [ ] | 4 | 14,99 [ ] | no aplica | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] `mensual` | [ ] | iron |
| `nivl_iron_anual` | [ ] | 4 | 59,99 [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] `anual` + `prueba-7d` | [ ] | iron |
| `nivl_focus_mensual` | [ ] | 4 | 14,99 [ ] | no aplica | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] `mensual` | [ ] | focus |
| `nivl_focus_anual` | [ ] | 4 | 59,99 [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] `anual` + `prueba-7d` | [ ] | focus |
| `nivl_work_mensual` | [ ] | 4 | 14,99 [ ] | no aplica | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] `mensual` | [ ] | work |
| `nivl_work_anual` | [ ] | 4 | 59,99 [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] `anual` + `prueba-7d` | [ ] | work |
| `nivl_founder_mensual` | [ ] | 4 | 14,99 [ ] | no aplica | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] `mensual` | [ ] | founder |
| `nivl_founder_anual` | [ ] | 4 | 59,99 [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] `anual` + `prueba-7d` | [ ] | founder |
| `nivl_todos_mensual` | [ ] | 1 | 30 [ ] | no aplica | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] `mensual` | [ ] | los cuatro |
| `nivl_todos_anual` | [ ] | 1 | 99 [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] `anual` + `prueba-7d` | [ ] | los cuatro |
