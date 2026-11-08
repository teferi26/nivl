// NIVL · Entreno con el GPS del iPhone (carrera y bici, sin reloj).
//
// · Todo el estado vive en `cola`, que nunca espera al hilo principal: así JS
//   puede leerlo de forma síncrona sin riesgo de interbloqueo. CoreLocation se
//   toca solo desde el hilo principal.
// · Cada 5 s los puntos van a disco: si el sistema mata la app, `gpsEstado` la
//   recupera con `interrumpido: true` y lo guardado.
// · `t` en la ruta son segundos en movimiento: ver `RelojActivo`.

import CoreLocation
import Foundation
import HealthKit

enum ErrorGps: Error {
  case sinPermiso
  case precisionReducida
  case yaEnMarcha
  case deporteInvalido
  case sinInfoPlist
}

private struct PuntoGps: Codable {
  /// Reloj de pared (epoch), para Salud.
  var w: Double
  /// Segundos en movimiento.
  var t: Double
  var lat: Double
  var lon: Double
  var alt: Double?
  var acc: Double
}

private struct PausaGps: Codable {
  var desde: Double
  var hasta: Double?
}

/// Lo que sobrevive a un cierre. Se reescribe entero en cada volcado; la
/// distancia, el desnivel y los parciales se recalculan de los puntos.
private struct MetaGps: Codable {
  var deporte: String
  var autoPausa: Bool
  var inicio: Double
  var acumulado: Double
  /// Epoch del inicio del tramo en marcha; nil si está en pausa.
  var tramoDesde: Double?
  var fase: String
  var pausas: [PausaGps]
  var latido: Double
}

/// Suma la ruta punto a punto; mismos umbrales que el reloj (ServicioEntreno).
/// La base solo avanza cuando el punto se ha alejado: quieto, el baile del GPS
/// no acumula metros.
private struct AcumuladorGps {
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

  /// Devuelve si el punto se aceptó.
  @discardableResult
  mutating func alimentar(lat: Double, lon: Double, altitud: Double?, precision: Double, t: Double) -> Bool {
    guard precision >= 0, precision <= 30 else { return false }
    if let altitud {
      altura.alimentar(altitud)
      lecturasAltitud += 1
    }
    guard let b = base else {
      base = (lat, lon, t)
      return true
    }
    let paso = EntrenoPuro.distanciaM(lat1: b.lat, lon1: b.lon, lat2: lat, lon2: lon)
    guard paso >= 2 else { return true }
    // Un salto imposible es un GPS que se ha ido: ni suma ni mueve la base.
    if t > b.t, paso / (t - b.t) > 40 { return false }
    distancia += paso
    base = (lat, lon, t)
    return true
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

  /// En s/km.
  var ritmo: Double? {
    guard let a = muestras.first, let b = muestras.last else { return nil }
    guard b.t - a.t >= 5, b.d - a.d >= 5 else { return nil }
    return (b.t - a.t) / ((b.d - a.d) / 1000)
  }
}

private struct SesionGps {
  var meta: MetaGps
  var puntos: [PuntoGps]
  var sinVolcar: [PuntoGps] = []
  var interrumpido: Bool
  var parando = false
  var auto: AutoPausa
  var acumulador = AcumuladorGps()
  var kms = ParcialesKm()
  var ritmo = VentanaRitmo()
  var precision: Double?
  /// Epoch del último fix que servía para decidir la auto-pausa.
  var ultimoDecidible: Double?
  /// El primer punto de cada tramo es la base y se apunta aunque no avance.
  var empiezaTramo = true

  init(meta: MetaGps, puntos: [PuntoGps], interrumpido: Bool) {
    self.meta = meta
    self.puntos = puntos
    self.interrumpido = interrumpido
    auto = AutoPausa(esBici: meta.deporte == "bici")
    // Mismo cálculo que en directo: los puntos guardados son los que movieron
    // la base, y una pausa entre dos de ellos corta el tramo.
    var previo: PuntoGps?
    for p in puntos {
      if let previo, meta.pausas.contains(where: { $0.desde >= previo.w && $0.desde <= p.w }) {
        acumulador.cortar()
      }
      acumulador.alimentar(lat: p.lat, lon: p.lon, altitud: p.alt, precision: p.acc, t: p.t)
      kms.alimentar(distancia: acumulador.distancia, t: p.t, desnivel: acumulador.desnivel ?? 0)
      previo = p
    }
  }
}

final class GpsSesion: NSObject, CLLocationManagerDelegate, @unchecked Sendable {
  static let compartido = GpsSesion()

