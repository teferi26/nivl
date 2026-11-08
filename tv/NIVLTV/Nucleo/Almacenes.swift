// NIVL TV · Dónde se guarda la sesión.
//
// El token va en el Llavero: no sincronizable, solo en este aparato y legible
// tras el primer desbloqueo. La caché es el último paquete en bruto en
// Caches, para abrir sin red; tvOS puede vaciarla cuando quiera y no pasa
// nada. Las dos se borran juntas al cerrar sesión.

import Foundation
import Security

protocol AlmacenToken: Sendable {
    func leer() -> String?
    /// false si no se ha podido guardar.
    func guardar(_ token: String) -> Bool
    func borrar()
}

struct LlaveroToken: AlmacenToken {
    var servicio = "com.teferi.nivl.tv.sesion"
    var cuenta = "token"

    private var consultaBase: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: servicio,
            kSecAttrAccount as String: cuenta,
            kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
        ]
    }

    func leer() -> String? {
        var consulta = consultaBase
        consulta[kSecReturnData as String] = true
        consulta[kSecMatchLimit as String] = kSecMatchLimitOne
        var resultado: CFTypeRef?
        guard SecItemCopyMatching(consulta as CFDictionary, &resultado) == errSecSuccess,
              let data = resultado as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func guardar(_ token: String) -> Bool {
        guard let data = token.data(using: .utf8) else { return false }
        SecItemDelete(consultaBase as CFDictionary)
        var nuevo = consultaBase
        nuevo[kSecValueData as String] = data
        nuevo[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(nuevo as CFDictionary, nil) == errSecSuccess
    }

    func borrar() {
        SecItemDelete(consultaBase as CFDictionary)
    }
}

/// El último paquete leído y cuándo se leyó.
struct CacheTV: Equatable {
    let paquete: PaqueteTV
    let sincronizado: Date
}

protocol AlmacenCache: Sendable {
    func leer() -> CacheTV?
    func guardar(_ carga: CargaTV)
    func borrar()
}

struct ArchivoCache: AlmacenCache {
    private struct Sobre: Codable {
        var version = 1
        let sincronizado: Date
        let crudo: Data
    }

    var carpeta: URL = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("nivl-tv", isDirectory: true)

    private var archivo: URL { carpeta.appendingPathComponent("paquete.json") }

    func leer() -> CacheTV? {
        guard let data = try? Data(contentsOf: archivo) else { return nil }
        guard let sobre = try? JSONDecoder().decode(Sobre.self, from: data), sobre.version == 1,
              let paquete = try? ContratoTV.paquete(sobre.crudo) else {
            borrar()
            return nil
        }
        return CacheTV(paquete: paquete, sincronizado: sobre.sincronizado)
    }

    func guardar(_ carga: CargaTV) {
        guard let data = try? JSONEncoder().encode(Sobre(sincronizado: carga.sincronizado, crudo: carga.crudo)) else { return }
        try? FileManager.default.createDirectory(at: carpeta, withIntermediateDirectories: true)
        try? data.write(to: archivo, options: .atomic)
    }

    func borrar() {
        try? FileManager.default.removeItem(at: carpeta)
    }
}
