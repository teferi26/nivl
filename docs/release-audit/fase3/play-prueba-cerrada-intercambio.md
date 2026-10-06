# Prueba cerrada de Google Play con testers de intercambio (para Teferi)

NIVL - Tiendas, 06/10/2026, por encargo de COACH.

**Decisión de Teferi (06/10):** los testers saldrán de comunidades de intercambio:
- r/AndroidClosedTesting;
- r/TestersCommunity;
- la app Testers Community.

Grupo de Google: `testers-nivl@googlegroups.com`.

**Reglas de este documento:**
- Los chats **no publican nada en nombre de Teferi** ni envían nada a Google sin su OK.
- 🔶 marca cada paso que **envía algo a Google** y necesita su OK expreso.
- Lo que no está comprobado en la consola real va marcado como **NO PROBADO**.

Base: `play-camino-completo.md` (ficha, clasificación, plan general) y `play-puesta-en-marcha.md` §2 (respuestas de «Contenido de la aplicación»).

---

## LISTA ÚNICA DE TEFERI: qué hace y cuándo

| Cuándo | Qué hace Teferi | Tiempo |
|---|---|---|
| **Hoy** | Si al crear el grupo quedó pendiente el captcha, completarlo. Después, en groups.google.com > testers-nivl > Configuración del grupo > «Quién puede unirse al grupo»: **«Cualquier usuario de la Web puede unirse»** (si no, habría que aprobar uno a uno). «Quién puede ver las conversaciones» y «Quién puede publicar»: **solo los propietarios**, para que nadie haga spam | 3 min |
| **Hoy** | Play Console > Usuarios y permisos: invitar al coordinador, si es él quien va a cargar la ficha y la prueba. Si lo hace Teferi, seguir la sección A paso a paso | 2 min |
| **Hoy** | Terminar la verificación de identidad y del móvil Android, si Play la sigue pidiendo | 5 a 10 min |
| **Hoy** | Poner la dirección y el teléfono públicos (que no sean los de casa) | 3 min |
| **Día 0** (cuando el coordinador tenga el AAB y la ficha cargada) | Dar el OK a cada paso 🔶 de la sección A, uno por uno | 10 min |
| **Día 0** | Preparar el móvil de intercambio (sección C.1): mejor un Android con una cuenta de Google secundaria, no la personal | 15 min, una vez |
| **Día 0** | Instalar Testers Community con esa cuenta secundaria y probar 3 apps para ganar los créditos de la entrada (sección B.3) | 20 min |
| **Día 1 a 3** (cuando Google apruebe la versión de la prueba cerrada y salga el enlace) | Publicar los posts B.1 y B.2 en Reddit y entrar en un pack de Testers Community | 15 min |
| **Cada día, del día 1 al 14 + N** | Rutina de 15 minutos de la sección C.2 y actualizar la hoja de control | 15 min al día |
| **Día 7** | Mandar el recordatorio de mitad de prueba a los testers y dejar una opinión breve en las apps que pruebas | 10 min |
| **Cuando haya 12 dentro y 14 días seguidos** | Avisar al coordinador para pedir el acceso a producción (sección D) | 30 min con el coordinador |

**N** son los días que tardan en entrar los 12 primeros. Los 14 días cuentan desde que hay 12 dentro sin interrupción.

---

## A. Pasos hasta tener el enlace de inscripción

Cada paso indica quién lo hace: el coordinador, con acceso de Teferi, o Teferi. Los textos están en `play-camino-completo.md` §3 y las respuestas, en `play-puesta-en-marcha.md` §2.

1. 🔶 **Crear la app:** Play Console > Crear app.
   - Nombre: `NIVL: Hábitos y Disciplina`.
   - Idioma predeterminado: Español (España).
   - Tipo: App. Gratuita (las suscripciones no cambian eso).
   - Marcar las dos declaraciones: políticas para desarrolladores y leyes de exportación de EE. UU.

   La app no es visible en Play hasta que se publica.

