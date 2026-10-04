// NIVL · Agenda: la vista (FASE3 Lote C, L-RADICAL §C). Pura: todo llega por
// props desde useAgenda (o desde la galería con datos de mentira) y no carga
// nada.
//
// De arriba abajo: el encabezado grabado (eyebrow mes y año; «MIÉRCOLES 7»,
// «SEMANA 41» u «OCTUBRE»; acción «Nuevo evento» en contorno; meandro), los
// chips Día · Semana · Mes con «Hoy», las flechas de 44 con el rango en
// inscripción, el calendario (tira o rejilla, Calendario.tsx) y el día
// elegido: la franja Eventos · Con hora · Misiones, los eventos, el eje por
// horas (LineaDeTiempo) y las misiones y plazos.
//
// Inversión única: el día elegido en la tira o la rejilla. En la vista por
// día no hay calendario, así que solo se invierte el «Añadir evento» del
// vacío futuro; con datos, la vista por día no invierte nada.
//
// A partir de `medium`: el mes va a la izquierda (55 %) con el día al lado; la
// semana y el día ponen el eje por horas a la izquierda y los eventos y las
// misiones a la derecha. Con el texto por encima de 1,35, una sola columna.

import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LineaDeTiempo } from '@/components/LineaDeTiempo';
import {
  BotonArena,
  CargaArena,
  EncabezadoArena,
  Entrada,
  ErrorSistema,
  FranjaCifras,
  TarjetaArena,
} from '@/components/arena';
import { Check, Chip, ChipWrap, EmptyState, Row, Screen, Section, Tag } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { useAnchoUtil, useSizeClass } from '@/design/useSizeClass';
import type { PlanConBloques } from '@/lib/dayplan';
import { hhmm, horaAMinutos, minutosAhora } from '@/lib/plan';
import type { CalendarEvent, DungeonTask, Quest } from '@/lib/types';
import { RejillaMes, TiraSemana } from './Calendario';
import {
  contenidoDe,
  eventosOrdenados,
  itemsConHora,
  mesYAnio,
  moverAgenda,
  rangoAgenda,
  rangoLeido,
  subtituloDia,
  tituloAgenda,
  type ContenidoDia,
  type ModoAgenda,
} from './derivarAgenda';

export type ViewMode = ModoAgenda;

export interface AgendaVistaProps {
  /** Hasta la primera carga se pintan huecos, nunca «Nada programado». */
  estado: 'cargando' | 'listo';
  /** Fallo de la última carga, ya escrito para el usuario (mensajeSistema). */
  error: string | null;
  hoy: string;
  /** El día elegido (clave AAAA-MM-DD). */
  dia: string;
  modo: ViewMode;
  quests: Quest[];
  events: CalendarEvent[];
  dueTasks: DungeonTask[];
  /** Misiones hechas el día elegido. */
  hechas: Set<string>;
  plan: PlanConBloques | null;
  /** Si la cuenta tiene coach; null mientras no se sabe. */
  esPro: boolean | null;
  /** La línea de «ahora» (minutos); por defecto, la hora real si el día es hoy. */
  ahoraMin?: number | null;
  onVolver?: () => void;
  acciones: {
    onModo: (m: ViewMode) => void;
    /** Flechas y «Hoy»: mueven sin vibrar. */
    onDia: (dia: string) => void;
    /** Tocar un día del calendario (vibra `seleccion` si cambia). */
    onElegirDia: (dia: string) => void;
    onNuevo: () => void;
    onDetalle: (e: CalendarEvent) => void;
    onReintentar: () => void;
  };
}

const VISTAS: { id: ViewMode; label: string; unidad: string }[] = [
  { id: 'dia', label: 'Día', unidad: 'Día' },
  { id: 'semana', label: 'Semana', unidad: 'Semana' },
  { id: 'mes', label: 'Mes', unidad: 'Mes' },
];

/** Con el texto por encima de esto, todo a una columna. */
const ESCALA_DOS_COLUMNAS = 1.35;
/**
 * El mes a dos columnas pide más hueco que semana y día: por debajo de esto
 * (y fuera de `expanded`) la rejilla queda estrecha al lado del día, así que
 * va arriba y el día debajo.
 */
const HUECO_MES_DOS_COLUMNAS = 900;
/** Ancho máximo del contenido a dos columnas (márgenes incluidos). */
const ANCHO_DOS_COLUMNAS = 1152;

