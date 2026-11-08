// NIVL TV · Las cuatro RPC de la TV con URLSession.
//
// POST {url}/rest/v1/rpc/<nombre> con cabeceras apikey y Authorization con la
// clave pública. Sin dependencias y sin logs: el token y el secreto viajan en
// el cuerpo y nunca se imprimen. Sesión efímera: nada se guarda en la caché
// de URL ni en cookies.

import Foundation

/// El resultado de un `tv_datos` correcto, con el JSON en bruto para la caché.
struct CargaTV: Equatable {
    let paquete: PaqueteTV
    let crudo: Data
    let sincronizado: Date
}

protocol ServicioTV: Sendable {
    func emitirCodigo(nombre: String) async throws -> RespuestaEmision
    func canjear(secreto: String) async throws -> RespuestaCanje
    func datos(token: String, hoy: String) async throws -> CargaTV
    func cerrarSesion(token: String) async throws
}

struct ClienteTV: ServicioTV {
    let config: ConfigServidor
    let sesion: URLSession

    init(config: ConfigServidor) {
        self.config = config
        let c = URLSessionConfiguration.ephemeral
        c.timeoutIntervalForRequest = 20
        c.timeoutIntervalForResource = 30
        c.waitsForConnectivity = false
        c.requestCachePolicy = .reloadIgnoringLocalCacheData
        c.urlCache = nil
        c.httpCookieStorage = nil
        sesion = URLSession(configuration: c)
    }

    func emitirCodigo(nombre: String) async throws -> RespuestaEmision {
        try ContratoTV.emision(try await llamar("tv_emitir_codigo", ["p_nombre": nombre]))
    }

    func canjear(secreto: String) async throws -> RespuestaCanje {
        try ContratoTV.canje(try await llamar("tv_canjear", ["p_secreto": secreto]))
    }

    func datos(token: String, hoy: String) async throws -> CargaTV {
        let data = try await llamar("tv_datos", ["p_token": token, "p_hoy": hoy])
        return CargaTV(paquete: try ContratoTV.paquete(data), crudo: data, sincronizado: Date())
    }

    func cerrarSesion(token: String) async throws {
        _ = try await llamar("tv_cerrar_sesion", ["p_token": token])
    }

    private func llamar(_ funcion: String, _ cuerpo: [String: String]) async throws -> Data {
        var peticion = URLRequest(url: config.url.appendingPathComponent("rest/v1/rpc/\(funcion)"))
        peticion.httpMethod = "POST"
        peticion.setValue(config.clave, forHTTPHeaderField: "apikey")
        peticion.setValue("Bearer \(config.clave)", forHTTPHeaderField: "Authorization")
        peticion.setValue("application/json", forHTTPHeaderField: "Content-Type")
        peticion.httpBody = try JSONSerialization.data(withJSONObject: cuerpo)

        let data: Data
        let respuesta: URLResponse
        do {
            (data, respuesta) = try await sesion.data(for: peticion)
        } catch {
            throw Self.traducir(error)
        }
        guard let http = respuesta as? HTTPURLResponse else { throw ErrorTV.servidor(nil) }
        guard (200...299).contains(http.statusCode) else { throw ErrorTV.servidor(http.statusCode) }
        return data
    }

    /// Lo que no es una falta de red es un fallo del servidor. Ninguno borra la sesión.
    static func traducir(_ error: Error) -> ErrorTV {
        if let propio = error as? ErrorTV { return propio }
        guard let url = error as? URLError else { return .servidor(nil) }
        switch url.code {
        case .notConnectedToInternet, .networkConnectionLost, .cannotFindHost, .cannotConnectToHost,
             .dnsLookupFailed, .timedOut, .dataNotAllowed, .internationalRoamingOff,
             .secureConnectionFailed, .callIsActive:
            return .sinRed
        default:
            return .servidor(nil)
        }
    }
}
