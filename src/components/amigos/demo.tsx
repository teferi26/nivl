// Demo de la galería /kit/pantallas (solo desarrollo). Lo rellena el encargo
// de esta pantalla del rediseño L-RADICAL (docs/design-v2/L-RADICAL.md §C).
//
// AmigosVista con datos de mentira: sin sesión ni Supabase. Las acciones no
// hacen nada y <Competicion> (el slot) va a null. Estados: lleno (con podio),
// dos-rivales (solo la línea), vacio (la arena sin nadie) y cargando.
import { router } from 'expo-router';
import { YO_DEMO } from '@/components/arena/demoDatos';
import type { DemoPantalla } from '@/components/arena/galeria';
import type { Rank } from '@/design/tokens';
import { conInsignias, SIN_LUDUS } from '@/lib/elite';
import type { BoardEntry, FriendRequest } from '@/lib/social';
import { clasificar, type Metrica } from '@/lib/socialmath';
import { AmigosVista, type AmigosVistaProps } from './AmigosVista';
import type { FilaRanking } from './ListaRanking';

const nada = () => {};
const nadaAsync = async () => {};

let siguiente = 0;

/** Un gladiador del marcador. Solo el nombre es obligatorio. */
function gladiador(p: Partial<BoardEntry> & { name: string }): BoardEntry {
  siguiente += 1;
  return {
    userId: `demo-amigo-${siguiente}`,
    isMe: false,
    xpWindow: 0,
    compliancePct: null,
    completed: 0,
    streakDays: 0,
    xpTotal: 4000,
    friendshipId: `demo-amistad-${siguiente}`,
    visible: true,
    avatarPath: null,
    equippedTitle: null,
    profileKind: 'general',
    daysActive: 5,
    scheduled: 20,
    windowDays: 7,
    ...p,
  };
}

/** «Yo» (YO_DEMO): nivel 23, rango A, racha 12, como en Hoy y Perfil. */
const YO = gladiador({
  userId: YO_DEMO.id,
  name: YO_DEMO.nombre,
  isMe: true,
  friendshipId: null,
  xpWindow: 1840,
  compliancePct: 86,
  completed: 31,
  streakDays: YO_DEMO.racha,
  xpTotal: YO_DEMO.xpTotal,
  daysActive: 7,
});

// El nivel de cada uno (levelFromXp) casa con su rango de RANGOS (rangoDeNivel):
// Lucía 31 (S), Marcos 24 (A), Irene 17 (B), Dani 11 (C), Sara 6 (D), Álvaro 4
// y Nerea 3 (E, sin corona). El orden de la semana no sigue al del total.
const RIVALES: BoardEntry[] = [
  gladiador({ name: 'Lucía', xpWindow: 2410, compliancePct: 94, completed: 34, streakDays: 41, xpTotal: 207400 }),
  gladiador({ name: 'Marcos', xpWindow: 2020, compliancePct: 88, completed: 30, streakDays: 9, xpTotal: 112600 }),
  gladiador({ name: 'Irene', xpWindow: 1505, compliancePct: 80, completed: 26, streakDays: 22, xpTotal: 47900 }),
  gladiador({ name: 'Dani', xpWindow: 1120, compliancePct: 71, completed: 22, streakDays: 4, xpTotal: 14800 }),
  gladiador({ name: 'Sara', xpWindow: 860, compliancePct: 62, completed: 18, streakDays: 0, xpTotal: 3100 }),
  gladiador({ name: 'Álvaro', xpWindow: 410, compliancePct: 40, completed: 9, streakDays: 2, xpTotal: 1200 }),
  gladiador({ name: 'Nerea', xpWindow: 0, compliancePct: null, completed: 0, streakDays: 0, xpTotal: 900 }),
];

const OCULTO = gladiador({ name: 'Pablo', visible: false });

const RANGOS: ReadonlyMap<string, Rank> = new Map<string, Rank>([
  [RIVALES[0].userId, 'S'],
  [RIVALES[1].userId, 'A'],
  [RIVALES[2].userId, 'B'],
  [RIVALES[3].userId, 'C'],
  [RIVALES[4].userId, 'D'],
]);

