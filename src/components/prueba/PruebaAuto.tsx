// NIVL · Prueba automática de Élite: lo que se monta en las pestañas.
// Con `prueba_auto_activa` apagado no pinta nada ni lee nada.

import { router } from 'expo-router';
import { Modal } from 'react-native';
import { BienvenidaPrueba, FinPrueba } from './PruebaVistas';
import { usePruebaAuto } from './usePruebaAuto';

export function PruebaAuto() {
  const p = usePruebaAuto();
  return (
    <>
      <BienvenidaPrueba
        visible={p.pantalla === 'bienvenida'}
        dias={p.dias}
        fecha={p.fecha}
        hora={p.hora}
        onCerrar={p.cerrarBienvenida}
      />
      <Modal visible={p.pantalla === 'fin'} animationType="slide" presentationStyle="fullScreen" onRequestClose={p.apartar}>
        <FinPrueba
          fecha={p.fecha}
          hora={p.hora}
          precios={p.precios}
          onSeguir={() => {
            p.apartar();
            // Las ofertas de la tienda (Élite mensual o anual, y Pro), con su letra.
            router.push('/pro?tier=elite');
          }}
          onQuedarme={p.quedarme}
        />
      </Modal>
    </>
  );
}
