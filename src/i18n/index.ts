// NIVL · Idiomas (docs/i18n/PLAN-1010.md). Importa desde '@/i18n'.
//
// · `t('ns:clave', { var })`: el texto del catálogo. Nunca a nivel de módulo
//   (literales.test.ts lo vigila): el idioma puede cambiar después de cargar.
// · `idiomaInterfaz()`: `es` mientras el flag `idiomas_activos` esté apagado
//   (como en 1.0.10); con el flag encendido (`activarIdiomasInterfaz(true)`,
//   Modos F1) sigue a la preferencia, igual que el coach. `xx` solo en
//   desarrollo, con `?idioma=xx` en la web.
// · `idiomaCoach()`: el idioma en que habla el coach. Sale de la preferencia
//   (`fijarPreferencia`): un idioma fijo o `auto`, que sigue al teléfono.
//   Mientras la preferencia no se conoce, `es`. Es lo que envía la cabecera
//   `x-nivl-locale` y lo que se guarda en `profiles.locale`.
// · `alCambiar(fn)` / `useIdioma()`: avisan al cambiar la preferencia, el
//   idioma del teléfono (con `auto`) o el de la interfaz.
//
// Sin react-i18next: con el React Compiler, al cambiar el idioma de la
// interfaz se remonta el árbol (`key={idiomaInterfaz()}` en _layout.tsx).
// El init es síncrono: los catálogos van dentro del paquete y `t()` funciona
// desde el primer import.

import { createInstance } from 'i18next';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { aplicarDireccion } from './direccion';
import { escucharDispositivo, idiomaBase, idiomaDispositivo } from './dispositivo';
import {
  __fijarInterfaz,
  esIdioma,
  idiomaInterfazActual,
  type Idioma,
  type IdiomaInterfaz,
  type Preferencia,
} from './estado';
import { miles } from './formato';
import { guardarPreferencia, leerPreferencia } from './preferencia';
import { pseudoRecursos } from './pseudo';
import { RECURSOS_LOCALES } from './traducidos';
import { completarIdioma, NAMESPACES, RECURSOS_ES } from './recursos';

export { esIdioma, esPreferencia, IDIOMAS, NOMBRE_IDIOMA } from './estado';
export type { Idioma, IdiomaInterfaz, Preferencia } from './estado';
export { idiomaDispositivo } from './dispositivo';
export type { Namespace } from './recursos';

/** En desarrollo y en la web, `?idioma=xx` (o `&idioma=xx`) arranca en pseudoidioma. */
function idiomaDeArranque(): IdiomaInterfaz {
  try {
    if (__DEV__ && Platform.OS === 'web' && typeof location !== 'undefined' && /[?&]idioma=xx\b/.test(location.search)) {
      return 'xx';
    }
  } catch {
    // Sin location: español.
  }
  return 'es';
}

const instancia = createInstance();
const arranque = idiomaDeArranque();
__fijarInterfaz(arranque);

type ArbolCatalogo = Parameters<typeof completarIdioma>[0];

/** Español, los idiomas traducidos (src/i18n/<lng>/) y, en desarrollo, el pseudoidioma. */
function recursosIniciales(): Record<string, ArbolCatalogo> {
  const out: Record<string, ArbolCatalogo> = { es: completarIdioma(RECURSOS_ES) };
  for (const [lng, catalogo] of Object.entries(RECURSOS_LOCALES)) {
    out[lng] = completarIdioma(catalogo as unknown as ArbolCatalogo);
  }
  if (__DEV__) out.xx = completarIdioma(pseudoRecursos(RECURSOS_ES));
  return out;
}

instancia.init({
  resources: recursosIniciales(),
  lng: arranque,
  fallbackLng: 'es',
  ns: NAMESPACES,
  defaultNS: 'comun',
  interpolation: { escapeValue: false },
  initAsync: false,
  returnNull: false,
});

// «{{count, miles}} XP» → «1.840 XP» en es (Intl no agrupa cuatro cifras en es).
instancia.services.formatter?.add('miles', (valor: unknown, lng: string | undefined) =>
  miles(Number(valor), (lng as IdiomaInterfaz | undefined) ?? idiomaInterfazActual()),
);

