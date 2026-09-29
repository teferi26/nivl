# NIVL: revisión del rechazo de Apple

Fecha: 29 de septiembre de 2026. Aplicación 6801825007, versión rechazada 1.0.7 (18). Fuente revisada: rama feat/tienda, base 112109db750cd77f3fa30348d440c89d3ac60cfc, con las correcciones locales de esta carpeta de trabajo.

## Qué ha pedido Apple realmente

El mensaje recibido cita **2.1 — Information Needed — New App Submission**: Apple pide conocer mejor una aplicación presentada por una cuenta con poco historial. No afirma que se haya producido un fallo concreto ni rechaza explícitamente suscripciones, capturas o modelo de negocio. Los apartados «Prevent Common Issues» son advertencias generales que también se han contrastado.

Para resolverlo hacen falta los siete puntos tanto en la respuesta de App Store Connect como en sus notas: vídeo físico, finalidad/público, acceso/instrucciones, servicios externos, regiones, derechos/actividad regulada y compras. Un vídeo de simulador o una demostración con servidor simulado no sustituye la grabación física solicitada. Ninguna auditoría garantiza una futura aprobación.

## Hallazgos y estado

| Riesgo | Medida preparada | Estado que se puede acreditar |
|---|---|---|
| Borrado eliminaba metadatos de fotos sin garantizar borrar sus archivos | La nueva función borra archivos mediante Storage, comprueba que no quedan y después elimina la cuenta; bloquea nuevas escrituras mientras termina y permite reintentar | Código local y pruebas; pendiente desplegar 0031 y account-erasure con el cliente nuevo |
| Perfiles con contenido público sin denuncia/bloqueo suficientes | Denuncia, bloqueo bilateral, soporte, revisión previa de alias/título/foto, rutas de foto inmutables y control de acceso | Código local y 11 escenarios SQL/RLS; pendiente desplegar 0032 y operar la cola humana |
| Precios de referencia podían aparecer antes de obtener el precio real | Solo planes con precio de StoreKit; estados de carga/error/reintento; nueva confirmación si cambia el precio | Código local y pruebas de la pantalla y compra |
| Oferta Élite podía sugerir disponibilidad inmediata de ludus o uso ilimitado | Límites mensuales y espera de asignación visibles antes de comprar | Código local; comprobar legibilidad en iPhone |
| Restaurar tras borrar la cuenta puede quedarse sin acceso | Reconciliación con el estado verificado por RevenueCat, conservando la contabilidad existente | Integración autorizada expresamente por el propietario y terminada; 11 pruebas Deno, 45 comprobaciones SQL y revisión independiente; pendiente despliegue y StoreKit real |
| Respuestas de IA sobre situaciones delicadas | Reglas comunes para coach/Oráculo sobre salud, crisis y límites financieros | Código local; no equivale a validar cada posible respuesta del modelo |
| Notas anteriores no cubrían los siete puntos del nuevo requerimiento | Respuesta completa y notas breves preparadas, sin credenciales públicas | Borradores; requieren vídeo, compilación final y retirar campos pendientes |
| Política web no indicaba claramente la retirada de salud ni los nuevos controles sociales | Actualizados los apartados de retirada de salud, derechos y moderación | Pendiente publicar la web; se comprobó que el resto de archivos modificados ya coincide con la web publicada |

## Cobertura de las directrices

