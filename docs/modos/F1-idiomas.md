# Modos F1 · Idiomas

Rama `modos-f1/idiomas` (base 659714e). Todo va detrás del flag `idiomas_activos`. **Con el flag apagado (por defecto, y si `app_flags()` falla), la app es la 1.0.10 en español, sin un solo cambio visible:** `verificar-es` da 0 y los tests que fijan el español siguen igual.

## Qué se ha hecho

1. **Catálogos en `src/i18n/<lng>/*.json`** para en, fr, pt, de e it, junto a `src/i18n/es/` (la estructura real del repo; no hay carpeta `locales/`). Cada idioma tiene los 33 namespaces de `es` con sus **2.318 claves**: las mismas claves, interpolaciones (`{{count, miles}}` incluido), plurales `_one`/`_other` y bancos de `voz` con las mismas frases.
   - Se registran en `src/i18n/traducidos.ts`, que se genera con `node scripts/i18n/registrar-traducidos.mjs` (lee las carpetas de idioma que haya).
   - i18next los carga todos al iniciar (init síncrono, como antes).
2. **Test `src/i18n/__tests__/traducidos.test.ts`.** Comprueba en cada idioma:
   - mismos namespaces y exactamente las mismas claves que `es`;
   - mismas interpolaciones con su formato, mismas `<b>` de TextoRico y mismos `$t()`;
   - ningún «—» ni «–», ninguna exclamación, ningún texto vacío;
   - NIVL, IRON, FOCUS, WORK y FOUNDER sin traducir.

   El test de antes (`catalogos.test`, «otro idioma usa las mismas variables») ahora también ve las carpetas nuevas.
3. **`src/components/idioma/SelectorIdioma.tsx`** (`{ valor, alCambiar, ocupado? }`):
   - lista con cada idioma escrito en su propio idioma (`NOMBRE_IDIOMA`);
   - es un `radiogroup` con filas `radio` (`checked`, `accessibilityLanguage`) de al menos 52 de alto;
   - lo elegido lleva el Check blanco del kit y no gasta la inversión.
4. **Ajustes > Idioma** (`PerfilAjustes`, `HojaIdiomaApp`, `usePerfil`). Solo se ve con `idiomas_activos`, y entonces sustituye a «Idioma del coach»: la app y el coach hablan el mismo idioma. Al elegir:
   - `fijarPreferencia` guarda la preferencia en el teléfono (`src/i18n/preferencia.ts`);
   - `asegurarIdiomaPerfil` escribe `profiles.locale` (0066). Si la columna no existe, no escribe y no falla (`sincronizar.ts`);
   - se reprograman los avisos.

   Hay una demo en la galería: `pantalla=perfil&estado=ajustes-idioma-app`.
5. **La interfaz sigue a la preferencia solo con el flag.** La raíz (`_layout.tsx`) llama a `activarIdiomasInterfaz(flags.idiomas_activos)`.
   - Encendido: idioma de la interfaz = idioma efectivo del coach (`auto` sigue al teléfono).
   - Apagado: `es`.
   - Al cambiar de idioma se remonta el árbol (`key={interfaz}`, mecanismo de la 1.0.10). El gladiador vuelve a la pantalla inicial: lo avisa el texto de la hoja.
6. **Flags.** `src/lib/flags.ts` es una **versión mínima mía**, compatible con el contrato, porque en `modos-f1/cliente` aún no existía:
   - `useFlags()`, `cargarFlags()` (RPC `app_flags`, una vez por sesión), `flagActivo()` y `flagsActuales()`;
   - todo apagado por defecto y si falla, sin caché persistente;
   - test en `src/lib/__tests__/flags.test.ts`.

   **Al integrar, manda la del equipo cliente.** Solo hace falta que exporte `useFlags()` y algo síncrono equivalente a `flagActivo('idiomas_activos')`, que es lo que usa `lib/coach.ts`.
7. **Coach.** `cabeceraIdioma()` en `src/lib/coach.ts` añade `x-nivl-locale: <idiomaCoach()>` a todas las llamadas a la función `coach` (`streamCoach`, `runRitual`, `generarResumen`, `clasificarMovimientos`), **solo con el flag**. Sin el flag no se manda nada y el prompt del servidor es byte a byte el de hoy.
8. **Fechas y números con Intl** (`src/i18n/formato.ts`):
   - `localeIntl()`: `pt` → `pt-PT`, y `es`/`xx` → `es-ES`;
   - `fechaLarga()` para las fechas largas;
   - `lib/dates.ts` (`formatLongDate`, `fechaConAnio`) delega en ellas y en `es` sale idéntico (test).
9. **RTL preparado, sin activar** (`src/i18n/direccion.ts`): `IDIOMAS_RTL` (ar, fa, ur, he), `esRTL()` y `aplicarDireccion()` con `I18nManager.allowRTL`/`forceRTL`. Ningún idioma de `IDIOMAS` es RTL, así que no cambia nada (test).

## Riesgos que señalaron los traductores, comprobados

- **La palabra para borrar la cuenta** (`perfil:borrar.palabra`): `palabraCuadra()` ya compara con el valor traducido (`mayus(escrito) === mayus(t('perfil:borrar.palabra'))`) y no con «ELIMINAR» fijo. Las palabras son DELETE, SUPPRIMER, ELIMINAR, LÖSCHEN y ELIMINA. El servidor no la ve: `account-erasure` recibe su propia constante.
- **Decimales con punto y con coma.** El peso (`useAvances`), las cargas y el RPE del gym (`useGym`) y el cardio (`useCardio`) leen con `replace(',', '.')`, así que «72,5» y «72.5» valen en todos los idiomas. Las cifras se pintan con `decimal()`/`miles()` en el idioma activo. El pulso es entero.

