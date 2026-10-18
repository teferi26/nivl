# Modos F1 · Servidor

Rama `modos-f1/servidor`, sobre `winter2/modos-f1` @659714e. Solo commits locales: no se ha hecho push, despliegue ni migración en producción, y no se ha tocado la base real.

## Qué se ha hecho

### Migraciones (aditivas, re-ejecutables, con «marcha atrás» en su cabecera)

| Archivo | Qué añade | Huella en `apply-migrations.mjs` |
|---|---|---|
| `0066_profiles_locale.sql` | `profiles.locale text null` (BCP-47 corto, CHECK laxo) y `grant update (locale)` | columna `profiles.locale` |
| `0067_app_config.sql` | `app_config` con RLS (anon y authenticated leen solo `public = true`, escribe solo `service_role`), `app_flags()` y `app_config_value(key, default)` (solo servidor). Semillas apagadas: `modos_activos`, `idiomas_activos`, `prueba_auto_activa` = false; `prueba_auto_dias` = 2; `prueba_ia_mensajes_dia` = 20; `valoracion_activa` = false | `nivl:app-config-0067` |
| `0068_modos.sql` | `quests.modes text[] default '{}'` (iron, focus, work, founder; NULL de supabase-js pasa a `{}`), `user_modes` (RLS de dueño), `mode_xp` (solo lectura del dueño), trigger de XP por modo y `export_my_data` v8 | `nivl:export-modos-0068` |
| `0069_prueba_auto.sql` | Plan `prueba_auto`, la prueba al nacer el perfil, tope diario, `ai_state` / `ai_begin_turn` / `user_tier` con la prueba, y `prueba_auto_resumen()` | `nivl:prueba-auto-0069` |

### XP por modo, sin tocar `complete_quest` ni `award_xp`

- Un trigger `AFTER INSERT` en `completions` suma `xp_awarded` a cada modo de la misión. Toda completion pasa por `complete_quest` desde la 0035.
- No suma nada en estos casos:
  - `modes` vacío (usuario de la 1.0.9);
  - misión extra (paga PB);
  - misión de penalización (restaura XP que ningún modo perdió);
  - doble toque.
- El XP por modo nunca baja: el cierre del día resta `xp_total`, no los modos. Es la misma regla que las stats.
- No es retroactivo: cuenta desde que la misión lleva el modo, con los modos que tenga al completarse.
- Un modo repetido en la misma misión suma una sola vez.

### Exportación y borrado

- `export_my_data` v8 es la v7 de la 0064 copiada tal cual, con `user_modes` y `mode_xp` añadidos. La columna `quests.modes` y `profiles.locale` viajan en las filas completas.
- `user_modes` y `mode_xp` cuelgan de `auth.users ON DELETE CASCADE` y llevan el `account_write_guard` de la 0031.

### Prueba automática de 2 días (apagada por defecto)

- **Cuándo nace.** Solo si `prueba_auto_activa` vale exactamente el booleano `true`. Se crea con un trigger `AFTER INSERT` en `profiles`; `handle_new_user` no se toca.
  - La fila es `subscriptions(plan 'prueba_auto', status 'trialing', provider 'prueba', fin = alta + prueba_auto_dias)`.
  - Lleva `ON CONFLICT DO NOTHING`, así que nunca pisa una fila existente: compra, cortesía, owner u otra prueba.
  - Cualquier error se traga, para que el alta de la cuenta no falle.
- **El plan en `ai_plans`.**
  - Tier `elite`.
  - Rutas `default` y `registro` a `claude-haiku-4-5`.
  - Sin modo profundo, porque Haiku no admite el esfuerzo `xhigh`.
  - Presupuesto total de la prueba: 1,00 $. Se cambia con un `update` de `ai_plans`.
- **Tope diario.** `ai_begin_turn` cuenta los turnos de `chat` sin error del día local del perfil y, al llegar a `prueba_ia_mensajes_dia`, devuelve `reason 'tope_diario'` sin tomar el cerrojo.
  - La función `coach` lo devuelve como `402 { reason: 'presupuesto_agotado', detalle: 'tope_diario', error: 'Has usado los mensajes de hoy de tu prueba. Mañana vuelven.' }`. La 1.0.9 ya pinta ese motivo con el texto del servidor.
- **Funciones reemplazadas.** `ai_state`, `ai_begin_turn` y `user_tier` son copias literales de la 0024 con el cambio marcado «0069», con la misma firma y los mismos permisos.
  - La prueba automática es una prueba sin días de gracia, como la de 7 días.
  - Su gasto cuenta desde el alta.
  - `ai_state` añade `tope_dia` y `mensajes_hoy` solo para ese plan.
