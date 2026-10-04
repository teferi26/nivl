# Fase 3 · App Review Guidelines: compras (3.1 y relacionadas) para NIVL 1.0.8 (build 23)

Auditoría del 04/10/2026 hecha por un subagente de «NIVL - Compras». Base: worktree `w2-chat2` (`winter2/integracion` @477c545) más los arreglos de este documento. Los datos de App Store Connect los leyó «NIVL - Tiendas» el 04/10/2026, solo con GET y sin escribir nada.

## Fuentes (leídas el 04/10/2026)

- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/. La página dice «Last Updated: June 8, 2026».
- Auto-renewable Subscriptions: https://developer.apple.com/app-store/subscriptions/. No muestra fecha.
- Rechazo vigente: `winter-chat1/docs/release-audit/00-apple-rechazo-literal.md`. Es un 2.1 «Information Needed» y pide, para las suscripciones, «the title, length, and price of each subscription, as well as links to the Terms of Use and privacy policy».

Citas literales breves:

| Regla | Texto literal |
|---|---|
| 3.1.1 | «If you want to unlock features or functionality within your app, […] you must use in-app purchase.» |
| 3.1.1 (pruebas sin suscripción) | «Non-subscription apps may offer a free time-based trial period […] by setting up a Non-Consumable IAP item at Price Tier 0» |
| 3.1.1(a) | «apps and their metadata may not include buttons, external links, or other calls to action that direct customers to purchasing mechanisms other than in-app purchase» (salvo en la tienda de EE. UU.) |
| 3.1.2(a) | «the subscription period must last at least seven days and be available across all of the user's devices» |
| 3.1.2(a) | «Auto-renewable subscription apps may offer a free trial period to customers by providing the relevant information set forth in App Store Connect.» |
| 3.1.2(a) | «apps that attempt to trick users into purchasing a subscription under false pretenses or engage in bait-and-switch» |
| 3.1.2(b) | «should not be able to inadvertently subscribe to multiple variations of the same thing» |
| 3.1.2(c) | «Before asking a customer to subscribe, you should clearly describe what the user will get for the price.» |
| 3.1.3 | «Apps in this section cannot, within the app, encourage users to use a purchasing method other than in-app purchase» |
| 3.1.3(b) | «may allow users to access content, subscriptions, or features they have acquired in your app on other platforms or your web site […] provided those items are also available as in-app purchases within the app» |
| 3.2.2(x) | «Apps must not force users to rate the app, review the app, download other apps […] Apps may otherwise incentivize users to take specific actions within apps» |
| 5.3.2 | «Official rules for sweepstakes, contests, and raffles must be presented in the app and make clear that Apple is not a sponsor» |
| 5.6 | «Apps should never prey on users or attempt to […] trick them into making unwanted purchases, […] raise prices in a tricky manner» |
| 5.6.3 | «Manipulating any element of the App Store customer experience such as charts, search, reviews, or referrals to your app […] is not permitted.» |
| 2.3.10 | «don't include names, icons, or imagery of other mobile platforms or alternative app marketplaces in your app or metadata» |
| Página de suscripciones | «Full renewal price, shown clearly and prominently» · «A way for current subscribers to sign in or restore purchases» · «the amount that will be billed must be the most prominent pricing element» · «your app and App Store metadata must include links to your Terms of Use and Privacy Policy» · free trial: «clearly indicate how long the free trial lasts and the price billed once the free trial is over» |

En la versión vigente de las Guidelines no hay un apartado 5.6.x sobre urgencia o patrones oscuros. Lo que aplica es la introducción de 5.6 y 3.1.2(a), citados arriba.

## Tabla de resultados

