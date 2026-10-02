# L-RADICAL · rediseño de verdad (Chat 4)

El usuario ve v2 como un recoloreado en blanco y negro con la misma estructura. Este lote rehace la composición de las pantallas más vistas con el lenguaje de las maquetas (`docs/design-v2/maquetas/`). Criterio de cierre por pantalla: **¿se nota a primera vista que es otra app?**

Marca: arena/gladiador, Cinzel + Outfit, blanco hueso y negro (monocromo). Las referencias a Solo Leveling de agentes y skills están obsoletas. Una sola inversión por pantalla. Ningún «—» visible; cifra vacía «-». En la interfaz «campañas», nunca «mazmorras». Sin prettier. No se tocan dependencias, app.json, API, economía, `src/lib/**` ni archivos de otros chats.

## 0. Comprobado

- Reanimated 4.1.7 + react-native-worklets 0.5.1 instalados; `babel-preset-expo` añade solo el plugin de worklets: **no crear babel.config.js**. Nadie usa Reanimated aún en `src`. Usar `scheduleOnRN` de `react-native-worklets` (no `runOnJS`). `ReduceMotion` se exporta de Reanimated.
- `src/app/_layout.tsx` abre zona pública y quita el tope de ancho si `segments[0] === 'kit'`: la galería de pantallas es `src/app/kit/pantallas.tsx` (convive con `src/app/kit.tsx`).
- HoyiPad.dc pinta el panel a 1180, pero con `huecoContenido(1180)` el hueco es 940 (medium) y no cabe aside: **manda el código**, el panel sale a partir de ~1268 de ventana.
- Paywall.dc invierte plan y CTA (dos inversiones): ver B.5.
- Con Supabase: `achievements`, `dayplan`, `social`, `pro`, `coach`, `dungeons`, `links`. Puros: `progression`, `closing`, `game`, `kinds`, `socialmath`, `proplans`, `habits`, `dates`, `voice`. Las vistas puras solo usan `import type` de los primeros.

## A. Base común (E0, antes que nada) · `src/components/arena/`

### A.0 Tokens y kit (solo E0)

`src/design/tokens.ts`, sin cambiar lo existente:
```ts
// en `type`:
monumento:   { family: 'Cinzel_700Bold',     size: 112, lineHeight: 112, tracking: 0 },
monumentoSm: { family: 'Cinzel_700Bold',     size: 72,  lineHeight: 72,  tracking: 0 },
cifra:       { family: 'Cinzel_600SemiBold', size: 32,  lineHeight: 36,  tracking: 0 },
inscripcion: { family: 'Cinzel_700Bold',     size: 14,  lineHeight: 18,  tracking: 4 },
// en `motion`:
escalon: 55,
```
`src/design/__tests__/tokens.test.ts` debe seguir pasando (tamaños ≥ 11). Comprueba que las familias Cinzel existen en la carga de fuentes.

- `src/components/ui/Screen.tsx`: exporta `GutterContext = createContext<number>(20)` y lo publica con el `gutter` real (incluido `MARGEN_SIN_PANEL`) envolviendo el cuerpo.
- `src/components/ui/Texture.tsx`: exporta `useIdSeguro` (hoy privado).
- `src/components/ui/index.ts` no se toca: la arena se importa de `@/components/arena`.
- `docs/design-v2/SISTEMA.md`: nueva «§5 bis Arena» con tres excepciones deliberadas: (1) títulos de pantalla en Cinzel mayúscula (`EncabezadoArena`); (2) grano en ink3 de fondo en los Hero (decoración de bajo contraste, no es «logro»); (3) la inversión puede ser una fila de una lista («lo activo»).

### A.1 `arena/cifras.ts` (puro, test en `arena/__tests__/cifras.test.ts`)
```ts
export function formatoMiles(n: number): string;   // 1840 → «1.840» (no toLocaleString: es-ES no agrupa 4 cifras)
export function romano(n: number): string;         // 1..39; fuera, String(n)
export function ordinal(n: number): string;        // 3 → «3.º»
export function ratioSeguro(a: number, b: number): number; // b<=0 → 1; acotado 0..1
```

