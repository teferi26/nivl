# NIVL — Un 1 % mejor cada día

App de hábitos de la gente de **Franky**. Gamifica la vida real como una arena (misiones con XP, niveles y rangos, racha, campañas con jefe final) **y lleva dentro un coach con IA que manda en tu día**: dicta el plan hora a hora, decide qué puntúa cada tarea, te avisa, te juzga por la noche y recuerda todo lo que aprende de ti.

Sirve igual a un emprendedor, a un deportista, a un estudiante o a cualquiera que quiera mejorar en general: en el alta eliges **para qué la usas** y eso ordena lo que ves primero, los hábitos que te propone y el énfasis del coach (ver "Perfiles de uso"). Estética: monocromo de gladiador (negro, hueso, hierro; el rojo avisa y el oro corona), tipografía Cinzel + Outfit (la de Franky).

Stack: Expo SDK 54 (React Native 0.81 + TypeScript estricto) · expo-router · Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron) · Claude Sonnet 5.

## La cuenta es la de Franky

Se entra con el correo y la contraseña de Franky, y crear cuenta desde NIVL crea una cuenta Franky. Las dos plataformas viven en proyectos de Supabase distintos (esquemas incompatibles), así que el puente es la Edge Function `franky-auth`: comprueba las credenciales contra Auth de Franky, garantiza el usuario NIVL con ese correo y devuelve un token de un solo uso que la app canjea con `verifyOtp`. La contraseña no se guarda en NIVL; la recuperación es en franky.es/recuperar. Detalle y garantías en la cabecera de `supabase/functions/franky-auth/index.ts`.

Despliegue del puente (una vez):

```bash
npx supabase functions deploy franky-auth --no-verify-jwt --project-ref <ref>
npx supabase secrets set FRANKY_SUPABASE_URL=https://<ref-franky>.supabase.co FRANKY_SUPABASE_ANON_KEY=<clave pública de Franky> FRANKY_WEB_URL=https://franky.es
```

Las cuentas creadas en NIVL antes del puente siguen entrando por "¿Cuenta antigua de NIVL?" en la pantalla de acceso. Si el correo coincide con el de Franky, el puente reutiliza esa misma cuenta y todo su historial.

## Perfiles de uso

`profiles.profile_kind` (migración 0018): **emprendedor · deportista · estudiante · general**. No oculta nada; ordena:

| Perfil | Módulos delante | Campañas se llaman | Hábitos propuestos |
|---|---|---|---|
| Emprendedor | Economía, Contrato, Informe, Avances, Diario, Oráculo | Proyectos | prospección, trabajo profundo, métricas… |
| Deportista | Gym, Cardio, Nutrición, Dieta, Avances, Compra | Bloques | entrenar, comidas, dormir 8 h, movilidad, pesarse… |
| Estudiante | Diario, Informe, Avances, Oráculo, Contrato, Recuerdos | Asignaturas | estudiar 2 h, repasar, sin móvil en clase… |
| General | todos | Campañas | entrenar, trabajo o estudio, comidas, leer, diario |

La definición vive en `src/lib/kinds.ts` (con tests) y el coach recibe el mismo perfil desde `supabase/functions/_shared/kinds.ts`. Se cambia en Perfil → "Para qué uso NIVL".

## Puesta en marcha

Todo el backend se despliega con scripts; no hace falta pegar SQL a mano.

1. **Token de Supabase** — Genera uno en [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) y pégalo en `supabase-token.txt` (gitignorado).
2. **Esquema** — `node scripts/apply-migrations.mjs`. Detecta lo que falta y aplica solo eso; se puede ejecutar las veces que haga falta.
3. **El coach** — `npx supabase functions deploy coach --project-ref <ref>` y añade el secret `ANTHROPIC_API_KEY` (Panel → Edge Functions → Secrets). Ponle tope de gasto en la consola de Anthropic.
4. **Rituales automáticos** — `npx supabase functions deploy ritual --no-verify-jwt --project-ref <ref>` y después `node scripts/setup-cron.mjs`. A partir de ahí la base de datos llama al coach cada hora y decide si te toca brief, revisión o cierre de mes.
5. **Memoria** — Si vienes de otro coach, deja su volcado en `scripts/cerebro.md` y ejecuta `node scripts/import-cerebro.mjs`.
6. **Login** — Authentication → Sign In / Providers → Email activado (el puente crea los usuarios ya confirmados). Ver "La cuenta es la de Franky".

