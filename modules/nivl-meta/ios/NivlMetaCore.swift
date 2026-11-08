// Puente con las gafas Meta sobre el Wearables Device Access Toolkit (DAT) 1.0.1.
//
// Sin dependencia de Expo: lo prueba en el Simulador el harness de ../harness con
// Mock Device Kit. Todo lo que toca DAT va bajo `canImport`; sin el SDK solo quedan
// los tipos, y el módulo de Expo responde "no disponible".
//
// Este puente solo pinta una tarjeta y avisa del botón. No mueve economía: completar
// una misión sigue siendo la vía de siempre, en la app y con confirmación.

import Foundation

public enum NivlMetaEstado: String, Sendable {
  case noDisponible = "no_disponible"
  case sinRegistrar = "sin_registrar"
  case registrando
  case desconectadas
  case conectadas
}

public enum NivlMetaError: Error, Equatable, Sendable {
  case noDisponible
  case sinRegistrar
  case metaAiNoInstalada
  case registroFallido
  case sinGafas
  case sinPantalla
  case actualizacionRequerida
  case sesionNoArranca
  case sesionEnPausa
  case pantallaNoArranca
  case envioFallido

  public var codigo: String {
    switch self {
    case .noDisponible: "no_disponible"
    case .sinRegistrar: "sin_registrar"
    case .metaAiNoInstalada: "meta_ai_no_instalada"
    case .registroFallido: "registro_fallido"
    case .sinGafas: "sin_gafas"
    case .sinPantalla: "sin_pantalla"
    case .actualizacionRequerida: "actualizacion_requerida"
    case .sesionNoArranca: "sesion_no_arranca"
    case .sesionEnPausa: "sesion_en_pausa"
    case .pantallaNoArranca: "pantalla_no_arranca"
    case .envioFallido: "envio_fallido"
    }
  }
}

/// Lo que llega de la fachada ya viene acotado a la pantalla (`acotarTarjeta`).
public struct NivlMetaTarjeta: Sendable, Equatable {
  public enum Estilo: String, Sendable {
    case heading
    case body
    case meta
  }

  public struct Linea: Sendable, Equatable {
    public let estilo: Estilo
    public let texto: String

    public init(estilo: Estilo, texto: String) {
      self.estilo = estilo
      self.texto = texto
    }
  }

  public let id: String
  public let lineas: [Linea]
  /// Texto del botón; nil si la tarjeta no lleva.
  public let boton: String?

  public init(id: String, lineas: [Linea], boton: String? = "Hecho") {
    self.id = id
    self.lineas = lineas
    self.boton = boton
  }
}

public enum NivlMetaEvento: Sendable, Equatable {
  case estado(NivlMetaEstado)
  case boton(tarjetaId: String)
  case sesionCerrada
}

/// Meta AI vuelve a la app con este parámetro; el resto de enlaces no son suyos.
public func nivlMetaEsEnlaceDeMeta(_ url: URL) -> Bool {
  URLComponents(url: url, resolvingAgainstBaseURL: false)?
    .queryItems?
    .contains { $0.name == "metaWearablesAction" } ?? false
}

#if canImport(MWDATCore) && canImport(MWDATDisplay)
import MWDATCore
import MWDATDisplay

@MainActor
public final class NivlMetaCore {
  public static let shared = NivlMetaCore()

  public var alEvento: ((NivlMetaEvento) -> Void)?

  private let esperaGafas: Duration
  private let esperaArranque: Duration
  private let esperaPausa: Duration

  private var wearables: (any WearablesInterface)?
  private var tokensGlobales: [any AnyListenerToken] = []
  private var tokensPorGafas: [DeviceIdentifier: [any AnyListenerToken]] = [:]
  private var ultimoEstado: NivlMetaEstado?

  private var sesion: DeviceSession?
  private var pantalla: Display?
  private var tokensSesion: [any AnyListenerToken] = []
  private var cola: Task<Void, Never>?
  private var enPausa = false

  private var tarjetaActual: NivlMetaTarjeta?
  private var tarjetaPulsada = false

