// NIVL · Lectura de Apple Salud.
//
// · HealthKit no dice si se concedió la LECTURA: sin permiso, las consultas
//   devuelven vacío. Por eso «sin muestras» y «sin permiso» son lo mismo: null.
// · Un error de verdad (p. ej. el teléfono bloqueado, con la base de datos
//   cifrada) se lanza: si se contestara con nulls, JS los subiría encima de un
//   resumen bueno.
// · El ancla de importación solo avanza con `confirmarAncla`, después de que
//   JS haya guardado: un cierre a mitad reimporta, y JS deduplica por externo_id.

import CoreLocation
import Foundation
import HealthKit

enum ErrorSalud: Error {
  case noDisponible
  case fechaInvalida(String)
}

final class LectorSalud: @unchecked Sendable {
  static let compartido = LectorSalud()

  let store = HKHealthStore()

  private let claveAncla = "nivl.salud.anclaEntrenos"
  private let bpm = HKUnit.count().unitDivided(by: .minute())

  // MARK: Permisos

  static func disponible() -> Bool {
    HKHealthStore.isHealthDataAvailable()
  }

  private func tiposLectura(_ categorias: [String]) -> Set<HKObjectType> {
    var tipos = Set<HKObjectType>()
    for categoria in categorias {
      switch categoria {
      case "peso":
        tipos.insert(HKQuantityType(.bodyMass))
      case "pasos":
        tipos.insert(HKQuantityType(.stepCount))
      case "energia":
        tipos.insert(HKQuantityType(.activeEnergyBurned))
      case "fc":
        tipos.insert(HKQuantityType(.heartRate))
        tipos.insert(HKQuantityType(.restingHeartRate))
      case "sueno":
        tipos.insert(HKCategoryType(.sleepAnalysis))
      case "entrenos":
        tipos.insert(HKObjectType.workoutType())
        tipos.insert(HKSeriesType.workoutRoute())
      default:
        break
      }
    }
    return tipos
  }

  private var tiposEscritura: Set<HKSampleType> {
    [
      HKObjectType.workoutType(),
      HKSeriesType.workoutRoute(),
      HKQuantityType(.distanceWalkingRunning),
      HKQuantityType(.distanceCycling),
    ]
  }

  func pedirPermisos(categorias: [String], escribirEntrenos: Bool) async throws {
    guard Self.disponible() else { throw ErrorSalud.noDisponible }
    let lectura = tiposLectura(categorias)
    let escritura = escribirEntrenos ? tiposEscritura : []
    // Con los dos conjuntos vacíos HealthKit responde con error.
    guard !lectura.isEmpty || !escritura.isEmpty else { return }
    try await store.requestAuthorization(toShare: escritura, read: lectura)
  }

  func hayQuePreguntar(categorias: [String]) async throws -> Bool {
    guard Self.disponible() else { return false }
    let lectura = tiposLectura(categorias)
    guard !lectura.isEmpty else { return false }
    let estado = try await store.statusForAuthorizationRequest(toShare: [], read: lectura)
    return estado != .unnecessary
  }

  // MARK: Resumen del día

  func resumenDia(fecha: String) async throws -> [String: Any] {
    guard Self.disponible() else { throw ErrorSalud.noDisponible }
    guard let inicio = ApoyoSalud.inicioDeDia(fecha),
      let fin = ApoyoSalud.calendario.date(byAdding: .day, value: 1, to: inicio)
    else { throw ErrorSalud.fechaInvalida(fecha) }

    async let pasos = suma(.stepCount, .count(), inicio, fin)
    async let kcal = suma(.activeEnergyBurned, .kilocalorie(), inicio, fin)
    async let fc = pulso(.heartRate, inicio, fin)
    async let reposo = pulso(.restingHeartRate, inicio, fin)
    async let sueno = suenoMinutos(diaInicio: inicio)
    async let peso = ultimoPeso(inicio, fin)

    let (p, k, f, r, s, w) = try await (pasos, kcal, fc, reposo, sueno, peso)
    return [
      "fecha": fecha,
      "pasos": ApoyoSalud.num(p),
      "kcal_activas": ApoyoSalud.num(k),
      "fc_media": ApoyoSalud.num(f.media),
      "fc_max": ApoyoSalud.num(f.max),
      "fc_reposo": ApoyoSalud.num(r.media),
      "sueno_min": ApoyoSalud.num(s),
      "peso_kg": ApoyoSalud.num(w, decimales: 2),
    ]
  }

