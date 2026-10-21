// NIVL · General · Perfil, rediseñado con la piel de NIVL (lámina 4). Pura:
// las mismas props que PerfilVista (usePerfil); los ajustes llegan hechos
// (PerfilAjustes, ya partidos en secciones) y el arsenal por la ranura
// `nivelesModo`.
//
//   1 · IDENTIDAD: retrato (tocar = cambiar foto), escudo con el nivel, nombre
//       editable, rango y título equipado, perfil de uso y la insignia Élite.
//   2 · PROGRESIÓN: XP del nivel, racha, piedras y multiplicador; el
//       siguiente rango (días activos reales) y «Ver progresión» (Avance).
//   3 · ARSENAL: cambiar de modo con un toque y los niveles por modo.
//   4 · LOGROS: los equipables (tocar = equipar el título).
//   5 · CUENTA: compartir, NIVL Pro, código y panel de creador.
//   6 · AJUSTES: las secciones de siempre, cada una en su tarjeta.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Entrada, formatoMiles, ratioSeguro } from '@/components/arena';
import { EliteBadge } from '@/components/EliteBadge';
import { textoSiguiente } from '@/components/perfil/CaminoDeRangos';
import type { PerfilVistaProps } from '@/components/perfil/PerfilVista';
import { Avatar } from '@/components/ui/Avatar';
import { t } from '@/i18n';
import { isValidKey, nombreDia } from '@/lib/dates';
import { MAX_STONES, streakMultiplier } from '@/lib/game';
import { kindMeta } from '@/lib/kinds';
import { rangoPorId } from '@/lib/progression';
import { voice } from '@/lib/voice';
import {
  BarraGeneral,
  BotonGeneral,
  CifraGeneral,
  Escudo,
  FilaCifras,
  FilaGeneral,
  HuecoGeneral,
  PantallaGeneral,
  RotuloGeneral,
  TarjetaGeneral,
  textoGeneral,
} from './piezas';
import { C, F, fs, G, oroA, px } from './tema';

export interface PerfilGeneralVistaProps extends PerfilVistaProps {
  onVolver?: () => void;
  onProgresion: () => void;
}

