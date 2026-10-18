// Demo de la galería /kit/pantallas (solo desarrollo): la prueba automática
// de Élite (0069). Solo existe con `prueba_auto_activa` encendido.
import { View } from 'react-native';
import type { DemoPantalla } from '@/components/arena/galeria';
import { Toast } from '@/components/ui';
import { t } from '@/i18n';
import { fechaHoraLocal, preciosFin } from '@/lib/pruebaAutomath';
import { BienvenidaPrueba, FinPrueba } from './PruebaVistas';

const nada = () => {};
const FIN = fechaHoraLocal('2026-10-20T19:30:00Z');
const TIENDA_CON_OFERTA = {
  eliteMes: '29,99 €',
  eliteAnio: '299,99 €',
  proMes: '12,99 €',
  introGratis: '5 días',
  introCondicional: false,
};

export const DEMO: DemoPantalla = {
  id: 'prueba',
  titulo: 'Prueba Élite',
  marco: 'pila',
  estados: [
    {
      id: 'bienvenida',
      titulo: 'Bienvenida',
      render: () => <BienvenidaPrueba visible dias={2} fecha={FIN.fecha} hora={FIN.hora} onCerrar={nada} />,
    },
    {
      id: 'aviso',
      titulo: 'Aviso de 24 h',
      render: () => (
        <View style={{ flex: 1 }}>
          <Toast message={t('prueba:aviso', FIN)} onDone={nada} />
        </View>
      ),
    },
    {
      id: 'fin',
      titulo: 'Fin (precios de la tabla)',
      render: () => <FinPrueba fecha={FIN.fecha} hora={FIN.hora} precios={preciosFin(null)} onSeguir={nada} onQuedarme={nada} />,
    },
    {
      id: 'fin-oferta',
      titulo: 'Fin (tienda con 5 días gratis)',
      render: () => (
        <FinPrueba fecha={FIN.fecha} hora={FIN.hora} precios={preciosFin(TIENDA_CON_OFERTA)} onSeguir={nada} onQuedarme={nada} />
      ),
    },
  ],
};
