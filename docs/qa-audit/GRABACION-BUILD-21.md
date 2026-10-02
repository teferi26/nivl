# Grabación y pruebas finales · NIVL 1.0.7 (21)

Para que lo ejecute el usuario en su iPhone en cuanto la build 21 llegue a TestFlight. Sale de:

- el guion del Chat 1 (`docs/release-audit/apple-guion-video.md` y `cuentas-demo.md`, rama `winter/chat1-tiendas`);
- la lista general `QA-FISICA-WINTER.csv`;
- el SHA integrado **`c87df0d`**.

Las credenciales nunca se escriben aquí. Apuntar PASS o FAIL en cada casilla. Un fallo **no se monta** en el vídeo: se avisa al coordinador y se repite la toma completa en la build corregida.

## 0. Antes de empezar (sin grabar)

| ✓ | Comprobación | Esperado |
|---|---|---|
| [ ] | TestFlight muestra **NIVL 1.0.7 (21)** y se instala esa build | Build 21, no la 20 |
| [ ] | Ajustes → General → Información | iOS **27.0.1 o posterior** (la última pública el día de la grabación). Anotar el modelo |
| [ ] | Abrir NIVL dos veces y cerrarla (por si se aplica alguna OTA) | Anotar el `updateId` si Perfil/Ajustes lo muestra; si no, «ninguna» |
| [ ] | Perfil → «NIVL Pro» con la cuenta Gratis | **Los cinco planes**, sin «Algún plan no está disponible…». Si aparece: **FAIL A6, NO grabar** (falta la oferta de RevenueCat) |
| [ ] | Ajustes → App Store → Cuenta sandbox | Sesión iniciada con la cuenta sandbox, nunca con la personal |
| [ ] | La cuenta U2 tiene un vínculo visible con la que graba (solicitud o ludus) | Para denunciar y bloquear |
| [ ] | «No molestar» activado; sin datos personales en ninguna cuenta | — |
| [ ] | Correo de Auth: el límite es de **100 correos por hora** (Resend, team@nivl.app; subido el 02/10). Los límites de inicio de sesión y registro siguen siendo los de por defecto, así que no hay que repetir decenas de intentos en el ensayo | El correo de confirmación de D llega en la toma buena |
| [ ] | Ensayo completo sin grabar, incluida la compra sandbox | Todo pasa |
| [ ] | Cerrar NIVL del todo | — |

**Cuentas** (definidas por el Chat 1 en `cuentas-demo.md`):

| Cuenta | Uso | Ojo |
|---|---|---|
| **D** (desechable) | Registro, login y borrado, **en cámara** | Correo de prueba exclusivo; se borra al final |
| **Gratis** (revisión, la de App Store Connect) | Compra sandbox y «Restaurar» **fuera del vídeo** (o en él si se decide) | No borrarla. Que pueda iniciar la prueba de 7 días |
| **Pro** (revisión) | Comprobar el nivel Pro **sin comprar** | No comprar ni restaurar con ella |
| **Élite** (revisión) | Comprobar Élite y su ludus **sin comprar** | No comprar ni restaurar; no tocar su ludus |
| **U2** | Ser denunciada y bloqueada | No se entrega a Apple |

## 1. La grabación (una sola toma, unos 6–9 min)

| ✓ | Escena | Qué hacer | Esperado | Casos |
|---|---|---|---|---|
| [ ] | 0 · Identificación (opcional) | Ajustes → Información (sin número de serie) y la ficha de TestFlight «1.0.7 (21)» | Visible | Ficha |
| [ ] | 1 · Lanzamiento | Inicio → icono de NIVL | Carga sin fallos y llega a Acceso | O-01 / A1 |
| [ ] | 2 · Registro | «CREAR CUENTA» → nombre, correo, contraseña y repetirla → casilla de Términos/Privacidad → «CREAR CUENTA» → abrir el enlace del correo **en el mismo iPhone** → «CONFIRMAR CUENTA» | Entra sola | O-02 / A2 |
| [ ] | 2 · Login | Cerrar sesión → «ENTRAR» → correo y contraseña de D → «ENTRAR» | Entra | O-03 / A3 |
| [ ] | 3 · Flujo típico | Edad y onboarding → crear una misión → completarla en Hoy (XP y racha) → Hábitos, campaña, Agenda | Responde sin errores | O-06, O-07 / A4 |
| [ ] | 3 · Salud | Módulo de salud: casilla desmarcada → «Ahora no» → todo sigue funcionando → Perfil → «Salud y bienestar» → aceptar | Funciona sin salud; luego se activa | O-04, O-05 / A5 |
| [ ] | 4 · Coach | «NIVL Pro» → «Probar el coach 7 días» → consentimiento de IA → «Acepto y activo el coach» → pedirle algo | Responde | O-12 / A5 |
| [ ] | 5 · Suscripciones | **Perfil → «NIVL Pro»**: los 5 planes, unos 2 s cada uno → renovación automática → abrir **Términos** y volver → abrir **Privacidad** y volver → (EULA) → compra sandbox → acceso activo → «Restaurar compras» | Título, periodo y precio de cada plan; compra y restauración funcionan; ningún texto menciona Google Play | O-09/A6, O-08/A7, O-10/A8, PAY-21 |
| [ ] | 6 · Denuncia y bloqueo | Amigos → U2 → ⋯ → motivo → «Enviar denuncia» → «Bloquear usuario» → desaparece → «Convivencia y seguridad» → «Desbloquear» y «Contactar con soporte» | Funciona | O-13 / A9 |
| [ ] | 7 · Datos y borrado | «Exportar mis datos» (cancelar la hoja) → «Envío de datos al coach» → enseñar «Retirar» → con D: «Eliminar cuenta» → «Eliminar para siempre» ×2 → intentar entrar con D | La cuenta ya no entra | O-14, O-15, O-16 / A10 |
| [ ] | 8 · Cierre | Pantalla de acceso → parar la grabación | — | — |

