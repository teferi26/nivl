// NIVL · WORK: Hoy, el centro de mando del trabajo. Pura: todo llega por props.
//
// De arriba abajo (maqueta Ónix): el héroe de la semana sin escudo, el coach, la
// tarjeta Ahora (qué atacar y un solo botón; sin plan, pide las prioridades), tres
// cifras, qué soltar, las prioridades, lo siguiente de la agenda, el orden del
// día, la carga cuando importa, el dinero en una línea y los enlaces.
// Sin atributos de RPG. El XP se ve, discreto.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Campo, ErrorSistema, TarjetaArena } from '@/components/arena';
import { Button, Check, Chip, Screen, Section, Sheet, Skeleton, SkeletonRows } from '@/components/ui';
import { HeroMundo, TarjetaCoach, TresCifras, tituloAhora } from '@/components/modos/mundo/PiezasOnix';
import { ink, space, type as tipo, vidrio } from '@/design/tokens';
import { t } from '@/i18n';
import { minAHora } from '@/work/fechas';
import { limpiarEntradas } from '@/work/prioridades';
import { DURACIONES_BLOQUE, MAX_PRIORIDADES, MAX_TITULO_PRIORIDAD } from '@/work/tipos';
import type { FilaTrabajo, ReunionVista, VistaWorkHoy } from '@/work/vistaHoy';
import { textoDuracion, textoMotivo } from './textos';

export type DestinoWork = 'proyectos' | 'horas' | 'revision' | 'carga';

export interface WorkHoyVistaProps {
  cabecera: ReactNode;
  /** El número de la semana, para el héroe. */
  semana: number;
  /** El nivel del modo, discreto («NV 11»). */
  nivelTexto?: string;
  estado: 'cargando' | 'listo';
  /** Fallo de la carga, ya escrito para el usuario. */
  error: string | null;
  /** Informe del cierre de ayer (el mismo de NIVL). */
  cierre: { alerta: boolean; lineas: string[] } | null;
  vista: VistaWorkHoy;
  /** Misión con el cerrojo tomado. */
  ocupada: string | null;
  /** Duración elegida para el próximo bloque. */
  minutos: number;
  refrescando?: boolean;
  /** Ranuras: las pintan quienes leen sus propios datos. */
  orden?: ReactNode;
  economia?: ReactNode;
  acciones: {
    onEmpezarAhora: () => void;
    onSeguirBloque: () => void;
    onMinutos: (m: number) => void;
    onEmpezarFila: (id: string) => void;
    onCompletar: (id: string) => void;
    onSoltar: (id: string) => void;
    onPlanificar: (titulos: string[]) => Promise<boolean>;
    onIr: (destino: DestinoWork) => void;
    onCoach: () => void;
    onReintentar: () => void;
    onRefrescar?: () => void;
  };
}

const CAMPOS = ['trabajo:planificar.campo1', 'trabajo:planificar.campo2', 'trabajo:planificar.campo3'] as const;

function FormPrioridades({ max, boton, onGuardar }: { max: number; boton: string; onGuardar: (titulos: string[]) => Promise<boolean> }) {
  const [textos, setTextos] = useState<string[]>(() => Array.from({ length: max }, () => ''));
  const [guardando, setGuardando] = useState(false);
  const cerrojo = useRef(false);
  const limpios = limpiarEntradas(textos);
  const poner = (i: number, v: string) => setTextos((x) => x.map((y, j) => (j === i ? v : y)));
  const guardar = async () => {
    if (cerrojo.current || limpios.length === 0) return;
    cerrojo.current = true;
    setGuardando(true);
    try {
      if (await onGuardar(limpios)) setTextos(Array.from({ length: max }, () => ''));
    } finally {
      cerrojo.current = false;
      setGuardando(false);
    }
  };
  return (
    <View style={styles.form}>
      {textos.map((v, i) =>
        // La siguiente aparece cuando se ha escrito la anterior: el primer paso es uno.
        i === 0 || textos[i - 1]!.trim() ? (
          <Campo
            key={i}
            etiqueta={t(CAMPOS[i] ?? CAMPOS[0])}
            placeholder={i === 0 ? t('trabajo:planificar.ejemplo') : undefined}
            value={v}
            onChangeText={(x) => poner(i, x)}
            maxLength={MAX_TITULO_PRIORIDAD}
            returnKeyType="done"
          />
        ) : null,
      )}
      <Text style={styles.detalle} maxFontSizeMultiplier={1.35}>
        {max > 1 ? `${t('trabajo:planificar.ayuda', { max })} ` : ''}
        {t('trabajo:planificar.aviso')}
      </Text>
      <Button title={boton} size="lg" disabled={limpios.length === 0} loading={guardando} onPress={() => void guardar()} />
    </View>
  );
}

