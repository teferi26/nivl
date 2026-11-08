# WORK: el modo de trabajo

Qué es, qué no es y el contrato exacto para construir encima. El código manda: si esto y `src/work/` discrepan, gana el código y se corrige este archivo.

**Objetivo.** Alguien nuevo sabe qué hacer en 30 segundos sin leer nada. Hoy deja de ser "economía personal" y pasa a ser el centro de mando del trabajo.

Toda la lógica vive sin pantalla (`src/work/`, con tests). La vista se va a rehacer en el rediseño 1.1: cada pantalla es `useX` + `XVista` + demo, con los componentes que ya existen (Screen, Section, Button, TarjetaArena, Skeleton), sin animaciones a medida ni piezas visuales nuevas.

## Las piezas, por orden de valor

1. **Planificación por prioridades.** Una tarjeta "Ahora": qué atacar ya y un solo botón. Sin nada planificado pregunta "¿qué tienes que sacar hoy?" (hasta 3) y lo convierte en misiones de WORK. Es el recorrido de los 30 segundos.
2. **Bloques de trabajo profundo.** Temporizador por hora de pared, resistente a segundo plano, con aviso local al acabar. Un bloque de verdad marca su misión.
3. **Reuniones y agenda con calendario.** Hoy sabe qué reunión viene. Importación de solo lectura del calendario del móvil, con permiso explícito.
4. **Proyectos y entregas.** Qué debo y para cuándo, con riesgo por fecha. Sin vocabulario de juego.
5. **Horas.** Por día, proyecto y facturable. Tarifa opcional: "horas por facturar", informativo y sin impuestos.
6. **Revisión semanal.** Sin IA: lo cerrado, lo que se quedó, horas profundas y las 3 de la semana siguiente.
7. **Carga.** Reuniones, foco, tardes, fines de semana. Dice qué soltar. Sin diagnóstico, sin culpa, sin penalizar.
8. **Economía integrada.** La pestaña sigue. En Hoy, una línea.
9. **Coach.** Recibe en modo work el mismo "qué atacar y qué soltar" ya calculado. Lo gratis funciona entero sin IA.

## Lo que NO se hace, y por qué

- **No se tocan las pestañas** (Hoy, Economía, Agenda, Coach). Cambiar `MUNDOS` es decisión del dueño.
- **Cero XP nuevo.** Ni bloques, ni horas, ni entregas, ni revisión, ni carga pagan. Paga la misión, por `completeQuest` y `propagarActo`. Nada de `award_xp` en WORK.
- **Sin atributos de RPG en las filas de trabajo** (nada de "AGI · Agilidad"). XP visible pero discreto.
- **No se reutiliza `QuestItem`, `MundoHoyVista` ni `AgendaVista` editándolos**: son compartidos. Se usan o se escribe una fila propia.
- **No se toca `infer_link`.** `trabajo` nunca se deduce de un título.
- **Sin consejo de inversión, sin mover dinero, sin fiscalidad concreta.** "Por facturar" es tiempo por tarifa, sin impuestos.
- **Sin lenguaje clínico** en carga ("agotamiento", "burnout", "estrés" no aparecen en interfaz).
- **Sin escritura en el calendario del teléfono.** Solo lectura.
- **Sin facturas, IVA ni multiempresa.** Lo pidió el autónomo, pero es otro producto y cruza la línea de fiscalidad.
- **Sin escuchar lo que no se ha medido**: la carga no usa ánimo ni energía del diario; el diario no está en WORK.

## Trampas ya pisadas (léelas antes de escribir)

