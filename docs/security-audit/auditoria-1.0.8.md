# Auditoría de seguridad 1.0.8 frente a 1.0.7

NIVL - Seguridad · 04/10/2026.

- **Diff revisado:** `c87df0d..winter2/integracion`, 397 archivos (+52.770 / −7.314).
- **Método:** dos revisiones por lectura en paralelo (servidor y cliente) y, para cada P1, reproducción propia.
- **Resultado:** 0 P0, 4 P1 y 15 P2.

Leyenda de la evidencia:
- **R** = reproducido en producción con BEGIN…ROLLBACK (`rosql.mjs`, cuentas `@example.invalid`);
- **L** = verificado leyendo el código;
- **H** = hipótesis por comprobar.

## P1

### P1-1 · `my_duels()` enseña las cifras del rival oculto, bloqueado o que no aceptó (R)
- **Archivo:** `supabase/migrations/0048_competicion.sql:481-503`.
- **Fallo:** `su_indice` y `sus_dias` salían en cualquier estado (`pending`, `declined`, `cancelled`) y sin mirar `social_visible`; solo el nombre pasaba por `_pareja_ok`.
- **Reproducción:** A reta a B, B está oculto y rechaza. `my_duels()` como A devuelve `status=declined … su_indice=70 sus_dias=0` y el alias de B.
- **Impacto:**
  - un reto que nunca se acepta sirve para mirar el índice semanal de otra persona durante 5 semanas;
  - se salta el «ocultarse» de 0021 y el bloqueo de 0032;
  - el índice puede incluir misiones de salud.
- **Arreglo:** dentro de la 0055 de Juego y QA, que también reescribe `my_duels`: `docs/security-audit/propuestas/0055_competicion_privacidad.sql`. Las cifras y el nombre solo salen si el duelo está aceptado o terminado, la pareja está bien y el rival es visible; si no, `null`.
- **Probado (R):**

  | Rival | Estado | Resultado |
  |---|---|---|
  | B, oculto | rechazado | null |
  | C, visible | aceptado | con cifras |
  | D, oculto | aceptado | null |
  | E, visible | pendiente | sin cifras |

- **Cliente, a la vez:** `src/components/amigos/Competicion.tsx:249,385,394,411` y `src/lib/competicionData.ts:87-89` asumen números. Con `null`, `BarraDuelo` pintaría «null» y una barra NaN. Hay que tipar `number | null` y enseñar «oculto».
- **Orden:** el ajuste del cliente (OTA 1.0.8) primero o junto con la migración.

### P1-2 · El permiso de «dictar por la red» lo heredaba la siguiente cuenta del móvil (L, ARREGLADO)
- **Archivos:** `src/components/coach/redDictado.ts` guardaba `'1'` sin usuario y con caché en memoria; `cerrarSesion` no lo borraba.
- **Reproducción:** A acepta la hoja «el audio sale a Apple o Google» y cierra sesión. B entra y su voz sale a Apple sin haber visto el aviso. En iOS el dictado siempre va por la red.
- **Arreglo (este commit):**
  - el permiso guarda el uid de quien aceptó y solo vale para esa sesión;
  - el valor `'1'` de la 1.0.8 deja de valer, así que se vuelve a preguntar;
  - `olvidarRedDictado()` se llama en `cerrarSesion`.
- **Tests:** `src/lib/__tests__/sec-dictado-red.test.ts` (4/4) y `sec-auth-flow` (37/37).
- **Archivo del NIVL - Experiencia:** cambio mínimo, avisado.

### P1-3 · La propuesta 0049 (pasos) desharía el borrado de fotos de progreso si se aplica después de 0050 (L, riesgo de integración)
- **Archivo:** `docs/release-audit/fase2/0049_origen_salud.sql:74-120` redefine `complete_health_erasure` a partir de la versión anterior a 0050: no mira el bucket `progress` ni la tabla `progress_photos`.
- **Estado en producción (R):** la función actual SÍ borra `progress` y `progress_photos`, y `health_daily_steps` no existe, así que 0049 no está aplicada. Hoy no hay fallo.
- **Arreglo:** antes de integrar 0049, partir de la definición de 0050 y añadir `health_daily_steps`. Añadir una huella o un test que exija `'progress'` en `complete_health_erasure`.

### P1-4 · Las fotos del chat del coach salían a DeepSeek con el plan Pro (L, ARREGLADO en el servidor)
- **Archivos:** `coach/handler.ts`, donde con fotos la ruta es la completa y `resolverModelo` da `deepseek-v4-flash` a Pro (`ai_plans` en producción), y `_shared/openai.ts:79-91`, donde el adaptador compatible convierte las imágenes en `image_url` base64.
- **Reproducción:** un usuario Pro adjunta una foto al coach (`useCoach.adjuntar`) y los bytes van a DeepSeek, lo acepte el proveedor o no.
- **Impacto:** las fotos pueden ser corporales o de comida, es decir, datos de salud. Contradice la decisión «la visión solo con Claude» y la política, que solo menciona texto con DeepSeek.
- **Arreglo:** `fotosSinVision` (`coach/guard.ts`) corta antes de cualquier llamada con un 400: «Con tu plan el coach no ve fotos…». El cliente ya enseña tal cual los 400 que hablan de fotos.
- **Tests:** `sec_fotos_vision_test.ts`. Deno 236/236.
- **Queda pendiente:**
  · ocultar «adjuntar» en el cliente para los planes sin visión (Experiencia);
  · decidir si Pro debe ver fotos con un modelo Claude (producto y coste).

## P2

