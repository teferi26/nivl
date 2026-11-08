// NIVL · FOCUS: generar tarjetas con IA desde un texto (efectos).
//
// Solo con NIVL Pro. Sin Pro la hoja ofrece el lote a mano: una negativa del
// candado (CoachAccessError) nunca se enseña como error.

import { useCallback, useEffect, useRef, useState } from 'react';
import { tarjetasDeIa, type TarjetaImportada } from '@/focus/importar';
import { t } from '@/i18n';
import { accessNotice, CoachAccessError, generarFlashcards } from '@/lib/coach';
import { fetchAiStatus } from '@/lib/pro';
import { mensajeSistema } from '@/lib/validation';

export type FaseIa = 'comprobando' | 'sinPro' | 'escribir' | 'generando' | 'revisar';

export function useTarjetasIa(abierta: boolean) {
  const [fase, setFase] = useState<FaseIa>('comprobando');
  const [tarjetas, setTarjetas] = useState<TarjetaImportada[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  // Cerrar la hoja o pedir otra cosa deja sin efecto la respuesta que llegue tarde.
  const turno = useRef(0);

  useEffect(() => {
    const yo = ++turno.current;
    if (!abierta) return;
    setFase('comprobando');
    setTarjetas([]);
    setAviso(null);
    fetchAiStatus()
      .then((s) => {
        if (turno.current === yo) setFase(s.entitled ? 'escribir' : 'sinPro');
      })
      .catch(() => {
        // Sin saberlo se deja probar: el servidor decide.
        if (turno.current === yo) setFase('escribir');
      });
  }, [abierta]);

  const generar = useCallback(async (texto: string) => {
    const yo = ++turno.current;
    setFase('generando');
    setAviso(null);
    try {
      const r = tarjetasDeIa(await generarFlashcards(texto));
      if (turno.current !== yo) return;
      if (r.length === 0) {
        setAviso(t('focus:fondo.tarjetas.iaNada'));
        setFase('escribir');
        return;
      }
      setTarjetas(r);
      setFase('revisar');
    } catch (e) {
      if (turno.current !== yo) return;
      if (e instanceof CoachAccessError && e.reason === 'sin_suscripcion') {
        setFase('sinPro');
        return;
      }
      setAviso(e instanceof CoachAccessError ? accessNotice(e) : mensajeSistema(e));
      setFase('escribir');
    }
  }, []);

  const quitar = useCallback((i: number) => setTarjetas((xs) => xs.filter((_, k) => k !== i)), []);
  const otraVez = useCallback(() => {
    setTarjetas([]);
    setAviso(null);
    setFase('escribir');
  }, []);

  return { fase, tarjetas, aviso, generar, quitar, otraVez };
}
