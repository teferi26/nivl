// NIVL · Modos: «Novedad: elige tus modos», la hoja única para quien ya tenía
// la app cuando se encendió `modos_activos`. Se monta en Hoy.
//
// Cuándo sale lo decide `tocaNovedadModos` (modos/novedad.ts, pura y con
// test). «Guardar» deja la elección en `user_modes` con el contexto de modos
// (como el paso del onboarding) y el selector de Hoy aparece en ese momento;
// «Ahora no» (o cerrar la hoja) solo la da por vista. En los dos casos la
// marca queda en el teléfono, por cuenta, y no vuelve.
//
// Con el interruptor apagado no pinta nada y no lee nada: la parte con
// efectos solo se monta encendida.

import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useConsentimientoAnalitica } from '@/components/consentimiento/useConsentimientoAnalitica';
import { Button, Sheet } from '@/components/ui';
import { vibrar } from '@/design/haptics';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import type { ProfileKind } from '@/lib/kinds';
import { mensajeSistema } from '@/lib/validation';
import { leerNovedadVista, marcarNovedadVista } from '@/modos/datos';
import { useModo } from '@/modos/ModoProvider';
import { tocaNovedadModos } from '@/modos/novedad';
import { eleccionValida, modosSugeridos, type ModoEtiqueta } from '@/modos/tipos';
import { EleccionModos } from './EleccionModos';

export interface NovedadModosProps {
  /** `profiles.onboarding_done` (false mientras Hoy no ha leído el perfil). */
  onboardingHecho: boolean;
  /** El perfil de uso: propone marcado su modo (un toque para cambiarlo). */
  kind: ProfileKind | null;
  /** Hay otra cosa encima (ceremonia, otra hoja): se espera. */
  enPausa: boolean;
}

function NovedadModosEncendida({ onboardingHecho, kind, enPausa }: NovedadModosProps) {
  const modos = useModo();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  // La medición de uso también pregunta una vez en Hoy: nunca las dos a la vez.
  const medicion = useConsentimientoAnalitica();
  const [vista, setVista] = useState<boolean | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [elegidos, setElegidos] = useState<ModoEtiqueta[]>(() => modosSugeridos(kind));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setVista(null);
    if (!userId) return;
    void leerNovedadVista(userId).then((v) => {
      if (vivo) setVista(v);
    });
    return () => {
      vivo = false;
    };
  }, [userId]);

  const toca = tocaNovedadModos({
    activo: modos.activo,
    onboardingHecho,
    cargado: modos.cargado,
    leidos: modos.leidos,
    activados: modos.activados,
    vista,
    enPausa: enPausa || medicion.cargando || medicion.preguntar,
  });

  // Se abre una vez y se queda abierta hasta que se decide: lo que cambie
  // debajo (otra lectura de modos, el perfil) no la cierra a medias.
  useEffect(() => {
    if (!toca || abierta) return;
    setElegidos(modosSugeridos(kind));
    setError(null);
    setAbierta(true);
  }, [toca, abierta, kind]);

  const cerrarVista = () => {
    setVista(true);
    setAbierta(false);
    if (userId) void marcarNovedadVista(userId);
  };

  const ahoraNo = () => {
    if (guardando) return;
    cerrarVista();
  };

  const guardar = async () => {
    if (guardando || !eleccionValida(elegidos)) return;
    setGuardando(true);
    setError(null);
    try {
      await modos.guardarActivados(elegidos);
      cerrarVista();
    } catch (e) {
      vibrar('penalizacion');
      setError(mensajeSistema(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Sheet
      visible={abierta}
      onClose={ahoraNo}
      eyebrow={t('modos:hoja.eyebrow')}
      title={t('modos:novedad.titulo')}
      footer={
        <>
          <Button
            title={t('comun:guardar')}
            size="lg"
            onPress={guardar}
            loading={guardando}
            disabled={!eleccionValida(elegidos)}
          />
          <Button title={t('comun:ahoraNo')} variant="ghost" onPress={ahoraNo} disabled={guardando} />
        </>
      }
    >
      <Text style={styles.pista} maxFontSizeMultiplier={1.35}>
        {t('modos:novedad.pista')}
      </Text>
      <EleccionModos valor={elegidos} alCambiar={setElegidos} ocupada={guardando} />
      {error ? (
        <Text style={styles.error} maxFontSizeMultiplier={1.35}>
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}

/** El hueco de Hoy: nada con el interruptor apagado. */
export function NovedadModos(props: NovedadModosProps) {
  const { activo } = useModo();
  if (!activo) return null;
  return <NovedadModosEncendida {...props} />;
}

const styles = StyleSheet.create({
  pista: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink8,
    marginBottom: space.s4,
  },
  error: {
    fontFamily: tipo.bodySm.family,
    fontSize: tipo.bodySm.size,
    lineHeight: tipo.bodySm.lineHeight,
    color: ink.ink9,
    marginTop: space.s2,
  },
});
