// NIVL · Modo GENERAL: la cabecera y el héroe del nivel global (Ónix). Puras.
//
//   [emblema] NIVL                       BASE  (perfil)
//   ┌──────────────────────────────────────────────┐
//   │ (23)  NIVEL GLOBAL · RANGO C                 │
//   │       Centurión                              │
//   │       ▬▬▬▬▬▬▬▬▬▬▬▬▬▬                         │
//   │       4.820 / 6.000 XP                       │
//   └──────────────────────────────────────────────┘

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatoMiles, ratioSeguro } from '@/components/arena';
import { LADO_RANURA } from '@/components/modos/mundo/CabeceraMundo';
import { GlifoModo } from '@/components/modos/rueda/GlifoModo';
import { ink, oro, radio, type as tipo, vidrio } from '@/design/tokens';
import { t } from '@/i18n';
import { rangoPorId, type RangoId } from '@/lib/progression';
import { NOMBRE_MODO } from '@/modos/tipos';
import { BarraGeneral, Escudo, HuecoGeneral, TarjetaGeneral } from './piezas';
import { G, px } from './tema';

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
        <Text style={styles.nombre} accessibilityRole="header" maxFontSizeMultiplier={1.35} numberOfLines={1}>
          {NOMBRE_MODO.general}
        </Text>
      </View>
      <Text style={styles.modo} accessibilityLabel={t('general:cabecera.subtitulo')} maxFontSizeMultiplier={1.5} numberOfLines={1}>
        {t('modos:rueda.base')}
      </Text>
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
  if (!datos) return <HuecoGeneral alto={px(100)} />;
  const maximo = datos.xpSiguiente <= 0;
  const ratio = maximo ? 1 : ratioSeguro(datos.xpEnNivel, datos.xpSiguiente);
  const rango = datos.rango ? rangoPorId(datos.rango) : null;
  const titulo = datos.titulo || rango?.nombre || '';
  const xp = maximo
    ? t('general:heroe.xpMax')
    : t('general:heroe.xp', { xp: formatoMiles(datos.xpEnNivel), total: formatoMiles(datos.xpSiguiente) });
  const etiqueta = t('general:heroe.a11y', { nivel: datos.nivel, titulo, xp, racha: datos.racha, piedras: datos.piedras });
  return (
    <TarjetaGeneral heroe onPress={onPress} accessibilityLabel={etiqueta}>
      <View style={styles.heroe}>
        <Escudo nivel={datos.nivel} />
        <View style={styles.flex}>
          <Text style={styles.eyebrow} maxFontSizeMultiplier={1.5} numberOfLines={1}>
            {t('general:heroe.eyebrow')}
            {rango ? <Text style={styles.rango}>{`  ·  ${t('general:heroe.rango', { rango: rango.id })}`}</Text> : null}
          </Text>
          <Text style={styles.titulo} numberOfLines={2} maxFontSizeMultiplier={1.4}>
            {titulo}
          </Text>
          <BarraGeneral ratio={ratio} alto={5} style={styles.barra} />
          <Text style={styles.xp} numberOfLines={1} maxFontSizeMultiplier={1.5}>
            {xp}
          </Text>
        </View>
      </View>
    </TarjetaGeneral>
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
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: oro.borde,
    backgroundColor: oro.fondo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombre: { flexShrink: 1, fontFamily: tipo.number.family, fontSize: tipo.number.size, lineHeight: tipo.number.lineHeight, letterSpacing: 3, color: ink.ink9 },
  modo: { flexShrink: 1, fontFamily: tipo.label.family, fontSize: tipo.label.size, lineHeight: tipo.label.lineHeight, letterSpacing: tipo.label.tracking, color: oro.claro },
  perfil: {
    width: 40,
    height: 40,
    borderRadius: radio.pastilla,
    borderWidth: 1,
    borderColor: vidrio.borde,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: vidrio.suave,
  },
  heroe: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  eyebrow: { fontFamily: tipo.label.family, fontSize: tipo.micro.size, lineHeight: tipo.micro.lineHeight, letterSpacing: tipo.label.tracking, color: ink.ink8 },
  rango: { color: oro.claro },
  titulo: { fontFamily: tipo.label.family, fontSize: 19, lineHeight: 24, color: ink.ink9, marginTop: 2 },
  barra: { marginTop: 7 },
  xp: { fontFamily: tipo.body.family, fontSize: 13, lineHeight: 18, color: ink.ink8, marginTop: 5 },
});
