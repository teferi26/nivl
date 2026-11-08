// NIVL · Perfil: la fila que lleva a la conexión con Salud, debajo de la
// sección de privacidad. Se abre también sin módulo nativo: la pantalla explica
// por qué no está disponible.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Card, Row, Section } from '@/components/ui';
import { ink, space } from '@/design/tokens';
import { t } from '@/i18n';

export function EntradaSaludConexion() {
  return (
    <Section title={t('medicion:entrada.seccion')}>
      <Card padded={false} style={styles.lista}>
        <Row
          first
          leading={<Ionicons name="pulse-outline" size={20} color={ink.ink9} />}
          title={t('medicion:entrada.titulo')}
          detail={t('medicion:entrada.detalle')}
          chevron
          onPress={() => router.push('/salud-conexion')}
          accessibilityLabel={t('medicion:entrada.titulo')}
        />
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: space.s4, paddingVertical: 2 },
});
