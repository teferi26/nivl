// NIVL · Mundo FOCUS: el inicio, «el bloque de foco» (P01, lámina 3). Pura.
//
// De arriba abajo, como la lámina:
//   0 · La cabecera del mundo (emblema, FOCUS, nivel de FOCUS).
//   1 · SESIÓN DE FOCO: el reloj del pomodoro, qué se estudia, «móvil en
//       silencio al empezar» y EMPEZAR BLOQUE (la única superficie llena).
//   2 · EXÁMENES: los dos próximos, con días que faltan y % del temario.
//   3 · TEMARIO de la asignatura en foco: casillas pendiente/repasando/dominado.
//   4 · PLAN DE ESTUDIO DE HOY: los bloques que reparte el plan automático.
//   5 · TU FOCO DE HOY: las misiones de FOCUS (pagan por complete_quest).
//   6 · COACH FOCUS: una línea del sistema y la entrada al chat.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Entrada, ErrorSistema } from '@/components/arena';
import { Screen, Skeleton } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import type { BloquePlan, ExamenVista } from '@/focus/resumen';
import type { Fase, Situacion } from '@/focus/pomodoro';
import type { EstadoTema } from '@/focus/tipos';
import { hhmm } from '@/focus/fechas';
import { t } from '@/i18n';
import { F } from './estilo';
import { AnilloReloj, BarraFocus, BotonFocus, Casilla, ChipFocus, Etiqueta, FilaFocus, Rotulo, TarjetaFocus, VacioFocus, textoFocus } from './Piezas';

export interface SesionVista {
  fase: Fase;
  bloque: number;
  cadaLargo: number;
  situacion: Situacion;
  reloj: string;
  ratio: number;
  /** La asignatura del bloque (null: bloque libre). */
  asignatura: string | null;
  /** «Tema 4 · Árboles binarios», o null. */
  tema: string | null;
  /** La misión que paga el bloque si se termina entero. */
  mision: { titulo: string; xp: number } | null;
  /** Hay misiones de FOCUS que se podrían enlazar. */
  hayMisiones: boolean;
  foco: number;
  descanso: number;
}

export interface TemaFila {
  id: string;
  nombre: string;
  estado: EstadoTema;
}

export interface MisionFila {
  id: string;
  titulo: string;
  hecha: boolean;
  xp: number;
  ocupada: boolean;
}

export interface FocusHoyVistaProps {
  cabecera: ReactNode;
  estado: 'cargando' | 'listo' | 'error';
  error: string | null;
  /** false: la 0076 aún no está en el servidor (estado vacío tranquilo). */
  disponible: boolean;
  refrescando?: boolean;
  sesion: SesionVista;
  examenes: ExamenVista[];
  /** Asignatura en foco y unos pocos temas alrededor de por dónde va. */
  temario: { asignatura: string; temas: TemaFila[]; total: number } | null;
  plan: BloquePlan[];
  /** null mientras cargan las misiones. */
  misiones: MisionFila[] | null;
  coach: string;
  sinAsignaturas: boolean;
  acciones: {
    onEmpezar: () => void;
    onPausar: () => void;
    onSaltar: () => void;
    onParar: () => void;
    onAjustes: () => void;
    onElegirMision: () => void;
    onNoMolestar: () => void;
    onExamenes: () => void;
    onExamen: (id: string) => void;
    onTemario: () => void;
    onAlternarTema: (id: string) => void;
    onBloque: (b: BloquePlan) => void;
    onCompletarMision: (id: string) => void;
    onCoach: () => void;
    onAnadirAsignatura: () => void;
    onAnadirExamen: () => void;
    onReintentar: () => void;
    onRefrescar?: () => void;
  };
}

const EXAMENES_EN_INICIO = 2;
const BLOQUES_EN_INICIO = 3;

export function etiquetaDias(dias: number): string {
  if (dias <= 0) return t('focus:comun.hoy');
  if (dias === 1) return t('focus:comun.manana');
  return t('focus:comun.enDias', { count: dias });
}

