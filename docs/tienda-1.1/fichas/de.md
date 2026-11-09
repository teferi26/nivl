# Ficha de tienda NIVL 1.1: Alemán

Propuesta del 9 de noviembre de 2026. **No se ha aplicado en ninguna consola.** Sale del código de la versión 1.1.0, no de fichas anteriores. Lo que hay dentro de los bloques de código es lo que se pega; lo demás es para el dueño.

App Store Connect: German, de-DE. Google Play: de-DE.

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
NIVL: Gewohnheiten & Disziplin
```

**Subtítulo**

```
Missionen, Serien & KI-Coach
```

**Texto promocional**

```
Neues Design, vier Modi mit eigenem Coach, optional Apple Health, Apple Watch und GPS. Die Basis bleibt kostenlos, Coach und Modi gibt es im Abo.
```

**Descripción**

```
NIVL macht aus deinen Gewohnheiten tägliche Missionen. Hältst du Wort, steigst du auf. Scheiterst du, sagt dir das System das ohne Umschweife. Du bist der Gladiator, dein Tag ist die Arena.

DIE BASIS IST KOSTENLOS
Missionen, Gewohnheiten, Serie, Ränge von E bis S und Tagesabschluss.
Kampagnen und Kalender in Blöcken. Du kannst deinen Kalender verbinden: NIVL liest ihn nur.
Protokolle für Gym, Cardio, Mahlzeiten, Gewicht und Tagebuch. Fokus-Timer und Prüfungen.
Persönliche Finanzen, von Hand oder per CSV-Kontoauszug. NIVL verbindet sich nicht mit deiner Bank und bewegt kein Geld.
Ligen, Duelle und Rangliste mit Freunden, ohne Chat zwischen Personen. Du kannst jede Person melden und blockieren; anstößige Inhalte und Missbrauch werden nicht geduldet.

APPLE HEALTH, APPLE WATCH UND GPS
Optional, separat aktiviert. Die App funktioniert auch ohne.
Apple Health (HealthKit): Du wählst, was NIVL liest (Workouts, Schritte, aktive Energie, Herzfrequenz, Schlaf, Gewicht). Wenn du es erlaubst, speichert NIVL gemessene Workouts in Health. Nie für Werbung.
iPhone-GPS: Läufe und Radtouren. Standort nur während einer Einheit, die du startest, auch bei ausgeschaltetem Bildschirm, mit sichtbarer blauer Anzeige.
Apple Watch: Missionen, Serie, Fokus, Pausen und Workouts (Laufen, Rad, Schwimmen, Kraft). Braucht die iPhone-App.
Messwerte sind Richtwerte ohne medizinische Genauigkeit.

DER KI-COACH, IM ABO
Er liest deine Daten, bevor er antwortet, und ordnet deinen Tag: Briefing am Morgen, Plan in Blöcken, Wochenrückblick und Gedächtnis. Im Chat legt er Missionen an und ändert deinen Kalender. Er schlägt Sätze, Gewichte und Ernährungsziele anhand deiner Einträge vor.
Er ist eine KI und kann sich irren: Prüfe seine Vorschläge.

VIER MODI, IM ABO
Jeder Modus öffnet seine Welt, sein Level und seinen Coach.
IRON: Training, Cardio, Ernährung und Ausdauer.
FOCUS: Stoff, Prüfungen und Lernplanung.
WORK: Arbeitstag, Projekte, Stunden und Finanzen.
FOUNDER: Kalender, Geschäftsfinanzen und deine Zahlen.

DEINE DATEN UND DIE KI
Der Coach nutzt Modelle von Anthropic, einem externen KI-Anbieter. Vor der ersten Nutzung bittet er um deine ausdrückliche Erlaubnis, Kontodaten zu senden. Dazu können Gesundheitsdaten gehören (Gewicht, Mahlzeiten, Tagebuch, gemessene Workouts mit mittlerer und maximaler Herzfrequenz) sowie Titel und Uhrzeiten deines Kalenders, wenn du ihn verbindest. GPS-Routen werden nicht gesendet. Keine Werbung. Unter Profil kannst du die Erlaubnis widerrufen, Daten exportieren und dein Konto löschen.

WAS NIVL NICHT IST
NIVL ist kein medizinischer, ernährungsbezogener oder psychologischer Dienst und keine Finanzberatung. Keine Diagnosen, keine Behandlung, keine Anlageberatung. Bei Schmerzen, Verletzungen oder gesundheitlichen Problemen wende dich an eine Fachperson. Ab 16 Jahren.

