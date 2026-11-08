// NIVL · WORK: las hojas de la Agenda. Puras: el estado y los cerrojos viven en
// useWorkAgenda. Los fallos van en línea, nada de avisos encima de una hoja.

import { StyleSheet, Text, View } from 'react-native';
import { Campo, ErrorSistema } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import type { TipoRapido } from '@/work/agendaRapida';
import type { EstadoCalendario } from '@/work/calendario';

export interface HojaRapidaProps {
  visible: boolean;
  tipo: TipoRapido;
  hoy: string;
  manana: string;
  dia: string;
  titulo: string;
  hora: string;
  duracion: number;
  duraciones: readonly number[];
  guardando: boolean;
  errorHora: string | null;
  errorGuardar: string | null;
  onTitulo: (v: string) => void;
  onDia: (v: string) => void;
  onHora: (v: string) => void;
  onDuracion: (v: number) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

export function HojaRapida(p: HojaRapidaProps) {
  const reunion = p.tipo === 'reunion';
  return (
    <Sheet
      visible={p.visible}
      onClose={p.onCerrar}
      eyebrow={t(reunion ? 'trabajoagenda:agenda.eyebrowReunion' : 'trabajoagenda:agenda.eyebrowBloque')}
      title={t(reunion ? 'trabajoagenda:agenda.preguntaReunion' : 'trabajoagenda:agenda.preguntaBloque')}
      footer={
        <>
          <Button title={t(reunion ? 'trabajoagenda:agenda.guardarReunion' : 'trabajoagenda:agenda.guardarBloque')} onPress={p.onGuardar} loading={p.guardando} />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={p.onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('trabajoagenda:agenda.dia')}
          </Text>
          <ChipWrap>
            <Chip small label={t('trabajoagenda:agenda.hoy')} selected={p.dia === p.hoy} onPress={() => p.onDia(p.hoy)} />
            <Chip small label={t('trabajoagenda:agenda.manana')} selected={p.dia === p.manana} onPress={() => p.onDia(p.manana)} />
          </ChipWrap>
        </View>
        <Campo
          etiqueta={t('trabajoagenda:agenda.hora')}
          value={p.hora}
          onChangeText={p.onHora}
          keyboardType="numbers-and-punctuation"
          error={p.errorHora ?? undefined}
          accessibilityLabel={t('trabajoagenda:agenda.hora')}
        />
        <View style={styles.grupo}>
          <Text style={styles.etiqueta} maxFontSizeMultiplier={1.35}>
            {t('trabajoagenda:agenda.duracion')}
          </Text>
          <ChipWrap>
            {p.duraciones.map((d) => (
              <Chip key={d} small label={t('trabajoagenda:agenda.minutos', { min: d })} selected={p.duracion === d} onPress={() => p.onDuracion(d)} />
            ))}
          </ChipWrap>
        </View>
        <Campo
          etiqueta={t('trabajoagenda:agenda.nombreOpcional')}
          value={p.titulo}
          onChangeText={p.onTitulo}
          placeholder={t(reunion ? 'trabajoagenda:agenda.tituloReunion' : 'trabajoagenda:agenda.tituloBloque')}
          accessibilityLabel={t('trabajoagenda:agenda.nombreOpcional')}
        />
        {p.errorGuardar ? <ErrorSistema mensaje={p.errorGuardar} compacto /> : null}
      </View>
    </Sheet>
  );
}

export interface HojaCalendarioProps {
  visible: boolean;
  estado: EstadoCalendario;
  puedeDesconectar: boolean;
  ocupado: boolean;
  error: string | null;
  onConectar: () => void;
  onActualizar: () => void;
  onDesconectar: () => void;
  onAjustes: () => void;
  onCerrar: () => void;
}

export function HojaCalendario(p: HojaCalendarioProps) {
  const cuerpo =
    p.estado === 'conectado'
      ? t('trabajoagenda:calendario.conectadoCuerpo')
      : p.estado === 'denegado'
        ? t('trabajoagenda:calendario.denegadoCuerpo')
        : t('trabajoagenda:calendario.optInCuerpo');
  return (
    <Sheet
      visible={p.visible}
      onClose={p.onCerrar}
      eyebrow={t('trabajoagenda:calendario.eyebrow')}
      title={p.estado === 'conectado' ? t('trabajoagenda:calendario.conectado') : p.estado === 'denegado' ? t('trabajoagenda:calendario.denegado') : t('trabajoagenda:calendario.optInTitulo')}
      footer={
        <>
          {p.estado === 'ofrecer' ? <Button title={t('trabajoagenda:calendario.conectar')} onPress={p.onConectar} loading={p.ocupado} /> : null}
          {p.estado === 'conectado' ? <Button title={t('trabajoagenda:calendario.actualizar')} variant="secondary" onPress={p.onActualizar} loading={p.ocupado} /> : null}
          {p.estado === 'denegado' ? <Button title={t('trabajoagenda:calendario.abrirAjustes')} variant="secondary" onPress={p.onAjustes} /> : null}
          {p.puedeDesconectar ? <Button title={t('trabajoagenda:calendario.desconectar')} variant="danger" onPress={p.onDesconectar} disabled={p.ocupado} /> : null}
          <Button title={t('comun:cerrar')} variant="ghost" onPress={p.onCerrar} />
        </>
      }
    >
      <View style={styles.pila}>
        <Text style={styles.cuerpo} maxFontSizeMultiplier={1.35}>
          {cuerpo}
        </Text>
        {p.error ? <ErrorSistema mensaje={p.error} compacto /> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.s4 },
  grupo: { gap: space.s2 },
  etiqueta: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8 },
  cuerpo: { fontFamily: tipo.body.family, fontSize: tipo.body.size, lineHeight: tipo.body.lineHeight, color: ink.ink8 },
});
