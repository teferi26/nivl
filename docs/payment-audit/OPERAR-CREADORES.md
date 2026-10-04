# Operar el programa de creadores (manual del dueño)

Fase 3 · Chat «NIVL - Compras» · 04/10/2026. Solo documentación.

Este manual es para que lleves el programa tú solo: dar de alta, ver qué ha
vendido cada uno, pagar y responder dudas. Todo lo que se cita se ha comprobado
contra el código real (`scripts/creadores.mjs`, migraciones 0025, 0027, 0031,
0046 y 0060, `src/lib/creators.ts`, `src/lib/creatorprogram.ts`,
`src/app/creador.tsx`, `src/app/c/[code].tsx`) y contra las condiciones
publicadas en la web (`nivl-web/creadores.html`, versión 1.1).

> **El repo es público.** En este archivo, en un commit, en un issue o en una
> captura no va nunca un código real, un alias, un email, un importe ni un
> pago. Los ejemplos usan `AAA_TEST`, «Ejemplo Test» y `@example.com`. La
> salida del script se queda en tu terminal o en `privado/` (gitignorado).

Palabras que salen mucho:

- **Creador**: cualquiera del programa. Tiene un **rol** (creador, comercial o
  clipper: solo cambia qué retos ve) y un **rango** (novato, pro o élite: es lo
  que fija su comisión).
- **Atribución**: la cuenta de un usuario queda unida a un creador, para
  siempre, porque metió su código.
- **Venta**: una cuenta atribuida que hace su **primer cobro real** en la
  tienda. Los cobros mensuales siguientes suman dinero, no ventas.
- **Retención**: los 30 días que espera cada comisión por si hay reembolso.
- **Disponible**: comisión que ya pasó la retención y está lista para pagar.
- **Clawback** (descuento): una comisión que ya pagaste y luego se reembolsó; se
  resta sola en el siguiente pago.
- **Liquidar**: apuntar en la base que has pagado. La transferencia la haces tú
  fuera; el script no mueve dinero.

---

## 1. Antes de empezar

### Qué necesitas

| Qué | Dónde | Notas |
|---|---|---|
| Node 18 o superior | tu ordenador | el script usa `fetch` nativo |
| El repo clonado | tu ordenador | el script se lanza desde la raíz |
| `EXPO_PUBLIC_SUPABASE_URL` | archivo `.env` de la raíz, o variable de entorno | de ahí saca el proyecto de Supabase |
| Token personal de Supabase | `supabase-token.txt` en la raíz (gitignorado), o variable `SUPABASE_ACCESS_TOKEN` | se crea en supabase.com → Account → Access tokens; el mismo que usa `apply-migrations.mjs` |
| Una terminal interactiva | — | `liquidar` y `pago` te piden escribir el código para confirmar |

El token personal da acceso total a tus proyectos de Supabase: trátalo como la
llave de casa. No lo pegues en chats, no lo subas, y si sospechas que se ha
visto, revócalo y crea otro.

El script habla con la base por la Management API con permisos de dueño. Por
eso no hay pantalla de administración: nadie más puede hacer esto.

### Comprobar que funciona

Sin argumentos, el script imprime la lista de comandos:

```bash
node scripts/creadores.mjs
```

Y esto lista los creadores (si no hay ninguno, te lo dice):

```bash
node scripts/creadores.mjs lista
```

Si falta el token o la URL, el script lo dice con un mensaje claro y no hace
nada.

### Ajustes que conviene revisar una vez

`informe` enseña en su cabecera los parámetros vivos: si estás en el Small
Business Program, los días de retención (30), el % de renovación (0) y el plazo
para meter un código (14 días).

Cuando Apple te acepte en el **Small Business Program**, díselo a la base. Por
defecto está en «no», y eso calcula el neto como si Apple se quedara el 30 % y
limita el Pro anual al 35 %:

```bash
node scripts/creadores.mjs sbp si
```

Si sales del programa (más de 1 M $ al año):

```bash
node scripts/creadores.mjs sbp no
```

La retención, el % de renovación y el plazo del código **no tienen comando
hoy**; solo se cambian con SQL en `creator_settings`. Las condiciones publicadas
dicen 30 días y 14 días: si los cambias, cambia antes las condiciones (aviso de
15 días).

---

## 2. Dar de alta a alguien

### 2.1 Alta

El código va en mayúsculas, de 3 a 20 letras, números o `_`. El alias es el
nombre que verán los demás creadores en la tabla (de 1 a 40 caracteres, entre
comillas). El rango es opcional; si no lo pones, entra como novato.

```bash
node scripts/creadores.mjs alta AAA_TEST "Ejemplo Test"
```

Con rango inicial pro:

```bash
node scripts/creadores.mjs alta AAA_TEST "Ejemplo Test" pro
```

