// NIVL · WORK: Horas (pura). Hoy y semana por proyecto; por facturar, informativo.

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Campo, FranjaCifras, TarjetaArena } from '@/components/arena';
import { Button, Chip, ChipRow, ChipWrap, EmptyState, Row, RowValue, Section, Sheet } from '@/components/ui';
import { Interruptor } from '@/components/ui/Interruptor';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { fechaCorta, sumarDias } from '@/work/fechas';
import { facturablePorDefecto, leerMinutos, type FilaHorasProyecto } from '@/work/horas';
import type { Proyecto } from '@/work/tipos';
import { PantallaGestion, TextoAyuda, type EstadoPantalla } from './Piezas';
import { duracion, type Apunte, type FilaPorFacturar, type VistaHoras } from './vistas';

export interface HorasVistaProps extends EstadoPantalla {
  vista: VistaHoras;
  hoy: string;
  acciones: {
    onApuntar: () => void;
    onMarcarFacturado: (f: FilaPorFacturar) => void;
    onBorrar: (a: Apunte) => void;
  };
}

const nombreDe = (nombre: string | null) => nombre ?? t('trabajogestion:horas.sinProyecto');

function FilasHoras({ filas }: { filas: FilaHorasProyecto[] }) {
  return (
    <TarjetaArena>
      {filas.map((f, i) => (
        <Row key={f.proyectoId ?? 'nada'} first={i === 0} title={nombreDe(f.nombre)} trailing={<RowValue tone="strong">{duracion(f.minutos)}</RowValue>} />
      ))}
    </TarjetaArena>
  );
}

function detalleFacturar(f: FilaPorFacturar): string {
  return f.porFacturarImporte !== null
    ? t('trabajogestion:horas.conImporte', { horas: duracion(f.porFacturarMin), importe: Math.round(f.porFacturarImporte) })
    : t('trabajogestion:horas.sinImporte', { horas: duracion(f.porFacturarMin) });
}

function etiquetaDia(fecha: string, hoy: string): string {
  if (fecha === hoy) return t('trabajogestion:comun.hoy');
  if (fecha === sumarDias(hoy, -1)) return t('trabajogestion:comun.ayer');
  return fechaCorta(fecha);
}

export function HorasVista({ vista, hoy, acciones, ...estado }: HorasVistaProps) {
  const { porFacturar: pf } = vista;
  return (
    <PantallaGestion
      {...estado}
      titulo={t('trabajogestion:horas.titulo')}
      etiquetaCarga={t('trabajogestion:horas.cargandoA11y')}
      formas={['franja', 'filas']}
      accion={vista.vacio ? undefined : { icono: 'add', etiqueta: t('trabajogestion:horas.apuntar'), onPress: acciones.onApuntar }}
    >
      {vista.vacio ? (
        <EmptyState icon="time-outline" title={t('trabajogestion:horas.vacioTitulo')} body={t('trabajogestion:horas.vacioCuerpo')} action={{ label: t('trabajogestion:horas.apuntar'), onPress: acciones.onApuntar }} />
      ) : (
        <View>
          <FranjaCifras
            cifras={[
              { valor: duracion(vista.hoyMin), rotulo: t('trabajogestion:horas.hoy') },
              { valor: duracion(vista.semana.minutos), rotulo: t('trabajogestion:horas.semana') },
              { valor: duracion(vista.semana.profundos), rotulo: t('trabajogestion:horas.foco') },
            ]}
          />
          <Section title={t('trabajogestion:horas.rotuloHoy')}>
            {vista.filasHoy.length > 0 ? <FilasHoras filas={vista.filasHoy} /> : <TextoAyuda>{t('trabajogestion:horas.hoyVacio')}</TextoAyuda>}
          </Section>
          {vista.filasSemana.length > 0 ? (
            <Section title={t('trabajogestion:horas.rotuloSemana')}>
              <FilasHoras filas={vista.filasSemana} />
            </Section>
          ) : null}
          {pf.filas.length > 0 ? (
            <Section title={t('trabajogestion:horas.rotuloFacturar')}>
              <TextoAyuda>{t('trabajogestion:horas.facturarNota')}</TextoAyuda>
              <TarjetaArena>
                {pf.filas.map((f, i) => (
                  <Row
                    key={f.proyectoId ?? 'nada'}
                    first={i === 0}
                    title={nombreDe(f.nombre)}
                    detail={detalleFacturar(f)}
                    trailing={<Button title={t('trabajogestion:horas.marcar')} variant="ghost" size="sm" onPress={() => acciones.onMarcarFacturado(f)} />}
                  />
                ))}
              </TarjetaArena>
            </Section>
          ) : null}
          {vista.apuntes.length > 0 ? (
            <Section title={t('trabajogestion:horas.rotuloApuntes')}>
              <TarjetaArena>
                {vista.apuntes.map((a, i) => (
                  <Row
                    key={a.sesion.id}
                    first={i === 0}
                    title={nombreDe(a.proyecto)}
                    detail={`${etiquetaDia(a.sesion.fecha, hoy)} · ${t(`trabajogestion:horas.${a.sesion.tipo}`)}`}
                    trailing={<RowValue>{duracion(a.sesion.minutos)}</RowValue>}
                    onPress={a.borrable ? () => acciones.onBorrar(a) : undefined}
                    accessibilityLabel={a.borrable ? t('trabajogestion:horas.borrarA11y', { horas: duracion(a.sesion.minutos) }) : undefined}
                  />
                ))}
              </TarjetaArena>
            </Section>
          ) : null}
        </View>
      )}
    </PantallaGestion>
  );
}

