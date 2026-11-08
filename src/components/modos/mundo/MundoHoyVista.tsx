// NIVL · Mundos FOCUS, WORK y FOUNDER: el inicio, versión 1 sobria (P01,
// lámina 3). Pura: todo llega por props; los datos son los de Hoy de NIVL
// (useHoy), que con el modo activo ya filtra las misiones por su etiqueta
// (`quests.modes`, modos/tipos.ts → filtrarPorModo).
//
// Solo lo que ya existe y encaja (sin inventar funciones):
//   0 · La cabecera del mundo (emblema, marca y nombre del modo).
//   1 · Avisos: fallo de carga y el informe del cierre (el mismo de NIVL).
//   2 · Ónix: el héroe del modo (escudo con nivel, salvo en WORK), el coach, la
//       tarjeta AHORA con la siguiente misión en un botón hueso (la misma hoja,
//       CompletarSheet) y tres cifras.
//   3 · El resto de las misiones (QuestItem).
//   4 · El orden del día (los bloques del plan: foco, trabajo profundo).
// FUERA: hábitos, campañas, Winter Arc, Hero de rango y duelo: viven en NIVL.

import { TarjetasPrimerUso } from '@/components/hoy/TarjetasPrimerUso';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Entrada, formatoMiles, ratioSeguro, TarjetaArena } from '@/components/arena';
import { OrdenDelDia } from '@/components/OrdenDelDia';
import { QuestItem } from '@/components/QuestItem';
import { Button, EmptyState, Screen, Section, SkeletonRows } from '@/components/ui';
import { DosColumnas } from '@/components/web/DosColumnas';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import type { HoyVistaProps } from '@/components/hoy/HoyVista';
import type { NivelModo } from '@/modos/niveles';
import { NOMBRE_MODO } from '@/modos/tipos';
import { HeroMundo, TarjetaCoach, TresCifras, tituloAhora } from './PiezasOnix';

export type ModoMundoSobrio = 'focus' | 'work' | 'founder';

export interface MundoHoyVistaProps {
  modo: ModoMundoSobrio;
  cabecera: ReactNode;
  /** El nivel del modo; null mientras se lee. */
  nivel: NivelModo | null;
  /** Lo que da useHoy (el mismo Hoy de NIVL, filtrado por el modo activo). */
  hoy: Pick<HoyVistaProps, 'estado' | 'error' | 'datos' | 'ocupada' | 'refrescando' | 'acciones'>;
  onCoach: () => void;
}

