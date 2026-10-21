// NIVL · General · Arena: junta los datos de Amigos (useAmigos, vía
// PantallaAmigos, que conserva la hoja de seguridad), los duelos (useDuelos) y
// la hoja de retar de siempre (RetarSheet) con la vista nueva.
import { router } from 'expo-router';
import { useState } from 'react';
import { RetarSheet, type Amigo } from '@/components/amigos/Competicion';
import type { DatosAmigos } from '@/components/amigos/useAmigos';
import { t } from '@/i18n';
import { ArenaGeneralVista } from './ArenaGeneralVista';
import { useDuelos } from './useDuelos';

export function ArenaConectada({ d }: { d: DatosAmigos }) {
  const v = d.vista;
  const c = d.competicion;
  const duelos = useDuelos(c.tablero, c.recarga);
  const [retar, setRetar] = useState<{ abierta: boolean; rival: Amigo | null }>({ abierta: false, rival: null });
  return (
    <>
      <ArenaGeneralVista
        cargando={v.cargando}
        fallo={v.fallo}
        refrescando={v.refrescando}
        refrescar={() => {
          void v.refrescar();
          duelos.recargar();
        }}
        subtitulo={v.subtitulo}
        numAmigos={v.numAmigos}
        ranking={v.ranking}
        ventana={v.ventana}
        elegirVentana={v.elegirVentana}
        metrica={v.metrica}
        elegirMetrica={v.elegirMetrica}
        miCodigo={v.yo?.friendCode ?? null}
        copiado={v.copiado}
        copiar={v.copiar}
        invitar={() => void v.invitar()}
        codigo={v.codigo}
        setCodigo={(x) => {
          v.setCodigo(x);
          v.setAvisoCodigo(null);
        }}
        enviar={() => void v.enviar()}
        enviando={v.enviando}
        avisoCodigo={v.avisoCodigo}
        entrantes={v.entrantes}
        salientes={v.salientes}
        ocupada={v.ocupada}
        responder={(r, a) => void v.responder(r, a)}
        retirar={(r) =>
          void v.quitar(
            r.friendshipId,
            t('amigos:solicitudes.retirarTitulo'),
            t('amigos:solicitudes.retirarMensaje', { nombre: r.name }),
            t('amigos:solicitudes.retirar'),
          )
        }
        abrirSeguridad={v.abrirSeguridad}
        duelos={duelos}
        onRetar={(rival) => setRetar({ abierta: true, rival })}
        amigos={c.amigos}
        onAjustes={() => router.push('/amigos')}
      />
      <RetarSheet
        visible={retar.abierta}
        amigos={c.amigos}
        preelegido={retar.rival}
        hoy={duelos.hoy}
        onCerrar={() => setRetar({ abierta: false, rival: null })}
        onHecho={duelos.recargar}
      />
    </>
  );
}
