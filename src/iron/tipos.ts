// NIVL · IRON · Motor de ejercicios: el esquema de datos.
//
// Cada ejercicio es un archivo de datos (src/iron/ejercicios/<id>.ts) que
// cumple `Ejercicio`. El motor (esqueleto.ts + interpolar.ts + dibujo.ts)
// genera la animación a partir de las poses clave; nada se dibuja a mano por
// ejercicio. Arquitectura y cómo se añade uno: docs/modos/F1-motor.md.
//
// Convenciones (las comprueba src/iron/__tests__/esquema.test.ts):
// · Mundo en unidades de cuerpo: 100 ≈ la altura de la persona de pie. Eje y
//   hacia arriba, suelo en y = 0. En la vista lateral la persona mira a +x
//   (salvo que el ancla gire el tronco: tumbada, a cuatro patas...).
// · Ángulos en grados, en el plano de la vista (lo que se ve dibujado). Si
//   un segmento sale del plano (los codos abiertos en el press de banca), se
//   indica con `escorzo` (0 a 1: cuánto de su largo se ve) y el ángulo es el
//   del dibujo, no el anatómico.
// · Articulaciones (positivo = flexión; en la vista frontal, hombro y cadera
//   son abducción):
//     cadera   muslo respecto al tronco    0 = alineados, + = el muslo sube por delante
//     rodilla  pierna respecto al muslo    0 = estirada,  + = el talón va hacia atrás
//     tobillo  pie respecto a la pierna    0 = pie a 90°, + = flexión dorsal (rodilla delante)
//     hombro   brazo respecto al tronco    0 = brazo pegado, + = el brazo sube por delante
//     codo     antebrazo respecto al brazo 0 = estirado,  + = la mano sube
//     cuello   cabeza respecto al tronco   0 = neutro,    + = barbilla al pecho
// · `cerca` es el lado que ve la cámara (el derecho de la persona en la vista
//   lateral); `lejos`, el otro. Si `lejos` no se da, es igual que `cerca`.

/**
 * Las claves de i18n van con su namespace: «iron:ejercicios.<id>.nombre», o
 * el de su grupo en la fase 2 («iron-core:ejercicios.<id>.nombre»).
 */
export type ClaveI18n = `iron:${string}` | `iron-${string}:${string}`;

export type Articulacion = 'cadera' | 'rodilla' | 'tobillo' | 'hombro' | 'codo';
export const ARTICULACIONES: readonly Articulacion[] = ['cadera', 'rodilla', 'tobillo', 'hombro', 'codo'];

/** Ángulo de cada articulación de un lado, en grados. */
export type Extremidades = Readonly<Record<Articulacion, number>>;

export type Lado = 'cerca' | 'lejos';

export type SegmentoId =
  | 'tronco'
  | 'cabeza'
  | 'muslo_c'
  | 'pierna_c'
  | 'pie_c'
  | 'brazo_c'
  | 'antebrazo_c'
  | 'muslo_l'
  | 'pierna_l'
  | 'pie_l'
  | 'brazo_l'
  | 'antebrazo_l';

export type PuntoId =
  | 'cadera'
  | 'hombro'
  | 'cabeza'
  | 'rodilla_c'
  | 'tobillo_c'
  | 'punta_c'
  | 'codo_c'
  | 'muneca_c'
  | 'agarre_c'
  | 'rodilla_l'
  | 'tobillo_l'
  | 'punta_l'
  | 'codo_l'
  | 'muneca_l'
  | 'agarre_l';

export type Vista = 'lateral' | 'frontal';

/** Una pose clave. `ms` es el instante dentro del ciclo (la primera, en 0). */
export interface Pose {
  readonly ms: number;
  readonly cuello: number;
  readonly cerca: Extremidades;
  readonly lejos?: Extremidades;
  /** Ángulo del segmento del ancla en esta pose (si cambia; si no, el del ancla). */
  readonly angulo?: number;
  /** Cuánto se ve de cada segmento que sale del plano (1 = entero). */
  readonly escorzo?: Readonly<Partial<Record<SegmentoId, number>>>;
  /**
   * Dónde está el punto del ancla en esta pose, si se mueve (saltos, burpees):
   * se interpola como los ángulos. Si no se da, el del ancla.
   */
  readonly punto?: { readonly x: number; readonly y: number };
}

/**
 * El punto fijo del cuerpo y la orientación de un segmento: desde ahí se
 * construye todo el esqueleto. Sentadilla: el tobillo en el suelo y el pie
 * plano. Press de banca: la cadera sobre el banco y el tronco tumbado.
 */
export interface Ancla {
  readonly punto: PuntoId;
  readonly x: number;
  readonly y: number;
  readonly segmento: SegmentoId;
  /** Ángulo absoluto del segmento: 0 = hacia +x, 90 = hacia arriba. */
  readonly angulo: number;
}

export type Material =
  | 'barra'
  | 'mancuerna'
  | 'banco'
  | 'peso_corporal'
  | 'polea'
  | 'maquina'
  | 'kettlebell'
  | 'banda'
  // core
  | 'esterilla'
  | 'comba'
  | 'rueda';

