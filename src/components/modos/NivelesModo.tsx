// NIVL · Modos F1: los niveles por modo en Perfil y la hoja para elegir los
// modos. Solo con `modos_activos` encendido: con él apagado no pinta nada y
// no lee nada (el useNivelesModo vive dentro de la parte que solo se monta
// encendida).

import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button, Sheet } from '@/components/ui';
import { vibrar } from '@/design/haptics';
import { ink, space, type as tipo } from '@/design/tokens';
import { t } from '@/i18n';
import { mensajeSistema } from '@/lib/validation';
import { useModo } from '@/modos/ModoProvider';
import type { ModoEtiqueta } from '@/modos/tipos';
import { EleccionModos } from './EleccionModos';
import { NivelesModoVista } from './NivelesModoVista';
import { useNivelesModo } from './useNivelesModo';

export interface HojaModosProps {
  abierta: boolean;
  cerrar: () => void;
  activados: readonly ModoEtiqueta[];
  guardar: (elegidos: readonly ModoEtiqueta[]) => Promise<void>;
}

/** Elegir los modos activados (Perfil). Se pueden quitar todos: queda NIVL. */
export function HojaModos({ abierta, cerrar, activados, guardar }: HojaModosProps) {
  const [elegidos, setElegidos] = useState<ModoEtiqueta[]>([...activados]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierta) return;
    setElegidos([...activados]);
    setError(null);
    // Se copia al abrir: lo que llegue con la hoja abierta no pisa lo elegido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta]);

  const onGuardar = async () => {
    if (guardando) return;
    setGuardando(true);
    try {
      await guardar(elegidos);
      cerrar();
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
      onClose={cerrar}
      eyebrow={t('modos:hoja.eyebrow')}
      title={t('modos:hoja.titulo')}
      footer={
        <>
          <Button title={t('comun:guardarCambios')} size="lg" onPress={onGuardar} loading={guardando} />
          <Button title={t('comun:cancelar')} variant="ghost" onPress={cerrar} />
        </>
      }
    >
      <Text style={styles.pista} maxFontSizeMultiplier={1.35}>
        {t('modos:hoja.pista')}
      </Text>
      <EleccionModos valor={elegidos} alCambiar={setElegidos} ocupada={guardando} minimo={false} />
      {error ? (
        <Text style={styles.error} maxFontSizeMultiplier={1.35}>
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}

function NivelesModoEncendido({ nivelGlobal }: { nivelGlobal: number | null }) {
  const { cargando, error, niveles, activados, guardar } = useNivelesModo();
  const [hoja, setHoja] = useState(false);
  return (
    <>
      <NivelesModoVista
        cargando={cargando}
        error={error}
        nivelGlobal={nivelGlobal}
        niveles={niveles}
        onElegir={() => setHoja(true)}
      />
      <HojaModos abierta={hoja} cerrar={() => setHoja(false)} activados={activados} guardar={guardar} />
    </>
  );
}

/** El hueco de Perfil: nada con el interruptor apagado. */
export function NivelesModo({ nivelGlobal }: { nivelGlobal: number | null }) {
  const { activo } = useModo();
  if (!activo) return null;
  return <NivelesModoEncendido nivelGlobal={nivelGlobal} />;
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