/** El texto de una clave del catálogo: `t('comun:cancelar')`, `t('comun:dia', { count: 3 })`. */
export const t = ((...args: unknown[]) =>
  (instancia.t as unknown as (...a: unknown[]) => string)(...args)) as unknown as typeof instancia.t;

/** ¿Existe la clave en el idioma actual (o en español)? */
export function existe(clave: string): boolean {
  return instancia.exists(clave);
}

// ── Preferencia y oyentes ───────────────────────────────────────────────

let preferencia: Preferencia | null = null;
let version = 0;
const oyentes = new Set<() => void>();
let dejarDeEscuchar: (() => void) | null = null;

function avisarCambio(): void {
  version++;
  for (const f of [...oyentes]) {
    try {
      f();
    } catch {
      // Un oyente roto no tumba a los demás.
    }
  }
}

/**
 * Llama a `fn` cuando cambia la preferencia, el idioma del teléfono (se mira
 * al volver a primer plano) o el de la interfaz. Devuelve cómo dejar de oír.
 */
export function alCambiar(fn: () => void): () => void {
  oyentes.add(fn);
  if (!dejarDeEscuchar) {
    dejarDeEscuchar = escucharDispositivo(() => {
      if (preferencia === 'auto') {
        sincronizarInterfaz();
        avisarCambio();
      }
    });
  }
  return () => {
    oyentes.delete(fn);
  };
}

/** El idioma de la interfaz: `es` con el flag apagado; con él, el de la preferencia. */
export function idiomaInterfaz(): IdiomaInterfaz {
  return idiomaInterfazActual();
}

// ── Interfaz en otros idiomas (Modos F1, flag `idiomas_activos`) ─────────

let interfazLibre = false;

/** Cambia el idioma de i18next, el de `formato` y la dirección de escritura. */
function cambiarInterfaz(idioma: IdiomaInterfaz): boolean {
  if (idiomaInterfazActual() === idioma) return false;
  void instancia.changeLanguage(idioma);
  __fijarInterfaz(idioma);
  // Sin idiomas RTL en IDIOMAS, esto no cambia nada (direccion.ts).
  if (idioma !== 'xx') aplicarDireccion(idioma);
  return true;
}

/**
 * Con la interfaz libre, la deja en el idioma efectivo de la preferencia (el
 * mismo que el coach). Con el flag apagado no toca nada: la 1.0.10 tal cual.
 * El pseudoidioma de desarrollo (`?idioma=xx`) manda sobre todo.
 */
function sincronizarInterfaz(): boolean {
  if (!interfazLibre || arranque === 'xx') return false;
  return cambiarInterfaz(idiomaCoach());
}

/**
 * Enciende o apaga la interfaz en otros idiomas (la raíz lo llama con el flag
 * `idiomas_activos`). Al apagarlo vuelve a `es`. Avisa si cambia el idioma.
 */
export function activarIdiomasInterfaz(activo: boolean): void {
  if (interfazLibre === activo) return;
  interfazLibre = activo;
  const cambia = activo ? sincronizarInterfaz() : arranque !== 'xx' && cambiarInterfaz('es');
  if (cambia) avisarCambio();
}

/** ¿Está encendida la interfaz en otros idiomas? */
export function idiomasInterfazActivos(): boolean {
  return interfazLibre;
}

/** La preferencia de este teléfono, o null si aún no se conoce. */
export function preferenciaIdioma(): Preferencia | null {
  return preferencia;
}

/**
 * El idioma del coach para una preferencia y un teléfono dados (puro): sin
 * preferencia, `es`; con `auto`, el del teléfono si NIVL lo habla y si no `es`.
 */
export function resolverIdiomaCoach(pref: Preferencia | null, dispositivo: string | null): Idioma {
  if (pref === null) return 'es';
  if (pref !== 'auto') return pref;
  const base = idiomaBase(dispositivo);
  return esIdioma(base) ? base : 'es';
}

/** El idioma en que habla el coach (cabecera `x-nivl-locale` y `profiles.locale`). */
export function idiomaCoach(): Idioma {
  return resolverIdiomaCoach(preferencia, idiomaDispositivo());
}

/**
 * Elige el idioma del coach: guarda en el teléfono y avisa. No escribe en el
 * perfil (eso es de quien llama, que sabe el usuario: ver sincronizar.ts).
 */
