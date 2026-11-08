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
  /// Permiso de salud de NIVL. nil = no consta: el reloj no mide.
  var saludAceptada: Bool? = nil
  /// La cuenta del iPhone, para sellar los entrenos que se midan aquí.
  var dueno: String? = nil

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

// MARK: Entreno medido (copia de src/lib/entrenoMedido.ts, si tocas uno, toca el otro)

/// Lo que se puede entrenar desde la muñeca. El rawValue es el `deporte` del contrato.
enum DeporteReloj: String, Codable, CaseIterable, Identifiable, Hashable {
  case carrera
  case bici
  case piscina
  case aguasAbiertas = "aguas_abiertas"
  case fuerza

  var id: String { rawValue }
}

/// `t` son segundos desde `inicio`, con el mismo reloj que `duracion_s`.
struct PuntoRuta: Codable, Hashable {
  let t: Double
  let lat: Double
  let lon: Double
  let alt: Double?

  func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(t, forKey: .t)
    try c.encode(lat, forKey: .lat)
    try c.encode(lon, forKey: .lon)
    try c.encode(alt, forKey: .alt)
  }
}

struct MuestraFc: Codable, Hashable {
  let t: Double
  let bpm: Double
}

/// `tipo`: km · largo · vuelta · transicion. Sin distancia medida, `distancia_m` es 0.
struct ParcialMedido: Codable, Hashable {
  let n: Int
  let tipo: String
  let distancia_m: Double
  let duracion_s: Double
  let fc_media: Double?
  let desnivel_m: Double?

  func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(n, forKey: .n)
    try c.encode(tipo, forKey: .tipo)
    try c.encode(distancia_m, forKey: .distancia_m)
    try c.encode(duracion_s, forKey: .duracion_s)
    try c.encode(fc_media, forKey: .fc_media)
    try c.encode(desnivel_m, forKey: .desnivel_m)
  }
}

/// Lo que se manda al iPhone. Lo no medido sale como null explícito: un 0 se
/// leería como medido.
struct EntrenoMedido: Codable, Hashable {
  var origen = "watch"
  let externo_id: String
  let deporte: String
  /// ISO 8601 en UTC.
  let inicio: String
  let fin: String
  /// En movimiento, sin pausas.
  let duracion_s: Double
  let distancia_m: Double?
  let kcal: Double?
  let fc_media: Double?
  let fc_max: Double?
  let desnivel_m: Double?
  let ruta: [PuntoRuta]?
  let parciales: [ParcialMedido]
  let largo_piscina_m: Double?
  let fc_serie: [MuestraFc]?
  /// Solo para el buzón: el iPhone no entrega a una cuenta lo medido por otra.
  var dueno: String? = nil

  func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(origen, forKey: .origen)
    try c.encode(externo_id, forKey: .externo_id)
    try c.encode(deporte, forKey: .deporte)
    try c.encode(inicio, forKey: .inicio)
    try c.encode(fin, forKey: .fin)
    try c.encode(duracion_s, forKey: .duracion_s)
    try c.encode(distancia_m, forKey: .distancia_m)
    try c.encode(kcal, forKey: .kcal)
    try c.encode(fc_media, forKey: .fc_media)
    try c.encode(fc_max, forKey: .fc_max)
    try c.encode(desnivel_m, forKey: .desnivel_m)
    try c.encode(ruta, forKey: .ruta)
    try c.encode(parciales, forKey: .parciales)
    try c.encode(largo_piscina_m, forKey: .largo_piscina_m)
    try c.encode(fc_serie, forKey: .fc_serie)
    try c.encodeIfPresent(dueno, forKey: .dueno)
  }
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