  public init(
    esperaGafas: Duration = .seconds(5),
    esperaArranque: Duration = .seconds(15),
    esperaPausa: Duration = .seconds(15)
  ) {
    self.esperaGafas = esperaGafas
    self.esperaArranque = esperaArranque
    self.esperaPausa = esperaPausa
  }

  // MARK: - Configuración y estado

  /// Idempotente. Se llama al arrancar y antes de cualquier otra operación.
  public func configurar() throws(NivlMetaError) {
    guard wearables == nil else { return }
    do throws(WearablesError) {
      try Wearables.configure()
    } catch {
      guard error == .alreadyConfigured else { throw .noDisponible }
    }
    let w = Wearables.shared
    wearables = w
    tokensGlobales = [
      w.addRegistrationStateListener { [weak self] _ in
        Task { @MainActor in self?.registroCambio() }
      },
      w.addDevicesListener { [weak self] ids in
        Task { @MainActor in self?.gafasCambiaron(ids) }
      },
    ]
    gafasCambiaron(w.devices)
  }

  public var estado: NivlMetaEstado {
    guard let w = wearables else { return .noDisponible }
    switch w.registrationState {
    // La muestra oficial ofrece registrar tanto en unavailable como en available.
    case .unavailable, .available: return .sinRegistrar
    case .registering: return .registrando
    case .registered: return hayGafasConectadas(w) ? .conectadas : .desconectadas
    }
  }

  /// Hay gafas enlazadas y alguna tiene pantalla. Las Ray-Ban Meta normales conectan
  /// pero no pintan: `mostrar` responde `sinPantalla`.
  public var tienePantalla: Bool {
    guard let w = wearables else { return false }
    return w.devices.contains { id in
      guard let d = w.deviceForIdentifier(id) else { return false }
      return d.linkState == .connected && d.supportsDisplay()
    }
  }

  private func hayGafasConectadas(_ w: any WearablesInterface) -> Bool {
    w.devices.contains { w.deviceForIdentifier($0)?.linkState == .connected }
  }

  private func registroCambio() {
    if let w = wearables, w.registrationState != .registered, sesion != nil {
      detenerSesion()
      alEvento?(.sesionCerrada)
    }
    avisarEstado()
  }

  private func gafasCambiaron(_ ids: [DeviceIdentifier]) {
    guard let w = wearables else { return }
    for id in tokensPorGafas.keys where !ids.contains(id) {
      tokensPorGafas[id] = nil
    }
    for id in ids where tokensPorGafas[id] == nil {
      guard let d = w.deviceForIdentifier(id) else { continue }
      tokensPorGafas[id] = [
        d.addLinkStateListener { [weak self] _ in
          Task { @MainActor in self?.avisarEstado() }
        },
        d.addCompatibilityListener { [weak self] _ in
          Task { @MainActor in self?.avisarEstado() }
        },
      ]
    }
    avisarEstado()
  }

  private func avisarEstado() {
    let actual = estado
    guard actual != ultimoEstado else { return }
    ultimoEstado = actual
    alEvento?(.estado(actual))
  }

  // MARK: - Registro

  /// Abre Meta AI; la vuelta llega por URL a `tratarEnlace`.
  public func registrar() async throws(NivlMetaError) {
    try configurar()
    guard let w = wearables else { throw .noDisponible }
    switch w.registrationState {
    case .registered, .registering: return
    case .unavailable, .available: break
    }
    do throws(RegistrationError) {
      try await w.startRegistration()
    } catch {
      switch error {
      case .alreadyRegistered: return
      case .metaAINotInstalled: throw .metaAiNoInstalada
      default: throw .registroFallido
      }
    }
  }

  @discardableResult
  public func tratarEnlace(_ url: URL) async -> Bool {
    guard nivlMetaEsEnlaceDeMeta(url), let w = wearables else { return false }
    return (try? await w.handleUrl(url)) ?? false
  }

  // MARK: - Tarjeta

