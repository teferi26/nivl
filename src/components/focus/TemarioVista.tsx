// NIVL · Mundo FOCUS: Temario (pestaña 2 de la lámina: «Hoy · Temario ·
// Exámenes · Coach»). Pura. Todo lo que se estudia y cómo:
//   · Asignaturas (chips) y el temario de la elegida: por secciones plegables,
//     con filtro por estado y vueltas.
//   · Repasos de hoy (repetición espaciada 1, 3, 7, 14, 30) y flashcards.
//   · Horas de estudio de la semana por asignatura (el detalle, en su hoja).
//   · Horario de clases.
//   · Métodos de estudio explicados.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Entrada, ErrorSistema } from '@/components/arena';
import { Screen, Skeleton } from '@/components/ui';
import { space, type as tipo } from '@/design/tokens';
import { formatoHoras } from '@/focus/horario';
import { METODOS, type Metodo } from '@/focus/metodos';
import type { HorasAsignatura } from '@/focus/resumen';
import { agruparPorSeccion, conteoPorEstado, FILTROS_TEMA, filtrarTemas, numeroDeTema, puedeEmpezarVuelta, seccionQueToca, type FiltroTema } from '@/focus/temarioLista';
import type { Asignatura, Clase, Mazo, Tema } from '@/focus/tipos';
import { t } from '@/i18n';
import { F } from './estilo';
import { casillaDe, horaClase, nombreDia } from './HojasFocus';
import { BarraFocus, BotonFocus, Casilla, ChipFocus, FilaFocus, Rotulo, TarjetaFocus, TituloFocus, VacioFocus, textoFocus } from './Piezas';

export interface TemarioVistaProps {
  estado: 'cargando' | 'listo' | 'error';
  error: string | null;
  disponible: boolean;
  asignaturas: Asignatura[];
  elegida: string | null;
  temas: Tema[];
  progreso: number;
  repasos: { temas: Tema[]; tarjetas: number };
  mazos: { mazo: Mazo; total: number; hoy: number }[];
  horas: { porAsignatura: HorasAsignatura[]; total: number };
  diaHorario: number;
  clases: (Clase & { asignatura: string })[];
  acciones: {
    onElegir: (id: string) => void;
    onArchivar: (a: Asignatura) => void;
    onAnadirAsignatura: () => void;
    onAnadirTemas: () => void;
    onAlternarTema: (t: Tema) => void;
    onEditarTema: (t: Tema) => void;
    onVuelta: (a: Asignatura) => void;
    onRepasar: () => void;
    onNuevoMazo: () => void;
    onNuevaTarjeta: (mazoId: string | null) => void;
    onPegarTarjetas: (mazoId: string | null) => void;
    onTarjetasIa: (mazoId: string | null) => void;
    onHoras: () => void;
    onDia: (d: number) => void;
    onAnadirClase: () => void;
    onEditarClase: (c: Clase) => void;
    onCopiarDia: () => void;
    onMetodo: (m: Metodo) => void;
    onReintentar: () => void;
  };
}

export function textoHoras(min: number): string {
  const { h, m } = formatoHoras(min);
  if (h === 0) return t('focus:horas.min', { m });
  if (m === 0) return t('focus:horas.h', { h });
  return t('focus:horas.hMin', { h, m: String(m).padStart(2, '0') });
}

function Asignaturas({ p }: { p: TemarioVistaProps }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsScroll}>
      {p.asignaturas.map((a) => (
        <ChipFocus key={a.id} titulo={a.nombre} activo={a.id === p.elegida} onPress={() => p.acciones.onElegir(a.id)} />
      ))}
      <ChipFocus titulo={t('focus:temario.nuevaAsignatura')} anadir onPress={p.acciones.onAnadirAsignatura} accessibilityLabel={t('focus:hoy.anadirAsignatura')} />
    </ScrollView>
  );
}

/** Sin secciones, cuántos temas se ven antes de «Ver todos». */
const TEMAS_A_LA_VISTA = 15;
/** Por debajo de esto el filtro estorba más que ayuda. */
const MIN_PARA_FILTRAR = 6;

