# NIVL 1.1.0 en Google Play: textos para Play Console

Fecha: 9 de noviembre de 2026. Borrador interno. Nada de esto se ha introducido en Play Console y la consola no se ha abierto: el texto exacto de cada formulario y los nombres en español de sus opciones están **sin verificar**. El AAB 1.1 no existe todavía: los permisos salen del manifiesto de `expo prebuild` (`docs/tienda-1.1/MATRIZ-PLATAFORMAS.md:170-172`, `SEGURIDAD-DATOS-GOOGLE.md:80-93`) y hay que confirmarlos con `bundletool dump manifest` cuando exista.

Las respuestas de Seguridad de los datos están en `docs/tienda-1.1/SEGURIDAD-DATOS-GOOGLE.md`. Este archivo no las repite.

## Antes de pegar nada

| Condición | Hallazgo | Por qué importa aquí |
|---|---|---|
| `EXPO_PUBLIC_RC_ANDROID_KEY` en EAS, entorno production | PLAT-03 | Sin ella `/pro` es una lista de solo lectura y no se puede comprar |
| Productos creados en Play y offering `modos` | PAG-04 | `PRODUCTOS.md`, secciones 8 y 9 |
| Política de privacidad y Términos actualizados | P1, PAG-01 | Hoy están desfasados: no declararlos como válidos |
| Decisión sobre moderación | CON-01 | Hoy no hay filtro previo: nada de lo escrito aquí afirma revisión previa |
| Quitar `SYSTEM_ALERT_WINDOW` y los servicios de `expo-audio` | P11, P12 | Ver «Permisos» |
| Huella real en `assetlinks.json` | CON-12 | Sin ella, los enlaces `/c/` abren el navegador |
| Android probado en un teléfono | MATRIZ | La 1.1 no se ha abierto nunca en Android (`INFORME-INTEGRACION.md:59`) |

## Qué es la versión Android

Se describe esto y nada más. Comprobado en el código:

- **No hay** Salud de Apple, Health Connect, GPS, permiso de ubicación, reloj ni mapa nativo. `modules/nivl-salud` y `modules/nivl-watch` solo declaran `apple`; `saludNativa.ts:85` y `useCardio.ts:256` lo cierran con `Platform.OS === 'ios'`.
- **Sí hay** hábitos, planificación, registros a mano de entreno, dieta, diario y economía, calendario del teléfono, dictado, fotos, ranking entre amigos, coach de IA y suscripción por modo.
- En Perfil aparece la fila «Conexión con Salud» y en Android abre una pantalla que dice que no está disponible (`medicion.json`, `conexion.noDisponible.android`). No es una promesa, pero conviene saberlo si el revisor pregunta.
- La ficha no puede anunciar medición, GPS, reloj, app web, Apple TV, gafas Meta ni banca conectada.

## 1. Acceso a la app

Respuesta: **Todas o parte de las funciones están restringidas**. Las credenciales van en los campos privados del formulario, no en este archivo. [DUEÑO: preparar una cuenta gratuita y otra con los cuatro modos, con vigencia suficiente y un amigo de demostración en el ranking; sin permisos aceptados de antemano.]

Campo «Otras instrucciones», español:

```text
NIVL requiere una cuenta. Usa las credenciales de este formulario: en la portada toca "Ya tengo cuenta" y luego "Entrar". Confirma la edad si se pide (la app es para mayores de 16 años). No hace falta hardware externo, cuenta bancaria ni clave de IA propia.

Perfil se abre con el icono de arriba a la derecha en Hoy.
Salud: Perfil > "Salud y bienestar" > "Revisar permiso de salud", marca la casilla y "Aceptar y activar salud". Se puede rechazar y el resto de la app sigue funcionando.
Coach de IA: requiere suscripción y un permiso aparte, "Acepto y activo el coach". Cada respuesta tiene "Denunciar respuesta".
Planes: Perfil > Cuenta > "NIVL Pro" (nombre antiguo de la pantalla de planes). "Restaurar" está en esa pantalla.
Denunciar y bloquear: Arena > "Ajustes de la arena" > fila de un usuario o tres puntos > "Enviar denuncia" o "Bloquear usuario".
Borrar la cuenta: Perfil > Cuenta > "Eliminar cuenta", escribe ELIMINAR y confirma. Usa una cuenta desechable. No cancela la suscripción de Google Play.

La versión de Android no usa GPS, ubicación del dispositivo, Health Connect ni reloj.
```

