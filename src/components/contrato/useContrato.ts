// NIVL · Contrato: datos, efectos y cerrojos (patrón L-RADICAL §C, FASE3 G1).
// Cortado y pegado de la ruta: la carga, la plantilla del cuaderno, firmar,
// confesar y eliminar normas, canjear PB y la carta sellada. Cómo se guardan
// y cobran las normas es de src/lib/contract.ts y aquí solo se consume.
//
// Cambios de presentación respecto a la ruta vieja:
//   · La carga ya no avisa con un diálogo: deja `errorCarga` para la vista
//     (ErrorSistema con «Reintentar») y un `cargado` para pintar huecos.
//   · Los fallos de las dos hojas van en línea dentro de la hoja (nada de
//     avisos encima de una hoja abierta), y la carta sellada ya no abre un
//     aviso mientras su hoja se cierra: la tarjeta «Sellada» lo dice.
//   · Vibraciones según la tabla de FASE3: `destructiva` tras borrar,
//     `penalizacion` en el catch de cada acción del usuario.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { volver } from '@/components/ui/Screen';
import { vibrar } from '@/design/haptics';
import { useAuth } from '@/lib/auth';
import {
  breakRule,
  createRule,
  deleteRule,
  fetchLetter,
  fetchRedemptionsThisWeek,
  fetchRules,
  openLetter,
  redeemBonus,
  sealLetter,
} from '@/lib/contract';
import { ensureProfile } from '@/lib/data';
import { addDays, dateKey } from '@/lib/dates';
import { REDEEM_COST, REDEEM_WEEKLY_CAP, RULE_BREAK_XP } from '@/lib/game';
import type { Letter, Profile, Rule } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';
import type { ContratoVistaProps } from './ContratoVista';
import { OPCIONES_APERTURA, type HojaCartaProps, type HojaNormaProps } from './HojasContrato';

// Plantilla basada en el cuaderno "CAMINO AL ÉXITO" del usuario, adaptada
// a su vida actual (carrera terminada).
const TEMPLATE_RULES: { text: string; consequence: string }[] = [
  { text: 'Escribir el diario todos los días: lo vivido y el plan del día', consequence: 'Correr 8 km' },
  { text: 'Nada de alcohol', consequence: '1 día comiendo solo limpio' },
  { text: 'Nada de cafeína', consequence: '1 día sin pantallas de ocio' },
  { text: 'Comer limpio a diario', consequence: 'Correr 4,5 km' },
  { text: 'Si salgo de fiesta sin haberlo ganado', consequence: '1 semana de dieta estricta' },
  { text: 'Ningún plan se interpone a mis objetivos', consequence: 'Reorganizar la semana y compensar el tiempo' },
];

export interface UsoContrato {
  vista: ContratoVistaProps;
  hojaNorma: HojaNormaProps;
  hojaCarta: HojaCartaProps;
}

