# Ficha de tienda NIVL 1.1: Español (España)

Propuesta del 9 de noviembre de 2026. **No se ha aplicado en ninguna consola.** Sale del código de la versión 1.1.0, no de fichas anteriores. Lo que hay dentro de los bloques de código es lo que se pega; lo demás es para el dueño.

App Store Connect: Spanish (Spain), es-ES, localización principal. Google Play: es-ES, idioma predeterminado.

## Antes de pegar (para el dueño, no va a la tienda)

1. **No hay binario 1.1 todavía** (PLAT-01). Esta ficha no menciona TestFlight. No se pega en ninguna consola hasta que haya build y prueba física.
2. **Si el reloj sale del binario** (alternativa de PLAT-01 o PLAT-06): borrar de la descripción de Apple la línea «Apple Watch», quitar Apple Watch del título de esa sección y del texto promocional, y borrar su línea de Novedades. Si va en el binario, la ficha exige capturas de reloj (`CAPTURAS.md`).
3. **Términos y privacidad publicados contradicen la 1.1** (PAG-01, P1). Los enlaces de esta ficha son las URL correctas, pero el contenido de esas páginas tiene que actualizarse antes de enviar. La frase de que no se toleran contenidos ofensivos ni abusos debe figurar también en los Términos.
4. **Moderación** (CON-01): la ficha solo dice denunciar y bloquear. No afirma revisión previa, porque hoy alias, título y foto se publican al instante y se revisan después.
5. **Importes:** la descripción no cita cantidades a propósito. Manda el precio de cada tienda, y 30 € y 99 € están sin verificar como punto de precio de Apple (`PRODUCTOS.md` sección 4). El precio se ve en la pantalla de compra y en la hoja de la tienda.
6. **Interruptores de servidor** (CON-06): `modos_1011` apaga los mundos si está en falso (`src/modos/rutasModo.ts:15-16`); la ficha vende modos, así que tiene que estar encendido antes de enviar. Su valor en producción está sin verificar.
7. **Lo que se presenta como gratis** sale de las rutas abiertas en General hoy (`src/app/(tabs)/index.tsx:29-43`). La lista definitiva depende de PAG-08. El PDF de extractos va con IA y candado (`src/components/economia/work/useWorkEconomia.ts:10-11`): por eso aquí solo se cita CSV.
8. **Google Play:** sin `EXPO_PUBLIC_RC_ANDROID_KEY` la tienda sale cerrada (PLAT-03) y la sección de suscripciones no sería cierta. La ficha de Google no promete GPS, Salud ni reloj porque en Android no existen (`src/lib/medicion/saludNativa.ts:85`, `src/components/cardio/useCardio.ts:256`). Si es el primer lanzamiento en Play, borrar la línea de Pro y Élite de las notas.
9. **Pro y Élite** aparecen solo en Novedades, para decir que ya no se ofrecen y que quien los tiene conserva el acceso. Nada los presenta a la venta.
10. **Categorías:** no se ha podido leer cuáles tiene la app en consola. Las palabras clave evitan productividad, salud y deporte por si lo son.
11. **Apple TV, gafas Meta, Mac, Vision Pro, app web y conexión bancaria** quedan fuera a propósito.
12. **Dictado y voz del coach:** solo se anuncian aquí porque están fijos en `es-ES` (`src/lib/coachvoz/dictar.ts:24`, `src/lib/coachvoz/hablar.ts:23`). La ficha no dice que se procese en el dispositivo: en iOS puede ir a Apple por red.

## App Store

**Nombre**

```
NIVL: Hábitos y Disciplina
```

**Subtítulo**

```
Misiones, rachas y coach IA
```

**Texto promocional**

```
Nuevo diseño, cuatro modos con su coach y conexión opcional con Salud de Apple, Apple Watch y GPS. La base sigue gratis; el coach y los modos van con suscripción.
```

**Descripción**

