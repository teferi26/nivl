// NIVL · Modo GENERAL · Hoy (Ónix). Pura: los datos son los de useHoy (los
// mismos de siempre, sin tocar la economía) y lo demás llega por props.
//
// Jerarquía, de arriba abajo (una pantalla que se lee en tres segundos):
//   0 · La cabecera: emblema, NIVL, el modo y el perfil.
//   1 · El nivel global: escudo, rango, título, barra de oro y XP.
//   2 · Avisos del sistema (fallo, pausa, informe del cierre).
//   3 · Tu coach: lo que dice hoy, un toque para hablar con él.
//   4 · AHORA: la misión que toca, con el botón hueso.
//   5 · Las cifras: racha, piedras y misiones de hoy.
//   6 · Misiones de hoy (la lista entera, QuestItem y CompletarSheet).
//   7 · Tu arsenal: los modos, un toque para equiparlos.
//   8 · El orden del día del coach.
//   9 · Campaña activa y duelo de la semana.
//  10 · Todo desde aquí: gimnasio, dieta, cardio, foco, exámenes, economía…

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Entrada } from '@/components/arena';
import type { HoyVistaProps } from '@/components/hoy/HoyVista';
import { Duelo } from '@/components/hoy/Duelo';
import { TarjetasPrimerUso } from '@/components/hoy/TarjetasPrimerUso';
import { OrdenDelDia } from '@/components/OrdenDelDia';
import { QuestItem } from '@/components/QuestItem';
import { SkeletonRows } from '@/components/ui';
import { ink, oro, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { DIFFICULTY_LABEL, questXp } from '@/lib/game';
import { TodoDesdeAqui, type AccesoGeneral } from './Arsenal';
import { CabeceraGeneral, HeroeNivel } from './CabeceraGeneral';
import { BarraGeneral, BotonGeneral, CifraGeneral, FilaCifras, HuecoGeneral, PantallaGeneral, RotuloGeneral, TarjetaGeneral, textoGeneral } from './piezas';
import { G, px } from './tema';

export interface CampanaActivaHoy {
  id: string;
  titulo: string;
  hechas: number;
  total: number;
  /** «12 días», «Hoy»… o null sin fecha. */
  plazo: string | null;
  rango: string;
}

export interface HoyGeneralVistaProps {
  hoy: Pick<HoyVistaProps, 'estado' | 'error' | 'datos' | 'ocupada' | 'refrescando' | 'preparandoTarjeta' | 'acciones'>;
  emblema?: ReactNode;
  /** ArsenalConectado (en la galería, ArsenalModos con datos de mentira). */
  arsenal?: ReactNode;
  /** null = sin campaña abierta; undefined = aún no se sabe. */
  campana?: CampanaActivaHoy | null;
  ir: {
    perfil: () => void;
    progresion: () => void;
    coach: () => void;
    habitos: () => void;
    campana: (id: string) => void;
    campanas: () => void;
    acceso: (a: AccesoGeneral) => void;
  };
}

export function HoyGeneralVista({ hoy, emblema, arsenal, campana, ir }: HoyGeneralVistaProps) {
  const { estado, error, datos: d, ocupada, refrescando, preparandoTarjeta, acciones } = hoy;
  const cargando = estado === 'cargando';
  const h = d.hero;
  const siguiente = d.misiones.find((m) => m.siguiente && !m.hecha) ?? null;
  const xpSiguiente = siguiente ? questXp(siguiente.quest, { evidence: false, streakDays: d.diasMultiplicador }) : 0;

  return (
    <PantallaGeneral refreshing={refrescando} onRefresh={acciones.onRefrescar}>
      <Entrada indice={0}>
        <CabeceraGeneral emblema={emblema} onPerfil={ir.perfil} />
      </Entrada>

      <Entrada indice={1}>
        <HeroeNivel
          datos={cargando || !h ? null : { ...h, misiones: h.misiones }}
          onPress={ir.progresion}
        />
      </Entrada>

      {/* 2 · Avisos */}
      {error ? (
        <TarjetaGeneral>
          <RotuloGeneral texto={t('general:hoy.errorRotulo')} />
          <Text style={[textoGeneral.cuerpo, styles.arriba]}>{error}</Text>
          <BotonGeneral titulo={t('comun:reintentar')} fantasma fino onPress={acciones.onReintentar} />
        </TarjetaGeneral>
      ) : null}
      {!cargando && d.pausa ? (
        <TarjetaGeneral>
          <RotuloGeneral texto={t('hoy:vista.pausaRotulo')} />
          <Text style={[textoGeneral.cuerpo, styles.arriba]}>{d.pausa}</Text>
        </TarjetaGeneral>
      ) : null}
      {!cargando && d.cierre ? (
        <TarjetaGeneral heroe={d.cierre.alerta}>
          <RotuloGeneral texto={d.cierre.alerta ? t('hoy:vista.alertaRotulo') : t('hoy:vista.informeRotulo')} />
          {d.cierre.lineas.map((l) => (
            <Text key={l} style={[textoGeneral.cuerpo, styles.arriba]}>
              {l}
            </Text>
          ))}
        </TarjetaGeneral>
      ) : null}

      {/* 3 · Tu coach */}
      {/* Lo que antes se pedía al entrar: solo cuando ya ha hecho algo. */}
      <TarjetasPrimerUso listo={d.hechas > 0} />
      <Entrada indice={2}>
        <TarjetaGeneral onPress={ir.coach} accessibilityLabel={t('general:coach.a11y')}>
          <RotuloGeneral texto={t('general:coach.rotulo')} em={t('general:coach.enLinea')} oro />
          <Text style={styles.coachTexto} maxFontSizeMultiplier={1.6}>
            {h?.linea || t('general:coach.porDefecto')}
          </Text>
          <View style={styles.coachPie}>
            <Text style={[textoGeneral.detalle, styles.flex]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
              {t('general:coach.preguntar')}
            </Text>
            <Ionicons name="arrow-forward" size={15} color={G} />
          </View>
        </TarjetaGeneral>
      </Entrada>

      {/* 4 · Ahora */}
      {cargando ? (
        <HuecoGeneral alto={px(130)} />
      ) : siguiente ? (
        <Entrada indice={3}>
          <TarjetaGeneral>
            <RotuloGeneral texto={t('general:hoy.siguiente')} em={t('general:hoy.xp', { xp: xpSiguiente })} />
            <Text style={styles.ahora} numberOfLines={3} maxFontSizeMultiplier={1.4}>
              {siguiente.quest.title}
            </Text>
            <Text style={textoGeneral.detalle} maxFontSizeMultiplier={1.4}>
              {DIFFICULTY_LABEL[siguiente.quest.difficulty]}
            </Text>
            <BotonGeneral
              titulo={t('general:hoy.completar')}
              icono="checkmark"
              onPress={() => acciones.onCompletar(siguiente.quest)}
              ocupado={ocupada === siguiente.quest.id}
              desactivado={siguiente.bloqueada}
            />
          </TarjetaGeneral>
        </Entrada>
      ) : d.celebrando ? (
        <TarjetaGeneral>
          <RotuloGeneral texto={t('hoy:vista.perfectoRotulo')} em={`${d.hechas}/${d.total}`} />
          <Text style={[textoGeneral.cuerpo, styles.arriba]}>{t('hoy:vista.perfectoCuerpo', { count: d.racha.valor })}</Text>
          <BotonGeneral titulo={t('comun:compartir')} icono="share-social-outline" onPress={acciones.onCompartirDia} ocupado={preparandoTarjeta} />
        </TarjetaGeneral>
      ) : d.total === 0 && !error ? (
        <TarjetaGeneral>
          <RotuloGeneral texto={t('general:hoy.siguiente')} />
          <Text style={styles.ahora}>{t('hoy:vista.vacioTitulo')}</Text>
          <Text style={textoGeneral.detalle}>{d.esPro === true ? t('hoy:vista.vacioCuerpoPro') : t('hoy:vista.vacioCuerpo')}</Text>
          <BotonGeneral titulo={t('hoy:vista.irAHabitos')} icono="add" onPress={ir.habitos} />
        </TarjetaGeneral>
      ) : null}

      {/* 5 · Las cifras */}
      {cargando || !h ? (
        <HuecoGeneral alto={68} />
      ) : (
        <Entrada indice={4}>
          <FilaCifras>
            <CifraGeneral rotulo={t('general:heroe.racha')} valor={String(h.racha)} />
            <CifraGeneral rotulo={t('general:heroe.piedras')} valor={String(h.piedras)} />
            <CifraGeneral rotulo={t('general:heroe.hoy')} valor={h.misiones || '0'} />
          </FilaCifras>
        </Entrada>
      )}

      {/* 6 · Misiones de hoy */}
      {cargando || d.total > 0 ? (
        <Entrada indice={5}>
          <RotuloGeneral
            texto={t('hoy:vista.misionesDeHoy')}
            em={cargando ? undefined : t('general:hoy.deTotal', { hechas: d.hechas, total: d.total })}
            seccion
          />
          <TarjetaGeneral style={styles.lista}>
            {cargando ? (
              <View accessibilityRole="progressbar" accessibilityLabel={t('hoy:vista.cargandoMisionesA11y')}>
                <SkeletonRows rows={3} />
              </View>
            ) : (
              d.misiones.map((m) => (
                <QuestItem
                  key={m.quest.id}
                  quest={m.quest}
                  completed={m.hecha}
                  xpAwarded={m.xpPagado}
                  busy={ocupada === m.quest.id}
                  streakDays={d.diasMultiplicador}
                  onComplete={acciones.onCompletar}
                  bloqueada={m.bloqueada}
                  // La siguiente ya va arriba, en grande: aquí no se invierte otra vez.
                  siguiente={false}
                />
              ))
            )}
            {!cargando && d.notaPendiente ? <Text style={[textoGeneral.detalle, styles.nota]}>{d.notaPendiente.texto}</Text> : null}
            <BotonGeneral titulo={t('general:hoy.gestionar')} fantasma fino icono="options-outline" onPress={ir.habitos} style={styles.gestionar} />
          </TarjetaGeneral>
        </Entrada>
      ) : null}

      {/* 7 · Tu arsenal */}
      {arsenal ? <Entrada indice={6}>{arsenal}</Entrada> : null}

      {/* 8 · El orden del día */}
      {!cargando && d.orden ? (
        <Entrada indice={7}>
          <TarjetaGeneral>
            <OrdenDelDia plan={d.orden.plan} bloques={d.orden.bloques} onToggle={acciones.onAlternarBloque} pro={d.orden.pro} />
          </TarjetaGeneral>
        </Entrada>
      ) : null}

      {/* 9 · Campaña activa y duelo */}
      {campana === undefined ? null : (
        <Entrada indice={8}>
          {campana ? (
            <TarjetaGeneral onPress={() => ir.campana(campana.id)} accessibilityLabel={t('general:hoy.campanaA11y', { titulo: campana.titulo, hechas: campana.hechas, total: campana.total })}>
              <View style={styles.campana}>
                <View style={styles.flex}>
                  <Text style={styles.eyebrow} maxFontSizeMultiplier={1.3}>
                    {t('general:hoy.campanaActiva')}
                  </Text>
                  <Text style={styles.campanaTitulo} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                    {campana.titulo}
                  </Text>
                </View>
                <View style={styles.campanaDer}>
                  <Text style={styles.campanaCifra} maxFontSizeMultiplier={1.3}>
                    {campana.total > 0 ? `${campana.hechas}/${campana.total}` : campana.rango}
                  </Text>
                  {campana.plazo ? (
                    <Text style={styles.campanaPlazo} maxFontSizeMultiplier={1.3}>
                      {campana.plazo}
                    </Text>
                  ) : null}
                </View>
              </View>
              {campana.total > 0 ? <BarraGeneral ratio={campana.hechas / campana.total} style={styles.arriba} /> : null}
            </TarjetaGeneral>
          ) : (
            <TarjetaGeneral onPress={ir.campanas} accessibilityLabel={t('general:hoy.sinCampana')}>
              <View style={styles.campana}>
                <View style={styles.flex}>
                  <Text style={styles.eyebrow}>{t('general:hoy.campanaActiva')}</Text>
                  <Text style={textoGeneral.cuerpo}>{t('general:hoy.sinCampana')}</Text>
                </View>
                <Text style={textoGeneral.oro}>{t('general:hoy.abrir')}</Text>
              </View>
            </TarjetaGeneral>
          )}
        </Entrada>
      )}
      {!cargando && d.duelo ? (
        <Entrada indice={8}>
          <TarjetaGeneral>
            <Duelo duelo={d.duelo} />
          </TarjetaGeneral>
        </Entrada>
      ) : null}

      {/* 10 · Todo desde aquí */}
      <Entrada indice={8}>
        <TodoDesdeAqui onIr={ir.acceso} />
      </Entrada>
    </PantallaGeneral>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  arriba: { marginTop: px(6) },
  lista: { paddingVertical: px(4) },
  nota: { marginTop: px(6) },
  gestionar: { marginTop: px(8), marginBottom: px(6) },
  ahora: { fontFamily: tipo.label.family, fontSize: 24, lineHeight: 29, letterSpacing: -0.3, color: ink.ink9, marginTop: 7 },
  eyebrow: { fontFamily: tipo.label.family, fontSize: tipo.label.size, lineHeight: tipo.label.lineHeight, letterSpacing: tipo.label.tracking, color: ink.ink8, textTransform: 'uppercase' },
  campana: { flexDirection: 'row', alignItems: 'center', gap: px(10) },
  campanaTitulo: { fontFamily: tipo.label.family, fontSize: 16, lineHeight: 21, color: ink.ink9, marginTop: px(3) },
  campanaDer: { alignItems: 'flex-end' },
  campanaCifra: { fontFamily: tipo.number.family, fontSize: 20, lineHeight: 25, color: oro.claro },
  campanaPlazo: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, lineHeight: tipo.micro.lineHeight, color: ink.ink8 },
  coachTexto: { fontFamily: tipo.micro.family, fontSize: 16, lineHeight: 22, color: ink.ink9, marginTop: 5 },
  coachPie: { flexDirection: 'row', alignItems: 'center', gap: px(8), marginTop: 8 },
});
