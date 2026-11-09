# Ficha de tienda NIVL 1.1: Italiano

Propuesta del 9 de noviembre de 2026. **No se ha aplicado en ninguna consola.** Sale del código de la versión 1.1.0, no de fichas anteriores. Lo que hay dentro de los bloques de código es lo que se pega; lo demás es para el dueño.

App Store Connect: Italian, it. Google Play: it-IT.

## Antes de pegar (para el dueño, no va a la tienda)

1. **No hay binario 1.1 todavía** (PLAT-01). Esta ficha no menciona TestFlight. No se pega en ninguna consola hasta que haya build y prueba física.
2. **Si el reloj sale del binario** (alternativa de PLAT-01 o PLAT-06): borrar de la descripción de Apple la línea «Apple Watch», quitar Apple Watch del título de esa sección y del texto promocional, y borrar su línea de Novedades. Si va en el binario, la ficha exige capturas de reloj (`CAPTURAS.md`).
3. **Términos y privacidad publicados contradicen la 1.1** (PAG-01, P1). Los enlaces de esta ficha son las URL correctas, pero el contenido de esas páginas tiene que actualizarse antes de enviar. La frase de que no se toleran contenidos ofensivos ni abusos debe figurar también en los Términos.
4. **Moderación** (CON-01): la ficha solo dice denunciar y bloquear. No afirma revisión previa, porque hoy alias, título y foto se publican al instante y se revisan después.
5. **Importes:** la descripción no cita cantidades a propósito. Manda el precio de cada tienda, con los cuatro modos a 29,99 € y 99,99 €. El precio se ve en la pantalla de compra y en la hoja de la tienda.
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
NIVL: Abitudini e Disciplina
```

**Subtítulo**

```
Missioni, serie e coach IA
```

**Texto promocional**

```
Nuovo design, quattro modalità con il loro coach e collegamento facoltativo a Salute di Apple, Apple Watch e GPS. La base resta gratis; coach e modalità in abbonamento.
```

**Descripción**

```
NIVL trasforma le tue abitudini in missioni quotidiane. Le porti a termine e sali di livello. Fallisci e il sistema te lo dice. Tu sei il gladiatore; la tua giornata, l'arena.

LA BASE È GRATIS
Missioni, abitudini, serie, ranghi da E a S e chiusura della giornata.
Campagne e agenda a blocchi. Puoi collegare il tuo calendario: NIVL si limita a leggerlo.
Registro di palestra, cardio, pasti, peso e diario. Timer di concentrazione ed esami.
Finanze personali, a mano o con estratto CSV. NIVL non si collega alla tua banca e non sposta denaro.
Leghe, duelli e classifica con gli amici, senza chat tra persone. Puoi segnalare e bloccare qualsiasi utente; contenuti offensivi e abusi non sono tollerati.

SALUTE DI APPLE, APPLE WATCH E GPS
Facoltativo, attivato a parte. L'app funziona anche senza.
Salute di Apple (HealthKit): scegli tu cosa legge NIVL (allenamenti, passi, energia attiva, frequenza cardiaca, sonno e peso). Se lo permetti, NIVL salva in Salute gli allenamenti che misuri. Mai usato per la pubblicità.
GPS dell'iPhone: corsa e bici. Usa la tua posizione solo durante la sessione che avvii tu, anche a schermo spento e con l'indicatore blu visibile.
Apple Watch: missioni, serie, concentrazione, recuperi e allenamenti (corsa, bici, nuoto, forza). Richiede l'app per iPhone.
Misurazioni indicative, senza precisione medica.

IL COACH IA, IN ABBONAMENTO
Legge i tuoi dati prima di rispondere e mette in ordine la tua giornata: brief al mattino, piano a blocchi, revisione settimanale e memoria. In chat crea missioni e sposta la tua agenda. Propone serie, carichi e obiettivi alimentari in base a ciò che registri.
È un'IA e può sbagliare: controlla ciò che ti propone.

QUATTRO MODALITÀ, IN ABBONAMENTO
Ogni modalità apre il suo mondo, il suo livello e il suo coach.
IRON: allenamento, cardio, dieta e resistenza.
FOCUS: programma, esami e pianificazione dello studio.
WORK: giornata, progetti, ore e finanze.
FOUNDER: agenda, finanze dell'attività e i tuoi numeri.

