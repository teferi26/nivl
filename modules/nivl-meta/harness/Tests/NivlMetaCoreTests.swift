import MWDATCore
import MWDATDisplay
import MWDATMockDevice
import XCTest

@testable import NivlMetaHost

/// Prueba NivlMetaCore.swift contra el DAT real con Mock Device Kit: gafas simuladas,
/// sesión de Display de verdad y clics inyectados por el identificador que el SDK
/// asigna al botón. Lo que se comprueba de la tarjeta sale del servidor de pruebas
/// del propio kit, que devuelve lo que la vista de previsualización pintaría.
@MainActor
final class NivlMetaCoreTests: XCTestCase {
  private var core: NivlMetaCore!
  private var eventos: [NivlMetaEvento] = []
  private var puerto: UInt16 = 0

  private func preparar(_ config: MockDeviceKitConfig = MockDeviceKitConfig()) async throws {
    MockDeviceKit.shared.enable(config: config)
    puerto = try await MockDeviceKit.shared.startTestServer()
    core = NivlMetaCore(esperaGafas: .seconds(1), esperaArranque: .seconds(10), esperaPausa: .seconds(3))
    eventos = []
    core.alEvento = { [weak self] in self?.eventos.append($0) }
    try core.configurar()
  }

  override func tearDown() async throws {
    await core?.cerrar()
    core = nil
    await MockDeviceKit.shared.stopTestServer()
    await MockDeviceKit.shared.disable()
    try await super.tearDown()
  }

  private func emparejar(_ modelo: GlassesModel) throws -> any MockGlasses {
    let gafas = try MockDeviceKit.shared.pairGlasses(model: modelo)
    gafas.powerOn()
    gafas.unfold()
    gafas.don()
    return gafas
  }

  private func hasta(
    _ descripcion: String,
    limite: Duration = .seconds(10),
    _ condicion: () -> Bool,
    file: StaticString = #filePath,
    line: UInt = #line
  ) async throws {
    let reloj = ContinuousClock()
    let fin = reloj.now.advanced(by: limite)
    while !condicion() {
      if reloj.now >= fin {
        XCTFail("Tiempo agotado esperando: \(descripcion). Eventos: \(eventos)", file: file, line: line)
        return
      }
      try await Task.sleep(for: .milliseconds(50))
    }
  }

  private func gafasListas(_ modelo: GlassesModel = .metaRayBanDisplay) async throws -> any MockGlasses {
    let gafas = try emparejar(modelo)
    try await hasta("conectadas") { core.estado == .conectadas }
    return gafas
  }

  private var botones: [String] {
    eventos.compactMap {
      if case .boton(let id) = $0 { return id }
      return nil
    }
  }

  private var cierres: Int {
    eventos.filter { $0 == .sesionCerrada }.count
  }

  // MARK: - Contenido pintado, leído del servidor del kit

  private struct Pintado {
    let revision: Int
    let raiz: [String: Any]

    var textos: [String] { recoger(raiz, tipo: "text", campo: "content") }
    var estilos: [String] { recoger(raiz, tipo: "text", campo: "style") }
    var tituloBoton: String? { recoger(raiz, tipo: "button", campo: "title").first }
    var idBoton: String? { recoger(raiz, tipo: "button", campo: "identifier").first }

    private func recoger(_ nodo: Any, tipo: String, campo: String) -> [String] {
      if let lista = nodo as? [Any] {
        return lista.flatMap { recoger($0, tipo: tipo, campo: campo) }
      }
      guard let dic = nodo as? [String: Any] else { return [] }
      let propio = (dic["type"] as? String) == tipo ? [dic[campo] as? String].compactMap { $0 } : []
      return propio + dic.values.flatMap { recoger($0, tipo: tipo, campo: campo) }
    }
  }

  private func leerPintado(despuesDe revision: Int? = nil) async throws -> Pintado? {
    var peticion = URLRequest(url: URL(string: "http://127.0.0.1:\(puerto)/display/content")!)
    peticion.httpMethod = "POST"
    peticion.setValue("application/json", forHTTPHeaderField: "Content-Type")
    let cuerpo: [String: Any] = ["afterRevision": revision.map { $0 as Any } ?? NSNull()]
    peticion.httpBody = try JSONSerialization.data(withJSONObject: cuerpo)
    let (datos, respuesta) = try await URLSession.shared.data(for: peticion)
    guard (respuesta as? HTTPURLResponse)?.statusCode == 200 else { return nil }
    let json = try XCTUnwrap(JSONSerialization.jsonObject(with: datos) as? [String: Any])
    guard let base64 = json["payload"] as? String, let rev = json["revision"] as? Int else {
      return nil
    }
    let carga = try XCTUnwrap(Data(base64Encoded: base64))
    let raiz = try XCTUnwrap(JSONSerialization.jsonObject(with: carga) as? [String: Any])
    return Pintado(revision: rev, raiz: raiz)
  }

