# Guion del vídeo para App Review (ajustado al mensaje del 29/09/2026)

Sustituye, para este envío, a `docs/appstore-review-2026-09-29/VIDEO-IPHONE.md`. Los rótulos se han comprobado en el código de la base `bf32d28`. Si los chats 2, 3 o 4 cambian algún texto, actualízalo aquí antes de grabar.

## Lo que exige Apple, literalmente, y cómo lo cubre el vídeo

| Exigencia (mensaje del 29/09) | Escena |
|---|---|
| «captured on a physical device» | Grabación de pantalla nativa de iOS en un iPhone físico. No hace falta filmar con otra cámara. No valen el simulador ni Expo Go |
| «running the latest operating system» | La última versión pública el 02/10/2026 era **iOS 27.0.1** (28/09/2026, [Apple security releases](https://support.apple.com/en-us/100100)). Comprobarlo el día de la grabación y enseñarlo en la escena 0 |
| «must begin with launching the app» | Escena 1: empieza en la pantalla de inicio y se toca el icono con la app cerrada |
| «show the typical user flow» | Escena 3 |
| «Account registration, login, and account deletion flows» | Escenas 2 y 7 |
| «Any user-generated content, including the required content reporting and blocking mechanisms» | Escena 6 |
| «subscription flows that clearly display… the title, length, and price of each subscription, as well as links to the Terms of Use and privacy policy» | Escena 5 |

## El vídeo del 01/10 no basta tal cual

Es una grabación de un iPhone y aporta valor como demostración parcial (`coordinacion-winter-arc/VIDEO-REVISION.md`, fuera del repositorio). Pero, contrastado con el mensaje vigente:

- empieza dentro de Perfil, no lanzando la app;
- no muestra registro, login ni borrado de cuenta;
- no muestra denuncia ni bloqueo;
- no muestra el paywall ni la compra;
- no permite saber la build ni la versión de iOS;
- usa una cuenta con datos personales.

**Conclusión:** hay que grabar un vídeo nuevo y completo con la build candidata. Algunos tramos del vídeo del 01/10 (hábitos, agenda, misiones) pueden servir de referencia, pero no conviene montarlos con el nuevo: Apple pide un recorrido continuo desde el lanzamiento, y mezclar builds o cuentas resta credibilidad.

## Preparación (fuera de cámara)

1. Instalar **NIVL 1.0.7 ([BUILD])** desde TestFlight, la misma build que se asociará al envío. No grabar una build anterior, una de desarrollo ni Expo Go. Si después se publica una OTA que cambie pantallas del vídeo, decidir con el coordinador si hay que repetir la grabación.
2. Actualizar el iPhone a la última versión pública de iOS y anotar el modelo y la versión.
3. Activar «No molestar». Quitar notificaciones y datos personales. Iniciar sesión en el iPhone con una **cuenta sandbox de Apple** (Ajustes > App Store > Cuenta Sandbox) para que la compra no sea real.
4. Preparar las cuentas ([cuentas-demo.md](cuentas-demo.md)):
   - **D** (desechable): se crea en cámara y se borra al final;
   - **U2** (segundo usuario): servirá para denunciarlo y bloquearlo, y tiene que tener ya una relación con D (solicitud de amistad o ludus de prueba). Para que D, recién creada, pueda verlo, la solicitud se envía desde U2 durante la grabación (en otro dispositivo o desde la web), o la escena 6 se graba con la cuenta Gratis de revisión, que ya tiene ese vínculo. Decidir y ensayarlo antes. Nunca denunciar a usuarios reales.
5. Comprobar que los 5 productos están adjuntos a la versión en ASC y que la offering de RevenueCat los devuelve todos: abrir Perfil > «NIVL Pro» y verificar que **no** aparece «Algún plan no está disponible…». Si aparece, no grabar.
6. Ensayar el recorrido entero una vez. Si algo falla, se corrige y se graba de nuevo. No se esconde nada en el montaje.
7. Cerrar la app del todo (deslizar en el selector de apps) y empezar la grabación de pantalla desde el Centro de control.

## Recorrido (una sola toma; unos 6–9 minutos)

**0. Identificación (fuera del vídeo).** El modelo, el iOS y la build se anotan en la respuesta (`[DEVICE]`, `[IOS]`, `[BUILD]`). Si se quieren enseñar, se graban en un clip aparte que no se pone al principio del recorrido. El vídeo empieza en la pantalla de inicio con la app cerrada.

**1. Lanzamiento.** Pantalla de inicio → tocar el icono de NIVL → pantalla de carga → pantalla de acceso.

**2. Registro y login.**
- Pestaña «CREAR CUENTA» → NOMBRE, CORREO, CONTRASEÑA y REPITE LA CONTRASEÑA de la cuenta D (ocultar la contraseña) → marcar la casilla «He leído y acepto los Términos de NIVL…» → «CREAR CUENTA» → aparece el aviso de confirmación → abrir la app Mail del **mismo iPhone** (el correo de D tiene que estar configurado ahí, sin otros correos personales a la vista) → tocar el enlace → NIVL abre «CONFIRMAR CUENTA» y entra solo. Ensayarlo antes: el correo real en el iPhone está NO PROBADO.
- Cerrar sesión desde Perfil y volver a entrar con D: pestaña «ENTRAR» → CORREO y CONTRASEÑA → «ENTRAR».
- Las cuentas de revisión entran por la misma pestaña «ENTRAR»; no hay otra ruta.

**3. Flujo típico.**
- Declaración de edad y onboarding (perfil de uso).
- Crear una misión o un hábito → en «Hoy», completarlo y enseñar el progreso (XP/racha).
- «Hábitos», una campaña o proyecto y «Agenda» (crear un evento).
- Permisos separados: abrir un módulo de salud → la casilla aparece desmarcada → «Ahora no» → las funciones generales siguen funcionando. Después, Perfil > «Salud y bienestar» > «Revisar permiso de salud» → marcar la casilla → «Aceptar y activar salud».

**4. Coach e IA.** (La salud tiene que estar aceptada en la escena 3: hoy `start_trial` falla si se rechazó el consentimiento de salud, trigger 0030, hasta que se integre el arreglo del Chat 3.) Perfil > fila «NIVL Pro» → «Probar el coach 7 días» si la cuenta tiene derecho → aparece el consentimiento de IA con los proveedores → «Acepto y activo el coach» → pestaña Coach → enviar «Ayúdame a organizar mi día de mañana» → mostrar la respuesta.

**5. Suscripciones (lo que más mira Apple).** Grabar SIEMPRE en Perfil > «NIVL Pro» (`/pro`), donde los planes salen antes que los beneficios. **No** grabarlo en el último paso del onboarding: ahí los 5 productos no caben sin desplazar la pantalla (Chat 2 @b11c2d2).
- Volver a «NIVL Pro» → «Suscribirme» (con la prueba activa) o directamente el selector de planes.
- Recorrer **los cinco planes**: «Pro» → mensual y anual; «Élite» → mensual, anual y fundador. En cada uno, mantener la imagen unos 2 segundos para que se lean el **título**, la **duración** y el **precio** de la tienda.
- Mostrar el texto de renovación automática y el aviso de energía mensual.
- **Abrir el enlace de Términos** (que cargue la página) y volver. **Abrir el de Privacidad** y volver.
- Comprar un plan con la cuenta sandbox, confirmar en la hoja de Apple, ver el acceso activado en NIVL y usar una función de pago.
- Pulsar «Restaurar compras» y enseñar el resultado.
- Si el plan fundador no está a la venta en la build, decirlo en la respuesta y no inventarlo. Pendiente de confirmar por el Chat 2: `[PAYWALL]`.

**6. Contenido de usuarios: denuncia y bloqueo.**
- Perfil > «Amigos» → localizar a U2 → botón de tres puntos (en un ranking también vale tocar su fila) → elegir un motivo → «Enviar denuncia» → confirmación.
- En la misma hoja, «Bloquear usuario» → «Bloquear» → U2 desaparece de solicitudes y rankings.
- «Convivencia y seguridad» → tocar «Desbloquear» y confirmar en la alerta → enseñar «Contactar con soporte».
- Se puede decir, o rotular, que las denuncias las revisa una persona y que no hay mensajería entre usuarios. No afirmar que la denuncia ya está resuelta.

**7. Datos y borrado de cuenta.**
- Perfil > sección «Cuenta» → «Exportar mis datos» → mostrar la hoja para compartir y cancelarla.
- Perfil > «Envío de datos al coach» → enseñar la opción «Retirar» (no hace falta confirmarla).
- Con la cuenta D: «Eliminar cuenta» → «Eliminar para siempre» en la hoja → «Eliminar para siempre» en la alerta → la app vuelve a la pantalla de acceso.
- Intentar entrar de nuevo con D y enseñar que ya no tiene datos o que no puede entrar, según el comportamiento real.
- ~~Cuenta Franky~~: resuelto el 02/10. Ya no existe la cuenta compartida; el borrado de NIVL es el registro completo. Texto anterior, solo como historial: Si se aprueba el enlace directo a la página de borrado de Franky (propuesta del Chat 3), seguir el enlace y completar también ese borrado en cámara. Si no se aprueba, el vídeo no lo mostrará y la respuesta lo explicará. Hay que tener en cuenta que es un riesgo frente a la guía de Apple, que pide borrar el registro completo de la cuenta.

**8. Cierre.** Volver a la pantalla de acceso y parar la grabación.

## Entrega

- Exportar el original del Carrete en MOV/MP4, sin recomprimirlo. El archivo que llegó por WhatsApp (384×848) no tiene calidad suficiente.
- Comprobar que en ningún fotograma aparecen contraseñas, correos personales ni notificaciones.
- Subirlo como adjunto de la respuesta o a un enlace que funcione sin iniciar sesión (probarlo en una ventana privada).
- Anotar las marcas de tiempo de cada escena para `[TIMESTAMPS]` en la respuesta.
- Apuntar los resultados en la lista mínima de pruebas físicas del Chat 5 ([pruebas-fisicas-minimas.md](pruebas-fisicas-minimas.md)): build, modelo, iOS, fecha y PASS/FAIL de cada escena.

Estado a 02/10/2026: **NO GRABADO.** Depende de: (a) la build candidata (coordinador); (b) el paywall con los cinco planes en esa build (Chat 2); (c) los rótulos nuevos de registro y acceso sin Franky (chats 3 y 4); (d) las cuentas U2 y sandbox preparadas.
