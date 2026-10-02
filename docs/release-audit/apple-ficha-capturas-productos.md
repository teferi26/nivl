# Apple · Ficha, capturas y productos frente al código (iOS 1.0.7)

Chat 1 · Tiendas, subagente Apple. Fecha: 02/10/2026. Solo lectura; no se ha enviado ni cambiado nada en App Store Connect (ASC).

- Código: rama `winter/chat1-tiendas`, SHA `58f4c60`. Las citas `archivo:línea` son de ese SHA.
- Ficha y productos en ASC: `privado/asc-chat1-readonly-20261002.json` y `privado/asc-chat1-readonly-prices-20261002.json` (GET del 02/10/2026). Este documento no copia credenciales ni datos de contacto.
- Capturas: `privado/appstore-capturas-1.0.7/` (7 de ficha en `finales/` y `entrega/00-vista-general.png`; 5 de revisión de suscripciones y originales en `native-run-36350080919/`). Se generaron con la UI del commit `7a5e6e1` (`privado/capturas-ios-1.0.7-20260927.md`).
- Rechazo vigente: 2.1 Information Needed, sin defectos concretos (`docs/release-audit/00-apple-rechazo-literal.md`). Los hallazgos de abajo son **riesgos propios**, no defectos atribuidos a Apple.

## 1. Estado leído en ASC (02/10/2026)

| Campo | Valor en ASC | Comentario |
|---|---|---|
| Nombre / subtítulo | «NIVL: Hábitos y Disciplina» (26 caracteres) / «Coach IA, misiones y rachas» (27) | Dentro de los límites (30/30). |
| Palabras clave | `rutina,productividad,gimnasio,dieta,metas,objetivos,motivación,estudio,diario,gamificación,entreno` (98/100) | Ninguna afirmación que comprobar. |
| Texto promocional | 135/170 caracteres | Correcto («Usa NIVL gratis y añade un coach de IA con NIVL Pro o Élite»). |
| Descripción | Coincide con `privado/appstore-ficha.md` y añade al final el enlace a la EULA estándar de Apple | Ver §2. |
| Novedades | `null` | Admisible en el primer envío. |
| URL de privacidad / soporte / marketing | `nivl-web.vercel.app/privacidad`, `/soporte`, raíz | Responden (privacidad v1.2 del 29/09/2026 y términos v1.1 del 27/09/2026, consultados el 02/10/2026). |
| EULA | `endUserLicenseAgreement.data: null`, es decir, EULA estándar de Apple | Ver P1-4. |
| Edad | `appStoreAgeRating: SEVENTEEN_PLUS`; Brasil `SELF_RATED_SIXTEEN`; cuestionario no legible (404) | Más estricta que el mínimo de 16 de la app (`src/lib/consentmath.ts:16`). Coherente. |
| Derechos de contenido | `USES_THIRD_PARTY_CONTENT` | La respuesta 6 de Apple debe aportar las licencias (fuentes Cinzel/Outfit con OFL; evidencia en `privado/apple-content-rights-evidence-20260928.md`). |
| Cifrado | build 18 `usesNonExemptEncryption: false`; `app.json:18` | Coherente. |
| iPad | `app.json:13` `supportsTablet: false` | No hacen falta capturas de iPad. |
| Disponibilidad | 175 territorios, `availableInNewTerritories: false`; los 27 de la UE con `TRADER_STATUS_NOT_PROVIDED` | Ver P0-1 y P1-5. |
| Build asociada | 18 (versión rechazada) | Hay que adjuntar la build corregida (20 o posterior) antes de reenviar. |

## 2. Afirmaciones de la ficha frente al código

