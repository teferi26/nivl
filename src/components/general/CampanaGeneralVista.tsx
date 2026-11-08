// NIVL · General · el detalle de una campaña, rediseñado con la piel de NIVL
// (Ónix). Pura: las mismas props que CampanaVista (useCampana: datos,
// cerrojos, cobro de tareas y del botín, sin tocar la economía).
//
//   · Cabecera: volver, estandarte del rango, título, atributo y el progreso
//     en grande (hechas / total y la barra).
//   · Cifras: plazo, jefes y botín. Lo que la campaña no tiene NO se pinta:
//     sin fecha, sin plazo; sin jefes, sin jefes (así el Winter Arc, que no
//     tiene jefe ni meta, no enseña huecos ni guiones).
//   · «Botín disponible»: el velo de oro con el botón hueso, solo con
//     todo caído y la campaña abierta. Despejada: el sello y lo cobrado.
//   · El jefe final pendiente, en su propia tarjeta con presencia; después,
//     las tareas (tocar = hecha; mantener = borrar).

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Entrada, formatoMiles } from '@/components/arena';
import type { CampanaVistaProps } from '@/components/campanas/CampanaVista';
import { fechaCorta, plazo } from '@/components/campanas/plazo';
import { ink, oro, radio, vidrio } from '@/design/tokens';
import { t } from '@/i18n';
import { DIFFICULTY_LABEL, DUNGEON_CLEAR_XP, dungeonTaskXp, STAT_LABEL } from '@/lib/game';
import type { DungeonTask } from '@/lib/types';
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
} from './piezas';
import { C, F, fs, G, px } from './tema';

