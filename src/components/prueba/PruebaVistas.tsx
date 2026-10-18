// NIVL · Prueba automática de Élite (0069): las vistas (puras).
//
// · BienvenidaPrueba: hoja la primera vez que la app ve la prueba activa.
//   Cuántos días, cuándo termina (fecha y hora del teléfono) y TODO lo que
//   incluye, sin prometer lo que la prueba no trae: el coach va en el modelo
//   económico con un tope diario y el modo profundo no entra.
// · FinPrueba: pantalla al vencer sin compra. Dos salidas del MISMO peso
//   (las dos `secondary`, mismo tamaño; ninguna invertida, nada preseleccionado)
//   y, junto a «Seguir con Élite», precio, periodo y renovación (Apple 3.1.2 y
//   Google Play). Debajo, qué conserva y qué deja de tener con el plan gratis.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TarjetaArena } from '@/components/arena';
import { Button, Sheet } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { mayus } from '@/i18n/formato';

function Punto({ icono, children, apagado }: { icono: keyof typeof Ionicons.glyphMap; children: ReactNode; apagado?: boolean }) {
  return (
    <View style={styles.punto}>
      <Ionicons name={icono} size={16} color={apagado ? ink.ink6 : ink.ink10} style={styles.puntoIcono} />
      <Text style={[styles.cuerpo, styles.flex, apagado && styles.apagado]} maxFontSizeMultiplier={1.35}>
        {children}
      </Text>
    </View>
  );
}

function Rotulo({ children }: { children: string }) {
  return (
    <Text style={styles.rotulo} maxFontSizeMultiplier={1.35} accessibilityRole="header">
      {mayus(children)}
    </Text>
  );
}

// ── Bienvenida ─────────────────────────────────────────────────────────

export interface BienvenidaPruebaProps {
  visible: boolean;
  dias: number;
  fecha: string;
  hora: string;
  onCerrar: () => void;
}

/** Lo que incluye la prueba (para la hoja y para las pruebas). */
export function listaIncluye(): { icono: keyof typeof Ionicons.glyphMap; texto: string }[] {
  return [
    { icono: 'sparkles-outline', texto: t('prueba:incluye.coach') },
    { icono: 'calendar-outline', texto: t('prueba:incluye.revision') },
    { icono: 'ribbon-outline', texto: t('prueba:incluye.laurel') },
    { icono: 'people-outline', texto: t('prueba:incluye.ludus') },
  ];
}

export function BienvenidaPrueba({ visible, dias, fecha, hora, onCerrar }: BienvenidaPruebaProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onCerrar}
      eyebrow={t('prueba:bienvenida.eyebrow')}
      title={t('prueba:bienvenida.titulo', { count: dias })}
      footer={<Button title={t('prueba:bienvenida.empezar')} size="lg" onPress={onCerrar} />}
    >
      <Text style={[styles.cuerpo, styles.destacado]} maxFontSizeMultiplier={1.35}>
        {t('prueba:bienvenida.termina', { fecha, hora })}
      </Text>
      <Text style={styles.cuerpo} maxFontSizeMultiplier={1.35}>
        {t('prueba:bienvenida.cuerpo')}
      </Text>

      <Rotulo>{t('prueba:bienvenida.incluye')}</Rotulo>
      {listaIncluye().map((p) => (
        <Punto key={p.texto} icono={p.icono}>
          {p.texto}
        </Punto>
      ))}
      <Punto icono="remove-outline" apagado>
        {t('prueba:incluye.profundo')}
      </Punto>

      <Rotulo>{t('prueba:bienvenida.gratis')}</Rotulo>
      <Text style={styles.cuerpo} maxFontSizeMultiplier={1.35}>
        {t('prueba:gratis.lista')}
      </Text>
    </Sheet>
  );
}

// ── Fin ────────────────────────────────────────────────────────────────

export interface PreciosFin {
  eliteMes: string;
  eliteAnio: string;
  proMes: string;
  /** «5 días» si la tienda declara un periodo gratis para el Élite mensual. */
  introGratis: string | null;
  introCondicional: boolean;
}

