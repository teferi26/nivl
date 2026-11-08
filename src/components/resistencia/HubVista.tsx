// NIVL · Resistencia: el hub (puro). Todo llega por props (useHub o la galería).
//
// De arriba abajo: cuenta atrás de la carrera, lo que toca hoy con la única
// acción sólida («Registrar entreno»), cuándo salir, la forma y los últimos
// entrenos. Con dolor marcado hoy, la tarjeta de cuándo salir se sustituye por
// la derivación a un profesional: nunca se propone una hora.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TarjetaHueco } from '@/components/ironmundo/Esqueletos';
import { GlifoIron } from '@/components/ironmundo/Glifos';
import { Entrada, ErrorSistema } from '@/components/arena';
import { BotonIron, CuadroIron, FilaIron, PantallaIron, TarjetaIron } from '@/components/ironmundo/piezas';
import { C, F, fs, px } from '@/components/ironmundo/tema';
import { fechaIron } from '@/components/ironmundo/textos';
import { Grano } from '@/components/ui';
import { useAnunciar } from '@/components/ui/useAnunciar';
import { t } from '@/i18n';
import { decimal, miles } from '@/i18n/formato';
import type { EstadoForma } from '@/lib/cargamath';
import type { DeporteEntreno } from '@/lib/entrenoMedido';
import { formatoRitmo, ritmoSeg100m, ritmoSegKm, velocidadKmh } from '@/lib/entrenomath';
import { dolorVigente, mejorVentana, type ContextoSalida, type HoraClima, type VeredictoSalida, type Ventana } from '@/lib/mejorHora';
import type { Bienestar, EntrenoFila, ObjetivoCarrera, PlanSesionFila } from '@/lib/resistencia';
import { estilosIron, RotuloIron } from './piezas';
import { detalleSesion, tituloSesion } from './textosPlan';

// ── Textos que salen de los datos ────────────────────────────────────

export const ICONO_DEPORTE: Record<DeporteEntreno, keyof typeof Ionicons.glyphMap> = {
  carrera: 'walk-outline',
  bici: 'bicycle-outline',
  piscina: 'water-outline',
  aguas_abiertas: 'boat-outline',
  caminar: 'footsteps-outline',
  fuerza: 'barbell-outline',
  otro: 'pulse-outline',
};

export const etiquetaDeporte = (d: DeporteEntreno) => t(`resistencia:deporte.${d}`);

/** «52:10» o «1:02:33». */
export function duracionTexto(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

const esNatacion = (d: DeporteEntreno) => d === 'piscina' || d === 'aguas_abiertas';

/** «10,2 km»; en natación, «1.500 m». Sin distancia, null. */
export function distanciaTexto(metros: number | null, deporte: DeporteEntreno): string | null {
  if (metros === null || metros <= 0) return null;
  return esNatacion(deporte)
    ? t('resistencia:unidad.m', { valor: miles(Math.round(metros)) })
    : t('resistencia:unidad.km', { valor: decimal(metros / 1000, 2) });
}

/** Lo que cada deporte mira: ritmo por km, velocidad o ritmo por 100 m. */
export function ritmoTexto(deporte: DeporteEntreno, metros: number | null, segundos: number): string | null {
  if (deporte === 'bici') {
    const v = velocidadKmh(metros, segundos);
    return v === null ? null : t('resistencia:unidad.kmh', { valor: decimal(v, 1) });
  }
  if (esNatacion(deporte)) {
    const r = formatoRitmo(ritmoSeg100m(metros, segundos));
    return r === null ? null : t('resistencia:unidad.por100', { ritmo: r });
  }
  if (deporte === 'carrera' || deporte === 'caminar') {
    const r = formatoRitmo(ritmoSegKm(metros, segundos));
    return r === null ? null : t('resistencia:unidad.porKm', { ritmo: r });
  }
  return null;
}

export function resumenEntreno(e: Pick<EntrenoFila, 'deporte' | 'distancia_m' | 'duracion_s'>): string {
  return [distanciaTexto(e.distancia_m, e.deporte), duracionTexto(e.duracion_s), ritmoTexto(e.deporte, e.distancia_m, e.duracion_s)]
    .filter(Boolean)
    .join(' · ');
}

/** Días enteros de `desde` a `hasta` (AAAA-MM-DD), sin pasar por el cambio de hora. */
export function diasHasta(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);
}

