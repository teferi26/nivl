# Ficha de tienda NIVL 1.1: Francés

Propuesta del 9 de noviembre de 2026. **No se ha aplicado en ninguna consola.** Sale del código de la versión 1.1.0, no de fichas anteriores. Lo que hay dentro de los bloques de código es lo que se pega; lo demás es para el dueño.

App Store Connect: French, fr-FR. Google Play: fr-FR.

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
NIVL : Habitudes et discipline
```

**Subtítulo**

```
Missions, séries et coach IA
```

**Texto promocional**

```
Nouveau design, quatre modes avec leur coach, lien facultatif avec Santé d'Apple, Apple Watch et GPS. La base reste gratuite ; coach et modes sur abonnement.
```

**Descripción**

```
NIVL transforme tes habitudes en missions quotidiennes. Tu tiens parole, tu montes de niveau. Tu échoues, le système te le dit. Tu es le gladiateur ; ta journée, l'arène.

LA BASE EST GRATUITE
Missions, habitudes, série, rangs de E à S et clôture du jour.
Campagnes et agenda par blocs. Tu peux connecter ton calendrier, en lecture seule.
Suivi de la salle, du cardio, des repas, du poids et journal. Minuteur de concentration et examens.
Finances personnelles, à la main ou par relevé CSV. NIVL ne se connecte pas à ta banque et ne déplace pas d'argent.
Ligues, duels et classement entre amis, sans messagerie. Tu peux signaler et bloquer tout utilisateur ; contenus offensants et abus ne sont pas tolérés.

SANTÉ D'APPLE, APPLE WATCH ET GPS
Facultatif, activé à part. L'app fonctionne sans.
Santé d'Apple (HealthKit) : tu choisis ce que NIVL lit (entraînements, pas, énergie active, fréquence cardiaque, sommeil, poids). Si tu l'autorises, NIVL y enregistre les entraînements mesurés. Jamais pour la publicité.
GPS de l'iPhone : course et vélo. Position utilisée uniquement pendant la séance que tu lances, même écran éteint, avec l'indicateur bleu visible.
Apple Watch : missions, série, concentration, repos et entraînements (course, vélo, natation, force). Nécessite l'app iPhone.
Mesures indicatives, sans précision médicale.

LE COACH IA, SUR ABONNEMENT
Il lit tes données avant de répondre et ordonne ta journée : brief le matin, plan par blocs, bilan hebdomadaire et mémoire. Dans le chat, il crée des missions et déplace ton agenda. Il propose séries, charges et objectifs alimentaires selon ce que tu notes.
C'est une IA, elle peut se tromper : vérifie ses propositions.

QUATRE MODES, SUR ABONNEMENT
Chaque mode ouvre son monde, son niveau et son coach.
IRON : entraînement, cardio, alimentation et endurance.
FOCUS : programme, examens et planning.
WORK : journée, projets, heures et finances.
FOUNDER : agenda, finances et tes chiffres.

TES DONNÉES ET L'IA
Le coach utilise des modèles d'Anthropic, fournisseur d'IA externe. Avant la première utilisation, il te demande l'autorisation expresse d'envoyer des données de ton compte, pouvant inclure des données de santé (poids, repas, journal, entraînements mesurés avec fréquence cardiaque moyenne et maximale) et le titre et les heures de ton calendrier si tu le connectes. Les parcours GPS ne sont pas envoyés. Sans publicité. Depuis Profil, tu peux retirer ton autorisation, exporter tes données et supprimer ton compte.

CE QUE NIVL N'EST PAS
NIVL n'est ni un service médical, nutritionnel ou psychologique, ni un conseiller financier. Aucun diagnostic, aucun soin, aucun conseil en investissement. En cas de douleur, de blessure ou de problème de santé, consulte un professionnel. Dès 16 ans.

