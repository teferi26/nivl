// NIVL · La vista del detalle de una campaña (L-RADICAL §B.7 y §C): pura,
// solo props. Los datos, los cerrojos y la celebración viven en useCampana;
// la galería (/kit/pantallas) la pinta con datos de mentira (demo.tsx).
//
// Composición de la arena: encabezado grabado con el estandarte de 72 a la
// derecha y el meandro; el plazo en una losa (trama si ya venció, piedra si
// no) con la franja de cifras; el avance en una barra segmentada; las tareas
// en filas con hairline, y el jefe final con la galea. La única inversión es
// el botín: la tarjeta blanca de «Reclamar botín», y solo cuando todas las
// tareas han caído. Por eso «Añadir tarea» va como acción de la sección y no
// como botón sólido en el encabezado.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Barra, EncabezadoArena, Entrada, FranjaCifras, Galea, Meandro, TarjetaArena, formatoMiles } from '@/components/arena';
import { Button, Check, EmptyState, Row, Screen, Section, Skeleton, SkeletonRows, Tag } from '@/components/ui';
import { SIN_DATO } from '@/components/ui/sinDato';
import { ink, space, type as tipo } from '@/design/tokens';
import { DIFFICULTY_LABEL, DUNGEON_CLEAR_XP, dungeonTaskXp } from '@/lib/game';
import type { Dungeon, DungeonTask } from '@/lib/types';
import { voice } from '@/lib/voice';
import { Estandarte, grosorDeRango } from './Estandarte';
import { fechaCorta, plazo } from './plazo';

export interface CampanaVistaProps {
  cargado: boolean;
  error: string | null;
  /** null: cargando, fallo o borrada. */
  campana: Dungeon | null;
  tareas: DungeonTask[];
  /** Tarea que se está cobrando (su Check gira). */
  marcando: string | null;
  /** Hay un cobro en vuelo (tarea o botín). */
  ocupada: boolean;
  onVolver: () => void;
  onReintentar: () => void;
  onNuevaTarea: () => void;
  onTarea: (t: DungeonTask) => void;
  onBorrarTarea: (t: DungeonTask) => void;
  onReclamar: () => void;
  onBorrarCampana: () => void;
}

/** Hasta aquí el título va en Cinzel grande; luego Cinzel menor; y pasado el tope, en Outfit. */
const TITULO_GRANDE = 14;
const TITULO_LARGO = 28;
/** Más de 20 cortes en la barra ya no se leen. */
const MAX_SEGMENTOS = 20;