  func ventanaActividad(inicioISO: String, finISO: String) async throws -> [String: Any] {
    guard Self.disponible() else { throw ErrorSalud.noDisponible }
    guard let inicio = ApoyoSalud.fecha(inicioISO) else { throw ErrorSalud.fechaInvalida(inicioISO) }
    guard let fin = ApoyoSalud.fecha(finISO) else { throw ErrorSalud.fechaInvalida(finISO) }

    async let pasos = suma(.stepCount, .count(), inicio, fin)
    async let kcal = suma(.activeEnergyBurned, .kilocalorie(), inicio, fin)
    async let fc = pulso(.heartRate, inicio, fin)
    async let muestras = muestrasCantidad(.heartRate, inicio, fin)

    let (p, k, f, m) = try await (pasos, kcal, fc, muestras)
    // `count`: una sola muestra en serie puede contener muchas lecturas.
    let lecturas = m.reduce(0) { $0 + $1.count }
    return [
      "kcal_activas": ApoyoSalud.num(k),
      "pasos": ApoyoSalud.num(p),
      "fc_media": ApoyoSalud.num(f.media),
      "fc_max": ApoyoSalud.num(f.max),
      "muestras_fc": lecturas,
    ]
  }

  // MARK: Consultas

  private func predicado(_ inicio: Date, _ fin: Date) -> NSPredicate {
    HKQuery.predicateForSamples(withStart: inicio, end: fin, options: [.strictStartDate])
  }

  /// Sin datos o sin permiso no son fallos: son «no hay muestras».
  private func esSinDatos(_ error: Error) -> Bool {
    let e = error as NSError
    guard e.domain == HKErrorDomain else { return false }
    return e.code == HKError.Code.errorNoData.rawValue
      || e.code == HKError.Code.errorAuthorizationDenied.rawValue
      || e.code == HKError.Code.errorAuthorizationNotDetermined.rawValue
  }

  private func estadistica(
    _ identificador: HKQuantityTypeIdentifier,
    _ inicio: Date,
    _ fin: Date,
    _ opciones: HKStatisticsOptions
  ) async throws -> HKStatistics? {
    try await withCheckedThrowingContinuation { c in
      let consulta = HKStatisticsQuery(
        quantityType: HKQuantityType(identificador),
        quantitySamplePredicate: predicado(inicio, fin),
        options: opciones
      ) { [self] _, estadisticas, error in
        if let error, !esSinDatos(error) {
          c.resume(throwing: error)
        } else {
          c.resume(returning: estadisticas)
        }
      }
      store.execute(consulta)
    }
  }

  private func suma(
    _ identificador: HKQuantityTypeIdentifier,
    _ unidad: HKUnit,
    _ inicio: Date,
    _ fin: Date
  ) async throws -> Double? {
    let e = try await estadistica(identificador, inicio, fin, .cumulativeSum)
    return e?.sumQuantity()?.doubleValue(for: unidad)
  }

  private func pulso(
    _ identificador: HKQuantityTypeIdentifier,
    _ inicio: Date,
    _ fin: Date
  ) async throws -> (media: Double?, max: Double?) {
    let e = try await estadistica(identificador, inicio, fin, [.discreteAverage, .discreteMax])
    return (
      e?.averageQuantity()?.doubleValue(for: bpm),
      e?.maximumQuantity()?.doubleValue(for: bpm)
    )
  }

