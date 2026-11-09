# Vídeo solicitado por App Review: NIVL 1.1.0

Apple pide una grabación de pantalla de un **dispositivo físico con el sistema operativo actualizado**, desde el lanzamiento y mostrando el recorrido normal. Un simulador, Expo Go, un vídeo generado o las capturas comerciales no satisfacen esa petición. Los vídeos de `scripts/tienda/` son material de la ficha y **no sirven aquí**.

Estado: **grabación física pendiente**. Instalar **NIVL 1.1.0 (build: [RELLENAR])** desde TestFlight. Este guion no acredita que las pruebas se hayan hecho. Grabar la compilación que se envía; no mezclar una versión local, una OTA distinta y el binario del envío.

Rótulos contrastados con el código de la 1.1.0 (`cc95408`). Si un texto en pantalla no coincide, manda la pantalla y se corrige este guion. Las pestañas de acceso, los rótulos pequeños de sección y el sello se pintan en mayúsculas; aquí van como están en el código. `[precio]`, `[modo]` y `N` son lo que ponga la pantalla: los importes los da siempre la tienda, en su moneda.

## Una sola toma

Todo sale en una grabación continua, sin cortes ni montaje. Calcular entre 15 y 20 minutos y medirlo en el ensayo: la entrada de la 1.1 es más larga. El orden está pensado para que los cambios de cuenta formen parte de lo que Apple pide ver: registro, acceso, restauración y borrado.

### Cuentas (solo de prueba, con datos ficticios)

| Cuenta | Para qué | Estado antes de grabar |
|---|---|---|
| **D** · desechable | Nace en directo y se borra al final | No existe. Hace falta un buzón de pruebas abierto en el iPhone, en el que no se vea correo personal |
| **R** · restauración y social | Entrar con contraseña, restaurar la compra, denunciar y bloquear | Creada, con edad confirmada y onboarding hecho. Sin suscripción. Con un amigo de prueba en el ranking y una solicitud entrante de una tercera cuenta. Haber entrado ya una vez en Hoy con la 1.1 para que no salgan avisos de primera vez |
| **A** y **B** · amigas ficticias | Las personas denunciadas y bloqueadas | A es amiga de R. B ha enviado solicitud a R. Nombre y avatar ficticios |

**Nunca** usar la cuenta del revisor ni las cinco del ludus de demostración: `ANTES-DE-REENVIAR.md` prohíbe borrarlas y aquí no hacen falta. No denunciar a personas reales.

### Preparación

- Anotar modelo de iPhone, versión de iOS, versión y build de NIVL, y fecha. Comprobar que el iPhone tiene la última versión pública del sistema.
- Comprobar que los productos de modo cargan precio en sandbox. Si la pantalla enseña una lista de solo lectura con «Las suscripciones no están disponibles en esta versión de la app.», ese binario no lleva la clave de RevenueCat y no se puede grabar la compra.
- Iniciar sesión en Ajustes con la cuenta de **sandbox** de Apple. Comprobar antes, fuera de cámara, que la compra sandbox abre los modos y que restaurar con otra cuenta los mueve (`TRANSFER`, migración 0027). Si la compra se ha probado antes con ese Apple ID, limpiarla o usar otro: si no, la tienda dirá que ya está comprada.
- Mirar en `app_config` estos interruptores, que cambian el recorrido:
  - `modos_1011` tiene que estar **encendido**: sin él no hay paso de modos, ni rueda, ni puerta de cada mundo. Las notas para Apple lo dan por encendido.
  - `prueba_auto_1011` tiene que estar **apagado** para esta toma. Encendido, D nace con prueba: no ve la oferta ni la puerta de los mundos, y `/pro` no le deja comprar porque ya tiene los cuatro modos.
  - `idiomas_1011` y `analitica_1011` añaden un paso cada uno. El guion marca dónde.