const CLAVES_MOTIVO = [
  'tormenta',
  'hielo',
  'nieve',
  'niebla',
  'calor_extremo',
  'frio_extremo',
  'calor',
  'frio',
  'lluvia',
  'lluvia_posible',
  'lluvia_fuerte',
  'viento_peligro',
  'viento',
  'noche',
  'uv',
  'buen_tiempo',
] as const;
type ClaveMotivo = (typeof CLAVES_MOTIVO)[number];
const esMotivo = (m: string): m is ClaveMotivo => (CLAVES_MOTIVO as readonly string[]).includes(m);

const CLAVES_SUAVE = ['forma_riesgo', 'poco_sueno', 'fatiga'] as const;
type ClaveSuave = (typeof CLAVES_SUAVE)[number];
const esSuave = (m: string): m is ClaveSuave => (CLAVES_SUAVE as readonly string[]).includes(m);

// ── Cuándo salir ─────────────────────────────────────────────────────

export type SalidaHub =
  | { estado: 'cargando' }
  /** Hay dolor vigente: se deriva y no se calcula nada más. */
  | { estado: 'derivar'; zona: string | null }
  | { estado: 'sin_ubicacion' }
  | { estado: 'sin_prevision'; ciudad: string }
  /** Lo de hoy no depende del tiempo (piscina, fuerza, descanso). */
  | { estado: 'no_aplica'; ciudad: string }
  | { estado: 'hecho'; ciudad: string }
  | { estado: 'veredicto'; ciudad: string; veredicto: VeredictoSalida };

export type SesionHub = Pick<PlanSesionFila, 'id' | 'disciplina' | 'titulo' | 'detalle' | 'duracion_min' | 'zona' | 'clave' | 'hecha_entreno_id' | 'nota_coach'>;

export interface EntradaSalida {
  hoy: string;
  /** HH:MM de ahora: no se recomienda el pasado. */
  ahora: string;
  bienestar: Pick<Bienestar, 'dolor' | 'dolor_zona' | 'sueno_h' | 'fatiga'> | null;
  /** Los partes de los últimos días. Con ellos, el dolor sigue la regla del coach. */
  partes?: readonly Pick<Bienestar, 'fecha' | 'dolor' | 'dolor_zona'>[];
  /** Hasta qué hora se puede salir; sin dato, las 22:00. */
  hasta?: string;
  /** La ciudad consentida; null si no hay. */
  ciudad: string | null;
  sesiones: readonly Pick<SesionHub, 'disciplina' | 'duracion_min' | 'hecha_entreno_id'>[];
  /** undefined: aún se está pidiendo. null: no ha llegado. */
  horas: readonly HoraClima[] | null | undefined;
  estadoForma: string;
  ocupadas: ContextoSalida['franjas_ocupadas'];
}

const HASTA_SALIDA = '22:00';
const DURACION_SIN_PLAN = 60;

function disciplinaSalida(d: SesionHub['disciplina']): ContextoSalida['disciplina'] | null {
  switch (d) {
    case 'carrera':
      return 'carrera';
    // El brick lleva bici: manda lo que más exige al tiempo.
    case 'bici':
    case 'brick':
      return 'bici';
    case 'transicion':
      return 'otro';
    case 'natacion':
    case 'fuerza':
    case 'descanso':
      return null;
  }
}

