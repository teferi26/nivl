// Demo de la galería /kit/pantallas (solo desarrollo): el cobro por modos con
// datos de mentira. Los precios imitan los que daría la tienda.
import { useState } from 'react';
import type { DemoPantalla } from '@/components/arena/galeria';
import { Screen } from '@/components/ui';
import { productoModo, type ModoDePago, type Periodo } from '@/lib/planesmodo';
import { MundoCerradoVista } from './MundoCerradoVista';
import { OfertaModosVista, type EstadoOfertaModos } from './OfertaModosVista';

const nada = () => {};
const PRECIOS: Record<Periodo, { uno: string; todos: string }> = {
  anual: { uno: '59,99 €', todos: '99 €' },
  mensual: { uno: '14,99 €', todos: '30 €' },
};

function useOfertaDemo(inicial: Partial<EstadoOfertaModos> & { modo?: ModoDePago } = {}): EstadoOfertaModos {
  const [periodo, setPeriodo] = useState<Periodo>(inicial.periodo ?? 'anual');
  const [pack, setPack] = useState<'todos' | 'uno'>(inicial.pack ?? 'uno');
  const [modo, setModo] = useState<ModoDePago>(inicial.modo ?? 'iron');
  const alcance = pack === 'todos' ? 'todos' : modo;
  const precioDe = (a: ModoDePago | 'todos') => PRECIOS[periodo][a === 'todos' ? 'todos' : 'uno'];
  return {
    disponible: true,
    catalogo: 'listo',
    periodo,
    pack,
    modo,
    producto: productoModo(alcance, periodo),
    precio: precioDe(alcance),
    precioDe,
    periodoGratis: periodo === 'anual' ? '7 días' : null,
    esActual: false,
    puedeComprar: true,
    busy: null,
    aviso: null,
    sinPermiso: false,
    avisoEnlace: false,
    plataforma: 'ios',
    onPeriodo: setPeriodo,
    onPack: setPack,
    onModo: setModo,
    onComprar: nada,
    onRestaurar: nada,
    onReintentar: nada,
    onRevisarPermiso: nada,
    onAbrir: nada,
    hoja: null,
    ...inicial,
  };
}

function Oferta(props: Partial<EstadoOfertaModos>) {
  const oferta = useOfertaDemo(props);
  return (
    <Screen>
      <OfertaModosVista oferta={oferta} etiquetaSalida="Seguir gratis" onSalir={nada} />
    </Screen>
  );
}

function Cerrado({ modo }: { modo: ModoDePago }) {
  const oferta = useOfertaDemo({ modo });
  return <MundoCerradoVista modo={modo} oferta={<OfertaModosVista oferta={oferta} etiquetaSalida="Volver a NIVL" onSalir={nada} />} />;
}

export const DEMO: DemoPantalla = {
  id: 'pago',
  titulo: 'Pago por modos',
  marco: 'pila',
  estados: [
    { id: 'cerrado', titulo: 'Mundo cerrado', render: () => <Cerrado modo="iron" /> },
    { id: 'cerrado-focus', titulo: 'Mundo cerrado · FOCUS', render: () => <Cerrado modo="focus" /> },
    { id: 'oferta', titulo: 'Oferta · anual', render: () => <Oferta /> },
    { id: 'todos', titulo: 'Oferta · los cuatro', render: () => <Oferta pack="todos" /> },
    { id: 'mensual', titulo: 'Oferta · mensual', render: () => <Oferta periodo="mensual" /> },
    { id: 'sin-tienda', titulo: 'Sin tienda', render: () => <Oferta disponible={false} /> },
  ],
};