export async function fijarPreferencia(p: Preferencia): Promise<void> {
  if (preferencia !== p) {
    preferencia = p;
    sincronizarInterfaz();
    avisarCambio();
  }
  await guardarPreferencia(p);
}

/**
 * Lee la preferencia guardada en el teléfono (una vez basta). Si ya se fijó
 * otra mientras tanto, manda la fijada.
 */
export async function cargarPreferencia(): Promise<Preferencia | null> {
  const guardada = await leerPreferencia();
  if (preferencia === null && guardada !== null) {
    preferencia = guardada;
    sincronizarInterfaz();
    avisarCambio();
  }
  return preferencia;
}

export interface DatosArranque {
  /** Lo guardado en el teléfono (null: nunca se eligió aquí). */
  guardada: Preferencia | null;
  /** `profiles.onboarding_done`. */
  onboardingHecho: boolean;
  /** `profiles.locale` (undefined si la columna aún no existe). */
  locale: string | null | undefined;
  /** El idioma del teléfono. */
  dispositivo: string | null;
  /**
   * La cuenta que entra no es la última que fijó la preferencia en este
   * teléfono: si su perfil ya trae idioma, manda el de la cuenta.
   */
  otraCuenta?: boolean;
}

/**
 * La regla de arranque (decisión de Teferi, plan §Selector), pura:
 *  · lo guardado en el teléfono manda;
 *  · si el perfil ya tiene idioma (otro teléfono, reinstalación), ese; como
 *    `auto` si coincide con el del teléfono;
 *  · una cuenta que ya existía (onboarding hecho y sin idioma) fija `es`: un
 *    hispanohablante con el móvil en inglés no recibe al coach en inglés;
 *  · una cuenta nueva, `auto`.
 * `guardar` dice si hay que guardar la decisión en el teléfono.
 */
export function decidirPreferenciaInicial(d: DatosArranque): { preferencia: Preferencia; guardar: boolean } {
  if (d.guardada !== null && !(d.otraCuenta && esIdioma(d.locale))) {
    return { preferencia: d.guardada, guardar: false };
  }
  if (esIdioma(d.locale)) {
    const auto = resolverIdiomaCoach('auto', d.dispositivo);
    return { preferencia: auto === d.locale ? 'auto' : d.locale, guardar: true };
  }
  if (d.onboardingHecho) return { preferencia: 'es', guardar: true };
  return { preferencia: 'auto', guardar: true };
}

// ── Hook ────────────────────────────────────────────────────────────────

export interface EstadoIdioma {
  interfaz: IdiomaInterfaz;
  /** null mientras no se conoce. */
  preferencia: Preferencia | null;
  coach: Idioma;
  /** El idioma del teléfono (BCP 47) o null. */
  dispositivo: string | null;
}

let instantanea: (EstadoIdioma & { version: number }) | null = null;

function leerInstantanea(): EstadoIdioma {
  if (!instantanea || instantanea.version !== version) {
    instantanea = {
      version,
      interfaz: idiomaInterfazActual(),
      preferencia,
      coach: idiomaCoach(),
      dispositivo: idiomaDispositivo(),
    };
  }
  return instantanea;
}

/** El estado del idioma, con repintado al cambiar. */
export function useIdioma(): EstadoIdioma {
  return useSyncExternalStore(alCambiar, leerInstantanea, leerInstantanea);
}

/** Solo el idioma de la interfaz: repinta únicamente si cambia ese (la raíz). */
export function useIdiomaInterfaz(): IdiomaInterfaz {
  return useSyncExternalStore(alCambiar, idiomaInterfazActual, idiomaInterfazActual);
}

// ── Solo pruebas ────────────────────────────────────────────────────────

/** Cambia el idioma de la interfaz (síncrono: los catálogos ya están cargados). */
export function __fijarIdiomaParaTest(idioma: IdiomaInterfaz): void {
  void instancia.changeLanguage(idioma);
  __fijarInterfaz(idioma);
  avisarCambio();
}

/** Olvida la preferencia (vuelve a «no se conoce») y apaga la interfaz libre. */
export function __olvidarPreferenciaParaTest(): void {
  preferencia = null;
  interfazLibre = false;
  avisarCambio();
}