function Sesion({ s, acciones }: { s: SesionVista; acciones: FocusHoyVistaProps['acciones'] }) {
  const foco = s.fase === 'foco';
  const rotuloDerecha =
    s.fase === 'foco' ? t('focus:hoy.bloque', { n: s.bloque, de: s.cadaLargo }) : s.fase === 'largo' ? t('focus:hoy.descansoLargo') : t('focus:hoy.descanso');
  const titulo = foco ? (s.asignatura ?? t('focus:hoy.bloqueLibre')) : t('focus:hoy.descansoTitulo');
  const principal =
    s.situacion === 'en_marcha'
      ? foco
        ? { titulo: t('focus:hoy.pausar'), onPress: acciones.onPausar, icono: 'pause' as const }
        : { titulo: t('focus:hoy.saltarDescanso'), onPress: acciones.onSaltar, icono: undefined }
      : s.situacion === 'en_pausa'
        ? { titulo: t('focus:hoy.seguir'), onPress: acciones.onEmpezar, icono: 'play' as const }
        : { titulo: foco ? t('focus:hoy.empezar') : t('focus:hoy.empezarDescanso'), onPress: acciones.onEmpezar, icono: undefined };
  const resumenA11y = t('focus:hoy.sesionA11y', { reloj: s.reloj, titulo, fase: rotuloDerecha });

  return (
    <TarjetaFocus heroe>
      <Rotulo
        texto={t('focus:hoy.sesionRotulo')}
        derecha={rotuloDerecha}
        icono={{ nombre: 'options-outline', a11y: t('focus:hoy.ajustesA11y', { foco: s.foco, descanso: s.descanso }), onPress: acciones.onAjustes }}
      />
      <View style={styles.sesion}>
        <View accessible accessibilityRole="timer" accessibilityLabel={resumenA11y}>
          <AnilloReloj ratio={s.ratio} reloj={s.reloj} pie={foco ? t('focus:hoy.relojBloque') : t('focus:hoy.relojDescanso')} apagado={!foco} />
        </View>
        <View style={styles.sesionTextos}>
          <Text style={textoFocus.titulo} maxFontSizeMultiplier={1.35} numberOfLines={2}>
            {titulo}
          </Text>
          {foco && s.tema ? (
            <Text style={styles.sesionMeta} maxFontSizeMultiplier={1.35} numberOfLines={1}>
              {s.tema}
            </Text>
          ) : null}
          {!foco ? (
            <Text style={styles.sesionMeta} maxFontSizeMultiplier={1.35} numberOfLines={2}>
              {t('focus:hoy.descansoCuerpo')}
            </Text>
          ) : null}
          {foco ? (
            <Pressable
              onPress={acciones.onNoMolestar}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityHint={t('focus:hoy.noMolestarA11y')}
              style={({ pressed }) => [styles.silencio, pressed && styles.pulsado]}
            >
              <Text style={styles.silencioTexto} maxFontSizeMultiplier={1.35}>
                {t('focus:hoy.silencio')}
              </Text>
            </Pressable>
          ) : null}
          {foco && (s.mision || s.hayMisiones) ? (
            <Pressable
              onPress={acciones.onElegirMision}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={s.mision ? t('focus:hoy.misionPagaA11y', { titulo: s.mision.titulo, xp: s.mision.xp }) : t('focus:hoy.misionElegir')}
              style={({ pressed }) => [styles.mision, pressed && styles.pulsado]}
            >
              {s.mision ? null : <Ionicons name="flag-outline" size={13} color={F.rotulo} />}
              <Text style={styles.misionTexto} maxFontSizeMultiplier={1.35} numberOfLines={1}>
                {s.mision ? (
                  <>
                    <Text style={styles.misionXp}>{t('focus:hoy.hastaXp', { xp: s.mision.xp })}</Text> {t('focus:hoy.alTerminar')}
                  </>
                ) : (
                  t('focus:hoy.misionElegir')
                )}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <BotonFocus titulo={principal.titulo} icono={principal.icono} onPress={principal.onPress} style={styles.botonGrande} />
      {s.situacion !== 'parado' || !foco ? (
        <View style={styles.secundarios}>
          {s.situacion !== 'parado' ? (
            <BotonFocus titulo={t('focus:hoy.parar')} variante="texto" pequeno onPress={acciones.onParar} />
          ) : null}
          {foco || s.situacion === 'parado' ? <BotonFocus titulo={t('focus:hoy.saltar')} variante="texto" pequeno onPress={acciones.onSaltar} /> : null}
        </View>
      ) : null}
    </TarjetaFocus>
  );
}

function Examenes({ examenes, acciones }: { examenes: ExamenVista[]; acciones: FocusHoyVistaProps['acciones'] }) {
  const lista = examenes.slice(0, EXAMENES_EN_INICIO);
  return (
    <TarjetaFocus>
      <Rotulo
        texto={t('focus:hoy.examenesRotulo')}
        derecha={examenes.length > 0 ? t('focus:hoy.proximos', { count: examenes.length }) : t('focus:hoy.anadir')}
        onDerecha={examenes.length > 0 ? acciones.onExamenes : acciones.onAnadirExamen}
      />
      {lista.length === 0 ? (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:hoy.examenesVacio')}
        </Text>
      ) : (
        lista.map((e, i) => (
          <Pressable
            key={e.examen.id}
            onPress={() => acciones.onExamen(e.examen.id)}
            accessibilityRole="button"
            accessibilityLabel={t('focus:hoy.examenA11y', { asignatura: e.asignatura, dias: etiquetaDias(e.dias), progreso: e.progreso })}
            style={({ pressed }) => [styles.examen, styles.separado, i === 0 && styles.primeraFila, pressed && styles.pulsado]}
          >
            <View style={styles.examenFila}>
              <Text style={[textoFocus.filaFuerte, styles.flex]} maxFontSizeMultiplier={1.35} numberOfLines={1}>
                {e.asignatura}
              </Text>
              <Etiqueta texto={etiquetaDias(e.dias)} />
            </View>
            <View style={styles.examenFila}>
              <BarraFocus ratio={e.progreso / 100} style={styles.flex} />
              <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35}>
                {t('focus:hoy.temarioPct', { pct: e.progreso })}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </TarjetaFocus>
  );
}

export function etiquetaEstado(e: EstadoTema): string {
  return t(`focus:estado.${e}`);
}

function Temario({ temario, acciones }: { temario: NonNullable<FocusHoyVistaProps['temario']>; acciones: FocusHoyVistaProps['acciones'] }) {
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:hoy.temarioRotulo', { asignatura: temario.asignatura })} derecha={t('focus:hoy.verTodo')} onDerecha={acciones.onTemario} />
      {temario.temas.length === 0 ? (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:hoy.temarioVacio')}
        </Text>
      ) : (
        <View style={styles.arriba}>
          {temario.temas.map((x, i) => (
            <FilaFocus
              key={x.id}
              primera={false}
              onPress={() => acciones.onAlternarTema(x.id)}
              accessibilityLabel={t('focus:hoy.temaA11y', { nombre: x.nombre, estado: etiquetaEstado(x.estado) })}
              accessibilityHint={t('focus:hoy.temaHint')}
            >
              <View style={styles.temaIzq}>
                <Casilla estado={x.estado === 'dominado' ? 'hecha' : x.estado === 'repasando' ? 'media' : 'vacia'} />
                <Text style={[textoFocus.fila, styles.flex]} maxFontSizeMultiplier={1.35} numberOfLines={1}>
                  {x.nombre}
                </Text>
              </View>
              <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35}>
                {etiquetaEstado(x.estado)}
              </Text>
            </FilaFocus>
          ))}
        </View>
      )}
    </TarjetaFocus>
  );
}

/** «Estructuras de datos» → «Estructuras»: en un chip de tres por fila cabe una palabra. */
export function nombreCorto(nombre: string): string {
  if (nombre.length <= 12) return nombre;
  return nombre.split(/\s+/)[0] ?? nombre;
}

function tituloBloque(b: BloquePlan): string {
  if (b.tipo === 'simulacro') return t('focus:plan.simulacroCorto');
  if (b.tipo === 'repasar') return t('focus:plan.repasoCorto');
  return nombreCorto(b.asignatura);
}

function Plan({ plan, acciones }: { plan: BloquePlan[]; acciones: FocusHoyVistaProps['acciones'] }) {
  const lista = plan.slice(0, BLOQUES_EN_INICIO);
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:hoy.planRotulo')} />
      {lista.length === 0 ? (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:hoy.planVacio')}
        </Text>
      ) : (
        <View style={styles.plan}>
          {lista.map((b, i) => (
            <ChipFocus
              key={`${b.examenId}-${b.temaId ?? 's'}-${b.tipo}-${i}`}
              arriba={b.hora === null ? t('focus:comun.hoy') : hhmm(b.hora)}
              titulo={tituloBloque(b)}
              activo={b.tipo === 'estudiar'}
              onPress={() => acciones.onBloque(b)}
              accessibilityLabel={t('focus:hoy.bloqueA11y', {
                hora: b.hora === null ? t('focus:comun.hoy') : hhmm(b.hora),
                titulo: tituloBloque(b),
                tema: b.tema ?? b.asignatura,
              })}
              style={styles.flex}
            />
          ))}
        </View>
      )}
    </TarjetaFocus>
  );
}

function Misiones({ misiones, acciones }: { misiones: MisionFila[]; acciones: FocusHoyVistaProps['acciones'] }) {
  const hechas = misiones.filter((m) => m.hecha).length;
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:hoy.misionesRotulo')} derecha={t('focus:hoy.deTotal', { n: hechas, total: misiones.length })} />
      <View style={styles.arriba}>
        {misiones.map((m, i) => (
          <FilaFocus
            key={m.id}
            primera={false}
            onPress={m.hecha || m.ocupada ? undefined : () => acciones.onCompletarMision(m.id)}
            accessibilityLabel={m.hecha ? t('focus:hoy.misionHechaA11y', { titulo: m.titulo }) : t('focus:hoy.misionA11y', { titulo: m.titulo, xp: m.xp })}
          >
            <View style={styles.temaIzq}>
              <Casilla estado={m.hecha ? 'hecha' : 'vacia'} />
              <Text style={[textoFocus.fila, styles.flex, m.hecha && styles.tachado]} maxFontSizeMultiplier={1.35} numberOfLines={2}>
                {m.titulo}
              </Text>
            </View>
            <Text style={[textoFocus.detalle, !m.hecha && styles.xp]} maxFontSizeMultiplier={1.35}>
              {m.hecha ? t('focus:hoy.hecha') : t('focus:hoy.hastaXp', { xp: m.xp })}
            </Text>
          </FilaFocus>
        ))}
      </View>
    </TarjetaFocus>
  );
}

function Coach({ frase, onCoach }: { frase: string; onCoach: () => void }) {
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:hoy.coachRotulo')} derecha={t('focus:hoy.coachEstado')} />
      <View style={styles.chat}>
        <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="locate-outline" size={19} color={F.acento} />
        </View>
        <View style={styles.burbuja}>
          <Text style={styles.burbujaTexto} maxFontSizeMultiplier={1.5}>
            {frase}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onCoach}
        accessibilityRole="button"
        accessibilityLabel={t('focus:hoy.coachPregunta')}
        style={({ pressed }) => [styles.entrada, pressed && styles.pulsado]}
      >
        <Text style={styles.entradaTexto} maxFontSizeMultiplier={1.35} numberOfLines={1}>
          {t('focus:hoy.coachPregunta')}
        </Text>
        <View style={styles.enviar}>
          <Ionicons name="arrow-forward" size={16} color={F.sobreAcento} />
        </View>
      </Pressable>
    </TarjetaFocus>
  );
}

