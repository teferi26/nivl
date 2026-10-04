# Fase 3 · Capturas de revisión de las 5 suscripciones (build 1.0.8)

Chat 2 · Compras, subagente B. Fecha: 2026-10-04. Solo documentación: aquí no se ha subido nada a App Store Connect (ASC) ni se ha cambiado nada fuera del repo.
**Quién las sube:** el coordinador o el Chat 1 (Tiendas). **Quién las hace:** el dueño o el Chat 5 (QA), en un iPhone con la build 1.0.8 de TestFlight.

## 1. Qué exige Apple (ayuda oficial, consultada el 2026-10-04)

| Regla | Texto oficial (resumido) | Fuente |
|---|---|---|
| Qué es | Se pide una captura de la compra integrada que **muestre con claridad el artículo o servicio que se ofrece**. Solo la ve App Review: **no aparece en la App Store**. | [In-App Purchase information](https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-information) |
| Tamaño | Tiene que cumplir **cualquiera** de las especificaciones de captura que admita la app. | ídem |
| Sustituir | Una vez subida, se puede **actualizar, pero no borrar**. | ídem |
| Dónde va | Producto → «Información de revisión»: captura y notas para el revisor. | [Offer auto-renewable subscriptions](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions) |
| Tamaños iPhone 6,9" | 1260×2736, 1290×2796 o **1320×2868** px en vertical (iPhone 16/17/18 Pro Max, Air…). Formato `.png`, `.jpg` o `.jpeg`. | [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications) |
| Otros tamaños válidos | 6,3": 1206×2622 o 1179×2556 (iPhone 15/16/17 Pro). 6,5": 1284×2778 o 1242×2688. | ídem |
| Formato | **Sin canal alfa ni transparencias.** | ídem |
| Primer envío | La primera suscripción autorrenovable va **con una versión nueva de la app**. Si el grupo no está aprobado, se envía junto con él. | [Submit an In-App Purchase](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase) |

**¿Vale una misma captura para varios productos?** La ayuda no lo prohíbe, porque cada producto tiene su propio campo. Pero la captura tiene que mostrar «el artículo que se ofrece». Por eso hacemos **una captura distinta por producto**, con ese producto seleccionado y su botón de compra con el precio. Así cada revisión ve su producto sin tener que adivinar. Es la misma decisión que los casos CAP-01…05 de `docs/qa-audit/QA-FISICA-WINTER.csv`.

**Situación actual.** Las 5 capturas que hay en ASC son del **paywall antiguo**: pestañas por nivel, «−36 %» y «4 meses gratis · 8,33 €/mes» (`ahorro()`/`mesesGratis()` de `proplans.ts`, que hoy solo usa el catálogo sin tienda). Contradicen la pantalla que verá el revisor. **Hay que sustituirlas por capturas de la 1.0.8 antes de enviar la 1.0.8**, que lleva el grupo «NIVL» y los 5 productos: según `docs/appstore-review-2026-09-29/AUDITORIA.md`, los productos base están en READY_TO_SUBMIT.

## 2. Qué pinta la pantalla en la 1.0.8 (código actual)

Se entra por Perfil → «NIVL Pro» (`/pro`, `ProOffer` sin `compact`). Con la tienda abierta, `planesArriba` coloca la lista de planes encima de los beneficios.

- **Fila de cada producto** (`ProOffer.tsx` ~l.360-405):
  - título `tituloPlan(id)`, por ejemplo «NIVL Élite fundador»;
  - línea `duracionPlan(id)` + «renovación automática» + `pitchVisible(p)`, por ejemplo «Anual · 1 año · renovación automática · Se cobra una vez al año»;
  - a la derecha, el `priceString` de StoreKit y «al año» o «al mes».
