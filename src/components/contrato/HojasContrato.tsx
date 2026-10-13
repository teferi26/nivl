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
import { t } from '@/i18n';
import { addDays, fechaConAnio } from '@/lib/dates';
import { RULE_BREAK_XP } from '@/lib/game';

export interface OpcionApertura {
  anios: number;
  days: number;
}

export const OPCIONES_APERTURA: readonly OpcionApertura[] = [
  { anios: 1, days: 365 },
  { anios: 3, days: 365 * 3 },
  { anios: 5, days: 365 * 5 },
];

/** «1 año», «3 años», «5 años». */
export function etiquetaApertura(o: OpcionApertura): string {
  return t('contrato:hojas.anios', { count: o.anios });
}

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
      eyebrow={editar ? t('contrato:hojas.norma.eyebrowEditar') : t('contrato:hojas.norma.eyebrowNueva')}
      title={editar ? t('contrato:hojas.norma.tituloEditar') : t('contrato:hojas.norma.tituloNueva')}
      footer={
        <>
          <Button
            title={editar ? t('comun:guardarCambios') : t('contrato:hojas.norma.firmar')}
            onPress={onGuardar}
            loading={guardando}
            disabled={!lista}
          />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Campo
          etiqueta={t('contrato:hojas.norma.etiqueta')}
          value={texto}
          onChangeText={onTexto}
          placeholder={t('contrato:hojas.norma.placeholder')}
          accessibilityLabel={t('contrato:hojas.norma.a11y')}
          autoFocus
        />
        <Campo
          etiqueta={t('contrato:hojas.norma.consecuenciaEtiqueta')}
          value={consecuencia}
          onChangeText={onConsecuencia}
          placeholder={t('contrato:hojas.norma.consecuenciaPlaceholder')}
          accessibilityLabel={t('contrato:hojas.norma.consecuenciaA11y')}
          ayuda={
            editar
              ? t('contrato:hojas.norma.ayudaEditar', { xp: RULE_BREAK_XP })
              : t('contrato:hojas.norma.ayudaNueva', { xp: RULE_BREAK_XP })
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
      eyebrow={t('contrato:hojas.carta.eyebrow')}
      title={t('contrato:hojas.carta.titulo')}
      footer={
        <>
          <Button title={t('contrato:hojas.carta.sellar')} onPress={onSellar} loading={sellando} disabled={!cuerpo.trim()} />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Campo
          etiqueta={t('contrato:hojas.carta.etiqueta')}
          value={cuerpo}
          onChangeText={onCuerpo}
          placeholder={t('contrato:hojas.carta.placeholder')}
          multiline
          accessibilityLabel={t('contrato:hojas.carta.a11y')}
          style={styles.carta}
        />
        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('contrato:hojas.carta.dentroDe')}
          </Text>
          <ChipWrap>
            {OPCIONES_APERTURA.map((o) => (
              <Chip
                key={o.days}
                label={etiquetaApertura(o)}
                selected={opcion.days === o.days}
                onPress={() => onOpcion(o)}
                accessibilityLabel={t('contrato:hojas.carta.dentroDeA11y', { plazo: etiquetaApertura(o) })}
              />
            ))}
          </ChipWrap>
          <Text style={styles.ayuda} maxFontSizeMultiplier={1.35}>
            {t('contrato:hojas.carta.seAbrira', { fecha: fechaConAnio(addDays(hoy, opcion.days)) })}
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