### A.2 `arena/geometria.ts` (puro, con test): cadenas `d` de los SVG
```ts
export function pathLaurel(alto: number): string;               // rama vertical viewBox 0 0 24 64
export function pathColumna(alto: number, ancho?: number): string;
export function pathArena(ancho: number, alto: number, gradas: number, variante: 'arco' | 'ovalo'): string;
export const MEANDRO_UNIDAD = 10;
export const PATH_MEANDRO = 'M0 9.5H10 M0.5 9.5V0.5H8.5V6.5H3.5V3.5H6';
```
- Laurel: tallo `M18 62 C6 48 6 20 16 2`, hojas en pares a y = 50, 38, 26, 14 (`l-7 -3`, `l-7 -4`, `l-6 -5`, `l-4 -6` por fuera; espejo más corto por dentro). Sale de la rama de Perfil.dc puesta en vertical.
- Columna dórica: capitel `M2 4H22 M4 8H20`, fuste `M6 8V{h-10} M18 8V{h-10}`, estrías `M10 12V{h-14} M14 12V{h-14}`, basa `M4 {h-8}H20 M2 {h-4}H22`.
- Arena `arco`: `gradas` semielipses concéntricas centradas en (ancho/2, alto), rx = ancho·(0,47 − 0,08·i), ry = alto·(0,92 − 0,18·i), más 15 arcadas (marcas radiales de 8 pt sobre la grada exterior en θ = π·(k+0,5)/15). `ovalo`: dos elipses y la línea del eje.

### A.3 `arena/Motivos.tsx`
Un trazo; todos con `accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`, `pointerEvents="none"`, `strokeLinecap="round"`, `fill="none"`.
```ts
export function Laurel(p: { alto: number; lado: 'izq' | 'der'; color?: string /* ink6 */; trazo?: number /* 1.5 */ }): JSX.Element;
export function Columna(p: { alto: number; ancho?: number /* 24 */; color?: string /* ink4 */ }): JSX.Element;
export function Arena(p: { ancho: number; alto: number; variante: 'arco' | 'ovalo'; gradas?: number /* 3 */; color?: string /* ink3 */ }): JSX.Element;
export function Meandro(p: { alto?: 8 | 12; color?: string /* ink4 */; style?: StyleProp<ViewStyle> }): JSX.Element; // ancho del padre; Pattern con useIdSeguro
export { Crown as Galea } from '@/components/ui/Crown';
```
`Laurel lado="der"` = espejo con `transform={[{ scaleX: -1 }]}`. Columna y arena no están en las maquetas: mismo trazo, hairline ink3/ink4, sin relleno.

### A.4 `arena/Contador.tsx` (Reanimated)
```ts
interface ContadorProps {
  valor: number; desde?: number | null; duracion?: number /* 700 */;
  formato?: (n: number) => string /* formatoMiles */; sufijo?: string;
  style?: StyleProp<TextStyle>; accessibilityLabel?: string /* valor FINAL */;
  maxFontSizeMultiplier?: number; adjustsFontSizeToFit?: boolean;
}
```
`useSharedValue(desde ?? valor)` + estado `shown`; al cambiar `valor`: `withTiming(valor, { duration, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })`; `useAnimatedReaction(() => Math.round(sv.value), (v, p) => { if (v !== p) scheduleOnRN(setShown, v) })`. Con movimiento reducido, valor directo. El Text anuncia el valor final. Como mucho 4 Contadores por pantalla y ninguno en filas de lista.

### A.5 `arena/Barra.tsx` (Reanimated)
```ts
interface BarraProps { ratio: number; desde?: number | null; alto?: 4 | 6 | 8 /* 6 */;
  segmentos?: number; tono?: 'blanco' | 'ink8'; etiqueta: string }
```
Pista View ink4; relleno `Animated.View` a ancho completo con `transform: [{ scaleX }]` y `transformOrigin: 'left'` (sin onLayout). `withSpring(ratio, { damping: 18, reduceMotion: ReduceMotion.System })`. Cortes de 2 pt en ink0 si `segmentos` ≤ 30. `accessibilityRole="progressbar"`, `accessibilityValue={{ min: 0, max: 100, now }}`. No sustituye a `XPBar`.

### A.6 `arena/Entrada.tsx`
`{ indice?: number; children; style? }`. `Animated.View` con `entering` a mano (worklet): de `{ opacity: 0, translateY: 14 }` con `withDelay(min(indice, 8) * motion.escalon, withTiming(...))`, 260 ms opacidad y 320 ms traslación. Movimiento reducido → `entering={undefined}`. Solo bloques de pantalla y los 8 primeros de una lista.

