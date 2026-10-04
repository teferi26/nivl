// Demo de la galería /kit/pantallas (solo desarrollo). FASE3 Oleada 2, lote E2.
//
// CompraVista con datos de mentira: sin sesión ni Supabase. Las acciones no
// hacen nada.
import type { DemoPantalla } from '@/components/arena/galeria';
import type { ShoppingItem } from '@/lib/types';
import { CompraVista, type CompraVistaProps } from './CompraVista';

const nada = () => {};

const articulo = (id: string, name: string, done = false, qty: string | null = null): ShoppingItem => ({
  id,
  user_id: 'demo-usuario',
  name,
  qty,
  done,
  created_at: '2026-10-01T09:00:00Z',
});

const LISTA: ShoppingItem[] = [
  articulo('a1', 'Pechuga de pollo', false, '1 kg'),
  articulo('a2', 'Arroz', false, '2'),
  articulo('a3', 'Brócoli'),
  articulo('a4', 'Yogur griego', false, '6'),
  articulo('a5', 'Avena'),
  articulo('a6', 'Plátanos', true, '6'),
  articulo('a7', 'Aceite de oliva', true),
  articulo('a8', 'Merluza', true, '500 g'),
];

const TODO_HECHO = LISTA.map((i) => ({ ...i, done: true }));

function base(cambios: Partial<CompraVistaProps> = {}): CompraVistaProps {
  return {
    cargado: true,
    errorCarga: null,
    items: LISTA,
    nuevo: '',
    anadiendo: false,
    vaciando: false,
    acciones: {
      onVolver: nada,
      onNuevo: nada,
      onAnadir: nada,
      onMarcar: nada,
      onVaciar: nada,
      onDieta: nada,
      onReintentar: nada,
    },
    ...cambios,
  };
}

export const DEMO: DemoPantalla | null = {
  id: 'compra',
  titulo: 'Compra',
  marco: 'pila',
  estados: [
    { id: 'a-medias', titulo: 'A medias', render: () => <CompraVista {...base()} /> },
    { id: 'escribiendo', titulo: 'Añadiendo', render: () => <CompraVista {...base({ nuevo: 'Huevos' })} /> },
    { id: 'hecha', titulo: 'Todo en el carro', render: () => <CompraVista {...base({ items: TODO_HECHO })} /> },
    { id: 'vacia', titulo: 'Lista vacía', render: () => <CompraVista {...base({ items: [] })} /> },
    { id: 'cargando', titulo: 'Cargando', render: () => <CompraVista {...base({ cargado: false, items: [] })} /> },
    {
      id: 'error',
      titulo: 'Sin conexión',
      render: () => (
        <CompraVista {...base({ errorCarga: 'Sin conexión. Revisa la red y vuelve a intentarlo.', items: [] })} />
      ),
    },
  ],
};