| Afirmación (descripción, subtítulo o promo) | ¿La soporta el código? | Evidencia / nota |
|---|---|---|
| Misiones, rachas, XP, niveles y rangos | Sí | `src/lib/game.ts`, `src/lib/engine.ts`; pestañas en `src/app/(tabs)/`. |
| Campañas para proyectos y asignaturas; agenda; contrato con reglas | Sí | `src/app/dungeon`, `src/app/(tabs)/` (Agenda, Campañas), `src/app/contrato.tsx`. |
| Gimnasio, cardio, nutrición, peso, diario y economía | Sí | `src/app/gym.tsx`, `cardio.tsx`, `nutricion.tsx`, `avances.tsx`, `diario.tsx`, `economia.tsx`. **Salud, peso, entreno, nutrición y diario piden antes el consentimiento de salud** (`src/components/ConsentimientoSalud.tsx:144`). La ficha dice «gratuitas, sin límite de tiempo»: correcto, el consentimiento no es un pago. |
| Fotos como evidencia | Sí | `src/lib/photos.ts:47-72`. |
| Los amigos no ven diario, finanzas, salud ni coach | Sí, según el texto de la UI (`06-amigos.png`: «nunca tu salud, tu dinero ni tu diario») | El servidor (`friends_board`, 0021/0032) debe comprobarlo Chat 3: **NO PROBADO** aquí. |
| Perfiles emprender / trabajo / deporte / estudios / general | Sí | `src/lib/kinds.ts`. |
| Pro: plan del día, entrenamiento y alimentación, revisiones, conversación con memoria que crea misiones | Sí | `src/lib/proplans.ts:305-313`; herramientas en `supabase/functions/_shared/tools.ts`. |
| Élite: «modelo de mayor capacidad», modo profundo, revisión ampliada, laurel, ludus de 5–8 | Sí en el código, **condicionado por el servidor** | `src/lib/proplans.ts:328-334`. El modelo de cada plan sale de `ai_plans.routes` (`supabase/functions/_shared/routing.ts:25-42`): **NO PROBADO** que Élite use hoy un modelo superior al de Pro (Chat 3). El ludus se asigna a mano (`proplans.ts:320-322`); la ficha ya dice que no hay plaza garantizada. |
| «Probar el coach durante 7 días sin datos de pago ni renovación automática» | Sí | `src/lib/pro.ts:72-78` (`start_trial`); `src/components/ProOffer.tsx:420-444`. **Es una prueba fuera de In-App Purchase**: ver P1-3. |
| Renovación automática, cancelación con 24 h, Ajustes > tu nombre > Suscripciones | Sí en la ficha. La app dice además «App Store o Google Play» | Ver P1-1. |
| Exportar y eliminar cuenta desde Perfil; el borrado solo afecta a NIVL | Sí | `src/app/(tabs)/perfil.tsx:865`, `:884`; `src/lib/account.ts:7-21`. Ver R-PRIV-3 en `apple-privacidad-datos.md`. |
| Antes de la IA, la app explica los datos enviados a Anthropic y DeepSeek | Sí | `src/lib/consentmath.ts:24-58`. Que el enrutado real coincida está **NO PROBADO** (Chat 3). |
| No diagnostica ni prescribe | Sí | Descargo `src/lib/consentmath.ts:61-65`. |
| Personas de 16 años o más | Sí, por declaración | `src/components/EdadMinima.tsx:118-125`. |

Conclusión: **ninguna afirmación de la ficha carece de soporte en el código.** Hay dos que dependen de configuración del servidor (modelo de Élite y proveedor DeepSeek) y quedan NO PROBADO hasta que responda Chat 3.

## 3. Capturas

### 3.1 Capturas de la ficha (7, APP_IPHONE_67, 1320 × 2868)

Revisadas visualmente: `entrega/00-vista-general.png`, `native-run-36350080919/03-coach.png` y `06-amigos.png`.

- **2.3.3**: las siete muestran la app en uso (Hoy, Agenda, Coach, Gimnasio, Economía, Amigos y Avances), con la etiqueta «Datos de ejemplo». **Ninguna es solo splash, título o login.** Cumple.
- **2.3.2 (funciones de pago)**: la captura 03 (Coach) lleva el pie «COACH IA · PRO Y ÉLITE». Bien.
- **Tamaño**: 1320 × 2868 es uno de los tamaños aceptados para 6,9", y ASC reutiliza la serie para 6,5" (`privado/appstore-capturas-1.0.7/README.md`). Según la [especificación de capturas](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/) (consultada el 02/10/2026), entre 1 y 10 capturas, sin canal alfa. Cumple. La página resumida era ambigua sobre si 6,9" o 6,5" es la obligatoria; como la serie de 6,9" existe y se reutiliza, **no hay riesgo práctico**.
- **Desfase con la UI actual** (P2): las capturas son del commit `7a5e6e1`. Después cambiaron Amigos (botón «…» de denuncia y bloqueo en cada fila, `src/app/amigos.tsx:190-195`), la puerta de consentimiento de salud (Coach, Hoy, Avances) y `ProOffer`. En `06-amigos.png` no aparece el botón «…» del ranking. No es engañoso, pero conviene una serie nueva cuando la UI se estabilice (dueño de la captura: Chat 4; la subida, Chat 1).

