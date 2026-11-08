// NIVL · Mundo FOCUS: Exámenes, la agenda académica (pestaña 3 de la lámina). Pura.
//   · La semana: clases, exámenes y entregas de un vistazo.
//   · Entregas y deberes: lo pendiente, con su casilla.
//   · Próximos exámenes, con fecha, aproximados o aún sin fecha.
//   · El plan de los próximos días hacia el examen más cercano.
//   · Notas, media y objetivo por asignatura.
//   · Simulacros tipo test y su evolución.
//   · Exámenes anteriores: la técnica y los ya hechos.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Entrada, ErrorSistema } from '@/components/arena';
import { Screen, Skeleton } from '@/components/ui';
import { space } from '@/design/tokens';
import { diaMes, plazoDe, type ClavePerfil, type DiaVista, type EntregaHecha, type Plazo, type SimulacrosAsignatura } from '@/focus/agenda';
import { fechaCorta, hhmm } from '@/focus/fechas';
import { formatoNota } from '@/focus/notas';
import type { DiaPlan } from '@/focus/planEstudio';
import type { EntregaVista, ExamenSinFechaVista, ExamenVista, NotasAsignatura } from '@/focus/resumen';
import type { ItemSemana } from '@/focus/semana';
import type { Asignatura, Examen } from '@/focus/tipos';
import { t } from '@/i18n';
import { F } from './estilo';
import { etiquetaDias } from './FocusHoyVista';
import { porPerfil, textoCambio, textoEvolucion } from './HojasAgenda';
import { etiquetaDiaPlan, etiquetaItem, fechaDeExamen, nombreDia, textoNecesaria } from './HojasFocus';
import { BarraFocus, BotonFocus, Casilla, ChipFocus, Etiqueta, FilaFocus, Rotulo, TarjetaFocus, TituloFocus, VacioFocus, textoFocus } from './Piezas';

export interface ExamenesVistaProps {
  estado: 'cargando' | 'listo' | 'error';
  error: string | null;
  disponible: boolean;
  sinAsignaturas: boolean;
  hoy: string;
  perfil: ClavePerfil;
  lunes: string;
  domingo: string;
  esEstaSemana: boolean;
  semana: DiaVista[];
  entregas: EntregaVista[];
  entregasHechas: EntregaHecha[];
  proximos: ExamenVista[];
  sinFecha: ExamenSinFechaVista[];
  /** Plan de los próximos días hacia el examen más cercano. */
  plan: { examen: ExamenVista; dias: DiaPlan[] } | null;
  nombreTema: (id: string | null) => string;
  pasados: (Examen & { fecha: string; asignatura: string })[];
  notas: NotasAsignatura[];
  /** Asignaturas sin notas: desde aquí también se les pone objetivo. */
  sinNotas: Asignatura[];
  mediaGlobal: number | null;
  simulacros: SimulacrosAsignatura[];
  acciones: {
    onSemana: (delta: -1 | 0 | 1) => void;
    onExamen: (id: string) => void;
    onNuevoExamen: () => void;
    onEntrega: (id: string | null) => void;
    onMarcarEntrega: (id: string, hecha: boolean) => void;
    onAnadirAsignatura: () => void;
    onNotas: (asignaturaId: string) => void;
    onNuevaNota: () => void;
    onSimulacro: () => void;
    onMetodoAnteriores: () => void;
    onReintentar: () => void;
  };
}

const DIAS_PLAN = 5;
const PUNTOS_EVOLUCION = 6;

function textoPlazo(p: Plazo): string {
  switch (p.clave) {
    case 'hoy':
      return t('focus:comun.hoy');
    case 'manana':
      return t('focus:comun.manana');
    case 'sinFecha':
      return t('focus:agenda.plazo.sinFecha');
    case 'dias':
      return t('focus:comun.enDias', { count: p.count });
    case 'vencida':
      return t('focus:agenda.plazo.vencida', { count: p.count });
  }
}

const conSeparador = (partes: readonly string[]) => partes.join(' · '); // i18n-ok: separa textos ya traducidos

function Flecha({ icono, a11y, onPress }: { icono: 'chevron-back' | 'chevron-forward'; a11y: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={a11y} style={({ pressed }) => [styles.flecha, pressed && styles.pulsado]}>
      <Ionicons name={icono} size={18} color={F.acento} />
    </Pressable>
  );
}

