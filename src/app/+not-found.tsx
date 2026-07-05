import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemButton } from '@/components/SystemButton';
import { SystemWindow } from '@/components/SystemWindow';
import { colors, fonts } from '@/lib/theme';

// Deep link inválido / ruta vieja: mantiene la identidad oscura en vez del 404
// claro por defecto de expo-router.
export default function NotFound() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.center}>
        <SystemWindow color={colors.redDim} fill={colors.redPanel}>
          <Text style={styles.title}>RUTA NO ENCONTRADA</Text>
          <Text style={styles.body}>El sistema no reconoce este destino.</Text>
        </SystemWindow>
        <SystemButton title="Volver al sistema" onPress={() => router.replace('/')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', padding: 24 },
  title: {
    fontFamily: fonts.heading,
    fontSize: 14,
    letterSpacing: 2.5,
    color: colors.red,
    marginBottom: 6,
  },
  body: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
});
