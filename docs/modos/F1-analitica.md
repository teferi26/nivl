# Modos F1 · Analítica

Rama `modos-f1/analitica`, sobre `winter2/modos-f1` @659714e. Contrato: `coordinacion-winter-arc/MODOS-F1-CONTRATO.md`.

El objetivo es responder a tres preguntas sobre la gente que ya tiene NIVL instalada:

- dónde se quedan;
- qué usan más;
- qué no usan.

Además hay dos piezas más:

- una opinión interna sincera;
- la valoración nativa de la tienda.

Todo va detrás de flags apagados y con migraciones solo aditivas.

## Qué se ha hecho

### 1. Embudo anónimo (`0070_funnel_events.sql` y cliente)

**Antes de empezar se revisó lo que ya existía.** La tabla `events` (0001) es la crónica del juego:

- exige cuenta (`user_id not null`);
- guarda texto escrito por la persona (`onboarding_goal`);
- la lee el coach.

No sirve para un embudo que empieza antes del registro y que no debe llevar texto libre. Por eso se ha creado una tabla aparte. Lo que `events`, `completions`, `quests` y `subscriptions` ya registran se reutiliza en las métricas de admin, sin duplicarlo:

- las subidas de nivel salen de `events.level_up`;
- las misiones, de `completions` y `quests`;
- los pagos, de `subscriptions` y `store_sales`.

**Servidor:**

- tabla `public.funnel_events(id, user_id null, install_id, evento, props, app_version, plataforma, created_at, recibido_en)`;
- RLS activada sin políticas y `revoke all` para `anon` y `authenticated`: nadie la lee desde la app.

**RPC `registrar_evento(p_install_id, p_evento, p_props, p_app_version, p_plataforma, p_ocurrido_en) → boolean`.** La pueden llamar `anon` y `authenticated`. Sus reglas:

- `user_id` lo pone el servidor (`auth.uid()`).
- Lista blanca de eventos y de claves por evento (`funnel_claves_admitidas`).
- Cada valor tiene que ser un entero (|n| ≤ 100000), un booleano o un código `[a-z0-9_]{1,32}`. No caben un correo, un nombre con mayúscula ni una frase.
- Las props ocupan 512 bytes como mucho.
- Error `22023` si algo no cumple.
- Límite de envíos: 120 eventos por instalación y hora, y 3000 por minuto en total. Al pasarlo devuelve `false` y no guarda nada.
- La hora del móvil se acepta solo si cae en los últimos 30 días; si no, `now()`.

**Eventos y props admitidas** (`src/lib/analiticamath.ts` y la 0070 tienen la misma lista, y un test lo comprueba):

| Evento | Props | Dónde se registra |
|---|---|---|
| `primer_arranque` | `previo` (bool: ya había sesión, venía de una versión anterior) | `_layout.tsx` → `arrancarAnalitica()` |
| `apertura_dia` | `dia` (días desde el primer arranque; D1/D3/D7) | al arrancar y al volver a primer plano |
| `registro` | `resultado`: `sesion` \| `confirmar_email` | `useLogin.ts` |
| `onboarding_paso` | `paso` 0 a 6 | `onboarding.tsx` (cada paso que se ve) |
| `onboarding_fin` | `salida`: `compra` \| `prueba` \| `cerrada` \| `sin_oferta` \| `ya_pro` | `onboarding.tsx` |
| `primera_mision_creada` | `origen`: `onboarding` \| `habitos` \| `informe` \| `oraculo` \| `otro` | `data.ts` (`createQuest`, `createStarterQuests`), una vez por instalación |
| `primera_mision_completada` | `con_foto` | `engine.ts` (`completeQuest`, también por `propagarActo`), una vez |
| `paywall_visto` | `motivo` (momento de `paywallmoment.ts`, `onboarding` o `pro`), `compacto` | `ProOfferBody` al montarse |
| `compra_iniciada` | `plan` (id de producto) | `ProOffer` antes de `purchase()` |
| `compra_ok` | `plan`, `resultado`: `activa` \| `pendiente` \| `programada` | `ProOffer` tras `purchase()` |

**Cliente (`src/lib/analitica.ts`):**

- `registrar(evento, props?)` vuelve enseguida y nunca lanza.
- `registrarUnaVez` hace lo mismo, pero una sola vez por instalación.
- `install_id` es un uuid v4 aleatorio guardado en AsyncStorage.
- Cola offline de 200 eventos como mucho: si se llena, se pierde lo más viejo.
- La cola se vacía 1,5 s después de registrar, al arrancar y al volver a primer plano.
- Si falla la red o la RPC aún no existe (`PGRST202`), el evento se queda en la cola. Si el servidor lo rechaza por forma (`22023`), se tira.
- **Con el flag `analitica_activa` apagado, o si no se puede leer, no sale nada del móvil.**
- AsyncStorage y expo-constants se cargan en perezoso, como en `pro.ts`.
- No se ejecuta en web ni en el portal de creadores.
- Al borrar la cuenta (`account.ts`), `olvidarAnalitica()` borra la instalación, la cola y las marcas del móvil.