Comprobar que el coach responde de punta a punta:

```bash
node scripts/smoke-coach.mjs "Preséntate y dime qué recuerdas de mí"
node scripts/setup-cron.mjs --comprobar
```

## Desarrollo diario

```bash
npm start
```

Las notificaciones y el push **no funcionan en Expo Go**: hace falta un development build o un build de EAS.

## Cómo funciona el juego

- XP por dificultad: trivial 10 · fácil 25 · media 50 · difícil 100 · épica 250.
- Evidencia (foto en el momento): +25 % XP.
- Racha: cada 7 días completos +0,1 al multiplicador (máx ×1,5). **Un día cuenta si fallas como mucho el 30% de lo programado**, redondeando hacia abajo: con ocho misiones se perdonan dos, con tres no se perdona ninguna. Fallar más la reinicia. El XP de lo fallado se pierde igual — la tolerancia salva la racha, no el bolsillo. Todo o nada no funcionaba: con ocho misiones diarias un día perfecto es raro, dos seguidos casi imposible, y la racha nunca pasaba de 1.
- Penalización al cierre: −50 % del XP base de cada misión fallada, con **tope de 150 XP/día**, y una **misión de penalización** que recupera exactamente lo perdido. En una ausencia larga se acumula: por eso los topes del esquema son altos.
- **Válvulas**: cada semana **perfecta** —siete días al 100%, no siete días cumplidos— forja una Piedra de Protección (máx 3), y desde Perfil puedes pausar el sistema. La piedra exige perfección a propósito: si se ablandara con la racha, la válvula pasaría de ganarse a regalarse.
- Nivel: curva `100 × nivel^1.5`. Rangos: E (1-10) · D (11-25) · C (26-45) · B (46-70) · A (71-99) · S (100+).
- Campañas: tareas dan XP base, jefes ×2, botín al despejar (E 50 → S 600). Gym: 50 XP + 25 por PR. Diario: 15 XP.
- Cuerpo: cardio 40 XP (caminar 15) con **tope de 60 XP diarios** entre todas las sesiones, y 10 XP por cumplir calorías y proteína el mismo día. El tope existe porque hay seis tipos de sesión: sin él, un paseo repetido valdría más que un día entero de misiones. Pasado el tope la sesión se sigue registrando — cuenta para el estudio aunque no pague.
- **La economía es intocable desde el cliente**: `xp_total`, la racha y las piedras solo se mueven por las RPC `award_xp`, `complete_quest` y `apply_day_close` (migración 0009). El UPDATE directo está revocado.

## El coach

- **Memoria en tres capas**: `coach_dossier` (lo estable, va cacheado en cada prompt), `coach_facts` (el log fechado) y `coach_messages` (la conversación). Lo que se reenvía a la API son los **últimos 12 intercambios**: el hilo sigue siendo continuo para ti, pero la memoria larga vive en el dossier y en los hechos, no en el transcript. Sin ese tope la conversación crece sin fin y a los seis meses cada turno arrastra cientos de miles de tokens.
- **Veintiuna herramientas** para escribir en tu vida real: crear y ajustar misiones, planificar el día, agenda, horarios, campañas, reglas del contrato, metas, memoria, las tres del cuerpo — `prescribir_entreno`, `fijar_nutricion` y `planificar_comidas` — y las cuatro del dinero — `fijar_plan_economico`, `fijar_presupuesto`, `regla_categoria` y `registrar_movimiento` — más `configurar_rutina`, que reescribe la rutina fija de un día del gimnasio (los ejercicios del programa, no la carga de una sesión suelta). Se ejecutan con tu JWT, así que RLS sigue aplicando.
- **El coach elige dificultad, nunca puntos**: el XP sale de la tabla de `game.ts` y no puede inflarlo.
### Cambiar de proveedor sin tocar código

