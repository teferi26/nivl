// NIVL · General · Arena: la competición con amigos, rediseñada pieza a pieza
// con la piel de NIVL (lámina 4 de la P01). Pura: los datos llegan de useAmigos
// (ranking, solicitudes, código) y de useDuelos (duelos de la semana).
//
//   · Título y la franja de cifras (amigos, tu puesto, duelos en curso).
//   · Ranking por CONSTANCIA (cumplimiento por defecto; XP y racha a un toque),
//     semana o mes; el podio de los tres primeros y la lista. Tu posición va
//     FIJA abajo, sobre la barra, aunque estés el último.
//   · Duelos: los que te retan (aceptar o rechazar), los activos con su
//     marcador (tu disciplina frente a la suya), los enviados y los pasados.
//   · Solicitudes entrantes y enviadas.
//   · Añadir amigos: tu código (copiar, invitar) y el campo para el suyo.
//   · Ludus, privacidad y bloqueados siguen en «Ajustes de la arena» (/amigos).
// Sin ligas (LIGAS_VISIBLES apagado).

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Entrada, formatoMiles } from '@/components/arena';
import { codigoLegible, LARGO_CODIGO, type Metrica, type Ventana } from '@/lib/socialmath';
import type { Duelo } from '@/lib/competicionData';
import type { FriendRequest } from '@/lib/social';
import type { FilaRanking } from '@/components/amigos/ListaRanking';
import { datosRival, detalleResuelto, diasRestantes, lineaDuelo, nombreRival, textoQuedan, textoResultado } from '@/components/amigos/competicionVista';
import { t } from '@/i18n';
import type { DatosDuelos } from './useDuelos';
import {
  BarraGeneral,
  BotonGeneral,
  ChipGeneral,
  CifraGeneral,
  FilaCifras,
  FilaGeneral,
  HuecoGeneral,
  PantallaGeneral,
  RotuloGeneral,
  Segmentos,
  TarjetaGeneral,
  textoGeneral,
  TituloGeneral,
} from '../piezas';
import { C, F, fs, G, oroA, oroMezcla, px } from '../tema';

export interface ArenaGeneralVistaProps {
  cargando: boolean;
  fallo: string | null;
  refrescando: boolean;
  refrescar: () => void;
  subtitulo: string;
  numAmigos: number;
  ranking: readonly FilaRanking[];
  ventana: Ventana;
  elegirVentana: (v: Ventana) => void;
  metrica: Metrica;
  elegirMetrica: (m: Metrica) => void;
  /** Mi código de amigo; null mientras carga. */
  miCodigo: string | null;
  copiado: boolean;
  copiar: () => void;
  invitar: () => void;
  codigo: string;
  setCodigo: (v: string) => void;
  enviar: () => void;
  enviando: boolean;
  avisoCodigo: { texto: string; error: boolean } | null;
  entrantes: readonly FriendRequest[];
  salientes: readonly FriendRequest[];
  ocupada: string | null;
  responder: (r: FriendRequest, aceptar: boolean) => void;
  retirar: (r: FriendRequest) => void;
  abrirSeguridad: (p: { userId: string; name: string }) => void;
  duelos: Pick<DatosDuelos, 'disponible' | 'listo' | 'fallo' | 'hoy' | 'vista' | 'ocupado' | 'responder'>;
  /** Abre la hoja de retar (con un rival elegido, para la revancha). */
  onRetar: (rival: { userId: string; name: string } | null) => void;
  amigos: readonly { userId: string; name: string }[];
  onAjustes: () => void;
}

const METRICAS: readonly Metrica[] = ['cumplimiento', 'xp', 'racha'];

function valorTexto(valor: number | null, m: Metrica): string {
  if (valor === null) return '-';
  if (m === 'cumplimiento') return `${valor} %`;
  if (m === 'xp') return `${formatoMiles(valor)} XP`;
  return t('general:avance.dias', { count: valor });
}