ABOS
Die Basis ist kostenlos. Coach und Modi setzen ein automatisch verlängertes Abo voraus, monatlich oder jährlich: ein Modus oder alle vier.
Ein Modus umfasst seine Welt, seinen Coach und den allgemeinen NIVL-Coach. Ein anderer Modus ersetzt den aktuellen; nur alle vier öffnen mehrere gleichzeitig.
Nur Jahresabos enthalten 7 Tage gratis, wenn dein Konto berechtigt ist (ein Test pro Person und Abo-Gruppe). Die KI ist im Test begrenzt, und ohne Kündigung vor dem Ende beginnt die Jahresabbuchung. Der Coach hat ein Nutzungslimit gegen Missbrauch.
Abbuchung über dein Apple-Konto. Verlängert sich automatisch, sofern du nicht mindestens 24 Stunden vor Ende des Zeitraums kündigst. Verwalten und kündigen unter Einstellungen > dein Name > Abos. Das Löschen deines NIVL-Kontos kündigt das Abo nicht.

SPRACHE
App und Antworten des Coachs sind auf Deutsch. Noch auf Spanisch: Einwilligungen zu Gesundheit und KI, Systemabfragen, Stimme des Coachs, einige Abo-Meldungen und die Apple-Watch-App.

Nutzungsbedingungen: https://nivl.app/terminos
Datenschutz: https://nivl.app/privacidad
Lizenzvereinbarung von Apple (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
```

**Palabras clave**

```
Routine,Gym,Diät,Ziele,Motivation,Lernen,Tagebuch,Ligen,Training,Planer,Prüfungen,Budget,Fokus
```

**Novedades de la versión 1.1**

```
Neu in NIVL 1.1:

- Neues Design, schwarz und schlicht.
- Vier Modi: IRON, FOCUS, WORK und FOUNDER. Jeder mit eigener Welt, eigenem Level und eigenem Coach, im Abo. Die Basis bleibt kostenlos.
- Optionale Verbindung mit Apple Health: Du entscheidest, was NIVL liest.
- Apple Watch: Missionen des Tages, Serie, Fokus, Pausen und Workouts mit Herzfrequenz.
- Miss Läufe und Radtouren mit dem iPhone-GPS, auch bei ausgeschaltetem Bildschirm und nur während einer Einheit, die du selbst startest.
- Der Coach pausiert, wenn du ihm mehrere Tage nicht schreibst. Du aktivierst ihn wieder, wann du willst.
- Neuer Einstieg: ein kurzer Fragebogen, bevor du dein Konto anlegst.
- NIVL Pro und Élite werden nicht mehr angeboten. Wenn du eines davon hast, behältst du den Zugang, solange es aktiv ist.
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
NIVL: Gewohnheiten & Disziplin
```

**Descripción breve**

```
Aus Gewohnheiten werden Missionen und Serien. KI-Coach im Abo.
```

**Descripción completa**

```
NIVL macht aus deinen Gewohnheiten tägliche Missionen. Hältst du Wort, steigst du auf. Scheiterst du, sagt dir das System das ohne Umschweife. Du bist der Gladiator, dein Tag ist die Arena.

Die Basis ist kostenlos
Missionen, Gewohnheiten, Serie, Ränge von E bis S und Tagesabschluss.
Kampagnen und Kalender in Blöcken. Du kannst deinen Kalender verbinden: NIVL liest ihn nur.
Protokolle für Gym, Cardio, Mahlzeiten, Gewicht und Tagebuch. Fokus-Timer und Prüfungen.
Persönliche Finanzen, von Hand oder per CSV-Kontoauszug. NIVL verbindet sich nicht mit deiner Bank und bewegt kein Geld.
Ligen, Duelle und Rangliste mit Freunden, ohne Chat zwischen Personen. Du kannst jede Person melden und blockieren; anstößige Inhalte und Missbrauch werden nicht geduldet.
Private Fortschrittsfotos, nur ab 18 Jahren.

Unter Android misst NIVL keine Workouts per GPS und verbindet sich weder mit Uhren noch mit Gesundheits-Apps: Workouts werden von Hand eingetragen.

Der KI-Coach, im Abo
Er liest deine Daten, bevor er antwortet, und ordnet deinen Tag: Briefing am Morgen, Plan in Blöcken, Wochenrückblick und Gedächtnis. Im Chat legt er Missionen an und ändert deinen Kalender. Er schlägt Sätze, Gewichte und Ernährungsziele anhand deiner Einträge vor.
Schreibst du ihm mehrere Tage nicht, pausiert er, bis du ihn wieder aktivierst.
Er ist eine KI und kann sich irren: Prüfe seine Vorschläge.

Vier Modi, im Abo
Jeder Modus öffnet seine Welt, sein Level und seinen Coach.
IRON: Training, Cardio, Ernährung und Ausdauer.
FOCUS: Stoff, Prüfungen und Lernplanung.
WORK: Arbeitstag, Projekte, Stunden und Finanzen.
FOUNDER: Kalender, Geschäftsfinanzen und deine Zahlen.

Deine Daten und die KI
Der Coach nutzt Modelle von Anthropic, einem externen KI-Anbieter. Vor der ersten Nutzung bittet er um deine ausdrückliche Erlaubnis, Daten aus deinem Konto zu senden. Das können Gesundheitsdaten sein (Gewicht, Mahlzeiten, Workouts und Tagebuch) sowie Titel und Uhrzeiten deines Kalenders, wenn du ihn verbindest. Keine Werbung. Unter Profil kannst du die Erlaubnis widerrufen, Daten exportieren und dein Konto löschen.

Was NIVL nicht ist
NIVL ist kein medizinischer, ernährungsbezogener oder psychologischer Dienst und keine Finanzberatung. Keine Diagnosen, keine Behandlung, keine Anlageberatung. Bei Schmerzen, Verletzungen oder gesundheitlichen Problemen wende dich an eine Fachperson. Ab 16 Jahren.

Abos
Die Basis ist kostenlos. Coach und Modi setzen ein automatisch verlängertes Abo voraus, monatlich oder jährlich: ein Modus oder alle vier.
Den Preis in deiner Währung siehst du vor dem Bezahlen im Store.
Ein Modus umfasst seine Welt, seinen Coach und den allgemeinen NIVL-Coach. Ein anderer Modus ersetzt den aktuellen; nur alle vier öffnen mehrere gleichzeitig.
Nur Jahresabos enthalten 7 Tage gratis, wenn dein Konto berechtigt ist (ein Test pro Person und Abo-Gruppe). Die KI ist im Test begrenzt, und ohne Kündigung vor dem Ende beginnt die Jahresabbuchung. Der Coach hat ein Nutzungslimit gegen Missbrauch.
Abbuchung über dein Google-Play-Konto. Verlängert sich automatisch, bis du kündigst. Verwalten und kündigen unter Google Play > Zahlungen und Abos > Abos. Das Löschen deines NIVL-Kontos kündigt das Abo nicht.

Sprache
App und Antworten des Coachs sind auf Deutsch. Noch auf Spanisch: die Einwilligungen zu Gesundheit und KI, die Stimme des Coachs und einige Abo-Meldungen.

Nutzungsbedingungen: https://nivl.app/terminos
Datenschutz: https://nivl.app/privacidad
Support: https://nivl.app/soporte
```

**Notas de la versión**

```
Neues Design, schwarz und schlicht.
Vier Modi (IRON, FOCUS, WORK und FOUNDER), jeder mit eigener Welt, Level und Coach, im Abo. Die Basis bleibt kostenlos.
Der Coach pausiert, wenn du ihm mehrere Tage nicht schreibst.
Neuer Einstieg mit kurzem Fragebogen vor der Kontoerstellung.
NIVL Pro und Élite werden nicht mehr angeboten. Wenn du eines davon hast, behältst du den Zugang, solange es aktiv ist.
```

**URL**

- Política de privacidad: https://nivl.app/privacidad
- Eliminación de cuenta (se declara en consola): https://nivl.app/borrar-cuenta

## Recuento

Medido con script (Node, puntos de código). Límite de cada consola a 9 de noviembre de 2026.

| Tienda | Campo | Caracteres | Límite | Estado |
|---|---|---:|---:|---|
| App Store | Nombre | 30 | 30 | OK |
| App Store | Subtítulo | 28 | 30 | OK |
| App Store | Texto promocional | 145 | 170 | OK |
| App Store | Descripción | 3996 | 4000 | OK |
| App Store | Palabras clave | 94 | 100 | OK |
| App Store | Novedades 1.1 | 790 | 4000 | OK |
| Google Play | Título | 30 | 30 | OK |
| Google Play | Descripción breve | 62 | 80 | OK |
| Google Play | Descripción completa | 3496 | 4000 | OK |
| Google Play | Notas de la versión | 399 | 500 | OK |

Palabras clave en bytes UTF-8: 96 de 100. Sin espacios tras la coma: sí.
Caracteres U+2014 y U+2013 en este archivo: 0.