function FilaTemaLista({ tema, numero, primera, onAlternar, onEditar }: { tema: Tema; numero: number | null; primera: boolean; onAlternar: () => void; onEditar: () => void }) {
  const estado = t(`focus:estado.${tema.estado}`);
  return (
    <FilaFocus
      primera={primera}
      onPress={onAlternar}
      onLongPress={onEditar}
      accessibilityLabel={t('focus:hoy.temaA11y', { nombre: tema.nombre, estado })}
      accessibilityHint={t('focus:hoy.temaHint')}
      accessibilityActions={[{ name: 'longpress', label: t('focus:fondo.temas.editar') }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onEditar()}
    >
      <View style={styles.izq}>
        <Casilla estado={casillaDe(tema.estado)} />
        <Text style={[textoFocus.fila, styles.flex]} maxFontSizeMultiplier={1.35} numberOfLines={2}>
          {numero === null ? tema.nombre : t('focus:fondo.temas.numerado', { n: numero, nombre: tema.nombre })}
        </Text>
      </View>
      <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35}>
        {estado}
      </Text>
      <Pressable onPress={onEditar} hitSlop={14} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.lapiz}>
        <Ionicons name="create-outline" size={16} color={F.rotulo} />
      </Pressable>
    </FilaFocus>
  );
}

function Temario({ p }: { p: TemarioVistaProps }) {
  const [filtro, setFiltro] = useState<FiltroTema>('todos');
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const [verTodos, setVerTodos] = useState(false);
  const a = p.asignaturas.find((x) => x.id === p.elegida);
  if (!a) return null;
  const dominados = p.temas.filter((x) => x.estado === 'dominado').length;
  const conteo = conteoPorEstado(p.temas);
  const numeros = new Map(p.temas.map((x, i) => [x.id, numeroDeTema(x.nombre, i + 1)]));
  const grupos = agruparPorSeccion(filtrarTemas(p.temas, filtro));
  const conSecciones = grupos.some((g) => g.seccion !== null);
  const laQueToca = seccionQueToca(grupos);
  const abierta = (k: string | null) => abiertas[k ?? ''] ?? (filtro !== 'todos' || k === laQueToca);
  const fila = (x: Tema, primera: boolean) => (
    <FilaTemaLista key={x.id} tema={x} numero={numeros.get(x.id) ?? null} primera={primera} onAlternar={() => p.acciones.onAlternarTema(x)} onEditar={() => p.acciones.onEditarTema(x)} />
  );
  const sinSeccion = grupos[0]?.temas ?? [];
  const recortar = !conSecciones && !verTodos && sinSeccion.length > TEMAS_A_LA_VISTA;
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:hoy.temarioRotulo', { asignatura: a.nombre })} derecha={t('focus:temario.dominados', { n: dominados, total: p.temas.length })} />
      {p.temas.length > 0 ? (
        <View style={styles.progreso}>
          <BarraFocus ratio={p.progreso / 100} style={styles.flex} />
          <Text style={textoFocus.detalle}>{a.vuelta > 1 ? t('focus:fondo.temas.pctVuelta', { pct: p.progreso, n: a.vuelta }) : t('focus:hoy.temarioPct', { pct: p.progreso })}</Text>
        </View>
      ) : (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:temario.vacio')}
        </Text>
      )}
      {p.temas.length >= MIN_PARA_FILTRAR ? (
        <View style={styles.filtros}>
          {FILTROS_TEMA.map((f) => (
            <ChipFocus key={f} titulo={t(`focus:fondo.temas.filtro.${f}`, { n: conteo[f] })} activo={f === filtro} onPress={() => setFiltro(f)} />
          ))}
        </View>
      ) : null}
      <View style={styles.arriba}>
        {grupos.length === 0 && p.temas.length > 0 ? (
          <Text style={textoFocus.cuerpo} maxFontSizeMultiplier={1.5}>
            {t('focus:fondo.temas.nadaConFiltro')}
          </Text>
        ) : conSecciones ? (
          grupos.map((g, i) => {
            const k = g.seccion;
            const open = abierta(k);
            return (
              <View key={k ?? ''}>
                <FilaFocus
                  primera={i === 0}
                  onPress={() => setAbiertas((m) => ({ ...m, [k ?? '']: !open }))}
                  accessibilityLabel={t('focus:fondo.temas.seccionA11y', { nombre: k ?? t('focus:fondo.temas.sinSeccion'), vistos: g.vistos, total: g.temas.length })}
                >
                  <View style={styles.izq}>
                    <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={16} color={F.rotulo} />
                    <Text style={[textoFocus.filaFuerte, styles.flex]} maxFontSizeMultiplier={1.35} numberOfLines={2}>
                      {k ?? t('focus:fondo.temas.sinSeccion')}
                    </Text>
                  </View>
                  <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35}>
                    {t('focus:hoy.deTotal', { n: g.vistos, total: g.temas.length })}
                  </Text>
                </FilaFocus>
                {open ? g.temas.map((x) => fila(x, false)) : null}
              </View>
            );
          })
        ) : (
          (recortar ? sinSeccion.slice(0, TEMAS_A_LA_VISTA) : sinSeccion).map((x, i) => fila(x, i === 0))
        )}
      </View>
      {recortar ? <BotonFocus titulo={t('focus:fondo.temas.verTodos', { count: sinSeccion.length })} variante="texto" pequeno onPress={() => setVerTodos(true)} style={styles.arribaPoco} /> : null}
      {puedeEmpezarVuelta(p.temas) ? <BotonFocus titulo={t('focus:fondo.temas.vueltaBoton', { n: a.vuelta + 1 })} variante="contorno" onPress={() => p.acciones.onVuelta(a)} style={styles.arriba} /> : null}
      <View style={styles.botones}>
        <BotonFocus titulo={t('focus:temario.anadirTemas')} icono="add" variante="contorno" pequeno onPress={p.acciones.onAnadirTemas} style={styles.flex} />
        <BotonFocus titulo={t('focus:temario.archivar')} variante="texto" pequeno onPress={() => p.acciones.onArchivar(a)} />
      </View>
    </TarjetaFocus>
  );
}

