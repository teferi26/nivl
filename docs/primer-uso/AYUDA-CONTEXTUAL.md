# Ayuda contextual

Piezas para que alguien que abre NIVL por primera vez entienda lo que ve sin manual: una pista corta dentro de la pantalla y una palabra del juego que se puede tocar para saber qué significa. Código en `src/components/ayuda/` y `src/lib/glosario.ts`; textos en el namespace `ayuda` de i18n.

## Antes de escribir una pista

**Primero se quita fricción; solo después se explica.** Si una pantalla necesita un tutorial, se simplifica: una acción sólida, un título que diga lo que hay, un vacío (`EmptyState`) que invite a empezar. Una pista no arregla una pantalla confusa.

| Úsala cuando | No la uses cuando |
|---|---|
| Hay una regla del juego que no se deduce mirando (lo que queda sin hacer a medianoche resta XP) | Basta con mejorar el título, el botón o el vacío |
| Es la primera vez y lo que hay que hacer no es evidente | Describe lo que ya se ve («esta es tu lista de misiones») |
| Una palabra de marca aparece sin contexto: `Termino` | Es un error o un aviso importante: eso va en `ErrorSistema`, `avisar` o en línea |
| | Es información legal, de salud o de pago: nunca se puede descartar |

**Máximo una pista visible por pantalla.** Si una pantalla tiene varias, llevan el mismo `grupo` y salen de una en una.

## Pista

Tarjeta en el flujo de la pantalla, no un modal. Tiene «Entendido» (la cierra para siempre en este dispositivo) y un enlace «No mostrar más pistas» (las apaga todas). Devuelve `null` hasta leer el almacén, así que no parpadea.

```tsx
import { Pista } from '@/components/ayuda';
import { t } from '@/i18n';

<Pista
  id="hoy.primer-dia"
  titulo={t('hoy:pista.primerDia.titulo')}
  cuerpo={t('hoy:pista.primerDia.cuerpo')}
/>
```

| Prop | Tipo | Notas |
|---|---|---|
| `id` | `string` | Único en toda la app. Ver la convención abajo. |
| `titulo`, `cuerpo` | `string` | Siempre por `t()`. Frases cortas; lee como si tuvieras 52 años y no jugaras. |
| `accion` | `{ label, onPress }` | Opcional. Secundaria, nunca sólida. **Pulsarla cierra también la pista.** |
| `grupo` | `string` | Las del mismo grupo salen de una en una. |
| `prioridad` | `number` | Dentro del grupo, menor número antes. Por defecto, 0; con empate, la que se monta primero. |
| `style` | `ViewStyle` | Solo colocación (márgenes). |

Con varias en una pantalla:

```tsx
<Pista id="hoy.primer-dia" grupo="hoy" prioridad={1} titulo={...} cuerpo={...} />
<Pista id="hoy.cierre" grupo="hoy" prioridad={2} titulo={...} cuerpo={...} />
```

### Convención de ids

`pantalla.tema` en NIVL, `modo.pantalla.tema` dentro de un modo. Minúsculas, cifras y guiones: `hoy.primer-dia`, `iron.gym.primera-serie`, `focus.temario.plan`, `work.economia.primer-extracto`. Un test recorre `src/` y falla si un `<Pista id="...">` no cumple el formato o repite id, así que escribe el id literal en el JSX, no en una variable.

Cambiar un id hace que la pista vuelva a salir a quien ya la cerró.

## Término y botón de ayuda

`Termino` hace pulsable una palabra o cifra (subrayado punteado discreto) y abre una hoja corta con su definición. `BotonAyuda` es la misma hoja con un icono «?» de 44 pt, para ponerlo junto a un título.

```tsx
import { BotonAyuda, Termino } from '@/components/ayuda';

<View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
  <Text style={estilo.texto}>{t('hoy:ganas', { xp })} </Text>
  <Termino termino="xp">XP</Termino>
</View>

<Termino termino="racha" textoStyle={estilo.cifra} accessibilityLabel={t('hoy:rachaA11y', { dias })}>
  {dias}
</Termino>

<BotonAyuda termino="rango" />
```

