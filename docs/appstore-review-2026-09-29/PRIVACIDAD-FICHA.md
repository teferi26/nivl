# Contraste pendiente de «Privacidad de la app»

La URL de privacidad responde y el texto publicado coincide con las correcciones. Eso no demuestra que las etiquetas de App Store Connect sean correctas: la API consultada no permitió leer sus respuestas. No se ha marcado esta comprobación como realizada.

Abrir NIVL → Privacidad de la app y comparar las respuestas guardadas con esta matriz del código. Los registros de cuenta se vinculan al UUID del usuario. El consentimiento opcional no convierte en anónimos esos datos ni elimina por sí solo su declaración.

| Datos presentes en NIVL | Categorías que contrastar en la ficha | Uso observado |
|---|---|---|
| Alias/nombre, correo, UUID de cuenta | Información de contacto e identificadores de usuario | Acceso y funciones de cuenta |
| Peso, ficha física, lesiones, nutrición y ejercicio | Salud y actividad física | Registros, progreso y coach si se autoriza |
| Ingresos, gastos, presupuestos y cuentas registradas por el usuario | Otra información financiera; revisar también información de pago si se guardan números de cuenta | Organización financiera y coach autorizado |
| Diario, misiones, proyectos, agenda y conversaciones | Contenido del usuario y, según su contenido, datos sensibles | Organización y personalización de las respuestas |
| Retratos y fotos adjuntas/de evidencia | Fotos o vídeos | Perfil, evidencias y análisis de adjuntos autorizado |
| Amistades y miembros del ludus | Contactos/grafo social y contenido de juego según las opciones del formulario | Funciones sociales, marcadores y moderación |
| Denuncias y solicitudes de soporte | Atención al cliente y contenido del usuario | Seguridad, investigación y soporte |
| Productos comprados y estado de suscripción | Historial de compras e identificadores | Desbloqueo, restauración y validación de suscripciones |
| Token push, identificadores de instalación y solicitudes de actualización | Identificadores de dispositivo, datos de uso/diagnóstico según la configuración efectiva de Expo | Notificaciones, distribución de actualizaciones y mantenimiento |

No seleccionar «Datos no recopilados»: existen datos de cuenta y registros en Supabase. La lista de finalidades debe incluir el funcionamiento de la app y, donde corresponda, personalización. Las estadísticas/diagnósticos que efectivamente recopilen SDK y proveedores también cuentan; revisar su vinculación concreta, no presumir anonimato por mostrar resultados agregados.

El código revisado no incorpora anuncios ni solicita IDFA, y no se encontró una llamada a recopilar identificadores publicitarios de RevenueCat. No basta eso para declarar «sin seguimiento» si posteriormente se activan integraciones publicitarias, exportaciones o uso de terceros para ese fin. Contrastar la configuración real y los contratos de proveedores.

Apple gestiona la hoja de pago. No atribuir a NIVL números de tarjeta a los que no tiene acceso. Distinguirlos de datos financieros que el usuario introduce en Economía y del historial de suscripciones. No declarar micrófono, ubicación precisa o libreta telefónica solo porque existan categorías con nombres parecidos: no se observaron esas funciones.

Fuentes: [definiciones de Apple](https://developer.apple.com/app-store/app-privacy-details/) y [guía de RevenueCat para la ficha de Apple](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy). Esta matriz es una propuesta de contraste basada en las funciones observadas, no una certificación de cumplimiento ni una lectura de las respuestas actuales.

Guardar evidencia de las respuestas finales y comprobarla antes de reenviar. Revisar además los manifiestos de privacidad del binario firmado y cualquier aviso que muestre App Store Connect al procesarlo.
