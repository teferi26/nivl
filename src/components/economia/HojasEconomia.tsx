// NIVL · Economía: las dos hojas (FASE3 G2). Puras: el formulario y los
// cerrojos viven en useEconomia.
//
//   · HojaClasificar → «¿Qué fue esto?»: el movimiento con su importe con
//     signo y las categorías en chips; tocar una la aplica (y el sistema
//     aprende la regla). Pie: ghost «Cancelar».
//   · HojaEfectivo → «Lo que el banco no ve»: Campo «Importe» (negativo si es
//     gasto, positivo si es un cobro en mano), Campo «Concepto» y la categoría
//     en chips radio. Pie: primary «Registrar» + ghost «Cancelar».
// Los fallos van en línea: el importe y el concepto en su Campo y el del
// servidor en un ErrorSistema compacto. Nada de avisos encima de una hoja.

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Campo, ErrorSistema } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { CATEGORIAS, NOMBRE_CATEGORIA, type Categoria, type Transaction } from '@/lib/money';
import { eurSigno } from './formato';

export const CATEGORIAS_ELEGIBLES = CATEGORIAS.filter((c) => c !== 'sin_clasificar');

export interface HojaClasificarProps {
  /** El movimiento que se clasifica; null con la hoja cerrada. */
  movimiento: Transaction | null;
  error: string | null;
  onElegir: (c: Categoria) => void;
  onCerrar: () => void;
}

export function HojaClasificar({ movimiento, error, onElegir, onCerrar }: HojaClasificarProps) {
  // Mientras la hoja se va, sigue enseñando el último movimiento.
  const [ultimo, setUltimo] = useState<Transaction | null>(movimiento);
  if (movimiento && movimiento !== ultimo) setUltimo(movimiento);
  const m = movimiento ?? ultimo;
  return (
    <Sheet
      visible={movimiento !== null}
      onClose={onCerrar}
      eyebrow="Clasificar"
      title="¿Qué fue esto?"
      footer={<Button title="Cancelar" variant="ghost" onPress={onCerrar} />}
    >
      <View style={styles.pila}>
        {m ? (
          <View style={styles.movimiento}>
            <Text style={styles.concepto} numberOfLines={2} maxFontSizeMultiplier={1.35}>
              {m.description}
            </Text>
            <Text style={styles.importe} maxFontSizeMultiplier={1.2}>
              {eurSigno(m.amount).replace(/ €$/, '')}
              <Text style={styles.unidad}> €</Text>
            </Text>
          </View>
        ) : null}
        <ChipWrap>
          {CATEGORIAS_ELEGIBLES.map((c) => (
            <Chip
              key={c}
              label={NOMBRE_CATEGORIA[c] ?? c}
              onPress={() => onElegir(c)}
              accessibilityLabel={`Clasificar como ${NOMBRE_CATEGORIA[c] ?? c}`}
            />
          ))}
        </ChipWrap>
        {error ? <ErrorSistema compacto mensaje={error} /> : null}
      </View>
    </Sheet>
  );
}

export interface HojaEfectivoProps {
  visible: boolean;
  importe: string;
  concepto: string;
  categoria: Categoria;
  guardando: boolean;
  /** «Escribe el importe…» si no es un número distinto de cero. */
  errorImporte: string | null;
  /** «Dentro de un mes no vas a recordar qué fue.» si falta. */
  errorConcepto: string | null;
  /** Lo que ha contestado el sistema al guardar, ya escrito para el usuario. */
  error: string | null;
  onImporte: (v: string) => void;
  onConcepto: (v: string) => void;
  onCategoria: (c: Categoria) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaEfectivo({
  visible,
  importe,
  concepto,
  categoria,
  guardando,
  errorImporte,
  errorConcepto,
  error,
  onImporte,
  onConcepto,
  onCategoria,
  onGuardar,
  onCerrar,
}: HojaEfectivoProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow="En efectivo"
      title="Lo que el banco no ve"
      footer={
        <>
          <Button title="Registrar" onPress={onGuardar} loading={guardando} />
          <Button title="Cancelar" variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Text style={styles.sub} maxFontSizeMultiplier={1.35}>
          Negativo si es gasto, positivo si es un cobro en mano.
        </Text>
        <Campo
          etiqueta="Importe"
          value={importe}
          onChangeText={onImporte}
          placeholder="-25,00"
          keyboardType="numbers-and-punctuation"
          accessibilityLabel="Importe en euros"
          error={errorImporte}
          autoFocus
        />
        <Campo
          etiqueta="Concepto"
          value={concepto}
          onChangeText={onConcepto}
          placeholder="Qué fue"
          accessibilityLabel="Concepto"
          error={errorConcepto}
        />
        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            Categoría
          </Text>
          <ChipWrap>
            {CATEGORIAS_ELEGIBLES.map((c) => (
              <Chip
                key={c}
                label={NOMBRE_CATEGORIA[c] ?? c}
                selected={categoria === c}
                onPress={() => onCategoria(c)}
                accessibilityLabel={`Categoría ${NOMBRE_CATEGORIA[c] ?? c}`}
              />
            ))}
          </ChipWrap>
        </View>
        {error ? <ErrorSistema compacto mensaje={error} /> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s5 },
  movimiento: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.s3 },
  concepto: {
    flex: 1,
    minWidth: 0,
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    color: ink.ink9,
  },
  importe: { fontFamily: 'Cinzel_600SemiBold', fontSize: 18, lineHeight: 22, color: ink.ink10 },
  unidad: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, letterSpacing: tipo.micro.tracking, color: ink.ink6 },
  sub: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  grupo: { gap: space.s2 },
  etiqueta: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
});
