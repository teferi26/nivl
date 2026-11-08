// NIVL · Resistencia: la hoja de la carrera objetivo (pura). El formulario y su
// guardado viven en useCarrera; aquí, los campos, la validación y la previa del
// plan, que sale de `generarPlan`: lo que se enseña es lo que se va a crear.

import { StyleSheet, Text, View } from 'react-native';
import { Campo, ErrorSistema } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { decimal } from '@/i18n/formato';
import { isValidKey } from '@/lib/dates';
import { DISTANCIAS, generarPlan, type DistanciasPrueba, type TipoPrueba } from '@/lib/planCarrera';
import type { NivelCarrera, NuevoObjetivo, ObjetivoCarrera } from '@/lib/resistencia';

export const TIPOS_PRUEBA: readonly TipoPrueba[] = ['sprint', 'olimpico', 'medio', 'ironman', '5k', '10k', 'media', 'maraton', 'otra'];
export const NIVELES: readonly NivelCarrera[] = ['principiante', 'intermedio', 'avanzado'];

export interface FormObjetivo {
  tipo: TipoPrueba;
  nombre: string;
  /** DD/MM/AAAA, tal como se teclea. */
  fecha: string;
  horas: string;
  nivel: NivelCarrera;
  /** Solo con `otra`: natación en metros, bici y carrera en km. */
  natacion: string;
  bici: string;
  carrera: string;
}

export interface ErroresObjetivo {
  fecha: string | null;
  horas: string | null;
  distancias: string | null;
  /** Lo que ha contestado el sistema al guardar, ya escrito para el usuario. */
  servidor: string | null;
}

export const SIN_ERRORES: ErroresObjetivo = { fecha: null, horas: null, distancias: null, servidor: null };

export const FORM_INICIAL: FormObjetivo = {
  tipo: 'olimpico',
  nombre: '',
  fecha: '',
  horas: '6',
  nivel: 'intermedio',
  natacion: '',
  bici: '',
  carrera: '',
};

const HORAS_MIN = 2;
const HORAS_MAX = 30;
/** Más allá de dos años no es un plan: es un deseo. */
const ANIOS_MAX = 2;

/** «27/12/2026» a «2026-12-27», o null si ese día no existe. */
export function leerFecha(texto: string): string | null {
  const m = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(texto);
  if (!m) return null;
  const key = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  if (!isValidKey(key)) return null;
  const [a, mes, d] = key.split('-').map(Number);
  const f = new Date(Date.UTC(a!, mes! - 1, d!));
  return f.getUTCMonth() === mes! - 1 && f.getUTCDate() === d ? key : null;
}

/** El formulario con la prueba activa: cambiar las horas no obliga a reescribirlo todo. */
export function formDeObjetivo(o: ObjetivoCarrera): FormObjetivo {
  const coma = (n: number) => String(n).replace('.', ',');
  const otra = o.tipo === 'otra';
  return {
    tipo: o.tipo,
    nombre: o.nombre ?? '',
    fecha: `${o.fecha.slice(8, 10)}/${o.fecha.slice(5, 7)}/${o.fecha.slice(0, 4)}`,
    horas: coma(o.horas_semana),
    nivel: o.nivel,
    natacion: otra && o.natacion_m ? String(o.natacion_m) : '',
    bici: otra && o.bici_m ? coma(o.bici_m / 1000) : '',
    carrera: otra && o.carrera_m ? coma(o.carrera_m / 1000) : '',
  };
}

function numero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (limpio === '') return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function distanciasDe(form: FormObjetivo): DistanciasPrueba | null {
  if (form.tipo !== 'otra') return DISTANCIAS[form.tipo];
  const d: DistanciasPrueba = {
    natacion_m: Math.round(numero(form.natacion) ?? 0),
    bici_m: Math.round((numero(form.bici) ?? 0) * 1000),
    carrera_m: Math.round((numero(form.carrera) ?? 0) * 1000),
  };
  return d.natacion_m + d.bici_m + d.carrera_m > 0 ? d : null;
}

function sumarAnios(key: string, anios: number): string {
  return `${Number(key.slice(0, 4)) + anios}${key.slice(4)}`;
}

export type ValidacionObjetivo = { ok: true; nuevo: NuevoObjetivo; distancias: DistanciasPrueba } | { ok: false; errores: ErroresObjetivo };

export function validarObjetivo(form: FormObjetivo, hoy: string): ValidacionObjetivo {
  const errores: ErroresObjetivo = { ...SIN_ERRORES };
  const fecha = leerFecha(form.fecha);
  if (!fecha) errores.fecha = t('resistenciaPlan:hoja.errorFecha');
  else if (fecha <= hoy) errores.fecha = t('resistenciaPlan:hoja.errorFechaPasada');
  else if (fecha > sumarAnios(hoy, ANIOS_MAX)) errores.fecha = t('resistenciaPlan:hoja.errorFechaLejos');

  const horas = numero(form.horas);
  if (horas === null || horas < HORAS_MIN || horas > HORAS_MAX) {
    errores.horas = t('resistenciaPlan:hoja.errorHoras', { min: HORAS_MIN, max: HORAS_MAX });
  }
  const distancias = distanciasDe(form);
  if (!distancias) errores.distancias = t('resistenciaPlan:hoja.errorDistancias');

  if (errores.fecha || errores.horas || errores.distancias || !fecha || horas === null || !distancias) {
    return { ok: false, errores };
  }
  return {
    ok: true,
    distancias,
    nuevo: {
      tipo: form.tipo,
      nombre: form.nombre.trim() || null,
      fecha,
      natacion_m: distancias.natacion_m || null,
      bici_m: distancias.bici_m || null,
      carrera_m: distancias.carrera_m || null,
      horas_semana: horas,
      nivel: form.nivel,
    },
  };
}

