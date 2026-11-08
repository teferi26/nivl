// NIVL · Resistencia: la hoja «Registrar entreno». Pura: el formulario vive en
// useHub y el pago en `guardarEntrenoMedido`, la misma puerta del reloj.
//
// `validarEntreno` convierte lo escrito en un EntrenoMedido o en los fallos de
// cada campo. En natación la distancia va en metros; en lo demás, en km.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Campo, ErrorSistema } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { addDays, dateKey, isValidKey } from '@/lib/dates';
import { DEPORTES_ENTRENO, externoManual, type DeporteEntreno, type EntrenoMedido } from '@/lib/entrenoMedido';
import type { Disciplina } from '@/lib/planCarrera';
import { leerFecha } from './HojaObjetivo';

export type DiaEntreno = 'hoy' | 'ayer' | 'otro';
const DIAS: readonly DiaEntreno[] = ['hoy', 'ayer', 'otro'];

export interface FormEntreno {
  deporte: DeporteEntreno;
  dia: DiaEntreno;
  /** DD/MM/AAAA, tal como se teclea; solo cuenta con `dia === 'otro'`. */
  fecha: string;
  /** HH:MM; vacía: acabado ahora si es hoy, mediodía si es otro día. */
  hora: string;
  duracion: string;
  distancia: string;
  fc: string;
  desnivel: string;
  largo: string;
  rpe: string;
  notas: string;
}

export interface ErroresEntreno {
  fecha: string | null;
  hora: string | null;
  duracion: string | null;
  distancia: string | null;
  fc: string | null;
  desnivel: string | null;
  largo: string | null;
  rpe: string | null;
  servidor: string | null;
}

export const SIN_ERRORES_ENTRENO: ErroresEntreno = {
  fecha: null,
  hora: null,
  duracion: null,
  distancia: null,
  fc: null,
  desnivel: null,
  largo: null,
  rpe: null,
  servidor: null,
};

export const FORM_ENTRENO_VACIO: FormEntreno = {
  deporte: 'carrera',
  dia: 'hoy',
  fecha: '',
  hora: '',
  duracion: '',
  distancia: '',
  fc: '',
  desnivel: '',
  largo: '',
  rpe: '',
  notas: '',
};

const DEPORTE_DE_DISCIPLINA: Partial<Record<Disciplina, DeporteEntreno>> = {
  carrera: 'carrera',
  bici: 'bici',
  brick: 'bici',
  natacion: 'piscina',
  fuerza: 'fuerza',
};

/** Lo que el hub ya sabe: la primera sesión pendiente de hoy. */
export function prefillEntreno(sesiones: readonly { disciplina: Disciplina; duracion_min: number; hecha_entreno_id: string | null }[]): Partial<FormEntreno> {
  const s = sesiones.find((x) => !x.hecha_entreno_id && DEPORTE_DE_DISCIPLINA[x.disciplina]);
  if (!s) return {};
  return { deporte: DEPORTE_DE_DISCIPLINA[s.disciplina]!, duracion: s.duracion_min > 0 ? String(s.duracion_min) : '' };
}

export const pideDistancia = (d: DeporteEntreno) => d !== 'fuerza';
export const pideDesnivel = (d: DeporteEntreno) => d === 'carrera' || d === 'bici' || d === 'caminar' || d === 'otro';
export const pideLargo = (d: DeporteEntreno) => d === 'piscina';
export const enMetros = (d: DeporteEntreno) => d === 'piscina' || d === 'aguas_abiertas';

/** Vacío: null. Admite la coma decimal. Lo que no es un número: NaN. */
function numeroDe(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  return limpio === '' ? null : Number(limpio);
}

const fuera = (n: number | null, min: number, max: number) => n !== null && (!Number.isFinite(n) || n < min || n > max);

export type ValidacionEntreno =
  | { ok: true; entrada: EntrenoMedido; rpe: number | null; notas: string }
  | { ok: false; errores: ErroresEntreno };

