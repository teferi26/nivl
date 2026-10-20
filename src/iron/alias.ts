// NIVL · IRON · Alias del catálogo: cómo se escribe de verdad un ejercicio en
// la libreta del gimnasio (puro; test en __tests__/alias.test.ts).
//
// El casado de casar.ts es exacto: «Press banca» no es «Press de banca con
// barra». Aquí van los nombres habituales en España y su equivalente en
// inglés para que «Ver técnica», el historial y la sugerencia de carga
// aparezcan sin obligar a nadie a cambiar cómo apunta.
//
// Regla para añadir un alias (conservadora a propósito):
// · Tiene que ser INEQUÍVOCAMENTE el mismo movimiento. Si el nombre vale para
//   dos ejercicios del catálogo, no entra: «fondos» (paralelas o banco),
//   «zancadas» (atrás o estática), «curl de bíceps» (barra o mancuernas),
//   «press inclinado» (barra o mancuernas), «aperturas», «jalón», «gemelos»,
//   «encogimientos», «abdominales», «curl femoral» (tumbado o sentado).
// · Se puede omitir el material solo cuando es la forma por defecto en un
//   gimnasio español: «press militar» es con barra, «hip thrust» es con
//   barra, «sentadilla» es la trasera con barra.
// · Mezclar variantes rompe el historial y la sugerencia de carga (no se
//   mueve el mismo peso con barra que con mancuernas): ante la duda, fuera.
// · Un alias nunca pisa el nombre oficial de otro ejercicio en ningún idioma
//   (el índice mete primero los nombres oficiales y el test lo comprueba).
//
// Se escriben como se teclean; la normalización quita tildes, mayúsculas,
// guiones y plurales no (por eso a veces van singular y plural).