/** El dolor va primero y no depende de ningún otro dato: ni de la ciudad ni de la previsión. */
export function construirSalida(e: EntradaSalida): SalidaHub {
  const dolor = e.partes ? dolorVigente(e.partes, e.hoy) : e.bienestar?.dolor ? e.bienestar : null;
  if (dolor) return { estado: 'derivar', zona: dolor.dolor_zona };
  if (!e.ciudad) return { estado: 'sin_ubicacion' };
  const pendientes = e.sesiones.filter((s) => !s.hecha_entreno_id);
  if (e.sesiones.length > 0 && pendientes.length === 0) return { estado: 'hecho', ciudad: e.ciudad };
  const exterior = pendientes.find((s) => disciplinaSalida(s.disciplina) !== null);
  if (pendientes.length > 0 && !exterior) return { estado: 'no_aplica', ciudad: e.ciudad };
  if (e.horas === undefined) return { estado: 'cargando' };
  const horasHoy = (e.horas ?? []).filter((h) => h.hora.startsWith(e.hoy));
  if (horasHoy.length === 0) return { estado: 'sin_prevision', ciudad: e.ciudad };
  const veredicto = mejorVentana(horasHoy, {
    disciplina: exterior ? disciplinaSalida(exterior.disciplina)! : 'otro',
    duracion_min: exterior?.duracion_min ?? DURACION_SIN_PLAN,
    estado_forma: e.estadoForma,
    sueno_h: e.bienestar?.sueno_h ?? null,
    fatiga: e.bienestar?.fatiga ?? null,
    dolor: false,
    franjas_ocupadas: e.ocupadas,
    desde: e.ahora,
    hasta: e.hasta ?? HASTA_SALIDA,
  });
  return { estado: 'veredicto', ciudad: e.ciudad, veredicto };
}