- **Plan elegido:** radio marcado. El plan que ya tiene la cuenta sale como «Tu plan actual» y no se puede elegir.
- **Botón principal** (`ProOfferActions`): «Activar NIVL Pro anual · 99,99 € al año». El importe es el `priceString`.
- **Pie** (`ProOfferLegal`): botón «Restaurar compras» y, debajo, `legalText()`. Ese texto incluye el título, «suscripción anual (1 año) de renovación automática: <priceString> cada año», la cancelación 24 h antes y dónde se gestiona en iOS. Después vienen los enlaces «Términos de uso · Política de privacidad · EULA de Apple». El EULA solo aparece en iOS.
- **Fundador:** solo aparece mientras `founder_seats_left() > 0` (`planesALaVenta`). Si el servidor no responde (`null`), también se muestra. Su letra añade «Oferta limitada a 100 plazas: no es un pago único ni vitalicio…».
- **Avisos que no deben salir en ninguna captura:**
  - «Cargando precios de la tienda»;
  - «Algún plan no está disponible ahora mismo en la tienda…»: significa que la offering de RevenueCat no devuelve los 5;
  - «No se han podido cargar los precios…».

## 3. Estado previo común (antes de cualquier captura)

1. **Build:** la 1.0.8 final de TestFlight, con el SHA del paywall aprobado por el Chat 2. Una OTA posterior que cambie `ProOffer` o `proplans` obliga a repetir las capturas.
2. **Dispositivo:** iPhone de 6,9" (16, 17 o 18 Pro Max) en vertical. Da 1320×2868 directamente. Si no hay ninguno, un iPhone 15/16/17 Pro (6,3") también cumple la especificación (1206×2622 / 1179×2556), aunque es preferible el de 6,9".
3. **Tienda:** el Apple ID del iPhone, que TestFlight usa en el entorno sandbox, tiene que tener **storefront España**. Así el `priceString` sale en euros y en el formato es-ES («12,99 €»). La app en español.
4. **Cuenta NIVL:** una cuenta de QA **gratuita y sin suscripción**.
   - No vale la revisora de Apple, ni las del ludus de demostración, ni una cuenta real.
   - Recomendado: que ya haya gastado la prueba de servidor de 7 días. Así solo se ve el botón de compra de tienda y no el de «probar gratis», que no es una compra integrada y puede confundir al revisor.
   - Con una cuenta Pro o en prueba, `/pro` enseña «Tu plan» y uno de los productos saldría como «Tu plan actual». **No sirve.**
5. **Fundador visible:** confirmar antes que `founder_seats_left()` es mayor que 0 en producción (cuenta solo ventas PRODUCTION). Si llegara a 0, la fila no se puede capturar. En ese caso lo correcto es retirar el producto de la venta en ASC, no fabricar la captura.
6. **Limpieza de la pantalla:**
   - modo No molestar;
   - sin notificaciones;
   - barra de estado normal;
   - nada de datos personales a la vista (en `/pro` no se muestra el correo; comprobarlo).
7. **Comprobación previa:** abrir `/pro`, esperar a que desaparezcan los esqueletos y comprobar que aparecen **las 5 filas** sin el aviso «Algún plan no está disponible». Si el aviso aparece, se para todo: es un fallo de la offering (A6/O-09), no de las capturas.

**Nunca se pulsa «Activar…», «Restaurar compras» ni «probar gratis».** La captura se hace con el producto seleccionado, antes de comprar.

## 4. Especificación por producto

Todas las capturas son en `/pro`, con la cuenta y el iPhone del §3. «Encuadre» describe qué tiene que caber en la **única** imagen que admite el campo.

### Encuadre recomendado

Desplazar la pantalla hasta que se vean a la vez:

1. la fila seleccionada (título, duración, «renovación automática» y `priceString`);
2. el botón «Activar <título> · <priceString> al <periodo>».

Si además caben «Restaurar compras», la letra de renovación y los enlaces legales, mejor. Si no caben, priman (1) y (2): Apple pide que se vea el artículo ofrecido, y los enlaces los comprueba el revisor en la app y en el vídeo 2.1.

**Nada de montajes ni de unir dos capturas:** la imagen tiene que ser la pantalla real.

