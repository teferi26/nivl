// NIVL · La hoja corta con lo que significa una palabra del juego. Si el
// término tiene más que contar, «Más en el glosario» cambia el contenido de la
// misma hoja: dos modales apilados no funcionan bien en iOS.

import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { tieneDetalle, type TerminoId } from '@/lib/glosario';
import { definicionTermino, GlosarioVista, tituloTermino } from './GlosarioVista';

export interface HojaTerminoProps {
  termino: TerminoId;
  visible: boolean;
  onClose: () => void;
}

export function HojaTermino({ termino, visible, onClose }: HojaTerminoProps) {
  const [completo, setCompleto] = useState(false);

  useEffect(() => {
    if (visible) setCompleto(false);
  }, [visible]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={completo ? t('ayuda:glosario.eyebrow') : t('ayuda:hoja.eyebrow')}
      title={completo ? t('ayuda:glosario.titulo') : tituloTermino(termino)}
    >
      {completo ? (
        <GlosarioVista destacar={termino} />
      ) : (
        <>
          <Text maxFontSizeMultiplier={1.35} style={styles.definicion}>
            {definicionTermino(termino)}
          </Text>
          {tieneDetalle(termino) ? (
            <Button
              title={t('ayuda:hoja.masEnGlosario')}
              variant="ghost"
              size="md"
              style={styles.mas}
              onPress={() => setCompleto(true)}
            />
          ) : null}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  definicion: {
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    color: ink.ink9,
    minWidth: 0,
  },
  mas: { alignSelf: 'flex-start', marginTop: space.s2 },
});
