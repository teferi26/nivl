// NIVL · Apple Watch: medir un entreno de verdad.
//
// HKWorkoutSession + HKLiveWorkoutBuilder miden; el HKWorkoutRouteBuilder del
// propio builder guarda la ruta al aire libre con CLLocationManager. Lo que se va
// midiendo se apunta en un diario en disco: si el proceso muere, HealthKit
// devuelve la sesión y el diario devuelve lo que HealthKit no guarda (ruta,
// parciales, serie de pulso). No hace falta iPhone en ningún momento: al
// terminar, el entreno queda en BuzonEntrenos y viaja cuando pueda.
//
// Métrica real o nil, nunca inventada. La lógica pura está en EntrenoPuro.

import CoreLocation
import Foundation
import HealthKit
import WatchKit

enum FaseEntreno: Equatable {
  case parado
  case preparando
  case enMarcha
  case pausaAuto
  case pausa
  case terminando
  case resumen
  case error(String)
}

struct MetricasEntreno: Equatable {
  var deporte: DeporteReloj = .carrera
  /// En movimiento, sin pausas.
  var duracion_s: Double = 0
  var distancia_m: Double?
  var ritmo_s_km: Double?
  var velocidad_kmh: Double?
  var fc: Double?
  var fc_media: Double?
  var kcal: Double?
  /// Solo en piscina.
  var largos: Int?
  /// El kilómetro o la vuelta en curso, desde 1.
  var parcialActual: Int = 1
  var gpsActivo = false
}

@MainActor
final class ServicioEntreno: NSObject, ObservableObject {
  static let compartido = ServicioEntreno()

  @Published var fase: FaseEntreno = .parado
  @Published var metricas = MetricasEntreno()
  @Published var resumen: EntrenoMedido?
  /// false si el JSON del último resumen no se pudo escribir en el reloj.
  @Published var resumenEnDisco = true

  private let salud = HKHealthStore()
  private let gps = CLLocationManager()
  private let diario = DiarioEntreno()

  private var sesion: HKWorkoutSession?
  // Se retiene hasta el siguiente entreno: `end()` termina de forma asíncrona.
  private var sesionSaliente: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?
  private var rutaBuilder: HKWorkoutRouteBuilder?
  private var tareaRuta: Task<Void, Never>?
  private var hayRutaInsertada = false
  private var tick: Timer?
  private var ticks = 0
  private var arrancado = false
  private var cerrando = false
  /// Queda un diario por resolver: HealthKit dio error al recuperar o el JSON
  /// no se pudo escribir. Un entreno nuevo no puede empezar pisándolo.
  private var recuperacionPendiente = false

  private var cabecera: CabeceraDiario?
  private var usaGps = false
  private var autoPausa: AutoPausa?
  private var pausaEsAuto = false
  private var acumulador = AcumuladorRuta()
  private var kms = ParcialesKm()
  private var ventana = VentanaRitmo()
  private var puntos: [PuntoGrabado] = []
  private var pendienteDeCorte = false
  private var ultimoFix: Date?
  private var ultimoDecidible: Date?
  private var fcSerie: [MuestraFc] = []
  private var fcMax: Double?
  private var vueltas: [ParcialMedido] = []
  private var marcaVuelta = (t: 0.0, d: 0.0)

  private static let precisionRuta = 50.0
  private static let precisionBuena = 20.0
  private static let segundosGpsVivo = 10.0
  private static let segundosSinDecidir = 3.0

  override init() {
    super.init()
    gps.delegate = self
    gps.activityType = .fitness
    gps.desiredAccuracy = kCLLocationAccuracyBest
    gps.distanceFilter = kCLDistanceFilterNone
  }

  // MARK: API

  /// HealthKit no dice si se concedió la lectura; solo se puede saber lo de
  /// escribir, que es lo que hace falta para guardar el entreno.
  func pedirPermisos() async -> Bool {
    guard HKHealthStore.isHealthDataAvailable() else { return false }
    let distancias: [HKQuantityType] = [
      HKQuantityType(.distanceWalkingRunning), HKQuantityType(.distanceCycling), HKQuantityType(.distanceSwimming),
    ]
    let energia = HKQuantityType(.activeEnergyBurned)
    let basal = HKQuantityType(.basalEnergyBurned)
    let brazadas = HKQuantityType(.swimmingStrokeCount)
    let pulso = HKQuantityType(.heartRate)
    let ruta = HKSeriesType.workoutRoute()
    let escribir = Set<HKSampleType>(distancias + [energia, basal, brazadas, pulso, ruta, HKObjectType.workoutType()])
    let leer = Set<HKObjectType>(distancias + [energia, basal, brazadas, pulso, ruta, HKObjectType.workoutType()])
    do {
      try await salud.requestAuthorization(toShare: escribir, read: leer)
    } catch {
      return false
    }
    if gps.authorizationStatus == .notDetermined { gps.requestWhenInUseAuthorization() }
    return salud.authorizationStatus(for: HKObjectType.workoutType()) == .sharingAuthorized
  }

  func empezar(_ d: DeporteReloj, largoPiscina: Double?, autoPausa conAutoPausa: Bool) {
    switch fase {
    case .parado, .resumen, .error: break
    default: return
    }
    guard sesion == nil else { return }
    resumen = nil
    metricas = MetricasEntreno(deporte: d, largos: d == .piscina ? 0 : nil)
    fase = .preparando
    Task { await arrancar(d, largoPiscina: largoPiscina, autoPausa: conAutoPausa) }
  }

