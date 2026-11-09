# NIVL — precios, niveles y la cuenta que no puede fallar

Rehecho el 2026-11-08 para el cobro por modos de la 1.1 (sustituye a Pro/Élite).
Si cambias un precio, un presupuesto de `ai_plans`, el proveedor del modelo o
una comisión de creador, rehaz las tablas de abajo antes de publicar.

Dominio y marca: **NIVL** («se dice *nivel*»), `nivl.app`, `@nivl.app` en
Instagram, TikTok y YouTube.

## La oferta: se paga por modo (1.1)

| | Gratis | Un modo | Los cuatro |
|---|---|---|---|
| NIVL base: hábitos, misiones, XP, racha, contrato, campañas, agenda, amigos | sí | sí | sí |
| Mundo IRON, FOCUS, WORK o FOUNDER | no | el suyo | los cuatro |
| Coach de ese mundo (cabecera `x-nivl-modo`, candado en servidor) | no | el suyo | los cuatro |

| Producto | Mensual | Anual |
|---|---|---|
| Un modo (IRON, FOCUS, WORK o FOUNDER) | **14,99 €** | **59,99 €**, 7 días gratis |
| Los cuatro | **29,99 €** | **99,99 €**, 7 días gratis |

- El anual lleva 7 días gratis (oferta introductoria de la tienda) y el mensual no.
- No hay combinaciones de 2 o 3: dos modos ya cuestan lo mismo que los cuatro, y
  Apple permite una sola suscripción activa por grupo.
- Élite desaparece y Haiku 5.5 es el único modelo.
- **Quien ya pagó Pro o Élite conserva todo hasta que caduque.** Las tablas de
  esos planes siguen en `ai_plans` y `store_products`: se dejan de vender, no de
  atender. Las pruebas y cortesías del servidor abren todo mientras duran.
- Los datos de un modo no se borran al dejar de pagar: el mundo se cierra y
  enseña su oferta; lo registrado sigue ahí.
- Sin suscripción, el coach no está incluido (como hasta ahora). Con un solo
  modo también se puede hablar con el coach General de NIVL: la decisión está en
  `coach/handler.ts` y es la que permite que rituales y binarios antiguos sigan
  sin cabecera.

Precios, productos y derechos: `src/lib/planesmodo.ts` (con tests), `public.ai_modos` (0140).

## Lo que entra limpio

IVA 21 % incluido en el precio. La comisión de tienda se aplica sobre el
precio sin IVA: 15 % dentro del Small Business Program (menos de 1 M $/año;
**hay que solicitarlo**) y 30 % fuera (solo el primer año de cada
suscripción; desde el segundo, 15 % siempre).

| Producto | Precio | Sin IVA | Limpio al 15 % | Limpio al 30 % |
|---|---|---|---|---|
| Un modo, mensual | 14,99 € | 12,39 € | 10,53 € | 8,67 € |
| Un modo, anual | 59,99 € | 49,58 € | 42,14 € | 34,71 € |
| Los cuatro, mensual | 29,99 € | 24,79 € | 21,07 € | 17,35 € |
| Los cuatro, anual | 99,99 € | 82,64 € | 70,24 € | 57,85 € |

## Un solo modelo: `claude-haiku-5-5`

Decisión del dueño (8-nov-2026): toda la IA va con Haiku 5.5, en todos los planes y sin selector. Se retiran
el modo profundo, «máxima potencia» y la revisión con otro modelo. Que el coach vea fotos ya no depende del modelo.

| Por millón de fichas | Entrada | Caché 5 min | Caché 1 h | Lectura de caché | Salida |
|---|---|---|---|---|---|
| Prompt de hasta 100.000 fichas | 0,10 $ | 0,125 $ | 0,20 $ | 0,01 $ | 0,50 $ |
| Prompt de más de 100.000 (toda la petición) | 0,50 $ | 0,625 $ | 1,00 $ | 0,05 $ | 2,50 $ |

El prompt cuenta también la caché leída y escrita. `TECHO_PROMPT` (90.000) mantiene el coach en el tramo barato.

Coste calculado con esta tarifa sobre la cuenta más pesada (76.000 fichas de prefijo y 650 de salida). Aún no
está medido en producción; Haiku 5.5 cuenta ~30 % más fichas que Haiku 4.5:

| Turno | Coste |
|---|---|
| Chat, primer mensaje en frío | ~0,01 $ |
| Chat, mensajes siguientes (leen la caché) | ~0,002 $ |
| Brief ligero (plan ya escrito) | < 0,001 $ |

## El freno de gasto (0140, con la cuenta de la 0090)

Quien paga no ve contadores. El tope mensual es un freno solo contra abusos y,
como mucho, lo que deja la cuota al mes, a 1 $ = 0,93 €, redondeado hacia abajo.
`update ai_plans set monthly_budget_micro_usd = …`, sin desplegar.

| Plan | Limpio al mes | En dólares | **Freno** | Peor caso/año |
|---|---|---|---|---|
| Un modo, mensual | 10,53 € | 11,32 $ | **11 $** | 122,76 € |
| Un modo, anual | 3,51 € | 3,78 $ | **3,50 $** | 39,06 € |
| Los cuatro, mensual | 21,07 € | 22,66 $ | **22 $** | 245,52 € |
| Los cuatro, anual | 5,80 € | 6,23 $ | **6 $** | 66,96 € |
| Prueba (`cortesia`, también la de 7 días del anual) | sin ingreso | sin ingreso | 0,50 $ | |

El de un modo anual es el freno más ajustado: mide con uso real de Haiku 5.5 que
una persona normal no lo alcance.

Los planes antiguos conservan el suyo hasta caducar (Pro mensual 9 $, Pro anual 6 $, Élite 15 a 22 $).

