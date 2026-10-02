# Cuentas para App Review y para la grabación

**Sin credenciales.** Las pone el coordinador con el usuario directamente en App Store Connect (campos de acceso y notas) y en `nivl/privado/`, que está fuera de git. Este archivo solo dice qué cuentas hacen falta y cómo deben estar.

Apple: «If the app has multiple account types, provide credentials for each type in the Notes field» (mensaje del 29/09/2026).

| Cuenta | Para qué | Cómo se obtiene el acceso | Dónde van las credenciales | Reglas |
|---|---|---|---|---|
| **Gratis (revisión)** | El revisor la usa para la compra sandbox y «Restaurar compras» | Sin concesión. Debe poder iniciar la prueba de 7 días: si ya la gastó, restablecerla o avisar en las notas | Campos de acceso de ASC (ya cargados: hay credenciales, no leídas) | Sin edad, salud ni IA aceptadas. No borrarla |
| **Pro (revisión)** | Ver las funciones de Pro sin pagar | Concesión manual de servidor (la ejecuta el coordinador; Chat 2: `docs/payment-audit/DEMO-REVISION.md`) | Notas de ASC: `[PRO_USER]` / `[PRO_PASS]` | **No comprar ni restaurar con ella**: la compra sandbox sustituiría la concesión y luego caducaría. Sin consentimientos aceptados |
| **Élite (revisión)** | Ver Élite: coach avanzado, modo profundo, ludus | Concesión manual de servidor. Ya existía una Élite de demostración hasta el 28/11/2026 (`privado/apple-review-elite-summary.json`); el coordinador decide si se reutiliza | Notas de ASC: `[ELITE_USER]` / `[ELITE_PASS]` | Igual que Pro. No borrar su ludus de demostración (5 miembros) |
| **D (desechable)** | Vídeo: registro, login y borrado | Se crea en cámara con el registro de NIVL (`[SIGNUP_ROUTE]`) | No se entrega a Apple | Usar un correo de prueba exclusivo. Se borra al final del vídeo |
| **U2 (segundo usuario)** | Vídeo: denuncia, bloqueo y desbloqueo | Cuenta de prueba normal | No se entrega a Apple | Nunca usar una persona real. Necesita un vínculo visible (solicitud o ludus) con la cuenta que graba |
| **Sandbox de Apple** | Comprar en TestFlight sin cargo real | App Store Connect > Usuarios y acceso > Sandbox | Solo en el iPhone de grabación | Nunca usar un Apple ID real para la compra de prueba |

## Antes de enviar (coordinador)

- [ ] Las tres cuentas de revisión entran por `[LOGIN_ROUTE]` en la build `[BUILD]`. Probado el ____ en ____ (dispositivo).
- [ ] La cuenta Gratis de los campos de acceso de ASC entra con la build `[BUILD]` (Auth propio, sin Franky). Si no entra, crear una nueva y sustituir las credenciales en ASC.
- [ ] Pro y Élite muestran su nivel sin haber comprado. La concesión dura al menos 60 días desde el reenvío. Si se reutiliza la Élite existente (vence el 28/11/2026), ampliarla hasta al menos la fecha de reenvío + 60 días.
- [ ] La cuenta Gratis puede iniciar la prueba, o las notas dicen que ya la usó.
- [ ] Ninguna tiene aceptadas la edad, la salud ni la IA. Si un ensayo las aceptó, se retiran o se recrea la cuenta.
- [ ] Los marcadores `[PRO_USER]`, `[PRO_PASS]`, `[ELITE_USER]` y `[ELITE_PASS]` se han sustituido en las notas pegadas en ASC y en ningún archivo de git.