function TarjetaAhora({ vista, minutos, acciones }: Pick<WorkHoyVistaProps, 'vista' | 'minutos' | 'acciones'>) {
  const a = vista.ahora;
  const sinTitulo = a.titulo === null;
  const titulo = vista.preparando ? t('trabajo:comun.noDisponibleTitulo') : (a.titulo ?? textoMotivo(a.motivo));
  const cuerpo = vista.preparando ? t('trabajo:comun.noDisponibleCuerpo') : sinTitulo ? null : textoMotivo(a.motivo);
  const meta = a.hastaMin !== null && a.tipo !== 'bloque' && a.tipo !== 'reunion' ? t('trabajo:ahora.hasta', { hora: minAHora(a.hastaMin) }) : undefined;
  return (
    <TarjetaArena variante="piedra" rotulo={t('trabajo:ahora.rotulo')} meta={meta}>
      <Text style={styles.ahoraTitulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
        {titulo}
      </Text>
      {cuerpo ? (
        <Text style={styles.ahoraMotivo} maxFontSizeMultiplier={1.35}>
          {cuerpo}
        </Text>
      ) : null}
      {vista.pedirPlan ? <FormPrioridades max={MAX_PRIORIDADES} boton={t('trabajo:planificar.guardar')} onGuardar={acciones.onPlanificar} /> : null}
      {a.accion === 'empezar_bloque' ? (
        <View style={styles.accion}>
          <View style={styles.duraciones}>
            {DURACIONES_BLOQUE.map((m) => (
              <Chip
                key={m}
                small
                label={t('trabajo:ahora.min', { minutos: m })}
                selected={m === minutos}
                onPress={() => acciones.onMinutos(m)}
                accessibilityLabel={t('trabajo:ahora.duracionA11y', { minutos: m })}
              />
            ))}
          </View>
          <Button title={t('trabajo:ahora.empezar')} icon="play" size="lg" onPress={acciones.onEmpezarAhora} />
        </View>
      ) : null}
      {a.accion === 'seguir_bloque' ? (
        <View style={styles.accion}>
          <Button title={t('trabajo:ahora.seguir')} size="lg" onPress={acciones.onSeguirBloque} />
        </View>
      ) : null}
    </TarjetaArena>
  );
}

function IconoFila({ nombre, a11y, onPress }: { nombre: keyof typeof Ionicons.glyphMap; a11y: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={styles.iconoFila} accessibilityRole="button" accessibilityLabel={a11y}>
      <Ionicons name={nombre} size={20} color={ink.ink8} />
    </Pressable>
  );
}

function Fila({ f, ocupada, primera, nota, acciones }: { f: FilaTrabajo; ocupada: string | null; primera: boolean; nota?: string; acciones: WorkHoyVistaProps['acciones'] }) {
  const bloqueado = f.hecha || f.bloqueada || ocupada === f.id;
  const detalle = nota ?? (f.hecha ? null : t('trabajo:hoy.xp', { xp: f.xp }));
  return (
    <View style={[styles.fila, !primera && styles.sep]}>
      <Pressable
        onPress={() => acciones.onCompletar(f.id)}
        disabled={bloqueado}
        hitSlop={8}
        style={styles.check}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: f.hecha, disabled: bloqueado }}
        accessibilityLabel={t('trabajo:hoy.marcarA11y', { titulo: f.titulo })}
      >
        <Check checked={f.hecha} busy={ocupada === f.id} />
      </Pressable>
      <View style={styles.filaTextos}>
        <Text style={[styles.filaTitulo, f.hecha && styles.filaHecha]} maxFontSizeMultiplier={1.35}>
          {f.titulo}
        </Text>
        {detalle ? (
          <Text style={styles.xp} maxFontSizeMultiplier={1.35}>
            {detalle}
          </Text>
        ) : null}
      </View>
      {f.puedeEmpezar ? <IconoFila nombre="play-outline" a11y={t('trabajo:hoy.empezarA11y', { titulo: f.titulo })} onPress={() => acciones.onEmpezarFila(f.id)} /> : null}
      {f.puedeSoltar ? <IconoFila nombre="close" a11y={t('trabajo:hoy.soltarA11y', { titulo: f.titulo })} onPress={() => acciones.onSoltar(f.id)} /> : null}
    </View>
  );
}

function LineaReunion({ r }: { r: ReunionVista }) {
  const cuando = r.enCurso ? t('trabajo:hoy.reunionAhora', { hora: minAHora(r.fin) }) : t('trabajo:hoy.reunionHora', { hora: minAHora(r.inicio), minutos: r.faltan });
  return (
    <Section title={t('trabajo:hoy.reunion')}>
      <Text style={styles.linea} maxFontSizeMultiplier={1.35}>
        {r.titulo}
      </Text>
      <Text style={styles.detalle} maxFontSizeMultiplier={1.35}>
        {cuando}
      </Text>
    </Section>
  );
}