function climaTexto(v: Ventana): string {
  return [
    v.clima.temp !== null ? t('resistencia:salida.temp', { valor: v.clima.temp }) : null,
    v.clima.lluvia_prob !== null ? t('resistencia:salida.lluvia', { valor: v.clima.lluvia_prob }) : null,
    v.clima.viento_kmh !== null ? t('resistencia:salida.viento', { valor: Math.round(v.clima.viento_kmh) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

const horaDe = (iso: string) => iso.slice(11, 16);

function motivosTexto(v: Ventana): string {
  return v.motivos
    .filter(esMotivo)
    .slice(0, 2)
    .map((m) => t(`resistencia:motivo.${m}`))
    .join(' · ');
}

function fraseVeredicto(v: VeredictoSalida): { titulo: string; detalle: string | null; ventana: Ventana | null } {
  switch (v.tipo) {
    case 'salir':
      return { titulo: t('resistencia:salida.salir', { hora: horaDe(v.ventana.inicio) }), detalle: motivosTexto(v.ventana) || null, ventana: v.ventana };
    case 'suave':
      return {
        titulo: t('resistencia:salida.suave', { hora: horaDe(v.ventana.inicio) }),
        detalle: esSuave(v.motivo) ? t(`resistencia:salida.motivoSuave.${v.motivo}`) : null,
        ventana: v.ventana,
      };
    case 'descanso':
      return { titulo: t('resistencia:salida.descanso'), detalle: t(`resistencia:salida.motivoDescanso.${v.motivo}`), ventana: null };
    case 'sin_ventana':
      return { titulo: t('resistencia:salida.sinVentana'), detalle: t(`resistencia:salida.motivoSinVentana.${v.motivo}`), ventana: null };
  }
}

function TarjetaSalida({ s, onUbicacion }: { s: Exclude<SalidaHub, { estado: 'derivar' }>; onUbicacion: () => void }) {
  if (s.estado === 'cargando') return <TarjetaHueco lineas={3} />;
  if (s.estado === 'sin_ubicacion') {
    return (
      <TarjetaIron>
        <RotuloIron texto={t('resistencia:salida.rotulo')} />
        <Text style={[estilosIron.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.6}>
          {t('resistencia:salida.sinUbicacion')}
        </Text>
        <BotonIron fantasma fino titulo={t('resistencia:salida.indicarCiudad')} onPress={onUbicacion} />
      </TarjetaIron>
    );
  }
  const frase =
    s.estado === 'veredicto'
      ? fraseVeredicto(s.veredicto)
      : { titulo: t(`resistencia:salida.estado.${s.estado}`), detalle: null, ventana: null };
  return (
    <TarjetaIron>
      <RotuloIron texto={t('resistencia:salida.rotulo')} em={s.ciudad.split(',')[0]} onEm={onUbicacion} emA11y={t('resistencia:salida.cambiarCiudadA11y', { ciudad: s.ciudad })} />
      <Text style={estilosIron.titulo} maxFontSizeMultiplier={1.35}>
        {frase.titulo}
      </Text>
      {frase.detalle ? (
        <Text style={estilosIron.meta} maxFontSizeMultiplier={1.6}>
          {frase.detalle}
        </Text>
      ) : null}
      {frase.ventana ? (
        <Text style={estilosIron.detalle} maxFontSizeMultiplier={1.35}>
          {climaTexto(frase.ventana)}
        </Text>
      ) : null}
    </TarjetaIron>
  );
}

function TarjetaDerivacion({ zona, onBienestar }: { zona: string | null; onBienestar: () => void }) {
  return (
    <TarjetaIron style={styles.derivacion}>
      <RotuloIron texto={t('resistencia:derivacion.rotulo')} />
      <Text style={estilosIron.titulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
        {t('resistencia:derivacion.titulo')}
      </Text>
      {zona ? (
        <Text style={estilosIron.meta} maxFontSizeMultiplier={1.6}>
          {t('resistencia:derivacion.zona', { zona })}
        </Text>
      ) : null}
      <Text style={[estilosIron.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.6}>
        {t('resistencia:derivacion.cuerpo')}
      </Text>
      <BotonIron fantasma fino titulo={t('resistencia:derivacion.actualizar')} onPress={onBienestar} />
    </TarjetaIron>
  );
}

// ── La vista ─────────────────────────────────────────────────────────

export interface FormaHub {
  estado: EstadoForma;
  ctl: number;
  atl: number;
  tsb: number;
}

export interface AccionesHub {
  onVolver: () => void;
  onReintentar: () => void;
  onRefrescar: () => void;
  onRegistrar: () => void;
  onUbicacion: () => void;
  onBienestar: () => void;
  onCarrera: () => void;
  onProgreso: () => void;
  onEntreno: (id: string) => void;
  onCerrarAnuncio: () => void;
}

export interface HubVistaProps {
  cargado: boolean;
  errorCarga: string | null;
  refrescando: boolean;
  hoy: string;
  objetivo: Pick<ObjetivoCarrera, 'tipo' | 'nombre' | 'fecha'> | null;
  /** Las sesiones del plan de hoy, las pendientes y clave primero. */
  sesiones: readonly SesionHub[];
  salida: SalidaHub;
  bienestar: Pick<Bienestar, 'sueno_h' | 'fatiga'> | null;
  forma: FormaHub;
  entrenos: readonly EntrenoFila[];
  /** Lo que ha pagado y los récords del último registro. */
  anuncio: string | null;
  /** El anuncio trae un récord: se pinta con grano. */
  anuncioLogro?: boolean;
  acciones: AccionesHub;
}

export function CabeceraResistencia({ titulo, subtitulo, onVolver }: { titulo: string; subtitulo?: string; onVolver: () => void }) {
  return (
    <View style={styles.cabecera}>
      <Pressable onPress={onVolver} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('ironmundo:volver')} style={styles.atras}>
        <GlifoIron nombre="atras" lado={px(18)} color={C.mudo} grosor={2.2} />
      </Pressable>
      <View style={styles.flex}>
        <Text style={styles.titulo} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {titulo}
        </Text>
        {subtitulo ? (
          <Text style={styles.subtitulo} numberOfLines={1} maxFontSizeMultiplier={1.35}>
            {subtitulo}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function CifraResistencia({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <View style={styles.cifra} accessible accessibilityLabel={t('ironmundo:par', { a: rotulo, b: valor })}>
      <Text style={styles.cifraValor} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1}>
        {valor}
      </Text>
      <Text style={styles.cifraRotulo} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {rotulo}
      </Text>
    </View>
  );
}

function TarjetaCarrera({ p }: { p: HubVistaProps }) {
  const o = p.objetivo;
  const dias = o ? diasHasta(p.hoy, o.fecha) : null;
  if (o && dias !== null && dias < 0) {
    return (
      <TarjetaIron onPress={p.acciones.onCarrera} accessibilityLabel={t('resistencia:carrera.cumplida')}>
        <RotuloIron texto={t('resistencia:carrera.rotulo')} em={t('resistencia:carrera.elegir')} />
        <Text style={[estilosIron.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.6}>
          {t('resistencia:carrera.cumplida')}
        </Text>
      </TarjetaIron>
    );
  }
  if (!o || dias === null) {
    return (
      <TarjetaIron onPress={p.acciones.onCarrera} accessibilityLabel={t('resistencia:carrera.sinObjetivo')}>
        <RotuloIron texto={t('resistencia:carrera.rotulo')} em={t('resistencia:carrera.preparar')} />
        <Text style={[estilosIron.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.6}>
          {t('resistencia:carrera.sinObjetivo')}
        </Text>
      </TarjetaIron>
    );
  }
  const nombre = o.nombre ?? t(`resistencia:prueba.${o.tipo}`);
  return (
    <TarjetaIron
      onPress={p.acciones.onCarrera}
      accessibilityLabel={dias === 0 ? t('resistencia:carrera.hoyA11y', { nombre }) : t('resistencia:carrera.faltanA11y', { count: dias, nombre })}
    >
      <RotuloIron texto={t('resistencia:carrera.rotulo')} em={fechaIron(o.fecha)} />
      <Text style={estilosIron.titulo} numberOfLines={1} maxFontSizeMultiplier={1.35}>
        {dias === 0 ? t('resistencia:carrera.hoy') : t('resistencia:carrera.faltan', { count: dias })}
      </Text>
      <Text style={estilosIron.meta} numberOfLines={1} maxFontSizeMultiplier={1.35}>
        {nombre}
      </Text>
    </TarjetaIron>
  );
}

function FilaSesion({ s, primera }: { s: SesionHub; primera: boolean }) {
  const hecha = !!s.hecha_entreno_id;
  const meta = [
    s.disciplina === 'descanso' || s.duracion_min === 0 ? null : t('resistencia:unidad.min', { valor: s.duracion_min }),
    s.zona ? t(`resistenciaPlan:zona.${s.zona}`) : null,
    s.clave ? t('resistencia:hoyToca.clave') : null,
    hecha ? t('resistencia:hoyToca.hecha') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <FilaIron primera={primera} style={styles.filaSesion}>
      <View style={styles.flex}>
        <Text style={[estilosIron.filaNombre, hecha && styles.hecha]} maxFontSizeMultiplier={1.35}>
          {tituloSesion(s.titulo)}
        </Text>
        <Text style={estilosIron.detalle} maxFontSizeMultiplier={1.35}>
          {meta}
        </Text>
        {s.detalle ? (
          <Text style={estilosIron.detalle} numberOfLines={3} maxFontSizeMultiplier={1.6}>
            {detalleSesion(s.detalle)}
          </Text>
        ) : null}
        {s.nota_coach ? (
          <Text style={[estilosIron.detalle, styles.notaCoach]} maxFontSizeMultiplier={1.6}>
            {t('resistencia:hoyToca.notaCoach', { nota: s.nota_coach })}
          </Text>
        ) : null}
      </View>
    </FilaIron>
  );
}

function TarjetaHoy({ p }: { p: HubVistaProps }) {
  return (
    <TarjetaIron heroe>
      <RotuloIron texto={t('resistencia:hoyToca.rotulo')} />
      {p.sesiones.length === 0 ? (
        <Text style={estilosIron.titulo} maxFontSizeMultiplier={1.35}>
          {p.objetivo ? t('resistencia:hoyToca.libre') : t('resistencia:hoyToca.sinPlan')}
        </Text>
      ) : (
        <View style={styles.filas}>
          {p.sesiones.map((s, i) => (
            <FilaSesion key={s.id} s={s} primera={i === 0} />
          ))}
        </View>
      )}
      {/* Con dolor, lo único destacado es la derivación; apuntar lo ya hecho sigue a mano. */}
      <BotonIron icono="mas" fantasma={p.salida.estado === 'derivar'} titulo={t('resistencia:hub.registrar')} onPress={p.acciones.onRegistrar} />
    </TarjetaIron>
  );
}

function TarjetaForma({ p }: { p: HubVistaProps }) {
  const f = p.forma;
  return (
    <TarjetaIron>
      <RotuloIron texto={t('resistencia:forma.rotulo')} em={t('resistencia:forma.progreso')} onEm={p.acciones.onProgreso} emA11y={t('resistencia:forma.progresoA11y')} />
      <Text style={estilosIron.titulo} maxFontSizeMultiplier={1.35}>
        {t(`resistencia:forma.estado.${f.estado}`)}
      </Text>
      <Text style={estilosIron.meta} maxFontSizeMultiplier={1.6}>
        {t(`resistencia:forma.detalle.${f.estado}`)}
      </Text>
    </TarjetaIron>
  );
}

function FilaEntreno({ e, primera, onPress }: { e: EntrenoFila; primera: boolean; onPress: () => void }) {
  const resumen = resumenEntreno(e);
  const nombre = etiquetaDeporte(e.deporte);
  const fecha = fechaIron(e.fecha);
  return (
    <FilaIron primera={primera} onPress={onPress} style={styles.filaEntreno} accessibilityLabel={t('resistencia:hub.entrenoA11y', { nombre, resumen, fecha })}>
      <CuadroIron lado={px(32)} radio={0}>
        <Ionicons name={ICONO_DEPORTE[e.deporte]} size={20} color={C.blanco} />
      </CuadroIron>
      <View style={styles.flex}>
        <Text style={estilosIron.filaNombre} numberOfLines={1} maxFontSizeMultiplier={1.35}>
          {nombre}
        </Text>
        <Text style={estilosIron.filaSerie} numberOfLines={2} maxFontSizeMultiplier={1.35}>
          {resumen}
        </Text>
      </View>
      <Text style={estilosIron.filaSerie} maxFontSizeMultiplier={1.35}>
        {fecha}
      </Text>
    </FilaIron>
  );
}

function bienestarTexto(b: HubVistaProps['bienestar']): string {
  if (!b || (b.sueno_h === null && b.fatiga === null)) return t('resistencia:bienestar.abrir');
  return [
    b.sueno_h !== null ? t('resistencia:bienestar.resumenSueno', { valor: decimal(b.sueno_h, 1) }) : null,
    b.fatiga !== null ? t('resistencia:bienestar.resumenFatiga', { valor: b.fatiga }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function HubVista(p: HubVistaProps) {
  useAnunciar(p.anuncio);
  const cabecera = <CabeceraResistencia titulo={t('resistencia:hub.titulo')} onVolver={p.acciones.onVolver} />;
  if (!p.cargado) {
    return (
      <PantallaIron>
        {cabecera}
        {p.errorCarga ? (
          <ErrorSistema compacto mensaje={p.errorCarga} onReintentar={p.acciones.onReintentar} />
        ) : (
          <View style={styles.pila} accessibilityRole="progressbar" accessibilityLabel={t('resistencia:hub.cargandoA11y')}>
            <TarjetaHueco lineas={2} />
            <TarjetaHueco heroe lineas={4} />
            <TarjetaHueco lineas={3} />
            <TarjetaHueco lineas={4} />
          </View>
        )}
      </PantallaIron>
    );
  }
  let salida: ReactNode;
  if (p.salida.estado === 'derivar') salida = <TarjetaDerivacion zona={p.salida.zona} onBienestar={p.acciones.onBienestar} />;
  else {
    salida = (
      <>
        <TarjetaSalida s={p.salida} onUbicacion={p.acciones.onUbicacion} />
        <BotonIron fantasma fino titulo={bienestarTexto(p.bienestar)} accessibilityLabel={t('resistencia:bienestar.abrirA11y')} onPress={p.acciones.onBienestar} style={styles.sinMargen} />
      </>
    );
  }
  return (
    <PantallaIron refreshing={p.refrescando} onRefresh={p.acciones.onRefrescar}>
      {cabecera}
      {p.errorCarga ? <ErrorSistema compacto mensaje={p.errorCarga} onReintentar={p.acciones.onReintentar} /> : null}
      {p.anuncio ? (
        <Entrada>
          <TarjetaIron onPress={p.acciones.onCerrarAnuncio} accessibilityLabel={p.anuncio}>
            {p.anuncioLogro ? <Grano /> : null}
            <RotuloIron texto={t('resistencia:hub.anuncio')} em={t('ironmundo:cerrar')} />
            <Text style={[estilosIron.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.6}>
              {p.anuncio}
            </Text>
          </TarjetaIron>
        </Entrada>
      ) : null}
      {p.salida.estado === 'derivar' ? salida : null}
      <TarjetaCarrera p={p} />
      <TarjetaHoy p={p} />
      {p.salida.estado === 'derivar' ? null : salida}
      <TarjetaForma p={p} />
      <View>
        <RotuloIron seccion texto={t('resistencia:hub.ultimos')} />
        <TarjetaIron>
          {p.entrenos.length === 0 ? (
            <Text style={estilosIron.cuerpo} maxFontSizeMultiplier={1.6}>
              {t('resistencia:hub.vacio')}
            </Text>
          ) : (
            p.entrenos.map((e, i) => <FilaEntreno key={e.id} e={e} primera={i === 0} onPress={() => p.acciones.onEntreno(e.id)} />)
          )}
        </TarjetaIron>
      </View>
    </PantallaIron>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pila: { gap: px(7) },
  arriba: { marginTop: px(5) },
  sinMargen: { marginTop: 0 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: px(8), paddingVertical: px(6) },
  atras: { paddingVertical: px(4) },
  titulo: { fontFamily: F.cinzel, fontSize: fs(16), letterSpacing: fs(16) * 0.08, color: C.blanco, textTransform: 'uppercase' },
  subtitulo: { fontFamily: F.r, fontSize: fs(10), color: C.meta, marginTop: px(1) },
  filas: { marginTop: px(4) },
  filaSesion: { paddingVertical: px(6) },
  filaEntreno: { paddingVertical: px(7) },
  hecha: { color: C.mudo, textDecorationLine: 'line-through' },
  notaCoach: { marginTop: px(3), color: C.claro },
  derivacion: { borderColor: C.blanco, borderWidth: 2 },
  cifra: { flex: 1, minWidth: 0, backgroundColor: C.tarjeta, borderWidth: 1, borderColor: C.filete, padding: px(8) },
  cifraValor: { fontFamily: F.xb, fontSize: fs(19), color: C.blanco },
  cifraRotulo: { fontFamily: F.b, fontSize: fs(9.5), letterSpacing: fs(9.5) * 0.14, color: C.mudo, textTransform: 'uppercase', marginTop: px(1) },
});
