// NIVL · Modo GENERAL · Campañas: la lista (pura), con los datos de siempre
// (useCampanas: mismas props que CampanasVista). Arriba, las tres cifras
// (abiertas, despejadas, botín); después cada campaña abierta en su tarjeta
// con el estandarte del rango, el atributo, el progreso de sus tareas, el
// plazo y el botín que paga; el botón grande para abrir otra; y las
// despejadas, con lo que pagaron. El detalle es el de siempre con la piel de
// NIVL (src/app/dungeon/[id].tsx).

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { Entrada, formatoMiles } from '@/components/arena';
import { diasHasta } from '@/components/campanas/plazo';
import type { CampanasVistaProps } from '@/components/campanas/CampanasVista';
import { t } from '@/i18n';
import { DUNGEON_CLEAR_XP, STAT_LABEL } from '@/lib/game';
import {
  BarraGeneral,
  BotonGeneral,
  CifraGeneral,
  FilaCifras,
  FilaGeneral,
  HuecoGeneral,
  PantallaGeneral,
  RotuloGeneral,
  TarjetaGeneral,
  textoGeneral,
  TituloGeneral,
} from './piezas';
import { C, F, fs, G, oroA, oroMezcla, px } from './tema';

export function CampanasGeneralVista(p: CampanasVistaProps) {
  const abiertas = p.campanas
    .filter((c) => c.status === 'active')
    .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
  const despejadas = p.campanas.filter((c) => c.status === 'cleared');
  const botin = despejadas.reduce((s, c) => s + DUNGEON_CLEAR_XP[c.rank], 0);
  const titulo = p.titulo ?? t('general:campanas.titulo');

  return (
    <PantallaGeneral>
      <Entrada indice={0}>
        <TituloGeneral eyebrow={t('general:campanas.eyebrow')} titulo={titulo.toUpperCase()} />
        <Text style={[textoGeneral.detalle, styles.sub]}>{p.subtitulo}</Text>
      </Entrada>

      {!p.cargado ? (
        <View accessibilityRole="progressbar" accessibilityLabel={t('campanas:lista.cargandoA11y')} style={styles.huecos}>
          <HuecoGeneral alto={px(64)} />
          <HuecoGeneral alto={px(130)} />
          <HuecoGeneral alto={px(130)} />
        </View>
      ) : p.error && p.campanas.length === 0 ? (
        <TarjetaGeneral>
          <RotuloGeneral texto={t('general:hoy.errorRotulo')} />
          <Text style={[textoGeneral.cuerpo, styles.arriba]}>{p.error}</Text>
          <BotonGeneral titulo={t('comun:reintentar')} fantasma fino onPress={p.onReintentar} />
        </TarjetaGeneral>
      ) : (
        <>
          <Entrada indice={1}>
            <FilaCifras>
              <CifraGeneral icono="flag" rotulo={t('campanas:lista.abiertas')} valor={String(abiertas.length)} />
              <CifraGeneral icono="checkmark-done" rotulo={t('campanas:lista.despejadas')} valor={String(despejadas.length)} />
              <CifraGeneral icono="diamond" rotulo={t('campanas:comun.botin')} valor={formatoMiles(botin)} unidad="XP" />
            </FilaCifras>
          </Entrada>

          <Entrada indice={2}>
            <RotuloGeneral texto={t('general:campanas.enCurso')} em={abiertas.length > 0 ? String(abiertas.length) : undefined} seccion />
          </Entrada>
          {abiertas.length === 0 ? (
            <TarjetaGeneral heroe>
              <Text style={textoGeneral.titulo}>{t('general:campanas.vacioTitulo')}</Text>
              <Text style={[textoGeneral.cuerpo, styles.arriba]}>{t('general:campanas.vacioCuerpo')}</Text>
            </TarjetaGeneral>
          ) : (
            abiertas.map((c, i) => {
              const plazo = diasHasta(c.deadline);
              const ratio = c.total > 0 ? c.doneCount / c.total : 0;
              return (
                <Entrada key={c.id} indice={Math.min(3 + i, 8)}>
                  <TarjetaGeneral
                    heroe={i === 0}
                    onPress={() => p.onAbrir(c.id)}
                    accessibilityLabel={t('general:campanas.a11y', { titulo: c.title, rango: c.rank, hechas: c.doneCount, total: c.total, xp: DUNGEON_CLEAR_XP[c.rank] })}
                  >
                    <View style={styles.cabeza}>
                      <View style={styles.estandarte}>
                        <Text style={styles.estandarteLetra}>{c.rank}</Text>
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.nombre} numberOfLines={2} maxFontSizeMultiplier={1.35}>
                          {c.title}
                        </Text>
                        <Text style={textoGeneral.detalle} numberOfLines={1}>
                          {t('general:campanas.meta', { stat: STAT_LABEL[c.stat], rango: c.rank })}
                        </Text>
                      </View>
                      {plazo ? (
                        <View style={[styles.plazo, plazo.urgente && styles.plazoUrgente]}>
                          <Text style={[styles.plazoTexto, plazo.urgente && styles.plazoTextoUrgente]} numberOfLines={1}>
                            {plazo.texto}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.progreso}>
                      <BarraGeneral ratio={ratio} alto={px(5)} style={styles.flex} />
                      <Text style={styles.cuenta}>{c.total > 0 ? `${c.doneCount}/${c.total}` : t('general:campanas.sinTareas')}</Text>
                    </View>
                    <View style={styles.pie}>
                      <Ionicons name="diamond-outline" size={px(11)} color={G} />
                      <Text style={textoGeneral.oro}>{t('general:campanas.botinXp', { xp: formatoMiles(DUNGEON_CLEAR_XP[c.rank]) })}</Text>
                      <View style={styles.flex} />
                      <Text style={textoGeneral.detalle}>{t('general:campanas.abrir')}</Text>
                      <Ionicons name="chevron-forward" size={px(12)} color={C.suave} />
                    </View>
                  </TarjetaGeneral>
                </Entrada>
              );
            })
          )}

          <BotonGeneral titulo={t('campanas:hojas.abrirCampana')} icono="add" onPress={p.onNueva} style={styles.nueva} />

          {despejadas.length > 0 ? (
            <Entrada indice={8}>
              <RotuloGeneral texto={t('campanas:lista.despejadas')} em={t('general:campanas.botinXp', { xp: formatoMiles(botin) })} seccion />
              <TarjetaGeneral>
                {despejadas.map((c, i) => (
                  <FilaGeneral key={c.id} primera={i === 0} onPress={() => p.onAbrir(c.id)} accessibilityLabel={c.title}>
                    <Ionicons name="checkmark-circle" size={px(16)} color={G} />
                    <Text style={[textoGeneral.fila, styles.flex]} numberOfLines={1}>
                      {c.title}
                    </Text>
                    <Text style={textoGeneral.oro}>{`+${formatoMiles(DUNGEON_CLEAR_XP[c.rank])} XP`}</Text>
                  </FilaGeneral>
                ))}
              </TarjetaGeneral>
            </Entrada>
          ) : null}
        </>
      )}
    </PantallaGeneral>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  arriba: { marginTop: px(6) },
  sub: { marginTop: px(2) },
  huecos: { gap: px(9) },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: px(10) },
  estandarte: {
    width: px(38),
    height: px(44),
    borderTopLeftRadius: px(6),
    borderTopRightRadius: px(6),
    borderBottomLeftRadius: px(14),
    borderBottomRightRadius: px(14),
    borderWidth: 1.5,
    borderColor: G,
    backgroundColor: oroMezcla(0.14, C.fondo),
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0px 0px 10px ${oroA(0.35)}`,
  },
  estandarteLetra: { fontFamily: 'Cinzel_900Black', fontSize: fs(17), color: G },
  nombre: { fontFamily: F.b, fontSize: fs(13), lineHeight: Math.round(fs(13) * 1.25), color: C.blanco },
  plazo: { borderRadius: px(7), borderWidth: 1, borderColor: C.borde, paddingHorizontal: px(7), paddingVertical: px(3) },
  plazoUrgente: { borderColor: G, backgroundColor: oroMezcla(0.15, C.tarjeta) },
  plazoTexto: { fontFamily: F.b, fontSize: fs(8.5), color: C.suave },
  plazoTextoUrgente: { color: G },
  progreso: { flexDirection: 'row', alignItems: 'center', gap: px(8), marginTop: px(10) },
  cuenta: { fontFamily: F.b, fontSize: fs(10), color: C.blanco },
  pie: { flexDirection: 'row', alignItems: 'center', gap: px(5), marginTop: px(8) },
  nueva: { marginTop: px(4) },
});
