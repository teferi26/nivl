// NIVL · Mundo IRON: el inicio, «IRON: tu gimnasio, nada más» (lámina 2 de la
// P01, teléfono de la izquierda). Pura: todo llega por props (useInicioIron o
// la galería).
//
// De arriba abajo, como la lámina:
//   1 · La cabecera del mundo (ranura: emblema, IRON, nivel de IRON).
//   2 · El entreno de hoy, primero: tarjeta héroe con el día de la rutina,
//       tres filas (ejercicio · series × reps · kg) y EMPEZAR ENTRENO.
//   3 · Tus pesos y récords: tres tarjetas con su gráfica de 6 semanas.
//   4 · Rutinas: tus días en una fila y «+ Nueva».
//   5 · Añadir ejercicio (catálogo con técnica) | Dieta de hoy (anillo).
//   6 · El coach de IRON.
// El informe del cierre (el mismo de Hoy de NIVL) va antes del entreno si lo hay.
// FUERA (regla de producto): hábitos, campañas, Winter Arc. Viven en NIVL.

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { kgTexto } from '@/components/iron/HistorialIron';
import { miles } from '@/i18n/formato';
import { t } from '@/i18n';
import { entrenoDeHoy, type DiaRutina, type EjercicioRutina, type Prescrito } from './calculos';
import { FiguraSentadilla, GlifoIron } from './Glifos';
import {
  AnilloIron,
  BarraIron,
  BotonIron,
  ChipIron,
  CoachIron,
  CuadroIron,
  estilosIron,
  FilaIron,
  HuecoIron,
  LineaAncha,
  PantallaIron,
  RotuloIron,
  TarjetaIron,
} from './piezas';
import { A, C, F, fs, px } from './tema';
import type { EstadoPesosIron, PesoIron } from './usePesos';

export interface EntradaEntrenoHoy {
  cargado: boolean;
  errorCarga: string | null;
  /** Día ISO de hoy (1 lunes … 7 domingo). */
  hoyDia: number;
  dias: readonly DiaRutina[];
  ejercicios: readonly EjercicioRutina[];
  prescrito: readonly Prescrito[];
  /** XP ya pagado hoy por entrenar (sesión y misión enlazada); null si aún no. */
  xpHecho: number | null;
  /** Lo que paga la sesión (GYM_SESSION_XP): «hasta +50 XP». */
  xpSesion: number;
  tecnicaDe?: (nombre: string) => (() => void) | undefined;
  onEmpezar: () => void;
  onReintentar: () => void;
}

export type EstadoDietaHoy =
  | { readonly estado: 'cargando' }
  | { readonly estado: 'error' }
  | {
      readonly estado: 'listo';
      readonly kcal: number | null;
      readonly objetivoKcal: number | null;
      readonly proteina: number | null;
      readonly objetivoProteina: number | null;
      readonly aguaMl: number;
      readonly objetivoAguaMl: number;
    };

export interface AccionesInicioIron {
  onRutinas: () => void;
  onPesos: () => void;
  onCatalogo: () => void;
  onDieta: () => void;
  onCoach: () => void;
}

export interface InicioIronVistaProps {
  cabecera: ReactNode;
  /** «mar 20 oct»; null mientras carga. */
  fecha: string | null;
  /** Las líneas del informe del cierre (Hoy de NIVL), si lo hay. */
  cierre: { alerta: boolean; lineas: readonly string[] } | null;
  entreno: EntradaEntrenoHoy;
  pesos: EstadoPesosIron;
  dieta: EstadoDietaHoy;
  /** La palabra del coach en la tarjeta. */
  coach: string;
  acciones: AccionesInicioIron;
}

const FILAS_HEROE = 3;
const PESOS_EN_INICIO = 3;

/** «4 × 5». */
export function seriesReps(series: number, reps: string | number): string {
  return t('ironmundo:entreno.seriesReps', { series, reps });
}

/** «102,5 kg»; sin carga, «-». */
export function kgFila(kg: number | null): string {
  return kg !== null && kg > 0 ? t('ironmundo:kg', { kg: kgTexto(kg) }) : t('ironmundo:sinCarga');
}