### A.7 `arena/TarjetaArena.tsx`
```ts
interface TarjetaArenaProps {
  variante?: 'piedra' | 'contorno' | 'trama' | 'grano' | 'invertida'; // Card surface | outline | alerta | logro | inverse
  remaches?: boolean; zocalo?: boolean; marco?: 1 | 2 | 3; rotulo?: string; meta?: string;
  padded?: boolean; onPress?: () => void; onLongPress?: () => void; accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>; children: ReactNode;
}
```
Usa `Card` por dentro (conserva `SuperficieContext` y `PressScale`), `marginBottom: 0`. Remaches: 4 cuadrados 3×3 ink6 en esquinas (ink0 sobre invertida). Zócalo: envoltorio `paddingRight: 4, paddingBottom: 4` + View absoluta en (4,4) con borde ink3 detrás (la losa, no sombra).

### A.8 `arena/EncabezadoArena.tsx` y `arena/ASangre.tsx`
```ts
interface EncabezadoArenaProps {
  eyebrow?: string; titulo: string /* MAYÚSCULAS con type.rank, ink10 */; subtitulo?: string;
  onVolver?: () => void;
  accion?: { icono: keyof typeof Ionicons.glyphMap; etiqueta: string; onPress: () => void; solida?: boolean };
  derecha?: ReactNode; meandro?: boolean /* una por pantalla */;
}
export function ASangre(p: { children: ReactNode; style?: StyleProp<ViewStyle> }): JSX.Element; // marginHorizontal: -useContext(GutterContext)
```

### A.9 `arena/FranjaCifras.tsx`
```ts
interface Cifra { valor: number | string; rotulo: string; sufijo?: string; desde?: number | null; etiqueta?: string }
interface FranjaCifrasProps { cifras: Cifra[]; centrado?: boolean }
```
2 a 4 celdas `flex: 1` con hairlines verticales ink3; valor en `type.cifra` (Contador si número, `maxFontSizeMultiplier` 1, `adjustsFontSizeToFit`); rótulo `micro` ink6 mayúsculas; cada celda `accessible` «{rótulo}: {valor}».

### A.10 `arena/HeroRango.tsx`
```ts
export interface HeroRangoProps {
  variante: 'hoy' | 'perfil'; cargando?: boolean;
  nivel: number; rango: Rank | null; titulo: string;
  xpEnNivel: number; xpSiguiente: number; // 0 = nivel máximo
  racha: number; rachaCerrada: boolean; piedras: number; piedrasMax?: number;
  eyebrow?: string; linea?: string; avatar: { path: string | null; nombre: string };
  cifraExtra?: Cifra; desde?: { nivel: number; xpRatio: number; racha: number } | null;
  accion?: { icono: keyof typeof Ionicons.glyphMap; etiqueta: string; onPress: () => void };
  onAvatar?: () => void; avatarOcupado?: boolean; nombre?: ReactNode; insignia?: ReactNode;
}
```
**hoy** (Main.dc, Nivel.dc, Tarjeta-racha), a sangre, fondo ink0, padding lateral = gutter:
1. Fila: eyebrow `label` ink6 a la izquierda; a la derecha botón agenda 44 (`calendar-outline`, si hay `accion`) y Avatar 44 con marco (`onAvatar`).
2. Monumento centrado: `Laurel izq alto 88` · Contador del nivel en `type.monumento` ink10 · `Laurel der`; detrás `Arena arco` ancho completo × 120 ink3 anclada abajo; con `rango.grain > 0`, Grano ink3 de fondo. `maxFontSizeMultiplier 1`, `numberOfLines 1`, `adjustsFontSizeToFit`; 3 cifras en hueco < 360 → `monumentoSm`.
3. «RANGO {R} · {TÍTULO}» `type.inscripcion` ink9, 8 pt bajo el número.
4. `linea` `bodySm` ink8 centrada, 2 líneas máx.
5. Fila `micro` ink6 «{xp} / {sig} XP» y «NIVEL {n+1}» (tope: «NIVEL MÁXIMO»); `Barra alto 6, 10 segmentos, desde`.
6. `FranjaCifras`: RACHA (sufijo «d»; cerrada → rótulo «RACHA · HOY CUENTA»), `cifraExtra`, PIEDRAS.
7. `Meandro alto 8` a sangre como cierre (único de Hoy).
Accesibilidad: un View accesible con el resumen («Nivel 23, rango A, Héroe de la arena. 1.840 de 2.200 XP. Racha de 12 días.»); avatar y agenda fuera, como botones.

