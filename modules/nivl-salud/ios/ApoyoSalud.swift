// NIVL · Utilidades del módulo de Salud: fechas y números para el JSON del
// contrato EntrenoMedido. Solo Foundation.

import Foundation

enum ApoyoSalud {
  /// ISO 8601 en UTC, como pide el contrato. Este formateador es seguro entre hilos.
  private static let iso: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
  }()

  private static let isoSinFraccion: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f
  }()

  static func texto(_ fecha: Date) -> String {
    iso.string(from: fecha)
  }

  static func fecha(_ texto: String) -> Date? {
    iso.date(from: texto) ?? isoSinFraccion.date(from: texto)
  }

  /// El calendario es gregoriano aunque el teléfono use otro: `YYYY-MM-DD`
  /// siempre habla en gregoriano, y el día es el local de la persona.
  static let calendario: Calendar = {
    var c = Calendar(identifier: .gregorian)
    c.timeZone = .current
    return c
  }()

  /// Medianoche local del día `YYYY-MM-DD`, o nil si no es una fecha real.
  static func inicioDeDia(_ texto: String) -> Date? {
    let partes = texto.split(separator: "-").compactMap { Int($0) }
    guard partes.count == 3 else { return nil }
    var cal = calendario
    cal.timeZone = .current
    var c = DateComponents()
    c.year = partes[0]
    c.month = partes[1]
    c.day = partes[2]
    guard c.isValidDate(in: cal), let dia = cal.date(from: c) else { return nil }
    return cal.startOfDay(for: dia)
  }

  /// Número para el JSON o para JS: lo no medido es null, nunca 0, y un NaN
  /// jamás llega a JSONSerialization (lanzaría una excepción que no se captura).
  static func num(_ x: Double?, decimales: Int = 0) -> Any {
    guard let x, x.isFinite else { return NSNull() }
    let f = pow(10.0, Double(decimales))
    return (x * f).rounded() / f
  }

  /// Como `num`, pero un cero también cuenta como «sin medir» (totales de un
  /// entreno que no tiene ese sensor).
  static func numPositivo(_ x: Double?, decimales: Int = 0) -> Any {
    guard let x, x > 0 else { return NSNull() }
    return num(x, decimales: decimales)
  }

  static func json(_ objeto: [String: Any]) -> String? {
    guard JSONSerialization.isValidJSONObject(objeto),
      let datos = try? JSONSerialization.data(withJSONObject: objeto)
    else { return nil }
    return String(data: datos, encoding: .utf8)
  }
}

/// Convierte la hora del reloj de pared en segundos EN MOVIMIENTO desde el
/// inicio. `normalizarEntreno` descarta lo que pase de `duracion_s + 60`, y
/// `duracion_s` no incluye pausas: con segundos de reloj de pared, una pausa
/// larga haría perder el final de la ruta y del pulso.
struct RelojActivo {
  let inicio: Date
  /// Ordenadas y sin solapar.
  let pausas: [DateInterval]

  /// Segundos en movimiento en `fecha`, o nil si cae dentro de una pausa o
  /// fuera del entreno.
  func segundos(en fecha: Date) -> Double? {
    guard fecha >= inicio else { return nil }
    var parado = 0.0
    for p in pausas {
      if fecha < p.start { break }
      if fecha <= p.end { return nil }
      parado += p.duration
    }
    return fecha.timeIntervalSince(inicio) - parado
  }
}
