// NIVL · Galería: el modo GENERAL v2 con datos de demo. SOLO DESARROLLO.
//
// /kit/general                       el índice de estados
// /kit/general?estado=<id>&quieto=1  un estado a pantalla completa, sin animar,
//                                    con la barra de NIVL dibujada abajo (para
//                                    capturar con Chrome sin cabeza a 390 × 844)
// En un build de release (__DEV__ false) redirige a la raíz.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fijarQuieto } from '@/components/arena/quieto';
import { ESTADOS_GENERAL, type EstadoGeneral } from '@/components/general/demo';
import { PielGeneral } from '@/components/general/piel';
import { C, G, oroA } from '@/components/general/tema';
import { GlifoModo } from '@/components/modos/rueda/GlifoModo';
import { Screen } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { TopeAncho } from '@/design/useSizeClass';

const PESTANAS = [
  { id: 'hoy', icono: 'today', nombre: 'Hoy' },
  { id: 'avance', icono: 'stats-chart', nombre: 'Avance' },
  { id: null, icono: null, nombre: '' },
  { id: 'campanas', icono: 'flag', nombre: 'Campañas' },
  { id: 'arena', icono: 'trophy', nombre: 'Arena' },
] as const;

/** La barra de NIVL tal como la pinta TabBar con el emblema (solo para la captura). */
function BarraNivl({ activa }: { activa: EstadoGeneral['pestana'] }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={[styles.barra, { paddingBottom: Math.max(bottom, 10) }]}>
      {PESTANAS.map((p, i) =>
        p.icono ? (
          <View key={i} style={styles.pestana}>
            <Ionicons
              name={(p.id === activa ? p.icono : `${p.icono}-outline`) as keyof typeof Ionicons.glyphMap}
              size={20}
              color={p.id === activa ? G : ink.ink6}
            />
            <Text style={[styles.pestanaTexto, p.id === activa && styles.pestanaActiva]}>{p.nombre}</Text>
          </View>
        ) : (
          <View key={i} style={styles.pestana}>
            <View style={styles.emblema}>
              <GlifoModo modo="general" tamano={24} color={G} />
            </View>
          </View>
        ),
      )}
    </View>
  );
}

export default function KitGeneral() {
  const p = useLocalSearchParams<{ estado?: string; quieto?: string; ancho?: string }>();
  const ancho = Number(p.ancho) || 390;
  fijarQuieto(p.quieto === '1');
  useEffect(() => () => fijarQuieto(false), []);
  if (!__DEV__) return <Redirect href="/" />;
  const estado = ESTADOS_GENERAL.find((e) => e.id === p.estado);
  if (estado) {
    return (
      <View style={styles.fondo}>
        <TopeAncho.Provider value={ancho}>
          <View style={[styles.lleno, { width: ancho, maxWidth: ancho }]}>
            <View style={styles.lleno}>
              <PielGeneral>{estado.render()}</PielGeneral>
            </View>
            <BarraNivl activa={estado.pestana} />
          </View>
        </TopeAncho.Provider>
      </View>
    );
  }
  return (
    <Screen>
      <Text style={styles.titulo}>NIVL · General v2</Text>
      {ESTADOS_GENERAL.map((e) => (
        <Pressable key={e.id} onPress={() => router.setParams({ estado: e.id })} style={styles.fila}>
          <Text style={styles.filaTexto}>{e.titulo}</Text>
          <Text style={styles.filaId}>{e.id}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lleno: { flex: 1, backgroundColor: C.fondo },
  fondo: { flex: 1, backgroundColor: C.fondo, alignItems: 'flex-start' },
  titulo: { fontFamily: tipo.rank.family, fontSize: 24, color: ink.ink10, marginVertical: space.s4 },
  fila: { paddingVertical: space.s3, borderBottomWidth: 1, borderBottomColor: ink.ink3, flexDirection: 'row', justifyContent: 'space-between' },
  filaTexto: { fontFamily: tipo.body.family, fontSize: 15, color: ink.ink9 },
  filaId: { fontFamily: tipo.micro.family, fontSize: 12, color: ink.ink6 },
  barra: { flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: C.filete, backgroundColor: C.barra, paddingTop: 8 },
  pestana: { flex: 1, alignItems: 'center', gap: 3 },
  pestanaTexto: { fontFamily: tipo.micro.family, fontSize: 10, color: ink.ink6 },
  pestanaActiva: { color: G },
  emblema: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: G,
    backgroundColor: C.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    boxShadow: `0px 0px 14px ${oroA(0.5)}`,
  },
});