**Ficha que va con el vídeo:** build `1.0.7 (21)` · OTA `____` · modelo `____` · iOS `____` · fecha y hora `____` · marcas de tiempo de cada escena `____`. Entregar el archivo original del Carrete.

## 2. Bloqueantes fuera del vídeo (misma build 21)

| ✓ | Caso | Qué hacer | Esperado |
|---|---|---|---|
| [ ] | A-11 · Pro y Élite de revisión | Entrar con Pro y después con Élite | Cada una muestra su nivel **sin comprar** |
| [ ] | PAY-12 / O-11 · Restaurar tras recrear la cuenta (**obligatorio**) | Con una suscripción sandbox viva en una cuenta desechable: borrar la cuenta → crear otra → «Restaurar compras» | Acceso en la nueva; la vieja ya no existe |
| [ ] | PAY-02 · Compra nueva | Pro anual en sandbox con una cuenta desechable | «Activa» en ≤12 s |
| [ ] | W-21 · Salud rechazada → prueba | Rechazar salud → «Probar el coach 7 días» | La prueba se inicia (corregido en 0035) |
| [ ] | D-04 · iPad (modo compatibilidad) | Instalar desde TestFlight en un iPad y repetir las escenas 1, 2, 5 y 7 | Funciona y es legible |
| [ ] | D-01 / D-02 · iPhone pequeño y grande | Escenas 1, 3 y 5 | Sin cortes ni solapes |
| [ ] | D-03 · iOS mínimo 15.1 | Solo si hay un dispositivo antiguo | Si no lo hay: NO PROBADO, con motivo; no bloquea |
| [ ] | CAP-01…05 · Capturas | En /pro, una por plan, a 1320×2868 | Paywall nuevo |

## 3. Economía (build 21, no bloquean el envío a Apple)

Necesitan el servidor con las migraciones 0035–0043, que ya está desplegado.

| ✓ | Caso | Esperado |
|---|---|---|
| [ ] | W-01 · Dos iPhone con la misma cuenta abren Hoy tras un día fallado | **Una** «Misión de penalización»; XP descontado una sola vez |
| [ ] | W-02 · Abrir Hoy y cambiar de pestaña rápido tras medianoche | Ídem |
| [ ] | W-19 / W-20 · Hoy abierta a medianoche | «El día ha cambiado» y «caducó», sin pago |
| [ ] | W-25…W-28 · «Regreso a la arena» | Candado hasta completar una misión antigua de hoy; luego paga exactamente lo perdido |
| [ ] | W-29 · Vuelta tras más de 3 días | Se cobran como mucho 3 días; la tarjeta lo dice |
| [ ] | W-30 · Congelación vencida | No se cobran los días congelados |
| [ ] | W-23 · Gimnasio con 5 o más récords | Como mucho 150; el aviso muestra lo pagado |

## Evidencia ya disponible en c87df0d (solo automática)

| Prueba | Resultado |
|---|---|
| typecheck | PASS |
| Jest | PASS: 42 suites y 551 tests, incluidos los 52 tests `qa-*` |
| lint | PASS, 0 avisos |
| `deno check` del coach y test de paridad del espejo | PASS |

Lo ejecutó el Chat 5 el 02/10/2026 en un worktree aparte a ese SHA. El coordinador informa de deno 103/103 y de export iOS/Android/web OK en el mismo SHA.

**Nada de esto es evidencia física.** El dictamen sigue en **NO-GO** hasta tener marcados los bloqueantes de los apartados 0–2.
