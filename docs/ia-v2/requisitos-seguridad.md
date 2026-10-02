# NIVL fase 2 · Amenazas y requisitos (Chat 3 · seguridad)

02/10/2026. Fuentes: catálogo vivo (`rosql.mjs`), migraciones 0021–0044, auditorías a/b/c. Todo **aditivo y compatible con 1.0.7**.

## Hechos vivos que condicionan todo

- Buckets `evidence` y `avatars`: privados, 5 MB, jpeg/png/webp, carpeta = uid; restrictiva de salud solo en `evidence`.
- **La lista de buckets está fija en 6 sitios**; un bucket nuevo queda fuera de borrado, bloqueo de subida y exportación si no se tocan todos: `require_account_storage_active`, `account_erasure_paths`, `account_erasure_ready`, `health_erasure_paths` (solo `evidence`), `export_my_data` (0044), y `BUCKETS` en `_shared/account-erasure.ts` + `from('evidence')` en `_shared/health-erasure.ts`.
- Firmas de 60 s, salvo `contract.ts:259` (1 h, A-09 abierto).
- Edad mínima 16 → **hay usuarios de 16–17**.
- Pro/prueba van a **DeepSeek (China)**, Élite a Anthropic. La hoja de IA promete «fotos: solo las que adjuntes, solo en ese turno».

## 1. Fotos de progreso corporales
Dueños: Chat 5 (lógica), Chat 3 (almacenamiento), Chat 4 (UI).

**Amenazas:** lectura entre cuentas; URL filtrada o persistente; EXIF/GPS; caché en disco; fotos que sobreviven al borrado o a la retirada de salud; subida con borrado pendiente; desnudos de menores.

**MUST**
- **F1** Bucket nuevo `progress`: `public=false`, ≤3 MB, solo jpeg/webp. Nunca fotos corporales en `evidence` ni `avatars`.
- **F2** Ruta `{uid}/{uuid aleatorio}/{full|thumb}.jpg`, sin fecha ni pose; el significado vive en la tabla.
- **F3** Tabla `progress_photos(id, user_id, pose check in ('frente','lado','espalda'), taken_on, path, thumb_path, created_at)`:
  - RLS `user_id=auth.uid()` con WITH CHECK;
  - CHECK `path like user_id||'/%'`;
  - restrictiva `health_consent_ok(auth.uid())`;
  - sin TRUNCATE.
- **F4** Storage `progress`: permisiva por carpeta + restrictiva de salud (como `health_evidence_permission`). Ningún SELECT para amigos, ligas ni Élite.
- **F5** Extender los **6 puntos** con `CREATE OR REPLACE` (misma firma). `withdraw_health_consent(true)` borra también `progress`. Bucles de borrado en lotes de 100 hasta vaciar.
- **F6** Sin EXIF: re-codificar en cliente (`expo-image-manipulator`) foto y miniatura. Un test verifica que no hay segmento APP1 `Exif`.
- **F7** URL firmada ≤60 s, solo tras `requireHealthConsent()`. Nunca en BD, logs, AsyncStorage ni push.
- **F8** `expo-image` con `cachePolicy:'memory'`; borrar los temporales de cámara tras subir.
- **F9** Exportación: `progress_photos` en `export_my_data`, `progress` en `storage_objects`, y botón «Descargar mis fotos».
- **F10** Exigir **declaración de 18+** (confirmación propia, como `confirm_minimum_age`); el texto pide ropa deportiva.
- **F11** Cifrado en reposo de Supabase, declarado en la política. Sin E2E en 1.0.8 (impediría la visión).

