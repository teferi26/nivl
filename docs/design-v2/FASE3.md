# Fase 3 · Barrido de pantallas (NIVL - Experiencia)

Criterio del usuario: ninguna pantalla con el diseño viejo; verificadas a 375, 430, 744, 1024 y 1440. Lenguaje L-RADICAL (`docs/design-v2/L-RADICAL.md`, `SISTEMA.md` §5 bis, `src/components/arena`). Una sola inversión por pantalla, sin «—», sin dark patterns. No se tocan economía, API, dependencias ni app.json; `src/lib/**` solo se consume (salvo voice/notifications/useNotificationRouting). Sin prettier; conservar saltos de línea.

## Hechos

1. `theme.ts` ya traduce `colors.*`/`fonts.*` a ink: lo viejo es la COMPOSICIÓN: `ScreenHeader` (título Outfit), `Card accent/tinted`, `StatRow/Stat` (debería ser `FranjaCifras`), `XPBar` (anima en JS), `FadeIn/Stagger`, `<Modal>` sueltos con KAV (deberían ser `Sheet`), `TextInput` a mano, `SystemButton` sólido por defecto (2–4 inversiones por pantalla).
2. 15 `<Modal>` sueltos (gym×2, avances×2, economía×2, contrato×2, cardio, dieta, oráculo, perfil×3, amigos, ConsentimientoIA, ConsentimientoSalud, DenunciarIA). En web son portal a ancho completo; `Sheet` se centra a 560: pasarlos a `Sheet` arregla iPad y web.
3. Las pruebas `src/lib/__tests__/{age,health,consentguard}.test.ts` importan `EdadMinima`, `ConsentimientoSalud`, `ConsentimientoIA` y simulan `@/components/ui` (Screen, ScreenHeader, Card, Check, Section, Skeleton) y `@/components/SystemButton`, buscando por `title` ('Tu salud, con permiso', 'Confirmar y continuar', 'Aceptar y activar salud') y `accessibilityRole: 'checkbox'`. No se pueden tocar (son del Chat 3).
4. No hay componente de error compartido.

## Patrón por pantalla (igual que L-RADICAL §C)
`useX()` (efectos copiados sin reescribir) + `XVista` pura + `demo.tsx`; la ruta ~30 líneas con hojas debajo. `Entrada` solo bloques 0–7; nunca `Entrada`/`Contador` en filas; máx. 4 `Contador`; `Barra` estática en listas; Modal → `Sheet` (sin KAV); vibraciones según la tabla.

## Lote 0 · Base y estados compartidos (solo y primero)
Archivos: `ui/{EmptyState,Skeleton,Row,Chip,Interruptor,Screen}.tsx`, `arena/{EstadoSistema.tsx (nuevo), Campo.tsx (nuevo), index.ts, galeria.ts}`, `src/app/kit/pantallas.tsx`, `ErrorBoundary.tsx`, `demo.tsx` vacíos de carpetas nuevas, `SISTEMA.md`.
1. `arena/EstadoSistema.tsx`: `ErrorSistema({ mensaje, onReintentar, compacto? })` (TarjetaArena contorno, rótulo «El sistema no responde», mensaje bodySm ink8, secondary «Reintentar»); `CargaArena({ etiqueta, formas: ('franja'|'rotulo'|'tarjeta'|'filas')[] })` (accessibilityRole progressbar, Skeleton con forma).
2. `arena/Campo.tsx`: `{ etiqueta; error?; ayuda?; grande?: 'rank' } & TextInputProps`; etiqueta label ink6, fondo ink2 borde ink4, foco borde 2 ink10, alto ≥48, body, outlineStyle none en web, error bodySm ink9 con icono y accessibilityLiveRegion.
3. `EmptyState`: Button secondary sm; título headline ink9; cuerpo bodySm ink8 (≥14); icono ink6; misma API.
4. `Skeleton`: ink2 que respira a ink3 con `useMovimientoReducido()` en vivo.
5. `Row`: rebote del Check y destello respetan «reducir movimiento».
6. `Chip` (modo radio) e `Interruptor`: `vibrar('seleccion')` al cambiar.
7. `ScreenHeader` `@deprecated` + prop `inscrito` (título Cinzel mayúscula con textTransform) como plan B de las puertas.
8. Galería: `IdPantalla` suma acceso, puertas, agenda, diario, gym, cardio, nutricion, dieta, compra, avances, informe, resumen, oraculo, contrato, memoria, economia, creador; `pantallas.tsx` importa todas con `DEMO = null` (ningún lote vuelve a tocar galería); `DemoPantalla.marco?: 'pestanas'|'pila'` (pila: hueco = ancho); la página arena enseña ErrorSistema, CargaArena, Campo, EmptyState.
9. `ErrorBoundary` a tokens, Galea 48 y Button; misma lógica.

## Oleada 1 (paralelo tras el Lote 0)