2. **Panel «Configura tu aplicación» > «Contenido de la aplicación»**, sección por sección. Cada «Guardar» o «Enviar» va a Google:
   - 🔶 **Política de privacidad:** https://nivl.app/privacidad
   - 🔶 **Acceso a la app:** «Todas o algunas funciones están restringidas». Se añade la **cuenta demo para el revisor de Google**, distinta de la de Apple, con instrucciones: «ENTRAR» con correo y contraseña. La crea el coordinador y **no va en ningún archivo del repo**.
   - 🔶 **Anuncios:** No.
   - 🔶 **Clasificación de contenido (IARC):** correo de contacto y las respuestas del §2. Al enviar, Google asigna la clasificación al momento.
   - 🔶 **Público objetivo:** 16 y 17 años, y 18 o más. Sin menores de 16. Atracción para niños: No.
   - 🔶 **Seguridad de los datos:** según `declaraciones-privacidad-finales.md`, con la URL de borrado https://nivl.app/borrar-cuenta.
   - 🔶 **Funciones financieras:** ninguna. **Salud:** declarar las funciones de bienestar (actividad, nutrición y peso) sin Health Connect. **Apps gubernamentales:** No. **Noticias:** No.
3. 🔶 **Ficha principal de Play Store:**
   - Textos en español del §3.
   - Icono: `nivl-icono-play-512.png` del coordinador.
   - Gráfico destacado: `play-graficos/play-grafico-destacado-1024x500.png`.
   - Al menos 2 capturas de teléfono. Si aún no hay capturas de Android, **la prueba cerrada no puede salir sin ellas**: el workflow necesita la cuenta de capturas.
   - Traducción en inglés: «Añadir traducciones» > Inglés, con los textos EN del §3. Ayuda a los testers de las comunidades, que en su mayoría no hablan español.
4. 🔶 **Categoría y contacto** (Presencia en Play Store > Configuración de la ficha): categoría **Salud y forma física** o **Productividad** (la decide el coordinador), correo de soporte y web https://nivl.app.
5. 🔶 **Prueba interna primero** (Probar > Pruebas internas > Crear versión):
   - Subir el **AAB** de producción que compila el coordinador desde integración (`versionCode` nuevo, runtime 1.0.8, **sin OTA nueva**).
   - Aceptar **Firma de aplicaciones de Play**, la opción por defecto.
   - Probarlo en un Android antes de abrir la prueba cerrada: arranque, entrar, Hoy, coach con la prueba de 7 días, borrar cuenta.
6. **Huella para los enlaces de nivl.app:** Configuración > Integridad de la app > copiar el SHA-256 de la clave de firma y pasárselo a quien publique `assetlinks.json` (Chat 4/coordinador). Esto no es un envío a Google.
7. 🔶 **Suscripciones** (Monetizar > Productos > Suscripciones):
   - Solo aparecen después de subir un AAB que tenga el permiso de facturación.
   - Crear los 5 IDs con sus precios y enlazarlos en RevenueCat.
   - **No bloquean el enlace de la prueba.** Si aún no están, los testers verán la tienda cerrada y podrán usar todo lo gratuito y la prueba de 7 días.
8. 🔶 **Prueba cerrada** (Probar > Prueba cerrada > pista «Alpha» o una nueva llamada «Intercambio»):
   - **Países y regiones: todos.** Los testers de intercambio están en todo el mundo; un tester de un país no incluido no puede instalar la app y no cuenta.
   - **Testers: Grupos de Google** > `testers-nivl@googlegroups.com`.
   - **URL o correo para comentarios:** el correo de soporte de NIVL.
   - **Crear versión:** promocionar el AAB de prueba interna. Notas de la versión en español e inglés: «Primera versión de prueba de NIVL. / First NIVL test build.»
   - «Revisar versión» > **Enviar a revisión**.
