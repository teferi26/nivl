# Repaso legal final (fase 3)

NIVL - Seguridad · 04/10/2026.

- **Textos revisados:** `nivl-web-v2`, ramas `master`/`hotfix/espera` (44e9ea9, publicada) y `winter2/chat4-web-v2` (privacidad 1.5).
- **Contraste:** con el código de `winter2/chat3-ia`.
- **Veredicto:**
  - lo publicado (`master`) puede seguir publicado;
  - `winter2/chat4-web-v2` **no se publica tal cual**: describe como activo el portal de creadores, que aún no tiene DNS;
  - hay **5 P1** y varios P2 que corregir, más **uno que decide el usuario** (garantías de transferencia por proveedor).

## P1

1. **El portal de creadores, citado antes de existir.**
   - Dónde: winter2 `privacidad.html` §11 y `creadores.html` §4 (dos veces).
   - Arreglo: esos párrafos se publican el mismo día que `creadores.nivl.app` funcione. Hasta entonces, `creadores.html` §4 dice: «Recibirás un desglose de ventas, anulaciones e importe.»
2. **Fotos de progreso sin la mención de 18+ en lo publicado.**
   - Dónde: `master` `privacidad.html` §9.
   - Arreglo: «Las fotos corporales de progreso y compartirlas solo están disponibles a partir de los 18 años; el coach solo ve su número, fecha y pose, no las imágenes.»
   - Esto corrige también «su análisis por IA» de winter2, que no existe: el coach recibe metadatos, no imágenes.
3. **Transferencias internacionales sin la garantía concreta (art. 13.1.f RGPD).**
   - Dónde: §6.
   - Arreglo: indicar el mecanismo de cada proveedor de EE. UU. (Supabase, Anthropic, RevenueCat, Expo, Vercel, Resend).
   - **Cuál usa cada uno (Marco de Privacidad UE-EE. UU. o cláusulas contractuales tipo) lo tiene que confirmar el usuario en el acuerdo de tratamiento de cada proveedor.** No se ha dado nada por cierto.
   - Plantilla: «Con [proveedor] la transferencia se ampara en [el Marco de Privacidad UE-EE. UU. / las cláusulas contractuales tipo de la Comisión Europea]. Puedes pedir copia en [correo de soporte].»
4. **El borrado de cuenta de un creador.**
   - Dónde: §7 dice que borrar la cuenta lo borra todo.
   - El problema: hasta que se aplique la 0056, la ficha del creador seguía activa. Con la 0056 queda desactivada y anonimizada, y la contabilidad se conserva.
   - Arreglo: tras aplicar la 0056, añadir a §7: «Si eres creador y eliminas tu cuenta, desactivamos tu código y anonimizamos tu alias; conservamos tus comisiones y liquidaciones el plazo que exige la normativa contable y fiscal, y para los ajustes por reembolsos.»
   - El plazo concreto lo confirma el usuario; con carácter general son 6 años (art. 30 del Código de Comercio).
5. **`espera.html` sin la primera capa informativa (art. 11 LOPDGDD).**
   - Arreglo, bajo la casilla: «Responsable: [titular]. Finalidad: avisarte del lanzamiento. Puedes ejercer tus derechos (acceso, supresión y los demás) en [correo de soporte]. Más información en la política de privacidad.»

## P2

- **Lista de espera, §11.** Mi texto decía «huella irreversible de tu IP», y no es exacto: es un HMAC con una clave que guarda NIVL (dato seudonimizado). Además, el freno también guarda una huella del correo.
  - Texto nuevo: «Para frenar envíos automáticos tratamos durante 48 horas una huella cifrada con una clave secreta (HMAC) de tu dirección IP y de tu correo. No guardamos tu IP en claro ni junto a tu correo en la lista.»
  - Añadir el origen: «o de dónde llegaste (el enlace de un creador o un parámetro de campaña)».
- **Fotos de progreso en §2/§3.** Pasarlas a la fila «Salud y cuerpo» (base: consentimiento explícito) en lugar de «ejecución del contrato».
- **Adjuntos al coach (§4/§6).** Cuando se despliegue el coach de `f240fb0`: «Las imágenes que adjuntas al coach solo se envían a Anthropic; nunca a DeepSeek.» Antes de desplegarlo NO es cierto (auditoría 1.0.8, P1-4).
- **Contraseña.** «se guarda cifrada con un hash irreversible» pasa a «se guarda como un hash irreversible».
- **Plazos que faltan en §7:** registros técnicos (el plazo del proveedor, por confirmar), confirmaciones de edad y de consentimiento (mientras exista la cuenta y el plazo de prescripción) y la huella de 48 h.
- **Versiones.** Hay dos textos con «1.4». Al publicar winter2, subir a «Versión 1.6» con fecha nueva.
- **`terminos.html`:**
  - §4 repite la frase de la contraseña;
  - §3 dice «coach… para quien tiene una suscripción»: añadir «o está en la prueba gratuita».
- **Android y Google Play.** Hoy aparecen como disponibles. Cambiar a «cuando esté disponible en Google Play», y en soporte poner «modelo de móvil».
- **`soporte.html`.** Añadir una pregunta frecuente: «¿Cómo salgo de la lista de espera? Escribe a [correo de soporte] desde ese correo y lo borramos.»
- **Google Fonts.** Opcional: servir las fuentes desde la propia web. Cada visita envía hoy la IP a Google, aunque está informado en §11.

## Correcto

- Datos LSSI del titular.
- Edad mínima de 16 años, igual que `EDAD_MINIMA` en el código; creadores y fotos, 18+.
- Precios iguales a `docs/PRECIOS.md`.
- La lista de proveedores casa con el código.
- DeepSeek y China explicados con honestidad.
- El borrado en RevenueCat existe de verdad.
- Las rutas «Eliminar cuenta», «Exportar» y «Salud» existen en la app.
- La lista de espera casa con la 0054.
- Sin Turnstile, sin «extremo a extremo», sin certificaciones ni pruebas inventadas, sin analítica.
- Derechos: plazo de un mes y AEPD.
- Desistimiento y cláusulas de Apple.
- Aviso de que no es consejo médico ni financiero, con el 024.