**perfil** (Perfil.dc), centrada: `Arena ovalo` 220×140 ink3 detrás del avatar; Avatar 120 (corona si B+), pulsable con placa de cámara; slot `nombre` + `insignia`; «{TÍTULO}» · {tipo} en `inscripcion` ink8; FranjaCifras NIVEL · RANGO (letra en `cifra`) · RACHA · PIEDRAS p/max; Barra 6; borde inferior 3 ink10. Sin meandro.

### A.11 Galería solo desarrollo
- `arena/galeria.ts`: `EstadoDemo { id; titulo; render: () => ReactElement }`, `DemoPantalla { id: 'hoy'|'coach'|'perfil'|'amigos'|'onboarding'|'habitos'|'campanas'; titulo; estados: EstadoDemo[] }`.
- `arena/demoDatos.ts`: `perfilDemo(p?)`, `misionDemo(p)`, `HOY_DEMO = '2026-10-02'`.
- Esqueletos `export const DEMO: DemoPantalla | null = null;` en `src/components/{hoy,coach,perfil,amigos,onboarding,habitos,campanas}/demo.tsx` (habitos y campanas son carpetas nuevas). Cada encargo rellena solo el suyo.
- `src/app/kit/pantallas.tsx`: `!__DEV__` → `<Redirect href="/" />`; params `pantalla`, `estado`, `ancho`; chips de pantalla, estado y ancho (375 · 430 · 744 · 1024 · 1440) y una página «arena» que enseña cada pieza de la base; debajo un View de `width = min(ancho, ventana)` con borde hairline envuelto en `<TopeAncho.Provider value={huecoContenido(ancho).ancho}>`.
- `src/app/kit.tsx`: enlace «Pantallas» a `/kit/pantallas`. Las rutas tipadas se regeneran arrancando Metro unos segundos.

## B. Especificación por pantalla

Comunes: rótulos de sección con `Section`; cifras en Cinzel; lectura en Outfit ≥ 14; una sola inversión; sin «—».

### B.1 Hoy
1. `HeroRango hoy`: eyebrow `formatLongDate()`; `linea` = saludo + estado del día («Buenas tardes, Teferi. 2 misiones por delante.»); `cifraExtra = { valor: '3/5', rotulo: 'Misiones' }`; `accion` agenda solo si `navActual === 'tabs'`; `onAvatar` → `/(tabs)/perfil`; `desde` = último valor visto en una variable de módulo `ultimoHero` en `useHoy` (primera carga sube desde 0).
2. Avisos con `Entrada`: pausa → `TarjetaArena contorno` «SISTEMA EN PAUSA»; cierre → `trama` «ALERTA DEL SISTEMA» o `contorno` «INFORME DEL CIERRE» (texto como `lineas: string[]`).
3. Día perfecto: `TarjetaArena grano` «DÍA PERFECTO» + `Button primary sm` «Compartir» (la inversión cuando no queda nada).
4. Misiones de hoy: `Section` meta «3/5», tono alerta según la regla actual; filas con hairline sin tarjeta envolvente (Main.dc). `QuestItem` rediseñado:
   - penalización: fila en `TarjetaArena trama` (candado en el aro, «Penalización: …», texto de recuperación, «+204» Cinzel);
   - **la siguiente pendiente** (primera que no es penalización, extra ni hecha) = **inversión de Hoy**: bloque ink10 padding 16, `micro` «SIGUIENTE», título `headline` ink0, meta `micro` ink3, XP Cinzel 600 18 ink0, Check con aro ink0 1,5;
   - pendiente normal: Check aro ink4, título Outfit 600 16 ink9, meta `micro` ink6 («INT · Intelecto»), «+30» Cinzel 600 16 ink6 + «XP» `micro`;
   - hecha: Check blanco, título ink6 tachado, «+50» Cinzel ink10.
   - Después, igual que hoy: línea de recuperación, `voice.allDone()`, línea RET-05 o «A medianoche…», línea Pro.