Versión en inglés, si la consola o el revisor la piden:

```text
NIVL requires an account. Use the credentials in this form: on the cover tap "Ya tengo cuenta", then "Entrar". Confirm your age if asked (the app is for people 16+). No external hardware, bank account or personal AI key is needed. The interface may appear in Spanish; labels are quoted as shown.

Perfil opens from the icon at the top right of Hoy.
Health: Perfil > "Salud y bienestar" > "Revisar permiso de salud", tick the box and tap "Aceptar y activar salud". It can be refused and the rest of the app keeps working.
AI coach: needs a subscription and a separate consent, "Acepto y activo el coach". Each reply has "Denunciar respuesta" (report).
Plans: Perfil > Cuenta > "NIVL Pro" (older name of the plans screen). "Restaurar" is on that screen.
Report and block: Arena > "Ajustes de la arena" > a user's row or three dots > "Enviar denuncia" or "Bloquear usuario".
Delete account: Perfil > Cuenta > "Eliminar cuenta", type ELIMINAR and confirm. Use a disposable account. It does not cancel a Google Play subscription.

The Android version does not use GPS, device location, Health Connect or a watch.
```

## 2. Declaración de salud

Google exige este formulario a toda app publicada, también en prueba cerrada ([ayuda](https://support.google.com/googleplay/android-developer/answer/14738291?hl=es)). Política > Contenido de la aplicación > Apps de salud.

| Categoría | Marcar | Motivo |
|---|---|---|
| Salud y forma física: Actividad y forma física | **Sí** | Gimnasio, cardio a mano, planes de entreno |
| Salud y forma física: Nutrición y control del peso | **Sí** | Dieta, comidas, peso |
| Salud y forma física: Gestión del sueño | Sí, si se considera función | El diario registra horas y calidad de sueño |
| Salud y forma física: Estrés, relajación y agudeza mental | Sí, si se considera función | Diario de ánimo y energía |
| Médica, cualquiera | **No** | NIVL no diagnostica ni trata (`_shared/ai-safety.ts`, `consentmath.ts:64-65`) |
| Dispositivo médico | **No** | |
| Investigación con personas | **No** | |

Texto de apoyo, si hay campo libre:

```text
NIVL es una app de hábitos con registro manual de actividad, nutrición, peso, sueño y ánimo, y un coach de IA opcional que solo funciona con permiso explícito. No es un servicio médico, nutricional ni psicológico, no diagnostica ni trata enfermedades y no es un dispositivo médico. La versión de Android no se conecta a Health Connect ni a sensores.
```

## 3. Ubicación en segundo plano y vídeo

**No aplica.** No hay que rellenar la declaración ni grabar vídeo, por esto:

- El manifiesto generado no lleva `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` ni `ACCESS_BACKGROUND_LOCATION` (`MATRIZ-PLATAFORMAS.md:162`). Ni `app.json:android.permissions`, ni `modules/`, ni `plugins/` los piden, y `expo-location` no está en `package.json`.
- La medición con GPS solo existe en iOS (`GpsSesion.swift`, `useCardio.ts:256`). En Android la pantalla lo dice (`medicion.json`, `gps.noDisponible.android`).
- La ciudad para la previsión del tiempo se elige a mano y no viene del GPS (`src/lib/resistencia.ts:232`).

Confirmarlo en el AAB final. Si un AAB futuro añade ubicación, este apartado deja de valer.

## 4. Permisos

Ninguno de los permisos previstos es de la lista que abre el formulario de permisos restringidos (SMS, registro de llamadas, ubicación en segundo plano, todos los archivos, fotos y vídeos, alarmas exactas): **sin verificar** en la consola, que es quien lo pide según el AAB.

| Permiso | Para qué, listo para pegar si lo preguntan |
|---|---|
| `READ_CALENDAR` | Leer título y horas de los próximos eventos para ordenarlos en la agenda de NIVL, solo si la persona conecta su calendario. Con el coach activo, esos títulos se envían a la IA. |
| `WRITE_CALENDAR` | NIVL no crea ni modifica eventos: la librería de calendario exige pedir lectura y escritura juntas (`CalendarModule.kt:235`). |
| `RECORD_AUDIO` | Dictar al coach mientras se mantiene pulsado el botón de voz. NIVL recibe texto, no audio. |
| `CAMERA` | Evidencias, foto de perfil y fotos de progreso. |
| `POST_NOTIFICATIONS` | Despertador, bloques del día y cierre. |

**Arreglar antes de compilar, no declarar:**

- `SYSTEM_ALERT_WINDOW` (P12): la app no lo usa. Añadir a `blockedPermissions`.
- `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` y los servicios `mediaPlayback` y `microphone` de `expo-audio` (P11): la app no los usa. Si se quedan, la consola pedirá justificar un uso que no existe, y no hay texto honesto para eso. Retirarlos.
- `READ_EXTERNAL_STORAGE` y `WRITE_EXTERNAL_STORAGE`: heredados. Bloquear tras probar el selector de fotos.

## 5. Funciones financieras

Google exige este formulario a toda app publicada ([ayuda](https://support.google.com/googleplay/android-developer/answer/13849271?hl=es)). La lista oficial trata de banca y préstamos, pagos y transferencias, compra aplazada y recompensas, inversión y cripto, y servicios como crédito, asesoramiento financiero y seguros, con una opción «Otro». El registro de gastos no aparece.

NIVL no ofrece ningún producto financiero: registra cuentas, movimientos y presupuestos que escribe o importa la persona (CSV en el teléfono; texto de un PDF con IBAN enmascarado y solo con permiso de IA). No conecta con bancos, no mueve dinero y el coach no da consejo de inversión ni fiscal concreto.

[DUEÑO decide]:

- **Propuesta:** «Mi app no ofrece funciones financieras», porque ninguna categoría describe un registro personal.
- **Alternativa prudente:** «Otro», si la consola admite describirlo, con este texto:

```text
Registro personal de gastos y presupuesto. La persona introduce sus movimientos o importa un extracto. La app no conecta con bancos, no ejecuta pagos ni transferencias, no concede crédito y no ofrece asesoramiento financiero, de inversión ni fiscal.
```

No marcar «Asesoramiento financiero». Qué hace la consola tras elegir «Otro»: sin verificar.

## 6. IA generativa

Aplica: el coach genera texto dentro de la app, y Google pide poder denunciar contenido ofensivo sin salir de ella ([política](https://support.google.com/googleplay/android-developer/answer/13985936?hl=es)). Está en el código: «Denunciar respuesta», `src/components/coach/MensajeCoach.tsx:126`.

```text
NIVL incluye un coach conversacional de IA con un único proveedor, Anthropic (Claude). Solo funciona tras un permiso explícito que indica qué datos se envían, a quién y en qué países; la persona puede retirarlo en Perfil > "Datos y la IA". Cada respuesta del coach tiene la opción "Denunciar respuesta" dentro de la app. El coach no sustituye a un profesional: NIVL no es un servicio médico, nutricional ni psicológico.
```

English:

```text
NIVL includes a conversational AI coach with one provider, Anthropic (Claude). It only works after explicit consent that states what data is sent, to whom and in which countries; users can withdraw it in Perfil > "Datos y la IA". Every coach reply has an in-app "Denunciar respuesta" (report) option. The coach does not replace a professional: NIVL is not a medical, nutritional or psychological service.
```

## 7. Público objetivo

Marcar **16 a 17 años** y **18 años o más**. No marcar menores de 16. La app no está dirigida a menores de 13.

Base: `EDAD_MINIMA = 16`, puerta declarativa (`src/components/EdadMinima.tsx`), y 18 para fotos corporales (`src/lib/age.ts`). La edad es una declaración de la persona: no decir que se verifica. Freno del coach con menores, parcial (P10).

## 8. Clasificación de contenido (IARC)

A validar por el dueño. Categoría: **utilidad o productividad**, la que ofrezca el cuestionario.

| Pregunta | Respuesta | Nota |
|---|---|---|
| Violencia | No | La temática de gladiador es solo nombre y tono |
| Sexualidad | No | |
| Drogas, alcohol, tabaco | No | Según la auditoría, la plantilla del Contrato solo propone evitar el alcohol. Si eso cambia, revisar |
| Apuestas | No | |
| Lenguaje soez | No | [DUEÑO: salvo que la prueba del tono sin filtros diga otra cosa] |
| Interacción entre usuarios | **Sí** | Alias, foto y ranking. Sin chat entre personas |
| Comparte ubicación con otros usuarios | No | |
| Compras digitales | **Sí** | Suscripciones de Google Play |
| Navegación web libre | No | |

## 9. Otras declaraciones

| Declaración | Respuesta |
|---|---|
| Anuncios | No contiene anuncios |
| ID de publicidad | No se usa (`AD_ID` retirado) |
| Política de privacidad | https://nivl.app/privacidad, cuando esté actualizada (P1) |
| Eliminación de cuenta | Sí. En la app: Perfil, Cuenta, Eliminar cuenta. Web: https://nivl.app/borrar-cuenta. Esa página lleva hoy una dirección personal: cambiarla antes (P13) |
| App de noticias, Gobierno | No |
| Servicios en primer plano | Ninguno, tras retirar los de `expo-audio` (P11) |

Moderación, si la consola o un revisor preguntan por contenido de usuarios:

```text
Los perfiles muestran alias, título y foto solo a solicitudes, amigos y grupos. No hay chat entre personas. Cualquier usuario puede denunciar y bloquear desde la app, y hay contacto con soporte. Las denuncias y los perfiles se revisan a posteriori.
```

[INTERNO: reescribir según lo que decida CON-01.]

## 10. Cuenta nueva y prueba cerrada

Aplica si la cuenta es personal y se creó después del 13/11/2023: **12 testers apuntados sin interrupción durante 14 días** antes de pedir producción, y quien se sale y vuelve reinicia su cuenta atrás ([ayuda](https://support.google.com/googleplay/android-developer/answer/14151465?hl=es)). Fecha de creación y contador: **sin verificar**.

Orden: AAB desde `7940dc2` o posterior, prueba cerrada, formularios de esta guía, y empezar los 14 días. Una prueba cerrada también exige las declaraciones de salud y finanzas.

Plantilla de la solicitud de producción. Rellenar solo con lo que haya pasado de verdad:

```text
Prueba cerrada
Cómo se reclutó a los testers: [DUEÑO]
Si usaron todas las funciones: [DUEÑO]
Si el uso se pareció al previsto en producción: [DUEÑO]
Resumen de opiniones y cómo se recogieron: [DUEÑO]

La app
Público: personas de 16 años o más que quieren ordenar hábitos, estudio, trabajo o entrenamiento.
Valor: un sistema de hábitos gratuito con un coach de IA opcional por suscripción.
Instalaciones estimadas el primer año: [DUEÑO]

Preparación
Cambios tras la prueba: [DUEÑO]
Por qué está lista: [DUEÑO]
```