export function AgendaVista({
  estado,
  error,
  hoy,
  dia,
  modo,
  quests,
  events,
  dueTasks,
  hechas,
  plan,
  esPro,
  ahoraMin,
  onVolver,
  acciones,
}: AgendaVistaProps) {
  const { sizeClass } = useSizeClass();
  const { fontScale } = useWindowDimensions();
  // El hueco real (la ventana menos el raíl o la barra lateral).
  const hueco = useAnchoUtil();
  const dosColumnas = sizeClass !== 'compact' && fontScale <= ESCALA_DOS_COLUMNAS;
  // Semana y día siguen con `dosColumnas`; el mes además pide 900 o `expanded`.
  const mesDosColumnas = dosColumnas && (hueco >= HUECO_MES_DOS_COLUMNAS || sizeClass === 'expanded');

  const listo = estado === 'listo';
  const datos = { quests, events, dueTasks };
  const c = contenidoDe(datos, dia, hoy);
  const bloques = plan?.bloques.length ?? 0;
  const vacio = c.eventos.length + c.plazos.length + c.misiones.length + bloques === 0;
  const unidad = VISTAS.find((v) => v.id === modo)?.unidad ?? 'Día';
  const leido = rangoLeido(modo, dia);

  const calendario =
    modo === 'semana' ? (
      <TiraSemana datos={datos} hoy={hoy} dia={dia} onElegir={acciones.onElegirDia} />
    ) : modo === 'mes' ? (
      <RejillaMes datos={datos} hoy={hoy} dia={dia} onElegir={acciones.onElegirDia} />
    ) : null;

  const detalle = (
    <DetalleDia
      listo={listo}
      error={error}
      hoy={hoy}
      dia={dia}
      modo={modo}
      c={c}
      vacio={vacio}
      hechas={hechas}
      plan={plan}
      esPro={esPro}
      ahoraMin={ahoraMin === undefined ? (dia === hoy ? minutosAhora() : null) : ahoraMin}
      // En el mes a dos columnas el día va en la columna estrecha: una sola.
      // Con la rejilla arriba, el día tiene el ancho entero, como en la vista Día.
      columnas={dosColumnas && !(modo === 'mes' && mesDosColumnas)}
      acciones={acciones}
    />
  );

  return (
    // A dos columnas la columna de lectura (640 o 720) se queda corta: el
    // contenido toma el hueco entero, con tope.
    <Screen contentStyle={dosColumnas ? { maxWidth: Math.min(hueco, ANCHO_DOS_COLUMNAS) } : undefined}>
      <Entrada indice={0}>
        <EncabezadoArena
          eyebrow={mesYAnio(dia)}
          titulo={tituloAgenda(modo, dia)}
          subtitulo={listo && !error ? subtituloDia(c, bloques, dia, hoy) : undefined}
          onVolver={onVolver}
          accion={{ icono: 'add', etiqueta: 'Nuevo evento', onPress: acciones.onNuevo }}
          meandro
        />
      </Entrada>

      <Entrada indice={1} style={styles.controles}>
        <View style={styles.selector}>
          <ChipWrap>
            {VISTAS.map((v) => (
              <Chip
                key={v.id}
                small
                label={v.label}
                selected={modo === v.id}
                onPress={() => acciones.onModo(v.id)}
                accessibilityLabel={`Vista por ${v.label.toLowerCase()}`}
              />
            ))}
          </ChipWrap>
          {dia !== hoy ? (
            <Chip small icon="today-outline" label="Hoy" onPress={() => acciones.onDia(hoy)} accessibilityLabel="Volver a hoy" />
          ) : null}
        </View>
        <View style={styles.nav}>
          <BotonArena
            icono="chevron-back"
            etiqueta={`${unidad} anterior`}
            onPress={() => acciones.onDia(moverAgenda(modo, dia, -1))}
          />
          <Text style={styles.rango} numberOfLines={1} maxFontSizeMultiplier={1.2} accessibilityLabel={leido}>
            {rangoAgenda(modo, dia)}
          </Text>
          <BotonArena
            icono="chevron-forward"
            etiqueta={`${unidad} siguiente`}
            onPress={() => acciones.onDia(moverAgenda(modo, dia, 1))}
          />
        </View>
      </Entrada>

      {modo === 'mes' && mesDosColumnas ? (
        <View style={styles.dos}>
          <Entrada indice={2} style={styles.colMes}>
            {calendario}
          </Entrada>
          <View style={styles.colResto}>{detalle}</View>
        </View>
      ) : (
        <>
          {calendario ? (
            <Entrada indice={2} style={styles.calendario}>
              {calendario}
            </Entrada>
          ) : null}
          {detalle}
        </>
      )}
    </Screen>
  );
}

