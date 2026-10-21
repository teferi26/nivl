// NIVL · Mundo IRON: el entreno en marcha (lo que abre EMPEZAR ENTRENO), en la
// piel de la lámina 2. Pura: las series, las notas, la foto y terminar llegan
// de useGym (el mismo hook de Gimnasio: su cerrojo, su pago y su celebración).
//
//   ┌ EN CURSO · 00:34:12                hasta +50 XP ┐  héroe
//   │ Pierna A · Fuerza                               │
//   │ 3 ejercicios · 7 de 10 series                   │
//   │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬░░░░░                          │
//   └─────────────────────────────────────────────────┘
//   Sentadilla trasera            Técnica  + SERIE
//   #   KG     REPS   RPE
//   ①  [100]  [6]    [7]   ×      (la casilla se llena con la serie hecha)
//   …
//   CÓMO FUE: notas y foto
//   [ ✓ TERMINAR ENTRENO ]
//
// Sin animaciones de entrada: un campo con el foco no debe moverse.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { LiftInput, SerieInput } from '@/components/gym/SesionEnCurso';
import { t } from '@/i18n';
import { BarraIron, BotonIron, estilosIron, PantallaIron, RotuloIron, TarjetaIron } from './piezas';
import { GlifoIron } from './Glifos';
import { A, acentoA, C, F, fs, mezcla, px } from './tema';

export interface EntrenandoIronVistaProps {
  cabecera: ReactNode;
  /** El nombre del día de la rutina; null si se entrena fuera de rutina. */
  dia: string | null;
  /** Cuándo empezó (ms). */
  desde: number;
  /** Galería: el reloj quieto en este instante. */
  ahora?: number;
  xpSesion: number;
  series: LiftInput[];
  notas: string;
  fotoLista: boolean;
  ocupado: boolean;
  tecnicaDe?: (nombre: string) => (() => void) | undefined;
  acciones: {
    onCambiarSerie: (iEj: number, iSerie: number, campo: keyof SerieInput, valor: string) => void;
    onAnadirSerie: (iEj: number) => void;
    onQuitarSerie: (iEj: number, iSerie: number) => void;
    onNotas: (v: string) => void;
    onFoto: () => void;
    onTerminar: () => void;
  };
}

/** Una serie está hecha cuando lleva repeticiones. */
export const serieHecha = (s: SerieInput) => Number(String(s.reps).replace(',', '.')) > 0;

/** «00:34:12». */
export function reloj(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const dos = (n: number) => String(n).padStart(2, '0');
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(dos).join(':');
}

function useReloj(desde: number, fijo?: number): number {
  const [ahora, setAhora] = useState(() => fijo ?? Date.now());
  useEffect(() => {
    if (fijo !== undefined) return;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [fijo]);
  return (fijo ?? ahora) - desde;
}

function Celda({
  value,
  onChangeText,
  placeholder,
  decimal,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  decimal: boolean;
  accessibilityLabel: string;
}) {
  const [foco, setFoco] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      placeholder={placeholder}
      placeholderTextColor={C.apagado}
      selectionColor={A}
      cursorColor={A}
      maxFontSizeMultiplier={1.35}
      accessibilityLabel={accessibilityLabel}
      onFocus={() => setFoco(true)}
      onBlur={() => setFoco(false)}
      style={[styles.celda, foco && styles.celdaFoco]}
    />
  );
}

