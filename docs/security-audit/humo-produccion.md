# Batería de humo de seguridad en producción (Chat 3)

Se ejecuta tras cada tanda de migraciones o funciones. Todo es de **solo lectura**: cada archivo corre dentro de `BEGIN … ROLLBACK` con usuarios ficticios `@example.invalid` (ayudante del Chat 3 o, para quien no lo tenga, la Management API envolviendo el SQL en `begin; … ; rollback;`). Nunca se leen datos de usuarios reales.

| Archivo (en `proposals/`) | Cómo | Esperado |
|---|---|---|
| Huellas 0035–0044 (línea 2 de cada archivo) | un `select` con todas | todas `true` |
| `0035-integridad-cierre-economia.test.sql` | solo el test | 33 × `ok:true` |
| `0037_moderacion.test.sql` | solo el test | 11 × `ok:true` |
| `0039_store_events_seudonimizar.test.sql` | solo el test | casos 1–7 como en el archivo (2 → `0`, 7 → `2`) |
| `0044_export_v4.test.sql` | solo el test (cuando 0044 esté aplicada) | `3 tablas con dueño SIN cubrir` = **`ninguna`** |
| `0041_xp_topes.test.sql` | solo el test | 20 × `ok:true` |
| `0042_push_token.test.sql` | solo el test | 8 × `ok:true` |

`0038` y `0043` llevan el cuerpo dentro del test: tras aplicarlas, su caso «ANTES» sale `false` por diseño; basta la huella.

**Regla de cobertura (exportación):** toda migración que cree una tabla con `user_id`, `reporter`, `requester` o `blocker` debe ampliar `export_my_data` en la misma migración; el test de 0044 lo detecta.

Última ejecución: 02/10/2026 tras el despliegue `c87df0d` — todo PASS salvo la cobertura de 0040 (corregida en 0044, pendiente de aplicar).