9. **Esperar a que Google la apruebe.** Ninguna página oficial da plazo para la revisión de la prueba cerrada: **NO PROBADO**. Suele tardar entre horas y pocos días.
10. **Copiar los enlaces** (Prueba cerrada > Testers > «Cómo se unen los testers»):
    - Enlace de inscripción: `https://play.google.com/apps/testing/com.teferi.nivl`. Así queda con el paquete `com.teferi.nivl`; la consola lo confirma: **NO PROBADO**.
    - Enlace del grupo: `https://groups.google.com/g/testers-nivl`.

    Con los dos enlaces, se rellenan los posts de la sección B.

---

## B. Posts listos para pegar (inglés)

Antes de publicar en cada subreddit: leer sus reglas, en la barra lateral o en «About». Esta guía no ha podido abrir Reddit para comprobarlas: **NO PROBADO**. Si piden un formato de título concreto, se adapta el título y el cuerpo se deja igual.

### B.1 r/AndroidClosedTesting

**Título:**
`[Test exchange] NIVL: habit tracker that turns habits into daily missions (Spanish UI). I'll test yours for 14 days`

**Cuerpo:**

```
Hi! Solo dev here. I need testers for my closed test and I'll test your app back for the full 14 days.

NIVL turns your habits into daily missions: you level up, climb ranks from E to S and keep streaks. Free to use (an optional AI coach is a paid subscription, with a 7-day free trial; you don't need it to help me).

The interface is in Spanish, but it's simple: open it, create a habit, tick a mission. A minute a day is enough.

How to join (both steps are needed):
1. Join the Google Group: https://groups.google.com/g/testers-nivl
2. Opt in and install: https://play.google.com/apps/testing/com.teferi.nivl

Then comment with your app's group + opt-in links and I'll join today. I open every app I test every day and stay opted in for 14 days. Please do the same and don't leave before day 14.

Any feedback is welcome, in English or Spanish. Thanks!
```

### B.2 r/TestersCommunity

**Título:**
`[Exchange] NIVL (habits & discipline, Spanish UI): 14-day mutual testing`

**Cuerpo:**

```
Looking for mutual testers. I test yours daily for 14 days, you test mine.

App: NIVL, a habit tracker where habits become daily missions with levels, ranks and streaks. Free; interface in Spanish (easy to navigate).

1. Join: https://groups.google.com/g/testers-nivl
2. Opt in + install: https://play.google.com/apps/testing/com.teferi.nivl

Reply with your links and I'll join right away. I keep a log and stay opted in the whole 14 days. Thanks!
```

### B.3 App Testers Community (testerscommunity.com)

Según su web, funciona por créditos y es gratis:
- se prueban 3 apps de otros para ganar créditos;
- con ellos se entra en un «pack» de unos 16 desarrolladores que se prueban entre sí durante 14 días.

Es de terceros: **NO PROBADO** desde este chat. Usar solo la vía gratuita de créditos. **No comprar paquetes de testers:** son testers de pago, y Google rechaza el acceso a producción cuando el uso no es real.

**Descripción para la ficha de NIVL dentro de la app** (en inglés, por si la piden):

```
NIVL turns your habits into daily missions. Level up, climb ranks and keep your streak. Spanish interface, simple to use: open it, create a habit and tick a mission each day. Optional AI coach (7-day free trial).
```

**Instrucciones para los testers** (si la app deja dejarlas):

```
Open NIVL once a day: check "Hoy" (today's missions), tick one, look at "Hábitos" or "Perfil". You can sign up with any email. No payment needed.
```

### B.4 Respuesta corta para quien comente en Reddit

```
Joined your group and opted in. I'll open it every day for 14 days. Thanks for testing NIVL!
```

---

## C. Rutina diaria de 15 minutos

### C.1 Una vez, antes de empezar (seguridad)

Vas a instalar apps de desconocidos.

