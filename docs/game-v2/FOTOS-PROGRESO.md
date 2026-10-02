# Fotos de progreso — contrato (E5)

Lógica pura en `src/lib/progressPhotos.ts`, con tests en `src/lib/__tests__/progressPhotos.test.ts`. No importa Supabase ni sabe de Storage: recibe metadatos y devuelve metadatos.

- **Chat 3 (SQL)**: la tabla `progress_photos(user_id, date, pose, path, weight_kg null)`, el bucket privado `progress` con rutas `{uid}/{uuid}`, las políticas y la RPC de solo lectura del coach.
- **Chat 4 (UI)**: pantalla, cámara, subida, URL firmadas, recordatorio y logro.
- **Este módulo**: agrupar, comparar, decir qué falta y contar la racha.

## Entrada

```ts
type Pose = 'frente' | 'lado' | 'espalda';
interface FotoProgreso { id: string; fecha: 'YYYY-MM-DD'; pose: Pose; pesoKg?: number | null }
interface PesoDia      { fecha: 'YYYY-MM-DD'; kg: number }        // weight_logs
interface NutricionDia { fecha: 'YYYY-MM-DD'; cumplido: boolean } // parte de comidas
```

La capa de datos mapea `progress_photos` así: `id → id`, `date → fecha`, `pose → pose` y `weight_kg → pesoKg`. **`path` no se pasa.** Si llega por descuido, se ignora: cada salida se construye campo a campo y hay un test que lo comprueba.

Las fotos con fecha inválida (no `YYYY-MM-DD`) o con una pose fuera de las tres se descartan sin error. Lo mismo pasa con los pesos que no son finitos o no son positivos.

## Funciones

| Función | Devuelve |
|---|---|
| `lineaTemporal(fotos, pesos = [], nutricion = [])` | `SemanaFotos[]`, de la semana más reciente a la más antigua |
| `parAntesDespues(fotos, pose, { hoy, dias = 90, pesos? })` | `ParAntesDespues \| null` |
| `estadoSemanal(fotos, hoy)` | `EstadoSemanal` |
| `rachaFotosSemanal(fotos, hoy)` | `RachaFotos` |
| `metadatosParaCoach(fotos, pesos = [])` | `{ fecha, pose, pesoKg }[]`, de la más reciente a la más antigua |
| `permisosFotos({ mayor18, consentimientoSalud, consentimientoIA })` | `PermisosFotos` |
| Auxiliares: `lunesDe`, `semanaIso`, `diasEntre`, `pesoCercano`, `POSES`, `HITOS_RACHA`, `VENTANA_PESO_DIAS`, `PROVEEDOR_VISION` | |

```ts
interface FotoConPeso { id; fecha; pose; pesoKg: number | null; fuentePeso: 'foto' | 'registro' | null }

interface SemanaFotos {
  semana: string;              // lunes ISO
  anioIso: number; numeroIso: number;   // "Semana 53 · 2026"
  fotos: FotoConPeso[];        // una por pose, en orden frente · lado · espalda
  faltan: Pose[]; completa: boolean;
  adherencia: number | null;   // 0..1; null si no hay partes esa semana
  diasCumplidos: number; diasRegistrados: number;
}

interface ParAntesDespues { antes: FotoConPeso; despues: FotoConPeso; dias: number; difPesoKg: number | null }

interface EstadoSemanal {
  semana: string; hechas: Pose[]; faltan: Pose[]; completa: boolean;
  recordar: boolean;           // domingo y semana incompleta
  claveAviso: string | null;   // 'fotos-progreso:{lunes}' cuando recordar
}

interface RachaFotos {
  semanas: number;             // racha vigente
  actualCompleta: boolean;
  mejor: number;               // racha más larga de la historia
  hitos: number[];             // de [4, 12, 52], los alcanzados según `mejor`
  siguienteHito: number | null;
}
```

La UI usa el `id` de `FotoConPeso` para pedir a la capa de datos la URL firmada de esa foto. La URL no pasa nunca por este módulo.

## Reglas