export function EntrenandoIronVista(p: EntrenandoIronVistaProps) {
  const transcurrido = useReloj(p.desde, p.ahora);
  const total = p.series.reduce((n, l) => n + l.series.length, 0);
  const hechas = p.series.reduce((n, l) => n + l.series.filter(serieHecha).length, 0);
  const { acciones: a } = p;
  return (
    <PantallaIron>
      {p.cabecera}

      <TarjetaIron heroe>
        <RotuloIron texto={t('ironmundo:sesion.enCurso', { reloj: reloj(transcurrido) })} em={t('ironmundo:hastaXp', { xp: p.xpSesion })} />
        <Text style={estilosIron.titulo} accessibilityRole="header" numberOfLines={2} maxFontSizeMultiplier={1.35}>
          {p.dia ?? t('ironmundo:sesion.libre')}
        </Text>
        <Text style={estilosIron.meta} maxFontSizeMultiplier={1.35}>
          {t('ironmundo:sesion.meta', { count: p.series.length, hechas, total })}
        </Text>
        <BarraIron ratio={total ? hechas / total : 0} alto={5} style={styles.progreso} />
      </TarjetaIron>

      {p.series.map((l, i) => {
        const tecnica = p.tecnicaDe?.(l.exercise);
        return (
          <TarjetaIron key={l.exercise}>
            <View style={styles.cabeza}>
              <Text style={[styles.nombre, styles.flex]} numberOfLines={2} maxFontSizeMultiplier={1.35}>
                {l.exercise}
              </Text>
              {tecnica ? (
                <Pressable onPress={tecnica} hitSlop={10} accessibilityRole="link" accessibilityLabel={t('ironmundo:sesion.tecnicaA11y', { ejercicio: l.exercise })}>
                  <Text style={styles.enlace} maxFontSizeMultiplier={1.35}>
                    {t('ironmundo:sesion.tecnica')}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => a.onAnadirSerie(i)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('ironmundo:sesion.anadirSerieA11y', { ejercicio: l.exercise })}
                style={({ pressed }) => [styles.serieMas, pressed && styles.pulsado]}
              >
                <Text style={styles.serieMasTexto} maxFontSizeMultiplier={1.2}>
                  {t('ironmundo:sesion.serie')}
                </Text>
              </Pressable>
            </View>

            <View style={styles.fila} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={[styles.colNum, styles.rotulo]}>{'#' /* i18n-ok: signo */}</Text>
              <Text style={[styles.colDato, styles.rotulo]}>{t('ironmundo:unidadKg')}</Text>
              <Text style={[styles.colDato, styles.rotulo]}>{t('ironmundo:sesion.reps')}</Text>
              <Text style={[styles.colDato, styles.rotulo]}>{t('ironmundo:sesion.rpe')}</Text>
              <View style={styles.colQuitar} />
            </View>

            {l.series.map((s, si) => {
              const hecha = serieHecha(s);
              const unica = l.series.length === 1;
              return (
                <View key={si} style={[styles.fila, styles.filaSerie]}>
                  <View style={styles.colNum}>
                    <View style={[styles.casilla, hecha && styles.casillaHecha]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                      {hecha ? (
                        <GlifoIron nombre="check" lado={px(13)} color={C.fondo} grosor={2.8} />
                      ) : (
                        <Text style={styles.casillaNumero} maxFontSizeMultiplier={1}>
                          {si + 1}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.colDato}>
                    <Celda
                      value={s.weight}
                      onChangeText={(v) => a.onCambiarSerie(i, si, 'weight', v)}
                      placeholder={t('ironmundo:unidadKg')}
                      decimal
                      accessibilityLabel={t('ironmundo:sesion.pesoA11y', { n: si + 1, ejercicio: l.exercise })}
                    />
                  </View>
                  <View style={styles.colDato}>
                    <Celda
                      value={s.reps}
                      onChangeText={(v) => a.onCambiarSerie(i, si, 'reps', v)}
                      placeholder={t('ironmundo:sesion.reps')}
                      decimal={false}
                      accessibilityLabel={t('ironmundo:sesion.repsA11y', { n: si + 1, ejercicio: l.exercise })}
                    />
                  </View>
                  <View style={styles.colDato}>
                    <Celda
                      value={s.rpe}
                      onChangeText={(v) => a.onCambiarSerie(i, si, 'rpe', v)}
                      placeholder={t('ironmundo:sesion.rpe')}
                      decimal
                      accessibilityLabel={t('ironmundo:sesion.rpeA11y', { n: si + 1, ejercicio: l.exercise })}
                    />
                  </View>
                  <Pressable
                    onPress={() => a.onQuitarSerie(i, si)}
                    disabled={unica}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('ironmundo:sesion.quitarA11y', { n: si + 1, ejercicio: l.exercise })}
                    accessibilityState={{ disabled: unica }}
                    style={({ pressed }) => [styles.colQuitar, pressed && styles.pulsado]}
                  >
                    <Ionicons name="close" size={px(16)} color={unica ? C.suelo : C.mudo} />
                  </Pressable>
                </View>
              );
            })}
          </TarjetaIron>
        );
      })}

      <TarjetaIron>
        <RotuloIron texto={t('ironmundo:sesion.comoFue')} />
        <TextInput
          value={p.notas}
          onChangeText={a.onNotas}
          placeholder={t('ironmundo:sesion.notas')}
          placeholderTextColor={C.tenue}
          accessibilityLabel={t('ironmundo:sesion.notasA11y')}
          multiline
          maxLength={1000}
          style={styles.notas}
          maxFontSizeMultiplier={1.35}
        />
        <BotonIron
          fantasma
          fino
          titulo={p.fotoLista ? t('ironmundo:sesion.fotoLista') : t('ironmundo:sesion.foto')}
          onPress={a.onFoto}
          accessibilityLabel={p.fotoLista ? t('ironmundo:sesion.fotoListaA11y') : t('ironmundo:sesion.fotoA11y')}
        />
      </TarjetaIron>

      <BotonIron icono="check" titulo={t('ironmundo:sesion.terminar')} onPress={a.onTerminar} ocupado={p.ocupado} style={styles.terminar} />
    </PantallaIron>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pulsado: { opacity: 0.6 },
  progreso: { marginTop: px(10), marginBottom: px(2) },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: px(10), marginBottom: px(6) },
  nombre: { fontFamily: F.b, fontSize: fs(13), color: C.blanco },
  enlace: { fontFamily: F.b, fontSize: fs(8.5), letterSpacing: fs(8.5) * 0.12, color: A, textTransform: 'uppercase' },
  serieMas: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: acentoA(0.55),
    borderRadius: px(8),
    paddingHorizontal: px(8),
    paddingVertical: px(4),
  },
  serieMasTexto: { fontFamily: F.xb, fontSize: fs(8.5), letterSpacing: fs(8.5) * 0.14, color: A },
  fila: { flexDirection: 'row', alignItems: 'center', gap: px(6) },
  filaSerie: { paddingVertical: px(3) },
  rotulo: { fontFamily: F.b, fontSize: fs(8), letterSpacing: fs(8) * 0.16, color: C.mudo, textTransform: 'uppercase', textAlign: 'center' },
  colNum: { width: px(28), alignItems: 'center' },
  colDato: { flex: 1, minWidth: 0 },
  colQuitar: { width: px(24), height: px(34), alignItems: 'center', justifyContent: 'center' },
  casilla: {
    width: px(22),
    height: px(22),
    borderRadius: px(11),
    borderWidth: 1.5,
    borderColor: acentoA(0.6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaHecha: { backgroundColor: A, borderColor: A },
  casillaNumero: { fontFamily: F.xb, fontSize: fs(9), color: A },
  celda: {
    height: px(34),
    borderRadius: px(9),
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.fondo,
    color: C.blanco,
    fontFamily: F.xb,
    fontSize: fs(13),
    textAlign: 'center',
    paddingHorizontal: px(4),
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  celdaFoco: { borderColor: A, backgroundColor: mezcla(0.1, C.fondo) },
  notas: {
    marginTop: px(8),
    minHeight: 44,
    borderRadius: px(10),
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.fondo,
    color: C.claro,
    fontFamily: F.r,
    fontSize: fs(11),
    paddingHorizontal: px(10),
    paddingVertical: px(10),
    textAlignVertical: 'top',
  },
  terminar: { marginTop: px(4), marginBottom: px(12) },
});