function LineaFechado({ item, perfil, acciones }: { item: ItemSemana; perfil: ClavePerfil; acciones: ExamenesVistaProps['acciones'] }) {
  const tipo = porPerfil(perfil, item.tipo);
  const abrir = () => (item.tipo === 'entrega' ? acciones.onEntrega(item.id) : acciones.onExamen(item.id));
  const extra = item.hecha ? t('focus:agenda.semana.hecha') : item.estimada ? t('focus:agenda.semana.aprox') : null;
  return (
    <Pressable
      onPress={abrir}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityLabel={t('focus:agenda.semana.itemA11y', { tipo, titulo: item.titulo, asignatura: item.asignatura })}
      style={({ pressed }) => [styles.linea, pressed && styles.pulsado]}
    >
      <Text style={[textoFocus.fila, item.hecha && styles.tachado]} numberOfLines={2} maxFontSizeMultiplier={1.35}>
        {item.hora !== null ? `${hhmm(item.hora)} ` : ''}
        <Text style={styles.acento}>{tipo} </Text>
        {t('focus:agenda.semana.item', { titulo: item.titulo, asignatura: item.asignatura })}
      </Text>
      {extra ? (
        <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35}>
          {extra}
        </Text>
      ) : null}
    </Pressable>
  );
}

function DiaSemanaFila({ dia, primera, p }: { dia: DiaVista; primera: boolean; p: ExamenesVistaProps }) {
  const [abierto, setAbierto] = useState(false);
  const hay = dia.clases.length > 0 || dia.fechados.length > 0;
  return (
    <FilaFocus primera={primera} style={styles.filaAlta}>
      <Text style={[textoFocus.detalle, styles.dia, dia.esHoy && styles.acento]} maxFontSizeMultiplier={1.35}>
        {`${nombreDia(dia.dia, true)} ${Number(dia.fecha.slice(8, 10))}`}
      </Text>
      <View style={styles.flex}>
        {!hay ? (
          <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35}>
            {t('focus:agenda.semana.libre')}
          </Text>
        ) : null}
        {dia.fechados.map((x) => (
          <LineaFechado key={x.id} item={x} perfil={p.perfil} acciones={p.acciones} />
        ))}
        {dia.clases.length > 0 && dia.clasesDesde !== null && dia.clasesHasta !== null ? (
          <Pressable
            onPress={() => setAbierto((v) => !v)}
            hitSlop={{ top: 4, bottom: 4 }}
            accessibilityRole="button"
            accessibilityState={{ expanded: abierto }}
            accessibilityHint={t('focus:agenda.semana.clasesHint')}
            style={({ pressed }) => [styles.linea, pressed && styles.pulsado]}
          >
            <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35}>
              {t('focus:agenda.semana.clases', { count: dia.clases.length, desde: hhmm(dia.clasesDesde), hasta: hhmm(dia.clasesHasta) })}
            </Text>
          </Pressable>
        ) : null}
        {abierto
          ? dia.clases.map((c) => (
              <Text key={c.id} style={[textoFocus.detalle, styles.claseAbierta]} maxFontSizeMultiplier={1.35}>
                {c.aula
                  ? t('focus:agenda.semana.claseAula', { hora: hhmm(c.hora ?? 0), asignatura: c.asignatura, aula: c.aula })
                  : t('focus:agenda.semana.clase', { hora: hhmm(c.hora ?? 0), asignatura: c.asignatura })}
              </Text>
            ))
          : null}
      </View>
    </FilaFocus>
  );
}

function Semana({ p }: { p: ExamenesVistaProps }) {
  return (
    <TarjetaFocus>
      <View style={styles.cabeceraSemana}>
        <Flecha icono="chevron-back" a11y={t('focus:agenda.semana.anteriorA11y')} onPress={() => p.acciones.onSemana(-1)} />
        <Rotulo texto={t('focus:agenda.semana.rotulo', { desde: diaMes(p.lunes), hasta: diaMes(p.domingo) })} style={styles.flex} />
        <Flecha icono="chevron-forward" a11y={t('focus:agenda.semana.siguienteA11y')} onPress={() => p.acciones.onSemana(1)} />
      </View>
      {!p.esEstaSemana ? <BotonFocus titulo={t('focus:agenda.semana.volver')} variante="texto" pequeno onPress={() => p.acciones.onSemana(0)} /> : null}
      <View style={styles.arribaPoco}>
        {p.semana.map((d, i) => (
          <DiaSemanaFila key={d.fecha} dia={d} primera={i === 0} p={p} />
        ))}
      </View>
    </TarjetaFocus>
  );
}

