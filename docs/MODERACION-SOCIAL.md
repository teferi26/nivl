# Moderación social de NIVL

Estado: controles preparados en la migración 0032. Este documento describe el procedimiento; no acredita que una revisión humana ya se haya realizado. Antes de enviar a Apple debe haber una persona responsable operando esta cola y debe comprobarse en el binario conectado al servidor actualizado.

## Qué se comparte

Amigos y ludus no tienen chat. Comparten marcadores, alias, título y retrato. El servidor solo publica alias, título y retrato después de revisión humana. Los perfiles existentes también quedan pendientes al aplicar 0032. Hasta aprobarlos, otras personas ven un alias neutro y una inicial. El propietario conserva sus datos. Cada cambio de nombre, título o ruta del avatar invalida la aprobación. Las rutas de avatar son inmutables: el servidor prohíbe sobrescribir bytes y reutilizar una ruta borrada; cada foto nueva necesita ruta nueva y aprobación. No se usa una lista de palabras como única protección de fotografías.

En Amigos, el botón de tres puntos de cada usuario (también solicitudes y ludus) permite denunciar con cuatro motivos: nombre/título ofensivo, foto inapropiada, acoso/amenazas o suplantación. Se confirma el registro sin prometer un tiempo de resolución. El enlace Contactar con soporte abre https://nivl-web.vercel.app/soporte.

Bloquear elimina la amistad/solicitud y oculta a ambas partes en rankings, ludus e insignias. Impide nuevas solicitudes y nuevas lecturas del retrato. Desbloquear solo retira el bloqueo propio; no restaura la amistad ni anula el bloqueo de la otra persona. En un ludus común vuelven a ser visibles si ninguna parte mantiene el bloqueo.

## Operación privada

Usar exclusivamente el SQL Editor de Supabase con una cuenta administrativa. No exponer service_role ni estos datos en la app, capturas de la tienda o repositorio. Revisar la cola con frecuencia suficiente para responder a denuncias de forma oportuna; designar responsable y suplente antes de publicar. No aprobar en masa sin inspección.

Cola de perfiles:

```sql
select r.user_id,r.status,r.updated_at,p.name,p.equipped_title,p.avatar_url,o.updated_at as avatar_updated_at
from public.social_profile_reviews r
join public.profiles p on p.id=r.user_id
left join storage.objects o on o.bucket_id='avatars' and o.name=p.avatar_url
where r.status='pending' order by r.updated_at;
```

Ver la imagen real desde Storage → avatars, sin descargar datos de otros módulos. Evaluar nombre, título y foto: rechazar desnudos/sexual, odio, violencia gráfica, amenazas, datos personales ajenos, suplantación y contenido sin derechos. Si falta la foto o es ambigua, no aprobar. Copiar exactamente los valores revisados a la función; NULL es SQL NULL, no la cadena "null":

```sql
select public.social_review_profile(
  'UUID_REVISADO', 'NOMBRE_REVISADO', 'RUTA_REVISADA_O_NULL', 'TITULO_REVISADO_O_NULL',
  'FECHA_EXACTA_STORAGE_O_NULL', 'approved', 'Revisión manual de alias, título e imagen'
);
```

La función rechaza una aprobación si cambió cualquier dato o la versión del objeto desde la revisión. Usar `rejected` para mantener representación neutra; `suspended` para excluir la cuenta de interacciones sociales. Una modificación del perfil no elimina una suspensión. Para levantarla, revisar de nuevo y aprobar la versión actual. Registrar el motivo concreto sin incluir información sensible innecesaria.

Cola de denuncias:

```sql
select id,subject,reason,displayed_name,displayed_title,displayed_avatar,created_at
from public.social_reports where status='open' order by created_at;
```

Investigar el perfil actual y el contenido señalado; retirar su aprobación o suspender mediante la función anterior cuando corresponda. Tras actuar, cerrar únicamente la denuncia investigada:

```sql
update public.social_reports
set status='resolved',resolved_at=now(),resolution='Acción concreta realizada'
where id='UUID_DENUNCIA' and status='open';
```

Usar `dismissed` si la investigación no encuentra infracción, dejando explicación. Mantener contacto de soporte atendido y resolver solicitudes recibidas allí. Las denuncias se deduplican mientras estén abiertas y admiten hasta 10 nuevas por hora por denunciante; bloqueo sigue disponible al alcanzar ese límite.

## Comprobación antes del vídeo para Apple

1. Dos cuentas de prueba: enviar solicitud; abrir tres puntos y denunciar; verificar fila en cola.
2. Aceptar y comprobar ranking. Aprobar un alias/avatar de prueba e inspeccionar el resultado desde la otra cuenta.
3. Cambiar nombre y subir una nueva foto: deben desaparecer públicamente hasta nueva revisión; el propietario sigue viéndolos.
4. Bloquear desde ranking y repetir desde una solicitud y un compañero de ludus: no quedan visibles ni pueden reinvitarse.
5. Desbloquear y comprobar que hace falta una nueva amistad; comprobar bloqueo inverso persistente.
6. Abrir soporte, también con texto grande. Filmar los pasos reales en dispositivo físico actualizado.

Límite técnico: las URLs de Storage ya firmadas y las imágenes previamente descargadas pueden permanecer accesibles hasta caducar o en caché; el bloqueo impide emitir nuevas firmas y las rutas inmutables impiden sustituir los bytes de una foto previamente aprobada. No prometer revocación inmediata de copias anteriores. Las denuncias y revisiones se borran en cascada al eliminar la cuenta correspondiente.

Prueba SQL local: `node scripts/test-social-safety.mjs`. Requiere `@electric-sql/pglite` en el entorno de pruebas, o `PGLITE_PACKAGE_ROOT` apuntando al directorio que contiene su package.json y node_modules. No conecta a Supabase ni modifica datos reales.