Salida esperada: `Alta: AAA_TEST · Ejemplo Test · creador novato. Enlace:
https://nivl.app/c/AAA_TEST`. Si el código ya existe, lo dice y no toca nada.

El **rol** no se pone en el alta: todos entran como «creador». Para un clipper
o un comercial, cámbialo después:

```bash
node scripts/creadores.mjs rol AAA_TEST clipper
```

El rol solo cambia qué retos ve. La comisión sigue siendo la de su rango.

### 2.2 Vincular su cuenta de NIVL

Para que vea su panel, el creador tiene que haber entrado al menos una vez en
NIVL con su email. Luego:

```bash
node scripts/creadores.mjs vincular AAA_TEST creador.test@example.com
```

Desde ese momento le sale la fila «Panel de creador» en Perfil. Si responde «o
el código no existe o esa cuenta no ha entrado nunca en NIVL», pídele que abra
la app y entre, y repite.

Una cuenta solo puede estar vinculada a un creador. Si intentas vincular una
que ya lo está, la base lo rechaza con un error técnico (`duplicate key`): no
pasa nada, simplemente no se hace.

No existe hoy un comando para **desvincular**. Para pasar el panel a otra
cuenta del mismo creador, basta con volver a lanzar `vincular` con el email
nuevo (sustituye al anterior).

### 2.3 Cómo comparte su código

El creador tiene dos cosas: su **código** (`AAA_TEST`) y su **enlace**
`https://nivl.app/c/AAA_TEST`. Díselo así de claro:

- **Lo que de verdad cuenta es el código.** Sin un servicio de atribución de
  pago, quien pulsa el enlace sin tener la app llega a la tienda y el código se
  pierde. Por eso la app pregunta «¿Quién te trajo?» al crear la cuenta.
- La página `nivl.app/c/AAA_TEST` enseña el código en grande, con botones para
  descargar, abrir la app y copiar el código.
- Si el usuario ya tiene la app, el botón «Abrir la app» (`nivl://c/AAA_TEST`)
  guarda el código y lo manda solo en cuanto entra.
- Mientras el dominio `nivl.app` y los enlaces universales no estén activos, el
  enlace web solo enseña esa página; el código sigue funcionando igual.

### 2.4 Qué pasa cuando alguien mete el código

El usuario lo puede meter en el onboarding (campo opcional «¿Quién te trajo?»,
precargado si entró por el enlace) o después en **Perfil → Código de creador**
(la fila solo sale mientras está en plazo). Si no hay red, el código queda
guardado en el móvil y se reintenta al volver a entrar.

La base lo acepta solo si se cumple todo esto:

| Motivo de rechazo | Lo que ve el usuario |
|---|---|
| La cuenta ya tiene a alguien que la trajo (es para siempre, gana el primero) | «Tu cuenta ya tiene a alguien que te trajo.» |
| El código no existe o el creador está desactivado | «El sistema no reconoce ese código.» |
| Es el código del propio usuario | «Ese código es el tuyo. Nadie se trae a sí mismo.» |
| La cuenta ya paga o ha pagado (cualquier cobro de tienda, o un plan de pago que no sea la prueba de 7 días) | «Tu cuenta ya tiene un plan de pago…» |
| Han pasado más de 14 días desde su primer acceso a NIVL | «El código solo se añade en los primeros días…» |

La prueba gratis de 7 días no cuenta como «ya paga»: alguien en prueba sí puede
meter un código.

Cada atribución cuenta como una «cuenta» en el panel del creador (no son
instalaciones: no se pueden medir).

No existe hoy un comando para **atribuir a mano** una cuenta (la base sí admite
el origen `manual`). Propuesta: `atribuir CODIGO email`, con las mismas reglas
de la tabla. Aun así, una atribución tardía nunca recupera cobros anteriores
(ver 3.1).

---

## 3. Cómo se generan las comisiones

### 3.1 De dónde salen

Nadie apunta ventas a mano. El recorrido es:

1. El usuario paga en la App Store o en Google Play.
2. RevenueCat avisa al webhook de NIVL (`revenuecat-webhook`).
3. La base (`apply_store_event`) decide si es un cobro real y, si lo es, llama
   a `record_sale`, que guarda la venta y, si la cuenta está atribuida a un
   creador **activo**, calcula la comisión.

Solo genera comisión un cobro que cumpla **todo**:

- Entorno de producción. El sandbox (TestFlight, revisión de Apple) da acceso
  al plan pero nunca crea ventas.
- App Store o Google Play.
- No es la prueba gratis, ni precio 0, ni Family Sharing.
- Es una compra inicial o una renovación (la conversión de la prueba llega
  como renovación y cuenta como primer cobro).