function Enlaces({ onIr }: { onIr: WorkHoyVistaProps['acciones']['onIr'] }) {
  const lista: { id: Exclude<DestinoWork, 'carga'>; icono: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'proyectos', icono: 'folder-outline' },
    { id: 'horas', icono: 'time-outline' },
    { id: 'revision', icono: 'checkmark-done-outline' },
  ];
  return (
    <View style={styles.enlaces}>
      {lista.map((e) => (
        <Button key={e.id} title={t(`trabajo:hoy.${e.id}`)} icon={e.icono} variant="secondary" size="sm" style={styles.enlace} onPress={() => onIr(e.id)} />
      ))}
    </View>
  );
}

export function WorkHoyVista(p: WorkHoyVistaProps) {
  const { cabecera, semana, nivelTexto, estado, error, cierre, vista: v, ocupada, minutos, refrescando, orden, economia, acciones } = p;
  const [anadiendo, setAnadiendo] = useState(false);
  const [verResto, setVerResto] = useState(false);
  const cargando = estado === 'cargando';
  const hayFilas = v.prioridades.length > 0 || v.penalizaciones.length > 0;
  const ven = hayFilas || (v.huecos > 0 && !v.pedirPlan);
  const mostrarReunion = v.reunion !== null && v.ahora.tipo !== 'reunion';
  // Sin migración o sin misiones fiables, estas cifras dirían cosas falsas.
  const conCifras = !v.preparando && !v.ocultarAhora;
  const prioridades = Math.min(v.prioridades.length, 3) as 0 | 1 | 2 | 3;

  return (
    <Screen refreshing={refrescando} onRefresh={acciones.onRefrescar}>
      {cabecera}

      {error ? (
        <View style={styles.bloque}>
          <ErrorSistema mensaje={error} onReintentar={acciones.onReintentar} compacto />
        </View>
      ) : null}

      {!cargando && cierre ? (
        <View style={styles.bloque}>
          <TarjetaArena variante={cierre.alerta ? 'trama' : 'contorno'} rotulo={t('trabajo:hoy.cierre')}>
            {cierre.lineas.map((l) => (
              <Text key={l} style={styles.linea} maxFontSizeMultiplier={1.35}>
                {l}
              </Text>
            ))}
          </TarjetaArena>
        </View>
      ) : null}

      {cargando ? (
        <View style={styles.bloque} accessibilityRole="progressbar" accessibilityLabel={t('trabajo:comun.cargandoA11y')}>
          <Skeleton height={168} />
          <SkeletonRows rows={3} style={styles.huecos} />
        </View>
      ) : (
        <>
          {conCifras ? (
            <View style={styles.bloque}>
              <HeroMundo
                rotulo={t('trabajo:heroe.semana', { n: semana })}
                meta={nivelTexto}
                titulo={t(`trabajo:heroe.titulo.${prioridades}`)}
                ratio={v.total > 0 ? v.hechas / v.total : 0}
                pie={v.total > 0 ? t('trabajo:heroe.hechas', { hechas: v.hechas, total: v.total }) : t('trabajo:heroe.sinPlan')}
                etiquetaBarra={t('trabajo:hoy.prioridades')}
              />
            </View>
          ) : null}

          <View style={styles.bloque}>
            <TarjetaCoach cuerpo={t('mundos:mundo.coachCuerpo.work')} onAbrir={acciones.onCoach} />
          </View>

          {v.ocultarAhora ? null : (
            <View style={styles.bloque}>
              <TarjetaAhora vista={v} minutos={minutos} acciones={acciones} />
            </View>
          )}

          {conCifras ? (
            <View style={styles.bloque}>
              <TresCifras
                cifras={[
                  { valor: textoDuracion(v.carga.profundoSemanaMin), rotulo: t('trabajo:heroe.foco') },
                  { valor: textoDuracion(v.carga.reunionesSemanaMin), rotulo: t('trabajo:heroe.reuniones') },
                  { valor: t(`trabajo:heroe.nivel.${v.carga.nivel}`), rotulo: t('trabajo:heroe.carga') },
                ]}
              />
            </View>
          ) : null}

          {v.ahora.soltar.length > 0 ? (
            <Section title={t('trabajo:hoy.queSoltar')}>
              {v.ahora.soltar.map((s, i) => (
                <View key={s.id} style={[styles.fila, i > 0 && styles.sep]}>
                  <View style={styles.filaTextos}>
                    <Text style={styles.filaTitulo} maxFontSizeMultiplier={1.35}>
                      {s.titulo}
                    </Text>
                    <Text style={styles.xp} maxFontSizeMultiplier={1.35}>
                      {textoMotivo(s.motivo)}
                    </Text>
                  </View>
                  {s.sinCoste ? (
                    <Button title={t('trabajo:hoy.soltar')} variant="secondary" size="sm" accessibilityLabel={t('trabajo:hoy.soltarA11y', { titulo: s.titulo })} onPress={() => acciones.onSoltar(s.id)} />
                  ) : null}
                </View>
              ))}
            </Section>
          ) : null}

          {ven ? (
            <Section
              title={t('trabajo:hoy.prioridades')}
              meta={v.total > 0 ? `${v.hechas}/${v.total}` : undefined}
              action={v.huecos > 0 ? { label: t('trabajo:hoy.anadir'), onPress: () => setAnadiendo(true), icon: 'add' } : undefined}
            >
              {hayFilas ? null : (
                <Text style={styles.detalle} maxFontSizeMultiplier={1.35}>
                  {t('trabajo:motivo.planificar')}
                </Text>
              )}
              {v.prioridades.map((f, i) => (
                <Fila key={f.id} f={f} ocupada={ocupada} primera={i === 0} acciones={acciones} />
              ))}
              {v.penalizaciones.map((f, i) => (
                <Fila
                  key={f.id}
                  f={f}
                  ocupada={ocupada}
                  primera={i === 0 && v.prioridades.length === 0}
                  nota={f.bloqueada ? t('trabajo:hoy.recuperarBloqueada') : t('trabajo:hoy.recuperar')}
                  acciones={acciones}
                />
              ))}
              {verResto ? v.resto.map((f) => <Fila key={f.id} f={f} ocupada={ocupada} primera={false} acciones={acciones} />) : null}
              {v.resto.length > 0 ? (
                <Button
                  title={verResto ? t('trabajo:hoy.restoOcultar') : t('trabajo:hoy.resto', { n: v.resto.length })}
                  variant="ghost"
                  size="sm"
                  onPress={() => setVerResto((x) => !x)}
                />
              ) : null}
            </Section>
          ) : null}

          {mostrarReunion ? <LineaReunion r={v.reunion!} /> : null}

          {orden}

          {v.carga.nivel === 'alta' ? (
            <Section title={t('trabajogestion:carga.nivel.alta')} action={{ label: t('trabajo:hoy.verCarga'), onPress: () => acciones.onIr('carga') }}>
              <Text style={styles.linea} maxFontSizeMultiplier={1.35}>
                {v.carga.soltar ? t(`trabajogestion:carga.soltar.${v.carga.soltar}`) : t('trabajo:hoy.cargaSinSoltar')}
              </Text>
            </Section>
          ) : null}

          {economia}

          <Enlaces onIr={acciones.onIr} />
        </>
      )}

      <Sheet visible={anadiendo} onClose={() => setAnadiendo(false)} eyebrow={t('trabajo:planificar.eyebrow')} title={t('trabajo:planificar.tituloHoja')}>
        {anadiendo ? (
          <FormPrioridades
            max={Math.max(1, v.huecos)}
            boton={t('trabajo:planificar.anadir')}
            onGuardar={async (titulos) => {
              const ok = await acciones.onPlanificar(titulos);
              if (ok) setAnadiendo(false);
              return ok;
            }}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloque: { marginBottom: space.s5 },
  huecos: { marginTop: space.s5 },
  ahoraTitulo: tituloAhora,
  ahoraMotivo: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8, marginTop: space.s1 },
  form: { gap: space.s3, marginTop: space.s4 },
  accion: { gap: space.s3, marginTop: space.s4 },
  duraciones: { flexDirection: 'row', gap: space.s2 },
  linea: { fontFamily: tipo.body.family, fontSize: tipo.body.size, lineHeight: tipo.body.lineHeight, color: ink.ink9 },
  detalle: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink6 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.s2, minHeight: 56, paddingVertical: space.s2 },
  sep: { borderTopWidth: 1, borderTopColor: vidrio.linea },
  check: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filaTextos: { flex: 1, minWidth: 0 },
  filaTitulo: { fontFamily: tipo.body.family, fontSize: tipo.body.size, lineHeight: tipo.body.lineHeight, color: ink.ink9 },
  filaHecha: { color: ink.ink6, textDecorationLine: 'line-through' },
  xp: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, lineHeight: tipo.micro.lineHeight, color: ink.ink6 },
  iconoFila: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  enlaces: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s2, marginBottom: space.s6 },
  enlace: { flexGrow: 1 },
});