function Huecos() {
  return (
    <View style={styles.huecos} accessibilityRole="progressbar" accessibilityLabel={t('focus:comun.cargandoA11y')}>
      <Skeleton height={132} />
      <Skeleton height={120} />
    </View>
  );
}

export function FocusHoyVista(p: FocusHoyVistaProps) {
  const { acciones } = p;
  const listo = p.estado === 'listo';
  let i = 2;
  return (
    <Screen refreshing={p.refrescando} onRefresh={acciones.onRefrescar} contentStyle={styles.contenido}>
      <Entrada indice={0}>{p.cabecera}</Entrada>

      <Entrada indice={1} style={styles.bloque}>
        <Sesion s={p.sesion} acciones={acciones} />
      </Entrada>

      {p.estado === 'cargando' ? (
        <Huecos />
      ) : p.estado === 'error' ? (
        <View style={styles.bloque}>
          <ErrorSistema mensaje={p.error ?? ''} onReintentar={acciones.onReintentar} compacto />
        </View>
      ) : !p.disponible ? (
        <Entrada indice={2} style={styles.bloque}>
          <TarjetaFocus>
            <VacioFocus rotulo={t('focus:hoy.asignaturasRotulo')} icono="hourglass-outline" titulo={t('focus:comun.noDisponibleTitulo')} cuerpo={t('focus:comun.noDisponibleCuerpo')} />
          </TarjetaFocus>
        </Entrada>
      ) : p.sinAsignaturas ? (
        <Entrada indice={2} style={styles.bloque}>
          <TarjetaFocus>
            <VacioFocus
              rotulo={t('focus:hoy.asignaturasRotulo')}
              icono="school-outline"
              titulo={t('focus:hoy.empiezaTitulo')}
              cuerpo={t('focus:hoy.empiezaCuerpo')}
              accion={{ titulo: t('focus:hoy.anadirAsignatura'), onPress: acciones.onAnadirAsignatura }}
            />
          </TarjetaFocus>
        </Entrada>
      ) : (
        <>
          <Entrada indice={i++} style={styles.bloque}>
            <Examenes examenes={p.examenes} acciones={acciones} />
          </Entrada>
          {p.temario ? (
            <Entrada indice={i++} style={styles.bloque}>
              <Temario temario={p.temario} acciones={acciones} />
            </Entrada>
          ) : null}
          <Entrada indice={i++} style={styles.bloque}>
            <Plan plan={p.plan} acciones={acciones} />
          </Entrada>
        </>
      )}

      <Entrada indice={6} style={styles.bloque}>
        <Coach frase={p.coach} onCoach={acciones.onCoach} />
      </Entrada>
      {listo && p.misiones && p.misiones.length > 0 ? (
        <Entrada indice={7} style={styles.bloque}>
          <Misiones misiones={p.misiones} acciones={acciones} />
        </Entrada>
      ) : null}

    </Screen>
  );
}

