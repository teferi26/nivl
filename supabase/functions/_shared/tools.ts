// NIVL · Las manos del coach.
//
// Cada herramienta se ejecuta con el JWT de quien llama, así que RLS sigue
// aplicando: el coach no puede tocar datos de nadie más aunque el modelo se
// invente un user_id. La descripción de cada una dice CUÁNDO usarla, no solo
// qué hace — es lo que más mueve la aguja en si el modelo la llama a tiempo.
//
// Invariante de economía: el coach elige DIFICULTAD, nunca puntos. El XP sale
// de la tabla de game.ts (10/25/50/100/250). Así no puede inflar el nivel.

import type { Db } from './db.ts';

const STATS = ['FUE', 'VIT', 'INT', 'AGI', 'PER'];
const DIFICULTADES = ['trivial', 'facil', 'media', 'dificil', 'epica'];
const TIPOS_BLOQUE = [
  'despertar', 'ritual', 'gym', 'aerobico', 'ventas', 'contenido',
  'deep_work', 'estudio', 'comida', 'redes', 'descanso', 'dormir', 'libre',
];

// Las de gasto, para poner topes. No se puede presupuestar un ingreso.
const CATEGORIAS_GASTO = [
  'vivienda', 'suministros', 'super', 'restaurante', 'transporte', 'salud',
  'gimnasio', 'suscripciones', 'ocio', 'ropa', 'formacion', 'negocio',
  'impuestos', 'comisiones', 'otros',
];

// Todas las que admite el CHECK de la 0013. Si añades una aquí, añádela allí.
const CATEGORIAS_TODAS = [
  'ingreso_negocio', 'ingreso_nomina', 'ingreso_otro',
  ...CATEGORIAS_GASTO,
  'ahorro', 'inversion', 'transferencia',
];

// Sin `strict: true` a propósito.
//
// El modo estricto compila cada esquema a una gramática de decodificación, y
// con 13 herramientas (incluida la de planificar el día, que anida un array
// de bloques con su propio enum) la API responde "Schema is too complex for
// compilation". Se puede vivir sin él porque la validación de verdad ya está
// dos capas más abajo: los CHECK de Postgres rechazan cualquier stat,
// dificultad, tipo de bloque, categoría o rango inválidos, y el error vuelve
// al modelo como resultado de herramienta para que lo corrija. El ejecutor
// valida además las horas y el orden de los bloques.
//
// Todas las propiedades siguen en `required`: al modelo le queda claro que no
// puede omitir claves, y lo opcional viaja con el centinela de cadena vacía.
function tool(name: string, description: string, properties: Record<string, unknown>) {
  return {
    name,
    description,
    input_schema: {
      type: 'object',
      properties,
      required: Object.keys(properties),
      additionalProperties: false,
    },
  };
}

const str = (description: string) => ({ type: 'string', description });
const bool = (description: string) => ({ type: 'boolean', description });
const enumOf = (values: string[], description: string) => ({ type: 'string', enum: values, description });

// Lo opcional se expresa con CADENA VACÍA, no con null.
//
// Dos razones, ambas del validador de esquemas: { type: ['string','null'] }
// junto a un enum se rechaza de plano, y además hay un tope de 16 parámetros
// con tipos unión en todo el conjunto de herramientas (aquí había 17). Con el
// centinela de cadena vacía no queda ni una unión, el esquema es más barato de
// compilar y al modelo le resulta más fácil de rellenar.
const opt = (description: string) => ({
  type: 'string',
  description: `${description}. Cadena vacía si no aplica.`,
});

const enumOpt = (values: string[], description: string) => ({
  type: 'string',
  enum: ['', ...values],
  description: `${description}. Cadena vacía para no tocarlo.`,
});

/** Normaliza el centinela: '' y null pasan a undefined. */
const val = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
  return s === '' ? undefined : s;
};