  /// Avisa a JS del estado. Se llama en el hilo principal.
  var alCambiar: (([String: Any]) -> Void)?

  private let cola = DispatchQueue(label: "app.nivl.gps")
  private var sesion: SesionGps?
  private var cargado = false
  private var temporizador: DispatchSourceTimer?
  private var pulsos = 0
  private var tareaParar: Task<String?, Never>?

  /// Solo en el hilo principal.
  private var manager: CLLocationManager?
  private var esperandoPermiso: [CheckedContinuation<String, Never>] = []

  private let codificador = JSONEncoder()
  private let decodificador = JSONDecoder()

  // MARK: Disco

  private var carpeta: URL {
    FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("nivl-gps", isDirectory: true)
  }
  private var rutaMeta: URL { carpeta.appendingPathComponent("sesion.json") }
  private var rutaPuntos: URL { carpeta.appendingPathComponent("puntos.jsonl") }

  private func prepararCarpeta() {
    var url = carpeta
    try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    // Una ruta dice dónde vive alguien: no viaja en la copia de seguridad.
    var valores = URLResourceValues()
    valores.isExcludedFromBackup = true
    try? url.setResourceValues(valores)
  }

  /// En `cola`. Tras un volcado, el disco refleja el estado hasta este instante.
  private func volcar() {
    guard var s = sesion else { return }
    s.meta.latido = Date().timeIntervalSince1970
    if !s.sinVolcar.isEmpty {
      var bloque = Data()
      for p in s.sinVolcar {
        guard let linea = try? codificador.encode(p) else { continue }
        bloque.append(linea)
        bloque.append(0x0A)
      }
      if !FileManager.default.fileExists(atPath: rutaPuntos.path) {
        // Accesible con el teléfono bloqueado en el bolsillo, que es el caso normal.
        FileManager.default.createFile(
          atPath: rutaPuntos.path,
          contents: nil,
          attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        )
      }
      if let h = try? FileHandle(forWritingTo: rutaPuntos) {
        _ = try? h.seekToEnd()
        try? h.write(contentsOf: bloque)
        try? h.close()
      }
      s.sinVolcar.removeAll()
    }
    if let datos = try? codificador.encode(s.meta) {
      try? datos.write(to: rutaMeta, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
    sesion = s
  }

  /// En `cola`. Recupera del disco la sesión de un proceso anterior.
  private func cargarSiHaceFalta() {
    guard !cargado else { return }
    cargado = true
    guard let datos = try? Data(contentsOf: rutaMeta),
      var meta = try? decodificador.decode(MetaGps.self, from: datos)
    else { return }

    var puntos: [PuntoGps] = []
    if let texto = try? Data(contentsOf: rutaPuntos) {
      // La última línea puede estar a medias si el cierre pilló la escritura.
      for linea in texto.split(separator: 0x0A) {
        if let p = try? decodificador.decode(PuntoGps.self, from: Data(linea)) { puntos.append(p) }
      }
    }
    if let desde = meta.tramoDesde {
      meta.acumulado += max(0, meta.latido - desde)
      meta.tramoDesde = nil
    }
    if meta.pausas.last.map({ $0.hasta != nil }) ?? true {
      meta.pausas.append(PausaGps(desde: meta.latido, hasta: nil))
    }
    meta.fase = "pausa"
    sesion = SesionGps(meta: meta, puntos: puntos, interrumpido: true)
  }

  private func borrarDisco() {
    try? FileManager.default.removeItem(at: rutaMeta)
    try? FileManager.default.removeItem(at: rutaPuntos)
  }

  // MARK: Permiso

  private static func nombre(_ s: CLAuthorizationStatus) -> String {
    switch s {
    case .notDetermined: return "sin_decidir"
    case .authorizedWhenInUse: return "en_uso"
    case .authorizedAlways: return "siempre"
    default: return "denegado"
    }
  }

  /// El método de clase se puede llamar desde el hilo de JS; el de instancia
  /// obligaría a tocar el manager fuera del principal.
  func permiso() -> String {
    Self.nombre(CLLocationManager.authorizationStatus())
  }

  private func conManager(_ cuerpo: @escaping (CLLocationManager) -> Void) {
    DispatchQueue.main.async { [self] in
      if let m = manager {
        cuerpo(m)
        return
      }
      let m = CLLocationManager()
      m.delegate = self
      manager = m
      cuerpo(m)
    }
  }

  func pedirPermiso() async throws -> String {
    // Sin el texto en Info.plist, iOS no pregunta ni avisa: la promesa no acabaría.
    guard Bundle.main.object(forInfoDictionaryKey: "NSLocationWhenInUseUsageDescription") != nil else {
      throw ErrorGps.sinInfoPlist
    }
    let actual = permiso()
    guard actual == "sin_decidir" else { return actual }
    return await withCheckedContinuation { c in
      conManager { [self] m in
        // Puede haberse decidido ya: entonces el delegado no volvería a avisar.
        let ahora = m.authorizationStatus
        guard ahora == .notDetermined else {
          c.resume(returning: Self.nombre(ahora))
          return
        }
        esperandoPermiso.append(c)
        m.requestWhenInUseAuthorization()
      }
    }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    let estado = manager.authorizationStatus
    // Al crear el manager llega un aviso con «sin decidir»: aún no hay respuesta.
    guard estado != .notDetermined else { return }
    let pendientes = esperandoPermiso
    esperandoPermiso.removeAll()
    for c in pendientes { c.resume(returning: Self.nombre(estado)) }
  }

  // MARK: Ciclo de vida

  func empezar(deporte: String, autoPausa: Bool) async throws {
    guard deporte == "carrera" || deporte == "bici" else { throw ErrorGps.deporteInvalido }
    let actual = permiso()
    guard actual == "en_uso" || actual == "siempre" else { throw ErrorGps.sinPermiso }

    try await withCheckedThrowingContinuation { (c: CheckedContinuation<Void, Error>) in
      conManager { [self] m in
        // Con «ubicación aproximada» todos los puntos se rechazarían en silencio.
        guard m.accuracyAuthorization == .fullAccuracy else {
          c.resume(throwing: ErrorGps.precisionReducida)
          return
        }
        cola.async { [self] in
          cargarSiHaceFalta()
          guard sesion == nil else {
            c.resume(throwing: ErrorGps.yaEnMarcha)
            return
          }
          let ahora = Date().timeIntervalSince1970
          sesion = SesionGps(
            meta: MetaGps(
              deporte: deporte,
              autoPausa: autoPausa,
              inicio: ahora,
              acumulado: 0,
              tramoDesde: ahora,
              fase: "midiendo",
              pausas: [],
              latido: ahora
            ),
            puntos: [],
            interrumpido: false
          )
          prepararCarpeta()
          borrarDisco()
          volcar()
          arrancarTemporizador()
          DispatchQueue.main.async { [self] in
            encenderGps(deporte: deporte)
            c.resume()
          }
          emitir()
        }
      }
    }
  }

  /// En el hilo principal.
  private func encenderGps(deporte: String) {
    conManager { m in
      m.desiredAccuracy = kCLLocationAccuracyBest
      m.distanceFilter = kCLDistanceFilterNone
      m.activityType = deporte == "bici" ? .otherNavigation : .fitness
      m.pausesLocationUpdatesAutomatically = false
      // Sin el modo «location» en Info.plist, activar esto hace abortar la app.
      let modos = Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String] ?? []
      if modos.contains("location") {
        m.allowsBackgroundLocationUpdates = true
        m.showsBackgroundLocationIndicator = true
      }
      m.startUpdatingLocation()
    }
  }

  private func apagarGps() {
    conManager { m in
      m.stopUpdatingLocation()
      let modos = Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String] ?? []
      if modos.contains("location") { m.allowsBackgroundLocationUpdates = false }
    }
  }