  private func muestras(
    tipo: HKSampleType,
    predicado: NSPredicate,
    limite: Int,
    masRecienteAntes: Bool = false
  ) async throws -> [HKSample] {
    try await withCheckedThrowingContinuation { c in
      let orden = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: !masRecienteAntes)
      let consulta = HKSampleQuery(
        sampleType: tipo,
        predicate: predicado,
        limit: limite,
        sortDescriptors: [orden]
      ) { [self] _, resultado, error in
        if let error, !esSinDatos(error) {
          c.resume(throwing: error)
        } else {
          c.resume(returning: resultado ?? [])
        }
      }
      store.execute(consulta)
    }
  }

  private func muestrasCantidad(
    _ identificador: HKQuantityTypeIdentifier,
    _ inicio: Date,
    _ fin: Date
  ) async throws -> [HKQuantitySample] {
    let lista = try await muestras(
      tipo: HKQuantityType(identificador),
      predicado: predicado(inicio, fin),
      limite: HKObjectQueryNoLimit
    )
    return lista.compactMap { $0 as? HKQuantitySample }
  }

  private func ultimoPeso(_ inicio: Date, _ fin: Date) async throws -> Double? {
    let lista = try await muestras(
      tipo: HKQuantityType(.bodyMass),
      predicado: predicado(inicio, fin),
      limite: 1,
      masRecienteAntes: true
    )
    return (lista.first as? HKQuantitySample)?.quantity.doubleValue(for: .gramUnit(with: .kilo))
  }

  /// La noche que termina ese día: de las 18:00 de la víspera a las 18:00.
  /// Se unen los intervalos porque el reloj y otras apps escriben a la vez las
  /// mismas horas, y sumarlas contaría dos veces. `inBed` (0) y `awake` (2) no
  /// son sueño; los valores «asleep» van por número porque sus casos son de iOS 16.
  private func suenoMinutos(diaInicio: Date) async throws -> Double? {
    let cal = ApoyoSalud.calendario
    guard let hoy18 = cal.date(bySettingHour: 18, minute: 0, second: 0, of: diaInicio),
      let ayer18 = cal.date(byAdding: .day, value: -1, to: hoy18)
    else { return nil }

    let lista = try await muestras(
      tipo: HKCategoryType(.sleepAnalysis),
      predicado: HKQuery.predicateForSamples(withStart: ayer18, end: hoy18, options: []),
      limite: HKObjectQueryNoLimit
    )
    let dormido: Set<Int> = [1, 3, 4, 5]
    let intervalos = lista
      .compactMap { $0 as? HKCategorySample }
      .filter { dormido.contains($0.value) }
      .map { (max($0.startDate, ayer18), min($0.endDate, hoy18)) }
      .filter { $0.0 < $0.1 }
      .sorted { $0.0 < $1.0 }
    guard var actual = intervalos.first else { return nil }

    var segundos = 0.0
    for tramo in intervalos.dropFirst() {
      if tramo.0 <= actual.1 {
        actual.1 = max(actual.1, tramo.1)
      } else {
        segundos += actual.1.timeIntervalSince(actual.0)
        actual = tramo
      }
    }
    segundos += actual.1.timeIntervalSince(actual.0)
    return segundos / 60
  }

  // MARK: Importar entrenos

  func entrenosNuevos(limite: Int) async throws -> [String: Any] {
    guard Self.disponible() else { throw ErrorSalud.noDisponible }
    let tope = max(1, min(limite, 200))
    // Lo que escribe NIVL (iPhone y reloj) ya ha llegado por su camino.
    let propio = Bundle.main.bundleIdentifier ?? "com.teferi.nivl"

    var ancla = anclaGuardada()
    var salida: [String] = []
    // Las propias se filtran después de consultar: una página llena de ellas
    // no significa que no quede nada, así que se sigue hasta llenar o agotar.
    while salida.count < tope {
      let pedir = tope - salida.count
      let (lote, siguiente) = try await paginaEntrenos(desde: ancla, limite: pedir)
      if let siguiente { ancla = siguiente }
      for entreno in lote
      where !entreno.sourceRevision.source.bundleIdentifier.hasPrefix(propio) {
        if let json = try await jsonDe(entreno) { salida.append(json) }
      }
      if lote.count < pedir { break }
    }
    return ["entrenos": salida, "ancla": ancla.flatMap(serializar) ?? NSNull()]
  }

  func confirmarAncla(_ texto: String) {
    // Un ancla que no se puede leer no se guarda: valdría como empezar de cero.
    guard deserializar(texto) != nil else { return }
    UserDefaults.standard.set(texto, forKey: claveAncla)
  }

  func reiniciarAncla() {
    UserDefaults.standard.removeObject(forKey: claveAncla)
  }

  private func anclaGuardada() -> HKQueryAnchor? {
    UserDefaults.standard.string(forKey: claveAncla).flatMap(deserializar)
  }

  private func serializar(_ ancla: HKQueryAnchor) -> String? {
    try? NSKeyedArchiver.archivedData(withRootObject: ancla, requiringSecureCoding: true)
      .base64EncodedString()
  }

  private func deserializar(_ texto: String) -> HKQueryAnchor? {
    guard let datos = Data(base64Encoded: texto) else { return nil }
    return try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: datos)
  }

  private func paginaEntrenos(
    desde ancla: HKQueryAnchor?,
    limite: Int
  ) async throws -> ([HKWorkout], HKQueryAnchor?) {
    try await withCheckedThrowingContinuation { c in
      let consulta = HKAnchoredObjectQuery(
        type: HKObjectType.workoutType(),
        predicate: nil,
        anchor: ancla,
        limit: limite
      ) { [self] _, nuevas, _, siguiente, error in
        if let error, !esSinDatos(error) {
          c.resume(throwing: error)
        } else {
          c.resume(returning: ((nuevas ?? []).compactMap { $0 as? HKWorkout }, siguiente))
        }
      }
      store.execute(consulta)
    }
  }

  private func deporte(de entreno: HKWorkout) -> String {
    switch entreno.workoutActivityType {
    case .running:
      return "carrera"
    case .cycling:
      return "bici"
    case .swimming:
      let lugar = entreno.metadata?[HKMetadataKeySwimmingLocationType] as? NSNumber
      return lugar?.intValue == HKWorkoutSwimmingLocationType.openWater.rawValue
        ? "aguas_abiertas" : "piscina"
    case .traditionalStrengthTraining, .functionalStrengthTraining, .coreTraining:
      return "fuerza"
    case .walking, .hiking:
      return "caminar"
    default:
      return "otro"
    }
  }

  private func total(
    _ entreno: HKWorkout,
    _ identificadores: [HKQuantityTypeIdentifier],
    _ unidad: HKUnit,
    _ antiguo: HKQuantity?
  ) -> Double? {
    if #available(iOS 16.0, *) {
      for id in identificadores {
        if let q = entreno.statistics(for: HKQuantityType(id))?.sumQuantity() {
          return q.doubleValue(for: unidad)
        }
      }
    }
    return antiguo?.doubleValue(for: unidad)
  }

  /// Las pausas del entreno, unidas y ordenadas. Una pausa sin reanudar llega
  /// hasta el final.
  private func pausas(de entreno: HKWorkout) -> [DateInterval] {
    let eventos = (entreno.workoutEvents ?? []).sorted { $0.dateInterval.start < $1.dateInterval.start }
    var salida: [DateInterval] = []
    var desde: Date?
    for evento in eventos {
      switch evento.type {
      case .pause, .motionPaused:
        if desde == nil { desde = evento.dateInterval.start }
      case .resume, .motionResumed:
        if let d = desde, evento.dateInterval.start > d {
          salida.append(DateInterval(start: d, end: evento.dateInterval.start))
        }
        desde = nil
      default:
        break
      }
    }
    if let d = desde, entreno.endDate > d {
      salida.append(DateInterval(start: d, end: entreno.endDate))
    }
    return salida
  }

  /// El JSON del contrato. Null si el entreno no se puede serializar.
  private func jsonDe(_ entreno: HKWorkout) async throws -> String? {
    let reloj = RelojActivo(inicio: entreno.startDate, pausas: pausas(de: entreno))
    let deporte = self.deporte(de: entreno)

    let distancia = total(
      entreno,
      [.distanceWalkingRunning, .distanceCycling, .distanceSwimming],
      .meter(),
      entreno.totalDistance
    )
    let kcal = total(entreno, [.activeEnergyBurned], .kilocalorie(), entreno.totalEnergyBurned)
    let fc = try await pulso(.heartRate, entreno.startDate, entreno.endDate)
    let serie = try await serieFc(inicio: entreno.startDate, fin: entreno.endDate, reloj: reloj)
    // La ruta no es imprescindible: sin ella el entreno sigue valiendo.
    let lugares = (try? await ruta(de: entreno)) ?? []

    var trazado: [[String: Any]] = []
    var kms = ParcialesKm()
    var subida = DesnivelHisteresis()
    var lecturasAltitud = 0
    var acumulado = 0.0
    var previo: CLLocation?
    var ultimoT = -1.0
    for lugar in lugares {
      guard let t = reloj.segundos(en: lugar.timestamp) else {
        previo = nil
        continue
      }
      let segundo = t.rounded()
      guard segundo > ultimoT else { continue }
      ultimoT = segundo
      let alturaValida = lugar.verticalAccuracy >= 0
      if alturaValida {
        lecturasAltitud += 1
        subida.alimentar(lugar.altitude)
      }
      if let previo {
        acumulado += EntrenoPuro.distanciaM(
          lat1: previo.coordinate.latitude,
          lon1: previo.coordinate.longitude,
          lat2: lugar.coordinate.latitude,
          lon2: lugar.coordinate.longitude
        )
      }
      previo = lugar
      kms.alimentar(distancia: acumulado, t: segundo, desnivel: subida.ganado)
      trazado.append([
        "t": segundo,
        "lat": lugar.coordinate.latitude,
        "lon": lugar.coordinate.longitude,
        "alt": alturaValida ? ApoyoSalud.num(lugar.altitude, decimales: 1) : NSNull(),
      ])
    }

    let largo = (entreno.metadata?[HKMetadataKeyLapLength] as? HKQuantity)?.doubleValue(for: .meter())
    var parciales: [[String: Any]] = []
    if deporte == "piscina" {
      for evento in entreno.workoutEvents ?? [] where evento.type == .lap && evento.dateInterval.duration >= 1 {
        parciales.append([
          "n": parciales.count + 1,
          "tipo": "largo",
          "distancia_m": largo ?? 0,
          "duracion_s": ApoyoSalud.num(evento.dateInterval.duration),
          "fc_media": NSNull(),
          "desnivel_m": NSNull(),
        ])
      }
    } else if !trazado.isEmpty, deporte == "carrera" || deporte == "bici" {
      parciales = kms.conResto(distancia: acumulado, t: entreno.duration, desnivel: subida.ganado).map {
        [
          "n": $0.n,
          "tipo": "km",
          "distancia_m": ApoyoSalud.num($0.distancia_m, decimales: 1),
          "duracion_s": ApoyoSalud.num($0.duracion_s),
          "fc_media": NSNull(),
          "desnivel_m": lecturasAltitud >= 2 ? ApoyoSalud.num($0.desnivel_m, decimales: 1) : NSNull(),
        ]
      }
    }

    var desnivel: Double?
    if let q = entreno.metadata?[HKMetadataKeyElevationAscended] as? HKQuantity {
      desnivel = q.doubleValue(for: .meter())
    } else if lecturasAltitud >= 2 {
      desnivel = subida.ganado
    }

    // Tecleado a mano en Salud: el UUID es de Salud, pero no lo midió un sensor.
    let aMano = (entreno.metadata?[HKMetadataKeyWasUserEntered] as? Bool) == true
    let objeto: [String: Any] = [
      "origen": aMano ? "manual" : "salud",
      "externo_id": entreno.uuid.uuidString,
      "deporte": deporte,
      "inicio": ApoyoSalud.texto(entreno.startDate),
      "fin": ApoyoSalud.texto(entreno.endDate),
      "duracion_s": ApoyoSalud.num(entreno.duration),
      "distancia_m": ApoyoSalud.numPositivo(distancia, decimales: 1),
      "kcal": ApoyoSalud.numPositivo(kcal),
      "fc_media": ApoyoSalud.num(fc.media),
      "fc_max": ApoyoSalud.num(fc.max),
      "desnivel_m": ApoyoSalud.num(desnivel, decimales: 1),
      "ruta": trazado.count >= 2 ? EntrenoPuro.adelgazarRuta(trazado) : NSNull(),
      "parciales": parciales,
      "largo_piscina_m": ApoyoSalud.numPositivo(largo, decimales: 1),
      "fc_serie": serie.count >= 2 ? serie : NSNull(),
    ]
    return ApoyoSalud.json(objeto)
  }

  /// El pulso de una ventana con `t` en segundos en movimiento; lo que cae en
  /// una pausa se descarta. Ya adelgazado: lo cruza todo el puente a JS.
  func serieFc(inicio: Date, fin: Date, reloj: RelojActivo) async throws -> [[String: Any]] {
    let lista = try await muestrasCantidad(.heartRate, inicio, fin)
    var salida: [[String: Any]] = []
    var ultimoT = -1.0
    for muestra in lista {
      guard let t = reloj.segundos(en: muestra.startDate)?.rounded(), t > ultimoT else { continue }
      ultimoT = t
      salida.append(["t": t, "bpm": muestra.quantity.doubleValue(for: bpm).rounded()])
    }
    return EntrenoPuro.adelgazarRuta(salida)
  }

  /// Totales de pulso y energía de una ventana, para el GPS del iPhone.
  func medidasVentana(inicio: Date, fin: Date) async throws -> (fcMedia: Double?, fcMax: Double?, kcal: Double?) {
    async let fc = pulso(.heartRate, inicio, fin)
    async let kcal = suma(.activeEnergyBurned, .kilocalorie(), inicio, fin)
    let (f, k) = try await (fc, kcal)
    return (f.media, f.max, k)
  }

  /// Todos los puntos del entreno. Puede haber varias rutas (una por tramo),
  /// y cada una llega por lotes.
  private func ruta(de entreno: HKWorkout) async throws -> [CLLocation] {
    let rutas = try await muestras(
      tipo: HKSeriesType.workoutRoute(),
      predicado: HKQuery.predicateForObjects(from: entreno),
      limite: HKObjectQueryNoLimit
    )
    var puntos: [CLLocation] = []
    for case let r as HKWorkoutRoute in rutas {
      puntos += try await lugares(de: r)
    }
    return puntos.sorted { $0.timestamp < $1.timestamp }
  }

  private func lugares(de ruta: HKWorkoutRoute) async throws -> [CLLocation] {
    try await withCheckedThrowingContinuation { c in
      var acumulados: [CLLocation] = []
      let consulta = HKWorkoutRouteQuery(route: ruta) { _, lote, terminado, error in
        if let error {
          c.resume(throwing: error)
          return
        }
        acumulados += lote ?? []
        if terminado { c.resume(returning: acumulados) }
      }
      store.execute(consulta)
    }
  }
}