function Repasos({ p }: { p: TemarioVistaProps }) {
  const total = p.repasos.temas.length + p.repasos.tarjetas;
  return (
    <TarjetaFocus heroe={total > 0}>
      <Rotulo texto={t('focus:temario.repasosRotulo')} derecha={total > 0 ? t('focus:temario.paraHoy', { count: total }) : null} />
      <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
        {total > 0
          ? t('focus:temario.repasosCuerpo', { temas: p.repasos.temas.length, tarjetas: p.repasos.tarjetas })
          : t('focus:temario.repasosVacio')}
      </Text>
      {p.repasos.temas.slice(0, 3).map((x, i) => (
        <FilaFocus key={x.id} primera={i === 0} style={i === 0 ? styles.arribaPoco : undefined}>
          <Text style={[textoFocus.fila, styles.flex]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
            {x.nombre}
          </Text>
          <Text style={textoFocus.detalle}>{t('focus:temario.etapa', { n: x.etapa + 1 })}</Text>
        </FilaFocus>
      ))}
      {total > 0 ? <BotonFocus titulo={t('focus:temario.repasarAhora')} onPress={p.acciones.onRepasar} style={styles.arriba} /> : null}
    </TarjetaFocus>
  );
}

function Flashcards({ p }: { p: TemarioVistaProps }) {
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:temario.flashcardsRotulo')} derecha={t('focus:temario.nuevoMazo')} onDerecha={p.acciones.onNuevoMazo} />
      {p.mazos.length === 0 ? (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:temario.flashcardsVacio')}
        </Text>
      ) : (
        <View style={styles.arribaPoco}>
          {p.mazos.map((m, i) => (
            <FilaFocus
              key={m.mazo.id}
              primera={i === 0}
              onPress={() => p.acciones.onNuevaTarjeta(m.mazo.id)}
              accessibilityLabel={t('focus:temario.mazoA11y', { nombre: m.mazo.nombre, total: m.total, hoy: m.hoy })}
              accessibilityHint={t('focus:temario.mazoHint')}
            >
              <View style={styles.izq}>
                <Ionicons name="albums-outline" size={18} color={F.acento} />
                <Text style={[textoFocus.fila, styles.flex]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                  {m.mazo.nombre}
                </Text>
              </View>
              <Text style={[textoFocus.detalle, m.hoy > 0 && styles.acento]} maxFontSizeMultiplier={1.35}>
                {m.hoy > 0 ? t('focus:temario.tarjetasHoy', { count: m.hoy }) : t('focus:temario.tarjetas', { count: m.total })}
              </Text>
            </FilaFocus>
          ))}
        </View>
      )}
      {p.mazos.length > 0 ? (
        <>
          <View style={styles.botones}>
            <BotonFocus titulo={t('focus:temario.anadirTarjeta')} icono="add" variante="contorno" pequeno onPress={() => p.acciones.onNuevaTarjeta(null)} style={styles.flex} />
            <BotonFocus titulo={t('focus:fondo.tarjetas.pegarBoton')} variante="contorno" pequeno onPress={() => p.acciones.onPegarTarjetas(null)} style={styles.flex} />
          </View>
          <BotonFocus titulo={t('focus:fondo.tarjetas.iaBoton')} variante="texto" pequeno onPress={() => p.acciones.onTarjetasIa(null)} style={styles.arribaPoco} />
        </>
      ) : null}
    </TarjetaFocus>
  );
}

function Horas({ p }: { p: TemarioVistaProps }) {
  const max = Math.max(1, ...p.horas.porAsignatura.map((x) => x.minutos));
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:temario.horasRotulo')} derecha={t('focus:temario.estaSemana')} />
      <Text style={[textoFocus.cifra, styles.arriba, styles.minus]} maxFontSizeMultiplier={1}>
        {textoHoras(p.horas.total)}
      </Text>
      {p.horas.porAsignatura.length === 0 ? (
        <Text style={textoFocus.cuerpo} maxFontSizeMultiplier={1.5}>
          {t('focus:temario.horasVacio')}
        </Text>
      ) : (
        p.horas.porAsignatura.map((x, i) => (
          <View key={x.asignaturaId ?? 'libre'} style={[styles.hora, i === 0 && styles.arribaPoco]} accessible accessibilityLabel={t('focus:temario.horasA11y', { nombre: x.nombre ?? t('focus:hoy.bloqueLibre'), horas: textoHoras(x.minutos) })}>
            <View style={styles.horaFila}>
              <Text style={[textoFocus.fila, styles.flex]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                {x.nombre ?? t('focus:hoy.bloqueLibre')}
              </Text>
              <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35}>
                {textoHoras(x.minutos)}
              </Text>
            </View>
            <BarraFocus ratio={x.minutos / max} />
          </View>
        ))
      )}
      <BotonFocus titulo={t('focus:fondo.horas.verDetalle')} variante="texto" pequeno onPress={p.acciones.onHoras} style={styles.arribaPoco} />
    </TarjetaFocus>
  );
}