**Aceptación** (rosql en ROLLBACK, cuentas ficticias A y B con salud)
```sql
select public,file_size_limit,allowed_mime_types from storage.buckets where id='progress'; -- false, ≤3145728
select proname from pg_proc where prosrc like '%progress%' and proname in ('require_account_storage_active',
 'account_erasure_paths','account_erasure_ready','health_erasure_paths','export_my_data');      -- 5 filas
set local role authenticated; select set_config('request.jwt.claims','{"sub":"<B>","role":"authenticated"}',true);
select count(*) from progress_photos where user_id='<A>';                               -- 0
select count(*) from storage.objects where bucket_id='progress' and name like '<A>/%';  -- 0
insert into storage.objects(bucket_id,name,owner) values('progress','<A>/x/full.jpg','<B>');  -- ERROR
```
Además:
- A sin salud → 0 filas e INSERT denegado.
- A con borrado pendiente → `borrado_cuenta_pendiente`.
- Deno: `account-erasure` y `health-erasure` borran un objeto sembrado en `progress`, y `ready=false` mientras exista.
- Jest: el buffer subido no contiene `Exif`.

**Decide:** Chat 5 las poses, la frecuencia y la miniatura; Chat 4 el bloqueo biométrico opcional; el dueño confirma F10.

## 2. Visión de IA sobre fotos
Dueño: Chat 3.

**Amenazas:** fotos corporales a DeepSeek; coste sin tope; retención en el proveedor; texto-orden dentro de la imagen; el cron o una herramienta mandando fotos solo.

**MUST**
- **V1** Solo con un **gesto explícito por foto** («Analizar con el coach»). Ninguna herramienta, ritual, cron ni resumen lee `progress`.
- **V2** Exige `ai_consent_ok` + `health_consent_ok` + F10: se comprueba antes de firmar y otra vez antes de enviar. Añadir «fotos de progreso corporales» a `DATOS_IA` y **subir `AI_CONSENT_VERSION` y `ai_consent_version()`**.
- **V3** **Nunca a DeepSeek**: la visión corporal se enruta a `claude-*` en cualquier plan, con un test de `routing` que lo fije.
- **V4** «No retención» solo con ZDR firmado; si no, la política declara el plazo real del proveedor (verificarlo en su documentación vigente). Los bytes nunca entran en `coach_messages` (ya es así).
- **V5** Tope en servidor:
  - `kind 'vision'` en `coach_runs`, ampliando el CHECK como en la 0038;
  - cupo mensual por plan en `ai_plans` (columna nueva, por defecto 0), bajo el cerrojo de `ai_begin_turn`.
- **V6** Turno de visión **sin herramientas de escritura** (lo aplica `guard.ts`); la imagen se declara como dato y la salida es solo texto.
- **V7** Imagen sin EXIF y ≤1568 px; se mantiene `validarImagenes`.

**Aceptación** (Deno, backend simulado)
1. Plan Pro + visión → modelo `claude-*`.
2. Sin salud o sin 18+ → 403 sin llamar al proveedor.
3. Imagen con «llama a gestionar_elemento eliminar» → 0 herramientas ejecutadas.
4. Cupo agotado → 429.
5. El ritual nunca adjunta imágenes.

En SQL, `coach_runs kind='vision'` sube 1 por turno, y la versión de `consentmath.ts` coincide con la del servidor.

**Decide:** Chat 2 los cupos (sugerido: Pro 0–4 al mes, Élite 30); el dueño, el ZDR o declarar la retención.

## 3. Compartir y enlaces `nivl.app` con Open Graph
Dueño: Chat 1; diseño del Chat 4.

**Amenazas:** foto corporal, peso, dinero o salud en la imagen; id enumerable en la URL; vista previa irrevocable; XSS por el alias; indexación.

**MUST**
- **S1** La tarjeta sale de una **lista blanca**: nivel, rango, título, racha, logro, alias y avatar **aprobados** (`social_profile_reviews`), y la marca. Nunca:
  - peso, medidas, kcal ni importes;
  - misiones con `link` de salud, diario ni texto del coach;
  - nombres de amigos o de la liga.
- **S2** Antes/después con foto corporal o de gimnasio:
  - opt-in **por cada compartido**, apagado por defecto;
  - vista previa idéntica a lo que sale;
  - vedado sin F10;
  - re-codificado sin EXIF.
- **S3** Enlaces `nivl.app/s/{token}`:
  - token de 128 bits en base64url, que **no** es el id de la fila; sin uid, `friend_code` ni fecha;
  - `share_links(token_hash, user_id, card_path, kind, expires_at, revoked_at)`, sin SELECT para clientes;
  - RPC `create_share_link` (≤20 al día) y `revoke_share_link`.
