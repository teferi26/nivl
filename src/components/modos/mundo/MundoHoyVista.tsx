// NIVL · Mundos FOCUS, WORK y FOUNDER: el inicio, versión 1 sobria (P01,
// lámina 3). Pura: todo llega por props; los datos son los de Hoy de NIVL
// (useHoy), que con el modo activo ya filtra las misiones por su etiqueta
// (`quests.modes`, modos/tipos.ts → filtrarPorModo).
//
// Solo lo que ya existe y encaja (sin inventar funciones):
//   0 · La cabecera del mundo (emblema, nombre, nivel del modo).
//   1 · Avisos: fallo de carga y el informe del cierre (el mismo de NIVL).
//   2 · Las misiones del modo, con la SIGUIENTE invertida (QuestItem):
//       FOCUS «Tu foco de hoy», WORK «Prioridades de hoy», FOUNDER «La única
//       cosa de hoy». Se completan con la misma hoja (CompletarSheet).
//   3 · El orden del día (los bloques del plan: foco, trabajo profundo).
//   4 · El coach del modo.
// FUERA: hábitos, campañas, Winter Arc, Hero de rango y duelo: viven en NIVL.

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Entrada, TarjetaArena } from '@/components/arena';
import { OrdenDelDia } from '@/components/OrdenDelDia';
import { QuestItem } from '@/components/QuestItem';
import { Button, EmptyState, Screen, Section, SkeletonRows } from '@/components/ui';
import { DosColumnas } from '@/components/web/DosColumnas';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import type { HoyVistaProps } from '@/components/hoy/HoyVista';
import { NOMBRE_MODO } from '@/modos/tipos';

export type ModoMundoSobrio = 'focus' | 'work' | 'founder';

export interface MundoHoyVistaProps {
  modo: ModoMundoSobrio;
  cabecera: ReactNode;
  /** Lo que da useHoy (el mismo Hoy de NIVL, filtrado por el modo activo). */
  hoy: Pick<HoyVistaProps, 'estado' | 'error' | 'datos' | 'ocupada' | 'refrescando' | 'acciones'>;
  onCoach: () => void;
}

export function MundoHoyVista({ modo, cabecera, hoy, onCoach }: MundoHoyVistaProps) {
  const { estado, error, datos: d, ocupada, refrescando, acciones } = hoy;
  const cargando = estado === 'cargando';
  const nombre = NOMBRE_MODO[modo];
  const cuenta = d.modo ?? (d.total > 0 ? { hechas: d.hechas, total: d.total } : null);

  return (
    <Screen amplio refreshing={refrescando} onRefresh={acciones.onRefrescar}>
      <Entrada indice={0}>{cabecera}</Entrada>

      {/* En escritorio (web): avisos y misiones a la izquierda; el orden del día y el coach a la derecha. */}
      <DosColumnas
        principal={
          <>
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

            <Entrada indice={3}>
              <Section
                title={t(`mundos:mundo.misiones.${modo}`)}
                meta={!cargando && cuenta && cuenta.total > 0 ? `${cuenta.hechas}/${cuenta.total}` : undefined}
              >
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
                    {d.misiones.map((m) => (
                      <QuestItem
                        key={m.quest.id}
                        quest={m.quest}
                        completed={m.hecha}
                        xpAwarded={m.xpPagado}
                        busy={ocupada === m.quest.id}
                        streakDays={d.diasMultiplicador}
                        onComplete={acciones.onCompletar}
                        bloqueada={m.bloqueada}
                        siguiente={m.siguiente}
                      />
                    ))}
                  </View>
                )}
                {!cargando && d.todoHecho && d.misiones.length > 0 ? <Text style={styles.todoHecho}>{d.todoHecho}</Text> : null}
              </Section>
            </Entrada>

          </>
        }
        lateral={
          <>
            {!cargando && d.orden ? (
              <Entrada indice={4}>
                <OrdenDelDia plan={d.orden.plan} bloques={d.orden.bloques} onToggle={acciones.onAlternarBloque} pro={d.orden.pro} />
              </Entrada>
            ) : null}

            <Entrada indice={5} style={styles.bloque}>
              <TarjetaArena variante="contorno" rotulo={t('mundos:mundo.coachTitulo', { modo: nombre })}>
                <Text style={styles.cuerpo} maxFontSizeMultiplier={1.6}>
                  {t(`mundos:mundo.coachCuerpo.${modo}`)}
                </Text>
                <Button
                  title={t('mundos:mundo.coachAbrir')}
                  icon="chatbubble-ellipses-outline"
                  variant="secondary"
                  size="sm"
                  onPress={onCoach}
                  style={styles.boton}
                />
              </TarjetaArena>
            </Entrada>
          </>
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
  boton: { marginTop: space.s4, alignSelf: 'flex-start' },
});