function Entreno({ e, fecha, onRutinas }: { e: EntradaEntrenoHoy; fecha: string | null; onRutinas: () => void }) {
  const rotulo = fecha ? t('ironmundo:entreno.rotuloFecha', { fecha }) : t('ironmundo:entreno.rotulo');
  if (!e.cargado) {
    return e.errorCarga ? (
      <TarjetaIron heroe>
        <RotuloIron texto={rotulo} />
        <Text style={estilosIron.error} maxFontSizeMultiplier={1.6}>
          {e.errorCarga}
        </Text>
        <BotonIron fantasma fino titulo={t('ironmundo:reintentar')} onPress={e.onReintentar} />
      </TarjetaIron>
    ) : (
      <View accessibilityRole="progressbar" accessibilityLabel={t('ironmundo:entreno.cargandoA11y')}>
        <HuecoIron alto={px(212)} />
      </View>
    );
  }

  const hoy = entrenoDeHoy({ dias: e.dias, ejercicios: e.ejercicios, prescrito: e.prescrito, hoyDia: e.hoyDia });

  if (e.xpHecho !== null) {
    return (
      <TarjetaIron heroe>
        <RotuloIron texto={rotulo} em={t('ironmundo:xp', { xp: e.xpHecho })} />
        <View style={styles.hecho}>
          <View style={styles.hechoMarca}>
            <GlifoIron nombre="check" lado={px(16)} color={C.fondo} grosor={2.6} />
          </View>
          <View style={styles.flex}>
            <Text style={estilosIron.titulo} maxFontSizeMultiplier={1.35}>
              {t('ironmundo:entreno.hechoTitulo')}
            </Text>
            <Text style={estilosIron.meta} maxFontSizeMultiplier={1.35}>
              {hoy.dia ? t('ironmundo:entreno.hechoMetaDia', { dia: hoy.dia.name }) : t('ironmundo:entreno.hechoMeta')}
            </Text>
          </View>
        </View>
        <BotonIron fantasma fino titulo={t('ironmundo:entreno.verRutinas')} onPress={onRutinas} />
      </TarjetaIron>
    );
  }

  if (e.dias.length === 0 && hoy.filas.length === 0) {
    return (
      <TarjetaIron heroe>
        <RotuloIron texto={rotulo} />
        <Text style={estilosIron.titulo} maxFontSizeMultiplier={1.35}>
          {t('ironmundo:entreno.sinRutinaTitulo')}
        </Text>
        <Text style={estilosIron.meta} maxFontSizeMultiplier={1.6}>
          {t('ironmundo:entreno.sinRutinaMeta')}
        </Text>
        <BotonIron icono="mas" titulo={t('ironmundo:entreno.crearRutina')} onPress={onRutinas} />
      </TarjetaIron>
    );
  }

  if (hoy.filas.length === 0) {
    return (
      <TarjetaIron heroe>
        <RotuloIron texto={rotulo} />
        <Text style={estilosIron.titulo} maxFontSizeMultiplier={1.35}>
          {hoy.dia ? hoy.dia.name : t('ironmundo:entreno.descansoTitulo')}
        </Text>
        <Text style={estilosIron.meta} maxFontSizeMultiplier={1.6}>
          {hoy.dia ? t('ironmundo:entreno.diaVacio') : t('ironmundo:entreno.descansoMeta')}
        </Text>
        <BotonIron fantasma fino titulo={t('ironmundo:entreno.verRutinas')} onPress={onRutinas} />
      </TarjetaIron>
    );
  }

  const visibles = hoy.filas.slice(0, FILAS_HEROE);
  return (
    <TarjetaIron heroe>
      <RotuloIron texto={rotulo} em={t('ironmundo:hastaXp', { xp: e.xpSesion })} />
      <Text style={estilosIron.titulo} accessibilityRole="header" maxFontSizeMultiplier={1.35} numberOfLines={2}>
        {hoy.dia?.name ?? t('ironmundo:entreno.delCoach')}
      </Text>
      <Text style={estilosIron.meta} maxFontSizeMultiplier={1.35}>
        {t('ironmundo:entreno.meta', { count: hoy.filas.length, series: hoy.series, minutos: hoy.minutos })}
      </Text>
      <View style={styles.filas}>
        {visibles.map((f, i) => (
          <FilaIron
            key={f.clave}
            primera={i === 0}
            onPress={e.tecnicaDe?.(f.nombre)}
            accessibilityLabel={t('ironmundo:entreno.filaA11y', { nombre: f.nombre, series: f.series, reps: f.reps, kg: kgFila(f.kg) })}
          >
            <Text style={estilosIron.filaNombre} numberOfLines={1} maxFontSizeMultiplier={1.35}>
              {f.nombre}
            </Text>
            <Text style={[estilosIron.filaSerie, styles.colSerie]} maxFontSizeMultiplier={1.35}>
              {seriesReps(f.series, f.reps)}
            </Text>
            <Text style={[estilosIron.filaKg, styles.colKg]} maxFontSizeMultiplier={1.35}>
              {kgFila(f.kg)}
            </Text>
          </FilaIron>
        ))}
      </View>
      <BotonIron icono="pesa" titulo={t('ironmundo:entreno.empezar')} onPress={e.onEmpezar} />
    </TarjetaIron>
  );
}