  /// En `cola`.
  private func arrancarTemporizador() {
    temporizador?.cancel()
    pulsos = 0
    let t = DispatchSource.makeTimerSource(queue: cola)
    t.schedule(deadline: .now() + 1, repeating: 1)
    t.setEventHandler { [weak self] in
      guard let self else { return }
      pulsos += 1
      vigilarAutoPausa()
      if pulsos % 5 == 0 { volcar() }
      emitir()
    }
    t.resume()
    temporizador = t
  }

  /// En `cola`. Sin señal no llega ningún fix: la salida de la auto-pausa la da
  /// el temporizador.
  private func vigilarAutoPausa() {
    guard var s = sesion, !s.interrumpido, !s.parando, s.meta.fase == "pausa_auto" else { return }
    let ahora = Date().timeIntervalSince1970
    guard ahora - (s.ultimoDecidible ?? 0) >= 3 else { return }
    let cambio = s.auto.sinDato(t: ahora)
    sesion = s
    if cambio == .reanudar {
      salirDePausa(ahora: ahora)
      volcar()
    }
  }

  private func pararTemporizador() {
    temporizador?.cancel()
    temporizador = nil
  }

  /// En `cola`. Cierra el tramo en marcha.
  private func entrarEnPausa(_ fase: String, ahora: Double) {
    guard var s = sesion, let desde = s.meta.tramoDesde else { return }
    s.meta.acumulado += max(0, ahora - desde)
    s.meta.tramoDesde = nil
    s.meta.fase = fase
    s.meta.pausas.append(PausaGps(desde: ahora, hasta: nil))
    s.acumulador.cortar()
    s.ritmo.cortar()
    s.empiezaTramo = true
    sesion = s
  }

