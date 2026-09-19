# NIVL Pro — precios y la cuenta que no puede fallar

Escrito el 2026-09-19 con los costes reales de `coach_runs`. Si cambias un
precio, un presupuesto de `ai_plans` o el proveedor del modelo, rehaz la
tabla de abajo antes de publicar.

## La oferta

| | Gratis | NIVL Pro |
|---|---|---|
| Hábitos, misiones, XP, racha, contrato, campañas, agenda | sí | sí |
| Gym, cardio, nutrición, peso, diario, avances, economía | sí | sí |
| Amigos, ranking y compartir progreso | sí | sí |
| **Coach de IA**: brief cada mañana, plan del día, chat, revisión semanal, entreno y dieta prescritos | no | **sí** |

- **Mensual: 9,99 €/mes.**
- **Anual: 79,99 €/año** (6,67 €/mes · −33 % · «4 meses gratis»).

Lo gratis es la app entera sin IA: tiene que ser buena de verdad, porque es la
que hace el boca a boca. Lo que se paga es lo único que nos cuesta dinero.

## Lo que entra limpio, en el peor caso

IVA 21 % incluido en el precio. La comisión de tienda se aplica sobre el
precio sin IVA. Apple y Google cobran 15 % dentro del Small Business Program
(menos de 1 M $/año; **hay que solicitarlo**, no es automático) y 30 % fuera.

| Plan | Precio | Sin IVA | Limpio al 15 % | Limpio al 30 % | **Limpio/mes, peor caso** |
|---|---|---|---|---|---|
| Mensual | 9,99 € | 8,26 € | 7,02 € | 5,78 € | **5,78 €** |
| Anual | 79,99 € | 66,11 € | 56,19 € | 46,28 € | **3,86 €** |

## Lo que puede gastar una cuenta

`ai_plans.monthly_budget_micro_usd` = **2,50 $** al mes para mensual, anual y
cortesía. El candado (`ai_begin_turn`, migración 0020) corta en el servidor al
llegar; el tope por turno se recorta a lo que quede, así que el exceso máximo
es una sola llamada al modelo: ~0,05 $ con DeepSeek, ~0,30 $ con Sonnet.

Peor caso absoluto por usuario y mes: **2,80 $ ≈ 2,60 €** (tratando 1 $ = 0,93 €;
aunque el dólar llegara a la paridad, 2,80 €).

| Plan | Limpio/mes peor caso | Gasto IA máximo | **Margen mínimo** |
|---|---|---|---|
| Mensual | 5,78 € | 2,80 € | **+2,98 €** |
| Anual | 3,86 € | 2,80 € | **+1,06 €** |

Ningún usuario de pago puede costar más de lo que deja, ni en el peor plan, ni
con la peor comisión, ni gastando el 100 % de su IA todos los meses. El usuario
típico gasta una fracción del tope, y una cuenta gratuita gasta **cero** de IA
(el candado la rechaza antes de llamar a ningún modelo).

Costes fijos a repartir: Supabase Pro 25 $/mes, Apple Developer 99 $/año,
EAS según builds. Con el margen medio real (~4-5 €/usuario) se cubren con
unos 10 suscriptores.

## Qué compran 2,50 $ — y por qué el proveedor importa

Medido en producción sobre la cuenta más pesada que existe (dossier de 12.000
tokens + estudios; una cuenta nueva lleva 4-5 veces menos contexto):

| Turno | Sonnet 5 | DeepSeek v4 flash (tarifa de hora punta) |
|---|---|---|
| Chat | 0,20 $ | 0,056 $ |
| Brief de la mañana | 0,30 $ | 0,036 $ |
| Revisión semanal | 0,48 $ | 0,029 $ |

- **Con DeepSeek**: 30 briefs (1,08 $) + 4 revisiones (0,12 $) dejan 1,30 $ →
  unos 25 chats/mes en la cuenta más pesada, 80-120 en una cuenta normal. Es
  un producto completo.
- **Con Sonnet**: los 2,50 $ se van en 8 briefs. No perdemos dinero (el candado
  corta igual), pero el usuario se queda sin IA el día 9 y se da de baja.

**Requisito de lanzamiento**: los secrets `COACH_BASE_URL`, `COACH_API_KEY` y
`COACH_MODEL_CHAT` (DeepSeek) puestos en el panel de Supabase. Hoy NO están:
producción corre en Sonnet. El dueño (`plan = 'owner'`, 40 $/mes de techo de
seguridad) puede seguir en el modelo que quiera con `COACH_MODEL_RITUAL`.

## Por qué no Stripe dentro de la app

La Guideline 3.1.1 de Apple y la política de pagos de Google Play obligan a
vender las suscripciones de contenido digital con su compra integrada. Un
enlace de Stripe dentro de la app = rechazo en revisión. Por eso:

- **iOS y Android**: compra integrada (StoreKit / Play Billing) vía RevenueCat,
  que avisa por webhook y escribe en `subscriptions` con `provider = 'apple'`
  o `'google'`.
- **Web (nivl.app)**: Stripe, con el webhook que ya existe
  (`provider = 'stripe'`), sin comisión de tienda. La app no puede enlazarlo.

La tabla `subscriptions` y el candado son agnósticos del proveedor: a
`ai_begin_turn` le da igual quién cobró.

## Palancas si algún día hace falta

- Subir o bajar el tope: `update ai_plans set monthly_budget_micro_usd = …`.
  Sin desplegar nada.
- Recarga de IA de pago único (consumible) para quien agote el mes.
- Prueba gratuita de 7 días: solo con `plan = 'cortesia'` y un presupuesto
  propio más bajo (p. ej. 0,50 $), nunca con el presupuesto entero.