  func pausar() {
    switch fase {
    case .enMarcha:
      pausaEsAuto = false
      sesion?.pause()
    case .pausaAuto:
      // Ya está parada: solo cambia quién la levanta (a partir de ahora, la mano).
      pausaEsAuto = false
      fase = .pausa
    default:
      break
    }
  }

  func reanudar() {
    guard fase == .pausa || fase == .pausaAuto else { return }
    pausaEsAuto = false
    autoPausa?.reiniciar()
    autoPausa?.enPausa = false
    sesion?.resume()
  }

  /// Vuelta a mano: un parcial tipo «vuelta». Sin distancia medida, 0 metros.
  func marcarParcial() {
    guard fase == .enMarcha, let b = builder else { return }
    let t = b.elapsedTime
    guard let vuelta = cerrarVuelta(hasta: t, distancia: distanciaAhora(), n: vueltas.count + 1) else { return }
    vueltas.append(vuelta)
    diario.anotar(LineaDiario(m: vuelta))
    empezarVuelta(t: t)
    metricas.parcialActual = vueltas.count + 1
    // Marker y no lap: en piscina los lap son los largos del propio sistema.
    let ahora = Date()
    let evento = HKWorkoutEvent(type: .marker, dateInterval: DateInterval(start: ahora, duration: 0), metadata: nil)
    Task { try? await b.addWorkoutEvents([evento]) }
  }

  func terminar() {
    guard let s = sesion else { return }
    switch fase {
    case .enMarcha, .pausa, .pausaAuto: break
    default: return
    }
    fase = .terminando
    pararGps()
    s.stopActivity(with: Date())
  }

  /// Tira la sesión en curso: ni Salud, ni buzón, ni diario.
  func descartar() {
    guard let s = sesion else {
      cerrarResumen()
      return
    }
    guard !cerrando else { return }
    cerrando = true
    pararGps()
    builder?.discardWorkout()
    rutaBuilder?.discard()
    s.end()
    diario.borrar()
    sesionSaliente = s
    limpiar()
    metricas = MetricasEntreno()
    fase = .parado
  }

  func cerrarResumen() {
    resumen = nil
    metricas = MetricasEntreno()
    fase = .parado
  }

  /// Al abrir la app: recuperar lo que estuviera en marcha. Se puede llamar
  /// varias veces (onAppear), solo actúa la primera.
  func alArrancar() {
    guard !arrancado else { return }
    arrancado = true
    Task {
      await recuperar()
      #if DEBUG
      await pruebaAutomatica()
      #endif
    }
  }

  // MARK: Arrancar

  private func arrancar(_ d: DeporteReloj, largoPiscina: Double?, autoPausa conAutoPausa: Bool) async {
    guard HKHealthStore.isHealthDataAvailable() else {
      return fallar("Este reloj no puede medir entrenos.")
    }
    if recuperacionPendiente {
      await recuperar()
      guard fase == .preparando else { return }
      if recuperacionPendiente { return fallar("No se ha podido empezar el entreno.") }
    }
    if salud.authorizationStatus(for: HKObjectType.workoutType()) != .sharingAuthorized {
      guard await pedirPermisos() else {
        return fallar("Permite a NIVL guardar entrenos en Salud.")
      }
    }
    let largo = d == .piscina ? (largoPiscina ?? 25) : nil
    do {
      let config = Self.configuracion(d, largo: largo)
      let s = try HKWorkoutSession(healthStore: salud, configuration: config)
      let b = s.associatedWorkoutBuilder()
      enganchar(s, b, config)
      let cab = CabeceraDiario(
        id: UUID().uuidString, deporte: d.rawValue, largo: largo, autoPausa: conAutoPausa,
        inicio: Date().timeIntervalSince1970, dueno: Almacen.compartido.estado?.dueno)
      reiniciarMedidas(cab)
      diario.empezar(cab)
      prepararGps(d, autoPausa: conAutoPausa)
      let ahora = Date()
      s.startActivity(with: ahora)
      try await b.beginCollection(at: ahora)
      arrancarTick()
      // El bloqueo por agua solo funciona con la sesión corriendo y la app delante.
      if d == .piscina || d == .aguasAbiertas { WKInterfaceDevice.current().enableWaterLock() }
    } catch {
      abortarArranque()
    }
  }

  /// No ha llegado a medirse nada: no se guarda ni un entreno vacío.
  private func abortarArranque() {
    builder?.discardWorkout()
    rutaBuilder?.discard()
    sesion?.end()
    sesionSaliente = sesion
    diario.borrar()
    pararGps()
    limpiar()
    fallar("No se ha podido empezar el entreno.")
  }

  private func fallar(_ motivo: String) {
    fase = .error(motivo)
  }

  private static func configuracion(_ d: DeporteReloj, largo: Double?) -> HKWorkoutConfiguration {
    let c = HKWorkoutConfiguration()
    switch d {
    case .carrera:
      c.activityType = .running
      c.locationType = .outdoor
    case .bici:
      c.activityType = .cycling
      c.locationType = .outdoor
    case .piscina:
      c.activityType = .swimming
      c.swimmingLocationType = .pool
      c.lapLength = HKQuantity(unit: .meter(), doubleValue: largo ?? 25)
    case .aguasAbiertas:
      c.activityType = .swimming
      c.locationType = .outdoor
      c.swimmingLocationType = .openWater
    case .fuerza:
      c.activityType = .traditionalStrengthTraining
      c.locationType = .indoor
    }
    return c
  }

