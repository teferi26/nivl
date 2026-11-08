// NIVL · FOCUS: las hojas del mundo del estudiante. Puras: reciben datos y
// devuelven lo que se eligió o escribió; guardar lo hace useHojasFocus.
//
//   HojaAsignatura · HojaTemas · HojaExamen · HojaDetalleExamen · HojaClase
//   HojaNota · HojaNotasAsignatura · HojaMazo · HojaTarjeta · HojaRepaso
//   HojaMetodo · HojaAjustes · HojaMision · HojaNoMolestar
//
// Formularios en Sheet con Campo y la acción en el pie (SISTEMA §6).

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Campo } from '@/components/arena';
import { Sheet } from '@/components/ui';
import { Interruptor } from '@/components/ui/Interruptor';
import { ink, space, type as tipo } from '@/design/tokens';
import { esSimulacro, leerFormExamen, leerObjetivo, modoFechaDe, nombreNota, type ClavePerfil, type ModoFecha } from '@/focus/agenda';
import type { TemaNuevo } from '@/focus/datos';
import { diaSemana, fechaCorta, hhmm, leerFechaEs, sumarDias } from '@/focus/fechas';
import { errorDeClase, solapes } from '@/focus/horario';
import { huecoDelDia, leerHora, siguienteHueco } from '@/focus/horarioRapido';
import { MAX_TEXTO_LOTE, temasDesdeTexto, type TemaImportado } from '@/focus/importar';
import type { Metodo } from '@/focus/metodos';
import { formatoNota, leerNumero, type Media, type Necesaria } from '@/focus/notas';
import type { DiaPlan } from '@/focus/planEstudio';
import { CONFIG_POR_DEFECTO, LIMITES, type ConfigPomodoro } from '@/focus/pomodoro';
import type { Resultado } from '@/focus/repaso';
import type { Asignatura, Clase, EstadoTema, Examen, Mazo, Nota, PrefsFocus, Tema, TipoExamen } from '@/focus/tipos';
import { t } from '@/i18n';
import { F, R } from './estilo';
import { CampoHora, Elegir, SelectorFecha, porPerfil } from './HojasAgenda';
import { tf } from './textos';
import { BotonFocus, Casilla, ChipFocus, FilaFocus, Rotulo, textoFocus } from './Piezas';

export { Elegir };

const DIAS = [1, 2, 3, 4, 5, 6, 7] as const;

export function nombreDia(d: number, corto = false): string {
  return tf(`focus:dia.${corto ? 'corto' : 'largo'}.${d}`);
}

export function Pie({ titulo, onPress, disabled }: { titulo: string; onPress: () => void; disabled?: boolean }) {
  return <BotonFocus titulo={titulo} onPress={onPress} disabled={disabled} />;
}

// ── Asignatura ────────────────────────────────────────────────────────

export function HojaAsignatura({ visible, onClose, onGuardar }: { visible: boolean; onClose: () => void; onGuardar: (nombre: string) => void }) {
  const [nombre, setNombre] = useState('');
  useEffect(() => {
    if (visible) setNombre('');
  }, [visible]);
  const ok = nombre.trim().length > 0;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={t('focus:hojas.eyebrow')}
      title={t('focus:hojas.asignaturaTitulo')}
      footer={<Pie titulo={t('focus:hojas.guardar')} disabled={!ok} onPress={() => onGuardar(nombre)} />}
    >
      <Campo etiqueta={t('focus:hojas.asignaturaNombre')} value={nombre} onChangeText={setNombre} maxLength={80} autoFocus placeholder={t('focus:hojas.asignaturaEjemplo')} />
    </Sheet>
  );
}

// ── Temas ─────────────────────────────────────────────────────────────

