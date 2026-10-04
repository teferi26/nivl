# Fotos de progreso: almacenamiento seguro (propuesta del Chat 3)

02/10/2026. Cubre §1 de `requisitos-seguridad.md` (F1, F3, F4, F5 y F10) en el lado del servidor. Es **aditiva** y compatible con la 1.0.7, que no usa nada de esto.

## Archivos

| Archivo | Qué es |
|---|---|
| `proposals/0050_fotos_progreso.sql` | La migración propuesta. Sin número; huella `to_regclass('public.progress_photos') is not null`. |
| `proposals/0050_fotos_progreso.test.sql` | El test en ROLLBACK, con las cuentas ficticias A, B y C (`@example.invalid`). |
| `supabase/functions/_shared/account-erasure.ts` | Añade `'progress'` a `BUCKETS`. |
| `supabase/functions/_shared/health-erasure.ts` | Lee el formato mixto de `health_erasure_paths` y vacía cada bucket. |
| `supabase/functions/_shared/ia2_fotos_erasure_test.ts` | 8 casos Deno del bucket `progress`. |

## Qué añade

1. **`adult_confirmations`** y sus funciones:
   - La tabla (`user_id` pk, `confirmed_at`): el cliente solo puede leer lo suyo; no tiene insert, update ni delete.
   - `confirm_adult()`: idempotente, exige `auth.uid()` y rechaza una cuenta con borrado pendiente.
   - `my_adult_confirmation()`.
   - `adult_ok(uid)`: predicado interno al estilo de `health_consent_ok`, sin sondeo de terceros.
2. **`progress_photos`**. La ruta es exactamente `{user_id}/{id}.{jpg|jpeg|webp}` (CHECK). La protegen:
   - RLS propia, más dos políticas restrictivas: `health_permission` (`health_row` cae en *else true*) y `adult_permission`.
   - Los triggers `account_write_guard`, `health_write` y `progress_photo_guard`. Este último exige 18+ también a service_role, rechaza fechas futuras y limita a 12 altas por día.
   - Sin TRUNCATE ni acceso de anon. Del cliente solo se puede actualizar `taken_on` y `pose`, por permiso de columna.
3. **Bucket `progress`**: privado, de 3 MB, solo jpeg/webp, creado con `insert into storage.buckets`. Sus políticas:
   - Lectura y borrado en la carpeta propia.
   - Subida solo si el nombre es la `path` de una fila propia.
   - Una restrictiva de salud + 18+.
   - Una restrictiva que impide el UPDATE (no se sobrescribe).
4. **`my_progress_photos_meta(p_from)`** devuelve jsonb `[{id, fecha, pose, peso_kg}]`:
   - Responde 42501 sin sesión, con borrado pendiente, sin salud o sin 18+.
   - `peso_kg` sale de `body_metrics.weight_kg` del mismo `date`: el último registro del día, o `null` si no hay.
   - Máximo 200, ordenado por fecha descendente. Nunca devuelve `path` ni URL.
5. **Los 5 sitios de borrado y bloqueo**, copiados del `pg_get_functiondef` vivo y ampliados con `'progress'`:
   - `require_account_storage_active`: para `progress`, además exige salud activa, 18+ y carpeta uuid, también a service_role.
   - `account_erasure_paths` y `account_erasure_ready`.
   - `health_erasure_paths`.
   - `complete_health_erasure`: exige `evidence` y `progress` vacíos y borra `progress_photos`. Conserva `adult_confirmations`, que no es dato de salud.

## Lo que queda fuera: la exportación

Por decisión del coordinador, **no** se toca `export_my_data`. La migración de exportación consolidada debe cubrir tres cosas:

- `progress_photos`, con todas sus filas;
- `adult_confirmations`;
- los objetos del bucket `progress` dentro de `storage_objects`.

El paso 07 del test lo documenta: hoy devuelve `progress_photos=f adult_confirmations=f objetos_progress=f nada_de_B=t`. Con la consolidada, los tres primeros deben dar `t`.

