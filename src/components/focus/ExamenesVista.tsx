// NIVL · Mundo FOCUS: Exámenes (pestaña 3 de la lámina). Pura.
//   · Próximos exámenes: días que faltan, % del temario y su plan automático.
//   · El plan de los próximos días hacia el examen más cercano.
//   · Notas y media (ponderada si se indica) y qué hace falta para el 5.
//   · Exámenes anteriores: la técnica y los ya hechos.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Entrada, ErrorSistema } from '@/components/arena';
import { Screen, Skeleton } from '@/components/ui';
import { space } from '@/design/tokens';
import { fechaCorta } from '@/focus/fechas';
import { formatoNota } from '@/focus/notas';
import type { DiaPlan } from '@/focus/planEstudio';
import type { ExamenVista, NotasAsignatura } from '@/focus/resumen';
import type { Examen } from '@/focus/tipos';
import { t } from '@/i18n';
import { F } from './estilo';
import { etiquetaDias } from './FocusHoyVista';
import { etiquetaItem, nombreDia, textoNecesaria } from './HojasFocus';
import { BarraFocus, BotonFocus, Etiqueta, FilaFocus, Rotulo, TarjetaFocus, TituloFocus, VacioFocus, textoFocus } from './Piezas';

export interface ExamenesVistaProps {
  estado: 'cargando' | 'listo' | 'error';
  error: string | null;
  disponible: boolean;
  sinAsignaturas: boolean;
  proximos: ExamenVista[];
  /** Plan de los próximos días hacia el examen más cercano. */
  plan: { examen: ExamenVista; dias: DiaPlan[] } | null;
  nombreTema: (id: string | null) => string;
  pasados: (Examen & { asignatura: string })[];
  notas: NotasAsignatura[];
  mediaGlobal: number | null;
  acciones: {
    onExamen: (id: string) => void;
    onNuevoExamen: () => void;
    onAnadirAsignatura: () => void;
    onNotas: (asignaturaId: string) => void;
    onNuevaNota: () => void;
    onMetodoAnteriores: () => void;
    onReintentar: () => void;
  };
}

const DIAS_PLAN = 5;

function diaCorto(f: string, i: number): string {
  if (i === 0) return t('focus:comun.hoy');
  const d = new Date(Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)))).getUTCDay();
  return `${nombreDia(d === 0 ? 7 : d, true)} ${Number(f.slice(8, 10))}`;
}

function Proximos({ p }: { p: ExamenesVistaProps }) {
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:examenes.proximosRotulo')} derecha={t('focus:examenes.nuevo')} onDerecha={p.acciones.onNuevoExamen} />
      {p.proximos.length === 0 ? (
        <VacioFocus
          icono="calendar-outline"
          titulo={t('focus:examenes.vacioTitulo')}
          cuerpo={t('focus:examenes.vacioCuerpo')}
          accion={{ titulo: t('focus:examenes.anadir'), onPress: p.acciones.onNuevoExamen }}
        />
      ) : (
        p.proximos.map((e, i) => (
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
              <Etiqueta texto={etiquetaDias(e.dias)} />
            </View>
            <Text style={[textoFocus.detalle, styles.detalle]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
              {t('focus:examenes.detalle', { titulo: e.examen.titulo, fecha: fechaCorta(e.examen.fecha), count: e.temas })}
            </Text>
            <View style={styles.fila}>
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
            <Text style={[textoFocus.detalle, styles.dia, i === 0 && styles.acento]} maxFontSizeMultiplier={1.35}>
              {diaCorto(d.fecha, i)}
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
                    {n.media.ponderada ? t('focus:notas.ponderadaCorta', { pct: formatoNota(n.media.pesoEvaluado) }) : t('focus:notas.simpleCorta', { count: n.notas })}
                  </Text>
                  {nec ? (
                    <Text style={[textoFocus.detalle, styles.acento]} maxFontSizeMultiplier={1.5} numberOfLines={1}>
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
        <FilaFocus key={x.id} primera={i === 0}>
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
            <Proximos p={p} />
          </Entrada>
          {p.plan ? (
            <Entrada indice={2} style={styles.bloque}>
              <Plan p={p} />
            </Entrada>
          ) : null}
          <Entrada indice={3} style={styles.bloque}>
            <Notas p={p} />
          </Entrada>
          <Entrada indice={4} style={styles.bloque}>
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
  media: { flexDirection: 'row', alignItems: 'center', gap: space.s4, marginTop: space.s3, marginBottom: space.s2 },
  mediaCifra: { ...textoFocus.cifra },
  notaCifra: { ...textoFocus.cifra, fontSize: 24, lineHeight: 28 },
});
