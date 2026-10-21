// NIVL · Mundos FOCUS, WORK y FOUNDER: las pantallas de sus pestañas. Solo
// juntan piezas que ya existen (patrón useX + XVista), sin lógica nueva:
//   · Hoy: useHoy + MundoHoyVista + CompletarSheet (la misma hoja de NIVL).
//   · Agenda: useAgenda + AgendaVista y sus hojas (bloques de foco y de trabajo).
//   · Diario: useDiario + DiarioVista (guarda de salud `diario`).
//   · La Economía de WORK y FOUNDER es una sola: economia/work/PantallaWorkEconomia.
// En una pestaña no hay flecha de volver.

import { router } from 'expo-router';
import { AgendaVista } from '@/components/agenda/AgendaVista';
import { HojaDetalle, HojaEvento } from '@/components/agenda/HojasAgenda';
import { useAgenda } from '@/components/agenda/useAgenda';
import { CompletarSheet } from '@/components/CompletarSheet';
import { HealthConsentGuard } from '@/components/ConsentimientoSalud';
import { DiarioVista } from '@/components/diario/DiarioVista';
import { useDiario } from '@/components/diario/useDiario';
import { useHoy } from '@/components/hoy/useHoy';
import { rutaCoachDe } from '@/modos/rutasModo';
import { EmblemaMundo } from '@/components/modos/EmblemaMundo';
import { CabeceraMundo } from './CabeceraMundo';
import { MundoHoyVista, type ModoMundoSobrio } from './MundoHoyVista';
import { useMundo } from './useMundo';

export function PantallaMundoHoy({ modo }: { modo: ModoMundoSobrio }) {
  const { vista, hojas } = useHoy();
  const mundo = useMundo(modo);
  return (
    <>
      <MundoHoyVista
        modo={modo}
        cabecera={<CabeceraMundo modo={modo} nivel={mundo.nivel} emblema={<EmblemaMundo modo={modo} />} />}
        hoy={vista}
        onCoach={() => router.navigate(rutaCoachDe(modo))}
      />
      <CompletarSheet quest={hojas.quest} onElegir={hojas.onElegir} onClose={hojas.onClose} />
    </>
  );
}

export function PantallaMundoAgenda() {
  const { vista, hojaEvento, hojaDetalle } = useAgenda();
  return (
    <>
      <AgendaVista {...vista} onVolver={undefined} />
      <HojaEvento {...hojaEvento} />
      <HojaDetalle {...hojaDetalle} />
    </>
  );
}

function Diario() {
  const vista = useDiario();
  return <DiarioVista {...vista} acciones={{ ...vista.acciones, onVolver: undefined }} />;
}

export function PantallaMundoDiario() {
  return (
    <HealthConsentGuard routeName="diario">
      <Diario />
    </HealthConsentGuard>
  );
}
