// NIVL · Memoria. La ruta solo junta las piezas (L-RADICAL §C, FASE3 G1):
// los datos y los efectos viven en useMemoria; lo que se pinta, en
// MemoriaVista (pura, también en la galería /kit/pantallas).

import { MemoriaVista } from '@/components/memoria/MemoriaVista';
import { useMemoria } from '@/components/memoria/useMemoria';

export default function MemoriaScreen() {
  return <MemoriaVista {...useMemoria()} />;
}
