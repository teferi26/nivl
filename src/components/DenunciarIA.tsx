// NIVL · La hoja de denunciar una respuesta de la IA (coach y Oráculo).
//
// Requisito de Google Play para apps con IA generativa: desde la propia
// respuesta se puede señalar como dañina u ofensiva. Se envía el motivo y el
// texto de esa burbuja (se avisa antes); si el servidor aún no tiene la
// función, se abre un correo a soporte con el id y el motivo, sin el texto.

import * as Linking from 'expo-linking';
import { useRef, useState } from 'react';
import { DenunciaVista } from '@/components/puertas/DenunciaVista';
import { vibrar } from '@/design/haptics';
import { supabase } from '@/lib/supabase';
import { mensajeSistema } from '@/lib/validation';
import { CORREO_SOPORTE, correoDenuncia, extractoDenuncia, faltaLaRpc, type FuenteIA, type MotivoIA } from './denunciaIA';

export interface RespuestaDenunciada {
  fuente: FuenteIA;
  /** Id del mensaje en servidor; null en el Oráculo, que no los guarda. */
  messageId: string | null;
  texto: string;
  /** Hilo y hora, para localizarla si no hay id de servidor. Nunca el texto. */
  contexto?: string;
}

interface Props {
  /** La respuesta que se denuncia; null = hoja cerrada. */
  respuesta: RespuestaDenunciada | null;
  onClose: () => void;
}

export function DenunciarIA({ respuesta, onClose }: Props) {
  const [motivo, setMotivo] = useState<MotivoIA | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const cerrar = () => {
    if (lock.current) return;
    setMotivo(null);
    setAviso(null);
    setEnviada(false);
    onClose();
  };

  const enviar = async () => {
    if (!respuesta || !motivo || lock.current) return;
    lock.current = true;
    setBusy(true);
    setAviso(null);
    try {
      const { error } = await supabase.rpc('report_ai_message', {
        p_source: respuesta.fuente,
        p_message_id: respuesta.messageId,
        p_reason: motivo,
        p_excerpt: extractoDenuncia(respuesta.texto),
      });
      if (error && faltaLaRpc(error)) {
        // Aún sin la función en el servidor: el correo de respaldo, sin el texto.
        try {
          await Linking.openURL(correoDenuncia(respuesta.fuente, motivo, respuesta.messageId, respuesta.contexto));
          setAviso('Se ha abierto tu correo con la denuncia. Envíalo para que llegue a revisión.');
        } catch {
          // Sin app de correo: que sepa a dónde escribir.
          setAviso(`No se ha podido abrir el correo. Escribe a ${CORREO_SOPORTE} con el motivo de la denuncia.`);
        }
        setEnviada(true);
      } else if (error) {
        throw error;
      } else {
        setEnviada(true);
        setAviso('Denuncia registrada. El equipo revisará esta respuesta.');
      }
    } catch (e) {
      vibrar('penalizacion');
      setAviso(mensajeSistema(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <DenunciaVista
      visible={respuesta !== null}
      motivo={motivo}
      aviso={aviso}
      enviada={enviada}
      ocupada={busy}
      onMotivo={setMotivo}
      onEnviar={() => void enviar()}
      onCerrar={cerrar}
    />
  );
}