export interface PreviaPlan {
  semanas: number;
  horasPico: number;
  plazoCorto: boolean;
}

/** Lo que saldría con este formulario, o null si aún no es válido. */
export function previaPlan(form: FormObjetivo, hoy: string): PreviaPlan | null {
  const v = validarObjetivo(form, hoy);
  if (!v.ok) return null;
  const plan = generarPlan({
    tipo: form.tipo,
    fecha_prueba: v.nuevo.fecha,
    hoy,
    horas_semana: v.nuevo.horas_semana,
    distancias: form.tipo === 'otra' ? v.distancias : undefined,
    nivel: form.nivel,
  });
  if (plan.semanas.length === 0) return null;
  return { semanas: plan.semanas.length, horasPico: Math.max(...plan.semanas.map((s) => s.horas)), plazoCorto: plan.aviso !== null };
}

export interface HojaObjetivoProps {
  visible: boolean;
  form: FormObjetivo;
  errores: ErroresObjetivo;
  previa: PreviaPlan | null;
  guardando: boolean;
  /** Ya hay un objetivo: este lo sustituye. */
  reemplaza: boolean;
  onCambiar: (cambios: Partial<FormObjetivo>) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaObjetivo({ visible, form, errores, previa, guardando, reemplaza, onCambiar, onGuardar, onCerrar }: HojaObjetivoProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow={t('resistenciaPlan:hoja.eyebrow')}
      title={reemplaza ? t('resistenciaPlan:hoja.tituloCambiar') : t('resistenciaPlan:hoja.titulo')}
      footer={
        <>
          <Button title={t('resistenciaPlan:hoja.crear')} onPress={onGuardar} loading={guardando} />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('resistenciaPlan:hoja.prueba')}
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('resistenciaPlan:hoja.prueba')}>
            <ChipWrap>
              {TIPOS_PRUEBA.map((k) => (
                <Chip key={k} label={t(`resistenciaPlan:tipo.${k}`)} selected={form.tipo === k} onPress={() => onCambiar({ tipo: k })} />
              ))}
            </ChipWrap>
          </View>
        </View>

        {form.tipo === 'otra' ? (
          <View style={styles.grupo}>
            <View style={styles.tres}>
              <Campo
                etiqueta={t('resistenciaPlan:hoja.natacionM')}
                value={form.natacion}
                onChangeText={(natacion) => onCambiar({ natacion })}
                keyboardType="number-pad"
                estiloBloque={styles.flex}
              />
              <Campo
                etiqueta={t('resistenciaPlan:hoja.biciKm')}
                value={form.bici}
                onChangeText={(bici) => onCambiar({ bici })}
                keyboardType="decimal-pad"
                estiloBloque={styles.flex}
              />
              <Campo
                etiqueta={t('resistenciaPlan:hoja.carreraKm')}
                value={form.carrera}
                onChangeText={(carrera) => onCambiar({ carrera })}
                keyboardType="decimal-pad"
                estiloBloque={styles.flex}
              />
            </View>
            {errores.distancias ? (
              <Text style={styles.ayuda} maxFontSizeMultiplier={1.6}>
                {errores.distancias}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Campo
          etiqueta={t('resistenciaPlan:hoja.fecha')}
          placeholder={t('resistenciaPlan:hoja.fechaEjemplo')}
          value={form.fecha}
          onChangeText={(fecha) => onCambiar({ fecha })}
          keyboardType="numbers-and-punctuation"
          error={errores.fecha}
          ayuda={t('resistenciaPlan:hoja.fechaAyuda')}
        />
        <Campo
          etiqueta={t('resistenciaPlan:hoja.nombre')}
          placeholder={t('resistenciaPlan:hoja.nombreEjemplo')}
          value={form.nombre}
          onChangeText={(nombre) => onCambiar({ nombre })}
          maxLength={80}
        />
        <Campo
          etiqueta={t('resistenciaPlan:hoja.horas')}
          value={form.horas}
          onChangeText={(horas) => onCambiar({ horas })}
          keyboardType="decimal-pad"
          error={errores.horas}
          ayuda={t('resistenciaPlan:hoja.horasAyuda')}
        />

        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('resistenciaPlan:hoja.nivel')}
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('resistenciaPlan:hoja.nivel')}>
            <ChipWrap>
              {NIVELES.map((n) => (
                <Chip key={n} label={t(`resistenciaPlan:nivel.${n}`)} selected={form.nivel === n} onPress={() => onCambiar({ nivel: n })} />
              ))}
            </ChipWrap>
          </View>
        </View>

        {previa ? (
          <Text style={styles.previa} maxFontSizeMultiplier={1.6}>
            {t('resistenciaPlan:hoja.previa', { count: previa.semanas, horas: decimal(previa.horasPico, 1) })}
            {previa.plazoCorto ? ` ${t('resistenciaPlan:hoja.previaCorta')}` : ''}
          </Text>
        ) : null}
        {reemplaza ? (
          <Text style={styles.ayuda} maxFontSizeMultiplier={1.6}>
            {t('resistenciaPlan:hoja.reemplaza')}
          </Text>
        ) : null}
        {errores.servidor ? <ErrorSistema compacto mensaje={errores.servidor} /> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pila: { gap: space.s4 },
  grupo: { gap: space.s2 },
  tres: { flexDirection: 'row', gap: space.s2 },
  etiqueta: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  ayuda: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8 },
  previa: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink9 },
});