function Entregas({ p }: { p: ExamenesVistaProps }) {
  return (
    <TarjetaFocus>
      <Rotulo texto={porPerfil(p.perfil, 'entregasRotulo')} derecha={t('focus:agenda.entregas.nueva')} derechaA11y={porPerfil(p.perfil, 'entregaNueva')} onDerecha={() => p.acciones.onEntrega(null)} />
      {p.entregas.length === 0 ? (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:agenda.entregas.vacio')}
        </Text>
      ) : (
        <View style={styles.arribaPoco}>
          {p.entregas.map((e, i) => {
            const plazo = plazoDe(e.dias);
            const texto = textoPlazo(plazo);
            const titulo = e.examen.titulo;
            const marcar = t('focus:agenda.entregas.marcarA11y', { titulo });
            return (
              <FilaFocus
                key={e.examen.id}
                primera={i === 0}
                onPress={() => p.acciones.onEntrega(e.examen.id)}
                accessibilityLabel={t('focus:agenda.entregas.abrirA11y', { titulo, asignatura: e.asignatura, plazo: texto })}
                accessibilityHint={t('focus:agenda.entregas.abrirHint')}
                accessibilityActions={[{ name: 'hecha', label: marcar }]}
                onAccessibilityAction={(ev) => ev.nativeEvent.actionName === 'hecha' && p.acciones.onMarcarEntrega(e.examen.id, true)}
                style={styles.filaAlta}
              >
                <Pressable onPress={() => p.acciones.onMarcarEntrega(e.examen.id, true)} hitSlop={12} accessibilityRole="checkbox" accessibilityState={{ checked: false }} accessibilityLabel={marcar}>
                  <Casilla estado="vacia" />
                </Pressable>
                <View style={styles.flex}>
                  <Text style={textoFocus.fila} numberOfLines={2} maxFontSizeMultiplier={1.35}>
                    {titulo}
                  </Text>
                  <Text style={textoFocus.detalle} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                    {conSeparador(e.examen.hora !== null ? [e.asignatura, hhmm(e.examen.hora)] : [e.asignatura])}
                  </Text>
                </View>
                <Etiqueta texto={texto} apagada={plazo.clave === 'sinFecha' || plazo.clave === 'dias'} />
              </FilaFocus>
            );
          })}
        </View>
      )}
      {p.entregasHechas.length > 0 ? (
        <>
          <Rotulo texto={t('focus:agenda.entregas.hechasRotulo')} style={styles.arriba} />
          <View style={styles.arribaPoco}>
            {p.entregasHechas.map((e, i) => (
              <FilaFocus
                key={e.examen.id}
                primera={i === 0}
                onPress={() => p.acciones.onMarcarEntrega(e.examen.id, false)}
                accessibilityLabel={t('focus:agenda.entregas.reabrirA11y', { titulo: e.examen.titulo })}
              >
                <Casilla estado="hecha" />
                <Text style={[textoFocus.detalle, styles.flex, styles.tachado]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                  {conSeparador([e.examen.titulo, e.asignatura])}
                </Text>
              </FilaFocus>
            ))}
          </View>
        </>
      ) : null}
    </TarjetaFocus>
  );
}

function Proximos({ p }: { p: ExamenesVistaProps }) {
  const vacio = p.proximos.length === 0 && p.sinFecha.length === 0;
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:examenes.proximosRotulo')} derecha={t('focus:examenes.nuevo')} derechaA11y={porPerfil(p.perfil, 'examenNuevo')} onDerecha={p.acciones.onNuevoExamen} />
      {vacio ? (
        <VacioFocus
          icono="calendar-outline"
          titulo={t('focus:examenes.vacioTitulo')}
          cuerpo={t('focus:examenes.vacioCuerpo')}
          accion={{ titulo: t('focus:examenes.anadir'), onPress: p.acciones.onNuevoExamen }}
        />
      ) : null}
      {p.proximos.map((e, i) => (
        <Pressable
          key={e.examen.id}
          onPress={() => p.acciones.onExamen(e.examen.id)}
          accessibilityRole="button"
          accessibilityLabel={t('focus:hoy.examenA11y', { asignatura: e.asignatura, dias: etiquetaDias(e.dias), progreso: e.progreso })}
          accessibilityHint={t('focus:examenes.abrirHint')}
          style={({ pressed }) => [styles.examen, i > 0 && styles.separado, pressed && styles.pulsado]}
        >
          <View style={styles.fila}>
            <Text style={[textoFocus.filaFuerte, styles.flex]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
              {e.asignatura}
            </Text>
            <Etiqueta texto={etiquetaDias(e.dias)} apagada={e.examen.estimada} />
          </View>
          <Text style={[textoFocus.detalle, styles.detalle]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
            {t('focus:examenes.detalle', { titulo: e.examen.titulo, fecha: fechaDeExamen(e.examen), count: e.temas })}
          </Text>
          <View style={styles.fila}>
            <BarraFocus ratio={e.progreso / 100} style={styles.flex} />
            <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35}>
              {t('focus:hoy.temarioPct', { pct: e.progreso })}
            </Text>
          </View>
        </Pressable>
      ))}
      {p.sinFecha.map((e, i) => (
        <Pressable
          key={e.examen.id}
          onPress={() => p.acciones.onExamen(e.examen.id)}
          accessibilityRole="button"
          accessibilityLabel={t('focus:agenda.examen.sinFechaA11y', { asignatura: e.asignatura, progreso: e.progreso })}
          accessibilityHint={t('focus:examenes.abrirHint')}
          style={({ pressed }) => [styles.examen, (i > 0 || p.proximos.length > 0) && styles.separado, pressed && styles.pulsado]}
        >
          <View style={styles.fila}>
            <Text style={[textoFocus.filaFuerte, styles.flex]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
              {e.asignatura}
            </Text>
            <Etiqueta texto={t('focus:agenda.plazo.sinFecha')} apagada />
          </View>
          <Text style={[textoFocus.detalle, styles.detalle]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
            {t('focus:agenda.examen.detalleSinFecha', { titulo: e.examen.titulo, count: e.temas })}
          </Text>
          <View style={styles.fila}>
            <BarraFocus ratio={e.progreso / 100} style={styles.flex} />
            <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35}>
              {t('focus:hoy.temarioPct', { pct: e.progreso })}
            </Text>
          </View>
        </Pressable>
      ))}
    </TarjetaFocus>
  );
}

function Plan({ p }: { p: ExamenesVistaProps }) {
  if (!p.plan) return null;
  const dias = p.plan.dias.slice(0, DIAS_PLAN);
  return (
    <TarjetaFocus>
      <Rotulo
        texto={t('focus:examenes.planRotulo', { asignatura: p.plan.examen.asignatura })}
        derecha={t('focus:examenes.verPlan')}
        onDerecha={() => p.acciones.onExamen(p.plan!.examen.examen.id)}
      />
      <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
        {t('focus:examenes.planCuerpo')}
      </Text>
      <View style={styles.arribaPoco}>
        {dias.map((d, i) => (
          <FilaFocus key={d.fecha} primera={i === 0} style={styles.filaAlta}>
            <Text style={[textoFocus.detalle, styles.dia, d.fecha === p.hoy && styles.acento]} maxFontSizeMultiplier={1.35}>
              {etiquetaDiaPlan(d.fecha, p.hoy)}
            </Text>
            <View style={styles.flex}>
              {d.items.map((it, k) => (
                <Text key={`${it.tipo}-${it.temaId ?? k}`} style={textoFocus.fila} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                  <Text style={it.tipo === 'estudiar' ? styles.acento : styles.apagado}>{etiquetaItem(it.tipo)} </Text>
                  {it.tipo === 'simulacro' ? t('focus:hojas.simulacroDetalle') : p.nombreTema(it.temaId)}
                </Text>
              ))}
            </View>
          </FilaFocus>
        ))}
      </View>
    </TarjetaFocus>
  );
}

function Notas({ p }: { p: ExamenesVistaProps }) {
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:examenes.notasRotulo')} derecha={t('focus:examenes.anadirNota')} onDerecha={p.acciones.onNuevaNota} />
      {p.notas.length === 0 ? (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:examenes.notasVacio')}
        </Text>
      ) : (
        <>
          <View style={styles.media} accessible accessibilityLabel={t('focus:examenes.mediaA11y', { media: formatoNota(p.mediaGlobal) })}>
            <Text style={styles.mediaCifra} maxFontSizeMultiplier={1}>
              {formatoNota(p.mediaGlobal)}
            </Text>
            <Text style={[textoFocus.cuerpo, styles.flex]} maxFontSizeMultiplier={1.5}>
              {t('focus:examenes.mediaGlobal')}
            </Text>
          </View>
          {p.notas.map((n, i) => {
            const nec = textoNecesaria(n.necesaria);
            const base = n.media.ponderada ? t('focus:notas.ponderadaCorta', { pct: formatoNota(n.media.pesoEvaluado) }) : t('focus:notas.simpleCorta', { count: n.notas });
            const objetivo = n.asignatura.notaObjetivo;
            return (
              <FilaFocus
                key={n.asignatura.id}
                primera={i === 0}
                onPress={() => p.acciones.onNotas(n.asignatura.id)}
                accessibilityLabel={t('focus:examenes.notaA11y', { asignatura: n.asignatura.nombre, media: formatoNota(n.media.media) })}
                style={styles.filaAlta}
              >
                <View style={styles.flex}>
                  <Text style={textoFocus.fila} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                    {n.asignatura.nombre}
                  </Text>
                  <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.5} numberOfLines={1}>
                    {objetivo !== null ? conSeparador([base, t('focus:agenda.notas.objetivoCorto', { nota: formatoNota(objetivo) })]) : base}
                  </Text>
                  {nec ? (
                    <Text style={[textoFocus.detalle, styles.acento]} maxFontSizeMultiplier={1.5} numberOfLines={2}>
                      {nec}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.notaCifra} maxFontSizeMultiplier={1}>
                  {formatoNota(n.media.media)}
                </Text>
              </FilaFocus>
            );
          })}
        </>
      )}
      {p.sinNotas.length > 0 ? (
        <>
          <Rotulo texto={t('focus:agenda.notas.sinNotasRotulo')} style={styles.arriba} />
          <View style={styles.chips}>
            {p.sinNotas.map((a) => (
              <ChipFocus key={a.id} titulo={a.nombre} onPress={() => p.acciones.onNotas(a.id)} />
            ))}
          </View>
        </>
      ) : null}
    </TarjetaFocus>
  );
}

function Simulacros({ p }: { p: ExamenesVistaProps }) {
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:agenda.simulacro.rotulo')} derecha={t('focus:agenda.simulacro.nuevo')} derechaA11y={t('focus:agenda.simulacro.titulo')} onDerecha={p.acciones.onSimulacro} />
      {p.simulacros.length === 0 ? (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:agenda.simulacro.vacio')}
        </Text>
      ) : (
        <View style={styles.arribaPoco}>
          {p.simulacros.map((s, i) => {
            const cambio = textoCambio(s.evolucion);
            const serie = conSeparador(s.evolucion.puntos.slice(-PUNTOS_EVOLUCION).map((x) => formatoNota(x.nota)));
            const resumen = textoEvolucion(s.evolucion);
            return (
              <FilaFocus
                key={s.asignaturaId}
                primera={i === 0}
                onPress={() => p.acciones.onNotas(s.asignaturaId)}
                accessibilityLabel={conSeparador([s.asignatura, resumen])}
                accessibilityHint={t('focus:agenda.simulacro.abrirHint')}
                style={styles.filaAlta}
              >
                <View style={styles.flex}>
                  <Text style={textoFocus.fila} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                    {s.asignatura}
                  </Text>
                  <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.5}>
                    {resumen}
                  </Text>
                  <Text style={textoFocus.detalle} numberOfLines={1} maxFontSizeMultiplier={1.5}>
                    {serie}
                  </Text>
                  {cambio ? (
                    <Text style={[textoFocus.detalle, styles.acento]} maxFontSizeMultiplier={1.5}>
                      {cambio}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.notaCifra} maxFontSizeMultiplier={1}>
                  {formatoNota(s.evolucion.ultima)}
                </Text>
              </FilaFocus>
            );
          })}
        </View>
      )}
    </TarjetaFocus>
  );
}