### Servidor
1. **Ligas (L):** `league_members` y `private_leagues` dejan leer el `user_id` de los demás miembros y el `owner` por REST (`0048:52,69-70`), también de quien está oculto o te ha bloqueado. Arreglo: política `user_id = auth.uid()` y sin `select` directo de `private_leagues`; ya existen `league_board` y `my_league_standing`.
2. **Borrado de cuenta pendiente (L):** las tablas de 0048 no tienen `account_write_guard`, y `league_*`/`duel_*` no miran `account_erasure_pending`. Quien tiene el borrado pendiente sigue saliendo en `league_board` y en `my_duels`.
3. **Exportación (L):** la 0060 no incluye los datos propios de quien es creador (`creators` con alias, código, rango y `role`, sus `commissions` y sus `creator_payouts`). Hay que añadirlos sin `user_id` de compradores.
4. **Lista de espera (R, CERRADO: no se puede saltar el freno):**
   - Prueba del 04/10, autorizada por el coordinador: 7 altas `xff-prueba-N@example.invalid`, cada una con un `X-Forwarded-For` falso y distinto (203.0.113.1-7). Resultado: 1-5 → 200 y 6-7 → **429**.
   - El proxy de Supabase no deja que el cliente elija la IP: el freno por IP funciona. Las 5 filas de prueba las borra el coordinador.
   - Sigue pendiente la doble confirmación cuando se envíe con Resend: se puede apuntar el correo de otra persona.
5. **Inyección por el nombre de una liga (L, residual):** el nombre lo escribe otra persona y entra en el contexto del coach. Ya está mitigado (40 caracteres, `neutralizarDatos`, cliente con RLS, tope de acciones destructivas). Opcional: vetar imperativos en `league_create`.
6. **Push del check-in (H):** `ritual/handler.ts:557` manda el texto generado, que puede nombrar una misión u objetivo, a la pantalla bloqueada y a Expo. Recomendación: cuerpo genérico y el texto dentro de la app.
7. **Repo público (L):**
   - `scripts/portal/desplegar.sh:20` publica el scope de Vercel con el correo del dueño;
   - su comprobación de secretos no busca un JWT de `service_role` en base64 (`c2VydmljZV9yb2xl`).

### Cliente
8. **Restos al cerrar sesión (L):**
   - las copias temporales de comparar fotos y la caché del selector si se cierra la app a la fuerza;
   - la caché de disco de expo-image (avatares);
   - las claves `nivl:duelos:vistos` y `nivl.ofertas.v1`;
   - los avisos ya mostrados.
   - Arreglo: en `cerrarSesion`, borrar temporales, `Image.clearDiskCache()`, `Notifications.dismissAllNotificationsAsync()` y `multiRemove` de esas claves.
9. **GPS en el EXIF de las fotos de progreso en Android (H):** expo-image-picker puede copiar el EXIF al comprimir. Comprobar en un dispositivo con una foto con ubicación. Arreglo: volver a codificar con expo-image-manipulator antes de subir.
10. **Texto del permiso de micrófono (L):** `app.json:81` habla de «grabar vídeo de evidencia», que no existe, y dos plugins escriben `NSMicrophoneUsageDescription`. Hay que dejar un solo texto, sobre la voz al coach. Riesgo de rechazo por la regla 5.1.1.
11. **`screenshots.yml` (L):**
    - `EXPO_TOKEN` y la contraseña de la demo están en el `env` de todo el job;
    - `eas-cli@latest` sin versión fija y la acción de Xcode fijada por etiqueta;
    - `inputs.ref` acepta cualquier SHA.
    - Arreglo: secretos solo en el `env` de los pasos que los usan, versiones fijadas por SHA y ref limitado a ramas propias.
12. **`competicionData.ts:16` (L):** enseña `error.message` con el código 22023, que Postgres también usa. Arreglo: marcar los mensajes propios y en el resto usar `mensajeSistema`.
13. **Alias genérico en las tarjetas (L):** cuando no hay alias aprobado, «Gladiador» va con 6 caracteres del UUID, lo que permite enlazar las tarjetas que se comparten. Usar un genérico sin UUID.
14. **App Links de Android (L):** `assetlinks.json` sigue con `PENDIENTE_SHA256_FINGERPRINT`.
15. **Fuera del diff:** «Salir» de `EdadMinima.tsx:107` hace un `signOut` sin la limpieza de `cerrarSesion`.

## Revisado y correcto (resumen)
- **0045, 0046, 0047, 0050, 0051, 0052, 0053 y 0054:**
  - RLS, `security definer` con `search_path` y comprobación de `auth.uid()`;
  - bucket `progress` privado, por carpeta, con salud y 18+;
  - el borrado de salud y el de cuenta cubren las fotos;
  - `rango_%` no lo puede escribir el cliente.
- **0060:** cubre las tablas nuevas de usuario, salvo lo de creadores (P2-3).
- **Coach v2:** JWT y RLS, doble llave en la ruta estrecha, `coach_runs` lo escribe el servidor, hilo validado y resumen con consentimiento.
- **Fotos en el cliente:** firmas de 60 s, sin rutas al exterior, bloqueo de capturas y placa en segundo plano.
- **Compartir:** todo apagado por defecto, sin EXIF (view-shot).
- **Panel de creador en tienda:** sin importes (lista blanca).
- **Portal:** no se activa en nativo.
- **Avisos:** lista blanca de rutas.
- **Terceros:** ni analítica ni SDK de terceros nuevos; `AD_ID` bloqueado.

## Lo que no se ha comprobado
- P2-9 (EXIF) necesita una prueba en un Android.
- No se ha revisado el diff de la web (repo aparte).