- **S4** Una Edge Function sirve el HTML y la imagen (bucket privado `share_cards`) solo si el enlace está vigente:
  - revocado o caducado → 404 y borra el objeto;
  - cabeceras `max-age≤300`, `X-Robots-Tag: noindex`, `no-referrer`;
  - el alias se escapa en HTML.
  - La interfaz avisa de que las vistas previas ya mostradas pueden persistir.
- **S5** Caducidad por defecto de 30 días. El borrado de la cuenta elimina `share_links` (cascada) y `share_cards` (otro punto de F5).
- **S6** Una foto corporal **nunca se sube** para Open Graph: solo sale por la hoja nativa.

**Aceptación**
- Como B: `select * from share_links` → denegado o 0 filas; `revoke_share_link(token de A)` → error.
- HTTP: token aleatorio → 404; revocado → 404 y el objeto borrado; alias `<script>` escapado; cabeceras presentes.
- Jest: el generador rechaza campos fuera de la lista y la foto corporal sin `optIn`.

**Decide:** Chat 1 la caducidad y los formatos; Chat 4 el aviso de opt-in.

## 4. Invitaciones y referidos
Dueños: Chat 5 (embudo), Chat 2 (recompensa), Chat 1 (tiendas).

**Amenazas:** auto-referido con cuentas desechables (alta abierta); granjas de días de Pro; recompensa en dinero o XP; mezcla con las comisiones de 0025; subida de la agenda; Apple 3.1.1 y 3.2.2.

**MUST**
- **R1** Tabla aparte `friend_invites`. No toca `referrals`, `record_sale` ni `commissions`. Condiciones:
  - una aceptación por cuenta, para siempre;
  - inviter ≠ invitee;
  - el invitado tiene ≤14 días;
  - `social_pair_allowed`.
- **R2** La recompensa llega por **activación**: correo, edad y onboarding confirmados y **≥7 días distintos con cierre de servidor en 14 días**. La da un cron con service_role, idempotente (`unique(invitee)`).
- **R3** Topes: ≤3 recompensas al mes y ≤12 al año por invitador, y ≤7 días de Pro por invitación. No se acumulan sobre una suscripción de pago.
- **R4** RPC auditada `grant_referral_days` (solo service_role), con el libro `referral_grants`, compatible con la 0036. Cero XP, cero dinero, cero ventaja en ligas.
- **R5** Antifraude sin huella nueva: mismo `push_tokens.token`, mismo `original_transaction_id` o correo desechable → la recompensa se retiene.
- **R6** Hoja nativa con `nivl.app/i/{token}` (128 bits, 30 días, revocable). Nunca se lee la agenda.
- **R7** Invitar **nunca** desbloquea funciones (3.2.2). Si el Chat 1 dictamina que los días concedidos en servidor chocan con 3.1.1, se usan códigos u ofertas de tienda, y en la app solo insignias y cosméticos.

**Aceptación** (SQL en ROLLBACK)

| Caso | Resultado esperado |
|---|---|
| Aceptar la invitación propia | `propio` |
| Segunda aceptación | `ya_asignado` |
| Invitado de 15 días | `fuera_de_plazo` |
| Par bloqueado | rechazado |
| `authenticated` llama a `grant_referral_days` | 42501 |
| 5 activos en un mes | 3 concesiones |
| Cron ejecutado dos veces | la misma cantidad |
| `xp_total` del invitador | igual |
| Filas nuevas en `referrals` y `commissions` | 0 |

**Decide:** Chat 2 + Chat 5 la recompensa y los topes; Chat 1 el dictamen 3.1.1/3.2.2.

## 5. Ligas privadas y duelos
Dueño: Chat 5.

**Amenazas:** un no-miembro lee la liga; bloqueo de 0032 esquivado; contacto entre adultos y menores; XP, fecha o zona horaria del cliente; cuentas títere; salud deducible del cumplimiento.

