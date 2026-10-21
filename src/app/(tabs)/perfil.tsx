// NIVL · General · Perfil (General v2). La ruta solo junta las piezas:
// usePerfil (datos y efectos), PerfilGeneralVista (identidad, progresión,
// arsenal, títulos, cuenta y ajustes con la piel de NIVL), PerfilAjustes (los
// ajustes de siempre) y, debajo, las hojas (HojasPerfil): borrar la cuenta,
// pausar, el código de creador y el idioma. Modos: «Tu arsenal» (un toque) y
// NivelesModo (nada con el interruptor `modos_activos` apagado).
import { router } from 'expo-router';
import { ArsenalConectado } from '@/components/general/Arsenal';
import { PerfilGeneralVista } from '@/components/general/PerfilGeneralVista';
import { PielGeneral } from '@/components/general/piel';
import { NivelesModo } from '@/components/modos/NivelesModo';
import { HojaBorrar, HojaCodigo, HojaIdioma, HojaIdiomaApp, HojaPausa } from '@/components/perfil/HojasPerfil';
import { PerfilAjustes } from '@/components/perfil/PerfilAjustes';
import { FREEZE_DAYS, motivosPausa, usePerfil } from '@/components/perfil/usePerfil';

export default function Perfil() {
  const { vista, ajustes, hojas } = usePerfil();
  const { pausa, codigo, borrar, idioma, idiomaApp, today } = hojas;

  return (
    <PielGeneral>
      <PerfilGeneralVista
        {...vista}
        onVolver={() => router.navigate('/(tabs)')}
        onProgresion={() => router.navigate({ pathname: '/(tabs)/avance', params: { ver: 'progresion' } })}
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
    </PielGeneral>
  );
}