## Programa de creadores (clippers)

| Rango | % del beneficio | Tope por cuenta |
|---|---|---|
| Novato | 25 % | 25 € |
| Pro | 35 % | 35 € |
| Élite (rango de creador, no el plan retirado) | 50 % | 50 € |

Reglas (0141):

1. **El creador cobra sobre el beneficio, no sobre la facturación.** Beneficio =
   neto del cobro (sin IVA ni tienda) menos el coste real de IA de esa cuenta.
   Nunca es negativo: un mes con más IA que ingreso deja 0 €.
2. **Se calcula mes a mes.** Un anual se reparte en 12 tramos y cada uno se
   devenga al cerrarse su mes (`devengar_comisiones`, cada noche); el coste de
   IA de un anual no se conoce el día del pago.
3. **Solo el primer anual.** Renovaciones: 0 % (parámetro; como mucho 10 %, también
   sobre el beneficio).
4. **Retención de 30 días** por reembolsos: si Apple o Google devuelven el
   dinero (webhook de RevenueCat), los tramos se anulan y lo ya pagado se descuenta.
   Mensual: su % del beneficio de cada mes cobrado, hasta el tope por cuenta.
   **Se paga en múltiplos de 5 €, redondeando hacia abajo** (0142): lo que sobra
   al redondear un pago se queda en NIVL y no se acumula. Por debajo de 5 € no se
   paga y las comisiones siguen disponibles para la siguiente liquidación.
5. El rango se gana por resultados. Un fijo mensual para los creadores Élite o un premio
   al primero del ranking son palancas posibles, del presupuesto de marketing y
   no de esta tabla; **hoy no hay ninguno activo** (las condiciones publicadas
   lo dicen así). Si se activa uno, con bases publicadas antes.
6. Las vistas (CPM) se pagan fuera, en Whop Content Rewards, también con
   presupuesto de marketing.

## La cuenta que no puede fallar: primer año por venta anual

Comisión sobre el beneficio (0141). Ejemplo con la tienda al 15 % y **0,50 € de
IA al mes por cuenta**, cifra ilustrativa y sin medir:

| Venta anual | Neto | Beneficio del año | Novato 25 % | Pro 35 % | Élite 50 % |
|---|---|---|---|---|---|
| Un modo, 59,99 € | 42,14 € | 36,14 € | 9,04 € | 12,65 € | 18,07 € |
| Los cuatro, 99,99 € | 70,24 € | 64,24 € | 16,06 € | 22,48 € | 32,12 € |

La comisión nunca supera el beneficio, así que una venta ya no puede perder
dinero por el creador. Si una cuenta agota el freno todos los meses (un modo
anual: 3,26 € de IA al mes), el beneficio baja a 3 € al año y un creador Élite cobra 1,50 €.

Las **condiciones publicadas para creadores** decían 25/35/50 € por venta anual:
hay que actualizarlas antes de aplicar la 0141.

Costes fijos a repartir: Supabase Pro 25 $/mes, Apple Developer 99 $/año,
dominio nivl.app 15 $/año.

## Por qué no Stripe dentro de la app

La Guideline 3.1.1 de Apple y la política de Google Play obligan a vender las
suscripciones digitales con su compra integrada; un enlace a Stripe dentro de
la app = rechazo. Por eso:

- **iOS y Android**: compra integrada vía RevenueCat, con webhook que escribe
  en `subscriptions` (`provider = 'apple' | 'google'`) y atribuye la comisión.
- **Web (nivl.app)**: Stripe, con el webhook que ya existe, sin comisión de
  tienda. La app no puede enlazarlo.

## Lo que tiene que crear el dueño en las tiendas

Antes de la OTA: sin esto, quien no paga verá los mundos cerrados y no podrá comprar.
Orden: migraciones (0136 antes que 0140) → Edge Functions (`coach`, `economia`,
`revenuecat-webhook`, `store-reconcile`, `stripe-webhook`) → productos → OTA.

**Los diez ids, exactos:** `nivl_iron_mensual`, `nivl_iron_anual`,
`nivl_focus_mensual`, `nivl_focus_anual`, `nivl_work_mensual`, `nivl_work_anual`,
`nivl_founder_mensual`, `nivl_founder_anual`, `nivl_todos_mensual`, `nivl_todos_anual`.

**App Store Connect**
1. Suscripciones autorrenovables, los diez **en el mismo grupo que Pro y Élite**:
   así Apple sigue impidiendo dos suscripciones activas.
2. Niveles del grupo: arriba los dos `todos`; debajo, los ocho de un modo en el
   mismo nivel. Así, de un modo a todos es mejora inmediata.
3. Oferta introductoria gratis de 7 días en los cinco anuales, nunca en los mensuales.
4. Precios de la tabla, nombre visible, descripción y captura de revisión de cada uno.
5. Retirar de la venta los `nivl_pro_*` y `nivl_elite_*` sin borrarlos: las
   suscripciones vivas siguen renovando hasta que el dueño decida otra cosa.

**Google Play Console**: los diez como suscripción, cada uno con su base plan
(`mensual` o `anual`) y, en los anuales, oferta de 7 días gratis para clientes nuevos.

**RevenueCat**: importar los diez y añadirlos a los paquetes de la offering
`current` (la app lee los precios de ahí). El servidor no usa entitlements: va por
id de producto.

**Stripe** (solo si se abre la web): un precio por producto con `lookup_key` igual al id de
la lista. Sin esa clave el webhook lo trataría como Pro antiguo, con los cuatro modos.

## Palancas

- Tope de IA: `update ai_plans set monthly_budget_micro_usd = …`, sin desplegar.
- Comisiones y retención: parámetros, no código.