/** `idUnico` se genera al abrir la hoja: el reintento no crea otro entreno. */
export function validarEntreno(f: FormEntreno, ahora: Date, idUnico: string): ValidacionEntreno {
  const errores: ErroresEntreno = { ...SIN_ERRORES_ENTRENO };
  const hoy = dateKey(ahora);

  const minutos = numeroDe(f.duracion);
  if (minutos === null || fuera(minutos, 1, 2880)) errores.duracion = t('resistencia:hoja.errorDuracion');
  const distanciaBruta = pideDistancia(f.deporte) ? numeroDe(f.distancia) : null;
  const distanciaM = distanciaBruta === null ? null : enMetros(f.deporte) ? distanciaBruta : distanciaBruta * 1000;
  if (fuera(distanciaM, 0, 1000000)) errores.distancia = t('resistencia:hoja.errorDistancia');
  const fc = numeroDe(f.fc);
  if (fuera(fc, 25, 250)) errores.fc = t('resistencia:hoja.errorFc');
  const desnivel = pideDesnivel(f.deporte) ? numeroDe(f.desnivel) : null;
  if (fuera(desnivel, 0, 30000)) errores.desnivel = t('resistencia:hoja.errorDesnivel');
  const largo = pideLargo(f.deporte) ? numeroDe(f.largo) : null;
  if (fuera(largo, 10, 100)) errores.largo = t('resistencia:hoja.errorLargo');
  const rpe = numeroDe(f.rpe);
  if (fuera(rpe, 1, 10)) errores.rpe = t('resistencia:hoja.errorRpe');

  const fecha = f.dia === 'hoy' ? hoy : f.dia === 'ayer' ? addDays(hoy, -1) : (leerFecha(f.fecha) ?? '');
  const [anio, mes, dia] = fecha.split('-').map(Number);
  // `isValidKey` deja pasar el 31 de febrero; Date lo convertiría en marzo.
  const fechaReal = isValidKey(fecha) && dateKey(new Date(anio!, mes! - 1, dia!)) === fecha;
  if (!fechaReal) errores.fecha = t('resistencia:hoja.errorFecha');
  else if (fecha > hoy) errores.fecha = t('resistencia:hoja.errorFuturo');

  const horaTexto = f.hora.trim();
  const hm = /^(\d{1,2}):(\d{2})$/.exec(horaTexto);
  const horaValida = hm !== null && Number(hm[1]) <= 23 && Number(hm[2]) <= 59;
  if (horaTexto !== '' && !horaValida) errores.hora = t('resistencia:hoja.errorHora');

  if (Object.values(errores).some(Boolean) || minutos === null) return { ok: false, errores };

  const duracionS = Math.round(minutos * 60);
  let inicio: Date;
  if (hm && horaValida) inicio = new Date(anio!, mes! - 1, dia!, Number(hm[1]), Number(hm[2]));
  else if (f.dia === 'hoy') inicio = new Date(ahora.getTime() - duracionS * 1000);
  else inicio = new Date(anio!, mes! - 1, dia!, 12, 0);
  if (inicio.getTime() > ahora.getTime()) return { ok: false, errores: { ...errores, hora: t('resistencia:hoja.errorFuturo') } };

  return {
    ok: true,
    rpe,
    notas: f.notas,
    entrada: {
      origen: 'manual',
      externo_id: externoManual(idUnico),
      deporte: f.deporte,
      inicio: inicio.toISOString(),
      fin: new Date(inicio.getTime() + duracionS * 1000).toISOString(),
      duracion_s: duracionS,
      distancia_m: distanciaM,
      kcal: null,
      fc_media: fc,
      fc_max: null,
      desnivel_m: desnivel,
      ruta: null,
      parciales: [],
      largo_piscina_m: largo,
      fc_serie: null,
    },
  };
}

