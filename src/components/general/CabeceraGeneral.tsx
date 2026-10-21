// NIVL · Modo GENERAL: la cabecera tipo HUD y el héroe del nivel global
// (lámina 4 de la P01). Puras.
//
//   [emblema] NIVL                         (perfil)
//             Base · nivel global
//   ┌──────────────────────────────────────────────┐
//   │ (23)  NIVEL GLOBAL                           │
//   │       CENTURIÓN                              │
//   │       4.820 / 6.000 XP · racha 20 días       │
//   │       ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬                     │
//   │  RACHA 20 · PIEDRAS 2 · HOY 3/5              │
//   └──────────────────────────────────────────────┘

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatoMiles, ratioSeguro } from '@/components/arena';
import { LADO_RANURA } from '@/components/modos/mundo/CabeceraMundo';
import { GlifoModo } from '@/components/modos/rueda/GlifoModo';
import { t } from '@/i18n';
import { rangoPorId, type RangoId } from '@/lib/progression';
import { NOMBRE_MODO } from '@/modos/tipos';
import { BarraGeneral, Escudo, HuecoGeneral, TarjetaGeneral } from './piezas';
import { C, F, fs, G, oroA, oroMezcla, px } from './tema';

export interface CabeceraGeneralProps {
  /** El emblema que abre la rueda (EmblemaMundo); sin modos, la placa quieta. */
  emblema?: ReactNode;
  onPerfil: () => void;
}

export function CabeceraGeneral({ emblema, onPerfil }: CabeceraGeneralProps) {
  return (
    <View style={styles.cabecera}>
      <View style={styles.izquierda}>
        <View style={styles.ranura}>
          {emblema ?? (
            <View style={styles.placa} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <GlifoModo modo="general" tamano={22} color={G} />
            </View>
          )}
        </View>
        <View style={styles.flex}>
          <Text style={styles.nombre} accessibilityRole="header" maxFontSizeMultiplier={1.35} numberOfLines={1}>
            {NOMBRE_MODO.general}
          </Text>
          <Text style={styles.sub} maxFontSizeMultiplier={1.35} numberOfLines={1}>
            {t('general:cabecera.subtitulo')}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onPerfil}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('general:cabecera.perfilA11y')}
        style={({ pressed }) => [styles.perfil, pressed && styles.pulsado]}
      >
        <Ionicons name="person-outline" size={19} color={G} />
      </Pressable>
    </View>
  );
}

export interface HeroeNivelDatos {
  nivel: number;
  xpEnNivel: number;
  /** 0 = nivel máximo. */
  xpSiguiente: number;
  rango: RangoId | null;
  titulo: string;
  racha: number;
  piedras: number;
  /** «3/5» o vacío. */
  misiones: string;
}

export function HeroeNivel({ datos, onPress }: { datos: HeroeNivelDatos | null; onPress?: () => void }) {
  if (!datos) return <HuecoGeneral alto={px(150)} />;
  const maximo = datos.xpSiguiente <= 0;
  const ratio = maximo ? 1 : ratioSeguro(datos.xpEnNivel, datos.xpSiguiente);
  const rango = datos.rango ? rangoPorId(datos.rango) : null;
  const titulo = (datos.titulo || rango?.nombre || '').toUpperCase();
  const xp = maximo
    ? t('general:heroe.xpMax')
    : t('general:heroe.xp', { xp: formatoMiles(datos.xpEnNivel), total: formatoMiles(datos.xpSiguiente) });
  const etiqueta = t('general:heroe.a11y', { nivel: datos.nivel, titulo, xp, racha: datos.racha, piedras: datos.piedras });
  return (
    <TarjetaGeneral heroe onPress={onPress} accessibilityLabel={etiqueta}>
      <View style={styles.heroe}>
        <Escudo nivel={datos.nivel} />
        <View style={styles.flex}>
          <Text style={styles.eyebrow} maxFontSizeMultiplier={1.3}>
            {t('general:heroe.eyebrow')}
            {rango ? <Text style={styles.rango}>{`  ·  ${t('general:heroe.rango', { rango: rango.id })}`}</Text> : null}
          </Text>
          <Text style={[styles.titulo, titulo.length > 14 && styles.tituloLargo]} numberOfLines={2} maxFontSizeMultiplier={1.2}>
            {titulo}
          </Text>
          <Text style={styles.xp} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {xp}
          </Text>
          <BarraGeneral ratio={ratio} alto={px(5)} style={styles.barra} />
        </View>
      </View>
      <View style={styles.franja}>
        <Dato icono="flame" valor={String(datos.racha)} rotulo={t('general:heroe.racha')} />
        <View style={styles.separador} />
        <Dato icono="shield-half" valor={String(datos.piedras)} rotulo={t('general:heroe.piedras')} />
        <View style={styles.separador} />
        <Dato icono="checkmark-done" valor={datos.misiones || '0'} rotulo={t('general:heroe.hoy')} />
      </View>
    </TarjetaGeneral>
  );
}

function Dato({ icono, valor, rotulo }: { icono: keyof typeof Ionicons.glyphMap; valor: string; rotulo: string }) {
  return (
    <View style={styles.dato}>
      <Ionicons name={icono} size={px(13)} color={G} />
      <Text style={styles.datoValor} maxFontSizeMultiplier={1.3} numberOfLines={1}>
        {valor}
      </Text>
      <Text style={styles.datoRotulo} maxFontSizeMultiplier={1.3} numberOfLines={1}>
        {rotulo}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pulsado: { opacity: 0.7 },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: px(10), paddingTop: px(2), paddingBottom: px(4) },
  izquierda: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  ranura: { width: LADO_RANURA, height: LADO_RANURA, alignItems: 'center', justifyContent: 'center' },
  placa: {
    width: LADO_RANURA,
    height: LADO_RANURA,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: G,
    backgroundColor: oroMezcla(0.14, C.fondo),
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0px 0px 16px ${oroA(0.45)}`,
  },
  nombre: { fontFamily: 'Cinzel_900Black', fontSize: 24, lineHeight: 27, letterSpacing: 1.9, color: C.blanco },
  sub: { fontFamily: F.m, fontSize: 12, lineHeight: 15, letterSpacing: 0.7, color: C.mudo, marginTop: 2 },
  perfil: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: oroA(0.7),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.fondo,
  },
  heroe: { flexDirection: 'row', alignItems: 'center', gap: px(14) },
  eyebrow: { fontFamily: F.b, fontSize: fs(8.5), letterSpacing: fs(8.5) * 0.18, color: C.meta },
  rango: { color: G },
  titulo: { fontFamily: 'Cinzel_900Black', fontSize: fs(20), lineHeight: Math.round(fs(20) * 1.25), letterSpacing: 1.2, color: C.blanco, marginTop: px(2) },
  tituloLargo: { fontSize: fs(15), lineHeight: Math.round(fs(15) * 1.25) },
  xp: { fontFamily: F.m, fontSize: fs(10), color: C.suave, marginTop: px(1) },
  barra: { marginTop: px(7) },
  franja: { flexDirection: 'row', alignItems: 'center', marginTop: px(12), paddingTop: px(10), borderTopWidth: 1, borderTopColor: C.regla },
  separador: { width: 1, alignSelf: 'stretch', backgroundColor: C.regla },
  dato: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: px(5) },
  datoValor: { fontFamily: F.xb, fontSize: fs(13), color: C.blanco },
  datoRotulo: { fontFamily: F.m, fontSize: fs(9), color: C.mudo, flexShrink: 1 },
});
