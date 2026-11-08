// NIVL · Mundo FOCUS: el inicio. Pura.
//
// Sin datos, el arranque guiado en vez del reloj. Con datos, de arriba abajo:
//   · Héroe (el próximo examen y el nivel en el escudo) y coach.
//   · Hueco, si se vuelve tras unos días.
//   · AHORA: qué se estudia, por qué y EMPEZAR (el único botón hueso).
//   · Tres cifras y el plan de hoy entero («ver todo»), con aviso si no se llega.
//   · Entregas y deberes, por encima de los exámenes.
//   · Siguiente clase y la entrada única a los repasos.
//   · Exámenes, temario y misiones.
// Con un bloque en marcha, PantallaConcentracion a pantalla completa.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Entrada, ErrorSistema, formatoMiles, ratioSeguro } from '@/components/arena';
import { HeroMundo, TarjetaCoach, TresCifras, tituloAhora, type CifraMundo } from '@/components/modos/mundo/PiezasOnix';
import { Screen, Skeleton } from '@/components/ui';
import { space, type as tipo } from '@/design/tokens';
import type { ExamenDeArranque } from '@/focus/arranqueFlujo';
import type { TipoBloque } from '@/focus/planEstudio';
import type { BloquePlan } from '@/focus/resumen';
import type { Fase, Situacion } from '@/focus/pomodoro';
import type { EstadoTema, PerfilFocus } from '@/focus/tipos';
import { t } from '@/i18n';
import type { NivelModo } from '@/modos/niveles';
import { NOMBRE_MODO } from '@/modos/tipos';
import { ArranqueGuiado } from './ArranqueGuiado';
import { F } from './estilo';
import { AnilloReloj, BarraFocus, BotonFocus, Casilla, ChipFocus, Etiqueta, FilaFocus, Rotulo, TarjetaFocus, VacioFocus, textoFocus } from './Piezas';
import { PantallaConcentracion } from './PantallaConcentracion';
import { TarjetaHueco } from './TarjetaHueco';
import { etiquetaDias } from './vistaHoy';

export { etiquetaDias };

export interface SesionVista {
  fase: Fase;
  bloque: number;
  cadaLargo: number;
  situacion: Situacion;
  reloj: string;
  ratio: number;
  /** La asignatura del bloque en marcha (null: bloque libre). */
  asignatura: string | null;
  /** «Tema 4 · Árboles binarios», o null. */
  tema: string | null;
  /** La misión elegida para el bloque. */
  mision: { titulo: string; xp: number } | null;
  /** Hay misiones de FOCUS que se podrían elegir. */
  hayMisiones: boolean;
  foco: number;
  descanso: number;
  /** Veces que se ha salido de la app en este bloque. Informativo. */
  salidas: number;
}

/** Lo que va a estudiar el siguiente bloque y por qué. */
export interface TocaVista {
  tipo: TipoBloque | 'libre';
  titulo: string;
  detalle: string | null;
  motivo: string | null;
  minutos: number;
  asignaturaId: string | null;
  temaId: string | null;
  /** Lo ha elegido a mano, no el plan. */
  elegido: boolean;
}

export interface FilaPlan {
  bloque: BloquePlan;
  /** «16:00», «Hoy» o null si no cabe hoy. */
  hora: string | null;
  titulo: string;
  motivo: string;
  minutos: number;
}

export interface PlanVista {
  bloques: FilaPlan[];
  fuera: FilaPlan[];
  aviso: boolean;
  /** Por qué no hay bloques; null si los hay. */
  sinPlan: string | null;
  /** La asignatura a la que le faltan temas. */
  faltanTemasDe: string | null;
}

export interface EntregaFila {
  id: string;
  titulo: string;
  asignatura: string;
  etiqueta: string;
  urgente: boolean;
}

export interface ExamenFila {
  id: string;
  asignatura: string;
  titulo: string;
  etiqueta: string;
  progreso: number;
  conFecha: boolean;
}

export interface ClaseVista {
  enCurso: boolean;
  asignatura: string;
  cuando: string;
  aula: string | null;
}

