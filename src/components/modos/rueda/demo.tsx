// NIVL · Modos: la rueda en la galería de desarrollo (/kit), sin sesión.
//
// Estado local en vez de `useModo()`: el emblema de verdad con los modos que se
// marquen aquí, el anterior y el cambio. SOLO DESARROLLO (la monta /kit).

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Chip } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { anteriorTrasCambio } from '@/modos/rueda';
import { alternarModo, modosDisponibles, MODOS_ETIQUETA, NOMBRE_MODO, type ModoEtiqueta, type ModoId } from '@/modos/tipos';
import { EmblemaModoVista } from './EmblemaModo';

export function DemoRueda() {
  const [activados, setActivados] = useState<ModoEtiqueta[]>(['iron', 'focus', 'work', 'founder']);
  const [modo, setModo] = useState<ModoId>('general');
  const [anterior, setAnterior] = useState<ModoId | null>(null);
  const disponibles = modosDisponibles(activados);

  const cambiar = (m: ModoId) => {
    setAnterior(anteriorTrasCambio(modo, m, anterior));
    setModo(m);
  };
  const alternar = (m: ModoEtiqueta) => {
    const lista = alternarModo(activados, m);
    setActivados(lista);
    if (modo !== 'general' && !lista.includes(modo)) setModo('general');
    if (anterior && anterior !== 'general' && !lista.includes(anterior)) setAnterior(null);
  };

  return (
    <View style={styles.caja}>
      <View style={styles.fila}>
        {MODOS_ETIQUETA.map((m) => (
          <Chip key={m} label={NOMBRE_MODO[m]} selected={activados.includes(m)} onPress={() => alternar(m)} />
        ))}
      </View>
      <View style={styles.escena}>
        <EmblemaModoVista modo={modo} anterior={anterior} disponibles={disponibles} alCambiar={cambiar} />
        <EmblemaModoVista tamano={44} forma="placa" modo={modo} anterior={anterior} disponibles={disponibles} alCambiar={cambiar} />
      </View>
      <Text style={styles.nota}>
        {`Modo ${NOMBRE_MODO[modo]} · anterior ${anterior ? NOMBRE_MODO[anterior] : '-'}. Toca para abrir la rueda y elige; mantén 300 ms y arrastra como atajo.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { gap: space.s4 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  escena: { flexDirection: 'row', alignItems: 'center', gap: space.s6, paddingVertical: space.s4 },
  nota: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8 },
});