- **Una prioridad lleva `link: 'ninguno'` explícito, nunca `'trabajo'`.** `propagarActo` marca TODAS las misiones enlazadas al acto: con `trabajo`, un bloque cerraría las tres prioridades. La que se ataca la paga su bloque por `questId`. `trabajo` queda para misiones fijas genéricas que cumpliría cualquier bloque, pero hoy nada las crea (ni la app ni el coach): si alguien las conecta, poner tope de una por bloque y ocultar "Registrar" en WORK (llevaría a la misma pantalla).
- **Antes de la 0117 una misión con link distinto de `ninguno` era dato de salud** (`health_row`, política restrictiva de la 0030): quien no dio ese consentimiento no la vería. La 0117 saca a `trabajo` de esa condición.
- **Una prioridad es de un solo día** (`quests.work_day`). `questsScheduledOn` (closing.ts, espejo en `trabajo.ts` y `completarMision`) la programa solo ese día, así que nunca se juzga dos veces aunque siga activa. `retirarPrioridadesCaducadas(hoy)` la apaga cuando `useHoy` ya está `listo`, porque el cierre de ayer va antes.
- **Una prioridad sin hacer cuesta como cualquier misión** (−50 % de su XP base, con su penalización recuperable). Soltarla el mismo día la saca sin coste (`soltarPrioridad`, `sePuedeSoltar`). **Decisión:** vale también para las misiones de entrega y revisión, aunque se crearan días antes: las crea el sistema y no el usuario, y soltar no paga nada. Por eso `sePuedeSoltar` mira `work_day` y no el día de alta. La interfaz avisa de que cuentan para la racha.
- **Renombrar** una misión con `trabajo` la re-deduce a `ninguno` (trigger de la 0019, intacto): el enlace se pierde. Reenviar el `link` en el mismo update no sirve (el trigger mira si cambió): va en un update posterior, como hace `editar_mision` del coach. No ofrecer renombrar misiones fijas de WORK, o hacer ese segundo update.
- **Los eventos del calendario no tienen tipo.** Pueden ser el cumpleaños de un hijo: `carga` y `semana` solo cuentan reuniones de lunes a viernes y sacan tardes y fines de semana de sesiones registradas.
- **Reservar un bloque en la Agenda escribe en `day_plans` y `day_blocks`, que están tras el consentimiento de salud (`health_row` de la 0030, rama `else true`).** Sin ese permiso la hoja lo explica y remite a Hoy (`BloqueSinPermiso`). `planificar_dia` del coach sustituye los bloques del día, también los reservados a mano, y un plan creado así evita el plan de respaldo del ritual de esa mañana.
- **`expo-calendar` en Android exige READ y WRITE** aunque solo se lea (`CalendarModule.kt`): no se puede bloquear `WRITE_CALENDAR`. NIVL no llama a ninguna función de escritura.
- **La OTA puede ir por delante del servidor.** Sin la 0115, `disponible: false` y estado vacío; las escrituras lanzan `WorkNoDisponible`. Hoy sigue leyendo eventos sin la 0116.

- **La misión de una entrega se enlaza por título y día** (`src/work/entregaMision.ts`), sin columna. Se crea a seis días o menos de la fecha, porque `days_of_week` es semanal: antes saldría y se cobraría también la semana anterior. La crea `programarMisionesDeEntregas` al leer los datos. Ningún día pasa de tres misiones con `work_day`, contando las prioridades: ese es el tope de lo que WORK puede pagar en un día. **Anti-farmeo:** una misión ya pagada nunca se retira (conserva su hueco; `editarRetiraMision` y la comprobación de `completions` en `retirarMisionDeEntrega`), y `filasDeEntregas` compara por título en toda la ventana, no por día más título.
- **Cerrar una entrega no paga: completa su misión** (`cerrarMisionDeEntrega`). Si se cierra antes de tiempo, la misión se adelanta a hoy; si hoy ya hay tres, se retira. Completar la misión desde Hoy aún no cierra la entrega.

## Contrato

### Reparto de archivos

