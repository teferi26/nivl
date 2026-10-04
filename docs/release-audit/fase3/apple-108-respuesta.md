# Respuesta al Resolution Center para la 1.0.8 (build 23)

Cambio de plan del 04/10/2026: el envío rechazado (versión renombrada a **1.0.8**, build **23**, publicación MANUAL, PREPARE_FOR_SUBMISSION por GET del 04/10) responde al mensaje de Apple del 29/09 (Guideline 2.1, Information Needed). Texto literal del mensaje: `winter/chat1-tiendas`, `docs/release-audit/00-apple-rechazo-literal.md`.

**Uso interno: no enviar esta cabecera.** Lo pega y lo envía el coordinador con el usuario. Antes de enviar:

| Marcador | Qué poner | Quién |
|---|---|---|
| `[VIDEO]` | Nombre del adjunto o enlace que se abra sin iniciar sesión | Coordinador + usuario |
| `[DEVICE]`, `[IOS]` | Modelo del iPhone y versión de iOS del vídeo (Ajustes > General > Información). El archivo no lleva esos metadatos. Última versión pública el 04/10/2026: **iOS 27.0.1** ([Apple security releases](https://support.apple.com/en-us/100100)). Si el iPhone tenía otra, actualizar y avisar | Usuario |
| `[DATE]` | Fecha de la grabación | Usuario |
| Credenciales de Pro y Élite | Solo en las notas de ASC, nunca aquí | Coordinador + usuario |

**Calidad del vídeo:** el archivo `videoCompletoNivl.mp4` mide **384 × 848** (80 MB, 8:20), la misma resolución reducida que la copia de WhatsApp del 01/10. Hay que adjuntar el **original del Carrete** del iPhone, a resolución completa, para que Apple pueda leer precios y textos legales. Las marcas de tiempo valen igual si es la misma toma.

---

Hello App Review Team,

Thank you for your message of 29 September (Guideline 2.1, Information Needed). This submission now contains NIVL 1.0.8 (build 23), which replaces the previously submitted build. Below is the information you requested, numbered as in your message. A compact version has also been added to the App Review Information notes.

**1. Screen recording on a physical device**

Recording: [VIDEO]
Device: [DEVICE], iOS [IOS]. App: NIVL 1.0.8 (build 23) installed from TestFlight. Recorded on [DATE] in one continuous take (8:20) with a newly created account.

- 0:00 Launch from the Home Screen.
- 0:03 to 0:57 Account registration and email confirmation.
- 1:00 to 1:24 Sign in.
- 1:24 Age declaration.
- 1:30 to 1:39 Rules, name and profile.
- 1:45 to 1:51 Health-data permission declined ("Ahora no"); the general features remain available.
- 2:00 to 2:57 Goal, first missions and commitment.
- 3:00 to 3:27 Subscription screen with all five plans, each with its title, duration and price: Pro (annual, €99.99/year; monthly, €12.99/month) and Élite (founder, €249/year; annual, €299/year; monthly, €29.99/month). The 7-day trial is started here.
- 3:30 to 3:39 Completing a mission; Habits.
- 3:51 to 3:54 Health permission accepted from Perfil.
- 4:06 to 4:24 Perfil > "NIVL Pro", showing the plans again.
- 4:27 Separate AI consent ("Acepto y activo el coach").
- 4:36 to 5:12 Paid feature in use: the AI coach replies and writes a plan.
- 5:45 to 6:12 Friends: friend code, report ("Enviar denuncia"), block, unblock and "Contactar con soporte".
- 6:27 to 6:57 Terms of Use and Privacy Policy opened (nivl.app).
- 7:00 to 7:06 Data export.
- 7:09 to 7:30 Sign out and sign in again.
- 7:42 to 7:57 Account deletion.
- 8:00 to 8:18 Signing in with the deleted account fails.

The subscription screen also has "Términos de uso" and "Política de privacidad" links at its bottom; in the recording they are opened from Perfil (6:27). The recording does not include a sandbox purchase: the Free review account can be used to test the purchase and "Restaurar compras".

**2. Purpose and target audience**

NIVL is a Spanish-language habit and personal-organisation app for individual users aged 16 and over, such as students, professionals, entrepreneurs and people building training routines. It turns routines and goals into daily missions with levels, ranks and streaks, and brings habits, campaigns, a calendar, training, nutrition, a journal, finances and progress photos together. The problem it addresses is consistency: users plan in one place, see what to do each day and track their progress. All tracking and organisation features are free. Optional subscriptions add an AI coach. NIVL is a general consumer app, not intended for a specific business or organisation.

**3. Setup and access to the main features**

No sample files, external hardware, bank connections or personal API keys are needed.

Review accounts, one per access level:
- Free account (credentials in the App Review sign-in fields): use it to test the purchase, the sandbox payment and "Restaurar compras".
- Pro account and Élite account (credentials in the App Review notes): their access was granted manually on our server so you can see the paid features without paying. Please do not buy or restore with these two accounts, because a sandbox purchase would replace the granted access, which would then expire.
None of the accounts has accepted the age declaration or the health and AI consents on your behalf; the app asks on first use.

Signing in: on the access screen, stay on the "ENTRAR" tab, enter the email and password and tap "ENTRAR". To create an account, open "CREAR CUENTA", fill in the details, tick the (initially unticked) Terms and Privacy box, tap "CREAR CUENTA" and open the confirmation link sent by email on the same device. NIVL accounts are NIVL's own; no third-party account is needed.

Main features: "Hoy" shows today's missions; "Hábitos", "Campañas" and "Agenda" organise routines, longer goals and scheduled activities; "Perfil" contains settings, "Amigos y duelos", data export and account deletion.

Health and AI permissions: training, nutrition and journal features ask for explicit health-data permission (Perfil > "Salud y bienestar" > "Revisar permiso de salud" > tick the box > "Aceptar y activar salud"). Sending data to the AI coach requires a separate consent ("Acepto y activo el coach"). Declining either keeps the free features; to try the coach, accept both. Both can be withdrawn in Perfil.

Coach voice (Pro and Élite): hold the microphone button in Coach to dictate, and tap "Escuchar" to hear a reply. The microphone is used only while the button is held.

Progress photos: "Avances" > "Fotos de progreso". They require an 18+ confirmation and the health permission, are stored privately, screenshots are blocked on that screen, and they are never analysed by AI.

User-generated content: Perfil > "Amigos y duelos". Tap another user's three-dot button (or their row in a ranking), choose a reason and tap "Enviar denuncia"; the same sheet offers "Bloquear usuario". "Convivencia y seguridad" lists blocked users with "Desbloquear" and offers "Contactar con soporte". Leagues and weekly duels compare consistency only; nothing is staked. AI coach replies can also be reported with "Denunciar respuesta". The developer reviews the report queue personally every day and acts within 24 hours, for example by replacing the reported name or photo with a neutral one or by suspending the account from social features. There is no messaging between users.

Account deletion: Perfil > "Cuenta" section > "Eliminar cuenta" > "Eliminar para siempre" in the sheet and again in the final alert. It permanently deletes the NIVL account, its personal data and stored files; limited records may be kept only where the law requires, as described in the Privacy Policy. Deleting the account does not cancel an Apple subscription (Settings > [your name] > Subscriptions). Please test deletion with a new account, not the review accounts.

**4. External services**

- Supabase (database hosted in Frankfurt, Germany): authentication, database, private file storage and server functions.
- Resend: account emails (sign-up confirmation and password reset).
- Apple In-App Purchase (StoreKit) and RevenueCat: subscriptions, restores and subscription status. All iOS purchases use Apple's purchase sheet.
- AI services used by the optional coach, only after the user's consent: DeepSeek (Pro coach and the 7-day trial) and Anthropic (Claude: the Élite coach and other requests listed in the consent screen).
- Apple speech services: on-device speech recognition when available for dictation, and text-to-speech for reading replies.
- Expo and Apple Push Notification service: optional notifications and over-the-air updates of the app's JavaScript.
- Vercel: hosting of the public website, support and legal pages.
NIVL has no analytics, advertising or cross-app tracking SDKs.

**5. Regional differences**

NIVL works the same in all 165 App Store territories where it is available. It has no region-specific features or content, and its interface is in Spanish. Prices, currency and taxes follow each customer's App Store storefront. Scheduling uses the device's time zone.

**6. Regulated industries and third-party material**

NIVL does not operate in a regulated industry. It is a general productivity and wellbeing app: it does not diagnose or treat medical conditions, does not provide financial or investment advice, does not process banking transactions and includes no gambling. It does not use HealthKit. Health and finance entries are typed in by the user, and the app states that AI suggestions do not replace professional advice. NIVL does not distribute protected third-party content; its brand graphics are our own, and the Cinzel and Outfit fonts are used under the SIL Open Font License 1.1.

**7. In-App Purchase**

Auto-renewable subscriptions in the "NIVL" subscription group. They unlock the AI coach; all tracking and organisation features stay free.

| Product ID | Name in the app | Duration | Price (Spain) |
|---|---|---|---|
| nivl_pro_mensual | NIVL Pro mensual | 1 month | €12.99 |
| nivl_pro_anual | NIVL Pro anual | 1 year | €99.99 |
| nivl_elite_mensual | NIVL Élite mensual | 1 month | €29.99 |
| nivl_elite_anual | NIVL Élite anual | 1 year | €299.00 |
| nivl_elite_fundador | NIVL Élite fundador | 1 year | €249.00 (shown only while founder places remain; auto-renewable, not lifetime) |

Pro is the standard AI coach with a monthly allowance. Élite adds a higher-capacity model, a limited deep mode, an extended weekly review, a laurel badge and the option to request a place in a ludus (a private group of 5 to 8 Élite members; placement is not guaranteed). Subscriptions do not buy XP, rank or ranking advantages.

How to reach the purchase flow: the last onboarding step (3:00 in the recording), or Perfil > "NIVL Pro" (4:06). Choose "Pro" or "Élite" and a plan; during the trial, tap "Suscribirme". The screen shows each plan's title, duration and localised App Store price, renewal terms, "Restaurar compras", and links to the Terms of Use, the Privacy Policy and Apple's standard EULA. Eligible accounts can start a one-time 7-day free trial of the AI coach at the Pro level, capped at a small usage allowance; it needs no payment information, does not renew or convert into a paid subscription and never unlocks Élite features.

Support: https://nivl.app/soporte
Terms of Use: https://nivl.app/terminos (Apple's standard EULA also applies)
Privacy Policy: https://nivl.app/privacidad

Thank you for reviewing NIVL.
