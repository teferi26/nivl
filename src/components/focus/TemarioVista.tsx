// NIVL · Mundo FOCUS: Temario (pestaña 2 de la lámina: «Hoy · Temario ·
// Exámenes · Coach»). Pura. Todo lo que se estudia y cómo:
//   · Asignaturas (chips) y el temario de la elegida, con su estado.
//   · Repasos de hoy (repetición espaciada 1, 3, 7, 14, 30) y flashcards.
//   · Horas de estudio de la semana por asignatura.
//   · Horario de clases.
//   · Métodos de estudio explicados.

import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Entrada, ErrorSistema } from '@/components/arena';
import { Screen, Skeleton } from '@/components/ui';
import { space, type as tipo } from '@/design/tokens';
import { formatoHoras } from '@/focus/horario';
import { METODOS, type Metodo } from '@/focus/metodos';
import type { HorasAsignatura } from '@/focus/resumen';
import type { Asignatura, Clase, Mazo, Tema } from '@/focus/tipos';
import { t } from '@/i18n';
import { F } from './estilo';
import { FilaTema, horaClase, nombreDia } from './HojasFocus';
import { BarraFocus, BotonFocus, ChipFocus, FilaFocus, Rotulo, TarjetaFocus, TituloFocus, VacioFocus, textoFocus } from './Piezas';

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
    onBorrarTema: (t: Tema) => void;
    onRepasar: () => void;
    onNuevoMazo: () => void;
    onNuevaTarjeta: (mazoId: string | null) => void;
    onDia: (d: number) => void;
    onAnadirClase: () => void;
    onBorrarClase: (c: Clase) => void;
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

function Temario({ p }: { p: TemarioVistaProps }) {
  const a = p.asignaturas.find((x) => x.id === p.elegida);
  if (!a) return null;
  const dominados = p.temas.filter((x) => x.estado === 'dominado').length;
  return (
    <TarjetaFocus>
      <Rotulo texto={t('focus:hoy.temarioRotulo', { asignatura: a.nombre })} derecha={t('focus:temario.dominados', { n: dominados, total: p.temas.length })} />
      {p.temas.length > 0 ? (
        <View style={styles.progreso}>
          <BarraFocus ratio={p.progreso / 100} style={styles.flex} />
          <Text style={textoFocus.detalle}>{t('focus:hoy.temarioPct', { pct: p.progreso })}</Text>
        </View>
      ) : (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:temario.vacio')}
        </Text>
      )}
      <View style={styles.arriba}>
        {p.temas.map((x, i) => (
          <FilaTema key={x.id} tema={x} primera={i === 0} onPress={() => p.acciones.onAlternarTema(x)} onLongPress={() => p.acciones.onBorrarTema(x)} />
        ))}
      </View>
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
        <BotonFocus titulo={t('focus:temario.anadirTarjeta')} icono="add" variante="contorno" pequeno onPress={() => p.acciones.onNuevaTarjeta(null)} style={styles.arriba} />
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
            onLongPress={() => p.acciones.onBorrarClase(c)}
            onPress={() => p.acciones.onBorrarClase(c)}
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
            <Temario p={p} />
          </Entrada>
          <Entrada indice={i++} style={styles.bloque}>
            <Repasos p={p} />
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