const styles = StyleSheet.create({
  contenido: { paddingBottom: space.s8 },
  bloque: { marginBottom: space.s2 },
  flex: { flex: 1, minWidth: 0 },
  arriba: { marginTop: space.s2 },
  arribaPoco: { marginTop: space.s1 },
  separado: { borderTopWidth: 1, borderTopColor: F.separador },
  primeraFila: { marginTop: space.s2 },
  pulsado: { opacity: 0.7 },
  sesion: { flexDirection: 'row', alignItems: 'center', gap: space.s4, marginTop: space.s2 },
  sesionTextos: { flex: 1, minWidth: 0, gap: 1 },
  sesionMeta: { fontFamily: tipo.bodySm.family, fontSize: 13, lineHeight: 17, color: F.meta },
  silencio: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1, alignSelf: 'flex-start', minHeight: 22 },
  silencioTexto: { fontFamily: tipo.micro.family, fontSize: 13, lineHeight: 17, color: F.acento },
  mision: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 20 },
  misionXp: { fontFamily: tipo.micro.family, color: F.acento },
  misionTexto: { flex: 1, fontFamily: tipo.bodySm.family, fontSize: 12, lineHeight: 17, color: F.rotulo },
  botonGrande: { marginTop: space.s3 - 2 },
  secundarios: { flexDirection: 'row', justifyContent: 'center', gap: space.s4, marginTop: space.s1 },
  ajustes: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.s2, minHeight: 36, marginTop: space.s1 },
  ajustesTexto: { fontFamily: tipo.bodySm.family, fontSize: 13, lineHeight: 18, color: F.rotulo },
  ajustesAccion: { fontFamily: tipo.label.family, fontSize: 12, lineHeight: 18, letterSpacing: 1.2, color: F.acento, textTransform: 'uppercase' },
  examen: { paddingVertical: 6, gap: 5 },
  examenFila: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  temaIzq: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  plan: { flexDirection: 'row', gap: space.s2, marginTop: space.s2 },
  tachado: { textDecorationLine: 'line-through', color: F.rotulo },
  xp: { color: F.acento },
  chat: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3, marginTop: space.s2 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: F.acento,
    backgroundColor: F.activo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burbuja: {
    flex: 1,
    backgroundColor: F.burbuja,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    paddingHorizontal: space.s3,
    paddingVertical: space.s3 - 2,
  },
  burbujaTexto: { fontFamily: tipo.body.family, fontSize: 14, lineHeight: 19, color: ink.ink9 },
  entrada: {
    marginTop: space.s3,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: F.linea,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: space.s4,
    paddingRight: 6,
  },
  entradaTexto: { flex: 1, fontFamily: tipo.bodySm.family, fontSize: 14, lineHeight: 20, color: F.rotulo },
  enviar: { width: 34, height: 34, borderRadius: 10, backgroundColor: F.acento, alignItems: 'center', justifyContent: 'center' },
  huecos: { gap: space.s3, marginBottom: space.s3 },
});