  /// En `cola`. Abre un tramo nuevo.
  private func salirDePausa(ahora: Double) {
    guard var s = sesion, s.meta.tramoDesde == nil else { return }
    s.meta.tramoDesde = ahora
    s.meta.fase = "midiendo"
    if let i = s.meta.pausas.indices.last, s.meta.pausas[i].hasta == nil {
      s.meta.pausas[i].hasta = ahora
    }
    s.acumulador.cortar()
    s.empiezaTramo = true
    sesion = s
  }

  func pausar() {
    cola.async { [self] in
      cargarSiHaceFalta()
      guard let s = sesion, !s.interrumpido, !s.parando else { return }
      let ahora = Date().timeIntervalSince1970
      if s.meta.fase == "midiendo" {
        entrarEnPausa("pausa", ahora: ahora)
      } else if s.meta.fase == "pausa_auto" {
        // Ya estaba parado: solo cambia quién tiene que reanudar.
        sesion?.meta.fase = "pausa"
      } else {
        return
      }
      sesion?.auto.enPausa = false
      sesion?.auto.reiniciar()
      volcar()
      emitir()
    }
  }

  func reanudar() {
    cola.async { [self] in
      cargarSiHaceFalta()
      guard let s = sesion, !s.parando, s.meta.fase != "midiendo" else { return }
      salirDePausa(ahora: Date().timeIntervalSince1970)
      sesion?.auto.enPausa = false
      sesion?.auto.reiniciar()
      if s.interrumpido {
        // Sigue la sesión de un proceso anterior: el GPS y el reloj se relanzan.
        sesion?.interrumpido = false
        arrancarTemporizador()
        let deporte = s.meta.deporte
        DispatchQueue.main.async { [self] in encenderGps(deporte: deporte) }
      }
      volcar()
      emitir()
    }
  }

  func descartar() {
    cola.async { [self] in
      cargarSiHaceFalta()
      guard let s = sesion, !s.parando else { return }
      pararTemporizador()
      if !s.interrumpido { apagarGps() }
      sesion = nil
      borrarDisco()
    }
  }

  func estado() -> [String: Any]? {
    cola.sync {
      cargarSiHaceFalta()
      return sesion.map(diccionario)
    }
  }

  // MARK: Puntos

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    cola.async { [self] in
      for l in locations { procesar(l) }
    }
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    // Un fallo puntual de señal no para la sesión: se sigue esperando puntos.
  }