export function HojaTemas({
  visible,
  asignatura,
  onClose,
  onGuardar,
}: {
  visible: boolean;
  asignatura: string;
  onClose: () => void;
  onGuardar: (temas: TemaImportado[]) => void;
}) {
  const [texto, setTexto] = useState('');
  useEffect(() => {
    if (visible) setTexto('');
  }, [visible]);
  const { temas, recortados } = temasDesdeTexto(texto);
  const secciones = new Set(temas.flatMap((x) => (x.seccion ? [x.seccion] : []))).size;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={asignatura}
      title={t('focus:hojas.temasTitulo')}
      footer={<Pie titulo={t('focus:hojas.anadirN', { count: temas.length })} disabled={temas.length === 0} onPress={() => onGuardar(temas)} />}
    >
      <Campo
        etiqueta={t('focus:hojas.temasCampo')}
        ayuda={t('focus:hojas.temasAyuda')}
        value={texto}
        onChangeText={setTexto}
        multiline
        maxLength={MAX_TEXTO_LOTE}
        style={styles.multilineaLote}
        placeholder={t('focus:hojas.temasEjemplo')}
      />
      {secciones > 0 ? (
        <Text style={[textoFocus.detalle, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:fondo.temas.enSecciones', { count: secciones })}
        </Text>
      ) : null}
      {recortados > 0 ? (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:fondo.temas.recortados', { count: recortados })}
        </Text>
      ) : null}
    </Sheet>
  );
}

// ── Examen: nuevo y editar ────────────────────────────────────────────

export interface ExamenNuevo {
  asignaturaId: string;
  titulo: string;
  fecha: string | null;
  peso: number | null;
  temas: TemaNuevo[];
  hora: number | null;
  tipo: TipoExamen;
  estimada: boolean;
}

export function HojaExamen({
  visible,
  asignaturas,
  hoy,
  inicial,
  examen,
  asignaturaFija,
  perfil = 'general',
  onClose,
  onGuardar,
}: {
  visible: boolean;
  asignaturas: Asignatura[];
  hoy: string;
  inicial?: string | null;
  /** El que se edita; sin él, uno nuevo. */
  examen?: Examen | null;
  /** Con temas propios, la asignatura no se cambia: se quedarían fuera del examen. */
  asignaturaFija?: boolean;
  perfil?: ClavePerfil;
  onClose: () => void;
  onGuardar: (x: ExamenNuevo) => void;
}) {
  const [asig, setAsig] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [modo, setModo] = useState<ModoFecha>('fija');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [tipoExamen, setTipoExamen] = useState<TipoExamen>('examen');
  const [peso, setPeso] = useState('');
  const [temas, setTemas] = useState('');
  const [intento, setIntento] = useState(false);
  const primera = asignaturas[0]?.id ?? null;
  const id = examen?.id ?? null;
  // Se rellena al abrir: releer los datos tras un fallo no borra lo escrito.
  useEffect(() => {
    if (!visible) return;
    setAsig(examen?.asignaturaId ?? inicial ?? primera);
    setTitulo(examen?.titulo ?? '');
    setModo(examen ? modoFechaDe(examen) : 'fija');
    setFecha(examen?.fecha ? fechaCorta(examen.fecha) : '');
    setHora(examen?.hora != null ? hhmm(examen.hora) : '');
    setTipoExamen(examen?.tipo === 'prueba' ? 'prueba' : 'examen');
    setPeso(examen?.peso != null ? formatoNota(examen.peso) : '');
    setTemas('');
    setIntento(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, id, inicial, primera]);
  const r = leerFormExamen({ modo, fecha, hora, peso }, hoy);
  const ok = !!asig && titulo.trim().length > 0 && r.ok;
  const modos: { valor: ModoFecha; titulo: string }[] = [
    { valor: 'fija', titulo: t('focus:agenda.examen.conFecha') },
    { valor: 'aproximada', titulo: t('focus:agenda.examen.aproximada') },
    { valor: 'sin', titulo: t('focus:agenda.examen.sinFecha') },
  ];
  const ayudaModo = modo === 'aproximada' ? t('focus:agenda.examen.aproximadaAyuda') : modo === 'sin' ? t('focus:agenda.examen.sinFechaAyuda') : null;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={t('focus:hojas.eyebrow')}
      title={porPerfil(perfil, examen ? 'examenEditar' : 'examenNuevo')}
      footer={
        <Pie
          titulo={t('focus:hojas.guardar')}
          onPress={() => {
            setIntento(true);
            if (ok && asig)
              onGuardar({ asignaturaId: asig, titulo, fecha: r.fecha, peso: r.peso, hora: r.hora, tipo: tipoExamen, estimada: r.estimada, temas: temasDesdeTexto(temas).temas });
          }}
        />
      }
    >
      {asignaturaFija ? null : <Elegir etiqueta={t('focus:hojas.asignatura')} opciones={asignaturas.map((a) => ({ valor: a.id, titulo: a.nombre }))} valor={asig} onCambiar={setAsig} />}
      <Campo
        etiqueta={porPerfil(perfil, 'examenNombre')}
        error={intento && titulo.trim().length === 0 ? t('focus:agenda.examen.nombreError') : null}
        value={titulo}
        onChangeText={setTitulo}
        maxLength={120}
        placeholder={porPerfil(perfil, 'examenEjemplo')}
        estiloBloque={styles.campo}
      />
      <Elegir
        etiqueta={t('focus:agenda.examen.tipo')}
        opciones={[
          { valor: 'examen' as const, titulo: porPerfil(perfil, 'examen') },
          { valor: 'prueba' as const, titulo: porPerfil(perfil, 'prueba') },
        ]}
        valor={tipoExamen}
        onCambiar={setTipoExamen}
      />
      <Elegir etiqueta={t('focus:agenda.examen.modo')} opciones={modos} valor={modo} onCambiar={setModo} />
      {ayudaModo ? (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {ayudaModo}
        </Text>
      ) : null}
      {modo !== 'sin' ? <SelectorFecha valor={fecha} hoy={hoy} uso="examen" error={intento && r.errores.fecha ? t('focus:hojas.fechaError') : null} onCambiar={setFecha} /> : null}
      {modo === 'fija' ? <CampoHora valor={hora} ayuda={t('focus:agenda.examen.horaAyuda')} error={r.errores.hora ? t('focus:agenda.horaError') : null} onCambiar={setHora} /> : null}
      <Campo
        etiqueta={t('focus:hojas.peso')}
        ayuda={t('focus:hojas.pesoAyuda')}
        error={r.errores.peso ? t('focus:hojas.pesoError') : null}
        value={peso}
        onChangeText={setPeso}
        keyboardType="decimal-pad"
        maxLength={6}
        estiloBloque={styles.campo}
      />
      {examen ? null : (
        <Campo
          etiqueta={t('focus:hojas.temasExamen')}
          ayuda={t('focus:hojas.temasExamenAyuda')}
          value={temas}
          onChangeText={setTemas}
          multiline
          maxLength={MAX_TEXTO_LOTE}
          style={styles.multilinea}
          estiloBloque={styles.campo}
        />
      )}
    </Sheet>
  );
}

// ── Detalle de un examen: plan automático y temario ──────────────────

export function etiquetaItem(tipo: 'estudiar' | 'repasar' | 'simulacro' | 'entrega'): string {
  return t(`focus:plan.${tipo}`);
}

/** «2/11/2026, 09:00» o «2/11/2026 aprox.». */
export function fechaDeExamen(x: Pick<Examen, 'hora' | 'estimada'> & { fecha: string }): string {
  const fecha = fechaCorta(x.fecha);
  if (x.estimada) return t('focus:agenda.examen.fechaAprox', { fecha });
  return x.hora !== null ? t('focus:agenda.examen.fechaHora', { fecha, hora: hhmm(x.hora) }) : fecha;
}

/** El rótulo de un día del plan: los días vacíos no salen, así que se mira la fecha. */
export function etiquetaDiaPlan(fecha: string, hoy: string): string {
  if (fecha === hoy) return t('focus:comun.hoy');
  if (fecha === sumarDias(hoy, 1)) return t('focus:comun.manana');
  return `${nombreDia(diaSemana(fecha), true)} ${Number(fecha.slice(8, 10))}`;
}

function textoPlanExamen(x: Examen, dias: number | null, sinTemas: boolean): string {
  if (dias !== null && dias < 0) return t('focus:agenda.plan.pasado');
  if (dias === 0 && !x.estimada) return t('focus:hojas.planHoyEs');
  if (sinTemas) return t('focus:agenda.plan.sinTemas');
  if (x.fecha === null) return t('focus:agenda.plan.sinFecha');
  if (x.estimada) return t('focus:agenda.plan.aproximada');
  return t('focus:hojas.planExplica', { count: dias ?? 0 });
}

const DIAS_HOJA_PLAN = 14;

export function HojaDetalleExamen({
  visible,
  examen,
  asignatura,
  hoy,
  dias,
  plan,
  temas,
  nombreTema,
  onClose,
  onAlternarTema,
  onAnadirTemas,
  onEditar,
  onSimulacro,
  onBorrar,
  onEstudiar,
}: {
  visible: boolean;
  examen: Examen | null;
  asignatura: string;
  hoy: string;
  /** Días que faltan; null sin fecha. */
  dias: number | null;
  plan: DiaPlan[];
  temas: Tema[];
  nombreTema: (id: string | null) => string;
  onClose: () => void;
  onAlternarTema: (t: Tema) => void;
  onAnadirTemas: () => void;
  onEditar: () => void;
  onSimulacro: () => void;
  onBorrar: () => void;
  onEstudiar: (temaId: string | null) => void;
}) {
  const [todo, setTodo] = useState(false);
  useEffect(() => {
    if (visible) setTodo(false);
  }, [visible]);
  if (!examen) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;
  const sinTemas = temas.length === 0;
  const cerrado = dias !== null && (dias < 0 || (dias === 0 && !examen.estimada));
  const siguiente = plan.flatMap((d) => d.items).find((i) => i.temaId !== null);
  const dentro = todo ? plan : plan.slice(0, DIAS_HOJA_PLAN);
  const quedan = plan.length - dentro.length;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={t('focus:hojas.detalleEyebrow', { fecha: examen.fecha ? fechaDeExamen({ ...examen, fecha: examen.fecha }) : t('focus:agenda.plazo.sinFecha'), titulo: examen.titulo })}
      title={asignatura}
      footer={<Pie titulo={t('focus:hojas.estudiarAhora')} onPress={() => onEstudiar(siguiente?.temaId ?? null)} />}
    >
      <Text style={textoFocus.cuerpo} maxFontSizeMultiplier={1.5}>
        {textoPlanExamen(examen, dias, sinTemas)}
      </Text>
      <View style={[styles.pieDos, styles.seccion]}>
        <BotonFocus titulo={t('focus:agenda.examen.editar')} variante="contorno" pequeno onPress={onEditar} style={styles.flex} />
        <BotonFocus titulo={t('focus:agenda.plan.apuntarSimulacro')} variante="contorno" pequeno onPress={onSimulacro} style={styles.flex} />
      </View>
      {sinTemas || cerrado ? null : (
        <>
          <Rotulo texto={t('focus:hojas.planRotulo')} style={styles.seccion} />
          {plan.length === 0 ? (
            <Text style={[textoFocus.cuerpo, styles.arriba]}>{t('focus:hojas.planVacio')}</Text>
          ) : (
            dentro.map((d, i) => (
              <FilaFocus key={d.fecha} primera={i === 0} style={styles.filaAlta}>
                <Text style={[textoFocus.detalle, styles.diaPlan]} maxFontSizeMultiplier={1.35}>
                  {etiquetaDiaPlan(d.fecha, hoy)}
                </Text>
                <View style={styles.flex}>
                  {d.items.map((it, k) => (
                    <Text key={`${it.tipo}-${it.temaId ?? k}`} style={textoFocus.fila} maxFontSizeMultiplier={1.35}>
                      <Text style={it.tipo === 'estudiar' ? styles.tipoItem : styles.tipoApagado}>{etiquetaItem(it.tipo)} </Text>
                      {it.tipo === 'simulacro' ? t('focus:hojas.simulacroDetalle') : nombreTema(it.temaId)}
                    </Text>
                  ))}
                </View>
              </FilaFocus>
            ))
          )}
          {quedan > 0 ? <BotonFocus titulo={t('focus:agenda.plan.verMas', { count: quedan })} variante="texto" pequeno onPress={() => setTodo(true)} /> : null}
        </>
      )}
      <Rotulo texto={t('focus:hojas.temarioRotulo', { count: temas.length })} derecha={t('focus:hojas.anadirTemas')} onDerecha={onAnadirTemas} style={styles.seccion} />
      {temas.map((x, i) => (
        <FilaTema key={x.id} tema={x} primera={i === 0} onPress={() => onAlternarTema(x)} />
      ))}
      <BotonFocus titulo={t('focus:hojas.borrarExamen')} variante="texto" pequeno onPress={onBorrar} style={styles.seccion} />
    </Sheet>
  );
}

