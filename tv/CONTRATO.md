# Contrato de la TV con el servidor

Migraciones `0125_tv_enlace`, `0126_tv_datos`, `0127_tv_export` y `0128_tv_proxima`. Pruebas: `scripts/test-tv-enlace.mjs` y `scripts/test-tv-proxima.mjs`.

## Transporte

- `POST {SUPABASE_URL}/rest/v1/rpc/<funcion>` con cuerpo JSON (claves `p_*`).
- Cabeceras de la TV: `apikey: <clave pública>`, `Authorization: Bearer <clave pública>`, `Content-Type: application/json`.
- La TV **nunca** recibe un JWT de usuario. Guarda el `token` opaco en el Llavero y lo manda como parámetro.
- Los resultados de negocio van con HTTP 200 y su campo `estado` u `ok`. Un HTTP distinto de 2xx es fallo de red o servidor: reintenta y no borres la sesión.
- Fechas: `timestamptz` en ISO 8601 con zona. `date` como `YYYY-MM-DD`. Es JSON de Postgres, así que los segundos pueden llevar decimales: el decodificador debe admitirlos.

## Flujo

1. `tv_emitir_codigo`: la TV enseña `XXXX-XXXX` y el QR `nivl://tv/XXXX-XXXX`.
2. Cada `sondeo_seg`, **tras recibir la respuesta anterior**, `tv_canjear`.
3. La persona confirma en el iPhone (`tv_aprobar`).
4. `tv_canjear` devuelve `aprobado` con el token **una sola vez**. Guárdalo antes de nada. Si se pierde, hay que enlazar otra vez.
5. `tv_datos` para leer. `tv_cerrar_sesion` para salir.

## RPC de la TV (rol `anon`)

### `tv_emitir_codigo(p_nombre text)`

`p_nombre`: nombre visible del aparato. Sin caracteres invisibles ni de dirección, recortado a 40 caracteres. Vacío, null o sin nada legible: `Apple TV`.

Un código sin sondeos durante 2 minutos se borra: `tv_canjear` dirá `caducado` y la TV pide otro.

| `estado` | Claves |
|---|---|
| `ok` | `codigo` string (8 caracteres de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, sin guion; la TV lo parte en 4 y 4), `secreto` string (64 hex, solo para la TV; no se enseña), `caduca_en` timestamptz (+10 min), `sondeo_seg` int (5) |
| `saturado` | `reintentar_seg` int (60). Tope global de 5000 códigos vivos: pendientes sondeados, o emitidos, hace menos de 30 s |

### `tv_canjear(p_secreto text)`

| `estado` | Claves | Qué hacer |
|---|---|---|
| `pendiente` | `sondeo_seg` int; `demasiado_rapido` true solo si el sondeo llegó antes de 4 s | Sigue esperando |
| `aprobado` | `token` string (64 hex), `caduca_en` timestamptz (+90 días) | Guarda el token. El secreto queda consumido |
| `caducado` | ninguna | Código vencido, ya canjeado o secreto desconocido. Pide código nuevo |
| `denegado` | ninguna | La persona dijo que no, o su cuenta se está borrando. Pide código nuevo si quiere |

Con `demasiado_rapido` el token **no** se entrega aunque ya esté aprobado: espera y vuelve a preguntar.

### `tv_datos(p_token text, p_hoy date)`

`p_hoy`: fecha local de la TV. Solo se acepta a un día o menos de la fecha UTC del servidor. Fuera de ese margen o null, manda la fecha en la zona del perfil. La fecha usada vuelve en `hoy`.

Token inválido, caducado, revocado o cuenta con borrado pendiente: exactamente `{"estado":"sesion_invalida"}`. No se distingue la causa. La TV borra el token y vuelve a la pantalla de enlace.

Caducidad: 90 días deslizantes y un techo de 365 días desde el enlace, por mucho que se use. Se renueva con la primera lectura pasadas 24 h de la anterior renovación. Cambiar la contraseña de la cuenta borra todas sus TV.

Refresca como mucho una vez por minuto. El servidor frena a una lectura por token cada 5 s, y una lectura simultánea no hace cola: `{"estado":"demasiado_rapido","reintentar_seg":5}`. No es perder la sesión: trátalo como un fallo de servidor y reintenta.

Con `"estado":"ok"`:

| Clave | Tipo | Notas |
|---|---|---|
| `generado_en` | timestamptz | |
| `hoy` | date | Día usado para rutina y semana |
| `sesion_caduca_en` | timestamptz | |
| `salud_activa` | bool | Consentimiento de salud vigente. Si es `false`, `rutina` es null y el peso va vacío: la TV puede decir que se active en el iPhone |
| `perfil` | objeto | Ver abajo |
| `rutina` | objeto o null | null: sin consentimiento o sin entreno hoy |
| `arena` | array | Ya ordenada. Solo filas visibles. Siempre incluye la propia |
| `ludus` | objeto o null | null si no está en un ludus. Sin puesto ni orden por puntos |
| `semana` | objeto | Ver abajo |
| `proxima` | objeto o null | 0128. El primer día con entreno de los siete siguientes. null sin consentimiento o sin nada programado. La TV lo trata como opcional |

`proxima`: `nombre` string, `dia_semana` int (1 lunes a 7 domingo), `en_dias` int (1 = mañana, hasta 7), `ejercicios` int (nunca 0).

`perfil`:

| Clave | Tipo |
|---|---|
| `nombre` | string |
| `titulo` | string (el equipado o el del rango) |
| `tipo` | string o null (`emprendedor`, `trabajador`, `deportista`, `estudiante`, `general`) |
| `rango` | string (`E`, `D`, `C`, `B`, `A`, `S`) |
| `xp_total` | int (el nivel lo calcula `Juego.swift`) |
| `elite` | bool |

