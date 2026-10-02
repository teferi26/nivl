// NIVL · Fotos de progreso (L5 · A). Dato de salud y solo 18+.
//
// La ruta no está en HEALTH_ROUTES: se protege sola (FotosVista enseña el
// permiso de salud o la pregunta de los 18 antes que cualquier foto). Los
// efectos viven en useFotos; aquí solo se montan la vista y las dos hojas.

import { StyleSheet, Text, View } from 'react-native';
import { FotosVista } from '@/components/fotos/FotosVista';
import { HojaNuevaFoto } from '@/components/fotos/HojaNuevaFoto';
import { Miniatura } from '@/components/fotos/LineaFotos';
import { fechaCorta, NOMBRE_POSE } from '@/components/fotos/modelo';
import { useFotos } from '@/components/fotos/useFotos';
import { Button, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';

export default function Fotos() {
  const f = useFotos();
  const foto = f.ver.foto;
  return (
    <FotosVista
      {...f.vista}
      hojas={
        <>
          <HojaNuevaFoto
            visible={f.nueva.visible}
            onCerrar={f.nueva.cerrar}
            uid={f.uid}
            hoy={f.hoy}
            onGuardada={f.nueva.guardada}
            onGate={f.nueva.gate}
            poseInicial={f.nueva.poseInicial}
            tapada={f.nueva.tapada}
          />
          <Sheet
            visible={foto !== null}
            onClose={f.ver.cerrar}
            eyebrow={foto ? fechaCorta(foto.fecha, f.hoy) : undefined}
            title={foto ? NOMBRE_POSE[foto.pose] : undefined}
            footer={<Button title="Borrar foto" variant="danger" icon="trash-outline" onPress={f.ver.borrar} loading={f.ver.borrando} />}
          >
            {foto ? (
              <View style={styles.grande}>
                <Miniatura url={f.ver.url} pose={foto.pose} fecha={foto.fecha} hoy={f.hoy} grande onFallo={() => f.ver.fallo(foto.id)} />
                <Text style={styles.nota}>Solo la ves tú.</Text>
              </View>
            ) : null}
          </Sheet>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  grande: { gap: space.s3, alignSelf: 'center', width: '100%', maxWidth: 360 },
  nota: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, color: ink.ink6, textAlign: 'center' },
});
