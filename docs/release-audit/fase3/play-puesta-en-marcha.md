# Google Play: puesta en marcha y prueba cerrada (lista para cuando haya cuenta)

Preparado por NIVL - Tiendas el 04/10/2026. **Nada se ha hecho en Play Console:** no hay cuenta todavía. Este documento ordena lo que hay que rellenar el día que la haya, con las respuestas ya preparadas. Base: `play-checklist.md` (fase 1, rama `winter/chat1-tiendas`) y la ficha de `ficha-108.md`.

Requisito de la cuenta personal reciente: **12 testers con alta continua durante 14 días** en una prueba cerrada antes de pedir producción ([Play Console Help 14151465](https://support.google.com/googleplay/android-developer/answer/14151465), consultado el 02/10/2026).

## 0. Antes de compilar el primer AAB (coordinador)

| Punto | Estado |
|---|---|
| Cuenta de Play Console (personal) y pago de alta | Usuario |
| `EXPO_PUBLIC_RC_ANDROID_KEY` en EAS (clave Android de RevenueCat; no vale la de iOS) | Usuario + coordinador |
| 5 suscripciones en Play con IDs exactos `nivl_pro_mensual`, `nivl_pro_anual`, `nivl_elite_mensual`, `nivl_elite_anual`, `nivl_elite_fundador`, un plan base cada una, importadas en RevenueCat | Usuario + Compras |
| `SCHEDULE_EXACT_ALARM`: quitarlo o justificarlo (Play lo restringe a alarmas y calendario) | Coordinador |
| Texto único de micrófono que cubra dictado y vídeo de evidencia | Coordinador |
| FCM (push remoto en Android): decidir si entra o si el lanzamiento va sin push remoto | Coordinador + usuario |
| Huella SHA-256 de Play App Signing → `assetlinks.json` de nivl.app | Coordinador (desde EAS/Play) + Experiencia (web) |
| Denuncia de respuestas de IA dentro de la app | HECHO en 1.0.8 («Denunciar respuesta») |
| URL web de borrado de cuenta | HECHO: https://nivl.app/borrar-cuenta |

## 1. Crear la app en Play Console

- **Nombre:** NIVL: Hábitos y Disciplina · **Idioma por defecto:** español (España) · **App o juego:** app · **Gratuita o de pago:** gratuita (con compras dentro de la app).
- **Package:** `com.teferi.nivl` (fijo para siempre tras la primera subida).

## 2. Contenido de la app (Policy > App content): respuestas preparadas

| Formulario | Respuesta | Motivo |
|---|---|---|
| Política de privacidad | https://nivl.app/privacidad | — |
| Anuncios | **No contiene anuncios** | No hay SDK publicitario y AD_ID está bloqueado |
| Acceso a la app | **Parte de la funcionalidad está restringida**. Instrucciones: «Pestaña ENTRAR > correo y contraseña > ENTRAR. Cuenta gratuita para probar la compra (tester de licencias); cuenta con Pro concedido por el servidor para ver el coach; no compres con ella.» Credenciales: solo en la consola | Cuentas de revisión distintas de las de Apple, con el mismo criterio: nada aceptado en su nombre |
| Clasificación de contenido (IARC) | Categoría: **utilidad o productividad**. Violencia: no. Sexo: no. Lenguaje: no. Drogas: no. **Interacción entre usuarios: sí** (amigos, ligas y duelos; sin chat). **Comparte información personal con otros usuarios: sí** (alias y retrato aprobados, ranking). Compras digitales: sí. Ubicación: no | Lo que hay en el código de la 1.0.8 |
| Público objetivo | **16-17 y 18+** (sin menores de 13; no aplica Familias). Contenido que no atrae a niños | La app exige 16+ y las fotos de progreso, 18+ |
| Apps de noticias | No | — |
| Apps del Gobierno | No | — |
| Funciones financieras | **Ninguna de las enumeradas** (NIVL registra gastos que escribe el usuario; no da préstamos, no mueve dinero ni gestiona inversiones) | Confirmar con la lista vigente del formulario el día de rellenarlo |
| Apps de salud | Declarar **seguimiento de actividad física y nutrición, y bienestar**. Sin Health Connect en esta versión. Sin diagnóstico ni funciones médicas | Si en la 1.0.9 entra Health Connect, hay que añadir la declaración de permisos de salud |
| Seguridad de los datos | La de `declaraciones-privacidad-finales.md` §2 (rama `winter/chat1-tiendas`), con la URL de borrado ya resuelta y FCM según la decisión de arriba | — |
| Permisos sensibles | `SCHEDULE_EXACT_ALARM` si se mantiene; cámara y micrófono no necesitan declaración propia | — |

## 3. Ficha de Play

Título, descripción breve y descripción completa: `ficha-108.md`, sección Google Play. Gráficos: icono de 512, gráfico destacado de 1024 × 500 y entre 2 y 8 capturas de teléfono. Falta producirlos para Android (propuesta: el mismo flujo de Maestro en un emulador de Android dentro del workflow de capturas, cuando haya build de Android).

## 4. Prueba interna (antes de la cerrada)

1. Subir **a mano** el primer AAB (`eas build -p android --profile production`) a **Prueba interna**. Así se activa Play App Signing y se obtiene la huella para assetlinks.
2. Añadir el correo del usuario como tester interno y de licencias.
3. Instalar en un Android físico: arranque, login, compra con la cuenta de tester de licencias, restaurar, denuncia y bloqueo, y borrado de cuenta (casos de Juego y QA).

## 5. Prueba cerrada 12 × 14

1. Crear la pista **Prueba cerrada** con una lista de correos (o un Grupo de Google) y promover la misma build.
2. **Reclutar 15 testers** (margen sobre 12), con Android propio. Mensaje propuesto para enviárselo el usuario (sin datos de nadie en el repo):

   > Estoy probando NIVL, mi app de hábitos, antes de publicarla en Google Play. ¿Me ayudas? Solo tienes que entrar en este enlace con tu cuenta de Google, aceptar la prueba e instalar la app: [ENLACE DE INSCRIPCIÓN]. Úsala unos minutos al día durante dos semanas: completa una misión, prueba el coach (tiene 7 días gratis) y dime qué falla. No te borres de la prueba antes de 14 días, porque Google solo cuenta a quien sigue dentro todo ese tiempo.

3. Llevar un registro **privado** (fuera de git) con la fecha de alta de cada tester. El día 14 se comprueba que hay al menos 12 dentro desde el principio.
4. Durante los 14 días: recoger opiniones (un formulario sencillo) y corregir. Las actualizaciones no reinician el contador; una baja sí resta.
5. Día 14 o después: **Panel > Solicitar acceso a producción**. Respuestas basadas en hechos: cómo se reclutó, cuánto se usó, qué opiniones llegaron y qué se cambió. Revisión de unos 7 días.
6. Producción: lanzamiento por fases en los 165 territorios de iOS, salvo motivo documentado.

**Calendario mínimo:** día 0 la prueba cerrada → día 14 el requisito → hacia el día 21, producción si Google no tarda más.
