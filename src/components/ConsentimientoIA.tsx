// NIVL · La hoja del consentimiento para la IA (Guideline 5.1.2(i), RGPD
// arts. 9 y 49).
//
// Sale antes del primer uso del coach: el primer mensaje del chat, la prueba
// de 7 días, la compra y el Oráculo. Dice qué datos van, a quién y dónde, y
// guarda la aceptación en el servidor con su versión (migración 0028). Sin
// ella el servidor no llama a ningún modelo, así que esta hoja no es la
// cerradura: es la puerta con el cartel.
//
// Uso: `const consentimiento = useConsentimientoIA();` y, antes de la acción,
// `if (!(await consentimiento.asegurar())) return;`. La pantalla pinta
// `{consentimiento.hoja}` en cualquier parte de su árbol.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConsentimientoIAVista } from '@/components/puertas/ConsentimientoIAVista';
import {
  aceptarConsentimiento,
  consentimientoVigente,
  crearCerrojoAceptacion,
  fetchConsentimiento,
  type AccionesAceptacion,
} from '@/lib/consent';
import { mensajeSistema } from '@/lib/validation';

interface SheetProps {
  visible: boolean;
  onAceptado: () => void;
  onCerrar: () => void;
}

export function ConsentimientoSheet({ visible, onAceptado, onCerrar }: SheetProps) {
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // El cerrojo es puro (consentmath.ts, con tests): aquí solo se le dan las
  // manos. La ref guarda las del último render.
  const acciones = useRef<AccionesAceptacion | null>(null);
  acciones.current = {
    guardar: aceptarConsentimiento,
    alEmpezar: () => {
      setBusy(true);
      setAviso(null);
    },
    alTerminar: () => setBusy(false),
    // Sin vibración al aceptar: decir sí y decir no pesan lo mismo.
    alAceptar: () => onAceptado(),
    alFallar: (e) => setAviso(mensajeSistema(e)),
  };
  const [cerrojo] = useState(() => crearCerrojoAceptacion(() => acciones.current!));

  const aceptar = () => cerrojo.aceptar();
  const cerrar = () => {
    cerrojo.cerrar(() => {
      setAviso(null);
      onCerrar();
    });
  };

  return <ConsentimientoIAVista visible={visible} ocupada={busy} aviso={aviso} onAceptar={aceptar} onCerrar={cerrar} />;
}

/**
 * Pide el consentimiento solo si hace falta. `asegurar()` resuelve true si ya
 * estaba vigente o si se acepta en la hoja; false si se cierra sin aceptar.
 * Si no se puede comprobar, abre la hoja y espera una aceptación guardada.
 * Salir de la pantalla cancela la petición pendiente.
 */
export function useConsentimientoIA() {
  const [abierta, setAbierta] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const montada = useRef(true);

  useEffect(() => {
    montada.current = true;
    return () => {
      montada.current = false;
      resolver.current?.(false);
      resolver.current = null;
    };
  }, []);

  const pedir = useCallback(
    () =>
      new Promise<boolean>((res) => {
        if (!montada.current) {
          res(false);
          return;
        }
        resolver.current?.(false);
        resolver.current = res;
        setAbierta(true);
      }),
    [],
  );

  const asegurar = useCallback(async () => {
    try {
      const estado = await fetchConsentimiento();
      if (!montada.current) return false;
      if (consentimientoVigente(estado)) return true;
    } catch {
      // Un fallo de lectura no autoriza ni la prueba ni una compra.
    }
    return pedir();
  }, [pedir]);

  const terminar = (ok: boolean) => {
    if (!montada.current) return;
    setAbierta(false);
    const r = resolver.current;
    resolver.current = null;
    r?.(ok);
  };

  const hoja = <ConsentimientoSheet visible={abierta} onAceptado={() => terminar(true)} onCerrar={() => terminar(false)} />;
  return { asegurar, pedir, hoja };
}
