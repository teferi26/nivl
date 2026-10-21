// NIVL · Galería: la economía de WORK con datos de demo. SOLO DESARROLLO.
//
// /kit/work                       el índice de estados
// /kit/work?estado=<id>&quieto=1  un estado a pantalla completa, sin animar,
//                                 con la barra del mundo dibujada abajo (para
//                                 capturar con Chrome sin cabeza a 390 × 844)
// En un build de release (__DEV__ false) redirige a la raíz.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fijarQuieto } from '@/components/arena/quieto';
import { ESTADOS_WORK } from '@/components/economia/work/demo';
import { ACENTO, tinte } from '@/components/economia/work/PiezasWork';
import { GlifoModo } from '@/components/modos/rueda/GlifoModo';
import { Screen } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { TopeAncho } from '@/design/useSizeClass';

const PESTANAS = [
  { icono: 'today-outline', nombre: 'Hoy' },
  { icono: 'wallet', nombre: 'Economía', activa: true },
  { icono: null, nombre: '' },
  { icono: 'calendar-outline', nombre: 'Agenda' },
  { icono: 'chatbubble-ellipses-outline', nombre: 'Coach' },
] as const;

/** La barra de WORK tal como sale en la lámina (solo para la captura). */
function BarraMundo() {
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={[styles.barra, { paddingBottom: Math.max(bottom, 10) }]}>
      {PESTANAS.map((p, i) =>
        p.icono ? (
          <View key={i} style={styles.pestana}>
            <Ionicons name={p.icono} size={20} color={'activa' in p ? ink.ink10 : ink.ink6} />
            <Text style={[styles.pestanaTexto, 'activa' in p && styles.pestanaActiva]}>{p.nombre}</Text>
          </View>
        ) : (
          <View key={i} style={styles.pestana}>
            <View style={styles.emblema}>
              <GlifoModo modo="work" tamano={24} color={ACENTO} />
            </View>
          </View>
        ),
      )}
    </View>
  );
}

export default function KitWork() {
  const p = useLocalSearchParams<{ estado?: string; quieto?: string; ancho?: string }>();
  // Chrome sin cabeza no baja de ~500 px de ventana: el marco fija el ancho del teléfono.
  const ancho = Number(p.ancho) || 390;
  fijarQuieto(p.quieto === '1');
  useEffect(() => () => fijarQuieto(false), []);
  if (!__DEV__) return <Redirect href="/" />;

  const estado = ESTADOS_WORK.find((e) => e.id === p.estado);
  if (estado) {
    return (
      <View style={styles.fondo}>
        <TopeAncho.Provider value={ancho}>
          <View style={[styles.lleno, { width: ancho, maxWidth: ancho }]}>
            <View style={styles.lleno}>{estado.render()}</View>
            {estado.id.startsWith('hoja') ? null : <BarraMundo />}
          </View>
        </TopeAncho.Provider>
      </View>
    );
  }
  return (
    <Screen>
      <Text style={styles.titulo}>WORK · economía</Text>
      {ESTADOS_WORK.map((e) => (
        <Pressable key={e.id} onPress={() => router.setParams({ estado: e.id })} style={styles.fila}>
          <Text style={styles.filaTexto}>{e.titulo}</Text>
          <Text style={styles.filaId}>{e.id}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lleno: { flex: 1, backgroundColor: ink.ink0 },
  fondo: { flex: 1, backgroundColor: ink.ink0, alignItems: 'flex-start' },
  titulo: { fontFamily: tipo.rank.family, fontSize: 24, color: ink.ink10, marginVertical: space.s4 },
  fila: { paddingVertical: space.s3, borderBottomWidth: 1, borderBottomColor: ink.ink3, flexDirection: 'row', justifyContent: 'space-between' },
  filaTexto: { fontFamily: tipo.body.family, fontSize: 15, color: ink.ink9 },
  filaId: { fontFamily: tipo.micro.family, fontSize: 12, color: ink.ink6 },
  barra: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: ink.ink3,
    backgroundColor: ink.ink0,
    paddingTop: 8,
  },
  pestana: { flex: 1, alignItems: 'center', gap: 3 },
  pestanaTexto: { fontFamily: tipo.micro.family, fontSize: 10, color: ink.ink6 },
  pestanaActiva: { color: ink.ink10 },
  emblema: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: ACENTO,
    backgroundColor: tinte(0.1),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
  },
});
