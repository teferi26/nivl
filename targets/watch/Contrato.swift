// NIVL · Apple Watch: copia en Swift del contrato de src/watch/contrato.ts.
// Si tocas uno, toca el otro. El reloj ignora claves que no conoce y acepta
// que falten las opcionales: un iPhone más nuevo no rompe un reloj más viejo.

import Foundation

let VERSION_CONTRATO = 1

struct MisionReloj: Codable, Identifiable, Hashable {
  let id: String
  let titulo: String
  let dificultad: String
  let premio: Int
  let unidad: String
  let enlace: String?
  var hecha: Bool
  let penalizacion: Bool
  let extra: Bool
  let requiereFoto: Bool
  let bloqueada: Bool

  /// «hasta +55 XP»: el servidor puede recortar (topes, racha).
  var textoPremio: String {
    if penalizacion { return "Recupera \(premio) XP" }
    return "hasta +\(premio) \(unidad)"
  }

  var nombreDificultad: String {
    switch dificultad {
    case "trivial": return "Trivial"
    case "facil": return "Fácil"
    case "media": return "Media"
    case "dificil": return "Difícil"
    case "epica": return "Épica"
    default: return dificultad.capitalized
    }
  }

  /// El módulo que la marca solo, si lo hay (gym, cardio, …).
  var nombreModulo: String? {
    switch enlace {
    case "gym": return "el gimnasio"
    case "cardio": return "cardio"
    case "nutricion": return "nutrición"
    case "peso": return "el peso"
    case "diario": return "el diario"
    default: return nil
    }
  }
}

struct FocusReloj: Codable, Hashable {
  /// foco · descanso · largo
  let fase: String
  /// parado · en_marcha · en_pausa
  let situacion: String
  /// ms de época
  let finEn: Double?
  let restanteMs: Double
  let totalMs: Double
  let bloque: Int
  let cadaLargo: Int

  var nombreFase: String {
    switch fase {
    case "descanso": return "DESCANSO"
    case "largo": return "DESCANSO LARGO"
    default: return "FOCO"
    }
  }
}

struct IronReloj: Codable, Hashable {
  let ejercicio: String
  let serie: Int
  let series: Int
  let reps: String
  let carga: Double?
  let descansoS: Int
  let siguiente: String
}

struct EstadoReloj: Codable, Equatable {
  let v: Int
  let generadoEn: Double
  let fecha: String
  let sesion: Bool
  var misiones: [MisionReloj]
  let racha: Int
  let rachaCerrada: Bool
  let nivel: Int
  let xpEnNivel: Int
  let xpSiguiente: Int
  let rango: String
  let titulo: String
  let piedras: Int
  let piedrasMax: Int
  let focus: FocusReloj?
  let iron: IronReloj?

  var pendientes: Int { misiones.filter { !$0.hecha && !$0.extra && !$0.penalizacion }.count }
  var cuentan: Int { misiones.filter { !$0.extra && !$0.penalizacion }.count }

  /// Fracción de la barra de nivel (1 en el nivel máximo).
  var progresoNivel: Double {
    guard xpSiguiente > 0 else { return 1 }
    return min(1, max(0, Double(xpEnNivel) / Double(xpSiguiente)))
  }

  /// Las misiones son de hoy (hora del reloj). Si no, el iPhone aún no ha
  /// publicado el día nuevo y no se puede completar nada.
  var esDeHoy: Bool { fecha == Self.claveHoy() }

  static func claveHoy(_ d: Date = Date()) -> String {
    let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
  }
}

/// Lo que el reloj pide al iPhone (PeticionReloj en el contrato).
enum PeticionReloj {
  case completar(id: String, fecha: String)
  case focus(accion: String)
  case estado

  var json: String {
    let dict: [String: String]
    switch self {
    case let .completar(id, fecha): dict = ["tipo": "completar", "id": id, "fecha": fecha]
    case let .focus(accion): dict = ["tipo": "focus", "accion": accion]
    case .estado: dict = ["tipo": "estado"]
    }
    let data = (try? JSONSerialization.data(withJSONObject: dict)) ?? Data("{}".utf8)
    return String(decoding: data, as: UTF8.self)
  }
}

struct RespuestaReloj: Codable {
  let ok: Bool
  let premio: Int?
  let motivo: String?
}

/// Lo poco que lee la complicación (copia en targets/watch-complicacion).
struct ResumenComplicacion: Codable {
  let racha: Int
  let pendientes: Int
  let total: Int
  let nivel: Int
  let rango: String
  let fecha: String
  let sesion: Bool
}

enum AppGroup {
  static let id = "group.com.teferi.nivl"
  static let claveResumen = "nivl.reloj.resumen"
}