| Trabajo | Archivos |
|---|---|
| Núcleo (hecho) | `src/work/{tipos,fechas,adaptar,prioridades,ahora,bloque,proyectos,horas,semana,carga,datos}.ts`, `src/components/work/{useWorkDatos,textos}.ts`, migraciones 0115 a 0118 |
| Hoy y bloque | `src/work/bloqueAlmacen.ts` (AsyncStorage y aviso), `src/components/work/{useBloque.ts,useWorkHoy.tsx,WorkHoyVista.tsx,demo.tsx}`, `src/app/(work)/work-hoy.tsx`, `src/app/kit/work.tsx` |
| Gestión | `src/components/work/gestion/*`, rutas `src/app/work/{proyectos,horas,revision}.tsx`; la carga se pinta dentro de `/work/revision` y como aviso en Hoy |
| Agenda, calendario, economía en Hoy | `src/work/{calendario,agendaRapida,calendarioDispositivo,datosCalendario,economiaHoy}.ts`, `src/components/work/agenda/*`, `src/components/work/LineaEconomia.tsx`, `src/app/(work)/work-agenda.tsx`, dependencia `expo-calendar@15.0.8`, `app.json`, lockfile con `npx npm@10.9.2 install --package-lock-only` |
| Coach | `supabase/functions/_shared/trabajo.ts` (espejo Deno de `elegirAhora` y `calcularCarga`) y su inserción en la parte rápida del estado solo en modo work |

### Tipos (`src/work/tipos.ts`)

`MisionTrabajo`, `BloquePlan`, `EventoTrabajo`, `Proyecto`, `Entrega`, `SesionTrabajo`, `Revision`, `ItemRevision`, `DatosWork`, `Motivo`, `CodigoMotivo`. Constantes: `MAX_PRIORIDADES` (3), `DURACIONES_BLOQUE` (25, 50, 90), `MINUTOS_BLOQUE_DEFECTO` (50), `MIN_MINUTOS_MISION` (25), `FRACCION_OBJETIVO` (0,8), `MIN_MINUTOS_SESION` (5), `DURACION_EVENTO_DEFECTO` (45), `FIN_JORNADA_MIN` (19:00), `HORA_TARDE_MIN` (20:00).

Los módulos puros devuelven códigos, no frases. `Motivo` se pinta con `textoMotivo(m)` de `src/components/work/textos.ts`.

### Fechas (`fechas.ts`)

`esFecha`, `sumarDias(f, n)`, `diasEntre(a, b)`, `diaSemana(f)` (1 lunes), `lunesDe(f)`, `esFinDeSemana(f)`, `fechaLocal(d)`, `minutosLocal(d)`, `horaAMin(s)`, `minAHora(m)`, `fechaCorta(f)`. El reloj solo entra por `fechaLocal` y `minutosLocal`; lo demás recibe `fecha` y `ahoraMin`.

### Adaptadores (`adaptar.ts`)

```ts
aMision(m: { quest: Quest; hecha: boolean }): MisionTrabajo   // nivl.datos.misiones de useHoy
aBloquePlan(b: DayBlock): BloquePlan
aEvento(e): EventoTrabajo
```

### Prioridades (`prioridades.ts`)

```ts
ordenarPrioridades<T>(misiones, hoy): T[]
prioridadesDelDia<T>(misiones, hoy): { visibles: T[]; resto: T[]; penalizaciones: T[]; hechas: number; total: number }
pendientes<T>(misiones, hoy): T[]
limpiarEntradas(textos): string[]
huecosDePrioridad(misiones, hoy): number
filasDePrioridad(titulos, hoy, rangoDesde = 1): FilaPrioridad[]
sePuedeSoltar(m, hoy): boolean
```

### Ahora (`ahora.ts`)

```ts
elegirAhora(e: EntradaAhora): Ahora
EntradaAhora = { fecha, ahoraMin, misiones, plan, eventos, entregas, bloque?: BloqueEnCurso | null, nivelCarga?, finJornadaMin? }
Ahora = { tipo, titulo, motivo, accion, questId, entregaId, bloquePlanId, minutosSugeridos, hastaMin, soltar: Soltable[] }
accion: 'seguir_bloque' | 'empezar_bloque' | 'planificar' | 'ninguna'   // el único botón; 'ninguna' = sin botón
Soltable = { tipo: 'mision', id, titulo, motivo, sinCoste }             // sinCoste: se puede soltarPrioridad
```

Orden de decisión: bloque en marcha, reunión en curso o a 15 min, bloque del plan que toca, hueco de menos de 25 min, siguiente prioridad, entrega que aprieta, pedir plan, recuperar la penalización pendiente, día cerrado. Un bloque del plan sin misión propia toma la primera pendiente y la tarjeta enseña su título: lo que paga se ve.

