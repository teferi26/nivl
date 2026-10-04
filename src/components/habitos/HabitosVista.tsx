// NIVL · Hábitos: la vista (L-RADICAL B.6 y §C). Pura: todo llega por props
// desde useHabitos (o desde la galería con datos de mentira) y no carga nada.
//
// La forja de la arena, de arriba abajo: el encabezado grabado con el
// meandro, la franja de cifras (en forja, mejor racha, listos, adquiridos),
// las reglas del contrato de hoy, cada hábito como una losa con zócalo (la
// racha manda: columna de 64 con la cifra en Cinzel sobre «/21» y una hairline;
// a la derecha el nombre, la barra en 21 segmentos y los días que toca en
// contorno) y los adquiridos con su laurel. El hábito que llega a 21 pasa a
// losa con grano y pide la decisión: «Darlo por adquirido».
//
// Inversión única de la pantalla: «Nuevo hábito» en el encabezado salvo en el
// vacío, donde la lleva el «Añadir el primero». Los días de
// la semana van en contorno a propósito (no cuentan como superficie) y el
// botón de consolidar es secondary.
//
// A partir de `medium` las losas van en dos columnas (una sola con el texto
// muy grande).

import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Barra, EncabezadoArena, Entrada, FranjaCifras, Laurel, TarjetaArena } from '@/components/arena';
import { Button, Check, EmptyState, PressScale, Row, Screen, Section, Skeleton, SkeletonRows } from '@/components/ui';
import { SIN_DATO } from '@/components/ui/sinDato';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { useSizeClass } from '@/design/useSizeClass';
import { RULE_BREAK_XP } from '@/lib/game';
import type { ProgresoHabito } from '@/lib/habits';
import type { Quest, Rule } from '@/lib/types';
import {
  reglasPendientes,
  resumenHabito,
  resumenHabitos,
  SUBTITULO_HABITOS,
  textoRestantes,
} from './derivarHabitos';

export interface HabitosVistaProps {
  /** Hasta la primera carga se pintan huecos, nunca «Ningún hábito en forja». */
  estado: 'cargando' | 'listo';
  /** Fallo de la última carga, ya escrito para el usuario (mensajeSistema). */
  error: string | null;
  /** Sin adquirir, los consolidables primero (clasificarHabitos). */
  enCurso: Quest[];
  adquiridos: Quest[];
  progresos: Map<string, ProgresoHabito>;
  reglas: Rule[];
  cumplidas: Set<string>;
  /** Consolidando un hábito: el botón espera. */
  ocupado: boolean;
  acciones: {
    onNuevo: () => void;
    onEditar: (q: Quest) => void;
    onConsolidar: (q: Quest, p: ProgresoHabito) => void;
    onReactivar: (q: Quest) => void;
    onAlternarRegla: (r: Rule) => void;
    onReintentar: () => void;
  };
}

