# Ficha de tienda NIVL 1.1: Inglés

Propuesta del 9 de noviembre de 2026. **No se ha aplicado en ninguna consola.** Sale del código de la versión 1.1.0, no de fichas anteriores. Lo que hay dentro de los bloques de código es lo que se pega; lo demás es para el dueño.

App Store Connect: English (U.S.), en-US; se puede copiar a English (U.K.), en-GB, porque el texto no usa ninguna palabra que cambie. Google Play: en-US, y en-GB si se quiere.

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
12. **Limitación de idioma. No publicar esta localización sin resolverla** (CON-11, P4, PAG-11). Comprobado en el código:
    - Con `idiomas_1011` apagado, toda la app sale en español (`src/i18n/index.ts:5`, `src/lib/flagsmath.ts:53`). La 0086 lo siembra en falso (`supabase/migrations/0086_interruptores_1011.sql:30`). Su valor en producción está **sin verificar**. Si sigue apagado, la sección pública «idioma» es falsa y esta ficha no puede salir.
    - El catálogo de este idioma existe entero: 55 archivos en `src/i18n/`, con la pantalla de compra, Salud y coach traducidos. No está revisado por un nativo, y la letra de compra espera revisión legal (`src/lib/planesmodo.ts`, sección «Lo que se dice»).
    - **Siguen en español:** el permiso de salud (`src/lib/healthmath.ts:19-26`) y la hoja de IA con sus proveedores (`src/lib/consentmath.ts:44`), con la línea de crisis; `/pro` con plan activo (`src/app/pro.tsx:259-276,321`) y errores de compra; los textos de permisos del sistema, porque `app.json` no tiene `locales` (`app.json:30` solo declara los idiomas); el dictado y la voz (`src/lib/coachvoz/dictar.ts:24`, `src/lib/coachvoz/hablar.ts:23`); la app del reloj (`docs/APPLE_WATCH.md`, punto 7 de pendientes).
    - El coach sí responde en este idioma (`supabase/functions/_shared/prompt.ts:246-248`). Por eso la descripción lo afirma y no anuncia voz.
    - **Recomendación:** si esas partes no se traducen a tiempo, publicar la 1.1 solo en es-ES. Aceptar un consentimiento de salud en un idioma que no se lee es el riesgo real, no la ficha.
13. **Calidad.** Traducción propuesta, con el vocabulario del catálogo de la app. Debe revisarla un nativo antes de pegarla.

## App Store

**Nombre**

```
NIVL: Habits & Discipline
```

**Subtítulo**

```
Missions, streaks & AI coach
```

**Texto promocional**

```
New design, four modes with their own coach and optional links to Apple Health, Apple Watch and GPS. The base stays free; the coach and the modes need a subscription.
```

**Descripción**

```
NIVL turns your habits into daily missions. Deliver and you level up. Fail and the system tells you so, plainly. You are the gladiator; your day is the arena.

THE BASE IS FREE
Missions, habits, streaks, ranks from E to S and a daily close.
Campaigns and a schedule in blocks. You can connect your calendar: NIVL only reads it.
Logs for gym, cardio, meals, weight and journal. Focus timer and exams.
Personal finances, by hand or from a CSV statement. NIVL does not connect to your bank or move money.
Leagues, weekly duels and a ranking with friends, with no chat between people. You can report and block any user; offensive content and abuse are not tolerated.
Private progress photos, 18 or over only.

APPLE HEALTH, APPLE WATCH AND GPS
Optional, switched on separately. The app works without it.
Apple Health (HealthKit): you choose what NIVL reads (workouts, steps, active energy, heart rate, sleep and weight) to show your progress. If you allow it, NIVL saves the workouts you measure to Health. Never used for advertising.
iPhone GPS: measures runs and rides. Your location is used only during a session you start, including with the screen off and the blue indicator showing.
Apple Watch: missions, streak, focus, rest timer and running, cycling, swimming and strength workouts. Needs the iPhone app.
Measurements are approximate and not medically accurate.

THE AI COACH, BY SUBSCRIPTION
It reads your data before it answers and puts your day in order: a morning brief, a plan in blocks, a weekly review and memory. In chat it creates missions and moves your schedule. It suggests sets, loads and food targets based on what you log.
If you go several days without writing to it, it pauses until you bring it back.
It is an AI and can be wrong: check what it suggests.

FOUR MODES, BY SUBSCRIPTION
Each mode opens its own world, level and coach.
IRON: training, cardio, diet and endurance.
FOCUS: syllabus, exams and study planning.
WORK: workday, projects, hours and finances.
FOUNDER: schedule, business finances and your numbers.

YOUR DATA AND AI
The coach uses models from Anthropic, a third-party AI provider. Before first use it asks your explicit permission to send it account data, which can include health data (weight, meals, journal, measured workouts with average and maximum heart rate) and calendar titles and times if you connect it. Daily Health summaries need a separate switch. GPS routes are not sent. No ads. From Profile you can withdraw your permission, export your data and delete your account.

WHAT NIVL IS NOT
NIVL is not a medical, nutritional or psychological service, or a financial adviser. It does not diagnose, treat or give investment advice. If you have pain, an injury or a health problem, see a professional. For people aged 16 or over.

SUBSCRIPTIONS
The base is free. The coach and the modes require an auto-renewing subscription, monthly or yearly: one mode or all four.
One mode includes its world, its coach and the NIVL general coach. Buying another mode replaces the current one; only all four open several at once.
Only yearly plans include 7 days free, if your account is eligible (one trial per person and subscription group). AI use is limited during the trial and, unless you cancel before it ends, the yearly charge begins. The coach has a usage limit to prevent abuse.
Charged to your Apple account. Renews automatically unless you cancel at least 24 hours before the end of the period. Manage or cancel in Settings > your name > Subscriptions. Deleting your NIVL account does not cancel the subscription.

LANGUAGE
The app and the coach's replies are available in English. Some parts are still in Spanish: the health and AI consent screens, the system permission prompts, the coach's voice, some subscription messages and the Apple Watch app.

Terms of use: https://nivl.app/terminos
Privacy: https://nivl.app/privacidad
Apple license agreement (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
```