El coach habla con Anthropic por defecto, pero puede hablar con **cualquier API compatible con OpenAI** — DeepSeek, Gemini (capa compatible), Qwen, Kimi, Groq o la propia OpenAI. Se hace con tres secrets en el panel de Supabase:

```
COACH_BASE_URL   https://api.deepseek.com/v1
COACH_API_KEY    <la clave del proveedor>
COACH_MODEL_CHAT deepseek-chat
```

Con `COACH_BASE_URL` y `COACH_API_KEY` puestos, `_shared/openai.ts` traduce a la ida y a la vuelta: las 21 herramientas, el estudio, la doctrina y la memoria funcionan igual. Quitando los secrets se vuelve a Claude en el acto.

**Por qué importa**: medido sobre una semana real, el coste lo domina el prefijo de ~78.000 fichas que se escribe en caché en cada conversación nueva. Con Claude son 0,19 $ por turno en frío; con DeepSeek o Gemini Flash ronda 0,03 $. Para uso personal da igual; para monetizar es la diferencia entre viable e inviable.

DeepSeek cobra casi el doble en hora punta (01-04 y 06-10 UTC). En la tabla va **siempre la tarifa de punta**: el freno de gasto tiene que pecar de caro. Fuera de punta lo real es la mitad de lo apuntado.

Las tarifas de cada modelo están en `PRICE_PER_MTOK` (`_shared/anthropic.ts`) y hay que revisarlas: cambian más a menudo que las de Anthropic. Un modelo que no esté en la tabla se cobra como Opus, para que el freno de gasto peque de caro.

### Qué modelo hace cada cosa

| Tarea | Modelo | Por qué |
|---|---|---|
| Chat, brief, plan del día, revisión semanal, cierre de mes, escalada | **Sonnet 5** | Todo eso es criterio: cruzar dominios, decidir cargas, escribir la carta de las tres puertas |
| Clasificar movimientos del extracto | **Haiku 4.5** | Leer "MERCADONA 4471" y decir que es súper no pide criterio. Además sale **antes** de construir el contexto: no viajan las 50.000 fichas de dossier y estudios |
| Titular del push tras un ritual | **Haiku 4.5** | Resumir en una línea un texto ya escrito |
| Resumen semanal y mensual en imágenes | **Sonnet 5** | Redactar con calidez sobre datos ya calculados; son 5 llamadas al mes |
| Misiones desde un objetivo (Oráculo) | **Haiku 4.5** | Rellenar una plantilla con salida estructurada |

La regla: **si la tarea es leer y transformar, Haiku; si es decidir, Sonnet.** Un extracto entero de sesenta movimientos se clasifica por céntimas; con el coach costaría cien veces más, y no por la tarifa del modelo sino porque arrastraría todo su contexto para responder algo que cabe en una línea.

Los dos secretos `COACH_MODEL_CHAT` y `COACH_MODEL_RITUAL` permiten cambiar el modelo del coach desde el panel de Supabase sin desplegar, por si algún día quieres probar otro y comparar en `coach_runs`.

