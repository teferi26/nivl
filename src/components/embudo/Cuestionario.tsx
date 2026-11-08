// NIVL · El cuestionario de entrada (Ónix): una pregunta por pantalla, la barra
// «Tu perfil», «Voy a ser crudo contigo» y la curva del 1 %. Se usa antes de
// tener cuenta (/empezar) y dentro del onboarding si este teléfono no lo tiene.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { Barra } from '@/components/arena';
import { Button } from '@/components/ui';
import { vibrar } from '@/design/haptics';
import { ink, oro, radio, space, type as tipo, vidrio } from '@/design/tokens';
import { t } from '@/i18n';
import {
  elegir,
  GUION,
  MULTIPLE,
  opcionesDe,
  porcentajeGuion,
  respondida,
  RESPUESTAS_VACIAS,
  textoOpcion,
  tx,
  type IdPregunta,
  type Respuestas,
  type Tono,
} from '@/lib/embudo';

interface Props {
  inicial?: Respuestas | null;
  onTerminar: (r: Respuestas) => void;
  /** Volver atrás desde la primera pregunta. */
  onSalir?: () => void;
}

export function Cuestionario({ inicial, onTerminar, onSalir }: Props) {
  const [indice, setIndice] = useState(0);
  const [r, setR] = useState<Respuestas>(inicial ?? RESPUESTAS_VACIAS);
  const paso = GUION[indice]!;
  const pct = porcentajeGuion(indice);

  const avanzar = (actual: Respuestas) => {
    if (indice >= GUION.length - 1) onTerminar(actual);
    else setIndice(indice + 1);
  };
  const volver = () => {
    if (indice === 0) onSalir?.();
    else setIndice(indice - 1);
  };
  const tocar = (id: IdPregunta, clave: string) => {
    vibrar('seleccion');
    const nuevo = elegir(id, clave, r);
    setR(nuevo);
    if (!MULTIPLE.has(id)) avanzar(nuevo);
  };
  const elegirTono = (tono: Tono) => {
    const nuevo = { ...r, tono };
    setR(nuevo);
    avanzar(nuevo);
  };

  return (
    <View style={styles.raiz}>
      <View style={styles.cabecera}>
        <View style={styles.filaVolver}>
          {indice > 0 || onSalir ? (
            <Pressable onPress={volver} hitSlop={12} style={styles.volver} accessibilityRole="button" accessibilityLabel={t('onboarding:volverA11y')}>
              <Ionicons name="arrow-back" size={20} color={ink.ink9} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.filaPerfil}>
          <Text style={styles.rotulo}>{t('onboarding:embudo.tuPerfil')}</Text>
          <Text style={styles.pct}>{pct} %</Text>
        </View>
        <Barra ratio={pct / 100} alto={8} etiqueta={t('onboarding:embudo.tuPerfilA11y', { pct })} />
      </View>
      {paso === 'crudo' ? (
        <Crudo onTono={elegirTono} />
      ) : paso === 'curva' ? (
        <Curva onSeguir={() => onTerminar(r)} />
      ) : (
        <Pregunta id={paso} r={r} onTocar={tocar} onContinuar={() => avanzar(r)} />
      )}
    </View>
  );
}

function Pregunta({ id, r, onTocar, onContinuar }: { id: IdPregunta; r: Respuestas; onTocar: (id: IdPregunta, c: string) => void; onContinuar: () => void }) {
  const opciones = opcionesDe(id, r.kind);
  const multiple = MULTIPLE.has(id);
  const elegidas = r[id];
  return (
    <View style={styles.cuerpo}>
      <ScrollView contentContainerStyle={styles.lista} showsVerticalScrollIndicator={false}>
        <Text style={styles.titulo} accessibilityRole="header">{tx(`onboarding:embudo.preguntas.${id}.t`)}</Text>
        <Text style={styles.pista}>{tx(`onboarding:embudo.preguntas.${id}.p`)}</Text>
        <View style={styles.opciones} accessibilityRole={multiple ? undefined : 'radiogroup'}>
          {opciones.map((c) => {
            const on = Array.isArray(elegidas) ? elegidas.includes(c) : elegidas === c;
            const texto = textoOpcion(id, c, r.kind);
            return (
              <Pressable
                key={c}
                onPress={() => onTocar(id, c)}
                accessibilityRole={multiple ? 'checkbox' : 'radio'}
                accessibilityState={multiple ? { checked: on } : { selected: on }}
                accessibilityLabel={texto}
                style={[styles.opcion, on && styles.opcionOn]}
              >
                <View style={[styles.marca, on && styles.marcaOn]}>
                  {on ? <Ionicons name="checkmark" size={16} color={ink.ink0} /> : null}
                </View>
                <Text style={styles.opcionTexto}>{texto}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {multiple ? <Button title={t('onboarding:continuar')} size="lg" onPress={onContinuar} disabled={!respondida(id, r)} /> : null}
    </View>
  );
}

function Crudo({ onTono }: { onTono: (t: Tono) => void }) {
  return (
    <View style={styles.cuerpo}>
      <ScrollView contentContainerStyle={styles.lista} showsVerticalScrollIndicator={false}>
        <Text style={styles.rotulo}>{t('onboarding:embudo.crudo.rotulo')}</Text>
        <Text style={styles.crudoTitulo} accessibilityRole="header">{t('onboarding:embudo.crudo.titulo')}</Text>
        <Text style={styles.grande}>{t('onboarding:embudo.crudo.cuerpo')}</Text>
        <Text style={styles.pista}>{t('onboarding:embudo.crudo.detalle')}</Text>
      </ScrollView>
      <View style={styles.botones}>
        <Text style={styles.rotulo}>{t('onboarding:embudo.crudo.pregunta')}</Text>
        <Button title={t('onboarding:embudo.crudo.duro')} size="lg" onPress={() => onTono('duro')} />
        <Button title={t('onboarding:embudo.crudo.tacto')} size="lg" variant="secondary" onPress={() => onTono('tacto')} />
      </View>
    </View>
  );
}

function Curva({ onSeguir }: { onSeguir: () => void }) {
  const { trazo, area } = useMemo(() => {
    const puntos: string[] = [];
    for (let x = 0; x <= 90; x += 5) {
      const y = 165 - ((Math.pow(1.01, x) - 1) / 1.449) * 149;
      puntos.push(`${(6 + (x / 90) * 294).toFixed(0)} ${y.toFixed(0)}`);
    }
    const linea = `M${puntos.join(' L')}`;
    return { trazo: linea, area: `${linea} L300 170 L6 170 Z` };
  }, []);
  return (
    <View style={styles.cuerpo}>
      <ScrollView contentContainerStyle={styles.lista} showsVerticalScrollIndicator={false}>
        <Text style={styles.titulo} accessibilityRole="header">{t('onboarding:embudo.curva.titulo')}</Text>
        <View style={styles.tarjeta} accessible accessibilityRole="image" accessibilityLabel={t('onboarding:embudo.curva.a11y')}>
          <Svg width="100%" height={190} viewBox="0 0 310 190">
            <Path d={area} fill={oro.hilo} opacity={0.22} />
            <Path d={trazo} fill="none" stroke={oro.claro} strokeWidth={4} strokeLinecap="round" />
            <Circle cx={103} cy={143} r={6} fill={oro.claro} />
            <Circle cx={300} cy={16} r={8} fill={oro.claro} />
            <SvgText x={103} y={125} textAnchor="middle" fontSize={17} fontWeight="700" fill={ink.ink9} fontFamily="Outfit_700Bold">+35 %</SvgText>
            <SvgText x={248} y={24} textAnchor="middle" fontSize={22} fontWeight="700" fill={ink.ink9} fontFamily="Outfit_700Bold">+145 %</SvgText>
            <SvgText x={4} y={186} fontSize={12} fill={ink.ink8} fontFamily="Outfit_500Medium">{t('onboarding:embudo.curva.hoy')}</SvgText>
            <SvgText x={90} y={186} fontSize={12} fill={ink.ink8} fontFamily="Outfit_500Medium">{t('onboarding:embudo.curva.dia30')}</SvgText>
            <SvgText x={262} y={186} fontSize={12} fill={ink.ink8} fontFamily="Outfit_500Medium">{t('onboarding:embudo.curva.dia90')}</SvgText>
          </Svg>
        </View>
        <Text style={styles.grande}>{t('onboarding:embudo.curva.cuerpo')}</Text>
      </ScrollView>
      <Button title={t('onboarding:embudo.curva.seguir')} size="lg" onPress={onSeguir} />
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  cabecera: { paddingHorizontal: space.s6, paddingTop: space.s2, paddingBottom: space.s2, gap: space.s2 },
  filaVolver: { height: 44, justifyContent: 'center' },
  volver: { alignSelf: 'flex-start', width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' },
  filaPerfil: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rotulo: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink8,
  },
  pct: { fontFamily: tipo.number.family, fontSize: 20, lineHeight: 26, color: oro.claro },
  cuerpo: { flex: 1, minHeight: 0, paddingHorizontal: space.s6, paddingBottom: space.s6, gap: space.s3 },
  lista: { paddingTop: space.s4, paddingBottom: space.s3, gap: space.s3 },
  titulo: { fontFamily: tipo.title.family, fontSize: tipo.title.size, lineHeight: tipo.title.lineHeight, color: ink.ink9 },
  pista: { fontFamily: tipo.body.family, fontSize: 16, lineHeight: 23, color: ink.ink8 },
  opciones: { gap: 9, marginTop: space.s1 },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 58,
    paddingVertical: 10,
    paddingHorizontal: space.s4,
    borderRadius: radio.tarjeta,
    borderWidth: 1,
    borderColor: vidrio.borde,
    backgroundColor: vidrio.suave,
  },
  opcionOn: { borderWidth: 2, borderColor: oro.claro, backgroundColor: vidrio.tarjeta, paddingVertical: 9, paddingHorizontal: space.s4 - 1 },
  marca: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: ink.ink6, alignItems: 'center', justifyContent: 'center' },
  marcaOn: { borderColor: ink.ink10, backgroundColor: ink.ink10 },
  opcionTexto: { flex: 1, minWidth: 0, fontFamily: tipo.headline.family, fontSize: 17, lineHeight: 22, color: ink.ink9 },
  crudoTitulo: { fontFamily: tipo.display.family, fontSize: tipo.display.size, lineHeight: tipo.display.lineHeight, color: oro.claro, marginTop: space.s2 },
  grande: { fontFamily: tipo.bodySm.family, fontSize: 21, lineHeight: 29, color: ink.ink9 },
  botones: { gap: space.s3 },
  tarjeta: { borderRadius: radio.tarjeta, borderWidth: 1, borderColor: vidrio.borde, backgroundColor: vidrio.suave, paddingVertical: space.s3, paddingHorizontal: space.s4 },
});
