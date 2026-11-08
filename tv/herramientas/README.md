# Servidor local de pruebas de la TV

`servidor-pruebas.mjs` monta PostgreSQL en memoria (PGlite) con las migraciones reales y expone `POST /rest/v1/rpc/*` como PostgREST. No usa red ni credenciales y no toca producción. Los datos son inventados y se pierden al pararlo.

```bash
mkdir -p "$TMPDIR/pg" && npm install --prefix "$TMPDIR/pg" @electric-sql/pglite
PGLITE_PACKAGE_ROOT="$TMPDIR/pg" node tv/herramientas/servidor-pruebas.mjs --puerto 54399
```

Lanzar la app contra él (solo Debug o simulador):

```bash
xcrun simctl launch <udid> com.teferi.nivl.tv -nivlServidor http://127.0.0.1:54399 -nivlClave clave-publica-local
```

Simular el iPhone y los fallos, con el servidor en marcha:

| Comando | Qué hace |
|---|---|
| `node tv/herramientas/servidor-pruebas.mjs aprobar [CODIGO] --cuenta llena` | Aprueba el código (o el último pendiente). Cuentas: `llena`, `vacia` (sin rutina ni amigos), `sinsalud` (sin consentimiento de salud), `descanso` (hoy no toca, próxima sesión pasado mañana) y `larga` (200 filas en la tabla) |
| `... rechazar [CODIGO]` | La TV pasa a `denegado` |
| `... caducar-codigo` | Caduca los códigos pendientes |
| `... revocar` | Borra todas las sesiones: la TV pasa a sesión caducada |
| `... fallo 503` | Toda RPC responde 503. `fallo 0` corta la conexión. `fallo no` lo quita |
| `... estado` | Sesiones activas, códigos pendientes y la economía de la cuenta llena (la TV no puede moverla) |
| `... apagar` / `encender` | Cierra de verdad la API (conexión rechazada) y la vuelve a abrir. El control sigue en `--puerto` + 1 |
| `... apagar-tras-canje` | Se apaga justo al entregar el token: sesión guardada y sin caché |
| `... codigos-cortos 8` | Los códigos nuevos caducan en 8 s. `codigos-cortos no` lo quita |

Punta a punta con el mando (necesita el servidor en el puerto 54399):

```bash
xcodebuild -project tv/NIVLTV.xcodeproj -scheme NIVLTVPuntaAPunta \
  -destination 'platform=tvOS Simulator,name=Apple TV 4K (4th generation)' \
  -derivedDataPath tv/.build CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual test
```

Firma ad hoc (sin certificado): sin ella el Llavero del simulador falla y no se puede enlazar. `TEST_RUNNER_NIVL_CAPTURAS=<carpeta>` guarda las capturas de cada paso.

`RecorridosUITests` son los recorridos A a J con el mando: sin enlazar, código caducado, pestañas, rutina completa, Arena con 200 filas y sin amigos, cuenta vacía, sin red con y sin caché, sesión revocada, cerrar sesión con y sin red, y que sin el argumento no hay demo. `testZ_AreaSeguraRecorridoPrincipal` recorre todas las pantallas comprobando que ningún marco, tampoco el enfocado, sale del área segura (60 arriba y abajo, 80 a los lados): córrelo en un Apple TV a 4K y otro a 1080p. Usan `-nivlLimpiar 1` para empezar sin la sesión de la vuelta anterior.

`SalonUITests`, en el mismo scheme, recorre la sesión guiada y el foco con la demo y no necesita servidor; `testRefrescarNoPierdeFoco` y `testSesionCaducadaNoCierraElEntreno` sí, y tardan algo más de un minuto porque respetan el tope de un refresco por minuto.