export function FilaTema({ tema, primera, onPress, onLongPress }: { tema: Pick<Tema, 'nombre' | 'estado'>; primera?: boolean; onPress: () => void; onLongPress?: () => void }) {
  const estado = t(`focus:estado.${tema.estado}`);
  return (
    <FilaFocus
      primera={primera}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={t('focus:hoy.temaA11y', { nombre: tema.nombre, estado })}
      accessibilityHint={t('focus:hoy.temaHint')}
      accessibilityActions={onLongPress ? [{ name: 'longpress', label: t('focus:hojas.borrarTema') }] : undefined}
      onAccessibilityAction={onLongPress ? (e) => e.nativeEvent.actionName === 'longpress' && onLongPress() : undefined}
    >
      <View style={styles.izq}>
        <Casilla estado={casillaDe(tema.estado)} />
        <Text style={[textoFocus.fila, styles.flex]} maxFontSizeMultiplier={1.35} numberOfLines={2}>
          {tema.nombre}
        </Text>
      </View>
      <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35}>
        {estado}
      </Text>
    </FilaFocus>
  );
}

export function casillaDe(e: EstadoTema): 'vacia' | 'media' | 'hecha' {
  return e === 'dominado' ? 'hecha' : e === 'repasando' ? 'media' : 'vacia';
}

// ── Clase ─────────────────────────────────────────────────────────────