export const TOOL_DEFS = [
  tool(
    'crear_mision',
    'Crea una misión recurrente. Úsala cuando acuerdes un hábito nuevo, cuando el gladiador declare un objetivo que exija repetición, o al montar su sistema desde cero. La dificultad determina el XP (trivial 10, facil 25, media 50, dificil 100, epica 250): elígela por el esfuerzo de UNA sesión, no por lo importante que sea.',
    {
      titulo: str('Título corto y accionable, en español, sin emojis'),
      stat: enumOf(STATS, 'FUE ejercicio · VIT nutrición/sueño · INT trabajo mental · AGI constancia · PER reflexión'),
      dificultad: enumOf(DIFICULTADES, 'Esfuerzo de una sesión: trivial ≤5min, facil ≤20min, media ~45min, dificil 1-2h, epica medio día'),
      dias_semana: {
        type: 'array',
        items: { type: 'integer', enum: [1, 2, 3, 4, 5, 6, 7] },
        description: 'Días en que toca (1=lunes … 7=domingo). Sé realista: casi nada aguanta los 7 días.',
      },
      requiere_evidencia: bool('Si true, completarla pide foto. La evidencia da +25% de XP aunque no sea obligatoria.'),
      es_extra: bool('Si true es misión extra: paga Puntos Bonus canjeables por descanso en vez de XP. Úsalo para lo opcional que no debe inflar el nivel.'),
    },
  ),

  tool(
    'editar_mision',
    'Cambia una misión existente. Úsala en la revisión semanal cuando una misión falla siempre (baja la dificultad) o se cumple al 100% sin esfuerzo (súbela). Deja vacío lo que no quieras tocar.',
    {
      mision_id: str('El id de la misión'),
      titulo: opt('Nuevo título'),
      dificultad: enumOpt(DIFICULTADES, 'Nueva dificultad'),
      dias_semana: {
        type: 'array',
        items: { type: 'integer', enum: [1, 2, 3, 4, 5, 6, 7] },
        description: 'Nuevos días (1=lunes … 7=domingo). Lista vacía para no tocarlos.',
      },
    },
  ),

  tool(
    'desactivar_mision',
    'QUITA una misión o hábito del sistema del gladiador: desaparece de su lista, deja de pedírsele y deja de contar para la racha. Puedes usarla siempre que él te lo pida ("quítame X") y también por tu cuenta cuando una misión lleva semanas por debajo del 30% de adherencia y mantenerla solo genera penalización inútil. Es la forma de eliminar un hábito, así que NO le digas que no puedes eliminarlos: puedes. Por dentro se conserva el historial de lo que sí completó (su XP ya ganado no se toca), pero para él está eliminada; díselo así, sin hablarle de desactivar.',
    { mision_id: str('El id de la misión'), motivo: str('Por qué se desactiva, una frase') },
  ),

  tool(
    'planificar_dia',
    'Escribe el plan completo de un día: el veredicto de ayer, las órdenes de hoy y los bloques con hora. Es tu herramienta principal de mando — llámala en el ritual de la mañana y siempre que replanifiques. Sustituye por completo el plan anterior de esa fecha. Pon números exactos en el detalle de cada bloque (cuántas llamadas, qué peso, cuántos minutos), nunca "trabajar en ventas".',
    {
      fecha: str('Día del plan en formato YYYY-MM-DD'),
      veredicto: opt('Juicio de lo de ayer, crudo y con datos'),
      brief: str('Las órdenes del día en la voz del sistema: qué se espera y por qué'),
      bloques: {
        type: 'array',
        description: 'Los bloques en orden cronológico. Entre 3 y 16.',
        items: {
          type: 'object',
          properties: {
            inicio: str('Hora de inicio HH:MM en 24h'),
            fin: str('Hora de fin HH:MM en 24h'),
            titulo: str('Nombre corto del bloque'),
            tipo: enumOf(TIPOS_BLOQUE, 'Naturaleza del bloque'),
            detalle: opt('Las órdenes exactas con números'),
            avisar: bool('Si true, salta una notificación al empezar el bloque'),
          },
          required: ['inicio', 'fin', 'titulo', 'tipo', 'detalle', 'avisar'],
          additionalProperties: false,
        },
      },
    },
  ),

  tool(
    'programar_evento',
    'Pone una cita en la agenda: llamada, demo, reunión, entrega. Úsala en cuanto se acuerde una fecha concreta con un tercero, para que no dependa de que él se acuerde.',
    {
      titulo: str('Qué es'),
      fecha: str('YYYY-MM-DD'),
      hora: opt('HH:MM en 24h si tiene hora fija'),
      notas: opt('Preparación o contexto'),
    },
  ),

  tool(
    'fijar_horarios',
    'Fija la hora de despertar, la de dormir y el régimen. El despertador y los avisos del día se programan a partir de esto. Úsala al pactar horarios y al cambiar de régimen tras un valle: A régimen completo, B mínimo viable, pausa para reflexionar sobre el pacto.',
    {
      hora_despertar: opt('HH:MM'),
      hora_dormir: opt('HH:MM'),
      regimen: enumOpt(['A', 'B', 'pausa'], 'Régimen'),
    },
  ),

  tool(
    'registrar_hecho',
    'Escribe en tu memoria permanente. Llámala SIEMPRE que aprendas algo que querrás recordar dentro de meses: un número real, una decisión, un patrón de conducta, el resultado de una llamada. Es la diferencia entre un coach que recuerda y uno que empieza de cero cada día. Un hecho por llamada, concreto y fechado.',
    {
      categoria: enumOf(
        ['perfil', 'objetivo', 'proyecto', 'regla', 'aprendizaje', 'log', 'metrica', 'venta'],
        'perfil datos suyos · objetivo metas · proyecto negocios · regla innegociables · aprendizaje patrones de conducta · log lo que pasó · metrica números · venta comercial',
      ),
      contenido: str('El hecho, en una o dos frases, con cifras si las hay'),
      fecha: opt('YYYY-MM-DD del hecho; vacía para hoy'),
    },
  ),

  tool(
    'actualizar_dossier',
    'Reescribe tu memoria estable completa (perfil, objetivos, proyectos, reglas, sistema, protocolos y aprendizajes). Es cara: se envía entera en cada conversación. Úsala solo cuando cambie algo ESTRUCTURAL — un objetivo nuevo, un proyecto que muere, una regla que se pacta. Para el día a día usa registrar_hecho. Manda el documento entero en markdown, no un fragmento: sustituye al anterior.',
    { contenido: str('El dossier completo en markdown') },
  ),

  tool(
    'crear_mazmorra',
    'Crea un proyecto con final (una mazmorra). Úsala cuando aparezca un trabajo grande y acotado: lanzar algo, cerrar un cliente, entregar un encargo. El rango marca el botín al despejarla: E 50 XP, D 100, C 150, B 250, A 400, S 600.',
    {
      titulo: str('Nombre del proyecto'),
      rango: enumOf(['E', 'D', 'C', 'B', 'A', 'S'], 'Envergadura: E trivial … S el proyecto de tu año'),
      descripcion: opt('Qué es y qué significa terminarlo'),
      stat: enumOf(STATS, 'Stat que alimenta'),
      fecha_limite: opt('YYYY-MM-DD'),
    },
  ),

  tool(
    'crear_tarea',
    'Añade una tarea a una mazmorra. Marca como jefe el paso que de verdad decide si el proyecto avanza: paga el doble de XP.',
    {
      mazmorra_id: str('Id de la mazmorra'),
      titulo: str('La tarea'),
      dificultad: enumOf(DIFICULTADES, 'Esfuerzo de la tarea'),
      es_jefe: bool('Si true, es el paso decisivo y paga XP doble'),
      fecha_limite: opt('YYYY-MM-DD'),
    },
  ),

  tool(
    'registrar_regla',
    'Añade una regla innegociable al contrato, con su consecuencia. Romperla resta 25 XP y genera una misión de castigo. Úsala solo para lo que él acepte como ley, no para consejos.',
    { texto: str('La regla, en imperativo'), consecuencia: str('Qué toca hacer al romperla, p. ej. "Correr 5 km"') },
  ),

  tool(
    'ajustar_meta',
    'Crea una meta medible con progreso automático. Para peso corporal y récords de gym el progreso se calcula solo con los datos reales; el resto se actualiza a mano. Conseguirla paga 100 XP.',
    {
      titulo: str('La meta'),
      tipo: enumOf(['peso_corporal', 'ejercicio', 'libre'], 'peso_corporal lee su peso · ejercicio lee su PR · libre se actualiza a mano'),
      ejercicio: opt('Nombre exacto del ejercicio si tipo=ejercicio'),
      valor_inicial: { type: 'number', description: 'Punto de partida' },
      valor_objetivo: { type: 'number', description: 'A dónde va' },
      unidad: str('kg, km, min, €…'),
      fecha_limite: opt('YYYY-MM-DD'),
    },
  ),

  tool(
    'prescribir_entreno',
    'Escribe la sesión de gimnasio de un día: qué ejercicios, cuántas series, cuántas repeticiones, con qué carga y a qué RPE. Úsala cuando programes la semana y cada vez que el estudio muestre que toca subir, mantener o descargar. Sustituye por completo lo prescrito para esa fecha. La carga se decide con el RPE de las últimas sesiones, no con el calendario: RPE ≤7 sube, 8-9 mantiene, 10 baja un 10%.',
    {
      fecha: str('Día de la sesión, YYYY-MM-DD'),
      ejercicios: {
        type: 'array',
        description: 'Los ejercicios en el orden en que se hacen: básicos primero. Entre 1 y 12.',
        items: {
          type: 'object',
          properties: {
            nombre: str('Nombre del ejercicio, igual que en su rutina'),
            series: { type: 'integer', description: 'Número de series de trabajo' },
            repeticiones: str('Repeticiones por serie: un número ("5") o un rango ("8-10")'),
            peso: { type: 'number', description: 'Carga en kg. 0 si es peso corporal.' },
            rpe_objetivo: { type: 'number', description: 'Esfuerzo buscado, de 1 a 10. Trabajo normal: 7-8.' },
            notas: opt('Indicación técnica o de tempo'),
          },
          required: ['nombre', 'series', 'repeticiones', 'peso', 'rpe_objetivo', 'notas'],
          additionalProperties: false,
        },
      },
    },
  ),

  tool(
    'fijar_nutricion',
    'Fija las calorías y la proteína diarias, con el motivo. Úsala al empezar, y cada vez que la tendencia del peso se aparte de lo previsto: dos semanas plano con adherencia alta significa que el mantenimiento ha bajado y hay que recortar 150-200 kcal, no 500. Si baja más de 1 kg por semana, se AÑADEN calorías. Nunca por debajo de 1.500 kcal para alguien que entrena.',
    {
      kcal: { type: 'integer', description: 'Calorías diarias objetivo' },
      proteina_g: { type: 'integer', description: 'Gramos de proteína al día. Referencia: 1,6-2,2 g por kg de peso.' },
      carbos_g: { type: 'integer', description: 'Gramos de carbohidrato al día. 0 si no lo especificas.' },
      grasa_g: { type: 'integer', description: 'Gramos de grasa al día. 0 si no lo especificas.' },
      motivo: str('Por qué estos números y qué esperas que pase. Se le enseña tal cual.'),
    },
  ),

  tool(
    'planificar_comidas',
    'Escribe el plan de comidas de un día de la semana. Prescribe lo que va a comer de verdad: odia cocinar y funciona con batch cooking y comidas repetidas, no con catorce recetas distintas. Sustituye lo que hubiera para ese día.',
    {
      dia_semana: { type: 'integer', description: 'Día de la semana: 1=lunes … 7=domingo' },
      comidas: {
        type: 'array',
        description: 'Las comidas del día',
        items: {
          type: 'object',
          properties: {
            // Estas cinco y no más: son las que admite el esquema y las que
            // pinta la pantalla de Dieta.
            franja: enumOf(
              ['desayuno', 'comida', 'merienda', 'cena', 'snack'],
              'Momento del día',
            ),
            descripcion: str('Qué come, con cantidades'),
            ingredientes: opt('Ingredientes separados por coma, para la lista de la compra'),
            kcal: { type: 'integer', description: 'Calorías aproximadas. 0 si no las calculas.' },
            proteina_g: { type: 'integer', description: 'Proteína aproximada en gramos. 0 si no la calculas.' },
          },
          required: ['franja', 'descripcion', 'ingredientes', 'kcal', 'proteina_g'],
          additionalProperties: false,
        },
      },
    },
  ),

  tool(
    'configurar_rutina',
    'Reescribe la rutina de un día de la semana en el gimnasio: el nombre del día y sus ejercicios con series, repeticiones y peso. Úsala cuando el programa entero tenga que cambiar (cambio de bloque, un ejercicio que le hace daño, un split nuevo), no para la carga de una sesión suelta: para eso está prescribir_entreno. Sustituye lo que hubiera ese día.',
    {
      dia_semana: { type: 'integer', description: 'Día de la semana: 1=lunes … 7=domingo' },
      nombre: str('Nombre del día, p. ej. PUSH, PULL, LEGS o Descanso'),
      ejercicios: {
        type: 'array',
        description: 'Los ejercicios del día, en el orden en que se hacen. Vacío convierte el día en descanso.',
        items: {
          type: 'object',
          properties: {
            nombre: str('Nombre del ejercicio'),
            series: { type: 'integer', description: 'Número de series' },
            reps: { type: 'integer', description: 'Repeticiones objetivo por serie' },
            peso: { type: 'number', description: 'Kilos. 0 si es al fallo, con el propio peso corporal o si aún no lo sabes.' },
          },
          required: ['nombre', 'series', 'reps', 'peso'],
          additionalProperties: false,
        },
      },
    },
  ),

  tool(
    'fijar_plan_economico',
    'Fija el plan de dinero del mes: cuánto tiene que entrar, cuánto es el techo de gasto, cuánto aparta y cuántos meses de aire quiere mantener. Úsala al empezar y cuando los meses cerrados digan que el plan no se corresponde con la realidad. Los meses de aire mandan sobre el crecimiento: si el colchón baja del pactado, esa es la alarma del mes.',
    {
      ingreso_objetivo: { type: 'integer', description: 'Euros que deben entrar al mes. 0 para no fijarlo.' },
      tope_gasto: { type: 'integer', description: 'Techo de gasto mensual en euros. 0 para no fijarlo.' },
      ahorro_objetivo: { type: 'integer', description: 'Euros a apartar cada mes. 0 para no fijarlo.' },
      meses_aire: { type: 'integer', description: 'Meses de gastos que quiere tener siempre cubiertos con el saldo. 0 para no fijarlo.' },
      motivo: str('Por qué estos números y de qué dato salen. Se le enseña tal cual.'),
    },
  ),

  tool(
    'fijar_presupuesto',
    'Pone un tope mensual a una categoría de gasto. Úsala sobre las categorías que el estudio muestre desviadas de su media, no sobre todas: un presupuesto que no se mira no existe. Sustituye el tope anterior de esa categoría.',
    {
      categoria: enumOf(CATEGORIAS_GASTO, 'Categoría a la que pones tope'),
      tope_mensual: { type: 'integer', description: 'Euros al mes' },
      motivo: str('Por qué ese tope y de qué cifra sale'),
    },
  ),

  tool(
    'regla_categoria',
    'Enseña al sistema a clasificar un tipo de movimiento para siempre. Úsala en cuanto él te diga qué era un cargo sin clasificar, y también cuando te corrija una categoría: a partir de ahí se aplica solo, y también recategoriza los movimientos que ya había. El dinero sin clasificar no aparece en ningún presupuesto.',
    {
      patron: str('Texto que aparece en la descripción o el cobrador, p. ej. "MERCADONA". Se compara sin distinguir mayúsculas.'),
      categoria: enumOf(CATEGORIAS_TODAS, 'Categoría que le corresponde'),
    },
  ),

  tool(
    'registrar_movimiento',
    'Anota un movimiento que el banco no ve: efectivo, un cobro en mano, un gasto de otra cuenta. Úsala solo cuando él te lo cuente, nunca para estimar lo que crees que gastó. El importe va NEGATIVO si es gasto y POSITIVO si es ingreso.',
    {
      fecha: str('YYYY-MM-DD'),
      importe: { type: 'number', description: 'Euros. Negativo si es gasto, positivo si es ingreso.' },
      descripcion: str('Qué fue'),
      categoria: enumOf(CATEGORIAS_TODAS, 'Categoría del movimiento'),
    },
  ),

  tool(
    'consultar_historial',
    'Consulta datos que no vienen en el estado inicial. Úsala cuando necesites comprobar algo concreto antes de afirmarlo: si de verdad falló una misión, cuánto levantó hace un mes, qué pesaba en enero, cuánto se gastó en algo. No la uses para lo que ya tienes delante.',
    {
      que: enumOf(
        ['completadas', 'eventos', 'peso', 'gym', 'cardio', 'nutricion', 'comidas', 'diario', 'reglas_rotas', 'hechos', 'movimientos'],
        'Qué serie quieres',
      ),
      desde: str('YYYY-MM-DD'),
      hasta: str('YYYY-MM-DD'),
      filtro: opt('Texto de filtro, p. ej. nombre de ejercicio'),
    },
  ),
];

