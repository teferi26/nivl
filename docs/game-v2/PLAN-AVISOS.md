# Plan de avisos del sistema (E6)

Dueño de la lógica: Chat 5. Código: `src/lib/notifyPlan.ts` (puro) y `src/lib/__tests__/notifyPlan.test.ts`.
Cableado y copy: Chat 4 (`src/lib/notifications.ts`). Ritual del servidor: coordinador (`supabase/functions/ritual/`).

## Qué decide y qué no

`planDeAvisos(estado, ahora) → Aviso[]` decide **qué** avisos del sistema merece hoy el gladiador y **a qué hora**. No programa nada, no escribe copy y no conoce la zona horaria de la máquina: trabaja con claves `YYYY-MM-DD` y minutos del día en hora local de pared.

Fuera de su alcance:

- El **despertador** y los **avisos de bloque/cierre del plan** que ya programa `notifications.ts`. Son alarmas que pide el usuario, no avisos del sistema, y no gastan el cupo de 2. Sí caducan, ver RET-06 más abajo.
- Cualquier aviso **promocional o de compra**. Son del Chat 2 y no entran aquí. Este módulo no tiene ningún tipo para ellos, a propósito.

## Reglas

| Regla | Valor |
|---|---|
| Avisos locales del sistema | como mucho **2 al día** (cuenta lo ya disparado hoy) |
| Push del servidor (ritual) | como mucho **1 al día**, aparte |
| Silencio | fuera de `[wake_time, sleep_time)`; sin perfil, **08:00–22:00**. Si `sleep_time` pasa de medianoche, el día se corta a las 24:00. Una ventana de menos de 6 h se trata como dato corrupto y se usa la de defecto |
| Separación | nunca dos avisos (locales o push) a **menos de 3 h** |
| Enfriamiento | **24 h** entre dos avisos del mismo tipo |
| Caducidad | 0–6 días sin abrir: normal. Día 7: solo la vuelta. Días 8–29: nada. Día 30: la última vuelta. Día 31 en adelante: **silencio total** |
| Prioridad si no caben | racha > recuperación > duelo > foto > rango |

### Eventos

| `tipo` | Cuándo existe | Hora preferida (margen) | `datos` |
|---|---|---|---|
| `racha` | `streakDays > 0`, sin `rachaProtegida` y `rachaVisible(...).faltan > 0` (quedan misiones que la romperían con el mismo criterio que el cierre) | `sleep_time − 90 min`, o 21:30 sin perfil. **Solo se adelanta**, hasta 2 h; nunca se retrasa | `{ racha, faltan }` |
| `recuperacion` | hay una misión de penalización de hoy sin completar | 17:00 (15:00–19:00) | `{ desbloqueada, pista, xp }`. `pista` es `'completa_una_mision'` si `recuperacionDesbloqueada` es false; si no, `null` |
| `duelo` | `duelosPendientes > 0` (aceptados o resueltos sin ver) | 19:00 (10:00–22:00) | `{ pendientes }` |
| `foto` | domingo y `fotosPendientes > 0` | 11:00 (10:00–20:00) | `{ pendientes }` |
| `rango` | `celebracionPendiente` | 13:00 (10:00–21:00) | `{ clave }` (la de la celebración, o `null`) |
| `vuelta` | siempre, a la última apertura +7 y +30 días | 12:00 (10:00–20:00) | `{ dias: 7 \| 30 }` |

Todo margen se recorta a la ventana activa y a después de `ahora`. Si la hora preferida choca, se prueba en pasos de 15 min, la más cercana primero. Si no cabe en su margen, ese día no hay aviso de ese tipo, y no se acumula.

Un día sin misiones no tiene racha que perder, así que no hay aviso de racha. Si ese día solo hay una penalización, la recuperación sale desbloqueada (no hay candado sin misiones válidas, RET-03).

### Salida

```ts
interface Aviso {
  id: string;          // estable: nivl.aviso.<tipo>.<fecha>; vuelta: nivl.aviso.vuelta7.<fecha> / vuelta30
  tipo: 'racha' | 'recuperacion' | 'duelo' | 'foto' | 'rango' | 'vuelta';
  cuando: string;      // 'YYYY-MM-DDTHH:MM' local de pared, sin zona
  titulo?: undefined;  // siempre vacío: el copy es del Chat 4
  datos: DatosAviso;   // unión discriminada por tipo
  prioridad: number;   // vuelta 0, racha 1 … rango 5
}
```

Va ordenada por `cuando`. Incluye los avisos de hoy que aún no han pasado y las vueltas futuras.

## Contrato para el Chat 4 (`notifications.ts` y copy)

