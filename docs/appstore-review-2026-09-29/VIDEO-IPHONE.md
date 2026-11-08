# Vídeo solicitado por App Review: NIVL 1.0.11

Apple pide una grabación de pantalla de un **dispositivo físico con el sistema operativo actualizado**, desde el lanzamiento y mostrando el recorrido normal. Un simulador, Expo Go, un vídeo generado o las capturas comerciales no satisfacen esa petición. Los vídeos de `scripts/tienda/` son material de la ficha y **no sirven aquí**.

Estado: **grabación física pendiente**. Instalar **NIVL 1.0.11 (build: [RELLENAR])** desde TestFlight. Este guion no acredita que las pruebas se hayan hecho. Grabar la compilación que se envía; no mezclar una versión local, una OTA distinta y el binario del envío.

Rótulos contrastados con el código de la 1.0.11 (`47d2546`). Si un texto en pantalla no coincide, manda la pantalla y se corrige este guion.

## Una sola toma

Todo sale en una grabación continua, de unos 15 minutos, sin cortes ni montaje. El orden está pensado para que los cambios de cuenta formen parte de lo que Apple pide ver: registro, acceso, restauración y borrado.

### Cuentas (solo de prueba, con datos ficticios)

| Cuenta | Para qué | Estado antes de grabar |
|---|---|---|
| **D** · desechable | Nace en directo y se borra al final | No existe. Hace falta un buzón de pruebas abierto en el iPhone, en el que no se vea correo personal |
| **R** · restauración y social | Entrar con contraseña, restaurar la compra, denunciar y bloquear | Creada, con edad confirmada y onboarding hecho. Sin suscripción. Con un amigo de prueba en el ranking y una solicitud entrante de una tercera cuenta |
| **A** y **B** · amigas ficticias | Las personas denunciadas y bloqueadas | A es amiga de R. B ha enviado solicitud a R. Nombre y avatar ficticios |

**Nunca** usar la cuenta del revisor ni las cinco del ludus de demostración: `ANTES-DE-REENVIAR.md` prohíbe borrarlas y aquí no hacen falta. No denunciar a personas reales.

### Preparación

- Anotar modelo de iPhone, versión de iOS, versión y build de NIVL, y fecha. Comprobar que el iPhone tiene la última versión pública del sistema.
- Dejar NIVL instalada desde TestFlight, con la sesión cerrada, y cerrar la app.
- Iniciar sesión en Ajustes con la cuenta de **sandbox** de Apple. Comprobar antes, fuera de cámara, que la compra sandbox activa el acceso y que restaurar con otra cuenta lo mueve (`TRANSFER`, migración 0027). Si la compra se ha probado antes con ese Apple ID, limpiarla o usar otro: si no, la tienda dirá que ya está comprada.
- Mirar en `app_config` los interruptores `modos_1011` y `prueba_auto_1011`. Cambian el recorrido, y el guion marca dónde. Las notas para Apple dan los modos por encendidos.
- Activar No molestar, con las notificaciones silenciadas. Ocultar el autorrelleno de contraseñas. Quitar fotos y contactos personales visibles.
- Ensayar una vez entera. Las contraseñas de D y R tienen 10 caracteres o más, son solo de prueba y el campo las oculta: no pulsar el ojo «Mostrar contraseña».
- Empezar a grabar con la pantalla de inicio del iPhone a la vista.

### Recorrido

**1. Lanzamiento y registro (cuenta D).** Mostrar el icono y abrir NIVL. En la pantalla de acceso, pestaña «Crear cuenta». Rellenar Nombre, Correo, «Contraseña» y «Repite la contraseña». Marcar «He leído y acepto los Términos de NIVL y he leído su Política de privacidad.» Pulsar «Crear cuenta». Aparece «Revisa tu correo». Abrir el correo de pruebas **en este iPhone** y tocar el enlace: vuelve a NIVL con la sesión abierta. Si no entra sola, pestaña «Entrar» con la contraseña.

**2. Edad y onboarding.** «Tu edad»: marcar «Tengo 16 años o más.» y «Confirmar y continuar». Después, en este orden:

