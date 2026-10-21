// NIVL · Modo GENERAL: «Tu arsenal» (lámina 4 de la P01, «toca para equipar»)
// y «Todo desde aquí».
//
// · ArsenalModos (pura): una tarjeta por modo activado con su glifo, su color
//   y su nivel. UN toque cambia de modo (el mismo `irAlMundo` de la rueda, con
//   la firma de sonido y vibración del modo): quien no quiere la rueda cambia
//   de modo sin arrastrar ni mantener. Va en Hoy y en Perfil.
// · ArsenalConectado: lo mismo leyendo useModo y useNivelesModo. Sin el
//   interruptor `modos_activos` o sin modos activados, nada.
// · TodoDesdeAqui (pura): los accesos a lo que viven los modos (gimnasio,
//   dieta, cardio, foco, exámenes, economía, agenda, diario, hábitos) para
//   quien lo hace todo desde General. Reutiliza las pantallas que ya existen.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatoMiles, ratioSeguro } from '@/components/arena';
import { conAlfa, mezcla } from '@/components/modos/rueda/color';
import { GlifoModo } from '@/components/modos/rueda/GlifoModo';
import { EVENTO_MODO } from '@/components/modos/rueda/RuedaModos';
import { sonarModo } from '@/components/modos/rueda/sonido';
import { useNivelesModo } from '@/components/modos/useNivelesModo';
import { vibrar } from '@/design/haptics';
import { acentoRueda } from '@/design/tokens';
import { t } from '@/i18n';
import { useModo } from '@/modos/ModoProvider';
import type { NivelModo } from '@/modos/niveles';
import { irAlMundo } from '@/modos/rutasModo';
import { NOMBRE_MODO, type ModoEtiqueta, type ModoId } from '@/modos/tipos';
import { BarraGeneral, HuecoGeneral, RotuloGeneral } from './piezas';
import { C, F, fs, G, px } from './tema';

export interface ArsenalModosProps {
  modos: readonly ModoEtiqueta[];
  /** null mientras se leen los niveles. */
  niveles: readonly NivelModo[] | null;
  onEquipar: (m: ModoId) => void;
}

export function ArsenalModos({ modos, niveles, onEquipar }: ArsenalModosProps) {
  if (modos.length === 0) return null;
  return (
    <View>
      <RotuloGeneral texto={t('general:arsenal.rotulo')} em={t('general:arsenal.em')} seccion />
      <View style={styles.rejilla}>
        {modos.map((m) => {
          const n = niveles?.find((x) => x.modo === m) ?? null;
          return <TarjetaModo key={m} modo={m} nivel={n} cargando={niveles === null} onPress={() => onEquipar(m)} />;
        })}
      </View>
    </View>
  );
}

function TarjetaModo({ modo, nivel, cargando, onPress }: { modo: ModoEtiqueta; nivel: NivelModo | null; cargando: boolean; onPress: () => void }) {
  const acento = acentoRueda[modo];
  const nombre = NOMBRE_MODO[modo];
  const ratio = nivel ? (nivel.xpSiguiente <= 0 ? 1 : ratioSeguro(nivel.xpEnNivel, nivel.xpSiguiente)) : 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('general:arsenal.equiparA11y', { modo: nombre, nivel: nivel?.nivel ?? 1 })}
      style={({ pressed }) => [
        styles.modo,
        { borderColor: conAlfa(acento, 0.45), backgroundColor: mezcla(acento, 0.08, C.tarjeta) },
        pressed && styles.pulsado,
      ]}
    >
      <View style={styles.modoCabeza}>
        <GlifoModo modo={modo} tamano={px(18)} color={acento} />
        {cargando ? (
          <View style={styles.huecoNv} />
        ) : (
          <Text style={[styles.nv, { color: acento }]} maxFontSizeMultiplier={1.3}>
            {t('general:arsenal.nivel', { nivel: nivel?.nivel ?? 1 })}
          </Text>
        )}
      </View>
      <Text style={styles.modoNombre} maxFontSizeMultiplier={1.3} numberOfLines={1}>
        {nombre}
      </Text>
      <Text style={styles.modoSub} maxFontSizeMultiplier={1.3} numberOfLines={1}>
        {t(`mundos:subtitulo.${modo}`)}
      </Text>
      <BarraGeneral ratio={ratio} alto={3} color={acento} style={styles.modoBarra} />
      <View style={styles.equipar}>
        <Text style={[styles.equiparTexto, { color: acento }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
          {nivel ? t('general:arsenal.xp', { xp: formatoMiles(nivel.xp) }) : ' '}
        </Text>
        <Ionicons name="arrow-forward" size={px(12)} color={acento} />
      </View>
    </Pressable>
  );
}

