# Respuesta preparada — Guideline 2.1

**BORRADOR. No enviar todavía:** falta la grabación en iPhone físico y completar las pruebas con la compilación final. Las correcciones locales deben estar desplegadas y dentro del binario antes de describirlas como disponibles. No afirmar que hay un vídeo adjunto ni pruebas completadas hasta que existan.

Sustituir los campos entre corchetes tras verificar los hechos. Las credenciales no se incluyen en este archivo público. No enviar este encabezado interno a Apple.

---

Hello App Review Team,

Thank you for your request under Guideline 2.1. Below is the information about NIVL, with matching information to be included in the App Review Notes.

**1. Physical-device recording and testing**

Recording: [ATTACHMENT NAME OR ACCESSIBLE VIDEO URL]
Device: [IPHONE MODEL]; operating system: [IOS VERSION]; NIVL: [VERSION AND BUILD]; recorded on [DATE].

The recording starts with launching NIVL and demonstrates registration, login, the normal habit and planning flow, separate health and AI permissions, the subscription screens and paid access, user-content reporting and blocking, and deletion of a disposable NIVL account. [ADD TIMESTAMPS ONLY AFTER VIEWING THE ACTUAL VIDEO.]

**2. Purpose and audience**

NIVL is a Spanish-language habit and personal organisation app for people aged 16 and over, including students, professionals, entrepreneurs and people building fitness habits. It brings recurring habits, personal projects, scheduling and progress into one place. Users can also record exercise, nutrition, wellbeing journal entries and personal finances. Missions, levels and streaks help users follow their routines. Tracking and organisation are free; an optional paid AI coach helps users plan and review their routines. NIVL is available to individual consumers and is not restricted to a particular employer, organisation or business.

**3. Setup and access to the main features**

Use the dedicated NIVL review credentials in the App Review sign-in fields. On the login screen choose “¿Cuenta antigua de NIVL? Entrar con ella”, then “Entrar con cuenta NIVL”. Those credentials use NIVL's direct login, not the separate Franky login. New users can choose “CREAR CUENTA” and then “Crear cuenta Franky” in the normal registration flow. No sample files, bank credentials, external hardware or personal API keys are required.

Confirm the age declaration when prompted. Hoy shows today's missions; Hábitos manages routines; campaigns/projects and Agenda organise longer goals and scheduled activities. Perfil provides account settings, data export and deletion.

Health features require explicit health-data permission. Select Perfil > Salud y bienestar > “Revisar permiso de salud”, read the notice, mark the initially unchecked box and choose “Aceptar y activar salud”. Declining keeps general organisation features available. AI sharing requires a separate consent screen describing the providers, data and processing countries, accepted with “Acepto y activo el coach”. To withdraw it, open Perfil, scroll to “Datos y la IA”, tap “Envío de datos al coach”, and confirm “Retirar”. Health permission is managed separately in “Salud y bienestar” with “Retirar y borrar salud”.

In Perfil, tap the “NIVL Pro” row below the profile header to open the paid plans. Eligible accounts can use “Probar el coach 7 días”, a server-granted trial with no payment details and no automatic renewal. Then open Coach and try “Ayúdame a organizar mi día de mañana”. If a trial is already active, “Suscribirme” opens the plans. An active Pro account can use “Ver NIVL Élite”. [ADD VERIFIED ADDITIONAL REVIEW ACCOUNT ACCESS IF NEEDED TO DEMONSTRATE ÉLITE/LUDUS.]

For account deletion, open Perfil and scroll to the “Cuenta” section. Tap “Eliminar cuenta”, then “Eliminar para siempre” in the explanation sheet, and confirm “Eliminar para siempre” in the final alert. “Cuenta” is a section on Perfil, not a separate screen. It removes the NIVL account, active personal records and stored files; limited records may be retained where legally required, as described in the Privacy Policy. The separate Franky account is unchanged. Deleting an app account does not cancel an Apple subscription, which is managed in Apple's subscription settings. Please use a disposable test account when verifying deletion so the supplied review account remains available. Data export is in the same “Cuenta” section under “Exportar mis datos”.

