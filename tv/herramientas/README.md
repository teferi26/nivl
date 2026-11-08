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
| `node tv/herramientas/servidor-pruebas.mjs aprobar [CODIGO] --cuenta llena` | Aprueba el código (o el último pendiente). Cuentas: `llena`, `vacia` (sin rutina ni amigos), `sinsalud` (sin consentimiento de salud) y `descanso` (hoy no toca, próxima sesión pasado mañana) |
| `... rechazar [CODIGO]` | La TV pasa a `denegado` |
| `... caducar-codigo` | Caduca los códigos pendientes |
| `... revocar` | Borra todas las sesiones: la TV pasa a sesión caducada |
| `... fallo 503` | Toda RPC responde 503. `fallo 0` corta la conexión. `fallo no` lo quita |
| `... estado` | Sesiones activas y códigos pendientes |

Punta a punta con el mando (necesita el servidor en el puerto 54399):

```bash
xcodebuild -project tv/NIVLTV.xcodeproj -scheme NIVLTVPuntaAPunta \
  -destination 'platform=tvOS Simulator,name=Apple TV 4K (4th generation)' \
  -derivedDataPath tv/.build CODE_SIGNING_ALLOWED=NO test
```

`SalonUITests`, en el mismo scheme, recorre la sesión guiada y el foco con la demo y no necesita servidor; `testRefrescarNoPierdeFoco` sí, y tarda algo más de un minuto porque respeta el tope de un refresco por minuto.