- **Compra frente a prueba.** Una compra real sustituye siempre a la prueba, y la prueba nunca pisa una compra.
  - `apply_store_event` (0027) ya sobrescribe cualquier fila que no sea del owner.
  - Se usa `provider 'prueba'` y no `'manual'` porque así `apply_store_reconciliation` (0036) no la protege como concesión manual. Con ella, una compra de sandbox (TestFlight o la revisión de Apple) también la sustituye. Sin derecho de tienda, la prueba se conserva.
  - `stripeMayTakeOver` (TS) deja que Stripe la sustituya.
- **Gasto.** `prueba_auto_resumen()`, solo para `service_role`, da las pruebas vivas, el total y el gasto de IA, para la alerta del 70 % del crédito. La alerta en sí no está montada (ver riesgos).

### Coach (edge functions)

- `_shared/modos.ts` es puro: normaliza las cabeceras, monta el bloque de idioma y modo y añade la etiqueta `· modos: IRON` a la línea de la misión.
- Dos cabeceras opcionales:
  - `x-nivl-locale` → «responde SIEMPRE en <idioma>».
  - `x-nivl-modo` → el sombrero del modo (iron, focus, work o founder).
  - Si no hay cabecera de idioma, se usa `profiles.locale`. Así los rituales del cron también hablan su idioma.
  - Una cabecera explícita `es` manda sobre el perfil.
- El bloque va en la parte dinámica del sistema. La parte fija y su caché siguen siendo idénticas para todos.
- Sin cabeceras, con `es` o con `general`, el sistema sale idéntico byte a byte. Lo comprueba `modos_test.ts` con el hash SHA-256 de `buildSystem` y `buildSystemRegistro`, calculado en 659714e con el mismo estado de ejemplo, y con el handler completo.
- El filtro sin guiones largos ya se aplicaba a toda la salida sin mirar el idioma (`callClaude` y `openai`). Ahora hay un test con inglés, francés, alemán, portugués, italiano, árabe, japonés y ruso, y el bloque nuevo no lleva ningún guion. `singuiones.ts` no se toca porque tiene una copia exacta en el cliente con su test de paridad.

## Cómo se prueba

```bash
# 1. Migraciones reales en PostgreSQL en memoria (PGlite; sin red ni credenciales)
node scripts/test-modos-f1.mjs <ruta>/@electric-sql/pglite/dist/index.js         # 123 comprobaciones
node scripts/test-export-full-schema.mjs <ruta>/@electric-sql/pglite/dist/index.js # export v8
node scripts/test-migration-preview.mjs
#    (PGlite está, por ejemplo, en C:\temp\nivl-age-sql-check\node_modules\@electric-sql\pglite\dist\index.js)

# 2. Edge functions
cd supabase/functions && npx deno test --allow-all            # 269 ok, 0 fallos (incluye modos_test.ts)
npx deno check coach/index.ts

# 3. Contra una base con 0066 a 0069 aplicadas, en BEGIN/ROLLBACK (no deja nada escrito)
#    psql -f scripts/probar-f1-servidor.sql   (o rosql.mjs, o el SQL Editor con el archivo entero)
#    → 27 filas (paso, ok, detalle), todas ok = true
```

`test-modos-f1.mjs` arranca dos bases: una hasta la 0065 y otra con todo. Ejecuta en las dos el mismo guion de un usuario de la 1.0.9 y compara los resultados.

- El guion incluye:
  - misiones normal, extra y de penalización, y el doble toque;
  - `award_xp` y la exportación;
  - una matriz de 11 situaciones de plan contra `ai_state`, `user_tier`, `ai_begin_turn` (estándar y profundo) y `ai_status`.
- Resultado: es idéntico. Las únicas diferencias son las claves nuevas (`locale: null` en el perfil que devuelven las RPC, `modes: []` en las misiones, y `user_modes` y `mode_xp` en la exportación).
- Después prueba el XP por modo, las RLS, los interruptores, la prueba automática, la tienda y el propio `probar-f1-servidor.sql`.

También pasan `npx tsc --noEmit`, `npx jest` (1668), `node scripts/i18n/verificar-es.mjs` y el lint de lo que no está ignorado (lo de `supabase/` lo excluye la configuración).

## Orden de despliegue (para el coordinador)

