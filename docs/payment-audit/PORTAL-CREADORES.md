# Portal web de creadores — contrato de acceso (Chat 2, 03/10/2026)

Aprobado en principio por el coordinador (el usuario pidió el sistema de creadores «en la web y en el móvil»). Ejecución: revisión de Chat 3 → montaje de Chat 4 (export web de Expo de `src/app/creador.tsx`, rama `conImportes`) en `creadores.nivl.app` → DNS del coordinador → condiciones §4 actualizadas.

## Qué es y qué no es

- Panel de **solo lectura** para cuentas marcadas como creador (`creators.user_id`, `active`). Muestra rango, progreso, ventas atribuidas, retos, tabla e **importes propios** (pendiente en retención, disponible, pagado, anulado y liquidaciones).
- **No** cobra, no liquida, no edita datos bancarios ni fiscales, no muestra compradores. Las liquidaciones siguen fuera (transferencia/Stripe), por `scripts/creadores.mjs`.
- No vende nada al usuario final: no hay suscripciones ni enlaces de compra en este subdominio.

## Autenticación

- Misma cuenta NIVL: `supabase.auth.signInWithPassword` (`src/lib/authFlow.ts`), el login web que ya usa la app. Sin Franky (eliminado). Sin registro desde el portal: el alta de creador es manual (`scripts/creadores.mjs`).
- Sesión de supabase-js en `localStorage` del subdominio (`persistSession: true`, `detectSessionInUrl: false`, como hoy). Cierre de sesión visible. La sesión de `nivl.app` y la del portal son independientes (orígenes distintos).
- Una cuenta que no es creador (o inactiva) ve un estado vacío neutro («Este panel es para creadores del programa»), sin revelar nada.

## Datos (todo filtrado por `auth.uid()` en el servidor)

| RPC | Migración | Devuelve | Revisión |
|---|---|---|---|
| `creator_panel()` | 0025 | panel propio con importes | fase 1 |
| `creator_board()` | 0025 | alias, ventas y puesto | fase 1 |
| `creator_progress()` | 0046 | rango, progreso, retos propios | Chat 3, PASS |
| `creator_sales_history(p_months)` | 0046 | por mes, importes propios (1–24 meses) | Chat 3, PASS |
| `creator_board_period(p_period)` | 0046 | alias, ventas, puesto, `is_me` | Chat 3, PASS |

Ningún acceso directo a tablas (RLS sin políticas para `authenticated`). Vista: `vistaPanelCreador('web', datos)` → `conImportes: true`; en iOS/Android la misma función quita los importes.

## Requisitos para el montaje (Chat 4) y la revisión (Chat 3)

1. **Solo el panel**: el export del subdominio arranca en `/creador` y no expone el resto de la app (login + creador); cualquier otra ruta redirige a `/creador`. Propuesta: una variable de build (p. ej. `EXPO_PUBLIC_SITIO=creadores`) que limite las rutas; la decide Chat 4 con el coordinador (configuración).
2. **Cabeceras**: `X-Robots-Tag: noindex`, CSP restrictiva (solo el proyecto Supabase), `frame-ancestors 'none'`, HTTPS.
3. **Sin datos de creadores en el repo**; capturas para láminas con cuentas de prueba.
4. **Privacidad**: la política y las condiciones §4 mencionan el portal (qué datos se muestran y que son del propio creador). Texto: Chat 4 con revisión de Chat 3.
5. **App de tienda sin cambios**: sigue sin importes y con «Tus ganancias se gestionan fuera de la app.». Mientras el portal no exista no se enlaza; si se enlaza desde la app, solo como texto informativo sin botón de cobro y con visto bueno de Chat 1.

## Pruebas a exigir

- Chat 3: con sesión de creador X, de creador Y, de usuario normal y sin sesión, contra el portal desplegado en preview: cada uno ve solo lo suyo; sin sesión, solo login; sin fugas en la red (inspeccionar respuestas).
- Chat 4: 375/744/1440, estados de carga/vacío/error, cierre de sesión.
- Chat 2: que los importes del portal casan con `creator_panel`/`creator_sales_history` en datos de prueba (PGlite ya cubre la lógica: 0046 67/67).
