// NIVL · Mundo IRON: el coach con la piel de IRON. El chat es el mismo de NIVL
// (su lógica no se toca); con la piel `coach` (src/design/piel.ts) se viste
// como la tarjeta «Coach IRON» de la lámina 2:
//   · una sola cabecera: la franja «COACH IRON · ● EN LÍNEA» con la mancuerna
//     en el círculo del acento y los dos accesos del coach (plan y memoria);
//   · la burbuja del coach con el avatar de la mancuerna y radio 16; la del
//     usuario en el acento al 15 %;
//   · días en letras espaciadas (sin Cinzel), compositor redondeado con enviar
//     en el cuadrado del acento y el micro fantasma;
//   · hueco abajo para el disco central de la barra.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PielContext, type Piel } from '@/design/piel';
import { t } from '@/i18n';
import { PIEL_IRON } from './piel';
import { AvatarIron, FondoIron } from './piezas';
import { A, acentoA, C, F, fs, M, px } from './tema';

const LADO_AVATAR = px(28);

function Acceso({ icono, etiqueta, onPress }: { icono: keyof typeof Ionicons.glyphMap; etiqueta: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      style={({ pressed }) => [styles.acceso, pressed && styles.pulsado]}
    >
      <Ionicons name={icono} size={px(16)} color={A} />
    </Pressable>
  );
}

const PIEL_COACH_IRON: Piel = {
  ...PIEL_IRON,
  coach: {
    cabecera: ({ linea, sinPro, cargando, onPro, onMemoria }) => (
      <View style={styles.franja}>
        <AvatarIron lado={px(34)} />
        <View style={styles.textos}>
          <Text style={styles.nombre} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {t('ironmundo:coach.rotulo').toUpperCase()}
          </Text>
          <Text style={styles.sub} numberOfLines={1} maxFontSizeMultiplier={1.35}>
            <Text style={styles.enLinea}>{t('ironmundo:coach.enLinea').toUpperCase()}</Text>
            {` · ${linea}`}
          </Text>
        </View>
        {cargando ? null : (
          <View style={styles.accesos}>
            <Acceso icono="flash-outline" etiqueta={sinPro ? t('comun:verNivlPro') : t('coach:vista.verPlan')} onPress={onPro} />
            {sinPro ? null : <Acceso icono="library-outline" etiqueta={t('coach:vista.verMemoria')} onPress={onMemoria} />}
          </View>
        )}
      </View>
    ),
    avatar: <AvatarIron lado={LADO_AVATAR} />,
    ladoAvatar: LADO_AVATAR,
    burbuja: C.burbuja,
    burbujaUsuario: acentoA(0.15),
    radioBurbuja: px(14),
    fuenteRotulo: F.b,
    textoTenue: C.mudo,
    // Medio disco del centro de la barra (56 / 2) más un respiro.
    margenInferior: 30,
  },
};

export function CoachIronMarco({ children }: { children: ReactNode }) {
  return (
    <View style={styles.lleno}>
      <FondoIron />
      <PielContext.Provider value={PIEL_COACH_IRON}>{children}</PielContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  lleno: { flex: 1, backgroundColor: C.fondo },
  pulsado: { opacity: 0.6 },
  franja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: px(10),
    marginHorizontal: M.margen,
    marginTop: px(4),
    marginBottom: px(4),
    paddingVertical: px(9),
    paddingHorizontal: px(12),
    borderRadius: M.radio,
    borderWidth: 1,
    borderColor: C.filete,
    backgroundColor: C.tarjeta,
  },
  textos: { flex: 1, minWidth: 0 },
  nombre: { fontFamily: F.cinzel, fontSize: fs(15), letterSpacing: fs(15) * 0.08, color: C.blanco },
  sub: { fontFamily: F.r, fontSize: fs(9.5), color: C.mudo, marginTop: px(1) },
  enLinea: { fontFamily: F.b, fontSize: fs(8), letterSpacing: fs(8) * 0.1, color: A },
  accesos: { flexDirection: 'row', gap: px(6) },
  acceso: {
    width: px(32),
    height: px(32),
    borderRadius: px(10),
    borderWidth: 1,
    borderColor: acentoA(0.35),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
