// NIVL · Lista de la compra. La ruta solo junta las piezas (L-RADICAL §C,
// FASE3 Oleada 2, lote E2): los datos, los efectos y los cerrojos viven en
// useCompra; lo que se pinta, en CompraVista (pura, también en la galería
// /kit/pantallas).

import { CompraVista } from '@/components/compra/CompraVista';
import { useCompra } from '@/components/compra/useCompra';

export default function Compra() {
  return <CompraVista {...useCompra()} />;
}
