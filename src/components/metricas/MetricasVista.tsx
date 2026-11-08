// NIVL · Métricas y opiniones: la vista. Pura, todo llega por props. Herramienta
// interna en español: no se traduce. Blanco y negro: manda la cifra.

import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { EncabezadoArena, FranjaCifras } from '@/components/arena';
import { Card, Chip, ChipRow, EmptyState, RowValue, Screen, Section, SkeletonRows, volver } from '@/components/ui';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import type { Metricas } from '@/lib/metricas';
import { alturas, hace, pasosClave, retencion, type Opinion } from '@/lib/metricasAdmin';
import type { MetricasVistaProps } from './useMetricas';

const LISTA = { paddingHorizontal: 16, paddingVertical: 2 } as const;

export function MetricasVista(p: MetricasVistaProps) {
  const atras = () => volver(router);
  if (p.loaded && p.admin === false) {
    return (
      <Screen>
        <EncabezadoArena eyebrow="Admin" titulo="Sin acceso" onVolver={atras} />
        <EmptyState icon="lock-closed-outline" title="Esta zona es del equipo" body="Tu cuenta no tiene permiso de administración." />
      </Screen>
    );
  }
  return (
    <Screen refreshing={p.refreshing} onRefresh={p.onRefresh}>
      <EncabezadoArena eyebrow="Admin" titulo="Métricas" subtitulo="Cómo va NIVL, en 30 días." onVolver={atras} />
      {p.error ? <Card variant="outline"><Text style={styles.error} accessibilityRole="alert">{p.error}</Text></Card> : null}
      <ChipRow style={styles.pestanas}>
        <Chip label="Métricas" selected={p.pestana === 'metricas'} onPress={() => p.onPestana('metricas')} />
        <Chip label={p.opiniones.length ? `Opiniones (${p.opiniones.length})` : 'Opiniones'} selected={p.pestana === 'opiniones'} onPress={() => p.onPestana('opiniones')} />
      </ChipRow>
      {!p.loaded ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Cargando las métricas"><SkeletonRows rows={5} /></View>
      ) : p.pestana === 'metricas' ? (
        <VistaMetricas metricas={p.metricas} />
      ) : (
        <VistaOpiniones opiniones={p.opiniones} />
      )}
    </Screen>
  );
}

function VistaMetricas({ metricas }: { metricas: Metricas | null }) {
  if (!metricas) return <EmptyState icon="stats-chart-outline" title="Sin métricas ahora" body="Desliza hacia abajo para reintentarlo." />;
  const { resumen: r } = metricas;
  const ret = retencion(metricas.retencion);
  const altas = metricas.altas.map((d) => Number(d.altas) || 0);
  const barras = alturas(altas);
  const suma = altas.reduce((a, b) => a + b, 0);
  return (
    <>
      <Section title="La base">
        <Card>
          <FranjaCifras cifras={[{ valor: r.usuarios, rotulo: 'Usuarios' }, { valor: r.suscripciones, rotulo: 'De pago' }, { valor: r.instalaciones, rotulo: 'Instalan' }]} />
        </Card>
      </Section>
      <Section title="Activos">
        <Card>
          <FranjaCifras cifras={[{ valor: r.activosHoy, rotulo: 'Hoy' }, { valor: r.activos7, rotulo: '7 días' }, { valor: r.activos30, rotulo: '30 días' }]} />
        </Card>
      </Section>
      <Section title="Altas" meta={`${suma} en 30 días`}>
        <Card>
          <View style={styles.barras} accessible accessibilityRole="image" accessibilityLabel={`${suma} altas en los últimos 30 días. Hoy, ${r.altasHoy}.`}>
            {barras.map((h, i) => (
              <View key={metricas.altas[i]?.dia ?? i} style={styles.barraHueco}>
                <View style={[styles.barra, { height: `${Math.max(h * 100, 3)}%` }, h === 0 && styles.barraVacia]} />
              </View>
            ))}
          </View>
          <View style={styles.bajoBarras}>
            <FranjaCifras cifras={[{ valor: r.altasHoy, rotulo: 'Hoy' }, { valor: r.altas7, rotulo: '7 días' }, { valor: r.onboarding, rotulo: 'Inicio hecho' }]} />
          </View>
        </Card>
      </Section>
      <Section title="Dónde se quedan" meta="30 días">
        <Card padded={false} style={LISTA}>
          {pasosClave(metricas.embudo).map((f, i) => (
            <View key={f.paso} style={[styles.paso, i > 0 && styles.pasoLinea]} accessible accessibilityLabel={`${f.rotulo}: ${f.instalaciones}, ${f.porcentaje} por ciento`}>
              <View style={styles.pasoFila}>
                <Text style={styles.pasoRotulo} numberOfLines={1}>{f.rotulo}</Text>
                <Text style={styles.pasoValor}>{f.instalaciones} · {Math.round(f.porcentaje)} %</Text>
              </View>
              <View style={styles.pista}><View style={[styles.relleno, { width: `${f.porcentaje}%` }]} /></View>
            </View>
          ))}
        </Card>
      </Section>
      <Section title="Vuelven" meta={`${ret.instalaciones} instalaciones`}>
        <Card>
          <FranjaCifras cifras={[{ valor: ret.d1, sufijo: '%', rotulo: 'Día 1' }, { valor: ret.d3, sufijo: '%', rotulo: 'Día 3' }, { valor: ret.d7, sufijo: '%', rotulo: 'Día 7' }]} />
        </Card>
      </Section>
    </>
  );
}

function VistaOpiniones({ opiniones }: { opiniones: Opinion[] }) {
  if (!opiniones.length) return <EmptyState icon="chatbox-outline" title="Sin opiniones aún" body="Aquí saldrá lo que la gente escriba desde la app." />;
  return (
    <>
      {opiniones.map((o) => (
        <Card key={o.id}>
          <View style={styles.opinionCabeza}>
            <Text style={styles.meta}>{hace(o.created_at)}</Text>
            {o.version ? <RowValue>{o.version}</RowValue> : null}
          </View>
          {o.gusta ? <Bloque rotulo="Le gusta" texto={o.gusta} /> : null}
          {o.cambiaria ? <Bloque rotulo="Cambiaría" texto={o.cambiaria} /> : null}
        </Card>
      ))}
    </>
  );
}

function Bloque({ rotulo, texto }: { rotulo: string; texto: string }) {
  return (
    <View style={styles.bloque}>
      <Text style={styles.rotulo}>{rotulo.toUpperCase()}</Text>
      <Text style={styles.texto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pestanas: { marginBottom: space.s5 },
  error: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink9 },
  barras: { height: 88, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barraHueco: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barra: { backgroundColor: ink.ink10 },
  barraVacia: { backgroundColor: ink.ink3 },
  bajoBarras: { marginTop: space.s4, paddingTop: space.s4, borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  paso: { paddingVertical: space.s3 },
  pasoLinea: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  pasoFila: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s3, marginBottom: space.s2 },
  pasoRotulo: { flex: 1, minWidth: 0, fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink9 },
  pasoValor: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8 },
  pista: { height: 4, backgroundColor: ink.ink3 },
  relleno: { height: 4, backgroundColor: ink.ink10 },
  opinionCabeza: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8 },
  bloque: { marginTop: space.s3 },
  rotulo: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, lineHeight: tipo.micro.lineHeight, letterSpacing: tipo.micro.tracking, color: ink.ink8, marginBottom: space.s1, marginTop: space.s2 },
  texto: { fontFamily: tipo.body.family, fontSize: tipo.body.size, lineHeight: tipo.body.lineHeight, color: ink.ink9 },
});
