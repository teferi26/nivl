# NIVL — precios, niveles y la cuenta que no puede fallar

Rehecho el 2026-09-24 (sustituye a la versión de 9,99/79,99 € del 2026-09-19).
Si cambias un precio, un presupuesto de `ai_plans`, el proveedor del modelo o
una comisión de creador, rehaz las tablas de abajo antes de publicar.

Dominio y marca: **NIVL** («se dice *nivel*»), `nivl.app`, `@nivl.app` en
Instagram, TikTok y YouTube.

## La oferta: tres niveles

> **8-nov-2026:** Élite se retira de la venta. Quien ya lo paga conserva el coach hasta que caduque su
> suscripción. El dueño está valorando cobrar por modos (FOCUS, WORK, GYM, FOUNDER); hasta que se cierre, los
> precios de Pro siguen como están.

| | Gratis | **Pro** |
|---|---|---|
| Hábitos, misiones, XP, racha, contrato, campañas, agenda | sí | sí |
| Gym, cardio, nutrición, peso, diario, avances, economía | sí | sí |
| Amigos, ranking y compartir progreso | sí | sí |
| Coach de IA (brief, plan del día, chat, revisión semanal, entreno y dieta) | no | sí |

| Plan | Mensual | Anual |
|---|---|---|
| Pro | **12,99 €** | **99,99 €** (8,33 €/mes · −36 %) |

- Prueba gratis de 7 días: `plan = 'cortesia'` con presupuesto propio de
  **0,50 $**, nunca el presupuesto entero.
- Lo gratis es la app entera sin IA y tiene que ser buena de verdad: es la que
  hace el boca a boca.

## Lo que entra limpio

IVA 21 % incluido en el precio. La comisión de tienda se aplica sobre el
precio sin IVA: 15 % dentro del Small Business Program (menos de 1 M $/año;
**hay que solicitarlo**) y 30 % fuera (solo el primer año de cada
suscripción; desde el segundo, 15 % siempre).

| Plan | Precio | Sin IVA | Limpio al 15 % | Limpio al 30 % |
|---|---|---|---|---|
| Pro mensual | 12,99 € | 10,74 € | 9,13 € | 7,51 € |
| Pro anual | 99,99 € | 82,64 € | 70,24 € | 57,85 € |

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

## Lo que puede gastar una cuenta en IA

`ai_plans.monthly_budget_micro_usd`, reservado por llamada en servidor (`ai_reservar`, 0078). Desde la 0090 es
un freno antiabuso que nadie alcanza usando la app a mano. No se ha cambiado con el modelo:

| Plan | Freno al mes | De él, bolsillo profundo en desuso |
|---|---|---|
| Prueba (cortesía) | 0,50 $ | 0 |
| Pro mensual | 9,00 $ | 0 |
| Pro anual | 6,00 $ | 0 |
| Élite mensual (sin venta, heredado) | 22,00 $ | 5,50 $ |
| Élite anual (sin venta, heredado) | 18,00 $ | 4,50 $ |
| Élite fundador (sin venta, heredado) | 15,00 $ | 3,75 $ |

Ese bolsillo sigue restándose del freno mensual: dejarlo a cero subiría el presupuesto de esos planes y esa
decisión no se ha tomado.

## Programa de creadores (clippers)

| Rango | Comisión | Por venta anual |
|---|---|---|
| Novato | 25 % | 25 € |
| Pro | 35 % | 35 € |
| Élite (rango de creador, no el plan retirado) | 50 % | 50 € |

Reglas:

1. **La base es siempre 100 €**.
2. **Solo el primer pago.** Renovaciones: 0 % (parámetro; como mucho 10 %).
3. **Retención de 30 días** por reembolsos: si Apple o Google devuelven el
   dinero (webhook de RevenueCat), la comisión se anula.
4. **Mensual**: el creador cobra su % **del neto de cada mes cobrado** hasta
   llegar a lo mismo que en el anual (25/35/50 €). Sustituye a la idea de
   «pagar entera al tercer mes»: con el Pro mensual, 3 meses dejan 27 € limpios
   y pagar 50 € ese día pierde dinero si el usuario se va en el cuarto.
5. El rango se gana por resultados. Un fijo mensual para los creadores Élite o un premio
   al primero del ranking son palancas posibles, del presupuesto de marketing y
   no de esta tabla; **hoy no hay ninguno activo** (las condiciones publicadas
   lo dicen así). Si se activa uno, con bases publicadas antes.
6. Las vistas (CPM) se pagan fuera, en Whop Content Rewards, también con
   presupuesto de marketing.

## La cuenta que no puede fallar: primer año por venta

Limpio − comisión del creador − IA en el peor caso. Las renovaciones no llevan
comisión y dejan mucho más.

| Venta | Tienda 15 %, creador 50 € | Tienda 30 %, creador 50 € | Tienda 30 %, creador 35 € |
|---|---|---|---|
| Pro anual | **+2,94 €** | **−9,45 €** ⚠ | +5,55 € |

| Venta mensual (por mes, mientras cobra) | Tienda 15 %, creador 50 % | Tienda 30 %, creador 50 % |
|---|---|---|
| Pro mensual | +3,12 € | +2,31 € |

**Regla de ajuste**: mientras estemos en el Small Business Program, todo
cuadra. Si salimos (más de 1 M $/año), la comisión sobre un **Pro anual** baja
a un máximo de 35 %; es la única casilla que pierde.

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

## Palancas

- Tope de IA: `update ai_plans set monthly_budget_micro_usd = …`, sin desplegar.
- Packs de turnos profundos (consumibles) para quien agote el mes.
- Comisiones y retención: parámetros, no código.