export function HojaClase({
  visible,
  asignaturas,
  dia,
  clase,
  clases,
  onClose,
  onGuardar,
  onBorrar,
}: {
  visible: boolean;
  asignaturas: Asignatura[];
  dia: number;
  /** La clase que se edita; null para una nueva. */
  clase: Clase | null;
  /** Todo el horario, para proponer la hora y avisar de lo que se pisa. */
  clases: Clase[];
  onClose: () => void;
  onGuardar: (c: Omit<Clase, 'id'>, otra: boolean) => void;
  onBorrar: (c: Clase) => void;
}) {
  const [asig, setAsig] = useState<string | null>(null);
  const [d, setD] = useState(dia);
  const [ini, setIni] = useState('');
  const [fin, setFin] = useState('');
  const [aula, setAula] = useState('');
  const claseId = clase?.id ?? null;
  // Se rellena al abrir: si dependiera de `clases` o `asignaturas`, «Guardar y
  // otra» relee y borraría lo que se está escribiendo.
  useEffect(() => {
    if (!visible) return;
    const hueco = clase ? null : huecoDelDia(clases, dia);
    setAsig(clase?.asignaturaId ?? asignaturas[0]?.id ?? null);
    setD(clase?.dia ?? dia);
    setIni(clase ? hhmm(clase.inicio) : hueco ? hhmm(hueco.inicio) : '');
    setFin(clase ? hhmm(clase.fin) : hueco ? hhmm(hueco.fin) : '');
    setAula(clase?.aula ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [visible, dia, claseId]);
  const i = leerHora(ini);
  const f = leerHora(fin);
  const errIni = ini.trim() !== '' && i === null ? t('focus:fondo.horario.horaError') : null;
  const errFin = fin.trim() !== '' && f === null ? t('focus:fondo.horario.horaError') : null;
  const horas = i !== null && f !== null ? { dia: d, inicio: i, fin: f } : null;
  const alReves = !!horas && errorDeClase(horas) !== null;
  const ok = !!asig && !!horas && !alReves;
  const pisa = horas && !alReves ? solapes(clases, { ...horas, id: claseId ?? undefined })[0] : undefined;
  const nombrePisa = pisa ? (asignaturas.find((a) => a.id === pisa.asignaturaId)?.nombre ?? '') : '';
  const datos = (): Omit<Clase, 'id'> | null =>
    ok && asig && i !== null && f !== null ? { asignaturaId: asig, dia: d, inicio: i, fin: f, aula: aula.trim() || null } : null;
  const guardarYOtra = () => {
    const c = datos();
    if (!c) return;
    onGuardar(c, true);
    const sig = siguienteHueco(c.inicio, c.fin);
    setIni(sig ? hhmm(sig.inicio) : '');
    setFin(sig ? hhmm(sig.fin) : '');
    setAula('');
  };
  const teclado = Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default';
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={t('focus:hojas.eyebrow')}
      title={clase ? t('focus:fondo.horario.editarTitulo') : t('focus:hojas.claseTitulo')}
      footer={
        clase ? (
          <Pie titulo={t('focus:hojas.guardar')} disabled={!ok} onPress={() => { const c = datos(); if (c) onGuardar(c, false); }} />
        ) : (
          <View style={styles.pieDos}>
            <BotonFocus titulo={t('focus:hojas.guardarOtra')} variante="contorno" disabled={!ok} style={styles.flex} onPress={guardarYOtra} />
            <BotonFocus titulo={t('focus:hojas.guardar')} disabled={!ok} style={styles.flex} onPress={() => { const c = datos(); if (c) onGuardar(c, false); }} />
          </View>
        )
      }
    >
      <Elegir etiqueta={t('focus:hojas.asignatura')} opciones={asignaturas.map((a) => ({ valor: a.id, titulo: a.nombre }))} valor={asig} onCambiar={setAsig} />
      <Elegir etiqueta={t('focus:hojas.dia')} opciones={DIAS.map((x) => ({ valor: x as number, titulo: nombreDia(x, true) }))} valor={d} onCambiar={setD} />
      <View style={styles.dos}>
        <Campo etiqueta={t('focus:hojas.inicio')} value={ini} onChangeText={setIni} placeholder="8" maxLength={5} keyboardType={teclado} error={errIni} estiloBloque={styles.flex} />
        <Campo etiqueta={t('focus:hojas.fin')} value={fin} onChangeText={setFin} placeholder="9" maxLength={5} keyboardType={teclado} error={errFin} estiloBloque={styles.flex} />
      </View>
      {alReves ? <Text style={[textoFocus.cuerpo, styles.arriba]}>{t('focus:hojas.horasError')}</Text> : null}
      {pisa ? <Text style={[textoFocus.cuerpo, styles.arriba]}>{t('focus:fondo.horario.pisa', { asignatura: nombrePisa, horas: horaClase(pisa) })}</Text> : null}
      <Campo etiqueta={t('focus:hojas.aula')} value={aula} onChangeText={setAula} maxLength={60} estiloBloque={styles.campo} />
      {clase ? <BotonFocus titulo={t('focus:fondo.horario.borrar')} variante="texto" pequeno onPress={() => onBorrar(clase)} style={styles.seccion} /> : null}
    </Sheet>
  );
}

// ── Nota ──────────────────────────────────────────────────────────────

export function HojaNota({
  visible,
  asignaturas,
  inicial,
  hoy,
  perfil = 'general',
  onClose,
  onGuardar,
}: {
  visible: boolean;
  asignaturas: Asignatura[];
  inicial?: string | null;
  hoy: string;
  perfil?: ClavePerfil;
  onClose: () => void;
  onGuardar: (n: Omit<Nota, 'id'>) => void;
}) {
  const [asig, setAsig] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [nota, setNota] = useState('');
  const [sobre, setSobre] = useState('10');
  const [peso, setPeso] = useState('');
  const primera = asignaturas[0]?.id ?? null;
  // Se rellena al abrir: releer los datos tras un fallo no borra lo escrito.
  useEffect(() => {
    if (!visible) return;
    setAsig(inicial ?? primera);
    setTitulo('');
    setNota('');
    setSobre('10');
    setPeso('');
  }, [visible, inicial, primera]);
  const n = leerNumero(nota);
  const s = leerNumero(sobre);
  const p = peso.trim() === '' ? null : leerNumero(peso);
  const errNota = nota.trim() !== '' && (n === null || s === null || n > s) ? t('focus:hojas.notaError') : null;
  const errPeso = peso.trim() !== '' && (p === null || p <= 0 || p > 100) ? t('focus:hojas.pesoError') : null;
  const ok = !!asig && titulo.trim().length > 0 && n !== null && s !== null && s > 0 && n <= s && !errPeso;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={t('focus:hojas.eyebrow')}
      title={t('focus:hojas.notaTitulo')}
      footer={
        <Pie
          titulo={t('focus:hojas.guardar')}
          disabled={!ok}
          onPress={() => asig && n !== null && s !== null && onGuardar({ asignaturaId: asig, titulo, nota: n, sobre: s, peso: p, fecha: hoy })}
        />
      }
    >
      <Elegir etiqueta={t('focus:hojas.asignatura')} opciones={asignaturas.map((a) => ({ valor: a.id, titulo: a.nombre }))} valor={asig} onCambiar={setAsig} />
      <Campo etiqueta={t('focus:hojas.notaNombre')} value={titulo} onChangeText={setTitulo} maxLength={120} placeholder={porPerfil(perfil, 'notaEjemplo')} estiloBloque={styles.campo} />
      <View style={styles.dos}>
        <Campo etiqueta={t('focus:hojas.nota')} value={nota} onChangeText={setNota} keyboardType="decimal-pad" maxLength={6} error={errNota} estiloBloque={styles.flex} />
        <Campo etiqueta={t('focus:hojas.sobre')} value={sobre} onChangeText={setSobre} keyboardType="decimal-pad" maxLength={6} estiloBloque={styles.flex} />
      </View>
      <Campo etiqueta={t('focus:hojas.peso')} ayuda={t('focus:hojas.pesoNotaAyuda')} error={errPeso} value={peso} onChangeText={setPeso} keyboardType="decimal-pad" maxLength={5} estiloBloque={styles.campo} />
    </Sheet>
  );
}

