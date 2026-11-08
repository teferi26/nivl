// NIVL · FOCUS: las hojas de la agenda académica (entregas y simulacros) y las
// piezas que comparte con la hoja de examen. Puras: guardar lo hace useHojasFocus.

import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Campo } from '@/components/arena';
import { Sheet } from '@/components/ui';
import { Interruptor } from '@/components/ui/Interruptor';
import { ink, space, type as tipo } from '@/design/tokens';
import { fechasRapidas, leerFormEntrega, leerFormSimulacro, notaDeSimulacro, type ClaveFechaRapida, type ClavePerfil } from '@/focus/agenda';
import { fechaCorta, hhmm, leerFechaEs, sumarDias } from '@/focus/fechas';
import { formatoNota } from '@/focus/notas';
import { leerPenalizacion, type EvolucionSimulacros } from '@/focus/simulacroTest';
import type { Asignatura, Examen, Nota } from '@/focus/tipos';
import { t } from '@/i18n';
import { tf } from './textos';
import { BotonFocus, ChipFocus, Rotulo, textoFocus } from './Piezas';

/** Una etiqueta que cambia según el perfil (oposición, universidad, instituto). */
export const porPerfil = (perfil: ClavePerfil, clave: string) => tf(`focus:agenda.perfil.${perfil}.${clave}`);

export const textoFechaRapida = (clave: ClaveFechaRapida) => tf(`focus:agenda.rapida.${clave}`);

const TECLADO_FECHA = Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default';

export function Elegir<T extends string | number>({
  etiqueta,
  opciones,
  valor,
  onCambiar,
}: {
  etiqueta: string;
  opciones: { valor: T; titulo: string }[];
  valor: T | null;
  onCambiar: (v: T) => void;
}) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
        {etiqueta}
      </Text>
      <View style={styles.chips}>
        {opciones.map((o) => (
          <ChipFocus key={String(o.valor)} titulo={o.titulo} activo={o.valor === valor} onPress={() => onCambiar(o.valor)} />
        ))}
      </View>
    </View>
  );
}

/** Fecha escrita a mano con chips para lo habitual. */
export function SelectorFecha({
  valor,
  hoy,
  uso,
  error,
  onCambiar,
}: {
  valor: string;
  hoy: string;
  uso: 'examen' | 'entrega';
  error?: string | null;
  onCambiar: (texto: string) => void;
}) {
  const leida = leerFechaEs(valor, hoy);
  return (
    <>
      <Campo
        etiqueta={t('focus:hojas.fecha')}
        ayuda={leida ? t('focus:hojas.fechaLeida', { fecha: fechaCorta(leida) }) : t('focus:hojas.fechaAyuda')}
        error={error}
        value={valor}
        onChangeText={onCambiar}
        keyboardType={TECLADO_FECHA}
        maxLength={10}
        placeholder={fechaCorta(sumarDias(hoy, 14))}
        estiloBloque={styles.campo}
      />
      <View style={styles.chips}>
        {fechasRapidas(hoy, uso).map((r) => (
          <ChipFocus key={r.clave} titulo={textoFechaRapida(r.clave)} activo={leida === r.fecha} onPress={() => onCambiar(fechaCorta(r.fecha))} />
        ))}
      </View>
    </>
  );
}

export function CampoHora({ valor, ayuda, error, onCambiar }: { valor: string; ayuda: string; error?: string | null; onCambiar: (texto: string) => void }) {
  return (
    <Campo etiqueta={t('focus:agenda.hora')} ayuda={ayuda} error={error} value={valor} onChangeText={onCambiar} keyboardType={TECLADO_FECHA} maxLength={5} placeholder="09:00" estiloBloque={styles.campo} />
  );
}

// ── Entregas y deberes ───────────────────────────────────────────────

export interface EntregaNueva {
  asignaturaId: string;
  titulo: string;
  fecha: string | null;
  hora: number | null;
}