`Termino` es un `Pressable`: **ponlo en una fila, no dentro de un `<Text>`**, o no llega a 44 pt. Con `quest.stat` puedes escribir `termino={quest.stat}`: los atributos usan el código `FUE`, `VIT`, `INT`, `AGI`, `PER`.

Ayuda a la palabra la primera vez que sale en una pantalla, no a todas: una pantalla llena de subrayados es otra forma de ruido. El texto que envuelve lo pones tú, con `t()`; la definición sale sola del glosario.

Si el término tiene `detalle`, la hoja enseña «Más en el glosario» y abre la lista completa con él arriba.

## Glosario completo

`<HojaGlosario visible onClose />` y `<GlosarioVista destacar="racha" />` (solo el contenido). Perfil ya lo monta con `AyudaPerfil`, junto al interruptor «Pistas en pantalla»: es la forma de recuperar las pistas, y activarlas enseña de nuevo también las que se habían cerrado.

## useAyuda

Para decidir algo según las pistas (lo normal es no necesitarlo):

```tsx
const { cargado, descartada, descartar, pistasApagadas, apagarPistas, reactivarPistas } = useAyuda();
```

La persistencia es local, en AsyncStorage (`nivl.ayuda.v1`), por dispositivo y no por cuenta.

## Ejemplos por modo

Estas claves son de ejemplo: créalas en tu namespace, en los seis idiomas.

```tsx
// nivl-deporte · src/components/iron/... o la pantalla de gym
<Pista
  id="iron.gym.primera-serie"
  titulo={t('iron:pista.primeraSerie.titulo')}
  cuerpo={t('iron:pista.primeraSerie.cuerpo')}
/>

// nivl-estudiante · FOCUS, dos pistas en la misma pantalla, de una en una
<Pista id="focus.temario.plan" grupo="temario" prioridad={1} titulo={t('focus:pista.plan.titulo')} cuerpo={t('focus:pista.plan.cuerpo')} />
<Pista id="focus.temario.repaso" grupo="temario" prioridad={2} titulo={t('focus:pista.repaso.titulo')} cuerpo={t('focus:pista.repaso.cuerpo')} />

// nivl-trabajador · WORK, con una acción
<Pista
  id="work.economia.primer-extracto"
  titulo={t('work:pista.extracto.titulo')}
  cuerpo={t('work:pista.extracto.cuerpo')}
  accion={{ label: t('work:pista.extracto.accion'), onPress: abrirImportar }}
/>
```

La tarjeta y el subrayado toman la piel del mundo (`usePiel`) si la hay. Galería en desarrollo: `/kit/pantallas?pantalla=ayuda`.

## Añadir un término

1. Añade la entrada en `TERMINOS` de `src/lib/glosario.ts` (`id`, `grupo`, `detalle`). Eso amplía el tipo `TerminoId`.
2. Añade `terminos.<id>` con `titulo`, `definicion` y, si `detalle: true`, `detalle`, en `src/i18n/{es,en,de,fr,it,pt}/ayuda.json`.
3. **Comprueba cada frase contra el código** (`game.ts`, `closing.ts`, `progression.ts`). Si lleva una cifra, añádela al bloque «no se inventan mecánicas» de `src/lib/__tests__/glosario.test.ts`.
4. `definicion` son una o dos frases llanas; `detalle`, tres como mucho. Sin guion largo ni medio, y sin explicar una palabra del juego con otra sin explicar.

Los tests exigen las mismas claves y las mismas cifras en los seis idiomas.

## Traerlo a otra rama

Todo va en un solo commit, sin migraciones ni cambios nativos:

```bash
git log --oneline --all --grep="Ayuda contextual"
git cherry-pick <hash>
node scripts/i18n/registrar-traducidos.mjs
```

Si hay conflicto, es en `src/i18n/recursos.ts` y `src/i18n/traducidos.ts`, o en `src/components/arena/galeria.ts` y `src/app/kit/pantallas.tsx`. Conserva las dos partes en los primeros y regenera `traducidos.ts` con el script; no lo edites a mano.