export function HojaNotasAsignatura({
  visible,
  asignatura,
  notas,
  media,
  necesaria,
  objetivo,
  onClose,
  onBorrar,
  onAnadir,
  onObjetivo,
}: {
  visible: boolean;
  asignatura: string;
  notas: Nota[];
  media: Media | null;
  necesaria: Necesaria | null;
  objetivo: number | null;
  onClose: () => void;
  onBorrar: (n: Nota) => void;
  onAnadir: () => void;
  onObjetivo: (nota: number | null) => void;
}) {
  const [texto, setTexto] = useState('');
  useEffect(() => {
    if (visible) setTexto(objetivo !== null ? formatoNota(objetivo) : '');
  }, [visible, objetivo]);
  const leido = leerObjetivo(texto);
  const cambia = leido.ok && leido.valor !== objetivo;
  return (
    <Sheet visible={visible} onClose={onClose} eyebrow={t('focus:hojas.notasEyebrow')} title={asignatura} footer={<Pie titulo={t('focus:hojas.anadirNota')} onPress={onAnadir} />}>
      {media && media.media !== null ? (
        <View style={styles.mediaFila}>
          <Text style={textoFocus.cifra} maxFontSizeMultiplier={1}>
            {formatoNota(media.media)}
          </Text>
          <Text style={[textoFocus.cuerpo, styles.flex]} maxFontSizeMultiplier={1.5}>
            {media.ponderada ? t('focus:notas.ponderada', { pct: formatoNota(media.pesoEvaluado) }) : t('focus:notas.simple')}
          </Text>
        </View>
      ) : null}
      {media && media.sinPeso > 0 ? <Text style={[textoFocus.detalle, styles.arriba]}>{t('focus:agenda.notas.sinPeso', { count: media.sinPeso })}</Text> : null}
      {necesaria && textoNecesaria(necesaria) ? <Text style={[textoFocus.cuerpo, styles.arriba]}>{textoNecesaria(necesaria)}</Text> : null}
      <Campo
        etiqueta={t('focus:agenda.notas.objetivoCampo')}
        ayuda={t('focus:agenda.notas.objetivoAyuda')}
        error={leido.ok ? null : t('focus:agenda.notas.objetivoError')}
        value={texto}
        onChangeText={setTexto}
        keyboardType="decimal-pad"
        maxLength={5}
        estiloBloque={styles.campo}
      />
      {cambia ? <BotonFocus titulo={t('focus:agenda.notas.objetivoGuardar')} variante="contorno" pequeno onPress={() => onObjetivo(leido.valor)} style={styles.arriba} /> : null}
      <Rotulo texto={t('focus:hojas.notasRotulo')} style={styles.seccion} />
      {notas.length === 0 ? <Text style={[textoFocus.cuerpo, styles.arriba]}>{t('focus:agenda.notas.vacio')}</Text> : null}
      {notas.map((n, i) => (
        <FilaFocus
          key={n.id}
          primera={i === 0}
          onLongPress={() => onBorrar(n)}
          onPress={() => onBorrar(n)}
          accessibilityLabel={t('focus:hojas.notaA11y', { titulo: nombreNota(n), nota: formatoNota(n.nota), sobre: formatoNota(n.sobre) })}
          accessibilityHint={t('focus:hojas.notaHint')}
        >
          <View style={styles.flex}>
            <Text style={textoFocus.fila} maxFontSizeMultiplier={1.35}>
              {nombreNota(n)}
            </Text>
            <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.35}>
              {esSimulacro(n) ? t('focus:agenda.simulacro.noCuenta') : n.peso !== null ? t('focus:hojas.notaPeso', { pct: formatoNota(n.peso) }) : t('focus:hojas.notaSinPeso')}
            </Text>
          </View>
          <Text style={textoFocus.filaFuerte} maxFontSizeMultiplier={1.35}>
            {formatoNota(n.nota)} / {formatoNota(n.sobre)}
          </Text>
        </FilaFocus>
      ))}
    </Sheet>
  );
}

export function textoNecesaria(n: Necesaria): string | null {
  if (n.tipo === 'asegurado') return t('focus:notas.asegurado');
  if (n.tipo === 'encaminada') return t('focus:notas.encaminada');
  if (n.tipo === 'necesaria') return t('focus:notas.necesaria', { nota: formatoNota(n.necesaria) });
  if (n.tipo === 'imposible') return t('focus:notas.imposible');
  return null;
}

// ── Flashcards ────────────────────────────────────────────────────────

