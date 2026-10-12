// NIVL · Memoria: la vista (patrón L-RADICAL §C, FASE3 G1). Pura: todo llega
// por props desde useMemoria (o desde la galería con datos de mentira).
//
// Lo que el coach recuerda de ti. De arriba abajo: el encabezado grabado
// («El sistema recuerda» / «MEMORIA») con el meandro, la FranjaCifras de
// hechos, versión del dossier y gasto del mes, el dossier («Quién eres para
// el sistema») en una losa remachada que se pliega, y los hechos con su
// filtro por categoría como filas entre hairlines (fecha en Cinzel a la
// izquierda, el hecho, y su categoría si no se filtra) con «Borrar» a la
// derecha de cada una (también como acción de accesibilidad de la fila).
//
// Sin superficie invertida: aquí no hay una acción principal, se lee.

import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CargaArena, EncabezadoArena, Entrada, ErrorSistema, FranjaCifras, TarjetaArena } from '@/components/arena';
import { fechaCorta } from '@/components/fecha';
import { TextoSistema } from '@/components/TextoSistema';
import { Chip, ChipRow, EmptyState, Screen, Section, Tag } from '@/components/ui';
import { SIN_DATO } from '@/components/ui/sinDato';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import type { CoachFact } from '@/lib/coach';

/** Las categorías del filtro, en orden. Su nombre está en memoria:categoria.<clave>. */
export const CATEGORIAS = ['todo', 'aprendizaje', 'venta', 'metrica', 'log', 'objetivo', 'proyecto', 'regla', 'perfil'] as const;
type Categoria = (typeof CATEGORIAS)[number];
const esCategoria = (clave: string): clave is Categoria => (CATEGORIAS as readonly string[]).includes(clave);

// La fecha corta vive en '@/components/fecha' (la comparte Economía); se
// reexporta para quien ya la importaba de aquí.
export { fechaCorta };

export function etiquetaCategoria(clave: string): string {
  return esCategoria(clave) ? t(`memoria:categoria.${clave}`) : clave;
}

export interface MemoriaVistaProps {
  cargando: boolean;
  /** Fallo al leer la memoria, ya escrito para el usuario. */
  error: string | null;
  dossier: { content: string; version: number } | null;
  hechos: CoachFact[];
  /** Gasto del coach este mes, en dólares (null si no se sabe). */
  gasto: number | null;
  filtro: string;
  dossierAbierto: boolean;
  /** Ids de los hechos que se están borrando: su fila queda cerrada. */
  borrando: ReadonlySet<string>;
  acciones: {
    onVolver: () => void;
    onFiltro: (clave: string) => void;
    onAlternarDossier: () => void;
    onAbrirHecho: (h: CoachFact) => void;
    onBorrarHecho: (h: CoachFact) => void;
    onReintentar: () => void;
  };
}

