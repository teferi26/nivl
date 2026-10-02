// NIVL · Arena: el encabezado grabado (SISTEMA.md §5 bis, excepción 1).
//
// El título de la pantalla en Cinzel mayúscula (`type.rank`, ink10), como una
// inscripción sobre la puerta. Encima un eyebrow, debajo una línea de
// contexto, a la derecha una acción de 44 o lo que haga falta, y si se pide,
// el meandro como cierre (uno por pantalla).

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { Meandro } from './Motivos';

export interface AccionArena {
  icono: keyof typeof Ionicons.glyphMap;
  etiqueta: string;
  onPress: () => void;
  /** Botón invertido: cuenta como LA inversión de la pantalla. */
  solida?: boolean;
}

export interface EncabezadoArenaProps {
  eyebrow?: string;
  /** Se pinta en mayúsculas. */
  titulo: string;
  subtitulo?: string;
  onVolver?: () => void;
  accion?: AccionArena;
  derecha?: ReactNode;
  meandro?: boolean;
}

export const TAM_BOTON = 44;

export function EncabezadoArena({ eyebrow, titulo, subtitulo, onVolver, accion, derecha, meandro }: EncabezadoArenaProps) {
  return (
    <View style={styles.wrap}>
      {onVolver ? (
        <Pressable
          onPress={onVolver}
          style={({ pressed }) => [styles.volver, pressed && styles.pulsado]}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={20} color={ink.ink9} />
        </Pressable>
      ) : null}
      <View style={styles.fila}>
        <View style={styles.textos}>
          {eyebrow ? (
            <Text style={styles.eyebrow} maxFontSizeMultiplier={1.35} numberOfLines={1}>
              {eyebrow}
            </Text>
          ) : null}
          <Text
            style={styles.titulo}
            accessibilityRole="header"
            maxFontSizeMultiplier={1.35}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {titulo.toUpperCase()}
          </Text>
          {subtitulo ? (
            <Text style={styles.subtitulo} maxFontSizeMultiplier={1.35}>
              {subtitulo}
            </Text>
          ) : null}
        </View>
        {derecha ? <View style={styles.derecha}>{derecha}</View> : null}
        {accion ? <BotonArena {...accion} /> : null}
      </View>
      {meandro ? <Meandro alto={8} style={styles.meandro} /> : null}
    </View>
  );
}

/** Botón cuadrado de 44: contorno ink4 o, con `solida`, invertido. */
export function BotonArena({ icono, etiqueta, onPress, solida }: AccionArena) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.boton, solida && styles.botonSolido, pressed && styles.pulsado]}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
    >
      <Ionicons name={icono} size={20} color={solida ? ink.ink0 : ink.ink9} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.s6 },
  volver: {
    width: TAM_BOTON,
    height: TAM_BOTON,
    marginLeft: -space.s3,
    marginBottom: space.s1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fila: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s3 },
  textos: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
    marginBottom: space.s2,
  },
  titulo: {
    fontFamily: tipo.rank.family,
    fontSize: tipo.rank.size,
    lineHeight: tipo.rank.lineHeight,
    letterSpacing: tipo.rank.tracking,
    color: ink.ink10,
  },
  subtitulo: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s2,
  },
  derecha: { alignItems: 'flex-end' },
  boton: {
    width: TAM_BOTON,
    height: TAM_BOTON,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonSolido: { backgroundColor: ink.ink10, borderColor: ink.ink10 },
  pulsado: { opacity: 0.7 },
  meandro: { marginTop: space.s4 },
});
