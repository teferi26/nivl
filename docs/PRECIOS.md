# NIVL — precios, niveles y la cuenta que no puede fallar

Rehecho el 2026-09-24 (sustituye a la versión de 9,99/79,99 € del 2026-09-19).
Si cambias un precio, un presupuesto de `ai_plans`, el proveedor del modelo o
una comisión de creador, rehaz las tablas de abajo antes de publicar.

Dominio y marca: **NIVL** («se dice *nivel*»), `nivl.app`, `@nivl.app` en
Instagram, TikTok y YouTube.

## La oferta: tres niveles

| | Gratis | **Pro** | **Élite — el 1 %** |
|---|---|---|---|
| Hábitos, misiones, XP, racha, contrato, campañas, agenda | sí | sí | sí |
| Gym, cardio, nutrición, peso, diario, avances, economía | sí | sí | sí |
| Amigos, ranking y compartir progreso | sí | sí | sí |
| Coach de IA (brief, plan del día, chat, revisión semanal, entreno y dieta) | no | **Estándar** (DeepSeek) | **Máxima potencia** (Sonnet) + modo profundo (Sonnet a `xhigh`) |
| Comunidad privada, grupos de 5-8 por objetivo, ranking propio | no | no | sí |
| Revisión semanal profunda (semana + ficha física + fotos) | no | no | sí |
| Insignia dorado laurel, acceso anticipado, retos trimestrales con premio | no | no | sí |

| Plan | Mensual | Anual |
|---|---|---|
| Pro | **12,99 €** | **99,99 €** (8,33 €/mes · −36 %) |
| Élite | **29,99 €** | **299 €** · fundador **249 €** (100 plazas, precio congelado) |

- Prueba gratis de 7 días: `plan = 'cortesia'` con presupuesto propio de
  **0,50 $**, nunca el presupuesto entero.
- La insignia y la comunidad del Élite son estatus, **no XP**: nada de pagar
  para ganar en el ranking general.
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
| Élite mensual | 29,99 € | 24,79 € | 21,07 € | 17,35 € |
| Élite anual | 299 € | 247,11 € | 210,04 € | 172,98 € |
| Élite fundador | 249 € | 205,79 € | 174,92 € | 144,05 € |

## Lo que puede gastar una cuenta en IA

`ai_plans.monthly_budget_micro_usd`, cortado en servidor por `ai_begin_turn`
(0020). El exceso máximo es una sola llamada: ~0,05 $ con DeepSeek, ~0,30 $
con Sonnet. 1 $ ≈ 0,93 €.

| Plan | Modelo | Presupuesto/mes | **Peor caso/mes** | Peor caso/año |
|---|---|---|---|---|
| Prueba (cortesía) | DeepSeek | 0,50 $ | 0,51 € | — |
| Pro | DeepSeek | 1,50 $ | **1,44 €** | 17,30 € |
| Élite | Sonnet (2,50 $ estándar + 1,50 $ profundo) | 4,00 $ | **4,00 €** | 48,00 € |

Qué compra el presupuesto (medido sobre la cuenta más pesada; una normal
lleva 4-5 veces menos contexto):

| Turno | Sonnet 5 | DeepSeek v4 flash |
|---|---|---|
| Chat | 0,20 $ | 0,056 $ |
| Brief de la mañana | 0,30 $ | 0,036 $ |
| Revisión semanal | 0,48 $ | 0,029 $ |

**El Pro solo existe con DeepSeek.** Con Sonnet, 1,50 $ son 5 briefs. Requisito
de lanzamiento: el enrutado por plan (Pro → DeepSeek, Élite → Anthropic a la
vez) y los secrets de DeepSeek puestos en el panel de Supabase.

## Programa de creadores (clippers)

| Rango | Comisión | Por venta anual |
|---|---|---|
| Novato | 25 % | 25 € |
| Pro | 35 % | 35 € |
| Élite | 50 % | 50 € |

Reglas:

1. **La base es siempre 100 €**, compre el usuario Pro o Élite.
2. **Solo el primer pago.** Renovaciones: 0 % (parámetro; como mucho 10 %).
3. **Retención de 30 días** por reembolsos: si Apple o Google devuelven el
   dinero (webhook de RevenueCat), la comisión se anula.
4. **Mensual**: el creador cobra su % **del neto de cada mes cobrado** hasta
   llegar a lo mismo que en el anual (25/35/50 €). Sustituye a la idea de
   «pagar entera al tercer mes»: con el Pro mensual, 3 meses dejan 27 € limpios
   y pagar 50 € ese día pierde dinero si el usuario se va en el cuarto.
5. El rango se gana por resultados; los Élite pueden llevar además un fijo
   mensual y el premio del primero del ranking, que salen del presupuesto de
   marketing, no de esta tabla.
6. Las vistas (CPM) se pagan fuera, en Whop Content Rewards, también con
   presupuesto de marketing.

## La cuenta que no puede fallar: primer año por venta

Limpio − comisión del creador − IA en el peor caso. Las renovaciones no llevan
comisión y dejan mucho más.

| Venta | Tienda 15 %, creador 50 € | Tienda 30 %, creador 50 € | Tienda 30 %, creador 35 € |
|---|---|---|---|
| Pro anual | **+2,94 €** | **−9,45 €** ⚠ | +5,55 € |
| Élite anual | +112,04 € | +74,98 € | +89,98 € |
| Élite fundador | +76,92 € | +46,05 € | +61,05 € |

| Venta mensual (por mes, mientras cobra) | Tienda 15 %, creador 50 % | Tienda 30 %, creador 50 % |
|---|---|---|
| Pro mensual | +3,12 € | +2,31 € |
| Élite mensual | +6,53 € | +4,68 € |

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
