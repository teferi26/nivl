// Módulo de Expo fino sobre NivlMetaCore. Los nombres casan con ../src/tipos.ts.
//
// Sin DAT enlazado compila igual y responde "no disponible" en todo.

import ExpoModulesCore
import Foundation
import UIKit

struct LineaRecord: Record {
  @Field var estilo: String = "body"
  @Field var texto: String = ""
}

struct BotonRecord: Record {
  @Field var id: String = "hecho"
  @Field var texto: String = "Hecho"
}

struct TarjetaRecord: Record {
  @Field var id: String = ""
  @Field var lineas: [LineaRecord] = []
  @Field var boton: BotonRecord? = nil
}

private func excepcion(_ error: NivlMetaError) -> Exception {
  Exception(name: "NivlMetaError", description: error.codigo, code: error.codigo)
}

#if canImport(MWDATCore) && canImport(MWDATDisplay)

@MainActor
private enum Puente {
  static let enlazado = true

  static func conectar(_ avisar: @escaping (NivlMetaEvento) -> Void) {
    NivlMetaCore.shared.alEvento = avisar
    try? NivlMetaCore.shared.configurar()
  }

  static func desconectar() {
    NivlMetaCore.shared.alEvento = nil
  }

  static var estado: NivlMetaEstado { NivlMetaCore.shared.estado }

  static func registrar() async throws(NivlMetaError) {
    try await NivlMetaCore.shared.registrar()
  }

  static func mostrar(_ tarjeta: NivlMetaTarjeta) async throws(NivlMetaError) {
    try await NivlMetaCore.shared.mostrar(tarjeta)
  }

  static func cerrar() async {
    await NivlMetaCore.shared.cerrar()
  }

  static func tratarEnlace(_ url: URL) async {
    await NivlMetaCore.shared.tratarEnlace(url)
  }
}

#else

@MainActor
private enum Puente {
  static let enlazado = false

  static func conectar(_ avisar: @escaping (NivlMetaEvento) -> Void) {}
  static func desconectar() {}
  static var estado: NivlMetaEstado { .noDisponible }
  static func registrar() async throws(NivlMetaError) {}
  static func mostrar(_ tarjeta: NivlMetaTarjeta) async throws(NivlMetaError) {}
  static func cerrar() async {}
  static func tratarEnlace(_ url: URL) async {}
}

#endif

public class NivlMetaModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NivlMeta")

    // "transcripcion" está en el contrato; este puente aún no la emite.
    Events("estado", "boton", "transcripcion")

    OnCreate {
      Task { @MainActor [weak self] in
        Puente.conectar { evento in self?.reenviar(evento) }
      }
    }

    OnDestroy {
      Task { @MainActor in Puente.desconectar() }
    }

    Function("disponible") { () -> Bool in
      #if canImport(MWDATCore) && canImport(MWDATDisplay)
        return true
      #else
        return false
      #endif
    }

    AsyncFunction("estado") { () async -> String in
      await MainActor.run { Puente.estado.rawValue }
    }

    AsyncFunction("registrar") { () async throws in
      do {
        try await Puente.registrar()
      } catch let error as NivlMetaError {
        throw excepcion(error)
      }
    }

    AsyncFunction("mostrar") { (tarjeta: TarjetaRecord) async throws in
      let nativa = NivlMetaTarjeta(
        id: tarjeta.id,
        lineas: tarjeta.lineas.map {
          NivlMetaTarjeta.Linea(
            estilo: NivlMetaTarjeta.Estilo(rawValue: $0.estilo) ?? .body,
            texto: $0.texto
          )
        },
        boton: tarjeta.boton?.texto
      )
      do {
        try await Puente.mostrar(nativa)
      } catch let error as NivlMetaError {
        throw excepcion(error)
      }
    }

    AsyncFunction("cerrar") { () async in
      await Puente.cerrar()
    }
  }

  @MainActor
  private func reenviar(_ evento: NivlMetaEvento) {
    switch evento {
    case .estado(let estado):
      sendEvent("estado", ["estado": estado.rawValue])
    case .boton(let tarjetaId):
      sendEvent("boton", ["tarjetaId": tarjetaId, "boton": "hecho"])
    case .sesionCerrada:
      break
    }
  }
}

/// La vuelta del registro desde Meta AI. Hay que declararla en `appDelegateSubscribers`.
public class NivlMetaAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    guard Puente.enlazado, nivlMetaEsEnlaceDeMeta(url) else { return false }
    Task { @MainActor in await Puente.tratarEnlace(url) }
    return true
  }
}
