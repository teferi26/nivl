// NIVL · Fotos de progreso: la fila de Avances (L5 · A).
//
// Va dentro del bloque de salud aceptada de Avances, tras el peso. Según el
// acceso (usePermisoFotos):
//   - cargando o sin salud → nada (Avances ya enseña su aviso de salud);
//   - error (sin conexión al leer la edad) → «No se ha podido comprobar»,
//     que vuelve a leer; nunca pregunta la edad por un fallo de red;
//   - confirmar_edad → «Fotos de progreso · 18+», que abre la pregunta en una
//     hoja con «Tengo 18 o más» y «Ahora no» del mismo peso;
//   - abierto → «Fotos de progreso» con las semanas seguidas (cosmético, sin
//     XP), que lleva a /fotos.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { usePermisoFotos } from '@/components/permisoFotos';
import { Card, Row, RowValue, Sheet } from '@/components/ui';
import { ink } from '@/design/tokens';
import { t } from '@/i18n';
import { confirmarMayorDeEdad } from '@/lib/age';
import { dateKey } from '@/lib/dates';
import { rachaFotosSemanal } from '@/lib/progressPhotos';
import { mensajeSistema } from '@/lib/validation';
import { listarFotos } from './datos';
import { textoSemanas } from './modelo';
import { PreguntaEdad, preguntaEdad } from './PreguntaEdad';

export function FilaFotosAvances() {
  const { estado, recargar, reintentar } = usePermisoFotos();
  const [semanas, setSemanas] = useState<number | null>(null);
  const [hoja, setHoja] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cerrojo = useRef(false);
  const abierto = estado === 'abierto';

  useFocusEffect(
    useCallback(() => {
      if (!abierto) {
        setSemanas(null);
        return;
      }
      let vivo = true;
      listarFotos().then(
        (fs) => {
          if (vivo) setSemanas(rachaFotosSemanal(fs, dateKey()).semanas);
        },
        () => {
          if (vivo) setSemanas(null);
        },
      );
      return () => {
        vivo = false;
      };
    }, [abierto]),
  );

  const si = async () => {
    if (cerrojo.current) return;
    cerrojo.current = true;
    setOcupado(true);
    setError(null);
    try {
      await confirmarMayorDeEdad();
      await recargar();
      setHoja(false);
      router.push('/fotos');
    } catch (e) {
      setError(mensajeSistema(e));
    } finally {
      cerrojo.current = false;
      setOcupado(false);
    }
  };

  if (estado === 'cargando' || estado === 'sin_salud') return null;

  const icono = <Ionicons name="images-outline" size={20} color={ink.ink9} />;

  return (
    <View style={styles.wrap}>
      <Card padded={false} style={styles.lista}>
        {estado === 'error' ? (
          <Row
            first
            leading={icono}
            title={t('fotos:fotosProgreso')}
            detail={t('fotos:fila.errorDetalle')}
            onPress={reintentar}
            accessibilityLabel={t('fotos:fila.errorA11y')}
          />
        ) : abierto ? (
          <Row
            first
            leading={icono}
            title={t('fotos:fotosProgreso')}
            detail={semanas ? textoSemanas(semanas) : t('fotos:fila.detalle')}
            trailing={semanas ? <RowValue strong>{semanas}</RowValue> : undefined}
            chevron
            onPress={() => router.push('/fotos')}
            accessibilityLabel={
              semanas ? t('fotos:fila.semanasA11y', { semanas: textoSemanas(semanas) }) : t('fotos:fotosProgreso')
            }
          />
        ) : (
          <Row
            first
            leading={icono}
            title={t('fotos:fila.titulo18')}
            detail={t('fotos:fila.detalle18')}
            chevron
            onPress={() => {
              setError(null);
              setHoja(true);
            }}
            accessibilityLabel={t('fotos:fila.a11y18')}
          />
        )}
      </Card>
      <Sheet visible={hoja} onClose={() => !cerrojo.current && setHoja(false)} eyebrow={t('fotos:fotosProgreso')}
        title={preguntaEdad()}
        scroll={false}
      >
        <PreguntaEdad sinPregunta onSi={() => void si()} onNo={() => setHoja(false)} ocupado={ocupado} error={error} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
});