1. **Cuándo recalcular:** en cada apertura (foreground) y cada vez que cambie algo de la entrada: completar una misión, ver una celebración, abrir un duelo o subir una foto. Es barato y determinista.
2. **Entrada** (`EstadoPlanAvisos`):
   - `ultimaApertura`: la fecha local de hoy cuando la app está abierta. Guárdala en AsyncStorage.
   - `wakeTime` y `sleepTime` del perfil, tal como vienen de Postgres (`'07:00:00'`).
   - `streakDays`, `questsHoy` (`questsScheduledOn(quests, hoy)`, con las penalizaciones) y `completadasHoy`.
   - `rachaProtegida`: true si una piedra o una congelación ya salvan el día. Mientras no exista RET-05 (`enJuegoHoy`), pásalo como `false` o según `freeze_until`.
   - `fotosPendientes`, `duelosPendientes` y `celebracionPendiente` (la primera épica de `colaDeCelebracion` sin ver, o `null`).
   - `historial`: los avisos del sistema **ya disparados**, `{ tipo, cuando }`. Lo más simple es guardar el último plan entregado y, al recalcular, pasar como historial las entradas cuyo `cuando <= ahora`. Basta con las últimas 48 h.
   - `pushesServidor`: el push del ritual de hoy si se conoce o se puede prever (por ejemplo, el brief a la hora de despertar si el coach está activo), como `'YYYY-MM-DDTHH:MM'`. Sirve para la separación de 3 h. Si no se sabe, `[]`.
3. **`ahora`:** `momentoDe(new Date())`.
4. **Programar:** cancela los identificadores `nivl.aviso.*` que ya no estén en el plan y programa cada `Aviso` con disparador `DATE` en `fechaDeAviso(a.cuando)`, canal `sistema` e identificador `a.id`. Así reabrir la app mueve las vueltas: las de +7 y +30 se recalculan desde la nueva apertura.
5. **Copy:** lo escribes tú, con la voz del sistema, a partir de `tipo` y `datos`. Tres reglas:
   - **Racha:** di qué falta (`faltan`) y nada más. No amenaces con lo perdido.
   - **Recuperación bloqueada:** usa la pista: «Completa una misión de hoy y la recuperación se abre».
   - **Vuelta, sin culpa:** ni racha rota, ni XP perdido, ni «te echamos de menos». Una puerta abierta, por ejemplo «La arena sigue aquí. Un paso basta». La de 30 días es la última: después, silencio.
6. **Ruta al tocar:** racha y recuperación → `/(tabs)`; duelo → amigos/duelos; foto → la pantalla de fotos de progreso; rango → `/(tabs)` (la celebración pendiente se muestra al entrar); vuelta → `/(tabs)`.
7. **RET-06 (despertador y bloques):** el `DAILY` del despertador debe pasar a disparadores `DATE` hasta `ultimoDiaConAvisos(ultimaApertura)` (apertura +6) y reprogramarse en cada apertura. Lo mismo para cualquier aviso recurrente. Así, tras 7 días sin abrir, solo quedan las vueltas.

## Contrato para el coordinador (ritual del servidor)

El ritual tiene que respetar **el mismo tope y la misma caducidad**. `pushDelServidorPermitido(args, ahora)` es la regla; cópiala tal cual al lado Deno, como se hace con `kinds.ts`:

- **Caducidad:** con 7 días o más sin abrir, el servidor **no envía nada**. Las dos vueltas son locales y ya están programadas en el móvil; si el servidor también avisara, serían dobles.
- **Tope:** 1 push al día por usuario (brief, revisión, cierre mensual y escalada comparten ese cupo). Hoy `decidir()` ya devuelve como mucho una decisión por pasada horaria, pero puede enviar el brief a las 07:00 y la escalada a las 11:00 del mismo día: hay que contar los `coach_runs` con push de hoy en hora local.
- **Silencio:** solo dentro de `[wake_time, sleep_time)`. El brief a la hora de despertar cae justo dentro. La revisión del domingo a las 20:00 cae fuera si alguien duerme a las 20:00, y en ese caso se salta.
- **Lo que falta en el esquema:** el servidor no sabe cuándo se abrió la app por última vez. Hace falta una columna (por ejemplo `profiles.last_open_on date`, escrita por la app en cada apertura con la fecha local) o derivarlo de la última actividad (`completions`, `coach_messages`). Sin ese dato no se puede aplicar la caducidad en el servidor. Hoy la escalada sigue escribiendo a quien lleva semanas fuera; es lo que RET-06 dejaba pendiente de verificar.
- **La separación de 3 h** con los avisos locales la garantiza el lado local, que recibe la hora del push en `pushesServidor`. El servidor no tiene que conocer los avisos locales.

## Fechas y cambio de hora (25/10/2026)

- Toda la aritmética de días es UTC pura (`sumarDias`, `diasEntre`, `diaSemana`), así que el resultado no depende de `TZ`. Un test lo comprueba con cuatro zonas.
- Las horas son de **pared**: el 25/10 la racha sigue a las 21:30. El SO resuelve la hora real al convertir con `fechaDeAviso`.
- La caducidad cuenta **días de calendario**, no bloques de 24 h. Un día de 25 h no adelanta ni retrasa la vuelta.
- La separación y el enfriamiento se miden en minutos de pared. Como la ventana activa nunca incluye las 02:00–03:00, ningún par de avisos del mismo día cruza el salto. Entre días, el error máximo es de 1 h: en otoño la separación real es mayor (más prudente); en primavera, un enfriamiento de 24 h de pared puede durar 23 h reales. Se acepta.

## Verificación

- `CI=true npx jest --ci --runInBand src/lib/__tests__/notifyPlan.test.ts`: 58 tests. Cubren topes, silencio, caducidad a 6/7/8–29/30/31 días, enfriamiento, prioridad, día sin misiones, DST e independencia de `TZ`, más un barrido de invariantes (tope, 3 h y futuro) sobre 144 estados.