/** Con el texto por encima de esto, las losas vuelven a una columna. */
const ESCALA_DOS_COLUMNAS = 1.35;

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** «lunes, miércoles y viernes» (o «todos los días»). */
function diasLeidos(dias: number[]): string {
  const nombres = DIAS_LARGOS.filter((_, i) => dias.includes(i + 1));
  if (nombres.length === 7) return 'todos los días';
  if (nombres.length <= 1) return nombres[0] ?? 'ningún día';
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/** Los siete días: los que toca en contorno blanco, el resto en hierro. */
function Semana({ dias }: { dias: number[] }) {
  return (
    <View style={styles.semana} accessible accessibilityLabel={`Toca ${diasLeidos(dias)}`}>
      {DIAS.map((d, i) => {
        const on = dias.includes(i + 1);
        return (
          <View key={d} style={[styles.dia, on && styles.diaOn]}>
            <Text style={[styles.diaTexto, on && styles.diaTextoOn]} maxFontSizeMultiplier={1.2}>
              {d}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * El cuerpo de una losa. La racha manda: columna izquierda de 64 con la cifra
 * en Cinzel sobre «/21» y una hairline vertical; a la derecha, el nombre, la
 * barra de 21 y la semana.
 */
function CuerpoHabito({ q, p, animar }: { q: Quest; p: ProgresoHabito; animar: boolean }) {
  return (
    <View style={styles.cuerpo}>
      <View style={styles.colRacha}>
        {/* Texto y no Contador: Contador, como mucho 4 por pantalla y nunca
            en una lista (ya los usa la franja de cifras). */}
        <Text style={styles.racha} maxFontSizeMultiplier={1} numberOfLines={1} adjustsFontSizeToFit>
          {p.racha}
        </Text>
        <Text style={styles.objetivo} maxFontSizeMultiplier={1}>
          /{p.objetivo}
        </Text>
      </View>
      <View style={styles.colTexto}>
        <Text style={styles.nombre} numberOfLines={2} maxFontSizeMultiplier={1.35}>
          {q.title}
        </Text>
        <View style={styles.barra}>
          {/* Solo se anima lo que se ve al entrar: más abajo aparece ya llena. */}
          <Barra
            ratio={p.racha / p.objetivo}
            desde={animar ? 0 : null}
            alto={8}
            segmentos={p.objetivo}
            etiqueta={`Racha de ${q.title}: ${p.racha} de ${p.objetivo} días`}
          />
        </View>
        <View style={styles.pie}>
          <Semana dias={q.days_of_week ?? []} />
          <Text style={[styles.restantes, p.consolidable && styles.restantesListo]} maxFontSizeMultiplier={1.35}>
            {textoRestantes(p)}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Las losas que entran a la vista y llenan su barra desde cero. */
const LOSAS_ANIMADAS = 4;

function LosaHabito({
  q,
  p,
  indice,
  ocupado,
  acciones,
}: {
  q: Quest;
  p: ProgresoHabito;
  indice: number;
  ocupado: boolean;
  acciones: HabitosVistaProps['acciones'];
}) {
  const editar = () => acciones.onEditar(q);
  const animar = indice < LOSAS_ANIMADAS;
  const etiqueta = `${resumenHabito(q.title, p)} Se pide ${diasLeidos(q.days_of_week ?? [])}. Toca para editar.`;
  if (!p.consolidable) {
    return (
      <TarjetaArena variante="piedra" zocalo onPress={editar} accessibilityLabel={etiqueta}>
        <CuerpoHabito q={q} p={p} animar={animar} />
      </TarjetaArena>
    );
  }
  // La losa no es pulsable entera: un botón dentro de otro botón desaparece
  // para VoiceOver. Lo que edita es el cuerpo; «Darlo por adquirido» queda
  // como botón propio debajo.
  return (
    <TarjetaArena variante="grano" zocalo rotulo="Forjado">
      <PressScale onPress={editar} accessibilityRole="button" accessibilityLabel={etiqueta}>
        <CuerpoHabito q={q} p={p} animar={animar} />
      </PressScale>
      <Button
        title="Darlo por adquirido"
        variant="secondary"
        onPress={() => acciones.onConsolidar(q, p)}
        loading={ocupado}
        icon="ribbon-outline"
        style={styles.consolidar}
      />
    </TarjetaArena>
  );
}

function Cargando() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Cargando tus hábitos">
      <Skeleton height={56} style={styles.skFranja} />
      <Skeleton height={11} width={110} style={styles.skEyebrow} />
      <Skeleton height={124} style={styles.skCard} />
      <Skeleton height={124} style={styles.skCard} />
      <SkeletonRows rows={2} />
    </View>
  );
}

export function HabitosVista({
  estado,
  error,
  enCurso,
  adquiridos,
  progresos,
  reglas,
  cumplidas,
  ocupado,
  acciones,
}: HabitosVistaProps) {
  const { sizeClass } = useSizeClass();
  const { fontScale } = useWindowDimensions();
  const dosColumnas = sizeClass !== 'compact' && fontScale <= ESCALA_DOS_COLUMNAS;

  const listo = estado === 'listo';
  const resumen = resumenHabitos(enCurso, adquiridos, progresos);
  const pendientes = reglasPendientes(reglas, cumplidas);
  const vacio = listo && !error && enCurso.length === 0 && adquiridos.length === 0;

  return (
    <Screen>
      <Entrada indice={0}>
        <EncabezadoArena
          eyebrow="Constancia"
          titulo="Hábitos"
          subtitulo={SUBTITULO_HABITOS}
          meandro
          // Sólida salvo en el vacío: allí la acción principal (la única
          // inversión) es «Añadir el primero». Con todo adquirido y nada en
          // forja, esta es la acción clara.
          accion={{ icono: 'add', etiqueta: 'Nuevo hábito', onPress: acciones.onNuevo, solida: !vacio }}
        />
      </Entrada>

      {!listo ? <Cargando /> : null}

      {listo && error ? (
        <TarjetaArena variante="contorno" style={styles.bloque}>
          <EmptyState
            compact
            icon="cloud-offline-outline"
            title="El sistema no responde"
            body={error}
            action={{ label: 'Reintentar', onPress: acciones.onReintentar }}
          />
        </TarjetaArena>
      ) : null}

      {/* Sin ningún hábito, cuatro ceros no dicen nada: manda el vacío. */}
      {listo && !error && !vacio ? (
        <Entrada indice={1} style={styles.franja}>
          <FranjaCifras
            cifras={[
              { valor: resumen.enForja, rotulo: 'En forja' },
              { valor: resumen.mejorRacha, rotulo: 'Mejor racha', sufijo: 'd', etiqueta: `Mejor racha: ${resumen.mejorRacha} días` },
              { valor: resumen.listos, rotulo: 'Listos' },
              // «Tuyos» y no «Adquiridos»: a 375 la celda mide ~60 pt y la
              // palabra larga se partía.
              { valor: resumen.adquiridos, rotulo: 'Tuyos', etiqueta: `Hábitos tuyos: ${resumen.adquiridos}` },
            ]}
          />
        </Entrada>
      ) : null}

      {listo && reglas.length > 0 ? (
        <Entrada indice={2}>
          <Section
            title="Reglas del contrato · hoy"
            tone={pendientes > 0 ? 'alerta' : undefined}
            meta={`${reglas.length - pendientes}/${reglas.length}`}
          >
            <TarjetaArena variante="piedra" padded={false} style={styles.lista}>
              {reglas.map((r, i) => {
                const ok = cumplidas.has(r.id);
                return (
                  <Row
                    key={r.id}
                    first={i === 0}
                    leading={<Check checked={ok} size={24} />}
                    title={r.text}
                    done={ok}
                    detail={!ok ? `Si no: ${r.consequence}` : undefined}
                    onPress={() => acciones.onAlternarRegla(r)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: ok }}
                  />
                );
              })}
            </TarjetaArena>
            <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
              {pendientes === 0
                ? 'Las has cumplido todas hoy. El sistema toma nota.'
                : `Lo que quede sin marcar al cierre cuenta como roto: ${RULE_BREAK_XP} XP por regla y su consecuencia mañana.`}
            </Text>
          </Section>
        </Entrada>
      ) : null}

      {/* Con la carga caída y nada que enseñar, la sección sobra. */}
      {/* La sección entra entera (título incluido) como el bloque 3; las
          losas no llevan Entrada propia: anidada, sumaría subida y retraso. */}
      {listo && !(error && enCurso.length === 0) ? (
        <Entrada indice={3}>
          <Section title="En forja" meta={enCurso.length > 0 ? `${enCurso.length}` : undefined}>
            {vacio ? (
              <TarjetaArena variante="contorno" remaches>
                <EmptyState
                  icon="hammer-outline"
                  title="Ningún hábito en forja"
                  body="Lectura, correr, las llamadas en frío, dormir a tu hora. Lo que quieras que un día te salga solo."
                  action={{ label: 'Añadir el primero', onPress: acciones.onNuevo, variant: 'solid' }}
                />
              </TarjetaArena>
            ) : null}

            {!vacio && !error && enCurso.length === 0 ? (
              <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
                Nada en forja ahora mismo. Lo que ya es tuyo sigue abajo.
              </Text>
            ) : null}

            <View style={dosColumnas ? styles.rejilla : styles.columna}>
              {enCurso.map((q, i) => {
                const p = progresos.get(q.id);
                if (!p) return null;
                // El que pide la decisión ocupa el ancho entero: su botón no cabe a media columna.
                const celda = dosColumnas ? (p.consolidable ? styles.celdaAncha : styles.celda) : undefined;
                return (
                  <View key={q.id} style={celda}>
                    <LosaHabito q={q} p={p} indice={i} ocupado={ocupado} acciones={acciones} />
                  </View>
                );
              })}
            </View>
          </Section>
        </Entrada>
      ) : null}

      {listo && adquiridos.length > 0 ? (
        <Section title="Adquiridos" tone="logro" meta={`${adquiridos.length}`}>
          <TarjetaArena variante="contorno" padded={false} style={styles.lista}>
            {adquiridos.map((q, i) => {
              const dias = q.acquired_streak;
              return (
                <Row
                  key={q.id}
                  first={i === 0}
                  leading={<Laurel alto={18} lado="izq" color={ink.ink8} />}
                  title={q.title}
                  muted
                  detail="Ya no se te pide. Mantén pulsado para volver a exigirlo."
                  trailing={
                    <Text style={styles.adquirido} maxFontSizeMultiplier={1}>
                      {dias == null ? SIN_DATO : dias}
                      {dias == null ? null : <Text style={styles.adquiridoUnidad}> d</Text>}
                    </Text>
                  }
                  onLongPress={() => acciones.onReactivar(q)}
                  accessibilityLongPressLabel="Reactivar"
                  accessibilityLabel={`${q.title}, adquirido${dias == null ? '' : ` a los ${dias} días`}. Mantén pulsado para volver a exigirlo.`}
                />
              );
            })}
          </TarjetaArena>
        </Section>
      ) : null}
    </Screen>
  );
}

const DIA = 22;
/** Ancho de la columna de la racha en cada losa. */
const COL_RACHA = 64;

const styles = StyleSheet.create({
  bloque: { marginBottom: space.s6 },
  franja: {
    marginBottom: space.s6,
    paddingVertical: space.s3,
    borderTopWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: ink.ink3,
  },
  lista: { paddingHorizontal: space.s4, paddingVertical: 2 },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: space.s2,
  },
  columna: { gap: space.s3 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.s3 },
  celda: { width: '48.5%' },
  celdaAncha: { width: '100%' },
  cuerpo: { flexDirection: 'row', alignItems: 'stretch' },
  // La racha es la protagonista: columna fija con hairline a la derecha.
  colRacha: {
    width: COL_RACHA,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: space.s3,
    marginRight: space.s3,
    borderRightWidth: stroke.hairline,
    borderRightColor: ink.ink4,
  },
  colTexto: { flex: 1, minWidth: 0 },
  nombre: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    lineHeight: 21,
    color: ink.ink9,
  },
  racha: {
    fontFamily: tipo.cifra.family,
    fontSize: tipo.cifra.size,
    lineHeight: tipo.cifra.lineHeight,
    color: ink.ink10,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  objetivo: {
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink6,
    textAlign: 'center',
  },
  barra: { marginTop: space.s3 },
  pie: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.s3,
    gap: space.s2,
  },
  semana: { flexDirection: 'row', gap: 4 },
  dia: {
    width: DIA,
    height: DIA,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: stroke.hairline,
    borderColor: ink.ink3,
  },
  diaOn: { borderColor: ink.ink10 },
  diaTexto: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, color: ink.ink6 },
  diaTextoOn: { color: ink.ink10 },
  restantes: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  restantesListo: { color: ink.ink10 },
  consolidar: { marginTop: space.s4 },
  adquirido: { fontFamily: tipo.cifra.family, fontSize: 16, color: ink.ink10 },
  adquiridoUnidad: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, color: ink.ink6 },
  skFranja: { marginBottom: space.s6 },
  skEyebrow: { marginBottom: 12, marginTop: 16 },
  skCard: { marginBottom: space.s3 },
});
