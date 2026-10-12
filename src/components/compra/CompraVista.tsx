// NIVL · Lista de la compra: la vista (L-RADICAL §C, FASE3 Oleada 2, lote
// E2). Pura: todo llega por props desde useCompra (o desde la galería con
// datos de mentira) y no carga nada.
//
// De arriba abajo: el encabezado grabado («Cuerpo» / «COMPRA», con la línea
// de lo que queda y el meandro), la franja de cifras (pendientes, en el carro
// y total) con la Barra del carro, el Campo para añadir con su botón de 48,
// lo pendiente (filas con Check sobre hairlines; marcar vibra `seleccion`) y
// lo que ya está en el carro, con «Vaciar comprados».
//
// INVERSIÓN única: el botón de añadir, y solo mientras hay algo escrito (es
// lo que toca hacer en ese momento). Con el campo vacío va en contorno y la
// pantalla no invierte nada: marcar es el gesto, y un Check no se invierte.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Barra,
  Campo,
  CargaArena,
  EncabezadoArena,
  Entrada,
  ErrorSistema,
  FranjaCifras,
  TarjetaArena,
} from '@/components/arena';
import { Check, EmptyState, Row, Screen, Section } from '@/components/ui';
import { ink, space, stroke } from '@/design/tokens';
import { t } from '@/i18n';
import type { ShoppingItem } from '@/lib/types';

export interface CompraVistaProps {
  /** Hasta la primera carga se pintan huecos. */
  cargado: boolean;
  /** Fallo de la última carga, ya escrito para el usuario. */
  errorCarga: string | null;
  items: ShoppingItem[];
  /** Lo escrito en el campo de añadir. */
  nuevo: string;
  anadiendo: boolean;
  vaciando: boolean;
  acciones: {
    onVolver: () => void;
    onNuevo: (v: string) => void;
    onAnadir: () => void;
    onMarcar: (item: ShoppingItem) => void;
    onVaciar: () => void;
    onDieta: () => void;
    onReintentar: () => void;
  };
}

const TAM_BOTON = 48;
/** Más cortes que estos no se leen (Barra). */
const MAX_SEGMENTOS = 30;