  /// En `cola`.
  private func procesar(_ l: CLLocation) {
    guard var s = sesion, !s.interrumpido, !s.parando else { return }
    if l.horizontalAccuracy >= 0 { s.precision = l.horizontalAccuracy }
    sesion = s
    let cuando = l.timestamp.timeIntervalSince1970
    // Lo cacheado al arrancar no se mide.
    guard l.horizontalAccuracy >= 0, abs(l.timestamp.timeIntervalSinceNow) < 10, cuando >= s.meta.inicio
    else { return }

    if s.meta.autoPausa, s.meta.fase != "pausa" {
      // Con GPS malo no se entra en pausa, pero quien ya está en ella tiene salida.
      let cambio: AutoPausa.Cambio?
      if l.speed >= 0, l.horizontalAccuracy <= 20 {
        s.ultimoDecidible = cuando
        cambio = s.auto.alimentar(velocidad: l.speed, t: cuando)
      } else {
        cambio = s.auto.sinDato(t: cuando)
      }
      sesion = s
      if cambio == .pausar, s.meta.fase == "midiendo" {
        entrarEnPausa("pausa_auto", ahora: cuando)
        volcar()
        emitir()
      } else if cambio == .reanudar, s.meta.fase == "pausa_auto" {
        salirDePausa(ahora: cuando)
        volcar()
        emitir()
      }
      guard let actual = sesion else { return }
      s = actual
    }

    guard s.meta.fase == "midiendo", let tramo = s.meta.tramoDesde else { return }
    let t = s.meta.acumulado + max(0, cuando - tramo)
    let altitud = l.verticalAccuracy >= 0 && l.verticalAccuracy <= 20 ? l.altitude : nil

    let antes = s.acumulador.distancia
    let aceptado = s.acumulador.alimentar(
      lat: l.coordinate.latitude,
      lon: l.coordinate.longitude,
      altitud: altitud,
      precision: l.horizontalAccuracy,
      t: t
    )
    guard aceptado else {
      sesion = s
      return
    }
    s.ritmo.alimentar(t: t, distancia: s.acumulador.distancia)

    // Solo se apunta lo que movió la base: parado, el GPS baila sin avanzar.
    if s.acumulador.distancia > antes || s.empiezaTramo {
      s.empiezaTramo = false
      s.kms.alimentar(distancia: s.acumulador.distancia, t: t, desnivel: s.acumulador.desnivel ?? 0)
      let punto = PuntoGps(
        w: cuando,
        t: t,
        lat: l.coordinate.latitude,
        lon: l.coordinate.longitude,
        alt: altitud,
        acc: l.horizontalAccuracy
      )
      s.puntos.append(punto)
      s.sinVolcar.append(punto)
    }
    sesion = s
  }

  // MARK: Estado

  private func duracion(_ m: MetaGps, ahora: Double) -> Double {
    m.acumulado + (m.tramoDesde.map { max(0, ahora - $0) } ?? 0)
  }

  private func parcialesJs(_ lista: [ParcialesKm.Parcial], conAltitud: Bool) -> [[String: Any]] {
    lista.map {
      [
        "n": $0.n,
        "tipo": "km",
        "distancia_m": ApoyoSalud.num($0.distancia_m, decimales: 1),
        "duracion_s": ApoyoSalud.num($0.duracion_s),
        "fc_media": NSNull(),
        // Sin altitud medida, el 0 de ParcialesKm sería mentira.
        "desnivel_m": conAltitud ? ApoyoSalud.num($0.desnivel_m, decimales: 1) : NSNull(),
      ]
    }
  }

  private func diccionario(_ s: SesionGps) -> [String: Any] {
    let m = s.meta
    return [
      "deporte": m.deporte,
      "fase": m.fase,
      "interrumpido": s.interrumpido,
      "inicio": ApoyoSalud.texto(Date(timeIntervalSince1970: m.inicio)),
      "duracion_s": ApoyoSalud.num(duracion(m, ahora: Date().timeIntervalSince1970)),
      "distancia_m": ApoyoSalud.num(s.acumulador.distancia, decimales: 1),
      "ritmo_s_km": ApoyoSalud.num(m.fase == "midiendo" ? s.ritmo.ritmo : nil),
      "precision_m": ApoyoSalud.num(s.precision, decimales: 1),
      "desnivel_m": ApoyoSalud.num(s.acumulador.desnivel, decimales: 1),
      "parciales": parcialesJs(s.kms.cerrados, conAltitud: s.acumulador.desnivel != nil),
    ]
  }

  /// En `cola`.
  private func emitir() {
    guard let s = sesion else { return }
    let e = diccionario(s)
    DispatchQueue.main.async { [self] in alCambiar?(e) }
  }

  // MARK: Parar

