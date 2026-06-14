# NIVL · Auditoría de código — índice maestro

> Auditoría del **código real** de NIVL (Expo SDK 55 · React Native 0.83 · TypeScript estricto · Supabase).
> Cada informe está anclado a `archivo:línea`: no son ideas sobre la app, son hallazgos sobre el código que ya existe en `src/` y `supabase/`.
> Punto de entrada recomendado: **[`00-SINTESIS.md`](00-SINTESIS.md)** — bugs rankeados, temas transversales, hoja de ruta y features nuevas.

## Informes por área

| Código | Informe | Ámbito | Mejoras | Bugs |
|---|---|---|---:|---:|
| **ENG** | [01-motor-economia.md](01-motor-economia.md) | Motor de juego: `game.ts`, `engine.ts`, `closing.ts`, `dates.ts` (economía, niveles, cierre, fechas) | 158 | 12 |
| **SQL** | [04-backend-sql-rls.md](04-backend-sql-rls.md) | Backend Postgres: esquema, RLS, atomicidad, Storage (`0001_init.sql`, `0002_fases.sql`) | 150 | 9 |
| **SIS** | [06-ux-sistema.md](06-ux-sistema.md) | Pantalla Sistema (home): completar misiones, cierre/pausa, optimistic UI | 200 | 5 |
| **DIA** | [13-ux-diario-informe.md](13-ux-diario-informe.md) | Diario, informe semanal y heatmap (`diario.tsx`, `informe.tsx`, `Heatmap.tsx`) | 160 | 8 |
| **ORA** | [14-ux-oraculo.md](14-ux-oraculo.md) | Oráculo IA: `oracle.ts` + `oraculo.tsx` (salida estructurada, validación, red) | 165 | 8 |
| | **TOTAL DELIVERED** | 5 áreas auditadas y escritas | **833** | **42** |

> Los 42 bugs están consolidados y rankeados en [`00-SINTESIS.md`](00-SINTESIS.md) (sección A). La síntesis añade 8 bugs de menor severidad y matices no listados aquí; la cifra operativa que se arregla primero es **~37 riesgos accionables**.

### Áreas aún sin informe escrito

La auditoría priorizó las cinco superficies de mayor riesgo (el flujo de completar misión, el backend que guarda el XP, y las tres pantallas con lógica propia). Quedan **pendientes de informe** áreas que el backlog previo (`../mejoras/`) ya cubre como ideas, pero que **no** se han auditado contra el código línea a línea: agenda/calendario, mazmorras (`dungeon/[id].tsx`, `dungeons.ts`), gym (`gym.tsx`, `body.ts`), dieta/compra, perfil (`perfil.tsx`), logros (`achievements.ts`), notificaciones (`notifications.ts`), exportador (`exporter.ts`), `auth.tsx`/`supabase.ts`, y el sistema de diseño/componentes compartidos. La hoja de ruta de la síntesis reserva un hito para cerrarlas.

## Cómo usar esto

1. **Empieza por los bugs, no por las mejoras.** Abre [`00-SINTESIS.md`](00-SINTESIS.md) → sección A. Arregla en orden **alta → media → baja**. Dentro de cada severidad, prioriza lo que toca **economía/atomicidad** (un XP perdido o inflado corrompe el dato para siempre) antes que lo cosmético.
2. **Trabaja por lotes coherentes de una misma área.** No saltes entre ENG, SQL y ORA en el mismo PR: cada informe comparte contexto y arreglos que se refuerzan (p. ej. casi todos los bugs de atomicidad se cierran de golpe con las RPC `SECURITY DEFINER` del informe SQL). Un lote = 5-12 ítems de un archivo, con un objetivo nombrable.
3. **El backend va primero.** La mitad de los bugs "de cliente" (doble XP por doble toque, races read-modify-write) **desaparecen solos** al mover la economía a RPC atómicas y revocar el `UPDATE` directo sobre las columnas de XP. Hacer eso antes ahorra arreglar el mismo síntoma cinco veces en el cliente.
4. **Verifica todo cambio** con la cadena mínima del proyecto:
   - `npm run typecheck` (tsc estricto, sin emitir),
   - `npm test` (jest: `closing.ts` ya tiene cobertura; añade `engine.ts` según ENG-080),
   - `npx expo export --platform android` (que el bundle compile),
   - y para lo que toca SQL, aplicar la migración nueva en el SQL Editor de Supabase y probar la RPC.
5. **Respeta las skills obligatorias** antes de tocar UI (`nivl-design-system`) o economía (`nivl-game-design`). Las migraciones aplicadas no se editan: siempre archivo nuevo numerado.

## Relación con el backlog previo

- **Backlog maestro de mejoras** (1.082 ideas por categoría, orientadas a *qué construir*): [`../mejoras/README.md`](../mejoras/README.md).
- **Roadmap por fases** (qué fase alimenta cada lote del backlog): [`../ROADMAP.md`](../ROADMAP.md).

La diferencia: el **backlog** propone funcionalidad nueva (features, mecánicas, pantallas). Esta **auditoría** arregla y endurece lo ya construido (bugs, atomicidad, estados, a11y, rendimiento). Orden sano: **primero estabilizar (auditoría), luego ampliar (backlog)** — sobre cimientos que pierden XP no merece la pena apilar features.