  private func enganchar(_ s: HKWorkoutSession, _ b: HKLiveWorkoutBuilder, _ config: HKWorkoutConfiguration) {
    b.dataSource = HKLiveWorkoutDataSource(healthStore: salud, workoutConfiguration: config)
    s.delegate = self
    b.delegate = self
    sesion = s
    builder = b
  }

  private func reiniciarMedidas(_ cab: CabeceraDiario) {
    cabecera = cab
    acumulador = AcumuladorRuta()
    kms = ParcialesKm()
    ventana = VentanaRitmo()
    puntos = []
    pendienteDeCorte = false
    ultimoFix = nil
    ultimoDecidible = nil
    fcSerie = []
    fcMax = nil
    vueltas = []
    marcaVuelta = (0, 0)
    pausaEsAuto = false
    cerrando = false
    hayRutaInsertada = false
    tareaRuta = nil
    sesionSaliente = nil
  }

  private func prepararGps(_ d: DeporteReloj, autoPausa conAutoPausa: Bool) {
    usaGps = d == .carrera || d == .bici || d == .aguasAbiertas
    switch (d, conAutoPausa) {
    case (.carrera, true): autoPausa = AutoPausa(esBici: false)
    case (.bici, true): autoPausa = AutoPausa(esBici: true)
    default: autoPausa = nil
    }
    guard usaGps else { return }
    gps.startUpdatingLocation()
  }

  private func pararGps() {
    gps.stopUpdatingLocation()
    metricas.gpsActivo = false
  }

