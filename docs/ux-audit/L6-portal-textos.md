# L6 · Portal de creadores: propuesta de textos legales (R6)

Chat 4 · 03/10/2026. **Solo propuesta.** No se ha tocado la web (`nivl-web-v2/creadores.html`,
`privacidad.html`) ni ningún texto legal publicado. La revisa el Chat 3 (condición R6 de
`docs/security-audit/portal-creadores.md`, rama `winter2/chat3-ia`) y la publica quien
corresponda cuando el portal esté desplegado y las pruebas de §5 de ese informe estén cerradas.
Mientras `creadores.nivl.app` no exista, nada de esto se publica: las condiciones no pueden
remitir a un portal que no está.

Contrato de referencia: `docs/payment-audit/PORTAL-CREADORES.md` (rama `winter2/chat2-monetizacion`).

Base: condiciones del programa versión 1.1 (27/09/2026) y política de privacidad tal y como están
hoy en `nivl-web-v2`.

## 1. Condiciones del programa de creadores

### 1.1 Apartado 4 (retención, reembolsos y pagos): añadir un punto al final

> **Portal de creadores.** En creadores.nivl.app puedes consultar, con tu cuenta de NIVL, tu
> rango, tus ventas atribuidas, tus retos, tu puesto en la tabla y tus importes: en retención,
> disponibles, pagados y anulados, y las últimas liquidaciones recibidas. Es solo de consulta: no cobra,
> no liquida y no pide ni guarda datos bancarios ni fiscales, que se siguen acordando por escrito
> como dice este apartado. Si una cifra del portal no casa con el desglose de una liquidación,
> manda el desglose; escríbenos y lo revisamos.

Y en el punto «Liquidación», la última frase pasa a:

> Recibirás un desglose de ventas, anulaciones e importe, que también puedes ver en el portal de
> creadores.

### 1.2 Apartado 7 (datos personales): ajustar la última frase

Hoy dice que el creador solo ve cifras agregadas de sus altas y ventas. Con el portal ve también
sus propios importes y, en la tabla, el alias y las ventas de los demás creadores. Propuesta:

> El creador solo ve cifras agregadas de sus altas y ventas y sus propios importes; nunca datos
> personales de los usuarios ni importes de otros creadores. En la tabla del programa aparecen el
> alias, las ventas y el puesto de cada creador activo.

Nota para el Chat 3: que el alias y las ventas de cada creador sean visibles para los demás ya
ocurre en la app (`creator_board`); aquí solo se hace explícito. Si se prefiere que la tabla sea
opcional por creador, es un cambio de producto, no de texto.

## 2. Política de privacidad

### 2.1 Tabla de datos, fila «Creadores»: sin cambios de categorías

El portal no recoge datos nuevos: muestra lo que ya está en la fila (código, ventas atribuidas,
alias, datos de pago y facturación del creador). No se añade ninguna categoría.

### 2.2 Añadir un párrafo en el bloque de creadores (o donde se describen los servicios)

> **Portal de creadores (creadores.nivl.app).** Si participas en el programa de creadores, puedes
> entrar con tu cuenta de NIVL en un panel web de solo lectura. Muestra únicamente tus propios
> datos del programa: rango, ventas atribuidas, retos, puesto en la tabla e importes de tus
> comisiones y liquidaciones. No muestra datos personales de los usuarios que llegaron con tu
> código ni importes de otros creadores, y no recoge datos bancarios ni fiscales. Para mantener la
> sesión iniciada, el navegador guarda en su almacenamiento local la sesión de tu cuenta de NIVL
> en ese dominio; se borra al cerrar sesión. No usamos cookies de análisis ni de publicidad en el
> portal.

Notas para el Chat 3 sobre este párrafo:

- «Almacenamiento local»: es lo que hace hoy supabase-js (`localStorage`, contrato del Chat 2).
  Si se adopta el opcional de R2 (`sessionStorage`), la frase pasa a «la sesión dura hasta que
  cierras la pestaña o cierras sesión».
- Es almacenamiento estrictamente necesario para el servicio que pide el usuario (art. 22.2 LSSI):
  no requiere banner de consentimiento. Hay que confirmar que el despliegue no añade analítica de
  Vercel ni ningún script de terceros (la CSP de R4 ya lo impediría).
- Base jurídica: la misma que ya figura para el creador (ejecución del contrato). No cambia.

## 3. Textos en el propio portal (ya en el código, para que el Chat 3 los vea juntos)

- Login: «PORTAL DE CREADORES» · «Entra con tu cuenta de NIVL para ver tu panel de creador.» ·
  «¿Olvidaste la contraseña? Cámbiala desde la app de NIVL y vuelve aquí.» · enlaces a Términos y
  Privacidad. Sin registro ni restablecer contraseña.
- Cuenta sin panel: «Este panel es para creadores del programa» · «Con esta cuenta no hay panel
  que mostrar.» No dice si la cuenta existió como creador ni si está inactiva.
- «Cerrar sesión» en la cabecera (icono) y como botón al final de cada estado.