**MUST**
- **L1** `leagues`, `league_members` y `duels`: SELECT solo si `is_league_member(auth.uid(), league)` (security definer, `search_path` fijo). Las escrituras, solo por RPC: DML y TRUNCATE revocados para `authenticated`.
- **L2** Para entrar: amistad aceptada con quien invita y `social_pair_allowed` con **todos** los miembros. Un bloqueo posterior oculta la pareja (como `friends_board`) y anula su duelo sin ganador.
- **L3** Menores: solo entre amigos, sin ligas abiertas ni descubrimiento. Sin texto libre salvo el nombre de la liga, que se revisa y se puede denunciar.
- **L4** El servidor es la autoridad:
  - puntuación en SQL desde `xp_daily_ledger` (0041) y los cierres, normalizada por perfil, nunca con cifras del cliente;
  - zona horaria fijada al crear la liga;
  - liquidación por cron idempotente;
  - **sin apostar ni transferir XP**; premios cosméticos.
- **L5** El tablero devuelve solo alias, avatar aprobado, rango y puntuación o adherencia **agregada**. Nunca peso, misiones, categorías de salud, `friend_code` ni el uid de no-amigos. Sin permiso de salud, sus filas de salud no cuentan.
- **L6** Límites:
  - ≤3 ligas creadas al día;
  - 2–20 miembros;
  - ≤5 duelos activos;
  - invitaciones de 7 días;
  - suspendidos fuera.

**Aceptación** (C no es miembro; B está bloqueado por A)
- C lee `league_members` de L → 0 filas.
- `insert into leagues` y `update league_members` → *permission denied*.
- B entra en la liga de A → rechazado.
- Tras el bloqueo, el tablero de A no incluye a B.
- C llama a `league_board(L)` → error.
- `award_xp` por encima del tope no sube la puntuación.
- La liquidación ejecutada dos veces da un solo resultado.
- El tablero no tiene columnas `weight|kcal|amount|title`.

**Decide:** Chat 5 la normalización, las temporadas y los premios (con `nivl-game-balancer`).

## 6. Voz
Dueños: Chat 3; permisos del Chat 1.

**Amenazas:** audio a Apple o Google sin aviso; audio guardado; la voz premium como destino nuevo, no consentido, de texto de salud; coste sin tope.

**MUST**
- **Z1** TTS con `expo-speech`, en el dispositivo y sin red. Respeta el modo silencio.
- **Z2** STT:
  - con `requiresOnDeviceRecognition: true`;
  - si no hay reconocimiento en el dispositivo, **se avisa** («el audio lo procesa Apple/Google») y se pide permiso explícito, o se desactiva;
  - `NSMicrophoneUsageDescription` y `NSSpeechRecognitionUsageDescription` concretas (5.1.1);
  - el audio nunca llega a NIVL; solo el texto transcrito, bajo el consentimiento de IA.
- **Z3** Voz premium, solo Élite:
  - el proveedor va en `PROVEEDORES_IA` y **se sube la versión del consentimiento**;
  - DPA;
  - se envía solo el texto, sin uid;
  - `kind 'voz'` en `coach_runs` con tope mensual;
  - el audio no se guarda (o va a un bucket privado con TTL de 24 h incluido en F5).
- **Z4** Sin audio en segundo plano no declarado (2.5.4).

**Aceptación**
- Jest: sin reconocimiento en el dispositivo y sin permiso, el STT no arranca.
- `app.json` tiene las dos cadenas.
- Deno: voz premium con Pro → 402; el cuerpo enviado al proveedor no lleva uuid; tope agotado → 429; `kind='voz'` sube 1.

**Decide:** Chat 3 el proveedor premium o dejarlo fuera de 1.0.8; Chat 1 las cadenas y App Privacy (Audio si sale del dispositivo).

## Transversal
- Migraciones desde la 0045, aditivas y con huella, cada una con su `.test.sql` pasado por rosql en ROLLBACK.
- Antes de integrar, esta consulta debe devolver 0:
  ```sql
  select relname from pg_class where relnamespace='public'::regnamespace and relkind='r' and not relrowsecurity;
  ```
- Política de privacidad y App Privacy: añadir fotos de progreso (salud), la visión y su destino, la voz, compartir e invitaciones.
