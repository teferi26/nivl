# Ficha de tienda NIVL 1.1: Portugués (Portugal)

Propuesta del 9 de noviembre de 2026. **No se ha aplicado en ninguna consola.** Sale del código de la versión 1.1.0, no de fichas anteriores. Lo que hay dentro de los bloques de código es lo que se pega; lo demás es para el dueño.

App Store Connect: Portuguese (Portugal), pt-PT. Google Play: pt-PT. El catálogo de la app está en portugués de Portugal: no copiar a pt-BR sin adaptar ("subscrição", "definições", "ginásio").

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
NIVL: Hábitos e Disciplina
```

**Subtítulo**

```
Missões, sequências e coach IA
```

**Texto promocional**

```
Novo design, quatro modos com o seu coach e ligação opcional à Saúde da Apple, Apple Watch e GPS. A base continua grátis; coach e modos têm subscrição.
```

**Descripción**

```
O NIVL transforma os teus hábitos em missões diárias. Cumpres e sobes de nível. Falhas e o sistema diz-to sem rodeios. Tu és o gladiador; o teu dia, a arena.

A BASE É GRÁTIS
Missões, hábitos, sequência, patentes de E a S e fecho do dia.
Campanhas e agenda por blocos. Podes ligar o teu calendário: o NIVL apenas o lê.
Registo de ginásio, cardio, refeições, peso e diário. Temporizador de foco e exames.
Finanças pessoais, à mão ou com extrato CSV. O NIVL não se liga ao teu banco nem movimenta dinheiro.
Ligas, duelos semanais e ranking com amigos, sem chat entre pessoas. Podes denunciar e bloquear qualquer utilizador; não são tolerados conteúdos ofensivos nem abusos.

SAÚDE DA APPLE, APPLE WATCH E GPS
Opcional, ativado à parte. A app funciona sem isto.
Saúde da Apple (HealthKit): tu escolhes o que o NIVL lê (treinos, passos, energia ativa, frequência cardíaca, sono e peso) para te mostrar a tua evolução. Se autorizares, guarda na Saúde os treinos que medes. Nunca é usado para publicidade.
GPS do iPhone: mede corrida e bicicleta. Usa a tua localização apenas durante a sessão que tu inicias, mesmo com o ecrã desligado e com o indicador azul visível.
Apple Watch: missões, sequência, foco, descansos e treinos de corrida, bicicleta, natação e força. Precisa da app do iPhone.
As medições são indicativas, sem precisão médica.

O COACH DE IA, COM SUBSCRIÇÃO
Lê os teus dados antes de responder e põe o teu dia em ordem: briefing de manhã, plano por blocos, revisão semanal e memória. No chat, cria missões e muda a tua agenda. Propõe séries, cargas e objetivos alimentares a partir do que registas.
É uma IA e pode enganar-se: revê o que te propõe.

QUATRO MODOS, COM SUBSCRIÇÃO
Cada modo abre o seu mundo, o seu nível e o seu coach.
IRON: treino, cardio, dieta e resistência.
FOCUS: matéria, exames e distribuição do estudo.
WORK: dia de trabalho, projetos, horas e finanças.
FOUNDER: agenda, finanças do negócio e os teus números.

OS TEUS DADOS E A IA
O coach usa modelos da Anthropic, um fornecedor externo de IA. Antes da primeira utilização, pede-te autorização expressa para enviar dados da tua conta, que podem incluir dados de saúde (peso, refeições, diário, treinos medidos com frequência cardíaca média e máxima) e o título e as horas do teu calendário, se o ligares. O resumo diário da Saúde exige um interruptor à parte. As rotas GPS não são enviadas. Sem publicidade. Em Perfil, podes retirar a autorização, exportar os teus dados e eliminar a tua conta.

O QUE O NIVL NÃO É
O NIVL não é um serviço médico, nutricional ou psicológico, nem um consultor financeiro. Não diagnostica, não trata e não dá aconselhamento de investimento. Em caso de dor, lesão ou problema de saúde, consulta um profissional. Para pessoas com 16 anos ou mais.