function Anteriores({ p }: { p: ExamenesVistaProps }) {
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:examenes.anterioresRotulo')} />
      <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
        {t('focus:examenes.anterioresCuerpo')}
      </Text>
      {p.pasados.slice(0, 4).map((x, i) => (
        <FilaFocus key={x.id} primera={i === 0} onPress={() => p.acciones.onExamen(x.id)} accessibilityLabel={conSeparador([x.asignatura, x.titulo, fechaCorta(x.fecha)])}>
          <Text style={[textoFocus.fila, styles.flex]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
            {x.asignatura} · {x.titulo}
          </Text>
          <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35}>
            {fechaCorta(x.fecha)}
          </Text>
        </FilaFocus>
      ))}
      <BotonFocus titulo={t('focus:examenes.comoSimulacro')} variante="contorno" pequeno onPress={p.acciones.onMetodoAnteriores} style={styles.arriba} />
    </TarjetaFocus>
  );
}

export function ExamenesVista(p: ExamenesVistaProps) {
  const titulo = <TituloFocus titulo={t('focus:examenes.titulo')} subtitulo={t('focus:examenes.subtitulo')} />;
  if (p.estado === 'cargando') {
    return (
      <Screen>
        {titulo}
        <View style={styles.huecos} accessibilityRole="progressbar" accessibilityLabel={t('focus:comun.cargandoA11y')}>
          <Skeleton height={200} />
          <Skeleton height={160} />
        </View>
      </Screen>
    );
  }
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
      ) : p.sinAsignaturas ? (
        <TarjetaFocus style={styles.bloque}>
          <VacioFocus
            rotulo={t('focus:hoy.asignaturasRotulo')}
            icono="school-outline"
            titulo={t('focus:hoy.empiezaTitulo')}
            cuerpo={t('focus:examenes.empiezaCuerpo')}
            accion={{ titulo: t('focus:hoy.anadirAsignatura'), onPress: p.acciones.onAnadirAsignatura }}
          />
        </TarjetaFocus>
      ) : (
        <>
          <Entrada indice={1} style={styles.bloque}>
            <Semana p={p} />
          </Entrada>
          <Entrada indice={2} style={styles.bloque}>
            <Entregas p={p} />
          </Entrada>
          <Entrada indice={3} style={styles.bloque}>
            <Proximos p={p} />
          </Entrada>
          {p.plan ? (
            <Entrada indice={4} style={styles.bloque}>
              <Plan p={p} />
            </Entrada>
          ) : null}
          <Entrada indice={5} style={styles.bloque}>
            <Notas p={p} />
          </Entrada>
          <Entrada indice={6} style={styles.bloque}>
            <Simulacros p={p} />
          </Entrada>
          <Entrada indice={7} style={styles.bloque}>
            <Anteriores p={p} />
          </Entrada>
        </>
      )}
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
  separado: { borderTopWidth: 1, borderTopColor: F.separador },
  pulsado: { opacity: 0.7 },
  examen: { paddingVertical: space.s3, gap: space.s2 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  detalle: { marginTop: -4 },
  filaAlta: { alignItems: 'flex-start', paddingVertical: space.s3 },
  dia: { width: 64, paddingTop: 1 },
  acento: { color: F.acento },
  apagado: { color: F.rotulo },
  tachado: { textDecorationLine: 'line-through' },
  cabeceraSemana: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  flecha: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  linea: { minHeight: 28, justifyContent: 'center' },
  claseAbierta: { paddingVertical: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s2 },
  media: { flexDirection: 'row', alignItems: 'center', gap: space.s4, marginTop: space.s3, marginBottom: space.s2 },
  mediaCifra: { ...textoFocus.cifra },
  notaCifra: { ...textoFocus.cifra, fontSize: 24, lineHeight: 28 },
});