**Palabras clave**

```
routine,gym,diet,goals,motivation,study,journal,leagues,workout,focus,planner,exams,budget,tracker
```

**Novedades de la versión 1.1**

```
What's new in NIVL 1.1:

- New design, black and sober.
- Four modes: IRON, FOCUS, WORK and FOUNDER. Each has its own world, level and coach, by subscription. The base stays free.
- Optional link to Apple Health: you choose what NIVL reads.
- Apple Watch: today's missions, streak, focus, rest timer and workouts with heart rate.
- Measure runs and rides with iPhone GPS, including with the screen off, only during a session you start.
- The coach pauses if you go several days without writing to it. Bring it back whenever you want.
- New start: a short questionnaire before you create your account.
- NIVL Pro and Élite are no longer offered. If you have one, you keep access while it stays active.
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
NIVL: Habits & Discipline
```

**Descripción breve**

```
Turn your habits into missions and streaks. AI coach by subscription.
```

**Descripción completa**

```
NIVL turns your habits into daily missions. Deliver and you level up. Fail and the system tells you so, plainly. You are the gladiator; your day is the arena.

The base is free
Missions, habits, streaks, ranks from E to S and a daily close.
Campaigns and a schedule in blocks. You can connect your calendar: NIVL only reads it.
Logs for gym, cardio, meals, weight and journal. Focus timer and exams.
Personal finances, by hand or from a CSV statement. NIVL does not connect to your bank or move money.
Leagues, weekly duels and a ranking with friends, with no chat between people. You can report and block any user; offensive content and abuse are not tolerated.
Private progress photos, 18 or over only.

On Android, NIVL does not measure workouts with GPS and does not connect to watches or health apps: workouts are logged by hand.

The AI coach, by subscription
It reads your data before it answers and puts your day in order: a morning brief, a plan in blocks, a weekly review and memory. In chat it creates missions and moves your schedule. It suggests sets, loads and food targets based on what you log.
If you go several days without writing to it, it pauses until you bring it back.
It is an AI and can be wrong: check what it suggests.

Four modes, by subscription
Each mode opens its own world, level and coach.
IRON: training, cardio, diet and endurance.
FOCUS: syllabus, exams and study planning.
WORK: workday, projects, hours and finances.
FOUNDER: schedule, business finances and your numbers.

Your data and AI
The coach uses models from Anthropic, a third-party AI provider. Before first use it asks for your explicit permission to send it data from your account, which can include health data (weight, meals, workouts and journal) and the title and times of your calendar events if you connect it. No ads. From Profile you can withdraw your permission, export your data and delete your account.

What NIVL is not
NIVL is not a medical, nutritional or psychological service, or a financial adviser. It does not diagnose, treat or give investment advice. If you have pain, an injury or a health problem, see a professional. For people aged 16 or over.

Subscriptions
The base is free. The coach and the modes require an auto-renewing subscription, monthly or yearly: one mode or all four.
You will see the price in your currency in the store before you pay.
One mode includes its world, its coach and the NIVL general coach. Buying another mode replaces the current one; only all four open several at once.
Only yearly plans include 7 days free, if your account is eligible (one trial per person and subscription group). AI use is limited during the trial and, unless you cancel before it ends, the yearly charge begins. The coach has a usage limit to prevent abuse.
Charged to your Google Play account. Renews automatically until you cancel. Manage or cancel in Google Play > Payments and subscriptions > Subscriptions. Deleting your NIVL account does not cancel the subscription.

Language
The app and the coach's replies are available in English. Some parts are still in Spanish: the health and AI consent screens, the coach's voice and some subscription messages.

Terms of use: https://nivl.app/terminos
Privacy: https://nivl.app/privacidad
Support: https://nivl.app/soporte
```

**Notas de la versión**

```
New design, black and sober.
Four modes (IRON, FOCUS, WORK and FOUNDER), each with its own world, level and coach, by subscription. The base stays free.
The coach pauses if you go several days without writing to it.
New start with a short questionnaire before you create your account.
NIVL Pro and Élite are no longer offered. If you have one, you keep access while it stays active.
```

**URL**

- Política de privacidad: https://nivl.app/privacidad
- Eliminación de cuenta (se declara en consola): https://nivl.app/borrar-cuenta

## Recuento

Medido con script (Node, puntos de código). Límite de cada consola a 9 de noviembre de 2026.

| Tienda | Campo | Caracteres | Límite | Estado |
|---|---|---:|---:|---|
| App Store | Nombre | 25 | 30 | OK |
| App Store | Subtítulo | 28 | 30 | OK |
| App Store | Texto promocional | 166 | 170 | OK |
| App Store | Descripción | 3979 | 4000 | OK |
| App Store | Palabras clave | 98 | 100 | OK |
| App Store | Novedades 1.1 | 700 | 4000 | OK |
| Google Play | Título | 25 | 30 | OK |
| Google Play | Descripción breve | 69 | 80 | OK |
| Google Play | Descripción completa | 3296 | 4000 | OK |
| Google Play | Notas de la versión | 382 | 500 | OK |

Palabras clave en bytes UTF-8: 98 de 100. Sin espacios tras la coma: sí.
Caracteres U+2014 y U+2013 en este archivo: 0.