- Activar No molestar, con las notificaciones silenciadas. Ocultar el autorrelleno de contraseñas. Quitar fotos y contactos personales visibles.
- Ensayar una vez entera. Las contraseñas de D y R tienen 10 caracteres o más, son solo de prueba y el campo las oculta: no pulsar el ojo «Mostrar contraseña».
- **Después del ensayo, borrar NIVL del iPhone y reinstalarla desde TestFlight.** Las respuestas del cuestionario, la decisión de medición y el historial de ofertas se guardan en el teléfono, no en la cuenta. Sin reinstalar, la oferta completa del paso 2 baja a una línea discreta y no se ve.
- Dejar NIVL con la sesión cerrada y la app cerrada. Empezar a grabar con la pantalla de inicio del iPhone a la vista.

### Recorrido

**1. Lanzamiento, cuestionario y registro (cuenta D).** Mostrar el icono y abrir NIVL. Sale la portada: enseñar «Tu mejor versión ya tiene entrenador», el aviso de que NIVL no es un servicio médico y «Para mayores de 16 años.» Pulsar «Crear mi plan». Enseñar la barra «Tu perfil» y contestar sin datos reales. Las preguntas de una respuesta avanzan solas; las de varias piden «Continuar».

- «¿En qué quieres mejorar?»: «Disciplina y hábitos» y «Cuerpo y energía», y «Continuar». Marcar «Cuerpo y energía» es lo que hace aparecer luego el permiso de salud dentro de la entrada.
- «¿Qué te describe mejor?»: «Quiero mi mejor versión».
- «¿Qué quieres conseguir?»: «Leer y aprender más».
- «¿Cuánto llevas queriendo esto?»: «Unos meses».
- «¿Qué te ha frenado hasta ahora?»: «Empiezo y lo dejo», y «Continuar».
- «¿Has tenido alguna vez un coach o entrenador?»: «Nunca».
- «Voy a ser crudo contigo.»: leerla y, en «¿Cómo quieres que te hable?», pulsar «Directo, pero con tacto».
- «¿Cuánto tiempo puedes darle cada día?»: «30 minutos».
- «¿Cuándo rindes mejor?»: «Por la tarde».
- «Un 1 % al día no parece nada.»: enseñar la curva y «Ya lo veo».

Llega el registro, con «Tu plan está casi listo. Guárdalo.» y la pestaña «Crear cuenta» ya elegida. Rellenar «Correo» y «Contraseña»: el registro ya no pide nombre ni repetir la contraseña. Marcar «He leído y acepto los Términos de NIVL y he leído su Política de privacidad.» y pulsar «Crear cuenta». Aparece «Revisa tu correo». Abrir el correo de pruebas **en este iPhone** y tocar el enlace: vuelve a NIVL con la sesión abierta. Si no entra sola, pestaña «Entrar» con la contraseña. «Reenviar correo» está ahí por si no llega.

**2. Edad, medición y onboarding.** «Tu edad»: marcar «Tengo 16 años o más.» y «Confirmar y continuar». Después, en este orden:

- Si `idiomas_1011` está encendido, «¿En qué idioma hablamos?»: dejar español y «Continuar».
- «Un par de cosas y empezamos.»: enseñar el aviso y «Continuar».
- Si `analitica_1011` está encendido, «¿Nos dejas medir cómo usas NIVL?»: «Rechazar».
- «¿Cómo te llamas?»: escribir un nombre ficticio, dejar vacío «¿Quién te trajo? · opcional» y «Continuar».
- «Elige tus modos»: marcar IRON, FOCUS, WORK y FOUNDER, y «Continuar».
- «Tus datos de salud, solo con tu permiso.»: decir en voz alta que es opcional y pulsar «Seguir sin datos de salud». Sale solo porque se marcó «Cuerpo y energía».
- «Tus primeras misiones»: las que piden datos de salud salen desmarcadas; no tocarlas, porque abren el permiso. Pulsar «Crear N misiones».
- «Construyendo tu plan» y después «Tu plan de 90 días · perfil al 100 %»: enseñar «El veredicto» y «Quiero empezar».
- «Tu plan está listo. Elige cómo seguir.»: enseñar la oferta y pulsar «Seguir gratis por ahora». No comprar aquí.

Entra en Hoy. La firma ya no está en la entrada.

