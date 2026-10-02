# Capturas de la App Store 1.0.8: flujo de Maestro y cuenta demo

**Estado (02/10/2026): nada de esto se ha ejecutado todavía.** Ni el flujo en un simulador ni la siembra contra Supabase. Los selectores salen del código y la sintaxis está validada.

| Pieza | Archivo | Dueño |
|---|---|---|
| Flujo de las 7 escenas | `e2e/maestro/capturas-108.yaml` | Chat 5 |
| Siembra de la cuenta demo | `scripts/seed-capturas.mjs` | Chat 5 (lo ejecuta el coordinador) |
| Workflow de CI | `.github/workflows/screenshots.yml` (en integración desde `c8f5e40`) | Coordinador |

**Procedencia:** propuesta del Chat 1 @`20c1861` (`docs/release-audit/fase2/capturas/`), revisada contra `winter2/integracion` @`21764de`. Ese commit ya incluye L3: Perfil, Amigos y la cola de celebraciones.

## Qué prueba y qué no

**No prueba lógica.** Son capturas para la ficha de la tienda. El flujo solo lee: no completa misiones, no compra, no restaura y no acepta consentimientos. Que pase no acredita nada de QA: la matriz sigue mandando (`MATRIZ-QA.md`, `QA-FISICA-WINTER.csv`).

Solo hay dos comprobaciones, y existen para no subir una captura que no vale:

- **Perfil:** el avatar debe anunciar «…, rango A, …». Si no, la siembra o `sync_rank` no se hicieron.
- **Amigos:** tiene que haber al menos una fila de rival con «Denunciar o bloquear a …». Apple pide que la denuncia y el bloqueo estén a la vista.

## Correcciones a la propuesta del Chat 1

| # | Propuesta | Problema en `21764de` | Corrección |
|---|---|---|---|
| 1 | `runFlow: login.yaml` | `login.yaml` toca `'^(Correo\|CORREO\|Correo electrónico)$'` y `'^(Contraseña\|CONTRASEÑA)$'`. Esos patrones casan también con los rótulos de texto que hay encima de cada campo, y tocar un rótulo no enfoca el campo. Además, pulsa `'^ENTRAR$'` con `index: 1`. En iOS, el conmutador expone «Entrar con cuenta existente» (es su `accessibilityLabel`), así que solo queda un «Entrar» (el botón) y el índice 1 no existe. | El login va dentro del flujo: `'^Correo electrónico$'` (el `accessibilityLabel` del campo), `'^Contraseña$'` con `index: 1` (el campo, que está debajo del rótulo) y el botón `'^Entrar$'` con `below: '^Contraseña$'`. Además, se rechaza «Guardar contraseña» si iOS lo ofrece. **`login.yaml` no se ha tocado:** fuera del alcance de este encargo. Conviene aplicarle el mismo arreglo. |
| 2 | `extendedWaitUntil: '^Hoy$'` como única espera | Sirve para la pestaña: `accessibilityLabel="Hoy"` en TabBar, NavRail y NavSidebar. Pero Hoy puede estar todavía en huecos. | Se mantiene, y además se espera a que desaparezca `'^Cargando tu día$'`. |
| 3 | `notVisible: 'Cargando precios'` | Maestro compara la expresión regular con el texto entero. «Cargando precios» no casa con «Cargando precios de la tienda» (`ProOffer.tsx`), así que la espera pasaba siempre en el acto. | `'^Cargando precios de la tienda$'`, y antes `'^Cargando NIVL Pro$'` (el hueco de `/pro`). |
| 4 | Escena 7 con `openLink: nivl://pro` y nada más | Una cuenta con Pro o en prueba no ve planes en `/pro`: ve «Tu plan». | Si aparece «Ver NIVL Élite» o «Suscribirme», se pulsa. Eso solo despliega `ProOffer`, sin comprar. |
| 5 | Escena 4: «liga, con denuncia y bloqueo visibles» | En `21764de`, ninguna pantalla usa las RPC de ligas privadas. Existen `competicionData.ts` y la 0048, pero Amigos pinta el «Ranking» de amigos y «Tu ludus» (Élite, formado a mano). | Se captura el Ranking: `scrollUntilVisible` hasta la primera fila de un rival, centrada. La liga se siembra igualmente, para cuando llegue su pantalla. |
| 6 | Sin esperas en Coach, Perfil, Campañas ni Agenda | Las cuatro pintan huecos al cargar. | Se espera a que desaparezca el hueco de cada una: «Cargando el coach», «Consultando el registro», «Cargando tus campañas» y «Cargando tu agenda». |
| 7 | — | L3 añadió una cola de celebraciones. Con `clearState: true` se borran las celebraciones ya vistas, guardadas en AsyncStorage, y una ceremonia puede tapar la pantalla. | Antes de cada foto: si se ve «Cerrar la celebración», se pulsa. |

