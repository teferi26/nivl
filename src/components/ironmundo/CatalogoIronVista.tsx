// NIVL · Mundo IRON: el catálogo con técnica (lámina 2 de la P01, teléfono de
// la derecha). Pura: todo llega por props (useCatalogoIron o la galería).
//
//   ‹ CATÁLOGO                       [pesa]
//     Añadir a Pierna A
//   [ Buscar ejercicio o músculo     (lupa) ]
//   (Pierna) (Pecho) (Espalda) (Hombro) (Brazo) (Core)
//   ┌ TÉCNICA · BUCLE ANIMADO         3 FASES ┐   tarjeta héroe
//   │ maniquí en bucle  · mapa delante/detrás │
//   │ Sentadilla trasera                       │
//   │ Cuádriceps y glúteo · Barra · Intermedio │
//   │ 1 · 2 · 3 consignas                      │
//   │ [ + AÑADIR A PIERNA A ]                  │   (sin día: VER TÉCNICA E HISTORIAL)
//   └──────────────────────────────────────────┘
//   MÁS DE PIERNA
//   [pesa] Zancada búlgara · Cuádriceps · mancuernas      +

import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { nombreIron, textoIron } from '@/components/iron/texto';
import { t } from '@/i18n';
import type { EntradaIron } from '@/iron/catalogo';
import type { Ejercicio, GrupoMuscular } from '@/iron/tipos';
import { FiguraTecnica } from './FiguraTecnica';
import { GlifoIron } from './Glifos';
import { MapaMini } from './MapaMini';
import { BotonIron, ChipIron, CuadroIron, estilosIron, FilaIron, PantallaIron, RotuloIron, TarjetaIron } from './piezas';
import { A, C, F, fs, mezcla, px } from './tema';

export interface CatalogoIronVistaProps {
  /** El día de la rutina al que se añade («Pierna A»); null: solo se mira. */
  diaNombre: string | null;
  consulta: string;
  onConsulta: (v: string) => void;
  grupos: readonly GrupoMuscular[];
  grupo: GrupoMuscular;
  onGrupo: (g: GrupoMuscular) => void;
  elegido: Ejercicio;
  /** Los demás del grupo, o lo que encuentra la búsqueda. */
  lista: readonly EntradaIron[];
  onElegir: (id: string) => void;
  /** Añadir el elegido al día (con día); sin día, no hay. */
  onAnadir?: () => void;
  anadiendo?: boolean;
  error?: string | null;
  /** La técnica completa con tu historial (/iron/[id]). */
  onTecnica: () => void;
  onVolver: () => void;
  /** Galería: el maniquí quieto en este instante. */
  ms?: number;
}

