// NIVL · Gimnasio. La ruta solo junta las piezas (L-RADICAL §C, FASE3 Lote E1):
// los datos, los efectos y los cerrojos (la sesión, el pago y la celebración)
// viven en useGym; lo que se pinta, en GymVista (pura, también en la galería
// /kit/pantallas); las hojas «Nuevo día» y «Ejercicio» van debajo.

import { GymVista } from '@/components/gym/GymVista';
import { HojaDia, HojaEjercicio } from '@/components/gym/HojasGym';
import { useGym } from '@/components/gym/useGym';

export default function Gym() {
  const { vista, hojaDia, hojaEjercicio } = useGym();
  return (
    <>
      <GymVista {...vista} />
      <HojaDia {...hojaDia} />
      <HojaEjercicio {...hojaEjercicio} />
    </>
  );
}
