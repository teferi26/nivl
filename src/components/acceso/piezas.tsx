// NIVL · Acceso: las piezas que comparten entrar y restablecer.
//
//   · CampoContrasena → Campo con el ojo de 44 anclado abajo, sobre la caja.
//     No lleva ayuda ni error propios (la fuerza y las faltas van fuera), así
//     el ojo no depende del alto de la etiqueta con letra grande.
//   · FuerzaContrasena → Barra de 4 segmentos, el nombre de la fuerza y lo
//     que falta en micro. Las reglas son las de validation.ts.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View, type TextInputProps } from 'react-native';
import { Barra, Campo } from '@/components/arena';
import { ink, space, type as tipo } from '@/design/tokens';

const OJO = 44;

type CampoContrasenaProps = {
  etiqueta: string;
  ver: boolean;
  onVer: () => void;
} & Omit<TextInputProps, 'secureTextEntry'>;

export function CampoContrasena({ etiqueta, ver, onVer, ...rest }: CampoContrasenaProps) {
  return (
    <View>
      <Campo etiqueta={etiqueta} secureTextEntry={!ver} autoCapitalize="none" style={styles.conOjo} {...rest} />
      <Pressable
        onPress={onVer}
        style={styles.ojo}
        accessibilityRole="button"
        accessibilityLabel={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        <Ionicons name={ver ? 'eye-off-outline' : 'eye-outline'} size={20} color={ink.ink8} />
      </Pressable>
    </View>
  );
}

export function FuerzaContrasena({
  fuerza,
  faltas,
}: {
  fuerza: { segmentos: number; etiqueta: string } | null;
  faltas: string[];
}) {
  if (!fuerza && faltas.length === 0) return null;
  return (
    <View style={styles.fuerza}>
      {fuerza ? (
        <View style={styles.fila}>
          <View style={styles.barra}>
            <Barra
              ratio={fuerza.segmentos / 4}
              alto={4}
              segmentos={4}
              etiqueta={`Fuerza de la contraseña: ${fuerza.etiqueta}`}
            />
          </View>
          <Text style={styles.nombre} maxFontSizeMultiplier={1.35}>
            {fuerza.etiqueta.toUpperCase()}
          </Text>
        </View>
      ) : null}
      {faltas.length > 0 ? (
        <Text style={styles.faltas} maxFontSizeMultiplier={1.6}>
          Le falta: {faltas.join(', ')}.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  conOjo: { paddingRight: OJO + space.s1 },
  ojo: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: OJO,
    height: OJO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fuerza: { gap: space.s2, marginTop: -space.s2 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  barra: { flex: 1 },
  nombre: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink9,
  },
  faltas: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    color: ink.ink6,
  },
});
