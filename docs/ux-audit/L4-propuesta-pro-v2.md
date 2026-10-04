# L4 · Propuesta para el Chat 2: la oferta Pro en «Mármol y tinta»

Autor: Chat 4 (Experiencia), 2026-10-02. Para el Chat 2, dueño de
`src/app/pro.tsx`, `src/components/ProOffer.tsx` y `src/lib/pro.ts`. El Chat 4
**no ha tocado** ninguno de esos archivos; esto es una propuesta concreta para
que la aplique quien los lleva. Las líneas son las de la rama
`winter2/chat4-experiencia` a esta fecha.

Referencias: `docs/design-v2/SISTEMA.md` (§0 inversión, tabla de componentes),
`src/design/tokens.ts` (`ink`, `type`), kit `src/components/ui`.

## Reglas que no cambian

- Contratos intactos: `useProOffer`, `ProOfferBody`, `ProOfferActions`,
  `ProOfferLegal`, `ProOffer` y `ProUpsellLine` conservan props y textos que
  miran los tests (`src/lib/__tests__/prooffer.test.ts`).
- Siguen visibles, siempre: «Seguir gratis» (o el `exitLabel` que toque),
  «Restaurar compras», «Términos de uso» y «Política de privacidad» (test
  «con motivo siguen visibles la salida, Restaurar, Términos y Privacidad»).
- Sin «≈», sin «/mes» y sin equivalentes mensuales de un anual (8,33, 20,75,
  24,92) en el texto de la oferta: lo exige el test «el importe que se cobra
  es la cifra del plan» (`prooffer.test.ts:290-296`, regex
  `/≈|\/mes|8,33|20,75|24,92/`). `docs/PRECIOS.md:24` sí usa «8,33 €/mes»,
  pero es un documento interno; en pantalla manda el test.
- Sin guion largo en textos visibles. Hoy no hay ninguno en los dos archivos.
- Sin cuentas atrás ni salida escondida: la salida gratuita mantiene el mismo
  tamaño que la acción de pago.

## Una sola inversión: el selector de nivel

SISTEMA §0 permite **una** superficie invertida por pantalla. En la oferta, esa
inversión es el selector **Pro / Élite**: es lo que más decide y lo primero que
se lee. Todo lo demás (planes, beneficios, legales) va en tinta sobre negro.

> Conflicto a resolver antes de aplicar. El `Chip` que hay ahora en el
> worktree (`src/components/ui/Chip.tsx:24-30`, cambio del Chat 4 en
> L3.2) dice que el seleccionado ya **no** se invierte porque «la inversión la
> gastan los botones primarios». Y el CTA de esta propuesta es `Button
> primary`, que es blanco sólido: con el selector invertido habría dos
> inversiones. Opciones: (a) el selector como control segmentado propio
> invertido y el CTA `primary` como excepción documentada en la hoja de pago;
> (b) el selector con el `Chip` v2 (marco de 2 pt, sin relleno) y la única
> inversión es el CTA. El Chat 4 recomienda **(b)** por coherencia con el kit,
> pero el encargo pedía (a): que lo decida el coordinador.

## `src/components/ProOffer.tsx`