  /// Abre la sesión si hace falta y pinta la tarjeta. Solo debe llamarse tras un gesto
  /// del usuario: Meta exige que la sesión de Display la inicie él.
  public func mostrar(_ tarjeta: NivlMetaTarjeta) async throws(NivlMetaError) {
    let turno = await pedirTurno()
    defer { turno.finish() }
    try configurar()
    guard let w = wearables else { throw .noDisponible }
    guard w.registrationState == .registered else { throw .sinRegistrar }
    tarjetaPulsada = false
    let pantalla = try await pantallaLista(w)
    do {
      try await enviar(tarjeta, a: pantalla)
    } catch {
      // La sesión pudo morir sin avisar todavía. Un intento limpio y ya.
      detenerSesion()
      let nueva = try await pantallaLista(w)
      do {
        try await enviar(tarjeta, a: nueva)
      } catch {
        detenerSesion()
        throw .envioFallido
      }
    }
  }

  private func enviar(_ tarjeta: NivlMetaTarjeta, a pantalla: Display) async throws {
    // Cada send sustituye la vista y sus manejadores. El clic siempre se atribuye a la
    // tarjeta vigente: el SDK da el mismo identificador a botones iguales y un reenvío
    // idéntico ni siquiera llega a sustituir el manejador anterior.
    try await pantalla.send(vista(tarjeta))
    tarjetaActual = tarjeta
  }

  private func vista(_ tarjeta: NivlMetaTarjeta) -> FlexBox {
    let alPulsar: @Sendable () -> Void = { [weak self] in
      Task { @MainActor in self?.botonPulsado() }
    }
    return FlexBox(direction: .column, spacing: 12) {
      for linea in tarjeta.lineas {
        switch linea.estilo {
        case .heading: Text(linea.texto, style: .heading)
        case .body: Text(linea.texto, style: .body)
        case .meta: Text(linea.texto, style: .meta, color: .secondary)
        }
      }
      if let boton = tarjeta.boton {
        Button(label: boton, style: .primary, iconName: .checkmark, onClick: alPulsar)
          .actionRole(.primary)
      }
    }
    .padding(24)
    .background(.card)
  }

  private func botonPulsado() {
    guard let tarjeta = tarjetaActual, tarjeta.boton != nil, !tarjetaPulsada else { return }
    tarjetaPulsada = true
    alEvento?(.boton(tarjetaId: tarjeta.id))
  }

  public func cerrar() async {
    let turno = await pedirTurno()
    defer { turno.finish() }
    guard let s = sesion else { return }
    detenerSesion()
    _ = await esperar(esperaArranque) { s.state == .stopped }
    alEvento?(.sesionCerrada)
  }

  /// `mostrar` y `cerrar` van en fila: dos envíos cruzados se cancelan entre sí en el SDK.
  private func pedirTurno() async -> AsyncStream<Void>.Continuation {
    let anterior = cola
    let (espera, turno) = AsyncStream<Void>.makeStream()
    cola = Task { for await _ in espera {} }
    await anterior?.value
    return turno
  }

  // MARK: - Sesión

  private func pantallaLista(_ w: any WearablesInterface) async throws(NivlMetaError) -> Display {
    if let s = sesion, s.state == .paused {
      // La documentación pide no reiniciar en pausa: o vuelve a started o acaba en stopped.
      guard await esperar(esperaPausa, { s.state != .paused }) else {
        throw .sesionEnPausa
      }
    }
    if let s = sesion, let p = pantalla, s.state == .started, p.state == .started {
      return p
    }
    detenerSesion()
    return try await abrir(w)
  }

  private func abrir(_ w: any WearablesInterface) async throws(NivlMetaError) -> Display {
    let id = try await gafasConPantalla(w)
    let s: DeviceSession
    do throws(DeviceSessionError) {
      s = try w.createSession(deviceSelector: SpecificDeviceSelector(device: id))
    } catch {
      throw traducir(error)
    }
    sesion = s
    tokensSesion = [
      s.statePublisher.listen { [weak self] nuevo in
        Task { @MainActor in self?.sesionCambio(s, a: nuevo) }
      },
      s.errorPublisher.listen { [weak self] error in
        Task { @MainActor in self?.sesionFallo(s, error) }
      },
    ]
    do throws(NivlMetaError) {
      do throws(DeviceSessionError) {
        try s.start()
      } catch {
        throw traducir(error)
      }
      guard await esperar(esperaArranque, { s.state == .started }) else {
        throw NivlMetaError.sesionNoArranca
      }
      let d: Display
      do throws(DeviceSessionError) {
        d = try s.addDisplay()
      } catch {
        throw traducir(error)
      }
      pantalla = d
      tokensSesion.append(
        d.statePublisher.listen { [weak self] nuevo in
          Task { @MainActor in self?.pantallaCambio(d, a: nuevo) }
        })
      d.start()
      guard await esperar(esperaArranque, { d.state == .started }) else {
        throw NivlMetaError.pantallaNoArranca
      }
      return d
    } catch {
      detenerSesion()
      throw error
    }
  }

