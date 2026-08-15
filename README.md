# NIVL — El sistema

App móvil personal que gamifica la vida real al estilo Solo Leveling **y lleva dentro un coach con IA que manda en tu día**: dicta el plan hora a hora, decide qué puntúa cada tarea, te avisa, te juzga por la noche y recuerda todo lo que aprende de ti.

Stack: Expo SDK 54 (React Native 0.81 + TypeScript estricto) · expo-router · Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron) · Claude Opus 5.

## Puesta en marcha

Todo el backend se despliega con scripts; no hace falta pegar SQL a mano.

1. **Token de Supabase** — Genera uno en [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) y pégalo en `supabase-token.txt` (gitignorado).
2. **Esquema** — `node scripts/apply-migrations.mjs`. Detecta lo que falta y aplica solo eso; se puede ejecutar las veces que haga falta.
3. **El coach** — `npx supabase functions deploy coach --project-ref <ref>` y añade el secret `ANTHROPIC_API_KEY` (Panel → Edge Functions → Secrets). Ponle tope de gasto en la consola de Anthropic.
4. **Rituales automáticos** — `npx supabase functions deploy ritual --no-verify-jwt --project-ref <ref>` y después `node scripts/setup-cron.mjs`. A partir de ahí la base de datos llama al coach cada hora y decide si te toca brief, revisión o cierre de mes.
5. **Memoria** — Si vienes de otro coach, deja su volcado en `scripts/cerebro.md` y ejecuta `node scripts/import-cerebro.mjs`.
6. **Login sin fricción** — Authentication → Sign In / Providers → Email → desactiva **Confirm email**.

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
- Racha: cada 7 días completos +0,1 al multiplicador (máx ×1,5). Fallar un día la reinicia.
- Penalización al cierre: −50 % del XP base de cada misión fallada, con **tope de 150 XP/día**, y una **misión de penalización** que recupera exactamente lo perdido. En una ausencia larga se acumula: por eso los topes del esquema son altos.
- **Válvulas**: cada semana perfecta forja una Piedra de Protección (máx 3), y desde Perfil puedes pausar el sistema.
- Nivel: curva `100 × nivel^1.5`. Rangos: E (1-10) · D (11-25) · C (26-45) · B (46-70) · A (71-99) · S (100+).
- Mazmorras: tareas dan XP base, jefes ×2, botín al despejar (E 50 → S 600). Gym: 50 XP + 25 por PR. Diario: 15 XP.
- Cuerpo: cardio 40 XP (caminar 15) con **tope de 60 XP diarios** entre todas las sesiones, y 10 XP por cumplir calorías y proteína el mismo día. El tope existe porque hay seis tipos de sesión: sin él, un paseo repetido valdría más que un día entero de misiones. Pasado el tope la sesión se sigue registrando — cuenta para el estudio aunque no pague.
- **La economía es intocable desde el cliente**: `xp_total`, la racha y las piedras solo se mueven por las RPC `award_xp`, `complete_quest` y `apply_day_close` (migración 0009). El UPDATE directo está revocado.

## El coach

- **Memoria en tres capas**: `coach_dossier` (lo estable, va cacheado en cada prompt), `coach_facts` (el log fechado) y `coach_messages` (la conversación). Lo que se reenvía a la API son los **últimos 12 intercambios**: el hilo sigue siendo continuo para ti, pero la memoria larga vive en el dossier y en los hechos, no en el transcript. Sin ese tope la conversación crece sin fin y a los seis meses cada turno arrastra cientos de miles de tokens.
- **Veinte herramientas** para escribir en tu vida real: crear y ajustar misiones, planificar el día, agenda, horarios, mazmorras, reglas del contrato, metas, memoria, las tres del cuerpo — `prescribir_entreno`, `fijar_nutricion` y `planificar_comidas` — y las cuatro del dinero — `fijar_plan_economico`, `fijar_presupuesto`, `regla_categoria` y `registrar_movimiento`. Se ejecutan con tu JWT, así que RLS sigue aplicando.
- **El coach elige dificultad, nunca puntos**: el XP sale de la tabla de `game.ts` y no puede inflarlo.
- **Coste real medido** con el estudio del cuerpo y el del dinero dentro: **0,17 $ un turno en caliente** (hablando seguido, con la caché viva) y **~0,35 $ el primero** de cada rato. Un brief con herramientas ronda 0,40 $. Queda registrado turno a turno en `coach_runs`; se ve en la app en Coach → icono de memoria.
- **De dónde sale ese coste**: el prefijo —voz, doctrina, dossier y estado del día— son unos 70.000 tokens que se cachean juntos. El estado va en el bloque de **sistema** a propósito: colgado del turno del usuario quedaba detrás del último punto de caché y se pagaba entero en cada vuelta del bucle de herramientas, que eran 0,60 $ por turno. Del historial se quitan además los bloques de pensamiento y los resultados largos, que no aportan nada pasado su turno y se pagaban enteros cada vez.
- **Necesita saldo en Anthropic.** Cuando se acaba, el coach lo dice con esas palabras y con el enlace para recargar, en vez de un "reintenta más tarde" que no ayuda.

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

## Mapa de la app

6 pestañas: **Sistema** (orden del día + misiones + módulos), **Coach** (el chat), **Misiones**, **Mazmorras**, **Agenda**, **Perfil**. Módulos desde Sistema: Gym, Cardio, Nutrición, Dieta, Economía, Compra, Diario, Informe, Avances, Oráculo y Contrato. Pantalla **Memoria** desde el chat del coach.

Verificación: `npm run typecheck` · `npm test` (95 tests) · `npm run lint` · `npx expo export --platform ios`.

## Notas

- Una notificación no es una alarma del sistema: en iOS no suena en silencio ni en Modo Concentración salvo con *Critical Alerts*, que requiere permiso expreso de Apple. Mantén también la alarma del reloj.
- Evidencias comprimidas (calidad 0.4) y con ruta determinista, para no llenar el free tier de Storage.
- El muro de pago está apagado (`EXPO_PUBLIC_PAYWALL`); todo el camino de Stripe sigue en el repositorio para cuando se reactive.