5. Orden del día (`OrdenDelDia` retocado): hora Cinzel 600 13 ink6 en columna de 48; bloque actual con regla izquierda 2 ink10.
6. Duelo de la semana (HoyiPad.dc; sustituye la fila de rivalidad): «Tú» + XP Cinzel 14 + `Barra blanco alto 4`; rival ink8 + `Barra ink8`; `lineaRivalidad` `bodySm` ink8; todo pulsable → `/amigos`.
7. Módulos: misma rejilla; azulejo ink1, icono 22 ink10, rótulo `micro` ink8; «Más · N» se queda.
8. Lema «UN 1 % MEJOR CADA DÍA» en `inscripcion` ink6 entre dos `Laurel` de 20.
A 744/1024: Hero a lo ancho, dos columnas (Misiones | Orden + Duelo), Módulos a lo ancho; una columna si `fontScale > 1.35`. A 1440 con panel: `PanelHoy` = tarjeta del coach (solo Pro: CoachMark 48, «Coach», «Pídele el plan, ajusta el día o pregúntale.») + Duelo (entonces no va en el cuerpo). Fuera: `ScreenHeader` con saludo y `ProgressRing`, `TarjetaRango` (se borra el archivo), fila de rivalidad, pulso del anillo.

### B.2 Coach
1. Cabecera fija con borde inferior ink3: `CoachMark 48`; «COACH» en `type.rank` (o `inscripcion` 20 si no cabe a 375); `micro` ink6 «Ha leído tu día · N consultas» (último turno; sin consultas «Listo para tu día»); `Tag` «PROFUNDO» si el modo visible es profundo; iconos 44 `flash-outline` (Pro) y `library-outline` (Memoria, solo Pro) con su `accessibilityLabel`.
2. Vacío con Pro: `Arena ovalo` 260×160 ink3 con `Galea casco 96` ink10 en el centro; «EL SISTEMA TE ESCUCHA.» `inscripcion`; texto actual `body` ink8; descargo `micro` ink6; atajos como píldoras que bajan de línea.
3. Bloqueado (`CoachBloqueado` → `components/coach/CoachBloqueado.tsx`): mismo contenido con la galea en `TarjetaArena trama remaches`.
4. Conversación: burbuja del usuario ink2 a la derecha, máx. 78 %, `body` 15/21; `MensajeCoach` igual; separador «HOY»/«AYER» solo si la burbuja trae fecha (si no, se omite).
5. Avisos de energía y banda Pro: misma lógica.
6. Compositor: franja encima; campo ink2 borde ink4 alto mín. 48 `body` 15; micrófono 48 en círculo aro 3 ink10 fondo ink0; **enviar 48 círculo ink10 con flecha ink0 = la inversión**; adjuntar `add` ink8 a la izquierda; selector de potencia encima de la franja.
Fuera: eyebrow «EL SISTEMA» y título en Outfit; cápsulas «Pro» y «Memoria» con texto.

### B.3 Perfil
1. `HeroRango perfil` (nombre = el TextInput actual; insignia EliteBadge 22; `onAvatar = pickAvatar`); debajo el aviso de revisión del nombre en `micro` ink6.
2. Camino de rangos (Perfil.dc): 6 casillas de 44 en rejilla de 6 con hueco 6; **alcanzados invertidos (ink10, letra Cinzel ink0) = la inversión**; actual borde 3 ink10; futuros hairline ink4 letra ink6; debajo `textoSiguiente()` `bodySm` ink8.
3. Arena (lista con hairline): «Compartir mi progreso», «Amigos y duelos», «NIVL Pro/Élite» (meta «Activo» o «Activa el coach»), «Código de creador» y «Panel de creador» con las condiciones actuales.
4. Pausa: `TarjetaArena contorno` si la hay.
5. Logros: `Section` meta N/M tono logro; rejilla 3 columnas (4 en medium); desbloqueado `TarjetaArena grano` con `ribbon` 22 ink10, nombre `micro` ink9 y Tag del título; bloqueado `contorno` con candado ink6.
6. Estadísticas: abreviatura Cinzel 600 14 ink10, nombre `micro` ink6, `Barra alto 4`, puntos Cinzel 600 16; «Registro» con `FranjaCifras` (Misiones, % con evidencia, Multiplicador).
7. `Meandro` a sangre + `Section` «Ajustes» con `PerfilAjustes` (todo lo de «Para qué uso NIVL» a «Eliminar cuenta», movido sin rediseñar).
Fuera: tarjeta de cabecera y tarjeta XP (multiplicador → Registro; frase de racha → `linea` del Hero).