export function CampanaVista(p: CampanaVistaProps) {
  const d = p.campana;
  // La frase del sistema se elige una vez por campaña, no en cada render.
  const tituloCampana = d?.title;
  const fraseDespejada = useMemo(() => (tituloCampana ? voice.dungeonCleared(tituloCampana) : ''), [tituloCampana]);

  if (!d) {
    // Cargando: huecos. Fallo: el motivo y una salida. Nunca un "un momento"
    // que no acaba.
    return (
      <Screen>
        {p.cargado ? (
          <EncabezadoArena onVolver={p.onVolver} eyebrow="Campaña" titulo="Campaña" meandro />
        ) : (
          // Cargando: el título en hueco, no un «ABRIENDO» que luego cambia.
          <View style={styles.cabecera}>
            <Pressable
              onPress={p.onVolver}
              style={({ pressed }) => [styles.volver, pressed && styles.pulsado]}
              accessibilityRole="button"
              accessibilityLabel="Volver"
            >
              <Ionicons name="arrow-back" size={20} color={ink.ink9} />
            </Pressable>
            <Text style={styles.eyebrow} maxFontSizeMultiplier={1.35} numberOfLines={1}>
              Campaña
            </Text>
            <Skeleton height={tipo.rank.lineHeight} width={220} />
            <Meandro alto={8} style={styles.meandro} />
          </View>
        )}
        {!p.cargado ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Cargando la campaña">
            <Skeleton height={116} style={styles.skCard} />
            <Skeleton height={11} width={90} style={styles.skEyebrow} />
            <SkeletonRows rows={4} />
          </View>
        ) : (
          <TarjetaArena variante="contorno">
            <EmptyState
              compact
              icon={p.error ? 'cloud-offline-outline' : 'flag-outline'}
              title={p.error ? 'El sistema no responde' : 'La campaña no está'}
              body={p.error ?? 'Puede que se haya borrado desde otro dispositivo.'}
              action={p.error ? { label: 'Reintentar', onPress: p.onReintentar } : { label: 'Volver', onPress: p.onVolver }}
            />
          </TarjetaArena>
        )}
      </Screen>
    );
  }

  const tasks = p.tareas;
  const done = tasks.filter((t) => t.done).length;
  const bosses = tasks.filter((t) => t.is_boss);
  const bossesDone = bosses.filter((t) => t.done).length;
  const allDone = tasks.length > 0 && done === tasks.length;
  const active = d.status === 'active';
  const cleared = d.status === 'cleared';
  const ratio = tasks.length > 0 ? done / tasks.length : 0;
  const loot = DUNGEON_CLEAR_XP[d.rank];
  const fecha = plazo(d.deadline);
  const vencida = active && fecha.vencida;

  const subtitulo = cleared
    ? `Despejada${fechaCorta(d.cleared_at) ? ` el ${fechaCorta(d.cleared_at)}` : ''}. Botín cobrado: +${loot} XP.`
    : tasks.length === 0
      ? `Entrena ${d.stat}. Botín al despejar: ${loot} XP.`
      : allDone
        ? 'Todas las tareas hechas. El botín espera.'
        : `${done}/${tasks.length} tareas · entrena ${d.stat} · botín ${loot} XP`;

  const jefes = {
    valor: bosses.length > 0 ? `${bossesDone}/${bosses.length}` : SIN_DATO,
    rotulo: 'Jefes',
    etiqueta: bosses.length > 0 ? `Jefes: ${bossesDone} de ${bosses.length}` : 'Jefes: ninguno',
  };

  return (
    <Screen>
      <Entrada indice={0}>
        <CabeceraCampana
          titulo={d.title}
          eyebrow={`Campaña · Rango ${d.rank}`}
          subtitulo={subtitulo}
          rango={d.rank}
          onVolver={p.onVolver}
        />
      </Entrada>

      {cleared ? (
        <Entrada indice={1} style={styles.bloque}>
          {/* Despejada: el grano va solo aquí (una textura por pantalla, SISTEMA §0). */}
          <TarjetaArena variante="grano" rotulo="Campaña despejada" meta={fechaCorta(d.cleared_at) ?? undefined}>
            <Text style={styles.frase}>{fraseDespejada}</Text>
            <View style={styles.franjaDentro}>
              <FranjaCifras
                cifras={[
                  { valor: `${done}/${tasks.length}`, rotulo: 'Tareas', etiqueta: `Tareas: ${done} de ${tasks.length}` },
                  jefes,
                  { valor: loot, rotulo: 'Botín', sufijo: ' XP', etiqueta: `Botín cobrado: ${formatoMiles(loot)} XP` },
                ]}
              />
            </View>
          </TarjetaArena>
        </Entrada>
      ) : (
        <Entrada indice={1} style={styles.bloque}>
          <TarjetaArena
            variante={vencida ? 'trama' : 'piedra'}
            rotulo={vencida ? 'Plazo vencido' : 'Plazo'}
            meta={fechaCorta(d.deadline) ?? 'Sin fecha'}
          >
            <FranjaCifras
              cifras={[
                {
                  valor: fecha.valor,
                  rotulo: fecha.label,
                  etiqueta: d.deadline ? `${fecha.label}: ${fecha.valor}` : 'Sin fecha límite',
                },
                jefes,
                { valor: loot, rotulo: 'Botín', sufijo: ' XP', etiqueta: `Botín al despejar: ${formatoMiles(loot)} XP` },
              ]}
            />
          </TarjetaArena>
        </Entrada>
      )}

      {tasks.length > 0 ? (
        <Entrada indice={2} style={styles.bloque}>
          <View style={styles.avancePie}>
            <Text style={[styles.micro, styles.mayus]}>
              {done}/{tasks.length} tareas
            </Text>
            <Text style={styles.pct} maxFontSizeMultiplier={1.35}>
              {Math.round(ratio * 100)}%
            </Text>
          </View>
          <Barra
            ratio={ratio}
            alto={6}
            segmentos={Math.min(tasks.length, MAX_SEGMENTOS)}
            etiqueta={`Avance de la campaña: ${done} de ${tasks.length} tareas`}
          />
        </Entrada>
      ) : null}

      {allDone && active ? (
        <Entrada indice={3} style={styles.bloque}>
          {/* La única inversión de la pantalla: el Button primario de dentro
              se invierte solo (SuperficieContext) y queda negro sobre blanco. */}
          <TarjetaArena variante="invertida" remaches rotulo="Botín disponible" meta={`+${formatoMiles(loot)} XP`}>
            <Text style={styles.botinTexto}>Cada tarea y cada jefe han caído. Reclama lo que es tuyo.</Text>
            <Button
              title={`Reclamar botín · +${loot} XP`}
              size="lg"
              onPress={p.onReclamar}
              loading={p.ocupada}
              icon="trophy-outline"
              style={styles.botinBoton}
            />
          </TarjetaArena>
        </Entrada>
      ) : null}

      <Entrada indice={4}>
        <Section
          title="Tareas"
          meta={tasks.length > 0 ? `${done}/${tasks.length}` : undefined}
          action={active && tasks.length > 0 ? { label: 'Añadir', icon: 'add', onPress: p.onNuevaTarea } : undefined}
        >
          {tasks.length === 0 ? (
            <TarjetaArena variante="contorno">
              <EmptyState
                compact
                icon="list-outline"
                title="Sin tareas todavía"
                body="Desglosa la campaña: cada tarea es un paso y cada hito, un jefe que paga el doble."
                action={active ? { label: 'Añadir la primera', onPress: p.onNuevaTarea } : undefined}
              />
            </TarjetaArena>
          ) : (
            <View>
              {tasks.map((t, i) => {
                const fila = (
                  <FilaTarea
                    tarea={t}
                    primera={i === 0 || (t.is_boss && !t.done)}
                    marcando={p.marcando === t.id}
                    onPress={() => p.onTarea(t)}
                    onLongPress={() => p.onBorrarTarea(t)}
                  />
                );
                // El jefe final pendiente se siente jefe: losa de piedra con
                // marco 2 y la galea grande. Caído, vuelve a la lista.
                return t.is_boss && !t.done ? (
                  <TarjetaArena key={t.id} variante="piedra" marco={2} style={styles.jefe}>
                    {fila}
                  </TarjetaArena>
                ) : (
                  <View key={t.id}>{fila}</View>
                );
              })}
            </View>
          )}
          {tasks.length > 0 && active ? (
            <Text style={styles.nota}>Toca una tarea para darla por hecha. Mantén pulsada para eliminarla.</Text>
          ) : null}
        </Section>
      </Entrada>

      <Entrada indice={5}>
        <Button
          title={cleared ? 'Borrar la campaña' : 'Abandonar la campaña'}
          variant="danger"
          icon="trash-outline"
          onPress={p.onBorrarCampana}
        />
      </Entrada>
    </Screen>
  );
}