ABONNEMENTS
La base est gratuite. Le coach et les modes nécessitent un abonnement à renouvellement automatique, mensuel ou annuel : un mode ou les quatre.
Un mode comprend son monde, son coach et le coach général de NIVL. Acheter un autre mode remplace l'actuel ; seuls les quatre en ouvrent plusieurs à la fois.
Seules les formules annuelles incluent 7 jours gratuits, si ton compte est éligible (un essai par personne et groupe d'abonnements). L'IA est limitée pendant l'essai et, sans annulation avant la fin, le prélèvement annuel commence. Le coach a une limite d'usage contre les abus.
Débité sur ton compte Apple. Renouvellement automatique sauf annulation au moins 24 heures avant la fin de la période. Gère ou annule dans Réglages > ton nom > Abonnements. Supprimer ton compte NIVL n'annule pas l'abonnement.

LANGUE
L'app et les réponses du coach sont en français. Restent en espagnol : consentements santé et IA, autorisations du système, voix du coach, certains messages d'abonnement et app Apple Watch.

Conditions d'utilisation: https://nivl.app/terminos
Confidentialité: https://nivl.app/privacidad
Contrat de licence d'Apple (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
```

**Palabras clave**

```
routine,gym,objectifs,motivation,études,journal,ligues,entraînement,agenda,examens,budget,focus
```

**Novedades de la versión 1.1**

```
Nouveautés de NIVL 1.1 :

- Nouveau design, noir et sobre.
- Quatre modes : IRON, FOCUS, WORK et FOUNDER. Chacun a son monde, son niveau et son coach, sur abonnement. La base reste gratuite.
- Lien facultatif avec Santé d'Apple : tu choisis ce que NIVL lit.
- Apple Watch : missions du jour, série, concentration, repos et entraînements avec fréquence cardiaque.
- Mesure tes courses et tes sorties à vélo avec le GPS de l'iPhone, même écran éteint, uniquement pendant la séance que tu lances.
- Le coach se met en pause si tu passes plusieurs jours sans lui écrire. Tu le réactives quand tu veux.
- Nouvelle entrée : un court questionnaire avant de créer ton compte.
- NIVL Pro et Élite ne sont plus proposés. Si tu en as un, tu gardes l'accès tant qu'il reste actif.
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
NIVL : Habitudes et discipline
```

**Descripción breve**

```
Tes habitudes deviennent missions et séries. Coach IA sur abonnement.
```

**Descripción completa**

```
NIVL transforme tes habitudes en missions quotidiennes. Tu tiens parole, tu montes de niveau. Tu échoues, le système te le dit. Tu es le gladiateur ; ta journée, l'arène.

La base est gratuite
Missions, habitudes, série, rangs de E à S et clôture du jour.
Campagnes et agenda par blocs. Tu peux connecter ton calendrier, en lecture seule.
Suivi de la salle, du cardio, des repas, du poids et journal. Minuteur de concentration et examens.
Finances personnelles, à la main ou par relevé CSV. NIVL ne se connecte pas à ta banque et ne déplace pas d'argent.
Ligues, duels et classement entre amis, sans messagerie. Tu peux signaler et bloquer tout utilisateur ; contenus offensants et abus ne sont pas tolérés.
Photos de progression privées, 18 ans et plus.

Sur Android, NIVL ne mesure pas les entraînements par GPS et ne se connecte ni aux montres ni aux apps de santé : les entraînements se notent à la main.

Le coach IA, sur abonnement
Il lit tes données avant de répondre et ordonne ta journée : brief le matin, plan par blocs, bilan hebdomadaire et mémoire. Dans le chat, il crée des missions et déplace ton agenda. Il propose séries, charges et objectifs alimentaires selon ce que tu notes.
Après plusieurs jours sans message, il se met en pause jusqu'à ce que tu le réactives.
C'est une IA, elle peut se tromper : vérifie ses propositions.

Quatre modes, sur abonnement
Chaque mode ouvre son monde, son niveau et son coach.
IRON : entraînement, cardio, alimentation et endurance.
FOCUS : programme, examens et planning.
WORK : journée, projets, heures et finances.
FOUNDER : agenda, finances et tes chiffres.

Tes données et l'IA
Le coach utilise des modèles d'Anthropic, un fournisseur d'IA externe. Avant la première utilisation, il te demande l'autorisation expresse de lui envoyer des données de ton compte, qui peuvent inclure des données de santé (poids, repas, entraînements et journal) et le titre et les heures de ton calendrier si tu le connectes. Sans publicité. Depuis Profil, tu peux retirer ton autorisation, exporter tes données et supprimer ton compte.

Ce que NIVL n'est pas
NIVL n'est ni un service médical, nutritionnel ou psychologique, ni un conseiller financier. Aucun diagnostic, aucun soin, aucun conseil en investissement. En cas de douleur, de blessure ou de problème de santé, consulte un professionnel. Dès 16 ans.

Abonnements
La base est gratuite. Le coach et les modes nécessitent un abonnement à renouvellement automatique, mensuel ou annuel : un mode ou les quatre.
Le prix dans ta devise s'affiche dans la boutique avant le paiement.
Un mode comprend son monde, son coach et le coach général de NIVL. Acheter un autre mode remplace l'actuel ; seuls les quatre en ouvrent plusieurs à la fois.
Seules les formules annuelles incluent 7 jours gratuits, si ton compte est éligible (un essai par personne et groupe d'abonnements). L'IA est limitée pendant l'essai et, sans annulation avant la fin, le prélèvement annuel commence. Le coach a une limite d'usage contre les abus.
Débité sur ton compte Google Play. Renouvellement automatique jusqu'à annulation. Gère ou annule dans Google Play > Paiements et abonnements > Abonnements. Supprimer ton compte NIVL n'annule pas l'abonnement.

Langue
L'app et les réponses du coach sont en français. Restent en espagnol : les consentements santé et IA, la voix du coach et certains messages d'abonnement.

Conditions d'utilisation: https://nivl.app/terminos
Confidentialité: https://nivl.app/privacidad
Assistance: https://nivl.app/soporte
```

**Notas de la versión**

```
Nouveau design, noir et sobre.
Quatre modes (IRON, FOCUS, WORK et FOUNDER), chacun avec son monde, son niveau et son coach, sur abonnement. La base reste gratuite.
Le coach se met en pause si tu passes plusieurs jours sans lui écrire.
Nouvelle entrée avec un court questionnaire avant de créer ton compte.
NIVL Pro et Élite ne sont plus proposés. Si tu en as un, tu gardes l'accès tant qu'il reste actif.
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
| App Store | Texto promocional | 157 | 170 | OK |
| App Store | Descripción | 3977 | 4000 | OK |
| App Store | Palabras clave | 95 | 100 | OK |
| App Store | Novedades 1.1 | 768 | 4000 | OK |
| Google Play | Título | 30 | 30 | OK |
| Google Play | Descripción breve | 69 | 80 | OK |
| Google Play | Descripción completa | 3516 | 4000 | OK |
| Google Play | Notas de la versión | 404 | 500 | OK |

Palabras clave en bytes UTF-8: 97 de 100. Sin espacios tras la coma: sí.
Caracteres U+2014 y U+2013 en este archivo: 0.