  private func esperarPintado(
    despuesDe revision: Int? = nil,
    file: StaticString = #filePath,
    line: UInt = #line
  ) async throws -> Pintado {
    let reloj = ContinuousClock()
    let fin = reloj.now.advanced(by: .seconds(5))
    while reloj.now < fin {
      if let pintado = try await leerPintado(despuesDe: revision) { return pintado }
      try await Task.sleep(for: .milliseconds(50))
    }
    XCTFail("El kit no entregó contenido nuevo", file: file, line: line)
    throw CancellationError()
  }

  private func comprobarError(
    _ esperado: NivlMetaError,
    file: StaticString = #filePath,
    line: UInt = #line,
    _ operacion: () async throws -> Void
  ) async {
    do {
      try await operacion()
      XCTFail("Debía fallar con \(esperado)", file: file, line: line)
    } catch {
      XCTAssertEqual(error as? NivlMetaError, esperado, file: file, line: line)
    }
  }

  private func tarjeta(_ id: String = "m1", boton: String? = "Hecho") -> NivlMetaTarjeta {
    NivlMetaTarjeta(
      id: id,
      lineas: [
        .init(estilo: .heading, texto: "Misión \(id)"),
        .init(estilo: .body, texto: "30 min de lectura"),
        .init(estilo: .meta, texto: "Antes de cenar"),
      ],
      boton: boton
    )
  }

  // MARK: - Estado

  func testGafasAusentes() async throws {
    try await preparar()
    XCTAssertEqual(core.estado, .desconectadas)
    XCTAssertFalse(core.tienePantalla)
    await comprobarError(.sinGafas) { try await self.core.mostrar(self.tarjeta()) }
  }

  func testEmparejadasPeroApagadas() async throws {
    try await preparar()
    _ = try MockDeviceKit.shared.pairGlasses(model: .metaRayBanDisplay)
    try await Task.sleep(for: .milliseconds(300))
    XCTAssertEqual(core.estado, .desconectadas)
    await comprobarError(.sinGafas) { try await self.core.mostrar(self.tarjeta()) }
  }

  func testGafasSinPantalla() async throws {
    try await preparar()
    _ = try await gafasListas(.rayBanMeta)
    XCTAssertEqual(core.estado, .conectadas)
    XCTAssertFalse(core.tienePantalla)
    await comprobarError(.sinPantalla) { try await self.core.mostrar(self.tarjeta()) }
    XCTAssertEqual(cierres, 0)
  }

  func testSinRegistrar() async throws {
    try await preparar(MockDeviceKitConfig(initiallyRegistered: false))
    XCTAssertEqual(core.estado, .sinRegistrar)
    await comprobarError(.sinRegistrar) { try await self.core.mostrar(self.tarjeta()) }
  }

  func testRegistrarLlevaARegistrada() async throws {
    try await preparar(MockDeviceKitConfig(initiallyRegistered: false))
    try await core.registrar()
    try await hasta("registrada") { core.estado == .desconectadas }
    try await hasta("evento de estado") { eventos.contains(.estado(.desconectadas)) }
  }

  func testEventosDeEstado() async throws {
    try await preparar()
    let gafas = try await gafasListas()
    try await hasta("evento conectadas") { eventos.last == .estado(.conectadas) }
    gafas.powerOff()
    try await hasta("evento desconectadas") { eventos.last == .estado(.desconectadas) }
  }

  // MARK: - Tarjeta y botón

  func testTarjetaYBotonHecho() async throws {
    try await preparar()
    let gafas = try await gafasListas()
    XCTAssertTrue(core.tienePantalla)

    try await core.mostrar(tarjeta())

    let pintado = try await esperarPintado()
    XCTAssertEqual(pintado.textos.sorted(), ["30 min de lectura", "Antes de cenar", "Misión m1"])
    XCTAssertEqual(pintado.estilos.sorted(), ["body", "heading", "meta"])
    XCTAssertEqual(pintado.tituloBoton, "Hecho")
    let id = try XCTUnwrap(pintado.idBoton)

    XCTAssertTrue(botones.isEmpty, "Sin clic no hay evento")
    XCTAssertTrue(gafas.services.display.sendClick(identifier: id))
    try await hasta("evento de botón") { botones == ["m1"] }
  }

