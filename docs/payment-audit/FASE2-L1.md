# Fase 2 · L1 — Momento de oferta y upsell contextual (D1)

Rama `winter2/chat2-monetizacion` (base `@99729ea`). Solo JS: sale con el binario 1.0.8 (y por OTA a la 1.0.8). Sin servidor, sin dependencias, sin SQL.

## Archivos

| Archivo | Qué |
|---|---|
| `src/lib/paywallmoment.ts` (NUEVO, puro) | `Momento`, `decidirOferta(momento, ctx)`, `bloqueoDeHoja`, `recortarHistorial`, `parsearHistorial`, `anotarEn`, `rutaOferta`, `esMomento`, `diaNatural` |
| `src/lib/pro.ts` | `CLAVE_OFERTAS = 'nivl.ofertas.v1'`, `leerHistorialOfertas()`, `anotarOferta(momento, respuesta, forma?)`, `ofrecerSi(momento, status, opts)`; reexporta `paywallmoment` |
| `src/lib/proplans.ts` | `COPY_UPSELL` (momento × nivel), `copyUpsell()`, `beneficiosPorMotivo()`; `LEGAL_URLS` → `https://nivl.app/terminos` y `/privacidad` (aprobado por Chat 1 + coordinador, solo 1.0.8) |
| `src/components/ProOffer.tsx` | prop `motivo` (en `ProOffer` y `ProOfferBody`): línea de contexto + su beneficio primero; NUEVO `ProUpsellLine`. Sin cambios de estilo visual (kit v2 de Chat 4 pendiente) salvo dos estilos mínimos (`contexto`, `upsell`) con tokens existentes |
| `src/app/pro.tsx` | lee `motivo` y `tier` (`useLocalSearchParams`), los pasa a `ProOffer` (`motivo`, `initialTier`) y apunta la respuesta (`cerrada`/`compra`/`prueba`) |
| Tests | NUEVO `paywallmoment.test.ts`; ampliados `pro-purchases` (historial y `ofrecerSi`), `prooffer` (motivo, legales, línea), `proplans` (URLs legales) |

## Contrato para Chat 4

```ts
import { ofrecerSi, anotarOferta, rutaOferta, type DecisionOferta } from '@/lib/pro';
import { ProOffer, ProUpsellLine } from '@/components/ProOffer';

// DecisionOferta = { mostrar, forma: 'hoja'|'linea', tier: 'pro'|'elite', prueba, copyKey, razon }
const d = await ofrecerSi(momento, aiStatus, { celebrando, provider? });
```

- `ofrecerSi` nunca lanza. Sin `aiStatus` (sin red) devuelve `mostrar: false`. Si decide **hoja**, la apunta ya como `vista` (el tope cuenta aunque luego no se pinte; lo prudente). Las **líneas** no se apuntan.
- `provider` (`subscriptions.provider`) evita ofrecer Élite en la tienda a quien paga Pro por Stripe o con plan heredado (`puedeMejorarEnTienda`).
- Respuesta del usuario a una hoja propia (no `/pro`): `anotarOferta(momento, 'cerrada' | 'compra' | 'prueba')`. Se funde con la `vista` de la última hora (cuenta una sola hoja). `/pro` ya lo hace solo cuando trae `motivo`.

### 1. Paso de la firma (onboarding)

```ts
const d = await ofrecerSi('firma', status, { celebrando: false });
if (d.mostrar && d.forma === 'hoja') {
  // El paso de oferta de siempre: ProOffer compact con initialTier={d.tier} motivo="firma"
  // trialAvailable={d.prueba}. «Empezar gratis» visible arriba y en el pie desde el primer frame.
  // Al salir: anotarOferta('firma', 'cerrada'); tras comprar/probar: 'compra' / 'prueba'.
} else if (d.mostrar) {
  // Línea (en prueba o tienda cerrada, o firma repetida con el tope gastado): <ProUpsellLine momento="firma" tier={d.tier} />
} // si no, se salta el paso
```

La primera firma es hoja aunque haya otra hoja ese día (no gasta el tope). Con la tienda cerrada sale **línea** (regla D1); si el Chat 4 prefiere mantener el paso entero con «Avísame cuando abra», hay que cambiar la regla aquí, no en la pantalla.

### 2. Tras el primer día (Chat 5)

Disparador: la celebración `logro` con clave `'logro:first_day'` (primer día cerrado con misiones cumplidas; contrato de Chat 5, `docs/game-v2/CONTRATO-PROGRESION.md` §4 en `winter2/chat5-juego`). `celebrando = principal !== null && visible` en la cola de celebraciones que expone Chat 4.

