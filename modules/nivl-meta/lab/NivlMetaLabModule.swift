// Solo para la variante interna: scripts/variante-interna.mjs copia este archivo a
// ios/ en un directorio temporal. No está en la carpeta del podspec, así que nunca
// se compila desde el repo, y Mock Device Kit nunca llega al binario de producción.

import ExpoModulesCore
import Foundation
import MWDATCore
import MWDATMockDevice

private struct Pintado {
  let revision: Int
  let raiz: [String: Any]

  var textos: [String] { recoger(raiz, tipo: "text", campo: "content") }
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

@MainActor
private enum Laboratorio {
  static var gafas: (any MockGlasses)?
  static var puerto: UInt16 = 0

  static func activar() async throws -> Int {
    if puerto == 0 {
      puerto = try await MockDeviceKit.shared.startTestServer()
    }
    if gafas == nil {
      let nuevas = try MockDeviceKit.shared.pairGlasses(model: .metaRayBanDisplay)
      nuevas.powerOn()
      nuevas.unfold()
      nuevas.don()
      gafas = nuevas
    }
    return Int(puerto)
  }

  /// Lo que el propio kit dice que hay en la pantalla simulada.
  static func leer() async throws -> Pintado? {
    guard puerto != 0, let url = URL(string: "http://127.0.0.1:\(puerto)/display/content") else {
      return nil
    }
    var peticion = URLRequest(url: url)
    peticion.httpMethod = "POST"
    peticion.setValue("application/json", forHTTPHeaderField: "Content-Type")
    peticion.httpBody = try JSONSerialization.data(withJSONObject: ["afterRevision": NSNull()])
    let (datos, respuesta) = try await URLSession.shared.data(for: peticion)
    guard (respuesta as? HTTPURLResponse)?.statusCode == 200,
      let json = try JSONSerialization.jsonObject(with: datos) as? [String: Any],
      let base64 = json["payload"] as? String,
      let revision = json["revision"] as? Int,
      let carga = Data(base64Encoded: base64),
      let raiz = try JSONSerialization.jsonObject(with: carga) as? [String: Any]
    else { return nil }
    return Pintado(revision: revision, raiz: raiz)
  }
}

public class NivlMetaLabModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NivlMetaLab")

    AsyncFunction("activarMock") { () async throws -> Int in
      try await Laboratorio.activar()
    }

    AsyncFunction("leerPintado") { () async throws -> [String: Any?]? in
      guard let pintado = try await Laboratorio.leer() else { return nil }
      return [
        "revision": pintado.revision,
        "textos": pintado.textos,
        "boton": pintado.tituloBoton,
      ]
    }

    AsyncFunction("pulsarBoton") { () async throws -> Bool in
      guard let gafas = await Laboratorio.gafas,
        let id = try await Laboratorio.leer()?.idBoton
      else { return false }
      return gafas.services.display.sendClick(identifier: id)
    }
  }
}

/// El mock tiene que estar activo antes de `Wearables.configure()`, y NivlMetaModule
/// lo llama al crearse. `subscriberDidRegister` corre antes que el arranque de la app.
public class NivlMetaLabAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func subscriberDidRegister() {
    MockDeviceKit.shared.enable()
  }
}
