// NIVL · Prueba automática de Élite: los datos y las decisiones (efectos).
//
// Solo con `prueba_auto_activa` encendido. Lee la fila de `subscriptions`
// al montar, al volver a primer plano y al cambiar de pantalla (como mucho
// cada 15 s: tras comprar en /pro, la pantalla de fin se va sola), y las
// marcas del teléfono. Decide con pantallaPrueba (puro).

import { usePathname } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCelebracion } from '@/components/celebracion/contexto';
import { useAlVolver } from '@/components/ui';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useFlags } from '@/lib/flags';
import { ofertaFinPrueba, type OfertaFinPrueba } from '@/lib/pro';
import { guardarMarcasPrueba, leerMarcasPrueba, leerSuscripcionPrueba } from '@/lib/pruebaAuto';
import {
  estadoPrueba,
  fechaHoraLocal,
  MARCAS_VACIAS,
  pantallaPrueba,
  preciosFin,
  trasBienvenida,
  type MarcasPrueba,
  type SuscripcionPrueba,
} from '@/lib/pruebaAutomath';

const RELEER_MS = 15_000;

export function usePruebaAuto() {
  const { prueba_auto_activa: activa, prueba_auto_dias: dias } = useFlags();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const ruta = usePathname();
  const { avisar } = useCelebracion();

  const [sub, setSub] = useState<SuscripcionPrueba | null>(null);
  const [marcas, setMarcas] = useState<MarcasPrueba | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  // «Seguir con Élite» o el atrás de Android la apartan en esta sesión (sin contar como «no»).
  const [apartada, setApartada] = useState(false);
  const [oferta, setOferta] = useState<OfertaFinPrueba | null>(null);
  const ultimaLectura = useRef(0);

  const leer = useCallback(
    async (forzar = false) => {
      if (!activa || !userId) return;
      if (!forzar && Date.now() - ultimaLectura.current < RELEER_MS) return;
      ultimaLectura.current = Date.now();
      try {
        const [s, m] = await Promise.all([leerSuscripcionPrueba(userId), leerMarcasPrueba(userId)]);
        setSub(s);
        setMarcas(m);
        setAhora(Date.now());
      } catch {
        // Sin red: no se enseña nada (nunca a ciegas).
      }
    },
    [activa, userId],
  );

  useEffect(() => {
    setSub(null);
    setMarcas(null);
    setApartada(false);
    void leer(true);
  }, [leer]);
  useEffect(() => {
    void leer();
  }, [ruta, leer]);
  useAlVolver(() => {
    setApartada(false);
    void leer(true);
  });

  const estado = useMemo(() => estadoPrueba(sub, ahora), [sub, ahora]);
  const pantalla =
    marcas === null ? null : pantallaPrueba({ activa, estado, marcas, ahora });
  const visible = pantalla === 'fin' && apartada ? null : pantalla;
  const fin = estado.tipo === 'ninguna' ? null : fechaHoraLocal(estado.fin);

  const guardar = useCallback(
    (m: MarcasPrueba) => {
      setMarcas(m);
      if (userId) void guardarMarcasPrueba(userId, m);
    },
    [userId],
  );

  // El aviso de 24 h: suave, en la cola de avisos de la app (no es un push).
  useEffect(() => {
    if (visible !== 'aviso' || !fin || estado.tipo !== 'activa') return;
    avisar(t('prueba:aviso', fin));
    guardar({ ...(marcas ?? MARCAS_VACIAS), aviso: estado.fin });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una vez por prueba
  }, [visible]);

  // Los precios de la tienda para la pantalla de fin.
  useEffect(() => {
    if (visible !== 'fin' || oferta) return;
    ofertaFinPrueba()
      .then(setOferta)
      .catch(() => {});
  }, [visible, oferta]);

  return {
    pantalla: visible,
    dias,
    fecha: fin?.fecha ?? '',
    hora: fin?.hora ?? '',
    precios: preciosFin(oferta),
    cerrarBienvenida: () => guardar(trasBienvenida(marcas ?? MARCAS_VACIAS, estado, Date.now())),
    apartar: () => setApartada(true),
    quedarme: () => guardar({ ...(marcas ?? MARCAS_VACIAS), gratisEn: Date.now() }),
  };
}
