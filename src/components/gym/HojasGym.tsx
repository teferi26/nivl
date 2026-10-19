// NIVL · Gimnasio: las dos hojas (FASE3 Lote E1). Puras: el formulario y los
// cerrojos viven en useGym.
//
//   · HojaDia → chips radio con el día de la semana y Campo «Nombre». Pie:
//     primary «Crear día» + ghost «Cancelar».
//   · HojaEjercicio → Campo «Ejercicio» y series, reps y kg en tres Campo a lo
//     ancho. Pie: primary «Añadir ejercicio» o «Guardar cambios» + ghost.
//
// Los fallos del servidor van en línea (ErrorSistema compacto): nada de avisos
// encima de una hoja abierta ni mientras se cierra.

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Campo, ErrorSistema } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import type { GymDay, GymExercise } from '@/lib/types';
import { CatalogoIron } from './CatalogoIron';
import { nombreDiaIso } from './RutinaSemanal';

/** Los siete días ISO (1 lunes … 7 domingo). */
const DIAS_ISO = [1, 2, 3, 4, 5, 6, 7];

export interface HojaDiaProps {
  visible: boolean;
  /** Día ISO elegido (1 lunes … 7 domingo). */
  diaSemana: number;
  nombre: string;
  guardando: boolean;
  error: string | null;
  onDiaSemana: (d: number) => void;
  onNombre: (v: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaDia({ visible, diaSemana, nombre, guardando, error, onDiaSemana, onNombre, onGuardar, onCerrar }: HojaDiaProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow={t('gym:hojaDia.eyebrow')}
      title={t('gym:hojaDia.titulo')}
      footer={
        <>
          <Button title={t('gym:hojaDia.crear')} onPress={onGuardar} loading={guardando} disabled={!nombre.trim()} />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('gym:hojaDia.dia')}
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('gym:hojaDia.diaA11y')}>
            <ChipWrap>
              {DIAS_ISO.map((d) => {
                const nombreDia = nombreDiaIso(d);
                return (
                  <Chip
                    key={d}
                    label={nombreDia.slice(0, 3)}
                    selected={diaSemana === d}
                    onPress={() => onDiaSemana(d)}
                    accessibilityLabel={nombreDia}
                  />
                );
              })}
            </ChipWrap>
          </View>
        </View>
        <Campo
          etiqueta={t('comun:nombre')}
          value={nombre}
          onChangeText={onNombre}
          placeholder={t('gym:hojaDia.nombrePlaceholder')}
          accessibilityLabel={t('gym:hojaDia.nombreA11y')}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (nombre.trim()) onGuardar();
          }}
        />
        {error ? <ErrorSistema compacto mensaje={error} /> : null}
      </View>
    </Sheet>
  );
}

export interface HojaEjercicioProps {
  visible: boolean;
  /** El día al que va el ejercicio. Se queda puesto al cerrar: el título no se vacía en la salida. */
  dia: GymDay | null;
  /** Con un ejercicio, la hoja edita en vez de crear. */
  editando: GymExercise | null;
  nombre: string;
  series: string;
  reps: string;
  kg: string;
  guardando: boolean;
  error: string | null;
  onNombre: (v: string) => void;
  onSeries: (v: string) => void;
  onReps: (v: string) => void;
  onKg: (v: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
  /** IRON (solo con `modos_activos`): «Elegir del catálogo» bajo el nombre. */
  catalogo?: boolean;
}

export function HojaEjercicio({
  visible,
  dia,
  editando,
  nombre,
  series,
  reps,
  kg,
  guardando,
  error,
  onNombre,
  onSeries,
  onReps,
  onKg,
  onGuardar,
  onCerrar,
  catalogo = false,
}: HojaEjercicioProps) {
  // El catálogo se pliega al cerrar la hoja: la próxima vez empieza cerrado.
  const [abierto, setAbierto] = useState(false);
  const [visibleAntes, setVisibleAntes] = useState(visible);
  if (visible !== visibleAntes) {
    setVisibleAntes(visible);
    if (!visible) setAbierto(false);
  }
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow={
        dia
          ? t(editando ? 'gym:hojaEjercicio.eyebrowEditarDia' : 'gym:hojaEjercicio.eyebrowNuevoDia', { dia: dia.name })
          : t(editando ? 'gym:hojaEjercicio.eyebrowEditar' : 'gym:hojaEjercicio.eyebrowNuevo')
      }
      title={editando ? editando.name : t('gym:hojaEjercicio.tituloNuevo')}
      footer={
        <>
          <Button
            title={editando ? t('comun:guardarCambios') : t('gym:hojaEjercicio.anadir')}
            onPress={onGuardar}
            loading={guardando}
            disabled={!nombre.trim()}
          />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Campo
          etiqueta={t('gym:hojaEjercicio.ejercicio')}
          value={nombre}
          onChangeText={onNombre}
          placeholder={t('gym:hojaEjercicio.ejercicioPlaceholder')}
          accessibilityLabel={t('gym:hojaEjercicio.ejercicioA11y')}
        />
        {catalogo ? (
          <View style={styles.grupo}>
            <Button
              title={abierto ? t('gym:iron.cerrarCatalogo') : t('gym:iron.abrirCatalogo')}
              variant="secondary"
              size="sm"
              icon={abierto ? 'chevron-up' : 'list-outline'}
              onPress={() => setAbierto((a) => !a)}
              style={styles.botonCatalogo}
            />
            {abierto ? (
              <CatalogoIron
                actual={nombre}
                onElegir={(n) => {
                  onNombre(n);
                  setAbierto(false);
                }}
              />
            ) : null}
          </View>
        ) : null}
        <View style={styles.tres}>
          <Campo
            etiqueta={t('gym:hojaEjercicio.series')}
            value={series}
            onChangeText={onSeries}
            keyboardType="number-pad"
            accessibilityLabel={t('gym:hojaEjercicio.seriesA11y')}
            estiloBloque={styles.columna}
          />
          <Campo
            etiqueta={t('gym:hojaEjercicio.reps')}
            value={reps}
            onChangeText={onReps}
            keyboardType="number-pad"
            accessibilityLabel={t('gym:hojaEjercicio.repsA11y')}
            estiloBloque={styles.columna}
          />
          <Campo
            etiqueta="Kg" // i18n-ok: unidad
            value={kg}
            onChangeText={onKg}
            keyboardType="decimal-pad"
            placeholder="-"
            accessibilityLabel={t('gym:hojaEjercicio.kgA11y')}
            estiloBloque={styles.columna}
          />
        </View>
        <Text style={styles.ayuda} maxFontSizeMultiplier={1.6}>
          {t('gym:hojaEjercicio.ayuda')}
        </Text>
        {error ? <ErrorSistema compacto mensaje={error} /> : null}
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
  tres: { flexDirection: 'row', gap: space.s3 },
  botonCatalogo: { alignSelf: 'flex-start' },
  columna: { flex: 1, minWidth: 0 },
  ayuda: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: -space.s2,
  },
});