| # | Regla | Estado | Prueba | Arreglo / dueño |
|---|---|---|---|---|
| 1 | 3.1.1: todo lo digital por IAP; sin Stripe ni clave propia en iOS | **CUMPLE** | `src/lib/storepolicy.ts:20-27`: `stripePermitido` y `clavePropiaPermitida` devuelven false en ios/android aunque se ponga `EXPO_PUBLIC_PAYWALL=on`. `subscription.ts:54-61` y `openCheckout` (:104) no tienen camino en la tienda. La compra va por RevenueCat (`pro.ts:142`). El Oráculo solo pide la clave propia si `byokEnabled()`. Tests: `storepolicy.test.ts` | — |
| 2 | 3.1.1/3.1.1(a): textos o enlaces que lleven a pagar fuera | **CUMPLE** | No hay ningún enlace a una página de compra. Los únicos `Linking.openURL` llevan a lo legal, al soporte, a la denuncia y a la gestión de la suscripción en Apple (`pro.ts:554,587`). `nivl.app` (enlazada en Términos, Privacidad y en el mensaje de invitación de `socialmath.ts:242`) no vende: dice «Las suscripciones se contratan dentro de la app con la compra integrada» y no tiene botón de pago (revisado con curl, 200). El proveedor `stripe` solo se nombra como «fuera de esta app» (`pro.ts:404`, `pro.tsx:285`), sin enlace ni invitación a comprar | — |
| 3 | 3.1.1/3.1.3: programa de creadores (códigos y comisiones) | **CUMPLE** | El código de creador solo atribuye el alta: no da descuento ni desbloquea nada (`creators.ts`; `marcarCreadorEnTienda` es un atributo informativo de RevenueCat, `pro.ts:230`). En iOS, el panel no muestra importes, ni %, ni vocabulario de cobro (`creatorprogram.ts:344-360`, `PARECE_DINERO` :230). «Tus ganancias se gestionan fuera de la app.» (`:222`) no es una llamada a comprar: habla de lo que se le paga al afiliado, no de una compra de contenido digital, así que no entra en 3.1.1 ni en 3.1.3. No lleva enlace (`ENLACE_GANANCIAS = null`). El panel es solo por invitación y las notas de revisión lo explican | — |
| 4 | 5.3.1/5.3.2: retos de creadores con premio | **RIESGO → ARREGLADO** | Antes, en la tienda se mostraba un premio en especie («Premio: Sudadera») sin bases ni el aviso de que Apple no patrocina, y eso es un concurso. Ahora `creatorprogram.ts:355-358` pone `prize: null` en iOS y Android. Los premios solo se ven en la web | Aplicado, con test (`creatorprogram.test.ts`) |
| 5 | 5.3: retos, ligas y duelos entre amigos | **CUMPLE** | Son de constancia, sin XP ni dinero en juego y sin premio, así que no son ni concurso ni sorteo (notas de revisión: «no XP or money at stake») | — |
| 6 | 3.2.1/3.2.2(x)/5.6.3: invitaciones | **CUMPLE** | Solo dan una insignia cosmética: «Es una insignia: no da XP ni días de Pro.» (`AmigosVista.tsx:678`, `invites.ts:1-3`). No hay ninguna recompensa por valorar, reseñar ni descargar. No hay `StoreReview` ni `requestReview` en `src/` | — |
| 7 | 3.1.2(a): valor continuo y duración mínima | **CUMPLE** | Coach de IA con brief diario, planes, revisión semanal y memoria (`PRO_BENEFITS`), con energía que se recarga cada mes. Duración mínima: en ASC, los mensuales son ONE_MONTH y los anuales y el fundador ONE_YEAR (Tiendas, 04/10). La suscripción va con la cuenta y vale en todos los dispositivos | — |
| 8 | 3.1.2(b): subir y bajar de plan | **CUMPLE** | Los 5 productos están en un solo grupo «NIVL», con Élite en el nivel 1 y Pro en el 2 (ASC). El plan que ya se paga sale marcado y no se puede volver a comprar (`ProOffer.tsx`, `planActual`; test «el plan que ya se paga…») | — |
| 9 | 3.1.2(c) y la página de suscripciones, en el paywall | **CUMPLE** | Cada plan muestra título, duración y precio (`ProOffer.tsx:392-405`; `tituloPlan`/`duracionPlan` `proplans.ts:470,476`). El precio que se cobra es el `priceString` de la tienda y es la cifra más destacada, sin equivalentes mensuales que compitan. La letra de renovación automática con cancelación 24 h antes está en `legalText` (`proplans.ts:499`). «Restaurar compras» en `ProOffer.tsx:600`. Términos, Privacidad y el EULA de Apple (iOS) en `:611-640` | — |
| 10 | 3.1.2/2.1: enlaces legales con la tienda **cerrada** | **RIESGO → MITIGADO** | En la OTA 1.0.8, un revisor vio la tienda cerrada y el paywall sin enlaces legales. Causa: la OTA no llevaba `EXPO_PUBLIC_RC_IOS_KEY` porque `eas update` se publicó sin `--environment production`; eso lo arregla el coordinador. Ahora `ProOfferLegal` (`ProOffer.tsx:594`) pinta SIEMPRE Términos, Privacidad y, en iOS, el EULA de Apple. Restaurar y la letra de renovación siguen apareciendo solo con la tienda abierta | Aplicado, con test (`prooffer.test.ts`, «tienda cerrada: …») |
| 11 | URLs legales | **CUMPLE** | `LEGAL_URLS` (`proplans.ts:459`): `https://nivl.app/terminos` → 200 «Términos de uso · NIVL»; `https://nivl.app/privacidad` → 200 «Política de privacidad · NIVL»; `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/` → 200 «Licensed Application End User License Agreement». Las de `nivl-web.vercel.app` también dan 200 | — |
| 12 | Metadatos: EULA y privacidad en ASC | **RIESGO** | Tiendas (04/10): no hay EULA propio, así que aplica el estándar. La URL de privacidad de la ficha es `nivl-web.vercel.app/privacidad`, que funciona. La descripción es la de 1.0.7 (enlaza `nivl-web.vercel.app/terminos` y `/privacidad` y el EULA, y **menciona Franky**). El paywall 1.0.8 enlaza nivl.app | **Tiendas**: en la versión 1.0.8, poner la descripción de `ficha-108.md:71-73` (Términos y Privacidad en nivl.app y el EULA estándar) y la URL de privacidad `https://nivl.app/privacidad`, y quitar Franky |
| 13 | 2.1/3.1.2/2.3.10: capturas de revisión de los 5 productos | **INCUMPLE** | Tiendas (04/10): siguen las capturas antiguas (1320×2868), con «−36 %», «4 meses gratis · 8,33 €/mes», «−31 %», «−17 % · 2 meses gratis» y el texto «…(App Store o Google Play)». Eso nombra Google Play en iOS y no refleja el paywall de la build 23 | **Coordinador**: subirlas de nuevo antes de enviar, según `docs/payment-audit/FASE3-CAPTURAS-SUSCRIPCIONES.md` |
| 14 | Prueba de 7 días del servidor, gratis y sin método de pago | **RIESGO (bajo)**, mantenida por decisión del dueño | Ver el dictamen más abajo. La redacción ya es neutra: `textoPrueba` y `LINEA_PRUEBA` (`proplans.ts:339-347`, usada en `pro.tsx:347`) dicen «gratis, una sola vez por cuenta, sin renovación», en línea con las notas de revisión («requires no payment information and does not auto-renew») | Texto aplicado, con test (`paywall-copy.test.ts`, `prooffer.test.ts`). La lógica no se ha tocado |
| 15 | 3.1.3(a)/(b): excepciones; compras web dentro de la app | **CUMPLE** | No es una «reader app». Lo que sí aplica es 3.1.3(b), multiplataforma: una suscripción de Stripe (la web la tiene apagada) da acceso en la app y los 5 productos también se venden por IAP. La app no anima a comprar en la web: el texto de `pro.tsx:285` solo dice dónde se gestiona | — |
| 16 | Paywall del onboarding (5.6 / 3.1.2(a)) | **CUMPLE** | La salida «Seguir gratis por ahora» está en el pie fijo desde el primer frame de la hoja (`onboarding.tsx:763`), es `secondary lg`, de la misma altura que la acción de pago (`ProOffer.tsx:572`), y nunca es `ghost`. Mientras se decide no hay botón de pago, y la salida aparece a los 2,5 s. No hay cuenta atrás, testimonios ni urgencia (`ProOffer.tsx:6-11`). Se preselecciona Pro anual con su precio anual a la vista, sin trampa. Se compra con un toque más la hoja de Apple; no hay toques encadenados. «Restaurar compras» está en el scroll, debajo de los planes (`onboarding.tsx:722`), así que existe pero puede quedar por debajo del pliegue | Opcional (**Experiencia**): subir `ProOfferLegal` o un «Restaurar compras» al pie en las pantallas de 667 pt. No bloquea |
| 17 | Plan Fundador «Plazas limitadas · precio congelado» | **CUMPLE** | La escasez es real: hay 100 plazas (`PLAZAS_FUNDADOR`, `proplans.ts:194`) y `founder_seats_left()` oculta el plan cuando llega a 0. No hay contador ni plazo. La letra pequeña explica qué significa: «no es un pago único ni vitalicio; el precio de fundador se mantiene mientras no la canceles» (`legalText`) | Condición para el dueño: si algún día sube precios, elegir en ASC «conservar el precio de los suscriptores actuales» para el fundador; si no, «congelado» se volvería falso (5.6, «raise prices in a tricky manner»). Texto alternativo, por si se quiere más prudencia: «100 plazas · precio de fundador» |
| 18 | 2.3.10: Google Play en iOS | **CUMPLE en el binario** / **INCUMPLE en las capturas (#13)** | `textoGestionTienda` (`proplans.ts:484`) y el aviso de borrado (`HojasPerfil.tsx:33-38`) cambian según la plataforma. La URL `play.google.com` de `pro.ts:555` solo se usa en Android y no se ve. Test: «en Android no se enlaza el EULA de Apple», y el inverso en iOS. Los Términos y la Privacidad web nombran Google Play porque valen para las dos tiendas: son documentos externos, no la app ni los metadatos | Capturas: #13 |
| 19 | Productos en ASC adjuntos a 1.0.8 | **VERIFICADO (Tiendas, 04/10)** | Envío `fb26cf6b`, con 7 elementos: el grupo y las 5 suscripciones en READY_FOR_REVIEW, y la versión 1.0.8 build 23 en REJECTED (se reenvía). Productos en READY_TO_SUBMIT. 0 ofertas introductorias y 0 promocionales. Sin EULA propio | Antes de «Volver a enviar»: capturas (#13), descripción y URL de privacidad (#12) |

## Dictamen: prueba de 7 días del servidor, sin método de pago

**Qué dice la norma.** 3.1.1 obliga a usar IAP para *desbloquear* funciones. El único camino que la norma describe para una prueba gratuita por tiempo es, en apps **sin** suscripción, un no consumible a precio 0 llamado «XX-day Trial». Para apps **con** suscripción, 3.1.2(a) dice «may offer a free trial period […] by providing the relevant information set forth in App Store Connect», es decir, una oferta introductoria de StoreKit. El texto vigente no prohíbe expresamente que el desarrollador regale acceso gratis desde su servidor, pero tampoco lo ampara: el camino que Apple describe es StoreKit.

**Lectura.** La prueba de NIVL no cobra nada, no pide datos de pago, no se renueva, es una sola por cuenta y Apple no deja de ingresar nada. Lo que 3.1.1 persigue es desbloquear funciones de pago *saltándose el cobro* de Apple, y aquí no hay cobro. Aun así, un revisor puede leer «desbloqueo temporal de una función de pago sin StoreKit» y citar 3.1.1 o 3.1.2(a). La probabilidad es baja: las notas lo explican y la pantalla lo dice tal cual. No es cero.

**Mitigaciones, de menor a mayor impacto:**
1. **(Aplicada.)** Redacción neutra en la app: se quita «sin tarjeta», que contraponía la prueba al pago de la tienda, y se dice «gratis, una sola vez por cuenta, sin renovación», que es lo que dicen las notas de revisión. La lógica no cambia.
2. **(Plan B, listo para una OTA.)** Si Apple lo objeta, se oculta la prueba solo en iOS. Basta una función pura en `storepolicy.ts` (`pruebaServidorPermitida(plataforma) = plataforma !== 'ios'`) aplicada al `trialAvailable` de `useProOffer` y a `ofrecerSi`. Es solo JS, así que va por OTA en horas y sin binario nuevo. Efecto: los usuarios de iOS pierden la prueba sin pago, y la web y Android la conservan.
3. **(Riesgo cero, pero cambia el producto.)** Una oferta introductoria de StoreKit, «1 semana gratis», en Pro mensual y Pro anual, con la prueba del servidor oculta en iOS. El paywall ya la anuncia sola (`introsDeTienda`, `textoIntro`). Efecto: hace falta Apple ID con método de pago, se renueva salvo cancelación y es una por grupo de suscripción. Contradice la decisión del dueño de una prueba «sin cobro».

**Recomendación:** mantener la decisión del dueño (1) en 1.0.8 y tener preparado el plan B (2). Si el dueño exige riesgo cero *antes* de enviar, la opción es (2) ya en la build 23, y la (3) solo si quiere conservar una prueba en iOS.

Coherencia web (**Experiencia**): la portada de `nivl.app` dice «Prueba de 7 días del coach sin método de pago». No es la app ni los metadatos, pero conviene alinearla con «gratis y sin renovación».

## Arreglos de código

### Aplicados en este worktree (sin commit)

| Archivo:línea | Cambio |
|---|---|
| `src/components/ProOffer.tsx:594-640` | `ProOfferLegal` ya no devuelve `null` con la tienda cerrada. Restaurar y `legalText` siguen apareciendo solo con `disponible`, y los enlaces Términos, Privacidad y EULA de Apple (iOS) se pintan siempre. Se ha actualizado el comentario de la cabecera (:8-11) |
| `src/lib/creatorprogram.ts:355-358` | Rama de tienda: `prize: null` siempre, también para premios en especie (5.3.2) |
| `src/lib/proplans.ts:333-347` | `textoPrueba` neutro, sin «tarjeta», y nueva constante `LINEA_PRUEBA = 'Prueba el coach 7 días: gratis y sin renovación.'` |
| `src/app/pro.tsx:347` | La cabecera usa `LINEA_PRUEBA` en vez de «Pruébalo 7 días, sin tarjeta.» |
| Tests | `prooffer.test.ts`: test nuevo «tienda cerrada: Términos, Privacidad y EULA (iOS)…», con Android incluido, y los textos de la prueba. `creatorprogram.test.ts`: premios en tienda a `null`, la web los conserva. `paywall-copy.test.ts`: la prueba es gratis, una vez y sin renovación, sin «tarjeta», y `LINEA_PRUEBA` |

Comprobación: `npm run typecheck` sin errores · `CI=true npx jest --ci --runInBand src` → 92 suites, 1537 tests en verde · `CI=true npm run lint` sin avisos.

### Pendientes de otros dueños

| Dueño | Qué |
|---|---|
| Coordinador | #13: subir las capturas de revisión de los 5 productos según `FASE3-CAPTURAS-SUSCRIPCIONES.md` (sin «−36 %», ni «meses gratis», ni «Google Play»). #10: publicar las OTA con `eas update --environment production` para que lleven `EXPO_PUBLIC_RC_IOS_KEY` |
| Tiendas | #12: descripción 1.0.8 (nivl.app/terminos, nivl.app/privacidad y EULA estándar, sin Franky) y URL de privacidad `https://nivl.app/privacidad` en la versión 1.0.8 |
| Experiencia | #16 (opcional): «Restaurar compras» a la vista sin hacer scroll en el onboarding. Web: «sin método de pago» → «gratis y sin renovación» |
| Dueño | #17: conservar el precio del fundador para los suscriptores actuales si algún día sube precios. #14: aceptar el riesgo bajo o activar el plan B |
