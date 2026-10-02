# Plantillas de email de Supabase Auth (NIVL)

Para el coordinador: Auth → Email Templates. Usan solo las variables oficiales de Supabase (`{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`), sin datos de uso. Los enlaces llevan a `nivl://auth/confirmar` y `nivl://auth/restablecer` (ya en la allow list) a través de `{{ .ConfirmationURL }}`: no se escribe la URL a mano.

Reglas de seguridad aplicadas: nada de contraseñas ni códigos en claro, aviso de «si no fuiste tú», caducidad mencionada sin inventar cifras (Supabase usa la del panel; si cambia, cambiar el texto) y ningún enlace a otros dominios salvo la web de NIVL.

Remitente sugerido: `NIVL <no-responder@nivl.app>` cuando el dominio esté verificado en Resend.

---

## 1. Confirmar registro (Confirm signup)

**Asunto:** Confirma tu correo para entrar en NIVL

```html
<div style="background:#0b0b0b;color:#e9e4d8;font-family:Helvetica,Arial,sans-serif;padding:32px">
  <p style="letter-spacing:.2em;font-size:12px;color:#8a8580;margin:0 0 24px">NIVL</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 16px">Confirma tu correo</h1>
  <p style="line-height:1.5">Alguien ha creado una cuenta en NIVL con {{ .Email }}. Si has sido tú, confirma el correo para entrar en la arena.</p>
  <p style="margin:28px 0"><a href="{{ .ConfirmationURL }}" style="background:#e9e4d8;color:#0b0b0b;padding:12px 20px;text-decoration:none;font-weight:600">Confirmar correo</a></p>
  <p style="line-height:1.5;color:#8a8580;font-size:13px">El enlace caduca pasado un tiempo y solo sirve una vez. Si no has sido tú, ignora este mensaje: sin confirmar, la cuenta no se puede usar.</p>
</div>
```

## 2. Restablecer contraseña (Reset password)

**Asunto:** Restablece tu contraseña de NIVL

```html
<div style="background:#0b0b0b;color:#e9e4d8;font-family:Helvetica,Arial,sans-serif;padding:32px">
  <p style="letter-spacing:.2em;font-size:12px;color:#8a8580;margin:0 0 24px">NIVL</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 16px">Nueva contraseña</h1>
  <p style="line-height:1.5">Has pedido restablecer la contraseña de la cuenta {{ .Email }}. Abre este enlace desde el móvil donde tienes NIVL y elige una nueva.</p>
  <p style="margin:28px 0"><a href="{{ .ConfirmationURL }}" style="background:#e9e4d8;color:#0b0b0b;padding:12px 20px;text-decoration:none;font-weight:600">Elegir nueva contraseña</a></p>
  <p style="line-height:1.5;color:#8a8580;font-size:13px">El enlace caduca pasado un tiempo y solo sirve una vez. Si no lo has pedido tú, ignora este mensaje: tu contraseña no cambia.</p>
</div>
```

## 3. Cambio de correo (Change email address)

Con `secure_email_change=true` llega un mensaje a la dirección antigua y otro a la nueva; esta plantilla sirve para las dos.

**Asunto:** Confirma el cambio de correo en NIVL

```html
<div style="background:#0b0b0b;color:#e9e4d8;font-family:Helvetica,Arial,sans-serif;padding:32px">
  <p style="letter-spacing:.2em;font-size:12px;color:#8a8580;margin:0 0 24px">NIVL</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 16px">Cambio de correo</h1>
  <p style="line-height:1.5">Se ha pedido cambiar el correo de tu cuenta de NIVL de {{ .Email }} a {{ .NewEmail }}. El cambio solo se aplica si se confirma.</p>
  <p style="margin:28px 0"><a href="{{ .ConfirmationURL }}" style="background:#e9e4d8;color:#0b0b0b;padding:12px 20px;text-decoration:none;font-weight:600">Confirmar el cambio</a></p>
  <p style="line-height:1.5;color:#8a8580;font-size:13px">Si no lo has pedido tú, no pulses el enlace y cambia tu contraseña desde la app. Para cualquier duda: teferilaforga@gmail.com.</p>
</div>
```

Nota: el correo de soporte es el que publica hoy `privacidad.html`. Cuando exista `soporte@nivl.app`, hay que cambiarlo aquí y en la web a la vez.

PENDIENTE (NO PROBADO): envío real con Resend y apertura del enlace en iPhone y Android. El enlace `nivl://` solo abre la app si el esquema está registrado en el binario instalado (`app.json` → `scheme`, archivo del coordinador).
