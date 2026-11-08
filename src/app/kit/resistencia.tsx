// NIVL · Galería: las cuatro vistas de Resistencia con el triatleta ficticio de
// components/resistencia/demo.ts. SOLO DESARROLLO.
//
// /kit/resistencia?v=hub|detalle|carrera|progreso
//   &estado=cargando|error|vacio|dolor   (según la vista; por defecto, llena)
//   &deporte=carrera|bici|piscina        (solo detalle)
//   &hoja=1                              (carrera: la hoja del objetivo abierta)
//   &solo=1                              (sin la barra de cambiar de vista)
// En un build de release (__DEV__ false) redirige a la raíz.

import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChipIron } from '@/components/ironmundo/piezas';
import { C, px } from '@/components/ironmundo/tema';
import { PielIron } from '@/components/ironmundo/piel';
import { CarreraVista } from '@/components/resistencia/CarreraVista';
import { demoCarrera, demoDetalle, demoHojaObjetivo, demoHub, demoProgreso } from '@/components/resistencia/demo';
import { DetalleVista } from '@/components/resistencia/DetalleVista';
import { HojaObjetivo } from '@/components/resistencia/HojaObjetivo';
import { HubVista } from '@/components/resistencia/HubVista';
import { ProgresoVista } from '@/components/resistencia/ProgresoVista';
import type { DeporteEntreno } from '@/lib/entrenoMedido';

const VISTAS = ['hub', 'detalle', 'carrera', 'progreso'] as const;
type Vista = (typeof VISTAS)[number];

type Params = {
  v?: string;
  estado?: string;
  deporte?: string;
  hoja?: string;
  solo?: string;
};

function Contenido({ v, p }: { v: Vista; p: Params }) {
  const [hoja, setHoja] = useState(p.hoja === '1');
  const estado = p.estado;
  const carga = estado === 'cargando' ? 'cargando' : estado === 'error' ? 'error' : 'listo';
  switch (v) {
    case 'hub':
      return <HubVista {...demoHub({ cargando: estado === 'cargando', error: estado === 'error', dolor: estado === 'dolor' })} />;
    case 'detalle':
      return <DetalleVista {...demoDetalle((p.deporte as DeporteEntreno | undefined) ?? 'carrera')} />;
    case 'carrera':
      return (
        <>
          <CarreraVista {...demoCarrera(carga, estado === 'vacio')} onObjetivo={() => setHoja(true)} />
          <HojaObjetivo {...demoHojaObjetivo(hoja, () => setHoja(false))} />
        </>
      );
    case 'progreso':
      return <ProgresoVista {...demoProgreso(carga, estado === 'vacio')} />;
  }
}

export default function KitResistencia() {
  const p = useLocalSearchParams<Params>();
  if (!__DEV__) return <Redirect href="/" />;
  const v = VISTAS.find((x) => x === p.v) ?? 'hub';
  return (
    <PielIron>
      <View style={styles.flex}>
        <View style={styles.flex}>
          <Contenido key={`${v}-${p.estado ?? ''}-${p.deporte ?? ''}`} v={v} p={p} />
        </View>
        {p.solo === '1' ? null : (
          <View style={styles.barra}>
            {VISTAS.map((x) => (
              <ChipIron key={x} texto={x} activo={x === v} onPress={() => router.setParams({ v: x, estado: '', deporte: '' })} />
            ))}
          </View>
        )}
      </View>
    </PielIron>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  barra: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: px(6),
    paddingVertical: px(8),
    backgroundColor: C.fondo,
    borderTopWidth: 1,
    borderTopColor: C.filete,
  },
});