**Se llama cuando se CIERRA la celebración `'logro:first_day'`, no al recibirla**:

```ts
onCelebracionCerrada(async (c) => {
  if (c.clave !== 'logro:first_day') return;
  const d = await ofrecerSi('primer_dia', status, { celebrando: colaVisible });
  if (d.mostrar && d.forma === 'hoja') router.push(rutaOferta('primer_dia', d.tier)); // o la hoja propia del kit v2
  else if (d.mostrar) mostrarLinea('primer_dia', d.tier);
});
```

Si en ese instante entra otra celebración en la cola, `celebrando: true` → nada (no se reintenta: el primer día es una vez en la vida). La hoja nunca va encima de la Ceremonia de nivel.

### 3. Líneas de función (no modales)

`<ProUpsellLine momento={m} tier={d.tier} />` = fila con icono + una línea + chevron; al tocarla abre `/pro?motivo=m&tier=t` (o `onPress` propio). Dónde:

| Momento | Dónde | A quién |
|---|---|---|
| `coach_profundo` | junto al selector de potencia del Coach, si `!puedeProfundo(status)` | gratis, prueba y Pro → Élite |
| `analisis_foto` | junto al botón de foto del Coach | gratis → Pro; Pro → Élite |
| `energia_agotada` | bajo el aviso de energía agotada (`energiaAgotada(status)`) | prueba → Pro; Pro → Élite |
| `voz_premium` | **no colocar todavía**: la voz no existe; su copy lo dice («aún no está disponible») y no vende nada | — |

`ProUpsellLine` lleva estilos mínimos con tokens existentes; el kit v2 puede reestilarla sin tocar su contrato (`momento`, `tier`, `onPress?`).

## Reglas anti-patrón oscuro (cubiertas por tests)

`src/lib/__tests__/paywallmoment.test.ts`, `pro-purchases.test.ts` («momento de la oferta»), `prooffer.test.ts` («fase 2»):

- Nada durante una celebración, en ningún momento ni nivel.
- ≤1 hoja por día natural local (una hoja a las 23:30 no gasta el tope del día siguiente); ≤2 hojas en 7 días (ventana móvil); 72 h sin hoja tras cualquier «cerrada» (también de una línea). Las líneas siguen saliendo con los topes gastados.
- `firma`: hoja la primera vez sin gastar tope; repetida, respeta topes y baja a línea. `primer_dia`: hoja una vez en la vida.
- Momentos de función: siempre línea. En prueba o con la tienda cerrada: línea.
- Élite/dueño: nada. Pro: solo Élite, solo en función o energía agotada, y nunca si paga fuera de la tienda.
- `prueba` solo con `trialAvailable` y nunca para vender Élite (la prueba es de Pro).
- Lo gratuito nunca se bloquea: la decisión no tiene campo de bloqueo (test de forma del objeto).
- Copy sin urgencias, cuentas atrás ni exclamaciones; cada beneficio citado existe; la voz se declara inexistente.
- Oferta con motivo: «Seguir gratis», «Restaurar compras», Términos y Privacidad siguen visibles; el importe que se cobra es la cifra del plan y no hay equivalente mensual de un anual (`≈`, `/mes`, 8,33…).
- Historial: JSON corrupto o almacenamiento roto = vacío, nunca un fallo; recorte a 30 días y a 60 entradas.

## Límites conocidos

- Salir de `/pro` con el gesto de atrás del sistema no apunta «cerrada»: la `vista` de `ofrecerSi` ya contó contra los topes, pero no activa las 72 h.
- El historial es del dispositivo: reinstalar o cambiar de móvil lo vacía (lo peor: una hoja más, con sus topes).
- AsyncStorage se carga con `require` perezoso en `pro.ts` para no arrastrar el módulo nativo a los tests que importan `pro.ts` sin mock (`import()` no lo transforma Jest).

## Resultados

02/10/2026, en el worktree compartido (con L2/L3 trabajando a la vez):

- `npm run typecheck`: sin errores.
- `CI=true npx jest --ci --runInBand src/lib/__tests__`: 44 suites, 637 tests, todos en verde (después se añadió un test más a `pro-purchases`: 42/42).
- `CI=true npm run lint`: 0 errores; quedaba 1 aviso `no-require-imports` en `creators.test.ts` (de L3, no tocado). Los archivos de L1 pasan `eslint` sin avisos.
- No ejecutado: `npx expo export` ni prueba en dispositivo.
