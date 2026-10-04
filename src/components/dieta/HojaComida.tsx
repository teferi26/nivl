// NIVL · Dieta: la hoja de una comida (FASE3 Oleada 2, lote E2). Pura: el
// formulario y los cerrojos viven en useDieta.
//
// Sheet (sin KAV propio: el teclado lo lleva la hoja) con Campo «Comida» y
// Campo «Ingredientes». Los fallos van en línea con ErrorSistema compacto,
// nunca en un aviso encima de la hoja abierta. Pie: primary «Guardar», danger
// «Quitar comida» si ya existe (con confirmar y vibración `destructiva`, en
// useDieta) y ghost «Cancelar».

import { StyleSheet, View } from 'react-native';
import { Campo, ErrorSistema } from '@/components/arena';
import { Button, Sheet } from '@/components/ui';
import { space } from '@/design/tokens';
import type { MealSlotName } from '@/lib/types';
import { DIAS, NOMBRE_COMIDA } from './DietaVista';

export interface HojaComidaProps {
  visible: boolean;
  /** Se queda puesto al cerrar: el título no se vacía durante la salida. */
  slot: MealSlotName | null;
  /** Ya había comida en ese hueco (se puede quitar). */
  existe: boolean;
  /** 1 (lunes) a 7. */
  dia: number;
  descripcion: string;
  ingredientes: string;
  guardando: boolean;
  quitando: boolean;
  /** Lo que ha contestado el sistema, ya escrito para el usuario. */
  error: string | null;
  onDescripcion: (v: string) => void;
  onIngredientes: (v: string) => void;
  onGuardar: () => void;
  onQuitar: () => void;
  onCerrar: () => void;
}

export function HojaComida({
  visible,
  slot,
  existe,
  dia,
  descripcion,
  ingredientes,
  guardando,
  quitando,
  error,
  onDescripcion,
  onIngredientes,
  onGuardar,
  onQuitar,
  onCerrar,
}: HojaComidaProps) {
  const nombre = slot ? NOMBRE_COMIDA[slot] : '';
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow={`${nombre} · ${DIAS[dia - 1] ?? ''}`}
      title={existe ? 'Ajusta la comida' : '¿Qué vas a comer?'}
      footer={
        <>
          <Button title="Guardar" onPress={onGuardar} loading={guardando} disabled={!descripcion.trim() || quitando} />
          {existe ? (
            <Button
              title="Quitar comida"
              variant="danger"
              icon="trash-outline"
              onPress={onQuitar}
              loading={quitando}
              disabled={guardando}
            />
          ) : null}
          <Button title="Cancelar" variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Campo
          etiqueta="Comida"
          value={descripcion}
          onChangeText={onDescripcion}
          placeholder="Pollo con arroz y brócoli"
          accessibilityLabel="Descripción de la comida"
        />
        <Campo
          etiqueta="Ingredientes"
          value={ingredientes}
          onChangeText={onIngredientes}
          placeholder="pollo, arroz, brócoli, aceite de oliva"
          multiline
          ayuda="Separados por comas: de aquí sale la lista de la compra."
          accessibilityLabel="Ingredientes separados por comas"
          style={styles.multilinea}
        />
        {error ? <ErrorSistema compacto mensaje={error} /> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s5 },
  multilinea: { minHeight: 72, textAlignVertical: 'top' },
});
