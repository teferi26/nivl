# El enlace de la TV en el iPhone

Ya vive en la app, no hay nada que copiar:

- `src/app/tv/[codigo].tsx`: la confirmación que abre el QR (`nivl://tv/XXXX-XXXX`).
- `src/app/tv/index.tsx`: Perfil, Televisores. Enlazar escribiendo el código y desenlazar.
- `src/lib/tvmath.ts` (puro, con tests) y `src/lib/tvEnlace.ts` (las RPC de la 0125).
- Textos en `perfil:televisores.*`, en los seis idiomas.

## Lo que hay que saber

- **Antes de publicar** van las migraciones 0125, 0126, 0127, 0128 y 0144.
- **Ruta con sesión**: sin ella la puerta manda a `/login` y hay que volver a escanear.
- **Aviso al aprobar**: es una notificación local a los dos minutos, en el iPhone que aprobó, que lleva a Televisores. Sin permiso de avisos no llega; queda la confirmación en pantalla y la lista en Perfil. No hay correo ni push a otros aparatos.
- **Cambiar la contraseña desenlaza todas las TV** (trigger de la 0125). El cierre global de sesiones de `authFlow.ts` no las toca.
- **El QR es `nivl://`**: sin la app instalada no abre nada, pero el código se puede escribir en Perfil, Televisores. Para que caiga en la App Store haría falta `https://nivl.app/tv/XXXX-XXXX`, su ruta y el AASA en `nivl-web`.
