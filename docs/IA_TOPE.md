# IA barata y tope duro (rama `nivl-1011/ia-barata`, 21/10/2026)

Decisión de Teferi: «solucionad todos los problemas, poned IA barata; que nadie pase del máximo de IA ni en abuso máximo». Informe de partida: `coordinacion-winter-arc/COSTE_IA_ELITE.md`.

## Coste por mensaje

| | Antes | Después | Cómo se mide |
|---|---|---|---|
| Chat seguido con Sonnet 5 (< 5 min) | 0,080 $ medido en producción (0,065 $ en el simulador) | **~0,017 $** en el simulador | `_shared/ia_barata_test.ts` («coste por mensaje antes/después») |
| Primer mensaje en frío | ~0,10 $ | ~0,10 $ (igual: no hay nada que leer) | mismo test, turno 1 |
| Brief con el plan ya escrito | 0,16 $ (Sonnet) | ~0,005 $ (Haiku, sin herramientas) | `brief ligero` en el mismo test |
| Brief sin plan | 0,16 $ | algo menos (sin historial del chat ni resumen) | |
| Flashcards, resumen, mapa, extracto, dieta, entreno | 0,08-0,16 $ si fueran turnos del coach | ~0,002-0,02 $ (Haiku, `kind: 'estudio'`) | |
| Resumen visual | Sonnet | Haiku | |

Por qué baja el chat: el estado se parte en **lento** (memoria, estudios, diario, agenda, ficha: va en el sistema, cacheado) y **rápido** (cabecera con XP, misiones y registro de hoy, plan de hoy, contrato de hoy: va en el mensaje del turno, detrás del historial). Puntos de caché: fijo ◆ estable ◆ historial ◆ turno ◆ (el último se mueve al final de cada vuelta del bucle de herramientas). Entre turnos seguidos el prefijo (herramientas + sistema) tiene el mismo SHA-256 y se lee; se escriben ~1,3 k fichas en vez de ~22 k.

## El tope duro (0078)

- Cada llamada al modelo (coach, rituales, estudio, clasificar, resumen, resumen del hilo, checkin, Oráculo) **reserva antes** su coste máximo con `ai_reservar`, que toma el cerrojo de la fila del usuario en `ai_cartera` (`SELECT … FOR UPDATE`) y solo inserta si `gastado + reservado + reserva <= presupuesto`. Al terminar, `ai_liquidar` apunta el coste real y libera el resto. Error HTTP del proveedor: se libera todo. Fallo sin saber si cobró: se cobra la reserva entera. Reserva huérfana (15 min): cobrada entera.
- `callClaude` y `callOpenAICompat` **exigen** `cartera` en el tipo: una función nueva sin cartera no compila.
- **La cota**: entrada = bytes UTF-8 de la petición serializada (una ficha cubre al menos un byte) + 1.024 de margen + 6.000 fichas por imagen, toda a precio de escritura de caché (1,25×, o 2× con TTL de 1 h); salida = `max_tokens`. Por eso la **tolerancia es 0**: el coste real no puede pasar de la reserva. Contrapartida: la cota de un chat de Sonnet ronda 0,4-0,6 $, así que los últimos ~0,5 $ del mes solo sirven para llamadas pequeñas (Haiku).
- Topes por función (`ai_topes_funcion`): profundo 3 turnos/día, estudio 50, pdf 10, clasificar 20, resumen 6, checkin 2, Oráculo 20, ritual 8, y un máximo por llamada. Cambiar uno es un `UPDATE`.
- Reparto diario: el bolsillo estándar no se gasta a más de 3 × (lo que queda ÷ días que faltan) (`app_config.ia_ritmo_factor`). Es la única regla blanda: el día puede pasarse en una llamada; el mes no.
- Élite: 8 $ (6 estándar + 2 profundo). Lo que se apuntó en `coach_runs` por funciones aún no desplegadas también cuenta.
- Solo Anthropic: un modelo que no sea `claude-*` en `ai_plans.routes` o en los secrets no se llama nunca; se atiende con Haiku y el log dice `modelo_no_anthropic_bloqueado`.

Test de abuso: `node scripts/test-ia-tope-abuso.mjs <ruta a @electric-sql/pglite/dist/index.js>` (todas las migraciones reales; 12 dispositivos, reintentos con la misma clave, huérfanas, liberadas, profundo; nunca pasa de 8 $, ni con recarga de 9,50 $) y `ia_barata_test.ts` («abuso: 10 dispositivos × 40 peticiones» contra el handler real).

## Recarga de IA: `nivl_ia_recarga_1`

Consumible a **2,99 €** → **1,50 $** de IA (`ai_recarga_productos`; con la tienda al 15 % deja ~0,85 $ de margen). Suma al bolsillo estándar sin ritmo diario y lo que no se gasta pasa al mes siguiente.

Pasos para Teferi:
1. App Store Connect → la app → Compras dentro de la app → **Consumible**, id `nivl_ia_recarga_1`, precio 2,99 €, nombre «Recarga de IA», descripción y captura de revisión.
2. Google Play Console → Productos dentro de la aplicación → producto **único** `nivl_ia_recarga_1`, 2,99 €, activo.
3. RevenueCat → Products: añadir los dos (no hace falta entitlement ni offering: la app lo pide por id).
4. Aplicar 0078 y 0079 (`node scripts/apply-migrations.mjs`), desplegar `coach`, `ritual`, `oracle`, `revenuecat-webhook` y `store-reconcile`, y después la OTA (la app enseña la barra y el botón solo con la tienda abierta).
5. Probar con una cuenta sandbox: comprar, ver la recarga en `/pro` y en el coach; reembolso → `revocar_ai_recarga`.

La compra la verifica el servidor en la información de cliente de RevenueCat (`subscriber.non_subscriptions`, `parseRecargas` en `store-reconcile.ts`), nunca el cuerpo del webhook ni la app. Antes de abrir la venta, contrastar ese formato con la documentación de RevenueCat.