export function HojaMazo({
  visible,
  asignaturas,
  onClose,
  onGuardar,
}: {
  visible: boolean;
  asignaturas: Asignatura[];
  onClose: () => void;
  onGuardar: (nombre: string, asignaturaId: string | null) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [asig, setAsig] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setNombre('');
      setAsig(null);
    }
  }, [visible]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={t('focus:hojas.eyebrow')}
      title={t('focus:hojas.mazoTitulo')}
      footer={<Pie titulo={t('focus:hojas.guardar')} disabled={!nombre.trim()} onPress={() => onGuardar(nombre, asig)} />}
    >
      <Campo etiqueta={t('focus:hojas.mazoNombre')} value={nombre} onChangeText={setNombre} maxLength={80} placeholder={t('focus:hojas.mazoEjemplo')} />
      {asignaturas.length > 0 ? (
        <Elegir etiqueta={t('focus:hojas.asignaturaOpcional')} opciones={asignaturas.map((a) => ({ valor: a.id, titulo: a.nombre }))} valor={asig} onCambiar={(v) => setAsig(v === asig ? null : v)} />
      ) : null}
    </Sheet>
  );
}

export function HojaTarjeta({
  visible,
  mazos,
  inicial,
  onClose,
  onGuardar,
}: {
  visible: boolean;
  mazos: Mazo[];
  inicial?: string | null;
  onClose: () => void;
  onGuardar: (mazoId: string, anverso: string, reverso: string, otra: boolean) => void;
}) {
  const [mazo, setMazo] = useState<string | null>(null);
  const [a, setA] = useState('');
  const [r, setR] = useState('');
  useEffect(() => {
    if (!visible) return;
    setMazo(inicial ?? mazos[0]?.id ?? null);
    setA('');
    setR('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- «Guardar y otra» relee: con `mazos` borraría lo que se está escribiendo
  }, [visible, inicial]);
  const ok = !!mazo && a.trim().length > 0 && r.trim().length > 0;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={t('focus:hojas.eyebrow')}
      title={t('focus:hojas.tarjetaTitulo')}
      footer={
        <View style={styles.pieDos}>
          <BotonFocus
            titulo={t('focus:hojas.guardarOtra')}
            variante="contorno"
            disabled={!ok}
            style={styles.flex}
            onPress={() => {
              if (!ok || !mazo) return;
              onGuardar(mazo, a, r, true);
              setA('');
              setR('');
            }}
          />
          <BotonFocus titulo={t('focus:hojas.guardar')} disabled={!ok} style={styles.flex} onPress={() => ok && mazo && onGuardar(mazo, a, r, false)} />
        </View>
      }
    >
      <Elegir etiqueta={t('focus:hojas.mazo')} opciones={mazos.map((m) => ({ valor: m.id, titulo: m.nombre }))} valor={mazo} onCambiar={setMazo} />
      <Campo etiqueta={t('focus:hojas.anverso')} ayuda={t('focus:hojas.anversoAyuda')} value={a} onChangeText={setA} maxLength={500} multiline estiloBloque={styles.campo} />
      <Campo etiqueta={t('focus:hojas.reverso')} value={r} onChangeText={setR} maxLength={1000} multiline style={styles.multilinea} estiloBloque={styles.campo} />
    </Sheet>
  );
}

// ── Repaso (flashcards y temas con la repetición espaciada) ──────────

export interface ItemRepaso {
  id: string;
  tipo: 'tarjeta' | 'tema';
  pregunta: string;
  respuesta: string | null;
  contexto: string;
}

export function HojaRepaso({
  visible,
  items,
  onClose,
  onResultado,
}: {
  visible: boolean;
  items: ItemRepaso[];
  onClose: () => void;
  onResultado: (item: ItemRepaso, r: Resultado) => void;
}) {
  const [i, setI] = useState(0);
  const [ver, setVer] = useState(false);
  useEffect(() => {
    if (visible) {
      setI(0);
      setVer(false);
    }
  }, [visible]);
  const item = items[i];
  const responder = (r: Resultado) => {
    if (!item) return;
    onResultado(item, r);
    setVer(false);
    setI((x) => x + 1);
  };
  const fin = !item;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={fin ? t('focus:repaso.eyebrow') : t('focus:repaso.progreso', { n: i + 1, total: items.length })}
      title={fin ? t('focus:repaso.finTitulo') : item.contexto || t('focus:repaso.eyebrow')}
      footer={
        fin ? (
          <Pie titulo={t('focus:repaso.cerrar')} onPress={onClose} />
        ) : !ver ? (
          <Pie titulo={t('focus:repaso.mostrar')} onPress={() => setVer(true)} />
        ) : (
          <View style={styles.pieDos}>
            <BotonFocus titulo={t('focus:repaso.mal')} variante="contorno" style={styles.flex} onPress={() => responder('mal')} />
            <BotonFocus titulo={t('focus:repaso.dudosa')} variante="contorno" style={styles.flex} onPress={() => responder('dudosa')} />
            <BotonFocus titulo={t('focus:repaso.bien')} style={styles.flex} onPress={() => responder('bien')} />
          </View>
        )
      }
    >
      {fin ? (
        <Text style={textoFocus.cuerpo} maxFontSizeMultiplier={1.5}>
          {items.length === 0 ? t('focus:repaso.nada') : t('focus:repaso.fin', { count: items.length })}
        </Text>
      ) : (
        <View style={styles.tarjetaRepaso}>
          <Text style={styles.pregunta} maxFontSizeMultiplier={1.5}>
            {item.pregunta}
          </Text>
          {ver ? (
            <Text style={[textoFocus.fila, styles.respuesta]} maxFontSizeMultiplier={1.5}>
              {item.respuesta ?? t('focus:repaso.temaRespuesta')}
            </Text>
          ) : (
            <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
              {item.tipo === 'tema' ? t('focus:repaso.temaPista') : t('focus:repaso.pista')}
            </Text>
          )}
        </View>
      )}
    </Sheet>
  );
}

// ── Método de estudio ────────────────────────────────────────────────

export function HojaMetodo({ visible, metodo, onClose, onAccion }: { visible: boolean; metodo: Metodo | null; onClose: () => void; onAccion: (m: Metodo) => void }) {
  if (!metodo) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;
  const base = `focus:metodos.${metodo.id}`;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={t('focus:metodos.eyebrow')}
      title={tf(`${base}.nombre`)}
      footer={<Pie titulo={t(`focus:metodos.accion.${metodo.accion}`)} onPress={() => onAccion(metodo)} />}
    >
      <Text style={textoFocus.fila} maxFontSizeMultiplier={1.5}>
        {tf(`${base}.que`)}
      </Text>
      <Rotulo texto={t('focus:metodos.comoRotulo')} style={styles.seccion} />
      {Array.from({ length: metodo.pasos }, (_, i) => (
        <FilaFocus key={i} primera={i === 0} style={styles.filaAlta}>
          <Text style={styles.numero} maxFontSizeMultiplier={1.35}>
            {i + 1}
          </Text>
          <Text style={[textoFocus.fila, styles.flex]} maxFontSizeMultiplier={1.5}>
            {tf(`${base}.pasos.${i}`)}
          </Text>
        </FilaFocus>
      ))}
      <Rotulo texto={t('focus:metodos.porQueRotulo')} style={styles.seccion} />
      <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
        {tf(`${base}.porQue`)}
      </Text>
    </Sheet>
  );
}

