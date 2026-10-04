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
import { TextoSistema } from '@/components/TextoSistema';
import { Chip, ChipRow, EmptyState, Screen, Section, Tag } from '@/components/ui';
import { SIN_DATO } from '@/components/ui/sinDato';
import { ink, space, stroke, type as tipo } from '@/design/tokens';
import type { CoachFact } from '@/lib/coach';

export const CATEGORIAS: { clave: string; etiqueta: string }[] = [
  { clave: 'todo', etiqueta: 'Todo' },
  { clave: 'aprendizaje', etiqueta: 'Aprendizajes' },
  { clave: 'venta', etiqueta: 'Ventas' },
  { clave: 'metrica', etiqueta: 'Métricas' },
  { clave: 'log', etiqueta: 'Registro' },
  { clave: 'objetivo', etiqueta: 'Objetivos' },
  { clave: 'proyecto', etiqueta: 'Proyectos' },
  { clave: 'regla', etiqueta: 'Reglas' },
  { clave: 'perfil', etiqueta: 'Perfil' },
];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-09-14" → "14 sep". Si no parece una fecha, se devuelve tal cual. */
export function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1] ?? ''}`;
}

export function etiquetaCategoria(clave: string): string {
  return CATEGORIAS.find((c) => c.clave === clave)?.etiqueta ?? clave;
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
        accessibilityLabel={`${categoria}, ${hecho.date}: ${hecho.content}`}
        accessibilityHint="Toca para leerlo entero."
        accessibilityState={{ disabled: borrando, busy: borrando }}
        accessibilityActions={[
          { name: 'activate', label: 'Leerlo entero' },
          { name: 'borrar', label: 'Borrar este recuerdo' },
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
        accessibilityLabel="Borrar este recuerdo"
        accessibilityState={{ disabled: borrando, busy: borrando }}
      >
        {borrando ? (
          <ActivityIndicator color={ink.ink6} size="small" accessibilityLabel="Borrando" />
        ) : (
          <Text style={styles.borrarTexto} maxFontSizeMultiplier={1.35}>
            Borrar
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
        <EncabezadoArena onVolver={acciones.onVolver} eyebrow="El sistema recuerda" titulo="Memoria" meandro />
        <CargaArena etiqueta="Leyendo la memoria" formas={['franja', 'tarjeta', 'rotulo', 'filas']} filas={5} />
      </Screen>
    );
  }

  const visibles = filtro === 'todo' ? hechos : hechos.filter((h) => h.category === filtro);
  const version = dossier?.version ?? 0;
  const subtitulo = error
    ? 'La memoria no responde.'
    : hechos.length === 0
      ? 'Todavía no hay nada anotado. Se escribe sola mientras hablas con el coach.'
      : `${hechos.length} ${hechos.length === 1 ? 'hecho anotado' : 'hechos anotados'} · dossier v${version}`;
  // Sin nada leído, el error ocupa la pantalla; con algo leído, va encima.
  const vacioPorError = !!error && hechos.length === 0 && !dossier;

  return (
    <Screen>
      <Entrada indice={0}>
        <EncabezadoArena
          onVolver={acciones.onVolver}
          eyebrow="El sistema recuerda"
          titulo="Memoria"
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
                  { valor: hechos.length, rotulo: 'Hechos' },
                  { valor: `v${version}`, rotulo: 'Dossier', etiqueta: `Dossier: versión ${version}` },
                  gasto === null
                    ? { valor: SIN_DATO, rotulo: 'Este mes', etiqueta: 'Este mes: sin dato' }
                    : {
                        valor: gasto.toFixed(2).replace('.', ','),
                        rotulo: 'Este mes',
                        sufijo: ' $',
                        etiqueta: `Este mes: ${gasto.toFixed(2).replace('.', ',')} dólares`,
                      },
                ]}
              />
            </View>
          </Entrada>

          <Entrada indice={2}>
            <Section
              title="Quién eres para el sistema"
              action={
                dossier?.content
                  ? {
                      label: dossierAbierto ? 'Contraer' : 'Leer todo',
                      icon: dossierAbierto ? 'chevron-up' : 'chevron-down',
                      onPress: acciones.onAlternarDossier,
                    }
                  : undefined
              }
            >
              {dossier?.content ? (
                <TarjetaArena variante="piedra" remaches rotulo="Dossier" meta={`v${version}`}>
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
                        Sin memoria estable aún
                      </Text>
                      <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
                        Se escribe sola cuando algo estructural cambia: un objetivo nuevo, un proyecto que muere, una
                        regla que pactas.
                      </Text>
                    </View>
                  </View>
                </TarjetaArena>
              )}
            </Section>
          </Entrada>

          <Entrada indice={3}>
            <Section title="Hechos" meta={visibles.length > 0 ? `${visibles.length}` : undefined}>
              {hechos.length > 0 ? (
                <ChipRow style={styles.filtros}>
                  {CATEGORIAS.map((c) => {
                    const n = c.clave === 'todo' ? hechos.length : hechos.filter((h) => h.category === c.clave).length;
                    if (!n && c.clave !== 'todo') return null;
                    return (
                      <Chip
                        key={c.clave}
                        small
                        label={`${c.etiqueta} · ${n}`}
                        selected={filtro === c.clave}
                        onPress={() => acciones.onFiltro(c.clave)}
                        accessibilityLabel={`Filtrar por ${c.etiqueta}, ${n}`}
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
                  title={hechos.length === 0 ? 'Nada anotado todavía' : 'Nada en esta categoría'}
                  body={
                    hechos.length === 0
                      ? 'Cada cifra, venta, aprendizaje o regla que le cuentes al coach queda aquí con su fecha.'
                      : 'Prueba otra categoría.'
                  }
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
