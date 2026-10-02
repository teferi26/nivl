// NIVL · Fotos de progreso: antes y después (L5 · A).
//
// Pose y plazo (30 · 90 · 180 días) con chips; el par lo elige
// `parAntesDespues` del Chat 5 (la foto más reciente de la pose y la más
// cercana al plazo, nunca del mismo día). Dos fotos lado a lado y los días
// entre ellas en Cinzel.
//
// Privacidad: el peso va apagado y no se recuerda (estado local que muere con
// la pantalla). «Compartir» solo existe con `puedeCompartir` (18+, salud y no
// web) y, aun así, la hoja de compartir abre con fotos y peso apagados. Las
// copias temporales para la tarjeta se borran al desmontar.

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Chip, ChipWrap } from '@/components/ui';
import { Interruptor } from '@/components/ui/Interruptor';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { parAntesDespues, POSES, type FotoProgreso, type ParAntesDespues, type PesoDia, type Pose } from '@/lib/progressPhotos';
import { borrarTemporales, TEMP_ANTES, TEMP_DESPUES } from './datos';
import { Miniatura } from './LineaFotos';
import { fechaCorta, NOMBRE_POSE, textoDifKg, textoDias, textoKg } from './modelo';

export const PLAZOS = [30, 90, 180] as const;
export type Plazo = (typeof PLAZOS)[number];

export interface CompararFotosProps {
  fotos: readonly FotoProgreso[];
  pesos: readonly PesoDia[];
  hoy: string;
  urls: Record<string, string>;
  puedeCompartir: boolean;
  compartiendo: boolean;
  onCompartir: (par: ParAntesDespues, conPeso: boolean) => void;
  /** Pide firma para las fotos del par que aún no la tienen. */
  onPedirFirmas: (ids: string[]) => void;
  onFallo: (id: string) => void;
  /** Estado inicial (la galería). Por defecto frente, 90 días y peso apagado. */
  inicial?: { pose?: Pose; plazo?: Plazo; mostrarPeso?: boolean };
}

export function CompararFotos({
  fotos,
  pesos,
  hoy,
  urls,
  puedeCompartir,
  compartiendo,
  onCompartir,
  onPedirFirmas,
  onFallo,
  inicial,
}: CompararFotosProps) {
  const [pose, setPose] = useState<Pose>(inicial?.pose ?? 'frente');
  const [plazo, setPlazo] = useState<Plazo>(inicial?.plazo ?? 90);
  const [mostrarPeso, setMostrarPeso] = useState(inicial?.mostrarPeso ?? false);

  const par = useMemo(() => parAntesDespues(fotos, pose, { hoy, dias: plazo, pesos }), [fotos, pose, hoy, plazo, pesos]);

  const idAntes = par?.antes.id;
  const idDespues = par?.despues.id;
  const faltaAntes = !!idAntes && !urls[idAntes];
  const faltaDespues = !!idDespues && !urls[idDespues];
  useEffect(() => {
    const ids = [faltaAntes ? idAntes : null, faltaDespues ? idDespues : null].filter((x): x is string => !!x);
    if (ids.length > 0) onPedirFirmas(ids);
  }, [idAntes, idDespues, faltaAntes, faltaDespues, onPedirFirmas]);

  // Las copias que se bajaron para la tarjeta no sobreviven a la pantalla.
  useEffect(() => () => borrarTemporales([TEMP_ANTES, TEMP_DESPUES]), []);

  const hayPeso = !!par && (par.antes.pesoKg !== null || par.despues.pesoKg !== null);

  return (
    <View style={styles.wrap}>
      <ChipWrap>
        {POSES.map((p) => (
          <Chip key={p} small label={NOMBRE_POSE[p]} selected={p === pose} onPress={() => setPose(p)} />
        ))}
      </ChipWrap>
      <ChipWrap>
        {PLAZOS.map((d) => (
          <Chip
            key={d}
            small
            label={`${d} días`}
            selected={d === plazo}
            onPress={() => setPlazo(d)}
            accessibilityLabel={`Comparar con hace unos ${d} días`}
          />
        ))}
      </ChipWrap>

      {!par ? (
        <Text style={styles.vacio} maxFontSizeMultiplier={1.35}>
          Hacen falta dos fotos de {NOMBRE_POSE[pose].toLowerCase()} en días distintos para comparar.
        </Text>
      ) : (
        <>
          <View style={styles.par}>
            {(['antes', 'despues'] as const).map((k) => {
              const f = par[k];
              return (
                <View key={k} style={styles.columna}>
                  <Miniatura url={urls[f.id]} pose={f.pose} fecha={f.fecha} hoy={hoy} grande onFallo={() => onFallo(f.id)} />
                  <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
                    {k === 'antes' ? 'ANTES' : 'DESPUÉS'} · {fechaCorta(f.fecha, hoy)}
                  </Text>
                  {mostrarPeso ? (
                    <Text style={styles.peso} maxFontSizeMultiplier={1.35}>
                      {textoKg(f.pesoKg)}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={styles.dias} accessible accessibilityLabel={`${textoDias(par.dias)} entre las dos fotos`}>
            <Text style={styles.cifra} maxFontSizeMultiplier={1}>
              {par.dias}
            </Text>
            <Text style={styles.diasTexto} maxFontSizeMultiplier={1.35}>
              {par.dias === 1 ? 'DÍA ENTRE ELLAS' : 'DÍAS ENTRE ELLAS'}
            </Text>
            {mostrarPeso && par.difPesoKg !== null ? (
              <Text style={styles.dif} maxFontSizeMultiplier={1.35}>
                {textoDifKg(par.difPesoKg)}
              </Text>
            ) : null}
          </View>

          {hayPeso ? (
            <View style={styles.interruptor}>
              <Text style={styles.interruptorTexto} maxFontSizeMultiplier={1.35}>
                Mostrar el peso
              </Text>
              <Interruptor value={mostrarPeso} onValueChange={setMostrarPeso} accessibilityLabel="Mostrar el peso" />
            </View>
          ) : null}

          {puedeCompartir ? (
            <Button
              title="Compartir"
              icon="share-outline"
              variant="secondary"
              onPress={() => onCompartir(par, mostrarPeso)}
              loading={compartiendo}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s3 },
  vacio: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8 },
  par: { flexDirection: 'row', gap: space.s3, marginTop: space.s1 },
  columna: { flex: 1, minWidth: 0, gap: space.s2 },
  rotulo: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink8,
  },
  peso: { fontFamily: tipo.number.family, fontSize: 16, lineHeight: 20, color: ink.ink9 },
  dias: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.s2,
    paddingVertical: space.s2,
    borderTopWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: ink.ink3,
  },
  cifra: { fontFamily: tipo.cifra.family, fontSize: tipo.cifra.size, lineHeight: tipo.cifra.lineHeight, color: ink.ink10 },
  diasTexto: {
    flex: 1,
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
  },
  dif: { fontFamily: tipo.number.family, fontSize: 16, lineHeight: 20, color: ink.ink9 },
  interruptor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  interruptorTexto: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, color: ink.ink9 },
});
