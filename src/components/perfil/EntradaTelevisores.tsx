// NIVL · Perfil: la fila que lleva a Televisores (enlazar un Apple TV o cortarlo).

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Card, Row, Section } from '@/components/ui';
import { ink, space } from '@/design/tokens';
import { t } from '@/i18n';

export function EntradaTelevisores() {
  return (
    <Section title={t('perfil:televisores.ceja')}>
      <Card padded={false} style={styles.lista}>
        <Row
          first
          leading={<Ionicons name="tv-outline" size={20} color={ink.ink9} />}
          title={t('perfil:televisores.titulo')}
          detail={t('perfil:televisores.entradaDetalle')}
          chevron
          onPress={() => router.push('/tv')}
          accessibilityLabel={t('perfil:televisores.titulo')}
        />
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: space.s4, paddingVertical: 2 },
});
