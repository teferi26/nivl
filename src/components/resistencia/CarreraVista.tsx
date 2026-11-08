// NIVL · Resistencia: la carrera objetivo y su plan por semanas (pura). Una
// decisión por pantalla: qué toca esta semana hacia la carrera. Los efectos, en
// useCarrera; `vistaCarrera` es lo único que transforma las filas y la usa
// también la galería, para que la demo no pueda separarse de la pantalla real.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ErrorSistema } from '@/components/arena';
import { GlifoIron } from '@/components/ironmundo/Glifos';
import {
  BarraIron,
  BotonIron,
  ChipIron,
  FilaIron,
  HuecoIron,
  PantallaIron,
  TarjetaIron,
} from '@/components/ironmundo/piezas';
import { C, F, fs, M, px } from '@/components/ironmundo/tema';
import { EmptyState, Grano } from '@/components/ui';
import { t } from '@/i18n';
import { decimal, fechaCorta, nombreDia } from '@/i18n/formato';
import { addDays, weekdayOfKey } from '@/lib/dates';
import { DISTANCIAS, type Disciplina, type DistanciasPrueba, type Fase, type TipoPrueba } from '@/lib/planCarrera';
import type { NivelCarrera, ObjetivoCarrera, PlanSesionFila } from '@/lib/resistencia';
import { estilosIron, RotuloIron } from './piezas';
import { detalleSesion, tituloSesion } from './textosPlan';

export interface SesionVista {
  id: string;
  fecha: string;
  disciplina: Disciplina;
  titulo: string;
  detalle: string;
  duracion_min: number;
  zona: PlanSesionFila['zona'];
  clave: boolean;
  /** El día de la prueba: se pinta aparte y no suma horas de entrenamiento. */
  esCarrera: boolean;
  hechaEntrenoId: string | null;
  notaCoach: string | null;
}

export interface SemanaVista {
  n: number;
  lunes: string;
  fase: Fase;
  descarga: boolean;
  minutos: number;
  porDisciplina: { disciplina: Disciplina; minutos: number }[];
  sesiones: SesionVista[];
}

export interface ObjetivoVista {
  tipo: TipoPrueba;
  nombre: string | null;
  fecha: string;
  distancias: DistanciasPrueba;
  nivel: NivelCarrera;
  horas_semana: number;
}

export interface DatosCarrera {
  objetivo: ObjetivoVista | null;
  semanas: SemanaVista[];
}

export interface CarreraVistaProps extends DatosCarrera {
  estado: 'cargando' | 'error' | 'listo';
  error: string | null;
  hoy: string;
  /** Quedaban menos de seis semanas al crear el plan. */
  plazoCorto: boolean;
  refreshing: boolean;
  borrando: boolean;
  onRefresh: () => void;
  onReintentar: () => void;
  onVolver: () => void;
  /** Abre la hoja del objetivo (crear o sustituir). */
  onObjetivo: () => void;
  onBorrar: () => void;
  onVerEntreno: (id: string) => void;
  overlay?: ReactNode;
}

const ORDEN_DISCIPLINAS: readonly Disciplina[] = ['natacion', 'bici', 'carrera', 'brick', 'transicion', 'fuerza'];

function aDiaUtc(key: string): number {
  const [a, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(a!, m! - 1, d!) / 86400000);
}

/** Días de `desde` a `hasta`, sin que un cambio de hora se coma ninguno. */
export function diasEntre(desde: string, hasta: string): number {
  return aDiaUtc(hasta) - aDiaUtc(desde);
}

/** La descarga no se guarda en `plan_sesiones`: es la regla de `generarPlan`. */
function esSemanaDescarga(n: number, fase: Fase): boolean {
  return n % 4 === 0 && (fase === 'base' || fase === 'construccion' || fase === 'pico');
}

