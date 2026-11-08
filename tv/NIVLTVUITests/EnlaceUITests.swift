// NIVL TV · Punta a punta con el mando (scheme NIVLTVPuntaAPunta).
//
// Necesita el servidor local de pruebas (tv/herramientas/README.md) y solo se
// ejecuta con él: en el scheme normal no entra. Hace lo que haría una persona:
// la app enseña un código, el iPhone simulado lo aprueba, se entra, se cierra
// sesión con el mando y vuelve el código.

import XCTest

final class EnlaceUITests: XCTestCase {
    private var servidor: String { ProcessInfo.processInfo.environment["NIVL_SERVIDOR"] ?? "http://127.0.0.1:54399" }
    private var clave: String { ProcessInfo.processInfo.environment["NIVL_CLAVE"] ?? "clave-publica-local" }
    private var capturas: String? { ProcessInfo.processInfo.environment["NIVL_CAPTURAS"] }

    private func captura(_ nombre: String) {
        let imagen = XCUIScreen.main.screenshot()
        let adjunto = XCTAttachment(screenshot: imagen)
        adjunto.name = nombre
        adjunto.lifetime = .keepAlways
        add(adjunto)
        guard let capturas else { return }
        try? imagen.pngRepresentation.write(to: URL(fileURLWithPath: capturas).appendingPathComponent(nombre + ".png"))
    }

    private func control(_ ruta: String, _ cuerpo: [String: String] = [:]) async throws -> [String: Any] {
        var r = URLRequest(url: URL(string: servidor + "/_pruebas/" + ruta)!)
        r.httpMethod = "POST"
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        r.httpBody = try JSONSerialization.data(withJSONObject: cuerpo)
        let (data, _) = try await URLSession.shared.data(for: r)
        return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    private func pulsarHasta(_ boton: XCUIElement, _ tecla: XCUIRemote.Button, veces: Int = 8) {
        var n = 0
        while !boton.hasFocus && n < veces {
            XCUIRemote.shared.press(tecla)
            n += 1
            Thread.sleep(forTimeInterval: 0.6)
        }
    }

    @MainActor
    func testEnlazarEntrarYCerrarSesion() async throws {
        continueAfterFailure = false
        _ = try await control("revocar")
        let app = XCUIApplication()
        app.launchArguments = ["-nivlServidor", servidor, "-nivlClave", clave, "-pestana", "cuenta"]
        app.launch()

        let codigo = app.staticTexts["codigoEnlace"]
        XCTAssertTrue(codigo.waitForExistence(timeout: 30), "tiene que aparecer el código")
        let pedir = app.buttons["pedirCodigo"]
        XCTAssertFalse(pedir.exists, "con un código a la vista no hay botón que lo deje huérfano")
        captura("1-codigo")

        // Rechazado en el iPhone: aparece el botón, con el foco, y pide otro.
        _ = try await control("rechazar")
        XCTAssertTrue(pedir.waitForExistence(timeout: 20), "sin código hay que poder pedir otro")
        var espera = 0
        while !pedir.hasFocus && espera < 10 {
            Thread.sleep(forTimeInterval: 0.3)
            espera += 1
        }
        XCTAssertTrue(pedir.hasFocus, "el botón tiene que tener el foco")
        captura("1b-rechazado")
        XCUIRemote.shared.press(.select)
        XCTAssertTrue(codigo.waitForExistence(timeout: 20), "vuelve el código")

        let r = try await control("aprobar", ["cuenta": "llena"])
        XCTAssertEqual(r["ok"] as? Bool, true, "\(r)")

        let cerrar = app.buttons["cerrarSesion"]
        let entro = cerrar.waitForExistence(timeout: 40)
        if !entro { print("JERARQUIA", app.debugDescription) }
        XCTAssertTrue(entro, "tiene que entrar con datos")
        captura("2-cuenta")

        // El foco arranca en la barra o en el primer botón: abajo hasta «Cerrar sesión».
        pulsarHasta(cerrar, .down)
        XCTAssertTrue(cerrar.hasFocus, "«Cerrar sesión» tiene que poder enfocarse")
        XCUIRemote.shared.press(.select)

        let confirmar = app.alerts.buttons["Cerrar sesión"].firstMatch
        XCTAssertTrue(confirmar.waitForExistence(timeout: 10), "tiene que pedir confirmación")
        captura("3-confirmacion")
        pulsarHasta(confirmar, .right)
        XCTAssertTrue(confirmar.hasFocus)
        XCUIRemote.shared.press(.select)

        let otro = app.staticTexts["codigoEnlace"]
        XCTAssertTrue(otro.waitForExistence(timeout: 30), "tras cerrar sesión vuelve el código")
        captura("4-codigo-otra-vez")

        let estado = try await control("estado")
        XCTAssertEqual(estado["dispositivos"] as? Int, 0, "la sesión también se borra en el servidor")
    }
}
