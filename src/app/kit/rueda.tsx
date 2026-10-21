// NIVL · Galería: la rueda de modos quieta, para comparar con las láminas de la
// P01 (propuestas_modos/p01). SOLO DESARROLLO, sin sesión ni Supabase.
//
// /kit/rueda?estado=<e>&modo=<m>&actual=<m>&anterior=<m>&t=<0..1>
//   estado: abierta (cuadro 02) · apuntando (03) · recarga (04 y «recarga
//           dorada» con modo=general) · cabecera (el HUD del mundo) · emblema
//           (el disco del Hoy de NIVL, quieto y cargando)
//   modo: el apuntado o el que recarga · actual: el modo a la vista ·
//   anterior: el que se marca · t: instante de la recarga (0,7 por defecto)
// Las piezas son las de la app (RuedaModos, EmblemaModo, CabeceraMundo); aquí
// solo se fijan sus valores. En un build de release (__DEV__ false) redirige a la raíz.

import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { MarcoVisor } from '@/components/modos/maestria/MarcoVisor';
import { CabeceraMundo, LADO_RANURA } from '@/components/modos/mundo/CabeceraMundo';
import { DibujoEmblema } from '@/components/modos/rueda/EmblemaModo';
import { DiscoRueda, FichaRueda, geometriaRueda, RecargaModo, VeloRueda } from '@/components/modos/rueda/RuedaModos';
import { acentoRueda, ink, space } from '@/design/tokens';
import { t } from '@/i18n';
import type { Marca } from '@/modos/maestria';
import { nivelesDeModos } from '@/modos/niveles';
import { mascaraDisponibles, ORDEN_RUEDA } from '@/modos/rueda';
import { esModo, MODOS, type ModoEtiqueta, type ModoId } from '@/modos/tipos';

const TODOS: readonly ModoId[] = MODOS;
const XP_DEMO: Record<ModoEtiqueta, number> = { iron: 6400, focus: 2600, work: 1500, founder: 600 };

export default function KitRueda() {
  const p = useLocalSearchParams<{ estado?: string; modo?: string; actual?: string; anterior?: string; t?: string; marca?: string }>();
  const { width: w, height: h } = useWindowDimensions();
  const estado = p.estado ?? 'abierta';
  const modo: ModoId = esModo(p.modo) ? p.modo : 'iron';
  const actual: ModoId = esModo(p.actual) ? p.actual : 'general';
  const anterior: ModoId | null = esModo(p.anterior) ? p.anterior : null;
  const instante = p.t ? Math.min(1, Math.max(0, Number(p.t))) : 0.7;
  const resaltado = useSharedValue(-1);
  const progreso = useSharedValue(instante);
  const carga = useSharedValue(0);

  useEffect(() => {
    resaltado.value = estado === 'apuntando' ? ORDEN_RUEDA.indexOf(modo) : -1;
    progreso.value = instante;
    carga.value = estado === 'emblema' ? 0.7 : 0;
  }, [estado, modo, instante, resaltado, progreso, carga]);

  if (!__DEV__) return <Redirect href="/" />;

  const geo = geometriaRueda(w, h);
  const mascara = mascaraDisponibles(TODOS);
  const mundo: ModoEtiqueta = actual === 'general' ? 'iron' : actual;
  const nivel = nivelesDeModos([mundo], XP_DEMO)[0];
  const marca = (Number(p.marca) || null) as Marca | null;

  const cabecera = (
    <CabeceraMundo
      modo={mundo}
      nivel={nivel}
      marca={marca}
      emblema={
        <View style={styles.ranura}>
          <MarcoVisor marca={marca ?? 3} color={acentoRueda[mundo]} tamano={LADO_RANURA} style={StyleSheet.absoluteFill} />
          <View style={{ width: 44, height: 44 }}>
            <DibujoEmblema forma="placa" tamano={44} modo={mundo} disponibles={TODOS} />
          </View>
        </View>
      }
    />
  );

  if (estado === 'cabecera') {
    return (
      <View style={styles.pantalla}>
        <View style={styles.contenido}>{cabecera}</View>
      </View>
    );
  }

  if (estado === 'emblema') {
    return (
      <View style={[styles.pantalla, styles.centrado]}>
        <View style={{ width: 56, height: 56 }}>
          <DibujoEmblema forma="disco" tamano={56} modo={actual} disponibles={TODOS} />
        </View>
        <View style={{ height: 80 }} />
        <View style={{ width: 56, height: 56 }}>
          <DibujoEmblema forma="disco" tamano={56} modo={actual} disponibles={TODOS} carga={carga} />
        </View>
      </View>
    );
  }

  if (estado === 'recarga') {
    return (
      <View style={styles.pantalla}>
        <RecargaModo modo={modo} ancho={w} alto={h} progreso={progreso} reducido={false} />
      </View>
    );
  }

  // abierta / apuntando: la app detrás (la cabecera y bloques), el velo y la rueda.
  return (
    <View style={styles.pantalla}>
      <View style={styles.contenido}>
        {actual === 'general' ? <FondoNivl /> : cabecera}
        {[150, 120, 96, 110, 140].map((alto, i) => (
          <View key={i} style={[styles.bloque, { height: alto }]} />
        ))}
      </View>
      <VeloRueda resaltado={resaltado} />
      <FichaRueda
        modo={estado === 'apuntando' ? modo : null}
        actual={actual}
        anterior={anterior}
        ancho={w}
        top={Math.max(space.s14, geo.cy - geo.D / 2 - 150)}
      />
      <View style={{ position: 'absolute', left: geo.cx - geo.D / 2, top: geo.cy - geo.D / 2 }}>
        <DiscoRueda lado={geo.D} modo={actual} anterior={anterior} mascara={mascara} resaltado={resaltado} />
      </View>
      <Text style={[styles.pista, { top: geo.cy + geo.D / 2 + space.s6, width: w }]}>{t('modos:rueda.cancelar')}</Text>
    </View>
  );
}

function FondoNivl() {
  return (
    <View style={styles.fondoNivl}>
      <Text style={styles.fondoNivlTitulo}>{'NIVL' /* i18n-ok: marca */}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: ink.ink0, overflow: 'hidden' },
  centrado: { alignItems: 'center', justifyContent: 'center' },
  contenido: { paddingTop: 54, paddingHorizontal: 16, gap: 8 },
  ranura: { width: LADO_RANURA, height: LADO_RANURA, alignItems: 'center', justifyContent: 'center' },
  bloque: { borderRadius: 16, borderWidth: 1, borderColor: '#1C1C21', backgroundColor: '#0C0C0F' },
  fondoNivl: { height: 52, justifyContent: 'center' },
  fondoNivlTitulo: { fontFamily: 'Cinzel_900Black', fontSize: 22, letterSpacing: 2, color: ink.ink10 },
  pista: {
    position: 'absolute',
    left: 0,
    textAlign: 'center',
    paddingHorizontal: space.s6,
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#8A8A92',
  },
});