export function MundoHoyVista({ modo, cabecera, nivel, hoy, onCoach }: MundoHoyVistaProps) {
  const { estado, error, datos: d, ocupada, refrescando, acciones } = hoy;
  const cargando = estado === 'cargando';
  const nombre = NOMBRE_MODO[modo];
  const cuenta = d.modo ?? (d.total > 0 ? { hechas: d.hechas, total: d.total } : null);
  const ahora = d.misiones.find((m) => m.siguiente && !m.hecha) ?? null;
  const resto = ahora ? d.misiones.filter((m) => m !== ahora) : d.misiones;
  const maximo = nivel !== null && nivel.xpSiguiente <= 0;
  const rango = d.rango ? (d.racha.valor > 0 ? t('mundos:mundo.rangoDia', { rango: d.rango, dia: d.racha.valor }) : t('mundos:mundo.rango', { rango: d.rango })) : nombre;

  return (
    <Screen amplio refreshing={refrescando} onRefresh={acciones.onRefrescar}>
      <Entrada indice={0}>{cabecera}</Entrada>

      {/* En escritorio (web): avisos y misiones a la izquierda; el orden del día y el coach a la derecha. */}
      <DosColumnas
        principal={
          <>
            <TarjetasPrimerUso />
            {error ? (
              <Entrada indice={1} style={styles.bloque}>
                <TarjetaArena variante="contorno">
                  <EmptyState
                    compact
                    icon="cloud-offline-outline"
                    title={t('comun:sistemaNoResponde')}
                    body={error}
                    action={{ label: t('comun:reintentar'), onPress: acciones.onReintentar }}
                  />
                </TarjetaArena>
              </Entrada>
            ) : null}

            {!cargando && d.cierre ? (
              <Entrada indice={2} style={styles.bloque}>
                <TarjetaArena
                  variante={d.cierre.alerta ? 'trama' : 'contorno'}
                  rotulo={d.cierre.alerta ? t('hoy:vista.alertaRotulo') : t('hoy:vista.informeRotulo')}
                >
                  {d.cierre.lineas.map((l) => (
                    <Text key={l} style={[styles.cuerpo, styles.linea]}>
                      {l}
                    </Text>
                  ))}
                </TarjetaArena>
              </Entrada>
            ) : null}

            {!cargando && nivel ? (
              <Entrada indice={3} style={styles.bloque}>
                <HeroMundo
                  rotulo={modo === 'work' ? nombre : rango}
                  titulo={t(`mundos:mundo.misiones.${modo}`)}
                  ratio={maximo ? 1 : ratioSeguro(nivel.xpEnNivel, nivel.xpSiguiente)}
                  pie={maximo ? t('mundos:cabecera.xpMax') : t('mundos:cabecera.xp', { xp: formatoMiles(nivel.xpEnNivel), total: formatoMiles(nivel.xpSiguiente) })}
                  etiquetaBarra={t('mundos:cabecera.nivelA11y', { modo: nombre, nivel: nivel.nivel, xp: formatoMiles(nivel.xp) })}
                  escudo={modo === 'work' ? undefined : nivel.nivel}
                />
              </Entrada>
            ) : null}

            <Entrada indice={4} style={styles.bloque}>
              <TarjetaCoach cuerpo={t(`mundos:mundo.coachCuerpo.${modo}`)} onAbrir={onCoach} />
            </Entrada>

            {!cargando && ahora ? (
              <Entrada indice={5} style={styles.bloque}>
                <TarjetaArena rotulo={t('mundos:mundo.ahora')}>
                  <Text style={styles.ahora} accessibilityRole="header" maxFontSizeMultiplier={1.35} numberOfLines={3}>
                    {ahora.quest.title}
                  </Text>
                  <Button
                    title={t('mundos:mundo.completar')}
                    size="lg"
                    disabled={ahora.bloqueada}
                    loading={ocupada === ahora.quest.id}
                    onPress={() => acciones.onCompletar(ahora.quest)}
                    style={styles.boton}
                  />
                </TarjetaArena>
              </Entrada>
            ) : null}

            {!cargando && !error && nivel ? (
              <Entrada indice={6} style={styles.bloque}>
                <TresCifras
                  cifras={[
                    { valor: cuenta ? `${cuenta.hechas}/${cuenta.total}` : '0', rotulo: t('mundos:mundo.cifras.hoy') },
                    { valor: String(d.racha.valor), rotulo: t('mundos:mundo.cifras.racha') },
                    { valor: formatoMiles(nivel.xp), rotulo: t('mundos:mundo.cifras.xp') },
                  ]}
                />
              </Entrada>
            ) : null}

            {!cargando && ahora && resto.length === 0 ? null : (
            <Entrada indice={7}>
              <Section title={ahora ? t('mundos:mundo.resto') : t(`mundos:mundo.misiones.${modo}`)}>
                {cargando ? (
                  <View accessibilityRole="progressbar" accessibilityLabel={t('mundos:mundo.cargandoA11y', { modo: nombre })}>
                    <SkeletonRows rows={3} />
                  </View>
                ) : d.misiones.length === 0 ? (
                  error ? null : (
                    <TarjetaArena variante="contorno">
                      <EmptyState
                        compact
                        icon="pricetag-outline"
                        title={t('mundos:mundo.vacioTitulo', { modo: nombre })}
                        body={t('mundos:mundo.vacioCuerpo', { modo: nombre })}
                        action={{ label: t('mundos:mundo.coachAbrir'), onPress: onCoach }}
                      />
                    </TarjetaArena>
                  )
                ) : (
                  <View>
                    {resto.map((m) => (
                      <QuestItem
                        key={m.quest.id}
                        quest={m.quest}
                        completed={m.hecha}
                        xpAwarded={m.xpPagado}
                        busy={ocupada === m.quest.id}
                        streakDays={d.diasMultiplicador}
                        onComplete={acciones.onCompletar}
                        bloqueada={m.bloqueada}
                      />
                    ))}
                  </View>
                )}
                {!cargando && d.todoHecho && d.misiones.length > 0 ? <Text style={styles.todoHecho}>{d.todoHecho}</Text> : null}
              </Section>
            </Entrada>
            )}
          </>
        }
        lateral={
          !cargando && d.orden ? (
            <Entrada indice={7}>
              <OrdenDelDia plan={d.orden.plan} bloques={d.orden.bloques} onToggle={acciones.onAlternarBloque} pro={d.orden.pro} />
            </Entrada>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloque: { marginBottom: space.s6 },
  cuerpo: {
    fontFamily: tipo.body.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
  },
  linea: { marginTop: space.s1 },
  todoHecho: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginTop: space.s3,
  },
  ahora: tituloAhora,
  boton: { marginTop: space.s4 },
});