export interface HuecoVista {
  dias: number;
  pasaron: string[];
  repasos: number;
  tarjetas: number;
  /** Los repasos por los que retomar, ya priorizados y con tope. */
  temaIds: string[];
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
  /** El nivel del modo para el escudo del héroe; null mientras se lee. */
  nivel: NivelModo | null;
  estado: 'cargando' | 'listo' | 'error';
  error: string | null;
  /** false: la 0076 aún no está en el servidor (estado vacío tranquilo). */
  disponible: boolean;
  refrescando?: boolean;
  /** Sin datos: el arranque guiado en vez del reloj. */
  arranque: boolean;
  hoy?: string;
  sesion: SesionVista;
  toca: TocaVista;
  asignaturas: { id: string; nombre: string }[];
  entregas: EntregaFila[];
  mostrarEntregas: boolean;
  plan: PlanVista;
  clase: ClaseVista | null;
  faltaHorario: boolean;
  repasos: { temas: number; tarjetas: number; total: number };
  /** Las horas de la semana, las tarjetas de hoy y la media. */
  cifras: readonly CifraMundo[];
  hueco: HuecoVista | null;
  examenes: ExamenFila[];
  /** Asignatura en foco y unos pocos temas alrededor de por dónde va. */
  temario: { asignatura: string; temas: TemaFila[]; total: number } | null;
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
    onElegirAsignatura: (id: string) => void;
    onEntregaHecha: (id: string) => void;
    onRepasar: () => void;
    onRetomarHueco: () => void;
    onCerrarHueco: () => void;
    onAnadirTemas: (asignaturaId: string) => void;
    onCompletarMision: (id: string) => void;
    onCoach: () => void;
    onAnadirAsignatura: () => void;
    onAnadirExamen: () => void;
    onArranqueAsignaturas: (nombres: string[]) => Promise<boolean>;
    onArranqueFin: (perfil: PerfilFocus, examen: ExamenDeArranque | null, titulo: string) => Promise<void>;
    onReintentar: () => void;
    onRefrescar?: () => void;
  };
}

const EXAMENES_EN_INICIO = 2;
const BLOQUES_EN_INICIO = 3;
const ENTREGAS_EN_INICIO = 3;

function textoEmpezar(tipoToca: TocaVista['tipo']): string {
  if (tipoToca === 'repasar') return t('focus:hoyToca.empezarRepaso');
  if (tipoToca === 'simulacro') return t('focus:hoyToca.empezarSimulacro');
  return t('focus:hoy.empezar');
}

function Descanso({ s, acciones }: { s: SesionVista; acciones: FocusHoyVistaProps['acciones'] }) {
  const rotulo = s.fase === 'largo' ? t('focus:hoy.descansoLargo') : t('focus:hoy.descanso');
  const parado = s.situacion === 'parado';
  const principal = s.situacion === 'en_marcha'
    ? { titulo: t('focus:hoy.saltarDescanso'), onPress: acciones.onSaltar }
    : { titulo: parado ? t('focus:hoy.empezarDescanso') : t('focus:hoy.seguir'), onPress: acciones.onEmpezar };
  return (
    <TarjetaFocus heroe>
      <Rotulo texto={rotulo} />
      <View style={styles.sesion}>
        <View accessible accessibilityRole="timer" accessibilityLabel={t('focus:hoy.sesionA11y', { reloj: s.reloj, titulo: t('focus:hoy.descansoTitulo'), fase: rotulo })}>
          <AnilloReloj ratio={s.ratio} reloj={s.reloj} pie={t('focus:hoy.relojDescanso')} apagado />
        </View>
        <View style={styles.sesionTextos}>
          <Text style={textoFocus.titulo} maxFontSizeMultiplier={1.35}>
            {t('focus:hoy.descansoTitulo')}
          </Text>
          <Text style={styles.sesionMeta} maxFontSizeMultiplier={1.35} numberOfLines={2}>
            {t('focus:hoy.descansoCuerpo')}
          </Text>
        </View>
      </View>
      <BotonFocus titulo={principal.titulo} onPress={principal.onPress} style={styles.botonGrande} />
      <View style={styles.secundarios}>
        {!parado ? <BotonFocus titulo={t('focus:hoy.parar')} variante="texto" pequeno onPress={acciones.onParar} /> : <BotonFocus titulo={t('focus:hoy.saltar')} variante="texto" pequeno onPress={acciones.onSaltar} />}
      </View>
    </TarjetaFocus>
  );
}

