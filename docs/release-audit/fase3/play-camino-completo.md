# Google Play para NIVL: cuenta, ficha y 12 testers (para Teferi)

Preparado por NIVL - Tiendas el 06/10/2026, por encargo de COACH. **No se ha hecho nada en Google Play**: esto es lo que hay que hacer, en orden. La build 24 que está en revisión en Apple no se toca.

**Por qué empezar ya:** una cuenta personal nueva necesita **12 testers dentro de una prueba cerrada durante 14 días seguidos** antes de poder publicar. Después, Google revisa la solicitud de acceso a producción (según Google, normalmente 7 días o menos). Desde que se abre la prueba hasta que se publica hay, como mínimo, **unas 3 semanas**.

Fuentes oficiales consultadas el 06/10/2026:
- [Registrarse en Play Console](https://support.google.com/googleplay/android-developer/answer/6112435).
- [Verificación de la identidad del desarrollador](https://support.google.com/googleplay/android-developer/answer/10841920).
- [Requisitos de prueba para cuentas personales nuevas](https://support.google.com/googleplay/android-developer/answer/14151465).

Lo que no esté en esas páginas va marcado como **NO PROBADO**.

## 1. Crear la cuenta de desarrollador (lo hace Teferi)

**Cuánto cuesta:** **25 USD, un único pago** con tarjeta. No hay cuota anual.

**Qué hace falta tener a mano:**
- **Una cuenta de Google.** Mejor una nueva solo para NIVL que tu Gmail personal: así no se mezcla nada y se puede pasar a otra persona si algún día hace falta.
- **DNI o pasaporte** en vigor, a tu nombre legal.
- **Tarjeta a tu nombre legal**, la del pago. El nombre tiene que coincidir con el del documento.
- **Teléfono y correo de contacto.** Se verifican con un código.
- **Tu dirección.** Sale del perfil de pagos de Google.
- **Un móvil Android físico.** Google pide demostrar que tienes acceso a uno con la app **Google Play Console** antes de poder publicar. Si no tienes, uno prestado sirve para ese paso.

**Pasos:**
1. **Entrar** en https://play.google.com/console/signup con la cuenta de Google elegida.
2. **Elegir «Personal»** como tipo de cuenta (eres tú, como persona física). La de organización pide una empresa y un número D-U-N-S, y no tiene la prueba obligatoria de 12 testers. Para NIVL, hoy, personal: es lo que se decidió el 02/10.
3. **Poner el nombre de desarrollador** que verá la gente. Propuesta: «NIVL».
4. **Pagar** los 25 USD.
5. **Verificar la identidad:** subir el DNI o el pasaporte.
6. **Verificar el correo y el teléfono** con los códigos que llegan.
7. **Verificar el dispositivo:** instalar **Google Play Console** en el Android y entrar con la misma cuenta.

**Tiempo:** el alta y el pago son minutos. **NO PROBADO:** cuánto tarda la verificación de identidad. Google no da un plazo; suele ir de horas a unos días. Hasta que esté verificada no se puede publicar nada.

**Ojo con la privacidad.** Como NIVL vende suscripciones, Google enseñará en la ficha datos de contacto del desarrollador. En la UE, por la Ley de Servicios Digitales, eso incluye **dirección y teléfono**. Antes de rellenarlo, decide si pones los tuyos o unos solo para NIVL (por ejemplo, un apartado de correos y un número aparte). Es la misma decisión que sigue pendiente en Apple con el estado de comerciante.

## 2. Lo que prepara el coordinador antes de abrir la prueba

El detalle está en `play-puesta-en-marcha.md` §0. Lo crítico:
- **Las 5 suscripciones en Play**, con los mismos IDs que en Apple (`nivl_pro_mensual`, `nivl_pro_anual`, `nivl_elite_mensual`, `nivl_elite_anual` y `nivl_elite_fundador`), enlazadas en RevenueCat, y la **clave Android** de RevenueCat en EAS.
- **El primer AAB subido a mano** a prueba interna. Activa la firma de Play y da la huella que necesitan los enlaces de `nivl.app`.
- **Decidir si las notificaciones push van en Android** (Firebase).

## 3. Ficha de Play

### Español (idioma principal)

**Título** (26/30): `NIVL: Hábitos y Disciplina`

**Descripción breve** (80/80): `Hábitos en misiones diarias: sube de nivel, reta a tus amigos y usa un coach IA.`

**Descripción completa** (2552/4000). Es la de `ficha-108.md`:

```
NIVL convierte tus hábitos en misiones diarias. Cumples, subes de nivel y avanzas de rango. Fallas, y el sistema te lo dice sin rodeos.

TU DÍA, EN MISIONES
Crea hábitos y misiones, organiza campañas para tus objetivos largos y planifica la agenda. Cada mañana sabes qué toca hoy. Cada noche el sistema cierra el día y cuenta tu racha.

PROGRESO QUE SE NOTA
Gana XP, sube de nivel y asciende de rango, de E a S, con su título y su marco en el avatar. Cada ascenso tiene su ceremonia, y puedes saltarla con un toque.

GIMNASIO, CARDIO, NUTRICIÓN Y DIARIO
Registra entrenamientos, cardio, comidas, peso y tu diario. Al registrar, la misión enlazada se marca sola.

FOTOS DE PROGRESO
Guarda fotos de frente, de lado y de espalda y compáralas a 30, 90 o 180 días. Son privadas, solo para mayores de 18 años y piden tu permiso de datos de salud.

AMIGOS Y DUELOS
Reta a tus amigos en duelos semanales que miden la constancia, no quién paga más. Puedes denunciar y bloquear a cualquier usuario.

COMPARTE TU AVANCE
Crea tarjetas de tu nivel, tu rango, tu semana o tu antes y después en formato historia o publicación. Tú eliges qué se ve: las fotos y el peso van apagados por defecto.

COACH DE IA (NIVL PRO Y ÉLITE)
Un coach que consulta tus datos antes de responder, te ayuda a planificar el día y te escribe de vez en cuando, con un tope. Puedes hablarle y escuchar sus respuestas en español. Antes de usarlo te pide permiso para enviar tus datos a los proveedores de IA, y puedes retirarlo cuando quieras. La energía del coach es mensual.

NIVL Pro: coach de IA estándar. NIVL Élite: modelo de mayor capacidad, modo profundo, revisión semanal ampliada, insignia de laurel y la opción de solicitar plaza en un ludus, un grupo privado de entre 5 y 8 miembros Élite. Los grupos se forman de manera gradual; la solicitud no garantiza una plaza inmediata. Las cuentas que nunca han tenido coach pueden probarlo 7 días sin datos de pago ni renovación automática.

DISEÑO EN BLANCO Y NEGRO
Pensado para leerse de un vistazo.

NIVL es para personas de 16 años o más. Puedes exportar tus datos y eliminar tu cuenta desde Perfil.

SUSCRIPCIONES
Las suscripciones se cobran a tu cuenta de Google Play y se renuevan automáticamente salvo que las canceles antes de que termine el periodo. Puedes gestionarlas en Play Store > Pagos y suscripciones > Suscripciones. Borrar tu cuenta de NIVL no cancela una suscripción de Google Play.

Condiciones de uso: https://nivl.app/terminos
Privacidad: https://nivl.app/privacidad
Borrar tu cuenta: https://nivl.app/borrar-cuenta
```

### English (ficha traducida; la app sigue en español)

Google permite traducir la ficha. Como **la app solo está en español**, la ficha en inglés lo dice en la segunda línea para no engañar a nadie.

**Title** (27/30): `NIVL: Habits and Discipline`

**Short description** (76/80): `Turn habits into daily missions, level up, duel friends and add an AI coach.`

**Full description** (2527/4000):

```
NIVL turns your habits into daily missions. Show up and you level up and climb the ranks. Miss a day and the system tells you straight.

The app is in Spanish.

YOUR DAY, AS MISSIONS
Create habits and missions, organise campaigns for long-term goals and plan your calendar. Every morning you know what today asks of you. Every night the system closes the day and counts your streak.

PROGRESS YOU CAN SEE
Earn XP, level up and rise from rank E to S, each with its own title and avatar frame. Every promotion has its ceremony, and you can skip it with one tap.

GYM, CARDIO, NUTRITION AND JOURNAL
Log workouts, cardio, meals, weight and your journal. When you log, the linked mission is completed automatically.

PROGRESS PHOTOS
Save front, side and back photos and compare them at 30, 90 or 180 days. They are private, for users aged 18 and over, and ask for your health-data permission.

FRIENDS AND DUELS
Challenge your friends to weekly duels that measure consistency, not who pays more. You can report and block any user.

SHARE YOUR PROGRESS
Create cards of your level, your rank, your week or your before and after, in story or post format. You choose what is shown: photos and weight are off by default.

AI COACH (NIVL PRO AND ÉLITE)
A coach that checks your data before answering, helps you plan your day and checks in now and then, with a limit. You can talk to it and listen to its replies in Spanish. Before you use it, it asks your permission to send your data to the AI providers, and you can withdraw it at any time. The coach's energy is monthly.

NIVL Pro: standard AI coach. NIVL Élite: higher-capacity model, deep mode, extended weekly review, laurel badge and the option to request a place in a ludus, a private group of 5 to 8 Élite members. Groups are formed gradually; a request does not guarantee an immediate place. Accounts that have never had the coach can try it for 7 days with no payment details and no automatic renewal.

BLACK AND WHITE DESIGN
Built to be read at a glance.

NIVL is for people aged 16 and over. You can export your data and delete your account from Perfil.

SUBSCRIPTIONS
Subscriptions are charged to your Google Play account and renew automatically unless you cancel before the end of the period. You can manage them in Play Store > Payments and subscriptions > Subscriptions. Deleting your NIVL account does not cancel a Google Play subscription.

Terms of use: https://nivl.app/terminos
Privacy: https://nivl.app/privacidad
Delete your account: https://nivl.app/borrar-cuenta
```

### Gráficos (todavía no existen)

| Recurso | Medida | De dónde sale |
|---|---|---|
| Icono | 512 × 512, PNG | El de la app (`assets/images/icon.png`), reducido |
| Gráfico destacado | 1024 × 500 | Nuevo: fondo negro, la marca NIVL en Cinzel y el lema «Un 1 % mejor cada día». Lo diseña Experiencia |
| Capturas de teléfono | De 2 a 8; para que la app pueda salir recomendada, al menos 4 de 1080 px o más | **Hechas en Android**, en un móvil real o en el emulador, con el mismo flujo de Maestro que las de iOS. Las de iPhone no valen: llevan la barra de estado y el aspecto de iOS |
| Capturas de tablet de 7" y 10" | Opcionales | Solo si se prueba en una tablet de verdad |

Las escenas son las mismas que en iOS:
- **Hoy.**
- **Coach**, con el rótulo «Con NIVL Pro o Élite», porque es de pago.
- **Hábitos.**
- **Campañas.**
- **Perfil**, con el rango.

En ninguna: datos personales, alcohol ni fotos reales.

### Clasificación de contenido (IARC) y formularios de «Contenido de la aplicación»

Las respuestas, una por una, están en `play-puesta-en-marcha.md` §2. En resumen:
- **Categoría:** Productividad o Estilo de vida (la decide el coordinador).
- **Violencia, sexo, lenguaje y drogas:** no.
- **Interacción entre usuarios:** sí. Hay amigos y duelos, sin chat; se comparten el alias y el retrato aprobado.
- **Compras digitales:** sí.
- **Público objetivo:** 16 y 17 años, y mayores de 18.
- **Anuncios:** no.
- **App de salud:** sí, de bienestar, sin funciones médicas.
- **Funciones financieras:** ninguna de las de la lista.
- **Seguridad de los datos:** lo que dice `declaraciones-privacidad-finales.md`. El micrófono solo se usa para el reconocimiento de voz del sistema y no se guarda audio.
- **URL para borrar la cuenta:** https://nivl.app/borrar-cuenta

## 4. Conseguir 12 testers reales (apuntar a 20)

**La regla de Google:** cuentan quienes se apuntan a la prueba cerrada **y siguen dentro 14 días seguidos**. Quien se sale antes no cuenta. Por eso la meta es **20 personas**, con margen.

**Qué necesita cada tester:**
- Un **móvil Android**.
- Una **cuenta de Google**.
- Unos minutos al día durante dos semanas.

Quien tenga iPhone no sirve para esta prueba.

**De dónde salen:**

| Fuente | Cuántos | Cómo |
|---|---|---|
| Amigos y familia con Android | De 6 a 8 | Mensaje directo (texto A). Son los que más aguantan los 14 días |
| Comunidad de tafatips | De 8 a 12 | Una historia o una publicación (texto B), y a quien responda se le manda el enlace por privado. Antes, preguntar si tiene Android |
| Cuentas de clips y creadores de NIVL | De 2 a 4 | Mensaje directo (texto A). De paso, graban contenido real de la app |

**Cómo se organiza:**
1. **Crear un Grupo de Google** (por ejemplo, «Testers NIVL») y ponerlo como lista de testers de la prueba cerrada. Cada persona entra en el grupo y después acepta en el **enlace de la prueba** de Play.
2. **Llevar un registro privado** de quién se apunta y qué día, fuera de git (el repositorio es público). El día 14 se comprueba que al menos 12 siguen dentro desde el principio.
3. **Mantenerlos activos:** un recordatorio a mitad de la prueba (texto C) y un formulario corto de opiniones. Al pedir producción, Google pregunta cómo se reclutó a los testers, cuánto usaron la app y qué se cambió con lo que dijeron. Hay que poder contestar con datos reales.
4. **No pagar ni pedir reseñas en Play**: está prohibido. Lo que sí se puede es dar Élite gratis a los testers mientras dura la prueba, con una concesión desde el servidor. Es un beneficio de la prueba, no un pago por opinar. **Lo decide el coordinador con Teferi.**

### Texto A: mensaje directo (amigos, familia y creadores)

> ¡Hola! Estoy lanzando NIVL, mi app de hábitos, y antes de publicarla en Google Play necesito 12 personas con Android que la prueben durante 14 días. ¿Me echas una mano?
>
> 1. Entra en este grupo con tu cuenta de Google: [ENLACE DEL GRUPO]
> 2. Acepta la prueba aquí e instala la app: [ENLACE DE LA PRUEBA]
> 3. Úsala unos minutos al día: completa alguna misión y prueba el coach.
>
> Lo único importante: **no te salgas de la prueba antes de 14 días**, porque Google solo cuenta a quien sigue dentro todo ese tiempo. Si algo falla o no te gusta, dímelo sin filtro. ¡Gracias!

### Texto B: comunidad de tafatips (historia o publicación)

> Estoy a punto de sacar **NIVL**, la app con la que convierto mis hábitos en misiones y subo de nivel cada día. Antes de publicarla en Android necesito **testers con móvil Android** durante 2 semanas.
>
> Si te apuntas, entras antes que nadie, me dices qué mejorarías y tienes el coach desbloqueado durante la prueba.
>
> Escríbeme «NIVL» por privado y te paso el enlace. Solo Android, y solo si puedes estar los 14 días dentro.

Si no se aprueba el Élite gratis, quitar «y tienes el coach desbloqueado durante la prueba». En ese caso, en Android el coach se prueba con los 7 días gratis, si la build de Android los tiene. **NO PROBADO.**

### Texto C: recordatorio a mitad de la prueba (día 7)

> ¡Vamos por la mitad! Gracias por seguir dentro. Si tienes 2 minutos, cuéntame qué es lo que más te ha servido y qué cambiarías: [ENLACE DEL FORMULARIO]. Recuerda no salirte de la prueba hasta el [FECHA DEL DÍA 14].

## 5. Calendario orientativo

| Día | Qué pasa |
|---|---|
| 0 | Cuenta creada y verificada; suscripciones creadas; AAB en prueba interna |
| 0 a 2 | **Prueba interna en un Android.** Arranque, inicio de sesión, compra con un tester de licencias, Restaurar compras y borrado de cuenta |
| 2 | **Se abre la prueba cerrada** y se mandan los textos A y B |
| 2 a 5 | Se apuntan los 20 testers |
| 9 | Recordatorio (texto C) |
| 16 | Se cumplen 14 días con 12 o más dentro: **solicitar el acceso a producción** |
| Hacia el 23 | Si Google lo aprueba, publicación en producción por fases |

**Lo que decide Teferi:**
- Abrir la cuenta como personal.
- Qué dirección y qué teléfono salen en público.
- Si los testers tienen Élite gratis durante la prueba.
- A quién le manda el texto A.

No se ha enviado nada a Google ni a Apple.