For social safety, open Perfil > “Amigos”. Tap another user's row or its three-dot button in a ranking, or use the three-dot button on a pending request. Choose a report reason and “Enviar denuncia”; the sheet also has “Bloquear usuario”. Confirm “Bloquear” to remove the relationship and hide both users from each other's requests and rankings, including a shared ludus. “Convivencia y seguridad” contains “Desbloquear” for blocked users and “Contactar con soporte”. Names, titles and photos remain private to their owner until human approval; others see a neutral alias and image while review is pending.

**4. External services**

- Supabase: NIVL authentication, database, file storage and server functions; the NIVL database is hosted in Frankfurt.
- Franky account service: registration and verification of the user's Franky credentials. The supplied review account also has the direct NIVL login described above.
- Apple StoreKit/App Store and RevenueCat: in-app subscriptions, purchase/restore handling and subscription status. iOS purchases are made through Apple's purchase sheet; there is no Stripe checkout or personal AI-key unlock in the App Store build.
- Anthropic (Claude) and DeepSeek: AI coaching and related assistance, depending on the configured plan/model. The app discloses Anthropic's US storage and default processing in the US, Europe, Asia and Australia, and DeepSeek's processing in China. It asks for explicit permission before sending user context. These services are optional; free tracking remains available without AI.
- Expo and Apple push services: notifications and app infrastructure, including compatible app updates. Notifications are optional.
- Vercel: hosting of the public support and legal pages. Google Fonts is used on those web pages.

An internal Notion integration is restricted to the developer's own account; it does not copy other users' conversations. NIVL does not require users to connect a bank or a Notion account.

**5. Regional behaviour**

NIVL has no region-specific feature switches: the same core features and Spanish-language interface are used across its enabled App Store territories. Store prices, currency, taxes and purchase availability follow the customer's App Store storefront. Scheduling follows the user's timezone. AI service/network availability may depend on the providers and local conditions; this is not a promise of worldwide provider availability. [VERIFY ENABLED TERRITORIES AND ANY PROVIDER RESTRICTIONS BEFORE SENDING.]

**6. Regulated services and third-party material**

NIVL is a general productivity and wellbeing app. It does not provide medical diagnosis or treatment, investment advice, banking transactions or gambling. It does not use HealthKit. Health and finance entries are supplied by the user; AI suggestions do not replace professional advice. The app displays relevant notices.

NIVL's distributed brand graphics are generated by the project's own geometric icon generator. Cinzel and Outfit fonts are used under the SIL Open Font License 1.1; the icon resources have applicable open-source licences. NIVL does not distribute a protected film, music or editorial catalogue. User content is subject to the Terms of Use and moderation. Provider terms govern the AI-generated outputs. Supporting content-rights and licence records can be supplied; we are not claiming medical or financial certification.

**7. In-App Purchases**

All products are auto-renewable subscriptions in the NIVL group:

| Product ID | Title | Duration | Access |
|---|---|---|---|
| nivl_pro_mensual | NIVL Pro mensual | 1 month | Standard AI coach with a monthly usage allowance |
| nivl_pro_anual | NIVL Pro anual | 1 year | Same Pro access, billed annually |
| nivl_elite_mensual | NIVL Élite mensual | 1 month | Advanced coach, limited deep mode, badge and ability to request a ludus place |
| nivl_elite_anual | NIVL Élite anual | 1 year | Same Élite access, billed annually |
| nivl_elite_fundador | NIVL Élite fundador | 1 year | Élite annual founder offer, when available; not a lifetime purchase |

Open Perfil > “NIVL Pro”, select “Pro” or “Élite” and the desired available plan (“Mensual”, “Anual” or the founder option when offered). For an account with an active trial, tap “Suscribirme” to reveal the plan selector; an existing Pro subscriber can tap “Ver NIVL Élite”. The purchase screen displays the title, billing period, current localised store price, included features, the notice explaining monthly energy limits and consumption that varies with request length, renewal information, “Restaurar compras”, and links to the Terms of Use and Privacy Policy. Founder availability is limited. Ludus groups are assigned gradually; purchasing Élite allows a placement request and does not guarantee immediate group assignment. Subscriptions do not buy XP, ranking advantages or prizes.

Support: https://nivl-web.vercel.app/soporte
Terms of Use: https://nivl-web.vercel.app/terminos
Privacy Policy: https://nivl-web.vercel.app/privacidad

Thank you for reviewing NIVL.