  func testTarjetaSinBoton() async throws {
    try await preparar()
    _ = try await gafasListas()
    try await core.mostrar(tarjeta(boton: nil))
    let pintado = try await esperarPintado()
    XCTAssertEqual(pintado.textos.count, 3)
    XCTAssertNil(pintado.idBoton)
  }

  func testDobleClicSoloAvisaUnaVez() async throws {
    try await preparar()
    let gafas = try await gafasListas()
    try await core.mostrar(tarjeta())
    let pintado = try await esperarPintado()
    let id = try XCTUnwrap(pintado.idBoton)

    gafas.services.display.sendClick(identifier: id)
    gafas.services.display.sendClick(identifier: id)
    try await hasta("evento de botón") { !botones.isEmpty }
    try await Task.sleep(for: .milliseconds(400))
    XCTAssertEqual(botones, ["m1"])
  }

  /// El SDK deduplica un reenvío idéntico: no hay revisión nueva y el identificador
  /// del botón es el mismo. Tras otro `mostrar`, el botón debe volver a avisar.
  func testLaMismaTarjetaReenviadaVuelveAAvisar() async throws {
    try await preparar()
    let gafas = try await gafasListas()
    try await core.mostrar(tarjeta())
    let pintado = try await esperarPintado()
    let id = try XCTUnwrap(pintado.idBoton)
    gafas.services.display.sendClick(identifier: id)
    try await hasta("primer aviso") { botones == ["m1"] }

    try await core.mostrar(tarjeta())
    let posterior = try await leerPintado(despuesDe: pintado.revision)
    XCTAssertNil(posterior, "Reenvío idéntico: el SDK no publica revisión nueva")
    gafas.services.display.sendClick(identifier: id)
    try await hasta("segundo aviso") { botones == ["m1", "m1"] }
  }

  /// Dos tarjetas con el mismo aspecto y distinto id: el clic es de la vigente.
  func testBotonesIgualesSeAtribuyenALaTarjetaVigente() async throws {
    try await preparar()
    let gafas = try await gafasListas()
    let lineas = [NivlMetaTarjeta.Linea(estilo: .heading, texto: "Leer")]
    try await core.mostrar(NivlMetaTarjeta(id: "a", lineas: lineas))
    let pintado = try await esperarPintado()
    let id = try XCTUnwrap(pintado.idBoton)
    try await core.mostrar(NivlMetaTarjeta(id: "b", lineas: lineas))
    gafas.services.display.sendClick(identifier: id)
    try await hasta("aviso de la vigente") { botones == ["b"] }
  }

  func testCadaEnvioSustituyeLaVista() async throws {
    try await preparar()
    let gafas = try await gafasListas()

    try await core.mostrar(tarjeta("a"))
    let primero = try await esperarPintado()
    let idA = try XCTUnwrap(primero.idBoton)

    try await core.mostrar(tarjeta("b", boton: "Listo"))
    let segundo = try await esperarPintado(despuesDe: primero.revision)
    let idB = try XCTUnwrap(segundo.idBoton)
    XCTAssertTrue(segundo.textos.contains("Misión b"))
    XCTAssertFalse(segundo.textos.contains("Misión a"), "La vista anterior no debe seguir")
    XCTAssertEqual(segundo.tituloBoton, "Listo")
    XCTAssertNotEqual(idA, idB, "El identificador depende del contenido del botón")

    gafas.services.display.sendClick(identifier: idA)
    try await Task.sleep(for: .milliseconds(400))
    XCTAssertTrue(botones.isEmpty, "El botón de una vista sustituida no avisa")

    gafas.services.display.sendClick(identifier: idB)
    try await hasta("evento de la vista vigente") { botones == ["b"] }
  }

  func testDosMostrarALaVezCompartenSesion() async throws {
    try await preparar()
    _ = try await gafasListas()
    let core = self.core!
    let a = tarjeta("a")
    let b = tarjeta("b")
    async let uno: Void = core.mostrar(a)
    async let dos: Void = core.mostrar(b)
    _ = try await (uno, dos)
    XCTAssertEqual(cierres, 0)
    _ = try await esperarPintado()
  }

  // MARK: - Fin de sesión