Lo que **no** genera comisión hoy:

- Ventas por la web con Stripe: el webhook de Stripe no llama a `record_sale`.
  Si algún día vendes Pro en la web y quieres pagar comisión por ellas, hay que
  añadirlo.
- Cobros de una cuenta atribuida mientras su creador estaba **desactivado**: la
  venta se guarda sin creador y no se recupera al reactivarlo.
- Cobros anteriores a la atribución.

### 3.2 Cuánto

La base es siempre **100 €**, compre Pro o Élite. El tope por cuenta es 100 € ×
el % del rango: 25 € (novato), 35 € (pro) o 50 € (élite).

- **Anual**: el primer cobro paga el tope entero de golpe.
- **Mensual**: cada mes cobrado paga el % del creador sobre el neto de ese mes
  (sin IVA y sin la comisión de la tienda), hasta llegar al mismo tope. Si el
  usuario se va antes, no hay más.
- Si pasa de mensual a anual a mitad, el anual paga solo lo que falte hasta el
  tope. Un cambio de Pro a Élite no reinicia el tope.
- **Renovaciones**: 0 % (parámetro `renewal_pct`, como mucho 10 %).
- **Fuera del Small Business Program**, el Pro anual se limita al 35 %: el tope
  es 35 € también para un élite.
- El % queda «fotografiado» en cada comisión: subir o bajar de rango no cambia
  lo ya generado. Ojo: en una cuenta mensual que aún no ha llenado su tope, los
  meses siguientes sí usan el rango nuevo.

### 3.3 Retención de 30 días

Cada comisión nace «pendiente» y pasa a «disponible» 30 días después del cobro.
No hay ningún proceso que lo haga: la base lo calcula por la fecha.

### 3.4 Reembolsos

Cuando Apple o Google devuelven el dinero, RevenueCat lo avisa y la base:

- Si la comisión **aún no estaba pagada**: la anula. Desaparece sola.
- Si **ya la habías pagado**: la anula y la marca como descuento (clawback). Se
  resta sola en el siguiente `liquidar`.

Apple acepta reembolsos hasta unos 90 días, más que la retención: por eso puede
haber descuentos de comisiones ya pagadas.

Si Apple **revierte un reembolso** (`REFUND_REVERSED`), hoy la base solo lo
apunta; la comisión sigue anulada. Si quieres devolvérsela al creador, apúntalo
como ajuste (ver 5.4).

---

## 4. Rangos y retos

### 4.1 Umbrales

Los umbrales sirven solo para **proponer** cambios de rango. Se fijan con el
número de ventas en los últimos 90 días y, si quieres, los meses seguidos con
al menos una venta. Novato no lleva umbral.

```bash
node scripts/creadores.mjs umbral pro 10
```

Con meses seguidos (por ejemplo, 3):

```bash
node scripts/creadores.mjs umbral elite 30 3
```

Para quitar un umbral:

```bash
node scripts/creadores.mjs umbral elite --quitar
```

No existe hoy un comando para **ver** los umbrales puestos. Propuesta: `umbral
lista`. Mientras, mira la consulta H de la sección 6.4.

Los números de arriba son ejemplos: decide los tuyos. Las condiciones dicen que
el rango «se gana por resultados» y que puedes revisarlo cada mes.

### 4.2 Revisar rangos

Este comando compara a cada creador activo con los umbrales y enseña una tabla
de propuestas (sube o baja). **No cambia nada**:

```bash
node scripts/creadores.mjs revisar-rangos
```

Para aplicar **todas** las propuestas hacen falta las dos marcas juntas:

```bash
node scripts/creadores.mjs revisar-rangos --aplicar --confirmar
```

Con `--aplicar` solo, no cambia nada. Si alguien cambió un rango entre medias,
ese no se pisa.

Cuidado: `--aplicar` aplica la lista entera, también las bajadas. Si has subido
a alguien a mano por encima de lo que marcan los umbrales, aparecerá propuesto
para bajar. Si solo quieres algunas propuestas, no uses `--aplicar`: cambia esos
rangos uno a uno.

### 4.3 Cambio manual de rango

```bash
node scripts/creadores.mjs rango AAA_TEST pro
```

Las comisiones ya generadas conservan su %.

### 4.4 Retos

Un reto es un objetivo de ventas entre dos fechas (hora de Madrid; el último
día entra entero). Puede ser para todos o solo para un rol.

Ver los retos:

```bash
node scripts/creadores.mjs reto lista
```

Crear un reto para todos, sin premio:

```bash
node scripts/creadores.mjs reto alta "Reto de prueba" 2026-11-01 2026-11-30 5
```

Solo para clippers, con descripción:

```bash
node scripts/creadores.mjs reto alta "Reto de prueba" 2026-11-01 2026-11-30 5 --rol clipper --desc "Texto de ejemplo"
```

Cerrar un reto (el ID sale en `reto lista`). Si aún no ha empezado, se borra;
si está en curso, termina ahora y su tabla queda congelada:

```bash
node scripts/creadores.mjs reto cerrar 00000000-0000-0000-0000-000000000000
```

Si pones la fecha de fin antes que la de inicio, la base lo rechaza con un error
técnico; no se crea nada.

**Premios: las reglas que no se saltan.**

- Hoy las condiciones publicadas dicen que **no hay convocatoria de premios
  activa**, ni fijo mensual. Mientras sea así, crea retos sin premio (son
  motivación y tabla, nada más).
- Si algún día pones un premio real (dinero o un regalo): primero publica unas
  **bases separadas** en la web (participantes, territorio, fechas, criterio,
  desempate, premio concreto, presupuesto máximo, entrega, impuestos) y solo
  después crea el reto. Las bases y el reto deben decir que **Apple y Google no
  patrocinan ni participan** y no son responsables del premio (las condiciones
  ya lo dicen; repítelo en las bases). Los retos se ven dentro de la app, así
  que aplica la norma de concursos de Apple (5.3).
- El premio se gana **solo por mérito** (ventas reales), nunca por sorteo y
  nunca pagando nada para participar.
- Nunca un reto de instalaciones, valoraciones o reseñas (ver sección 7).
- En la app de tienda, un premio, título o descripción que hable de dinero no
  se enseña (se filtra solo); en el portal web, sí.
- El premio, cuando lo pagues, se apunta con `pago … premio` (ver 5.4).

Hay además un «premio del mes» general que sale en el panel:

```bash
node scripts/creadores.mjs premio "Texto de ejemplo"
```

```bash
node scripts/creadores.mjs premio --quitar
```

Con las condiciones actuales debe estar vacío. El script no te avisa si lo
rellenas: hazlo solo después de publicar bases.

---

## 5. Pagar cada mes (liquidación)

### 5.1 Ver cuánto hay

El informe del mes (por defecto, el mes en curso en hora de Madrid):

```bash
node scripts/creadores.mjs informe
```

De un mes concreto:

```bash
node scripts/creadores.mjs informe 2026-10
```

Y además guardarlo en un CSV (en céntimos, separado por `;`) en `privado/`:

```bash
node scripts/creadores.mjs informe 2026-10 --csv
```

Columnas que importan: `retencion` (aún en los 30 días), `disponible` (lo que
puedes pagar ya), `clawback` (descuentos pendientes), `pagado_mes` y
`pagado_total`.

### 5.2 Liquidar

```bash
node scripts/creadores.mjs liquidar AAA_TEST
```

Con una nota (máximo 280 caracteres; no pongas IBAN ni datos personales):

```bash
node scripts/creadores.mjs liquidar AAA_TEST "Liquidación de octubre"
```

Qué hace, en orden:

1. Enseña cada comisión disponible (producto, fecha del cobro, desde cuándo
   está disponible), el total disponible, los descuentos y el **A pagar**.
2. Si no hay nada que pagar, lo dice y termina.
3. Te pide escribir el código (`AAA_TEST`) para confirmar. Cualquier otra cosa
   cancela sin tocar nada. Así puedes usarlo para **mirar** sin pagar.
4. Al confirmar, la base (`liquidate_creator`) apunta un pago de tipo
   «comisiones», marca esas comisiones como pagadas y da por saldados los
   descuentos. Imprime `Apuntado: X € a AAA_TEST`.

**Transfiere exactamente la cifra de la línea «Apuntado»**, no la de la vista
previa: la base recalcula en el momento de confirmar y, si entre medias una
comisión pasó a disponible o llegó un reembolso, puede variar unos euros.

Haz la transferencia el mismo día en que apuntas. No hay un comando para
deshacer una liquidación: si apuntas y luego no pagas, el panel del creador dirá
«cobrado» sin serlo.

Si los descuentos superan a lo disponible, «A pagar» sale 0, no se apunta nada
y el descuento queda pendiente para el mes siguiente. Nunca le pidas al creador
que te devuelva dinero por esto salvo fraude: se compensa solo con lo que vaya
generando.

### 5.3 Pagar fuera

El pago real lo haces por transferencia bancaria (o Stripe/Whop, lo que hayas
acordado por escrito con cada creador). Según las condiciones:

- Liquidación mensual, a mes vencido, con el medio y el mínimo (si lo hay)
  acordados por escrito antes de empezar.
- El creador te manda factura cuando corresponda; tú aplicas las retenciones
  que marque la ley. Pregunta a tu gestor: este manual no es asesoría fiscal.
