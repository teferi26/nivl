// NIVL TV · La sesión guiada y el foco, con el mando (scheme NIVLTVPuntaAPunta).
//
// Los de la sesión van con la demo y sin servidor. `testRefrescarNoPierdeFoco`
// necesita el servidor local (tv/herramientas/README.md) y una cuenta enlazada.

import XCTest

final class SalonUITests: XCTestCase {
    private var capturas: String? { ProcessInfo.processInfo.environment["NIVL_CAPTURAS"] }

    private func captura(_ nombre: String) {
        guard let capturas else { return }
        let imagen = XCUIScreen.main.screenshot()
        try? imagen.pngRepresentation.write(to: URL(fileURLWithPath: capturas).appendingPathComponent(nombre + ".png"))
    }

    private func abrir(_ argumentos: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-nivlDemo", "1"] + argumentos
        app.launch()
        return app
    }

    private func esperarFoco(_ e: XCUIElement, intentos: Int = 20) -> Bool {
        var n = 0
        while !e.hasFocus && n < intentos {
            Thread.sleep(forTimeInterval: 0.3)
            n += 1
        }
        return e.hasFocus
    }

    private func pulsarHasta(_ e: XCUIElement, _ tecla: XCUIRemote.Button, veces: Int = 6) {
        var n = 0
        while !e.hasFocus && n < veces {
            XCUIRemote.shared.press(tecla)
            n += 1
            Thread.sleep(forTimeInterval: 0.6)
        }
    }

    @MainActor
    func testSesionMenuConfirmaYNoSacaDeLaApp() {
        continueAfterFailure = false
        let app = abrir(["-variante", "real"])
        let empezar = app.buttons["empezarSesion"]
        XCTAssertTrue(empezar.waitForExistence(timeout: 15))
        pulsarHasta(empezar, .down)
        XCTAssertTrue(empezar.hasFocus, "Empezar tiene que recibir el foco")
        XCUIRemote.shared.press(.select)

        let accion = app.buttons["accionSesion"]
        XCTAssertTrue(accion.waitForExistence(timeout: 10))
        XCTAssertTrue(esperarFoco(accion), "la sesión arranca con el foco en la acción")
        XCTAssertFalse(app.tabBars.firstMatch.exists && app.tabBars.buttons["Arena"].isHittable, "las pestañas no están a mano")
        captura("sesion-serie")

        // Serie terminada: arranca el descanso y el foco sigue en la acción.
        XCUIRemote.shared.press(.select)
        XCTAssertTrue(app.staticTexts["Descanso"].waitForExistence(timeout: 5) || accion.label == "Saltar descanso")
        XCTAssertTrue(accion.hasFocus)
        captura("sesion-descanso")

        // Play/Pausa congela el descanso y otra vez lo suelta, sin mover el foco.
        XCUIRemote.shared.press(.playPause)
        XCTAssertTrue(app.buttons["SEGUIR"].waitForExistence(timeout: 3), "Play/Pausa congela")
        XCUIRemote.shared.press(.playPause)
        XCTAssertTrue(app.buttons["PAUSA"].waitForExistence(timeout: 3))
        XCTAssertTrue(accion.hasFocus)

        // Hacia arriba no hay escapatoria a la barra de pestañas.
        XCUIRemote.shared.press(.up)
        Thread.sleep(forTimeInterval: 0.6)
        XCTAssertTrue(accion.hasFocus || app.buttons["PAUSA"].hasFocus)

        // Menú: confirma, no sale.
        XCUIRemote.shared.press(.menu)
        let seguir = app.alerts.buttons["Seguir entrenando"].firstMatch
        XCTAssertTrue(seguir.waitForExistence(timeout: 5), "Menú tiene que pedir confirmación")
        captura("sesion-salir")
        XCTAssertEqual(app.state, .runningForeground)

        // Menú otra vez: se queda en la sesión, con el mando.
        XCUIRemote.shared.press(.menu)
        Thread.sleep(forTimeInterval: 1)
        XCTAssertTrue(accion.waitForExistence(timeout: 5))
        XCTAssertTrue(esperarFoco(accion), "al cancelar vuelve el foco")
        XCTAssertEqual(app.state, .runningForeground)

        // Menú y Salir: vuelve a la pestaña, dentro de la app.
        XCUIRemote.shared.press(.menu)
        let salir = app.alerts.buttons["Salir"].firstMatch
        XCTAssertTrue(salir.waitForExistence(timeout: 5))
        pulsarHasta(salir, .down)
        if !salir.hasFocus { pulsarHasta(salir, .right) }
        XCTAssertTrue(salir.hasFocus)
        XCUIRemote.shared.press(.select)
        XCTAssertTrue(empezar.waitForExistence(timeout: 10), "vuelve a la pestaña")
        XCTAssertEqual(app.state, .runningForeground)
        XCTAssertTrue(esperarFoco(empezar), "el foco vuelve a Empezar")
    }

