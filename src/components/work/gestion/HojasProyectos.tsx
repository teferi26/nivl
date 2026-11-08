// NIVL · WORK: la hoja de Proyectos (pura). Una sola Sheet que cambia de
// contenido: dos Modal seguidos fallan al presentarse en iOS.

import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Campo } from '@/components/arena';
import { Button, Chip, ChipWrap, Sheet } from '@/components/ui';
import { space } from '@/design/tokens';
import { t } from '@/i18n';
import { fechaCorta } from '@/work/fechas';
import type { Entrega, EstadoProyecto, Proyecto } from '@/work/tipos';
import { FilaEntrega, TextoAyuda } from './Piezas';
import { leerFecha, leerTarifa, opcionesFecha, type DetalleProyecto } from './vistas';

export type HojaProyecto =
  | { tipo: 'proyecto'; proyecto: Proyecto | null }
  | { tipo: 'detalle'; proyectoId: string }
  | { tipo: 'entrega'; entrega: Entrega | null; proyectoId: string | null };

export interface HojasProyectosProps {
  hoja: HojaProyecto | null;
  hoy: string;
  detalle: DetalleProyecto | null;
  guardando: boolean;
  onCerrar: () => void;
  onGuardarProyecto: (p: { id?: string; nombre: string; cliente: string | null; tarifaHora: number | null }) => void;
  onGuardarEntrega: (e: { id?: string; proyectoId: string | null; titulo: string; fecha: string | null }) => void;
  onNuevaEntrega: (proyectoId: string) => void;
  onEditarProyecto: (p: Proyecto) => void;
  onEstadoProyecto: (p: Proyecto, estado: EstadoProyecto) => void;
  onBorrarProyecto: (p: Proyecto) => void;
  onBorrarEntrega: (e: Entrega) => void;
  onMarcar: (e: Entrega) => void;
  onEntrega: (e: Entrega) => void;
}

interface Form {
  nombre: string;
  cliente: string;
  tarifa: string;
  mas: boolean;
  titulo: string;
  fecha: string;
  intento: boolean;
}

function formDe(h: HojaProyecto | null): Form {
  const p = h?.tipo === 'proyecto' ? h.proyecto : null;
  const e = h?.tipo === 'entrega' ? h.entrega : null;
  return {
    nombre: p?.nombre ?? '',
    cliente: p?.cliente ?? '',
    tarifa: p?.tarifaHora != null ? String(p.tarifaHora) : '',
    mas: !!p && (!!p.cliente || p.tarifaHora != null),
    titulo: e?.titulo ?? '',
    fecha: e?.fecha ? fechaCorta(e.fecha) : '',
    intento: false,
  };
}