```
NIVL convierte tus hábitos en misiones diarias. Cumples y subes de nivel. Fallas y el sistema te lo dice sin rodeos. Tú eres el gladiador; tu día, la arena.

LA BASE ES GRATIS
Misiones, hábitos, racha, rangos de E a S y cierre del día.
Campañas y agenda por bloques. Puedes conectar tu calendario: NIVL solo lo lee.
Registro de gimnasio, cardio, comidas, peso y diario. Temporizador de foco y exámenes.
Economía personal a mano o con extracto CSV. NIVL no se conecta a tu banco ni mueve dinero.
Ligas, duelos semanales y clasificación con amigos, sin chat entre personas. Puedes denunciar y bloquear a cualquier usuario; no se toleran contenidos ofensivos ni abusos.
Fotos de progreso privadas, solo para mayores de 18 años.

SALUD DE APPLE, APPLE WATCH Y GPS
Opcional y se activa aparte. Si no lo conectas, la app funciona igual.
Salud de Apple (HealthKit): tú eliges qué lee NIVL (entrenos, pasos, energía activa, pulso, sueño y peso) para enseñarte tu evolución y contrastar lo que apuntas. Si lo permites, guarda en Salud los entrenos que mides. Nunca se usa para publicidad.
GPS del iPhone: mide carrera y bici. Usa tu ubicación solo durante la sesión que arrancas tú, también con la pantalla apagada y con el indicador azul visible.
Apple Watch: misiones, racha, foco, descansos y entrenos de carrera, bici, natación y fuerza. Necesita la app del iPhone.
Las mediciones son orientativas, sin precisión médica.

EL COACH DE IA, CON SUSCRIPCIÓN
Lee tus datos antes de responder y ordena tu día: brief por la mañana, plan por bloques, revisión semanal y memoria de lo que aprende de ti. Por chat crea misiones y mueve tu agenda. Propone series, cargas y objetivos de comida según lo que registras. Puedes dictarle y escucharlo en español.
Si pasas varios días sin escribirle, se pone en pausa hasta que lo reactives.
Es una IA y puede equivocarse: revisa lo que te propone.

CUATRO MODOS, CON SUSCRIPCIÓN
Cada modo abre su mundo, con sus pantallas, su nivel y su coach.
IRON: entreno, cardio, dieta y resistencia.
FOCUS: temario, exámenes y reparto del estudio.
WORK: jornada, proyectos, horas y economía.
FOUNDER: agenda, economía del negocio y tus cifras.

TUS DATOS Y LA IA
El coach usa modelos de Anthropic, un proveedor externo de IA. Antes del primer uso te pide permiso expreso para enviarle datos de tu cuenta, que pueden incluir datos de salud (peso, comidas, diario y entrenos medidos con pulso medio y máximo) y el título y las horas de tu calendario si lo conectas. El resumen diario de Salud solo va si activas ese interruptor. La ruta GPS y la serie completa de pulso no se envían. Sin publicidad. Desde Perfil puedes retirar el permiso, exportar tus datos y eliminar tu cuenta.

LO QUE NIVL NO ES
NIVL no es un servicio médico, nutricional ni psicológico, ni un asesor financiero. No diagnostica, no trata y no da consejo de inversión. Ante dolor, lesión o un problema de salud, consulta a un profesional. Para personas de 16 años o más.

SUSCRIPCIONES
La base es gratis. El coach y los modos requieren suscripción de renovación automática, mensual o anual: un modo o los cuatro.
El precio en tu moneda aparece en la tienda antes de pagar.
Un modo incluye su mundo, su coach y el coach general de NIVL. Comprar otro modo sustituye al actual; solo los cuatro abren varios a la vez.
Solo los planes anuales traen 7 días gratis, si tu cuenta es elegible (una prueba por persona y grupo de suscripciones). La prueba tiene IA limitada y, si no cancelas antes de que acabe, empieza el cobro anual. El coach tiene un límite de uso contra abusos.
Se carga en tu cuenta de Apple y se renueva sola salvo que canceles al menos 24 horas antes de que acabe el periodo. Gestiona y cancela en Ajustes > tu nombre > Suscripciones. Eliminar tu cuenta de NIVL no cancela la suscripción.

Términos de uso: https://nivl.app/terminos
Privacidad: https://nivl.app/privacidad
Acuerdo de licencia de Apple (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
```

**Palabras clave**

```
rutina,gimnasio,dieta,metas,objetivos,motivacion,estudio,diario,ligas,entreno,agenda,examenes,gastos
```

**Novedades de la versión 1.1**

```
Esto trae NIVL 1.1:

- Nuevo diseño, negro y sobrio.
- Cuatro modos: IRON, FOCUS, WORK y FOUNDER. Cada uno con su mundo, su nivel y su coach, con suscripción. La base sigue gratis.
- Conexión opcional con Salud de Apple: tú eliges qué lee NIVL.
- Apple Watch: misiones de hoy, racha, foco, descansos y entrenos con pulso.
- Mide carrera y bici con el GPS del iPhone, también con la pantalla apagada y solo durante la sesión que arrancas tú.
- El coach se pone en pausa si pasas varios días sin escribirle. Lo reactivas cuando quieras.
- Nueva entrada: un cuestionario corto antes de crear la cuenta.
- NIVL Pro y Élite ya no se ofrecen. Si tienes uno, conservas el acceso mientras siga activo.
```

**URL**

- Soporte: https://nivl.app/soporte (antes de enviar, quitar la lista de espera, CON-13)
- Marketing: https://nivl.app
- Política de privacidad: https://nivl.app/privacidad
- Términos enlazados en la descripción: https://nivl.app/terminos
- EULA estándar de Apple: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

## Google Play

**Título**

```
NIVL: Hábitos y Disciplina
```

**Descripción breve**

```
Convierte tus hábitos en misiones y rachas. Coach de IA con suscripción.
```

**Descripción completa**

