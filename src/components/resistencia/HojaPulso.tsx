// NIVL · Resistencia: la hoja del pulso máximo. Con este dato salen las zonas. Pura.

import { Campo, ErrorSistema } from '@/components/arena';
import { Button, Sheet } from '@/components/ui';
import { t } from '@/i18n';

export interface HojaPulsoProps {
  visible: boolean;
  valor: string;
  guardando: boolean;
  error: string | null;
  servidor: string | null;
  onCambio: (v: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaPulso(p: HojaPulsoProps) {
  return (
    <Sheet
      visible={p.visible}
      onClose={p.onCerrar}
      eyebrow={t('resistencia:pulso.eyebrow')}
      title={t('resistencia:pulso.titulo')}
      footer={
        <>
          <Button title={t('comun:guardar')} onPress={p.onGuardar} loading={p.guardando} />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={p.onCerrar} />
        </>
      }
    >
      <Campo
        etiqueta={t('resistencia:pulso.campo')}
        value={p.valor}
        onChangeText={p.onCambio}
        keyboardType="number-pad"
        error={p.error}
        ayuda={t('resistencia:pulso.ayuda')}
      />
      {p.servidor ? <ErrorSistema compacto mensaje={p.servidor} /> : null}
    </Sheet>
  );
}