- **El modelo del coach es `claude-sonnet-5`**, no Opus. La tarea del coach es leer un estudio ya calculado, aplicar una doctrina escrita y llamar a la herramienta correcta; la aritmética fina no la hace él, sale de `analytics.ts` y `finance.ts`. Con Opus el turno costaba 0,42 $ en frío, que para el uso real son del orden de 150 €/mes. Haiku se descartó a propósito: con veinte herramientas y 50.000 tokens de contexto es donde empiezan a elegirse herramientas equivocadas, y aquí eso se traduce en cargas de gimnasio y en dinero.
- **Coste por turno, medido sobre Sonnet 5**: **0,19 $ el primero de cada conversación** y **0,021 $ los siguientes**. La diferencia es de casi diez veces, y toda está en el prefijo: el primer turno escribe las ~76.000 fichas en caché y el resto las lee a una décima parte. Con Opus eran 0,42 $ y 0,17 $.
- **Factura estimada con esas cifras**: ~12 €/mes con una conversación al día, **~19 €/mes** con dos, ~42 €/mes si te agarras al chat cinco veces al día. Por eso **hablar del tirón sale casi diez veces más barato que abrir el chat cinco veces**, y por eso Haiku en el chat ya solo ahorraría unos 9 €/mes: no compensa arriesgar el criterio.
- **Lo que manda en la factura no son los mensajes, son las veces que abres el chat.** La caché dura 5 minutos: el primer turno de cada conversación escribe las ~70.000 fichas del prefijo y los siguientes las leen a una décima parte. Diez mensajes del tirón cuestan menos de la mitad que esos diez repartidos por el día.
- **De dónde sale ese prefijo**: voz, doctrina, dossier y estado del día. El estado va en el bloque de **sistema** a propósito: colgado del turno del usuario quedaba detrás del último punto de caché y se pagaba entero en cada vuelta del bucle de herramientas. Del historial se quitan además los bloques de pensamiento y los resultados largos, que no aportan nada pasado su turno.
- **Necesita saldo en Anthropic.** Cuando se acaba, el coach lo dice con esas palabras y con el enlace para recargar, en vez de un "reintenta más tarde" que no ayuda.
- **Con veinte herramientas y sin `strict`, la red de seguridad es el esquema**: los CHECK de Postgres y el ejecutor rechazan lo inválido y el error vuelve al modelo para que lo corrija. Eso es lo que permite bajar de modelo sin que se le vaya la cabeza.

## El entrenador: cómo ajusta lo siguiente con lo que registras

El bucle es prescribir → ejecutar → registrar → ajustar. Lo que lo cierra es que el coach nunca ve tu historial en bruto, sino un **estudio** ya calculado (`supabase/functions/_shared/analytics.ts`):

- **Fuerza**: 1RM estimado por Epley de cada ejercicio, su variación en 28 días y el RPE medio. El **RPE es el dato que decide la carga**: ≤7 con las repeticiones completas sube el escalón, 8-9 mantiene, 10 baja un 10 %. Por eso el campo RPE está en la pantalla de Gym al lado del peso.
- **Peso corporal**: tendencia por regresión sobre 28 días, no el último pesaje — una báscula oscila ±1 kg de un día para otro y el último dato es ruido.
- **Cardio**: volumen por tipo, comparación con los 28 días anteriores y evolución del ritmo **solo dentro de la misma zona** (un Z2 y unos intervalos no son la misma prueba).
- **Nutrición y adherencia**: porcentaje de días cumplidos y sesiones prescritas frente a realizadas. Si la adherencia es alta y el peso no se mueve dos semanas, el fallo está en el objetivo y el coach lo recalcula en vez de apretar.

La doctrina que aplica sobre esos números está escrita y versionada en `supabase/functions/_shared/knowledge.ts`, con sus límites: no es médico, y para dolor articular, mareos o señales de trastorno alimentario manda parar y derivar. La matemática es determinista y está cubierta por tests; la IA decide qué hacer con las cifras, no las inventa.

## El dinero: en qué se te va y si llegas

Mismo bucle que el cuerpo, aplicado a la economía. `supabase/functions/_shared/finance.ts` calcula el estudio y el coach decide sobre él:

- **Cargos recurrentes**: agrupa por cobrador normalizado (`AMZN Mktp ES*2K4L9` y `AMZN Mktp ES*7H1P2` son el mismo comercio) y saca lo que se repite tres meses o más con importe estable, con su **coste anual**. Lo que sangra no suele ser una compra grande.
- **Ritmo de gasto**: a mitad de mes ya dice si vas a cerrar por encima del tope, en vez de avisarte el día 30 cuando ya no hay margen.
- **Meses de aire**: saldo entre el gasto medio. Es la cifra que permite decir que no a un mal cliente.
- **Tasa de ahorro** por mes cerrado, y gasto por categoría comparado con su propia media.
- **Sin clasificar**: lo que no tiene categoría no está en ningún presupuesto, así que el coach pregunta por los mayores y escribe una regla para que se clasifiquen solos a partir de entonces.

La doctrina y sus límites están en `knowledge.ts`: primero los cargos recurrentes, luego las categorías desviadas y por último el gasto del día; **ingresos antes que recortes** (un recorte tiene suelo, una venta no); y tres cosas que no hace nunca — no da consejo de inversión, no mueve dinero, y no entra en fiscalidad concreta.

### Importar movimientos

```bash
node scripts/import-revolut.mjs extracto.csv
```

El CSV sale de la app de Revolut → Menú → Extractos → formato **Excel/CSV** (no PDF). Se puede ejecutar las veces que quieras y con rangos solapados: cada movimiento lleva una huella estable y los repetidos se descartan. Con `--seco` enseña lo que importaría sin escribir nada.

Para conexión automática por open banking (PSD2), sin CSV:

```bash
node scripts/setup-banco.mjs --conectar
```

Necesita una cuenta gratuita en GoCardless Bank Account Data y sus dos credenciales en `banco-token.txt` (gitignorado). El consentimiento PSD2 caduca a los 90 días y hay que renovarlo.

## La agenda

Tres vistas que de verdad son tres cosas distintas, no la misma lista repetida:

- **Día** — eje de horas con los bloques del plan del coach colocados por su hora y su duración, los eventos con hora, y una línea roja marcando el momento actual.
- **Semana** — tira de siete días con una barra de carga por día, y debajo el día elegido en su eje.
- **Mes** — rejilla con puntos por tipo, y debajo el día elegido en su eje.

Lo que no tiene hora —misiones del día, deadlines de campaña, eventos sin hora— va a una tira superior, como el "todo el día" de cualquier calendario: meterlo en el eje obligaría a inventarle una hora que no tiene.

La colocación vive en `src/lib/timeline.ts`, con tests: una hora mide siempre lo mismo, el eje se recorta a las horas con contenido (un día de 5:00 a 22:00 no necesita seis horas de vacío arriba), y lo que se solapa se reparte el ancho **por tramo**, así que dos citas a las 9:00 no dejan la tarde a media pantalla.

## El contrato se marca cada día

Las reglas innegociables aparecen en Hábitos y se marcan como **cumplidas**. Lo que quede sin marcar al cerrar el día cuenta como roto: 25 XP por regla y su consecuencia al día siguiente.

Antes una regla solo existía cuando confesabas haberla roto, y eso deja el contrato en manos de la honestidad del peor momento del día.

Tres guardas para que sea exigente sin ser una emboscada: el castigo diario **se agrega y se topa** en 150 XP (seis reglas por seis días de ausencia serían 900 de golpe), la consecuencia es **una sola** aunque caigan varias (seis castigos el mismo día no se hacen, se abandonan), y **el juicio no empieza hasta la primera vez que marcas algo** — quien nunca ha marcado no está incumpliendo, está sin enterarse.

## Hábitos

La pestaña donde se ve **cada hábito por separado**: lectura, skincare, correr, nadar, los correos, las llamadas en frío. La racha del perfil es global y se rompe si fallas cualquier cosa; esta cuenta cada uno por su cuenta y solo los días en los que tocaba — un hábito de lunes a viernes no se rompe el domingo.