// ── Apuntar ─────────────────────────────────────────────────────────────

export interface ApunteNuevo {
  minutos: number;
  proyectoId: string | null;
  fecha: string;
  facturable: boolean;
}

export interface HojaApuntarProps {
  visible: boolean;
  hoy: string;
  proyectos: Proyecto[];
  guardando: boolean;
  onCerrar: () => void;
  onGuardar: (a: ApunteNuevo) => void;
}

const RAPIDOS = ['0:30', '1:00', '2:00'];

export function HojaApuntar(p: HojaApuntarProps) {
  const [abierta, setAbierta] = useState(p.visible);
  const [tiempo, setTiempo] = useState('');
  const [proyectoId, setProyectoId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(p.hoy);
  const [facturableElegido, setFacturable] = useState<boolean | null>(null);
  const [intento, setIntento] = useState(false);
  if (p.visible !== abierta) {
    setAbierta(p.visible);
    if (p.visible) {
      setTiempo('');
      setProyectoId(p.proyectos[0]?.id ?? null);
      setFecha(p.hoy);
      setFacturable(null);
      setIntento(false);
    }
  }
  const proyecto = p.proyectos.find((x) => x.id === proyectoId) ?? null;
  const facturable = facturableElegido ?? facturablePorDefecto(proyecto);
  const minutos = leerMinutos(tiempo);
  const dias = [p.hoy, sumarDias(p.hoy, -1), sumarDias(p.hoy, -2)];

  const guardar = () => {
    if (minutos === null) return setIntento(true);
    p.onGuardar({ minutos, proyectoId, fecha, facturable });
  };

  return (
    <Sheet
      visible={p.visible}
      onClose={p.onCerrar}
      eyebrow={t('trabajogestion:horas.titulo')}
      title={t('trabajogestion:horas.apuntar')}
      footer={<Button title={t('trabajogestion:horas.guardar')} size="lg" loading={p.guardando} onPress={guardar} />}
    >
      <Campo
        etiqueta={t('trabajogestion:horas.tiempo')}
        ayuda={minutos !== null ? duracion(minutos) : t('trabajogestion:horas.tiempoAyuda')}
        value={tiempo}
        onChangeText={setTiempo}
        keyboardType="numbers-and-punctuation"
        autoFocus
        error={intento && minutos === null ? t('trabajogestion:horas.tiempoError') : undefined}
      />
      <ChipWrap style={styles.bloque}>
        {RAPIDOS.map((r) => (
          <Chip key={r} label={duracion(leerMinutos(r) ?? 0)} selected={tiempo === r} onPress={() => setTiempo(r)} />
        ))}
      </ChipWrap>
      {p.proyectos.length > 0 ? (
        <View style={styles.bloque}>
          <Text style={styles.rotulo}>{t('trabajogestion:horas.proyecto')}</Text>
          <ChipRow>
            {p.proyectos.map((x) => (
              <Chip key={x.id} label={x.nombre} selected={proyectoId === x.id} onPress={() => setProyectoId(x.id)} />
            ))}
            <Chip label={t('trabajogestion:horas.sinProyecto')} selected={proyectoId === null} onPress={() => setProyectoId(null)} />
          </ChipRow>
        </View>
      ) : null}
      <View style={styles.bloque}>
        <Text style={styles.rotulo}>{t('trabajogestion:horas.dia')}</Text>
        <ChipWrap>
          {dias.map((d) => (
            <Chip key={d} label={etiquetaDia(d, p.hoy)} selected={fecha === d} onPress={() => setFecha(d)} />
          ))}
        </ChipWrap>
      </View>
      <View style={styles.fila}>
        <Text style={styles.texto}>{t('trabajogestion:horas.facturable')}</Text>
        <Interruptor value={facturable} onValueChange={setFacturable} accessibilityLabel={t('trabajogestion:horas.facturable')} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  bloque: { marginBottom: space.s4 },
  rotulo: { fontFamily: tipo.label.family, fontSize: tipo.label.size, lineHeight: tipo.label.lineHeight, letterSpacing: tipo.label.tracking, textTransform: 'uppercase', color: ink.ink6, marginBottom: space.s2 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  texto: { fontFamily: tipo.body.family, fontSize: tipo.body.size, lineHeight: tipo.body.lineHeight, color: ink.ink9 },
});
