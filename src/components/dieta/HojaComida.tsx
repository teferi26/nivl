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
import { t } from '@/i18n';
import type { MealSlotName } from '@/lib/types';
import { nombreComida, nombreDiaDieta } from './DietaVista';

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
  const nombre = slot ? nombreComida(slot) : '';
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow={t('dieta:hoja.eyebrow', { comida: nombre, dia: nombreDiaDieta(dia) })}
      title={existe ? t('dieta:hoja.tituloAjustar') : t('dieta:hoja.tituloNueva')}
      footer={
        <>
          <Button title={t('comun:guardar')} onPress={onGuardar} loading={guardando} disabled={!descripcion.trim() || quitando} />
          {existe ? (
            <Button
              title={t('dieta:hoja.quitarComida')}
              variant="danger"
              icon="trash-outline"
              onPress={onQuitar}
              loading={quitando}
              disabled={guardando}
            />
          ) : null}
          <Button title={t('comun:cancelar')} variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Campo
          etiqueta={t('dieta:hoja.comida')}
          value={descripcion}
          onChangeText={onDescripcion}
          placeholder={t('dieta:hoja.comidaPlaceholder')}
          accessibilityLabel={t('dieta:hoja.comidaA11y')}
        />
        <Campo
          etiqueta={t('dieta:hoja.ingredientes')}
          value={ingredientes}
          onChangeText={onIngredientes}
          placeholder={t('dieta:hoja.ingredientesPlaceholder')}
          multiline
          ayuda={t('dieta:hoja.ingredientesAyuda')}
          accessibilityLabel={t('dieta:hoja.ingredientesA11y')}
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
