// NIVL TV · Modelos de solo lectura que pintan las vistas.
//
// Llegan de `tv_datos` (Contrato.swift) o, solo en la demo, de Demo.swift.
// Aquí no se calcula nada: los números llegan hechos.

import Foundation

struct EjercicioTV: Identifiable, Equatable {
    let id: String
    let nombre: String
    let series: Int
    /// Repeticiones prescritas («8» o «8 a 10»).
    let reps: String
    /// Carga prescrita; nil = sin carga prescrita, y entonces no se pinta.
    let cargaKg: Double?
    /// 0 = encadena las series sin descanso.
    let descansoSeg: Int
    /// Símbolo del sistema para la figura de técnica. nil con datos reales:
    /// el servidor no la da y la vista no se inventa una.
    let figura: String?
    /// El servidor no los da: quedan vacíos con datos reales y la vista los omite.
    let musculos: [String]
    let tecnica: [String]
}

struct RutinaTV: Equatable {
    let nombre: String
    let dia: String
    let ejercicios: [EjercicioTV]
    /// Ya hay una sesión registrada hoy (en el iPhone).
    var hecha = false

    var seriesTotales: Int { ejercicios.reduce(0) { $0 + $1.series } }

    /// Con algo que enseñar en la columna de técnica. Si no, la columna no existe.
    var tieneTecnica: Bool {
        ejercicios.contains { $0.figura != nil || !$0.tecnica.isEmpty || !$0.musculos.isEmpty }
    }
}

/// El siguiente día con entreno, para cuando hoy no toca.
struct ProximaSesion: Equatable {
    let nombre: String
    /// 1 lunes a 7 domingo.
    let diaSemana: Int
    /// 1 = mañana.
    let enDias: Int
    let ejercicios: Int
}

struct FilaArena: Identifiable, Equatable {
    let id: String
    let soyYo: Bool
    let nombre: String
    let titulo: String
    /// Rango registrado por el servidor (E a S).
    let rango: String
    let xpTotal: Int
    let xpVentana: Int
    let racha: Int
    /// nil = sin medir, que no es lo mismo que 0.
    let cumplimientoPct: Int?
    let elite: Bool
}

struct FilaLudus: Identifiable, Equatable {
    let id: String
    let nombre: String
    let xpVentana: Int
    let cumplimientoPct: Int?
    let soyYo: Bool
}

struct LudusTV: Equatable {
    let nombre: String
    let miembros: [FilaLudus]
}

struct DiaSemana: Identifiable, Equatable {
    let id: String
    /// Inicial del día (L, M, X, J, V, S, D).
    let inicial: String
    let hechas: Int
    let falladas: Int
}

struct PuntoPeso: Identifiable, Equatable {
    let id: Int
    /// Día relativo (0 = hace 27 días).
    let dia: Int
    let kg: Double
}

struct SemanaTV: Equatable {
    let racha: Int
    let piedras: Int
    let piedrasMax: Int
    let xpGanado: Int
    let hechas: Int
    let falladas: Int
    let dias: [DiaSemana]
    /// Heatmap de 12 semanas: fracción cumplida por día (0...1), de la más
    /// antigua a la actual, 7 valores por semana.
    let mapa: [[Double]]
    let pesos: [PuntoPeso]
    /// Del estudio de peso (mínimos cuadrados, en el servidor): kg por semana.
    /// nil con menos de 3 pesajes o sin consentimiento de salud.
    let tendenciaKgSemana: Double?
    /// Recta del estudio: valor al principio y al final de la ventana.
    let tendenciaInicio: Double?
    let tendenciaFin: Double?
    let lectura: String?
}

struct PerfilTV: Equatable {
    let nombre: String
    let titulo: String
    let rango: String
    let xpTotal: Int
    let elite: Bool
}

/// Todo lo que pinta la TV, en una sola lectura.
struct DatosTV: Equatable {
    let perfil: PerfilTV
    let saludActiva: Bool
    let rutina: RutinaTV?
    var ironAbierto = true
    let arena: [FilaArena]
    let ludus: LudusTV?
    let semana: SemanaTV
    var proxima: ProximaSesion?
}
