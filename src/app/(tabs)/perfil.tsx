// NIVL · Perfil (L-RADICAL B.3). La ruta solo junta las piezas: usePerfil
// (datos y efectos), PerfilVista (la pantalla), PerfilAjustes (los ajustes) y,
// debajo, las tres hojas (HojasPerfil): borrar la cuenta, pausar y el código
// de creador.
import { HojaBorrar, HojaCodigo, HojaPausa } from '@/components/perfil/HojasPerfil';
import { PerfilAjustes } from '@/components/perfil/PerfilAjustes';
import { PerfilVista } from '@/components/perfil/PerfilVista';
import { FREEZE_DAYS, FREEZE_REASONS, usePerfil } from '@/components/perfil/usePerfil';
import { Screen } from '@/components/ui';

export default function Perfil() {
  const { vista, ajustes, hojas } = usePerfil();
  const { pausa, codigo, borrar, today } = hojas;

  return (
    <Screen>
      <PerfilVista {...vista} ajustes={ajustes ? <PerfilAjustes {...ajustes} /> : null} />

      {hojas.consentimientoHoja}

      <HojaBorrar {...borrar} />
      <HojaPausa {...pausa} today={today} motivos={FREEZE_REASONS} duraciones={FREEZE_DAYS} />
      <HojaCodigo {...codigo} />
    </Screen>
  );
}