  private func gafasConPantalla(_ w: any WearablesInterface) async throws(NivlMetaError)
    -> DeviceIdentifier
  {
    var encontrada: DeviceIdentifier?
    var hayEnlazadas = false
    var hayQueActualizar = false
    let inspeccionar = {
      hayEnlazadas = false
      hayQueActualizar = false
      for id in w.devices {
        guard let d = w.deviceForIdentifier(id), d.linkState == .connected else { continue }
        hayEnlazadas = true
        guard d.supportsDisplay() else { continue }
        switch d.compatibility() {
        case .compatible:
          encontrada = id
          return true
        case .deviceUpdateRequired, .sdkUpdateRequired:
          hayQueActualizar = true
        default:
          break
        }
      }
      return false
    }
    _ = await esperar(esperaGafas) { inspeccionar() }
    if let encontrada { return encontrada }
    if hayQueActualizar { throw .actualizacionRequerida }
    throw hayEnlazadas ? .sinPantalla : .sinGafas
  }

  private func sesionCambio(_ s: DeviceSession, a nuevo: DeviceSessionState) {
    guard s === sesion else { return }
    switch nuevo {
    case .paused:
      enPausa = true
    case .started:
      guard enPausa else { return }
      enPausa = false
      // Las gafas no guardan estado: al volver de una pausa se repinta lo último.
      if let p = pantalla, p.state == .started, let t = tarjetaActual {
        Task { [weak self] in
          guard let self else { return }
          let turno = await self.pedirTurno()
          defer { turno.finish() }
          guard self.pantalla === p else { return }
          try? await self.enviar(t, a: p)
        }
      }
    case .stopped:
      detenerSesion()
      alEvento?(.sesionCerrada)
    case .idle, .starting, .stopping:
      break
    }
  }

  private func sesionFallo(_ s: DeviceSession, _ error: DeviceSessionError) {
    guard s === sesion, s.state == .stopped || s.state == .idle else { return }
    detenerSesion()
    alEvento?(.sesionCerrada)
  }

  private func pantallaCambio(_ d: Display, a nuevo: DisplayState) {
    // El sistema puede interrumpir la pantalla con la sesión viva. El sueño a los 25 s
    // no pasa por aquí: atenúa y duerme sin cerrar, y no hay nada que reabrir.
    guard d === pantalla, nuevo == .stopped else { return }
    detenerSesion()
    alEvento?(.sesionCerrada)
  }

  private func detenerSesion() {
    let d = pantalla
    let s = sesion
    pantalla = nil
    sesion = nil
    tokensSesion = []
    enPausa = false
    tarjetaActual = nil
    d?.stop()
    s?.stop()
  }

  private func traducir(_ error: DeviceSessionError) -> NivlMetaError {
    switch error {
    case .noEligibleDevice: .sinGafas
    case .datAppOnTheGlassesUpdateRequired, .insufficientSDKVersion: .actualizacionRequerida
    default: .sesionNoArranca
    }
  }

  /// true si la condición se cumplió antes del límite.
  private func esperar(_ limite: Duration, _ condicion: () -> Bool) async -> Bool {
    let reloj = ContinuousClock()
    let fin = reloj.now.advanced(by: limite)
    while !condicion() {
      guard reloj.now < fin, !Task.isCancelled else { return false }
      try? await Task.sleep(for: .milliseconds(50))
    }
    return true
  }
}
#endif