  /// `conSalud` false: sin el permiso de salud de NIVL ni se lee pulso ni se
  /// escribe en Salud.
  func parar(conSalud: Bool) async -> String? {
    let tarea: Task<String?, Never> = cola.sync {
      if let t = tareaParar { return t }
      let t = Task { await self.cierreCompleto(conSalud: conSalud) }
      tareaParar = t
      return t
    }
    let resultado = await tarea.value
    cola.async { [self] in tareaParar = nil }
    return resultado
  }

  private func cierreCompleto(conSalud: Bool) async -> String? {
    let toma: SesionGps? = cola.sync {
      cargarSiHaceFalta()
      guard sesion != nil else { return nil }
      pararTemporizador()
      let ahora = Date().timeIntervalSince1970
      if !(sesion?.interrumpido ?? true) { apagarGps() }
      entrarEnPausa(sesion?.meta.fase ?? "pausa", ahora: ahora)
      sesion?.parando = true
      volcar()
      return sesion
    }
    guard let s = toma else { return nil }

    let json = await construir(s, conSalud: conSalud)
    cola.sync {
      sesion = nil
      borrarDisco()
    }
    return json
  }

  /// El entreno termina cuando se dejó de moverse, no al pulsar «parar»: toda
  /// sesión llega aquí con una última pausa abierta.
  private func construir(_ s: SesionGps, conSalud: Bool) async -> String? {
    let m = s.meta
    guard m.acumulado >= 30, s.puntos.count >= 2 else { return nil }

    let inicio = Date(timeIntervalSince1970: m.inicio)
    let finEpoch = m.pausas.last(where: { $0.hasta == nil })?.desde ?? m.latido
    let fin = Date(timeIntervalSince1970: finEpoch)
    guard fin > inicio else { return nil }

    let pausas: [DateInterval] = m.pausas.compactMap {
      guard let h = $0.hasta, h > $0.desde else { return nil }
      return DateInterval(
        start: Date(timeIntervalSince1970: $0.desde),
        end: Date(timeIntervalSince1970: h)
      )
    }
    let reloj = RelojActivo(inicio: inicio, pausas: pausas)
    let lector = LectorSalud.compartido
    // Lo que se pueda leer de Salud (pulso del reloj, energía). Sin permiso, vacío.
    var medidas: (fcMedia: Double?, fcMax: Double?, kcal: Double?)?
    var serie: [[String: Any]] = []
    if conSalud, LectorSalud.disponible() {
      medidas = try? await lector.medidasVentana(inicio: inicio, fin: fin)
      serie = (try? await lector.serieFc(inicio: inicio, fin: fin, reloj: reloj)) ?? []
    }

    let guardado = conSalud ? await guardarEnSalud(s, inicio: inicio, fin: fin, pausas: pausas) : nil
    let uuid = guardado ?? UUID()

    var ruta: [[String: Any]] = []
    var ultimoT = -1.0
    for p in s.puntos {
      let t = p.t.rounded()
      guard t > ultimoT else { continue }
      ultimoT = t
      ruta.append([
        "t": t,
        "lat": p.lat,
        "lon": p.lon,
        "alt": ApoyoSalud.num(p.alt, decimales: 1),
      ])
    }

    let distancia = s.acumulador.distancia
    let desnivel = s.acumulador.desnivel
    let parciales = s.kms.conResto(distancia: distancia, t: m.acumulado, desnivel: desnivel ?? 0)
    let objeto: [String: Any] = [
      "origen": "iphone_gps",
      "externo_id": uuid.uuidString,
      "deporte": m.deporte,
      "inicio": ApoyoSalud.texto(inicio),
      "fin": ApoyoSalud.texto(fin),
      "duracion_s": ApoyoSalud.num(m.acumulado),
      "distancia_m": ApoyoSalud.numPositivo(distancia, decimales: 1),
      "kcal": ApoyoSalud.numPositivo(medidas?.kcal),
      "fc_media": ApoyoSalud.num(medidas?.fcMedia),
      "fc_max": ApoyoSalud.num(medidas?.fcMax),
      "desnivel_m": ApoyoSalud.num(desnivel, decimales: 1),
      "ruta": ruta.count >= 2 ? EntrenoPuro.adelgazarRuta(ruta) : NSNull(),
      "parciales": parcialesJs(parciales, conAltitud: desnivel != nil),
      "largo_piscina_m": NSNull(),
      "fc_serie": serie.count >= 2 ? serie : NSNull(),
    ]
    return ApoyoSalud.json(objeto)
  }