export function ArenaGeneralVista(p: ArenaGeneralVistaProps) {
  const yo = p.ranking.find((f) => f.competidor.isMe) ?? null;
  const total = p.ranking.length;
  const podio = p.ranking.slice(0, 3);
  const resto = p.ranking.slice(3);
  const dv = p.duelos.vista;
  const enCurso = dv.activos.length;

  const fija =
    yo && total > 1 && !p.cargando ? (
      <View style={styles.fija} pointerEvents="none" accessible accessibilityLabel={t('general:arena.puestoA11y', { puesto: yo.posicion, total, valor: valorTexto(yo.valor, p.metrica) })}>
        <Text style={styles.fijaPuesto}>{`${yo.posicion}.º`}</Text>
        <View style={styles.flex}>
          <Text style={styles.fijaRotulo}>{t('general:arena.tuPuesto')}</Text>
          <Text style={styles.fijaTexto} numberOfLines={1}>
            {t('general:arena.deTotal', { puesto: yo.posicion, total })}
          </Text>
        </View>
        <Text style={styles.fijaValor}>{valorTexto(yo.valor, p.metrica)}</Text>
      </View>
    ) : null;

  return (
    <PantallaGeneral refreshing={p.refrescando} onRefresh={p.refrescar} overlay={fija}>
      <Entrada indice={0}>
        <TituloGeneral
          eyebrow={t('general:arena.eyebrow')}
          titulo={t('general:arena.titulo')}
          derecha={
            <Pressable onPress={p.onAjustes} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('general:arena.ajustes')} style={styles.ajustes}>
              <Ionicons name="settings-outline" size={18} color={G} />
            </Pressable>
          }
        />
        <Text style={[textoGeneral.detalle, styles.sub]}>{p.subtitulo}</Text>
      </Entrada>

      {p.cargando ? (
        <View style={styles.huecos} accessibilityRole="progressbar" accessibilityLabel={t('general:arena.cargandoA11y')}>
          <HuecoGeneral alto={px(64)} />
          <HuecoGeneral alto={px(190)} />
          <HuecoGeneral alto={px(150)} />
        </View>
      ) : p.fallo && total === 0 ? (
        <TarjetaGeneral>
          <RotuloGeneral texto={t('general:hoy.errorRotulo')} />
          <Text style={[textoGeneral.cuerpo, styles.arriba]}>{p.fallo}</Text>
          <BotonGeneral titulo={t('comun:reintentar')} fantasma fino onPress={p.refrescar} />
        </TarjetaGeneral>
      ) : (
        <>
          <Entrada indice={1}>
            <FilaCifras>
              <CifraGeneral icono="people" rotulo={t('general:arena.amigos')} valor={String(p.numAmigos)} />
              <CifraGeneral icono="podium" rotulo={t('general:arena.puesto')} valor={yo && total > 1 ? `${yo.posicion}.º` : '-'} nota={total > 1 ? t('general:arena.de', { total }) : undefined} />
              <CifraGeneral icono="flash" rotulo={t('general:arena.duelos')} valor={String(enCurso)} nota={t('general:arena.enCurso')} />
            </FilaCifras>
          </Entrada>

          {/* Ranking */}
          <Entrada indice={2}>
            <RotuloGeneral texto={t('general:arena.ranking')} em={t(`general:arena.ventana.${p.ventana}`)} seccion />
            <Segmentos
              opciones={[
                { id: 'semana', texto: t('general:arena.ventana.semana') },
                { id: 'mes', texto: t('general:arena.ventana.mes') },
              ]}
              valor={p.ventana}
              alCambiar={p.elegirVentana}
            />
            <View style={styles.chips}>
              {METRICAS.map((m) => (
                <ChipGeneral key={m} texto={t(`general:arena.metrica.${m}`)} activo={p.metrica === m} onPress={() => p.elegirMetrica(m)} />
              ))}
            </View>
          </Entrada>

          {p.numAmigos === 0 ? (
            <TarjetaGeneral heroe>
              <Text style={textoGeneral.titulo}>{t('general:arena.vacioTitulo')}</Text>
              <Text style={[textoGeneral.cuerpo, styles.arriba]}>{t('general:arena.vacioCuerpo')}</Text>
              <BotonGeneral titulo={t('amigos:codigo.invitar')} icono="paper-plane-outline" onPress={p.invitar} />
            </TarjetaGeneral>
          ) : (
            <Entrada indice={3}>
              <TarjetaGeneral heroe>
                <View style={styles.podio}>
                  {[1, 0, 2].map((i) => {
                    const f = podio[i];
                    if (!f) return <View key={i} style={styles.podioCol} />;
                    const alto = i === 0 ? px(84) : i === 1 ? px(60) : px(44);
                    return (
                      <View key={f.competidor.userId} style={styles.podioCol} accessible accessibilityLabel={t('general:arena.filaA11y', { puesto: f.posicion, nombre: f.competidor.name, valor: valorTexto(f.valor, p.metrica) })}>
                        <Inicial nombre={f.competidor.name} grande={i === 0} mia={f.competidor.isMe} />
                        <Text style={[styles.podioNombre, f.competidor.isMe && styles.oro]} numberOfLines={1}>
                          {f.competidor.isMe ? t('amigos:comun.tu') : f.competidor.name}
                        </Text>
                        <Text style={styles.podioValor} numberOfLines={1}>
                          {valorTexto(f.valor, p.metrica)}
                        </Text>
                        <View style={[styles.peana, { height: alto }, i === 0 && styles.peanaOro]}>
                          <Text style={[styles.peanaNum, i === 0 && styles.peanaNumOro]}>{f.posicion}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </TarjetaGeneral>
              {resto.length > 0 ? (
                <TarjetaGeneral style={styles.lista}>
                  {resto.map((f, i) => (
                    <FilaGeneral
                      key={f.competidor.userId}
                      primera={i === 0}
                      style={f.competidor.isMe ? styles.filaMia : undefined}
                      onPress={f.competidor.isMe ? undefined : () => p.abrirSeguridad(f.competidor)}
                      accessibilityLabel={t('general:arena.filaA11y', { puesto: f.posicion, nombre: f.competidor.name, valor: valorTexto(f.valor, p.metrica) })}
                    >
                      <Text style={[styles.puesto, f.competidor.isMe && styles.oro]}>{f.posicion}</Text>
                      <Inicial nombre={f.competidor.name} mia={f.competidor.isMe} />
                      <View style={styles.flex}>
                        <Text style={[textoGeneral.fila, f.competidor.isMe && styles.oro]} numberOfLines={1}>
                          {f.competidor.isMe ? t('amigos:comun.tu') : f.competidor.name}
                        </Text>
                        {f.titulo ? <Text style={textoGeneral.detalle} numberOfLines={1}>{f.titulo}</Text> : null}
                      </View>
                      <Text style={styles.valor}>{valorTexto(f.valor, p.metrica)}</Text>
                    </FilaGeneral>
                  ))}
                </TarjetaGeneral>
              ) : null}
            </Entrada>
          )}

          {/* Duelos */}
          {p.duelos.disponible ? (
            <Entrada indice={4}>
              <RotuloGeneral texto={t('general:arena.duelosRotulo')} em={enCurso > 0 ? t('general:arena.enCursoN', { n: enCurso }) : undefined} seccion />
              {!p.duelos.listo ? (
                <HuecoGeneral alto={px(110)} />
              ) : (
                <>
                  {p.duelos.fallo ? <Text style={[textoGeneral.detalle, styles.arriba]}>{p.duelos.fallo}</Text> : null}
                  {dv.porResponder.map((d) => (
                    <TarjetaGeneral key={d.id} heroe style={styles.separado}>
                      <RotuloGeneral texto={t('general:arena.teReta')} em={textoQuedan(diasRestantes(d.week_start, p.duelos.hoy))} />
                      <Text style={[textoGeneral.titulo, styles.arriba]}>{nombreRival(d)}</Text>
                      <Text style={textoGeneral.detalle}>{t('amigos:competicion.regla')}</Text>
                      <View style={styles.botones}>
                        <BotonGeneral titulo={t('amigos:comun.aceptar')} icono="flash" onPress={() => p.duelos.responder(d, true)} ocupado={p.duelos.ocupado === d.id} style={styles.flex} />
                        <BotonGeneral titulo={t('general:arena.rechazar')} fantasma onPress={() => p.duelos.responder(d, false)} desactivado={p.duelos.ocupado === d.id} style={styles.flex} />
                      </View>
                    </TarjetaGeneral>
                  ))}
                  {dv.activos.map((d) => (
                    <Marcador key={d.id} d={d} hoy={p.duelos.hoy} />
                  ))}
                  {dv.enviados.length + dv.cerrados.length + dv.resueltos.length > 0 ? (
                    <TarjetaGeneral style={[styles.lista, styles.separado]}>
                      {dv.enviados.map((d, i) => (
                        <FilaGeneral key={d.id} primera={i === 0}>
                          <Ionicons name="hourglass-outline" size={px(15)} color={C.mudo} />
                          <Text style={[textoGeneral.fila, styles.flex]} numberOfLines={1}>{nombreRival(d)}</Text>
                          <Text style={textoGeneral.detalle}>{t('general:arena.enviado')}</Text>
                        </FilaGeneral>
                      ))}
                      {dv.cerrados.map((d, i) => (
                        <FilaGeneral key={d.id} primera={dv.enviados.length === 0 && i === 0}>
                          <Ionicons name="hourglass-outline" size={px(15)} color={C.mudo} />
                          <Text style={[textoGeneral.fila, styles.flex]} numberOfLines={1}>{nombreRival(d)}</Text>
                          <Text style={textoGeneral.detalle}>{t('amigos:competicion.semanaCerrada')}</Text>
                        </FilaGeneral>
                      ))}
                      {dv.resueltos.map((d, i) => {
                        const mismos = d.resultado === 'pierdo' && d.rival ? p.amigos.filter((a) => a.name === d.rival) : [];
                        const rival = mismos.length === 1 ? mismos[0]! : null;
                        const gano = d.resultado === 'gano';
                        return (
                          <FilaGeneral key={d.id} primera={dv.enviados.length + dv.cerrados.length === 0 && i === 0}>
                            <Ionicons name={gano ? 'trophy' : 'flag-outline'} size={px(15)} color={gano ? G : C.mudo} />
                            <View style={styles.flex}>
                              <Text style={textoGeneral.fila} numberOfLines={1}>{nombreRival(d)}</Text>
                              <Text style={textoGeneral.detalle} numberOfLines={1}>{detalleResuelto(d, false)}</Text>
                            </View>
                            {rival ? (
                              <ChipGeneral texto={t('amigos:competicion.revancha')} onPress={() => p.onRetar(rival)} />
                            ) : (
                              <Text style={[styles.resultado, gano && styles.oro]}>{textoResultado(d.resultado!)}</Text>
                            )}
                          </FilaGeneral>
                        );
                      })}
                    </TarjetaGeneral>
                  ) : null}
                  {dv.porResponder.length + dv.activos.length + dv.enviados.length + dv.cerrados.length + dv.resueltos.length === 0 ? (
                    <Text style={[textoGeneral.cuerpo, styles.arriba]}>{t('amigos:competicion.vacio')}</Text>
                  ) : null}
                  <BotonGeneral titulo={t('general:arena.retar')} icono="flash-outline" onPress={() => p.onRetar(null)} desactivado={p.amigos.length === 0} />
                </>
              )}
            </Entrada>
          ) : null}

          {/* Solicitudes */}
          {p.entrantes.length + p.salientes.length > 0 ? (
            <Entrada indice={5}>
              <RotuloGeneral texto={t('amigos:solicitudes.titulo')} em={p.entrantes.length > 0 ? String(p.entrantes.length) : undefined} seccion />
              <TarjetaGeneral style={styles.lista}>
                {p.entrantes.map((r, i) => (
                  <FilaGeneral key={r.friendshipId} primera={i === 0}>
                    <Inicial nombre={r.name} />
                    <View style={styles.flex}>
                      <Text style={textoGeneral.fila} numberOfLines={1}>{r.name}</Text>
                      <Text style={textoGeneral.detalle} numberOfLines={1}>{t('amigos:solicitudes.entrante', { nivel: r.level })}</Text>
                    </View>
                    {p.ocupada === r.friendshipId ? (
                      <ActivityIndicator size="small" color={G} />
                    ) : (
                      <View style={styles.respuestas}>
                        <ChipGeneral texto={t('amigos:comun.aceptar')} activo onPress={() => p.responder(r, true)} />
                        <Pressable onPress={() => p.responder(r, false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('amigos:solicitudes.rechazarA11y', { nombre: r.name })} style={styles.x}>
                          <Ionicons name="close" size={16} color={C.suave} />
                        </Pressable>
                      </View>
                    )}
                  </FilaGeneral>
                ))}
                {p.salientes.map((r, i) => (
                  <FilaGeneral key={r.friendshipId} primera={p.entrantes.length === 0 && i === 0}>
                    <Inicial nombre={r.name} />
                    <View style={styles.flex}>
                      <Text style={textoGeneral.fila} numberOfLines={1}>{r.name}</Text>
                      <Text style={textoGeneral.detalle} numberOfLines={1}>{t('amigos:solicitudes.saliente', { nivel: r.level })}</Text>
                    </View>
                    <ChipGeneral texto={t('amigos:solicitudes.retirar')} onPress={() => p.retirar(r)} accessibilityLabel={t('amigos:solicitudes.retirarA11y', { nombre: r.name })} />
                  </FilaGeneral>
                ))}
              </TarjetaGeneral>
            </Entrada>
          ) : null}

          {/* Añadir amigos */}
          <Entrada indice={6}>
            <RotuloGeneral texto={t('general:arena.anadir')} seccion />
            <TarjetaGeneral>
              <RotuloGeneral texto={t('amigos:codigo.tuCodigo')} em={p.copiado ? t('amigos:codigo.copiado') : undefined} />
              <Text style={styles.codigo} accessibilityLabel={p.miCodigo ? t('amigos:codigo.tuCodigoA11y', { codigo: p.miCodigo }) : undefined} selectable>
                {p.miCodigo ? codigoLegible(p.miCodigo) : '-'}
              </Text>
              <View style={styles.botones}>
                <BotonGeneral titulo={t('amigos:codigo.copiar')} icono="copy-outline" fantasma fino onPress={p.copiar} style={styles.flex} desactivado={!p.miCodigo} />
                <BotonGeneral titulo={t('amigos:codigo.invitar')} icono="paper-plane-outline" fino onPress={p.invitar} style={styles.flex} />
              </View>
              <View style={styles.separador} />
              <RotuloGeneral texto={t('amigos:codigo.anadir')} />
              <View style={styles.campoFila}>
                <TextInput
                  value={p.codigo}
                  onChangeText={p.setCodigo}
                  placeholder={t('amigos:codigo.campo')}
                  placeholderTextColor={C.tenue}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={LARGO_CODIGO + 2}
                  onSubmitEditing={p.enviar}
                  accessibilityLabel={t('amigos:codigo.campoA11y')}
                  style={styles.campo}
                />
                <BotonGeneral titulo={t('amigos:codigo.enviar')} onPress={p.enviar} ocupado={p.enviando} desactivado={p.codigo.length === 0} style={styles.enviar} />
              </View>
              {p.avisoCodigo ? <Text style={[textoGeneral.detalle, styles.arriba, !p.avisoCodigo.error && styles.oro]}>{p.avisoCodigo.texto}</Text> : null}
            </TarjetaGeneral>
          </Entrada>

          <BotonGeneral titulo={t('general:arena.ajustes')} icono="settings-outline" fantasma fino onPress={p.onAjustes} />
          {fija ? <View style={styles.huecoFija} /> : null}
        </>
      )}
    </PantallaGeneral>
  );
}

function Marcador({ d, hoy }: { d: Duelo; hoy: string }) {
  const rival = datosRival(d);
  const max = Math.max(1, d.mi_indice ?? 0, rival?.indice ?? 0);
  return (
    <TarjetaGeneral heroe style={styles.separado}>
      <RotuloGeneral texto={t('general:arena.duelo')} em={textoQuedan(diasRestantes(d.week_start, hoy))} />
      <View style={styles.marcador}>
        <Lado nombre={t('amigos:comun.tu')} indice={d.mi_indice} dias={d.mis_dias} mia />
        <Text style={styles.vs}>{t('general:arena.vs')}</Text>
        <Lado nombre={nombreRival(d)} indice={rival?.indice ?? null} dias={rival?.dias ?? null} />
      </View>
      <BarraGeneral ratio={(d.mi_indice ?? 0) / max} alto={px(5)} style={styles.arriba} />
      <BarraGeneral ratio={(rival?.indice ?? 0) / max} alto={px(5)} color={C.suave} style={styles.arribaPoco} />
      <Text style={[textoGeneral.cuerpo, styles.arriba]}>{rival ? lineaDuelo(d) : t('amigos:competicion.sinDatosRival')}</Text>
    </TarjetaGeneral>
  );
}

function Lado({ nombre, indice, dias, mia }: { nombre: string; indice: number | null; dias: number | null; mia?: boolean }) {
  return (
    <View style={[styles.lado, !mia && styles.ladoDer]}>
      <Text style={[styles.ladoNombre, mia && styles.oro]} numberOfLines={1}>{nombre}</Text>
      <Text style={[styles.ladoCifra, mia && styles.oro]}>{indice == null ? '-' : String(indice)}</Text>
      <Text style={textoGeneral.detalle}>{dias == null ? ' ' : t('general:arena.diasActivos', { n: dias })}</Text>
    </View>
  );
}

function Inicial({ nombre, grande, mia }: { nombre: string; grande?: boolean; mia?: boolean }): ReactNode {
  const lado = grande ? px(46) : px(30);
  return (
    <View style={[styles.inicial, { width: lado, height: lado, borderRadius: lado / 2 }, (mia || grande) && styles.inicialOro]}>
      <Text style={[styles.inicialTexto, { fontSize: grande ? fs(17) : fs(12) }, (mia || grande) && styles.oro]}>{(nombre.trim()[0] ?? '?').toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  arriba: { marginTop: px(6) },
  arribaPoco: { marginTop: px(3) },
  sub: { marginTop: px(2) },
  huecos: { gap: px(9) },
  oro: { color: G },
  separado: { marginTop: px(7) },
  ajustes: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: oroA(0.6), alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: px(6), marginTop: px(8) },
  lista: { paddingVertical: px(3), marginTop: px(7) },
  podio: { flexDirection: 'row', alignItems: 'flex-end', gap: px(8), paddingTop: px(4) },
  podioCol: { flex: 1, alignItems: 'center', gap: px(4), minWidth: 0 },
  podioNombre: { fontFamily: F.b, fontSize: fs(11), color: C.blanco, maxWidth: '100%' },
  podioValor: { fontFamily: F.m, fontSize: fs(9.5), color: C.suave },
  peana: { alignSelf: 'stretch', borderTopLeftRadius: px(8), borderTopRightRadius: px(8), backgroundColor: C.hueco, borderWidth: 1, borderColor: C.borde, alignItems: 'center', paddingTop: px(6) },
  peanaOro: { backgroundColor: oroMezcla(0.22, C.tarjeta), borderColor: G },
  peanaNum: { fontFamily: 'Cinzel_900Black', fontSize: fs(18), color: C.suave },
  peanaNumOro: { color: G },
  filaMia: { backgroundColor: oroMezcla(0.1, C.tarjeta), marginHorizontal: -px(12), paddingHorizontal: px(12) },
  puesto: { width: px(20), fontFamily: F.xb, fontSize: fs(12), color: C.suave, textAlign: 'center' },
  valor: { fontFamily: F.b, fontSize: fs(11.5), color: C.blanco },
  inicial: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.borde, backgroundColor: C.hueco },
  inicialOro: { borderColor: G, backgroundColor: oroMezcla(0.14, C.fondo) },
  inicialTexto: { fontFamily: 'Cinzel_900Black', color: C.texto },
  botones: { flexDirection: 'row', gap: px(7) },
  marcador: { flexDirection: 'row', alignItems: 'center', marginTop: px(8) },
  vs: { fontFamily: 'Cinzel_900Black', fontSize: fs(13), color: C.mudo, marginHorizontal: px(8) },
  lado: { flex: 1, minWidth: 0 },
  ladoDer: { alignItems: 'flex-end' },
  ladoNombre: { fontFamily: F.b, fontSize: fs(11), color: C.texto },
  ladoCifra: { fontFamily: F.xb, fontSize: fs(24), color: C.blanco },
  resultado: { fontFamily: F.b, fontSize: fs(10), color: C.suave },
  respuestas: { flexDirection: 'row', alignItems: 'center', gap: px(6) },
  x: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: C.borde, alignItems: 'center', justifyContent: 'center' },
  codigo: { fontFamily: F.xb, fontSize: fs(24), letterSpacing: 4, color: G, marginTop: px(6), textAlign: 'center' },
  separador: { height: 1, backgroundColor: C.regla, marginVertical: px(10) },
  campoFila: { flexDirection: 'row', alignItems: 'center', gap: px(7), marginTop: px(6) },
  campo: {
    flex: 1,
    minHeight: px(38),
    borderRadius: px(10),
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.fondo,
    color: C.blanco,
    fontFamily: F.b,
    fontSize: fs(13),
    letterSpacing: 2,
    paddingHorizontal: px(10),
  },
  enviar: { marginTop: 0, minHeight: px(38) },
  fija: {
    position: 'absolute',
    left: px(14),
    right: px(14),
    bottom: px(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: px(10),
    paddingVertical: px(9),
    paddingHorizontal: px(12),
    borderRadius: px(14),
    borderWidth: 1,
    borderColor: G,
    backgroundColor: oroMezcla(0.16, C.tarjeta),
    boxShadow: `0px 6px 18px rgba(0,0,0,0.6), 0px 0px 12px ${oroA(0.3)}`,
  },
  fijaPuesto: { fontFamily: 'Cinzel_900Black', fontSize: fs(20), color: G },
  fijaRotulo: { fontFamily: F.b, fontSize: fs(8), letterSpacing: fs(8) * 0.16, color: C.meta, textTransform: 'uppercase' },
  fijaTexto: { fontFamily: F.b, fontSize: fs(11), color: C.blanco },
  fijaValor: { fontFamily: F.xb, fontSize: fs(13), color: G },
  huecoFija: { height: px(56) },
});