export function HojasProyectos(p: HojasProyectosProps) {
  // Se recuerda la última para que el contenido no desaparezca al cerrar.
  const [ultima, setUltima] = useState(p.hoja);
  const [f, setF] = useState(() => formDe(p.hoja));
  if (p.hoja && p.hoja !== ultima) {
    setUltima(p.hoja);
    setF(formDe(p.hoja));
  }
  const cambiar = (c: Partial<Form>) => setF((x) => ({ ...x, ...c }));
  const tarifaRef = useRef<TextInput>(null);
  const h = p.hoja ?? ultima;

  const tarifa = leerTarifa(f.tarifa);
  const fecha = f.fecha.trim() ? leerFecha(f.fecha, p.hoy) : null;
  const fechaMal = !!f.fecha.trim() && !fecha;

  const guardarProyecto = () => {
    if (h?.tipo !== 'proyecto') return;
    if (!f.nombre.trim() || !tarifa.ok) return cambiar({ intento: true, mas: f.mas || !tarifa.ok });
    p.onGuardarProyecto({ id: h.proyecto?.id, nombre: f.nombre, cliente: f.cliente.trim() || null, tarifaHora: tarifa.valor });
  };
  const guardarEntrega = () => {
    if (h?.tipo !== 'entrega') return;
    if (!f.titulo.trim() || fechaMal) return cambiar({ intento: true });
    p.onGuardarEntrega({ id: h.entrega?.id, proyectoId: h.proyectoId, titulo: f.titulo, fecha });
  };

  const detalle = h?.tipo === 'detalle' ? p.detalle : null;
  const proyecto = detalle?.resumen.proyecto ?? null;

  const cabecera =
    h?.tipo === 'proyecto'
      ? { eyebrow: t('trabajogestion:hoja.eyebrow'), title: t(h.proyecto ? 'trabajogestion:hoja.editarTitulo' : 'trabajogestion:hoja.nuevoTitulo') }
      : h?.tipo === 'entrega'
        ? { eyebrow: t('trabajogestion:entrega.eyebrow'), title: t(h.entrega ? 'trabajogestion:entrega.editarTitulo' : 'trabajogestion:entrega.nuevaTitulo') }
        : { eyebrow: proyecto?.cliente ?? t('trabajogestion:hoja.eyebrow'), title: proyecto?.nombre ?? '' };

  const pie =
    h?.tipo === 'proyecto' ? (
      <Button title={t(h.proyecto ? 'comun:guardar' : 'trabajogestion:hoja.crear')} size="lg" loading={p.guardando} onPress={guardarProyecto} />
    ) : h?.tipo === 'entrega' ? (
      <Button title={t(h.entrega ? 'comun:guardar' : 'trabajogestion:entrega.anadir')} size="lg" loading={p.guardando} onPress={guardarEntrega} />
    ) : proyecto?.estado === 'activo' ? (
      <Button title={t('trabajogestion:proyectos.nuevaEntrega')} icon="add" size="lg" onPress={() => p.onNuevaEntrega(proyecto.id)} />
    ) : undefined;

  return (
    <Sheet visible={!!p.hoja} onClose={p.onCerrar} eyebrow={cabecera.eyebrow} title={cabecera.title} footer={pie}>
      {h?.tipo === 'proyecto' ? (
        <View>
          <Campo
            etiqueta={t('trabajogestion:hoja.nombre')}
            placeholder={t('trabajogestion:hoja.nombreEjemplo')}
            value={f.nombre}
            onChangeText={(nombre) => cambiar({ nombre })}
            maxLength={80}
            autoFocus={!h.proyecto}
            error={f.intento && !f.nombre.trim() ? t('trabajogestion:hoja.nombreError') : undefined}
          />
          {f.mas ? (
            <View>
              <Campo etiqueta={t('trabajogestion:hoja.cliente')} value={f.cliente} onChangeText={(cliente) => cambiar({ cliente })} maxLength={80} returnKeyType="next" onSubmitEditing={() => tarifaRef.current?.focus()} />
              <Campo
                ref={tarifaRef}
                etiqueta={t('trabajogestion:hoja.tarifa')}
                ayuda={t('trabajogestion:hoja.tarifaAyuda')}
                value={f.tarifa}
                onChangeText={(x) => cambiar({ tarifa: x })}
                keyboardType="decimal-pad"
                error={f.intento && !tarifa.ok ? t('trabajogestion:hoja.tarifaError') : undefined}
              />
            </View>
          ) : (
            <Button title={t('trabajogestion:hoja.masDatos')} variant="ghost" size="sm" onPress={() => cambiar({ mas: true })} />
          )}
        </View>
      ) : null}

      {h?.tipo === 'entrega' ? (
        <View>
          <Campo
            etiqueta={t('trabajogestion:entrega.tituloCampo')}
            placeholder={t('trabajogestion:entrega.tituloEjemplo')}
            value={f.titulo}
            onChangeText={(titulo) => cambiar({ titulo })}
            maxLength={160}
            autoFocus={!h.entrega}
            error={f.intento && !f.titulo.trim() ? t('trabajogestion:entrega.tituloError') : undefined}
          />
          <ChipWrap style={styles.bloque}>
            {opcionesFecha(p.hoy).map((o) => (
              <Chip key={o.codigo} label={t(`trabajogestion:entrega.opcion_${o.codigo}`)} selected={fecha === o.fecha} onPress={() => cambiar({ fecha: fechaCorta(o.fecha) })} />
            ))}
            <Chip label={t('trabajogestion:entrega.sinFecha')} selected={!f.fecha.trim()} onPress={() => cambiar({ fecha: '' })} />
          </ChipWrap>
          <Campo
            etiqueta={t('trabajogestion:entrega.fecha')}
            ayuda={fecha ? t('trabajogestion:entrega.fechaLeida', { fecha: fechaCorta(fecha) }) : t('trabajogestion:entrega.fechaAyuda')}
            value={f.fecha}
            onChangeText={(x) => cambiar({ fecha: x })}
            placeholder={fechaCorta(opcionesFecha(p.hoy).at(-1)!.fecha)}
            keyboardType="numbers-and-punctuation"
            error={f.intento && fechaMal ? t('trabajogestion:entrega.fechaError') : undefined}
          />
          <TextoAyuda>{t('trabajogestion:entrega.misionAviso')}</TextoAyuda>
          {h.entrega ? <Button title={t('trabajogestion:comun.borrar')} variant="danger" size="sm" onPress={() => p.onBorrarEntrega(h.entrega!)} /> : null}
        </View>
      ) : null}

      {h?.tipo === 'detalle' && detalle && proyecto ? (
        <View>
          {proyecto.tarifaHora != null ? <TextoAyuda>{t('trabajogestion:detalle.tarifa', { tarifa: proyecto.tarifaHora })}</TextoAyuda> : null}
          {detalle.pendientes.length === 0 ? <TextoAyuda>{t('trabajogestion:detalle.vacio')}</TextoAyuda> : null}
          {detalle.pendientes.map((e, i) => (
            <FilaEntrega key={e.id} entrega={e} primera={i === 0} onMarcar={p.onMarcar} onAbrir={p.onEntrega} />
          ))}
          {detalle.hechas.map((e, i) => (
            <FilaEntrega key={e.id} entrega={e} primera={i === 0 && detalle.pendientes.length === 0} onMarcar={p.onMarcar} onAbrir={p.onEntrega} />
          ))}
          <View style={styles.acciones}>
            <Button title={t('trabajogestion:detalle.editar')} variant="secondary" size="sm" onPress={() => p.onEditarProyecto(proyecto)} />
            {proyecto.estado === 'activo' ? (
              <>
                <Button title={t('trabajogestion:detalle.pausar')} variant="ghost" size="sm" onPress={() => p.onEstadoProyecto(proyecto, 'pausado')} />
                <Button title={t('trabajogestion:detalle.cerrar')} variant="ghost" size="sm" onPress={() => p.onEstadoProyecto(proyecto, 'cerrado')} />
              </>
            ) : (
              <Button title={t('trabajogestion:detalle.reabrir')} variant="ghost" size="sm" onPress={() => p.onEstadoProyecto(proyecto, 'activo')} />
            )}
            <Button title={t('trabajogestion:comun.borrar')} variant="danger" size="sm" onPress={() => p.onBorrarProyecto(proyecto)} />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  bloque: { marginBottom: space.s3 },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s4 },
});