I TUOI DATI E L'IA
Il coach usa modelli di Anthropic, un fornitore esterno di IA. Prima del primo utilizzo ti chiede il permesso esplicito di inviare dati del tuo account, che possono includere dati sulla salute (peso, pasti, diario, allenamenti misurati con frequenza cardiaca media e massima) e il titolo e gli orari del tuo calendario, se lo colleghi. I percorsi GPS non vengono inviati. Senza pubblicità. Da Profilo puoi revocare il permesso, esportare i tuoi dati ed eliminare il tuo account.

COSA NIVL NON È
NIVL non è un servizio medico, nutrizionale o psicologico, né un consulente finanziario. Non fa diagnosi, non cura e non dà consigli di investimento. In caso di dolore, infortunio o problemi di salute, rivolgiti a un professionista. Dai 16 anni in su.

ABBONAMENTI
La base è gratis. Il coach e le modalità richiedono un abbonamento a rinnovo automatico, mensile o annuale: una modalità o tutte e quattro.
Una modalità include il suo mondo, il suo coach e il coach generale di NIVL. Acquistarne un'altra sostituisce quella attuale; solo tutte e quattro ne aprono più di una.
Solo i piani annuali includono 7 giorni gratis, se il tuo account è idoneo (una prova per persona e gruppo di abbonamenti). L'IA è limitata durante la prova e, se non disdici prima della fine, inizia l'addebito annuale. Il coach ha un limite di utilizzo contro gli abusi.
Addebito sul tuo account Apple. Si rinnova automaticamente salvo disdetta almeno 24 ore prima della fine del periodo. Gestisci e disdici in Impostazioni > il tuo nome > Abbonamenti. Eliminare il tuo account NIVL non disdice l'abbonamento.

LINGUA
L'app e le risposte del coach sono in italiano. Restano in spagnolo: consensi su salute e IA, autorizzazioni di sistema, voce del coach, alcuni messaggi sull'abbonamento e app per Apple Watch.