function semanaDeFilas(n: number, filas: PlanSesionFila[], fechaCarrera: string): SemanaVista {
  const ordenadas = filas.slice().sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  const primera = ordenadas[0]!;
  const fase: Fase = primera.fase ?? 'base';
  const minutosPor = new Map<Disciplina, number>();
  let minutos = 0;
  const sesiones = ordenadas.map((f): SesionVista => {
    const esCarrera = f.fecha === fechaCarrera && f.clave && f.disciplina !== 'descanso';
    if (!esCarrera && f.disciplina !== 'descanso') {
      minutos += f.duracion_min;
      minutosPor.set(f.disciplina, (minutosPor.get(f.disciplina) ?? 0) + f.duracion_min);
    }
    return {
      id: f.id,
      fecha: f.fecha,
      disciplina: f.disciplina,
      titulo: f.titulo,
      detalle: f.detalle,
      duracion_min: f.duracion_min,
      zona: f.zona,
      clave: f.clave,
      esCarrera,
      hechaEntrenoId: f.hecha_entreno_id,
      notaCoach: f.nota_coach,
    };
  });
  return {
    n,
    lunes: addDays(primera.fecha, 1 - weekdayOfKey(primera.fecha)),
    fase,
    descarga: esSemanaDescarga(n, fase),
    minutos,
    porDisciplina: ORDEN_DISCIPLINAS.filter((d) => minutosPor.has(d)).map((disciplina) => ({
      disciplina,
      minutos: minutosPor.get(disciplina)!,
    })),
    sesiones,
  };
}

/** De las filas guardadas a lo que pinta la pantalla. */
export function vistaCarrera(objetivo: ObjetivoCarrera | null, filas: PlanSesionFila[]): DatosCarrera {
  if (!objetivo) return { objetivo: null, semanas: [] };
  const porSemana = new Map<number, PlanSesionFila[]>();
  for (const f of filas) porSemana.set(f.semana, [...(porSemana.get(f.semana) ?? []), f]);
  const base = objetivo.tipo === 'otra' ? null : DISTANCIAS[objetivo.tipo];
  return {
    objetivo: {
      tipo: objetivo.tipo,
      nombre: objetivo.nombre,
      fecha: objetivo.fecha,
      nivel: objetivo.nivel,
      horas_semana: objetivo.horas_semana,
      distancias: {
        natacion_m: objetivo.natacion_m ?? base?.natacion_m ?? 0,
        bici_m: objetivo.bici_m ?? base?.bici_m ?? 0,
        carrera_m: objetivo.carrera_m ?? base?.carrera_m ?? 0,
      },
    },
    semanas: [...porSemana.keys()]
      .sort((a, b) => a - b)
      .map((n) => semanaDeFilas(n, porSemana.get(n)!, objetivo.fecha)),
  };
}

/** El índice de la semana de `hoy`; antes del plan, la primera; después, la última. */
export function indiceSemanaActual(semanas: readonly SemanaVista[], hoy: string): number {
  const i = semanas.findIndex((s) => hoy >= s.lunes && hoy <= addDays(s.lunes, 6));
  if (i >= 0) return i;
  return semanas.length > 0 && hoy > semanas[semanas.length - 1]!.lunes ? semanas.length - 1 : 0;
}

function kmTexto(metros: number): string {
  return metros < 1000
    ? t('resistenciaPlan:unidad.m', { valor: decimal(metros) })
    : t('resistenciaPlan:unidad.km', { valor: decimal(metros / 1000, metros % 1000 === 0 ? 0 : 1) });
}

function distanciasTexto(d: DistanciasPrueba): string {
  return [d.natacion_m, d.bici_m, d.carrera_m]
    .filter((m) => m > 0)
    .map(kmTexto)
    .join(' · ');
}

export function minutosTexto(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos - h * 60);
  if (h === 0) return t('resistenciaPlan:unidad.min', { min: m });
  return m === 0 ? t('resistenciaPlan:unidad.h', { h }) : t('resistenciaPlan:unidad.hMin', { h, min: String(m).padStart(2, '0') });
}

