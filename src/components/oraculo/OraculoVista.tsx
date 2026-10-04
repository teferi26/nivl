// NIVL · Oráculo: la vista (patrón L-RADICAL §C, FASE3 G1). Pura: todo llega
// por props desde useOraculo (o desde la galería con datos de mentira).
//
// De arriba abajo: el encabezado grabado («El sistema forja» / «ORÁCULO», con
// la llave de la clave propia solo si `byokEnabled()`), el objetivo en un
// Campo de varias líneas y «Consultar al oráculo», y debajo un único bloque
// según el momento:
//   · espera      → TarjetaArena contorno «El oráculo espera».
//   · deliberando → TarjetaArena contorno con huecos que respiran.
//   · sin Pro     → TarjetaArena trama remachada con candado (bloqueado) y
//                   «Ver NIVL Pro» en secondary; la ruta a /pro no cambia.
//   · veredicto   → el resumen en TarjetaArena piedra remachada (con
//                   «Denunciar respuesta»), las misiones propuestas con Check
//                   entre hairlines y «Aceptar N misiones».
// Los fallos de consultar y de aceptar van en línea (ErrorSistema compacto).
//
// INVERSIÓN única: «Consultar al oráculo» mientras no hay propuestas; con
// propuestas pasa a secondary y la inversión es «Aceptar N misiones».

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { Campo, CargaArena, EncabezadoArena, Entrada, ErrorSistema, TarjetaArena } from '@/components/arena';
import { TextoSistema } from '@/components/TextoSistema';
import { Button, Check, Row, Screen, Section } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { DIFFICULTY_LABEL, XP_BY_DIFFICULTY } from '@/lib/game';
import type { ProposedQuest } from '@/lib/oracle';

export interface OraculoVistaProps {
  /** La web con clave propia (`byokEnabled()`); nunca en la app de tienda. */
  clavePropia: boolean;
  claveGuardada: boolean;
  objetivo: string;
  consultando: boolean;
  aceptando: boolean;
  /** La consulta ha respondido que el Oráculo es de NIVL Pro. */
  pidePro: boolean;
  propuestas: ProposedQuest[];
  seleccionadas: Set<number>;
  resumen: string;
  /** Fallo de la consulta, ya escrito para el usuario. */
  errorConsulta: string | null;
  /** Fallo al aceptar, ya escrito para el usuario. */
  errorAceptar: string | null;
  acciones: {
    onVolver: () => void;
    onObjetivo: (v: string) => void;
    onConsultar: () => void;
    onAlternar: (i: number) => void;
    onAceptar: () => void;
    onAbrirClave: () => void;
    onVerPro: () => void;
    onDenunciar: () => void;
  };
}

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const dias = (d: number[]) => (d.length === 7 ? 'todos los días' : d.map((x) => DAY_LABELS[x - 1]).join(' '));

