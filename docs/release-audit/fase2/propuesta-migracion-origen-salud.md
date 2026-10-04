# PROPUESTA de migración: origen de los datos de salud importados (para 1.0.9)

**Estado:** APROBADA por el Chat 3 el 02/10 tras probarla en rollback contra el esquema vivo, con una **ADENDA OBLIGATORIA en la misma migración**: `docs/ia-v2/proposals/adenda-origen-salud.sql` y su `.test.sql` (winter2/chat3-ia @6a54a80), 8/8 en rollback. Sin la adenda, `health_daily_steps` admitía inserciones sin consentimiento de salud, quedaba sin los triggers de salud y de borrado pendiente, fuera de `complete_health_erasure` y de la exportación (la adenda la sube a v5) y con privilegios para anon. Va DESPUÉS de la 0044. **Sin número.** El número lo asigna el coordinador (≥ 0045). No se ha aplicado en ningún entorno y no está en `supabase/migrations/`, que es del coordinador.

Requisitos (Chat 3, 02/10/2026):
- solo lectura y en primer plano;
- tipos: entrenamientos, pasos diarios agregados y peso;
- origen en el dato: `source` ∈ {manual, healthkit, health_connect} más `external_id`;
- deduplicación por (user_id, source, external_id);
- lo importado no pisa lo manual;
- sin metadatos de dispositivo ni de app de origen;
- botón «desconectar» con «borrar lo importado»;
- el coach filtra `source='manual'` hasta que se acepte el consentimiento de IA ampliado.

## Compatibilidad con 1.0.7 (regla 3 de la fase 2)

- **Solo es aditiva.** Columnas nuevas con valor por defecto, más una tabla nueva. No cambia ninguna firma, columna existente, restricción ni política.
- La build 21 sigue insertando sin `source` y sin `external_id` → `'manual'` y `null`. Las restricciones únicas existentes (`cardio_sessions (user_id, date, kind)`, `body_metrics (user_id, date)`) **no se tocan**.
- Las políticas RLS existentes (por `user_id`) cubren las columnas nuevas sin cambios.
- `account-erasure` y `health-erasure` ya borran estas tablas por `user_id` (Chat 3). Solo falta un test con filas importadas.
- La exportación (`export_my_data` v4) incluye la fila completa, así que también `source` (Chat 3).

## SQL propuesto

```sql
-- Origen de los datos de salud importados (HealthKit / Health Connect).
-- Aditiva: valor por defecto 'manual'; compatible con binarios 1.0.7.

alter table public.cardio_sessions
  add column if not exists source text not null default 'manual',
  add column if not exists external_id text;
alter table public.cardio_sessions
  add constraint cardio_sessions_source_check
  check (source in ('manual', 'healthkit', 'health_connect'));
alter table public.cardio_sessions
  add constraint cardio_sessions_external_id_check
  check ((source = 'manual') = (external_id is null) and (external_id is null or length(external_id) <= 128));
create unique index if not exists cardio_sessions_import_uidx
  on public.cardio_sessions (user_id, source, external_id)
  where external_id is not null;

alter table public.body_metrics
  add column if not exists source text not null default 'manual',
  add column if not exists external_id text;
alter table public.body_metrics
  add constraint body_metrics_source_check
  check (source in ('manual', 'healthkit', 'health_connect'));
alter table public.body_metrics
  add constraint body_metrics_external_id_check
  check ((source = 'manual') = (external_id is null) and (external_id is null or length(external_id) <= 128));
create unique index if not exists body_metrics_import_uidx
  on public.body_metrics (user_id, source, external_id)
  where external_id is not null;

-- Pasos diarios agregados: tabla nueva (no hay módulo manual de pasos).
create table if not exists public.health_daily_steps (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  source text not null check (source in ('healthkit', 'health_connect')),
  steps integer not null check (steps >= 0 and steps < 200000),
  updated_at timestamptz not null default now(),
  primary key (user_id, date, source)
);
alter table public.health_daily_steps enable row level security;
create policy health_daily_steps_own on public.health_daily_steps
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- Mismo patrón de revocación que el resto de tablas de salud (Chat 3 decide si
-- la escritura va por RPC con comprobación del consentimiento de salud, como
-- el trigger de 0030).
```

