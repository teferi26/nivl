// NIVL · Gimnasio: el catálogo de IRON dentro de la hoja «Ejercicio» (Modos
// F1, solo con `modos_activos`). Búsqueda por nombre (idioma de la interfaz o
// español, sin tildes), filtro por grupo muscular en chips y la lista agrupada
// por grupo. Tocar un ejercicio rellena el nombre; el texto libre sigue
// valiendo. Pura: el catálogo no toca Supabase.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Campo } from '@/components/arena';
import { nombreIron } from '@/components/iron/texto';
import { Chip, ChipWrap } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { normalizarNombre } from '@/iron/casar';
import { buscarIron, entradasIron, type EntradaIron } from '@/iron/catalogo';
import type { GrupoMuscular } from '@/iron/tipos';

/** Con la búsqueda vacía y «Todos», no se pintan más filas que estas. */
const TOPE = 60;

export interface CatalogoIronProps {
  /** El nombre que hay ahora en el campo: su fila sale marcada. */
  actual: string;
  onElegir: (nombre: string) => void;
}

export function CatalogoIron({ actual, onElegir }: CatalogoIronProps) {
  const [consulta, setConsulta] = useState('');
  const [grupo, setGrupo] = useState<GrupoMuscular | null>(null);

  const grupos = [...new Set(entradasIron().map((e) => e.grupo))];
  const encontrados = buscarIron(consulta).filter((e) => grupo === null || e.grupo === grupo);
  const visibles = encontrados.slice(0, TOPE);
  const elegido = normalizarNombre(actual);

  const porGrupo = new Map<GrupoMuscular, EntradaIron[]>();
  for (const e of visibles) porGrupo.set(e.grupo, [...(porGrupo.get(e.grupo) ?? []), e]);

  return (
    <View style={styles.pila}>
      <Campo
        etiqueta={t('gym:iron.buscar')}
        value={consulta}
        onChangeText={setConsulta}
        placeholder={t('gym:iron.buscarPlaceholder')}
        accessibilityLabel={t('gym:iron.buscarA11y')}
        autoCorrect={false}
        returnKeyType="search"
      />
      <View accessibilityRole="radiogroup" accessibilityLabel={t('gym:iron.grupoA11y')}>
        <ChipWrap>
          <Chip small label={t('gym:iron.todos')} selected={grupo === null} onPress={() => setGrupo(null)} />
          {grupos.map((g) => (
            <Chip key={g} small label={nombreIron('grupo', g)} selected={grupo === g} onPress={() => setGrupo(g)} />
          ))}
        </ChipWrap>
      </View>

      {visibles.length === 0 ? (
        <Text style={styles.linea} maxFontSizeMultiplier={1.6}>
          {t('gym:iron.sinResultados')}
        </Text>
      ) : (
        [...porGrupo.entries()].map(([g, lista]) => (
          <View key={g}>
            <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
              {nombreIron('grupo', g)}
            </Text>
            {lista.map((e, i) => {
              const marcado = normalizarNombre(e.nombre) === elegido;
              const material = e.ejercicio.material.map((m) => nombreIron('material', m)).join(' · ');
              return (
                <Pressable
                  key={e.id}
                  onPress={() => onElegir(e.nombre)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: marcado }}
                  accessibilityLabel={t('gym:iron.elegirA11y', {
                    nombre: e.nombre,
                    material,
                  })}
                  style={({ pressed }) => [styles.fila, i > 0 && styles.conRegla, pressed && styles.pulsado]}
                >
                  <View style={styles.filaTexto}>
                    <Text style={styles.nombre} numberOfLines={2} maxFontSizeMultiplier={1.35}>
                      {e.nombre}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                      {material}
                    </Text>
                  </View>
                  {marcado ? <Ionicons name="checkmark" size={18} color={ink.ink10} /> : null}
                </Pressable>
              );
            })}
          </View>
        ))
      )}

      {encontrados.length > visibles.length ? (
        <Text style={styles.linea} maxFontSizeMultiplier={1.6}>
          {t('gym:iron.afinar', {
            count: encontrados.length - visibles.length,
          })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s4 },
  rotulo: {
    fontFamily: tipo.label.family,
    fontSize: tipo.label.size,
    lineHeight: tipo.label.lineHeight,
    letterSpacing: tipo.label.tracking,
    textTransform: 'uppercase',
    color: ink.ink6,
    marginBottom: space.s1,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 48,
    paddingVertical: space.s2,
  },
  conRegla: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  pulsado: { backgroundColor: ink.ink2 },
  filaTexto: { flex: 1, minWidth: 0, gap: 2 },
  nombre: {
    fontFamily: tipo.body.family,
    fontSize: tipo.body.size,
    lineHeight: tipo.body.lineHeight,
    color: ink.ink9,
  },
  meta: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
  },
  linea: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
});
