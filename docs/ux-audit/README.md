# Auditoría de experiencia · Winter Arc (Chat 4)

Rama `winter/chat4-experiencia` desde `bf32d28`. Web pública: `nivl-web` rama `winter/chat4-web`.
Fecha: 02/10/2026. Método: lectura de código, tres auditorías en paralelo (móvil/accesibilidad, web/rendimiento, web pública), `nivl-planner`, dos implementadores con archivos disjuntos y `nivl-ux-auditor` al final. Verificación visual en el navegador integrado (Chromium) contra `expo start --web` y un export web estático.

**Importante:** desde `09a6b99` la rama necesita `src/lib/authFlow.ts`, `validation.ts` y `supabase.ts` de `winter/chat3-seguridad` (@7120a45) para tipar. Los integra el coordinador.

## Inventario de pantallas

| Área | Pantallas |
|---|---|
| Acceso | `login` (entrar / crear cuenta / recuperar), `auth/confirmar`, `auth/restablecer`, `index` (entrada) |
| Primera misión | `onboarding`, `(tabs)/index` (Hoy), `CompletarSheet`, `QuestForm` |
| Hábitos, campañas, agenda | `(tabs)/habitos`, `(tabs)/mazmorras`, `dungeon/[id]`, `(tabs)/agenda`, `contrato` |
| Cuerpo | `gym`, `cardio`, `nutricion`, `dieta`, `avances`, `compra` |
| Diario y dinero | `diario`, `economia`, `informe`, `resumen`, `memoria` |
| Coach | `(tabs)/coach`, `oraculo` |
| Social y perfil | `amigos`, `(tabs)/perfil`, `creador`, `c/[code]` |
| Pro (Chat 2) | `pro` — solo revisión UX, sin editar |

## Pistas del vídeo

| Pista | Resultado |
|---|---|
| Gimnasio +25 frente a +50 | Explicada: la tarjeta enseñaba `gym_sessions.xp_awarded`, que excluye lo que paga la misión enlazada. Corregido: la tarjeta suma la misión y el aviso desglosa. Sin doble pago en el camino feliz (confirmado por el Chat 5). |
| Diario +15 frente a +10 | Correcto: 10 de la misión + 5 de resto del módulo. Faltaba decirlo; ahora se desglosa. |
| Campañas vacías mientras cargan | **Confirmada en código** (`mazmorras.tsx` sin `loaded`). Corregido: esqueleto y error con Reintentar. Igual en 9 pantallas más. |

## Cambios principales

- **Revisión de Apple:** legales de NIVL en login y Perfil; casilla de registro con enlaces accesibles; borrado de cuenta, bloqueo y retirada de consentimientos funcionan también en web (`confirmar()`); aviso de suscripción sin nombrar Google Play en iOS; denunciar respuestas de la IA en coach y Oráculo (Google Play).
- **Primera misión y vuelta D1:** el token push se registra al conceder el permiso (antes el push del día 2 no llegaba a usuarios nuevos); Hoy, Hábitos y Agenda recargan al volver a la app o al cambiar de día; el onboarding no duplica misiones ni carta al reanudar; sin red, la entrada no salta el onboarding.
- **Estados:** carga con esqueleto, error con Reintentar y vacío solo tras cargar en todas las pantallas con datos; `mensajeSistema` en lugar de `e.message`.
- **Accesibilidad:** reducir movimiento en todo el kit; XP y subida de nivel anunciados al lector; textos ≥ 11 px; `textFaint` 4,60:1 sobre panel; zonas táctiles de enlaces; «Abrir ajustes» con cámara o avisos denegados.
- **Web:** columna centrada de 560 px, `lang="es"`, chips que envuelven, Intro envía en el coach, Oráculo y cierre de sesión sin SecureStore.
- **Acceso propio de NIVL** (sin Franky): login, registro, recuperación y enlaces del correo.

## Mediciones

| Medida | Antes (`bf32d28`) | Después | Método |
|---|---|---|---|
| Bundle web (entry JS) | 3,73 MB · 966 KB gzip | 3,74 MB · 969 KB gzip | `expo export --platform web`, medido |
| RevenueCat en el bundle web | 1.041 KB (28 %) | igual; separación aceptada por el Chat 2 | source map, medido |
| Viajes al abrir el gimnasio | 4 en serie | 1 ronda en paralelo | código, contado |
| Viajes al abrir Campañas / Hábitos | 3 / 3 en serie | 1 / 1 ronda | código, contado |
| Arranque y latencia en dispositivo | — | — | NO PROBADO (sin dispositivo) |

## Matriz de pruebas

| Prueba | Resultado | Entorno |
|---|---|---|
| `tsc`, `eslint`, Jest 32 suites / 404 tests | PASS | `bb8f695` y `368ffc9` (automático) |
| Export iOS / Android / web | PASS | `bb8f695` (automático) |
| Login, crear cuenta, recuperar a 375×812 | PASS | Web estático, Chromium del panel |
| `/auth/confirmar` con código inválido y `/auth/restablecer` sin enlace | PASS | Web estático, Chromium |
| Columna centrada y sin scroll horizontal a 1440×900 | PASS | Expo web, Chromium |
| `lang="es"` | PASS | Expo web, Chromium |
| Casilla y 4/2 enlaces legales tabulables y con rol | PASS | Expo web, Chromium |
| Pantallas con sesión iniciada (Hoy, campañas, amigos…) en web | NO PROBADO | Sin credenciales: requiere que el usuario entre |
| Safari / Firefox / Edge de escritorio | NO PROBADO | Solo Chromium disponible |
| iPhone y Android físicos, VoiceOver, TalkBack, teclado, safe areas | NO PROBADO | Sin dispositivo |
| Notificaciones / cámara / fotos denegadas | NO PROBADO | Requiere dispositivo |
| Offline, red lenta, segundo plano, deep links, enlace real del correo | NO PROBADO | Requiere dispositivo |
| Web pública 320–1440 px sin scroll horizontal | PASS | Servidor local, Chromium |
| `/terminos` y `/privacidad` en producción | PASS (200) | GET a nivl-web.vercel.app |

## iPad, tablet, plegables y Mac

Hoy `supportsTablet=false` y `orientation=portrait`.

- **iPad:** la app de iPhone corre en modo compatibilidad (marco de iPhone escalado). No hay nada que optimizar sin activar `supportsTablet`. Apple puede revisar en iPad: el layout de iPhone ya funciona ahí, así que no es un riesgo para este envío.
- **Android tablet y plegable desplegado:** no hay restricción, así que la app se estira a todo el ancho (como la web antes de la columna de 560 px). **Propuesta al coordinador:** aplicar la misma columna centrada en nativo cuando el ancho sea ≥ 600 dp (hoy solo se aplica en web). Es JS puro y va por OTA. No lo he hecho sin validar en un dispositivo o emulador grande.
- **Activar `supportsTablet`** exige además capturas de iPad en App Store Connect, revisar las hojas `Modal` a ancho completo y, si se quiere, la orientación horizontal. Propuesta: no para este envío; sí tras el Winter Arc.
- **Mac (Apple Silicon):** la app de iPhone puede ofrecerse en Mac desde ASC. NO PROBADO y no recomendado sin prueba.

## Pendiente

- Hojas `Modal` en web a ancho completo en escritorio (portales de react-native-web): limitar a 560 px en cada hoja. P2.
- Texto de retención de `/privacidad` del Chat 3: publicar cuando el coordinador despliegue `account-erasure` y la seudonimización de `store_events`.
- Recorrido con sesión iniciada en web y en dispositivo; casos físicos en la matriz del Chat 5.