export function CompraVista({ cargado, errorCarga, items, nuevo, anadiendo, vaciando, acciones }: CompraVistaProps) {
  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  const hayTexto = !!nuevo.trim();
  const puedeAnadir = hayTexto && !anadiendo;

  const subtitulo =
    !cargado || errorCarga
      ? undefined
      : items.length === 0
        ? t('compra:vista.subVacia')
        : pending.length === 0
          ? t('compra:vista.subHecha')
          : t('compra:vista.subPendientes', { count: pending.length });

  return (
    <Screen>
      <Entrada indice={0}>
        <EncabezadoArena
          eyebrow={t('compra:vista.eyebrow')}
          titulo={t('compra:vista.titulo')}
          subtitulo={subtitulo}
          onVolver={acciones.onVolver}
          meandro
        />
      </Entrada>

      {/* Sin Entrada: un campo con el foco no debe moverse al aparecer. */}
      <View style={styles.anadir}>
        <Campo
          etiqueta={t('compra:vista.anadirArticulo')}
          value={nuevo}
          onChangeText={acciones.onNuevo}
          placeholder={t('compra:vista.anadirPlaceholder')}
          onSubmitEditing={acciones.onAnadir}
          returnKeyType="done"
          accessibilityLabel={t('compra:vista.nuevoA11y')}
          estiloBloque={styles.campo}
        />
        <Pressable
          onPress={acciones.onAnadir}
          disabled={!puedeAnadir}
          style={({ pressed }) => [
            styles.boton,
            hayTexto && styles.botonSolido,
            !hayTexto && styles.botonApagado,
            pressed && styles.pulsado,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('compra:vista.anadirA11y')}
          accessibilityState={{ disabled: !puedeAnadir, busy: anadiendo }}
        >
          <Ionicons name="add" size={22} color={hayTexto ? ink.ink0 : ink.ink6} />
        </Pressable>
      </View>

      {!cargado ? (
        <CargaArena etiqueta={t('compra:vista.cargando')} formas={['franja', 'rotulo', 'filas']} filas={4} />
      ) : errorCarga ? (
        <Entrada indice={1}>
          <ErrorSistema mensaje={errorCarga} onReintentar={acciones.onReintentar} style={styles.bloque} />
        </Entrada>
      ) : (
        <>
          {items.length > 0 ? (
            <Entrada indice={1} style={styles.franja}>
              <FranjaCifras
                cifras={[
                  { valor: pending.length, rotulo: t('compra:vista.cifraPendientes') },
                  { valor: done.length, rotulo: t('compra:vista.cifraCarro') },
                  { valor: items.length, rotulo: t('compra:vista.cifraLista') },
                ]}
              />
              <View style={styles.barra}>
                <Barra
                  ratio={done.length / items.length}
                  alto={4}
                  segmentos={items.length <= MAX_SEGMENTOS ? items.length : undefined}
                  etiqueta={t('compra:vista.barraA11y', { hechos: done.length, total: items.length })}
                />
              </View>
            </Entrada>
          ) : null}

          <Entrada indice={2}>
            <Section title={t('compra:vista.pendiente')} meta={pending.length > 0 ? `${pending.length}` : undefined}>
              {pending.length === 0 ? (
                <TarjetaArena variante={items.length > 0 ? 'grano' : 'contorno'}>
                  <EmptyState
                    compact
                    icon="cart-outline"
                    title={items.length > 0 ? t('compra:vista.compraHecha') : t('compra:vista.nadaPendiente')}
                    body={
                      items.length > 0
                        ? t('compra:vista.compraHechaCuerpo')
                        : t('compra:vista.nadaPendienteCuerpo')
                    }
                    action={
                      items.length > 0
                        ? undefined
                        : { label: t('compra:vista.irDieta'), onPress: acciones.onDieta, variant: 'outline' }
                    }
                  />
                </TarjetaArena>
              ) : (
                <View style={styles.lista}>
                  {pending.map((i, idx) => (
                    <Row
                      key={i.id}
                      first={idx === 0}
                      leading={<Check checked={false} size={24} />}
                      title={i.name}
                      trailing={i.qty ? <Text style={styles.cantidad}>{i.qty}</Text> : undefined}
                      onPress={() => acciones.onMarcar(i)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: false }}
                      accessibilityLabel={
                        i.qty
                          ? t('compra:vista.pendienteCantidadA11y', { nombre: i.name, cantidad: i.qty })
                          : t('compra:vista.pendienteA11y', { nombre: i.name })
                      }
                    />
                  ))}
                </View>
              )}
            </Section>
          </Entrada>

          {done.length > 0 ? (
            <Entrada indice={3}>
              <Section
                title={t('compra:vista.enCarro')}
                meta={`${done.length}`}
                action={{
                  label: vaciando ? t('compra:vista.vaciando') : t('compra:vista.vaciar'),
                  icon: 'trash-outline',
                  onPress: acciones.onVaciar,
                }}
              >
                <View style={styles.lista}>
                  {done.map((i, idx) => (
                    <Row
                      key={i.id}
                      first={idx === 0}
                      leading={<Check checked size={24} />}
                      title={i.name}
                      done
                      trailing={i.qty ? <Text style={[styles.cantidad, styles.cantidadHecha]}>{i.qty}</Text> : undefined}
                      onPress={() => acciones.onMarcar(i)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: true }}
                      accessibilityLabel={
                        i.qty
                          ? t('compra:vista.enCarroCantidadA11y', { nombre: i.name, cantidad: i.qty })
                          : t('compra:vista.enCarroA11y', { nombre: i.name })
                      }
                    />
                  ))}
                </View>
              </Section>
            </Entrada>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  anadir: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s2, marginBottom: space.s6 },
  campo: { flex: 1, minWidth: 0 },
  boton: {
    width: TAM_BOTON,
    height: TAM_BOTON,
    borderWidth: stroke.hairline,
    borderColor: ink.ink4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonSolido: { backgroundColor: ink.ink10, borderColor: ink.ink10 },
  botonApagado: { opacity: 0.6 },
  pulsado: { opacity: 0.7 },
  bloque: { marginBottom: space.s6 },
  franja: {
    marginBottom: space.s6,
    paddingTop: space.s3,
    borderTopWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: ink.ink3,
  },
  barra: { paddingVertical: space.s3 },
  lista: { borderTopWidth: stroke.hairline, borderBottomWidth: stroke.hairline, borderColor: ink.ink3 },
  // La cantidad es texto libre («1 kg», «500 g»): Cinzel no tiene minúsculas
  // y la gritaría, así que va en Outfit con cifras tabulares.
  cantidad: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    lineHeight: 18,
    color: ink.ink8,
    fontVariant: ['tabular-nums'],
  },
  cantidadHecha: { color: ink.ink6 },
});