    @MainActor
    func testAlAcabarDiceQueSeRegistraEnElIPhone() {
        continueAfterFailure = false
        let app = abrir(["-variante", "real", "-estado", "fin"])
        let texto = app.staticTexts["sesionTerminadaTexto"]
        XCTAssertTrue(texto.waitForExistence(timeout: 15))
        captura("sesion-fin")
        let accion = app.buttons["accionSesion"]
        XCTAssertTrue(esperarFoco(accion))
        // Terminada, Menú cierra sin preguntar y sin salir de la app.
        XCUIRemote.shared.press(.menu)
        XCTAssertTrue(app.buttons["empezarSesion"].waitForExistence(timeout: 10))
        XCTAssertEqual(app.state, .runningForeground)
    }

    @MainActor
    func testTuFilaEsLaPrimeraAlBajarDesdeLasPestanas() {
        continueAfterFailure = false
        let app = abrir(["-variante", "larga", "-pestana", "arena"])
        let propia = app.otherElements["filaPropia"].firstMatch
        XCTAssertTrue(propia.waitForExistence(timeout: 20))
        captura("arena-larga")
        pulsarHasta(propia, .down, veces: 2)
        XCTAssertTrue(propia.hasFocus, "al entrar en la tabla, el foco cae en tu fila")
        captura("arena-larga-foco")
        // La fila es solo foco: el clic no hace nada ni saca de ella.
        XCUIRemote.shared.press(.select)
        Thread.sleep(forTimeInterval: 0.5)
        XCTAssertTrue(propia.hasFocus)
    }

    /// Necesita el servidor local: enlaza, baja por la tabla, fuerza un refresco
    /// y comprueba que la fila enfocada sigue siendo la misma.
    @MainActor
    func testRefrescarNoPierdeFoco() async throws {
        continueAfterFailure = false
        let servidor = ProcessInfo.processInfo.environment["NIVL_SERVIDOR"] ?? "http://127.0.0.1:54399"
        func control(_ ruta: String, _ cuerpo: [String: String] = [:]) async throws -> [String: Any] {
            var r = URLRequest(url: URL(string: servidor + "/_pruebas/" + ruta)!)
            r.httpMethod = "POST"
            r.setValue("application/json", forHTTPHeaderField: "Content-Type")
            r.httpBody = try JSONSerialization.data(withJSONObject: cuerpo)
            let (data, _) = try await URLSession.shared.data(for: r)
            return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
        }
        let app = XCUIApplication()
        app.launchArguments = ["-nivlServidor", servidor, "-nivlClave", "clave-publica-local", "-pestana", "arena"]
        app.launch()

        let propia = app.otherElements["filaPropia"].firstMatch
        if !propia.waitForExistence(timeout: 8) {
            // Sin sesión de una vuelta anterior: se enlaza.
            if app.buttons["Enlazar de nuevo"].exists { XCUIRemote.shared.press(.select) }
            XCTAssertTrue(app.staticTexts["codigoEnlace"].waitForExistence(timeout: 30))
            let aprobado = try await control("aprobar", ["cuenta": "llena"])
            XCTAssertEqual(aprobado["ok"] as? Bool, true, "\(aprobado)")
            XCTAssertTrue(propia.waitForExistence(timeout: 40))
        }
        captura("real-arena")
        pulsarHasta(propia, .down, veces: 3)
        XCTAssertTrue(propia.hasFocus, "tu fila recibe el foco")
        XCUIRemote.shared.press(.down)
        Thread.sleep(forTimeInterval: 0.8)
        let enfocada = app.otherElements.matching(NSPredicate(format: "identifier == 'filaArena' AND hasFocus == true")).firstMatch
        XCTAssertTrue(enfocada.exists, "el foco se mueve por la tabla")
        let etiqueta = enfocada.label

        // El tope es un refresco por minuto; al volver a primer plano refresca.
        Thread.sleep(forTimeInterval: 65)
        XCUIRemote.shared.press(.home)
        Thread.sleep(forTimeInterval: 2)
        app.activate()
        Thread.sleep(forTimeInterval: 6)
        let despues = app.otherElements.matching(NSPredicate(format: "identifier == 'filaArena' AND hasFocus == true")).firstMatch
        XCTAssertTrue(despues.exists, "el foco sigue en la tabla tras refrescar")
        XCTAssertEqual(despues.label, etiqueta, "y en la misma fila")
    }

    @MainActor
    func testSemanaNoTieneNadaEnfocableSinEfecto() {
        let app = abrir(["-pestana", "semana"])
        XCTAssertTrue(app.staticTexts["Misiones por día"].waitForExistence(timeout: 15) || app.state == .runningForeground)
        XCTAssertEqual(app.descendants(matching: .any).matching(NSPredicate(format: "hasFocus == true AND elementType != %d AND elementType != %d",
                                                                             XCUIElement.ElementType.tabBar.rawValue,
                                                                             XCUIElement.ElementType.button.rawValue)).count, 0)
    }
}
