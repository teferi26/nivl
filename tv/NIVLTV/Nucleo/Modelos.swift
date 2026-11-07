// NIVL TV · Modelos de solo lectura.
//
// Cada uno calca lo que la app ya lee del servidor, para que la v2 cambie la
// demo por Supabase sin rehacer las vistas:
// - RutinaTV / EjercicioTV: la prescripción del día de IRON (sesión de gym).
// - FilaArena: una fila de la RPC `friends_board` (0021); `elite` sale de
//   `fetchEliteBadges` (0026). FilaLudus: `elite_group_board`.
// - SemanaTV: los estudios ya calculados (analytics.ts) y el cierre de días.
//   Aquí no se calcula nada: los números llegan hechos.

import Foundation

struct EjercicioTV: Identifiable, Equatable {
    let id: String
    let nombre: String
    let series: Int
    /// Repeticiones prescritas («8» o «8 a 10»).
    let reps: String
    /// Carga prescrita; nil = peso corporal.
    let cargaKg: Double?
    let descansoSeg: Int
    /// Símbolo del sistema para la figura de técnica (monocromo).
    let figura: String
    let musculos: [String]
    let tecnica: [String]
}

struct RutinaTV: Equatable {
    let nombre: String
    let dia: String
    let ejercicios: [EjercicioTV]

    var seriesTotales: Int { ejercicios.reduce(0) { $0 + $1.series } }
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
    let cumplimientoPct: Int
    let elite: Bool
}

struct FilaLudus: Identifiable, Equatable {
    let id: String
    let nombre: String
    let xpVentana: Int
    let cumplimientoPct: Int
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
    let xpGanado: Int
    let hechas: Int
    let falladas: Int
    let dias: [DiaSemana]
    /// Heatmap de 12 semanas: fracción cumplida por día (0...1), de la más
    /// antigua a la actual, 7 valores por semana.
    let mapa: [[Double]]
    let pesos: [PuntoPeso]
    /// Del estudio de peso (mínimos cuadrados, analytics.ts): kg por semana.
    let tendenciaKgSemana: Double
    /// Recta del estudio: valor al principio y al final de la ventana.
    let tendenciaInicio: Double
    let tendenciaFin: Double
    let lectura: String
}
