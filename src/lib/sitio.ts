// NIVL · Qué sitio se compila. Puro: sin Supabase ni React.
//
// El mismo código sale como la app (tiendas y nivl.app) o como el portal de
// creadores (creadores.nivl.app, export web de Expo). Lo decide una variable
// de build: `EXPO_PUBLIC_SITIO=creadores`. Sin ella, todo es la app de siempre.
//
// En el portal solo existen dos pantallas, el login y /creador (contrato del
// Chat 2, docs/payment-audit/PORTAL-CREADORES.md; condición R1 del Chat 3). La
// restricción en cliente no protege datos (eso lo hacen las RPC con
// auth.uid()): sirve para no publicar en un dominio nuevo una superficie de
// la app que nadie ha revisado (salud, coach, fotos, compra).

/** Valor de `EXPO_PUBLIC_SITIO` que activa el portal de creadores. */
export const VALOR_SITIO_CREADORES = 'creadores';

/**
 * El portal es solo web: en iOS y Android la variable no cuenta nunca, aunque
 * se cuele en un build (ver la nota de caché de abajo).
 */
export function esSitioCreadores(valor: string | undefined | null, plataforma: string | undefined): boolean {
  return plataforma === 'web' && (valor ?? '').trim().toLowerCase() === VALOR_SITIO_CREADORES;
}

// Acceso literal a `process.env.EXPO_PUBLIC_…` y a `process.env.EXPO_OS`: Expo
// solo incrusta en el bundle lo escrito así, y lo fija al compilar.
//
// OJO, caché de Metro: el valor queda guardado en la caché de transformación y
// cambiar la variable en la consola NO la invalida. Un export del portal y
// luego uno normal en la misma máquina sale como portal, y al revés. Por eso
// cada export web (portal o nivl.app) se hace con `--clear`. En nativo no
// pasa nada: arriba se exige `web`.
export const SITIO_CREADORES = esSitioCreadores(process.env.EXPO_PUBLIC_SITIO, process.env.EXPO_OS);

/**
 * Adónde mandar a quien está en `primerSegmento` dentro del portal, o null si
 * se queda. Sin sesión, todo va al login; con sesión, todo va a /creador
 * (también el login, una vez dentro). El layout usa lo mismo con el nombre de
 * cada pantalla del Stack: solo se pinta la que devuelve null.
 */
export function destinoPortal(primerSegmento: string | undefined, conSesion: boolean): '/login' | '/creador' | null {
  if (!conSesion) return primerSegmento === 'login' ? null : '/login';
  return primerSegmento === 'creador' ? null : '/creador';
}