/** El arsenal conectado al modo de la cuenta. Nada sin `modos_activos` o sin modos activados. */
export function ArsenalConectado() {
  const { activo, activados, cambiar } = useModo();
  if (!activo || activados.length === 0) return null;
  return <ArsenalLeido activados={activados} cambiar={cambiar} />;
}

function ArsenalLeido({ activados, cambiar }: { activados: readonly ModoEtiqueta[]; cambiar: (m: ModoId) => void }) {
  const { cargando, niveles } = useNivelesModo();
  const equipar = useCallback(
    (m: ModoId) => {
      sonarModo(m);
      vibrar(EVENTO_MODO[m]);
      irAlMundo(m, cambiar);
    },
    [cambiar],
  );
  return <ArsenalModos modos={activados} niveles={cargando ? null : niveles} onEquipar={equipar} />;
}

// ── Todo desde aquí ──────────────────────────────────────────────────

export type AccesoGeneral = 'gym' | 'dieta' | 'cardio' | 'foco' | 'examenes' | 'economia' | 'agenda' | 'diario' | 'habitos';

export const ACCESOS: readonly { id: AccesoGeneral; icono: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'gym', icono: 'barbell-outline' },
  { id: 'dieta', icono: 'restaurant-outline' },
  { id: 'cardio', icono: 'walk-outline' },
  { id: 'foco', icono: 'timer-outline' },
  { id: 'examenes', icono: 'school-outline' },
  { id: 'economia', icono: 'wallet-outline' },
  { id: 'agenda', icono: 'calendar-outline' },
  { id: 'diario', icono: 'book-outline' },
  { id: 'habitos', icono: 'repeat-outline' },
];

export function TodoDesdeAqui({ onIr }: { onIr: (a: AccesoGeneral) => void }) {
  return (
    <View>
      <RotuloGeneral texto={t('general:todo.rotulo')} em={t('general:todo.em')} seccion />
      <View style={styles.accesos}>
        {ACCESOS.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => onIr(a.id)}
            accessibilityRole="button"
            accessibilityLabel={t(`general:todo.${a.id}`)}
            style={({ pressed }) => [styles.acceso, pressed && styles.pulsado]}
          >
            <Ionicons name={a.icono} size={px(20)} color={G} />
            <Text style={styles.accesoTexto} maxFontSizeMultiplier={1.25} numberOfLines={1}>
              {t(`general:todo.${a.id}`)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function HuecoArsenal() {
  return <HuecoGeneral alto={px(110)} />;
}

const styles = StyleSheet.create({
  pulsado: { opacity: 0.75 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: px(7), marginTop: px(6) },
  modo: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: px(14), paddingVertical: px(10), paddingHorizontal: px(11) },
  modoCabeza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nv: { fontFamily: F.xb, fontSize: fs(9.5), letterSpacing: fs(9.5) * 0.12 },
  huecoNv: { width: px(30), height: px(10), borderRadius: 4, backgroundColor: C.hueco },
  modoNombre: { fontFamily: F.xb, fontSize: fs(12.5), letterSpacing: fs(12.5) * 0.1, color: C.blanco, marginTop: px(8) },
  modoSub: { fontFamily: F.r, fontSize: fs(9.5), color: C.suave, marginTop: px(1) },
  modoBarra: { marginTop: px(8) },
  equipar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: px(6) },
  equiparTexto: { fontFamily: F.b, fontSize: fs(9), flexShrink: 1 },
  accesos: { flexDirection: 'row', flexWrap: 'wrap', gap: px(7), marginTop: px(6) },
  acceso: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: px(66),
    borderRadius: px(13),
    borderWidth: 1,
    borderColor: C.filete,
    backgroundColor: C.tarjeta,
    alignItems: 'center',
    justifyContent: 'center',
    gap: px(6),
    paddingHorizontal: px(4),
  },
  accesoTexto: { fontFamily: F.sb, fontSize: fs(10), color: C.texto },
});
