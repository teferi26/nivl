// NIVL · Galería del mundo FOCUS (datos de demo, sin sesión ni Supabase). SOLO DESARROLLO.
//
// /kit/focus?pantalla=<hoy|temario|examenes|hojas>&estado=<id>[&quieto=1][&solo=1]
//
// `quieto=1` pinta las entradas ya en su sitio (para capturar con Chrome sin
// cabeza) y `solo=1` quita los selectores. Las pantallas y estados están en
// src/components/focus/demo.tsx. En un build de release redirige a la raíz.

import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fijarQuieto } from '@/components/arena/quieto';
import { GALERIA_FOCUS } from '@/components/focus/demo';
import { Chip, ChipRow } from '@/components/ui';
import { ink, space } from '@/design/tokens';

export default function GaleriaFocus() {
  const p = useLocalSearchParams<{ pantalla?: string; estado?: string; quieto?: string; solo?: string }>();
  fijarQuieto(p.quieto === '1');
  useEffect(() => () => fijarQuieto(false), []);
  if (!__DEV__) return <Redirect href="/" />;
  const pantalla = GALERIA_FOCUS.find((x) => x.id === p.pantalla) ?? GALERIA_FOCUS[0]!;
  const estado = pantalla.estados.find((e) => e.id === p.estado) ?? pantalla.estados[0]!;
  const ir = (cambio: { pantalla?: string; estado?: string }) => router.setParams(cambio);

  return (
    <SafeAreaView style={styles.pantalla} edges={['top', 'left', 'right']}>
      {p.solo === '1' ? null : (
        <View style={styles.controles}>
          <ChipRow>
            {GALERIA_FOCUS.map((x) => (
              <Chip key={x.id} small label={x.titulo} selected={x.id === pantalla.id} onPress={() => ir({ pantalla: x.id, estado: '' })} />
            ))}
          </ChipRow>
          <ChipRow>
            {pantalla.estados.map((e) => (
              <Chip key={e.id} small label={e.titulo} selected={e.id === estado.id} onPress={() => ir({ estado: e.id })} />
            ))}
          </ChipRow>
        </View>
      )}
      {/* Con «solo», un marco de 390 a la izquierda: Chrome sin cabeza no baja de ~500 de ventana. */}
      <View key={`${pantalla.id}-${estado.id}-${p.quieto ?? ''}`} style={[styles.flex, p.solo === '1' && styles.marcoSolo]}>
        {estado.render()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: ink.ink0 },
  controles: { gap: space.s2, paddingVertical: space.s2, borderBottomWidth: 1, borderBottomColor: ink.ink3 },
  flex: { flex: 1 },
  marcoSolo: { width: 390, alignSelf: 'flex-start' },
});