SUBSCRIÇÕES
A base é grátis. O coach e os modos requerem subscrição com renovação automática, mensal ou anual: um modo ou os quatro.
Um modo inclui o seu mundo, o seu coach e o coach geral do NIVL. Comprar outro modo substitui o atual; só os quatro abrem vários ao mesmo tempo.
Só os planos anuais incluem 7 dias grátis, se a tua conta for elegível (um período experimental por pessoa e grupo de subscrições). A IA é limitada nesse período e, se não cancelares antes do fim, começa a cobrança anual. O coach tem um limite de utilização contra abusos.
Cobrado na tua conta Apple. Renova-se automaticamente, salvo se cancelares pelo menos 24 horas antes do fim do período. Gere e cancela em Definições > o teu nome > Subscrições. Eliminar a tua conta NIVL não cancela a subscrição.

IDIOMA
A app e as respostas do coach estão em português. Continuam em espanhol: os consentimentos de saúde e IA, os pedidos de permissão do sistema, a voz do coach, algumas mensagens de subscrição e a app do Apple Watch.

Termos de utilização: https://nivl.app/terminos
Privacidade: https://nivl.app/privacidad
Contrato de licença da Apple (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
```

**Palabras clave**

```
rotina,ginásio,dieta,metas,objetivos,motivação,estudo,diário,ligas,treino,agenda,exames,gastos
```

**Novedades de la versión 1.1**

```
Novidades do NIVL 1.1:

- Novo design, preto e sóbrio.
- Quatro modos: IRON, FOCUS, WORK e FOUNDER. Cada um com o seu mundo, o seu nível e o seu coach, com subscrição. A base continua grátis.
- Ligação opcional à Saúde da Apple: tu escolhes o que o NIVL lê.
- Apple Watch: missões de hoje, sequência, foco, descansos e treinos com frequência cardíaca.
- Mede corridas e voltas de bicicleta com o GPS do iPhone, mesmo com o ecrã desligado, apenas durante a sessão que tu inicias.
- O coach entra em pausa se passares vários dias sem lhe escrever. Reativas quando quiseres.
- Nova entrada: um questionário curto antes de criares a conta.
- O NIVL Pro e o Élite deixam de ser oferecidos. Se tiveres um, manténs o acesso enquanto estiver ativo.
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
NIVL: Hábitos e Disciplina
```

**Descripción breve**

```
Os teus hábitos em missões e sequências. Coach de IA com subscrição.
```

**Descripción completa**

```
O NIVL transforma os teus hábitos em missões diárias. Cumpres e sobes de nível. Falhas e o sistema diz-to sem rodeios. Tu és o gladiador; o teu dia, a arena.

A base é grátis
Missões, hábitos, sequência, patentes de E a S e fecho do dia.
Campanhas e agenda por blocos. Podes ligar o teu calendário: o NIVL apenas o lê.
Registo de ginásio, cardio, refeições, peso e diário. Temporizador de foco e exames.
Finanças pessoais, à mão ou com extrato CSV. O NIVL não se liga ao teu banco nem movimenta dinheiro.
Ligas, duelos semanais e ranking com amigos, sem chat entre pessoas. Podes denunciar e bloquear qualquer utilizador; não são tolerados conteúdos ofensivos nem abusos.
Fotos de progresso privadas, apenas para maiores de 18.

No Android, o NIVL não mede treinos com GPS nem se liga a relógios ou apps de saúde: os treinos registam-se à mão.

O coach de IA, com subscrição
Lê os teus dados antes de responder e põe o teu dia em ordem: briefing de manhã, plano por blocos, revisão semanal e memória. No chat, cria missões e muda a tua agenda. Propõe séries, cargas e objetivos alimentares a partir do que registas.
Se passares vários dias sem lhe escrever, entra em pausa até o reativares.
É uma IA e pode enganar-se: revê o que te propõe.

Quatro modos, com subscrição
Cada modo abre o seu mundo, o seu nível e o seu coach.
IRON: treino, cardio, dieta e resistência.
FOCUS: matéria, exames e distribuição do estudo.
WORK: dia de trabalho, projetos, horas e finanças.
FOUNDER: agenda, finanças do negócio e os teus números.

Os teus dados e a IA
O coach usa modelos da Anthropic, um fornecedor externo de IA. Antes da primeira utilização, pede-te autorização expressa para lhe enviar dados da tua conta, que podem incluir dados de saúde (peso, refeições, treinos e diário) e o título e as horas do teu calendário, se o ligares. Sem publicidade. Em Perfil, podes retirar a autorização, exportar os teus dados e eliminar a tua conta.

O que o NIVL não é
O NIVL não é um serviço médico, nutricional ou psicológico, nem um consultor financeiro. Não diagnostica, não trata e não dá aconselhamento de investimento. Em caso de dor, lesão ou problema de saúde, consulta um profissional. Para pessoas com 16 anos ou mais.

Subscrições
A base é grátis. O coach e os modos requerem subscrição com renovação automática, mensal ou anual: um modo ou os quatro.
O preço na tua moeda aparece na loja antes de pagares.
Um modo inclui o seu mundo, o seu coach e o coach geral do NIVL. Comprar outro modo substitui o atual; só os quatro abrem vários ao mesmo tempo.
Só os planos anuais incluem 7 dias grátis, se a tua conta for elegível (um período experimental por pessoa e grupo de subscrições). A IA é limitada nesse período e, se não cancelares antes do fim, começa a cobrança anual. O coach tem um limite de utilização contra abusos.
Cobrado na tua conta Google Play. Renova-se automaticamente até cancelares. Gere e cancela em Google Play > Pagamentos e subscrições > Subscrições. Eliminar a tua conta NIVL não cancela a subscrição.

Idioma
A app e as respostas do coach estão em português. Continuam em espanhol: os consentimentos de saúde e IA, a voz do coach e algumas mensagens de subscrição.

Termos de utilização: https://nivl.app/terminos
Privacidade: https://nivl.app/privacidad
Apoio: https://nivl.app/soporte
```

**Notas de la versión**

```
Novo design, preto e sóbrio.
Quatro modos (IRON, FOCUS, WORK e FOUNDER), cada um com o seu mundo, nível e coach, com subscrição. A base continua grátis.
O coach entra em pausa se passares vários dias sem lhe escrever.
Nova entrada com um questionário curto antes de criares a conta.
O NIVL Pro e o Élite deixam de ser oferecidos. Se tiveres um, manténs o acesso enquanto estiver ativo.
```

**URL**

- Política de privacidad: https://nivl.app/privacidad
- Eliminación de cuenta (se declara en consola): https://nivl.app/borrar-cuenta

## Recuento

Medido con script (Node, puntos de código). Límite de cada consola a 9 de noviembre de 2026.

| Tienda | Campo | Caracteres | Límite | Estado |
|---|---|---:|---:|---|
| App Store | Nombre | 26 | 30 | OK |
| App Store | Subtítulo | 30 | 30 | OK |
| App Store | Texto promocional | 151 | 170 | OK |
| App Store | Descripción | 3955 | 4000 | OK |
| App Store | Palabras clave | 94 | 100 | OK |
| App Store | Novedades 1.1 | 740 | 4000 | OK |
| Google Play | Título | 26 | 30 | OK |
| Google Play | Descripción breve | 68 | 80 | OK |
| Google Play | Descripción completa | 3306 | 4000 | OK |
| Google Play | Notas de la versión | 385 | 500 | OK |

Palabras clave en bytes UTF-8: 98 de 100. Sin espacios tras la coma: sí.
Caracteres U+2014 y U+2013 en este archivo: 0.
