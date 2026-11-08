// NIVL · La sección «Ayuda» de Perfil: el glosario completo y el interruptor
// de las pistas (la única forma de recuperarlas tras «No mostrar más pistas»).

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Card, Row, Section } from '@/components/ui';
import { Interruptor } from '@/components/ui/Interruptor';
import { ink, space } from '@/design/tokens';
import { t } from '@/i18n';
import { HojaGlosario } from './GlosarioVista';
import { useAyuda } from './useAyuda';

export function AyudaPerfil() {
  const { pistasApagadas, apagarPistas, reactivarPistas } = useAyuda();
  const [glosario, setGlosario] = useState(false);

  return (
    <Section title={t('ayuda:perfil.seccion')}>
      <Card padded={false} style={styles.lista}>
        <Row
          first
          leading={<Ionicons name="book-outline" size={20} color={ink.ink9} />}
          title={t('ayuda:glosario.titulo')}
          detail={t('ayuda:perfil.glosarioDetalle')}
          chevron
          onPress={() => setGlosario(true)}
          accessibilityLabel={t('ayuda:glosario.titulo')}
        />
        <Row
          leading={<Ionicons name="bulb-outline" size={20} color={pistasApagadas ? ink.ink6 : ink.ink9} />}
          title={t('ayuda:perfil.pistas')}
          detail={t('ayuda:perfil.pistasDetalle')}
          trailing={
            <Interruptor
              value={!pistasApagadas}
              onValueChange={(activas) => (activas ? reactivarPistas() : apagarPistas())}
              accessibilityLabel={t('ayuda:perfil.pistas')}
            />
          }
        />
      </Card>
      <HojaGlosario visible={glosario} onClose={() => setGlosario(false)} />
    </Section>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: space.s4, paddingVertical: 2 },
});