Se revisaron las cinco familias de las [App Review Guidelines vigentes](https://developer.apple.com/app-store/review/guidelines/). «No aplicable» se refiere a las funciones observadas, no a una exención permanente.

| Familia y apartados relevantes | Contraste con NIVL | Pendiente antes del reenvío |
|---|---|---|
| 1.1/1.2 Contenido y UGC | No hay chat público; alias, títulos y fotos sí son UGC. Nuevos controles de denuncia, bloqueo y revisión previa | Desplegar, probar con dos cuentas y designar responsable que atienda denuncias y soporte |
| 1.3 Niños | Ficha orientada a 16+ y declaración de edad; no categoría Kids | Comprobar cuestionario de edad vigente y que coincide con funciones de bienestar/IA/UGC |
| 1.4 Daño físico/salud | Registro de ejercicio/nutrición y coach; avisos y nuevas reglas de seguridad; sin HealthKit | Prueba real de respuestas y de límites; no presentar el producto como diagnóstico/tratamiento |
| 1.5/1.6 Contacto/seguridad | Soporte y política responden HTTP 200; controles de datos y permisos revisados | Confirmar atención humana del contacto y políticas contractuales de proveedores |
| 2.1 Compleción/acceso | Cuenta dedicada comprobada con acceso correcto; credenciales coinciden con App Store Connect | Probar binario real, IA y StoreKit; vídeo y acceso a Élite/ludus sin depender de un trial agotable |
| 2.2/2.3 Beta y metadatos | Publicación final de consumo; capturas anteriores de interfaz real, no solo splash | Contrastar capturas con la versión final; descripción sin funciones prometidas y suscripciones incluidas |
| 2.4/2.5 Hardware, APIs y plataforma | iPhone, Expo SDK 54/RN 0.81, permisos de cámara/fotos específicos, notificaciones opcionales | Inicio en frío, red lenta/sin red, permisos denegados, segundo plano, texto grande; revisar SDK/manifiestos en binario firmado |
| 3.1.1 Compras/restauración | Cinco suscripciones nativas; no checkout Stripe ni claves de IA personales en el flujo iOS | Integrar/restaurar con cuentas nuevas y existentes; compra, cancelación, renovación, reembolso y pérdida de conexión en sandbox |
| 3.1.2 Suscripciones | Título, duración, precio de tienda, renovación, privacidad y términos; fundador es anual, no vitalicio | Comprobar los cinco productos y grupo en el envío, capturas de revisión y precios efectivos |
| 3.1.3/3.2 Otros modelos | Aplicación pública para consumidores; no exclusiva de empresas o empleados | Sin necesidad detectada de distribución empresarial. Verificar contratos/pagos/impuestos de la cuenta de Apple |
| 4.1/4.2/4.3 Diseño, utilidad y duplicados | Funciones propias de hábitos, agenda, proyectos, registros y juego; marca arena | Comprobar identidad/recursos finales y que ningún flujo es un marcador vacío |
| 4.4/4.7 Extensiones, miniapps | No observadas | No aplicable a la versión examinada |
| 4.5 Notificaciones y servicios Apple | Notificaciones opcionales, sin obligación para usar la app | Probar denegación y enlaces profundos desde inicio cerrado |
| 4.8 Inicio de sesión | Correo/contraseña del servicio propio, sin Google/Facebook observados | Confirmar registro y recuperación reales; mantener instrucciones claras para la cuenta NIVL de revisión |
| 5.1.1/5.1.2 Privacidad, borrado y terceros IA | Salud e IA tienen permisos separados; exportación/retirada; borrado corregido; proveedores divulgados | Contrastar etiquetas App Privacy con TODOS los datos reales y SDK, publicar política y validar condiciones de retención/transferencia de proveedores |
| 5.1.3 Salud | Datos físicos/diario pueden ser sensibles aunque no haya HealthKit | Probar rechazo y retirada de consentimiento; comprobar minimización y tratamiento contratado |
| 5.2 Propiedad intelectual | Generador propio de icono, fuentes/recursos con licencias, sin catálogo audiovisual protegido | Guardar licencias y justificación de derechos; no afirmar certificaciones inexistentes |
| 5.3/5.4 Juego con dinero/VPN y servicios específicos | XP sin canje por dinero, sin apuestas, VPN, criptomonedas ni transacciones bancarias | No aplicable a las funciones observadas |

## Evidencia y sus límites

- Verificación final tras integrar restauración: tipos y ESLint correctos, 29 suites/392 pruebas Jest aprobadas y exportación iOS completada (1.523 módulos). Las pruebas automatizadas no sustituyen StoreKit real ni un iPhone.
- Funciones de servidor: comprobación Deno de coach, oracle, ritual y account-erasure correcta; 7 pruebas del borrado de archivos aprobadas.
- Base de datos local: escenarios de borrado y seguridad social ejecutan migraciones reales con sustitutos de Auth/Storage. Los 11 escenarios sociales incluyen 0031; 10 escenarios de borrado/reconciliación se verificaron con todas las migraciones hasta 0033 y filas de las tablas nuevas. No equivalen a borrar una cuenta real con archivos en Storage.
- Acceso remoto comprobado el 29/09: cuenta de revisión autenticable, sin consentimientos fabricados, trial disponible; páginas de privacidad/términos/soporte accesibles. Las evidencias privadas y credenciales están fuera del repositorio público.
- La versión rechazada y las suscripciones se encontraron asociadas a una revisión con asuntos pendientes. El mensaje original procede del texto aportado por el propietario. No se ha enviado ninguna respuesta ni se ha afirmado disponer de un vídeo inexistente.
- La prueba anterior en simulador con servidor simulado no acredita compras, borrado real, permisos físicos ni conectividad de la versión nueva.

## Condiciones para cerrar el trabajo

1. Autorización explícita de restauración recibida el 29/09/2026; código integrado y revisado. Conservar las pruebas y verificar el comportamiento desplegado.
2. Desplegar las migraciones y funciones revisadas solo en NIVL; comprobar archivos/borrado con una cuenta desechable creada para QA. No borrar la cuenta de revisión ni ninguna cuenta de Franky.
3. Generar una compilación TestFlight que incluya todos los cambios y verificar su versión/SDK. La compilación 18 no contiene estas correcciones.
4. Hacer el recorrido de [VIDEO-IPHONE.md](VIDEO-IPHONE.md) y completar [QA-FISICA.csv](QA-FISICA.csv) en iPhone actualizado. Comprobar cuenta/grupo Élite para revisión, moderación y territorios compatibles con los proveedores.
5. Contrastar etiquetas de privacidad y política publicada, capturas y cinco suscripciones. No marcarlo hecho únicamente por tener código.
6. Rellenar [RESPUESTA-APPLE.md](RESPUESTA-APPLE.md) y [NOTAS-APPLE.txt](NOTAS-APPLE.txt) con hechos y enlace/adjunto reales, sin marcadores. Obtener autorización de envío y usar el mismo contenido sustantivo en ambos campos de Apple.

Fuentes adicionales: [responder a App Review](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/reply-to-app-review-messages/), [borrado de cuentas](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [etiquetas de privacidad](https://developer.apple.com/app-store/app-privacy-details/), [requisitos de SDK de terceros](https://developer.apple.com/support/third-party-SDK-requirements/), [borrado de archivos de Supabase](https://supabase.com/docs/guides/storage/management/delete-objects).