export function PerfilGeneralVista(p: PerfilGeneralVistaProps) {
  const { datos, acciones } = p;
  const volver = p.onVolver ? (
    <Pressable onPress={p.onVolver} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('comun:volver')} style={styles.redondo}>
      <Ionicons name="chevron-back" size={20} color={G} />
    </Pressable>
  ) : null;
  const barra = (
    <View style={styles.barraSup}>
      {volver}
      <Text style={styles.eyebrow}>{t('general:perfil.eyebrow')}</Text>
    </View>
  );

  if (!datos) {
    return (
      <PantallaGeneral>
        {barra}
        {p.error ? (
          <TarjetaGeneral>
            <RotuloGeneral texto={t('general:hoy.errorRotulo')} />
            <Text style={[textoGeneral.cuerpo, styles.arriba]}>{p.error}</Text>
            <BotonGeneral titulo={t('comun:reintentar')} fantasma fino onPress={acciones.onReintentar} />
          </TarjetaGeneral>
        ) : (
          <View style={styles.huecos} accessibilityRole="progressbar" accessibilityLabel={t('general:perfil.cargandoA11y')}>
            <HuecoGeneral alto={px(200)} />
            <HuecoGeneral alto={px(120)} />
            <HuecoGeneral alto={px(160)} />
          </View>
        )}
      </PantallaGeneral>
    );
  }

  const { profile, estado, titulo, elite, frozen, tieneCoach, stats, logros } = datos;
  const rango = rangoPorId(estado.rango);
  const maximo = estado.xpSiguiente <= 0;
  const equipables = logros.filter((l) => l.unlocked && l.title);
  const ganados = logros.filter((l) => l.unlocked).length;
  const evidencia = stats.total > 0 ? Math.round((stats.withEvidence / stats.total) * 100) : null;
  const mult = `×${streakMultiplier(datos.racha).toFixed(1).replace('.', ',')}`;

  return (
    <PantallaGeneral>
      <Entrada indice={0}>{barra}</Entrada>

      {/* 1 · Identidad */}
      <Entrada indice={1}>
        <TarjetaGeneral heroe>
          <View style={styles.identidad}>
            <Pressable onPress={acciones.onAvatar} disabled={p.subiendoFoto} accessibilityRole="button" accessibilityLabel={t('general:perfil.fotoA11y')} style={styles.retrato}>
              <Avatar size={px(84)} avatarPath={profile.avatar_url} name={profile.name} rank={estado.rango} />
              <View style={styles.camara}>
                <Ionicons name={p.subiendoFoto ? 'hourglass-outline' : 'camera'} size={px(12)} color={C.fondo} />
              </View>
            </Pressable>
            <View style={styles.flex}>
              <View style={styles.nombreFila}>
                <TextInput
                  style={styles.nombre}
                  value={p.nombre}
                  onChangeText={acciones.onNombre}
                  onBlur={acciones.onGuardarNombre}
                  onSubmitEditing={acciones.onGuardarNombre}
                  returnKeyType="done"
                  maxLength={24}
                  maxFontSizeMultiplier={1.35}
                  accessibilityLabel={t('perfil:vista.nombreA11y')}
                />
                {elite ? <EliteBadge size={20} /> : null}
              </View>
              <Text style={styles.titulo} numberOfLines={2}>
                {(titulo || rango.nombre).toUpperCase()}
              </Text>
              <Text style={textoGeneral.detalle} numberOfLines={1}>
                {t('general:perfil.rangoUso', { rango: estado.rango, nombre: rango.nombre, uso: kindMeta(profile.profile_kind).title })}
              </Text>
            </View>
          </View>
          <View style={styles.nivelFila}>
            <Escudo nivel={estado.nivel} lado={px(46)} />
            <View style={styles.flex}>
              <Text style={styles.rotuloPeq}>{t('general:progresion.nivel', { nivel: estado.nivel })}</Text>
              <BarraGeneral ratio={maximo ? 1 : ratioSeguro(estado.xpEnNivel, estado.xpSiguiente)} alto={px(5)} style={styles.arribaPoco} />
              <Text style={[textoGeneral.detalle, styles.arribaPoco]}>
                {maximo ? t('general:heroe.xpMax') : t('general:heroe.xp', { xp: formatoMiles(estado.xpEnNivel), total: formatoMiles(estado.xpSiguiente) })}
              </Text>
            </View>
          </View>
          <Text style={[textoGeneral.detalle, styles.arriba]}>{t('perfil:vista.avisoRevision')}</Text>
        </TarjetaGeneral>
      </Entrada>

      {/* 2 · Progresión resumida */}
      <Entrada indice={2}>
        <RotuloGeneral texto={t('general:perfil.progresion')} em={t('general:perfil.verProgresion')} onEm={p.onProgresion} seccion />
        <FilaCifras>
          <CifraGeneral icono="flame" rotulo={t('general:avance.racha')} valor={String(datos.racha)} nota={mult} />
          <CifraGeneral icono="shield-half" rotulo={t('general:perfil.piedras')}valor={`${profile.protection_stones}/${MAX_STONES}`} />
          <CifraGeneral icono="checkmark-done" rotulo={t('perfil:vista.misiones')} valor={formatoMiles(stats.total)} nota={evidencia === null ? undefined : t('general:perfil.evidencia', { pct: evidencia })} />
        </FilaCifras>
        {estado.siguienteRango ? (
          <TarjetaGeneral onPress={p.onProgresion} style={styles.arriba} accessibilityLabel={textoSiguiente(estado.siguienteRango)}>
            <View style={styles.siguiente}>
              <View style={styles.letra}>
                <Text style={styles.letraTexto}>{estado.siguienteRango.rango}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.rotuloPeq}>{t('general:perfil.siguienteRango')}</Text>
                <Text style={textoGeneral.cuerpo}>{textoSiguiente(estado.siguienteRango)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={px(14)} color={C.suave} />
            </View>
          </TarjetaGeneral>
        ) : null}
        <Text style={[textoGeneral.detalle, styles.racha]}>{datos.rachaFrase}</Text>
      </Entrada>

      {frozen ? (
        <TarjetaGeneral>
          <RotuloGeneral texto={t('perfil:vista.enPausa')} />
          <Text style={[textoGeneral.cuerpo, styles.arriba]}>
            {profile.freeze_until && isValidKey(profile.freeze_until)
              ? t('perfil:vista.pausaHasta', {
                  frase: voice.frozen(profile.freeze_reason ?? t('perfil:ajustes.pausaMotivo')),
                  dia: nombreDia(profile.freeze_until).toLowerCase(),
                })
              : voice.frozen(profile.freeze_reason ?? t('perfil:ajustes.pausaMotivo'))}
          </Text>
        </TarjetaGeneral>
      ) : null}

      {/* 3 · Arsenal y niveles de modo */}
      {p.nivelesModo ? <Entrada indice={3}>{p.nivelesModo}</Entrada> : null}

      {/* 4 · Títulos equipables */}
      <Entrada indice={4}>
        <RotuloGeneral texto={t('general:perfil.titulos')} em={t('general:progresion.deTotal', { n: ganados, total: logros.length })} onEm={p.onProgresion} seccion />
        {equipables.length === 0 ? (
          <TarjetaGeneral>
            <Text style={textoGeneral.cuerpo}>{t('general:perfil.sinTitulos')}</Text>
          </TarjetaGeneral>
        ) : (
          <View style={styles.titulos}>
            {equipables.map((l) => (
              <Pressable
                key={l.code}
                onPress={() => acciones.onLogro(l.code)}
                accessibilityRole="button"
                accessibilityState={{ selected: l.equipado }}
                accessibilityLabel={t('general:perfil.tituloA11y', { titulo: l.title })}
                style={({ pressed }) => [styles.tituloChip, l.equipado && styles.tituloChipOn, pressed && styles.pulsado]}
              >
                <Ionicons name={l.equipado ? 'ribbon' : 'ribbon-outline'} size={px(13)} color={l.equipado ? C.fondo : G} />
                <Text style={[styles.tituloChipTexto, l.equipado && styles.tituloChipTextoOn]} numberOfLines={1}>
                  {l.title}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Entrada>

      {/* 5 · Cuenta */}
      <Entrada indice={5}>
        <RotuloGeneral texto={t('general:perfil.cuenta')} seccion />
        <TarjetaGeneral style={styles.lista}>
          <Fila icono="share-social-outline" titulo={t('perfil:vista.compartir')} onPress={acciones.onCompartir} primera />
          <Fila
            icono="shield-half-outline"
            titulo={elite ? 'NIVL Élite' : 'NIVL Pro'} // i18n-ok: nombres de los planes (la marca)
            meta={tieneCoach === null ? undefined : tieneCoach ? t('perfil:vista.activo') : t('perfil:vista.activaCoach')}
            onPress={() => router.push('/pro')}
          />
          {datos.codigoCreador ? <Fila icono="ticket-outline" titulo={t('perfil:vista.codigo')} onPress={acciones.onCodigo} /> : null}
          {datos.esCreador ? <Fila icono="megaphone-outline" titulo={t('perfil:vista.panelCreador')} onPress={() => router.push('/creador')} /> : null}
        </TarjetaGeneral>
      </Entrada>

      {/* 6 · Ajustes */}
      {p.ajustes ? (
        <Entrada indice={6}>
          <RotuloGeneral texto={t('perfil:vista.ajustes')} seccion />
          <TarjetaGeneral style={styles.ajustes}>{p.ajustes}</TarjetaGeneral>
        </Entrada>
      ) : null}
    </PantallaGeneral>
  );
}

function Fila({ icono, titulo, meta, onPress, primera }: { icono: keyof typeof Ionicons.glyphMap; titulo: string; meta?: string; onPress: () => void; primera?: boolean }) {
  return (
    <FilaGeneral primera={primera} onPress={onPress} accessibilityLabel={meta ? `${titulo}, ${meta}` : titulo}>
      <Ionicons name={icono} size={px(17)} color={G} />
      <Text style={[textoGeneral.fila, styles.flex]} numberOfLines={1}>
        {titulo}
      </Text>
      {meta ? <Text style={textoGeneral.oro}>{meta}</Text> : null}
      <Ionicons name="chevron-forward" size={px(13)} color={C.suave} />
    </FilaGeneral>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  arriba: { marginTop: px(8) },
  arribaPoco: { marginTop: px(4) },
  huecos: { gap: px(9) },
  pulsado: { opacity: 0.75 },
  barraSup: { flexDirection: 'row', alignItems: 'center', gap: px(10), marginBottom: px(4), minHeight: 40 },
  redondo: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: oroA(0.6), alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: 'Cinzel_900Black', fontSize: 24, letterSpacing: 1.6, color: C.blanco },
  identidad: { flexDirection: 'row', alignItems: 'center', gap: px(14), marginBottom: px(12) },
  retrato: { width: px(84), height: px(84) },
  camara: { position: 'absolute', right: -2, bottom: -2, width: px(24), height: px(24), borderRadius: px(12), backgroundColor: G, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.tarjeta },
  nombreFila: { flexDirection: 'row', alignItems: 'center', gap: px(6) },
  nombre: { flex: 1, minWidth: 0, fontFamily: F.xb, fontSize: fs(18), color: C.blanco, paddingVertical: 2 },
  titulo: { fontFamily: 'Cinzel_900Black', fontSize: fs(13), letterSpacing: 1, color: G, marginTop: px(2) },
  nivelFila: { flexDirection: 'row', alignItems: 'center', gap: px(12), marginTop: px(12), paddingTop: px(10), borderTopWidth: 1, borderTopColor: C.regla },
  rotuloPeq: { fontFamily: F.b, fontSize: fs(9), letterSpacing: fs(9) * 0.16, color: C.meta, textTransform: 'uppercase' },
  siguiente: { flexDirection: 'row', alignItems: 'center', gap: px(10) },
  letra: { width: px(34), height: px(34), borderRadius: px(9), borderWidth: 2, borderColor: G, alignItems: 'center', justifyContent: 'center' },
  letraTexto: { fontFamily: 'Cinzel_900Black', fontSize: fs(15), color: G },
  racha: { marginTop: px(6), marginHorizontal: px(2) },
  titulos: { flexDirection: 'row', flexWrap: 'wrap', gap: px(7), marginTop: px(6) },
  tituloChip: { flexDirection: 'row', alignItems: 'center', gap: px(6), paddingVertical: px(8), paddingHorizontal: px(11), borderRadius: px(10), borderWidth: 1, borderColor: oroA(0.45), backgroundColor: C.tarjeta, maxWidth: '100%' },
  tituloChipOn: { backgroundColor: G, borderColor: G },
  tituloChipTexto: { fontFamily: F.sb, fontSize: fs(10.5), color: C.texto, flexShrink: 1 },
  tituloChipTextoOn: { color: C.fondo, fontFamily: F.xb },
  lista: { paddingVertical: px(3), marginTop: px(6) },
  ajustes: { marginTop: px(6), paddingTop: px(4) },
});
