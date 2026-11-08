// NIVL · Cálculo puro del entreno: solo Foundation. Copia exacta en
// targets/watch/EntrenoPuro.swift y en modules/nivl-salud/ios/EntrenoPuro.swift
// (un test compara ambas): si tocas una, toca la otra.

import Foundation

enum EntrenoPuro {
  /// Metros entre dos coordenadas (haversine).
  static func distanciaM(lat1: Double, lon1: Double, lat2: Double, lon2: Double) -> Double {
    let radio = 6_371_000.0
    let f1 = lat1 * .pi / 180
    let f2 = lat2 * .pi / 180
    let df = (lat2 - lat1) * .pi / 180
    let dl = (lon2 - lon1) * .pi / 180
    let a = sin(df / 2) * sin(df / 2) + cos(f1) * cos(f2) * sin(dl / 2) * sin(dl / 2)
    return 2 * radio * atan2(sqrt(a), sqrt(1 - a))
  }

  /// `max` elementos repartidos a lo largo de la serie, con el primero y el
  /// último siempre dentro. Mismo reparto que `reducirSerie` en JS.
  static func adelgazarRuta<T>(_ serie: [T], max: Int = 1500) -> [T] {
    guard max >= 2, serie.count > max else { return serie }
    let paso = Double(serie.count - 1) / Double(max - 1)
    return (0..<max).map { serie[Int((Double($0) * paso).rounded())] }
  }
}

/// Auto-pausa propia: no hay API pública fiable. Corre: por debajo de 0,5 m/s
/// durante 6 s pausa y por encima de 1,0 m/s durante 3 s reanuda. Bici: 1,0 y
/// 2,0. Hay una banda muerta entre ambos umbrales para que no parpadee. Sin
/// lecturas fiables no se entra en pausa, pero de una pausa siempre se sale.
struct AutoPausa {
  enum Cambio {
    case pausar
    case reanudar
  }

  let umbralPausa: Double
  let umbralReanudar: Double
  var enPausa = false

  private var lentoDesde: TimeInterval?
  private var rapidoDesde: TimeInterval?
  private var sinDatoDesde: TimeInterval?

  /// Segundos en pausa sin una lectura fiable antes de reanudar sola. Parado
  /// bajo un árbol cuesta unos segundos de más; corriendo, no reanudar costaría
  /// el resto de la sesión.
  private static let segundosSinDato: TimeInterval = 15

  init(esBici: Bool) {
    umbralPausa = esBici ? 1.0 : 0.5
    umbralReanudar = esBici ? 2.0 : 1.0
  }

  /// `t` en segundos, de un reloj que solo avanza.
  mutating func alimentar(velocidad: Double, t: TimeInterval) -> Cambio? {
    sinDatoDesde = nil
    if enPausa {
      guard velocidad > umbralReanudar else {
        rapidoDesde = nil
        return nil
      }
      let desde = rapidoDesde ?? t
      rapidoDesde = desde
      guard t - desde >= 3 else { return nil }
      enPausa = false
      reiniciar()
      return .reanudar
    }
    guard velocidad < umbralPausa else {
      lentoDesde = nil
      return nil
    }
    let desde = lentoDesde ?? t
    lentoDesde = desde
    guard t - desde >= 6 else { return nil }
    enPausa = true
    reiniciar()
    return .pausar
  }

  /// Una lectura que no sirve para decidir, o ninguna. En marcha anula la cuenta
  /// de parado. En pausa no toca la de reanudar: un fix malo entre dos buenos no
  /// debe dejar a nadie en pausa.
  mutating func sinDato(t: TimeInterval) -> Cambio? {
    guard enPausa else {
      lentoDesde = nil
      return nil
    }
    let desde = sinDatoDesde ?? t
    sinDatoDesde = desde
    guard t - desde >= Self.segundosSinDato else { return nil }
    enPausa = false
    reiniciar()
    return .reanudar
  }

  /// Tras una pausa o reanudación a mano, lo medido hasta ahora ya no cuenta.
  mutating func reiniciar() {
    lentoDesde = nil
    rapidoDesde = nil
    sinDatoDesde = nil
  }
}

/// Desnivel positivo con histéresis de 3 m: el ruido de la altitud del GPS no
/// se acumula como subida.
struct DesnivelHisteresis {
  private(set) var ganado = 0.0
  private(set) var referencia: Double?

  init(ganado: Double = 0, referencia: Double? = nil) {
    self.ganado = ganado
    self.referencia = referencia
  }

  mutating func alimentar(_ altitud: Double) {
    guard let r = referencia else {
      referencia = altitud
      return
    }
    if altitud - r >= 3 {
      ganado += altitud - r
      referencia = altitud
    } else if r - altitud >= 3 {
      referencia = altitud
    }
  }
}

/// Parciales por kilómetro a partir de la distancia acumulada.
struct ParcialesKm: Codable {
  struct Parcial: Codable {
    var n: Int
    var distancia_m: Double
    var duracion_s: Double
    var desnivel_m: Double?
  }

  private(set) var cerrados: [Parcial] = []
  private var distanciaBase = 0.0
  private var tiempoBase = 0.0
  private var desnivelBase = 0.0

  /// El kilómetro en curso, desde 1. Si uno se saltó por no tener tiempo
  /// medido, los siguientes conservan su número real.
  private var kmEnCurso: Int { Int(distanciaBase / 1000) + 1 }

  /// Cierra todos los kilómetros que `distancia` haya cruzado. `t` son segundos
  /// en movimiento. Tiempo y desnivel se reparten a prorrata del tramo: tras un
  /// túnel una sola lectura cruza varios kilómetros, y darle todo el tiempo al
  /// primero dejaba a los demás en un segundo inventado.
  mutating func alimentar(distancia: Double, t: Double, desnivel: Double) {
    let tramo = distancia - distanciaBase
    guard tramo >= 1000 else { return }
    let porMetro = max(0, t - tiempoBase) / tramo
    let subidaPorMetro = max(0, desnivel - desnivelBase) / tramo
    while distancia - distanciaBase >= 1000 {
      let duracion = porMetro * 1000
      let subida = subidaPorMetro * 1000
      // Menos de un segundo por kilómetro no es un tiempo medido: sin parcial.
      if duracion >= 1 {
        cerrados.append(Parcial(n: kmEnCurso, distancia_m: 1000, duracion_s: duracion, desnivel_m: subida))
      }
      distanciaBase += 1000
      tiempoBase += duracion
      desnivelBase += subida
    }
  }

  /// Los cerrados más el tramo final si llega a 50 m y a un segundo.
  func conResto(distancia: Double, t: Double, desnivel: Double) -> [Parcial] {
    var todos = cerrados
    let resto = distancia - distanciaBase
    let tiempo = t - tiempoBase
    if resto >= 50, tiempo >= 1 {
      todos.append(
        Parcial(
          n: kmEnCurso,
          distancia_m: resto,
          duracion_s: tiempo,
          desnivel_m: max(0, desnivel - desnivelBase)
        ))
    }
    return todos
  }
}