/** Un hecho: la fecha grabada a la izquierda, el texto y su categoría; «Borrar» a la derecha. */
function FilaHecho({
  hecho,
  primero,
  conCategoria,
  borrando,
  onPress,
  onBorrar,
}: {
  hecho: CoachFact;
  primero: boolean;
  conCategoria: boolean;
  borrando: boolean;
  onPress: () => void;
  onBorrar: () => void;
}) {
  const categoria = etiquetaCategoria(hecho.category);
  return (
    <View style={[styles.fila, !primero && styles.hairline]}>
      <Pressable
        onPress={onPress}
        disabled={borrando}
        style={({ pressed }) => [styles.hecho, pressed && styles.pulsado]}
        accessibilityRole="button"
        accessibilityLabel={t('memoria:hecho.a11y', { categoria, fecha: fechaCorta(hecho.date), contenido: hecho.content })}
        accessibilityHint={t('memoria:hecho.pista')}
        accessibilityState={{ disabled: borrando, busy: borrando }}
        accessibilityActions={[
          { name: 'activate', label: t('memoria:hecho.leerEntero') },
          { name: 'borrar', label: t('memoria:hecho.borrarAccion') },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'borrar') {
            if (!borrando) onBorrar();
          } else onPress();
        }}
      >
        <Text style={styles.fecha} maxFontSizeMultiplier={1.35}>
          {fechaCorta(hecho.date).toUpperCase()}
        </Text>
        <View style={styles.hechoCuerpo}>
          <Text style={[styles.hechoTexto, borrando && styles.apagado]} numberOfLines={3} maxFontSizeMultiplier={1.35}>
            {hecho.content}
          </Text>
          {conCategoria ? (
            <View style={styles.tag}>
              <Tag>{categoria}</Tag>
            </View>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        onPress={onBorrar}
        disabled={borrando}
        style={({ pressed }) => [styles.borrar, pressed && styles.pulsado]}
        accessibilityRole="button"
        accessibilityLabel={t('memoria:hecho.borrarA11y', { contenido: hecho.content.slice(0, 60) })}
        accessibilityState={{ disabled: borrando, busy: borrando }}
      >
        {borrando ? (
          <ActivityIndicator color={ink.ink6} size="small" accessibilityLabel={t('memoria:hecho.borrando')} />
        ) : (
          <Text style={styles.borrarTexto} maxFontSizeMultiplier={1.35}>
            {t('memoria:hecho.borrar')}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

export function MemoriaVista({
  cargando,
  error,
  dossier,
  hechos,
  gasto,
  filtro,
  dossierAbierto,
  borrando,
  acciones,
}: MemoriaVistaProps) {
  if (cargando) {
    return (
      <Screen>
        <EncabezadoArena
          onVolver={acciones.onVolver}
          eyebrow={t('memoria:vista.eyebrow')}
          titulo={t('memoria:vista.titulo')}
          meandro
        />
        <CargaArena etiqueta={t('memoria:vista.cargando')} formas={['franja', 'tarjeta', 'rotulo', 'filas']} filas={5} />
      </Screen>
    );
  }

  const visibles = filtro === 'todo' ? hechos : hechos.filter((h) => h.category === filtro);
  const version = dossier?.version ?? 0;
  const subtitulo = error
    ? t('memoria:vista.noResponde')
    : hechos.length === 0
      ? t('memoria:vista.vacioSubtitulo')
      : t('memoria:vista.subtitulo', { count: hechos.length, version });
  // Sin nada leído, el error ocupa la pantalla; con algo leído, va encima.
  const vacioPorError = !!error && hechos.length === 0 && !dossier;

  return (
    <Screen>
      <Entrada indice={0}>
        <EncabezadoArena
          onVolver={acciones.onVolver}
          eyebrow={t('memoria:vista.eyebrow')}
          titulo={t('memoria:vista.titulo')}
          subtitulo={subtitulo}
          meandro
        />
      </Entrada>

      {error ? (
        <Entrada indice={1}>
          <ErrorSistema
            mensaje={error}
            onReintentar={acciones.onReintentar}
            compacto={!vacioPorError}
            style={styles.bloque}
          />
        </Entrada>
      ) : null}

      {vacioPorError ? null : (
        <>
          <Entrada indice={1}>
            <View style={styles.bloque}>
              <FranjaCifras
                cifras={[
                  { valor: hechos.length, rotulo: t('memoria:vista.hechos') },
                  {
                    valor: `v${version}`,
                    rotulo: t('memoria:vista.dossier'),
                    etiqueta: t('memoria:vista.dossierA11y', { version }),
                  },
                  gasto === null
                    ? { valor: SIN_DATO, rotulo: t('memoria:vista.esteMes'), etiqueta: t('memoria:vista.esteMesSinDato') }
                    : {
                        valor: gasto.toFixed(2).replace('.', ','),
                        rotulo: t('memoria:vista.esteMes'),
                        sufijo: ' $',
                        etiqueta: t('memoria:vista.esteMesA11y', { gasto: gasto.toFixed(2).replace('.', ',') }),
                      },
                ]}
              />
            </View>
          </Entrada>

          <Entrada indice={2}>
            <Section
              title={t('memoria:vista.quienEres')}
              action={
                dossier?.content
                  ? {
                      label: dossierAbierto ? t('memoria:vista.contraer') : t('memoria:vista.leerTodo'),
                      icon: dossierAbierto ? 'chevron-up' : 'chevron-down',
                      onPress: acciones.onAlternarDossier,
                    }
                  : undefined
              }
            >
              {dossier?.content ? (
                <TarjetaArena variante="piedra" remaches rotulo={t('memoria:vista.dossier')} meta={`v${version}`}>
                  <View style={!dossierAbierto && styles.plegado}>
                    <TextoSistema texto={dossier.content} />
                  </View>
                  {!dossierAbierto ? <View style={styles.velo} pointerEvents="none" /> : null}
                </TarjetaArena>
              ) : (
                <TarjetaArena variante="contorno">
                  <View style={styles.sinDossier}>
                    <Ionicons name="library-outline" size={20} color={ink.ink6} style={styles.icono} />
                    <View style={styles.flex}>
                      <Text style={styles.titulo} maxFontSizeMultiplier={1.35}>
                        {t('memoria:vista.sinDossierTitulo')}
                      </Text>
                      <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
                        {t('memoria:vista.sinDossierCuerpo')}
                      </Text>
                    </View>
                  </View>
                </TarjetaArena>
              )}
            </Section>
          </Entrada>

          <Entrada indice={3}>
            <Section title={t('memoria:vista.hechos')} meta={visibles.length > 0 ? `${visibles.length}` : undefined}>
              {hechos.length > 0 ? (
                <ChipRow style={styles.filtros}>
                  {CATEGORIAS.map((clave) => {
                    const n = clave === 'todo' ? hechos.length : hechos.filter((h) => h.category === clave).length;
                    if (!n && clave !== 'todo') return null;
                    const categoria = t(`memoria:categoria.${clave}`);
                    return (
                      <Chip
                        key={clave}
                        small
                        label={t('memoria:vista.filtro', { categoria, n })}
                        selected={filtro === clave}
                        onPress={() => acciones.onFiltro(clave)}
                        accessibilityLabel={t('memoria:vista.filtroA11y', { categoria, n })}
                      />
                    );
                  })}
                </ChipRow>
              ) : null}

              {visibles.length > 0 ? (
                <View>
                  {visibles.map((h, i) => (
                    <FilaHecho
                      key={h.id}
                      hecho={h}
                      primero={i === 0}
                      conCategoria={filtro === 'todo'}
                      borrando={borrando.has(h.id)}
                      onPress={() => acciones.onAbrirHecho(h)}
                      onBorrar={() => acciones.onBorrarHecho(h)}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState
                  icon="time-outline"
                  title={hechos.length === 0 ? t('memoria:vista.vacioTitulo') : t('memoria:vista.vacioCategoria')}
                  body={hechos.length === 0 ? t('memoria:vista.vacioCuerpo') : t('memoria:vista.otraCategoria')}
                />
              )}
            </Section>
          </Entrada>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  bloque: { marginBottom: space.s6 },
  hairline: { borderTopWidth: stroke.hairline, borderTopColor: ink.ink3 },
  plegado: { maxHeight: 168, overflow: 'hidden' },
  // La última línea plegada se apaga con una franja de la superficie (ink1), sin degradado.
  velo: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 28, backgroundColor: ink.ink1, opacity: 0.85 },
  sinDossier: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3 },
  icono: { marginTop: 3 },
  titulo: {
    fontFamily: tipo.headline.family,
    fontSize: tipo.headline.size,
    lineHeight: tipo.headline.lineHeight,
    letterSpacing: tipo.headline.tracking,
    color: ink.ink9,
    marginBottom: space.s1,
  },
  texto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
  },
  filtros: { marginBottom: space.s3 },
  fila: { flexDirection: 'row', alignItems: 'stretch' },
  hecho: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: space.s3, minHeight: 44, paddingVertical: space.s3 },
  // Acción de fila: un ghost sm (rótulo del Button) con zona táctil de 44 × 44.
  borrar: { minWidth: 64, minHeight: 44, alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: space.s3, paddingLeft: space.s2 },
  borrarTexto: {
    fontFamily: tipo.label.family,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: ink.ink8,
  },
  pulsado: { backgroundColor: ink.ink2 },
  fecha: {
    width: 56,
    fontFamily: tipo.number.family,
    fontSize: 13,
    lineHeight: 20,
    color: ink.ink6,
  },
  hechoCuerpo: { flex: 1, minWidth: 0 },
  hechoTexto: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
  // Mientras se borra, el texto baja a ink6 (sin opacidad).
  apagado: { color: ink.ink6 },
  tag: { flexDirection: 'row', marginTop: space.s2 },
});
