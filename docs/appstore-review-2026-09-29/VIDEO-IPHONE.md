# Vídeo solicitado por App Review — NIVL

Apple pide expresamente una grabación de pantalla de un **dispositivo físico con el sistema operativo actualizado**, desde el lanzamiento y mostrando el recorrido normal. Un simulador, Expo Go, un vídeo generado o las capturas comerciales no satisfacen esa petición.

Estado: **grabación física pendiente**. Este guion no acredita que las pruebas se hayan realizado. Grabar la compilación final corregida que vaya a recibir Apple; no mezclar una versión local, una actualización distinta y el binario del envío.

## Preparación

- Instalar desde TestFlight la compilación final y anotar modelo de iPhone, versión de iOS, versión/build de NIVL y fecha. Comprobar que el dispositivo utiliza la última versión pública del sistema solicitada por Apple.
- Usar cuentas y datos de prueba. Mantener intacta la cuenta dedicada del revisor. El borrado se demuestra con una cuenta desechable diferente.
- Preparar un segundo usuario de prueba para enseñar solicitudes, denuncia y bloqueo. No denunciar a usuarios reales para la demostración.
- Probar antes la compra/restauración de suscripciones en el entorno sandbox de TestFlight y su activación efectiva en el servidor. Una pantalla de éxito simulada o un catálogo ficticio no sirven.
- Activar la grabación del iPhone y cerrar la app. Abrirla desde su icono al empezar el recorrido. Evitar notificaciones y datos personales ajenos.

## Recorrido de la grabación

1. **Lanzamiento, registro y acceso.** Mostrar el icono, abrir NIVL, pestaña «CREAR CUENTA», botón «Crear cuenta Franky», confirmación requerida, cierre de sesión y entrada de una cuenta de prueba. Mostrar también el acceso directo «¿Cuenta antigua de NIVL? Entrar con ella» que utilizará la cuenta facilitada a Apple. No incluir contraseñas personales ni códigos de seguridad.
2. **Onboarding y uso diario.** Declaración de edad, elección del perfil de uso y creación de una misión general. Entrar en Hoy, completar la misión y mostrar el progreso. Crear una campaña/proyecto y un evento de agenda. Explicar brevemente que hábitos y organización son gratuitos.
3. **Permisos separados.** Entrar en un módulo de salud; mostrar la casilla inicialmente desmarcada, «Ahora no» y continuidad de las funciones generales. Volver y aceptar expresamente con la cuenta de prueba. Para abrir de nuevo el permiso de salud, ir a Perfil → sección «Salud y bienestar» → «Revisar permiso de salud» y confirmar con «Aceptar y activar salud». Mostrar que el envío a proveedores de IA requiere otra aceptación con «Acepto y activo el coach». No preaceptar permisos de la cuenta revisora.
4. **Compras.** Perfil → fila «NIVL Pro», debajo de la cabecera del perfil. Mostrar los selectores «Pro» y «Élite»; cada plan disponible debe enseñar nombre, duración y precio real en la moneda de la tienda. Incluir mensual, anual y fundador si sigue disponible. Mostrar el aviso de energía mensual limitada y consumo variable según la extensión de cada petición, el límite mensual separado del modo profundo y la posible espera del ludus. Mostrar la renovación y abrir los enlaces «Términos» y «Privacidad». La pantalla no promete un número fijo de mensajes; no narrarlo como si existiera. Si hay trial activo, usar «Suscribirme» para volver a los planes. La prueba gratuita de siete días no cobra ni se renueva automáticamente.
5. **Compra y acceso de pago.** Completar una compra sandbox y mostrar que el acceso se activa en NIVL. Probar «Restaurar compras» y mostrar el acceso efectivo, no solo que aparece el botón. Abrir Coach y enviar un ejemplo no sensible: «Ayúdame a organizar mi día de mañana». Mostrar también las funciones de Élite con una cuenta de prueba autorizada si no quedan demostradas.
6. **Contenido social.** Entrar en Perfil → «Amigos» y localizar una solicitud o miembro de prueba. Tocar sus tres puntos (en un ranking también sirve tocar la fila), seleccionar un motivo y pulsar «Enviar denuncia». Mostrar la confirmación de registro. Pulsar «Bloquear usuario», confirmar «Bloquear» y comprobar que desaparece de las superficies correspondientes. En «Convivencia y seguridad», mostrar «Desbloquear» y «Contactar con soporte». Aclarar que la denuncia entra en una cola para revisión; no afirmar que un moderador ya la ha resuelto si todavía no ha ocurrido. Si se muestra un ludus, sus integrantes también deben disponer de esas protecciones. Aclarar que no hay mensajería entre usuarios.
7. **Datos y cuenta.** En Perfil, bajar hasta la sección «Cuenta» y abrir «Exportar mis datos». Mostrar también Perfil → «Datos y la IA» → «Envío de datos al coach» → «Retirar», y la opción separada «Salud y bienestar» → «Retirar y borrar salud». Con la **cuenta desechable**, volver a la sección «Cuenta», pulsar «Eliminar cuenta», luego «Eliminar para siempre» en la hoja y otra vez «Eliminar para siempre» en la alerta final, hasta volver al acceso. «Cuenta» es un rótulo de sección, no una pantalla que se abra. Verificar que el acceso directo «Entrar con cuenta NIVL» no acepta las credenciales de la cuenta NIVL eliminada y que los datos anteriores no reaparecen. El borrado de NIVL conserva la cuenta independiente de Franky; no confundir una nueva entrada que cree un perfil nuevo con la recuperación de los datos borrados. Recordar que una suscripción Apple se cancela en los ajustes de Apple.

Si una acción falla, corregirla y repetir el recorrido completo en el build final. No ocultar el fallo mediante montaje. Se pueden proteger secretos sin sustituir la interfaz ni fingir acciones.

## Evidencias que acompañan al vídeo

Registrar los resultados reales en `QA-FISICA.csv`: arranque en frío, registro/login, denegación de permisos, navegación, compra, activación, restauración tras reinstalar y tras recrear una cuenta, denuncia/bloqueo, borrado y confirmación de ausencia de archivos. Las comprobaciones de servidor de borrado deben realizarse sobre esa cuenta desechable, sin incluir sus datos en la respuesta a Apple.

Entregar un MP4/MOV legible o un enlace de vídeo accesible al revisor sin pedir permisos adicionales. Verificar el acceso al enlace. Incluir el modelo, sistema, build y fecha junto al vídeo. Si se utilizan varios vídeos, identificar los recorridos y la cuenta/build de cada uno; Apple debe poder seguir el flujo completo desde el lanzamiento.

## Envío

Completar los campos pendientes de `RESPUESTA-APPLE.md`, contrastar sus rutas con la grabación y copiar la información también en Notas de revisión. Mantener las credenciales en los campos de acceso de App Store Connect. No reenviar mientras falten el vídeo físico, las pruebas de pago/borrado o una función descrita.
