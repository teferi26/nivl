// NIVL · Amigos: el podio (L-RADICAL §B.4.2).
//
// Tres columnas dóricas de alto distinto (2.º 96 · 1.º 128 · 3.º 72) en hairline
// ink4, apoyadas en una basa común donde se graba el puesto en Cinzel
// (`type.cifra`). Encima de cada columna, el gladiador: Avatar 48 con el marco
// de su rango, nombre `micro` y su cifra en Cinzel 600 18 (Contador: al cambiar
// de periodo sube o baja hasta la nueva; al cambiar de métrica se vuelve a
// montar sin contar; son 3 de los 4 de la pantalla). Debajo, «TU PUESTO: 3.º DE 8» en inscripción entre dos laureles.
//
// Con uno o dos rivales (o sin tres cifras medidas) no hay podio: solo la línea.
// No es superficie invertida: la inversión de Amigos es mi fila del ranking.

import { StyleSheet, Text, View } from 'react-native';
import { Columna, Contador, Laurel } from '@/components/arena';
import { Avatar } from '@/components/ui';
import { ink, space, stroke, type as tipo, type Rank } from '@/design/tokens';
import { etiquetaPosicion, formatoValor, type Metrica } from '@/lib/socialmath';
import { lineaPuesto, ordenPodio, sufijoDe } from './cifraRanking';
import type { FilaRanking } from './ListaRanking';

interface PodioProps {
  /** El ranking ya clasificado (el mismo que la lista). */
  filas: readonly FilaRanking[];
  metrica: Metrica;
  /** Amigos en la arena (sin mí): con menos de 3, solo la línea. */
  rivales: number;
  miRango: Rank | null;
  rangos: ReadonlyMap<string, Rank>;
  atenuado?: boolean;
}

/** Alto de la columna por hueco del podio, en el orden pintado (2.º · 1.º · 3.º). */
const ALTOS = [96, 128, 72] as const;
const ANCHO_COLUMNA = 40;
const AVATAR = 48;
/** El podio no se estira más que esto en tableta y escritorio. */
const ANCHO_MAX = 440;

export function Podio({ filas, metrica, rivales, miRango, rangos, atenuado }: PodioProps) {
  const tres = ordenPodio(filas, rivales);
  const linea = lineaPuesto(filas);

  return (
    <View style={[styles.wrap, atenuado && styles.atenuado]}>
      {tres ? (
        <View
          accessible
          accessibilityLabel={`Podio. ${[tres[1], tres[0], tres[2]]
            .map((c) => `${etiquetaPosicion(c.posicion)}, ${c.competidor.isMe ? 'tú' : c.competidor.name}, ${formatoValor(c.valor, metrica)}`)
            .join('. ')}.`}
          style={styles.podio}
        >
          <View style={styles.huecos}>
            {tres.map((c, i) => {
              const b = c.competidor;
              return (
                // La clave lleva la métrica: al cambiarla el hueco se vuelve a
                // montar y la cifra aparece ya en su unidad (contar de XP a %
                // pasaba por «1.200 %»). Dentro de una métrica, cambiar de
                // periodo sí cuenta hasta la nueva.
                <View key={`${metrica}-${i}`} style={styles.hueco}>
                  <Avatar
                    size={AVATAR}
                    avatarPath={b.avatarPath}
                    name={b.name}
                    rank={b.isMe ? miRango : (rangos.get(b.userId) ?? null)}
                    titulo={c.titulo ?? undefined}
                  />
                  <Text style={styles.nombre} numberOfLines={1} maxFontSizeMultiplier={1.35}>
                    {b.isMe ? 'Tú' : b.name}
                  </Text>
                  <Contador
                    valor={c.valor ?? 0}
                    sufijo={sufijoDe(metrica)}
                    style={[styles.valor, i === 1 && styles.valorLider]}
                    maxFontSizeMultiplier={1}
                    adjustsFontSizeToFit
                  />
                  <View style={styles.columna}>
                    <Columna alto={ALTOS[i]} ancho={ANCHO_COLUMNA} color={i === 1 ? ink.ink6 : ink.ink4} />
                  </View>
                </View>
              );
            })}
          </View>
          {/* La basa: una losa con hairline arriba y abajo y el puesto grabado. */}
          <View style={styles.basa}>
            {tres.map((c, i) => (
              <Text
                key={`puesto-${i}`}
                style={[styles.puesto, i === 1 && styles.puestoLider]}
                maxFontSizeMultiplier={1}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {etiquetaPosicion(c.posicion)}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.lineaFila}>
        <Laurel alto={20} lado="izq" />
        <Text style={styles.linea} accessibilityRole="text" maxFontSizeMultiplier={1.35} numberOfLines={2}>
          {linea.toUpperCase()}
        </Text>
        <Laurel alto={20} lado="der" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.s6 },
  atenuado: { opacity: 0.45 },
  podio: { width: '100%', maxWidth: ANCHO_MAX, alignSelf: 'center' },
  huecos: { flexDirection: 'row', alignItems: 'flex-end' },
  hueco: { flex: 1, minWidth: 0, alignItems: 'center' },
  nombre: {
    marginTop: space.s2,
    maxWidth: '100%',
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    letterSpacing: tipo.micro.tracking,
    textTransform: 'uppercase',
    color: ink.ink8,
  },
  valor: {
    marginTop: 2,
    fontFamily: tipo.number.family,
    fontSize: 18,
    lineHeight: 22,
    color: ink.ink9,
  },
  valorLider: { color: ink.ink10 },
  columna: { marginTop: space.s2 },
  basa: {
    flexDirection: 'row',
    borderTopWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: ink.ink4,
    paddingVertical: space.s2,
  },
  puesto: {
    flex: 1,
    textAlign: 'center',
    fontFamily: tipo.cifra.family,
    fontSize: tipo.cifra.size,
    lineHeight: tipo.cifra.lineHeight,
    color: ink.ink6,
  },
  puestoLider: { color: ink.ink10 },
  lineaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s3,
    marginTop: space.s5,
  },
  linea: {
    flexShrink: 1,
    textAlign: 'center',
    fontFamily: tipo.inscripcion.family,
    fontSize: tipo.inscripcion.size,
    lineHeight: tipo.inscripcion.lineHeight,
    letterSpacing: tipo.inscripcion.tracking,
    color: ink.ink9,
  },
});