1. Migraciones `node scripts/apply-migrations.mjs` (0066 → 0069). Con todo apagado, la 1.0.9 no nota nada.
2. Desplegar `coach` (y, si se quiere, `stripe-webhook`, por `store-stripe.ts`). **Antes de encender `prueba_auto_activa`**: con la función vieja, el motivo `tope_diario` no está en su tabla y la 1.0.9 lo vería como «sin suscripción» (paywall).
3. Ejecutar `scripts/probar-f1-servidor.sql` en BEGIN/ROLLBACK contra la base.
4. Encender: `update app_config set value = 'true' where key = '…';` con la clave de servicio.

## Riesgos

- **El perfil que devuelven `complete_quest` y `award_xp` gana la clave `locale`** (null). Es aditivo y la 1.0.9 la ignora, pero no es literalmente el mismo JSON.
- **La prueba es tier `elite`, como pide el contrato.** Durante 2 días:
  - el usuario lleva el laurel Élite para sus amigos (`elite_badges` mira `user_tier`);
  - puede pedir plaza en un ludus.
  
  Si no se quiere, hay dos salidas:
  - `update ai_plans set tier = 'pro' where plan = 'prueba_auto'`;
  - una migración que excluya `prueba_auto` del laurel.
- **Una prueba por cuenta.** Con la automática, `start_trial()` (la de 7 días de la 1.0.9) devuelve `ya_usada` y `trial_available` es false al caducar.
- **El tope diario cuenta solo `kind = 'chat'` sin error.** Los rituales del cron consumen presupuesto (1 $ en total), pero no mensajes.
- **`prueba_auto_resumen().gasto_micro_usd` es aproximado.** Si alguien compra, su fila deja de ser `prueba_auto` y su gasto de prueba sale de la suma. Falta montar la alerta del 70 %: cron o script con este dato y el crédito.
- **Hay dos cabeceras parecidas.**
  - `x-nivl-mode` = potencia (`profundo`), ya existía.
  - `x-nivl-modo` = modo de la app (iron…), es nueva.
  
  Confundirlas no abre nada caro, porque solo `profundo` exacto abre el bolsillo, pero conviene no mezclarlas.
- **Modo nuevo = migración.** El CHECK de `quests.modes`, `user_modes` y `mode_xp` solo admite los cuatro modos.
- **Coach con modos.** Las herramientas del coach (`tools.ts`) aún no escriben `modes` al crear misiones. Fuera de alcance en F1: las misiones del coach nacen en General.
- **Avisos y correos.** `ritual/index.ts` (titular del push) y los correos siguen en español. `profiles.locale` ya está para ellos.

## Lo que necesitan otros equipos

**Cliente**
- **Interruptores.** `app_flags()` con anon o authenticated devuelve las seis claves. Si falla, todo apagado.
- **Idioma.**
  - Escribir `profiles.locale` con `update profiles set locale = …`. Solo esa columna, BCP-47 corto.
  - Mandar `x-nivl-locale` en cada llamada a `coach`.
- **Modos.**
  - Mandar `x-nivl-modo` con el modo activo, sin mandarla en General. Ojo: no es `x-nivl-mode`.
  - `user_modes`: insert, update y delete de las filas propias (`mode` en iron, focus, work o founder; General no se guarda).
  - `quests.modes`: escribir el array al crear o editar una misión. `NULL` se convierte en `{}`.
  - `mode_xp`: solo lectura (`select mode, xp from mode_xp`). El nivel por modo se calcula en el cliente con la misma curva.
- **Prueba automática.**
  - `ai_status()` puede traer `plan 'prueba_auto'` con `trial: true`, `renews` = fin de la prueba, y además `tope_dia` y `mensajes_hoy`.
  - Añadir `'prueba_auto'` a `PlanKey` y `PLAN_LABEL` (hoy cae en «NIVL Pro»).
  - En `subscriptions.provider` puede venir `'prueba'`.
- **Tope diario.** El 402 trae `reason 'presupuesto_agotado'` y `detalle 'tope_diario'`. El texto del servidor ya vale; el cliente nuevo puede distinguirlo por `detalle`.

**Analítica**
- Inicios de prueba: `subscriptions` con `plan = 'prueba_auto'` (fecha de alta = `current_period_end` menos `prueba_auto_dias`). No se escribe ningún evento en `events`.
- Conversión: la fila pasa a un plan de tienda (`provider apple/google`).
- Gasto: `prueba_auto_resumen()` (service_role).
- Si `funnel_events` lleva `user_id` u otro dueño, tiene que entrar en `export_my_data` (regla de AGENTS.md) en una migración posterior a la 0069. Si es anónima, no.

**Coordinador**
- Números 0066 a 0069 ocupados. La siguiente exportación debe partir de la v8 de la 0068.
