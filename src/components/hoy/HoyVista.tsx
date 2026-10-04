// NIVL · Hoy: la vista (L-RADICAL B.1 y §C). Pura: todo llega por props desde
// useHoy (o desde la galería con datos de mentira) y no carga nada.
//
// De arriba abajo: el Hero del rango a sangre (el nivel como monumento entre
// laureles, sobre el graderío), los avisos del sistema, el día perfecto, las
// misiones con la SIGUIENTE invertida, el orden del día, el duelo de la
// semana, los módulos y el lema entre laureles.
//
// Inversión única de la pantalla: la misión siguiente; con el día cerrado y la
// celebración a la vista, el botón «Compartir» del día perfecto (nunca las dos
// a la vez: con el día perfecto no queda misión siguiente).
//
// A partir de `medium` (744, 1024) misiones y orden van en dos columnas (una
// sola con el texto muy grande). Con el panel lateral (1440) el coach y el
// duelo se van al panel.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { EncabezadoArena, Entrada, HeroRango, Laurel, TarjetaArena } from '@/components/arena';
import { LAUREL_ALTO, LAUREL_ANCHO } from '@/components/arena/geometria';
import { ajustarInscripcion } from '@/components/arena/medida';
import { OrdenDelDia } from '@/components/OrdenDelDia';
import { QuestItem } from '@/components/QuestItem';
import { Button, EmptyState, Row, Screen, Section, SkeletonRows } from '@/components/ui';
import { cabeAside } from '@/design/responsive';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { useAnchoUtil, useNavActual, useSizeClass } from '@/design/useSizeClass';
import type { DayBlock } from '@/lib/plan';
import { fonts } from '@/lib/theme';
import type { Quest } from '@/lib/types';
import type { HoyDatos } from './derivarHoy';
import { Duelo } from './Duelo';
import { PanelHoy } from './PanelHoy';

/** Lo último que enseñó el Hero: el nivel, la barra y la racha suben desde ahí. */
export interface DesdeHero {
  nivel: number;
  xpRatio: number;
  racha: number;
}

export interface HoyVistaProps {
  /** Hasta la primera carga se pintan huecos, nunca «Nada programado». */
  estado: 'cargando' | 'listo';
  /** Fallo de la última carga, ya escrito para el usuario (mensajeSistema). */
  error: string | null;
  datos: HoyDatos;
  /** Misión con el cerrojo tomado (cámara u hoja abiertas, pago en vuelo). */
  ocupada: string | null;
  preparandoTarjeta: boolean;
  refrescando: boolean;
  desde?: DesdeHero | null;
  /** Minutos del día que cuentan como «ahora» en el orden del día (galería). */
  ahora?: number;
  acciones: {
    onCompletar: (q: Quest) => void;
    onAlternarBloque: (b: DayBlock) => void;
    onCompartirDia: () => void;
    onRefrescar: () => void;
    onReintentar: () => void;
  };
}

// Hueco de la rejilla de módulos y lado de referencia de un azulejo: cuatro
// por fila como poco, y más cuando la rejilla es ancha.
const HUECO_MODULOS = 8;
const LADO_MODULO = 112;
/** Por encima, el texto no cabe en dos columnas: una sola. */
const ESCALA_DOS_COLUMNAS = 1.35;
const LEMA = 'UN 1 % MEJOR CADA DÍA';
const LAUREL_LEMA = 20;
/** Lo que el lema no puede usar: dos laureles de 20 y sus dos huecos. */
const MARCO_LEMA = 2 * ((LAUREL_LEMA * LAUREL_ANCHO) / LAUREL_ALTO) + 2 * space.s3;