/** Una tarea: Check, título y XP. El jefe final lleva la galea y su placa. */
function FilaTarea({
  tarea: t,
  primera,
  marcando,
  onPress,
  onLongPress,
}: {
  tarea: DungeonTask;
  primera: boolean;
  marcando: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const xp = dungeonTaskXp(t.difficulty, t.is_boss);
  return (
    <Row
      first={primera}
      leading={<Check checked={t.done} busy={marcando} />}
      title={t.title}
      titleAddon={t.is_boss ? <Galea kind="casco" size={t.done ? 20 : 32} color={t.done ? ink.ink6 : ink.ink10} /> : undefined}
      done={t.done}
      detail={
        <View style={styles.tareaMeta}>
          {t.is_boss ? <Tag tone="dim">Jefe final</Tag> : null}
          <Text style={styles.micro}>{DIFFICULTY_LABEL[t.difficulty]}</Text>
        </View>
      }
      trailing={
        <Text style={[styles.xp, t.done && styles.xpHecha]} maxFontSizeMultiplier={1.35}>
          +{xp}
          <Text style={styles.xpUnidad}> XP</Text>
        </Text>
      }
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={t.done}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: t.done, disabled: t.done }}
      accessibilityLabel={`${t.title}${t.is_boss ? ', jefe final' : ''}${t.done ? ', hecha' : `, pendiente, ${xp} XP`}. Mantén pulsado para eliminarla.`}
    />
  );
}

