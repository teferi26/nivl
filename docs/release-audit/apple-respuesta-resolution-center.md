# Respuesta a App Review (Resolution Center) — lista para pegar

Responde al mensaje de Apple del 29/09/2026 1:16 (Guideline 2.1 — Information Needed), envío `fb26cf6b-…`. Texto literal en [00-apple-rechazo-literal.md](00-apple-rechazo-literal.md).

**Uso interno: no enviar esta cabecera.** Solo el coordinador, con el usuario, pega y envía. Antes de enviar, sustituye cada `[CORCHETE]` por un hecho comprobado y marca la casilla. Si un dato no está comprobado, quítalo: no lo dejes con corchetes ni lo sustituyas por una suposición.

| Campo | Fuente que lo acredita | Hecho |
|---|---|---|
| `[BUILD]` | Build asociada a la 1.0.7 en ASC antes de «Volver a enviar» (decide el coordinador) | ☐ |
| `[DEVICE]`, `[IOS]`, `[DATE]` | Ajustes > General > Información del iPhone que grabó. Debe ser la última versión pública: el 02/10/2026 era iOS 27.0.1 ([Apple security releases](https://support.apple.com/en-us/100100)) | ☐ |
| `[VIDEO]` | Nombre del adjunto o enlace probado sin iniciar sesión | ☐ |
| `[TIMESTAMPS]` | Marcas tomadas viendo el vídeo final, no este guion | ☐ |
| `[N]` | Sustituido por 165 (02/10: retirados CHN, RUS, HKG, MAC, BLR, VEN, MMR, AFG, YEM y XKS; se mantienen los 6 territorios británicos de ultramar por decisión del usuario) | ☑ |
| `[LOGIN_ROUTE]`, `[SIGNUP_ROUTE]` | Rótulos exactos de acceso y registro con Supabase Auth propio en la build final (decisión del usuario 02/10: se elimina el puente Franky; implementan los chats 3 y 4). Ejemplo: `On the access screen, enter the credentials and tap "[RÓTULO]".` | ☐ |
| Borrado | Comprobar en la build final que el borrado elimina la cuenta de Auth de NIVL, sus datos y Storage. Antes había un marcador `[DELETION]` por la cuenta Franky; desaparece con la decisión del 02/10 | ☐ |
| `[PLAZO]` | Sustituido por «24 hours» (confirmado por el usuario el 02/10). Moderación: el propio dueño de la cuenta, avisado por push desde `ritual` (migración 0037, pendiente de integrar). No poner datos personales | ☐ |
| `[AI_REPORT]` | Solo si la build final permite denunciar respuestas del coach (Chat 4): «Users can also report an AI coach reply from the reply itself; these reports go to the same queue.» Si no lo permite, borrar el marcador | ☐ |
| `[PAYWALL]` | Confirmación del Chat 2 de que la build `[BUILD]` muestra los 5 planes con título, periodo y precio, y los enlaces | ☐ |

Límites: el Resolution Center admite texto largo. Las **notas** de App Review Information tienen un máximo de 4.000 caracteres y van en [apple-notas-revisor.txt](apple-notas-revisor.txt), en versión compacta.

---

Hello App Review Team,

Thank you for your message of 29 September. Below is the information requested under Guideline 2.1, numbered as in your message. A compact version has also been added to the App Review Information notes. The submission now uses NIVL 1.0.7 ([BUILD]).

**1. Screen recording on a physical device**

Recording: [VIDEO]
Device: [DEVICE], iOS [IOS] (latest public release on the recording date). App: NIVL 1.0.7 ([BUILD]), installed from TestFlight. Recorded on [DATE].

The recording starts on the Home Screen by launching NIVL and shows, in order:
[TIMESTAMPS]
- registration of a new account and login;
- the typical flow: daily missions, habits and planning;
- the separate health-data and AI permissions;
- the subscription screen, showing the title, duration and price of each subscription, plus the Terms of Use and Privacy Policy links; a sandbox purchase, the resulting paid access and "Restaurar compras";
- user-generated content: reporting a user and blocking/unblocking them;
- deletion of a disposable account.

**2. Purpose and target audience**

NIVL is a Spanish-language habit and personal-organisation app for individual users aged 16 and over, such as students, professionals, entrepreneurs and people building training routines. It turns routines and goals into daily missions with levels and streaks. It brings habits, projects, a calendar, training, nutrition, a journal and personal finances together in one place. The problem it addresses is consistency: users plan in one place, see each day what to do and track their progress. Tracking and organisation are free. Optional subscriptions add an AI coach that helps users plan and review their routines. NIVL is a general consumer app; it is not intended for a specific business or organisation.

**3. Setup and access to the main features**

No sample files, external hardware, bank connections or personal API keys are needed.

Review accounts. The credentials of each account are in the App Review sign-in fields and in the notes. We provide one account per access level:
- Free account (the one in the sign-in fields). Use this account to test the purchase, the sandbox payment and "Restaurar compras".
- Pro account and Élite account. Their paid access was granted manually on our server for review, so you can see the paid features without paying. Please do not buy or restore with these two accounts: a sandbox purchase would replace the granted access, and that access would expire.
None of the accounts has accepted the age declaration or the health and AI permissions on your behalf. The app asks for these choices on first use.

Signing in. [LOGIN_ROUTE] To create a new account instead, [SIGNUP_ROUTE] NIVL accounts are NIVL's own; no third-party account is needed.

Main features. The "Hoy" tab shows today's missions. "Hábitos" manages routines. Campaigns and "Agenda" organise longer goals and scheduled activities. "Perfil" contains settings, social features, data export and account deletion.

Health and AI permissions. Training, nutrition and journal features ask for explicit health-data permission: open Perfil > "Salud y bienestar" > "Revisar permiso de salud", tick the box and tap "Aceptar y activar salud". Sending data to the AI coach requires a separate consent, accepted with "Acepto y activo el coach". Declining either one keeps the free organisation features available. You can withdraw these permissions in Perfil > "Envío de datos al coach" and in "Salud y bienestar" > "Retirar y borrar salud".

Coach. Grant both permissions, then open the Coach tab and send, for example, "Ayúdame a organizar mi día de mañana".

User-generated content. Open Perfil > "Amigos". Tap the three-dot button of another user (or the user's row in a ranking), choose a reason and tap "Enviar denuncia". The same sheet offers "Bloquear usuario"; after confirming "Bloquear", the users no longer see each other in requests or rankings. "Convivencia y seguridad" lists blocked users with "Desbloquear" and offers "Contactar con soporte". Reports go into a moderation queue. The developer reviews every report personally, receives a notification when a new report arrives and acts within 24 hours: hiding content, warning or blocking the reported account. Users can also contact support at https://nivl-web.vercel.app/soporte. [AI_REPORT] Names, titles and photos stay private until they pass human approval. There is no messaging between users.

Account deletion. In Perfil, scroll to the "Cuenta" section, tap "Eliminar cuenta", then tap "Eliminar para siempre" in the sheet and again in the final alert. This permanently deletes the NIVL account, its personal data and stored files; limited records may be kept only where the law requires, as described in the Privacy Policy. "Exportar mis datos" is in the same section. Deleting the account does not cancel an Apple subscription; subscriptions are managed in the Apple ID settings. Please use a newly created account to test deletion, so that the review accounts remain available.

**4. External services**

- Supabase (database hosted in Frankfurt, Germany): authentication, database, file storage and server functions.
- Apple In-App Purchase (StoreKit) and RevenueCat: subscription purchases, restores and subscription status. All iOS purchases use Apple's purchase sheet.
- AI services used by the optional coach, only after the user's consent: DeepSeek (Pro coach and the 7-day trial) and Anthropic (Claude: Élite coach and some shorter tasks). The in-app consent screen names each provider, when it is used and its processing locations. NIVL has no analytics, advertising or cross-app tracking SDKs.
- Expo and Apple Push Notification service: optional notifications and compatible over-the-air updates of the app's JavaScript.
- Vercel: hosting of the public support and legal pages.

**5. Regional differences**

NIVL works the same in all 165 App Store territories where it is available. It has no region-specific features or content, and its interface is in Spanish. Prices, currency and taxes follow each customer's App Store storefront. Scheduling uses the device's time zone.

**6. Regulated industries and third-party material**

NIVL does not operate in a regulated industry. It is a general productivity and wellbeing app: it does not diagnose or treat medical conditions, does not provide financial or investment advice, does not process banking transactions and includes no gambling. It does not use HealthKit. Health and finance entries are typed in by the user, and the app states that AI suggestions do not replace professional advice. NIVL does not distribute protected third-party content. Its brand graphics are our own. The Cinzel and Outfit fonts are used under the SIL Open Font License 1.1, and the icon resources are under open-source licences. We can provide the licence records on request.

**7. In-App Purchase**

Users can buy auto-renewable subscriptions in the "NIVL" subscription group. They unlock the AI coach; habits and organisation stay free.

| Product ID | Name in the app | Duration | Price (Spain) | Access |
|---|---|---|---|---|
| nivl_pro_mensual | NIVL Pro mensual | 1 month | €12.99 | Standard AI coach with a monthly allowance |
| nivl_pro_anual | NIVL Pro anual | 1 year | €99.99 | Same as Pro mensual, billed annually |
| nivl_elite_mensual | NIVL Élite mensual | 1 month | €29.99 | Advanced coach, limited deep mode, badge and option to request a place in a ludus (private group) |
| nivl_elite_anual | NIVL Élite anual | 1 year | €299.00 | Same as Élite mensual, billed annually |
| nivl_elite_fundador | NIVL Élite fundador | 1 year | €249.00 | Élite at a founder price; limited availability; auto-renewable, not lifetime |

How to reach the purchase flow: open Perfil and tap the "NIVL Pro" row below the profile header (or use the Pro control in Coach). Choose "Pro" or "Élite" and a plan. During the 7-day trial, tap "Suscribirme"; a Pro subscriber can tap "Ver NIVL Élite". [PAYWALL] The screen shows each plan's title, duration and localised App Store price, what is included, the renewal terms, "Restaurar compras", and links to the Terms of Use and the Privacy Policy.

The 7-day trial ("Probar el coach 7 días") is granted by our server: it asks for no payment details and does not renew. Subscriptions do not buy XP, ranking advantages or prizes. Élite lets users request a ludus place but does not guarantee immediate assignment.

Support: https://nivl-web.vercel.app/soporte
Terms of Use: https://nivl-web.vercel.app/terminos (the Apple Standard EULA also applies)
Privacy Policy: https://nivl-web.vercel.app/privacidad

Thank you for reviewing NIVL.

---

## Nota interna sobre el borrado (no enviar)

Resuelto por decisión del usuario el 02/10/2026: NIVL deja el puente de Franky y usa su propio Supabase Auth, así que el borrado en NIVL elimina el registro completo de la cuenta, como pide la [guía de Apple](https://developer.apple.com/support/offering-account-deletion-in-your-app/). Falta comprobarlo en el binario (prueba A10). Si la build final mantuviera cuentas antiguas creadas con Franky, revisar este punto antes de enviar.
