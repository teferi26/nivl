// NIVL · Galería del kit v2. SOLO DESARROLLO.
//
// Sirve para verificar a ojo el sistema de diseño (docs/design-v2/SISTEMA.md)
// a 375/430/744/1024/1440 sin necesidad de sesión. En un build de release
// (__DEV__ false) redirige a la raíz y la puerta de sesión no la abre.

import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, Card, Crown, Section, Screen, ScreenHeader, Sheet, Toast } from '@/components/ui';
import { RANK_THEME, type Rank } from '@/design/tokens';
import { useSizeClass } from '@/design/useSizeClass';
import { colors, fonts } from '@/lib/theme';

const RANGOS: Rank[] = ['E', 'D', 'C', 'B', 'A', 'S'];

export default function Kit() {
  const [hoja, setHoja] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const marco = useSizeClass();
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <Screen
      overlay={<Toast message={toast} onDone={() => setToast(null)} />}
      aside={
        <View style={{ padding: 24, gap: 8 }}>
          <Text style={styles.label}>PANEL CONTEXTUAL</Text>
          <Text style={styles.body}>Solo en expanded (≥ 1024).</Text>
        </View>
      }
    >
      <ScreenHeader eyebrow="Diseño v2" title="Kit" subtitle={`Clase: ${marco.sizeClass} · margen ${marco.gutter} · máx. ${marco.maxContent}`} />

      <Section title="Botones">
        <View style={{ gap: 10 }}>
          <Button title="Primario" onPress={() => setToast('+50 XP · FUE')} />
          <Button title="Secundario" variant="secondary" onPress={() => setHoja(true)} />
          <Button title="Fantasma" variant="ghost" onPress={() => {}} />
          <Button title="Eliminar cuenta" variant="danger" icon="trash-outline" onPress={() => {}} />
          <Button title="Pequeño" size="sm" variant="secondary" onPress={() => {}} />
        </View>
      </Section>

      <Section title="Tarjetas">
        <View style={{ gap: 10 }}>
          <Card variant="surface"><Text style={styles.body}>surface · superficie normal</Text></Card>
          <Card variant="outline"><Text style={styles.body}>outline · avisos y vacíos</Text></Card>
          <Card variant="inverse"><Text style={[styles.body, { color: '#000' }]}>inverse · una por pantalla</Text></Card>
          <Card variant="alerta"><Text style={styles.body}>alerta · trama: penalización, bloqueo</Text></Card>
          <Card variant="logro"><Text style={styles.body}>logro · grano: racha, hito, Élite</Text></Card>
        </View>
      </Section>

      <Section title="Rangos">
        <View style={styles.rangos}>
          {RANGOS.map((r) => (
            <View key={r} style={styles.rango}>
              <Avatar size={64} avatarPath={null} name={`Rango ${r}`} rank={r} />
              <Text style={styles.letra}>{r}</Text>
              <Text style={styles.small}>{RANK_THEME[r].defaultTitle}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.rangos, { marginTop: 16 }]}>
          <Crown kind="casco" size={48} />
          <Crown kind="laurel" size={48} />
          <Crown kind="corona_arena" size={48} />
        </View>
      </Section>

      <Sheet
        visible={hoja}
        onClose={() => setHoja(false)}
        eyebrow="HOJA"
        title="Sheet del kit"
        footer={<Button title="Cerrar" onPress={() => setHoja(false)} />}
      >
        <Text style={styles.body}>Centrada a 560 en tablet, a ancho completo en el móvil, con safe area real.</Text>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.heading, fontSize: 12, letterSpacing: 2, color: colors.textFaint },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: 11, color: colors.textDim },
  letra: { fontFamily: fonts.brand, fontSize: 20, color: colors.accent },
  rangos: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, alignItems: 'flex-end' },
  rango: { alignItems: 'center', gap: 6, width: 84 },
});