  private func arrancarTick() {
    tick?.invalidate()
    tick = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      Task { @MainActor in self?.alTick() }
    }
  }

  private func alTick() {
    guard builder != nil else { return }
    refrescar()
    vigilarAutoPausa()
    ticks += 1
    if ticks % 10 == 0 {
      diario.anotar(LineaDiario(s: foto()))
      diario.volcar()
    }
  }

  private func foto() -> FotoDiario {
    FotoDiario(
      fecha: Date().timeIntervalSince1970, duracion: metricas.duracion_s, distancia: metricas.distancia_m,
      kcal: metricas.kcal, fcMedia: metricas.fc_media, fcMax: fcMax, desnivel: acumulador.desnivel,
      largos: metricas.largos)
  }

  // MARK: Métricas

  private var deporte: DeporteReloj { metricas.deporte }

  private var tipoDistancia: HKQuantityType? {
    switch deporte {
    case .carrera: return HKQuantityType(.distanceWalkingRunning)
    case .bici: return HKQuantityType(.distanceCycling)
    case .piscina, .aguasAbiertas: return HKQuantityType(.distanceSwimming)
    case .fuerza: return nil
    }
  }

  /// La del sistema manda. Si da 0 (simulador, o aún sin calibrar) vale lo
  /// sumado por GPS, y en piscina los largos contados: también es medido.
  private func distanciaAhora() -> Double? {
    guard let tipo = tipoDistancia else { return nil }
    let sistema = builder?.statistics(for: tipo)?.sumQuantity()?.doubleValue(for: .meter()) ?? 0
    if sistema > 0 { return sistema }
    if usaGps, acumulador.distancia > 0 { return acumulador.distancia }
    if deporte == .piscina, let largos = metricas.largos, largos > 0, let l = cabecera?.largo {
      return Double(largos) * l
    }
    return nil
  }

  private func refrescar() {
    guard let b = builder else { return }
    let t = b.elapsedTime
    metricas.duracion_s = t
    let distancia = distanciaAhora()
    metricas.distancia_m = distancia
    metricas.kcal = Self.kcal(b)
    if let ultimo = ultimoFix {
      metricas.gpsActivo = usaGps && Date().timeIntervalSince(ultimo) <= Self.segundosGpsVivo
    }

    guard fase == .enMarcha else {
      metricas.ritmo_s_km = nil
      metricas.velocidad_kmh = nil
      return
    }
    if let distancia {
      ventana.alimentar(t: t, distancia: distancia)
      if usaGps {
        let antes = kms.cerrados.count
        kms.alimentar(distancia: distancia, t: t, desnivel: acumulador.desnivel ?? 0)
        if kms.cerrados.count != antes { diario.anotar(LineaDiario(k: kms)) }
      }
    }
    if deporte == .piscina {
      // Los largos no dan una ventana útil: en piscina, el ritmo medio.
      let v = distancia.flatMap { t >= 10 ? $0 / t : nil }
      metricas.ritmo_s_km = ritmoSegundosKm(velocidad: v)
      metricas.velocidad_kmh = v.map { $0 * 3.6 }
    } else {
      let v = ventana.velocidad
      metricas.ritmo_s_km = ritmoSegundosKm(velocidad: v)
      metricas.velocidad_kmh = v.map { $0 * 3.6 }
    }
    if !vueltas.isEmpty {
      metricas.parcialActual = vueltas.count + 1
    } else if usaGps {
      metricas.parcialActual = kms.cerrados.count + 1
    }
  }

  private static func kcal(_ b: HKLiveWorkoutBuilder) -> Double? {
    let v = b.statistics(for: HKQuantityType(.activeEnergyBurned))?.sumQuantity()?.doubleValue(for: .kilocalorie())
    guard let v, v > 0 else { return nil }
    return v
  }

  private static let ppm = HKUnit.count().unitDivided(by: .minute())

  private func leerPulso(_ b: HKLiveWorkoutBuilder) {
    guard let st = b.statistics(for: HKQuantityType(.heartRate)) else { return }
    if let media = st.averageQuantity()?.doubleValue(for: Self.ppm) { metricas.fc_media = media }
    if let maxima = st.maximumQuantity()?.doubleValue(for: Self.ppm) { fcMax = maxima }
    guard let actual = st.mostRecentQuantity()?.doubleValue(for: Self.ppm),
          let intervalo = st.mostRecentQuantityDateInterval() else { return }
    metricas.fc = actual
    let t = b.elapsedTime(at: intervalo.end)
    guard t > (fcSerie.last?.t ?? -1) else { return }
    let muestra = MuestraFc(t: t, bpm: actual)
    fcSerie.append(muestra)
    diario.anotarFc(muestra)
  }

  private func recontarLargos(_ b: HKLiveWorkoutBuilder) {
    guard deporte == .piscina else { return }
    metricas.largos = b.workoutEvents.filter { $0.type == .lap }.count
  }

  /// Pulso medio de un tramo, de la serie (con el mismo reloj en movimiento).
  private func fcMedia(_ t0: Double, _ t1: Double) -> Double? {
    let dentro = fcSerie.filter { $0.t >= t0 && $0.t <= t1 }.map(\.bpm)
    return dentro.isEmpty ? nil : dentro.reduce(0, +) / Double(dentro.count)
  }

  private func empezarVuelta(t: Double) {
    marcaVuelta = (t, distanciaAhora() ?? 0)
  }

  private func cerrarVuelta(hasta t: Double, distancia: Double?, n: Int) -> ParcialMedido? {
    let duracion = t - marcaVuelta.t
    guard duracion >= 1 else { return nil }
    return ParcialMedido(
      n: n, tipo: "vuelta", distancia_m: max(0, (distancia ?? 0) - marcaVuelta.d), duracion_s: duracion,
      fc_media: fcMedia(marcaVuelta.t, t), desnivel_m: nil)
  }

  // MARK: GPS

  private func alRecibir(_ ubicaciones: [CLLocation]) {
    guard let b = builder, !cerrando else { return }
    var nuevos: [CLLocation] = []
    for l in ubicaciones where l.horizontalAccuracy >= 0 {
      // Lo cacheado al arrancar no se mide: la ruta empezaría en el sitio antiguo.
      guard abs(l.timestamp.timeIntervalSinceNow) < Self.segundosGpsVivo, let inicio = b.startDate,
            l.timestamp >= inicio else { continue }
      let precision = l.horizontalAccuracy
      if precision <= Self.precisionRuta { ultimoFix = Date() }
      if fase == .enMarcha || fase == .pausaAuto, autoPausa != nil {
        let cuando = l.timestamp.timeIntervalSince1970
        // Con GPS malo no se entra en pausa, pero quien ya está en ella tiene salida.
        if precision <= Self.precisionBuena, l.speed >= 0 {
          ultimoDecidible = Date()
          aplicar(autoPausa?.alimentar(velocidad: l.speed, t: cuando))
        } else {
          aplicar(autoPausa?.sinDato(t: cuando))
        }
      }
      guard fase == .enMarcha, precision <= Self.precisionRuta else { continue }
      let t = b.elapsedTime(at: l.timestamp)
      guard t > (puntos.last?.t ?? -1) else { continue }
      let altitud = l.verticalAccuracy >= 0 ? l.altitude : nil
      let p = PuntoGrabado(
        t: t, la: l.coordinate.latitude, lo: l.coordinate.longitude, al: altitud,
        ts: l.timestamp.timeIntervalSince1970, ph: precision, pv: l.verticalAccuracy, c: pendienteDeCorte ? true : nil)
      registrar(p)
      pendienteDeCorte = false
      puntos.append(p)
      diario.anotarPunto(p)
      nuevos.append(l)
    }
    insertarEnRuta(nuevos)
  }

  private func aplicar(_ cambio: AutoPausa.Cambio?) {
    if cambio == .pausar, fase == .enMarcha {
      pausaEsAuto = true
      sesion?.pause()
    } else if cambio == .reanudar, fase == .pausaAuto {
      sesion?.resume()
    }
  }

  /// Sin señal no llega ningún fix: la salida de la auto-pausa la da el reloj.
  private func vigilarAutoPausa() {
    guard fase == .pausaAuto else { return }
    let ahora = Date()
    guard ahora.timeIntervalSince(ultimoDecidible ?? .distantPast) >= Self.segundosSinDecidir else { return }
    aplicar(autoPausa?.sinDato(t: ahora.timeIntervalSince1970))
  }

  private func registrar(_ p: PuntoGrabado) {
    if p.c == true { acumulador.cortar() }
    acumulador.alimentar(lat: p.la, lon: p.lo, altitud: p.al, precision: p.ph, t: p.t)
  }

  /// En serie: el cierre espera a que haya entrado todo antes de acabar la ruta.
  private func insertarEnRuta(_ ubicaciones: [CLLocation]) {
    guard !ubicaciones.isEmpty else { return }
    // Con un builder de entreno se le pide a él (lo dice la cabecera), y aquí
    // ya ha empezado a recoger.
    if rutaBuilder == nil {
      rutaBuilder = builder?.seriesBuilder(for: HKSeriesType.workoutRoute()) as? HKWorkoutRouteBuilder
    }
    guard let r = rutaBuilder else { return }
    let previa = tareaRuta
    tareaRuta = Task { [weak self] in
      await previa?.value
      do {
        try await r.insertRouteData(ubicaciones)
        self?.hayRutaInsertada = true
      } catch {
        // La ruta sigue en el entreno; solo se pierde en Salud.
      }
    }
  }

  // MARK: Delegados

  private func alCambiar(_ s: HKWorkoutSession, a estado: HKWorkoutSessionState, fecha: Date) {
    guard s === sesion else { return }
    switch estado {
    case .running:
      guard fase != .terminando else { return }
      // Lo recorrido durante la pausa no cuenta.
      acumulador.cortar()
      ventana.cortar()
      pendienteDeCorte = true
      fase = .enMarcha
      refrescar()
    case .paused:
      guard fase != .terminando else { return }
      fase = pausaEsAuto ? .pausaAuto : .pausa
      refrescar()
    case .stopped, .ended:
      // A «ended» se llega sin pasar por «stopped» si la para el sistema.
      if fase == .preparando {
        abortarArranque()
      } else {
        Task { await cerrar(en: fecha) }
      }
    default:
      break
    }
  }

  private func alRecogerDatos(_ b: HKLiveWorkoutBuilder, tipos: Set<HKSampleType>) {
    guard b === builder else { return }
    if tipos.contains(HKQuantityType(.heartRate)) { leerPulso(b) }
    refrescar()
  }

  // MARK: Cerrar

  private func cerrar(en fecha: Date) async {
    guard !cerrando, let b = builder, let s = sesion, let cab = cabecera else { return }
    cerrando = true
    fase = .terminando
    tick?.invalidate()
    pararGps()
    await tareaRuta?.value

    var workout: HKWorkout?
    do {
      try await b.endCollection(at: fecha)
      leerPulso(b)
      recontarLargos(b)
      refrescar()
      // Se calcula antes de cerrar: necesita los eventos y el reloj del builder.
      let parciales = parcialesFinales(b)
      let duracion = b.elapsedTime
      let finales = (parciales, duracion)
      workout = try await b.finishWorkout()
      await entregar(b, s, cab, workout, fecha, finales)
    } catch {
      // Sin HKWorkout (sin permiso, disco lleno) lo medido sigue valiendo.
      await entregar(b, s, cab, workout, fecha, (parcialesFinales(b), b.elapsedTime))
    }
  }

  private func entregar(
    _ b: HKLiveWorkoutBuilder, _ s: HKWorkoutSession, _ cab: CabeceraDiario, _ workout: HKWorkout?, _ fecha: Date,
    _ finales: ([ParcialMedido], Double)
  ) async {
    if let r = rutaBuilder {
      if let workout, hayRutaInsertada {
        _ = try? await r.finishRoute(with: workout, metadata: nil)
      } else {
        r.discard()
      }
    }
    if s.state != .ended { s.end() }
    sesionSaliente = s
    let entreno = construir(
      cab, id: workout?.uuid.uuidString ?? cab.id, inicio: workout?.startDate, fin: workout?.endDate ?? fecha,
      duracion: workout?.duration ?? finales.1, parciales: finales.0)
    guardarYMostrar(entreno)
  }

  private func guardarYMostrar(_ entreno: EntrenoMedido, desdeDiario: Bool = false) {
    // El diario solo se borra con el JSON ya escrito: nunca sin copia.
    let enDisco = BuzonEntrenos.compartido.guardar(entreno)
    if enDisco {
      diario.borrar()
      recuperacionPendiente = false
    } else {
      // Se reintenta desde el diario, que hasta ahora iba diez segundos atrás.
      if !desdeDiario { diario.anotar(LineaDiario(s: foto())) }
      diario.volcar()
      recuperacionPendiente = true
    }
    limpiar()
    resumenEnDisco = enDisco
    resumen = entreno
    fase = .resumen
  }

  private func limpiar() {
    tick?.invalidate()
    tick = nil
    sesion = nil
    builder = nil
    rutaBuilder = nil
    cabecera = nil
    autoPausa = nil
    usaGps = false
    cerrando = false
  }

  private func parcialesFinales(_ b: HKLiveWorkoutBuilder) -> [ParcialMedido] {
    var lista: [ParcialMedido] = []
    if usaGps, let distancia = metricas.distancia_m {
      lista = parcialesKm(kms.conResto(distancia: distancia, t: b.elapsedTime, desnivel: acumulador.desnivel ?? 0))
    }
    if !vueltas.isEmpty {
      lista += vueltas
      if let ultima = cerrarVuelta(hasta: b.elapsedTime, distancia: metricas.distancia_m, n: vueltas.count + 1) {
        lista.append(ultima)
      }
    }
    if deporte == .piscina, let largo = cabecera?.largo { lista += parcialesLargo(b, largo: largo) }
    return lista
  }

  private func parcialesKm(_ tramos: [ParcialesKm.Parcial]) -> [ParcialMedido] {
    var t0 = 0.0
    return tramos.map { k in
      let t1 = t0 + k.duracion_s
      defer { t0 = t1 }
      return ParcialMedido(
        n: k.n, tipo: "km", distancia_m: k.distancia_m, duracion_s: k.duracion_s, fc_media: fcMedia(t0, t1),
        // Sin altitud medida el 0 de ParcialesKm sería mentira.
        desnivel_m: acumulador.desnivel == nil ? nil : k.desnivel_m)
    }
  }

  private func parcialesLargo(_ b: HKLiveWorkoutBuilder, largo: Double) -> [ParcialMedido] {
    var salida: [ParcialMedido] = []
    var previo: Date?
    for evento in b.workoutEvents where evento.type == .lap {
      let intervalo = evento.dateInterval
      // Hay lap sin duración: entonces el largo va desde el anterior.
      let inicio = intervalo.duration >= 1 ? intervalo.start : (previo ?? intervalo.start)
      let t0 = b.elapsedTime(at: inicio)
      let t1 = b.elapsedTime(at: intervalo.end)
      previo = intervalo.end
      let duracion = t1 - t0
      guard duracion >= 1 else { continue }
      salida.append(
        ParcialMedido(
          n: salida.count + 1, tipo: "largo", distancia_m: largo, duracion_s: duracion, fc_media: fcMedia(t0, t1),
          desnivel_m: nil))
    }
    return salida
  }

  private static let iso: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
  }()

  private static func redondeo(_ x: Double?, _ d: Double = 10) -> Double? {
    x.map { ($0 * d).rounded() / d }
  }

  private func construir(
    _ cab: CabeceraDiario, id: String, inicio: Date?, fin: Date, duracion: Double, parciales: [ParcialMedido]
  ) -> EntrenoMedido {
    let desde = inicio ?? Date(timeIntervalSince1970: cab.inicio)
    let ruta = EntrenoPuro.adelgazarRuta(puntos).map {
      PuntoRuta(t: Self.redondeo($0.t)!, lat: $0.la, lon: $0.lo, alt: Self.redondeo($0.al))
    }
    return EntrenoMedido(
      externo_id: id,
      deporte: cab.deporte,
      inicio: Self.iso.string(from: desde),
      // El contrato rechaza un fin que no sea posterior al inicio.
      fin: Self.iso.string(from: max(fin, desde.addingTimeInterval(1))),
      duracion_s: max(1, duracion.rounded()),
      distancia_m: Self.redondeo(metricas.distancia_m),
      kcal: Self.redondeo(metricas.kcal),
      fc_media: Self.redondeo(metricas.fc_media),
      fc_max: Self.redondeo(fcMax),
      desnivel_m: usaGps ? Self.redondeo(acumulador.desnivel) : nil,
      ruta: ruta.count >= 2 ? ruta : nil,
      parciales: parciales,
      largo_piscina_m: cab.largo,
      fc_serie: fcSerie.count >= 2 ? EntrenoPuro.adelgazarRuta(fcSerie) : nil,
      dueno: cab.dueno
    )
  }

  // MARK: Recuperar

  private func recuperar() async {
    guard HKHealthStore.isHealthDataAvailable(), sesion == nil else { return }
    let viva: HKWorkoutSession?
    do {
      viva = try await salud.recoverActiveWorkoutSession()
    } catch {
      // Un error no es «no hay sesión»: la sesión puede seguir viva y el diario
      // es lo único con su ruta. Se conserva y se reintenta al volver a activo.
      recuperacionPendiente = true
      arrancado = false
      return
    }
    recuperacionPendiente = false
    let lineas = diario.leer()
    guard let s = viva else {
      entregarDesdeDiario(lineas)
      return
    }
    let b = s.associatedWorkoutBuilder()
    enganchar(s, b, s.workoutConfiguration)
    let d = lineas.compactMap(\.c).first.flatMap { DeporteReloj(rawValue: $0.deporte) }
      ?? Self.deporte(de: s.workoutConfiguration)
    metricas = MetricasEntreno(deporte: d, largos: d == .piscina ? 0 : nil)
    let cab = lineas.compactMap(\.c).first ?? CabeceraDiario(
      id: UUID().uuidString, deporte: d.rawValue, largo: s.workoutConfiguration.lapLength?.doubleValue(for: .meter()),
      autoPausa: false, inicio: (s.startDate ?? Date()).timeIntervalSince1970, dueno: Almacen.compartido.estado?.dueno)
    reiniciarMedidas(cab)
    if lineas.isEmpty { diario.empezar(cab) }
    prepararGps(d, autoPausa: cab.autoPausa)
    reconstruir(lineas)
    leerPulso(b)
    recontarLargos(b)
    arrancarTick()

    switch s.state {
    case .running:
      fase = .enMarcha
      refrescar()
    case .paused:
      // Si fue auto-pausa ya no se sabe: mejor que la levante la mano.
      fase = .pausa
      refrescar()
    case .stopped, .ended:
      await cerrar(en: s.endDate ?? Date())
    default:
      // Nunca llegó a correr: ni GPS encendido ni ruta a medias.
      pararGps()
      rutaBuilder?.discard()
      s.end()
      sesionSaliente = s
      diario.borrar()
      limpiar()
      fase = .parado
    }
  }

  /// Devuelve a memoria lo apuntado. La ruta se reinserta porque la cabecera del
  /// builder avisa de que sin terminarla se pierde si el proceso muere.
  private func reconstruir(_ lineas: [LineaDiario]) {
    var ubicaciones: [CLLocation] = []
    for l in lineas {
      for p in l.p ?? [] {
        registrar(p)
        puntos.append(p)
        ubicaciones.append(p.ubicacion)
      }
      fcSerie += l.f ?? []
      if let k = l.k { kms = k }
      if let m = l.m { vueltas.append(m) }
    }
    if !vueltas.isEmpty {
      marcaVuelta.t = vueltas.reduce(0) { $0 + $1.duracion_s }
      marcaVuelta.d = vueltas.reduce(0) { $0 + $1.distancia_m }
    }
    pendienteDeCorte = true
    insertarEnRuta(ubicaciones)
  }

  /// La sesión ya no existe (reinicio del reloj, por ejemplo) pero hay diario:
  /// lo medido hasta el último apunte se entrega con lo que se sepa.
  private func entregarDesdeDiario(_ lineas: [LineaDiario]) {
    guard !lineas.isEmpty else { return }
    guard let cab = lineas.compactMap(\.c).first, let ultima = lineas.compactMap(\.s).last, ultima.duracion >= 60,
          let d = DeporteReloj(rawValue: cab.deporte) else {
      diario.borrar()
      return
    }
    metricas = MetricasEntreno(
      deporte: d, duracion_s: ultima.duracion, distancia_m: ultima.distancia, fc_media: ultima.fcMedia,
      kcal: ultima.kcal, largos: ultima.largos)
    reiniciarMedidas(cab)
    usaGps = d == .carrera || d == .bici || d == .aguasAbiertas
    reconstruir(lineas)
    fcMax = ultima.fcMax
    let parciales = parcialesKm(kms.cerrados) + vueltas
    let entreno = construir(
      cab, id: cab.id, inicio: nil, fin: Date(timeIntervalSince1970: ultima.fecha), duracion: ultima.duracion,
      parciales: parciales)
    guardarYMostrar(entreno, desdeDiario: true)
  }

  private static func deporte(de c: HKWorkoutConfiguration) -> DeporteReloj {
    switch c.activityType {
    case .running: return .carrera
    case .cycling: return .bici
    case .swimming: return c.swimmingLocationType == .openWater ? .aguasAbiertas : .piscina
    default: return .fuerza
    }
  }

  // MARK: Prueba en simulador

  #if DEBUG
  /// `-nivlAuto carrera -nivlAutoSegundos 40`: una sesión real sin tocar nada.
  private func pruebaAutomatica() async {
    let d = UserDefaults.standard
    guard fase == .parado, let clave = d.string(forKey: "nivlAuto"), let deporte = DeporteReloj(rawValue: clave) else {
      return
    }
    let segundos = d.integer(forKey: "nivlAutoSegundos")
    print("NIVL_AUTO empezar \(clave)")
    empezar(deporte, largoPiscina: deporte == .piscina ? 25 : nil, autoPausa: false)
    // La primera vez, el permiso de Salud espera a que alguien lo acepte.
    for _ in 0..<120 where fase == .preparando {
      try? await Task.sleep(for: .seconds(1))
    }
    try? await Task.sleep(for: .seconds(segundos > 0 ? segundos : 40))
    print("NIVL_AUTO fase \(fase) metricas \(metricas)")
    terminar()
    for _ in 0..<60 where fase == .terminando {
      try? await Task.sleep(for: .seconds(1))
    }
    if let r = resumen {
      print("NIVL_AUTO resumen id=\(r.externo_id) dur=\(r.duracion_s) dist=\(r.distancia_m ?? -1) kcal=\(r.kcal ?? -1) fc=\(r.fc_media ?? -1) ruta=\(r.ruta?.count ?? 0) serie=\(r.fc_serie?.count ?? 0)")
    } else {
      print("NIVL_AUTO sin resumen fase=\(fase)")
    }
  }
  #endif
}