### B.4 Amigos
1. `EncabezadoArena` eyebrow «Arena», «AMIGOS», subtítulo actual, `onVolver`, acción «Compartir mi semana», `meandro`.
2. Podio (`components/amigos/Podio.tsx`) con 3+: columnas 2.º·1.º·3.º con `Columna` 96/128/72 ink4; encima Avatar 48 (rango si se conoce), nombre `micro` ink8, valor Cinzel 600 18; puesto en `cifra` sobre la base. Debajo «Tu puesto: 3.º de 8» en `inscripcion`. Con 1-2 rivales, solo la línea.
3. Ranking: chips y línea de rivalidad como ahora; `ListaRanking` (puesto Cinzel 600 20 ink6 en 36, Avatar 32, nombre `bodySm` 600, valor Cinzel 600 16); **mi fila invertida = la inversión**; arena vacía → `EmptyState` con «Invitar al primero» sólido.
4. Duelos y ligas: `<Competicion>` igual; solo sus barras de duelo pasan a `Barra` (mía blanco, rival ink8).
5. Solicitudes igual. 6. Tu código: `TarjetaArena piedra remaches`, código en `type.rank` tracking 6, frase de privacidad, «Copiar» e «Invitar» secondary. 7. Añadir por código, Tu ludus (`Section tone="logro"`), Tus invitados (`FranjaCifras`). 8. Fuera del ranking, Convivencia y Privacidad igual.
El ranking sube justo tras el podio; «Tu código» baja.

### B.5 Pro (especificación para el Chat 2) y onboarding
Pro/ProOffer (solo texto para el Chat 2): orden Paywall.dc (cerrar 44 · eyebrow del momento · título 30/34 · línea body ink8 · radiogroup de planes con tienda abierta · separador flexible · CTA primary lg 52 con doble filo · «Seguir gratis» ghost · renovación 11/15 ink6 · enlaces 44). Plan elegido con marco 3 ink10 y precio Cinzel 600 20, no invertido; la inversión es el CTA. Tienda cerrada según AGENTS.md. Opcional: `Laurel` 20 a los lados de «NIVL PRO» en `inscripcion`.
Condiciones de cumplimiento del Chat 2 (3.1.2/5.6 y Google), por delante de la maqueta: (a) cada fila del radiogroup muestra título de la tienda, duración y priceString, y el precio cobrado es la cifra más destacada; (b) renovación en `bodySm` (≥ 12), no 11/15; (c) «Seguir gratis» con contraste ≥ ink8 y zona de 44; (d) «Restaurar» visible con tienda abierta, junto a los enlaces de 44; (e) eyebrow y título del momento desde COPY_UPSELL, sin urgencias ni cuentas atrás.
Onboarding (nuestro): `ProgresoPasos { paso; total }` (Barra 4 con `segmentos=total`, «PASO {romano} DE {romano}» `micro` ink6, a11y «Paso 3 de 7»); paso 0 `PortadaArena` (Arena arco a sangre 200, «NIVL» `display` tracking 16, Laurel a los lados de «UN 1 % MEJOR CADA DÍA», lore en `TarjetaArena contorno remaches`, descargo; «Entrar en la arena» en el pie = inversión); paso 5 `TablillaContrato { parrafos; abreEl }` (`TarjetaArena piedra remaches zocalo`, «CONTRATO» `inscripcion`, Meandro arriba y abajo dentro, párrafos con `Entrada`, fecha `micro`; `HoldToSign` intacto); pasos 1-4 y 6: solo título de paso (`inscripcion` como eyebrow + `title`). Paso 6 sigue con `ProOfferBody/Actions/Legal` sin tocarlos; `pasoOferta.ts` no se toca.

### B.6 Hábitos
1. `EncabezadoArena` «Constancia» / «HÁBITOS», subtítulo, `meandro`, acción «Nuevo hábito» sólida si hay en curso (inversión).
2. `FranjaCifras`: En forja, Mejor racha (d), Listos, Adquiridos.
3. Reglas del contrato · hoy igual (Check 24, tono alerta si quedan).
4. En forja: `TarjetaArena piedra remaches` por hábito (pulsable): título Outfit 600 16, Contador de racha en `cifra` con «/21»; `Barra alto 8 segmentos=objetivo`; fila `Semana` con días programados en borde 1 ink10 (no invertidos); «Faltan N días» `micro`. Consolidable → `grano` con «Darlo por adquirido» secondary. `Entrada` en los 8 primeros.
5. Adquiridos: filas con `Laurel` 18 y valor Cinzel 600 16.