- Mándale un desglose de ventas, anulaciones e importe. La tabla que enseña
  `liquidar` sirve de base (cópiala a un documento privado, nunca al repo).
- IBAN, NIF y facturas **no van a la base de NIVL**. Guárdalos fuera (tu
  gestoría, una carpeta privada).

### 5.4 Otros pagos (no comisiones)

Para todo lo que no sea comisión hay `pago`, con cuatro tipos: `fijo_mensual`,
`premio`, `contenido_externo` (por ejemplo, vistas pagadas en Whop) y `ajuste`.
También pide escribir el código para confirmar.

```bash
node scripts/creadores.mjs pago AAA_TEST 20 premio "Premio del reto de prueba"
```

Un ajuste puede ser negativo (para corregir un apunte):

```bash
node scripts/creadores.mjs pago AAA_TEST -5 ajuste "Corrección de ejemplo"
```

El pago se apunta siempre en el mes en curso; no se puede elegir otro mes.

Hay también un comando para fijar un fijo mensual que se ve en el panel:

```bash
node scripts/creadores.mjs fijo AAA_TEST 0
```

Las condiciones actuales dicen que **no hay fijo mensual**. Déjalo en 0 salvo
que firmes un acuerdo por escrito con ese creador. Fijarlo solo lo enseña: el
pago se apunta aparte, cada vez, con `pago … fijo_mensual`.

### 5.5 Qué ve el creador

- **En la app (iPhone y Android)**: rango y progreso al siguiente, código y
  enlace, cuentas y ventas, retos, tabla del mes (alias y ventas de los demás,
  nunca su dinero) e histórico de ventas por mes. **Ningún importe**, ni %, ni
  pagos. Una línea de texto: «Tus ganancias se gestionan fuera de la app.» Sin
  botón ni enlace de cobro. Esto es a propósito (normas de las tiendas): no lo
  cambies.
- **En el portal web** (`creadores.nivl.app`, cuando esté publicado): lo mismo
  más su dinero: en retención, disponible, cobrado, descuentos, fijo y los
  últimos 12 pagos. Entra con su misma cuenta de NIVL. Solo lectura.

Después de liquidar, el pago aparece al momento como cobrado.

### 5.6 Calendario recomendado

| Cuándo | Qué |
|---|---|
| Días 1 a 5 de cada mes | `informe` del mes anterior (con `--csv` si quieres guardarlo) |
| Mismo día | `revisar-rangos` (solo mirar) y decidir cambios |
| Días 5 a 10 | `liquidar` a cada creador con algo disponible, transferencia y desglose |
| Cuando llegue | factura del creador, a tu carpeta privada |
| Cada mes | borrar de `privado/` los CSV que ya no necesites |

Una venta hecha el día 20 pasa la retención el día 19 o 20 del mes siguiente:
entra en la liquidación del otro mes. Es normal; explícalo así si preguntan.

---

## 6. Soporte

### 6.1 Preguntas típicas

**«No me sale una venta.»** Comprueba en este orden:

1. ¿El usuario metió el código? Consulta C. Si no hay atribución, no hay venta
   (y no se recupera; ver 2.4).
2. ¿El cobro llegó? Consulta D. Si no hay fila, mira los eventos de tienda
   (consulta E): una nota como «sin usuario de NIVL» o un entorno `SANDBOX`
   explica por qué no cuenta.
3. ¿Es prueba gratis, Family Sharing o web? No cuentan (3.1).
4. ¿El creador estaba desactivado cuando se cobró? La venta sale sin creador.
5. ¿Se reembolsó? Entonces la comisión está anulada (consulta F).

**«Mi cifra es distinta.»**

- «Ventas» cuenta cuentas con primer cobro; los meses siguientes de un mensual
  suman dinero pero no ventas.
- Las comisiones en retención no salen como disponibles hasta el día 30.
- Un reembolso anula o descuenta.
- Si un comprador **borra su cuenta**, su atribución desaparece y su venta deja
  de contar en «ventas» y «cuentas», pero **la comisión se mantiene** (el dinero
  no cambia).
- Una cuenta mensual genera comisiones pequeñas cada mes, no 25/35/50 € de golpe.

**«Quiero cambiar mi alias o mi código.»** No existe hoy un comando. Propuesta:
`alias CODIGO "nuevo"` y `codigo VIEJO NUEVO`. Cambiar el código es seguro para
el dinero (todo va por el id interno), pero el enlace viejo deja de funcionar y
quien lo tenga guardado verá «código no reconocido». Mientras no exista el
comando, la respuesta es «lo apuntamos para la próxima actualización».

**«Me quiero dar de baja.»**

```bash
node scripts/creadores.mjs activo AAA_TEST no
```

