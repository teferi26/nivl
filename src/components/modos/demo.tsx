// Demo de la galería /kit/pantallas (solo desarrollo): Modos F1 con datos de
// mentira. Todo lo que aquí se ve solo existe con `modos_activos` encendido;
// con él apagado, Hoy, Hábitos, el onboarding y Perfil son los de siempre.
import { useMemo, useState } from 'react';
import { HOY_DEMO, misionDemo, perfilDemo, YO_DEMO } from '@/components/arena/demoDatos';
import type { DemoPantalla } from '@/components/arena/galeria';
import { derivarHoy, type EntradaHoy } from '@/components/hoy/derivarHoy';
import { HoyVista } from '@/components/hoy/HoyVista';
import { SelectorIdioma } from '@/components/idioma/SelectorIdioma';
import { TituloPaso } from '@/components/onboarding/TituloPaso';
import { QuestForm } from '@/components/QuestForm';
import { Screen } from '@/components/ui';
import { t } from '@/i18n';
import type { Completion, Quest } from '@/lib/types';
import { nivelesDeModos } from '@/modos/niveles';
import { modosDisponibles, type ModoEtiqueta, type ModoId } from '@/modos/tipos';
import { EleccionModos } from './EleccionModos';
import { HojaModos } from './NivelesModo';
import { NivelesModoVista } from './NivelesModoVista';
import { SelectorModo } from './SelectorModo';

const nada = () => {};
const ACTIVADOS: ModoEtiqueta[] = ['iron', 'focus', 'founder'];

const hecha = (q: Quest, xp: number): Completion => ({
  id: `c-${q.id}`,
  user_id: 'demo-usuario',
  quest_id: q.id,
  date: HOY_DEMO,
  completed_at: `${HOY_DEMO}T08:30:00Z`,
  xp_awarded: xp,
  evidence_url: null,
});

const pierna = misionDemo({ title: 'Entreno de pierna', stat: 'FUE', difficulty: 'dificil', link: 'gym', modes: ['iron'] });
const proteina = misionDemo({ title: 'Llegar a 140 g de proteína', stat: 'VIT', modes: ['iron'] });
const tema4 = misionDemo({ title: 'Estudiar Tema 4', stat: 'INT', modes: ['focus'] });
const llamadas = misionDemo({ title: 'Tres llamadas de venta', stat: 'AGI', modes: ['work', 'founder'] });
const leer = misionDemo({ title: 'Leer 20 páginas', stat: 'INT' });
const TODAS = [pierna, proteina, tema4, llamadas, leer];

const entrada = (p: Partial<EntradaHoy> = {}): EntradaHoy => ({
  hoy: HOY_DEMO,
  hora: 16,
  profile: perfilDemo(),
  rango: YO_DEMO.rango,
  tituloEquipado: null,
  quests: TODAS,
  completions: { [pierna.id]: hecha(pierna, 100), [llamadas.id]: hecha(llamadas, 50) },
  dayResult: null,
  plan: null,
  esPro: false,
  board: null,
  rotosPrevios: 0,
  diaPerfecto: false,
  avisoRecuperacion: false,
  ...p,
});

/** Hoy con el selector: cambiar de modo filtra la lista en local. */
function HoyModos({ inicial, base = entrada() }: { inicial: ModoId; base?: EntradaHoy }) {
  const [modo, setModo] = useState<ModoId>(inicial);
  const datos = useMemo(() => derivarHoy({ ...base, modo }), [base, modo]);
  return (
    <HoyVista
      estado="listo"
      error={null}
      datos={datos}
      ocupada={null}
      preparandoTarjeta={false}
      refrescando={false}
      desde={{ nivel: 0, xpRatio: 0, racha: 0 }}
      selectorModo={<SelectorModo modo={modo} disponibles={modosDisponibles(ACTIVADOS)} alCambiar={setModo} />}
      acciones={{ onCompletar: nada, onAlternarBloque: nada, onCompartirDia: nada, onRefrescar: nada, onReintentar: nada }}
    />
  );
}

function PasoModos() {
  const [valor, setValor] = useState<ModoEtiqueta[]>(['iron']);
  return (
    <Screen>
      <TituloPaso
        inscripcion={t('modos:onboarding.inscripcion')}
        titulo={t('modos:onboarding.titulo')}
        pista={t('modos:onboarding.pista')}
      />
      <EleccionModos valor={valor} alCambiar={setValor} />
    </Screen>
  );
}

function PasoIdioma() {
  const [valor, setValor] = useState('es');
  return (
    <Screen>
      <TituloPaso
        inscripcion={t('onboarding:idioma.inscripcion')}
        titulo={t('onboarding:idioma.titulo')}
        pista={t('onboarding:idioma.pista')}
      />
      <SelectorIdioma valor={valor} alCambiar={setValor} />
    </Screen>
  );
}

const XP = { iron: 2_340, focus: 610, work: 0, founder: 150 };

function PerfilModos({ cargando = false }: { cargando?: boolean }) {
  return (
    <Screen>
      <NivelesModoVista
        cargando={cargando}
        nivelGlobal={23}
        niveles={nivelesDeModos(ACTIVADOS, XP)}
        onElegir={nada}
      />
    </Screen>
  );
}

export const DEMO: DemoPantalla = {
  id: 'modos',
  titulo: 'Modos',
  estados: [
    { id: 'hoy-iron', titulo: 'Hoy · IRON', render: () => <HoyModos inicial="iron" /> },
    { id: 'hoy-general', titulo: 'Hoy · NIVL', render: () => <HoyModos inicial="general" /> },
    { id: 'hoy-founder', titulo: 'Hoy · dos modos', render: () => <HoyModos inicial="founder" /> },
    {
      id: 'hoy-vacio',
      titulo: 'Hoy · modo sin misiones',
      render: () => <HoyModos inicial="focus" base={entrada({ quests: [pierna, leer], completions: {} })} />,
    },
    {
      id: 'formulario',
      titulo: 'Formulario de misión',
      render: () => (
        <QuestForm
          visible
          onClose={nada}
          onSubmit={async () => {}}
          // i18n-ok: valor de la prop
          sustantivo="hábito"
          modos={{ opciones: ACTIVADOS, porDefecto: ['iron'] }}
        />
      ),
    },
    {
      id: 'formulario-editar',
      titulo: 'Editar misión con dos modos',
      render: () => (
        <QuestForm
          visible
          initial={llamadas}
          onClose={nada}
          onSubmit={async () => {}}
          onDelete={async () => {}}
          modos={{ opciones: ACTIVADOS, porDefecto: [] }}
        />
      ),
    },
    { id: 'onboarding', titulo: 'Onboarding · modos', render: () => <PasoModos /> },
    { id: 'idioma', titulo: 'Onboarding · idioma', render: () => <PasoIdioma /> },
    { id: 'perfil', titulo: 'Perfil · niveles', render: () => <PerfilModos /> },
    { id: 'perfil-cargando', titulo: 'Perfil · cargando', render: () => <PerfilModos cargando /> },
    {
      id: 'hoja',
      titulo: 'Perfil · elegir modos',
      render: () => <HojaModos abierta cerrar={nada} activados={ACTIVADOS} guardar={async () => {}} />,
    },
  ],
};