### B.7 Campañas (`mazmorras.tsx`, `dungeon/[id].tsx`)
Lista: `EncabezadoArena` (título `meta.campaignsLabel` en mayúsculas, subtítulo `campaignsHint`, `meandro`, acción «Abrir campaña» `flag-outline`, sólida si hay abiertas); `FranjaCifras` Abiertas · Despejadas · Botín; abiertas como `TarjetaArena piedra zocalo` con `Estandarte` (vexilo con muesca en V, un trazo ink10, letra Cinzel 700, grosor por rango D1/C2/B+3; props `{ letra; ancho: 40|72; grosor: 1|2|3 }`), título Outfit 600 16 2 líneas, meta «4/9 tareas · INT», plazo `Tag alerta` si urge, `Barra 4`, % Cinzel 600 14 y «Botín 300 XP» `micro`; despejadas en `Section tone="logro"` con Estandarte 40 grosor 1 y «+300 XP» Cinzel.
Detalle: `EncabezadoArena` con volver, «Campaña», título en mayúsculas (si > 28 caracteres, `headline` Outfit), `derecha = Estandarte 72`, `meandro`; plazo en `TarjetaArena` (`trama` vencida, `piedra` si no) con «N días» en `cifra`; progreso `Barra 6 segmentos=min(tareas,20)` + «4/9 TAREAS»; **botín `TarjetaArena invertida` «Reclamar botín · +N XP» = la inversión**, solo cuando corresponde; tareas con Check; jefe final con `Galea casco 20` + Tag «Jefe final»; abandonar/borrar igual.

## C. Datos y vista

Patrón: `useX()` (efectos, Supabase, refs y cerrojos, **cortados y pegados sin reescribir**) devuelve `{ vista; hojas }`; `XVista` puro con props (puede usar `useSizeClass`, `useAnchoUtil`, `router.push`); la ruta queda en ~30 líneas con las hojas/modales debajo. Las vistas importan módulos con efectos solo con `import type`. Primero un commit «refactor: hook y vista sin cambio visual», luego el rediseño.

- **Hoy (E1)**: `hoy/derivarHoy.ts` (puro, con test en `hoy/__tests__/derivarHoy.test.ts`; recibe `hoy` y `hora` desde fuera), `hoy/useHoy.ts` (líneas ~96-597 de index.tsx, con `ultimoPro` y `ultimoHero`), `hoy/HoyVista.tsx`. `HoyVistaProps { estado; error; datos: HoyDatos | null; ocupada; preparandoTarjeta; refrescando; acciones: { onCompletar, onAlternarBloque, onCompartirDia, onRefrescar, onReintentar } }`. index.tsx: `<HoyVista {...h.vista} />` + `<CompletarSheet …/>`. `OrdenDelDia` importa ayudantes de `dayplan` (Supabase): vale en la galería, no en jest. Estados demo: lleno, penalizacion, perfecto, vacio, pausa, cargando, error.
- **Coach (E2)**: `coach/useCoach.ts`, `coach/CoachVista.tsx`, `coach/CoachBloqueado.tsx`; en coach.tsx se quedan `HealthConsentGuard`, la hoja de consentimiento, `HojaPrivacidadDictado` y `DenunciarIA`. `dictadoDemo` se copia a `coach/demo.tsx`. Estados: conversacion, vacio-pro, bloqueado, pensando, energia, cargando, grabando.
- **Perfil (E3)**: `perfil/usePerfil.ts`, `perfil/PerfilVista.tsx`, `perfil/PerfilAjustes.tsx` (movido); la ruta conserva las hojas de pausa, código y borrar; `ajustes: ReactNode` (null en la galería). Estados: rango-E, rango-A, rango-S-elite, cargando.
- **Amigos (E4)**: `amigos/useAmigos.ts`, `AmigosVista.tsx`, `Podio.tsx`, `ListaRanking.tsx`; `competicion: ReactNode` (slot, null en galería); la ruta conserva la hoja de seguridad.
- **Hábitos (E6)**: `habitos/useHabitos.ts`, `HabitosVista.tsx`; `QuestForm` en la ruta. Estados: lleno (uno consolidable), vacio, cargando.
- **Campañas (E7)**: `campanas/useCampanas.ts` (incluida la consulta a `dungeon_tasks` que hoy está en la pantalla), `CampanasVista.tsx`, `useCampana.ts`, `CampanaVista.tsx`, `Estandarte.tsx`; hojas en las rutas. Estados: abiertas, vacio, detalle-con-jefe, detalle-vencida, detalle-botin.
- **Onboarding (E5)**: sin hook; solo piezas puras `PortadaArena`, `TablillaContrato`, `ProgresoPasos` en la galería.

## D. Reparto