| Línea | Hoy | Propuesta v2 |
|---|---|---|
| 37 | `import { SystemButton }` | `import { Button } from '@/components/ui'` (junto a `Card, Chip, Skeleton, Tag`, l. 38). |
| 349, 359 | `SystemButton` «Reintentar precios» `variant="outline" size="sm"` | `Button variant="secondary" size="sm"`. |
| 445 | `Card variant="outline" accent={colors.accentDim}` (énfasis por perfil) | `Card variant="outline"` sin `accent`: el borde hairline ink3 basta; el énfasis lo da el texto ink9. |
| 449-458 | `Chip` por nivel en `styles.niveles` | La inversión de la pantalla (ver conflicto arriba). `accessibilityRole="radiogroup"` y `radio` se mantienen. |
| 459, 712 | `styles.potencia` en `colors.textDim` | `type.bodySm` en `ink.ink8`. |
| 366-372, 733-741 | Plan como `Pressable` con `styles.plan` / `styles.planOn` (`borderColor: colors.accent`, `backgroundColor: colors.accentFaint`) | Plan como **Card outline**: borde hairline `ink.ink3` de 1; al elegirlo, borde `ink.ink10` de **1,5** y fondo sin cambiar (nada de `accentFaint`, que en v2 sería una segunda superficie de color). `pressed` sigue con opacidad 0,7. |
| 752-762 | `radio`, `radioOn`, `radioDot` con `colors.accentDim` / `colors.accent` | Aro `ink.ink4` (1,5); elegido `ink.ink10` con punto `ink.ink10`. |
| 384, 424 | `Tag` «Tu plan actual» y ahorro | `Tag` v2 por defecto (contorno). Sin cambio de texto. |
| 393, 767 | `planDuration` en `colors.accentText` | `type.bodySm` en `ink.ink8`. El acento no se usa para metadatos. |
| 768-771 | `planPitch` `textDim`, `price` `fonts.number`, `period` `textFaint` | `planPitch` `bodySm` ink8; `price` en la familia numérica en `ink.ink9`; `period` `bodySm` `ink.ink6`. |
| 429 | Lista sin tienda: `{p.pitch}` («4 meses gratis · 8,33 €/mes», `proplans.ts`) | **Usar `pitchVisible(p)`** como en la rama con tienda. Hoy, con la tienda cerrada, este texto incumple la regla del test (no salta porque el test monta con `purchasesAvailable: () => true`). |
| 750 | `priceListTitle` `textFaint` | `type.micro` (o el `eyebrow` del kit) en `ink.ink6`. |
| 468, 479 | Iconos de beneficio en `colors.accentText` | `ink.ink9`, Ionicons outline (SISTEMA §iconos: el estado activo es la variante sólida, no un color). |
| 715, 710 | `sep`, `upsell` con `borderTopColor: colors.line` | `ink.ink3` (hairline). |
| 773-786 | `notice` en `colors.accentText`, `noticeWarn` en `textDim` | `notice` `bodySm` `ink.ink8`; `noticeWarn` `bodySm` `ink.ink9` con regla izquierda de 2 px `ink.ink6` (aviso, no color). |
| 513-515 | Rótulo del CTA `` `Activar … · ${precio}/${plan.period}` `` | Con el plan mensual elegido sale «12,99 €/mes»: cae en la regex del test aunque sea el cobro real. Proponemos `` `Activar … · ${precio} al ${plan.period}` ``, igual que la columna de precio («al mes», «al año»). Cambia el texto que busca el test (`'Activar NIVL Pro anual · 99,99 €/año'`): actualizarlo a la vez. |
| 530-571 | `SystemButton` prueba (`lg`), compra directa (`ghost sm`), principal (`lg`) y salida (`outline lg`) | Prueba y principal: `Button variant="primary" size="lg"`. Compra directa: `Button variant="ghost" size="sm"`. Salida: `Button variant="secondary" size="lg"`, **mismo alto que el CTA** (52), nunca `ghost`. |
| 587-595 | `SystemButton` «Restaurar compras» `ghost sm` | `Button variant="ghost" size="sm"`, centrado. Visible siempre que haya tienda. |
| 596, 788 | `legal` 12/17 `textFaint` | `type.bodySm` en `ink.ink6` (14/20: más legible; la letra pequeña no puede ser ilegible). |
| 598-627, 790-791 | `link` `colors.accentText` subrayado; `linkSep` `textFaint` | `link` `bodySm` `ink.ink9` subrayado; `linkSep` `ink.ink6`. |

### `ProUpsellLine` (l. 684-704)

Mismo contrato (`momento`, `tier`, `onPress`), mismo `accessibilityRole="link"`
y mismo hint. Solo la pintura, como fila del kit:

- Fila: `flexDirection: 'row'`, hairline superior `ink.ink3`, alto mínimo 44.
- Icono (l. 695): `ink.ink8`, 16 (hoy `colors.accentText`).
- Línea (l. 697, `styles.benefitDetail`): `type.bodySm` en `ink.ink9`.
- Enlace (l. 700, `styles.link`): `bodySm` en `ink.ink10`, subrayado.
- Chevron (l. 702): `ink.ink6` (hoy `colors.textFaint`).

## `src/app/pro.tsx`

| Línea | Hoy | Propuesta v2 |
|---|---|---|
| 19 | `import { SystemButton }` | `Button` desde `@/components/ui` (l. 21). |
| 181 | `XPBar color={agotada ? colors.accentDim : colors.accent}` | `ink.ink10` llena, `ink.ink6` agotada; pista `ink.ink4`. |
| 219-226 | `SystemButton` «Gestionar o cancelar suscripción» `ghost sm` | `Button variant="ghost" size="sm" icon="open-outline"`. |
| 247 | `SystemButton` «Hablar con el coach» | `Button variant="primary"`: es la acción principal de la pantalla del suscriptor. |
| 277-282 | `SystemButton` «Suscribirme» / «Ver NIVL Élite» `outline` | `Button variant="secondary"`. |
| 197 | `RowValue tone="accent"` | `RowValue` por defecto en `ink.ink9`, `strong`. |
| 330, 333 | `energia` `textDim`, `nota` 12/17 `textFaint` | `energia` `type.body` `ink.ink8`; `nota` `type.bodySm` `ink.ink6`. |
| 336 | `oferta` con `borderTopColor: colors.line` | `ink.ink3`. |

## Verificación propuesta

1. `CI=true npx jest --ci prooffer pro-` sin tocar expectativas salvo la del
   rótulo «al año» si se adopta.
2. Capturas a 375 y 430 (SISTEMA `VERIFY_WIDTHS`) de: `/pro` sin cuenta de
   pago, con tienda y sin ella; `/pro` en prueba con la oferta abierta; el paso
   final del onboarding en forma hoja.
3. Contraste: texto `ink6` sobre `ink0` es 6,25:1 (AA); no bajar la letra
   legal de `ink6`.

## Hallazgos fuera de la pintura

Los dos que había (el texto de la voz en `COPY_UPSELL` y la falta del momento
`coach_cerrado`) ya los resolvió el Chat 2 en `winter2/chat2-monetizacion`
@bfa1622, integrado en `winter2/integracion` @7ab8822.