function Horario({ p }: { p: TemarioVistaProps }) {
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:temario.horarioRotulo')} derecha={t('focus:temario.anadirClase')} onDerecha={p.acciones.onAnadirClase} />
      <View style={styles.dias}>
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <ChipFocus key={d} titulo={nombreDia(d, true)} activo={d === p.diaHorario} onPress={() => p.acciones.onDia(d)} accessibilityLabel={nombreDia(d)} style={styles.dia} />
        ))}
      </View>
      {p.clases.length === 0 ? (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:temario.sinClases', { dia: nombreDia(p.diaHorario) })}
        </Text>
      ) : (
        p.clases.map((c, i) => (
          <FilaFocus
            key={c.id}
            primera={i === 0}
            onPress={() => p.acciones.onEditarClase(c)}
            accessibilityLabel={t('focus:temario.claseA11y', { horas: horaClase(c), asignatura: c.aula ? `${c.asignatura}, ${c.aula}` : c.asignatura })}
            accessibilityHint={t('focus:temario.claseHint')}
          >
            <Text style={[textoFocus.filaFuerte, styles.horaClase]} maxFontSizeMultiplier={1.35}>
              {horaClase(c)}
            </Text>
            <View style={styles.flex}>
              <Text style={textoFocus.fila} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                {c.asignatura}
              </Text>
              {c.aula ? (
                <Text style={textoFocus.detalle} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                  {c.aula}
                </Text>
              ) : null}
            </View>
          </FilaFocus>
        ))
      )}
      {p.clases.length > 0 ? <BotonFocus titulo={t('focus:fondo.horario.copiarBoton')} variante="texto" pequeno onPress={p.acciones.onCopiarDia} style={styles.arribaPoco} /> : null}
    </TarjetaFocus>
  );
}

function Metodos({ p }: { p: TemarioVistaProps }) {
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:metodos.rotulo')} />
      <View style={styles.arribaPoco}>
        {METODOS.map((m, i) => (
          <FilaFocus key={m.id} primera={i === 0} style={styles.metodoFila} onPress={() => p.acciones.onMetodo(m)} accessibilityLabel={t(`focus:metodos.${m.id}.nombre`)} accessibilityHint={t(`focus:metodos.${m.id}.linea`)}>
            <View style={styles.metodoIcono}>
              <Ionicons name={m.icono as keyof typeof Ionicons.glyphMap} size={18} color={F.acento} />
            </View>
            <View style={styles.flex}>
              <Text style={textoFocus.filaFuerte} maxFontSizeMultiplier={1.35}>
                {t(`focus:metodos.${m.id}.nombre`)}
              </Text>
              <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.5}>
                {t(`focus:metodos.${m.id}.linea`)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={F.rotulo} />
          </FilaFocus>
        ))}
      </View>
    </TarjetaFocus>
  );
}

