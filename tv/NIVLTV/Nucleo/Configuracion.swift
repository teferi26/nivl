// NIVL TV · Con qué servidor habla la app.
//
// La URL y la clave pública salen de tv/Config/Servidor.local.xcconfig
// (gitignorado) a través del Info.plist. Sin ellas la app no puede hablar con
// nadie y enseña «servicio no disponible». La compilación Release sin
// configurar ya falla antes, en el Run Script del proyecto.

import Foundation

struct ConfigServidor: Equatable, Sendable {
    let url: URL
    let clave: String

    private static let hostsLocales: Set<String> = ["localhost", "127.0.0.1", "::1"]

    /// nil si falta algo o viene sin resolver. `http` solo a la propia máquina y solo si se permite.
    static func validar(url texto: String?, clave: String?, permitirLocal: Bool) -> ConfigServidor? {
        guard let texto = texto?.trimmingCharacters(in: .whitespacesAndNewlines), !texto.isEmpty,
              let clave = clave?.trimmingCharacters(in: .whitespacesAndNewlines), !clave.isEmpty,
              !texto.contains("$("), !clave.contains("$("),
              let url = URL(string: texto), let host = url.host, !host.isEmpty,
              let esquema = url.scheme?.lowercased() else { return nil }
        let local = permitirLocal && hostsLocales.contains(host.lowercased())
        guard esquema == "https" || (esquema == "http" && local) else { return nil }
        return ConfigServidor(url: url, clave: clave)
    }

    /// La configuración de este binario, o nil si no tiene.
    static func actual() -> ConfigServidor? {
        #if DEBUG || targetEnvironment(simulator)
        let l = Lanzamiento.actual
        if let servidor = l.servidor, let clave = l.clave {
            return validar(url: servidor, clave: clave, permitirLocal: true)
        }
        #endif
        let info = Bundle.main.infoDictionary
        return validar(
            url: info?["NIVLSupabaseURL"] as? String,
            clave: info?["NIVLSupabaseClave"] as? String,
            permitirLocal: false
        )
    }
}

#if DEBUG || targetEnvironment(simulator)
/// Argumentos de arranque para capturas y pruebas locales. En Release para
/// aparato este tipo no existe: ni la demo ni otro servidor se pueden pedir.
struct Lanzamiento: Equatable {
    var demo = false
    var pestana: String?
    var estado: String?
    /// Solo con la demo: vacia, sinsalud, descanso, real o larga.
    var variante: String?
    var servidor: String?
    var clave: String?

    static let actual = Lanzamiento.leer(ProcessInfo.processInfo.arguments)

    /// Corre bajo XCTest: la app anfitriona no debe arrancar la sesión real.
    static var enTests: Bool {
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
    }

    /// Pares `-nombre valor`. La demo pide exactamente `-nivlDemo 1`.
    static func leer(_ argumentos: [String]) -> Lanzamiento {
        var r = Lanzamiento()
        var i = 0
        while i + 1 < argumentos.count {
            let valor = argumentos[i + 1]
            switch argumentos[i] {
            case "-nivlDemo": r.demo = valor == "1"
            case "-pestana": r.pestana = valor
            case "-estado": r.estado = valor
            case "-variante": r.variante = valor
            case "-nivlServidor": r.servidor = valor
            case "-nivlClave": r.clave = valor
            default: break
            }
            i += 1
        }
        return r
    }
}
#endif
