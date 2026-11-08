// NIVL · Moderación: lógica pura (sin Supabase). Normaliza lo que devuelve
// admin_moderacion_bandeja (0088) y traduce sus respuestas a frases.

export type TipoDenuncia = 'perfil' | 'ia';
export type ClaseElemento = 'denuncia_perfil' | 'denuncia_ia' | 'perfil' | 'suspendido';
export type AccionModeracion = 'descartar' | 'resolver' | 'suspender' | 'levantar' | 'revisar';

export interface Persona {
  id: string | null;
  nombre: string | null;
}

export interface DenunciaPerfil {
  clase: 'denuncia_perfil';
  clave: string;
  id: string;
  motivo: string;
  motivoTexto: string;
  creadaEn: string;
  denunciante: Persona;
  denunciado: Persona & { foto: string | null; titulo: string | null; estado: string | null; version: string | null };
  mostrado: { nombre: string | null; foto: string | null; titulo: string | null };
}

export interface DenunciaIA {
  clase: 'denuncia_ia';
  clave: string;
  id: string;
  origen: string;
  motivo: string;
  motivoTexto: string;
  texto: string;
  creadaEn: string;
  denunciante: Persona;
}

export interface PerfilModeracion {
  clase: 'perfil' | 'suspendido';
  clave: string;
  userId: string;
  nombre: string | null;
  foto: string | null;
  titulo: string | null;
  estado: string;
  version: string;
  revisadoEn: string | null;
  nota: string | null;
}

export type ElementoModeracion = DenunciaPerfil | DenunciaIA | PerfilModeracion;

export interface Bandeja {
  recuento: { denunciasPerfil: number; denunciasIA: number; perfiles: number; suspendidos: number };
  denunciasPerfil: DenunciaPerfil[];
  denunciasIA: DenunciaIA[];
  perfiles: PerfilModeracion[];
  suspendidos: PerfilModeracion[];
}

export interface RespuestaAccion {
  ok: boolean;
  motivo?: string;
}

type Crudo = Record<string, unknown>;
const texto = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const numero = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const objeto = (v: unknown): Crudo => (v && typeof v === 'object' ? (v as Crudo) : {});
const lista = (v: unknown): Crudo[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Crudo[]) : []);

function perfil(f: Crudo, clase: 'perfil' | 'suspendido'): PerfilModeracion {
  const userId = texto(f.user_id) ?? '';
  return {
    clase,
    clave: `${clase === 'perfil' ? 'pf' : 'su'}_${userId}`,
    userId,
    nombre: texto(f.nombre),
    foto: texto(f.foto),
    titulo: texto(f.titulo),
    estado: texto(f.estado) ?? '',
    version: texto(f.version) ?? '',
    revisadoEn: texto(f.revisado_en),
    nota: texto(f.nota),
  };
}

export function leerBandeja(crudo: unknown): Bandeja {
  const b = objeto(crudo);
  const r = objeto(b.recuento);
  return {
    recuento: {
      denunciasPerfil: numero(r.denuncias_perfil),
      denunciasIA: numero(r.denuncias_ia),
      perfiles: numero(r.perfiles),
      suspendidos: numero(r.suspendidos),
    },
    denunciasPerfil: lista(b.denuncias_perfil).map((f) => {
      const d = objeto(f.denunciado);
      const m = objeto(f.mostrado);
      const q = objeto(f.denunciante);
      const id = texto(f.id) ?? '';
      return {
        clase: 'denuncia_perfil' as const,
        clave: `dp_${id}`,
        id,
        motivo: texto(f.motivo) ?? '',
        motivoTexto: texto(f.motivo_texto) ?? 'Denuncia',
        creadaEn: texto(f.creada_en) ?? '',
        denunciante: { id: texto(q.id), nombre: texto(q.nombre) },
        denunciado: {
          id: texto(d.id),
          nombre: texto(d.nombre),
          foto: texto(d.foto),
          titulo: texto(d.titulo),
          estado: texto(d.estado),
          version: texto(d.version),
        },
        mostrado: { nombre: texto(m.nombre), foto: texto(m.foto), titulo: texto(m.titulo) },
      };
    }),
    denunciasIA: lista(b.denuncias_ia).map((f) => {
      const q = objeto(f.denunciante);
      const id = texto(f.id) ?? '';
      return {
        clase: 'denuncia_ia' as const,
        clave: `ia_${id}`,
        id,
        origen: texto(f.origen_texto) ?? 'IA',
        motivo: texto(f.motivo) ?? '',
        motivoTexto: texto(f.motivo_texto) ?? 'Denuncia',
        texto: texto(f.texto) ?? '',
        creadaEn: texto(f.creada_en) ?? '',
        denunciante: { id: texto(q.id), nombre: texto(q.nombre) },
      };
    }),
    perfiles: lista(b.perfiles).map((f) => perfil(f, 'perfil')),
    suspendidos: lista(b.suspendidos).map((f) => perfil(f, 'suspendido')),
  };
}

export function totalAbierto(b: Bandeja): number {
  return b.recuento.denunciasPerfil + b.recuento.denunciasIA + b.recuento.perfiles;
}

export function buscarElemento(b: Bandeja, clave: string): ElementoModeracion | null {
  return [...b.denunciasPerfil, ...b.denunciasIA, ...b.perfiles, ...b.suspendidos].find((e) => e.clave === clave) ?? null;
}

export function accionesDe(e: ElementoModeracion): AccionModeracion[] {
  switch (e.clase) {
    case 'denuncia_perfil':
      return e.denunciado.id ? ['resolver', 'descartar', 'suspender'] : ['resolver', 'descartar'];
    case 'denuncia_ia':
      return ['resolver', 'descartar'];
    case 'perfil':
      return ['revisar', 'suspender'];
    case 'suspendido':
      return ['levantar'];
  }
}

export function respuestaAccion(crudo: unknown): RespuestaAccion {
  const r = objeto(crudo);
  return { ok: r.ok === true, motivo: texto(r.motivo) ?? undefined };
}

/** La frase de un ok=false. El resultado siempre lleva a recargar la bandeja. */
export function fraseRechazo(motivo: string | undefined): string {
  switch (motivo) {
    case 'ya_cerrada':
      return 'Esta denuncia ya estaba cerrada desde otro dispositivo.';
    case 'perfil_cambio':
      return 'El perfil ha cambiado mientras lo mirabas. Revísalo de nuevo.';
    case 'borrado_pendiente':
      return 'Quien denunció está borrando su cuenta. La denuncia desaparecerá con ella.';
    case 'no_suspendido':
      return 'Este perfil ya no está suspendido.';
    case 'estado':
      return 'Este perfil está suspendido. Levanta la suspensión desde su ficha.';
    default:
      return 'Este elemento ya no está disponible.';
  }
}

/** ¿La nota es obligatoria para esta acción? (el servidor pide 3 caracteres) */
export function notaObligatoria(a: AccionModeracion): boolean {
  return a === 'suspender' || a === 'levantar';
}

export function notaValida(a: AccionModeracion, nota: string): boolean {
  return !notaObligatoria(a) || nota.trim().length >= 3;
}

/** «08/11 14:05», hora del dispositivo. */
export function fechaCorta(iso: string): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '-';
  const d = (n: number) => String(n).padStart(2, '0');
  return `${d(f.getDate())}/${d(f.getMonth() + 1)} ${d(f.getHours())}:${d(f.getMinutes())}`;
}

export function nombreDe(p: { nombre: string | null; id?: string | null }, vacio = 'Cuenta borrada'): string {
  return p.nombre ?? (p.id ? `Sin nombre (${p.id.slice(0, 6)})` : vacio);
}