/**
 * El encabezado del detalle. Como EncabezadoArena, pero el título se adapta a
 * su largo: un nombre de campaña corto se graba en Cinzel 32; uno medio, en
 * Cinzel 22; y pasado de 28 caracteres, en `headline` Outfit (en Cinzel
 * mayúscula no cabría junto al estandarte a 375).
 */
function CabeceraCampana({
  titulo,
  eyebrow,
  subtitulo,
  rango,
  onVolver,
}: {
  titulo: string;
  eyebrow: string;
  subtitulo: string;
  rango: Dungeon['rank'];
  onVolver: () => void;
}) {
  const largo = titulo.length;
  const estiloTitulo =
    largo <= TITULO_GRANDE ? styles.tituloGrande : largo <= TITULO_LARGO ? styles.tituloMedio : styles.tituloLargo;
  return (
    <View style={styles.cabecera}>
      <Pressable
        onPress={onVolver}
        style={({ pressed }) => [styles.volver, pressed && styles.pulsado]}
        accessibilityRole="button"
        accessibilityLabel="Volver"
      >
        <Ionicons name="arrow-back" size={20} color={ink.ink9} />
      </Pressable>
      <View style={styles.cabeceraFila}>
        <View style={styles.cabeceraTextos}>
          <Text style={styles.eyebrow} maxFontSizeMultiplier={1.35} numberOfLines={1}>
            {eyebrow}
          </Text>
          <Text style={estiloTitulo} accessibilityRole="header" maxFontSizeMultiplier={1.35} numberOfLines={3}>
            {largo <= TITULO_LARGO ? titulo.toUpperCase() : titulo}
          </Text>
        </View>
        <Estandarte letra={rango} ancho={72} grosor={grosorDeRango(rango)} accessibilityLabel={`Rango ${rango}`} />
      </View>
      <Text style={styles.subtitulo} maxFontSizeMultiplier={1.35}>
        {subtitulo}
      </Text>
      <Meandro alto={8} style={styles.meandro} />
    </View>
  );
}

const styles = StyleSheet.create({
  skEyebrow: { marginBottom: space.s3, marginTop: space.s4 },
  skCard: { marginBottom: space.s3 },
  bloque: { marginBottom: space.s6 },
  jefe: { marginVertical: space.s3 },
  cabecera: { marginBottom: space.s6 },
  volver: {
    width: 44,
    height: 44,
    marginLeft: -space.s3,
    marginBottom: space.s1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsado: { opacity: 0.7 },
  cabeceraFila: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s4 },
  cabeceraTextos: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
    marginBottom: space.s2,
  },
  tituloGrande: {
    fontFamily: tipo.rank.family,
    fontSize: tipo.rank.size,
    lineHeight: tipo.rank.lineHeight,
    letterSpacing: tipo.rank.tracking,
    color: ink.ink10,
  },
  tituloMedio: {
    fontFamily: tipo.rank.family,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 2,
    color: ink.ink10,
  },
  tituloLargo: {
    fontFamily: tipo.headline.family,
    fontSize: tipo.headline.size,
    lineHeight: tipo.headline.lineHeight,
    letterSpacing: tipo.headline.tracking,
    color: ink.ink10,
  },
  subtitulo: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s3,
  },
  meandro: { marginTop: space.s4 },
  frase: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
  franjaDentro: { marginTop: space.s4 },
  avancePie: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space.s2 },
  micro: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
  },
  mayus: { textTransform: 'uppercase' },
  pct: { fontFamily: tipo.number.family, fontSize: 14, lineHeight: 18, color: ink.ink10 },
  // Sobre la invertida (blanca): texto en ink0 (ink6 no llega sobre blanco).
  botinTexto: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink0 },
  botinBoton: { marginTop: space.s4 },
  tareaMeta: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  xp: { fontFamily: tipo.number.family, fontSize: 16, lineHeight: 20, color: ink.ink6 },
  xpHecha: { color: ink.ink10 },
  xpUnidad: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, letterSpacing: tipo.micro.tracking, color: ink.ink6 },
  nota: { fontFamily: tipo.micro.family, fontSize: 12, lineHeight: 17, color: ink.ink6, marginTop: space.s3 },
});
