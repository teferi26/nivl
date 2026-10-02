# Rechazo vigente de App Review (texto literal)

Leído el 02/10/2026 en App Store Connect (sesión del usuario en Chrome, solo lectura) por Chat 1 · Tiendas.

- App: 6801825007 «NIVL: Hábitos y Disciplina».
- Envío: `fb26cf6b-bb5d-4a84-a66a-346edde0b580`, presentado el 28/09/2026 a las 9:16, estado «Problemas sin resolver».
- Elementos enviados (7): grupo de suscripción «NIVL»; «Pro mensual 12,99», «Pro anual 99,99», «Élite mensual 29,99», «Élite anual 299» y «Élite fundador 249», todos «Listo para revisión»; versión **iOS 1.0.7 (18)**, «Rechazado», motivo de la tabla: **«2.1.0 Performance: App Completeness»**.
- Mensajes del hilo: **1**, de Apple, el **29/09/2026 a la 1:16** (hora mostrada por ASC). **No hay respuesta del desarrollador** ni mensajes posteriores. No hay adjuntos de Apple.
- Banner: «Tu versión de la app se ha rechazado y ninguno de los otros elementos enviados puede aceptarse ni aprobarse.»

## Texto literal

> Guideline 2.1 - Information Needed - New App Submission
>
> This app has been submitted by a developer account that has a limited App Review history. We need additional information to better understand the app and complete the review.
>
> Note: Before submitting, run the submitted build through your own testing and quality assurance process on supported physical devices. App Review is intended for apps and metadata that are complete and ready for App Store customers.
>
> If the app is ready for review, follow the directions below.
>
> Next Steps
>
> Reply in App Store Connect with all of the following information and also add this information to the Notes field of the App Review Information section in App Store Connect, for reference on future submissions:
>
> 1. A screen recording captured on a physical device, running the latest operating system, demonstrating the app's functionality. The recording must begin with launching the app and show the typical user flow. If the app has any of the following, include them in the recording:
>
> - Account registration, login, and account deletion flows. Account deletion is required in apps that support account creation.
> - Any user-generated content, including the required content reporting and blocking mechanisms.
> - Accessing paid content or features within the app, including subscription flows that clearly display all the following required information: the title, length, and price of each subscription, as well as links to the Terms of Use and privacy policy.
>
> 2. A description of the app's purpose and target audience, including the problem it solves and the value it provides
> 3. Instructions for setting up and accessing the app's main features, including any required login credentials or sample files
> 4. A list of the external services, tools, or platforms the app uses to deliver its core functionality (for example, data providers, authentication services, payment processors, or AI services)
> 5. Describe any regional differences in the app's features or content, or confirm that the app functions consistently across all regions
> 6. If the app operates in a highly regulated industry or includes protected third-party material, provide any relevant documentation or credentials to demonstrate you are authorized to provide these services or protected material
> 7. An overview of what users can buy with In-App Purchase. Describe how to navigate to the purchase flows within the app.
>
> Prevent Common Issues
>
> - Guideline 2.1 - Bugs and crashes: Apps are reviewed on physical devices to mirror real-world conditions. Test the app on each supported device platform before submitting. Use TestFlight to distribute builds for beta testing on real devices.
> - Guideline 2.1 - Accessing the app: If the app includes account-based features, provide up-to-date login credentials for a demo account in App Store Connect. If the app has multiple account types, provide credentials for each type in the Notes field.
> - Guideline 2.3.3 - Screenshots: App screenshots on the App Store must show the actual app in use, and not merely the title art, login page, or splash screen.
> - Guideline 3.1.1 - In-App Purchase: In-App Purchase products should be configured and submitted alongside the app.
> - Guideline 3.2 - Other Business Models: If your app is intended to be used by specific businesses, organizations or employees then use one of the other distribution options available to you through the Apple Developer Program Account.

## Lectura

- Es un **2.1 Information Needed** (petición de información), no un fallo concreto observado por Apple. Apple no ha señalado ningún bug, crash ni incumplimiento específico. La sección «Prevent Common Issues» es una lista genérica de prevención, no una lista de defectos encontrados.
- Coincide con el expediente local del 29/09 (`docs/appstore-review-2026-09-29/`): ese expediente **sí es la causa vigente**, pero la respuesta **no se ha enviado**.
- Exigencias de vídeo: dispositivo físico, **último sistema operativo**, **empieza lanzando la app**, flujo típico, y como la app los tiene: **registro, login y borrado de cuenta**; **UGC con denuncia y bloqueo**; **acceso a contenido de pago** con título, duración y precio de cada suscripción y enlaces a Términos de uso y Política de privacidad.
- La versión rechazada lleva la build **18**. Para reenviar con el binario corregido hay que asociar la build 20 (o la que salga de la integración) a la 1.0.7 antes de «Volver a enviar».
