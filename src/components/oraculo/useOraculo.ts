// NIVL · Oráculo: datos, efectos y cerrojos (patrón L-RADICAL §C, FASE3 G1).
// Cortado y pegado de la ruta: la clave propia (solo si `byokEnabled()`), el
// consentimiento de IA, la consulta con su camino a NIVL Pro (PaywallError →
// aviso con el enlace a /pro; nunca Stripe en la app de tienda) y aceptar las
// misiones propuestas. La lógica de acceso es de src/lib/oracle.ts y
// src/lib/subscription.ts y aquí solo se consume.
//
// Cambios de presentación respecto a la ruta vieja:
//   · El fallo de la consulta y el de aceptar van en línea (ErrorSistema) y
//     vibran `penalizacion`; ya no abren un diálogo.
//   · Guardar la clave ya no abre un aviso mientras la hoja se cierra: el
//     subtítulo pasa a decir que la clave está en el dispositivo.
//   · Marcar o desmarcar una propuesta vibra `seleccion` (el Check rebota).

import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useConsentimientoIA } from '@/components/ConsentimientoIA';
import type { RespuestaDenunciada } from '@/components/DenunciarIA';
import { confirmar } from '@/components/ui/confirmar';
import { volver } from '@/components/ui/Screen';
import { vibrar } from '@/design/haptics';
import { useAuth } from '@/lib/auth';
import { olvidarConsentimiento } from '@/lib/consent';
import { createQuest } from '@/lib/data';
import { askOracle, ConsentRequiredError, getApiKey, PaywallError, setApiKey, type ProposedQuest } from '@/lib/oracle';
import { byokEnabled } from '@/lib/subscription';
import { mensajeSistema } from '@/lib/validation';
import type { HojaClaveProps } from './HojaClave';
import type { OraculoVistaProps } from './OraculoVista';

export interface UsoOraculo {
  vista: OraculoVistaProps;
  hojaClave: HojaClaveProps;
  /** La hoja de consentimiento de IA (useConsentimientoIA). */
  hojaConsentimiento: ReactNode;
  denuncia: { respuesta: RespuestaDenunciada | null; onClose: () => void };
}

export function useOraculo(): UsoOraculo {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [apiKey, setKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [goal, setGoal] = useState('');
  const [proposals, setProposals] = useState<ProposedQuest[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState('');
  const [denuncia, setDenuncia] = useState<RespuestaDenunciada | null>(null);
  const [busy, setBusy] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState<string | null>(null);
  const [errorAceptar, setErrorAceptar] = useState<string | null>(null);
  // El Oráculo es de NIVL Pro: sin él, un aviso con el camino a /pro. Nunca
  // Stripe ni la clave propia en la app de tienda (Guideline 3.1.1).
  const [pidePro, setPidePro] = useState(false);
  const clavePropia = byokEnabled();
  const consentimiento = useConsentimientoIA();

  useEffect(() => {
    if (!clavePropia) return;
    getApiKey().then((k) => {
      if (k) {
        setKey(k);
        setKeySaved(true);
      }
    });
  }, [clavePropia]);

  const saveKey = async () => {
    await setApiKey(apiKey);
    setKeySaved(!!apiKey.trim());
    setKeyOpen(false);
  };

  const consult = async () => {
    if (!goal.trim() || busy || !userId) return;
    if (!(await consentimiento.asegurar())) return;
    setBusy(true);
    setPidePro(false);
    setErrorConsulta(null);
    setErrorAceptar(null);
    setProposals([]);
    try {
      // Vía automática: suscripción premium (servidor) → key propia → paywall.
      const res = await askOracle(goal.trim(), userId);
      setProposals(res.quests);
      setSummary(res.plan_summary);
      setSelected(new Set(res.quests.map((_, i) => i)));
    } catch (e) {
      if (e instanceof PaywallError) {
        setPidePro(true);
      } else if (e instanceof ConsentRequiredError) {
        olvidarConsentimiento();
        consentimiento.pedir();
      } else {
        vibrar('penalizacion');
        setErrorConsulta(mensajeSistema(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const toggle = (i: number) => {
    vibrar('seleccion');
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const accept = async () => {
    if (!userId || selected.size === 0 || accepting) return;
    setAccepting(true);
    setErrorAceptar(null);
    try {
      for (const i of selected) {
        const p = proposals[i];
        if (!p) continue;
        await createQuest(userId, {
          health_data: true,
          title: p.title,
          stat: p.stat,
          difficulty: p.difficulty,
          days_of_week: p.days_of_week,
          requires_evidence: false,
        });
      }
      const n = selected.size;
      setProposals([]);
      setGoal('');
      // El aviso llevaba la navegación en su botón: en la web era un botón
      // muerto. Ahora es una confirmación que funciona en las dos.
      const ver = await confirmar({
        titulo: 'MISIONES ASIGNADAS',
        mensaje: `El sistema ha registrado ${n === 1 ? 'una misión nueva' : `${n} misiones nuevas`}.`,
        confirmar: 'Ver misiones',
        cancelar: 'Quedarme aquí',
      });
      if (ver) router.replace('/(tabs)/habitos');
    } catch (e) {
      vibrar('penalizacion');
      setErrorAceptar(mensajeSistema(e));
    } finally {
      setAccepting(false);
    }
  };

  return {
    vista: {
      clavePropia,
      claveGuardada: keySaved,
      objetivo: goal,
      consultando: busy,
      aceptando: accepting,
      pidePro,
      propuestas: proposals,
      seleccionadas: selected,
      resumen: summary,
      errorConsulta,
      errorAceptar,
      acciones: {
        onVolver: () => volver(router),
        onObjetivo: setGoal,
        onConsultar: consult,
        onAlternar: toggle,
        onAceptar: accept,
        onAbrirClave: () => setKeyOpen(true),
        onVerPro: () => router.push('/pro'),
        // El Oráculo no guarda la respuesta en el servidor: viaja el texto.
        onDenunciar: () =>
          setDenuncia({
            fuente: 'oraculo',
            messageId: null,
            texto: [summary, ...proposals.map((p) => p.title)].join(' · '),
          }),
      },
    },
    hojaClave: {
      visible: clavePropia && keyOpen,
      clave: apiKey,
      guardada: keySaved,
      onClave: setKey,
      onGuardar: saveKey,
      onCerrar: () => setKeyOpen(false),
    },
    hojaConsentimiento: consentimiento.hoja,
    denuncia: { respuesta: denuncia, onClose: () => setDenuncia(null) },
  };
}
