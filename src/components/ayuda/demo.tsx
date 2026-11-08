// Demo de la galería /kit/pantallas (solo desarrollo): la ayuda contextual.
// `pista` y `glosario` son estáticos; `grupo` usa el almacén de verdad.
import { StyleSheet, Text, View } from 'react-native';
import type { DemoPantalla } from '@/components/arena/galeria';
import { Button, Screen } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { BotonAyuda, GlosarioVista, HojaTermino, Pista, PistaVista, Termino, useAyuda } from '.';

const nada = () => {};

function GrupoReal() {
  const { reactivarPistas, pistasApagadas } = useAyuda();
  return (
    <View style={styles.pila}>
      <Pista
        id="demo.ayuda.segunda"
        grupo="demo"
        prioridad={2}
        titulo="La segunda del grupo"
        cuerpo="Solo se ve cuando se ha cerrado la primera."
      />
      <Pista
        id="demo.ayuda.primera"
        grupo="demo"
        prioridad={1}
        titulo="La primera del grupo"
        cuerpo="Aunque esté montada después, sale antes por su prioridad."
      />
      <Text style={styles.nota}>{pistasApagadas ? 'Pistas apagadas.' : 'Pistas encendidas.'}</Text>
      <Button title="Reiniciar pistas" variant="secondary" onPress={reactivarPistas} />
    </View>
  );
}

function Terminos() {
  return (
    <View style={styles.pila}>
      <View style={styles.fila}>
        <Text style={styles.texto}>Hoy puedes ganar 120 </Text>
        <Termino termino="xp">XP</Termino>
      </View>
      <View style={styles.fila}>
        <Termino termino="racha" textoStyle={styles.cifra} accessibilityLabel="12 días de racha">
          12
        </Termino>
        <Text style={styles.texto}> días seguidos</Text>
      </View>
      <View style={styles.fila}>
        <Text style={styles.titulo}>Tu rango</Text>
        <BotonAyuda termino="rango" />
      </View>
    </View>
  );
}

export const DEMO: DemoPantalla = {
  id: 'ayuda',
  titulo: 'Ayuda contextual',
  marco: 'pila',
  estados: [
    {
      id: 'pista',
      titulo: 'Pista',
      render: () => (
        <Screen>
          <View style={styles.pila}>
            <PistaVista
              titulo="Tu primer día"
              cuerpo="Toca una misión cuando la hayas hecho. Lo que quede sin hacer a medianoche resta puntos."
              onEntendido={nada}
              onNoMostrarMas={nada}
            />
            <PistaVista
              titulo="Con acción"
              cuerpo="El rótulo largo crece y los botones bajan de línea si no caben."
              accion={{ label: 'Ver mis misiones', onPress: nada }}
              onEntendido={nada}
              onNoMostrarMas={nada}
            />
          </View>
        </Screen>
      ),
    },
    { id: 'grupo', titulo: 'Grupo (almacén real)', render: () => <Screen><GrupoReal /></Screen> },
    { id: 'terminos', titulo: 'Término y botón', render: () => <Screen><Terminos /></Screen> },
    {
      id: 'hoja',
      titulo: 'Hoja de término',
      render: () => (
        <Screen>
          <HojaTermino termino="racha" visible onClose={nada} />
        </Screen>
      ),
    },
    { id: 'glosario', titulo: 'Glosario', render: () => <Screen><GlosarioVista /></Screen> },
    { id: 'destacado', titulo: 'Glosario con destacado', render: () => <Screen><GlosarioVista destacar="penalizacion" /></Screen> },
  ],
};

const styles = StyleSheet.create({
  pila: { gap: space.s4 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  texto: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8 },
  nota: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink6 },
  titulo: { fontFamily: tipo.headline.family, fontSize: tipo.headline.size, lineHeight: tipo.headline.lineHeight, color: ink.ink9 },
  cifra: { fontFamily: tipo.number.family, fontSize: tipo.number.size, lineHeight: tipo.number.lineHeight },
});