Termini di utilizzo: https://nivl.app/terminos
Privacy: https://nivl.app/privacidad
Contratto di licenza di Apple (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
```

**Palabras clave**

```
routine,palestra,dieta,obiettivi,motivazione,studio,diario,leghe,allenamento,agenda,esami,budget
```

**Novedades de la versión 1.1**

```
Novità di NIVL 1.1:

- Nuovo design, nero e sobrio.
- Quattro modalità: IRON, FOCUS, WORK e FOUNDER. Ognuna con il suo mondo, il suo livello e il suo coach, in abbonamento. La base resta gratis.
- Collegamento facoltativo a Salute di Apple: scegli tu cosa legge NIVL.
- Apple Watch: missioni di oggi, serie, concentrazione, recuperi e allenamenti con frequenza cardiaca.
- Misura corse e uscite in bici con il GPS dell'iPhone, anche a schermo spento, solo durante la sessione che avvii tu.
- Il coach va in pausa se passi diversi giorni senza scrivergli. Lo riattivi quando vuoi.
- Nuovo ingresso: un breve questionario prima di creare l'account.
- NIVL Pro ed Élite non sono più offerti. Se ne hai uno, mantieni l'accesso finché resta attivo.
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
NIVL: Abitudini e Disciplina
```

**Descripción breve**

```
Le tue abitudini diventano missioni e serie. Coach IA in abbonamento.
```

**Descripción completa**

```
NIVL trasforma le tue abitudini in missioni quotidiane. Le porti a termine e sali di livello. Fallisci e il sistema te lo dice. Tu sei il gladiatore; la tua giornata, l'arena.

La base è gratis
Missioni, abitudini, serie, ranghi da E a S e chiusura della giornata.
Campagne e agenda a blocchi. Puoi collegare il tuo calendario: NIVL si limita a leggerlo.
Registro di palestra, cardio, pasti, peso e diario. Timer di concentrazione ed esami.
Finanze personali, a mano o con estratto CSV. NIVL non si collega alla tua banca e non sposta denaro.
Leghe, duelli e classifica con gli amici, senza chat tra persone. Puoi segnalare e bloccare qualsiasi utente; contenuti offensivi e abusi non sono tollerati.
Foto dei progressi private, dai 18 anni.

Su Android, NIVL non misura gli allenamenti con il GPS e non si collega a orologi o app di salute: gli allenamenti si registrano a mano.

Il coach IA, in abbonamento
Legge i tuoi dati prima di rispondere e mette in ordine la tua giornata: brief al mattino, piano a blocchi, revisione settimanale e memoria. In chat crea missioni e sposta la tua agenda. Propone serie, carichi e obiettivi alimentari in base a ciò che registri.
Se passi diversi giorni senza scrivergli, va in pausa finché non lo riattivi.
È un'IA e può sbagliare: controlla ciò che ti propone.

Quattro modalità, in abbonamento
Ogni modalità apre il suo mondo, il suo livello e il suo coach.
IRON: allenamento, cardio, dieta e resistenza.
FOCUS: programma, esami e pianificazione dello studio.
WORK: giornata, progetti, ore e finanze.
FOUNDER: agenda, finanze dell'attività e i tuoi numeri.

I tuoi dati e l'IA
Il coach usa modelli di Anthropic, un fornitore esterno di IA. Prima del primo utilizzo ti chiede il permesso esplicito di inviargli dati del tuo account, che possono includere dati sulla salute (peso, pasti, allenamenti e diario) e il titolo e gli orari del tuo calendario, se lo colleghi. Senza pubblicità. Da Profilo puoi revocare il permesso, esportare i tuoi dati ed eliminare il tuo account.

Cosa NIVL non è
NIVL non è un servizio medico, nutrizionale o psicologico, né un consulente finanziario. Non fa diagnosi, non cura e non dà consigli di investimento. In caso di dolore, infortunio o problemi di salute, rivolgiti a un professionista. Dai 16 anni in su.

Abbonamenti
La base è gratis. Il coach e le modalità richiedono un abbonamento a rinnovo automatico, mensile o annuale: una modalità o tutte e quattro.
Il prezzo nella tua valuta compare nello store prima di pagare.
Una modalità include il suo mondo, il suo coach e il coach generale di NIVL. Acquistarne un'altra sostituisce quella attuale; solo tutte e quattro ne aprono più di una.
Solo i piani annuali includono 7 giorni gratis, se il tuo account è idoneo (una prova per persona e gruppo di abbonamenti). L'IA è limitata durante la prova e, se non disdici prima della fine, inizia l'addebito annuale. Il coach ha un limite di utilizzo contro gli abusi.
Addebito sul tuo account Google Play. Si rinnova automaticamente finché non lo disdici. Gestisci e disdici in Google Play > Pagamenti e abbonamenti > Abbonamenti. Eliminare il tuo account NIVL non disdice l'abbonamento.

Lingua
L'app e le risposte del coach sono in italiano. Restano in spagnolo: i consensi su salute e IA, la voce del coach e alcuni messaggi sull'abbonamento.

Termini di utilizzo: https://nivl.app/terminos
Privacy: https://nivl.app/privacidad
Assistenza: https://nivl.app/soporte
```

**Notas de la versión**

```
Nuovo design, nero e sobrio.
Quattro modalità (IRON, FOCUS, WORK e FOUNDER), ognuna con il suo mondo, livello e coach, in abbonamento. La base resta gratis.
Il coach va in pausa se passi diversi giorni senza scrivergli.
Nuovo ingresso con un breve questionario prima di creare l'account.
NIVL Pro ed Élite non sono più offerti. Se ne hai uno, mantieni l'accesso finché resta attivo.
```

**URL**

- Política de privacidad: https://nivl.app/privacidad
- Eliminación de cuenta (se declara en consola): https://nivl.app/borrar-cuenta

## Recuento

Medido con script (Node, puntos de código). Límite de cada consola a 9 de noviembre de 2026.

| Tienda | Campo | Caracteres | Límite | Estado |
|---|---|---:|---:|---|
| App Store | Nombre | 28 | 30 | OK |
| App Store | Subtítulo | 26 | 30 | OK |
| App Store | Texto promocional | 168 | 170 | OK |
| App Store | Descripción | 3970 | 4000 | OK |
| App Store | Palabras clave | 96 | 100 | OK |
| App Store | Novedades 1.1 | 743 | 4000 | OK |
| Google Play | Título | 28 | 30 | OK |
| Google Play | Descripción breve | 69 | 80 | OK |
| Google Play | Descripción completa | 3444 | 4000 | OK |
| Google Play | Notas de la versión | 382 | 500 | OK |

Palabras clave en bytes UTF-8: 96 de 100. Sin espacios tras la coma: sí.
Caracteres U+2014 y U+2013 en este archivo: 0.