**3. Uso diario gratis y puerta de un modo.** En Hoy, en la tarjeta «Ahora», pulsar «Completar» y, en la hoja, otra vez «Completar». Enseñar XP y progreso. Sale la tarjeta «Firma tu compromiso», solo cuando ya se ha hecho algo: pulsar «Firmar». En «Fírmalo contigo», escribir el nombre en «Escribe tu nombre para firmar» y mantener pulsado el anillo. Tocar «Sellado» para volver a Hoy. Si sale «Que no se te pase», pulsar «Ahora no».

Pestaña «Campañas»: «Abrir campaña». Volver a Hoy, bajar a «Todo desde aquí», entrar en «Agenda» y crear un «Nuevo evento». Decir que hábitos y organización son gratis.

Tocar el emblema central de la barra inferior, enseñar la rueda y elegir IRON. Sale la puerta del modo: «Sigue cerrado.», qué abre, «Lo que registraste aquí sigue siendo tuyo. Nada se borra por no pagar.» y «NIVL y tus hábitos siguen gratis.», con la oferta debajo y «Solo IRON» elegido. No comprar aquí. Pulsar «Volver a NIVL».

**4. Permiso de salud, separado.** En Hoy, «Todo desde aquí», «Gimnasio». Sale «Tu salud, con permiso»: «Revisar permiso». Enseñar la casilla desmarcada y el botón «Aceptar y activar salud» apagado. Pulsar «Ahora no» y volver a Hoy para demostrar que lo general sigue funcionando. Tocar el avatar de Hoy para abrir Perfil, sección «Salud y bienestar», «Revisar permiso de salud». Marcar la casilla y «Aceptar y activar salud».

**5. Oferta por modos y compra (cuenta D).** Perfil, sección «Arena», fila «NIVL Pro», con «Activa el coach» a la derecha. Abre «Un modo o los cuatro.» Enseñar «Anual» y «Mensual», «Todos los modos» y, al tocarla, «Solo [modo]» con los cuatro modos para elegir. Cada opción muestra el importe real de la tienda. En «Anual», si la tienda declara prueba para esta cuenta, salen «Empieza gratis» y «Primer cobro», y el botón es «Empezar mis N días gratis».

Bajar a la letra de renovación y abrir «Términos», «Privacidad» y «EULA de Apple», volviendo a la app cada vez.

Elegir **«Mensual»** y **«Todos los modos»**, y pulsar «Suscribirme por [precio] al mes». Sale la hoja «Tus datos y la IA». Pulsar primero «Ahora no» y enseñar el aviso: «Para usar el coach hace falta aceptar el envío de tus datos al proveedor de IA. Sin ese permiso no se cobra nada.» Volver a pulsar el botón de compra y aceptar con «Acepto y activo el coach». Completar la hoja de compra sandbox de Apple.

Esperar a la pantalla «El coach está contigo.»: enseñar «Tu plan», «Modos» con «Los cuatro modos», y «Úsalo cuanto quieras: sin contadores ni pagos extra.» Si sale el aviso «Compra confirmada por la tienda. El modo se abre en unos segundos; si no aparece, pulsa Restaurar.», esperar y deslizar hacia abajo para actualizar. Pulsar «Hablar con el coach» y enviar: "Ayúdame a organizar mi día de mañana". Esperar la respuesta real.

Pestaña «Hoy», emblema central, y entrar en IRON, FOCUS, WORK y FOUNDER unos segundos cada uno: ya no sale «Sigue cerrado.» FOCUS puede abrir su arranque guiado; no hace falta rellenarlo. Volver a NIVL con el emblema.

**6. Datos (cuenta D).** Tocar el avatar de Hoy para abrir Perfil, sección «Cuenta», «Exportar mis datos». Sale la hoja de compartir del sistema: enseñarla y cerrarla sin enviar nada. Sección «Datos y la IA», «Envío de datos al coach», y confirmar «Retirar». Sección «Salud y bienestar», «Retirar y borrar salud», y confirmar «Retirar y borrar».

**7. Acceso y restauración (cuenta R).** Sección «Cuenta», «Cerrar sesión». Vuelve a la pantalla de acceso, pestaña «Entrar»: correo y contraseña de R. Enseñar de paso que existe «¿Olvidaste tu contraseña?». Avatar de Hoy, Perfil, fila «NIVL Pro». Sale «Un modo o los cuatro.» Pulsar «Restaurar» en la fila de enlaces y esperar a que aparezca «El coach está contigo.»: es el acceso efectivo, no solo el botón.