// ── Ajustes del pomodoro ─────────────────────────────────────────────

function Pasos({ etiqueta, valor, opciones, sufijo, onCambiar }: { etiqueta: string; valor: number; opciones: number[]; sufijo: string; onCambiar: (n: number) => void }) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
        {etiqueta}
      </Text>
      <View style={styles.chips}>
        {opciones.map((o) => (
          <ChipFocus key={o} titulo={conSufijo(o, sufijo)} activo={o === valor} onPress={() => onCambiar(o)} />
        ))}
      </View>
    </View>
  );
}

const conSufijo = (n: number, sufijo: string) => `${n} ${sufijo}`; // i18n-ok: cifra y unidad ya traducida
const entre = (xs: number[], [a, b]: readonly [number, number]) => xs.filter((x) => x >= a && x <= b);

const MINUTOS_DIA = [30, 60, 90, 120, 180, 240, 300, 360, 480];

export function HojaAjustes({
  visible,
  config,
  prefs,
  hoy,
  onClose,
  onGuardar,
}: {
  visible: boolean;
  config: ConfigPomodoro;
  /** Sin ellas, solo el pomodoro. */
  prefs?: PrefsFocus;
  hoy?: string;
  onClose: () => void;
  onGuardar: (c: ConfigPomodoro, prefs?: PrefsFocus) => void;
}) {
  const [c, setC] = useState(config);
  const [minutosDia, setMinutosDia] = useState(prefs?.minutosDia ?? 120);
  const [hasta, setHasta] = useState('');
  useEffect(() => {
    if (!visible) return;
    setC(config);
    setMinutosDia(prefs?.minutosDia ?? 120);
    setHasta(prefs?.sinClasesHasta ? fechaCorta(prefs.sinClasesHasta) : '');
  }, [visible, config, prefs]);
  const min = t('focus:ajustes.min');
  const leida = hasta.trim() && hoy ? leerFechaEs(hasta, hoy) : null;
  const hastaMal = hasta.trim().length > 0 && leida === null;
  const conClases = prefs?.perfil !== 'oposicion';
  const guardar = () => {
    if (hastaMal) return;
    onGuardar(c, prefs ? { ...prefs, minutosDia, sinClasesHasta: conClases ? leida : prefs.sinClasesHasta } : undefined);
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={t('focus:ajustes.eyebrow')}
      title={t('focus:ajustes.titulo')}
      footer={<Pie titulo={t('focus:hojas.guardar')} disabled={hastaMal} onPress={guardar} />}
    >
      {prefs ? (
        <>
          <Pasos
            etiqueta={t('focus:ajustes.minutosDia')}
            valor={minutosDia}
            opciones={MINUTOS_DIA.includes(minutosDia) ? MINUTOS_DIA : [...MINUTOS_DIA, minutosDia].sort((a, b) => a - b)}
            sufijo={min}
            onCambiar={setMinutosDia}
          />
          {conClases ? (
            <View style={styles.campo}>
              <Campo
                etiqueta={t('focus:ajustes.sinClases')}
                ayuda={leida ? t('focus:hojas.fechaLeida', { fecha: fechaCorta(leida) }) : t('focus:ajustes.sinClasesAyuda')}
                error={hastaMal ? t('focus:hojas.fechaError') : undefined}
                value={hasta}
                onChangeText={setHasta}
                maxLength={12}
              />
            </View>
          ) : null}
        </>
      ) : null}
      <Pasos etiqueta={t('focus:ajustes.foco')} valor={c.foco} opciones={entre([15, 20, 25, 30, 45, 50, 60, 90], LIMITES.foco)} sufijo={min} onCambiar={(foco) => setC({ ...c, foco })} />
      <Pasos etiqueta={t('focus:ajustes.descanso')} valor={c.descanso} opciones={entre([3, 5, 10, 15], LIMITES.descanso)} sufijo={min} onCambiar={(descanso) => setC({ ...c, descanso })} />
      <Pasos etiqueta={t('focus:ajustes.largo')} valor={c.largo} opciones={entre([10, 15, 20, 30], LIMITES.largo)} sufijo={min} onCambiar={(largo) => setC({ ...c, largo })} />
      <Pasos
        etiqueta={t('focus:ajustes.cadaLargo')}
        valor={c.cadaLargo}
        opciones={entre([2, 3, 4, 5, 6], LIMITES.cadaLargo)}
        sufijo={t('focus:ajustes.bloques')}
        onCambiar={(cadaLargo) => setC({ ...c, cadaLargo })}
      />
      <Interruptor_ etiqueta={t('focus:ajustes.sonido')} valor={c.sonido} onCambiar={(sonido) => setC({ ...c, sonido })} />
      <Interruptor_ etiqueta={t('focus:ajustes.encadenar')} ayuda={t('focus:ajustes.encadenarAyuda')} valor={c.encadenar} onCambiar={(encadenar) => setC({ ...c, encadenar })} />
      <BotonFocus titulo={t('focus:ajustes.porDefecto')} variante="texto" pequeno onPress={() => setC(CONFIG_POR_DEFECTO)} style={styles.seccion} />
    </Sheet>
  );
}

function Interruptor_({ etiqueta, ayuda, valor, onCambiar }: { etiqueta: string; ayuda?: string; valor: boolean; onCambiar: (v: boolean) => void }) {
  return (
    <View style={[styles.interruptor, styles.seccion]}>
      <View style={styles.flex}>
        <Text style={textoFocus.fila} maxFontSizeMultiplier={1.35}>
          {etiqueta}
        </Text>
        {ayuda ? (
          <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.5}>
            {ayuda}
          </Text>
        ) : null}
      </View>
      <Interruptor value={valor} onValueChange={onCambiar} accessibilityLabel={etiqueta} />
    </View>
  );
}