### 3.2 Capturas de revisión de las 5 suscripciones (1320 × 2868, `COMPLETE` en ASC)

Revisadas: `10-pro-mensual.png` y `14-elite-fundador.png`.

- **Muestran una UI que ya no existe** (P2): etiquetas «−36 %», «−17 %», «−31 %» y rótulos «4 meses gratis · 8,33 €/mes», «2 meses gratis · 24,92 €/mes» y «… · 20,75 €/mes». El código actual quitó ahorros y equivalentes mensuales con la tienda abierta (`src/lib/proplans.ts:492-499`, `pitchVisible` → «Un solo pago al año» / «Sin permanencia» / «100 plazas · precio congelado»). La letra pequeña capturada («NIVL sigue entera y gratis») también cambió (`proplans.ts:446`, commit `8d22e54`). Apple revisa el binario, no la captura, pero la captura de revisión debe reflejar el flujo real.
- En la de fundador, la letra legal queda fuera del encuadre. Mejor una captura donde se vean precio, periodo, botón, «Restaurar compras», letra y enlaces.
- Las dos muestran el texto «(App Store o Google Play)» (ver P1-1).

## 4. Los 5 productos

| Producto | ASC: estado / periodo / nivel | Precio leído (fila 1 / fila 2)* | Código (`src/lib/proplans.ts`) | Nombre y descripción es-ES | ¿Coincide? |
|---|---|---|---|---|---|
| `nivl_pro_mensual` | READY_TO_SUBMIT / 1 mes / 2 | 12,99 / 11,99 | `:180`, `:254` (1299 céntimos, mes) | «NIVL Pro mensual» · «Coach de IA estándar, cada mes» | Sí |
| `nivl_pro_anual` | READY_TO_SUBMIT / 1 año / 2 | 99,99 / 89,99 | `:181`, `:253` | «NIVL Pro anual» · «Coach de IA estándar, un año» | Sí |
| `nivl_elite_mensual` | READY_TO_SUBMIT / 1 mes / 1 | 29,99 / 24,99 | `:182`, `:274` | «NIVL Élite mensual» · «Coach avanzado, modo profundo y ludus» | Sí |
| `nivl_elite_anual` | READY_TO_SUBMIT / 1 año / 1 | 299,00 / 249,00 | `:183`, `:273` | «NIVL Élite anual» · «Coach avanzado y modo profundo, un año» | Sí |
| `nivl_elite_fundador` | READY_TO_SUBMIT / 1 año / 1 | 249,00 / 229,00 | `:184`, `:264-272` | «NIVL Élite fundador» · «Élite anual con precio de fundador» | Sí |

\* La consulta filtró `ESP,USA` y devolvió dos filas sin territorio. La primera coincide con los euros del código (ESP) y la segunda es presumiblemente USA en dólares. **La asignación por territorio está NO PROBADA.** Los ingresos (`proceeds`) encajan con una comisión del 15 % (Small Business Program). No hay ofertas introductorias (`intro: []` en los cinco).

Otros datos de ASC: grupo «NIVL» (nombre visible «NIVL»), `familySharable: false`, localizaciones en `PREPARE_FOR_SUBMISSION` y notas de revisión coherentes con la app. Los cinco tienen `multiSeatStatus: ENABLED` y `marketSettings` con `APPLE_BUSINESS` y `APPLE_SCHOOL`: **significado y efecto NO PROBADOS**. Conviene revisarlo en la UI de ASC, porque la app es de consumo y la 3.2 de Apple advierte de las distribuciones para empresas.

**Disponibilidad del fundador**: el código lo oculta cuando `founder_seats_left()` llega a 0 (`proplans.ts:471-475`), pero en la tienda es un producto anual normal sin tope. El límite de 100 plazas depende del servidor: NO PROBADO (Chat 2/Chat 3).

## 5. Requisitos 3.1.2 en el paywall (código actual)

