# Lista de espera de nivl.app: servidor, contrato y privacidad

Chat 3 · 03/10/2026. Encargo del coordinador, aprobado por el usuario.

- Migración `supabase/migrations/0054_lista_espera.sql`.
- Función `supabase/functions/espera/`.
- Pruebas:
  - `supabase/functions/_shared/sec_espera_test.ts` (Deno, 9/9);
  - `docs/security-audit/lista-espera-0054.sql` (SQL contra producción con BEGIN…ROLLBACK; la migración se aplica dos veces).

## 1. Despliegue (coordinador)

1. Huella en `scripts/apply-migrations.mjs`:
   `'0054': \`coalesce(obj_description(to_regprocedure('public.waitlist_join(text,text,text,text)'),'pg_proc') like '%nivl:waitlist-0054%', false)\``
2. `node scripts/apply-migrations.mjs`.
3. `npx supabase functions deploy espera --no-verify-jwt --project-ref dueyufxxkiixdxighpaz`.
   No necesita secretos nuevos: usa `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, que ya están. La sal del HMAC se crea en la propia migración y no sale de la base de datos.
4. Primero el servidor y después la web.

## 2. Contrato del endpoint (para el Chat 4)

`POST https://dueyufxxkiixdxighpaz.supabase.co/functions/v1/espera`

- **Cabeceras:** solo `Content-Type: application/json`. **Sin `apikey` ni `Authorization`**: la función va sin JWT y no hace falta exponer nada más.
- **CORS:** solo `https://nivl.app`. Cualquier otro origen, y la ausencia de `Origin`, reciben 403 sin cabeceras CORS. Eso incluye `www.nivl.app`, `nivl-web.vercel.app` y los previews de Vercel. Si el formulario tiene que funcionar en otro dominio, me lo pedís y lo añado a la lista; no se abre con comodín.
- **Cuerpo** (JSON, máximo 2 KB):

  ```json
  { "email": "ana@ejemplo.com", "consentimiento": true, "origen": "c:CODIGO", "web": "" }
  ```

  | Campo | Obligatorio | Notas |
  |---|---|---|
  | `email` | sí | El servidor lo normaliza con `trim` y minúsculas. Hasta 254 caracteres. |
  | `consentimiento` | sí | Tiene que ser el booleano `true`, de una casilla **sin marcar por defecto**. La versión del texto la fija el servidor (`espera-v1`); el cliente no la manda. |
  | `origen` | no | `bio`, `utm_source:tiktok`, `c:CODIGO` (si viene de `/c/CODIGO`)… Patrón `^[A-Za-z0-9_.:-]{1,64}$`. Lo que no encaja se guarda como vacío, sin error. |
  | `web` | **honeypot** | Campo de texto oculto con CSS y `tabindex="-1"`, `autocomplete="off"` y `aria-hidden="true"`. Si llega con texto, el servidor responde 200 y no guarda nada. |

- **Respuestas** (siempre JSON y `cache-control: no-store`):

  | Código | Cuerpo | Qué enseñar |
  |---|---|---|
  | 200 | `{"ok":true}` | «Listo. Te avisaremos cuando NIVL esté disponible.» **El mismo mensaje si el correo ya estaba**: el servidor no lo distingue y la web tampoco debe hacerlo. |
  | 400 | `{"error":"correo"}` | «Revisa el correo.» |
  | 400 | `{"error":"consentimiento"}` | «Marca la casilla para que podamos avisarte.» |
  | 400, 413, 415 | `{"error":"formato"}` | Fallo genérico (no debería ocurrir desde el formulario). |
  | 429 | `{"error":"frenado"}` | «Demasiados intentos. Prueba dentro de unos minutos.» |
  | 403 / 405 / 500 | `{"error":…}` | «No se ha podido apuntar. Prueba más tarde.» |

- **Freno:**
  - 5 intentos por IP cada 10 min y 30 al día; 3 por correo cada hora.
  - Cuentan los intentos con correo válido, no solo las altas.
  - La IP se guarda solo como HMAC y se borra a las 48 h.

## 3. Texto de la casilla (literal)

> Quiero que NIVL me avise por correo cuando la app esté disponible. He leído la [política de privacidad](/privacidad#lista-espera).

Sin otras finalidades en la misma casilla: ni boletín ni promociones.

## 4. Privacidad: texto para `privacidad.html`

Va como **subapartado de «11. Esta web»**, con el ancla `id="lista-espera"`. Además, una línea en «7. Cuánto tiempo los guardamos». Al publicar, se sube la versión y la fecha de la política.

> **Lista de espera.** Si te apuntas en nivl.app para que te avisemos del lanzamiento, guardamos tu correo electrónico, la fecha y la versión del texto que aceptaste y, si lo hay, de dónde llegaste (por ejemplo, una red social o el código del creador que te trajo).
>
> - **Para qué:** solo para avisarte por correo cuando NIVL esté disponible. No lo usamos para nada más ni lo unimos a una cuenta de NIVL.
> - **Base legal:** tu consentimiento, que puedes retirar cuando quieras.
> - **Baja:** responde a cualquiera de nuestros correos o escribe a soporte, y borramos tu correo de la lista.
> - **Conservación:** hasta el lanzamiento y tres meses más; después se borra la lista entera.
> - **Freno de abusos:** para frenar envíos automáticos tratamos durante 48 horas una huella irreversible de tu dirección IP. Nunca la IP en claro, y la huella no se guarda con tu correo. La base legal es nuestro interés legítimo en proteger el servicio.
> - **Quién la trata:** la lista se guarda en Supabase. Cuando enviemos el aviso, lo hará Resend. Los dos figuran en «4. Con quién compartimos datos».

En «7. Cuánto tiempo los guardamos», añadir:

> Lista de espera: hasta el lanzamiento y tres meses más, o hasta que te des de baja.

## 5. Notas

- **Exportación 0060:** no hay que tocarla. La lista no lleva `user_id` ni se une a ninguna cuenta, así que no hay datos de cuenta que exportar. El derecho de acceso de alguien de la lista se atiende a mano: el responsable consulta la tabla por correo.
- **CSP de nivl.app:** hoy no tiene CSP y este hotfix no necesita añadirla. Si algún día se añade, `connect-src` tiene que incluir `https://dueyufxxkiixdxighpaz.supabase.co`.
- **Envío con Resend:** el día que se importe la lista, cada correo lleva un enlace o una instrucción de baja. Después de enviar el aviso, el plazo de 3 meses empieza a contar.
- **Pendiente para después del despliegue:** una prueba real con `curl` y un correo `@example.invalid`, que se borra al terminar, contra la función desplegada. Antes del despliegue, el servidor solo está probado con Deno (handler) y con SQL (RPC).
