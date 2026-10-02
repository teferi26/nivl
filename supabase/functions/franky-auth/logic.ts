// NIVL · franky-auth: la parte pura del puente (sin red, sin Deno.env).
//
// Vive aparte para poder probarla con Jest desde src/lib/__tests__ (igual que
// _shared/routing.ts). Nada de imports: el empaquetado de la Edge Function y el
// de Jest tienen que poder cargarla tal cual.

export type Action = 'login' | 'register';

export class PuertaError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** `undefined`/`null` es login (clientes antiguos); cualquier otra cosa que no sea login/register, null. */
export function accionDe(raw: unknown): Action | null {
  if (raw == null || raw === 'login') return 'login';
  if (raw === 'register') return 'register';
  return null;
}

export function limpiarEmail(raw: unknown): string {
  const e = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!e || e.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) {
    throw new PuertaError('invalid_email', 400, 'El correo no tiene un formato válido.');
  }
  return e;
}

export function limpiarPassword(raw: unknown): string {
  const p = typeof raw === 'string' ? raw : '';
  if (!p || p.length > 200) {
    throw new PuertaError('invalid_password', 400, 'Escribe tu contraseña.');
  }
  return p;
}

/**
 * La IP del cliente para el freno. Se prefieren las cabeceras que escribe el
 * borde (`cf-connecting-ip`, `x-real-ip`). El primer valor de
 * `x-forwarded-for` lo puede inventar el cliente, así que el freno por IP es
 * esquivable cuando solo llega esa cabecera: por eso existe además el freno
 * por correo, que no depende de cabeceras. No se usa el último salto: en la
 * red de Supabase puede ser un proxy interno compartido y frenaría a todos.
 */
export function ipDe(headers: { get(name: string): string | null }): string {
  const directa = headers.get('cf-connecting-ip')?.trim() || headers.get('x-real-ip')?.trim();
  if (directa) return directa;
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocida';
}

/**
 * Freno de ventana fija por clave. Best-effort: el aislado de una Edge Function
 * es efímero y no comparte memoria con otros. No sustituye a los límites de
 * Auth de Franky; frena a un script que martillee la misma instancia.
 */
export class Freno {
  private readonly cuentas = new Map<string, { n: number; hasta: number }>();

  constructor(
    private readonly limite: number,
    private readonly ventanaMs: number,
    private readonly maxClaves = 10_000,
  ) {}

  /** Cuenta un intento; true si aún cabe, false si se pasa del límite. */
  intentar(clave: string, ahora: number = Date.now()): boolean {
    const v = this.cuentas.get(clave);
    if (!v || v.hasta < ahora) {
      if (this.cuentas.size >= this.maxClaves) this.purgar(ahora);
      this.cuentas.set(clave, { n: 1, hasta: ahora + this.ventanaMs });
      return true;
    }
    v.n += 1;
    return v.n <= this.limite;
  }

  private purgar(ahora: number): void {
    for (const [k, v] of this.cuentas) if (v.hasta < ahora) this.cuentas.delete(k);
    // Si todo sigue vivo (inundación), se vacía: mejor olvidar que crecer sin tope.
    if (this.cuentas.size >= this.maxClaves) this.cuentas.clear();
  }
}

export type Vinculo = 'ok' | 'vincular' | 'conflicto';

export interface DecisionVinculo {
  vinculo: Vinculo;
  /**
   * true = al vincular, sustituir la contraseña NIVL por una aleatoria que nadie
   * conoce. Solo para cuentas SIN vínculo y SIN correo confirmado: son las que
   * pudo crear un tercero con signUp público (alta abierta). El magic link del
   * puente confirmaría el correo y la contraseña de ese tercero seguiría
   * valiendo. Una cuenta ya confirmada (las legítimas anteriores al puente, la
   * del revisor) conserva la suya.
   */
  reiniciarPassword: boolean;
}

/**
 * ¿Puede esta cuenta Franky abrir esta cuenta NIVL, y cómo?
 *
 * El vínculo vive en `app_metadata.franky_id`, que solo escribe el servidor.
 * (`user_metadata` lo puede cambiar el propio usuario con updateUser: no vale
 * como prueba de nada.) Un correo es la llave para encontrar la cuenta, pero
 * no basta: si la cuenta NIVL ya está atada a OTRA cuenta Franky (Franky
 * reasignó el correo, o alguien movió su correo NIVL al de otra persona), el
 * puente no entrega la sesión.
 */
export function decidirVinculo(
  usuario: { app_metadata?: unknown; email_confirmed_at?: string | null } | null | undefined,
  frankyId: string,
): DecisionVinculo {
  const meta = (usuario?.app_metadata && typeof usuario.app_metadata === 'object' ? usuario.app_metadata : {}) as Record<
    string,
    unknown
  >;
  const actual = meta.franky_id;
  if (typeof actual === 'string' && actual.length > 0) {
    return { vinculo: actual === frankyId ? 'ok' : 'conflicto', reiniciarPassword: false };
  }
  const confirmado = typeof usuario?.email_confirmed_at === 'string' && usuario.email_confirmed_at.length > 0;
  return { vinculo: 'vincular', reiniciarPassword: !confirmado };
}

/** 32 bytes aleatorios en base64url (43 caracteres). No se registra en ningún sitio. */
export function passwordAleatoria(rnd: (b: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const bytes = rnd(new Uint8Array(32));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
