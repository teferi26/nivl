// NIVL · El enlace de creador: nivl://c/CODIGO.
//
// Guarda el código como pendiente y se va a la raíz. No enseña nada: quien
// decide adónde ir es `index.tsx` (login, onboarding con el código precargado
// en "¿Quién te trajo?", o Hoy, donde se reintenta en silencio). Esta ruta es
// zona pública en `_layout.tsx`: si no, el guard saltaba a /login antes de
// guardar el código y se perdía.
//
// Solo abre la app si ya está instalada: sin un SDK de atribución no hay
// enlace diferido, así que el mecanismo principal es la pregunta del
// onboarding (docs/PLAN_NIVELES_Y_CREADORES.md §4).

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { guardarCodigoPendiente } from '@/lib/creators';
import { ink } from '@/design/tokens';

export default function EnlaceCreador() {
  const { code } = useLocalSearchParams<{ code: string }>();

  useEffect(() => {
    let alive = true;
    const valor = Array.isArray(code) ? code[0] : code;
    guardarCodigoPendiente(valor ?? '', 'enlace').finally(() => {
      if (alive) router.replace('/');
    });
    return () => {
      alive = false;
    };
  }, [code]);

  return <View style={{ flex: 1, backgroundColor: ink.ink0 }} />;
}