  /// Sin permiso de escritura o con cualquier fallo devuelve nil: el entreno
  /// vale igual para NIVL aunque no llegue a Salud.
  private func guardarEnSalud(
    _ s: SesionGps,
    inicio: Date,
    fin: Date,
    pausas: [DateInterval]
  ) async -> UUID? {
    guard LectorSalud.disponible() else { return nil }
    let store = LectorSalud.compartido.store
    guard store.authorizationStatus(for: HKObjectType.workoutType()) == .sharingAuthorized else { return nil }

    let m = s.meta
    let esBici = m.deporte == "bici"
    let configuracion = HKWorkoutConfiguration()
    configuracion.activityType = esBici ? .cycling : .running
    configuracion.locationType = .outdoor

    let builder = HKWorkoutBuilder(healthStore: store, configuration: configuracion, device: .local())
    do {
      try await builder.beginCollection(at: inicio)

      let tipoDistancia = HKQuantityType(esBici ? .distanceCycling : .distanceWalkingRunning)
      let distancia = s.acumulador.distancia
      if distancia > 0, store.authorizationStatus(for: tipoDistancia) == .sharingAuthorized {
        let muestra = HKQuantitySample(
          type: tipoDistancia,
          quantity: HKQuantity(unit: .meter(), doubleValue: distancia),
          start: inicio,
          end: fin
        )
        try await builder.addSamples([muestra])
      }

      var eventos: [HKWorkoutEvent] = []
      for p in pausas where p.end <= fin {
        eventos.append(
          HKWorkoutEvent(type: .pause, dateInterval: DateInterval(start: p.start, duration: 0), metadata: nil))
        eventos.append(
          HKWorkoutEvent(type: .resume, dateInterval: DateInterval(start: p.end, duration: 0), metadata: nil))
      }
      if !eventos.isEmpty { try await builder.addWorkoutEvents(eventos) }

      var metadatos: [String: Any] = [HKMetadataKeyIndoorWorkout: false]
      if let subida = s.acumulador.desnivel {
        metadatos[HKMetadataKeyElevationAscended] = HKQuantity(unit: .meter(), doubleValue: subida)
      }
      try await builder.addMetadata(metadatos)

      let ruta = await insertarRuta(s, en: builder, inicio: inicio, fin: fin)
      try await builder.endCollection(at: fin)
      guard let entreno = try await builder.finishWorkout() else { return nil }

      // Si la ruta falla, el entreno ya está guardado en Salud y se queda.
      if let ruta { _ = try? await ruta.finishRoute(with: entreno, metadata: nil) }
      return entreno.uuid
    } catch {
      builder.discardWorkout()
      return nil
    }
  }

  /// Con un builder de entreno la ruta se le pide a él (lo dice la cabecera) y
  /// se rellena antes de cerrarlo. nil si no hay ruta que terminar.
  private func insertarRuta(
    _ s: SesionGps,
    en builder: HKWorkoutBuilder,
    inicio: Date,
    fin: Date
  ) async -> HKWorkoutRouteBuilder? {
    let store = LectorSalud.compartido.store
    guard store.authorizationStatus(for: HKSeriesType.workoutRoute()) == .sharingAuthorized else { return nil }
    let lugares = s.puntos
      .filter { $0.w >= inicio.timeIntervalSince1970 && $0.w <= fin.timeIntervalSince1970 }
      .map {
        CLLocation(
          coordinate: CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lon),
          altitude: $0.alt ?? 0,
          horizontalAccuracy: $0.acc,
          verticalAccuracy: $0.alt == nil ? -1 : 10,
          timestamp: Date(timeIntervalSince1970: $0.w)
        )
      }
    guard !lugares.isEmpty,
      let ruta = builder.seriesBuilder(for: HKSeriesType.workoutRoute()) as? HKWorkoutRouteBuilder
    else { return nil }
    do {
      try await ruta.insertRouteData(lugares)
      return ruta
    } catch {
      ruta.discard()
      return nil
    }
  }
}