/** El próximo examen; sin exámenes, el nivel del modo. Nada que no venga de los datos. */
function Heroe({ examen, nivel }: { examen: ExamenFila | undefined; nivel: NivelModo | null }) {
  const pieNivel = nivel
    ? nivel.xpSiguiente <= 0
      ? t('mundos:cabecera.xpMax')
      : t('mundos:cabecera.xp', { xp: formatoMiles(nivel.xpEnNivel), total: formatoMiles(nivel.xpSiguiente) })
    : '';
  const datos = examen
    ? { rotulo: t('focus:hoyHeroe.rotulo'), titulo: examen.asignatura, ratio: examen.progreso / 100, pie: t('focus:hoyHeroe.pie', { cuando: examen.etiqueta, pct: examen.progreso }), etiquetaBarra: t('focus:hoyHeroe.barra') }
    : { rotulo: nivel ? t('mundos:cabecera.nivel', { nivel: nivel.nivel }) : '', titulo: t('focus:hoyHeroe.sinExamen'), ratio: !nivel || nivel.xpSiguiente <= 0 ? 1 : ratioSeguro(nivel.xpEnNivel, nivel.xpSiguiente), pie: pieNivel, etiquetaBarra: t('focus:hoyHeroe.barraNivel') };
  // El escudo es decorado: el nivel se lee aquí, junto al resto de la tarjeta.
  const a11yNivel = nivel ? t('mundos:cabecera.nivelA11y', { modo: NOMBRE_MODO.focus, nivel: nivel.nivel, xp: formatoMiles(nivel.xp) }) : null;
  return (
    <View accessible accessibilityLabel={[a11yNivel, datos.rotulo, datos.titulo, datos.pie].filter(Boolean).join('. ')}>
      <HeroMundo {...datos} escudo={nivel?.nivel} />
    </View>
  );
}

function HoyToca({ toca, s, hora, asignaturas, acciones }: { toca: TocaVista; s: SesionVista; /** La hora del plan para este bloque, si la tiene. */ hora?: string | null; asignaturas: FocusHoyVistaProps['asignaturas']; acciones: FocusHoyVistaProps['acciones'] }) {
  const minutos = t('focus:hoyToca.minutos', { n: toca.minutos });
  return (
    <TarjetaFocus>
      <Rotulo
        texto={t('focus:hoyToca.rotulo')}
        derecha={hora ? `${hora} · ${minutos}` /* i18n-ok: unión de dos datos */ : minutos}
        icono={{ nombre: 'options-outline', a11y: t('focus:hoy.ajustesA11y', { foco: s.foco, descanso: s.descanso }), onPress: acciones.onAjustes }}
      />
      <Text style={[tituloAhora, styles.arribaPoco]} maxFontSizeMultiplier={1.35} numberOfLines={3}>
        {toca.titulo}
      </Text>
      {toca.detalle ? (
        <Text style={styles.sesionMeta} maxFontSizeMultiplier={1.35} numberOfLines={1}>
          {toca.detalle}
        </Text>
      ) : null}
      {toca.motivo ? (
        <Text style={[textoFocus.cuerpo, styles.arribaPoco]} maxFontSizeMultiplier={1.5}>
          {toca.motivo}
        </Text>
      ) : null}
      {asignaturas.length > 1 ? (
        <View style={styles.chips}>
          {asignaturas.map((a) => (
            <ChipFocus key={a.id} titulo={a.nombre} activo={toca.elegido && toca.asignaturaId === a.id} onPress={() => acciones.onElegirAsignatura(a.id)} />
          ))}
        </View>
      ) : null}
      <BotonFocus titulo={textoEmpezar(toca.tipo)} onPress={acciones.onEmpezar} style={styles.botonGrande} />
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
      {s.mision || s.hayMisiones ? (
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
    </TarjetaFocus>
  );
}

function Entregas({ entregas, acciones }: { entregas: EntregaFila[]; acciones: FocusHoyVistaProps['acciones'] }) {
  const lista = entregas.slice(0, ENTREGAS_EN_INICIO);
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:hoyEntregas.rotulo')} derecha={entregas.length > 0 ? t('focus:hoy.verTodo') : t('focus:hoy.anadir')} onDerecha={acciones.onExamenes} />
      {lista.length === 0 ? (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:hoyEntregas.vacio')}
        </Text>
      ) : (
        <View style={styles.arriba}>
          {lista.map((e) => (
            <FilaFocus key={e.id} primera={false} onPress={() => acciones.onEntregaHecha(e.id)} accessibilityLabel={t('focus:hoyEntregas.a11y', { titulo: e.titulo, asignatura: e.asignatura, cuando: e.etiqueta })} accessibilityHint={t('focus:hoyEntregas.hint')}>
              <View style={styles.temaIzq}>
                <Casilla estado="vacia" />
                <View style={styles.flex}>
                  <Text style={textoFocus.fila} maxFontSizeMultiplier={1.35} numberOfLines={1}>
                    {e.titulo}
                  </Text>
                  <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35} numberOfLines={1}>
                    {e.asignatura}
                  </Text>
                </View>
              </View>
              <Etiqueta texto={e.etiqueta} apagada={!e.urgente} />
            </FilaFocus>
          ))}
          {entregas.length > lista.length ? (
            <Text style={[textoFocus.detalle, styles.arribaPoco]} maxFontSizeMultiplier={1.35}>
              {t('focus:hoy.masBloques', { count: entregas.length - lista.length })}
            </Text>
          ) : null}
        </View>
      )}
    </TarjetaFocus>
  );
}