```
NIVL convierte tus hábitos en misiones diarias. Cumples y subes de nivel. Fallas y el sistema te lo dice sin rodeos. Tú eres el gladiador; tu día, la arena.

La base es gratis
Misiones, hábitos, racha, rangos de E a S y cierre del día.
Campañas y agenda por bloques. Puedes conectar tu calendario: NIVL solo lo lee.
Registro de gimnasio, cardio, comidas, peso y diario. Temporizador de foco y exámenes.
Economía personal a mano o con extracto CSV. NIVL no se conecta a tu banco ni mueve dinero.
Ligas, duelos semanales y clasificación con amigos, sin chat entre personas. Puedes denunciar y bloquear a cualquier usuario; no se toleran contenidos ofensivos ni abusos.
Fotos de progreso privadas, solo para mayores de 18 años.

En Android, NIVL no mide entrenos con GPS ni se conecta con relojes ni con apps de salud: los entrenos se registran a mano.

El coach de IA, con suscripción
Lee tus datos antes de responder y ordena tu día: brief por la mañana, plan por bloques, revisión semanal y memoria de lo que aprende de ti. Por chat crea misiones y mueve tu agenda. Propone series, cargas y objetivos de comida según lo que registras. Puedes dictarle y escucharlo en español.
Si pasas varios días sin escribirle, se pone en pausa hasta que lo reactives.
Es una IA y puede equivocarse: revisa lo que te propone.

Cuatro modos, con suscripción
Cada modo abre su mundo, con sus pantallas, su nivel y su coach.
IRON: entreno, cardio, dieta y resistencia.
FOCUS: temario, exámenes y reparto del estudio.
WORK: jornada, proyectos, horas y economía.
FOUNDER: agenda, economía del negocio y tus cifras.

Tus datos y la IA
El coach usa modelos de Anthropic, un proveedor externo de IA. Antes del primer uso te pide permiso expreso para enviarle datos de tu cuenta, que pueden incluir datos de salud (peso, comidas, entrenos y diario) y el título y las horas de tu calendario si lo conectas. Sin publicidad. Desde Perfil puedes retirar el permiso, exportar tus datos y eliminar tu cuenta.

Lo que NIVL no es
NIVL no es un servicio médico, nutricional ni psicológico, ni un asesor financiero. No diagnostica, no trata y no da consejo de inversión. Ante dolor, lesión o un problema de salud, consulta a un profesional. Para personas de 16 años o más.

Suscripciones
La base es gratis. El coach y los modos requieren suscripción de renovación automática, mensual o anual: un modo o los cuatro.
El precio en tu moneda aparece en la tienda antes de pagar.
Un modo incluye su mundo, su coach y el coach general de NIVL. Comprar otro modo sustituye al actual; solo los cuatro abren varios a la vez.
Solo los planes anuales traen 7 días gratis, si tu cuenta es elegible (una prueba por persona y grupo de suscripciones). La prueba tiene IA limitada y, si no cancelas antes de que acabe, empieza el cobro anual. El coach tiene un límite de uso contra abusos.
Se carga en tu cuenta de Google Play y se renueva sola hasta que la canceles. Gestiona y cancela en Google Play > Pagos y suscripciones > Suscripciones. Eliminar tu cuenta de NIVL no cancela la suscripción.

Términos de uso: https://nivl.app/terminos
Privacidad: https://nivl.app/privacidad
Soporte: https://nivl.app/soporte
```

**Notas de la versión**

```
Nuevo diseño, negro y sobrio.
Cuatro modos (IRON, FOCUS, WORK y FOUNDER), cada uno con su mundo, su nivel y su coach, con suscripción. La base sigue gratis.
El coach se pone en pausa si pasas varios días sin escribirle.
Nueva entrada con un cuestionario corto antes de crear la cuenta.
NIVL Pro y Élite ya no se ofrecen. Si tienes uno, conservas el acceso mientras siga activo.
```

**URL**

- Política de privacidad: https://nivl.app/privacidad
- Eliminación de cuenta (se declara en consola): https://nivl.app/borrar-cuenta

## Recuento

Medido con script (Node, puntos de código). Límite de cada consola a 9 de noviembre de 2026.

| Tienda | Campo | Caracteres | Límite | Estado |
|---|---|---:|---:|---|
| App Store | Nombre | 26 | 30 | OK |
| App Store | Subtítulo | 27 | 30 | OK |
| App Store | Texto promocional | 162 | 170 | OK |
| App Store | Descripción | 3973 | 4000 | OK |
| App Store | Palabras clave | 100 | 100 | OK |
| App Store | Novedades 1.1 | 693 | 4000 | OK |
| Google Play | Título | 26 | 30 | OK |
| Google Play | Descripción breve | 72 | 80 | OK |
| Google Play | Descripción completa | 3164 | 4000 | OK |
| Google Play | Notas de la versión | 377 | 500 | OK |

Palabras clave en bytes UTF-8: 100 de 100. Sin espacios tras la coma: sí.
Caracteres U+2014 y U+2013 en este archivo: 0.