export function TemarioVista(p: TemarioVistaProps) {
  const titulo = <TituloFocus titulo={t('focus:temario.titulo')} subtitulo={t('focus:temario.subtitulo')} />;
  if (p.estado === 'cargando') {
    return (
      <Screen>
        {titulo}
        <View style={styles.huecos} accessibilityRole="progressbar" accessibilityLabel={t('focus:comun.cargandoA11y')}>
          <Skeleton height={44} />
          <Skeleton height={220} />
          <Skeleton height={120} />
        </View>
      </Screen>
    );
  }
  let i = 1;
  return (
    <Screen contentStyle={styles.contenido}>
      <Entrada indice={0}>{titulo}</Entrada>
      {p.estado === 'error' ? (
        <View style={styles.bloque}>
          <ErrorSistema mensaje={p.error ?? ''} onReintentar={p.acciones.onReintentar} compacto />
        </View>
      ) : !p.disponible ? (
        <TarjetaFocus style={styles.bloque}>
          <VacioFocus rotulo={t('focus:hoy.asignaturasRotulo')} icono="hourglass-outline" titulo={t('focus:comun.noDisponibleTitulo')} cuerpo={t('focus:comun.noDisponibleCuerpo')} />
        </TarjetaFocus>
      ) : p.asignaturas.length === 0 ? (
        <TarjetaFocus style={styles.bloque}>
          <VacioFocus
            rotulo={t('focus:hoy.asignaturasRotulo')}
            icono="school-outline"
            titulo={t('focus:hoy.empiezaTitulo')}
            cuerpo={t('focus:temario.empiezaCuerpo')}
            accion={{ titulo: t('focus:hoy.anadirAsignatura'), onPress: p.acciones.onAnadirAsignatura }}
          />
        </TarjetaFocus>
      ) : (
        <>
          <Entrada indice={i++} style={styles.bloque}>
            <Asignaturas p={p} />
          </Entrada>
          <Entrada indice={i++} style={styles.bloque}>
            <Repasos p={p} />
          </Entrada>
          <Entrada indice={i++} style={styles.bloque}>
            <Temario key={p.elegida ?? ''} p={p} />
          </Entrada>
          <Entrada indice={i++} style={styles.bloque}>
            <Flashcards p={p} />
          </Entrada>
          <Entrada indice={i++} style={styles.bloque}>
            <Horas p={p} />
          </Entrada>
          <Entrada indice={i++} style={styles.bloque}>
            <Horario p={p} />
          </Entrada>
        </>
      )}
      <Entrada indice={7} style={styles.bloque}>
        <Metodos p={p} />
      </Entrada>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contenido: { paddingBottom: space.s8 },
  bloque: { marginBottom: space.s3 },
  huecos: { gap: space.s3 },
  flex: { flex: 1, minWidth: 0 },
  arriba: { marginTop: space.s3 },
  arribaPoco: { marginTop: space.s1 },
  chipsScroll: { marginHorizontal: -space.s5 },
  chips: { gap: space.s2, paddingHorizontal: space.s5 },
  progreso: { flexDirection: 'row', alignItems: 'center', gap: space.s3, marginTop: space.s3 },
  botones: { flexDirection: 'row', alignItems: 'center', gap: space.s2, marginTop: space.s3 },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s3 },
  lapiz: { paddingLeft: space.s2 },
  izq: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  acento: { color: F.acento },
  minus: { textTransform: 'none' },
  hora: { gap: 6, paddingVertical: space.s2 },
  horaFila: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  dias: { flexDirection: 'row', gap: 6, marginTop: space.s3 },
  dia: { flex: 1, paddingHorizontal: 0, alignItems: 'center' },
  horaClase: { width: 112, fontFamily: tipo.micro.family },
  metodoFila: { paddingVertical: space.s2 + 2 },
  metodoIcono: { width: 24, alignItems: 'center', justifyContent: 'center' },
});