// ── Ejecución ───────────────────────────────────────────────────────

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(hhmm: string): number {
  const m = HHMM.exec(hhmm);
  if (!m) throw new Error(`Hora inválida: ${hhmm} (formato HH:MM en 24h)`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export interface ToolCtx {
  sb: Db;
  userId: string;
  today: string;
}

/** Ejecuta una herramienta y devuelve el texto que verá el modelo. */
export async function executeTool(
  name: string,
  input: Record<string, any>,
  ctx: ToolCtx,
): Promise<string> {
  const { sb, userId } = ctx;
  const ok = (msg: string) => msg;

  switch (name) {
    case 'crear_mision': {
      const { data, error } = await sb
        .from('quests')
        .insert({
          user_id: userId,
          title: input.titulo,
          stat: input.stat,
          difficulty: input.dificultad,
          days_of_week: input.dias_semana?.length ? input.dias_semana : [1, 2, 3, 4, 5, 6, 7],
          requires_evidence: !!input.requiere_evidencia,
          is_bonus: !!input.es_extra,
        })
        .select('id')
        .single();
      if (error) throw error;
      return ok(`Misión creada (id ${data.id}): "${input.titulo}" · ${input.stat} · ${input.dificultad}`);
    }

    case 'editar_mision': {
      const patch: Record<string, unknown> = {};
      if (val(input.titulo)) patch.title = val(input.titulo);
      if (val(input.dificultad)) patch.difficulty = val(input.dificultad);
      if (input.dias_semana?.length) patch.days_of_week = input.dias_semana;
      if (!Object.keys(patch).length) return ok('Nada que cambiar.');
      const { error } = await sb.from('quests').update(patch).eq('id', input.mision_id).eq('user_id', userId);
      if (error) throw error;
      return ok(`Misión ${input.mision_id} actualizada: ${JSON.stringify(patch)}`);
    }

    case 'desactivar_mision': {
      const { error } = await sb
        .from('quests')
        .update({ active: false })
        .eq('id', input.mision_id)
        .eq('user_id', userId);
      if (error) throw error;
      await sb.from('coach_facts').insert({
        user_id: userId,
        category: 'log',
        content: `Misión desactivada: ${input.motivo}`,
      });
      return ok(`Misión ${input.mision_id} desactivada.`);
    }

    case 'planificar_dia': {
      const bloques = (input.bloques ?? []) as any[];
      if (!bloques.length) throw new Error('Un plan sin bloques no es un plan.');

      const { data: plan, error: planErr } = await sb
        .from('day_plans')
        .upsert(
          {
            user_id: userId,
            date: input.fecha,
            status: 'activo',
            verdict: val(input.veredicto) ?? null,
            brief: input.brief,
            generated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,date' },
        )
        .select('id')
        .single();
      if (planErr) throw planErr;

      // Sustitución completa: replanificar no debe dejar bloques zombis.
      await sb.from('day_blocks').delete().eq('plan_id', plan.id);

      const rows = bloques.map((b, i) => {
        const start = toMinutes(b.inicio);
        const end = toMinutes(b.fin);
        if (end <= start) throw new Error(`El bloque "${b.titulo}" acaba antes de empezar (${b.inicio}-${b.fin}).`);
        return {
          plan_id: plan.id,
          user_id: userId,
          start_min: start,
          end_min: end,
          title: b.titulo,
          kind: b.tipo,
          detail: val(b.detalle) ?? null,
          notify: b.avisar !== false,
          position: i,
        };
      });
      const { error: blkErr } = await sb.from('day_blocks').insert(rows);
      if (blkErr) throw blkErr;
      return ok(`Plan del ${input.fecha} escrito: ${rows.length} bloques, de ${bloques[0].inicio} a ${bloques[bloques.length - 1].fin}.`);
    }

    case 'programar_evento': {
      const { error } = await sb.from('calendar_events').insert({
        user_id: userId,
        title: input.titulo,
        date: input.fecha,
        time: val(input.hora) ?? null,
        notes: val(input.notas) ?? null,
      });
      if (error) throw error;
      return ok(`Evento en agenda: ${input.titulo} el ${input.fecha}${input.hora ? ' a las ' + input.hora : ''}.`);
    }

    case 'fijar_horarios': {
      const patch: Record<string, unknown> = {};
      if (input.hora_despertar != null) {
        toMinutes(input.hora_despertar);
        patch.wake_time = input.hora_despertar;
      }
      if (input.hora_dormir != null) {
        toMinutes(input.hora_dormir);
        patch.sleep_time = input.hora_dormir;
      }
      if (input.regimen != null) patch.coach_mode = input.regimen;
      if (!Object.keys(patch).length) return ok('Nada que cambiar.');
      const { error } = await sb.from('profiles').update(patch).eq('id', userId);
      if (error) throw error;
      return ok(`Horarios fijados: ${JSON.stringify(patch)}`);
    }

    case 'registrar_hecho': {
      const { error } = await sb.from('coach_facts').insert({
        user_id: userId,
        category: input.categoria,
        content: input.contenido,
        date: val(input.fecha) ?? ctx.today,
        source: 'coach',
      });
      if (error) throw error;
      return ok('Anotado en la memoria.');
    }

    case 'actualizar_dossier': {
      const { data: prev } = await sb
        .from('coach_dossier')
        .select('version')
        .eq('user_id', userId)
        .maybeSingle();
      const { error } = await sb.from('coach_dossier').upsert(
        {
          user_id: userId,
          content: input.contenido,
          version: (prev?.version ?? 0) + 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
      return ok(`Dossier reescrito (versión ${(prev?.version ?? 0) + 1}).`);
    }

    case 'crear_mazmorra': {
      const { data, error } = await sb
        .from('dungeons')
        .insert({
          user_id: userId,
          title: input.titulo,
          rank: input.rango,
          description: val(input.descripcion) ?? null,
          stat: input.stat,
          deadline: val(input.fecha_limite) ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;
      return ok(`Mazmorra creada (id ${data.id}): "${input.titulo}" rango ${input.rango}.`);
    }

    case 'crear_tarea': {
      const { count } = await sb
        .from('dungeon_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('dungeon_id', input.mazmorra_id);
      const { error } = await sb.from('dungeon_tasks').insert({
        dungeon_id: input.mazmorra_id,
        user_id: userId,
        title: input.titulo,
        difficulty: input.dificultad,
        is_boss: !!input.es_jefe,
        due_date: val(input.fecha_limite) ?? null,
        position: count ?? 0,
      });
      if (error) throw error;
      return ok(`Tarea añadida: "${input.titulo}"${input.es_jefe ? ' (jefe)' : ''}.`);
    }

    case 'registrar_regla': {
      const { count } = await sb
        .from('rules')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      const { error } = await sb.from('rules').insert({
        user_id: userId,
        text: input.texto,
        consequence: input.consecuencia,
        position: count ?? 0,
      });
      if (error) throw error;
      return ok(`Regla añadida al contrato: "${input.texto}" → ${input.consecuencia}`);
    }

    case 'ajustar_meta': {
      const { error } = await sb.from('goals').insert({
        user_id: userId,
        title: input.titulo,
        metric_type: input.tipo,
        exercise_name: val(input.ejercicio) ?? null,
        start_value: input.valor_inicial,
        target_value: input.valor_objetivo,
        current_value: input.tipo === 'libre' ? input.valor_inicial : null,
        unit: input.unidad,
        deadline: val(input.fecha_limite) ?? null,
      });
      if (error) throw error;
      return ok(`Meta creada: ${input.titulo} (${input.valor_inicial} → ${input.valor_objetivo} ${input.unidad}).`);
    }

    case 'prescribir_entreno': {
      const ejercicios = (input.ejercicios ?? []) as any[];
      if (!ejercicios.length) throw new Error('Una sesión sin ejercicios no es una sesión.');

      // Sustitución completa: reprogramar no debe dejar ejercicios zombis de
      // una versión anterior del plan.
      await sb
        .from('training_prescriptions')
        .delete()
        .eq('user_id', userId)
        .eq('date', input.fecha);

      const filas = ejercicios.map((e, i) => ({
        user_id: userId,
        date: input.fecha,
        exercise_name: e.nombre,
        sets: e.series,
        reps: String(e.repeticiones),
        weight: e.peso ?? null,
        rpe_target: e.rpe_objetivo ?? null,
        notes: val(e.notas) ?? null,
        position: i,
      }));
      const { error } = await sb.from('training_prescriptions').insert(filas);
      if (error) throw error;
      return ok(
        `Entreno del ${input.fecha} prescrito: ${filas
          .map((f) => `${f.exercise_name} ${f.sets}×${f.reps}${f.weight ? ` @${f.weight}kg` : ''}`)
          .join(' · ')}`,
      );
    }

    case 'fijar_nutricion': {
      const kcal = Number(input.kcal);
      const prot = Number(input.proteina_g);
      // Guardas duras: el esquema ya las tiene, pero fallar aquí con un
      // mensaje claro le enseña al modelo el límite en vez de darle un error
      // opaco de Postgres.
      if (!(kcal >= 1500 && kcal <= 6000)) {
        throw new Error(`${kcal} kcal está fuera de lo prescribible. Nunca por debajo de 1.500 para alguien que entrena.`);
      }
      if (!(prot >= 40 && prot <= 400)) {
        throw new Error(`${prot} g de proteína está fuera de rango.`);
      }

      // Solo un objetivo vigente: el anterior queda archivado, no borrado.
      await sb
        .from('nutrition_targets')
        .update({ active: false })
        .eq('user_id', userId)
        .eq('active', true);

      const { error } = await sb.from('nutrition_targets').insert({
        user_id: userId,
        from_date: ctx.today,
        kcal,
        protein_g: prot,
        carbs_g: input.carbos_g ? Number(input.carbos_g) : null,
        fat_g: input.grasa_g ? Number(input.grasa_g) : null,
        rationale: input.motivo,
        active: true,
      });
      if (error) throw error;
      return ok(`Nutrición fijada: ${kcal} kcal y ${prot} g de proteína al día.`);
    }

    case 'planificar_comidas': {
      const dia = Number(input.dia_semana);
      if (!(dia >= 1 && dia <= 7)) throw new Error(`Día de la semana inválido: ${input.dia_semana}`);
      const comidas = (input.comidas ?? []) as any[];
      if (!comidas.length) throw new Error('Un día sin comidas no es un plan.');

      await sb.from('meal_slots').delete().eq('user_id', userId).eq('day_of_week', dia);

      const filas = comidas.map((c) => ({
        user_id: userId,
        day_of_week: dia,
        slot: c.franja,
        description: c.descripcion,
        ingredients: val(c.ingredientes) ?? null,
        kcal: c.kcal ? Number(c.kcal) : null,
        protein_g: c.proteina_g ? Number(c.proteina_g) : null,
      }));
      const { error } = await sb.from('meal_slots').insert(filas);
      if (error) throw error;

      const totalKcal = filas.reduce((a, f) => a + (f.kcal ?? 0), 0);
      const totalProt = filas.reduce((a, f) => a + (f.protein_g ?? 0), 0);
      const DIAS_NOMBRE = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
      return ok(
        `Comidas del ${DIAS_NOMBRE[dia]} escritas: ${filas.length} franjas` +
          (totalKcal ? ` · ${totalKcal} kcal y ${totalProt} g de proteína en total` : ''),
      );
    }

    case 'configurar_rutina': {
      const dia = Number(input.dia_semana);
      if (!(dia >= 1 && dia <= 7)) throw new Error(`Día de la semana inválido: ${input.dia_semana}`);
      const nombre = String(input.nombre ?? '').trim();
      if (!nombre) throw new Error('El día necesita un nombre: PUSH, PULL, LEGS, Descanso…');
      const ejercicios = (input.ejercicios ?? []) as any[];

      // El día se reescribe entero. Las SESIONES ya registradas no se tocan:
      // gym_sessions apunta al día por gym_day_id, y borrar el día se lo
      // llevaría por delante junto con el histórico de cargas que alimenta el
      // estudio. Por eso se reutiliza la fila si existe.
      const { data: existente } = await sb
        .from('gym_days')
        .select('id')
        .eq('user_id', userId)
        .eq('day_of_week', dia)
        .maybeSingle();

      let diaId = (existente as { id: string } | null)?.id;
      if (diaId) {
        const { error } = await sb.from('gym_days').update({ name: nombre }).eq('id', diaId);
        if (error) throw error;
        await sb.from('gym_exercises').delete().eq('gym_day_id', diaId);
      } else {
        const { data, error } = await sb
          .from('gym_days')
          .insert({ user_id: userId, day_of_week: dia, name: nombre })
          .select('id')
          .single();
        if (error) throw error;
        diaId = (data as { id: string }).id;
      }

      if (ejercicios.length) {
        const filas = ejercicios.map((e, i) => ({
          gym_day_id: diaId,
          user_id: userId,
          name: String(e.nombre),
          sets: Number(e.series) || 3,
          reps: Number(e.reps) || 10,
          weight: e.peso ? Number(e.peso) : null,
          position: i,
        }));
        const { error } = await sb.from('gym_exercises').insert(filas);
        if (error) throw error;
      }

      const DIAS_NOMBRE = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
      return ok(
        `Rutina del ${DIAS_NOMBRE[dia]} reescrita como ${nombre}: ` +
          (ejercicios.length ? `${ejercicios.length} ejercicios.` : 'día de descanso.'),
      );
    }

    case 'fijar_plan_economico': {
      const num = (v: unknown) => {
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : null;
      };
      const ingreso = num(input.ingreso_objetivo);
      const gasto = num(input.tope_gasto);
      const ahorro = num(input.ahorro_objetivo);
      const aire = num(input.meses_aire);
      if (ingreso === null && gasto === null && ahorro === null && aire === null) {
        throw new Error('Un plan sin ninguna cifra no es un plan. Fija al menos una.');
      }
      // Aritmética elemental, pero es el error que más se cuela: prometerle
      // ahorrar más de lo que le sobra después del techo de gasto.
      if (ingreso !== null && gasto !== null && ahorro !== null && ahorro > ingreso - gasto) {
        throw new Error(
          `No cuadra: con ${ingreso} € de ingreso y ${gasto} € de tope, lo máximo que puede apartar son ${ingreso - gasto} €, no ${ahorro} €.`,
        );
      }

      await sb.from('money_plan').update({ active: false }).eq('user_id', userId).eq('active', true);

      const { error } = await sb.from('money_plan').insert({
        user_id: userId,
        from_date: ctx.today,
        income_target: ingreso,
        spend_cap: gasto,
        savings_target: ahorro,
        runway_target_months: aire,
        rationale: input.motivo,
        active: true,
      });
      if (error) throw error;

      const partes = [
        ingreso !== null ? `entrar ${ingreso} €` : null,
        gasto !== null ? `gastar como mucho ${gasto} €` : null,
        ahorro !== null ? `apartar ${ahorro} €` : null,
        aire !== null ? `${aire} meses de aire` : null,
      ].filter(Boolean);
      return ok(`Plan económico fijado: ${partes.join(' · ')} al mes.`);
    }

    case 'fijar_presupuesto': {
      const tope = Number(input.tope_mensual);
      if (!(tope >= 0)) throw new Error(`Tope inválido: ${input.tope_mensual}`);
      const { error } = await sb
        .from('budgets')
        .upsert(
          {
            user_id: userId,
            category: input.categoria,
            monthly_limit: tope,
            rationale: input.motivo,
            active: true,
          },
          { onConflict: 'user_id,category' },
        );
      if (error) throw error;
      return ok(`Presupuesto de ${input.categoria}: ${tope} € al mes.`);
    }

    case 'regla_categoria': {
      const patron = String(input.patron ?? '').trim();
      if (patron.length < 2) throw new Error('El patrón necesita al menos dos caracteres.');

      const { error } = await sb
        .from('category_rules')
        .upsert(
          { user_id: userId, pattern: patron, category: input.categoria },
          { onConflict: 'user_id,pattern' },
        );
      if (error) throw error;

      // La regla se aplica también hacia atrás. Solo sobre lo que nadie ha
      // clasificado a mano: una regla nueva no debe pisar una corrección suya.
      const like = `%${patron}%`;
      const { data: tocados, error: e2 } = await sb
        .from('transactions')
        .update({ category: input.categoria })
        .eq('user_id', userId)
        .eq('category', 'sin_clasificar')
        .or(`description.ilike.${like},counterparty.ilike.${like}`)
        .select('id');
      if (e2) throw e2;

      return ok(
        `Regla guardada: lo que contenga "${patron}" es ${input.categoria}. ` +
          `${tocados?.length ?? 0} movimiento(s) antiguos reclasificados.`,
      );
    }

    case 'registrar_movimiento': {
      const importe = Number(input.importe);
      if (!Number.isFinite(importe) || importe === 0) {
        throw new Error(`Importe inválido: ${input.importe}. Negativo si es gasto, positivo si es ingreso.`);
      }
      const fecha = String(input.fecha);
      const desc = String(input.descripcion ?? '').trim();
      if (!desc) throw new Error('Un movimiento sin descripción no sirve de nada dentro de un mes.');

      // Misma huella que usa el importador: si el mismo movimiento acaba
      // llegando también por el extracto, no se cuenta dos veces.
      const huella = `manual|${fecha}|${importe.toFixed(2)}|${desc.toLowerCase().slice(0, 60)}`;
      const { error } = await sb.from('transactions').insert({
        user_id: userId,
        date: fecha,
        amount: importe,
        description: desc,
        category: input.categoria,
        source: 'coach',
        dedup_hash: huella,
      });
      if (error) {
        if (String(error.code) === '23505') return ok('Ese movimiento ya estaba registrado. No se duplica.');
        throw error;
      }
      return ok(
        `${importe < 0 ? 'Gasto' : 'Ingreso'} de ${Math.abs(importe).toFixed(2)} € anotado el ${fecha} como ${input.categoria}.`,
      );
    }

    case 'consultar_historial': {
      const { desde, hasta, filtro } = input;
      const LIMIT = 200;
      const table: Record<string, { t: string; cols: string; dateCol: string }> = {
        completadas: { t: 'completions', cols: 'date, quest_id, xp_awarded', dateCol: 'date' },
        eventos: { t: 'events', cols: 'type, payload, created_at', dateCol: 'created_at' },
        peso: { t: 'body_metrics', cols: 'date, weight_kg, notes', dateCol: 'date' },
        cardio: { t: 'cardio_sessions', cols: 'date, kind, distance_km, duration_min, zone, rpe, avg_hr, notes', dateCol: 'date' },
        nutricion: { t: 'nutrition_logs', cols: 'date, hit_kcal, hit_protein, kcal_est, protein_est, notes', dateCol: 'date' },
        diario: { t: 'journal_entries', cols: 'date, mood, energy, text', dateCol: 'date' },
        reglas_rotas: { t: 'rule_breaks', cols: 'date, rule_id', dateCol: 'date' },
        hechos: { t: 'coach_facts', cols: 'date, category, content', dateCol: 'date' },
        movimientos: { t: 'transactions', cols: 'date, amount, currency, description, counterparty, category, is_internal', dateCol: 'date' },
      };
      // gym_lifts NO tiene fecha propia: la fecha vive en su sesión. Filtrarlo
      // por created_at reventaba con un error de Postgres que además llegaba al
      // modelo como "[object Object]", así que ni podía corregirse solo.
      if (input.que === 'gym') {
        const { data: sesiones, error: e1 } = await sb
          .from('gym_sessions')
          .select('id, date, notes')
          .eq('user_id', userId)
          .gte('date', desde)
          .lte('date', hasta)
          .order('date');
        if (e1) throw e1;
        if (!sesiones?.length) return ok(`Sin sesiones de gimnasio entre ${desde} y ${hasta}.`);

        const porId = new Map(
          (sesiones as { id: string; date: string; notes: string | null }[]).map((x) => [x.id, x]),
        );
        const { data: series, error: e2 } = await sb
          .from('gym_lifts')
          .select('session_id, exercise_name, weight, reps, rpe, set_index')
          .eq('user_id', userId)
          .in('session_id', [...porId.keys()]);
        if (e2) throw e2;

        const filas = ((series ?? []) as Record<string, unknown>[])
          .map((l) => ({
            fecha: porId.get(String(l.session_id))?.date,
            ejercicio: l.exercise_name,
            serie: (Number(l.set_index) || 0) + 1,
            kg: l.weight,
            reps: l.reps,
            rpe: l.rpe,
          }))
          .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || a.serie - b.serie);

        const notas = (sesiones as { date: string; notes: string | null }[])
          .filter((x) => x.notes)
          .map((x) => `${x.date}: ${x.notes}`);
        return ok(
          JSON.stringify({ series: filas, notas }).slice(0, 12000),
        );
      }

      // El plan de comidas es semanal, no una serie temporal: filtrarlo por
      // fechas no tiene sentido y la tabla ni siquiera tiene columna de fecha.
      if (input.que === 'comidas') {
        const { data, error } = await sb
          .from('meal_slots')
          .select('day_of_week, slot, description, ingredients, kcal, protein_g')
          .eq('user_id', userId)
          .order('day_of_week')
          .order('slot');
        if (error) throw error;
        if (!data?.length) return ok('No hay plan de comidas escrito todavía.');
        return ok(JSON.stringify(data).slice(0, 12000));
      }

      const spec = table[input.que];
      if (!spec) throw new Error(`Serie desconocida: ${input.que}`);
      let q = sb.from(spec.t).select(spec.cols).eq('user_id', userId).limit(LIMIT);
      q = q.gte(spec.dateCol, desde).lte(spec.dateCol, spec.dateCol === 'created_at' ? `${hasta}T23:59:59` : hasta);
      const { data, error } = await q;
      if (error) throw error;
      let rows = data ?? [];
      const needleRaw = val(filtro);
      if (needleRaw) {
        const needle = needleRaw.toLowerCase();
        rows = rows.filter((r: any) => JSON.stringify(r).toLowerCase().includes(needle));
      }
      if (!rows.length) return ok(`Sin datos de ${input.que} entre ${desde} y ${hasta}.`);
      return ok(JSON.stringify(rows).slice(0, 12000));
    }

    default:
      throw new Error(`Herramienta desconocida: ${name}`);
  }
}