`rutina`:

| Clave | Tipo | Notas |
|---|---|---|
| `fuente` | string | `prescripcion` (el coach para hoy) o `rutina` (la rutina semanal) |
| `nombre` | string | |
| `dia_semana` | int | 1 lunes a 7 domingo |
| `hecha` | bool | Ya hay sesión registrada hoy |
| `ejercicios` | array | Puede venir vacío en `rutina` |
| `ejercicios[].id` | string uuid | |
| `ejercicios[].nombre` | string | |
| `ejercicios[].series` | int | |
| `ejercicios[].reps` | string | «8», «8-10», «AMRAP» |
| `ejercicios[].carga_kg` | number o null | null o 0 = sin carga prescrita. Puede ser peso corporal o que no se haya apuntado: la TV no lo pinta ni lo adivina |
| `ejercicios[].descanso_seg` | int | Siempre 90: no se guarda en ninguna tabla |

El servidor **no** da figura, músculos ni técnica: son del catálogo cliente de IRON. La TV debe tolerar que falten.

`arena[]`:

| Clave | Tipo |
|---|---|
| `id` | string uuid |
| `soy_yo` | bool |
| `nombre` | string |
| `titulo` | string |
| `rango` | string |
| `xp_total` | int |
| `xp_ventana` | int (7 días) |
| `racha` | int (días cerrados) |
| `cumplimiento_pct` | int o null (null = sin medir, no es 0) |
| `elite` | bool |

`ludus`: `nombre` string, `miembros` array por nombre, cada uno con `id` string, `soy_yo` bool, `nombre` string, `xp_ventana` int, `cumplimiento_pct` int o null.

`semana`:

| Clave | Tipo | Notas |
|---|---|---|
| `racha` | int | Como en Hoy: cerrada, más 1 si hoy ya está cumplido |
| `piedras` | int | |
| `piedras_max` | int | 3 |
| `xp_ganado` | int | Semana natural, lunes a hoy |
| `hechas`, `falladas` | int | Semana natural |
| `dias` | array de 7 | Lunes a domingo: `fecha` date, `inicial` string (`L M X J V S D`), `hechas` int, `falladas` int |
| `mapa` | array de 12 arrays de 7 | De la semana más antigua a la actual, lunes a domingo. Número 0 a 1; 0 también para días sin programar y futuros |
| `pesos` | array | `dia` int (0 = hace 27 días, 27 = hoy), `kg` number. Vacío sin consentimiento |
| `tendencia_kg_semana` | number o null | Mínimos cuadrados, 2 decimales. null con menos de 3 pesajes o sin consentimiento |
| `tendencia_inicio`, `tendencia_fin` | number o null | Recta en el día 0 y en el último día con dato |
| `lectura` | string o null | Texto listo para pintar. null sin consentimiento |

Lo que no sale nunca: correo, dinero, diario, fotos ni retratos, notas del coach, hashes.

### `tv_cerrar_sesion(p_token text)`

Siempre `{"ok":true}`. Borra el token local igualmente.

## RPC del iPhone (rol `authenticated`, JWT de usuario)

### `tv_aprobar(p_codigo text)` y `tv_rechazar(p_codigo text)`

Admiten `XXXX-XXXX` y `XXXXXXXX`. Sin sesión: error 42501.

- `tv_aprobar` correcto: `{"ok":true,"nombre":"Salón"}`.
- `tv_rechazar` correcto: `{"ok":true}`.
- No: `{"ok":false,"reason":R}`.

| `reason` | Significado |
|---|---|
| `codigo_invalido` | No existe, caducó o ya se usó. Cuenta como fallo si tenía formato válido |
| `demasiados_intentos` | 10 fallos en una hora. Por usuario; acertar no limpia el contador |
| `tope_tv` | Solo `tv_aprobar`. Máximo 5 por usuario; añade `"tope":5` |
| `borrado_pendiente` | La cuenta se está borrando |

### `tv_mis_dispositivos()`

Filas: `id` uuid, `nombre` text, `creado_en`, `ultimo_uso`, `caduca_en` timestamptz. Solo las propias y no caducadas, por uso reciente.

### `tv_revocar(p_id uuid)`

`{"ok":true}` si era tuya y se ha borrado. `{"ok":false}` si no existe o no es tuya.

## Decisiones respecto al diseño inicial

- **`tv_rechazar` es nueva.** Sin ella, nadie podía producir `denegado`. Es el botón «No he sido yo» del iPhone.
- **Revocar y cerrar sesión borran la fila.** No queda histórico del token.
- **Margen de 1 s en el sondeo.** El servidor corta por debajo de 4 s. Un cliente que espera 5 s tras cada respuesta no ve el aviso.
- **`p_hoy` fuera de margen no es un error**: se ignora. Un reloj mal puesto no debe dejar la TV sin datos.
- **El mapa usa la lista actual de misiones**, no `daily_scorecards`: así comparte definición y filtro de salud con las barras de la semana. Borrar una misión la saca de su historia en la TV, igual que en `friends_board`.
- **Cambiar la contraseña borra las TV.** El token no depende de la sesión de Auth, y sin esto una TV enlazada con una sesión robada seguiría leyendo tras recuperar la cuenta. El cierre global de sesiones no las toca. Se revoca también con `tv_revocar`; borrar la cuenta se lo lleva por la FK.
- **Sin tope por IP.** A nivel de base no hay una IP fiable y no se ha podido comprobar qué cabecera lo es en Supabase real: la emisión solo tiene el tope global de códigos vivos.