interface DetalleDiaProps {
  listo: boolean;
  error: string | null;
  hoy: string;
  dia: string;
  modo: ViewMode;
  c: ContenidoDia;
  vacio: boolean;
  hechas: Set<string>;
  plan: PlanConBloques | null;
  esPro: boolean | null;
  ahoraMin: number | null;
  columnas: boolean;
  acciones: AgendaVistaProps['acciones'];
}

/** El día elegido: estado, franja, eventos, eje por horas y misiones. */
function DetalleDia({
  listo,
  error,
  hoy,
  dia,
  modo,
  c,
  vacio,
  hechas,
  plan,
  esPro,
  ahoraMin,
  columnas,
  acciones,
}: DetalleDiaProps) {
  if (!listo) {
    return (
      <CargaArena
        etiqueta="Cargando tu agenda"
        formas={['franja', 'rotulo', 'filas', 'rotulo', 'tarjeta']}
        style={styles.bloque}
      />
    );
  }
  if (error) {
    return (
      <Entrada indice={3}>
        <ErrorSistema mensaje={error} onReintentar={acciones.onReintentar} style={styles.bloque} />
      </Entrada>
    );
  }

  const futuro = dia >= hoy;
  if (vacio) {
    return (
      <Entrada indice={3}>
        <TarjetaArena variante="contorno" style={styles.bloque}>
          <EmptyState
            icon="calendar-outline"
            title={futuro ? 'Nada programado' : 'Un día en blanco'}
            body={
              futuro
                ? esPro === true
                  ? 'Pídele al coach que planifique el día o añade un evento. Las misiones programadas aparecen aquí.'
                  : 'Añade un evento. Las misiones programadas aparecen aquí.'
                : 'El sistema no tiene nada registrado para ese día.'
            }
            // En la vista por día no hay día invertido: la inversión es esta.
            action={
              futuro
                ? { label: 'Añadir evento', onPress: acciones.onNuevo, variant: modo === 'dia' ? 'solid' : 'outline' }
                : undefined
            }
          />
        </TarjetaArena>
      </Entrada>
    );
  }

  const items = itemsConHora(plan, c.eventos);
  const eventos = eventosOrdenados(c.eventos);
  const misionesHechas = c.misiones.filter((q) => hechas.has(q.id)).length;

  const franja = (
    <Entrada indice={3} style={styles.franja}>
      <FranjaCifras
        cifras={[
          { valor: c.eventos.length, rotulo: 'Eventos' },
          { valor: items.length, rotulo: 'Con hora', etiqueta: `Con hora: ${items.length}` },
          c.misiones.length > 0
            ? {
                valor: `${misionesHechas}/${c.misiones.length}`,
                rotulo: 'Misiones',
                etiqueta: `Misiones: ${misionesHechas} de ${c.misiones.length} hechas`,
              }
            : { valor: 0, rotulo: 'Misiones' },
        ]}
      />
    </Entrada>
  );

  const seccionEventos =
    eventos.length > 0 ? (
      <Section title="Eventos" meta={`${eventos.length}`}>
        <TarjetaArena variante="piedra" padded={false} style={styles.lista}>
          {eventos.map((e, i) => {
            const min = horaAMinutos(e.time);
            return (
              <Row
                key={e.id}
                first={i === 0}
                leading={<View style={styles.punto} />}
                title={e.title}
                detail={e.notes ?? undefined}
                trailing={
                  min === null ? (
                    <Text style={styles.todoElDia} maxFontSizeMultiplier={1.35}>
                      Todo el día
                    </Text>
                  ) : (
                    <Text style={styles.hora} maxFontSizeMultiplier={1.2}>
                      {hhmm(min)}
                    </Text>
                  )
                }
                onPress={() => acciones.onDetalle(e)}
                accessibilityLabel={`${e.title}, ${min === null ? 'todo el día' : `a las ${hhmm(min)}`}. Toca para ver el detalle.`}
              />
            );
          })}
        </TarjetaArena>
        <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
          Toca un evento para ver su detalle.
        </Text>
      </Section>
    ) : null;

  const seccionHoras = (
    <Section title="Por horas" meta={items.length > 0 ? `${items.length}` : undefined}>
      {items.length === 0 ? (
        <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
          {futuro
            ? esPro === true
              ? 'Nada a una hora concreta. Pídele al coach que planifique el día, o añade un evento con hora.'
              : 'Nada a una hora concreta. Añade un evento con hora y se pinta aquí.'
            : 'Ese día no tuvo plan por horas.'}
        </Text>
      ) : (
        <LineaDeTiempo
          items={items}
          ahoraMin={ahoraMin}
          onPress={(item) => {
            const e = c.eventos.find((x) => `e-${x.id}` === item.id);
            if (e) acciones.onDetalle(e);
          }}
        />
      )}
    </Section>
  );

  const venceHoy = dia === hoy;
  const seccionMisiones =
    c.plazos.length > 0 || c.misiones.length > 0 ? (
      <Section
        title="Misiones y plazos"
        tone={venceHoy && c.plazos.length > 0 ? 'alerta' : undefined}
        meta={c.misiones.length > 0 ? `${misionesHechas}/${c.misiones.length}` : `${c.plazos.length}`}
      >
        <TarjetaArena variante="piedra" padded={false} style={styles.lista}>
          {c.plazos.map((t, i) => (
            <Row
              key={t.id}
              first={i === 0}
              leading={<View style={styles.cuadro} />}
              title={t.title}
              detail={t.is_boss ? 'Jefe final de campaña.' : 'Tarea de campaña.'}
              trailing={
                venceHoy ? (
                  <Tag tone="alerta">Vence hoy</Tag>
                ) : t.is_boss ? (
                  <Tag tone="dim">Jefe</Tag>
                ) : (
                  <Text style={styles.todoElDia}>Plazo</Text>
                )
              }
              accessibilityLabel={`${t.title}, ${t.is_boss ? 'jefe final' : 'tarea'} de campaña, ${venceHoy ? 'vence hoy' : 'vence ese día'}.`}
            />
          ))}
          {c.misiones.map((q, i) => {
            const hecha = hechas.has(q.id);
            return (
              <Row
                key={q.id}
                first={c.plazos.length === 0 && i === 0}
                leading={<Check checked={hecha} size={24} />}
                title={q.title}
                done={hecha}
                detail={`Misión · ${q.stat}`}
                trailing={q.is_penalty && !hecha ? <Tag tone="alerta">Penalización</Tag> : undefined}
              />
            );
          })}
        </TarjetaArena>
        <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
          Las misiones se completan desde Hoy.
        </Text>
      </Section>
    ) : null;

  if (columnas) {
    return (
      <>
        {franja}
        <Entrada indice={4} style={styles.dos}>
          <View style={styles.colHoras}>{seccionHoras}</View>
          <View style={styles.colResto}>
            {seccionEventos}
            {seccionMisiones}
          </View>
        </Entrada>
      </>
    );
  }

  return (
    <>
      {franja}
      {seccionEventos ? <Entrada indice={4}>{seccionEventos}</Entrada> : null}
      <Entrada indice={5}>{seccionHoras}</Entrada>
      {seccionMisiones ? <Entrada indice={6}>{seccionMisiones}</Entrada> : null}
    </>
  );
}

const MARCA = 7;

const styles = StyleSheet.create({
  controles: { marginBottom: space.s6, gap: space.s4 },
  selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s2 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  rango: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink9,
  },
  calendario: { marginBottom: space.s6 },
  dos: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s6 },
  colMes: { width: '55%' },
  colHoras: { flex: 11, minWidth: 0 },
  colResto: { flex: 9, minWidth: 0 },
  bloque: { marginBottom: space.s6 },
  franja: {
    marginBottom: space.s6,
    paddingVertical: space.s3,
    borderTopWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: ink.ink3,
  },
  lista: { paddingHorizontal: space.s4, paddingVertical: 2 },
  punto: { width: MARCA, height: MARCA, borderRadius: MARCA / 2, backgroundColor: ink.ink9 },
  cuadro: { width: MARCA, height: MARCA, borderWidth: stroke.hairline, borderColor: ink.ink9 },
  hora: {
    fontFamily: 'Cinzel_600SemiBold',
    fontSize: 16,
    lineHeight: 20,
    color: ink.ink10,
    fontVariant: ['tabular-nums'],
  },
  todoElDia: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: space.s2,
  },
});