**Borrado y exportación:**

- `funnel_events.user_id` tiene `on delete cascade`.
- Un trigger borra además las filas anónimas de las mismas instalaciones, como el onboarding previo al registro.
- Caducidad: `purgar_funnel_events()` borra lo que tiene más de 12 meses. No hay cron.

### 2. Opinión interna (`0071_app_feedback.sql`, `HojaOpinion`)

- Tabla `public.app_feedback(id, user_id, gusta, cambiaria, version, created_at)`:
  - 1000 caracteres por campo como mucho y al menos uno con texto;
  - RLS: `authenticated` solo puede insertar la suya, con grant de columnas (`user_id`, `gusta`, `cambiaria`, `version`); nadie lee desde la app;
  - tope de 3 opiniones por cuenta y día (trigger, error `54000`);
  - `on delete cascade`;
  - flag `opinion_activa` sembrado a `false`.
- Hoja «¿Qué te gusta? ¿Qué cambiarías?» (`src/components/opinion/HojaOpinion.tsx` + `usePeticiones.ts`):
  - aparece en Hoy, el día 2 o 3 de uso, tras completar una misión o subir de nivel;
  - nunca encima de una ceremonia;
  - una sola vez, y se puede cerrar con «Ahora no», el asa o el fondo;
  - los textos están en `hoy.json` (`opinion.*`) y aceptados en `docs/i18n/textos-es.aceptados.tsv`.

### 3. Valoración nativa (`src/lib/peticiones.ts`, `peticionesmath.ts`)

- `expo-store-review` **no está en `package.json`** y no se ha instalado.
- El diálogo va detrás de la interfaz `ValoracionNativa`. La implementación pregunta por el módulo nativo `ExpoStoreReview` con `requireOptionalNativeModule`. En el binario actual no existe, así que la valoración no está disponible y no se pide nunca.
- **Hace falta una build nueva:**
  1. `npx expo install expo-store-review`;
  2. lockfile con npm 10;
  3. pasar la revisión de Apple;
  4. después, encender `valoracion_activa`.
- Cuándo se pide:
  - la primera vez, el día 2 o 3, tras un momento bueno;
  - después, como mucho una vez cada 120 días;
  - el sistema operativo además limita cuántas veces se enseña.
- **Sin «review gating»:** la decisión no recibe nada de la opinión, solo las fechas en que se pidió cada cosa, y un test lo fija.
- Si en el mismo momento tocan las dos, va primero la valoración y la opinión espera al siguiente momento bueno. Es solo orden, no filtro.
- **Por OTA puede salir:** la opinión interna, el embudo y la lógica de la valoración, que queda en espera.
- **Con build nueva:** solo el diálogo nativo.

### 4. Métricas para el panel admin (`0072_admin_metricas.sql`)

**Rol admin en servidor:**

- tabla `public.admins(user_id)`, cerrada a `anon` y `authenticated`;
- no hay ningún correo en el cliente ni en el SQL.

Alta del dueño, con service_role en el SQL Editor (no lo hace la app):

```sql
insert into public.admins (user_id) select id from auth.users where email = '<correo del dueño>';
```

**RPC.** Todas son `security definer` y solo de `authenticated`. Todas salvo `es_admin()` empiezan por `exigir_admin()`, que devuelve 42501 si no eres admin:

| RPC | Devuelve | Para |
|---|---|---|
| `es_admin() → boolean` | si la sesión es admin | que la web decida si pinta el panel (la seguridad está en cada RPC) |
| `admin_resumen() → jsonb` | usuarios, altas hoy/7d/30d, activos hoy/7d/30d (`last_open_on`), onboarding hecho, instalaciones nuevas y previas, suscripciones vivas, opiniones | la cabecera |
| `admin_altas_por_dia(p_desde date, p_hasta date)` | `dia, altas, instalaciones` | altas por día |
| `admin_embudo(p_desde, p_hasta)` | `orden, paso, instalaciones, porcentaje` (17 pasos: arranque → registro → onboarding 1-6 → fin → primera misión creada y completada → D1, D3, D7 → paywall → compra iniciada → compra ok) | embudo por paso. La cohorte son las instalaciones nuevas cuyo primer arranque cae en la ventana |
| `admin_donde_se_quedan(p_desde, p_hasta)` | `ultimo_paso, instalaciones` | dónde se quedan |
| `admin_retencion(p_desde, p_hasta)` | `cohorte, instalaciones, d1, d3, d7` | retención por día de primer arranque (D exacto, día local del móvil) |
| `admin_misiones_por_dia(p_desde, p_hasta)` | `dia, completadas, usuarios, creadas` | misiones |
| `admin_uso_modulos(p_desde, p_hasta)` | `modulo, usuarios, registros`: misiones, gym, cardio, nutrición, peso, diario, dinero, coach, fotos de progreso, campañas, amigos, subidas de nivel | qué usan más y qué no |
| `admin_conversiones(p_desde, p_hasta) → jsonb` | suscripciones vivas por plan, estado y proveedor; pruebas iniciadas; cobros de `store_sales` (importe, neto, primeros pagos, reembolsos); embudo de compra; paywall por motivo | conversiones (RevenueCat → `subscriptions`/`store_sales`) |
| `admin_opiniones(p_limite int = 50, p_antes timestamptz = null)` | `id, created_at, version, gusta, cambiaria`, sin user_id | opiniones, paginadas hacia atrás |

