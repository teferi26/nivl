// NIVL · Moderación: la bandeja (pura). Herramienta interna en español: no se traduce.
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { CargaArena, EncabezadoArena, Entrada, ErrorSistema, FranjaCifras, TarjetaArena } from '@/components/arena';
import { EmptyState, Row, Screen, Section, Tag } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import {
  fechaCorta,
  nombreDe,
  totalAbierto,
  type Bandeja,
  type DenunciaIA,
  type DenunciaPerfil,
  type ElementoModeracion,
  type PerfilModeracion,
} from '@/lib/moderacionmath';
import type { Acceso } from './useModeracion';

export interface BandejaVistaProps {
  acceso: Acceso;
  bandeja: Bandeja | null;
  error: string | null;
  refrescando: boolean;
  onRefrescar: () => void;
  onSalir: () => void;
  onAbrir: (e: ElementoModeracion) => void;
}

const ENCABEZADO = { eyebrow: 'Administración', titulo: 'Moderación' };

function subtituloDe(b: Bandeja): string {
  const n = totalAbierto(b);
  if (n === 0) return 'Nada por atender.';
  return n === 1 ? '1 asunto por atender.' : `${n} asuntos por atender.`;
}

export function SinAcceso({ onSalir }: { onSalir: () => void }) {
  return (
    <Screen>
      <EncabezadoArena onVolver={onSalir} {...ENCABEZADO} />
      <TarjetaArena variante="contorno">
        <EmptyState compact icon="lock-closed-outline" title="Sin acceso" body="Esta pantalla es solo para administradores." />
      </TarjetaArena>
    </Screen>
  );
}

function FilaPerfil({ e, primera, onAbrir }: { e: DenunciaPerfil; primera: boolean; onAbrir: () => void }) {
  return (
    <Row
      first={primera}
      chevron
      leading={<Ionicons name="person-outline" size={20} color={ink.ink8} />}
      title={e.motivoTexto}
      detail={`${nombreDe(e.denunciado)} · ${fechaCorta(e.creadaEn)}`}
      onPress={onAbrir}
    />
  );
}

function FilaIA({ e, primera, onAbrir }: { e: DenunciaIA; primera: boolean; onAbrir: () => void }) {
  return (
    <Row
      first={primera}
      chevron
      leading={<Ionicons name="chatbubble-ellipses-outline" size={20} color={ink.ink8} />}
      title={e.motivoTexto}
      detail={`${e.origen} · ${fechaCorta(e.creadaEn)}`}
      onPress={onAbrir}
    />
  );
}

function FilaFicha({ e, primera, onAbrir }: { e: PerfilModeracion; primera: boolean; onAbrir: () => void }) {
  return (
    <Row
      first={primera}
      chevron
      leading={<Ionicons name={e.clase === 'suspendido' ? 'ban-outline' : 'id-card-outline'} size={20} color={ink.ink8} />}
      title={nombreDe({ nombre: e.nombre, id: e.userId })}
      detail={e.titulo ?? (e.foto ? 'Con foto' : 'Sin foto')}
      trailing={e.estado === 'pending' ? <Tag>PENDIENTE</Tag> : undefined}
      onPress={onAbrir}
    />
  );
}

function Lista({ children }: { children: React.ReactNode }) {
  return (
    <TarjetaArena padded={false} style={styles.lista}>
      {children}
    </TarjetaArena>
  );
}

export function BandejaVista({ acceso, bandeja, error, refrescando, onRefrescar, onSalir, onAbrir }: BandejaVistaProps) {
  if (acceso === 'negado') return <SinAcceso onSalir={onSalir} />;

  if (!bandeja) {
    return (
      <Screen refreshing={refrescando} onRefresh={onRefrescar}>
        <EncabezadoArena onVolver={onSalir} {...ENCABEZADO} />
        {error ? (
          <ErrorSistema mensaje={error} onReintentar={onRefrescar} reintentando={refrescando} />
        ) : (
          <CargaArena etiqueta="Cargando la bandeja" formas={['franja', 'rotulo', 'filas', 'rotulo', 'filas']} />
        )}
      </Screen>
    );
  }

  const { recuento: r } = bandeja;
  const vacia = totalAbierto(bandeja) === 0;

  return (
    <Screen refreshing={refrescando} onRefresh={onRefrescar}>
      <Entrada indice={0}>
        <EncabezadoArena onVolver={onSalir} {...ENCABEZADO} subtitulo={subtituloDe(bandeja)} meandro />
      </Entrada>
      <Entrada indice={1}>
        <FranjaCifras
          cifras={[
            { valor: r.denunciasPerfil, rotulo: 'Perfil' },
            { valor: r.denunciasIA, rotulo: 'IA' },
            { valor: r.perfiles, rotulo: 'Revisar' },
            { valor: r.suspendidos, rotulo: 'Susp.', etiqueta: `Suspendidos: ${r.suspendidos}` },
          ]}
        />
      </Entrada>

      {error ? <ErrorSistema compacto mensaje={error} onReintentar={onRefrescar} reintentando={refrescando} style={styles.error} /> : null}

      {vacia ? (
        <Entrada indice={2} style={styles.bloque}>
          <TarjetaArena variante="contorno">
            <EmptyState compact icon="shield-checkmark-outline" title="La arena está en orden" body="No hay denuncias ni perfiles por revisar." />
          </TarjetaArena>
        </Entrada>
      ) : null}

      {bandeja.denunciasPerfil.length ? (
        <Entrada indice={2} style={styles.bloque}>
          <Section title="Denuncias de perfil" meta={String(r.denunciasPerfil)} tone="alerta">
            <Lista>
              {bandeja.denunciasPerfil.map((e, i) => (
                <FilaPerfil key={e.clave} e={e} primera={i === 0} onAbrir={() => onAbrir(e)} />
              ))}
            </Lista>
          </Section>
        </Entrada>
      ) : null}

      {bandeja.denunciasIA.length ? (
        <Entrada indice={3} style={styles.bloque}>
          <Section title="Denuncias de la IA" meta={String(r.denunciasIA)} tone="alerta">
            <Lista>
              {bandeja.denunciasIA.map((e, i) => (
                <FilaIA key={e.clave} e={e} primera={i === 0} onAbrir={() => onAbrir(e)} />
              ))}
            </Lista>
          </Section>
        </Entrada>
      ) : null}

      {bandeja.perfiles.length ? (
        <Entrada indice={4} style={styles.bloque}>
          <Section title="Perfiles por revisar" meta={String(r.perfiles)}>
            <Lista>
              {bandeja.perfiles.map((e, i) => (
                <FilaFicha key={e.clave} e={e} primera={i === 0} onAbrir={() => onAbrir(e)} />
              ))}
            </Lista>
          </Section>
        </Entrada>
      ) : null}

      {bandeja.suspendidos.length ? (
        <Entrada indice={5} style={styles.bloque}>
          <Section title="Suspendidos" meta={String(r.suspendidos)}>
            <Lista>
              {bandeja.suspendidos.map((e, i) => (
                <FilaFicha key={e.clave} e={e} primera={i === 0} onAbrir={() => onAbrir(e)} />
              ))}
            </Lista>
          </Section>
        </Entrada>
      ) : null}

      <View style={styles.pie}>
        <Text style={styles.pieTexto} maxFontSizeMultiplier={1.35}>
          También en nivl.app/admin
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: space.s4, paddingVertical: 2 },
  bloque: { marginTop: space.s6 },
  error: { marginTop: space.s4 },
  pie: { marginTop: space.s6, alignItems: 'center' },
  pieTexto: { ...tipo.bodySm, color: ink.ink6 },
});