/** «▲ 7,5 en 6 sem» o «▼ 2,5 en 6 sem». */
export function subidaCorta(kg: number): string {
  return kg >= 0 ? t('ironmundo:pesos.sube', { kg: kgTexto(kg) }) : t('ironmundo:pesos.baja', { kg: kgTexto(-kg) });
}

function TarjetaPeso({ p }: { p: PesoIron }) {
  return (
    <TarjetaIron
      style={styles.peso}
      onPress={p.onTecnica}
      accessibilityLabel={[
        t('ironmundo:pesos.a11y', { nombre: p.nombre, kg: kgTexto(p.kg) }),
        p.record ? t('ironmundo:pesos.record') : null,
        p.subida !== null ? subidaCorta(p.subida) : null,
      ]
        .filter(Boolean)
        .join('. ')}
    >
      <Text style={styles.pesoNombre} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {p.nombre}
      </Text>
      <Text style={estilosIron.kg} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1}>
        {kgTexto(p.kg)}
        <Text style={estilosIron.kgUnidad}>{` ${t('ironmundo:unidadKg')}`}</Text>
      </Text>
      <View style={styles.pesoDelta}>
        {p.record ? (
          <Text style={estilosIron.etiqueta} maxFontSizeMultiplier={1.2}>
            {t('ironmundo:pesos.record').toUpperCase()}
          </Text>
        ) : p.subida !== null ? (
          <Text style={estilosIron.delta} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {subidaCorta(p.subida)}
          </Text>
        ) : (
          <Text style={[estilosIron.delta, styles.deltaMudo]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {t('ironmundo:pesos.sesiones', { count: p.sesiones })}
          </Text>
        )}
      </View>
      <View style={styles.pesoLinea}>
        <LineaAncha puntos={p.serie} alto={px(18)} />
      </View>
    </TarjetaIron>
  );
}

function Pesos({ estado, onPesos }: { estado: EstadoPesosIron; onPesos: () => void }) {
  if (estado.estado === 'cargando') {
    return (
      <View style={styles.pesos} accessibilityRole="progressbar" accessibilityLabel={t('ironmundo:pesos.cargandoA11y')}>
        {[0, 1, 2].map((i) => (
          <HuecoIron key={i} alto={px(96)} style={styles.peso} />
        ))}
      </View>
    );
  }
  if (estado.estado === 'error') {
    return (
      <TarjetaIron>
        <Text style={estilosIron.cuerpo} maxFontSizeMultiplier={1.6}>
          {estado.mensaje}
        </Text>
        <BotonIron fantasma fino titulo={t('ironmundo:reintentar')} onPress={estado.reintentar} />
      </TarjetaIron>
    );
  }
  if (estado.filas.length === 0) {
    return (
      <TarjetaIron onPress={onPesos} accessibilityLabel={t('ironmundo:pesos.vacio')}>
        <Text style={estilosIron.cuerpo} maxFontSizeMultiplier={1.6}>
          {t('ironmundo:pesos.vacio')}
        </Text>
      </TarjetaIron>
    );
  }
  return (
    <View style={styles.pesos}>
      {estado.filas.slice(0, PESOS_EN_INICIO).map((p) => (
        <TarjetaPeso key={p.clave} p={p} />
      ))}
    </View>
  );
}

