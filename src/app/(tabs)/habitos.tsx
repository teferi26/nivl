import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { QuestForm } from '@/components/QuestForm';
import { XPBar } from '@/components/XPBar';
import {
  avisar,
  Button,
  Card,
  Check,
  EmptyState,
  FadeIn,
  PressScale,
  Row,
  RowValue,
  Screen,
  ScreenHeader,
  Section,
  Skeleton,
  SkeletonRows,
  Stagger,
  Stat,
  StatRow,
  useAlVolver,
} from '@/components/ui';
import { SIN_DATO } from '@/components/ui/sinDato';
import { confirmar } from '@/components/ui/confirmar';
import { vibrar } from '@/design/haptics';
import { sincronizarRango } from '@/lib/achievements';
import { useAuth } from '@/lib/auth';
import { createQuest, deleteQuest, ensureProfile, updateQuest } from '@/lib/data';
import { dateKey } from '@/lib/dates';
import { awardXp } from '@/lib/engine';
import { desmarcarRegla, fetchRuleChecks, fetchRules, marcarReglaCumplida } from '@/lib/contract';
import { HABIT_ACQUIRED_XP, RULE_BREAK_XP } from '@/lib/game';
import {
  consolidarHabito,
  fetchHabitos,
  fetchFechasPorHabito,
  reactivarHabito,
} from '@/lib/habitdata';
import { HABIT_TARGET_DAYS, ordenarPorCercania, progresoHabito, type ProgresoHabito } from '@/lib/habits';
import { colors, fonts } from '@/lib/theme';
import type { Quest, Rule } from '@/lib/types';
import { mensajeSistema } from '@/lib/validation';

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Los siete días de la semana: los programados en blanco, el resto en hierro. */
function Semana({ dias }: { dias: number[] }) {
  return (
    <View style={styles.semana}>
      {DIAS.map((d, i) => {
        const on = dias.includes(i + 1);
        return (
          <View key={d} style={[styles.dia, on && styles.diaOn]}>
            <Text style={[styles.diaTexto, on && styles.diaTextoOn]}>{d}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function Habitos() {
  const { session } = useAuth();
  const userId = session?.user.id;
  // El día es estado y lo fija cada carga: si la app vuelve de segundo plano
  // tras la medianoche, las reglas y las rachas pasan a contar el día nuevo.
  const [hoy, setHoy] = useState(() => dateKey());
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const consolidando = useRef(false);

  const [enCurso, setEnCurso] = useState<Quest[]>([]);
  const [adquiridos, setAdquiridos] = useState<Quest[]>([]);
  const [progresos, setProgresos] = useState<Map<string, ProgresoHabito>>(new Map());
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Quest | null>(null);
  const [busy, setBusy] = useState(false);
  const [reglas, setReglas] = useState<Rule[]>([]);
  const [cumplidas, setCumplidas] = useState<Set<string>>(new Set());
  // Copia síncrona de `cumplidas`: alternarRegla decide con ella si la regla
  // estaba marcada, no con el `cumplidas` de la clausura del render en que se
  // tocó (que puede ser viejo si llega un `cargar` entre medias).
  const cumplidasRef = useRef<Set<string>>(new Set());
  // Reglas con una escritura en vuelo: un segundo toque sobre la misma regla
  // antes de que vuelva la red se ignora (si no, marcar y desmarcar se cruzan).
  const reglasEnVuelo = useRef<Set<string>>(new Set());
  const pendientesReglas = reglas.filter((r) => !cumplidas.has(r.id)).length;

  const cargar = useCallback(async () => {
    const dia = dateKey();
    try {
      // Las cuatro consultas son independientes: van a la vez.
      const [todos, fechas, rs, checks] = await Promise.all([
        fetchHabitos(),
        fetchFechasPorHabito(),
        fetchRules(),
        fetchRuleChecks(dia),
      ]);
      const mapa = new Map<string, ProgresoHabito>();
      for (const q of todos) mapa.set(q.id, progresoHabito(q, fechas.get(q.id) ?? new Set(), dia));
      setHoy(dia);
      setProgresos(mapa);
      setEnCurso(ordenarPorCercania(todos.filter((q) => !q.acquired_at), mapa));
      setAdquiridos(todos.filter((q) => q.acquired_at));
      setReglas(rs);
      cumplidasRef.current = checks;
      setCumplidas(checks);
      setLoadError(null);
    } catch (e) {
      setLoadError(mensajeSistema(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );
  useAlVolver(cargar);

  /**
   * Marcar una regla del contrato como cumplida hoy.
   *
   * Es optimista a propósito: son seis toques seguidos cada noche y esperar a
   * la red en cada uno haría que se sintiera rota. Si falla, se revierte.
   */
  const fijarRegla = (id: string, marcada: boolean) => {
    // Idempotente (añade o quita, no alterna) y en forma funcional: no depende
    // del estado que viera el render que lo llamó.
    const aplicar = (prev: Set<string>) => {
      if (prev.has(id) === marcada) return prev;
      const s = new Set(prev);
      if (marcada) s.add(id);
      else s.delete(id);
      return s;
    };
    cumplidasRef.current = aplicar(cumplidasRef.current);
    setCumplidas(aplicar);
  };

  const alternarRegla = async (r: Rule) => {
    if (!userId || reglasEnVuelo.current.has(r.id)) return;
    reglasEnVuelo.current.add(r.id);
    const estaba = cumplidasRef.current.has(r.id);
    fijarRegla(r.id, !estaba);
    try {
      if (estaba) await desmarcarRegla(r.id, hoy);
      else await marcarReglaCumplida(userId, r.id, hoy);
      if (!estaba) vibrar('seleccion');
    } catch (e) {
      fijarRegla(r.id, estaba);
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      reglasEnVuelo.current.delete(r.id);
    }
  };

  const consolidar = async (q: Quest, p: ProgresoHabito) => {
    const ok = await confirmar({
      titulo: 'HÁBITO ADQUIRIDO',
      mensaje: `${q.title} lleva ${p.racha} días seguidos.\n\nSi lo consolidas deja de pedirte el toque diario y deja de poder romperte la racha. Puedes seguir marcándolo cuando quieras.\n\nSi prefieres seguir contando, no pasa nada: sigue sumando.`,
      confirmar: 'Consolidar',
      cancelar: 'Seguir contando',
    });
    // Cerrojo síncrono además de `busy`: el XP del hábito adquirido se paga una vez.
    if (!ok || !userId || busy || consolidando.current) return;
    consolidando.current = true;
    setBusy(true);
    try {
      await consolidarHabito(q.id, p.racha);
      const perfil = await ensureProfile(userId);
      const res = await awardXp(perfil, HABIT_ACQUIRED_XP, q.stat, 'habit_acquired', {
        // quest_id: clave del premio de una sola vez (lista blanca del servidor).
        quest_id: q.id,
        quest: q.title,
        dias: p.racha,
      });
      // El rango se recalcula en segundo plano: no bloquea ni rompe el cobro.
      sincronizarRango().catch(() => []);
      const pagado = Math.max(0, res.profile.xp_total - perfil.xp_total);
      vibrar('rachaHito');
      await cargar();
      avisar('El sistema lo da por tuyo', `${q.title} ya no se te va a pedir.\n${pagado > 0 ? `+${pagado} XP a ${q.stat}.` : 'Ese premio ya estaba cobrado.'}`);
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    } finally {
      consolidando.current = false;
      setBusy(false);
    }
  };

  const reactivar = async (q: Quest) => {
    const ok = await confirmar({
      titulo: 'Volver a exigirlo',
      mensaje: `${q.title} vuelve a pedirse cada día y vuelve a contar para la racha.`,
      confirmar: 'Volver a exigirlo',
    });
    if (!ok) return;
    try {
      await reactivarHabito(q.id);
    } catch (e) {
      avisar('Error del sistema', mensajeSistema(e));
    }
    await cargar();
  };

  const listos = enCurso.filter((q) => progresos.get(q.id)?.consolidable).length;
  const mejorRacha = Math.max(0, ...enCurso.map((q) => progresos.get(q.id)?.racha ?? 0));

  return (
    <Screen>
      <Stagger>
        <FadeIn index={0}>
          <ScreenHeader
            eyebrow="Constancia"
            title="Hábitos"
            subtitle={`A los ${HABIT_TARGET_DAYS} días seguidos un hábito es tuyo. Cada uno cuenta su propia racha.`}
            // Sólida solo si hay hábitos en forja: sin ellos, la acción
            // principal (la única inversión) es la del estado vacío.
            action={{ icon: 'add', label: 'Nuevo hábito', onPress: () => setFormOpen(true), solid: enCurso.length > 0 }}
          />
        </FadeIn>

        {!loaded ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Cargando tus hábitos">
            <Skeleton height={76} style={styles.skCard} />
            <Skeleton height={11} width={110} style={styles.skEyebrow} />
            <Skeleton height={112} style={styles.skCard} />
            <SkeletonRows rows={2} />
          </View>
        ) : null}

        {loaded && loadError ? (
          <Card variant="outline">
            <EmptyState
              compact
              icon="cloud-offline-outline"
              title="El sistema no responde"
              body={loadError}
              action={{ label: 'Reintentar', onPress: cargar }}
            />
          </Card>
        ) : null}

        {loaded && !loadError ? (
          <FadeIn index={1}>
            <Card>
              <StatRow>
                <Stat value={enCurso.length} label="En forja" />
                <Stat value={mejorRacha} label="Mejor racha" unit="d" tone={mejorRacha >= HABIT_TARGET_DAYS ? 'accent' : 'text'} />
                <Stat value={listos} label="Listos" tone={listos > 0 ? 'accent' : 'text'} />
                <Stat value={adquiridos.length} label="Adquiridos" />
              </StatRow>
            </Card>
          </FadeIn>
        ) : null}

        {loaded && reglas.length > 0 ? (
          <FadeIn index={2}>
            <Section
              title="Reglas del contrato · hoy"
              tone={pendientesReglas > 0 ? 'alerta' : undefined}
              meta={`${reglas.length - pendientesReglas}/${reglas.length}`}
            >
              <Card padded={false} style={styles.lista}>
                {reglas.map((r, i) => {
                  const ok = cumplidas.has(r.id);
                  return (
                    <Row
                      key={r.id}
                      first={i === 0}
                      leading={<Check checked={ok} size={24} />}
                      title={r.text}
                      done={ok}
                      detail={!ok ? `Si no: ${r.consequence}` : undefined}
                      onPress={() => alternarRegla(r)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: ok }}
                    />
                  );
                })}
              </Card>
              <Text style={styles.nota}>
                {pendientesReglas === 0
                  ? 'Las has cumplido todas hoy. El sistema toma nota.'
                  : `Lo que quede sin marcar al cierre cuenta como roto: ${RULE_BREAK_XP} XP por regla y su consecuencia mañana.`}
              </Text>
            </Section>
          </FadeIn>
        ) : null}

        {loaded ? (
          <FadeIn index={3}>
            <Section title="En forja" meta={enCurso.length > 0 ? `${enCurso.length}` : undefined}>
              {enCurso.length === 0 && adquiridos.length === 0 && !loadError ? (
                <Card variant="outline">
                  <EmptyState
                    icon="repeat-outline"
                    title="Ningún hábito en forja"
                    body="Lectura, correr, las llamadas en frío, dormir a tu hora. Lo que quieras que un día te salga solo."
                    action={{ label: 'Añadir el primero', onPress: () => setFormOpen(true), variant: 'solid' }}
                  />
                </Card>
              ) : null}

              {enCurso.map((q, i) => {
                const p = progresos.get(q.id);
                if (!p) return null;
                const editar = () => {
                  setEditando(q);
                  setFormOpen(true);
                };
                const cuerpo = (
                  <>
                    <View style={styles.fila}>
                      <Text style={styles.nombre} numberOfLines={1}>
                        {q.title}
                      </Text>
                      <Text style={[styles.racha, p.consolidable && styles.rachaListo]}>
                        {p.racha}
                        <Text style={styles.rachaObjetivo}> / {p.objetivo}</Text>
                      </Text>
                    </View>
                    <View style={{ marginTop: 10 }}>
                      <XPBar ratio={Math.min(1, p.racha / p.objetivo)} height={8} segments={p.objetivo} />
                    </View>
                    <View style={styles.metaFila}>
                      <Semana dias={q.days_of_week} />
                      <Text style={[styles.meta, p.consolidable && styles.metaListo]}>
                        {p.consolidable
                          ? 'Listo para consolidar'
                          : p.restantes === 1
                            ? 'Falta 1 día'
                            : `Faltan ${p.restantes} días`}
                      </Text>
                    </View>
                  </>
                );
                return (
                  <FadeIn key={q.id} index={i}>
                    {p.consolidable ? (
                      // La tarjeta no es pulsable entera: un botón dentro de otro
                      // botón desaparece para VoiceOver. Lo que edita es el cuerpo;
                      // «Darlo por adquirido» queda como botón propio al lado.
                      <Card variant="logro">
                        <PressScale onPress={editar} accessibilityRole="button" accessibilityLabel={`Editar ${q.title}`}>
                          {cuerpo}
                        </PressScale>
                        <Button
                          title="Darlo por adquirido"
                          variant="secondary"
                          onPress={() => consolidar(q, p)}
                          loading={busy}
                          icon="ribbon-outline"
                          style={{ marginTop: 14 }}
                        />
                      </Card>
                    ) : (
                      <Card onPress={editar} accessibilityLabel={`Editar ${q.title}`}>
                        {cuerpo}
                      </Card>
                    )}
                  </FadeIn>
                );
              })}
            </Section>
          </FadeIn>
        ) : null}

        {loaded && adquiridos.length > 0 ? (
          <FadeIn index={4}>
            <Section title="Adquiridos" meta={`${adquiridos.length}`}>
              <Card padded={false} style={styles.lista}>
                {adquiridos.map((q, i) => (
                  <Row
                    key={q.id}
                    first={i === 0}
                    leading={<Ionicons name="ribbon" size={18} color={colors.text} />}
                    title={q.title}
                    muted
                    detail="Ya no se te pide. Mantén pulsado para volver a exigirlo."
                    trailing={<RowValue tone="accent">{q.acquired_streak == null ? SIN_DATO : `${q.acquired_streak} d`}</RowValue>}
                    onLongPress={() => reactivar(q)}
                    accessibilityLabel={`${q.title}, adquirido. Mantén pulsado para volver a exigirlo.`}
                  />
                ))}
              </Card>
            </Section>
          </FadeIn>
        ) : null}
      </Stagger>

      <QuestForm
        sustantivo="hábito"
        visible={formOpen}
        initial={editando}
        onClose={() => {
          setFormOpen(false);
          setEditando(null);
        }}
        onSubmit={async (input) => {
          if (editando) await updateQuest(editando.id, input);
          else if (userId) await createQuest(userId, input);
          setFormOpen(false);
          setEditando(null);
          await cargar();
        }}
        onDelete={async (q) => {
          await deleteQuest(q.id);
          setFormOpen(false);
          setEditando(null);
          await cargar();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: 16, paddingVertical: 2 },
  nota: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 2 },
  fila: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  nombre: { fontFamily: fonts.heading, fontSize: 17, letterSpacing: -0.2, color: colors.text, flex: 1, minWidth: 0 },
  racha: { fontFamily: fonts.number, fontSize: 18, color: colors.text },
  rachaListo: { color: colors.accent },
  rachaObjetivo: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  metaFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 10 },
  semana: { flexDirection: 'row', gap: 4 },
  dia: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  diaOn: { backgroundColor: colors.accentFaint, borderColor: colors.accentDim },
  diaTexto: { fontFamily: fonts.heading, fontSize: 11, color: colors.textFaint },
  diaTextoOn: { color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, flexShrink: 1, textAlign: 'right' },
  metaListo: { color: colors.accent, fontFamily: fonts.semibold },
  skEyebrow: { marginBottom: 12, marginTop: 16 },
  skCard: { marginBottom: 10 },
});