// MARK: Cuentas de la ruta y del ritmo

/// Suma la ruta punto a punto. La base solo avanza cuando el punto se ha
/// alejado un paso mínimo: quieto, el baile del GPS no acumula metros.
private struct AcumuladorRuta {
  private(set) var distancia = 0.0
  private var altura = DesnivelHisteresis()
  private var lecturasAltitud = 0
  private var base: (lat: Double, lon: Double, t: Double)?

  /// Sin dos lecturas de altitud no hay desnivel medido.
  var desnivel: Double? { lecturasAltitud >= 2 ? altura.ganado : nil }

  /// Tras una pausa: lo andado entre medias no cuenta.
  mutating func cortar() {
    base = nil
  }

  mutating func alimentar(lat: Double, lon: Double, altitud: Double?, precision: Double, t: Double) {
    guard precision >= 0, precision <= 30 else { return }
    if let altitud {
      altura.alimentar(altitud)
      lecturasAltitud += 1
    }
    guard let b = base else {
      base = (lat, lon, t)
      return
    }
    let paso = EntrenoPuro.distanciaM(lat1: b.lat, lon1: b.lon, lat2: lat, lon2: lon)
    guard paso >= 2 else { return }
    // Un salto imposible es un GPS que se ha ido: ni suma ni mueve la base.
    if t > b.t, paso / (t - b.t) > 40 { return }
    distancia += paso
    base = (lat, lon, t)
  }
}