- **Usar una cuenta de Google secundaria**, no la personal ni la de desarrollador, y si es posible un Android sin datos personales (uno viejo o prestado). Esa cuenta es la que se une a los grupos y pruebas de los demás.
- **Instalar solo desde Play** (el enlace de inscripción de cada prueba). Nunca un APK suelto ni enlaces fuera de Play.
- **Permisos:** denegar todo lo que no haga falta (contactos, ubicación, SMS, micrófono, accesibilidad). Si una app pide **accesibilidad** o **administrador del dispositivo**, desinstalarla y quitarla de la hoja.
- **No meter datos reales** al registrarse: alias, sin teléfono y sin pagos. **Nunca comprar nada** en las apps de los demás.

### C.2 La rutina (cada día, unos 15 minutos)

1. **Minutos 0 a 10. Abrir cada app que pruebas:** unos 30 segundos por app, tocando un par de pantallas. Con 15 a 20 apps sale justo. Marcar «Hoy» en la hoja.
2. **Minutos 10 a 13. Peticiones nuevas:** mirar las respuestas en Reddit y en Testers Community. Por cada una:
   - entrar en su grupo y su enlace de prueba;
   - instalar;
   - contestar con B.4;
   - añadir una fila en la hoja.
3. **Minutos 13 a 15. NIVL:**
   - mirar el correo de soporte y los comentarios de los testers;
   - apuntar en la columna «Cambio» cualquier cosa que se arregle, porque Google pregunta por eso.
4. **El día 7:** dejar una opinión breve y honesta en cada app que pruebas. Así cumples y es más fácil que no se salgan de la tuya.
5. **Nunca salir de una prueba antes de su día 14.** Desinstalar la app tampoco saca de la prueba, pero las apps deben abrirse a diario.

### C.3 Hoja de control

Va en la carpeta `nivl/privado/` (fuera de git) o en una hoja de cálculo privada, **nunca en el repositorio**: lleva cuentas de otras personas.

| Fecha de alta | Persona o usuario | Dónde (Reddit, TC…) | Su app (nombre y paquete) | Yo me uno el | Mi día 14 | Se une a NIVL el | Su día 14 en NIVL | ¿Abre NIVL? (por semana) | Abro su app (L M X J V S D) | Opinión dejada (día 7) | Cambio hecho en NIVL por su opinión | Notas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

**Cómo se lee:**
- El **día 14 en NIVL** de cada tester es su fecha de alta + 14.
- Cuando haya **12 filas con «Se une a NIVL» sin baja**, la cuenta atrás de Google empieza en la fecha del duodécimo.
- Meta: **20 a 25 intercambios**, porque en estas comunidades parte de la gente se va antes de tiempo.
- Play Console no dice quién abre la app; solo da números agregados de testers y de uso. La columna «¿Abre NIVL?» se rellena con lo que diga cada tester, por eso es aproximada.

---

## D. Al llegar a 12 testers durante 14 días: pedir producción

Panel de Play Console > «Solicitar acceso a producción». Lo preparan el coordinador y este chat con los datos reales de la hoja:

1. **Sobre la prueba cerrada:**
   - cómo se reclutó: comunidades de intercambio de testers, publicaciones abiertas y Testers Community;
   - si fue difícil;
   - qué funciones se usaron;
   - si el uso se pareció al real.
2. **Sobre la app:**
   - público: hispanohablantes de 16 años o más que quieren constancia en sus hábitos;
   - valor: hábitos convertidos en misiones diarias, con progreso visible y un coach opcional;
   - instalaciones previstas en el primer año.
3. **Preparación:** los cambios hechos con las opiniones (la columna «Cambio») y por qué está lista.

**Respuesta honesta sobre el intercambio:** la mayoría de testers no hablan español, así que el uso fue más corto que el de un usuario real. Se cuenta tal cual, junto a lo que se mejoró. No se inventan cifras. Google tarda normalmente 7 días o menos en contestar.

🔶 Enviar la solicitud de acceso a producción.