export function HojaEntrega({
  visible,
  asignaturas,
  hoy,
  perfil = 'general',
  entrega,
  onClose,
  onGuardar,
  onBorrar,
}: {
  visible: boolean;
  asignaturas: Asignatura[];
  hoy: string;
  perfil?: ClavePerfil;
  /** La que se edita; sin ella, una nueva para mañana. */
  entrega?: Examen | null;
  onClose: () => void;
  onGuardar: (x: EntregaNueva) => void;
  onBorrar?: () => void;
}) {
  const [asig, setAsig] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [intento, setIntento] = useState(false);
  const primera = asignaturas[0]?.id ?? null;
  const id = entrega?.id ?? null;
  // Se rellena al abrir: releer los datos tras un fallo no borra lo escrito.
  useEffect(() => {
    if (!visible) return;
    setAsig(entrega?.asignaturaId ?? primera);
    setTitulo(entrega?.titulo ?? '');
    setFecha(entrega ? (entrega.fecha ? fechaCorta(entrega.fecha) : '') : fechaCorta(sumarDias(hoy, 1)));
    setHora(entrega?.hora != null ? hhmm(entrega.hora) : '');
    setIntento(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, id, primera, hoy]);
  const r = leerFormEntrega({ fecha, hora, fechaOpcional: !!entrega && entrega.fecha === null }, hoy);
  const ok = !!asig && titulo.trim().length > 0 && r.ok;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={t('focus:hojas.eyebrow')}
      title={porPerfil(perfil, entrega ? 'entregaEditar' : 'entregaNueva')}
      footer={
        <BotonFocus
          titulo={t('focus:hojas.guardar')}
          onPress={() => {
            setIntento(true);
            if (ok && asig) onGuardar({ asignaturaId: asig, titulo, fecha: r.fecha, hora: r.hora });
          }}
        />
      }
    >
      <Elegir etiqueta={t('focus:hojas.asignatura')} opciones={asignaturas.map((a) => ({ valor: a.id, titulo: a.nombre }))} valor={asig} onCambiar={setAsig} />
      <Campo
        etiqueta={t('focus:agenda.entregas.campo')}
        error={intento && titulo.trim().length === 0 ? t('focus:agenda.entregas.campoError') : null}
        value={titulo}
        onChangeText={setTitulo}
        maxLength={120}
        placeholder={porPerfil(perfil, 'entregaEjemplo')}
        estiloBloque={styles.campo}
      />
      <SelectorFecha valor={fecha} hoy={hoy} uso="entrega" error={intento && r.errores.fecha ? t('focus:hojas.fechaError') : null} onCambiar={setFecha} />
      <CampoHora valor={hora} ayuda={t('focus:agenda.entregas.horaAyuda')} error={r.errores.hora ? t('focus:agenda.horaError') : null} onCambiar={setHora} />
      <Text style={[textoFocus.cuerpo, styles.seccion]} maxFontSizeMultiplier={1.5}>
        {t('focus:agenda.entregas.explica')}
      </Text>
      {entrega && onBorrar ? <BotonFocus titulo={t('focus:agenda.entregas.borrar')} variante="texto" pequeno onPress={onBorrar} style={styles.seccion} /> : null}
    </Sheet>
  );
}

// ── Simulacro tipo test ──────────────────────────────────────────────

type OpcionPenalizacion = '0' | '1/3' | '1/4' | 'otra';

/** «Última 6,5 · mejor 7 · media 6,1». */
export function textoEvolucion(e: EvolucionSimulacros): string {
  return t('focus:agenda.simulacro.evolucion', { ultima: formatoNota(e.ultima), mejor: formatoNota(e.mejor), media: formatoNota(e.media) });
}

/** «Sube 0,75 respecto al anterior». null con un solo simulacro. */
export function textoCambio(e: EvolucionSimulacros): string | null {
  if (e.cambio === null) return null;
  if (e.cambio === 0) return t('focus:agenda.simulacro.igual');
  const n = formatoNota(Math.abs(e.cambio));
  return e.cambio > 0 ? t('focus:agenda.simulacro.sube', { n }) : t('focus:agenda.simulacro.baja', { n });
}