Qué pasa al desactivar: su código deja de aceptarse, sus cuentas atribuidas
dejan de generar comisiones nuevas (para siempre, aunque lo reactives), y **deja
de ver su panel**. Lo ya generado sigue en la base: según las condiciones, se le
pagan las comisiones confirmadas (salvo fraude). `liquidar` funciona igual con
un creador desactivado. Ojo: lo que aún esté en retención madura después;
recuerda liquidarlo en los meses siguientes.

Para volver a activarlo:

```bash
node scripts/creadores.mjs activo AAA_TEST si
```

**Fraude o incumplimiento grave.** Las condiciones permiten anular las
comisiones pendientes ligadas a esa conducta. No existe hoy un comando para
anular comisiones. Propuesta: `anular CODIGO --motivo "…" --confirmar`.
Mientras, desactívalo y no lo liquides; si hay que anular de verdad, hazlo con
ayuda (es una escritura en la base, no una consulta).

**«Quiero borrar mi cuenta de NIVL.»** Lo que pasa hoy:

- Su fila de creador **se queda** (código, alias, rango, comisiones y pagos),
  solo se rompe el enlace con su cuenta. Es lo correcto para la contabilidad:
  los pagos hay que conservarlos por obligaciones fiscales.
- **Pero sigue activo**: su código se seguiría aceptando y generando comisiones.
  Desactívalo en cuanto lo sepas (comando de arriba) y liquida lo pendiente.
- Las ventas (`store_sales`) de cualquier comprador que borra su cuenta se
  conservan sin el usuario; los eventos de tienda se seudonimizan.

### 6.2 Plantillas de respuesta

> **Venta que no aparece:** Hola. He mirado tu código: esa cuenta no lo metió
> en sus primeros 14 días (o pagó antes de meterlo), así que no queda
> atribuida. Las condiciones lo explican en el apartado 2. Recuerda pedir que
> escriban tu código en «¿Quién te trajo?» al crear la cuenta.

> **Comisión en retención:** Hola. La venta está registrada. Cada comisión
> espera 30 días por si hay reembolso; pasará a disponible el día [fecha] y
> entrará en la siguiente liquidación.

> **Reembolso:** Hola. Apple (o Google) devolvió el dinero de esa compra, así
> que la comisión se anula. Si ya te la había pagado, se descuenta de la
> siguiente liquidación, como dice el apartado 4.

> **Importes en la app:** Hola. En la app de iPhone y Android no enseñamos
> importes por las normas de las tiendas. Tus ganancias las verás en el portal
> web de creadores [o: en el desglose que te mando cada mes].

> **Baja:** Hola. Hecho: tu código ya no se acepta. Te pagaremos lo confirmado
> en las próximas liquidaciones, incluido lo que salga de la retención.

### 6.3 Dónde lanzar consultas

En el panel de Supabase → **SQL Editor**. Usa **solo** las consultas de abajo
(todas son `select`: leen y no cambian nada). Sustituye `AAA_TEST` y el email
de ejemplo por los reales en el editor, nunca en un archivo del repo.

No existe hoy un comando de consulta en el script. Propuesta: `detalle CODIGO`
(comisiones y pagos de un creador) y `cuenta email` (atribución y cobros de un
usuario), de solo lectura.

### 6.4 Consultas de solo lectura

**A. Ficha de un creador**

```sql
select code, alias, role, rank, active, user_id is not null as vinculado, monthly_fixed_cents, created_at
from public.creators where code = 'AAA_TEST';
```

**B. Cuentas atribuidas por origen**

```sql
select r.source, count(*) as cuentas
from public.referrals r join public.creators c on c.id = r.creator_id
where c.code = 'AAA_TEST' group by r.source;
```

**C. ¿A quién está atribuida esta cuenta?**

```sql
select u.created_at as alta_nivl, c.code, r.source, r.created_at as atribuida
from auth.users u
left join public.referrals r on r.user_id = u.id
left join public.creators c on c.id = r.creator_id
where lower(u.email) = 'comprador.test@example.com';
```

**D. Cobros de esa cuenta**

```sql
select s.store, s.product_id, s.payment_number, s.net_cents, s.purchased_at, s.refunded_at,
       c.code as creador
from public.store_sales s
join auth.users u on u.id = s.user_id
left join public.creators c on c.id = s.creator_id
where lower(u.email) = 'comprador.test@example.com'
order by s.purchased_at;
```

**E. Últimos eventos de tienda de esa cuenta**

```sql
select type, environment, note, received_at
from public.store_events
where app_user_id = (select id::text from auth.users where lower(email) = 'comprador.test@example.com')
order by received_at desc limit 20;
```

**F. Comisiones de un creador, con su estado**

