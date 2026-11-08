// NIVL · WORK: Proyectos (pura). Estado de cada proyecto y su siguiente entrega.

import { View } from 'react-native';
import { TarjetaArena } from '@/components/arena';
import { Button, EmptyState, Row, Section } from '@/components/ui';
import { t } from '@/i18n';
import { fechaCorta } from '@/work/fechas';
import type { ResumenProyecto } from '@/work/proyectos';
import type { Entrega, Proyecto } from '@/work/tipos';
import { EtiquetaRiesgo, FilaEntrega, PantallaGestion, type EstadoPantalla } from './Piezas';
import type { VistaProyectos } from './vistas';

export interface ProyectosVistaProps extends EstadoPantalla {
  vista: VistaProyectos;
  acciones: {
    onNuevoProyecto: () => void;
    onNuevaEntrega: () => void;
    onAbrir: (p: Proyecto) => void;
    onMarcar: (e: Entrega) => void;
    onEntrega: (e: Entrega) => void;
  };
}

function detalleDe(r: ResumenProyecto): string {
  if (!r.proxima) return t('trabajogestion:proyectos.sinEntregas');
  return r.proxima.fecha ? t('trabajogestion:proyectos.proxima', { titulo: r.proxima.titulo, fecha: fechaCorta(r.proxima.fecha) }) : r.proxima.titulo;
}

export function ProyectosVista({ vista, acciones, ...estado }: ProyectosVistaProps) {
  return (
    <PantallaGestion
      {...estado}
      titulo={t('trabajogestion:proyectos.titulo')}
      etiquetaCarga={t('trabajogestion:proyectos.cargandoA11y')}
      formas={['filas', 'filas']}
      accion={vista.vacio ? undefined : { icono: 'add', etiqueta: t('trabajogestion:proyectos.nuevo'), onPress: acciones.onNuevoProyecto }}
    >
      {vista.vacio ? (
        <EmptyState
          icon="briefcase-outline"
          title={t('trabajogestion:proyectos.vacioTitulo')}
          body={t('trabajogestion:proyectos.vacioCuerpo')}
          action={{ label: t('trabajogestion:proyectos.nuevo'), onPress: acciones.onNuevoProyecto }}
        />
      ) : (
        <View>
          {vista.activos.length > 0 ? (
            <Section title={t('trabajogestion:proyectos.activos')}>
              <TarjetaArena>
                {vista.activos.map((r, i) => (
                  <Row
                    key={r.proyecto.id}
                    first={i === 0}
                    title={r.proyecto.nombre}
                    detail={detalleDe(r)}
                    onPress={() => acciones.onAbrir(r.proyecto)}
                    trailing={r.riesgo ? <EtiquetaRiesgo riesgo={r.riesgo} /> : undefined}
                    chevron
                  />
                ))}
              </TarjetaArena>
            </Section>
          ) : null}
          {vista.sueltas.length > 0 ? (
            <Section title={t('trabajogestion:proyectos.sueltas')}>
              <TarjetaArena>
                {vista.sueltas.map((e, i) => (
                  <FilaEntrega key={e.id} entrega={e} primera={i === 0} onMarcar={acciones.onMarcar} onAbrir={acciones.onEntrega} />
                ))}
              </TarjetaArena>
            </Section>
          ) : null}
          <Button title={t('trabajogestion:proyectos.nuevaEntrega')} icon="add" variant="secondary" onPress={acciones.onNuevaEntrega} />
          {vista.otros.length > 0 ? (
            <Section title={t('trabajogestion:proyectos.otros')}>
              <TarjetaArena>
                {vista.otros.map((p, i) => (
                  <Row key={p.id} first={i === 0} muted title={p.nombre} detail={t(`trabajogestion:proyectos.estado_${p.estado}`)} onPress={() => acciones.onAbrir(p)} chevron />
                ))}
              </TarjetaArena>
            </Section>
          ) : null}
        </View>
      )}
    </PantallaGestion>
  );
}
