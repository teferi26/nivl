// NIVL · Galería del embudo de entrada. Solo desarrollo o despliegue de galería.
// /kit/embudo?paso=portada|pregunta|crudo|curva|carga|plan&kind=deportista&tono=duro

import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fijarQuieto } from '@/components/arena/quieto';
import { Cuestionario } from '@/components/embudo/Cuestionario';
import { CargaPlan, PlanNoventa } from '@/components/embudo/PlanNoventa';
import { Portada } from '@/components/embudo/Portada';
import { Button, FondoOnix } from '@/components/ui';
import { GUION, RESPUESTAS_VACIAS, type PasoGuion, type Respuestas, type Tono } from '@/lib/embudo';
import type { ProfileKind } from '@/lib/kinds';
import { GALERIA } from '@/lib/galeria';
import { colors } from '@/lib/theme';
import { t } from '@/i18n';

const META: Record<ProfileKind, string> = { deportista: 'carrera', estudiante: 'oposicion', trabajador: 'ascenso', emprendedor: 'facturar', general: 'disciplina' };

export default function KitEmbudo() {
  const p = useLocalSearchParams<{ paso?: string; kind?: string; tono?: string; guion?: string }>();
  useEffect(() => {
    fijarQuieto(true);
    return () => fijarQuieto(false);
  }, []);
  if (!GALERIA) return <Redirect href="/" />;
  const kind = (p.kind ?? 'deportista') as ProfileKind;
  const tono = (p.tono ?? 'duro') as Tono;
  const r: Respuestas = { ...RESPUESTAS_VACIAS, mejora: ['cuerpo', 'trabajo'], kind, meta: META[kind], cuanto: 'anio', freno: ['tiempo'], coach: 'nunca', min: '30', mom: 'primera', tono };
  const nada = () => {};
  const paso = p.paso ?? 'portada';
  const indice = GUION.indexOf((p.guion ?? paso) as PasoGuion);
  return (
    <SafeAreaView style={styles.fondo}>
      <FondoOnix />
      {paso === 'portada' ? <Portada onCrear={nada} onEntrar={nada} /> : null}
      {indice >= 0 ? <Cuestionario inicial={r} indiceInicial={indice} onTerminar={nada} onSalir={nada} /> : null}
      {paso === 'carga' ? <View style={styles.bloque}><CargaPlan onFin={nada} /></View> : null}
      {paso === 'plan' ? (
        <View style={styles.flex}>
          <ScrollView contentContainerStyle={styles.bloque}><PlanNoventa respuestas={r} /></ScrollView>
          <View style={styles.pie}><Button title={t('onboarding:embudo.plan.empezar')} size="lg" onPress={nada} /></View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, width: '100%', maxWidth: 608, alignSelf: 'center' },
  bloque: { paddingHorizontal: 24, paddingVertical: 24 },
  pie: { paddingHorizontal: 24, paddingBottom: 12 },
});
