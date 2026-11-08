// NIVL · WORK: la revisión semanal en tres pasos y la carga (puras).

import { StyleSheet, View } from 'react-native';
import { Campo, FranjaCifras, TarjetaArena } from '@/components/arena';
import { Button, Chip, ChipWrap, EmptyState, Row, Section } from '@/components/ui';
import { ink, space } from '@/design/tokens';
import { t } from '@/i18n';
import { fechaCorta } from '@/work/fechas';
import type { ItemRevision, RazonQuedo } from '@/work/tipos';
import { RAZONES_QUEDO } from '@/work/tipos';
import { textoMotivo } from '../textos';
import { PantallaGestion, TextoAyuda, type EstadoPantalla } from './Piezas';
import { claveRazon, duracion, type PasoRevision, type Razones, type VistaCarga, type VistaRevision } from './vistas';

// ── Carga ───────────────────────────────────────────────────────────────

export function TarjetaCarga({ carga }: { carga: VistaCarga }) {
  if (carga.sinDatos) {
    return (
      <Section title={t('trabajogestion:carga.titulo')}>
        <TextoAyuda>{t('trabajogestion:carga.sinDatos')}</TextoAyuda>
      </Section>
    );
  }
  return (
    <Section title={t('trabajogestion:carga.titulo')} meta={t('trabajogestion:carga.ventana')}>
      <TarjetaArena variante="contorno" rotulo={t(`trabajogestion:carga.nivel.${carga.nivel}`)}>
        <FranjaCifras
          cifras={[
            { valor: duracion(carga.reunionesSemanaMin), rotulo: t('trabajogestion:carga.reuniones') },
            { valor: duracion(carga.profundoSemanaMin), rotulo: t('trabajogestion:carga.foco') },
            { valor: carga.diasTarde, rotulo: t('trabajogestion:carga.tardes') },
          ]}
        />
        {carga.senales.map((s, i) => (
          <Row key={s.codigo} first={i === 0} title={t(`trabajogestion:carga.senal.${s.codigo}`, { valor: s.valor })} />
        ))}
      </TarjetaArena>
      <View style={styles.soltar}>
        <TextoAyuda>{carga.soltar ? t(`trabajogestion:carga.soltar.${carga.soltar}`) : t('trabajogestion:carga.nadaQueSoltar')}</TextoAyuda>
      </View>
    </Section>
  );
}

export interface CargaVistaProps extends EstadoPantalla {
  carga: VistaCarga;
}

export function CargaVista({ carga, ...estado }: CargaVistaProps) {
  return (
    <PantallaGestion {...estado} titulo={t('trabajogestion:carga.titulo')} etiquetaCarga={t('trabajogestion:carga.cargandoA11y')} formas={['tarjeta', 'filas']}>
      <TarjetaCarga carga={carga} />
    </PantallaGestion>
  );
}

// ── Revisión ────────────────────────────────────────────────────────────

export interface RevisionVistaProps extends EstadoPantalla {
  vista: VistaRevision;
  carga: VistaCarga;
  paso: PasoRevision;
  razones: Razones;
  tres: string[];
  guardando: boolean;
  /** null mientras no se ha cerrado; si no, las misiones creadas. */
  terminada: { creadas: number } | null;
  /** Ya se revisó esta semana y aún no se ha pedido repasarla. */
  yaHecha: boolean;
  acciones: {
    onSiguiente: () => void;
    onAtras: () => void;
    onRazon: (i: ItemRevision, r: RazonQuedo) => void;
    onTres: (i: number, valor: string) => void;
    onCerrar: () => void;
    onRepasar: () => void;
  };
}

function Paso1({ v }: { v: VistaRevision }) {
  const r = v.resumen;
  if (v.vacia) return <EmptyState compact icon="calendar-outline" title={t('trabajogestion:revision.vaciaTitulo')} body={t('trabajogestion:revision.vaciaCuerpo')} />;
  return (
    <View>
      <FranjaCifras
        cifras={[
          { valor: duracion(r.minutosProfundos), rotulo: t('trabajogestion:revision.foco') },
          { valor: duracion(r.minutosTotales), rotulo: t('trabajogestion:revision.total') },
          { valor: duracion(r.minutosReunion), rotulo: t('trabajogestion:revision.reuniones') },
        ]}
      />
      {r.cerrado.length > 0 ? (
        <TarjetaArena style={styles.arriba}>
          {r.cerrado.map((i, n) => (
            <Row key={i.titulo} first={n === 0} title={i.titulo} done />
          ))}
        </TarjetaArena>
      ) : (
        <View style={styles.arriba}>
          <TextoAyuda>{t('trabajogestion:revision.cerradoVacio')}</TextoAyuda>
        </View>
      )}
    </View>
  );
}

