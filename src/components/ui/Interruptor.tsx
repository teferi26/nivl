// NIVL · Interruptor B/N. Encendido y apagado se distinguen por la forma y
// el peso, no por el color: pista blanca con pomo negro frente a pista hierro
// con pomo gris (SISTEMA §5). Cada cambio vibra `seleccion` (FASE3).

import { Switch } from 'react-native';
import { vibrar } from '@/design/haptics';
import { ink } from '@/design/tokens';

interface Props {
  value: boolean;
  onValueChange: (v: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

export function Interruptor({ value, onValueChange, accessibilityLabel, disabled }: Props) {
  return (
    <Switch
      value={value}
      onValueChange={(v) => {
        vibrar('seleccion');
        onValueChange(v);
      }}
      disabled={disabled}
      trackColor={{ false: ink.ink4, true: ink.ink10 }}
      thumbColor={value ? ink.ink0 : ink.ink8}
      ios_backgroundColor={ink.ink4}
      // Solo web (react-native-web): sin esto el pomo encendido sale del color del sistema.
      {...({ activeThumbColor: ink.ink0 } as object)}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
    />
  );
}