export function useContrato(): UsoContrato {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [spentWeek, setSpentWeek] = useState(0);
  const [letter, setLetter] = useState<Letter | null>(null);
  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [ruleText, setRuleText] = useState('');
  const [ruleConsequence, setRuleConsequence] = useState('');
  const [firmando, setFirmando] = useState(false);
  const [errorNorma, setErrorNorma] = useState<string | null>(null);
  const [letterFormOpen, setLetterFormOpen] = useState(false);
  const [letterBody, setLetterBody] = useState('');
  const [letterYears, setLetterYears] = useState(OPCIONES_APERTURA[2]!);
  const [errorCarta, setErrorCarta] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const today = dateKey();

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [prof, rs, reds, lt] = await Promise.all([
        ensureProfile(userId),
        fetchRules(),
        fetchRedemptionsThisWeek(),
        fetchLetter(),
      ]);
      setProfile(prof);
      setRules(rs);
      setSpentWeek(reds.reduce((s, r) => s + r.amount, 0));
      setLetter(lt);
      setErrorCarga(null);
    } catch (e) {
      setErrorCarga(mensajeSistema(e));
    } finally {
      setCargado(true);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const seedTemplate = async () => {
    if (!userId || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      for (let i = 0; i < TEMPLATE_RULES.length; i++) {
        const t = TEMPLATE_RULES[i]!;
        await createRule(userId, { text: t.text, consequence: t.consequence, position: i });
      }
      await load();
    } catch (e) {
      vibrar('penalizacion');
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const addRule = async () => {
    if (!userId || !ruleText.trim() || !ruleConsequence.trim() || lock.current) return;
    lock.current = true;
    setFirmando(true);
    setErrorNorma(null);
    try {
      await createRule(userId, {
        text: ruleText.trim(),
        consequence: ruleConsequence.trim(),
        position: rules.reduce((m, r) => Math.max(m, r.position), -1) + 1,
      });
      setRuleText('');
      setRuleConsequence('');
      setRuleFormOpen(false);
      await load();
    } catch (e) {
      vibrar('penalizacion');
      setErrorNorma(mensajeSistema(e));
    } finally {
      lock.current = false;
      setFirmando(false);
    }
  };

  const onBreakRule = async (rule: Rule) => {
    if (lock.current) return;
    const ok = await confirmar({
      titulo: 'Confesión al sistema',
      mensaje: `¿Has roto la norma "${rule.text}"?\n\nPenalización: −${RULE_BREAK_XP} XP y la consecuencia que tú mismo firmaste: ${rule.consequence}. Cúmplela hoy y recuperas el XP.`,
      confirmar: 'La he roto',
      destructivo: true,
    });
    if (!ok || !profile || lock.current) return;
    lock.current = true;
    try {
      const res = await breakRule(profile, rule);
      setProfile(res.profile);
      vibrar('penalizacion');
      avisar(
        'REGISTRADO',
        `El sistema no juzga: registra. La misión "Consecuencia: ${rule.consequence}" te espera hoy en Sistema.`,
      );
      await load();
    } catch (e) {
      vibrar('penalizacion');
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      lock.current = false;
    }
  };

  const onDeleteRule = async (rule: Rule) => {
    const ok = await confirmar({
      titulo: 'Eliminar norma',
      mensaje: `"${rule.text}" y su historial de incumplimientos.`,
      confirmar: 'Eliminar',
      destructivo: true,
    });
    if (!ok) return;
    try {
      await deleteRule(rule.id);
      // La háptica de borrado, solo si se ha borrado de verdad.
      vibrar('destructiva');
      await load();
    } catch (e) {
      vibrar('penalizacion');
      avisar('Error del sistema', mensajeSistema(e));
    }
  };

  const onRedeem = async () => {
    if (!profile) return;
    if (profile.bonus_points < REDEEM_COST) {
      avisar('Puntos insuficientes', `Necesitas ${REDEEM_COST} PB para canjear 1 h de descanso.`);
      return;
    }
    if (spentWeek + REDEEM_COST > REDEEM_WEEKLY_CAP) {
      avisar('Tope semanal', `Máximo ${REDEEM_WEEKLY_CAP} PB canjeados cada 7 días. Llevas ${spentWeek}.`);
      return;
    }
    const ok = await confirmar({
      titulo: 'Canjear descanso',
      mensaje: `${REDEEM_COST} PB → 1 hora de descanso ganado. ¿Confirmas?`,
      confirmar: 'Canjear',
    });
    if (!ok || lock.current) return;
    lock.current = true;
    try {
      const newTotal = await redeemBonus(REDEEM_COST, '1 h de descanso');
      setProfile((p) => (p ? { ...p, bonus_points: newTotal } : p));
      setSpentWeek((s) => s + REDEEM_COST);
      vibrar('mision');
      avisar('DESCANSO GANADO', 'Disfrútalo sin culpa: lo has pagado con esfuerzo.');
    } catch (e) {
      vibrar('penalizacion');
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      lock.current = false;
    }
  };

  const onSealLetter = async () => {
    if (!userId || !letterBody.trim() || lock.current) return;
    lock.current = true;
    setBusy(true);
    setErrorCarta(null);
    try {
      const openAt = addDays(today, letterYears.days);
      await sealLetter(userId, letterBody.trim(), openAt);
      setLetterFormOpen(false);
      setLetterBody('');
      vibrar('mision');
      await load();
    } catch (e) {
      vibrar('penalizacion');
      setErrorCarta(mensajeSistema(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const onOpenLetter = async () => {
    if (!letter || lock.current) return;
    lock.current = true;
    try {
      const opened = await openLetter(letter);
      setLetter(opened);
      vibrar('mision');
    } catch (e) {
      vibrar('penalizacion');
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      lock.current = false;
    }
  };

  const cerrarNorma = () => {
    setRuleFormOpen(false);
    setErrorNorma(null);
  };
  const cerrarCarta = () => {
    setLetterFormOpen(false);
    setErrorCarta(null);
  };

  return {
    vista: {
      cargado,
      errorCarga,
      hoy: today,
      conPerfil: !!profile,
      reglas: rules.filter((r) => r.active),
      bonus: profile?.bonus_points ?? 0,
      gastadoSemana: spentWeek,
      carta: letter,
      sembrando: busy,
      acciones: {
        onVolver: () => volver(router),
        onNuevaNorma: () => setRuleFormOpen(true),
        onRomper: onBreakRule,
        onEliminar: onDeleteRule,
        onCanjear: onRedeem,
        onCargarPlantilla: seedTemplate,
        onEscribirCarta: () => setLetterFormOpen(true),
        onAbrirCarta: onOpenLetter,
        onReintentar: load,
      },
    },
    hojaNorma: {
      visible: ruleFormOpen,
      texto: ruleText,
      consecuencia: ruleConsequence,
      guardando: firmando,
      error: errorNorma,
      onTexto: setRuleText,
      onConsecuencia: setRuleConsequence,
      onGuardar: addRule,
      onCerrar: cerrarNorma,
    },
    hojaCarta: {
      visible: letterFormOpen,
      hoy: today,
      cuerpo: letterBody,
      opcion: letterYears,
      sellando: busy,
      error: errorCarta,
      onCuerpo: setLetterBody,
      onOpcion: setLetterYears,
      onSellar: onSealLetter,
      onCerrar: cerrarCarta,
    },
  };
}