/** Lucía lleva la insignia Élite y un título equipado, para ver los adornos. */
function filas(board: readonly BoardEntry[], metrica: Metrica): FilaRanking[] {
  return conInsignias(clasificar(board, metrica), new Set([RIVALES[0].userId])).map((f) => ({
    ...f,
    titulo: f.competidor.userId === RIVALES[0].userId ? 'Leyenda' : null,
  }));
}

const SOLICITUD: FriendRequest = {
  friendshipId: 'demo-solicitud-1',
  userId: 'demo-solicitante',
  direction: 'incoming',
  name: 'Hugo',
  level: 8,
  createdAt: '2026-10-01T18:00:00Z',
};

function base(board: readonly BoardEntry[], cambios: Partial<AmigosVistaProps> = {}): AmigosVistaProps {
  const visibles = board.filter((b) => b.visible);
  const numAmigos = board.filter((b) => !b.isMe).length;
  return {
    refrescando: false,
    refrescar: nadaAsync,
    onVolver: () => router.back(),
    abrirTarjeta: nadaAsync,
    preparando: false,
    yo: { friendCode: 'TFRK7Q2M', socialVisible: true },
    subtitulo:
      numAmigos === 0
        ? 'Nadie mejora igual cuando alguien le mira el marcador.'
        : `${numAmigos} ${numAmigos === 1 ? 'rival' : 'rivales'} en tu arena.`,
    cargando: false,
    fallo: null,
    copiado: false,
    copiar: nada,
    invitar: nadaAsync,
    invitaciones: null,
    siguienteInsignia: null,
    insigniasGanadas: [],
    codigo: '',
    setCodigo: nada,
    setAvisoCodigo: nada,
    enviar: nadaAsync,
    enviando: false,
    avisoCodigo: null,
    requests: [],
    entrantes: [],
    salientes: [],
    ocupada: null,
    abrirSeguridad: nada,
    responder: nadaAsync,
    quitar: nadaAsync,
    estado: 'fuera',
    miLudus: SIN_LUDUS,
    ventanaLudus: 'semana',
    elegirVentanaLudus: nada,
    metricaLudus: 'xp',
    elegirMetricaLudus: nada,
    ludusVisibles: [],
    rankingLudus: [],
    miRango: YO_DEMO.rango,
    rangos: RANGOS,
    cambiarPeticion: false,
    setCambiarPeticion: nada,
    objetivo: null,
    setObjetivo: nada,
    setAvisoLudus: nada,
    nota: '',
    setNota: nada,
    pidiendo: false,
    pedirLudus: nadaAsync,
    avisoLudus: null,
    numAmigos,
    visibles,
    ventana: 'semana',
    elegirVentana: nada,
    metrica: 'xp',
    elegirMetrica: nada,
    ranking: filas(visibles, 'xp'),
    cambiando: false,
    quitarAmigo: nada,
    ocultos: board.filter((b) => !b.visible && !b.isMe),
    abrirSoporte: nadaAsync,
    blockedUsers: [],
    safetyBusy: false,
    desbloquear: nadaAsync,
    cambiarVisible: nadaAsync,
    competicion: null,
    ...cambios,
  };
}

export const DEMO: DemoPantalla | null = {
  id: 'amigos',
  titulo: 'Amigos',
  marco: 'pila',
  estados: [
    {
      id: 'lleno',
      titulo: 'Lleno · podio',
      render: () => (
        <AmigosVista
          {...base([YO, ...RIVALES, OCULTO], {
            subtitulo: '8 rivales en tu arena · 1 por responder.',
            requests: [SOLICITUD],
            entrantes: [SOLICITUD],
            invitaciones: {
              activos: 2,
              pendientes: 1,
              caducadas: 0,
              tope: 0,
              insignias: [],
              siguienteUmbral: 3,
              invitado: false,
            },
            siguienteInsignia: { nombre: 'Reclutador', umbral: 3 },
          })}
        />
      ),
    },
    {
      id: 'dos-rivales',
      titulo: 'Dos rivales',
      render: () => <AmigosVista {...base([YO, RIVALES[0], RIVALES[3]])} />,
    },
    {
      id: 'vacio',
      titulo: 'Arena vacía',
      render: () => <AmigosVista {...base([YO])} />,
    },
    {
      id: 'cargando',
      titulo: 'Cargando',
      render: () => <AmigosVista {...base([YO], { cargando: true, yo: null, subtitulo: '' })} />,
    },
  ],
};