export function CampanaGeneralVista(p: CampanaVistaProps) {
  const d = p.campana;
  const volver = (
    <Pressable onPress={p.onVolver} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('comun:volver')} style={styles.volver}>
      <Ionicons name="chevron-back" size={20} color={G} />
    </Pressable>
  );

  if (!d) {
    return (
      <PantallaGeneral>
        <View style={styles.barraSup}>{volver}</View>
        {!p.cargado ? (
          <View style={styles.huecos} accessibilityRole="progressbar" accessibilityLabel={t('campanas:detalle.cargandoA11y')}>
            <HuecoGeneral alto={px(150)} />
            <HuecoGeneral alto={px(64)} />
            <HuecoGeneral alto={px(200)} />
          </View>
        ) : (
          <TarjetaGeneral>
            <RotuloGeneral texto={p.error ? t('general:hoy.errorRotulo') : t('campanas:detalle.noEsta')} />
            <Text style={[textoGeneral.cuerpo, styles.arriba]}>{p.error ?? t('campanas:detalle.noEstaCuerpo')}</Text>
            <BotonGeneral titulo={p.error ? t('comun:reintentar') : t('comun:volver')} fantasma fino onPress={p.error ? p.onReintentar : p.onVolver} />
          </TarjetaGeneral>
        )}
      </PantallaGeneral>
    );
  }

  const tareas = p.tareas;
  const hechas = tareas.filter((x) => x.done).length;
  const jefes = tareas.filter((x) => x.is_boss);
  const jefesCaidos = jefes.filter((x) => x.done).length;
  const todo = tareas.length > 0 && hechas === tareas.length;
  const abierta = d.status === 'active';
  const despejada = d.status === 'cleared';
  const ratio = tareas.length > 0 ? hechas / tareas.length : 0;
  const botin = DUNGEON_CLEAR_XP[d.rank];
  const fecha = plazo(d.deadline);
  const vencida = abierta && fecha.vencida;
  const jefePendiente = jefes.find((x) => !x.done) ?? null;
  const resto = tareas.filter((x) => x !== jefePendiente);

  return (
    <PantallaGeneral>
      <Entrada indice={0}>
        <View style={styles.barraSup}>
          {volver}
          <Text style={styles.eyebrow} numberOfLines={1}>
            {t('campanas:detalle.eyebrow', { rango: d.rank }).toUpperCase()}
          </Text>
        </View>
        <TarjetaGeneral heroe>
          <View style={styles.cabeza}>
            <View style={styles.estandarte}>
              <Text style={styles.estandarteLetra}>{d.rank}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.titulo} accessibilityRole="header" numberOfLines={3} maxFontSizeMultiplier={1.3}>
                {d.title}
              </Text>
              <Text style={textoGeneral.detalle}>{t('general:campana.meta', { stat: STAT_LABEL[d.stat] })}</Text>
            </View>
          </View>
          {tareas.length > 0 ? (
            <>
              <View style={styles.progresoFila}>
                <Text style={styles.progresoCifra}>{`${hechas}/${tareas.length}`}</Text>
                <Text style={textoGeneral.detalle}>{t('general:campana.tareasHechas')}</Text>
                <View style={styles.flex} />
                <Text style={styles.pct}>{`${Math.round(ratio * 100)} %`}</Text>
              </View>
              <BarraGeneral ratio={ratio} alto={px(6)} style={styles.arriba} />
            </>
          ) : null}
          {despejada ? (
            <View style={styles.sello}>
              <Ionicons name="trophy" size={px(14)} color={G} />
              <Text style={styles.selloTexto}>
                {fechaCorta(d.cleared_at) ? t('general:campana.despejadaEl', { fecha: fechaCorta(d.cleared_at) }) : t('campanas:comun.despejada')}
              </Text>
            </View>
          ) : null}
        </TarjetaGeneral>
      </Entrada>

      <Entrada indice={1}>
        <FilaCifras>
          {d.deadline && !despejada ? (
            <CifraGeneral icono={vencida ? 'alert-circle' : 'hourglass'} rotulo={vencida ? t('campanas:detalle.plazoVencido') : t('campanas:detalle.plazo')} valor={fecha.valor} nota={fecha.label} />
          ) : null}
          {jefes.length > 0 ? (
            <CifraGeneral icono="skull" rotulo={t('campanas:detalle.jefes')} valor={`${jefesCaidos}/${jefes.length}`} nota={jefesCaidos === jefes.length ? t('general:campana.caidos') : undefined} />
          ) : null}
          <CifraGeneral icono="diamond" rotulo={t('campanas:comun.botin')} valor={formatoMiles(botin)} unidad="XP" nota={t('general:campana.botinMax')} />
        </FilaCifras>
      </Entrada>

      {todo && abierta ? (
        <Entrada indice={2}>
          <View style={styles.botin}>
            <View style={styles.botinCabeza}>
              <Ionicons name="trophy" size={px(22)} color={G} />
              <Text style={styles.botinRotulo}>{t('campanas:detalle.botinDisponible').toUpperCase()}</Text>
            </View>
            <Text style={styles.botinTexto}>{hechas < 3 ? t('general:campana.botinMinimo') : t('campanas:detalle.botinCuerpo')}</Text>
            <Pressable
              onPress={p.onReclamar}
              disabled={p.ocupada}
              accessibilityRole="button"
              accessibilityLabel={t('campanas:detalle.reclamar', { xp: botin })}
              style={({ pressed }) => [styles.botinBoton, (pressed || p.ocupada) && styles.pulsado]}
            >
              <Text style={styles.botinBotonTexto}>{t('general:campana.reclamar', { xp: formatoMiles(botin) })}</Text>
            </Pressable>
          </View>
        </Entrada>
      ) : null}

      {jefePendiente ? (
        <Entrada indice={3}>
          <RotuloGeneral texto={t('campanas:detalle.jefeFinal')} em={t('campanas:detalle.hastaXp', { xp: dungeonTaskXp(jefePendiente.difficulty, true) })} seccion />
          <Pressable
            onPress={() => p.onTarea(jefePendiente)}
            onLongPress={() => p.onBorrarTarea(jefePendiente)}
            accessibilityActions={abierta && !p.ocupada ? [{ name: 'longpress', label: t('campanas:detalle.borrarTarea') }] : undefined}
            onAccessibilityAction={(e) => abierta && !p.ocupada && e.nativeEvent.actionName === 'longpress' && p.onBorrarTarea(jefePendiente)}
            disabled={!abierta || p.ocupada}
            accessibilityRole="button"
            accessibilityLabel={t('general:campana.jefeA11y', { titulo: jefePendiente.title, xp: dungeonTaskXp(jefePendiente.difficulty, true) })}
            style={({ pressed }) => [styles.jefe, pressed && styles.pulsado]}
          >
            <View style={styles.jefeIcono}>
              <Ionicons name="skull" size={px(26)} color={G} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.jefeTitulo} numberOfLines={2}>
                {jefePendiente.title}
              </Text>
              <Text style={textoGeneral.detalle}>{t('general:campana.jefeDetalle', { dificultad: DIFFICULTY_LABEL[jefePendiente.difficulty] })}</Text>
            </View>
            <Ionicons name={p.marcando === jefePendiente.id ? 'hourglass-outline' : 'ellipse-outline'} size={px(24)} color={G} />
          </Pressable>
        </Entrada>
      ) : null}

      <Entrada indice={4}>
        <RotuloGeneral
          texto={t('campanas:detalle.tareas')}
          em={abierta ? `+ ${t('campanas:detalle.anadir')}` : undefined}
          onEm={abierta ? p.onNuevaTarea : undefined}
          seccion
        />
        {tareas.length === 0 ? (
          <TarjetaGeneral>
            <Text style={textoGeneral.titulo}>{t('campanas:detalle.sinTareas')}</Text>
            <Text style={[textoGeneral.cuerpo, styles.arriba]}>{t('campanas:detalle.sinTareasCuerpo')}</Text>
            {abierta ? <BotonGeneral titulo={t('campanas:detalle.anadirPrimera')} icono="add" onPress={p.onNuevaTarea} /> : null}
          </TarjetaGeneral>
        ) : resto.length > 0 ? (
          <TarjetaGeneral style={styles.lista}>
            {resto.map((x, i) => (
              <Tarea key={x.id} tarea={x} primera={i === 0} marcando={p.marcando === x.id} activa={abierta && !p.ocupada} onPress={() => p.onTarea(x)} onLongPress={() => p.onBorrarTarea(x)} />
            ))}
          </TarjetaGeneral>
        ) : null}
        {tareas.length > 0 && abierta ? <Text style={[textoGeneral.detalle, styles.nota]}>{t('campanas:detalle.nota')}</Text> : null}
      </Entrada>

      <Entrada indice={5}>
        <BotonGeneral
          titulo={despejada ? t('campanas:detalle.borrar') : t('campanas:detalle.abandonar')}
          icono="trash-outline"
          fantasma
          fino
          onPress={p.onBorrarCampana}
          style={styles.peligro}
        />
      </Entrada>
    </PantallaGeneral>
  );
}