function nombreDisciplina(d: Disciplina): string {
  return t(`resistenciaPlan:disciplina.${d}`);
}

function Cabecera({ onVolver }: { onVolver: () => void }) {
  return (
    <View style={styles.cabecera}>
      <Pressable onPress={onVolver} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('ironmundo:volver')} style={styles.atras}>
        <GlifoIron nombre="atras" lado={px(18)} color={C.mudo} grosor={2.2} />
      </Pressable>
      <View style={styles.flex}>
        <Text style={styles.titulo} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
          {t('resistenciaPlan:carrera.titulo')}
        </Text>
        <Text style={styles.subtitulo} numberOfLines={1} maxFontSizeMultiplier={1.35}>
          {t('resistenciaPlan:carrera.sub')}
        </Text>
      </View>
    </View>
  );
}

function Cumplida({ onObjetivo }: { onObjetivo: () => void }) {
  return (
    <TarjetaIron>
      <Grano />
      <Text style={estilosIron.titulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
        {t('resistenciaPlan:carrera.cumplidaCuerpo')}
      </Text>
      <BotonIron titulo={t('resistenciaPlan:carrera.elegirSiguiente')} onPress={onObjetivo} />
    </TarjetaIron>
  );
}

function Heroe({ objetivo, semanas, hoy }: { objetivo: ObjetivoVista; semanas: SemanaVista[]; hoy: string }) {
  const dias = diasEntre(hoy, objetivo.fecha);
  const total = semanas.length;
  const actual = total > 0 ? indiceSemanaActual(semanas, hoy) + 1 : 0;
  const nombre = objetivo.nombre?.trim() || t(`resistenciaPlan:tipo.${objetivo.tipo}`);
  const cuenta =
    dias < 0
      ? t('resistenciaPlan:carrera.terminada')
      : dias === 0
        ? t('resistenciaPlan:carrera.esHoy')
        : t('resistenciaPlan:carrera.faltan', { count: dias });
  return (
    <TarjetaIron heroe>
      <RotuloIron texto={t(`resistenciaPlan:tipo.${objetivo.tipo}`)} em={total > 0 ? t('resistenciaPlan:carrera.semanaDe', { n: actual, total }) : undefined} />
      <Text style={estilosIron.titulo} accessibilityRole="header" numberOfLines={2} maxFontSizeMultiplier={1.35}>
        {nombre}
      </Text>
      <Text style={estilosIron.meta} maxFontSizeMultiplier={1.6}>
        {[fechaCorta(objetivo.fecha), distanciasTexto(objetivo.distancias)].filter(Boolean).join(' · ')}
      </Text>
      <Text style={styles.cuenta} maxFontSizeMultiplier={1.2}>
        {cuenta}
      </Text>
      {total > 0 ? <BarraIron ratio={actual / total} style={styles.barra} /> : null}
    </TarjetaIron>
  );
}

function FilaSesion({
  s,
  primera,
  hoy,
  abierta,
  onAlternar,
  onVerEntreno,
}: {
  s: SesionVista;
  primera: boolean;
  hoy: string;
  abierta: boolean;
  onAlternar: () => void;
  onVerEntreno: (id: string) => void;
}) {
  const descanso = s.disciplina === 'descanso';
  const dia = nombreDia(weekdayOfKey(s.fecha) - 1).slice(0, 3);
  const hecha = s.hechaEntrenoId !== null;
  const esHoy = s.fecha === hoy;
  const meta = descanso
    ? nombreDisciplina('descanso')
    : [nombreDisciplina(s.disciplina), minutosTexto(s.duracion_min), s.zona ? t(`resistenciaPlan:zona.${s.zona}`) : null].filter(Boolean).join(' · ');
  const titulo = tituloSesion(s.titulo);
  const leido = t('resistenciaPlan:carrera.sesionA11y', {
    dia: fechaCorta(s.fecha),
    titulo,
    meta,
    estado: hecha ? t('resistenciaPlan:carrera.hecha') : esHoy ? t('resistenciaPlan:carrera.hoy') : '',
  });
  return (
    <View>
      <FilaIron
        primera={primera}
        onPress={descanso ? undefined : onAlternar}
        accessibilityLabel={leido}
        accessibilityState={descanso ? undefined : { expanded: abierta }}
        accessibilityHint={descanso ? undefined : t('resistenciaPlan:carrera.verDetalleHint')}
        style={styles.fila}
      >
        <View style={[styles.dia, esHoy && styles.diaCeldaHoy]}>
          <Text style={[styles.diaNombre, esHoy && styles.diaTextoHoy]} maxFontSizeMultiplier={1.2}>
            {dia}
          </Text>
          <Text style={[styles.diaNumero, esHoy && styles.diaTextoHoy]} maxFontSizeMultiplier={1.2}>
            {Number(s.fecha.slice(8))}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text style={[estilosIron.filaNombre, descanso && styles.apagado, hecha && styles.hecha]} numberOfLines={2} maxFontSizeMultiplier={1.5}>
            {titulo}
          </Text>
          {descanso ? null : (
            <Text style={estilosIron.detalle} numberOfLines={1} maxFontSizeMultiplier={1.5}>
              {meta}
            </Text>
          )}
        </View>
        {s.esCarrera ? (
          <Text style={estilosIron.etiqueta} maxFontSizeMultiplier={1.2}>
            {t('resistenciaPlan:carrera.etiquetaCarrera')}
          </Text>
        ) : s.clave && !hecha ? (
          <Text style={styles.clave} maxFontSizeMultiplier={1.2}>
            {t('resistenciaPlan:carrera.clave')}
          </Text>
        ) : null}
        {hecha ? <GlifoIron nombre="check" lado={px(15)} color={C.blanco} grosor={2.4} /> : null}
        {descanso ? null : <Ionicons name={abierta ? 'chevron-up' : 'chevron-down'} size={14} color={C.mudo} />}
      </FilaIron>
      {abierta && !descanso ? (
        <View style={styles.abierta}>
          <Text style={estilosIron.cuerpo} maxFontSizeMultiplier={1.6}>
            {detalleSesion(s.detalle)}
          </Text>
          {s.notaCoach ? (
            <Text style={[estilosIron.detalle, styles.nota]} maxFontSizeMultiplier={1.6}>
              {t('resistenciaPlan:carrera.notaCoach', { nota: s.notaCoach })}
            </Text>
          ) : null}
          {s.hechaEntrenoId ? (
            <BotonIron fantasma fino titulo={t('resistenciaPlan:carrera.verEntreno')} onPress={() => onVerEntreno(s.hechaEntrenoId!)} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Semana({
  s,
  total,
  hoy,
  onVerEntreno,
}: {
  s: SemanaVista;
  total: number;
  hoy: string;
  onVerEntreno: (id: string) => void;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const maximo = Math.max(1, ...s.porDisciplina.map((d) => d.minutos));
  const fase = s.descarga
    ? t('resistenciaPlan:carrera.faseDescarga', { fase: t(`resistenciaPlan:fase.${s.fase}`) })
    : t(`resistenciaPlan:fase.${s.fase}`);
  return (
    <TarjetaIron>
      <RotuloIron texto={t('resistenciaPlan:carrera.semanaDe', { n: s.n, total })} em={fase} />
      <Text style={estilosIron.meta} maxFontSizeMultiplier={1.6}>
        {t('resistenciaPlan:carrera.rangoSemana', {
          desde: fechaCorta(s.lunes),
          hasta: fechaCorta(addDays(s.lunes, 6)),
          duracion: minutosTexto(s.minutos),
        })}
      </Text>
      <Text style={estilosIron.detalle} maxFontSizeMultiplier={1.6}>
        {t(`resistenciaPlan:fasePista.${s.fase}`)}
        {s.descarga ? ` ${t('resistenciaPlan:carrera.descargaPista')}` : ''}
      </Text>
      {s.porDisciplina.length > 0 ? (
        <View style={styles.reparto}>
          {s.porDisciplina.map((d) => (
            <View
              key={d.disciplina}
              style={styles.repartoFila}
              accessible
              // i18n-ok
              accessibilityLabel={`${nombreDisciplina(d.disciplina)}: ${minutosTexto(d.minutos)}`}
            >
              <Text style={[estilosIron.detalle, styles.repartoNombre]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                {nombreDisciplina(d.disciplina)}
              </Text>
              <BarraIron ratio={d.minutos / maximo} style={styles.flex} />
              <Text style={[estilosIron.detalle, styles.repartoValor]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                {minutosTexto(d.minutos)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.sesiones}>
        {s.sesiones.map((x, i) => (
          <FilaSesion
            key={x.id}
            s={x}
            primera={i === 0}
            hoy={hoy}
            abierta={abierta === x.id}
            onAlternar={() => setAbierta((a) => (a === x.id ? null : x.id))}
            onVerEntreno={onVerEntreno}
          />
        ))}
      </View>
    </TarjetaIron>
  );
}

export function CarreraVista(p: CarreraVistaProps) {
  const [elegida, setElegida] = useState<number | null>(null);
  const selector = useRef<ScrollView>(null);
  const situado = useRef(false);
  const actual = indiceSemanaActual(p.semanas, p.hoy);
  const i = elegida !== null && elegida < p.semanas.length ? elegida : actual;
  const semana = p.semanas[i];

  if (p.estado === 'cargando') {
    return (
      <PantallaIron overlay={p.overlay}>
        <Cabecera onVolver={p.onVolver} />
        <View accessibilityRole="progressbar" accessibilityLabel={t('resistenciaPlan:carrera.cargandoA11y')} style={styles.huecos}>
          <HuecoIron alto={px(120)} />
          <HuecoIron alto={px(34)} />
          <HuecoIron alto={px(300)} />
        </View>
      </PantallaIron>
    );
  }

  if (p.estado === 'error') {
    return (
      <PantallaIron overlay={p.overlay}>
        <Cabecera onVolver={p.onVolver} />
        <ErrorSistema mensaje={p.error ?? ''} onReintentar={p.onReintentar} />
      </PantallaIron>
    );
  }

  if (!p.objetivo) {
    return (
      <PantallaIron overlay={p.overlay} refreshing={p.refreshing} onRefresh={p.onRefresh}>
        <Cabecera onVolver={p.onVolver} />
        {p.error ? <ErrorSistema compacto mensaje={p.error} onReintentar={p.onReintentar} /> : null}
        <EmptyState
          icon="flag-outline"
          title={t('resistenciaPlan:carrera.vacioTitulo')}
          body={t('resistenciaPlan:carrera.vacioCuerpo')}
          action={{ label: t('resistenciaPlan:carrera.crear'), onPress: p.onObjetivo, variant: 'solid' }}
        />
      </PantallaIron>
    );
  }

  const terminada = diasEntre(p.hoy, p.objetivo.fecha) < 0;
  return (
    <PantallaIron overlay={p.overlay} refreshing={p.refreshing} onRefresh={p.onRefresh}>
      <Cabecera onVolver={p.onVolver} />
      {p.error ? <ErrorSistema compacto mensaje={p.error} onReintentar={p.onReintentar} /> : null}
      <Heroe objetivo={p.objetivo} semanas={p.semanas} hoy={p.hoy} />
      {terminada ? <Cumplida onObjetivo={p.onObjetivo} /> : null}
      {p.plazoCorto ? (
        <TarjetaIron>
          <Text style={estilosIron.cuerpo} maxFontSizeMultiplier={1.6}>
            {t('resistenciaPlan:carrera.plazoCorto')}
          </Text>
        </TarjetaIron>
      ) : null}
      {p.semanas.length > 1 ? (
        <ScrollView
          ref={selector}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Una vez y sin animación: la semana en curso, a la vista al entrar.
          onContentSizeChange={(ancho) => {
            if (situado.current) return;
            situado.current = true;
            selector.current?.scrollTo({ x: Math.max(0, (ancho * actual) / p.semanas.length - px(40)), animated: false });
          }}
          contentContainerStyle={styles.chips}
          accessibilityRole="tablist"
          accessibilityLabel={t('resistenciaPlan:carrera.semanasA11y')}
        >
          {p.semanas.map((s, k) => (
            <ChipIron
              key={s.n}
              pestana
              texto={t('resistenciaPlan:carrera.chipSemana', { n: s.n })}
              activo={k === i}
              onPress={() => setElegida(k)}
              accessibilityLabel={t('resistenciaPlan:carrera.chipSemanaA11y', { n: s.n, fase: t(`resistenciaPlan:fase.${s.fase}`) })}
            />
          ))}
        </ScrollView>
      ) : null}
      {semana ? <Semana key={semana.n} s={semana} total={p.semanas.length} hoy={p.hoy} onVerEntreno={p.onVerEntreno} /> : null}
      {terminada ? null : <BotonIron fantasma titulo={t('resistenciaPlan:carrera.cambiar')} onPress={p.onObjetivo} />}
      <Pressable
        onPress={p.onBorrar}
        disabled={p.borrando}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityState={{ disabled: p.borrando, busy: p.borrando }}
        style={styles.borrar}
      >
        <Text style={styles.borrarTexto} maxFontSizeMultiplier={1.35}>
          {t('resistenciaPlan:carrera.borrar')}
        </Text>
      </Pressable>
    </PantallaIron>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: px(9), paddingTop: px(4), marginBottom: px(2) },
  atras: { paddingVertical: px(4) },
  titulo: { fontFamily: F.serif, fontSize: fs(16), color: C.blanco },
  subtitulo: { fontFamily: F.m, fontSize: fs(9.5), letterSpacing: fs(9.5) * 0.06, color: C.mudo, marginTop: px(2) },
  huecos: { gap: M.hueco },
  cuenta: { fontFamily: F.serif, fontSize: fs(17), lineHeight: Math.round(fs(17) * 1.3), color: C.blanco, marginTop: px(8) },
  barra: { marginTop: px(8) },
  chips: { gap: px(6), paddingVertical: px(2) },
  reparto: { gap: px(4), marginTop: px(8), marginBottom: px(4) },
  repartoFila: { flexDirection: 'row', alignItems: 'center', gap: px(8) },
  repartoNombre: { width: px(92) },
  repartoValor: { width: px(62), textAlign: 'right' },
  sesiones: { marginTop: px(4) },
  fila: { paddingVertical: px(7), minHeight: 44 },
  dia: { width: px(30), alignItems: 'center', paddingVertical: px(2) },
  diaCeldaHoy: { backgroundColor: C.blanco },
  diaNombre: { fontFamily: F.b, fontSize: fs(9.5), color: C.mudo, textTransform: 'uppercase' },
  diaNumero: { fontFamily: F.xb, fontSize: fs(13), color: C.texto },
  diaTextoHoy: { color: C.fondo },
  apagado: { color: C.mudo },
  hecha: { color: C.mudo, textDecorationLine: 'line-through' },
  clave: {
    fontFamily: F.b,
    fontSize: fs(9.5),
    letterSpacing: fs(9.5) * 0.12,
    color: C.claro,
    borderWidth: 1,
    borderColor: C.borde,
    paddingHorizontal: px(5),
    paddingVertical: px(2),
    overflow: 'hidden',
  },
  abierta: { paddingLeft: px(38), paddingBottom: px(8) },
  nota: { marginTop: px(5) },
  borrar: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: px(10) },
  borrarTexto: { fontFamily: F.m, fontSize: fs(10), color: C.mudo, textDecorationLine: 'underline' },
});