### Lote A · Acceso
Archivos: `src/app/login.tsx`, `src/app/auth/restablecer.tsx`, `src/app/auth/confirmar.tsx`, `src/app/index.tsx`, `src/app/+not-found.tsx`, `src/app/c/[code].tsx`, `src/components/acceso/*` (useLogin, LoginVista, EnlaceCuenta, demo); borrar `SystemWindow.tsx`.
Login: portada ASangre con Arena arco 140 ink3, «NIVL» display tr16 ink10, lema inscripcion entre Laurel 20 (con teclado se pliega a «NIVL» inscripcion 20 sin arena); pestañas ENTRAR / CREAR CUENTA (role tab, activa con regla inferior 2 ink10, sin invertir; no en recuperar ni portal); línea del modo; `Campo` nombre/correo/contraseña (ojo 44), fuerza con Barra 4 seg 4 + faltas micro; error del servidor en TarjetaArena trama compacta (alert); INVERSIÓN Button primary lg; enlaces ghost 44; legales micro; Version. Mantener autoComplete/textContentType y el modo portal (SITIO_CREADORES).
Restablecer/confirmar con `EnlaceCuenta`: EncabezadoArena (eyebrow «Cuenta»; «NUEVA CONTRASEÑA» / «CONFIRMAR CORREO»); comprobando CargaArena; formulario; hecho TarjetaArena grano; inválido trama.
Arranque (`index.tsx`): «NIVL» inscripcion ink6 sobre Arena ovalo 220×140, accesible «Cargando»; error ErrorSistema + primary Reintentar + ghost Cerrar sesión. Lógica intacta.
404: EncabezadoArena «Ruta» / «FUERA DE LA ARENA», Arena ovalo, línea bodySm, primary «Volver a la arena». `c/[code]`: colors.bg → ink.ink0.
Demos (marco pila): entrar, crear-vacio, crear-errores, recuperar, recuperar-enviado, error-servidor, enviando, portal; restablecer comprobando/formulario/hecho/invalido; confirmar confirmando/fallo; arranque cargando/error; 404.

### Lote C · Agenda
Archivos: `src/app/(tabs)/agenda.tsx`, `src/components/agenda/*` (useAgenda, AgendaVista, Calendario, demo), `src/components/LineaDeTiempo.tsx`.
EncabezadoArena (eyebrow mes y año; «MIÉRCOLES 7» / «SEMANA 41» / «OCTUBRE»; acción add no sólida; meandro); chips radio Día·Semana·Mes + «Hoy»; flechas 44 y rango en inscripcion («6 A 12 OCT», sin «–»); semana: tira de 7 (letra micro ink6, número Cinzel 600 18, pista ink4 con relleno ink8), INVERSIÓN el día elegido, hoy con marco 2; mes: rejilla 7×6 hairline ink3, números Cinzel 600 14, marcas por forma (evento punto ink9, plazo cuadrado contorno, misiones punto ink6); día: FranjaCifras Eventos·Con hora·Misiones, Section Eventos, Por horas (LineaDeTiempo con hora Cinzel col 48), Misiones y plazos (Tag alerta si vence hoy); hojas con Campo; detalle con fecha inscripcion, hora Cinzel, danger «Eliminar evento» + ghost. iPad: mes 55 % + detalle; semana tira + dos columnas; fontScale>1.35 una columna. `dates.ts` solo se consume.
Demos: dia-lleno, semana, mes, vacio-futuro, vacio-pasado, cargando, error.

### Lote D · Diario
Archivos: `src/app/diario.tsx`, `src/components/diario/*` (+ useDiario, DiarioVista, demo).
Escritura: EncabezadoArena «Mente · hoy» / «DIARIO» con acción library-outline «Archivo»; estado en TarjetaArena grano «Registrado» o trama «Cambios sin guardar» con Barra 4 seg 8 «5 de 8 respondidas»; preguntas I–VIII (numeral cifra ink6 col 48; respondida ink10 con regla 2; título headline, pista bodySm ink8; hairline sin tarjetas); EmotionPicker chips radio; SleepStepper cifra con −/+ 44; comprobantes 76 contorno ink4; INVERSIÓN pie fijo «Registrar el día · +N XP»; un solo mecanismo de teclado (KAV de la pantalla plain).
Archivo: «ARCHIVO», FranjaCifras, MoodTrend (pista ink4 línea ink10), Flashbacks contorno, Crónica, EntryCard filas hairline (fecha Cinzel 600, extracto 2 líneas); inversión «Escribir hoy» si falta. iPad: escritura 640; archivo 2 columnas; chartWidth con onLayout.
Demos: escribir-vacio, a-medias, registrado, archivo-lleno, archivo-vacio, cargando, error-guardado.