/// Velocidad de los últimos 30 s. Sin tiempo o metros suficientes no hay dato.
private struct VentanaRitmo {
  private var muestras: [(t: Double, d: Double)] = []

  mutating func cortar() {
    muestras.removeAll()
  }

  mutating func alimentar(t: Double, distancia: Double) {
    if let ultima = muestras.last, t <= ultima.t || distancia < ultima.d { return }
    muestras.append((t, distancia))
    muestras.removeAll { t - $0.t > 30 }
  }

  /// En m/s.
  var velocidad: Double? {
    guard let a = muestras.first, let b = muestras.last else { return nil }
    guard b.t - a.t >= 5, b.d - a.d >= 5 else { return nil }
    return (b.d - a.d) / (b.t - a.t)
  }
}

private func ritmoSegundosKm(velocidad: Double?) -> Double? {
  guard let v = velocidad, v.isFinite, v > 0 else { return nil }
  return 1000 / v
}

// MARK: Delegados (llegan fuera del hilo principal)

extension ServicioEntreno: HKWorkoutSessionDelegate {
  nonisolated func workoutSession(
    _ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState,
    from fromState: HKWorkoutSessionState, date: Date
  ) {
    Task { @MainActor in self.alCambiar(workoutSession, a: toState, fecha: date) }
  }

  nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
    Task { @MainActor in
      // Un fallo durante la marcha no tira lo medido: el cierre llega por «ended».
      if self.fase == .preparando, workoutSession === self.sesion { self.abortarArranque() }
    }
  }
}

extension ServicioEntreno: HKLiveWorkoutBuilderDelegate {
  nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {
    Task { @MainActor in self.recontarLargos(workoutBuilder) }
  }

  nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
    Task { @MainActor in self.alRecogerDatos(workoutBuilder, tipos: collectedTypes) }
  }
}

extension ServicioEntreno: CLLocationManagerDelegate {
  nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    Task { @MainActor in self.alRecibir(locations) }
  }

  nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    // Sin señal o sin permiso el entreno sigue: sin ruta y con lo que dé el sistema.
  }
}

// MARK: Diario en disco

private struct CabeceraDiario: Codable {
  let id: String
  let deporte: String
  let largo: Double?
  let autoPausa: Bool
  let inicio: Double
  /// La cuenta del iPhone al empezar: el entreno es suyo aunque luego cambie.
  let dueno: String?
}

private struct PuntoGrabado: Codable {
  let t: Double
  let la: Double
  let lo: Double
  let al: Double?
  /// Época, y precisiones: para rehacer el CLLocation al recuperar.
  let ts: Double
  let ph: Double
  let pv: Double
  /// Primer punto tras una pausa.
  let c: Bool?

