// NIVL · IRON · La técnica de un ejercicio (/iron/[id], se abre desde
// Gimnasio con «Ver técnica»). Pura: el ejercicio y volver llegan por props.
//
// De arriba abajo: el encabezado grabado (nombre, grupo · nivel · material),
// la demostración animada en bucle con «Pausar» (quieta con «reducir
// movimiento», lo hace el Maniquí), la ficha de músculos con el mapa y las
// consignas, y los errores comunes. Sin inversión: aquí no hay acción
// principal, se mira.

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EncabezadoArena, Entrada, TarjetaArena } from '@/components/arena';
import { DescargoSalud } from '@/components/DescargoSalud';
import { Button, Screen } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { useAnchoUtil } from '@/design/useSizeClass';
import { t } from '@/i18n';
import type { Ejercicio } from '@/iron/tipos';
import { FichaIron } from './FichaIron';
import { Maniqui } from './Maniqui';
import { nombreIron, textoIron } from './texto';

/** La demostración no pasa de aquí de ancho (iPad). */
const ANCHO_MAX = 560;

export function TecnicaIron({ ejercicio: ej, onVolver }: { ejercicio: Ejercicio; onVolver: () => void }) {
  const [pausado, setPausado] = useState(false);
  const ancho = Math.min(useAnchoUtil(), ANCHO_MAX);
  const nombre = textoIron(ej.nombre);
  const meta = [nombreIron('grupo', ej.grupo), t(`iron:nivel.${ej.nivel}`), ...ej.material.map((m) => nombreIron('material', m))].join(' · ');

  return (
    <Screen contentStyle={styles.contenido}>
      <Entrada indice={0}>
        <EncabezadoArena eyebrow={t('iron:tecnica.eyebrow')} titulo={nombre} subtitulo={meta} onVolver={onVolver} meandro />
      </Entrada>

      <Entrada indice={1}>
        <TarjetaArena variante="contorno" rotulo={t('iron:tecnica.demostracion')}>
          <View style={styles.escenario}>
            <Maniqui ejercicio={ej} ancho={ancho - 2 * space.s4} pausado={pausado} accessibilityLabel={t('iron:demo.animacion', { nombre })} />
          </View>
          <Button
            title={pausado ? t('iron:demo.seguir') : t('iron:demo.pausar')}
            icon={pausado ? 'play-outline' : 'pause-outline'}
            variant="ghost"
            size="sm"
            onPress={() => setPausado((p) => !p)}
            style={styles.boton}
          />
        </TarjetaArena>
      </Entrada>

      <Entrada indice={2}>
        <TarjetaArena rotulo={t('iron:demo.musculos')}>
          <FichaIron ejercicio={ej} ancho={ancho - 2 * space.s4} incrustada />
        </TarjetaArena>
      </Entrada>

      {ej.errores.length > 0 ? (
        <Entrada indice={3}>
          <TarjetaArena rotulo={t('iron:demo.errores')}>
            {ej.errores.map((c) => (
              <Text key={c} style={styles.texto} maxFontSizeMultiplier={1.35}>
                {`· ${textoIron(c)}`}
              </Text>
            ))}
          </TarjetaArena>
        </Entrada>
      ) : null}

      <DescargoSalud />
    </Screen>
  );
}

const styles = StyleSheet.create({
  contenido: { maxWidth: ANCHO_MAX + 2 * space.s8, gap: space.s5 },
  escenario: {
    alignItems: 'center',
    marginVertical: space.s3,
    backgroundColor: ink.ink0,
  },
  boton: { alignSelf: 'flex-start' },
  texto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
});