### Lote E1 · Gimnasio y Cardio
Archivos: `src/app/gym.tsx`, `src/app/cardio.tsx`, `src/components/gym/*` (useGym, GymVista, SesionEnCurso, RutinaSemanal, demo), `src/components/cardio/*`.
Gimnasio: EncabezadoArena «Cuerpo» / «GIMNASIO», acción add «Nuevo día», meandro; FranjaCifras Días/semana·Ejercicios·XP de hoy (Contador); prescrito: filas (ejercicio Outfit 600 16, «3×8 · 60 kg» Cinzel 600 14 ink8); sesión de hoy TarjetaArena piedra remaches zocalo, INVERSIÓN «Entrenar · +N XP»; entrenando: piedra por ejercicio con tabla de series (Cinzel + Campo compactos), INVERSIÓN «Terminar sesión» (excluye la otra); rutina: contorno por día (hoy marco 2), borrar danger sm; hojas «Nuevo día» y «Ejercicio»; DescargoSalud. iPad: Sesión | Rutina; entrenando 640. NO cambiar `finishTraining`, el cerrojo `saving`, la guarda `subeNivel` ni `celebrar()`; no `avisar()` mientras se cierra un Sheet (errores en línea o en onDismiss).
Cardio: EncabezadoArena «CARDIO» con acción sólida «Registrar sesión» (INVERSIÓN); Arena ovalo a lo ancho tras FranjaCifras km·sesiones·min 28 días; filas con icono, Tag zona, cifras Cinzel; hoja con chips radio y Campo.
Demos gym: sin-rutina, rutina-hoy, entrenando, sesion-hecha, descanso, prescrito; cardio: vacio, lleno, cargando.

### Lote H · iPad, rotación y navegación
Archivos: `ui/{NavSidebar,NavRail,TabBar}.tsx`, `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`.
1. NavSidebar: la fila activa deja de invertirse (regla izq 2 ink10, fondo ink2, icono sólido, texto ink10, como el raíl); el hueco de `rango` muestra el lema entre Laurel 16 o se quita su minHeight.
2. TabBar: colors → ink.
3. `ColumnaWeb` (en `_layout.tsx`) deja de acotar a 560 las pantallas de la pila con sesión (excluye login, auth, c, onboarding).
4. Comprobar giro de iPad (raíl ↔ barra lateral) en la web a 744/1024/1194/1366 de ancho y alto.

## Oleada 2
- **B1 Puertas** (EdadMinima, ConsentimientoSalud, ConsentimientoIA, DenunciarIA, puertas/demo): pedir al Chat 3 que sus mocks admitan `@/components/arena` y `Button`; plan B con solo los nombres simulados (`ScreenHeader inscrito`, `SystemButton`). Títulos de botones intactos. Edad: «TU EDAD», piedra remaches con Check, INVERSIÓN «Confirmar y continuar», bloqueada trama + secondary + ghost. Salud: «TU SALUD, CON PERMISO», filas, Check, INVERSIÓN «Aceptar y activar salud», «Ahora no» pasa a secondary (mismo peso). IA y denuncia → Sheet.
- **B2 Perfil y hojas** (perfil.tsx, PerfilAjustes, perfil/demo, amigos.tsx, mazmorras.tsx, dungeon/[id].tsx estilos de hojas): borrar cuenta Sheet con consecuencias en trama, Campo «ELIMINAR», danger + ghost; pausa chips días + INVERSIÓN; código Campo grande rank + INVERSIÓN; PerfilAjustes sin FadeIn, avisos sin permiso en trama, «Eliminar cuenta» Button danger; amigos hoja de seguridad Sheet.
- **E2 Nutrición, Dieta, Compra.** **F Avances, Informe, Recuerdos (+ TrendLine, Heatmap; el pase no avanza solo con reducir movimiento o lector, pausa con pulsación larga, foto min(ancho, alto·9/16), sin vibración al final).** **G1 Contrato, Oráculo, Memoria.**

## Oleada 3
- **G2 Economía y Creador.** **Z Cierre:** rg de piezas viejas, `@deprecated` + `no-restricted-imports` en aviso, `kit.tsx` con EncabezadoArena, `useRetrato`/`Hexagon`, SISTEMA.md.

## Vibraciones (tabla)
| Gesto | Vibración | Movimiento |
|---|---|---|
| Elegir chip/pestaña/día/paso | `seleccion` (dentro de Chip/Interruptor/pestañas) | ninguno |
| Marcar un elemento | `seleccion` | rebote del Check 180 ms (nada con reducir movimiento) |
| Guardar con XP o firmar | `mision` (`misionExtra` con foto o bonus); NADA si la cola abre ceremonia | Contador/Barra en la cifra que cambia |
| Guardar sin XP | ninguna | cierre de la hoja |
| Borrado confirmado | `destructiva` tras `confirmar` | ninguno |
| Fallo de una acción del usuario | `penalizacion` en el catch de la acción principal (no en cargas) | ninguno |
| Llegar al final de algo que se mira | ninguna | ninguno |
| Entrar en una pantalla | ninguna | `Entrada` bloques 0–7, escalón 55 ms |

## Verificación por lote
`npx tsc --noEmit`, `npx eslint src --quiet`, `CI=true npx jest --ci`, `npx expo export --platform web` (y ios). Galería en todos los estados a 375/430/744/1024/1440 con `/kit/pantallas?pantalla=<id>&estado=<e>&ancho=<w>&quieto=1&solo=1` (export `--dev`, `--clear`, servido con `scratchpad/spa_server.py`, capturas con Chrome headless; el plan de capturas de L-RADICAL). `rg "—"` en los archivos del lote; una inversión por estado. Dispositivo: NO PROBADO hasta las OTA.