```sql
select s.product_id, s.purchased_at, k.kind, k.rank, k.pct, k.amount_cents, k.status,
       k.available_at, k.clawback, k.clawback_settled_at, k.voided_reason
from public.commissions k
join public.store_sales s on s.id = k.sale_id
join public.creators c on c.id = k.creator_id
where c.code = 'AAA_TEST'
order by s.purchased_at desc;
```

**G. Pagos apuntados a un creador**

```sql
select p.kind, p.amount_cents, p.period, p.note, p.paid_at
from public.creator_payouts p join public.creators c on c.id = p.creator_id
where c.code = 'AAA_TEST'
order by p.paid_at desc;
```

**H. Parámetros, rangos y umbrales**

```sql
select * from public.creator_settings;
```

```sql
select r.rank, r.pct, u.min_sales_90d, u.min_months_active
from public.creator_ranks r left join public.creator_rank_rules u on u.rank = r.rank
order by r.pct;
```

**I. Cobros de cuentas atribuidas que se guardaron sin creador** (creador
desactivado en ese momento, o atribución posterior al cobro)

```sql
select c.code, count(*) as cobros_sin_creador
from public.store_sales s
join public.referrals r on r.user_id = s.user_id
join public.creators c on c.id = r.creator_id
where s.creator_id is null
group by c.code;
```

Importes en céntimos: 2500 son 25,00 €.

---

## 7. Cumplimiento

### 7.1 Lo que nunca se paga

- **Nunca por instalaciones, descargas, valoraciones ni reseñas.** Apple
  (3.2.2 y 5.6.3) y Google Play retiran la app por eso. Se paga solo por
  suscripciones reales atribuidas por código, y los retos se miden solo en
  ventas.
- El creador no puede ofrecer dinero ni regalos al usuario a cambio de usar su
  código sin acuerdo previo por escrito, ni sortear nada a cambio de
  valoraciones o descargas.
- Prohibido (y motivo de expulsión, apartado 6 de las condiciones): spam,
  cuentas falsas, comprar vistas o seguidores, bots, pujar por la marca «NIVL»
  en anuncios, dirigirse a menores, hacerse pasar por NIVL o por Apple.

### 7.2 Publicidad identificada

Todo clip, post o historia del programa lleva **«#publi»** (o «Publicidad»)
visible al principio y, si la red la tiene, la herramienta de «Colaboración
pagada» o «Contenido de marca». Si el contenido está hecho o retocado con IA de
forma realista, se marca. Nada de prometer resultados (kilos, dinero,
«garantizado»), ni «gratis para siempre», ni precios que no sean los oficiales.

### 7.3 Kit de clips

El kit (ganchos, guiones de 15/30/60 s, reglas de marca en blanco y negro, aviso
`#publi` y lo prohibido) está en `src/lib/creatorprogram.ts` (`KIT_CLIPS`), y
`revisarTexto` detecta lo evidente en un guion. Hoy **no se enseña en el panel
de la app**: mándaselo tú al dar el alta. La revisión final de cada guion es
tuya; el detector es una red, no un abogado.

### 7.4 Datos personales (RGPD)

Qué guarda la base de NIVL de un creador: código, alias, rol, rango, fijo,
activo, una nota interna (`notes`, ningún comando la escribe), el enlace con su
cuenta, sus comisiones (por venta, sin datos del comprador) y sus pagos
(importe, tipo, mes, nota). **No** guarda IBAN, NIF, dirección ni facturas: eso
va fuera, en tu archivo privado o tu gestoría.

Qué ve el creador de los compradores: nada personal. Solo cifras agregadas.

Lo que hay que tener presente:

- **Exportación.** La exportación de datos de la app (0060) incluye, para un
  usuario normal, quién le trajo (`referrals`, con el código) y sus cobros
  (`store_sales`). **No incluye los datos del creador como creador** (su fila,
  sus comisiones, sus pagos). Si un creador pide sus datos, respóndele a mano
  con las consultas A, F y G (o con el portal, que enseña casi todo). No existe
  hoy un comando; propuesta: `exportar CODIGO` que escriba un JSON en
  `privado/`.
- **Borrado.** Si borra su cuenta, su fila de creador se conserva sin enlace
  (necesaria para la contabilidad y las obligaciones fiscales). Desactívalo. No
  existe hoy un comando para seudonimizar el alias tras la baja; propuesta:
  `seudonimizar CODIGO`, que ponga un alias neutro cuando ya no haya nada
  pendiente.
- **Exportes del script.** Los CSV de `privado/` llevan alias: son datos
  personales. Guárdalos solo el tiempo necesario y no los compartas.
- La política de privacidad y el apartado 7 de las condiciones cubren estos
  datos. Si cambias lo que guardas (por ejemplo, metes datos fiscales en la
  base), actualiza antes la política.

---