/**
 * Cómo se ve la barra. De perfil puro la barra es un punto y el disco tapa
 * cabeza y torso; con `eje` la cámara está en 3/4: la barra se dibuja como un
 * tramo que sale del centro, con el disco cercano en `centro + eje` y el
 * lejano en `centro - eje` (detrás del cuerpo). `disco`: radio del disco.
 */
export interface VistaBarra {
  readonly eje?: { readonly x: number; readonly y: number };
  readonly disco?: number;
}

/** Dónde va la carga que se dibuja. */
export type Carga =
  | ({ readonly tipo: 'barra'; readonly en: 'agarre' } & VistaBarra)
  | ({
      readonly tipo: 'barra';
      /** Sobre el tronco: `t` de 0 (cadera) a 1 (hombro); `dorso` > 0 la lleva a la espalda. */
      readonly en: 'tronco';
      readonly t: number;
      readonly dorso: number;
    } & VistaBarra)
  | {
      readonly tipo: 'mancuerna';
      readonly en: 'agarre';
      /** `punta`: se ve de frente (agarre en supinación); `lado`: se ve a lo largo (agarre neutro). */
      readonly orientacion: 'punta' | 'lado';
      readonly lados: readonly Lado[];
    }
  // core: la comba gira `vueltas` veces por ciclo (la cuerda va detrás del cuerpo).
  | { readonly tipo: 'comba'; readonly vueltas: number }
  // core: la rueda abdominal, en las manos y apoyada en el suelo.
  | { readonly tipo: 'rueda'; readonly radio: number };

/** Lo que hay en el mundo y no se mueve. */
export interface Escenario {
  /** 'esterilla' (core): una lámina en el suelo de grosor `alto`. */
  readonly tipo: 'banco' | 'esterilla';
  /** Extremo izquierdo, largo y altura del tablero (el suelo es y = 0). */
  readonly x: number;
  readonly ancho: number;
  readonly alto: number;
  /** 'fondo': detrás de todo (lo que se apoya encima se ve). 'medio': entre el lado lejano y el cercano. */
  readonly capa: 'fondo' | 'medio';
}

export type MusculoId =
  | 'pectoral'
  | 'deltoides_anterior'
  | 'deltoides_lateral'
  | 'deltoides_posterior'
  | 'biceps'
  | 'triceps'
  | 'antebrazo'
  | 'dorsal'
  | 'trapecio'
  | 'espalda_alta'
  | 'lumbares'
  | 'abdomen'
  | 'oblicuos'
  | 'gluteo'
  | 'cuadriceps'
  | 'isquiotibiales'
  | 'aductores'
  | 'gemelos'
  | 'tibial'
  // core
  | 'transverso'
  | 'serrato'
  | 'cuello';

/**
 * 'cardio' y 'movilidad' (core, fase 2) son grupos de entrega sin músculo
 * propio: sus ejercicios no siguen la regla «grupo = el del primer principal».
 */
export type GrupoMuscular = 'pecho' | 'espalda' | 'hombro' | 'brazo' | 'pierna' | 'core' | 'cardio' | 'movilidad';

export type Nivel = 'principiante' | 'intermedio' | 'avanzado';

export interface Ejercicio {
  /** Igual que el nombre del archivo, en minúsculas con guiones. */
  readonly id: string;
  readonly nombre: ClaveI18n;
  readonly grupo: GrupoMuscular;
  readonly nivel: Nivel;
  /** 'isometrico': se aguanta una postura (plancha); la animación late en el músculo. */
  readonly tipo: 'dinamico' | 'isometrico';
  /** Todo lo que hace falta. El primero es el principal. */
  readonly material: readonly Material[];
  readonly musculos: {
    readonly principales: readonly MusculoId[];
    readonly secundarios: readonly MusculoId[];
  };
  /** Ids de otros ejercicios que lo sustituyen, del mejor al peor. */
  readonly sustitutos: readonly string[];
  readonly vista: Vista;
  readonly ancla: Ancla;
  /** Al menos dos; ordenadas por `ms`; la última vuelve a la primera. */
  readonly poses: readonly Pose[];
  /** Duración del ciclo completo (de la primera pose a sí misma), en ms. */
  readonly cicloMs: number;
  /**
   * Fase de esfuerzo (la concéntrica: subir, empujar, tirar), en ms del
   * ciclo: el músculo principal brilla. En un isométrico, todo el ciclo.
   */
  readonly esfuerzo: readonly { readonly desde: number; readonly hasta: number }[];
  /**
   * Instante que se enseña quieto (ficha, PNG y «reducir movimiento»). Si no
   * se da, la pose clave central. Elige uno en el que se vea el principal.
   */
  readonly msFicha?: number;
  readonly carga?: Carga;
  readonly escenario?: readonly Escenario[];
  /** Ventana del dibujo en unidades de mundo. */
  readonly encuadre: { readonly x: number; readonly y: number; readonly ancho: number; readonly alto: number };
  /** De 2 a 4 consignas cortas, de técnica y seguridad. */
  readonly cues: readonly ClaveI18n[];
  /** Errores comunes que corrige el sistema. */
  readonly errores: readonly ClaveI18n[];
}