function Paso2({ v, razones, onRazon }: { v: VistaRevision; razones: Razones; onRazon: RevisionVistaProps['acciones']['onRazon'] }) {
  return (
    <View>
      {v.resumen.seQuedo.map((i) => (
        <TarjetaArena key={i.titulo} rotulo={i.titulo} style={styles.tarjeta}>
          <ChipWrap>
            {RAZONES_QUEDO.map((r) => (
              <Chip key={r} label={t(`trabajogestion:revision.razon_${r}`)} selected={razones[claveRazon(i)] === r} onPress={() => onRazon(i, r)} />
            ))}
          </ChipWrap>
        </TarjetaArena>
      ))}
    </View>
  );
}

function Paso3({ v, tres, onTres }: { v: VistaRevision; tres: string[]; onTres: (i: number, valor: string) => void }) {
  return (
    <View>
      <TextoAyuda>{t('trabajogestion:revision.tresAyuda', { fecha: fechaCorta(v.dia) })}</TextoAyuda>
      {tres.map((valor, i) => {
        const propuesta = v.resumen.propuestas.find((p) => p.titulo === valor);
        return (
          <Campo
            key={i}
            etiqueta={t('trabajogestion:revision.prioridad', { n: i + 1 })}
            ayuda={propuesta ? textoMotivo(propuesta.motivo) : undefined}
            value={valor}
            onChangeText={(x) => onTres(i, x)}
            maxLength={120}
            returnKeyType="done"
          />
        );
      })}
    </View>
  );
}

const TITULO_PASO = { 1: 'paso1', 2: 'paso2', 3: 'paso3' } as const satisfies Record<PasoRevision, string>;

export function RevisionVista({ vista: v, carga, paso, razones, tres, guardando, terminada, yaHecha, acciones, ...estado }: RevisionVistaProps) {
  const rango = t('trabajogestion:revision.rango', { desde: fechaCorta(v.resumen.lunes), hasta: fechaCorta(v.resumen.domingo) });
  return (
    <PantallaGestion {...estado} titulo={t('trabajogestion:revision.titulo')} subtitulo={rango} etiquetaCarga={t('trabajogestion:revision.cargandoA11y')} formas={['franja', 'filas']}>
      {terminada ? (
        <TarjetaArena variante="grano" rotulo={t('trabajogestion:revision.hechaTitulo')}>
          <TextoAyuda>{t('trabajogestion:revision.hechaCuerpo', { n: terminada.creadas, fecha: fechaCorta(v.dia) })}</TextoAyuda>
          <Button title={t('comun:volver')} onPress={estado.onVolver} />
        </TarjetaArena>
      ) : yaHecha ? (
        <View>
          <TarjetaArena variante="contorno" rotulo={t('trabajogestion:revision.hechaTitulo')}>
            <TextoAyuda>{t('trabajogestion:revision.yaHecha')}</TextoAyuda>
            {(v.previa?.prioridades ?? []).map((p, i) => (
              <Row key={p} first={i === 0} title={p} />
            ))}
            <Button title={t('trabajogestion:revision.repasar')} variant="secondary" onPress={acciones.onRepasar} style={styles.arriba} />
          </TarjetaArena>
          <TarjetaCarga carga={carga} />
        </View>
      ) : (
        <View>
          {/* Con carga alta se llega aquí desde Hoy buscando qué soltar: va primero. */}
          {paso === 1 && carga.nivel === 'alta' ? <TarjetaCarga carga={carga} /> : null}
          <Section title={t(`trabajogestion:revision.${TITULO_PASO[paso]}`)} meta={t('trabajogestion:revision.paso', { n: paso })}>
            {paso === 1 ? <Paso1 v={v} /> : paso === 2 ? <Paso2 v={v} razones={razones} onRazon={acciones.onRazon} /> : <Paso3 v={v} tres={tres} onTres={acciones.onTres} />}
          </Section>
          <View style={styles.pie}>
            {paso > 1 ? <Button title={t('trabajogestion:revision.atras')} variant="ghost" onPress={acciones.onAtras} style={styles.flex} /> : null}
            {paso < 3 ? (
              <Button title={t('trabajogestion:revision.siguiente')} onPress={acciones.onSiguiente} style={styles.flex} />
            ) : (
              <Button title={t('trabajogestion:revision.cerrar')} loading={guardando} onPress={acciones.onCerrar} style={styles.flex} />
            )}
          </View>
          {paso === 1 && carga.nivel !== 'alta' ? <TarjetaCarga carga={carga} /> : null}
        </View>
      )}
    </PantallaGestion>
  );
}

const styles = StyleSheet.create({
  arriba: { marginTop: space.s4 },
  tarjeta: { marginBottom: space.s3 },
  soltar: { marginTop: space.s3, borderLeftWidth: 2, borderLeftColor: ink.ink10, paddingLeft: space.s3 },
  pie: { flexDirection: 'row', gap: space.s3, marginTop: space.s4 },
  flex: { flex: 1 },
});