1. **Semanas ISO**: van de lunes a domingo y la clave de la semana es su lunes. En 2026 hay semana 53 (del 28/12/2026 al 03/01/2027), y su año ISO es el del jueves.
2. **Solo claves `YYYY-MM-DD`**: la distancia entre días se calcula en UTC a partir de las cifras de la clave, así que el cambio de hora del 25/10/2026 no mueve nada. Los tests pasan con `TZ=Europe/Madrid` y `TZ=America/Los_Angeles`.
3. **Peso de una foto**: si la foto trae `pesoKg`, se usa ese (`fuentePeso: 'foto'`). Si no, se toma el registro más cercano dentro de **±3 días** (`'registro'`), y a igual distancia gana el anterior. Si no hay ninguno, el peso es `null`.
4. **Línea temporal**: si hay varias fotos de la misma pose en una semana, queda la más reciente. La adherencia es días cumplidos / días con parte de lunes a domingo, con un parte por día (si se repite, cuenta el último).
5. **Antes y después**: el "después" es la foto más reciente de la pose con fecha ≤ `hoy`. El "antes" es, entre las fotos de fechas anteriores, la más cercana a `hoy − dias`. Si ese objetivo cae antes de la primera foto, el "antes" es la primera, y a igual distancia gana la más antigua. Devuelve `null` si no hay dos fechas distintas. `difPesoKg = después − antes` se redondea a 0,1 y es `null` si falta alguno de los dos pesos.
6. **Recordatorio**: hay un aviso por semana y solo en domingo. Con la semana completa no sale nada. La capa de avisos (Chat 4) usa `claveAviso` para no repetirlo.
7. **Racha**: cuenta las semanas ISO consecutivas con las tres poses. La semana en curso suma si ya está completa, y si no lo está todavía no rompe la racha. Las fotos con fecha futura no cuentan. Los hitos 4, 12 y 52 salen de `mejor`, así que un logro no se pierde aunque la racha se rompa.
8. **Coach**: recibe `{ fecha, pose, pesoKg }` y nada más (ni id, ni ruta, ni URL). La RPC de solo lectura del Chat 3 debe devolver exactamente esa forma, con el peso resuelto con la misma regla de ±3 días o, si no, solo `weight_kg`.

## Permisos: edad y consentimientos

```ts
permisosFotos({ mayor18: boolean | null, consentimientoSalud: boolean, consentimientoIA: boolean }): {
  guardar: boolean; compartir: boolean; analizarIA: boolean;
  proveedorVision: 'claude';
  motivo: 'menor' | 'edad_sin_confirmar' | 'sin_consentimiento_salud' | 'sin_consentimiento_ia' | null;
}
```

Las condiciones se comprueban en este orden, y `motivo` es la primera que falla:

1. **Edad**: la app no conoce la edad en años, solo la confirmación declarada de ser mayor de 18. Con `mayor18: false`, todo es `false` con `menor`. Con `null` (o cualquier valor que no sea un booleano), todo es `false` con `edad_sin_confirmar`. Solo `true` deja seguir.
2. **Consentimiento de salud**: `guardar` y `compartir` lo exigen. Si falta, todo es `false` con `sin_consentimiento_salud`.
3. **Consentimiento de IA**: `analizarIA` exige además este. Si falta, se puede guardar y compartir, y `motivo` es `sin_consentimiento_ia`.
4. **Proveedor**: `proveedorVision` vale siempre `'claude'`. La visión sobre fotos corporales no se manda a ningún otro modelo; DeepSeek, por ejemplo, queda fuera aunque el plan Pro vaya por él.

La UI (Chat 4) decide con esta función qué botones enseñar y el SQL (Chat 3) aplica la misma regla en el servidor; la función no sustituye esa comprobación. Si hay que enseñar el `motivo`, el texto lo pone la UI.

## Lo que NO hace

- **No da XP.** Ninguna función toca la economía, y la racha alimenta un logro cosmético.
- No ve rutas, URL, `user_id` ni el bucket, y tampoco firma URL ni sube ni borra archivos.
- No lee la edad ni los consentimientos: los recibe. `permisosFotos` decide con lo que le pasan, y el servidor debe aplicar la misma regla (mayor de 18 confirmado, consentimiento de salud y de IA) en la tabla, el bucket y la RPC.
- No envía avisos ni recuerda si ya avisó: devuelve `recordar` y `claveAviso`, y quien programa el aviso es la capa de avisos.
- No analiza la imagen (composición, comparación visual ni estimación de grasa).
- No decide la hora: `hoy` lo pasa quien llama (`dateKey()` local).