  func testCerrarYReabrir() async throws {
    try await preparar()
    let gafas = try await gafasListas()
    try await core.mostrar(tarjeta("a"))
    let pintado = try await esperarPintado()
    let id = try XCTUnwrap(pintado.idBoton)

    await core.cerrar()
    XCTAssertEqual(cierres, 1)
    XCTAssertEqual(core.estado, .conectadas, "Cerrar la sesión no desconecta las gafas")

    gafas.services.display.sendClick(identifier: id)
    try await Task.sleep(for: .milliseconds(400))
    XCTAssertTrue(botones.isEmpty, "Tras cerrar no llega ningún botón")

    try await core.mostrar(tarjeta("b"))
    XCTAssertEqual(cierres, 1)
  }

  func testCerrarSinSesionNoHaceNada() async throws {
    try await preparar()
    await core.cerrar()
    XCTAssertEqual(cierres, 0)
  }

  func testApagarDuranteLaSesion() async throws {
    try await preparar()
    let gafas = try await gafasListas()
    try await core.mostrar(tarjeta())

    gafas.powerOff()
    try await hasta("sesión cerrada") { cierres == 1 }
    try await hasta("desconectadas") { core.estado == .desconectadas }
    await comprobarError(.sinGafas) { try await self.core.mostrar(self.tarjeta()) }

    gafas.powerOn()
    gafas.unfold()
    gafas.don()
    try await hasta("conectadas otra vez") { core.estado == .conectadas }
    try await core.mostrar(tarjeta("otra"))
    let pintado = try await esperarPintado()
    let id = try XCTUnwrap(pintado.idBoton)
    gafas.services.display.sendClick(identifier: id)
    try await hasta("botón tras reconectar") { botones == ["otra"] }
  }

  func testPlegarDuranteLaSesion() async throws {
    try await preparar()
    let gafas = try await gafasListas()
    try await core.mostrar(tarjeta())
    gafas.fold()
    try await hasta("sesión cerrada al plegar") { cierres == 1 }
  }

  /// Observa qué hace el kit al quitarse las gafas. La vuelta debe dejar la tarjeta
  /// operativa, sea porque la sesión siguió o porque `mostrar` abre otra.
  func testQuitarseYPonerseLasGafas() async throws {
    try await preparar()
    let gafas = try await gafasListas()
    try await core.mostrar(tarjeta())
    let antes = try await esperarPintado()

    gafas.doff()
    try await Task.sleep(for: .seconds(1))
    gafas.don()
    try await hasta("conectadas tras ponérselas") { core.estado == .conectadas }

    try await core.mostrar(tarjeta("vuelta"))
    let despues = try await esperarPintado(despuesDe: antes.revision)
    XCTAssertTrue(despues.textos.contains("Misión vuelta"))
    gafas.services.display.sendClick(identifier: try XCTUnwrap(despues.idBoton))
    try await hasta("botón tras ponérselas") { botones == ["vuelta"] }
  }

  /// El kit no simula la atenuación a los 20 s ni el sueño a los 25 s. Esto solo
  /// garantiza que nada en nuestro lado cierra ni repinta por inactividad.
  func testNadaCierraPorInactividad() async throws {
    try await preparar()
    let gafas = try await gafasListas()
    try await core.mostrar(tarjeta())
    let pintado = try await esperarPintado()
    let id = try XCTUnwrap(pintado.idBoton)

    try await Task.sleep(for: .seconds(26))

    XCTAssertEqual(cierres, 0)
    let posterior = try await leerPintado(despuesDe: pintado.revision)
    XCTAssertNil(posterior, "Sin repintado por inactividad")
    gafas.services.display.sendClick(identifier: id)
    try await hasta("botón tras la espera") { botones == ["m1"] }
  }

  // MARK: - Lógica sin SDK

  func testSoloLosEnlacesDeMetaSonDelPuente() throws {
    XCTAssertTrue(nivlMetaEsEnlaceDeMeta(try XCTUnwrap(URL(string: "nivl://x?metaWearablesAction=register"))))
    XCTAssertFalse(nivlMetaEsEnlaceDeMeta(try XCTUnwrap(URL(string: "nivl://c/CODIGO"))))
    XCTAssertFalse(nivlMetaEsEnlaceDeMeta(try XCTUnwrap(URL(string: "https://nivl.app/auth/confirmar?token=1"))))
  }

  func testNombresDeEstadoDelPuente() {
    XCTAssertEqual(
      [NivlMetaEstado.noDisponible, .sinRegistrar, .registrando, .desconectadas, .conectadas].map(\.rawValue),
      ["no_disponible", "sin_registrar", "registrando", "desconectadas", "conectadas"]
    )
  }
}