export function HoyVista({
  estado,
  error,
  datos: d,
  ocupada,
  preparandoTarjeta,
  refrescando,
  desde,
  ahora,
  acciones,
}: HoyVistaProps) {
  const [verMas, setVerMas] = useState(false);
  // Ancho real de la rejilla de módulos (onLayout), no el de la ventana.
  const [anchoRejilla, setAnchoRejilla] = useState(0);
  const ancho = useAnchoUtil();
  const { sizeClass, gutter, maxContent } = useSizeClass();
  const { fontScale } = useWindowDimensions();
  // La Agenda se ofrece desde aquí solo con la barra inferior de verdad en
  // pantalla (sale del ancho de la ventana, no del hueco tras el raíl).
  const navActual = useNavActual();
  const cargando = estado === 'cargando';
  const h = d.hero;

  // El panel solo existe si tiene algo que decir (coach o duelo); si no cabe,
  // Screen no lo pinta y el duelo va en el cuerpo. Mientras carga se decide
  // con lo ya sabido (esPro llega de la última carga de la sesión): si no,
  // aparecía con huecos y desaparecía al cargar sin Pro ni duelo.
  const hayPanel = d.esPro === true || (!cargando && !!d.duelo);
  const conPanel = hayPanel && cabeAside(ancho);
  const dueloEnCuerpo = !cargando && !!d.duelo && !conPanel;
  const ordenVisible = !cargando && !!d.orden;
  const dosColumnas = sizeClass !== 'compact' && fontScale <= ESCALA_DOS_COLUMNAS && (ordenVisible || dueloEnCuerpo);

  // El lema en UNA línea (en la web no hay adjustsFontSizeToFit): tracking 3
  // de partida y, si aun así no cabe, más apretado.
  const huecoLema = Math.min(ancho, maxContent + 2 * gutter) - 2 * gutter - MARCO_LEMA;
  const ajusteLema = ajustarInscripcion(LEMA, huecoLema, { size: tipo.inscripcion.size, tracking: 3 });

  const modulos = d.modulos;
  const columnas = Math.max(4, Math.floor(anchoRejilla / LADO_MODULO));
  const tile = anchoRejilla > 0 ? Math.floor((anchoRejilla - HUECO_MODULOS * (columnas - 1)) / columnas) : 0;

  // ── Misiones de hoy ──
  // Con la carga fallida y sin misiones no se sabe si las hay: el aviso de
  // arriba lo dice y la sección no se pinta vacía.
  const misiones = !cargando && d.total === 0 && error ? null : (
    <Section
      title="Misiones de hoy"
      meta={!cargando && d.total > 0 ? `${d.hechas}/${d.total}` : undefined}
      tone={cargando ? undefined : d.tonoMisiones}
    >
      {cargando ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Cargando tus misiones">
          <SkeletonRows rows={4} />
        </View>
      ) : d.total === 0 ? (
        // Con la carga fallida no se sabe si hay misiones: el aviso de arriba
        // ya lo dice y aquí no se afirma «Nada programado».
        error ? null : (
          <TarjetaArena variante="contorno">
            <EmptyState
              compact
              icon="repeat-outline"
              title="Nada programado para hoy"
              body={d.esPro === true ? 'Crea tus misiones en Hábitos o pídeselas al coach.' : 'Crea tus misiones en Hábitos.'}
              action={{ label: 'Ir a Hábitos', onPress: () => router.push('/(tabs)/habitos') }}
            />
          </TarjetaArena>
        )
      ) : (
        <View>
          {d.misiones.map((m) => (
            <QuestItem
              key={m.quest.id}
              quest={m.quest}
              completed={m.hecha}
              xpAwarded={m.xpPagado}
              busy={ocupada === m.quest.id}
              streakDays={d.diasMultiplicador}
              onComplete={acciones.onCompletar}
              bloqueada={m.bloqueada}
              siguiente={m.siguiente}
            />
          ))}
        </View>
      )}
      {/* La recuperación abierta ya la dice la losa de la penalización. */}
      {!cargando && d.todoHecho ? <Text style={styles.todoHecho}>{d.todoHecho}</Text> : null}
      {!cargando && d.notaPendiente ? (
        <Text style={[styles.nota, d.notaPendiente.alerta && styles.notaAlerta]}>{d.notaPendiente.texto}</Text>
      ) : null}
      {/* Una sola línea, callada y DEBAJO de las misiones: lo gratis va
          primero y el coach se ofrece sin cortar el paso. */}
      {!cargando && d.lineaPro ? (
        <View style={styles.lineaPro}>
          <Row
            first
            chevron
            muted
            leading={<Ionicons name="shield-half-outline" size={18} color={ink.ink6} />}
            title="El plan del día lo escribe el coach · NIVL Pro"
            onPress={() => router.push('/pro')}
            accessibilityLabel="El plan del día lo escribe el coach. Ver NIVL Pro"
          />
        </View>
      ) : null}
    </Section>
  );

  // ── Orden del día y duelo (la segunda columna a partir de medium) ──
  const lateral: ReactNode[] = [];
  if (ordenVisible && d.orden) {
    lateral.push(
      <OrdenDelDia
        key="orden"
        plan={d.orden.plan}
        bloques={d.orden.bloques}
        onToggle={acciones.onAlternarBloque}
        pro={d.orden.pro}
        ahora={ahora}
      />,
    );
  }
  if (dueloEnCuerpo && d.duelo) lateral.push(<Duelo key="duelo" duelo={d.duelo} />);

  return (
    <Screen
      refreshing={refrescando}
      onRefresh={acciones.onRefrescar}
      aside={hayPanel ? <PanelHoy cargando={cargando} esPro={d.esPro} duelo={d.duelo} /> : undefined}
    >
      {/* 1 · El Hero (sin perfil tras un fallo, la cabecera grabada). */}
      {cargando || h ? (
        <Entrada indice={0}>
          <HeroRango
            variante="hoy"
            cargando={cargando || !h}
            nivel={h?.nivel ?? 0}
            rango={h?.rango ?? null}
            titulo={h?.titulo ?? ''}
            xpEnNivel={h?.xpEnNivel ?? 0}
            xpSiguiente={h?.xpSiguiente ?? 1}
            racha={h?.racha ?? 0}
            rachaCerrada={h?.rachaCerrada ?? false}
            piedras={h?.piedras ?? 0}
            eyebrow={d.fecha}
            linea={h?.linea}
            avatar={h?.avatar ?? { path: null, nombre: '' }}
            cifraExtra={{ valor: h?.misiones ?? '', rotulo: 'Misiones' }}
            // La barra de otro nivel no dice nada de este: si el nivel ha
            // cambiado desde lo último visto, se llena desde vacío.
            desde={desde && h && desde.nivel !== h.nivel ? { ...desde, xpRatio: 0 } : desde}
            accion={
              // En compact la Agenda no está en la barra inferior: se llega
              // desde aquí. En el raíl y la barra lateral es un destino propio.
              navActual === 'tabs'
                ? { icono: 'calendar-outline', etiqueta: 'Abrir la agenda', onPress: () => router.push('/(tabs)/agenda') }
                : undefined
            }
            onAvatar={() => router.push('/(tabs)/perfil')}
          />
        </Entrada>
      ) : (
        <EncabezadoArena eyebrow={d.fecha} titulo="Hoy" meandro />
      )}

      {/* 2 · Avisos del sistema. */}
      {error ? (
        <Entrada indice={1} style={styles.bloque}>
          <TarjetaArena variante="contorno">
            <EmptyState
              compact
              icon="cloud-offline-outline"
              title={d.perfil ? 'No se ha podido actualizar' : 'El sistema no responde'}
              body={error}
              action={{ label: 'Reintentar', onPress: acciones.onReintentar }}
            />
          </TarjetaArena>
        </Entrada>
      ) : null}

      {!cargando && d.pausa ? (
        <Entrada indice={2} style={styles.bloque}>
          <TarjetaArena variante="contorno" rotulo="Sistema en pausa">
            <View style={styles.pausa}>
              <Ionicons name="snow-outline" size={16} color={ink.ink8} />
              <Text style={[styles.cuerpo, styles.flex]}>{d.pausa}</Text>
            </View>
          </TarjetaArena>
        </Entrada>
      ) : null}

      {!cargando && d.cierre ? (
        <Entrada indice={2} style={styles.bloque}>
          <TarjetaArena
            variante={d.cierre.alerta ? 'trama' : 'contorno'}
            rotulo={d.cierre.alerta ? 'Alerta del sistema' : 'Informe del cierre'}
          >
            {d.cierre.lineas.map((l) => (
              <Text key={l} style={[styles.cuerpo, styles.linea]}>
                {l}
              </Text>
            ))}
          </TarjetaArena>
        </Entrada>
      ) : null}

      {/* 3 · Día perfecto: la inversión cuando no queda nada. */}
      {!cargando && d.celebrando ? (
        <Entrada indice={2} style={styles.bloque}>
          <TarjetaArena variante="grano" rotulo="Día perfecto" meta={`${d.hechas}/${d.total}`}>
            <Text style={styles.cuerpo}>
              Todas cumplidas. Racha de {d.racha.valor} {d.racha.valor === 1 ? 'día' : 'días'}.
            </Text>
            <Button
              title="Compartir"
              icon="share-social-outline"
              variant="primary"
              size="sm"
              onPress={acciones.onCompartirDia}
              loading={preparandoTarjeta}
              style={styles.compartir}
            />
          </TarjetaArena>
        </Entrada>
      ) : null}

      {/* 4-6 · Misiones | Orden del día y duelo. Con key: la cascada se
          vuelve a ver con el contenido real, no sobre los huecos. */}
      <Entrada key={cargando ? 'misiones-sk' : 'misiones-ok'} indice={3}>
        {dosColumnas ? (
          <View style={styles.columnas}>
            <View style={styles.columna}>{misiones}</View>
            <View style={styles.columna}>{lateral}</View>
          </View>
        ) : (
          <>
            {misiones}
            {lateral}
          </>
        )}
      </Entrada>

      {/* 7 · Módulos. */}
      <Entrada key={cargando ? 'modulos-sk' : 'modulos-ok'} indice={4}>
        <Section
          title="Módulos"
          action={
            modulos.secondary.length > 0
              ? {
                  label: verMas ? 'Menos' : `Más · ${modulos.secondary.length}`,
                  icon: verMas ? 'chevron-up' : 'chevron-down',
                  onPress: () => setVerMas((v) => !v),
                }
              : undefined
          }
        >
          <View style={styles.rejilla} onLayout={(e) => setAnchoRejilla(e.nativeEvent.layout.width)}>
            {/* Hasta medir no se pintan: con un lado inventado saltaban. */}
            {tile > 0 &&
              [...modulos.primary, ...(verMas ? modulos.secondary : [])].map((m) => (
                <Pressable
                  key={m.route}
                  onPress={() => router.push(m.route)}
                  style={({ pressed }) => [styles.azulejo, { width: tile, height: tile }, pressed && styles.azulejoPulsado]}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir ${m.label}`}
                >
                  <Ionicons name={m.icon as never} size={22} color={ink.ink10} />
                  <Text style={styles.azulejoRotulo} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
          </View>
        </Section>
      </Entrada>

      {/* 8 · El lema entre laureles. */}
      <Entrada indice={5}>
        <View style={styles.lema} accessible accessibilityLabel="Un 1 % mejor cada día">
          <Laurel alto={LAUREL_LEMA} lado="izq" />
          <Text
            style={[styles.lemaTexto, { fontSize: ajusteLema.size, letterSpacing: ajusteLema.tracking }]}
            maxFontSizeMultiplier={1.35}
            numberOfLines={ajusteLema.cabe ? 1 : 2}
          >
            {LEMA}
          </Text>
          <Laurel alto={LAUREL_LEMA} lado="der" />
        </View>
      </Entrada>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bloque: { marginBottom: space.s6 },
  cuerpo: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
  linea: { marginBottom: space.s1 },
  pausa: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3 },
  compartir: { alignSelf: 'flex-start', marginTop: space.s3 },
  columnas: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s6 },
  columna: { flex: 1, minWidth: 0 },
  todoHecho: {
    fontFamily: fonts.semibold,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
    marginTop: space.s3,
  },
  // RET-05: bodySm (14/20) en ink8; en riesgo, seminegrita ink9.
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s3,
  },
  notaAlerta: { fontFamily: fonts.semibold, color: ink.ink9 },
  lineaPro: {
    marginTop: space.s3,
    borderTopWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: ink.ink3,
  },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: HUECO_MODULOS },
  // El lado del azulejo se calcula con el ancho medido de la rejilla (ver `tile`).
  azulejo: {
    backgroundColor: ink.ink1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  azulejoPulsado: { backgroundColor: ink.ink2 },
  azulejoRotulo: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink8,
    paddingHorizontal: space.s1,
  },
  lema: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s3,
    marginTop: space.s2,
    marginBottom: space.s4,
  },
  lemaTexto: {
    flexShrink: 1,
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink6,
    textAlign: 'center',
  },
});
