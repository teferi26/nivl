# Prueba en dispositivo · NIVL 1.0.8 (OTA sobre la build 22)

**Candidato:** OTA del grupo `75d4bb6c` sobre la build **22**, código `winter2/integracion @ 762928d` (sustituye a `9a483144` / `7e92f75`).

**Pruebas automáticas en `762928d`** (Chat 5, worktree aparte sin cambios, 03/10/2026): typecheck PASS · Jest 83/83 suites, 1401/1401 tests · lint con 0 avisos · arnés SQL PGlite (0048, 0051 y 0052) 53/53 · `expo export --platform ios` OK · app.json 1.0.8. Nada de esto es evidencia física.

**Para quién:** el usuario, en su iPhone y, si puede, en Android. Son **15 pasos**, de mayor a menor importancia. Si se acaba el tiempo, quedan hechos los críticos.

**Cuenta:** una **cuenta de prueba**, nunca la personal ni las de revisión de Apple. No se borra nada real: el paso 15 usa una cuenta desechable creada para la prueba.

**Antes de empezar:**
- Abre y cierra NIVL **dos veces**: la OTA se descarga en un arranque y se aplica en el siguiente.
- Anota el modelo, la versión de iOS o Android y la hora.
- Marca cada paso con ✅ (va bien), ❌ (falla: apunta qué ves) o ⏭ (no se pudo probar).

## Críticos (P0)

| # | Qué hacer | Qué debe pasar | ✅ ❌ ⏭ |
|---|---|---|---|
| 1 | Abre la app desde el icono, con la sesión iniciada. | Llega a Hoy sin quedarse en blanco ni cerrarse. | |
| 2 | En Hoy, completa **una** misión con un toque normal y, en otra, haz **doble toque** rápido. | Cada misión suma su XP **una sola vez**; no aparecen dos avisos de XP para la misma. | |
| 3 | Si sale una celebración (nivel, rango o logro), ciérrala. Repite con la app pasada a segundo plano justo cuando aparece. | Al cerrarla, la app sigue usable; si iOS no la llega a mostrar, desaparece sola en ~1 s. **Nunca** queda una pantalla congelada. | |
| 4 | Abre el **Coach**, toca el micrófono **con el teclado abierto**, dicta una frase y envíala. | El dictado escribe lo que dices; el teclado no tapa el botón ni se cuelga el gesto. | |
| 5 | Pide al coach que hable (voz) y, **mientras habla, cambia de pestaña**. | La voz se detiene al salir del Coach y no se queda sonando en otra pantalla. | |
| 6 | Perfil → privacidad / datos → abre la **hoja de privacidad** y ciérrala sin cambiar nada. | La hoja se abre y se cierra sin errores; no cambia ningún consentimiento si no tocas nada. | |

## Importantes (P1)

| # | Qué hacer | Qué debe pasar | ✅ ❌ ⏭ |
|---|---|---|---|
| 7 | Mira la línea encima de «Misiones de hoy» con misiones pendientes. | Dice algo concreto («Te falta N para salvar la racha…» o «dejarlo te costaría X XP»), no el genérico de antes. Si una piedra te protege, lo dice; con coste 0, sin cifra. | |
| 8 | Perfil: mira tu rango, el marco del avatar y «faltan … para {rango}». | Rango, marco y título coherentes; el texto indica niveles y, si los hay, días activos. | |
| 9 | Amigos: abre el Ranking. Si tienes un amigo con rango, mira su corona. | Se ven alias, no nombres sin moderar; la corona corresponde a su rango. | |
| 10 | Amigos → «…» de un amigo → **Retar a duelo** (que el amigo lo acepte desde su móvil si puede). | La hoja del duelo se abre sin solaparse con el menú; el duelo aparece como pendiente y luego como aceptado. | |
| 11 | Crea una **liga** con un nombre e invita a un amigo; el amigo **acepta** desde su móvil. | El amigo no entra hasta aceptar; después los dos ven el tablero de la liga. | |
| 12 | **Compartir** un logro o tu nivel. Mira la hoja antes de compartir. | Al abrir, todo lo opcional está apagado (alias, foto, peso); la imagen generada no sale en negro ni con huecos. | |
| 13 | Abre **NIVL Pro** (sin comprar). | Se ven los planes con precio y periodo, «Restaurar compras» y los enlaces legales; se puede cerrar. | |

## Comprobaciones finales (P2)

| # | Qué hacer | Qué debe pasar | ✅ ❌ ⏭ |
|---|---|---|---|
| 14 | Busca una pantalla con un dato vacío (por ejemplo, una estadística sin datos). | Se ve «-» y no «0», «NaN» o un hueco. | |
| 15 | **Con una cuenta desechable nueva:** regístrate, haz el onboarding hasta el final y fíjate en cuándo aparece la oferta Pro. Al terminar puedes borrar **esa** cuenta. | La oferta no se abre encima de una celebración; se puede cerrar sin comprar. Nunca borres una cuenta real. | |

## Bloque B · Fotos y avisos (si queda tiempo; con una cuenta desechable de 18+)

| # | Qué hacer | Qué debe pasar | ✅ ❌ ⏭ |
|---|---|---|---|
| B1 | Sin haber confirmado los 18 años, abre Fotos de progreso. | No deja hacer, subir ni ver fotos; explica qué falta. (FOT-01) | |
| B2 | Confirma 18+ y la salud. Haz la foto de frente con la cámara y la de lado desde la galería. | Pide los permisos la primera vez; cada foto queda en su pose con la fecha de hoy. (FOT-02/03) | |
| B3 | Con dos fotos de la misma pose en fechas distintas, abre la comparación y prueba a compartirla. | Antes/después con sus fechas; la hoja de compartir trae todo apagado (peso incluido). (FOT-05/06) | |
| B4 | Deja misiones que rompan la racha y no abras la app por la noche. | Un aviso de racha ~90 min antes de dormir y **no** el de «El cierre del día se acerca». Como mucho 2 avisos del sistema en el día. (AV-01/02) | |

La lista completa de fotos y avisos (FOT-01..08, AV-01..08) está en `QA-FISICA-108.csv`.

## Qué NO cubre esta lista

- Compra y restauración en sandbox: están en `QA-FISICA-WINTER.csv` (PAY-*).
- El cambio de hora del 25/10 y las ausencias largas: cubiertos por los tests automáticos. En el teléfono solo se puede comprobar, pasados 7 días sin abrir la app, que el servidor deja de mandar push.
- iPad y Android en detalle: van en `QA-FISICA-108.csv`.

Al terminar, pasa la tabla (con ✅, ❌ o ⏭ y lo que veas en cada ❌) al Chat 5, que la vuelca en la matriz y emite el dictamen GO/NO-GO de 1.0.8.