**8. Contenido social (cuenta R).** Perfil, «Amigos y duelos». En «Ranking», tocar los tres puntos de A (o su fila). En la hoja, elegir un motivo (por ejemplo «Nombre o título ofensivo») y «Enviar denuncia». Enseñar «Denuncia registrada para revisión.» Pulsar «Bloquear usuario» y confirmar «Bloquear». Comprobar que A desaparece del ranking. En «Solicitudes», enseñar que la solicitud de B tiene los mismos tres puntos. En «Convivencia y seguridad», enseñar «Desbloquear» y «Contactar con soporte».

Decir en voz alta que la denuncia entra en una cola de revisión y que no hay mensajería entre usuarios. No afirmar que un moderador la haya resuelto. Si no hay ludus en esta cuenta, no hablar de él.

**9. Borrado (cuenta D).** «Cerrar sesión» y, en la pestaña «Entrar», con D. Avatar de Hoy, Perfil, bajar hasta la sección «Cuenta» (es un rótulo de sección, no una pantalla) y pulsar «Eliminar cuenta». En «Borrar para siempre», enseñar el aviso de que borrar no cancela la suscripción, que se cancela en los ajustes de Apple. Escribir ELIMINAR y pulsar «Eliminar para siempre». En «¿Estás totalmente seguro?», otra vez «Eliminar para siempre». Vuelve al acceso. Intentar entrar con D: debe salir «Correo o contraseña incorrectos.» Fin de la grabación.

## Qué no decir ni enseñar

- Nada de cuentas ni códigos de Franky: la cuenta es propia de NIVL, con correo y contraseña.
- No vender Pro ni Élite: ya no están a la venta y el cobro es por modos. La fila «NIVL Pro» de Perfil y la cabecera de «El coach está contigo.» conservan ese nombre; no explicarlo como un plan.
- Nada de energía, porcentajes ni contadores de IA para quien paga: la 0090 los retiró. La energía solo existe en la prueba gratuita y no hay que explicarla si no aparece. No prometer un número de mensajes.
- No mencionar recargas de IA: la decisión es cuota plana.
- No citar importes de memoria: solo los que enseñe la tienda en pantalla.
- No decir que el borrado conserva nada en Franky ni en otro sitio.
- No enseñar contraseñas, códigos de seguridad, correo personal, datos reales ni el panel de TestFlight.
- No usar la cuenta del revisor ni preaceptarle permisos.
- Sin consejo médico ni de inversión en el ejemplo del coach.

## Si algo falla

Corregirlo y **repetir la toma entera** en el build final. No ocultar el fallo con montaje. Se pueden proteger secretos sin sustituir la interfaz ni fingir acciones. Una toma fallida gasta las cuentas y deja datos en el teléfono: preparar repuestos de D, reinstalar NIVL y volver a dejar R sin suscripción, con A sin bloquear.

## Evidencias que acompañan al vídeo

Registrar los resultados reales en `QA-FISICA.csv`. La toma única cubre buena parte de sus casos, pero no todos: restauración tras reinstalar y tras recrear cuenta, modo avión, permisos del sistema denegados, VoiceOver y cancelación sandbox se prueban aparte. Tampoco entra aquí la conexión de Apple Salud, GPS y reloj, que se activa aparte del permiso de salud. Las comprobaciones de servidor del borrado (Auth, filas y archivos) se hacen sobre D, sin incluir sus datos en la respuesta a Apple.

Entregar un MP4 o MOV legible, o un enlace accesible al revisor sin pedir permisos. Verificar el acceso al enlace. Acompañarlo de modelo, sistema, build y fecha.

## Envío

Completar los campos pendientes de `RESPUESTA-APPLE.md`, contrastar sus rutas con la grabación y copiar la información también en Notas de revisión (`NOTAS-APPLE.txt`). `NOTAS-APPLE.txt` sigue escrito para la 1.0.11 y hay que ponerlo al día antes de enviar. Mantener las credenciales en los campos de acceso de App Store Connect. No reenviar mientras falten el vídeo físico, las pruebas de pago y borrado o una función descrita.