Para todas las RPC con ventana:

- fechas en `Europe/Madrid`;
- por defecto, los últimos 30 días;
- 366 días como mucho (si no, error 22023).

El panel web **no** está hecho. Es la siguiente fase y necesita revisión de seguridad antes de producción.

**Exportación:**

- `export_my_data` v9 es la v8 de la 0068 de servidor (`modos-f1/servidor` @1c4748d), copiada sin cambios, más `funnel_events`, `app_feedback` y `admins`;
- conserva todas las huellas y añade `nivl:export-analitica-0072`;
- para un usuario 1.0.9 da lo mismo que la v8, más tres listas vacías y `version: 9`.

**Huellas:** 0070, 0071 y 0072 están en `scripts/apply-migrations.mjs`.

## Cómo se prueba

- `npx tsc --noEmit`, `npx eslint src scripts --max-warnings 0` y `CI=true npx jest --ci`: todo en verde, 106 suites y 1693 tests.
  - Tests nuevos `src/lib/__tests__/analitica.test.ts`:
    - lista blanca;
    - la misma lista que la 0070;
    - nada personal en lo que se envía;
    - la cola: tope, orden, sin red, flag apagado o ilegible, `22023` frente a `PGRST202`;
    - `registrarUnaVez`;
    - D1/D3/D7 y el cambio de hora;
    - `previo`.
  - Tests nuevos `src/lib/__tests__/peticiones.test.ts`:
    - la ventana de días;
    - los 120 días;
    - sin gating;
    - los flags;
    - sin expo-store-review no se pide;
    - qué viaja en la opinión.
- `node scripts/i18n/verificar-es.mjs` da 0 diferencias sin aceptar.
- SQL contra TODAS las migraciones reales (0001 a 0072, con las 0066 a 0069 de servidor) en PGlite:
  ```
  node scripts/analitica/probar-migraciones.mjs C:\temp\nivl-age-sql-check\node_modules\@electric-sql\pglite\dist\index.js
  ```
  Da 59 comprobaciones en verde una vez integrada la rama de servidor. En esta rama sola falla, porque falta la 0068. Comprueba:
  - RLS;
  - la lista blanca;
  - los límites;
  - el admin;
  - la exportación v9;
  - el borrado;
  - los flags apagados.
- `node scripts/test-migration-preview.mjs`: PASS.
- A mano, con una base de pruebas, nunca la real:
  1. aplicar las migraciones;
  2. encender `analitica_activa`;
  3. abrir la app, hacer el onboarding y completar una misión;
  4. comprobar `select evento, props from funnel_events order by created_at`.

## Riesgos

- **`scripts/test-modos-f1.mjs` de servidor espera `version` 8** en la exportación con todas las migraciones aplicadas. Con la 0072 integrada es 9: hay que cambiar esa aserción, o probar hasta la 0069.
- **La 0072 copia la v8 de la 0068 @1c4748d.** Si servidor cambia su v8 antes de integrar, hay que volver a copiarla en la 0072.
- **Conflicto trivial esperado:**
  - en `HUELLAS` de `apply-migrations.mjs` (servidor añade 0066-0069; aquí 0070-0072);
  - en `hoy.json` y `textos-es.aceptados.tsv` con idiomas: los `hoy:opinion.*` necesitan traducción en las otras lenguas.