  var ubicacion: CLLocation {
    CLLocation(
      coordinate: CLLocationCoordinate2D(latitude: la, longitude: lo), altitude: al ?? 0, horizontalAccuracy: ph,
      verticalAccuracy: al == nil ? -1 : pv, timestamp: Date(timeIntervalSince1970: ts))
  }
}

private struct FotoDiario: Codable {
  let fecha: Double
  let duracion: Double
  let distancia: Double?
  let kcal: Double?
  let fcMedia: Double?
  let fcMax: Double?
  let desnivel: Double?
  let largos: Int?
}

/// Una línea del diario: solo va relleno lo que ha pasado.
private struct LineaDiario: Codable {
  var c: CabeceraDiario?
  var p: [PuntoGrabado]?
  var f: [MuestraFc]?
  /// Los kilómetros cerrados hasta ahora: vale la última.
  var k: ParcialesKm?
  var m: ParcialMedido?
  var s: FotoDiario?
}

/// Solo añade al final (JSONL): reescribir miles de puntos cada pocos segundos
/// gastaría batería. Una última línea a medias se ignora al leer.
@MainActor
private final class DiarioEntreno {
  private let url: URL
  private var puntos: [PuntoGrabado] = []
  private var fc: [MuestraFc] = []
  private var lineas: [LineaDiario] = []

  init() {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
    url = base.appendingPathComponent("nivl-entreno-en-curso.jsonl")
  }

  func empezar(_ c: CabeceraDiario) {
    borrar()
    anotar(LineaDiario(c: c))
    volcar()
  }

  func anotar(_ l: LineaDiario) {
    lineas.append(l)
  }

  func anotarPunto(_ p: PuntoGrabado) {
    puntos.append(p)
  }

  func anotarFc(_ m: MuestraFc) {
    fc.append(m)
  }

  func volcar() {
    var todo = lineas
    lineas = []
    if !puntos.isEmpty || !fc.isEmpty {
      todo.append(LineaDiario(p: puntos.isEmpty ? nil : puntos, f: fc.isEmpty ? nil : fc))
      puntos = []
      fc = []
    }
    guard !todo.isEmpty else { return }
    let codificador = JSONEncoder()
    var bloque = Data()
    for l in todo {
      guard let data = try? codificador.encode(l) else { continue }
      bloque.append(data)
      bloque.append(0x0A)
    }
    if !FileManager.default.fileExists(atPath: url.path) {
      try? bloque.write(to: url)
      return
    }
    guard let h = try? FileHandle(forWritingTo: url) else { return }
    defer { try? h.close() }
    _ = try? h.seekToEnd()
    try? h.write(contentsOf: bloque)
  }

  func leer() -> [LineaDiario] {
    guard let data = try? Data(contentsOf: url) else { return [] }
    let decodificador = JSONDecoder()
    return data.split(separator: 0x0A).compactMap { try? decodificador.decode(LineaDiario.self, from: Data($0)) }
  }

  func borrar() {
    puntos = []
    fc = []
    lineas = []
    try? FileManager.default.removeItem(at: url)
  }
}