A los **21 días seguidos** se puede consolidar, y la decisión es tuya: puedes seguir contando, o darlo por adquirido. Consolidarlo es la recompensa de verdad — **deja de pedirte el toque diario y deja de poder romperte la racha**— y son 100 XP de una vez. Se puede volver a exigir con una pulsación larga.

No hay tabla de hábitos: un hábito y una misión recurrente son la misma cosa mirada en dos momentos. Separarlas habría obligado a duplicar completadas, XP, racha y todas las herramientas del coach.

## El formato del coach

El coach escribe en markdown porque así piensa: **negrita** para la cifra que importa, viñetas para las órdenes. En pantalla salía en crudo, con los asteriscos a la vista. `src/lib/markdown.ts` lo convierte en algo pintable — negrita, títulos, viñetas y numeradas — sin meter una librería, que traería su propia tipografía a pelear con el sistema de diseño.

Solo se soporta lo que el coach usa de verdad. El `*` suelto **no** es cursiva a propósito: aparece constantemente en cifras ("3*10", "×1,5") y tratarlo como formato dejaba frases mutiladas.

## El diario: cómo el coach te va conociendo

Es la pieza que más le enseña sobre ti, así que entra **entero en su contexto**: las últimas 10 entradas con ánimo, energía y tus propias palabras. No es algo que consulte si se le ocurre — lo lee siempre, y con la doctrina de que dos días seguidos por debajo de 3 son una señal, no una queja.

La pantalla navega por días con las flechas: puedes leer y **editar cualquier día pasado**, y arriba se ve de un vistazo si ese día está `REGISTRADO` o `SIN REGISTRAR`, más un aviso de cambios sin guardar. Tocar una entrada de la lista salta a ese día.

Los 15 XP solo se pagan escribiendo **hoy o ayer**. Rellenar dos semanas de golpe completa tu archivo igual, pero no debe pagar veinte entradas de una sentada: eso convertiría la reflexión en una granja.

## Recuerdos: la semana en imágenes

Al completar una misión el sistema ofrece hacerle una foto. Suma un 25 % de XP —eso ya existía como evidencia— y **la misma foto queda además como recuerdo**: pedirla dos veces sería absurdo.

El domingo, o cuando lo pidas, esas fotos se convierten en un pase de diapositivas: portada, las cifras que importan, una diapositiva por foto contando qué pasaba ese día, el día que costó, y un cierre. Se toca la mitad derecha para avanzar y la izquierda para volver, con barras de progreso arriba.

Dos reglas: **sin fotos no hay resumen** (un pase vacío no motiva, recuerda que no registraste nada) y **no se inventa nada** — las cifras se calculan en `_shared/recap.ts` y el modelo solo redacta. El semanal lo pides tú; el mensual lo monta el sistema solo el día 1 y te avisa.

También puedes **mandarle fotos al coach en el chat** con el botón `+`. Viajan solo en ese turno: en el historial queda la marca, nunca los bytes, o cada turno siguiente arrastraría megabytes.

## Mapa de la app

6 pestañas: **Hoy** (orden del día + misiones + módulos según perfil), **Coach** (el chat), **Hábitos**, **Campañas** (campañas en rutas y BD), **Agenda**, **Perfil**. Módulos desde Hoy: Gym, Cardio, Nutrición, Dieta, Economía, Recuerdos, Compra, Diario, Informe, Avances, Oráculo y Contrato. Pantalla **Memoria** desde el chat del coach.

Verificación: `npm run typecheck` · `npm test` (164 tests) · `npm run lint` · `npx expo export --platform ios`.

## Notas

- Una notificación no es una alarma del sistema: en iOS no suena en silencio ni en Modo Concentración salvo con *Critical Alerts*, que requiere permiso expreso de Apple. Mantén también la alarma del reloj.
- Evidencias comprimidas (calidad 0.4) y con ruta determinista, para no llenar el free tier de Storage.
- El muro de pago está apagado (`EXPO_PUBLIC_PAYWALL`); todo el camino de Stripe sigue en el repositorio para cuando se reactive.