export function HojaSimulacro({
  visible,
  asignaturas,
  hoy,
  perfil = 'general',
  inicial,
  evolucionDe,
  onClose,
  onGuardar,
}: {
  visible: boolean;
  asignaturas: Asignatura[];
  hoy: string;
  perfil?: ClavePerfil;
  inicial?: string | null;
  evolucionDe: (asignaturaId: string) => EvolucionSimulacros;
  onClose: () => void;
  onGuardar: (n: Omit<Nota, 'id'>) => void;
}) {
  const [asig, setAsig] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [aciertos, setAciertos] = useState('');
  const [fallos, setFallos] = useState('');
  const [blancos, setBlancos] = useState('');
  const [opcion, setOpcion] = useState<OpcionPenalizacion>('0');
  const [otra, setOtra] = useState('');
  const [negativo, setNegativo] = useState(false);
  const primera = asignaturas[0]?.id ?? null;
  useEffect(() => {
    if (!visible) return;
    setAsig(inicial ?? primera);
    setNombre('');
    setAciertos('');
    setFallos('');
    setBlancos('');
    setOpcion(perfil === 'oposicion' ? '1/3' : '0');
    setOtra('');
    setNegativo(false);
  }, [visible, inicial, primera, perfil]);
  const penalizacion = leerPenalizacion(opcion === 'otra' ? otra : opcion);
  const r = leerFormSimulacro({ aciertos, fallos, blancos, penalizacion, netoNegativo: negativo });
  const previa = asig ? evolucionDe(asig) : null;
  const opciones: { valor: OpcionPenalizacion; titulo: string }[] = [
    { valor: '0', titulo: t('focus:agenda.simulacro.sinResta') },
    { valor: '1/3', titulo: '1/3' },
    { valor: '1/4', titulo: '1/4' },
    { valor: 'otra', titulo: t('focus:agenda.simulacro.otra') },
  ];
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={t('focus:hojas.eyebrow')}
      title={t('focus:agenda.simulacro.titulo')}
      footer={<BotonFocus titulo={t('focus:hojas.guardar')} disabled={!asig || !r} onPress={() => asig && r && onGuardar(notaDeSimulacro(asig, nombre, hoy, r))} />}
    >
      <Elegir etiqueta={t('focus:hojas.asignatura')} opciones={asignaturas.map((a) => ({ valor: a.id, titulo: a.nombre }))} valor={asig} onCambiar={setAsig} />
      <Campo etiqueta={t('focus:agenda.simulacro.nombre')} value={nombre} onChangeText={setNombre} maxLength={100} placeholder={porPerfil(perfil, 'simulacroEjemplo')} estiloBloque={styles.campo} />
      <View style={styles.tres}>
        <Campo etiqueta={t('focus:agenda.simulacro.aciertos')} value={aciertos} onChangeText={setAciertos} keyboardType="number-pad" maxLength={4} estiloBloque={styles.flex} />
        <Campo etiqueta={t('focus:agenda.simulacro.fallos')} value={fallos} onChangeText={setFallos} keyboardType="number-pad" maxLength={4} estiloBloque={styles.flex} />
        <Campo etiqueta={t('focus:agenda.simulacro.blancos')} value={blancos} onChangeText={setBlancos} keyboardType="number-pad" maxLength={4} estiloBloque={styles.flex} />
      </View>
      <Elegir etiqueta={t('focus:agenda.simulacro.penalizacion')} opciones={opciones} valor={opcion} onCambiar={setOpcion} />
      {opcion === 'otra' ? (
        <Campo
          etiqueta={t('focus:agenda.simulacro.otraCampo')}
          ayuda={t('focus:agenda.simulacro.otraAyuda')}
          error={otra.trim() !== '' && penalizacion === null ? t('focus:agenda.simulacro.otraError') : null}
          value={otra}
          onChangeText={setOtra}
          keyboardType={TECLADO_FECHA}
          maxLength={6}
          estiloBloque={styles.campo}
        />
      ) : null}
      <View style={[styles.interruptor, styles.seccion]}>
        <View style={styles.flex}>
          <Text style={textoFocus.fila} maxFontSizeMultiplier={1.35}>
            {t('focus:agenda.simulacro.netoNegativo')}
          </Text>
          <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.5}>
            {t('focus:agenda.simulacro.netoNegativoAyuda')}
          </Text>
        </View>
        <Interruptor value={negativo} onValueChange={setNegativo} accessibilityLabel={t('focus:agenda.simulacro.netoNegativo')} />
      </View>
      <Rotulo texto={t('focus:agenda.simulacro.resultadoRotulo')} style={styles.seccion} />
      {r ? (
        <View style={styles.resultado} accessible accessibilityLabel={t('focus:agenda.simulacro.resultadoA11y', { nota: formatoNota(r.nota), neto: formatoNota(r.neto), total: r.total })}>
          <Text style={textoFocus.cifra} maxFontSizeMultiplier={1}>
            {formatoNota(r.nota)}
          </Text>
          <View style={styles.flex}>
            <Text style={textoFocus.cuerpo} maxFontSizeMultiplier={1.5}>
              {t('focus:agenda.simulacro.sobre10')}
            </Text>
            <Text style={textoFocus.detalle} maxFontSizeMultiplier={1.5}>
              {t('focus:agenda.simulacro.neto', { neto: formatoNota(r.neto), total: r.total, pct: formatoNota(r.porcentaje) })}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={[textoFocus.cuerpo, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:agenda.simulacro.sinDatos')}
        </Text>
      )}
      {r && r.nota < 0 ? (
        <Text style={[textoFocus.detalle, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {t('focus:agenda.simulacro.notaCero')}
        </Text>
      ) : null}
      {previa && previa.ultima !== null ? (
        <Text style={[textoFocus.detalle, styles.arriba]} maxFontSizeMultiplier={1.5}>
          {textoEvolucion(previa)}
        </Text>
      ) : null}
      <Text style={[textoFocus.cuerpo, styles.seccion]} maxFontSizeMultiplier={1.5}>
        {t('focus:agenda.simulacro.explica')}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grupo: { gap: space.s2, marginTop: space.s4 },
  etiqueta: { fontFamily: tipo.label.family, fontSize: 12, lineHeight: 16, letterSpacing: 2, color: ink.ink6, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s2 },
  campo: { marginTop: space.s4 },
  tres: { flexDirection: 'row', gap: space.s3, marginTop: space.s4 },
  seccion: { marginTop: space.s5 },
  arriba: { marginTop: space.s2 },
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  resultado: { flexDirection: 'row', alignItems: 'center', gap: space.s4, marginTop: space.s2 },
});
