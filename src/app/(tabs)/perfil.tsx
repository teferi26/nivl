// NIVL · Perfil (L-RADICAL B.3). La ruta solo junta las piezas: usePerfil
// (datos y efectos), PerfilVista (la pantalla), PerfilAjustes (los ajustes) y,
// debajo, las hojas (HojasPerfil): borrar la cuenta, pausar, el código de
// creador y el idioma del coach. Modos F1: NivelesModo (nada con el
// interruptor `modos_activos` apagado).
import { HojaBorrar, HojaCodigo, HojaIdioma, HojaIdiomaApp, HojaPausa } from '@/components/perfil/HojasPerfil';
import { PerfilAjustes } from '@/components/perfil/PerfilAjustes';
import { PerfilVista } from '@/components/perfil/PerfilVista';
import { FREEZE_DAYS, motivosPausa, usePerfil } from '@/components/perfil/usePerfil';
import { ArsenalConectado } from '@/components/general/Arsenal';
import { NivelesModo } from '@/components/modos/NivelesModo';
import { Screen } from '@/components/ui';

export default function Perfil() {
  const { vista, ajustes, hojas } = usePerfil();
  const { pausa, codigo, borrar, idioma, idiomaApp, today } = hojas;

  return (
    <Screen>
      <PerfilVista
        {...vista}
        ajustes={ajustes ? <PerfilAjustes {...ajustes} /> : null}
        nivelesModo={
          <>
            {/* Cambiar de modo con UN toque, sin rueda (docs/modos/GENERAL.md). */}
            <ArsenalConectado />
            <NivelesModo nivelGlobal={vista.datos?.estado.nivel ?? null} />
          </>
        }
      />

      {hojas.consentimientoHoja}

      <HojaBorrar {...borrar} />
      <HojaPausa {...pausa} today={today} motivos={motivosPausa()} duraciones={FREEZE_DAYS} />
      <HojaCodigo {...codigo} />
      {/* Con el flag `idiomas_activos`, «Idioma» (app y coach) sustituye al idioma del coach. */}
      {idiomaApp.activa ? <HojaIdiomaApp {...idiomaApp} /> : <HojaIdioma {...idioma} />}
    </Screen>
  );
}