function Rutinas({ e, onRutinas }: { e: EntradaEntrenoHoy; onRutinas: () => void }) {
  if (!e.cargado) return null;
  return (
    <View>
      <RotuloIron seccion texto={t('ironmundo:rutinas.rotulo')} em={e.dias.length > 0 ? String(e.dias.length) : undefined} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {[...e.dias]
          .sort((a, b) => a.day_of_week - b.day_of_week)
          .map((d) => (
            <ChipIron
              key={d.id}
              texto={d.name}
              activo={d.day_of_week === e.hoyDia}
              onPress={onRutinas}
              accessibilityLabel={d.day_of_week === e.hoyDia ? t('ironmundo:rutinas.hoyA11y', { dia: d.name }) : d.name}
            />
          ))}
        <ChipIron nuevo texto={t('ironmundo:rutinas.nueva')} onPress={onRutinas} accessibilityLabel={t('ironmundo:rutinas.nuevaA11y')} />
      </ScrollView>
    </View>
  );
}

function Catalogo({ onCatalogo }: { onCatalogo: () => void }) {
  return (
    <TarjetaIron style={styles.mitad}>
      <RotuloIron texto={t('ironmundo:catalogo.anadir')} />
      <View style={styles.catalogo}>
        <CuadroIron lado={px(44)}>
          <FiguraSentadilla lado={px(40)} color={A} suelo={C.suelo} />
        </CuadroIron>
        <Text style={[estilosIron.detalle, styles.flex]} maxFontSizeMultiplier={1.35}>
          {t('ironmundo:catalogo.cuerpo')}
        </Text>
      </View>
      <BotonIron fantasma fino titulo={t('ironmundo:catalogo.boton')} onPress={onCatalogo} style={styles.botonCatalogo} />
    </TarjetaIron>
  );
}

function Dieta({ dieta, onDieta }: { dieta: EstadoDietaHoy; onDieta: () => void }) {
  const listo = dieta.estado === 'listo' ? dieta : null;
  const ratio = listo && listo.kcal !== null && listo.objetivoKcal ? listo.kcal / listo.objetivoKcal : 0;
  const pct = listo && listo.objetivoKcal && listo.kcal !== null ? Math.round(ratio * 100) : null;
  const barras = listo
    ? [
        { nombre: t('ironmundo:dieta.calorias'), r: ratio },
        { nombre: t('ironmundo:dieta.proteina'), r: listo.proteina !== null && listo.objetivoProteina ? listo.proteina / listo.objetivoProteina : 0 },
        { nombre: t('ironmundo:dieta.agua'), r: listo.objetivoAguaMl ? listo.aguaMl / listo.objetivoAguaMl : 0 },
      ]
    : [];
  return (
    <TarjetaIron
      style={styles.mitad}
      onPress={onDieta}
      accessibilityLabel={
        listo
          ? t('ironmundo:dieta.a11y', {
              kcal: listo.kcal === null ? t('ironmundo:sinDato') : miles(listo.kcal),
              objetivo: listo.objetivoKcal === null ? t('ironmundo:sinDato') : miles(listo.objetivoKcal),
            })
          : t('ironmundo:dieta.rotulo')
      }
    >
      <RotuloIron texto={t('ironmundo:dieta.rotulo')} em={pct !== null ? t('ironmundo:pct', { pct }) : undefined} />
      <View style={styles.dieta}>
        <AnilloIron
          ratio={ratio}
          lado={px(54)}
          valor={listo && listo.kcal !== null ? miles(listo.kcal) : t('ironmundo:sinDato')}
          unidad={t('ironmundo:unidadKcal')}
        />
        <View style={styles.flex}>
          {dieta.estado === 'cargando' ? (
            <HuecoIron alto={px(40)} />
          ) : dieta.estado === 'error' ? (
            <Text style={estilosIron.detalle} maxFontSizeMultiplier={1.35}>
              {t('ironmundo:dieta.abrir')}
            </Text>
          ) : (
            barras.map((b) => (
              <View key={b.nombre} style={styles.macro}>
                <Text style={styles.macroNombre} maxFontSizeMultiplier={1.2}>
                  {b.nombre}
                </Text>
                <BarraIron ratio={b.r} style={styles.macroBarra} />
              </View>
            ))
          )}
        </View>
      </View>
    </TarjetaIron>
  );
}