| # | Producto (ASC) | Título visible | Duración visible | Precio esperado (`priceString`, ES) | Texto de renovación visible | Archivo |
|---|---|---|---|---|---|---|
| CAP-01 | `nivl_pro_mensual` | NIVL Pro mensual | Mensual · 1 mes · renovación automática · Sin permanencia | 12,99 € al mes | «NIVL Pro mensual es una suscripción mensual (1 mes) de renovación automática: 12,99 € cada mes…» | `iap-review_nivl_pro_mensual_1320x2868.png` |
| CAP-02 | `nivl_pro_anual` | NIVL Pro anual | Anual · 1 año · renovación automática · Se cobra una vez al año | 99,99 € al año | «…suscripción anual (1 año) de renovación automática: 99,99 € cada año…» | `iap-review_nivl_pro_anual_1320x2868.png` |
| CAP-03 | `nivl_elite_mensual` | NIVL Élite mensual | Mensual · 1 mes · renovación automática · Sin permanencia | 29,99 € al mes | «…29,99 € cada mes…» | `iap-review_nivl_elite_mensual_1320x2868.png` |
| CAP-04 | `nivl_elite_anual` | NIVL Élite anual | Anual · 1 año · renovación automática · Se cobra una vez al año | 299,00 € al año | «…299,00 € cada año…» | `iap-review_nivl_elite_anual_1320x2868.png` |
| CAP-05 | `nivl_elite_fundador` | NIVL Élite fundador | Anual · 1 año · renovación automática · Plazas limitadas · precio congelado | 249,00 € al año | «…249,00 € cada año. Oferta limitada a 100 plazas: no es un pago único ni vitalicio…» | `iap-review_nivl_elite_fundador_1320x2868.png` |

- El formato exacto del `priceString` lo da StoreKit (por ejemplo «299,00 €» o «299 €»). **Hay que copiar el que salga, no el de esta tabla.** Si no coincide con el precio de ASC para España, se para.
- Al tocar una fila de Élite, la pantalla cambia al nivel Élite (`elegir` → `setTier`) y muestra sus beneficios y el aviso de uso. Es lo esperado.
- Con otro tamaño de dispositivo, el sufijo del archivo cambia (`_1206x2622` o el que corresponda).
- **Notas para el revisor** (campo «Notas de revisión» de cada producto, texto propuesto):
  > Abra Perfil → «NIVL Pro». Los cinco planes del grupo «NIVL» aparecen en una sola lista con su título, duración y precio de la App Store. Seleccione «<título>» y pulse «Activar…». Hay una cuenta de prueba en la información de revisión de la app. El fundador es una suscripción anual de renovación automática, limitada a 100 plazas; no es un pago único.

## 5. Checklist de verificación (por cada archivo)

- [ ] Captura hecha en la build 1.0.8 final: anotar el número de build y el SHA.
- [ ] Tamaño exacto aceptado. En macOS se comprueba con `sips -g pixelWidth -g pixelHeight -g hasAlpha archivo.png`: **hasAlpha: no**. Si tiene alfa, exportar a JPEG o quitar el canal alfa.
- [ ] Vertical, PNG o JPEG, nombre según la tabla.
- [ ] Se ven el título igual que en ASC es-ES, la duración, «renovación automática» y el `priceString` en euros.
- [ ] La fila del producto está **seleccionada**, y el botón «Activar <mismo título> · <mismo precio>» coincide con ella.
- [ ] No aparecen «−36 %», «meses gratis», «8,33 €/mes» ni ningún equivalente mensual de un anual.
- [ ] No hay avisos de carga, de error ni de «Algún plan no está disponible».
- [ ] No aparece «Tu plan actual»: la cuenta no está suscrita.
- [ ] Fundador: aparece «Plazas limitadas · precio congelado» y, si cabe, «no es un pago único ni vitalicio».
- [ ] Si caben, se ven «Restaurar compras», la letra de renovación y los enlaces Términos de uso · Política de privacidad · EULA de Apple. Si no caben, queda anotado que se verifican en el vídeo 2.1 (QA-FISICA, caso 1).
- [ ] Sin datos personales y sin notificaciones.
- [ ] Anotado en `docs/qa-audit/MATRIZ-QA.md`: dispositivo, iOS, build, tipo de cuenta (sin credenciales) y PASS/FAIL. El Chat 5 es el dueño de ese archivo.

## 6. Cómo producirlas

### A. Manual en TestFlight (vía principal)