export function OraculoVista({
  clavePropia,
  claveGuardada,
  objetivo,
  consultando,
  aceptando,
  pidePro,
  propuestas,
  seleccionadas,
  resumen,
  errorConsulta,
  errorAceptar,
  acciones,
}: OraculoVistaProps) {
  const hayPropuestas = propuestas.length > 0;
  const n = seleccionadas.size;

  return (
    <Screen>
      <Entrada indice={0}>
        <EncabezadoArena
          onVolver={acciones.onVolver}
          eyebrow="El sistema forja"
          titulo="Oráculo"
          subtitulo={
            clavePropia && claveGuardada
              ? 'Dile tu objetivo y lo convierte en misiones. Tu clave está en este dispositivo.'
              : 'Dile tu objetivo y lo convierte en misiones diarias con fecha y medida.'
          }
          accion={
            clavePropia
              ? {
                  icono: 'key-outline',
                  etiqueta: claveGuardada ? 'Cambiar la clave de API' : 'Usar mi propia clave de API',
                  onPress: acciones.onAbrirClave,
                }
              : undefined
          }
          meandro
        />
      </Entrada>

      {/* El bloque con el campo no lleva Entrada: un campo con el foco no debe moverse al aparecer. */}
      <View style={styles.bloque}>
        <Campo
          etiqueta="Tu objetivo"
          value={objetivo}
          onChangeText={acciones.onObjetivo}
          placeholder="Correr 10 km en mayo. Aprobar Cálculo con nota. Dormir 8 horas."
          multiline
          editable={!consultando}
          accessibilityLabel="Tu objetivo"
          style={styles.objetivo}
        />
        <Button
          title="Consultar al oráculo"
          icon="sparkles-outline"
          variant={hayPropuestas ? 'secondary' : 'primary'}
          size="lg"
          onPress={acciones.onConsultar}
          loading={consultando}
          disabled={!objetivo.trim()}
          style={styles.consultar}
        />
        {errorConsulta && !consultando ? (
          <ErrorSistema compacto mensaje={errorConsulta} onReintentar={acciones.onConsultar} style={styles.error} />
        ) : null}
      </View>

      {consultando ? (
        <Entrada indice={1}>
          <TarjetaArena variante="contorno" rotulo="El oráculo delibera">
            <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
              Unos segundos. Está midiendo tu objetivo contra tus días.
            </Text>
            <CargaArena etiqueta="El oráculo delibera" formas={['filas']} style={styles.carga} />
          </TarjetaArena>
        </Entrada>
      ) : null}

      {pidePro && !consultando ? (
        <Entrada indice={1}>
          <TarjetaArena variante="trama" remaches rotulo="NIVL Pro">
            <View style={styles.bloqueado}>
              <Ionicons name="lock-closed-outline" size={20} color={ink.ink9} style={styles.candado} />
              <View style={styles.flex}>
                <Text style={styles.titulo} maxFontSizeMultiplier={1.35}>
                  El Oráculo es parte de NIVL Pro
                </Text>
                <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
                  Convertir objetivos en misiones con IA va con el coach. El resto de NIVL sigue siendo tuyo.
                </Text>
              </View>
            </View>
            <Button title="Ver NIVL Pro" variant="secondary" size="sm" onPress={acciones.onVerPro} style={styles.boton} />
          </TarjetaArena>
        </Entrada>
      ) : null}

      {!consultando && !hayPropuestas && !pidePro ? (
        <Entrada indice={1}>
          <TarjetaArena variante="contorno" rotulo="El oráculo espera">
            <Text style={styles.texto} maxFontSizeMultiplier={1.35}>
              Un objetivo concreto, con fecha y medida, da mejores misiones. Tú eliges cuáles aceptar.
            </Text>
          </TarjetaArena>
        </Entrada>
      ) : null}

      {hayPropuestas ? (
        <>
          <Entrada indice={1}>
            <Section
              title="Veredicto del sistema"
              action={{ label: 'Denunciar respuesta', icon: 'flag-outline', onPress: acciones.onDenunciar }}
            >
              <TarjetaArena variante="piedra" remaches>
                <TextoSistema texto={resumen} />
              </TarjetaArena>
            </Section>
          </Entrada>

          <Entrada indice={2}>
            <Section title="Misiones propuestas" meta={`${n}/${propuestas.length}`}>
              <View>
                {propuestas.map((p, i) => {
                  const on = seleccionadas.has(i);
                  return (
                    <Row
                      key={i}
                      first={i === 0}
                      leading={<Check checked={on} />}
                      title={p.title}
                      muted={!on}
                      detail={
                        <View>
                          <Text style={styles.meta} maxFontSizeMultiplier={1.35}>
                            {p.stat} · {DIFFICULTY_LABEL[p.difficulty]} · {dias(p.days_of_week)}
                          </Text>
                          {p.reasoning ? (
                            <Text style={styles.razon} numberOfLines={3} maxFontSizeMultiplier={1.35}>
                              {p.reasoning}
                            </Text>
                          ) : null}
                        </View>
                      }
                      trailing={
                        <Text style={[styles.xp, !on && styles.xpApagado]} maxFontSizeMultiplier={1.35}>
                          {/* Cinzel no tiene minúsculas: «hasta» va en Outfit, como la unidad. */}
                          <Text style={styles.xpUnidad}>hasta </Text>+{XP_BY_DIFFICULTY[p.difficulty]}
                          <Text style={styles.xpUnidad}> XP</Text>
                        </Text>
                      }
                      onPress={() => acciones.onAlternar(i)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`Misión propuesta: ${p.title}, hasta ${XP_BY_DIFFICULTY[p.difficulty]} XP, ${on ? 'aceptada' : 'descartada'}`}
                    />
                  );
                })}
              </View>
              <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
                Desmarca las que no quieras. Las aceptadas pasan a Hábitos como misiones diarias.
              </Text>
              {errorAceptar ? <ErrorSistema compacto mensaje={errorAceptar} style={styles.error} /> : null}
              <Button
                title={n === 1 ? 'Aceptar 1 misión' : `Aceptar ${n} misiones`}
                icon="checkmark"
                size="lg"
                onPress={acciones.onAceptar}
                loading={aceptando}
                disabled={n === 0}
                style={styles.consultar}
              />
            </Section>
          </Entrada>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  bloque: { marginBottom: space.s6 },
  objetivo: {
    minHeight: 110,
    fontFamily: tipo.headline.family,
    fontSize: 18,
    lineHeight: 26,
  },
  consultar: { marginTop: space.s4 },
  error: { marginTop: space.s4 },
  carga: { marginTop: space.s4 },
  boton: { alignSelf: 'flex-start', marginTop: space.s4 },
  bloqueado: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3 },
  candado: { marginTop: 3 },
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
  meta: {
    fontFamily: tipo.micro.family,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: tipo.micro.tracking,
    color: ink.ink8,
  },
  razon: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: 3,
  },
  xp: { fontFamily: tipo.number.family, fontSize: 16, color: ink.ink10 },
  xpApagado: { color: ink.ink6 },
  xpUnidad: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, letterSpacing: tipo.micro.tracking },
  nota: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink6,
    marginTop: space.s3,
  },
});