### Bloque (`bloque.ts`)

```ts
nuevoBloque(a: NuevoBloque): EstadoBloque
avanzar(e, ahoraMs)  pausar(e, ahoraMs)  reanudar(e, ahoraMs)  terminar(e, ahoraMs)
transcurridoMs(e, ahoraMs)  restanteMs(e, ahoraMs)  minutosReales(e, ahoraMs)
finPrevisto(e, ahoraMs): number | null        // programar el aviso local
cuentaComoBloque(minutos, objetivoMin): boolean
cierreDe(e): CierreBloque | null              // { clientId, fecha, inicioMin, minutos, guardar, cuenta, questId, proyectoId, entregaId, bloquePlanId }
marcaMision(c, hoy): boolean
normalizarBloque(v: unknown): EstadoBloque | null
```

Al terminar, una sola vez por `clientId`, en este orden:

1. Si `c.guardar`: `registrarSesion({ clientId, tipo: 'bloque', ..., facturable: facturablePorDefecto(proyecto) })`.
2. Si `marcaMision(c, hoy)`: `fetchQuests` + `completeQuest(perfil, quest, null)`. Si la misión es de penalización, no.
3. Si `c.cuenta` y `c.fecha === hoy`: `propagarActo(perfil, 'trabajo', hoy, c.bloquePlanId)`: marca reglas y el bloque del plan que se atacaba, sea `deep_work`, `ventas` o `contenido`; si el bloque no salió del plan, el primer `deep_work` sin hacer. El espejo del coach no recibe id: su rama no tiene quien la llame.
4. Sin XP pagado, aviso tranquilo; nada de error. Ver `useFocusHoy.tsx` como referencia, sin importarlo.

### Proyectos (`proyectos.ts`)

```ts
riesgoEntrega(e, hoy, minutosRecientes = 0): 'hecha' | 'atrasada' | 'hoy' | 'en_riesgo' | 'a_tiempo' | 'sin_fecha'
entregasConRiesgo(entregas, sesiones, hoy): EntregaConRiesgo[]     // { ...Entrega, riesgo, dias }
entregasProximas(entregas, sesiones, hoy, dias = 7): EntregaConRiesgo[]
resumenProyecto(p, entregas, sesiones, hoy): ResumenProyecto       // { proyecto, pendientes, hechas, avance, proxima, riesgo, minutosSemana }
resumenProyectos(proyectos, entregas, sesiones, hoy): ResumenProyecto[]
```

### Horas (`horas.ts`)

```ts
minutosPorDia(sesiones, desde, hasta): DiaHoras[]                  // { fecha, minutos, profundos }
horasPorProyecto(sesiones, proyectos, desde, hasta): FilaHorasProyecto[]
totalHoras(sesiones, proyectos, desde, hasta): TotalHoras
idsPorFacturar(sesiones, proyectoId, desde, hasta): string[]
facturablePorDefecto(p): boolean
leerMinutos(s): number | null                                      // «1:30», «1,5», «90m»
```

### Semana (`semana.ts`)

```ts
semanaARevisar(hoy): string                                        // lunes; de viernes a domingo, la que acaba
resumenSemana(e: EntradaSemana): ResumenSemana
EntradaSemana = { lunes, misiones: MisionSemana[], entregas, sesiones, eventos, proyectos }
ResumenSemana = { lunes, domingo, cerrado, seQuedo, minutosProfundos, minutosTotales, minutosReunion, diasConBloque, propuestas }
```

### Carga (`carga.ts`)

```ts
calcularCarga(e: { fecha, eventos, sesiones, horaTardeMin? }): Carga
Carga = { nivel: 'ligera' | 'normal' | 'alta', puntos, reunionesHoyMin, reunionesSemanaMin, profundoHoyMin, profundoSemanaMin,
          trabajoSemanaMin, diasTarde, diasFinDeSemana, diasSeguidos, senales: SenalCarga[], soltar: CodigoSenal | null }
finEvento(e): number | null    minutosOcupados(eventos): number
```

