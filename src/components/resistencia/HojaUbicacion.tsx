// NIVL · Resistencia: la ciudad para «Cuándo salir». Pura.
//
// No se usa el GPS: la persona escribe su ciudad. Antes de buscar nada lee qué
// se guarda, para qué, con qué precisión y que puede retirarlo, y lo acepta con
// un gesto propio: hasta entonces no sale ningún texto del móvil.

import { StyleSheet, Text, View } from 'react-native';
import { Campo, ErrorSistema } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { Interruptor } from '@/components/ui/Interruptor';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';

export interface CiudadResultado {
  /** «Madrid, Comunidad de Madrid, España». */
  nombre: string;
  lat: number;
  lon: number;
}

const leerTexto = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : null);
const leerNumero = (x: unknown, tope: number) => (typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= tope ? x : null);

/** Lo que devuelve `prevision?buscar=`, ya creído. Una fila incompleta se descarta. */
export function leerCiudades(data: unknown): CiudadResultado[] {
  if (!Array.isArray(data)) return [];
  const salida: CiudadResultado[] = [];
  for (const fila of data as Record<string, unknown>[]) {
    if (typeof fila !== 'object' || fila === null) continue;
    const base = leerTexto(fila.nombre);
    const lat = leerNumero(fila.lat, 90);
    const lon = leerNumero(fila.lon, 180);
    if (!base || lat === null || lon === null) continue;
    const partes = [base, leerTexto(fila.region), leerTexto(fila.pais)].filter(Boolean);
    salida.push({ nombre: [...new Set(partes)].join(', ').slice(0, 120), lat, lon });
  }
  return salida;
}

export interface HojaUbicacionProps {
  visible: boolean;
  /** La ciudad guardada; null si no hay. */
  actual: string | null;
  acepta: boolean;
  consulta: string;
  resultados: readonly CiudadResultado[];
  /** Ya se buscó y no hubo nada. */
  sinResultados: boolean;
  elegida: CiudadResultado | null;
  buscando: boolean;
  guardando: boolean;
  error: string | null;
  onAcepta: (v: boolean) => void;
  onConsulta: (v: string) => void;
  onBuscar: () => void;
  onElegir: (c: CiudadResultado) => void;
  onGuardar: () => void;
  onRetirar: () => void;
  onCerrar: () => void;
}

const PUNTOS = ['guarda', 'para', 'precision', 'tercero', 'retirada'] as const;

export function HojaUbicacion(p: HojaUbicacionProps) {
  return (
    <Sheet
      visible={p.visible}
      onClose={p.onCerrar}
      eyebrow={t('resistencia:ubicacion.eyebrow')}
      title={t('resistencia:ubicacion.titulo')}
      footer={
        <>
          <Button
            title={t('resistencia:ubicacion.guardar')}
            onPress={p.onGuardar}
            loading={p.guardando}
            disabled={!p.acepta || !p.elegida}
          />
          {p.actual ? (
            <Button title={t('resistencia:ubicacion.retirar')} variant="secondary" onPress={p.onRetirar} disabled={p.guardando} />
          ) : null}
          <Button title={t('comun:cancelar')} variant="ghost" onPress={p.onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        {p.actual ? (
          <Text style={styles.actual} maxFontSizeMultiplier={1.35}>
            {t('resistencia:ubicacion.actual', { ciudad: p.actual })}
          </Text>
        ) : null}

        <View style={styles.grupo}>
          {PUNTOS.map((k) => (
            <View key={k}>
              <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
                {t(`resistencia:ubicacion.${k}Rotulo`)}
              </Text>
              <Text style={styles.texto} maxFontSizeMultiplier={1.6}>
                {t(`resistencia:ubicacion.${k}`)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.fila}>
          <Text style={styles.textoFlex} maxFontSizeMultiplier={1.35}>
            {t('resistencia:ubicacion.acepto')}
          </Text>
          <Interruptor value={p.acepta} onValueChange={p.onAcepta} accessibilityLabel={t('resistencia:ubicacion.acepto')} />
        </View>

        <Campo
          etiqueta={t('resistencia:ubicacion.ciudad')}
          value={p.consulta}
          onChangeText={p.onConsulta}
          editable={p.acepta}
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={p.onBuscar}
          maxLength={80}
        />
        <Button
          title={t('resistencia:ubicacion.buscar')}
          variant="secondary"
          size="sm"
          onPress={p.onBuscar}
          loading={p.buscando}
          disabled={!p.acepta || p.consulta.trim().length < 2}
        />

        {p.resultados.length > 0 ? (
          <View accessibilityRole="radiogroup" accessibilityLabel={t('resistencia:ubicacion.resultados')}>
            <ChipWrap>
              {p.resultados.map((c) => (
                <Chip key={`${c.lat},${c.lon},${c.nombre}`} label={c.nombre} selected={p.elegida === c} onPress={() => p.onElegir(c)} />
              ))}
            </ChipWrap>
          </View>
        ) : p.sinResultados ? (
          <Text style={styles.texto} maxFontSizeMultiplier={1.6}>
            {t('resistencia:ubicacion.sinResultados')}
          </Text>
        ) : null}

        {p.error ? <ErrorSistema compacto mensaje={p.error} /> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s5 },
  grupo: { gap: space.s3 },
  etiqueta: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
  },
  texto: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8 },
  textoFlex: { flex: 1, fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink9 },
  actual: { fontFamily: tipo.body.family, fontSize: tipo.body.size, lineHeight: tipo.body.lineHeight, color: ink.ink9 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: 44 },
});