function FilaDelPlan({ f, acciones }: { f: FilaPlan; acciones: FocusHoyVistaProps['acciones'] }) {
  return (
    <FilaFocus primera={false} onPress={() => acciones.onBloque(f.bloque)} accessibilityLabel={t('focus:hoy.bloqueA11y', { hora: f.hora ?? '', titulo: f.titulo, tema: f.motivo })}>
      {f.hora ? (
        <Text style={[textoFocus.detalle, styles.hora]} maxFontSizeMultiplier={1.35}>
          {f.hora}
        </Text>
      ) : null}
      <View style={styles.flex}>
        <Text style={textoFocus.fila} maxFontSizeMultiplier={1.35} numberOfLines={1}>
          {f.titulo}
        </Text>
        <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35} numberOfLines={1}>
          {f.motivo}
        </Text>
      </View>
      <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35}>
        {t('focus:hoyToca.minutos', { n: f.minutos })}
      </Text>
    </FilaFocus>
  );
}

function Plan({ plan, acciones }: { plan: PlanVista; acciones: FocusHoyVistaProps['acciones'] }) {
  const [todo, setTodo] = useState(false);
  const hayMas = plan.bloques.length > BLOQUES_EN_INICIO || plan.fuera.length > 0;
  const lista = todo ? plan.bloques : plan.bloques.slice(0, BLOQUES_EN_INICIO);
  const faltanTemasDe = plan.faltanTemasDe;
  return (
    <View>
      <Rotulo texto={t('focus:hoy.planRotulo')} derecha={hayMas ? (todo ? t('focus:hoyToca.verMenos') : t('focus:hoyToca.verTodoN', { n: plan.bloques.length + plan.fuera.length })) : null} onDerecha={() => setTodo((v) => !v)} />
      {plan.aviso ? (
        <Text style={[textoFocus.acento, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:hoyToca.noLlegas', { count: plan.fuera.length })}
        </Text>
      ) : null}
      {lista.length === 0 ? (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {plan.sinPlan}
        </Text>
      ) : (
        <View style={styles.arriba}>
          {lista.map((f, i) => (
            <FilaDelPlan key={`${f.bloque.examenId}-${f.bloque.temaId ?? 's'}-${f.bloque.tipo}-${i}`} f={f} acciones={acciones} />
          ))}
        </View>
      )}
      {todo && plan.fuera.length > 0 ? (
        <View style={styles.arriba}>
          <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35}>
            {t('focus:hoyToca.fuera')}
          </Text>
          {plan.fuera.map((f, i) => (
            <FilaDelPlan key={`f-${f.bloque.examenId}-${f.bloque.temaId ?? 's'}-${f.bloque.tipo}-${i}`} f={f} acciones={acciones} />
          ))}
        </View>
      ) : null}
      {faltanTemasDe ? <BotonFocus titulo={t('focus:hoyToca.anadirTemas')} variante="contorno" pequeno onPress={() => acciones.onAnadirTemas(faltanTemasDe)} style={styles.arriba} /> : null}
    </View>
  );
}

function Clase({ clase }: { clase: ClaseVista }) {
  return (
    <TarjetaFocus>
      <Rotulo texto={clase.enCurso ? t('focus:hoyClase.enCurso') : t('focus:hoyClase.rotulo')} />
      <Text style={[textoFocus.filaFuerte, styles.arribaPoco]} maxFontSizeMultiplier={1.35} numberOfLines={1}>
        {clase.asignatura}
      </Text>
      <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35} numberOfLines={1}>
        {clase.aula ? `${clase.cuando} · ${clase.aula}` /* i18n-ok: unión de dos datos */ : clase.cuando}
      </Text>
    </TarjetaFocus>
  );
}

