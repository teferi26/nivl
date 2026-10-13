// NIVL · Contrato: datos, efectos y cerrojos (patrón L-RADICAL §C, FASE3 G1).
// Cortado y pegado de la ruta: la carga, la plantilla del cuaderno, firmar,
// confesar, editar y eliminar normas, canjear PB y la carta sellada. Cómo se guardan
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
//   · Editar una norma (editarRegla) reutiliza la hoja de la norma nueva en
//     modo edición. La regla vieja se archiva y vuelve una nueva con otro id:
//     se sustituye en la lista por la devuelta, sin recargar, y su id queda en
//     `editadas` (solo esta sesión) para decir debajo que se ha editado hoy.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { avisar, confirmar } from '@/components/ui/confirmar';
import { volver } from '@/components/ui/Screen';
import { vibrar } from '@/design/haptics';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import {
  breakRule,
  createRule,
  deleteRule,
  editarRegla,
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
// a su vida actual (carrera terminada). Los textos, en contrato:hook.plantilla.
const PLANTILLA = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const;

function normasDePlantilla(): { text: string; consequence: string }[] {
  return PLANTILLA.map((p) => ({
    text: t(`contrato:hook.plantilla.${p}.texto`),
    consequence: t(`contrato:hook.plantilla.${p}.consecuencia`),
  }));
}

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
  // La norma que se edita en la hoja (null: la hoja firma una nueva).
  const [editando, setEditando] = useState<Rule | null>(null);
  const [editadas, setEditadas] = useState<ReadonlySet<string>>(new Set());
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
      const normas = normasDePlantilla();
      for (let i = 0; i < normas.length; i++) {
        const n = normas[i]!;
        await createRule(userId, { text: n.text, consequence: n.consequence, position: i });
      }
      await load();
    } catch (e) {
      vibrar('penalizacion');
      avisar(t('comun:sistemaNoResponde'), mensajeSistema(e));
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

  const abrirEdicion = (rule: Rule) => {
    if (lock.current || !profile) return;
    setEditando(rule);
    setRuleText(rule.text);
    setRuleConsequence(rule.consequence);
    setErrorNorma(null);
    setRuleFormOpen(true);
  };

  const guardarEdicion = async () => {
    const vieja = editando;
    if (!vieja || !profile || lock.current) return;
    lock.current = true;
    setFirmando(true);
    setErrorNorma(null);
    try {
      const nueva = await editarRegla(profile, vieja, { text: ruleText, consequence: ruleConsequence });
      if (nueva !== vieja) {
        setRules((rs) => rs.map((r) => (r.id === vieja.id ? nueva : r)));
        setEditadas((s) => new Set(s).add(nueva.id));
      }
      setRuleFormOpen(false);
      setEditando(null);
      setRuleText('');
      setRuleConsequence('');
    } catch (e) {
      vibrar('penalizacion');
      // ErrorVisible (días sin cerrar, campos vacíos) pasa tal cual.
      setErrorNorma(mensajeSistema(e));
    } finally {
      lock.current = false;
      setFirmando(false);
    }
  };

  const onBreakRule = async (rule: Rule) => {
    if (lock.current) return;
    const ok = await confirmar({
      titulo: t('contrato:hook.confesionTitulo'),
      mensaje: t('contrato:hook.confesionMensaje', { norma: rule.text, xp: RULE_BREAK_XP, consecuencia: rule.consequence }),
      confirmar: t('contrato:hook.laHeRoto'),
      destructivo: true,
    });
    if (!ok || !profile || lock.current) return;
    lock.current = true;
    try {
      const res = await breakRule(profile, rule);
      setProfile(res.profile);
      vibrar('penalizacion');
      avisar(t('contrato:hook.registrado'), t('contrato:hook.registradoMensaje', { consecuencia: rule.consequence }));
      await load();
    } catch (e) {
      vibrar('penalizacion');
      avisar(t('comun:sistemaNoResponde'), mensajeSistema(e));
    } finally {
      lock.current = false;
    }
  };

  const onDeleteRule = async (rule: Rule) => {
    const ok = await confirmar({
      titulo: t('contrato:hook.eliminarTitulo'),
      mensaje: t('contrato:hook.eliminarMensaje', { norma: rule.text }),
      confirmar: t('comun:eliminar'),
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
      avisar(t('comun:sistemaNoResponde'), mensajeSistema(e));
    }
  };

  const onRedeem = async () => {
    if (!profile) return;
    if (profile.bonus_points < REDEEM_COST) {
      avisar(t('contrato:hook.insuficientesTitulo'), t('contrato:hook.insuficientes', { coste: REDEEM_COST }));
      return;
    }
    if (spentWeek + REDEEM_COST > REDEEM_WEEKLY_CAP) {
      avisar(t('contrato:hook.topeTitulo'), t('contrato:hook.tope', { tope: REDEEM_WEEKLY_CAP, llevas: spentWeek }));
      return;
    }
    const ok = await confirmar({
      titulo: t('contrato:hook.canjearTitulo'),
      mensaje: t('contrato:hook.canjearMensaje', { coste: REDEEM_COST }),
      confirmar: t('contrato:hook.canjear'),
    });
    if (!ok || lock.current) return;
    lock.current = true;
    try {
      const newTotal = await redeemBonus(REDEEM_COST, t('contrato:hook.motivoCanje'));
      setProfile((p) => (p ? { ...p, bonus_points: newTotal } : p));
      setSpentWeek((s) => s + REDEEM_COST);
      vibrar('mision');
      avisar(t('contrato:hook.descansoTitulo'), t('contrato:hook.descansoMensaje'));
    } catch (e) {
      vibrar('penalizacion');
      avisar(t('comun:sistemaNoResponde'), mensajeSistema(e));
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
      avisar(t('comun:sistemaNoResponde'), mensajeSistema(e));
    } finally {
      lock.current = false;
    }
  };

  const cerrarNorma = () => {
    setRuleFormOpen(false);
    setErrorNorma(null);
    // Lo escrito para editar no se queda en la hoja de la norma nueva.
    if (editando) {
      setEditando(null);
      setRuleText('');
      setRuleConsequence('');
    }
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
      editadas,
      bonus: profile?.bonus_points ?? 0,
      gastadoSemana: spentWeek,
      carta: letter,
      sembrando: busy,
      acciones: {
        onVolver: () => volver(router),
        onNuevaNorma: () => setRuleFormOpen(true),
        onRomper: onBreakRule,
        onEliminar: onDeleteRule,
        onEditar: abrirEdicion,
        onCanjear: onRedeem,
        onCargarPlantilla: seedTemplate,
        onEscribirCarta: () => setLetterFormOpen(true),
        onAbrirCarta: onOpenLetter,
        onReintentar: load,
      },
    },
    hojaNorma: {
      visible: ruleFormOpen,
      modo: editando ? 'editar' : 'nueva',
      original: editando ? { texto: editando.text, consecuencia: editando.consequence } : null,
      texto: ruleText,
      consecuencia: ruleConsequence,
      guardando: firmando,
      error: errorNorma,
      onTexto: setRuleText,
      onConsecuencia: setRuleConsequence,
      onGuardar: editando ? guardarEdicion : addRule,
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
