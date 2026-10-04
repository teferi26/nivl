// NIVL · Panel de creador. Pantalla oculta: solo se llega desde la fila
// "Panel de creador" de Perfil, que solo sale si creator_panel() devuelve algo.
// En el portal de creadores (creadores.nivl.app, `src/lib/sitio.ts`) es la
// única pantalla con sesión.
//
// La ruta solo junta las piezas (L-RADICAL §C, FASE3 G2): la carga, compartir,
// copiar y cerrar sesión viven en useCreador; lo que se pinta, en CreadorVista
// (pura, también en la galería /kit/pantallas). Lo que se enseña de dinero lo
// decide `vistaPanelCreador` (creatorprogram.ts): nada en la app de tienda.

import { CreadorVista } from '@/components/creador/CreadorVista';
import { useCreador } from '@/components/creador/useCreador';

export default function Creador() {
  const props = useCreador();
  return <CreadorVista {...props} />;
}