export const ALIAS_IRON: Readonly<Record<string, readonly string[]>> = {
  // ── Pierna ──
  'sentadilla-barra': [
    'Sentadilla',
    'Sentadillas',
    'Sentadillas con barra',
    'Sentadilla trasera',
    'Sentadilla trasera con barra',
    'Back squat',
    'Barbell back squat',
    'Squat',
    'Squats',
  ],
  'sentadilla-frontal': ['Sentadilla frontal con barra', 'Sentadillas frontales', 'Front squats'],
  'sentadilla-goblet': ['Sentadilla goblet', 'Goblet squat', 'Goblet squats'],
  'sentadilla-bulgara': ['Sentadillas búlgaras', 'Búlgaras', 'Bulgarian squat', 'Bulgarian split squats'],
  'zancada-atras-mancuerna': ['Zancada atrás', 'Zancadas atrás', 'Zancada inversa', 'Zancadas inversas', 'Reverse lunge', 'Reverse lunges'],
  'zancada-estatica': ['Zancadas estáticas', 'Split squats'],
  prensa: ['Prensa', 'Prensa de pierna', 'Leg press machine'],
  'extension-cuadriceps': ['Extensiones de cuádriceps', 'Extensión de piernas', 'Leg extensions'],
  'curl-femoral-tumbado': ['Femoral tumbado', 'Curl de femoral tumbado', 'Lying hamstring curl'],
  'peso-muerto-rumano': ['Peso muerto rumano con barra', 'RDL', 'Barbell Romanian deadlift'],
  'hip-thrust': ['Hip thrust', 'Hip thrusts', 'Empuje de cadera', 'Empuje de cadera con barra'],
  'puente-gluteo': ['Puente de glúteos', 'Puente glúteo', 'Glute bridges'],
  'step-up-cajon': ['Step up', 'Step ups', 'Subidas al cajón'],
  'swing-kettlebell': ['Swing ruso', 'Kettlebell swings'],
  'buenos-dias': ['Buenos días', 'Good morning', 'Good mornings'],
  'abduccion-maquina': ['Máquina de abductores', 'Abductor machine', 'Hip abduction machine'],
  'gemelos-de-pie': ['Gemelos de pie', 'Standing calf raises'],
  'curl-nordico': ['Curl nórdico', 'Nordic curls', 'Nordic hamstring curl'],
  // ── Espalda ──
  'peso-muerto': ['Peso muerto convencional', 'Peso muerto con barra', 'Deadlifts', 'Conventional deadlift', 'Barbell deadlift'],
  'peso-muerto-sumo': ['Peso muerto estilo sumo'],
  dominada: ['Dominadas', 'Dominadas pronas', 'Dominada prona', 'Pull ups', 'Pullups', 'Pullup'],
  'dominada-supina': ['Dominadas supinas', 'Chin ups', 'Chinups', 'Chinup'],
  'dominada-neutra': ['Dominadas neutras', 'Dominadas con agarre neutro', 'Neutral grip pull ups'],
  'jalon-pecho': ['Jalón pecho', 'Jalones al pecho', 'Jalón al pecho en polea', 'Lat pulldowns'],
  'remo-barra': ['Remo barra', 'Remo inclinado con barra', 'Bent over row', 'Barbell bent over row', 'Barbell rows'],
  'remo-mancuerna': ['Remo a una mano', 'Remo unilateral con mancuerna', 'One arm dumbbell row', 'Single arm dumbbell row'],
  'remo-polea-sentado': ['Remo en polea baja', 'Remo polea baja', 'Remo sentado en polea', 'Seated row', 'Cable row'],
  'remo-invertido': ['Remo australiano', 'Inverted rows'],
  'face-pull': ['Face pulls', 'Facepull'],
  hiperextension: ['Hiperextensión', 'Extensiones lumbares', 'Back extensions', 'Hyperextensions'],
  'encogimientos-barra': ['Barbell shrugs'],
  // ── Pecho ──
  'press-banca': [
    'Press banca',
    'Press de banca con barra',
    'Press banca con barra',
    'Press banca plano',
    'Press de banca plano',
    'Bench',
    'Barbell bench press',
    'Flat bench press',
  ],
  'press-banca-mancuerna': ['Press banca con mancuernas', 'Press de banca mancuernas', 'DB bench press'],
  'press-inclinado-barra': ['Press banca inclinado', 'Press de banca inclinado', 'Incline bench press', 'Incline bench'],
  'press-inclinado-mancuerna': ['Press inclinado mancuernas', 'Incline DB press'],
  'fondos-paralelas': ['Fondos paralelas', 'Fondos en barras paralelas', 'Dips', 'Bar dips', 'Parallel dips'],
  flexiones: ['Flexión', 'Flexiones de pecho', 'Push up', 'Pushups', 'Pushup'],
  'pec-deck': ['Contractora', 'Máquina contractora', 'Peck deck', 'Butterfly'],
  'cruce-poleas': ['Cruces de poleas', 'Cable crossovers'],
  // ── Hombro ──
  'press-militar-barra': [
    'Press militar',
    'Press militar barra',
    'Press militar de pie',
    'Press de hombro con barra',
    'Military press',
    'Overhead press',
    'OHP',
  ],
  'press-arnold': ['Arnold'],
  'elevaciones-laterales': ['Elevaciones laterales', 'Elevación lateral', 'Elevación lateral con mancuernas', 'Lateral raises', 'Lateral raise', 'Side raises'],
  'elevaciones-frontales': ['Elevaciones frontales', 'Elevación frontal con mancuernas', 'Front raises'],
  'pajaro-mancuerna': ['Pájaro', 'Pájaros', 'Pájaros con mancuernas', 'Reverse flyes'],
  'remo-menton-barra': ['Remo al mentón', 'Upright row', 'Upright rows'],
  // ── Brazo ──
  'curl-barra': ['Curl con barra', 'Curl barra', 'Curl de bíceps barra', 'Barbell curls', 'Barbell biceps curl'],
  'curl-biceps-mancuerna': [
    'Curl con mancuernas',
    'Curl de bíceps con mancuerna',
    'Curl de bíceps mancuernas',
    'Curl bíceps mancuernas',
    'Dumbbell curl',
    'Dumbbell curls',
  ],
  'curl-martillo': ['Curl martillo', 'Curl de martillo', 'Martillo', 'Hammer curl', 'Hammer curls'],
  'curl-concentrado': ['Curl concentrado', 'Concentration curl'],
  'extension-triceps-polea': ['Extensión de tríceps en polea', 'Tríceps en polea', 'Tríceps polea', 'Triceps pushdown', 'Rope pushdown', 'Pushdown'],
  'press-cerrado-barra': ['Press cerrado', 'Press banca agarre cerrado', 'Press de banca cerrado', 'Close grip bench'],
  'fondos-banco': ['Fondos de tríceps en banco', 'Bench dip'],
  'paseo-granjero': ['Paseo de granjero', 'Farmer walk', 'Farmers walk'],
  // ── Core y cardio ──
  plancha: ['Plancha abdominal', 'Plancha frontal', 'Planks', 'Front plank'],
  crunch: ['Crunches', 'Encogimientos abdominales'],
  'rueda-abdominal': ['Rueda', 'Rueda de abdominales', 'Ab wheel'],
  'mountain-climbers': ['Escaladores', 'Mountain climber'],
  'saltos-tijera': ['Jumping jack'],
  'russian-twist': ['Giros rusos', 'Giro ruso'],
  'elevacion-rodillas-colgado': ['Elevaciones de rodillas colgado', 'Hanging knee raises'],
  burpees: ['Burpee'],
  comba: ['Comba', 'Saltar comba', 'Skipping rope'],
};