## 8. Checklist mensual y tabla de comandos

### Checklist mensual

- [ ] `informe` del mes anterior revisado (y CSV en `privado/` si lo quieres).
- [ ] `revisar-rangos` mirado; cambios aplicados uno a uno con `rango` o en
      bloque con `--aplicar --confirmar` si todas valen.
- [ ] `liquidar` a cada creador con disponible; transferencia por la cifra
      «Apuntado»; desglose enviado.
- [ ] Facturas recibidas y archivadas fuera del repo.
- [ ] Descuentos (clawback) pendientes revisados en el informe.
- [ ] Bajas del mes desactivadas (`activo … no`), incluidos creadores que
      borraron su cuenta.
- [ ] Retos del mes cerrados o creados; `premio` vacío salvo bases publicadas.
- [ ] `sbp` coherente con tu situación en Apple.
- [ ] CSV viejos borrados de `privado/`.
- [ ] Nada de lo anterior pegado en un commit, issue o captura.

### Tabla de comandos (todos verificados en `scripts/creadores.mjs`)

| Comando | Qué hace | Cambia datos | Pide confirmar |
|---|---|---|---|
| `lista` | creadores con rango, activo, vinculado, fijo y cuentas | no | no |
| `alta CODIGO "alias" [novato\|pro\|elite]` | da de alta (novato por defecto) | sí | no |
| `vincular CODIGO email` | une el creador a su cuenta de NIVL | sí | no |
| `rol CODIGO creador\|comercial\|clipper` | cambia el rol (qué retos ve) | sí | no |
| `rango CODIGO novato\|pro\|elite` | cambia el rango | sí | no |
| `activo CODIGO si\|no` | activa o desactiva | sí | no |
| `fijo CODIGO euros` | fija el fijo mensual que se enseña (no lo paga) | sí | no |
| `premio "texto"` / `premio --quitar` | premio del mes en el panel | sí | no |
| `sbp si\|no` | Small Business Program de Apple | sí | no |
| `informe [AAAA-MM] [--csv]` | resumen del mes; CSV en `privado/` | no | no |
| `liquidar CODIGO ["nota"]` | desglose y apunte del pago de comisiones | sí | escribir el código |
| `pago CODIGO euros fijo_mensual\|premio\|contenido_externo\|ajuste ["nota"]` | apunta otro pago (ajuste puede ser negativo) | sí | escribir el código |
| `reto lista` | retos con estado | no | no |
| `reto alta "título" AAAA-MM-DD AAAA-MM-DD objetivo ["premio"] [--rol R] [--desc "texto"]` | crea un reto | sí | no |
| `reto cerrar ID` | borra (si no empezó) o termina ahora | sí | no |
| `umbral pro\|elite ventas90 [meses]` / `umbral RANGO --quitar` | umbrales para proponer rango | sí | no |
| `revisar-rangos [--aplicar --confirmar]` | propone; aplica todo solo con las dos marcas | solo con las dos marcas | las dos marcas |

**No existen hoy** (propuestas): `desvincular`, `atribuir CODIGO email`,
`alias CODIGO "nuevo"`, `codigo VIEJO NUEVO`, `anular CODIGO`, `umbral lista`,
`detalle CODIGO`, `cuenta email`, `exportar CODIGO`, `seudonimizar CODIGO`, y un
comando para retención, renovación y plazo del código.

### Notas sobre el script (sin corregir; para quien lo mantenga)

1. `liquidar` calcula la vista previa en una consulta y paga con
   `liquidate_creator` en otra: si algo madura o se reembolsa entre medias, el
   importe apuntado difiere del previsto. El script imprime el real; el manual
   pide transferir ese. Mejor: enseñar el `r.amount` con más énfasis o volver a
   pedir confirmación si difiere.
2. `revisar-rangos --aplicar` es todo o nada: no permite aplicar solo algunas
   propuestas, y propone bajar a quien se subió a mano.
3. `activo no` no avisa de que el creador pierde el panel ni de que los cobros
   de sus cuentas mientras esté desactivado no se le atribuirán nunca.
4. `premio` y `fijo` no avisan de que las condiciones publicadas dicen que no
   hay premio ni fijo.
5. `vincular` con una cuenta ya vinculada a otro creador y `reto alta` con fin
   anterior al inicio acaban en un error técnico de la base en vez de un
   mensaje claro (no se escribe nada).
6. `pago` fija siempre el mes en curso como periodo.
7. `lista` e `informe` no enseñan el rol.

Huecos fuera del script: las ventas web por Stripe no generan comisión; un
`REFUND_REVERSED` no restaura la comisión; la exportación RGPD no incluye los
datos de creador; borrar la cuenta de un creador lo deja activo; el kit de clips
no se enseña en el panel.
