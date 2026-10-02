# Fase 2 · Monetización y creadores — plan (Chat 2, 02/10/2026)

Base `winter2/integracion @99729ea`, rama `winter2/chat2-monetizacion`. Reglas: build 21 intocable; 1.0.8 binario nuevo; servidor solo aditivo y compatible con 1.0.7; sin patrones oscuros (3.1.2/5.6); recompensas por invitar sin dinero ni XP inflacionario; pagos a creadores fuera de la app.

## Normas que mandan (fuentes oficiales, consultadas el 02/10/2026)

- Paywall (Apple 3.1.2, página de suscripciones; Google política de suscripciones): nombre, duración, precio completo de renovación localizado; el importe que se cobra es el precio más destacado (el «≈/mes» de un anual va menor); prueba = duración + lo que se cobra después; Términos, Privacidad y Restaurar visibles; cierre visible desde el primer instante. Rechazos típicos: X retrasada o sin contraste, precio semanal/mensual destacado sobre un cobro anual, «gratis» sin el cobro posterior, casilla de prueba activada por defecto, varios toques encadenados hasta comprar.
- Días de suscripción concedidos desde nuestro servidor como recompensa (y los «promotional entitlements» de RevenueCat) son acceso fuera de IAP para algo que se vende: **zona de riesgo 3.1.1**. Las vías conformes son de tienda: Offer Codes (Apple, también códigos personalizados, caducan ≤6 meses, ≤10 ofertas activas por SKU), Promotional Offers (solo suscriptores actuales/antiguos, firmadas en servidor) y promo codes / ofertas de Google.
- Panel de comisiones de creador en la app: permitido si es solo lectura y sin botones de pago ni enlaces externos; pagos a creadores fuera de la app (no son cobros al usuario). Nada de incentivar valoraciones ni pagar por instalación (Apple 3.2.2(x), Google). Retos: premios por mérito y entrada gratis; premios reales exigen bases dentro de la app y cláusula «Apple no es patrocinador» (5.3).

URLs: developer.apple.com/app-store/review/guidelines · developer.apple.com/app-store/subscriptions · developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-subscription-offer-codes · support.google.com/googleplay/android-developer/answer/9900533, 9898684, 6321495, 9858738 · revenuecat.com/docs (ios-subscription-offers, google-play-offers, webhooks event types) · revenuecat.com/v2.3/reference/grant-a-promotional-entitlement.

## Decisiones

- **D1 Momento de valor.** Dos momentos: (a) tras la firma del onboarding (ya existe; se mantiene saltable con «Empezar gratis» visible arriba y en el pie); (b) el primer valor real: primer día cerrado con ≥1 misión, o primera misión del día 2, mostrado DESPUÉS de cerrar la celebración, nunca encima. Topes: ≤1 hoja/día, ≤2/semana, 72 h tras «Ahora no».
- **D2 Prueba.** 1.0.8 conserva la prueba de servidor (decisión del usuario, fase 1). El cliente ya declara la oferta introductoria de tienda si se configura. **Recomendación (decisión del usuario):** tras la aprobación de 1.0.7, configurar en ASC/Play «7 días gratis» en los anuales y ocultar la prueba de servidor en builds de tienda; mientras la 1.0.7 está en revisión no se tocan los productos.
- **D3 Invitar (propuesta a Chat 5).** NO se conceden días de Pro desde el servidor (3.1.1). Recompensas 1.0.8: cosméticas y de estatus para quien invita (insignia/marco «Reclutador» con niveles 1/3/10 invitados ACTIVOS; los define Chat 5, cero XP) y el invitado entra con la prueba normal. Vía de tienda preparada para 1.0.9: Offer Code personalizado para el invitado (lo crea el usuario en ASC; Google promo code) y Promotional Offer «1 mes gratis» para quien invita y ya paga (requiere clave de suscripciones .p8 en servidor). Activación del invitado = 3 días distintos con progreso en 14 días y ≥72 h de cuenta; topes y `unique` anti-abuso.
- **D4 Creadores.** Rangos y comisiones de `docs/PRECIOS.md` (25/35/50 %, base 100 €, primer pago, mensual hasta tope, retención 30 días). El ascenso de rango nunca es automático (sube la comisión): el script propone, el dueño aplica. Enlaces `https://nivl.app/c/CODIGO`. Sin datos de creadores en el repo.

## Lotes (cada uno con tsc, Jest, lint y export en verde)

| Lote | Contenido | Archivos | Servidor |
|---|---|---|---|
| L1 | Momento de oferta y upsell contextual (módulo puro + historial local + contrato para Chat 4); ProOffer con `motivo`; `/pro?motivo=&tier=`; importe cobrado como precio principal | NUEVO `src/lib/paywallmoment.ts` + test; `pro.ts`, `proplans.ts`, `ProOffer.tsx`, `pro.tsx` | ninguno |
| L2 | Invitaciones con recompensa cosmética: `claim_invite`, `settle_my_invites`, `my_invites`; `invites` + `invite_rewards` (auditoría, sin días) | NUEVO `src/lib/invites.ts` + test; SQL A (nº a asignar); NUEVO `scripts/test-invites.mjs` | aditivo |
| L3 | Programa de creadores gamificado: rol creador/comercial/clipper, retos, histórico mensual propio, tabla por periodo, progreso de rango; kit de clips; contrato `PortalCreador` para la web | `src/lib/{creatormath,creators}.ts` (+tests), NUEVO `src/lib/creatorprogram.ts` + test; `scripts/creadores.mjs`; SQL B; NUEVO `scripts/test-creator-program.mjs` | aditivo |
| L4 | Auditoría 3.1.2/5.6/3.1.1/3.2.2 por pantalla con Chat 1; contrato de datos a Chat 4; casos físicos a Chat 5 | `docs/payment-audit/FASE2-*.md` | — |

## Reclamaciones

Existentes (fase 1): `src/lib/{pro,proplans,subscription,storepolicy,tienda,tienda.native}.ts`, `src/app/pro.tsx`, `src/components/ProOffer.tsx`, funciones store-*/revenuecat/stripe, `docs/payment-audit/**`. Nuevas: `src/lib/{paywallmoment,invites,creatorprogram}.ts`, `src/lib/{creatormath,creators}.ts` y sus tests, `scripts/creadores.mjs`, `scripts/test-invites.mjs`, `scripts/test-creator-program.mjs`. UI de `onboarding.tsx`, `creador.tsx`, `amigos.tsx` y portal web: Chat 4 con mis contratos.

## Dependencias

- Chat 4: maquetar el paso de oferta, la hoja de upsell, `creador.tsx`, la sección de invitar y el portal web con `ofrecerSi()`, `ProOffer({motivo, initialTier})`, `PortalCreador`, `fetchMyInvites()`.
- Chat 5: evento «primer día cerrado» y bandera de celebración en curso; aprobar D3 y diseñar la insignia «Reclutador»; embudo que llama a `claim_invite`/`settle_my_invites`.
- Chat 3: revisión anti-abuso de L2; qué nivel da voz premium y análisis de fotos (alimenta los momentos); exportación de `invites`.
- Chat 1: `nivl.app/c/*` en AASA/assetlinks y `URL_NIVL`; dictamen 3.1.1/3.2.2 de D3; Offer Codes/Promotional Offers en ASC para 1.0.9.
- Coordinador: números SQL (A invitaciones, B creadores) y huellas; decisión del usuario sobre D2.