- «Entrar en la arena».
- «¿Nos dejas medir cómo usas NIVL?»: «Rechazar».
- «¿Cómo te llamas?» y «Continuar».
- «¿Para qué vas a usar NIVL?»: elegir uno y «Continuar».
- Si `modos_1011` está encendido, «Elige tus modos»: marcar IRON, FOCUS, WORK y FOUNDER.
- «¿A qué has venido?»: escribir un objetivo sin datos de salud, por ejemplo «Leer doce libros este año», y dejar apagado «Mi objetivo incluye salud o entrenamiento».
- «Tus primeras misiones»: «Crear N misiones».
- «Fírmalo contigo»: escribir el nombre y mantener pulsado el anillo. Tocar «Sellado» para continuar.
- «Firmado. Ahora, quién lo dirige.»: «Seguir gratis por ahora». No comprar aquí.

Si `prueba_auto_1011` está encendido, sale una bienvenida «Tienes N días de NIVL Élite». Pulsar «Empezar» y decirlo en voz alta: es una prueba sin pago ni renovación.

**3. Uso diario gratis.** En Hoy, tocar una misión y, en la hoja, «Completar». Enseñar XP y progreso. Pestaña «Campañas»: «Abrir una campaña nueva». Volver a Hoy, «Abrir la agenda» y crear un «Nuevo evento». Decir que hábitos y organización son gratis. Si los modos están activos, tocar el emblema central de la barra inferior, enseñar la rueda y entrar en IRON, FOCUS, WORK y FOUNDER unos segundos cada uno, y volver a NIVL con el emblema.

**4. Permiso de salud, separado.** Abrir el Gimnasio desde Hoy («Todo desde aquí» con la interfaz de modos; sin ella, cualquier registro de salud, como Diario o Nutrición). Sale «Tu salud, con permiso»: «Revisar permiso». Enseñar la casilla desmarcada y el botón «Aceptar y activar salud» apagado. Pulsar «Ahora no» y volver a Hoy para demostrar que lo general sigue funcionando. Tocar el avatar de Hoy para abrir Perfil, sección «Salud y bienestar», «Revisar permiso de salud». Marcar la casilla y «Aceptar y activar salud».

**5. Planes y compra (cuenta D).** Perfil, sección «Arena», fila «NIVL Pro». Enseñar los selectores «Pro» y «Élite». Cada plan disponible muestra nombre, duración y precio real en la moneda de la tienda: mensual, anual y fundador si sigue disponible. Enseñar el aviso «Sin contadores ni pagos extra por usar el coach» y, en Élite, que el ludus se solicita y se asigna a mano y puede requerir espera. Bajar a la letra de renovación y abrir «Términos de uso», «Política de privacidad» y «EULA de Apple», volviendo a la app cada vez.

Elegir **Élite mensual** y pulsar «Activar [plan] · [precio] al mes». Si la prueba de 7 días está disponible, ese botón es el pequeño, debajo de «Probar el coach 7 días» (o «Probar Pro 7 días» si se mira Élite).

Sale la hoja «Tus datos y la IA». Pulsar primero «Ahora no» y enseñar el aviso: «Para usar el coach hace falta aceptar el envío de tus datos al proveedor de IA. Sin ese permiso no se cobra nada.» Volver a pulsar el botón de compra y aceptar con «Acepto y activo el coach». Completar la hoja de compra sandbox de Apple.

Esperar a la pantalla «El coach está contigo.»: enseñar «Tu plan» y «Úsalo cuanto quieras: sin contadores ni pagos extra.» Pulsar «Hablar con el coach» y enviar: «Ayúdame a organizar mi día de mañana». Esperar la respuesta real.

**6. Datos (cuenta D).** Perfil, sección «Cuenta», «Exportar mis datos». Sale la hoja de compartir del sistema: enseñarla y cerrarla sin enviar nada. Sección «Datos y la IA», «Envío de datos al coach», y confirmar «Retirar». Sección «Salud y bienestar», «Retirar y borrar salud», y confirmar «Retirar y borrar».