- **ePrivacy / LSSI art. 22.2:** el `install_id` se guarda en el dispositivo para medición. La AEPD admite exceptuar del consentimiento la analítica propia, agregada y sin cesión, pero hay que confirmarlo. Por eso `analitica_activa` va apagado hasta que el dueño apruebe el texto de privacidad. Si se prefiere, se añade un interruptor «Medición de uso» en Perfil.
- **«Anónimo» es, en rigor, seudónimo:** con sesión, el servidor guarda el user_id. La política tiene que decirlo así (texto abajo).
- La retención se mide con `apertura_dia`. Quien abre la app solo por una notificación también cuenta, porque sigue siendo una apertura.
- `primer_arranque` de quien ya usaba 1.0.9: se distingue con `previo: true` y las métricas lo excluyen de las instalaciones nuevas. Su día 0 para la opinión y la valoración es el día en que estrena esta versión.
- El límite global de 3000 eventos por minuto protege la tabla, no el servicio. Supabase tiene además su propio límite de peticiones.
- `funnel_events` no tiene cron de purga: queda pendiente programar `purgar_funnel_events()`.

## Lo que necesito de otros equipos

- **Servidor:**
  - la 0067 (`app_config`, `app_flags()`) tiene que estar antes; las 0070 y 0071 siembran `analitica_activa` y `opinion_activa` (apagados) solo si existe `app_config`;
  - ajustar la aserción de versión 8 de `test-modos-f1.mjs`.
- **Cliente:** cuando exista `src/lib/flags.ts`, `src/lib/flagsServidor.ts` puede reducirse a reexportar su lectura sin hook. Hasta entonces es independiente y sigue la misma regla: con fallo, todo apagado.
- **Idiomas:** traducir `hoy:opinion.*` (9 claves) en los catálogos nuevos.
- **Coordinador:**
  - flags nuevos que no estaban en el contrato: `analitica_activa` y `opinion_activa`;
  - orden de despliegue: 0066-0069 → 0070-0072 → OTA;
  - la build con `expo-store-review` cuando toque binario.
- **Teferi (un solo bloque):**
  1. aprobar el párrafo de privacidad de abajo y publicarlo en nivl-web, que pasa a la versión 1.8;
  2. después, encender `analitica_activa` (y `opinion_activa` si quiere la pregunta);
  3. darse de alta como admin con el insert de arriba.

## Privacidad: ¿cubre la 1.7 lo nuevo? No del todo

**Lo que ya cubre:**

- en «Técnicos»: el identificador de instalación, la plataforma y la versión;
- en el apartado 3: «análisis técnico y estadísticas agregadas de uso» por interés legítimo. Pero ahí solo describe las estadísticas de Expo a partir de las solicitudes de actualización.

**Lo que no cubre:**

1. Que NIVL registre en su propia base el recorrido dentro de la app (pasos del onboarding, primera misión, aperturas, paywall, compra), unido a la cuenta cuando hay sesión.
2. La pregunta de opinión: texto libre que la persona escribe y que se guarda.
3. La petición de valoración de la tienda. No trata datos de NIVL, pero conviene decirlo.

Plazos: el embudo se ha fijado en 12 meses, como los registros técnicos. La opinión se guarda mientras exista la cuenta.

**Párrafos propuestos para la 1.8.** No se ha editado la web; los tiene que aprobar el dueño.

En el apartado 2, fila nueva tras «Técnicos»:

> **Uso de la app** · Qué pasos del recorrido completas (primer arranque, pasos del onboarding, registro, primera misión creada y completada, días en que abres la app, si ves la oferta de NIVL Pro y si inicias o completas una compra), con un identificador aleatorio de instalación, la versión y la plataforma. No incluye nada de lo que escribes, ni tu correo ni tu nombre. Si tienes la sesión iniciada, se asocia a tu cuenta. · *Tu dispositivo*
>
> **Tu opinión** · Lo que escribas si respondes a «¿Qué te gusta? ¿Qué cambiarías?», con la versión de la app. · *Tú, solo si respondes*

En el apartado 3, filas nuevas:

> Medir el uso de la app para saber dónde se atasca la gente y mejorarla (estadísticas propias de NIVL; solo las ve el equipo de NIVL, de forma agregada) · Interés legítimo (art. 6.1.f). Puedes oponerte escribiendo al contacto de privacidad.
>
> Leer tu opinión sobre la app para mejorarla · Consentimiento, al enviarla (art. 6.1.a). Es opcional y no cambia nada de tu cuenta.

En el apartado 7, tras «Los registros técnicos del servicio...»:

> Los datos de uso de la app se conservan como máximo 12 meses. Tu opinión, mientras mantengas la cuenta. Al eliminar la cuenta se borran ambos, incluidos los pasos registrados en ese dispositivo antes de crearla.

En el apartado 4: no hace falta un proveedor nuevo, porque todo se guarda en Supabase.

Párrafo nuevo en el apartado 4 o en el 8:

> **Valoraciones en la tienda.** NIVL puede pedirte que valores la app con el diálogo del propio sistema (App Store o Google Play). La valoración la gestiona Apple o Google; NIVL no recibe qué puntuación das ni si la das.

Detalles para la 1.8:

- cambiar la fecha;
- según el apartado 12, avisar en la app de este «uso nuevo», que es un cambio relevante.
