// NIVL · WORK: la pantalla del bloque de trabajo. Pura: todo llega por props.
// La pone a pantalla completa useWorkHoy; la galería la pinta tal cual.
//
// En marcha: qué se ataca, el reloj grande, pausa y terminar aquí. Sin culpa:
// parar guarda lo hecho. Al acabar: lo que pasó de verdad (minutos y XP pagado).

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TarjetaArena } from '@/components/arena';
import { Button, Screen, useAnunciar } from '@/components/ui';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import type { ResultadoBloque } from '@/work/cierreBloque';
import { desenlaceBloque, type VistaBloque } from '@/work/vistaHoy';

export interface BloqueVistaProps {
  vista: VistaBloque;
  resultado: ResultadoBloque | null;
  cerrando: boolean;
  acciones: {
    onPausar: () => void;
    onSeguir: () => void;
    onTerminar: () => void;
    onMinimizar: () => void;
    onCerrar: () => void;
  };
}

function Marcha({ vista: v, acciones }: Pick<BloqueVistaProps, 'vista' | 'acciones'>) {
  const pausado = v.fase === 'pausado';
  const nota = v.yaCuenta
    ? t('trabajo:bloque.notaCuenta')
    : v.seGuarda
      ? t('trabajo:bloque.notaGuarda', { minutos: v.minutosHechos })
      : t('trabajo:bloque.notaCorto');
  return (
    <>
      <View style={styles.arriba}>
        <Pressable onPress={acciones.onMinimizar} hitSlop={8} style={styles.icono} accessibilityRole="button" accessibilityLabel={t('trabajo:bloque.minimizarA11y')}>
          <Ionicons name="chevron-down" size={24} color={ink.ink9} />
        </Pressable>
        <Text style={styles.rotulo} maxFontSizeMultiplier={1.35}>
          {pausado ? t('trabajo:bloque.enPausa') : t('trabajo:bloque.rotulo')}
        </Text>
        <View style={styles.icono} />
      </View>

      <View style={styles.centro}>
        <Text style={styles.titulo} accessibilityRole="header" maxFontSizeMultiplier={1.35} numberOfLines={3}>
          {v.titulo ?? t('trabajo:bloque.libre')}
        </Text>
        <Text
          style={styles.reloj}
          accessibilityRole="timer"
          accessibilityLabel={t('trabajo:bloque.relojA11y', { minutos: v.restanteMin })}
          maxFontSizeMultiplier={1}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {v.reloj}
        </Text>
        <Text style={styles.detalle} maxFontSizeMultiplier={1.35}>
          {t('trabajo:bloque.objetivo', { minutos: v.objetivoMin })}
        </Text>
        <Text style={styles.nota} maxFontSizeMultiplier={1.35}>
          {nota}
        </Text>
      </View>

      <View style={styles.pie}>
        <Button
          title={pausado ? t('trabajo:bloque.seguir') : t('trabajo:bloque.pausar')}
          icon={pausado ? 'play' : 'pause'}
          size="lg"
          onPress={pausado ? acciones.onSeguir : acciones.onPausar}
        />
        <Button title={t('trabajo:bloque.terminar')} variant="ghost" onPress={acciones.onTerminar} />
      </View>
    </>
  );
}

function Resumen({ vista: v, resultado: r, cerrando, acciones }: BloqueVistaProps) {
  const minutos = r?.minutos ?? v.minutosHechos;
  const desenlace = r ? desenlaceBloque(r, v.conMision) : null;
  const marcada = r?.marcadas[0] ?? v.titulo ?? '';
  const linea = desenlace ? t(`trabajo:bloque.desenlace.${desenlace}`, { titulo: marcada }) : t('trabajo:bloque.guardando');
  const pagado = !!r && r.xp > 0;
  const anuncio = desenlace
    ? `${t('trabajo:bloque.resumenA11y', { minutos })} ${pagado ? t('trabajo:bloque.xp', { xp: r.xp }) : ''} ${linea}`
    : null;
  useAnunciar(anuncio);
  return (
    <>
      <View style={styles.centro}>
        <Text style={styles.rotulo} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
          {v.yaCuenta ? t('trabajo:bloque.hecho') : t('trabajo:bloque.parado')}
        </Text>
        <Text style={styles.cifra} maxFontSizeMultiplier={1} numberOfLines={1} adjustsFontSizeToFit>
          {t('trabajo:bloque.minutos', { minutos })}
        </Text>
        <TarjetaArena variante={pagado ? 'grano' : 'contorno'} style={styles.tarjeta}>
          {pagado ? (
            <Text style={styles.xp} maxFontSizeMultiplier={1.35}>
              {t('trabajo:bloque.xp', { xp: r.xp })}
            </Text>
          ) : null}
          <Text style={styles.cuerpo} maxFontSizeMultiplier={1.35}>
            {linea}
          </Text>
          {r?.reintentar ? (
            <Text style={styles.detalle} maxFontSizeMultiplier={1.35}>
              {t('trabajo:bloque.sinRed')}
            </Text>
          ) : null}
        </TarjetaArena>
      </View>
      <View style={styles.pie}>
        <Button title={t('trabajo:bloque.volver')} size="lg" loading={cerrando} disabled={cerrando} onPress={acciones.onCerrar} />
      </View>
    </>
  );
}

export function BloqueVista(p: BloqueVistaProps) {
  return <Screen contentStyle={styles.pantalla}>{p.vista.fase === 'terminado' ? <Resumen {...p} /> : <Marcha vista={p.vista} acciones={p.acciones} />}</Screen>;
}

const styles = StyleSheet.create({
  pantalla: { flexGrow: 1, paddingBottom: space.s6 },
  arriba: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icono: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  rotulo: { fontFamily: tipo.label.family, fontSize: tipo.label.size, lineHeight: tipo.label.lineHeight, letterSpacing: tipo.label.tracking, color: ink.ink8, textTransform: 'uppercase', textAlign: 'center' },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.s3, paddingVertical: space.s8 },
  titulo: { fontFamily: tipo.headline.family, fontSize: tipo.headline.size, lineHeight: tipo.headline.lineHeight, letterSpacing: tipo.headline.tracking, color: ink.ink9, textAlign: 'center' },
  reloj: { fontFamily: tipo.monumentoSm.family, fontSize: tipo.monumentoSm.size, lineHeight: tipo.monumentoSm.size + 12, color: ink.ink10, fontVariant: ['tabular-nums'] },
  cifra: { fontFamily: tipo.monumentoSm.family, fontSize: tipo.monumentoSm.size, lineHeight: tipo.monumentoSm.size + 12, color: ink.ink10 },
  detalle: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink6, textAlign: 'center' },
  nota: { fontFamily: tipo.bodySm.family, fontSize: tipo.bodySm.size, lineHeight: tipo.bodySm.lineHeight, color: ink.ink8, textAlign: 'center' },
  tarjeta: { alignSelf: 'stretch' },
  xp: { fontFamily: tipo.number.family, fontSize: tipo.number.size, lineHeight: tipo.number.lineHeight, color: ink.ink10, textAlign: 'center', marginBottom: space.s2 },
  cuerpo: { fontFamily: tipo.body.family, fontSize: tipo.body.size, lineHeight: tipo.body.lineHeight, color: ink.ink9, textAlign: 'center' },
  pie: { gap: space.s2 },
});