// ── Misión que paga el bloque ────────────────────────────────────────

export function HojaMision({
  visible,
  misiones,
  elegida,
  onClose,
  onElegir,
}: {
  visible: boolean;
  misiones: { id: string; titulo: string; xp: number }[];
  elegida: string | null;
  onClose: () => void;
  onElegir: (id: string | null) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} eyebrow={t('focus:mision.eyebrow')} title={t('focus:mision.titulo')}>
      <Text style={textoFocus.cuerpo} maxFontSizeMultiplier={1.5}>
        {t('focus:mision.explica')}
      </Text>
      <View style={styles.seccion}>
        {misiones.map((m, i) => (
          <FilaFocus key={m.id} primera={i === 0} onPress={() => onElegir(m.id)} accessibilityLabel={t('focus:hoy.misionA11y', { titulo: m.titulo, xp: m.xp })}>
            <View style={styles.izq}>
              <Casilla redonda estado={m.id === elegida ? 'hecha' : 'vacia'} />
              <Text style={[textoFocus.fila, styles.flex]} maxFontSizeMultiplier={1.35}>
                {m.titulo}
              </Text>
            </View>
            <Text style={[textoFocus.detalle, styles.xp]} maxFontSizeMultiplier={1.35}>
              {t('focus:hoy.hastaXp', { xp: m.xp })}
            </Text>
          </FilaFocus>
        ))}
        <FilaFocus primera={misiones.length === 0} onPress={() => onElegir(null)}>
          <View style={styles.izq}>
            <Casilla redonda estado={elegida === null ? 'hecha' : 'vacia'} />
            <Text style={[textoFocus.fila, styles.flex]} maxFontSizeMultiplier={1.35}>
              {t('focus:mision.ninguna')}
            </Text>
          </View>
        </FilaFocus>
      </View>
    </Sheet>
  );
}

// ── No molestar: recordatorio honesto ────────────────────────────────

export function HojaNoMolestar({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const pasos = Platform.OS === 'android' ? 'android' : 'ios';
  return (
    <Sheet visible={visible} onClose={onClose} eyebrow={t('focus:noMolestar.eyebrow')} title={t('focus:noMolestar.titulo')} footer={<Pie titulo={t('focus:noMolestar.listo')} onPress={onClose} />}>
      <Text style={textoFocus.fila} maxFontSizeMultiplier={1.5}>
        {t('focus:noMolestar.honesto')}
      </Text>
      <Rotulo texto={t(`focus:noMolestar.${pasos}Rotulo`)} style={styles.seccion} />
      {[0, 1, 2].map((i) => (
        <FilaFocus key={i} primera={i === 0} style={styles.filaAlta}>
          <Text style={styles.numero} maxFontSizeMultiplier={1.35}>
            {i + 1}
          </Text>
          <Text style={[textoFocus.fila, styles.flex]} maxFontSizeMultiplier={1.5}>
            {tf(`focus:noMolestar.${pasos}.${i}`)}
          </Text>
        </FilaFocus>
      ))}
      {Platform.OS === 'ios' ? (
        <>
          <Rotulo texto={t('focus:noMolestar.guiadoRotulo')} style={styles.seccion} />
          <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
            {t('focus:noMolestar.guiadoCuerpo')}
          </Text>
          {[0, 1, 2].map((i) => (
            <FilaFocus key={i} primera={i === 0} style={styles.filaAlta}>
              <Text style={styles.numero} maxFontSizeMultiplier={1.35}>
                {i + 1}
              </Text>
              <Text style={[textoFocus.fila, styles.flex]} maxFontSizeMultiplier={1.5}>
                {tf(`focus:noMolestar.guiado.${i}`)}
              </Text>
            </FilaFocus>
          ))}
        </>
      ) : null}
      <View style={[styles.consejo, styles.seccion]}>
        <Ionicons name="phone-portrait-outline" size={18} color={F.acento} />
        <Text style={[textoFocus.cuerpo, styles.flex]} maxFontSizeMultiplier={1.5}>
          {t('focus:noMolestar.consejo')}
        </Text>
      </View>
    </Sheet>
  );
}

/** Para envolver una lista corta con su rótulo dentro de una hoja. */
export function Bloque({ children }: { children: ReactNode }) {
  return <View style={styles.seccion}>{children}</View>;
}

export const horaClase = (c: Pick<Clase, 'inicio' | 'fin'>) => t('focus:horario.horas', { inicio: hhmm(c.inicio), fin: hhmm(c.fin) });

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grupo: { gap: space.s2, marginTop: space.s4 },
  etiqueta: { fontFamily: tipo.label.family, fontSize: 12, lineHeight: 16, letterSpacing: 2, color: ink.ink6, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s2 },
  campo: { marginTop: space.s4 },
  multilinea: { minHeight: 110, textAlignVertical: 'top' },
  multilineaLote: { minHeight: 140, maxHeight: 320, textAlignVertical: 'top' },
  dos: { flexDirection: 'row', gap: space.s3, marginTop: space.s4 },
  arriba: { marginTop: space.s2 },
  seccion: { marginTop: space.s5 },
  filaAlta: { alignItems: 'flex-start', paddingVertical: space.s3 },
  diaPlan: { width: 64, paddingTop: 1 },
  tipoItem: { color: F.acento },
  tipoApagado: { color: ink.ink6 },
  izq: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  pieDos: { flexDirection: 'row', gap: space.s2 },
  mediaFila: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  tarjetaRepaso: { borderRadius: R.boton, borderWidth: 1, borderColor: F.bordeHeroe, backgroundColor: F.activo, padding: space.s5, minHeight: 180, justifyContent: 'center' },
  pregunta: { fontFamily: tipo.headline.family, fontSize: 22, lineHeight: 28, color: ink.ink10 },
  respuesta: { marginTop: space.s4, paddingTop: space.s4, borderTopWidth: 1, borderTopColor: F.bordeActivo },
  numero: { width: 24, fontFamily: tipo.number.family, fontSize: 17, lineHeight: 21, color: F.acento },
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  xp: { color: F.acento },
  consejo: { flexDirection: 'row', gap: space.s3, alignItems: 'flex-start' },
});