**Rutas comprobadas:** con `scheme: nivl` (`app.json`) y expo-router, `nivl://amigos` abre `src/app/amigos.tsx`. Los grupos no cuentan en la URL, así que `nivl://mazmorras` abre `(tabs)/mazmorras.tsx` y `nivl://agenda` abre `(tabs)/agenda.tsx`. `nivl://pro` abre `src/app/pro.tsx`. A Hoy, Coach y Perfil se llega tocando la pestaña: `accessibilityLabel` «Hoy», «Coach» y «Perfil» en las tres navegaciones (barra inferior en iPhone; barra lateral en iPad 13", que mide ≥ 1024). `appId: com.teferi.nivl` coincide con `bundleIdentifier`.

**Validación del YAML:** `js-yaml` (de `node_modules`) lo carga sin errores: dos documentos, 47 pasos, 7 `takeScreenshot` con el nombre `capt-${SLUG}-NN-…` que espera el workflow y 4 `openLink`. Se quitaron las anclas YAML (`&`/`*`) porque no está claro que el parser de Maestro las resuelva.

**Sin verificar** hasta la primera ejecución:

- que Maestro compara sin distinguir mayúsculas;
- `optional` en `extendedWaitUntil`, que viene de la propuesta;
- `centerElement` en `scrollUntilVisible`;
- el orden de `index` cuando hay varias coincidencias.

## Cuenta demo de capturas

La cuenta demo es **distinta de la revisora de Apple** y de cualquier cuenta real. Alias genérico: «Gladiador demo». Correo de un dominio de pruebas propio, y que no sea de una persona. La dan de alta el coordinador o el usuario, nunca un script.

### Antes de sembrar, en la app y con la cuenta demo

1. Onboarding completo: contrato y firma, edad mínima, consentimiento de salud y de IA, en esa cuenta. El script no pone `onboarding_done`, porque saltaría la firma. Solo avisa si falta.
2. Anotar su uuid (`DEMO_USER_ID`) y el de las cuentas protegidas (`PROTECTED_IDS`). Como mínimo, la revisora de Apple y la del dueño.

### Rivales para Amigos (y la liga)

Hacen falta **3–5 cuentas ficticias más** (`FRIEND_IDS`). Mismas reglas que la demo: correo de pruebas, nada de nombres reales. Hay que darlas de alta y pasar el onboarding con cada una. El script las llama «Rival demo 1…5» y les da un nivel menor que el de la demo: 15–24, con 30–76 días activos y rachas de 3 a 20, para que la demo no salga sola ni imbatible.

| Paso | Quién (sesión) | RPC |
|---|---|---|
| Amistad | cada rival | `friend_request(p_code := friend_code de la demo)` |
| Aceptarla | demo | `friend_respond(p_friendship, true)` |
| Crear la liga | demo | `league_create('Liga demo')` |
| Invitar | demo | `league_invite(liga, rival)` por cada rival |
| Entrar | cada rival | `league_accept(liga)` |
| Rango | cada cuenta | `sync_rank()` |

Todas exigen `auth.uid()` y no se pueden hacer con la clave de servicio. Hay dos caminos:

- **Por defecto:** el script imprime los pasos. La amistad se pide desde la app («Añadir por código» en Amigos), iniciando sesión con cada rival. La liga todavía no tiene pantalla, así que necesita las RPC.
- **Con `--sesiones`:** el script abre una sesión de cada cuenta con la clave de servicio, igual que `scripts/session.mjs`: genera un enlace mágico, no envía ningún correo y lo canjea por un JWT que no se imprime. Después llama a las RPC como cada usuario. Antes de tocar nada, comprueba que la amistad, la invitación o la pertenencia no existan ya.

Nombres en Amigos: lo que ven los demás sale de `social_public_name` (0032). Mientras la moderación no apruebe el alias, el ranking enseña «Gladiador xxxxxx», con el principio del uuid. Si se quiere «Gladiador demo» o «Rival demo N» en la captura, hay que aprobarlos en el panel de moderación (0037). Es decisión del coordinador.

### Qué deja la siembra

Comprobado en seco con uuids ficticios:

- **Nivel 26** (`xp_total` 137 938, el punto medio del nivel según la curva `100·N^1,5` de `game.ts`). El A pide nivel ≥ 22; S exigiría nivel ≥ 30 y 600 días.
- **311 días activos:** una misión, «Leer 20 páginas» (media, INT), cumplida en 310 días de los últimos 345 y hoy. El `xp_awarded` es el de `questXp`: 50 × multiplicador de racha (50–80).
- **Racha de 42 días**, que acaba ayer. `last_day_processed` = ayer, así que al abrir la app no se cierra ningún día atrasado.
- **5 misiones hoy** con nombres genéricos: «Leer 20 páginas», que es la cumplida, «Planificar el día», «Repasar inglés 15 minutos», «Ordenar el escritorio» y «Avanzar el proyecto una hora». Las cuatro nuevas se crean con `created_at = now()` y no cuentan como falladas en días pasados.
- **Rango A**, que registra `sync_rank()`. Nunca se inserta `rango_X` a mano: la 0051 lo prohíbe y lo decide el servidor.
- **Estadísticas:** `xp_fue`…`xp_per` se reparten del total. El resto de la XP representa campañas, misiones y logros que no se siembran.
- **Sin salud:** ni gym, ni peso, ni cardio, ni dieta, ni diario. Los títulos no enlazan con ningún módulo (`infer_link` los deja en «ninguno»).

**Idempotencia.** Los ids de las misiones son deterministas, derivados del uuid de la cuenta. Las completions usan `on_conflict (user_id, quest_id, date)` e ignoran los duplicados, y el perfil se escribe con valores absolutos. El script no borra nada. Hay que ejecutarlo **el mismo día de las capturas**: «hoy» y «ayer» se calculan con la zona del perfil.

**Excepción a una regla del proyecto.** AGENTS.md dice que la economía solo se mueve por RPC. Esta siembra escribe `xp_total`, `streak_days` y las completions con la clave de servicio porque no existe una RPC para rellenar historia. Es una excepción **solo para cuentas ficticias de capturas**, protegida con `DEMO_USER_ID` y `PROTECTED_IDS`. Nunca se usa con una cuenta real.

## Cómo se ejecuta

```bash
# 1. En seco (no conecta a nada): resumen + SQL equivalente + pasos de sesión
DEMO_USER_ID=<uuid demo> FRIEND_IDS=<uuid>,<uuid>,<uuid> node scripts/seed-capturas.mjs

# 2. Aplicar (coordinador; las claves solo en el entorno de esa terminal)
export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...      # nunca en el repo ni en un archivo
DEMO_USER_ID=... FRIEND_IDS=... PROTECTED_IDS=<revisora>,<dueño> \
  node scripts/seed-capturas.mjs --apply
#    …y para que el script haga también rango, amistades y liga:
SUPABASE_ANON_KEY=... DEMO_USER_ID=... FRIEND_IDS=... PROTECTED_IDS=... \
  node scripts/seed-capturas.mjs --apply --sesiones

# 3. Abrir la app UNA vez con la demo (Hoy llama a sync_rank; si sale la
#    ceremonia del rango, cerrarla) y comprobar Perfil = rango A.

# 4. Capturas: el workflow «Capturas App Store (simulador)», a mano.
#    En local (macOS, simulador arrancado y build instalada):
maestro test -e NIVL_QA_EMAIL="$NIVL_SHOTS_EMAIL" -e NIVL_QA_PASSWORD="$NIVL_SHOTS_PASSWORD" \
  -e SLUG=iphone-69 --test-output-dir qa-out/capturas e2e/maestro/capturas-108.yaml
```

El script se niega a seguir si:

- falta `DEMO_USER_ID` o no es un uuid;
- alguna cuenta está en `PROTECTED_IDS`;
- se pasa `--apply` sin `PROTECTED_IDS`;
- se pasa `--apply` sin `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`;
- no existe el perfil de alguna cuenta;
- el plan no da nivel ≥ 24, 300 días, racha ≥ 30 y rango A.

El script no imprime claves, JWT ni correos.

## Decisiones pendientes del coordinador

- **¿La demo con Pro o sin Pro?** Con Pro, el Coach enseña una conversación, pero tiene que ser real: alguien escribe y la IA responde, con su coste, y sin datos personales. Además, `/pro` enseña «Tu plan» y el flujo despliega la oferta con «Ver NIVL Élite». Sin Pro, el Coach enseña la muestra bloqueada y `/pro` la oferta. El flujo vale para los dos casos.
- **Campañas y Agenda** salen vacías si no se crean a mano en la app («Abrir campaña», «Añadir evento»). Con títulos genéricos («Terminar el curso de inglés», «Revisión del proyecto»). El script no las siembra.
- **Moderación de los alias** de la demo y de los rivales: ver arriba.

## Riesgos

- **Los datos ficticios no deben parecer de nadie.** Nada de nombres, caras, ciudades, correos ni fotos reales: el repo es público y el artefacto con las capturas se puede descargar 3 días. Sin avatar subido: se queda la inicial. En el Coach, nada que se lea como la vida de una persona concreta. Hay que revisar cada captura a ojo antes de subirla a App Store Connect.
- **Nunca la revisora de Apple.** El script se niega si su uuid va en `PROTECTED_IDS`, que es obligatorio con `--apply`. Si alguien no la incluye, la protección no existe: hay que ponerla siempre.
- **La siembra escribe en el Supabase que usa la app,** que es producción: la build de capturas lleva `environment: production`. Toca solo filas de las cuentas indicadas y no borra nada. Aun así, hay que ejecutarla en seco primero y leer la salida.
- **Precios:** si StoreKit no carga en el simulador, la escena 7 se repite a mano en TestFlight. Nunca se maquilla un precio.
- **Maestro 2.10.0, checksum: NO verificado por el Chat 5.** El workflow fija `MAESTRO_SHA256 = 29b675e10cc12080e445e9bfb2e2b4e4dfb9c0f2e30d5884120d258b5e1cd991` para el asset `maestro.zip` de la release `cli-2.10.0` (publicada el 31/08/2026). Ese valor lo **obtuvo el Chat 1 de la API de GitHub** (`gh api repos/mobile-dev-inc/maestro/releases/tags/cli-2.10.0`); el Chat 5 no lo ha verificado. La release trae también `checksums_sha256.txt`. Antes de fiarse, contrástalo con la publicación oficial y no lo copies de este documento. La instalación es descargar el zip y comprobarlo con `shasum -a 256 -c`, como en el workflow propuesto por el Chat 1 @`8e2fa59`. Nunca `curl | bash`.