function Tarea({ tarea, primera, marcando, activa, onPress, onLongPress }: { tarea: DungeonTask; primera: boolean; marcando: boolean; activa: boolean; onPress: () => void; onLongPress: () => void }) {
  const xp = dungeonTaskXp(tarea.difficulty, tarea.is_boss);
  return (
    <FilaGeneral primera={primera} onPress={activa ? onPress : undefined} onLongPress={onLongPress} accessibilityLongPressLabel={t('campanas:detalle.borrarTarea')} accessibilityLabel={t('general:campana.tareaA11y', { titulo: tarea.title, xp, estado: tarea.done ? t('general:campana.hecha') : t('general:campana.pendiente') })}>
      <View style={[styles.check, tarea.done && styles.checkHecho]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {marcando ? <Ionicons name="hourglass-outline" size={px(12)} color={G} /> : tarea.done ? <Ionicons name="checkmark" size={px(13)} color={C.fondo} /> : null}
      </View>
      <View style={styles.flex}>
        <Text style={[textoGeneral.fila, tarea.done && styles.tachada]} numberOfLines={2}>
          {tarea.title}
        </Text>
        <Text style={textoGeneral.detalle}>{tarea.is_boss ? t('campanas:detalle.jefeFinal') : DIFFICULTY_LABEL[tarea.difficulty]}</Text>
      </View>
      <Text style={[styles.xp, tarea.done && styles.xpHecha]}>{t('campanas:detalle.hastaXp', { xp })}</Text>
    </FilaGeneral>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  arriba: { marginTop: px(6) },
  huecos: { gap: px(9) },
  pulsado: { opacity: 0.75 },
  barraSup: { flexDirection: 'row', alignItems: 'center', gap: px(10), marginBottom: px(8) },
  volver: { width: 40, height: 40, borderRadius: radio.pastilla, borderWidth: 1, borderColor: vidrio.borde, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: F.b, fontSize: fs(9), letterSpacing: fs(9) * 0.2, color: G, flex: 1 },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: px(12) },
  estandarte: {
    width: px(54),
    height: px(64),
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: oro.borde,
    backgroundColor: oro.fondo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estandarteLetra: { fontFamily: F.serif, fontSize: fs(26), color: oro.claro },
  titulo: { fontFamily: F.serif, fontSize: fs(18), lineHeight: Math.round(fs(18) * 1.25), color: C.blanco },
  progresoFila: { flexDirection: 'row', alignItems: 'baseline', gap: px(6), marginTop: px(12) },
  progresoCifra: { fontFamily: F.serif, fontSize: fs(22), color: C.blanco },
  pct: { fontFamily: F.serif, fontSize: fs(13), color: oro.claro },
  sello: { flexDirection: 'row', alignItems: 'center', gap: px(6), alignSelf: 'flex-start', backgroundColor: oro.fondo, borderWidth: 1, borderColor: oro.borde, borderRadius: radio.chip, paddingHorizontal: px(10), paddingVertical: px(5), marginTop: px(10) },
  selloTexto: { fontFamily: F.xb, fontSize: fs(9.5), letterSpacing: 1, color: oro.claro },
  botin: { backgroundColor: oro.fondo, borderWidth: 1, borderColor: oro.borde, borderRadius: radio.tarjeta, padding: px(14) },
  botinCabeza: { flexDirection: 'row', alignItems: 'center', gap: px(8) },
  botinRotulo: { fontFamily: F.b, fontSize: fs(11), letterSpacing: 2, color: oro.claro },
  botinTexto: { fontFamily: F.m, fontSize: fs(11), lineHeight: Math.round(fs(11) * 1.4), color: ink.ink9, marginTop: px(6) },
  botinBoton: { marginTop: px(10), minHeight: 48, borderRadius: radio.control, backgroundColor: ink.ink10, alignItems: 'center', justifyContent: 'center' },
  botinBotonTexto: { fontFamily: F.b, fontSize: 16, color: ink.ink0 },
  jefe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: px(12),
    borderRadius: radio.tarjeta,
    borderWidth: 1,
    borderColor: oro.borde,
    backgroundColor: oro.fondo,
    padding: px(13),
    marginTop: px(6),
  },
  jefeIcono: { width: px(48), height: px(48), borderRadius: radio.control, borderWidth: 1, borderColor: oro.borde, backgroundColor: vidrio.suave, alignItems: 'center', justifyContent: 'center' },
  jefeTitulo: { fontFamily: F.b, fontSize: fs(14), lineHeight: Math.round(fs(14) * 1.25), color: C.blanco },
  lista: { paddingVertical: px(3), marginTop: px(6) },
  check: { width: px(22), height: px(22), borderRadius: radio.pastilla, borderWidth: 1.5, borderColor: ink.ink6, alignItems: 'center', justifyContent: 'center' },
  checkHecho: { backgroundColor: ink.ink10, borderColor: ink.ink10 },
  tachada: { textDecorationLine: 'line-through', color: C.mudo },
  xp: { fontFamily: F.serif, fontSize: fs(10.5), color: oro.claro },
  xpHecha: { color: C.apagado },
  nota: { marginTop: px(6), marginHorizontal: px(2) },
  peligro: { marginTop: px(14), borderColor: C.borde },
});
