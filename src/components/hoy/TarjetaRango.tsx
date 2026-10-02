// NIVL · La cabecera de rango de Hoy: avatar con su marco, título, rango,
// nivel en Cinzel, barra de XP, racha y piedras. Va en el cuerpo de Hoy y,
// en `expanded`, en el panel contextual (PanelHoy) con `grande`.
//
// Solo blanco y negro (SISTEMA.md §0): la racha cerrada se dice con la llama
// rellena y el texto en blanco, no con oro.

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar, Card, Skeleton } from '@/components/ui';
import { XPBar } from '@/components/XPBar';
import { ink, RANK_THEME, space, type as tipo } from '@/design/tokens';
import { tituloVigente } from '@/lib/achievements';
import { levelFromXp, streakMultiplier } from '@/lib/game';
import { kindMeta } from '@/lib/kinds';
import type { RangoId } from '@/lib/progression';
import { fonts } from '@/lib/theme';
import type { Profile } from '@/lib/types';
import { useCountUp } from '@/lib/useCountUp';

export interface RachaHoy {
  /** Racha que se enseña (cuenta hoy en cuanto queda cerrado). */
  valor: number;
  hoyCerrado: boolean;
  perfecto: boolean;
  /** Misiones que faltan para salvar el día. */
  faltan: number;
}

interface Props {
  profile: Profile;
  /** Rango vigente (estadoDe). null = aún cargando: hueco en vez de inventarlo. */
  rango: RangoId | null;
  racha: RachaHoy;
  /** Versión del panel lateral: avatar mayor y el bloque apilado. */
  grande?: boolean;
  /**
   * La línea RET-05 está a la vista: la pista «N para salvar el día» no se
   * pinta. rachaVisible cuenta las extras y enJuegoHoy no, y darían dos
   * números distintos para lo mismo.
   */
  ocultarPista?: boolean;
  /**
   * La tarjeta de día perfecto está a la vista: ella lleva el grano y esta no
   * lo repite (SISTEMA §0, sin acumular).
   */
  diaPerfectoVisible?: boolean;
}

export function TarjetaRango({ profile, rango, racha, grande, ocultarPista, diaPerfectoVisible }: Props) {
  const lvl = levelFromXp(profile.xp_total);
  const xpEnNivel = useCountUp(lvl.into, 600);
  const titulo = tituloVigente(profile.equipped_title);
  const rotulo = titulo ? `« ${titulo} »` : kindMeta(profile.profile_kind).title;
  const pista = racha.hoyCerrado
    ? racha.perfecto
      ? 'Día perfecto'
      : 'Hoy cuenta'
    : racha.faltan > 0 && !ocultarPista
      ? `${racha.faltan} para salvar el día`
      : '';
  // Grano solo para logro: el de los rangos altos (B, A, S), y nunca a la vez
  // que el día perfecto.
  const conGrano = !!rango && RANK_THEME[rango].grain > 0 && !diaPerfectoVisible;

  return (
    <Card variant={conGrano ? 'logro' : 'surface'}>
      <View style={[styles.fila, grande && styles.filaGrande]}>
        <Avatar
          size={grande ? 88 : 52}
          avatarPath={profile.avatar_url}
          name={profile.name}
          rank={rango ?? 'E'}
          titulo={titulo ?? undefined}
        />
        <View style={[styles.info, grande && styles.infoGrande]}>
          <Text style={[styles.nombre, grande && styles.centrado]} numberOfLines={1}>
            {rotulo}
          </Text>
          {rango ? (
            <Text style={[styles.rango, grande && styles.centrado]}>
              RANGO {rango} · {lvl.next > 0 ? `${xpEnNivel} / ${lvl.next} XP` : 'NIVEL MÁXIMO'}
            </Text>
          ) : (
            <Skeleton height={11} width={140} style={styles.rangoHueco} />
          )}
        </View>
        <View style={[styles.nivel, grande && styles.nivelGrande]}>
          <Text style={styles.nivelRotulo}>NIVEL</Text>
          <Text style={[styles.nivelValor, grande && styles.nivelValorGrande]}>{lvl.level}</Text>
        </View>
      </View>
      <View style={styles.barra}>
        <XPBar ratio={lvl.next > 0 ? lvl.into / lvl.next : 1} height={4} />
      </View>
      <View style={styles.insignias}>
        <View
          style={styles.insignia}
          accessible
          accessibilityLabel={`Racha de ${racha.valor} ${racha.valor === 1 ? 'día' : 'días'}${racha.hoyCerrado ? ', hoy cerrado' : ''}`}
        >
          <Ionicons name={racha.hoyCerrado ? 'flame' : 'flame-outline'} size={13} color={racha.hoyCerrado ? ink.ink10 : ink.ink6} />
          <Text style={[styles.insigniaTexto, racha.hoyCerrado && styles.insigniaCerrada]}>
            Racha {racha.valor} · ×{streakMultiplier(profile.streak_days).toFixed(1)}
          </Text>
        </View>
        <Text style={styles.pista} numberOfLines={1}>
          {pista}
        </Text>
        <View
          style={styles.insignia}
          accessible
          accessibilityLabel={`${profile.protection_stones} ${profile.protection_stones === 1 ? 'piedra' : 'piedras'} de protección`}
        >
          <Ionicons name="shield-half-outline" size={13} color={ink.ink6} />
          <Text style={styles.insigniaTexto}>{profile.protection_stones}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  filaGrande: { flexDirection: 'column', alignItems: 'center', gap: space.s3 },
  info: { flex: 1, minWidth: 0 },
  infoGrande: { flex: 0, alignSelf: 'stretch', alignItems: 'center' },
  centrado: { textAlign: 'center' },
  nombre: { fontFamily: fonts.heading, fontSize: 16, letterSpacing: 0.5, color: ink.ink9 },
  rango: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1.5, color: ink.ink6, marginTop: 4 },
  rangoHueco: { marginTop: 6 },
  nivel: { alignItems: 'flex-end' },
  nivelGrande: { alignItems: 'center' },
  nivelRotulo: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1.7, color: ink.ink6 },
  nivelValor: { fontFamily: tipo.rank.family, fontSize: 32, lineHeight: 36, color: ink.ink10 },
  nivelValorGrande: { fontSize: 40, lineHeight: 44 },
  barra: { marginTop: 14 },
  insignias: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  insignia: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  insigniaTexto: { fontFamily: tipo.micro.family, fontSize: tipo.micro.size, lineHeight: tipo.micro.lineHeight, color: ink.ink8 },
  insigniaCerrada: { color: ink.ink10 },
  pista: {
    flex: 1,
    fontFamily: tipo.micro.family,
    fontSize: tipo.micro.size,
    lineHeight: tipo.micro.lineHeight,
    color: ink.ink6,
  },
});