E0 primero y solo. Luego en paralelo, con archivos exclusivos:

| Encargo | Archivos exclusivos |
|---|---|
| E0 Base | `src/components/arena/**`, `src/design/tokens.ts` (+ test), `ui/Screen.tsx`, `ui/Texture.tsx` (solo el export), `src/app/kit.tsx`, `src/app/kit/pantallas.tsx`, los 7 `demo.tsx` esqueleto, `docs/design-v2/SISTEMA.md` |
| E1 Hoy | `src/app/(tabs)/index.tsx`, `src/components/hoy/*` (borra `TarjetaRango.tsx`), `QuestItem.tsx`, `OrdenDelDia.tsx` |
| E2 Coach | `src/app/(tabs)/coach.tsx`, `src/components/coach/*` |
| E3 Perfil | `src/app/(tabs)/perfil.tsx`, `src/components/perfil/*` |
| E4 Amigos | `src/app/amigos.tsx`, `src/components/amigos/*` |
| E5 Onboarding | `src/app/onboarding.tsx`, `src/components/onboarding/*` (sin tocar `pasoOferta.ts`); espec. Pro en `docs/design-v2/encargos/pro-chat2.md` |
| E6 Hábitos | `src/app/(tabs)/habitos.tsx`, `src/components/habitos/*` |
| E7 Campañas | `src/app/(tabs)/mazmorras.tsx`, `src/app/dungeon/[id].tsx`, `src/components/campanas/*` |

Nadie toca: package.json, app.json, lockfile, babel.config.js, `src/lib/**`, `ui/**` (salvo E0), `arena/**` (salvo E0), XPBar, SystemButton, CompletarSheet, HoldToSign, EliteBadge, `celebracion/**`, `share/**`, pro.tsx, ProOffer.tsx, `_layout.tsx`. Si un encargo necesita algo nuevo de la base, lo crea local en su carpeta y lo anota.

### Riesgos
1. Listas: `Entrada` acotada a 8; nada de Contador ni `entering` en filas de ranking ni en el hilo del Coach; `layout` de Reanimated prohibido.
2. Web: `transformOrigin`/`scaleX` funcionan en RNW; `entering` a mano funciona; Pattern con `useIdSeguro`; verificar con `npx expo export --platform web`.
3. Jest: no se pintan componentes de Reanimated; solo lo puro (cifras, geometria, derivarHoy y los derivar*).
4. Accesibilidad: motivos ocultos; Contador anuncia el final; Barra progressbar; Hero como grupo con resumen; zonas táctiles ≥ 44; monumentos `maxFontSizeMultiplier` 1, rótulos 1,35; texto sobre invertida en ink0/ink3 (ink6 sobre blanco no llega).
5. Tamaños: a 375 el Hero con 3 cifras baja a `monumentoSm`; a 744 hueco 672 y a 1024 hueco 784 (medium, dos columnas, sin panel); a 1440 hueco 1200 con panel.
6. Inversión única: cada encargo dice cuál es la suya. `Check` hecho, `CoachMark` y los días de `Semana` no cuentan como superficie.
7. Mover código: commit de refactor sin cambio visual antes del rediseño; Coach es el de más riesgo (dictado, Escuchar/Parar, adjuntar, 402/429).
8. Rutas tipadas: `/kit/pantallas` necesita arrancar Metro unos segundos.

### Verificación por pantalla
1. `npx tsc --noEmit`, `npx eslint src --quiet`, `CI=true npx jest --ci`, `npx expo export --platform ios` (y web si toca base o animación).
2. Galería: `/kit/pantallas?pantalla=<id>&estado=<estado>&ancho=375|744|1024|1440`, todos los estados.
3. Una sola inversión; `rg -n "—"`, `rg -in "mazmorra"` (solo en rutas o identificadores) y `rg -n "#[0-9A-Fa-f]{3,6}"` sobre sus archivos.
4. Dispositivo (NO PROBADO hasta que alguien lo haga): flujos clave por pantalla y «Reducir movimiento».

## Fuera de alcance
Agenda, Diario, módulos y resto de pantallas; sustituir `ScreenHeader`/`XPBar` globales; pasar la ceremonia a Reanimated; tarjetas de compartir (Chat 1); pro.tsx y ProOffer.tsx (solo espec.); cita real del coach en el panel de Hoy; rediseño a fondo de `Competicion`; pasos 1-4 y 6 del onboarding más allá del título y el progreso; separador por días del Coach si no hay fecha.