/** «Cuádriceps y glúteo · Barra · Intermedio». */
export function metaEjercicio(ej: Ejercicio): string {
  const musculos = ej.musculos.principales.slice(0, 2).map((m) => nombreIron('musculo', m));
  return [
    musculos.length === 2 ? t('ironmundo:catalogo.musculosY', { a: musculos[0], b: musculos[1]!.toLowerCase() }) : musculos[0],
    ej.material[0] ? nombreIron('material', ej.material[0]) : null,
    t(`iron:nivel.${ej.nivel}`),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** «Cuádriceps · mancuernas» (la fila de la lista). */
function metaCorta(ej: Ejercicio): string {
  return [ej.musculos.principales[0] ? nombreIron('musculo', ej.musculos.principales[0]) : null, ej.material[0] ? nombreIron('material', ej.material[0]).toLowerCase() : null]
    .filter(Boolean)
    .join(' · ');
}

export function CatalogoIronVista(p: CatalogoIronVistaProps) {
  const ej = p.elegido;
  const nombre = textoIron(ej.nombre);
  const buscando = p.consulta.trim().length > 0;
  return (
    <PantallaIron>
      <View style={styles.cabecera}>
        <Pressable onPress={p.onVolver} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('ironmundo:volver')} style={styles.atras}>
          <GlifoIron nombre="atras" lado={px(18)} color={C.mudo} grosor={2.2} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.titulo} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
            {t('ironmundo:catalogo.titulo')}
          </Text>
          <Text style={styles.subtitulo} numberOfLines={1} maxFontSizeMultiplier={1.35}>
            {p.diaNombre ? t('ironmundo:catalogo.anadirA', { dia: p.diaNombre }) : t('ironmundo:catalogo.sub')}
          </Text>
        </View>
        <View style={styles.emblema}>
          <GlifoIron nombre="pesa" lado={px(16)} color={A} />
        </View>
      </View>

      <View style={styles.buscar}>
        <TextInput
          value={p.consulta}
          onChangeText={p.onConsulta}
          placeholder={t('ironmundo:catalogo.buscar')}
          placeholderTextColor={C.tenue}
          accessibilityLabel={t('ironmundo:catalogo.buscarA11y')}
          autoCorrect={false}
          returnKeyType="search"
          style={styles.buscarCampo}
          maxFontSizeMultiplier={1.35}
        />
        <View style={styles.lupa}>
          <GlifoIron nombre="buscar" lado={px(12)} color={C.mudo} grosor={2.4} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="radiogroup">
        {p.grupos.map((g) => (
          <ChipIron key={g} texto={nombreIron('grupo', g)} activo={!buscando && g === p.grupo} onPress={() => p.onGrupo(g)} />
        ))}
      </ScrollView>

      <TarjetaIron heroe style={styles.heroe}>
        <RotuloIron texto={t('ironmundo:catalogo.tecnica')} em={t('ironmundo:catalogo.fases', { count: 3 })} />
        <View style={styles.escena}>
          <FiguraTecnica ejercicio={ej} alto={px(150)} ancho={px(178)} ms={p.ms} accessibilityLabel={t('iron:demo.animacion', { nombre })} />
          <MapaMini musculos={ej.musculos} alto={px(104)} etiqueta={t('ironmundo:catalogo.mapaA11y', { nombre })} />
        </View>
        <Text style={[estilosIron.titulo, styles.nombre]} maxFontSizeMultiplier={1.35}>
          {nombre}
        </Text>
        <Text style={estilosIron.meta} maxFontSizeMultiplier={1.35}>
          {metaEjercicio(ej)}
        </Text>
        <View style={styles.pasos}>
          {ej.cues.slice(0, 3).map((c, i) => (
            <View key={c} style={styles.paso}>
              <View style={styles.pasoNumero}>
                <Text style={styles.pasoNumeroTexto} maxFontSizeMultiplier={1}>
                  {i + 1}
                </Text>
              </View>
              <Text style={styles.pasoTexto} maxFontSizeMultiplier={1.6}>
                {textoIron(c)}
              </Text>
            </View>
          ))}
        </View>
        {p.error ? (
          <Text style={estilosIron.error} maxFontSizeMultiplier={1.6}>
            {p.error}
          </Text>
        ) : null}
        {p.onAnadir && p.diaNombre ? (
          <BotonIron titulo={t('ironmundo:catalogo.anadirBoton', { dia: p.diaNombre })} onPress={p.onAnadir} ocupado={p.anadiendo} />
        ) : (
          <BotonIron titulo={t('ironmundo:catalogo.verTecnica')} onPress={p.onTecnica} />
        )}
        {p.onAnadir && p.diaNombre ? (
          <Pressable onPress={p.onTecnica} hitSlop={10} accessibilityRole="link" style={styles.enlace}>
            <Text style={styles.enlaceTexto} maxFontSizeMultiplier={1.35}>
              {t('ironmundo:catalogo.verTecnica')}
            </Text>
          </Pressable>
        ) : null}
      </TarjetaIron>

      <View>
        <RotuloIron
          seccion
          texto={buscando ? t('ironmundo:catalogo.resultados', { count: p.lista.length }) : t('ironmundo:catalogo.masDe', { grupo: nombreIron('grupo', p.grupo).toLowerCase() })}
        />
        {p.lista.length === 0 ? (
          <Text style={estilosIron.detalle} maxFontSizeMultiplier={1.6}>
            {t('ironmundo:catalogo.sinResultados')}
          </Text>
        ) : (
          p.lista.map((e, i) => (
            <FilaIron
              key={e.id}
              primera={i === 0}
              onPress={() => p.onElegir(e.id)}
              style={styles.fila}
              accessibilityLabel={t('ironmundo:catalogo.filaA11y', { nombre: e.nombre, meta: metaCorta(e.ejercicio) })}
            >
              <View style={styles.filaIzq}>
                <CuadroIron lado={px(30)} radio={px(8)}>
                  <GlifoIron nombre="pesa" lado={px(14)} color={A} />
                </CuadroIron>
                <View style={styles.flex}>
                  <Text style={estilosIron.filaNombre} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                    {e.nombre}
                  </Text>
                  <Text style={estilosIron.filaSerie} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                    {metaCorta(e.ejercicio)}
                  </Text>
                </View>
              </View>
              <Text style={styles.mas} maxFontSizeMultiplier={1}>
                {'+' /* i18n-ok: signo */}
              </Text>
            </FilaIron>
          ))
        )}
      </View>
    </PantallaIron>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: px(9), paddingTop: px(4), marginBottom: px(2) },
  atras: { paddingVertical: px(4) },
  titulo: { fontFamily: F.cinzel, fontSize: fs(16), letterSpacing: fs(16) * 0.08, color: C.blanco },
  subtitulo: { fontFamily: F.m, fontSize: fs(9.5), letterSpacing: fs(9.5) * 0.06, color: C.mudo, marginTop: px(2) },
  emblema: {
    width: px(30),
    height: px(30),
    borderRadius: px(10),
    borderWidth: 1.5,
    borderColor: A,
    backgroundColor: mezcla(0.14, C.fondo),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: A,
    shadowOpacity: 0.45,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
  buscar: {
    height: px(34),
    borderRadius: px(10),
    borderWidth: 1,
    borderColor: C.borde,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: px(10),
    paddingRight: px(4),
    marginTop: px(2),
  },
  buscarCampo: { flex: 1, height: '100%', fontFamily: F.r, fontSize: fs(10), color: C.claro, padding: 0 },
  lupa: {
    width: px(24),
    height: px(24),
    borderRadius: px(8),
    borderWidth: 1,
    borderColor: C.suelo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { gap: px(6), paddingVertical: px(2) },
  heroe: { padding: px(12) },
  escena: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: px(4), marginBottom: px(6) },
  nombre: { fontSize: fs(18) },
  pasos: { marginTop: px(8), gap: px(5) },
  paso: { flexDirection: 'row', alignItems: 'center', gap: px(7) },
  pasoNumero: { width: px(16), height: px(16), borderRadius: px(5), backgroundColor: C.hueco, alignItems: 'center', justifyContent: 'center' },
  pasoNumeroTexto: { fontFamily: F.xb, fontSize: fs(8.5), color: A },
  pasoTexto: { flex: 1, fontFamily: F.m, fontSize: fs(10), lineHeight: fs(10) * 1.35, color: C.texto },
  enlace: { alignSelf: 'center', marginTop: px(8) },
  enlaceTexto: { fontFamily: F.b, fontSize: fs(9), letterSpacing: fs(9) * 0.12, color: A, textTransform: 'uppercase' },
  fila: { paddingVertical: px(7), paddingHorizontal: px(2) },
  filaIzq: { flexDirection: 'row', alignItems: 'center', gap: px(9), flex: 1, minWidth: 0 },
  mas: { fontFamily: F.xb, fontSize: fs(15), color: A },
});