**7. Acceso y restauración (cuenta R).** Sección «Cuenta», «Cerrar sesión». En la pantalla de acceso, pestaña «Entrar», con correo y contraseña de R. Enseñar de paso que existe «¿Olvidaste tu contraseña?». Perfil, fila «NIVL Pro». Pulsar «Restaurar compras» y esperar a que aparezca «El coach está contigo.»: es el acceso efectivo, no solo el botón.

**8. Contenido social (cuenta R).** Perfil, «Amigos y duelos». En «Ranking», tocar los tres puntos de A (o su fila). En la hoja, elegir un motivo (por ejemplo «Nombre o título ofensivo») y «Enviar denuncia». Enseñar «Denuncia registrada para revisión». Pulsar «Bloquear usuario» y confirmar «Bloquear». Comprobar que A desaparece del ranking. En «Solicitudes», enseñar que la solicitud de B tiene los mismos tres puntos. En «Convivencia y seguridad», enseñar «Desbloquear» y «Contactar con soporte».

Decir en voz alta que la denuncia entra en una cola de revisión y que no hay mensajería entre usuarios. No afirmar que un moderador la haya resuelto. Si no hay ludus en esta cuenta, no hablar de él.

**9. Borrado (cuenta D).** «Cerrar sesión» y «Entrar» con D. Perfil, bajar hasta la sección «Cuenta» (es un rótulo de sección, no una pantalla) y pulsar «Eliminar cuenta». En «Borrar para siempre», enseñar el aviso de que borrar no cancela la suscripción, que se cancela en los ajustes de Apple. Escribir ELIMINAR y pulsar «Eliminar para siempre». En «¿Estás totalmente seguro?», otra vez «Eliminar para siempre». Vuelve al acceso. Intentar entrar con D: debe salir «Correo o contraseña incorrectos.» Fin de la grabación.

## Qué no decir ni enseñar

- Nada de «Crear cuenta Franky», «cuenta antigua», «Entrar con cuenta NIVL» ni códigos de Franky: la cuenta es propia de NIVL, con correo y contraseña.
- Nada de energía, porcentajes ni contadores de IA para quien paga: la 0090 los retiró. La energía solo existe en la prueba gratuita y no hay que explicarla si no aparece. No prometer un número de mensajes.
- No mencionar recargas de IA: la decisión es cuota plana.
- No decir que el borrado conserva nada en Franky ni en otro sitio.
- No enseñar contraseñas, códigos de seguridad, correo personal, datos reales ni el panel de TestFlight.
- No usar la cuenta del revisor ni preaceptarle permisos.
- Sin consejo médico ni de inversión en el ejemplo del coach.

## Si algo falla

Corregirlo y **repetir la toma entera** en el build final. No ocultar el fallo con montaje. Se pueden proteger secretos sin sustituir la interfaz ni fingir acciones. Una toma fallida gasta las cuentas: preparar repuestos de D y volver a dejar R sin suscripción, con A sin bloquear.

## Evidencias que acompañan al vídeo

Registrar los resultados reales en `QA-FISICA.csv`. La toma única cubre buena parte de sus casos, pero no todos: restauración tras reinstalar y tras recrear cuenta, modo avión, permisos del sistema denegados, VoiceOver y cancelación sandbox se prueban aparte. Las comprobaciones de servidor del borrado (Auth, filas y archivos) se hacen sobre D, sin incluir sus datos en la respuesta a Apple.

Entregar un MP4 o MOV legible, o un enlace accesible al revisor sin pedir permisos. Verificar el acceso al enlace. Acompañarlo de modelo, sistema, build y fecha.

## Envío

Completar los campos pendientes de `RESPUESTA-APPLE.md`, contrastar sus rutas con la grabación y copiar la información también en Notas de revisión (`NOTAS-APPLE.txt`). Mantener las credenciales en los campos de acceso de App Store Connect. No reenviar mientras falten el vídeo físico, las pruebas de pago y borrado o una función descrita.
