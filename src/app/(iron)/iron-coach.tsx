// NIVL · Mundo IRON: el coach. El mismo chat que NIVL (por dentro no se toca);
// dentro del mundo el modo activo es IRON y viaja de contexto en
// `x-nivl-modo`. Por fuera lleva el marco de IRON (CoachIronMarco).
import { PantallaCoach } from '@/components/coach/PantallaCoach';
import { CoachIronMarco } from '@/components/ironmundo/CoachIronMarco';

export default function IronCoach() {
  return (
    <CoachIronMarco>
      <PantallaCoach />
    </CoachIronMarco>
  );
}