## Reglas de importación (cliente, 1.0.9)

1. **Tipos y mapeo** (sin frecuencia cardiaca por muestra, sin rutas ni ubicación, nada clínico):
   - entrenamientos de carrera/running → `correr`, natación → `nadar`, ciclismo → `bici`, caminata/senderismo → `caminar`, remo → `remo`, resto de cardio → `otro`;
   - los entrenamientos de fuerza **no** se importan a `gym_sessions`: allí una sesión es un día del programa con series registradas, y un workout externo no trae series;
   - peso: la última muestra de cada día → `body_metrics`;
   - pasos: la suma diaria → `health_daily_steps`.
2. **Alcance:** primera sincronización de los últimos 90 días; después, incremental desde la última fecha importada.
3. **Lo importado no pisa lo manual:**
   - si ya existe una fila manual con la misma clave única (cardio: mismo `date` + `kind`; peso: mismo `date`), la importada se **omite**;
   - nunca hay `update` sobre filas `source='manual'`.
4. **Varias sesiones externas del mismo tipo en un día:** la tabla obliga a una fila por (`date`, `kind`) y eso no se toca, así que se **agregan** (duración y distancia sumadas, y `external_id` = hash estable de los uuids de los samples ordenados).
5. **XP: las sesiones importadas se guardan con `xp_awarded = 0`.** No pagan XP de forma automática, para no abrir la puerta a granjear XP con datos externos. Si la economía quiere premiarlas, lo decide el Chat 5 con `nivl-game-balancer` en una RPC propia.
6. **Sin metadatos:** no se guarda `sourceRevision`, el bundle id, el nombre de la app (Strava, etc.) ni el dispositivo. La marca Strava no aparece en la app.
7. **Desconectar:** Perfil > Salud y bienestar > «Desconectar Salud» deja de leer y ofrece «Borrar lo importado», que borra las filas del usuario con `source <> 'manual'` en las tres tablas. Si se retira el consentimiento de salud, se bloquea igual que hoy.
8. **IA:** el contexto, las herramientas y `recap` del coach filtran `source = 'manual'` hasta que el usuario acepta el consentimiento de IA ampliado, que nombra Salud y Health Connect (lo hace el Chat 3). Los proveedores a los que se envía dependen de la decisión del dueño «salud solo a Claude».

## Dependencias y siguientes pasos

| Paso | Dueño |
|---|---|
| Revisar el SQL y probarlo en rollback | Chat 3 |
| Asignar el número y aplicarlo | Coordinador |
| Filtro `source='manual'` en `context.ts`, `tools.ts` y `recap.ts` | Chat 3 |
| Consentimiento de salud v+1 y de IA ampliado | Chat 3 (UI: Chat 4) |
| ¿Premiar las sesiones importadas? (hoy, XP 0) | Chat 5 |
| Bibliotecas nativas (@kingstinct/react-native-healthkit 16.0.0, react-native-health-connect 4.1.3, expo-build-properties con minSdk 26), capability HealthKit y declaración de Health Connect | Coordinador con el usuario, para 1.0.9 |
| Módulo de importación (`src/lib/healthimport.ts` puro + efectos) y pantalla | Chat 1 (lógica), Chat 4 (UI) |
| App Privacy, Data Safety, política y notas de Apple (deja de valer «does not use HealthKit») | Chat 1 y Chat 3 |

## Decisiones del coordinador que afectan a 1.0.8 y 1.0.9 (vía Chat 3, 02/10)

- Fotos corporales, su análisis por IA y compartirlas: **solo 18+**. Aplicado en compartir: `puedeCompartirFotos` (sharecard.ts/share.ts @77ac953).
- Visión sobre fotos corporales: **solo Claude, nunca DeepSeek**.
- No se afirma «sin retención» del proveedor de IA hasta que se firme el acuerdo de retención cero con Anthropic.
