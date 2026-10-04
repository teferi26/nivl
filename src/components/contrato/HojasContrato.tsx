// NIVL · Contrato: las dos hojas (FASE3 G1). Puras: el estado del formulario
// y los cerrojos viven en useContrato.
//
//   · HojaNorma → Campo «La norma» y Campo «Consecuencia si la rompes», con
//     lo que cuesta romperla debajo. Pie: primary «Firmar la norma» + ghost.
//     En modo «editar» llega rellena con la norma y su pie es «Guardar
//     cambios»; la versión anterior se archiva con sus roturas (editarRegla).
//     Al editar, el botón solo se enciende con los dos campos escritos y algo
//     cambiado respecto a la norma de partida (`original`).
//   · HojaCarta → Campo de varias líneas para la carta y chips radio del
//     plazo (1, 3 o 5 años) con la fecha en que se abrirá. Pie: primary
//     «Sellar la carta» + ghost.
// Los fallos del servidor van en línea (ErrorSistema compacto): nada de
// avisos encima de una hoja abierta. Los chips ya vibran al elegir.

import { StyleSheet, Text, View } from 'react-native';
import { Campo, ErrorSistema } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { addDays, fechaConAnio } from '@/lib/dates';
import { RULE_BREAK_XP } from '@/lib/game';

export interface OpcionApertura {
  label: string;
  days: number;
}

export const OPCIONES_APERTURA: readonly OpcionApertura[] = [
  { label: '1 año', days: 365 },
  { label: '3 años', days: 365 * 3 },
  { label: '5 años', days: 365 * 5 },
];

export interface HojaNormaProps {
  visible: boolean;
  /** «nueva» firma una norma; «editar» cambia la que se ha abierto. */
  modo: 'nueva' | 'editar';
  /** En «editar», la norma de partida: sin cambios, no hay nada que guardar. */
  original?: { texto: string; consecuencia: string } | null;
  texto: string;
  consecuencia: string;
  guardando: boolean;
  /** Lo que ha contestado el sistema al firmar, ya escrito para el usuario. */
  error: string | null;
  onTexto: (v: string) => void;
  onConsecuencia: (v: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaNorma({
  visible,
  modo,
  original = null,
  texto,
  consecuencia,
  guardando,
  error,
  onTexto,
  onConsecuencia,
  onGuardar,
  onCerrar,
}: HojaNormaProps) {
  const editar = modo === 'editar';
  const rellena = !!texto.trim() && !!consecuencia.trim();
  const cambiada =
    !editar || !original || texto.trim() !== original.texto || consecuencia.trim() !== original.consecuencia;
  const lista = rellena && cambiada;
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow={editar ? 'Editar norma' : 'Nueva norma'}
      title={editar ? 'Ajusta lo que firmaste' : '¿Qué te prohíbes?'}
      footer={
        <>
          <Button
            title={editar ? 'Guardar cambios' : 'Firmar la norma'}
            onPress={onGuardar}
            loading={guardando}
            disabled={!lista}
          />
          <Button title="Cancelar" variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Campo
          etiqueta="La norma"
          value={texto}
          onChangeText={onTexto}
          placeholder="Ej. Nada de redes sociales antes de las 12"
          accessibilityLabel="Texto de la norma"
          autoFocus
        />
        <Campo
          etiqueta="Consecuencia si la rompes"
          value={consecuencia}
          onChangeText={onConsecuencia}
          placeholder="Ej. Correr 5 km"
          accessibilityLabel="Consecuencia de romper la norma"
          ayuda={
            editar
              ? `Rige desde hoy. La versión anterior se archiva con sus roturas. Romperla cuesta −${RULE_BREAK_XP} XP.`
              : `Romperla cuesta −${RULE_BREAK_XP} XP. Cumplir la consecuencia el mismo día lo recupera.`
          }
        />
        {error ? <ErrorSistema compacto mensaje={error} /> : null}
      </View>
    </Sheet>
  );
}

export interface HojaCartaProps {
  visible: boolean;
  hoy: string;
  cuerpo: string;
  opcion: OpcionApertura;
  sellando: boolean;
  error: string | null;
  onCuerpo: (v: string) => void;
  onOpcion: (o: OpcionApertura) => void;
  onSellar: () => void;
  onCerrar: () => void;
}

export function HojaCarta({
  visible,
  hoy,
  cuerpo,
  opcion,
  sellando,
  error,
  onCuerpo,
  onOpcion,
  onSellar,
  onCerrar,
}: HojaCartaProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow="Para tu yo del futuro"
      title="Escríbele a quien serás"
      footer={
        <>
          <Button title="Sellar la carta" onPress={onSellar} loading={sellando} disabled={!cuerpo.trim()} />
          <Button title="Cancelar" variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Campo
          etiqueta="La carta"
          value={cuerpo}
          onChangeText={onCuerpo}
          placeholder="No sé cómo estarás, ni en qué situación…"
          multiline
          accessibilityLabel="Cuerpo de la carta"
          style={styles.carta}
        />
        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            Se abrirá dentro de
          </Text>
          <ChipWrap>
            {OPCIONES_APERTURA.map((o) => (
              <Chip
                key={o.label}
                label={o.label}
                selected={opcion.label === o.label}
                onPress={() => onOpcion(o)}
                accessibilityLabel={`Abrir dentro de ${o.label}`}
              />
            ))}
          </ChipWrap>
          <Text style={styles.ayuda} maxFontSizeMultiplier={1.35}>
            Se abrirá el {fechaConAnio(addDays(hoy, opcion.days))}. Nadie podrá leerla antes, ni tú.
          </Text>
        </View>
        {error ? <ErrorSistema compacto mensaje={error} /> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s5 },
  grupo: { gap: space.s2 },
  etiqueta: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  ayuda: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
  },
  carta: { minHeight: 150, textAlignVertical: 'top' },
});