`Carga.nivel` se pasa a `elegirAhora` como `nivelCarga`.

### Datos (`datos.ts`, efectos)

```ts
class WorkNoDisponible
esMigracionAusente(e): boolean
leerWork(r: RangoWork): Promise<LecturaWork>
leerMisionesSemana(desde, hasta): Promise<MisionSemana[]>
crearPrioridades(userId, titulos, hoy, rangoDesde = 1)   // en pantalla, usa crearPrioridadesDelDia (datosGestion.ts): cuenta contra el servidor
soltarPrioridad(questId, hoy)
retirarPrioridadesCaducadas(hoy)             // nunca lanza
guardarProyecto(p)  fijarEstadoProyecto(id, estado)  borrarProyecto(id)
guardarEntrega(e)  marcarEntrega(id, hecha, dia)  borrarEntrega(id)
registrarSesion(s: NuevaSesion)  borrarSesion(id)  marcarFacturadas(ids, dia)
guardarRevision(r: EdicionRevision)
```

Almacén: `useWorkDatos(): { estado, datos, disponible, error, recargar, hacer }`. Toda escritura de pantalla va dentro de `hacer(() => ...)`: pone el aviso correcto y relee. `datos.sesiones` son los últimos 60 días; `datos.eventos`, de −14 a +14 días.

Calendario: la fila importada es `{ title, date, time, end_time, source: 'dispositivo', external_id: '<id del evento>@<YYYY-MM-DD>' }`, con upsert `onConflict: 'user_id,external_id'` (una serie repetida tiene el mismo id en todas sus ocurrencias; por eso va el día). `external_id` es obligatorio con `source = 'dispositivo'` y debe ser null con `'manual'`. Desconectar: `delete` con `.eq('source', 'dispositivo')`. Si reimportas, borra antes los importados que ya no estén en el teléfono.

### Rutas

`/work/proyectos`, `/work/horas`, `/work/revision` (las escribe Gestión; Hoy enlaza a ellas). `RUTA_DE_ACTO.trabajo` es `/work-hoy`.

### i18n

Tres namespaces registrados en `recursos.ts`:

- `trabajo`: Hoy, Ahora, bloque. Ya tiene `comun.*` y `motivo.<CodigoMotivo>`.
- `trabajogestion`: proyectos, horas, revisión, carga. Ya tiene `riesgo.<RiesgoEntrega>`, `carga.nivel.*`, `carga.senal.<CodigoSenal>` (con `{{valor}}`) y `carga.soltar.<CodigoSenal>`.
- `trabajoagenda`: agenda, calendario, economía en Hoy. Ya tiene `calendario.*` y `economia.porFacturar`.

Secciones nuevas sugeridas: `trabajo:hoy.*`, `trabajo:ahora.*`, `trabajo:bloque.*`, `trabajo:planificar.*`; `trabajogestion:proyectos.*`, `trabajogestion:horas.*`, `trabajogestion:revision.*`; `trabajoagenda:agenda.*`.

**Toda clave nueva va en los seis idiomas** (`src/i18n/{es,en,fr,pt,de,it}/`), o `traducidos.test` falla. Sin raya ni guion medio, sin exclamaciones, WORK y NIVL sin traducir. Un `CodigoMotivo` nuevo pide su clave en `trabajo:motivo` (lo comprueba `src/work/__tests__/nucleo.test.ts`).

### Migraciones (escritas, sin aplicar)

| Número | Qué |
|---|---|
| 0115 | `work_projects`, `work_deliverables`, `work_sessions`, `work_reviews`, RLS de dueño, topes; `quests.work_day` y `quests.work_rank` |
| 0116 | `calendar_events.source`, `external_id`, `end_time` e índice único |
| 0117 | `trabajo` en `quests_link_check` y `rules_link_check` (leídos del catálogo) y fuera de `health_row` |
| 0118 | `export_my_data` v12 |

La 0119 queda libre. La 0118 es un envoltorio y no una copia entera, igual que la 0079: la versión vigente ya es un envoltorio y una copia borraría lo que otra rama haya añadido antes.

Cuando se apliquen: primero las migraciones, luego la OTA.