1. Instalar la 1.0.8 de TestFlight en el iPhone 6,9" e iniciar sesión con la cuenta de QA del §3.
2. Perfil → «NIVL Pro». Comprobación previa del §3.7.
3. Para cada producto: tocar la fila, desplazar hasta el encuadre del §4 y hacer la captura con los botones lateral + volumen arriba.
4. Pasar las imágenes al Mac con AirDrop, en «Tamaño real», no en las versiones reducidas. Comprobar el tamaño y el alfa, y renombrar.
5. Guardarlas **fuera del repo** (por ejemplo, la carpeta de entregables del coordinador) o en `qa-out/` (local, no se sube).

### B. Maestro (opcional; encaja con el Chat 5 · Juego y QA)

- Ya existe `e2e/maestro/pro-planes.yaml`, de solo lectura, que hace `pro-10…pro-15`. **Sus selectores están desfasados** respecto a `ProOffer` actual:
  - espera `'^NIVL Pro mensual, .+ al mes\..*'`, pero el `accessibilityLabel` real es «NIVL Pro mensual. Suscripción mensual de renovación automática, 12,99 € al mes. Sin permanencia»;
  - espera `'^Activar NIVL Pro · .+/mes$'`, pero el botón real dice «Activar NIVL Pro mensual · 12,99 € al mes».

  Ese archivo es del Chat 5: le paso la corrección y no lo toco.
- Propuesta de bloque para un flujo nuevo del Chat 5, `e2e/maestro/capturas-revision-iap.yaml`, de solo lectura. Usaría la misma cuenta de QA del §3, **no** la cuenta demo de capturas, que tiene Pro por concesión manual y mostraría «Tu plan»:

```yaml
appId: com.teferi.nivl
name: NIVL capturas de revisión IAP (solo lectura)
---
- launchApp: { stopApp: true, clearState: false, permissions: { notifications: deny } }
- openLink: nivl://pro
- extendedWaitUntil: { notVisible: '^Cargando precios de la tienda$', timeout: 30000 }
- assertNotVisible: '^Algún plan no está disponible.*'
- scrollUntilVisible: { element: { text: '^NIVL Pro mensual\. Suscripción mensual.*' }, direction: DOWN }
- tapOn: '^NIVL Pro mensual\. Suscripción mensual.*'
- assertVisible: '^Activar NIVL Pro mensual · .+ al mes$'
- takeScreenshot: iap-review_nivl_pro_mensual
# Repetir para «NIVL Pro anual\. Suscripción anual.*» / «al año»,
# «NIVL Élite mensual…», «NIVL Élite anual…» y, dentro de runFlow when visible,
# «NIVL Élite fundador\. Suscripción anual.*».
```

- **Límites de esta vía:**
  - Maestro es fiable en simulador, no en iPhone físico (lo dice `e2e/maestro/README.md`).
  - Un simulador iPhone 16/17 Pro Max da exactamente 1320×2868.
  - Que el simulador cargue precios reales de sandbox (cuenta sandbox en Ajustes → Developer) está **NO VERIFICADO**. Si no carga, el flujo se para en la espera, y eso no es un fallo de la app.
  - Con cualquiera de las dos vías, `takeScreenshot` captura el estado del momento. El encuadre tiene que incluir el botón: puede hacer falta un `scroll` adicional antes de cada captura.
- Si esta vía funciona, sirve también para volver a generar las capturas después de cada cambio del paywall.

### C. Subida (coordinador / Chat 1)

ASC → app NIVL → Monetización → Suscripciones → grupo «NIVL» → producto → **Información de revisión** → Captura de pantalla → sustituir (no se puede dejar vacía), y pegar la nota del §4. Repetir con los 5. Después, con la 1.0.8, enviar la versión con el grupo y los 5 productos añadidos al envío.

## 7. Pendientes y dependencias

- **Chat 5:** hacer CAP-01…05 (casos P0 ya creados) y corregir los selectores de `pro-planes.yaml`.
- **Coordinador/Chat 1:** subir las capturas y las notas, y confirmar que la offering de RevenueCat devuelve los 5 productos con storefront ES.
- **Chat 2:** dar el SHA final del paywall. Cualquier cambio posterior en `ProOffer.tsx`, `proplans.ts` o los textos invalida las capturas.
- Nada de esto se ha probado en dispositivo: **NO PROBADO**.