export function InicioIronVista({ cabecera, fecha, cierre, entreno, pesos, dieta, coach, acciones }: InicioIronVistaProps) {
  return (
    <PantallaIron>
      {cabecera}

      {cierre ? (
        <TarjetaIron>
          <RotuloIron texto={cierre.alerta ? t('ironmundo:cierre.alerta') : t('ironmundo:cierre.informe')} />
          {cierre.lineas.map((l) => (
            <Text key={l} style={[estilosIron.cuerpo, styles.linea]} maxFontSizeMultiplier={1.6}>
              {l}
            </Text>
          ))}
        </TarjetaIron>
      ) : null}

      <Entreno e={entreno} fecha={fecha} onRutinas={acciones.onRutinas} />

      <View>
        <RotuloIron
          seccion
          texto={t('ironmundo:pesos.rotulo')}
          em={t('ironmundo:verTodo')}
          onEm={acciones.onPesos}
          emA11y={t('ironmundo:pesos.verTodoA11y')}
        />
        <Pesos estado={pesos} onPesos={acciones.onPesos} />
      </View>

      <Rutinas e={entreno} onRutinas={acciones.onRutinas} />

      <View style={styles.dos}>
        <Catalogo onCatalogo={acciones.onCatalogo} />
        <Dieta dieta={dieta} onDieta={acciones.onDieta} />
      </View>

      <CoachIron mensaje={coach} onAbrir={acciones.onCoach} />
    </PantallaIron>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  filas: { marginTop: px(6) },
  colSerie: { width: px(44), textAlign: 'center' },
  colKg: { minWidth: px(60), textAlign: 'right' },
  hecho: { flexDirection: 'row', alignItems: 'center', gap: px(10), marginTop: px(4) },
  hechoMarca: { width: px(28), height: px(28), borderRadius: px(14), backgroundColor: A, alignItems: 'center', justifyContent: 'center' },
  pesos: { flexDirection: 'row', gap: px(7) },
  peso: { flex: 1, minWidth: 0, borderRadius: px(13), paddingVertical: px(8), paddingHorizontal: px(9) },
  pesoNombre: { fontFamily: F.sb, fontSize: fs(9), color: C.meta },
  pesoDelta: { marginTop: px(1), minHeight: px(13), justifyContent: 'center' },
  deltaMudo: { color: C.mudo },
  pesoLinea: { marginTop: px(4) },
  chips: { gap: px(6), paddingRight: px(2) },
  dos: { flexDirection: 'row', gap: px(7) },
  mitad: { flex: 1, minWidth: 0, paddingVertical: px(9), paddingHorizontal: px(10) },
  catalogo: { flexDirection: 'row', alignItems: 'center', gap: px(8), marginTop: px(6) },
  botonCatalogo: { marginTop: px(7) },
  dieta: { flexDirection: 'row', alignItems: 'center', gap: px(9), marginTop: px(6) },
  macro: { marginBottom: px(5) },
  macroNombre: { fontFamily: F.sb, fontSize: fs(8.5), color: C.meta },
  macroBarra: { marginTop: px(2) },
  linea: { marginTop: px(4) },
});