function Repasos({ repasos, onRepasar }: { repasos: FocusHoyVistaProps['repasos']; onRepasar: () => void }) {
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:hoyToca.repasosRotulo')} derecha={t('focus:hoyToca.repasar')} onDerecha={onRepasar} />
      <Text style={[textoFocus.cuerpo, styles.arribaPoco]} maxFontSizeMultiplier={1.5}>
        {t('focus:hoyToca.repasosCuerpo', { count: repasos.total })}
      </Text>
    </TarjetaFocus>
  );
}

function Examenes({ examenes, acciones }: { examenes: ExamenFila[]; acciones: FocusHoyVistaProps['acciones'] }) {
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
            key={e.id}
            onPress={() => acciones.onExamen(e.id)}
            accessibilityRole="button"
            accessibilityLabel={t('focus:hoy.examenA11y', { asignatura: e.asignatura, dias: e.etiqueta, progreso: e.progreso })}
            style={({ pressed }) => [styles.examen, styles.separado, i === 0 && styles.primeraFila, pressed && styles.pulsado]}
          >
            <View style={styles.examenFila}>
              <Text style={[textoFocus.filaFuerte, styles.flex]} maxFontSizeMultiplier={1.35} numberOfLines={1}>
                {e.asignatura}
              </Text>
              <Etiqueta texto={e.etiqueta} apagada={!e.conFecha} />
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

function Huecos() {
  return (
    <View style={styles.huecos} accessibilityRole="progressbar" accessibilityLabel={t('focus:comun.cargandoA11y')}>
      <Skeleton height={132} />
      <Skeleton height={120} />
    </View>
  );
}

function Contenido({ p, indice }: { p: FocusHoyVistaProps; indice: number }) {
  const { acciones } = p;
  let i = indice;
  const estaEnDescanso = p.sesion.fase !== 'foco';
  const tocaRepaso = p.toca.tipo === 'repasar';
  const horaToca = p.plan.bloques.find((f) => f.bloque.hora !== null && f.bloque.asignaturaId === p.toca.asignaturaId && f.bloque.temaId === p.toca.temaId)?.hora ?? null;
  return (
    <>
      {p.examenes.length > 0 || p.nivel ? (
        <Entrada indice={i++} style={styles.bloque}>
          <Heroe examen={p.examenes[0]} nivel={p.nivel} />
        </Entrada>
      ) : null}
      {p.hueco ? (
        <Entrada indice={i++} style={styles.bloque}>
          <TarjetaHueco hueco={p.hueco} onRetomar={acciones.onRetomarHueco} onCerrar={acciones.onCerrarHueco} />
        </Entrada>
      ) : null}
      <Entrada indice={i++} style={styles.bloque}>
        <TarjetaCoach cuerpo={p.coach} onAbrir={acciones.onCoach} />
      </Entrada>
      <Entrada indice={i++} style={styles.bloque}>
        {estaEnDescanso ? <Descanso s={p.sesion} acciones={acciones} /> : <HoyToca toca={p.toca} s={p.sesion} hora={horaToca} asignaturas={p.asignaturas} acciones={acciones} />}
      </Entrada>
      <Entrada indice={i++} style={styles.bloque}>
        <TresCifras cifras={p.cifras} />
      </Entrada>
      <Entrada indice={i++} style={styles.lista}>
        <Plan plan={p.plan} acciones={acciones} />
      </Entrada>
      {p.mostrarEntregas ? (
        <Entrada indice={i++} style={styles.bloque}>
          <Entregas entregas={p.entregas} acciones={acciones} />
        </Entrada>
      ) : null}
      {p.clase ? (
        <Entrada indice={i++} style={styles.bloque}>
          <Clase clase={p.clase} />
        </Entrada>
      ) : p.faltaHorario ? (
        <Entrada indice={i++} style={styles.bloque}>
          <TarjetaFocus>
            <Rotulo texto={t('focus:hoyClase.rotulo')} derecha={t('focus:hoy.anadir')} onDerecha={acciones.onTemario} />
            <Text style={[textoFocus.cuerpo, styles.arribaPoco]} maxFontSizeMultiplier={1.5}>
              {t('focus:hoyClase.sinHorario')}
            </Text>
          </TarjetaFocus>
        </Entrada>
      ) : null}
      {p.repasos.total > 0 && !tocaRepaso ? (
        <Entrada indice={i++} style={styles.bloque}>
          <Repasos repasos={p.repasos} onRepasar={acciones.onRepasar} />
        </Entrada>
      ) : null}
      <Entrada indice={i++} style={styles.bloque}>
        <Examenes examenes={p.examenes} acciones={acciones} />
      </Entrada>
      {p.temario ? (
        <View style={styles.bloque}>
          <Temario temario={p.temario} acciones={acciones} />
        </View>
      ) : null}
      {p.misiones && p.misiones.length > 0 ? (
        <View style={styles.bloque}>
          <Misiones misiones={p.misiones} acciones={acciones} />
        </View>
      ) : null}
    </>
  );
}

export function FocusHoyVista(p: FocusHoyVistaProps) {
  const { acciones, sesion: s } = p;
  const concentrado = s.fase === 'foco' && s.situacion !== 'parado';
  return (
    <Screen
      refreshing={p.refrescando}
      onRefresh={acciones.onRefrescar}
      contentStyle={styles.contenido}
      overlay={
        <PantallaConcentracion
          visible={concentrado}
          situacion={s.situacion}
          reloj={s.reloj}
          ratio={s.ratio}
          asignatura={s.asignatura}
          tema={s.tema}
          salidas={s.salidas}
          bloque={s.bloque}
          cadaLargo={s.cadaLargo}
          onPausar={acciones.onPausar}
          onSeguir={acciones.onEmpezar}
          onTerminar={acciones.onParar}
        />
      }
    >
      <Entrada indice={0}>{p.cabecera}</Entrada>

      {p.estado === 'cargando' ? (
        <Huecos />
      ) : p.estado === 'error' ? (
        <View style={styles.bloque}>
          <ErrorSistema mensaje={p.error ?? ''} onReintentar={acciones.onReintentar} compacto />
        </View>
      ) : !p.disponible ? (
        <>
          <Entrada indice={1} style={styles.bloque}>
            <HoyToca toca={p.toca} s={s} asignaturas={[]} acciones={acciones} />
          </Entrada>
          <Entrada indice={2} style={styles.bloque}>
            <TarjetaFocus>
              <VacioFocus rotulo={t('focus:hoy.asignaturasRotulo')} icono="hourglass-outline" titulo={t('focus:comun.noDisponibleTitulo')} cuerpo={t('focus:comun.noDisponibleCuerpo')} />
            </TarjetaFocus>
          </Entrada>
        </>
      ) : p.arranque ? (
        <Entrada indice={1} style={styles.bloque}>
          <ArranqueGuiado hoy={p.hoy ?? ''} asignaturas={p.asignaturas} onAsignaturas={acciones.onArranqueAsignaturas} onTerminar={acciones.onArranqueFin} />
        </Entrada>
      ) : p.sinAsignaturas ? (
        <Entrada indice={1} style={styles.bloque}>
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
        <Contenido p={p} indice={1} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  contenido: { paddingBottom: space.s8 },
  bloque: { marginBottom: space.s2 },
  lista: { marginTop: space.s2, marginBottom: space.s4 },
  flex: { flex: 1, minWidth: 0 },
  arriba: { marginTop: space.s2 },
  arribaPoco: { marginTop: space.s1 },
  separado: { borderTopWidth: 1, borderTopColor: F.separador },
  primeraFila: { marginTop: space.s2 },
  pulsado: { opacity: 0.7 },
  sesion: { flexDirection: 'row', alignItems: 'center', gap: space.s4, marginTop: space.s2 },
  sesionTextos: { flex: 1, minWidth: 0, gap: 1 },
  sesionMeta: { fontFamily: tipo.bodySm.family, fontSize: 13, lineHeight: 17, color: F.meta },
  silencio: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.s2, alignSelf: 'center', minHeight: 22 },
  silencioTexto: { fontFamily: tipo.micro.family, fontSize: 13, lineHeight: 17, color: F.meta },
  mision: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 20, marginTop: space.s1 },
  misionXp: { fontFamily: tipo.micro.family, color: F.acento },
  misionTexto: { fontFamily: tipo.bodySm.family, fontSize: 12, lineHeight: 17, color: F.rotulo },
  botonGrande: { marginTop: space.s3 - 2 },
  secundarios: { flexDirection: 'row', justifyContent: 'center', gap: space.s4, marginTop: space.s1 },
  examen: { paddingVertical: 6, gap: 5 },
  examenFila: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  temaIzq: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  hora: { width: 44 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s3 },
  tachado: { textDecorationLine: 'line-through', color: F.rotulo },
  xp: { color: F.acento },
  huecos: { gap: space.s3, marginBottom: space.s3 },
});