export interface HojaEntrenoProps {
  visible: boolean;
  form: FormEntreno;
  guardando: boolean;
  errores: ErroresEntreno;
  onCambio: (cambios: Partial<FormEntreno>) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaEntreno({ visible, form, guardando, errores, onCambio, onGuardar, onCerrar }: HojaEntrenoProps) {
  const d = form.deporte;
  const unidadMetros = enMetros(d);
  const [masDatos, setMasDatos] = useState(false);
  // Un error dentro del plegado no se puede quedar escondido.
  const abierto = masDatos || !!(errores.hora || errores.fc || errores.rpe || errores.desnivel || errores.largo);
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow={t('resistencia:hoja.eyebrow')}
      title={t('resistencia:hoja.titulo')}
      footer={
        <>
          <Button title={t('resistencia:hub.registrar')} onPress={onGuardar} loading={guardando} />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('resistencia:hoja.deporte')}
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('resistencia:hoja.deporte')}>
            <ChipWrap>
              {DEPORTES_ENTRENO.map((k) => (
                <Chip key={k} label={t(`resistencia:deporte.${k}`)} selected={d === k} onPress={() => onCambio({ deporte: k })} />
              ))}
            </ChipWrap>
          </View>
        </View>

        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('resistencia:hoja.cuando')}
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('resistencia:hoja.cuando')}>
            <ChipWrap>
              {DIAS.map((k) => (
                <Chip key={k} label={t(`resistencia:hoja.dia.${k}`)} selected={form.dia === k} onPress={() => onCambio({ dia: k })} />
              ))}
            </ChipWrap>
          </View>
          {errores.fecha && form.dia !== 'otro' ? (
            <Text style={styles.ayuda} maxFontSizeMultiplier={1.6}>
              {errores.fecha}
            </Text>
          ) : null}
        </View>

        {form.dia === 'otro' ? (
          <Campo
            etiqueta={t('resistencia:hoja.fecha')}
            value={form.fecha}
            onChangeText={(v) => onCambio({ fecha: v })}
            placeholder={t('resistencia:hoja.fechaPlaceholder')}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            error={errores.fecha}
          />
        ) : null}

        <View style={styles.dos}>
          <Campo
            etiqueta={t('resistencia:hoja.duracion')}
            value={form.duracion}
            onChangeText={(v) => onCambio({ duracion: v })}
            keyboardType="decimal-pad"
            error={errores.duracion}
            estiloBloque={styles.columna}
          />
          {pideDistancia(d) ? (
            <Campo
              etiqueta={unidadMetros ? t('resistencia:hoja.distanciaM') : t('resistencia:hoja.distanciaKm')}
              value={form.distancia}
              onChangeText={(v) => onCambio({ distancia: v })}
              keyboardType="decimal-pad"
              error={errores.distancia}
              estiloBloque={styles.columna}
            />
          ) : (
            <View style={styles.columna} />
          )}
        </View>

        <Pressable
          onPress={() => setMasDatos(!abierto)}
          accessibilityRole="button"
          accessibilityState={{ expanded: abierto }}
          style={styles.mas}
        >
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('resistencia:hoja.masDatos')}
          </Text>
          <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={16} color={ink.ink6} />
        </Pressable>

        {abierto ? (
          <>
            <Campo
              etiqueta={t('resistencia:hoja.hora')}
              value={form.hora}
              onChangeText={(v) => onCambio({ hora: v })}
              placeholder={t('resistencia:hoja.horaPlaceholder')}
              keyboardType="numbers-and-punctuation"
              error={errores.hora}
            />
            <View style={styles.dos}>
              <Campo
                etiqueta={t('resistencia:hoja.fc')}
                value={form.fc}
                onChangeText={(v) => onCambio({ fc: v })}
                keyboardType="number-pad"
                error={errores.fc}
                estiloBloque={styles.columna}
              />
              <Campo
                etiqueta={t('resistencia:hoja.rpe')}
                value={form.rpe}
                onChangeText={(v) => onCambio({ rpe: v })}
                keyboardType="decimal-pad"
                error={errores.rpe}
                estiloBloque={styles.columna}
              />
            </View>
            {pideDesnivel(d) ? (
              <Campo
                etiqueta={t('resistencia:hoja.desnivel')}
                value={form.desnivel}
                onChangeText={(v) => onCambio({ desnivel: v })}
                keyboardType="number-pad"
                error={errores.desnivel}
              />
            ) : null}
            {pideLargo(d) ? (
              <Campo
                etiqueta={t('resistencia:hoja.largo')}
                value={form.largo}
                onChangeText={(v) => onCambio({ largo: v })}
                keyboardType="number-pad"
                error={errores.largo}
              />
            ) : null}
            <Campo
              etiqueta={t('resistencia:hoja.notas')}
              value={form.notas}
              onChangeText={(v) => onCambio({ notas: v })}
              multiline
              maxLength={2000}
            />
          </>
        ) : null}

        {errores.servidor ? <ErrorSistema compacto mensaje={errores.servidor} /> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s5 },
  grupo: { gap: space.s2 },
  etiqueta: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  ayuda: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
  mas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  dos: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3 },
  columna: { flex: 1, minWidth: 0 },
});
