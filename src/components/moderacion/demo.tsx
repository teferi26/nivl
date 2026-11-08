// Demo de la galería /kit/pantallas (solo desarrollo): moderación con datos de
// mentira, sin sesión ni Supabase. Las acciones no hacen nada.
import type { DemoPantalla } from '@/components/arena/galeria';
import { leerBandeja } from '@/lib/moderacionmath';
import { BandejaVista, type BandejaVistaProps } from './BandejaVista';
import { DetalleVista, type DetalleVistaProps } from './DetalleVista';

const nada = () => {};

const BANDEJA = leerBandeja({
  recuento: { denuncias_perfil: 1, denuncias_ia: 1, perfiles: 1, suspendidos: 1 },
  denuncias_perfil: [
    {
      id: 'd1', motivo: 'avatar', motivo_texto: 'Foto inapropiada', creada_en: '2026-11-08T14:05:00Z',
      denunciante: { id: 'u1', nombre: 'Marta' },
      denunciado: { id: 'u2', nombre: 'Gladiador Nombre Muy Largo Para Ver Como Se Corta', foto: null, titulo: 'Rey de la arena', estado: 'approved', version: 'v' },
      mostrado: { nombre: 'Gladiador Nombre Muy Largo Para Ver Como Se Corta', foto: null, titulo: 'Rey de la arena' },
    },
  ],
  denuncias_ia: [
    {
      id: 'd2', origen_texto: 'Coach', motivo: 'salud', motivo_texto: 'Consejo de salud peligroso', creada_en: '2026-11-08T09:12:00Z',
      texto: 'Puedes saltarte la cena tres días seguidos para compensar.', denunciante: { id: 'u3', nombre: 'Luis' },
    },
  ],
  perfiles: [{ user_id: 'u4', nombre: 'Ana', foto: null, titulo: null, estado: 'approved', version: 'v', nota: 'auto' }],
  suspendidos: [{ user_id: 'u5', nombre: 'Troll', foto: null, titulo: null, estado: 'suspended', version: 'v', nota: 'suspendido · admin 1234 · 2026-11-01 10:00 UTC · Foto ofensiva' }],
});

const BASE: BandejaVistaProps = { acceso: 'admin', bandeja: BANDEJA, error: null, refrescando: false, onRefrescar: nada, onSalir: nada, onAbrir: nada };
const VACIA = leerBandeja({});

function detalle(clave: 0 | 1, extra: Partial<DetalleVistaProps> = {}): DetalleVistaProps {
  return {
    acceso: 'admin', cargado: true, error: null, refrescando: false, onRefrescar: nada,
    elemento: clave === 0 ? BANDEJA.denunciasPerfil[0] : BANDEJA.denunciasIA[0],
    hoja: null, enviando: false, fallo: null, onSalir: nada, onAccion: nada, onCerrarHoja: nada, onConfirmar: nada, ...extra,
  };
}

export const DEMO: DemoPantalla | null = {
  id: 'moderacion',
  titulo: 'Moderación',
  marco: 'pila',
  estados: [
    { id: 'llena', titulo: 'Bandeja llena', render: () => <BandejaVista {...BASE} /> },
    { id: 'vacia', titulo: 'Bandeja vacía', render: () => <BandejaVista {...BASE} bandeja={VACIA} /> },
    { id: 'cargando', titulo: 'Cargando', render: () => <BandejaVista {...BASE} bandeja={null} /> },
    { id: 'error', titulo: 'Error', render: () => <BandejaVista {...BASE} bandeja={null} error="El sistema no responde." /> },
    { id: 'negado', titulo: 'Sin acceso', render: () => <BandejaVista {...BASE} acceso="negado" /> },
    { id: 'perfil', titulo: 'Detalle: denuncia de perfil', render: () => <DetalleVista {...detalle(0)} /> },
    { id: 'ia', titulo: 'Detalle: denuncia de la IA', render: () => <DetalleVista {...detalle(1)} /> },
    { id: 'confirmar', titulo: 'Confirmar: suspender', render: () => <DetalleVista {...detalle(0, { hoja: 'suspender' })} /> },
  ],
};