## Cómo ejecutar

```bash
# Inyecta la migración (sin begin/commit) en la línea «-- @@MIGRACION@@» del test y la ejecuta en ROLLBACK
node -e "const f=require('fs'),d='docs/ia-v2/proposals/';f.writeFileSync('/tmp/fp.sql',f.readFileSync(d+'0050_fotos_progreso.test.sql','utf8').replace(/^-- @@MIGRACION@@$/m,()=>f.readFileSync(d+'0050_fotos_progreso.sql','utf8').replace(/^\s*(begin|commit);\s*$/gim,'')))"
node <scratchpad>/rosql.mjs -f /tmp/fp.sql
npx deno test --allow-env --allow-net --allow-read supabase/functions/_shared/
npx deno check supabase/functions/account-erasure/index.ts supabase/functions/health-erasure/index.ts
```

Resultado del 02/10, real:
- **SQL**: los 80 pasos salen como se esperaba. Después, una consulta comprueba que no queda tabla, bucket ni usuario ficticio.
- **Deno**: 118 passed, 0 failed.
- **`deno check`**: limpio.

## Decisiones

- **La ruta es `{uid}/{id}.ext`, no `{uid}/{uuid}/{full|thumb}.jpg` (F2), por mandato del encargo.** Si el Chat 5 quiere miniatura, hay que añadir `thumb_path` con su propio CHECK (`{uid}/{id}.thumb.jpg`) y ampliar la política de subida. Los 5 sitios de borrado ya cubren la carpeta entera.
- **Un objeto exige su fila.** La política de subida pide `exists(progress_photos.path = name)`. El orden en la app es: insertar la fila, subir y, si la subida falla, borrar la fila. No hay archivos sueltos y el tope de 12 al día acota también el almacenamiento.
- **`health_erasure_paths` usa un formato mixto.** `evidence` sigue saliendo como cadena (el formato de la función desplegada) y `progress` sale como `{bucket, path}`. La función antigua, ante un objeto de `progress`, responde 503 y no borra nada indebido. La nueva vacía cada bucket.
- **18+ es una declaración propia y aparte de `age_confirmations` (16+).** No se puede revocar desde el cliente. Se borra en cascada con la cuenta, y la retirada de salud la conserva.

## Riesgos y pendientes

- **Orden de despliegue: migración → `account-erasure` y `health-erasure` → app.** Con las funciones antiguas, una cuenta con fotos de `progress` se queda en «pendiente» (sin pérdida de datos) hasta desplegarlas. Con la 1.0.7 no puede existir ninguna.
- **El bucket se crea por SQL (`insert into storage.buckets … on conflict do update`).** Funciona en ROLLBACK como `postgres`: el paso 00 lo confirma y, tras el ROLLBACK, `storage.buckets` no tiene `progress`. Los límites de 3 MB y del tipo MIME los aplica la API de Storage, no SQL. Por eso el test comprueba la extensión en la ruta y no el MIME.
- **`storage.protect_delete` veta el DELETE directo en SQL.** El test lo simula con `storage.allow_delete_query`, como la API. El borrado real va por `storage.from('progress').remove()`.
- **`anon` y `authenticated` conservan TRUNCATE sobre `storage.objects`.** Es una concesión de Supabase en el esquema `storage`, fuera del alcance de esta propuesta. Lo anoto para el ciclo de higiene; la 0043 solo cubre `public`.
- **Quedan fuera del servidor:**
  - F6, sin EXIF;
  - F7, firma de ≤60 s tras `requireHealthConsent()`;
  - F8, caché solo en memoria;
  - el texto de F10, con ropa deportiva.

  Son de cliente: Chat 4 y Chat 5.
- **Antes de integrar**, conviene comprobar que no choca con otra propuesta que redefina estas 5 funciones. Con este diseño, `export_my_data` ya no entra en conflicto.
