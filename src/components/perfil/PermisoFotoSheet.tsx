// NIVL · El permiso expreso para enviar una foto de perfil al filtro automático (0143, Apple 5.1.2).

import { Text, View } from 'react-native';
import { Button, Sheet } from '@/components/ui';
import { ink, space, type } from '@/design/tokens';
import { t } from '@/i18n';

export function PermisoFotoSheet({ onResponder }: { onResponder: (permitido: boolean | null) => void }) {
  return (
    <Sheet
      visible
      onClose={() => onResponder(null)}
      eyebrow={t('perfil:filtro.eyebrow')}
      title={t('perfil:filtro.titulo')}
      footer={
        <View style={{ gap: space.s2 }}>
          <Button title={t('perfil:filtro.permitir')} size="lg" onPress={() => onResponder(true)} />
          <Button title={t('perfil:filtro.manual')} variant="secondary" size="lg" onPress={() => onResponder(false)} />
        </View>
      }
    >
      <Text
        style={{ fontFamily: type.body.family, fontSize: type.body.size, lineHeight: type.body.lineHeight, color: ink.ink9 }}
        maxFontSizeMultiplier={1.35}
      >
        {t('perfil:filtro.cuerpo')}
      </Text>
    </Sheet>
  );
}