Requisitos según las [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) (3.1.2) y la página de [suscripciones](https://developer.apple.com/app-store/subscriptions/) (consultadas el 02/10/2026): nombre y duración; precio completo de renovación, claro y localizado; el importe cobrado como elemento de precio más destacado; una forma de restaurar; enlaces a Términos de uso y Política de privacidad; en una prueba, su duración y el precio después.

| Requisito | ¿Cumple? | Evidencia |
|---|---|---|
| Título | Sí | Selector Pro/Élite (`ProOffer.tsx:282-293`), plan (`:355`), botón «Activar NIVL Pro · {precio}/{periodo}» (`:415-417`) y letra «NIVL Pro mensual es una suscripción de renovación automática…» (`proplans.ts:443`). |
| Duración | Sí | «al mes» / «al año» (`ProOffer.tsx:363`); «cada mes / cada año» (`proplans.ts:440`). |
| Precio de la tienda, localizado | Sí | `precioDe` con el `priceString` de la tienda (`ProOffer.tsx:129`, `pro.ts:213-215`). Sin precio confirmado no se puede comprar (`ProOffer.tsx:130`, `:158`). |
| Importe cobrado como lo más destacado | Sí en el código actual | Sin equivalentes mensuales (`proplans.ts:492-499`). Las capturas de revisión todavía muestran los antiguos (§3.2). |
| Restaurar compras | Sí | `ProOffer.tsx:494-502`. |
| Enlaces a Términos y Privacidad | Sí, a páginas propias | `ProOffer.tsx:504-521`, `proplans.ts:425-428`. **Los Términos propios no enlazan la EULA estándar de Apple** (P1-4). |
| Paywall del onboarding | Sí | `src/app/onboarding.tsx:654-655` (cuerpo + letra legal) y `:685` (acciones). |
| Mención de otras plataformas (2.3.10) | **No cumple** | «App Store o de Google Play» en `src/lib/proplans.ts:445-446` y `src/app/pro.tsx:174-175`; «Apple ID o de Google Play» en `src/app/(tabs)/perfil.tsx:921-922`. |
| Prueba gratuita | Fuera de IAP | `ProOffer.tsx:420-444` («Siete días con el coach, sin tarjeta y sin cobro»). Ver P1-3. |
| Tienda activa en el binario | NO PROBADO | Necesita `EXPO_PUBLIC_RC_IOS_KEY` y el módulo nativo (`pro.ts:95-112`). Sin ellos, la app enseña «Compras no disponibles» (`ProOffer.tsx:394-397`) y el revisor no podría comprar. Lo comprueba Chat 2 en la build 20. |

> **Actualización del 02/10/2026 (decisiones del usuario, vía coordinador):** se retiran CHN, RUS, HKG, MAC, BLR, VEN, MMR, AFG, YEM y XKS → **165 territorios** (P1-5 y 7.1-1 resueltos). Se elimina el puente de Franky: NIVL usa su propio Supabase Auth (7.1-6 y la parte Franky de 7.2-6 quedan sin objeto). Dominio único: `nivl-web.vercel.app`. Copy de Élite: «Insignia de laurel» y «Solicita plaza en un ludus (5-8)», sin «acceso anticipado». Diff de la descripción en §7.3.

## 6. Hallazgos priorizados

- **P0-1 · Estado de comerciante (DSA) sin informar en los 27 países de la UE, incluida España** (`TRADER_STATUS_NOT_PROVIDED` en `privado/asc-chat1-readonly-prices-20261002.json`). La app no puede publicarse en su mercado principal aunque la aprueben. Lo resuelve el titular en ASC > Business; Chat 1 lo sigue vía coordinador.
- **P1-1 · Google Play mencionado dentro de la app iOS (2.3.10).** `src/lib/proplans.ts:445-446`, `src/app/pro.tsx:174-175`, `src/app/(tabs)/perfil.tsx:921-922`. También aparece en las capturas de revisión de suscripciones.
- **P1-2 · Capturas de revisión de las 5 suscripciones desfasadas** (ahorros y «meses gratis» ya retirados; letra antigua). Ver §3.2. Lo subo a P1 porque la respuesta 1/7 a Apple debe describir el flujo que verá el revisor.
- **P1-3 · Prueba de 7 días concedida por el servidor, fuera de In-App Purchase.** La 3.1.1 solo prevé pruebas para apps sin suscripción mediante un no consumible de precio 0, y para suscripciones Apple usa ofertas introductorias. Una prueba propia que desbloquea funciones de pago sin IAP es un riesgo de interpretación, no un defecto señalado. Se puede defender como función gratuita, pero hay que mencionarla de forma explícita en las notas (ya lo hacen) y valorar sustituirla por una oferta introductoria de 1 semana en `nivl_pro_mensual` y `nivl_pro_anual`.
- **P1-4 · EULA.** ASC usa la EULA estándar y la descripción la enlaza (correcto). El paywall enlaza `nivl-web.vercel.app/terminos`, que **no** menciona ni enlaza la EULA estándar de Apple (consultado el 02/10/2026). Apple pide un enlace funcional a los Términos de uso (EULA) en la app.
- **P1-5 · China continental y Rusia en la disponibilidad.** La app tiene IA generativa con proveedor en China y no tiene licencia MIIT/CAC ni ICP. Apple retiró más de 100 apps de IA generativa de la tienda china en 2023 ([TechNode, 02/08/2023](https://technode.com/2023/08/02/apple-widely-removing-generative-ai-apps-from-chinas-app-store/), consultada el 02/10/2026; **no se ha encontrado una página oficial de Apple**, así que el requisito está NO PROBADO en fuente primaria). Además, la app está solo en español. Afecta a la respuesta 5 (diferencias regionales).
- **P2-1 · Capturas de la ficha anteriores a los cambios de seguridad social y de salud** (§3.1).
- **P2-2 · `multiSeatStatus: ENABLED` y mercados `APPLE_BUSINESS`/`APPLE_SCHOOL`** en los cinco productos: significado NO PROBADO.
- **P2-3 · «Élite: modelo de mayor capacidad»**: rutas confirmadas por el Chat 3 el 02/10 (`elite_*` → claude-sonnet-5; `pro_*` → deepseek-v4-flash). Solo falta que el dueño confirme COACH_BASE_URL.

## 7. Correcciones propuestas

### 7.1 Puede hacerlas Chat 1 en ASC (a través del coordinador, con permiso del dueño; nada se ha ejecutado)

1. **Disponibilidad**: HECHO el 02/10 (165 territorios). Respuesta 5, texto propuesto: «NIVL funciona igual en todos los territorios donde se distribuye. La interfaz está en español. No se distribuye en China continental.»
2. **DSA**: que el titular complete o verifique el estado de comerciante (lo hace el dueño; Chat 1 comprueba después por GET que desaparece `TRADER_STATUS_NOT_PROVIDED`).
3. **Capturas de revisión de los 5 productos**: sustituirlas en cuanto haya capturas del binario corregido que muestren precio, periodo, botón, «Restaurar compras», letra legal y enlaces en un mismo encuadre (o en dos capturas).
4. **EULA**, una de estas dos opciones: (a) mantener la EULA estándar y pedir que `/terminos` añada este párrafo: «Si descargas NIVL desde la App Store, también se aplica el Acuerdo de licencia de usuario final estándar de Apple: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/»; o (b) subir una EULA propia en ASC. Recomendada la (a), porque la web la cambia el dueño sin binario.
5. **Descripción**: sin cambios obligatorios. Si Chat 3 no confirma que Élite usa un modelo superior, cambiar «Élite incluye un modelo de mayor capacidad, modo profundo, …» por «Élite incluye modo profundo, revisión semanal ampliada y la insignia de laurel.» Si se pasa la prueba a oferta introductoria (7.2-3), cambiar el párrafo de la prueba por: «NIVL Pro incluye una semana de prueba gratuita para cuentas elegibles. Al terminar, se cobra el precio del plan elegido salvo que canceles al menos 24 horas antes.»
6. **Notas de revisión**: sin Franky (decisión del 02/10). ~~añadir la ruta de borrado de la cuenta Franky (ver `apple-privacidad-datos.md`, R-PRIV-3) y quitar «Anthropic y DeepSeek» si Chat 3 no confirma DeepSeek en producción.
7. **Productos**: revisar en la UI de ASC qué significan `multiSeatStatus` y los mercados Business/School, y desactivarlos si no proceden en una app de consumo (pendiente de confirmar que sea seguro).

### 7.3 Diff de la descripción de ASC (es-ES) tras la decisión «sin Franky» — PROPUESTA, no aplicada

```diff
- NIVL es para personas de 16 años o más. Entras con tu cuenta de Franky o la creas desde la pantalla de acceso. Puedes exportar tus datos y eliminar tu cuenta de NIVL desde Perfil. El borrado afecta solo a NIVL; tu cuenta de Franky permanece.
+ NIVL es para personas de 16 años o más. Creas tu cuenta de NIVL desde la pantalla de acceso. Puedes exportar tus datos y eliminar tu cuenta desde Perfil.
```

Comprobaciones hechas por GET el 02/10/2026:
- La descripción, el texto promocional y las palabras clave **no** contienen «acceso anticipado», «nivl.app», «escuadra» ni «Google».
- La descripción ya dice «la insignia de laurel» y «solicitar plaza en un ludus: un grupo privado de entre 5 y 8 miembros Élite»: coincide con el copy aprobado.
- Las descripciones de los productos (Élite mensual: «Coach avanzado, modo profundo y ludus»; Élite anual: «Coach avanzado y modo profundo, un año»; fundador: «Élite anual con precio de fundador») no prometen acceso anticipado. **Ningún cambio obligatorio.**
- Todas las URL de ASC (privacidad, soporte, marketing y enlaces de la descripción) usan `nivl-web.vercel.app`.

### 7.2 Requieren código (no las toca Chat 1)

1. **Chat 2 (pagos)**, `src/lib/proplans.ts:445-446`: hacer la letra dependiente de la plataforma. Texto iOS exacto: «La gestionas y la cancelas cuando quieras en Ajustes > tu nombre > Suscripciones.» (Android conservaría su texto propio sin nombrar Apple.)
2. **Chat 2 (pagos)**, `src/components/ProOffer.tsx:504-521`: renombrar el enlace a «Términos de uso (EULA)». Si `/terminos` no recoge la EULA de Apple, añadir un tercer enlace «EULA de Apple» → `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`.
3. **Chat 2 (pagos)**: decidir si la prueba de 7 días pasa a oferta introductoria de IAP (y adaptar `start_trial`, `ProOffer.tsx:420-444` y el webhook) o se mantiene como prueba de servidor, justificada en las notas.
4. **Chat 4 (UI)**, `src/app/pro.tsx:174-175`: «La suscripción se gestiona y se cancela en Ajustes > tu nombre > Suscripciones.»
5. **Chat 4 (UI)**, `src/app/(tabs)/perfil.tsx:921-922`: «Borrar la cuenta no cancela una suscripción de NIVL Pro: cancélala en Ajustes > tu nombre > Suscripciones.»
6. **Chat 4 (UI)**: fila permanente «Privacidad y términos» en Perfil > Cuenta (5.1.1(i)).
7. **Chat 4 (UI)**: nueva serie de capturas (ficha y revisión de productos) desde el binario corregido, con el mismo arnés de datos de ejemplo.

Los cambios 7.2-1, 2, 4, 5 y 6 son solo JS: pueden salir por OTA en la 1.0.7, pero **el binario que se adjunte a la revisión debe llevarlos ya** (o la OTA debe estar publicada antes de que el revisor abra la app).

## 8. NO PROBADO (resumen)

- Que la build 20 tenga la clave de RevenueCat y que compra y restauración funcionen en sandbox en un dispositivo físico.
- A qué territorio corresponde cada una de las dos filas de precio.
- El modelo real de cada plan (Élite superior a Pro; DeepSeek en Pro y la prueba).
- El tope de 100 plazas del fundador en producción.
- El cuestionario de edad publicado y las categorías completas de privacidad en ASC.
- El efecto de `multiSeatStatus` y de los mercados Business/School.
- El requisito chino de IA generativa en una fuente oficial de Apple.

## 9. Fuentes consultadas el 02/10/2026

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): 1.2, 2.1, 2.3.3, 2.3.10, 3.1.1, 3.1.2, 5.1.1(i), 5.1.1(v).
- [Auto-renewable subscriptions](https://developer.apple.com/app-store/subscriptions/): información obligatoria en la compra y pruebas.
- [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/).
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/).
- [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/).
- [TechNode: Apple retira apps de IA generativa en China](https://technode.com/2023/08/02/apple-widely-removing-generative-ai-apps-from-chinas-app-store/) y [China Digital Times](https://chinadigitaltimes.net/2023/08/generative-ai-apps-removed-from-apples-chinese-app-store/) (prensa, no son fuentes de Apple).
- NIVL: [Términos](https://nivl-web.vercel.app/terminos) (v1.1, 27/09/2026) y [Privacidad](https://nivl-web.vercel.app/privacidad) (v1.2, 29/09/2026).