export interface FinPruebaProps {
  fecha: string;
  hora: string;
  precios: PreciosFin;
  onSeguir: () => void;
  onQuedarme: () => void;
  ocupado?: boolean;
}

export function FinPrueba({ fecha, hora, precios, onSeguir, onQuedarme, ocupado }: FinPruebaProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.pantalla}
      contentContainerStyle={[styles.contenido, { paddingTop: insets.top + space.s6, paddingBottom: insets.bottom + space.s8 }]}
    >
      <Text style={styles.inscripcion} maxFontSizeMultiplier={1.35}>
        {mayus(t('prueba:fin.eyebrow'))}
      </Text>
      <Text style={styles.titulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
        {t('prueba:fin.titulo')}
      </Text>
      <Text style={styles.cuerpo} maxFontSizeMultiplier={1.35}>
        {t('prueba:fin.cuerpo', { fecha, hora })}
      </Text>

      {/* Las dos salidas, del mismo peso: mismo marco, mismo tamaño. */}
      <TarjetaArena variante="contorno" style={styles.opcion}>
        <Button
          title={t('prueba:fin.seguir')}
          variant="secondary"
          onPress={onSeguir}
          disabled={ocupado}
          accessibilityLabel={t('prueba:fin.seguirA11y')}
        />
        {precios.introGratis ? (
          <Text style={[styles.nota, styles.destacado]} maxFontSizeMultiplier={1.35}>
            {t(precios.introCondicional ? 'prueba:fin.introCondicional' : 'prueba:fin.intro', {
              periodo: precios.introGratis,
              precio: precios.eliteMes,
            })}
          </Text>
        ) : null}
        <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
          {t('prueba:fin.precios', { mes: precios.eliteMes, anio: precios.eliteAnio })}
        </Text>
        <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
          {t('prueba:fin.pro', { precio: precios.proMes })}
        </Text>
      </TarjetaArena>

      <TarjetaArena variante="contorno" style={styles.opcion}>
        <Button title={t('prueba:fin.quedarme')} variant="secondary" onPress={onQuedarme} disabled={ocupado} />
        <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
          {t('prueba:fin.quedarmeNota')}
        </Text>
      </TarjetaArena>

      <Rotulo>{t('prueba:fin.conservas')}</Rotulo>
      <Punto icono="checkmark">{t('prueba:fin.conservasCuerpo')}</Punto>

      <Rotulo>{t('prueba:fin.pierdes')}</Rotulo>
      <Punto icono="remove-outline" apagado>
        {t('prueba:fin.pierdeCoach')}
      </Punto>
      <Punto icono="remove-outline" apagado>
        {t('prueba:fin.pierdeRevision')}
      </Punto>
      <Punto icono="remove-outline" apagado>
        {t('prueba:fin.pierdeLaurel')}
      </Punto>
      <Punto icono="remove-outline" apagado>
        {t('prueba:fin.pierdeLudus')}
      </Punto>

      <Text style={[styles.cuerpo, styles.datos]} maxFontSizeMultiplier={1.35}>
        {t('prueba:fin.datos')}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pantalla: { flex: 1, backgroundColor: ink.ink0 },
  contenido: { paddingHorizontal: space.s5, width: '100%', maxWidth: 560, alignSelf: 'center' },
  inscripcion: {
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink6,
    marginBottom: space.s2,
  },
  titulo: {
    fontFamily: tipo.title.family,
    fontSize: tipo.title.size,
    lineHeight: tipo.title.lineHeight,
    letterSpacing: tipo.title.tracking,
    color: ink.ink10,
    marginBottom: space.s3,
  },
  cuerpo: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  destacado: { color: ink.ink10, fontFamily: tipo.label.family, marginBottom: space.s2 },
  apagado: { color: ink.ink6 },
  rotulo: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    color: ink.ink6,
    marginTop: space.s6,
    marginBottom: space.s3,
    paddingBottom: space.s2,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: ink.ink3,
  },
  punto: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3, marginBottom: space.s3 },
  puntoIcono: { marginTop: 2 },
  opcion: { marginTop: space.s5 },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s3,
  },
  datos: { marginTop: space.s5, color: ink.ink9 },
});