## Cobertura por idioma

| Idioma | Claves | Notas |
|---|---:|---|
| en | 2.318/2.318 | Ortografía estadounidense, comillas “ ” |
| fr | 2.318/2.318 | Tutoiement, espacio insecable antes de : ; ? y dentro de « » |
| pt | 2.318/2.318 | Portugués europeo (AO90) con variantes neutras; Intl en pt-PT |
| de | 2.318/2.318 | du, comillas „ “ |
| it | 2.318/2.318 | tu, comillas « » |

Las 8 claves nuevas de la hoja «Idioma» (`perfil:idiomaApp.*`) son las únicas que he escrito en español. Están apuntadas en `docs/i18n/textos-es.aceptados.tsv` y solo se ven con el flag.

## Lo que NO se traduce en esta fase (a propósito)

Los textos de las librerías de otros equipos siguen en español en cualquier idioma, como dice `docs/i18n/INFORME-FINAL.md` §«Lo que queda para la 1.1.0». **Incluye los legales y de consentimiento:**
- `DESCARGO_SALUD` y `LINEA_CRISIS` (`lib/consent.ts`, que se pintan en Ajustes);
- las puertas de salud e IA;
- `proplans` (217 textos);
- `achievements`, `kinds`, `coach`, `oracle`, `socialmath` (por ejemplo `toLocaleString('es-ES')` en sus frases) y `coachvoz` (dictado y voz en `es-ES`);
- `pro.tsx` y `ProOffer.tsx`, el kit y los demos.

Con el flag encendido y otro idioma, esas piezas se verán en español mezcladas. Hay que cerrarlas antes de encender el flag en producción.

## Pendiente de revisión nativa

Antes de publicar cada idioma, un revisor nativo tiene que mirar:
- **La voz «el sistema»:** seca, sin exclamaciones, con el tuteo de cada idioma.
- **El glosario:**

  | es | en | fr | pt | de | it |
  |---|---|---|---|---|---|
  | racha | streak | série | sequência | Serie | serie |
  | rango | rank | rang | patente | Rang | rango |
  | cierre | day close | clôture | fecho | Tagesabschluss | chiusura |
  | Piedra de Protección | Protection Stone | Pierre de protection | Pedra de Proteção | Schutzstein | Pietra di protezione |

  «Patente» (pt) y «Serie» (de) son las elecciones más discutibles.
- **El portugués:** dónde se eligió entre PT y BR (telefone/telemóvel, «tu» frente a construcciones impersonales).
- **Las longitudes en alemán y francés:** botones, rótulos en MAYÚSCULAS, pestañas y celdas de `FranjaCifras`. Hay que pasar la galería con `&idioma=<lng>` cuando exista ese parámetro; hoy solo está `xx`.
- **Las frases que en español no tienen plural** («Tendencia de {{n}} datos»), que se quedaron así para no cambiar el español.

## RTL: qué falta para encenderlo

1. Añadir el idioma a `IDIOMAS` (`estado.ts`) y su catálogo en `src/i18n/<lng>/`.
2. `app.json`: `expo.extra.supportsRTL: true` (y `forcesRTL` solo para probar). Es un cambio nativo y pide binario nuevo.
3. Reiniciar tras `aplicarDireccion()`, que devuelve `true` si cambia: `Updates.reloadAsync()` o pedírselo al gladiador. React Native solo cambia la dirección al arrancar.
4. Revisar los estilos con `left`/`right`, `marginLeft` y similares (pasarlos a `start`/`end`), los iconos con dirección (chevron, flechas de volver), los gráficos (`TrendLine`, barras) y los textos con cifras.
5. Fuentes: Cinzel y Outfit no tienen árabe ni hebreo. Hace falta una familia de reserva.
6. Plurales: el árabe usa `zero`/`two`/`few`/`many`. `traducidos.test` exige hoy las mismas claves que `es` y habrá que permitir las formas extra de cada idioma.

## Cómo se prueba

- `npx tsc --noEmit`, `npx eslint src --max-warnings 0`, `CI=true npx jest --ci` (107 suites en verde) y `node scripts/i18n/verificar-es.mjs` (0 diferencias).
- Galería: `/kit/pantallas?pantalla=perfil&estado=ajustes-idioma-app`.
- En un móvil, con `app_config.idiomas_activos = true`:
  1. Perfil > Idioma > English: la app se recarga en inglés.
  2. El coach responde en inglés, con la cabecera `x-nivl-locale: en`.
  3. `profiles.locale = 'en'` si la 0066 está aplicada.
- Con el flag a `false`: Perfil vuelve a «Idioma del coach» y la app a español.

## Lo que necesito de otros equipos

- **Cliente:** su `src/lib/flags.ts` con `useFlags()` y una lectura síncrona (sustituye a la mía; los nombres de las claves son los del contrato). Además, el selector en el primer paso del onboarding (propuesta §5), que no entraba en este encargo; `SelectorIdioma` ya sirve para eso.
- **Servidor:**
  - 0066 (`profiles.locale`);
  - 0067 (`app_flags()`);
  - el coach leyendo `x-nivl-locale`;
  - las notificaciones del ritual por `profiles.locale`;
  - el filtro «sin guiones» en cada idioma.
- **Motor y dueños de `src/lib`:** pasar sus textos a catálogos (lista de arriba) antes de encender el flag.
- **Hermes:** i18next usa `Intl.PluralRules`. Hermes lo trae en RN 0.81, pero hay que confirmarlo en un binario real con fr/pt/it antes de publicar; si no, polyfill `@formatjs/intl-pluralrules`.
