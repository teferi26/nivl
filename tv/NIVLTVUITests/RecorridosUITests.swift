// NIVL TV · Recorridos A a J con el mando (scheme NIVLTVPuntaAPunta).
//
// Necesita el servidor local (tv/herramientas/README.md) escuchando en 54399 y
// su control en 54400. Cada recorrido hace lo que haría una persona con el
// mando: nada de tocar la vista por dentro. `-nivlLimpiar 1` borra la sesión
// de la vuelta anterior; con el control se simula el iPhone y se apaga la red.
//
// Área segura: el recorrido principal comprueba los marcos. NIVL_CAPTURAS
// (TEST_RUNNER_NIVL_CAPTURAS en xcodebuild) guarda las capturas en esa carpeta.

import XCTest

final class RecorridosUITests: XCTestCase {
    private let base = ProcessInfo.processInfo.environment["NIVL_SERVIDOR"] ?? "http://127.0.0.1:54399"
    private let baseControl = ProcessInfo.processInfo.environment["NIVL_CONTROL"] ?? "http://127.0.0.1:54400"
    private let clave = "clave-publica-local"
    private var capturas: String? { ProcessInfo.processInfo.environment["NIVL_CAPTURAS"] }
    private let mando = XCUIRemote.shared

    override func setUp() {
        continueAfterFailure = false
        ctl("encender")
        ctl("fallo", ["http": "no"])
        ctl("codigos-cortos", ["segundos": "no"])
        ctl("revocar")
    }

    // MARK: Ayudas

    @discardableResult
    private func ctl(_ ruta: String, _ cuerpo: [String: String] = [:]) -> [String: Any] {
        var r = URLRequest(url: URL(string: baseControl + "/_pruebas/" + ruta)!)
        r.httpMethod = "POST"
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        r.httpBody = try? JSONSerialization.data(withJSONObject: cuerpo)
        let hecho = DispatchSemaphore(value: 0)
        var salida: [String: Any] = [:]
        URLSession.shared.dataTask(with: r) { data, _, _ in
            if let data, let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any] { salida = o }
            hecho.signal()
        }.resume()
        hecho.wait()
        return salida
    }

    private func captura(_ nombre: String) {
        let imagen = XCUIScreen.main.screenshot()
        let adjunto = XCTAttachment(screenshot: imagen)
        adjunto.name = nombre
        adjunto.lifetime = .keepAlways
        add(adjunto)
        guard let capturas else { return }
        try? imagen.pngRepresentation.write(to: URL(fileURLWithPath: capturas).appendingPathComponent(nombre + ".png"))
    }

    private func app(pestana: String? = nil, limpiar: Bool = true, extra: [String] = []) -> XCUIApplication {
        let a = XCUIApplication()
        a.launchArguments = ["-nivlServidor", base, "-nivlClave", clave]
            + (pestana.map { ["-pestana", $0] } ?? [])
            + (limpiar ? ["-nivlLimpiar", "1"] : [])
            + extra
        return a
    }

    /// Enlaza desde cero y espera a tener la barra de pestañas.
    @discardableResult
    private func enlazado(cuenta: String = "llena", pestana: String? = nil) -> XCUIApplication {
        let a = app(pestana: pestana)
        a.launch()
        XCTAssertTrue(a.staticTexts["codigoEnlace"].waitForExistence(timeout: 30), "tiene que salir el código")
        let r = ctl("aprobar", ["cuenta": cuenta])
        XCTAssertEqual(r["ok"] as? Bool, true, "\(r)")
        XCTAssertTrue(pestanaBoton(a, "Entreno").waitForExistence(timeout: 40), "tiene que entrar solo")
        return a
    }

    private func pestanaBoton(_ a: XCUIApplication, _ nombre: String) -> XCUIElement {
        a.tabBars.buttons[nombre].firstMatch
    }

    private func enfocado(_ a: XCUIApplication) -> XCUIElement {
        a.descendants(matching: .any).matching(NSPredicate(format: "hasFocus == true")).firstMatch
    }

    private func describeFoco(_ a: XCUIApplication) -> String {
        let e = enfocado(a)
        return e.exists ? "tipo \(e.elementType.rawValue) id «\(e.identifier)» «\(e.label)»" : "NADIE"
    }

    private func esperarFoco(_ e: XCUIElement, segundos: Double = 6) -> Bool {
        let fin = Date().addingTimeInterval(segundos)
        while Date() < fin {
            if e.exists, e.hasFocus { return true }
            Thread.sleep(forTimeInterval: 0.2)
        }
        return e.exists && e.hasFocus
    }

    private func pulsarHasta(_ e: XCUIElement, _ tecla: XCUIRemote.Button, veces: Int = 8) {
        var n = 0
        while !(e.exists && e.hasFocus) && n < veces {
            mando.press(tecla)
            n += 1
            Thread.sleep(forTimeInterval: 0.6)
        }
    }

    private func pulsar(_ tecla: XCUIRemote.Button, pausa: Double = 0.8) {
        mando.press(tecla)
        Thread.sleep(forTimeInterval: pausa)
    }

    private func hayTexto(_ a: XCUIApplication, _ texto: String) -> XCUIElement {
        a.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] %@", texto)).firstMatch
    }

    /// Sale de la app: Menú hasta que deje de estar delante.
    private func saleConMenu(_ a: XCUIApplication, veces: Int = 3) -> Bool {
        for _ in 0..<veces {
            mando.press(.menu)
            if a.wait(for: .runningBackgroundSuspended, timeout: 3) || a.state == .runningBackground { return true }
        }
        return false
    }

    private func confirmarAlerta(_ a: XCUIApplication, _ titulo: String) {
        let b = a.alerts.buttons[titulo].firstMatch
        XCTAssertTrue(b.waitForExistence(timeout: 8), "alerta con «\(titulo)»")
        pulsarHasta(b, .down, veces: 3)
        if !b.hasFocus { pulsarHasta(b, .up, veces: 3) }
        if !b.hasFocus { pulsarHasta(b, .right, veces: 3) }
        if !b.hasFocus { pulsarHasta(b, .left, veces: 3) }
        XCTAssertTrue(b.hasFocus, "«\(titulo)» tiene que poder enfocarse")
        mando.press(.select)
    }

    /// Lleva el foco a la barra y a esa pestaña.
    private func irAPestana(_ a: XCUIApplication, _ nombre: String) {
        let b = pestanaBoton(a, nombre)
        XCTAssertTrue(b.waitForExistence(timeout: 10))
        if !enBarra(a) { subirABarra(a) }
        pulsarHasta(b, .right, veces: 4)
        if !b.hasFocus { pulsarHasta(b, .left, veces: 4) }
        XCTAssertTrue(b.hasFocus, "la pestaña \(nombre) con foco; está en \(describeFoco(a))")
    }

    private func enBarra(_ a: XCUIApplication) -> Bool {
        a.tabBars.buttons.matching(NSPredicate(format: "hasFocus == true")).firstMatch.exists
    }

    private func subirABarra(_ a: XCUIApplication) {
        var n = 0
        while !enBarra(a) && n < 5 {
            mando.press(.up)
            n += 1
            Thread.sleep(forTimeInterval: 0.7)
        }
        XCTAssertTrue(enBarra(a), "no llego a la barra; foco en \(describeFoco(a))")
    }

    /// Nada visible se sale del área segura de tvOS: 60 arriba y abajo, 80 a los lados.
    private func comprobarAreaSegura(_ a: XCUIApplication, _ pantalla: String) {
        let w = a.windows.firstMatch.frame
        let seguro = CGRect(x: w.minX + 80, y: w.minY + 60, width: w.width - 160, height: w.height - 120).insetBy(dx: -2, dy: -2)
        var malos: [String] = []
        for lista in [a.staticTexts.allElementsBoundByIndex, a.buttons.allElementsBoundByIndex] {
            for e in lista where e.exists && !e.frame.isEmpty && !e.identifier.hasPrefix("fila") {
                // Lo que queda detrás del recorte de una lista no se ve.
                if e.frame.minY >= w.maxY || e.frame.maxY <= w.minY { continue }
                if !seguro.contains(e.frame) { malos.append("«\(e.label)» \(e.frame)") }
            }
        }
        let f = enfocado(a)
        if f.exists, !seguro.contains(f.frame) { malos.append("foco «\(f.label)» \(f.frame)") }
        XCTAssertEqual(malos, [], "fuera del área segura en \(pantalla)")
    }

    // MARK: A. Sin enlazar

    @MainActor
    func testA_SinEnlazarYEntraSolo() {
        let a = app()
        a.launch()
        let codigo = a.staticTexts["codigoEnlace"]
        XCTAssertTrue(codigo.waitForExistence(timeout: 30))
        XCTAssertTrue(a.otherElements["qrEnlace"].exists || a.images["qrEnlace"].exists, "QR a la vista")
        XCTAssertFalse(a.buttons["pedirCodigo"].exists, "con código a la vista no hay nada que pulsar")
        captura("A1-codigo")

        // Menú en la raíz deja salir: lo pide Apple.
        XCTAssertTrue(saleConMenu(a), "Menú en la raíz tiene que sacar de la app")
        a.activate()
        XCTAssertTrue(codigo.waitForExistence(timeout: 30), "al volver sigue el código")

        let r = ctl("aprobar", ["cuenta": "llena"])
        XCTAssertEqual(r["ok"] as? Bool, true, "\(r)")
        let empezar = a.buttons["empezarSesion"]
        XCTAssertTrue(empezar.waitForExistence(timeout: 40), "entra solo")
        Thread.sleep(forTimeInterval: 1.5)
        XCTAssertTrue(enfocado(a).exists, "el foco no se pierde al entrar")
        captura("A2-entro")
        print("FOCO INICIAL A", describeFoco(a))

        // Con pestañas, Menú también acaba saliendo (primero sube a la barra).
        XCTAssertTrue(saleConMenu(a), "Menú en las pestañas tiene que acabar saliendo")
        a.activate()
        XCTAssertTrue(empezar.waitForExistence(timeout: 15), "al volver sigue dentro")
    }

    @MainActor
    func testA2_RechazadoPideOtroConFoco() {
        let a = app()
        a.launch()
        XCTAssertTrue(a.staticTexts["codigoEnlace"].waitForExistence(timeout: 30))
        ctl("rechazar")
        let pedir = a.buttons["pedirCodigo"]
        XCTAssertTrue(pedir.waitForExistence(timeout: 20))
        XCTAssertTrue(esperarFoco(pedir), "lo accionable tiene el foco")
        captura("A3-rechazado")
        mando.press(.select)
        XCTAssertTrue(a.staticTexts["codigoEnlace"].waitForExistence(timeout: 20))
    }

    // MARK: B. Código caducado

    @MainActor
    func testB_CodigoCaducadoSeRenuevaSinBloquear() {
        ctl("codigos-cortos", ["segundos": "8"])
        let a = app()
        a.launch()
        let codigo = a.staticTexts["codigoEnlace"]
        XCTAssertTrue(codigo.waitForExistence(timeout: 30))
        let primero = codigo.label
        captura("B1-codigo")

        // Caducidad en el reloj de la TV: se renueva solo.
        var fin = Date().addingTimeInterval(30)
        while Date() < fin, codigo.exists ? codigo.label == primero : true { Thread.sleep(forTimeInterval: 0.5) }
        XCTAssertTrue(codigo.exists, "sigue habiendo código")
        XCTAssertNotEqual(codigo.label, primero, "el código se renueva")
        captura("B2-renovado")
        XCTAssertFalse(a.buttons["pedirCodigo"].exists)

        // Caducidad decidida por el servidor antes de tiempo.
        ctl("codigos-cortos", ["segundos": "no"])
        fin = Date().addingTimeInterval(30)
        var segundo = codigo.label
        while Date() < fin, codigo.exists ? codigo.label == segundo : true { Thread.sleep(forTimeInterval: 0.5) }
        segundo = codigo.label
        ctl("caducar-codigo")
        fin = Date().addingTimeInterval(30)
        while Date() < fin, codigo.exists ? codigo.label == segundo : true { Thread.sleep(forTimeInterval: 0.5) }
        XCTAssertNotEqual(codigo.label, segundo, "el código caducado en servidor se renueva")

        let r = ctl("aprobar", ["cuenta": "llena"])
        XCTAssertEqual(r["ok"] as? Bool, true, "\(r)")
        XCTAssertTrue(a.buttons["empezarSesion"].waitForExistence(timeout: 40), "y el nuevo enlaza")
    }

    // MARK: C. Pestañas

    @MainActor
    func testC_PestanasIdaYVuelta() {
        let a = enlazado()
        let empezar = a.buttons["empezarSesion"]
        XCTAssertTrue(empezar.waitForExistence(timeout: 20))
        Thread.sleep(forTimeInterval: 1.5)
        XCTAssertTrue(enfocado(a).exists, "foco inicial")
        captura("C1-entreno")
        print("FOCO INICIAL C", describeFoco(a))

        // Entreno: a Empezar y de vuelta a la barra.
        pulsarHasta(empezar, .down, veces: 3)
        XCTAssertTrue(empezar.hasFocus, "Empezar recibe el foco; está en \(describeFoco(a))")
        subirABarra(a)

        // Arena: entra a tu fila, recorre y vuelve con Menú.
        irAPestana(a, "Arena")
        XCTAssertTrue(pestanaBoton(a, "Arena").isSelected || pestanaBoton(a, "Arena").hasFocus)
        let propia = a.otherElements["filaPropia"].firstMatch
        XCTAssertTrue(propia.waitForExistence(timeout: 10))
        pulsarHasta(propia, .down, veces: 3)
        XCTAssertTrue(propia.hasFocus, "al bajar, tu fila; está en \(describeFoco(a))")
        captura("C2-arena")
        pulsar(.down)
        XCTAssertTrue(enfocado(a).exists, "foco en la tabla")
        pulsar(.menu)
        XCTAssertTrue(enBarra(a), "Menú sube a la barra; foco en \(describeFoco(a))")
        XCTAssertEqual(a.state, .runningForeground)

        // Semana: nada enfocable. El foco se queda en la barra.
        irAPestana(a, "Semana")
        Thread.sleep(forTimeInterval: 1)
        pulsar(.down)
        XCTAssertTrue(enfocado(a).exists, "el foco no se pierde en Semana")
        XCTAssertTrue(enBarra(a), "Semana no tiene nada enfocable; foco en \(describeFoco(a))")
        captura("C3-semana")

        // Cuenta: los dos botones, arriba y abajo.
        irAPestana(a, "Cuenta")
        let sinc = a.buttons["sincronizar"]
        let cerrar = a.buttons["cerrarSesion"]
        XCTAssertTrue(sinc.waitForExistence(timeout: 10))
        pulsarHasta(sinc, .down, veces: 3)
        XCTAssertTrue(sinc.hasFocus, "Sincronizar; está en \(describeFoco(a))")
        pulsarHasta(cerrar, .down, veces: 2)
        XCTAssertTrue(cerrar.hasFocus)
        pulsarHasta(sinc, .up, veces: 2)
        XCTAssertTrue(sinc.hasFocus)
        captura("C4-cuenta")
        subirABarra(a)

        // Vuelta entera a la izquierda, y otra vez abajo.
        irAPestana(a, "Entreno")
        pulsarHasta(empezar, .down, veces: 3)
        XCTAssertTrue(empezar.hasFocus)
        XCTAssertEqual(a.state, .runningForeground)
    }

    // MARK: D. Rutina completa

    @MainActor
    func testD_RutinaCompleta() {
        let a = enlazado()
        let antes = ctl("estado")
        let empezar = a.buttons["empezarSesion"]
        XCTAssertTrue(empezar.waitForExistence(timeout: 20))
        pulsarHasta(empezar, .down, veces: 3)
        XCTAssertTrue(empezar.hasFocus)
        mando.press(.select)
        let accion = a.buttons["accionSesion"]
        XCTAssertTrue(accion.waitForExistence(timeout: 10))
        XCTAssertTrue(esperarFoco(accion), "la sesión arranca en la acción")
        captura("D1-serie")

        // La cuenta llena tiene 4+4+3+3 series.
        let total = 14
        for serie in 1...total {
            XCTAssertTrue(accion.label.uppercased().contains("TERMINAR"), "serie \(serie): \(accion.label)")
            mando.press(.select)
            Thread.sleep(forTimeInterval: 0.6)
            if serie == total { break }
            XCTAssertTrue(accion.label.uppercased().contains("SALTAR"), "descanso tras \(serie): \(accion.label)")
            XCTAssertTrue(accion.hasFocus, "foco en la acción durante el descanso \(serie)")
            if serie == 2 {
                captura("D2-descanso")
                let reloj = a.descendants(matching: .any)["relojSesion"].firstMatch
                XCTAssertTrue(reloj.exists)
                pulsar(.playPause)
                XCTAssertTrue(a.buttons["SEGUIR"].waitForExistence(timeout: 3), "Play/Pausa congela")
                let congelado = reloj.label
                Thread.sleep(forTimeInterval: 2.2)
                XCTAssertEqual(reloj.label, congelado, "en pausa el reloj no corre")
                captura("D3-pausa")
                pulsar(.playPause)
                XCTAssertTrue(a.buttons["PAUSA"].waitForExistence(timeout: 3))
                XCTAssertTrue(accion.hasFocus, "Play/Pausa no mueve el foco")
            }
            if serie == 5 {
                // Menú en mitad: confirma y Cancelar con Menú sigue donde estaba.
                pulsar(.menu)
                let seguir = a.alerts.buttons["Seguir entrenando"].firstMatch
                XCTAssertTrue(seguir.waitForExistence(timeout: 5), "Menú confirma")
                captura("D4-confirmar")
                XCTAssertEqual(a.state, .runningForeground)
                pulsar(.menu, pausa: 1.2)
                XCTAssertFalse(a.alerts.firstMatch.exists)
                XCTAssertTrue(esperarFoco(accion), "al cancelar vuelve a la acción")
            }
            mando.press(.select) // saltar
            Thread.sleep(forTimeInterval: 0.6)
            XCTAssertTrue(accion.hasFocus, "foco tras saltar \(serie)")
        }

        let fin = a.staticTexts["sesionTerminadaTexto"]
        XCTAssertTrue(fin.waitForExistence(timeout: 5) || a.descendants(matching: .any)["sesionTerminadaTexto"].exists, "sesión terminada")
        captura("D5-fin")
        XCTAssertTrue(esperarFoco(accion))
        mando.press(.select)
        XCTAssertTrue(empezar.waitForExistence(timeout: 10), "Volver regresa a la pestaña")
        XCTAssertTrue(esperarFoco(empezar), "foco en Empezar; está en \(describeFoco(a))")
        XCTAssertEqual(a.state, .runningForeground)

        let despues = ctl("estado")
        XCTAssertEqual(despues["economia_llena"] as? NSDictionary, antes["economia_llena"] as? NSDictionary, "la TV no mueve la economía")
        XCTAssertEqual(despues["completions_llena"] as? Int, antes["completions_llena"] as? Int, "la TV no registra nada")

        // Menú en mitad con salida: vuelve a la pestaña, dentro de la app.
        mando.press(.select)
        XCTAssertTrue(accion.waitForExistence(timeout: 10))
        XCTAssertTrue(esperarFoco(accion))
        pulsar(.menu)
        confirmarAlerta(a, "Salir")
        XCTAssertTrue(empezar.waitForExistence(timeout: 10))
        XCTAssertTrue(esperarFoco(empezar))
    }

    /// El descanso acaba solo con el foco en Pausa: el foco no se pierde.
    @MainActor
    func testD2_DescansoAcabaConFocoEnPausa() {
        let a = XCUIApplication()
        a.launchArguments = ["-nivlDemo", "1", "-variante", "real", "-estado", "descanso"]
        a.launch()
        let accion = a.buttons["accionSesion"]
        XCTAssertTrue(accion.waitForExistence(timeout: 15))
        XCTAssertTrue(esperarFoco(accion))
        let pausa = a.buttons["PAUSA"]
        XCTAssertTrue(pausa.waitForExistence(timeout: 5))
        pulsarHasta(pausa, .right, veces: 3)
        XCTAssertTrue(pausa.hasFocus)
        let fin = Date().addingTimeInterval(120)
        while Date() < fin, accion.label.uppercased().contains("SALTAR") { Thread.sleep(forTimeInterval: 1) }
        XCTAssertTrue(accion.label.uppercased().contains("TERMINAR"), "el descanso acaba solo: \(accion.label)")
        XCTAssertTrue(esperarFoco(accion), "foco en la acción; está en \(describeFoco(a))")
    }

    // MARK: E. Arena

    private func filaEnfocada(_ a: XCUIApplication) -> XCUIElement {
        a.otherElements.matching(NSPredicate(format: "hasFocus == true AND (identifier == 'filaArena' OR identifier == 'filaPropia')")).firstMatch
    }

    private func puesto(_ e: XCUIElement) -> Int? {
        guard e.exists, let r = e.label.range(of: #"Puesto (\d+)"#, options: .regularExpression) else { return nil }
        return Int(e.label[r].dropFirst("Puesto ".count))
    }

    /// Pulsa `veces` y luego corrige hasta llegar al puesto pedido.
    private func recorrer(_ a: XCUIApplication, _ tecla: XCUIRemote.Button, veces: Int, hasta objetivo: Int) {
        for i in 0..<veces {
            mando.press(tecla)
            Thread.sleep(forTimeInterval: 0.15)
            if i % 40 == 39 {
                XCTAssertNotNil(puesto(filaEnfocada(a)), "foco perdido en la tabla tras \(i + 1) pulsaciones: \(describeFoco(a))")
            }
        }
        Thread.sleep(forTimeInterval: 1)
        var extra = 0
        while puesto(filaEnfocada(a)) != objetivo && extra < 25 {
            mando.press(tecla)
            extra += 1
            Thread.sleep(forTimeInterval: 0.5)
        }
        XCTAssertEqual(puesto(filaEnfocada(a)), objetivo, "pulsaciones perdidas: \(extra)")
    }

    @MainActor
    func testE_ArenaLargaDeArribaAbajo() {
        let a = enlazado(cuenta: "larga", pestana: "arena")
        let propia = a.otherElements["filaPropia"].firstMatch
        XCTAssertTrue(propia.waitForExistence(timeout: 30))
        captura("E1-larga")
        pulsarHasta(propia, .down, veces: 3)
        XCTAssertTrue(propia.hasFocus, "el foco cae en tu fila; está en \(describeFoco(a))")
        let inicio = puesto(propia)!
        print("PUESTO PROPIO", inicio)
        captura("E2-propia")

        recorrer(a, .down, veces: 200 - inicio, hasta: 200)
        Thread.sleep(forTimeInterval: 1)
        let ultima = filaEnfocada(a)
        XCTAssertTrue(ultima.isHittable, "la última fila se ve")
        XCTAssertLessThanOrEqual(ultima.frame.maxY, a.windows.firstMatch.frame.maxY - 20, "y no queda cortada")
        captura("E3-ultima")
        pulsar(.down)
        XCTAssertEqual(puesto(filaEnfocada(a)), 200, "abajo del todo el foco no se escapa")

        recorrer(a, .up, veces: 199, hasta: 1)
        Thread.sleep(forTimeInterval: 1)
        captura("E4-primera")
        subirABarra(a)
        XCTAssertEqual(a.state, .runningForeground)
    }

    @MainActor
    func testE2_ArenaDeUnaSolaFila() {
        let a = enlazado(cuenta: "vacia", pestana: "arena")
        let propia = a.otherElements["filaPropia"].firstMatch
        XCTAssertTrue(propia.waitForExistence(timeout: 30))
        XCTAssertTrue(hayTexto(a, "Aún no tienes amigos").exists)
        pulsarHasta(propia, .down, veces: 3)
        XCTAssertTrue(propia.hasFocus)
        pulsar(.down)
        XCTAssertTrue(propia.hasFocus, "no hay a dónde bajar")
        captura("E5-una-fila")
        subirABarra(a)
    }

    @MainActor
    func testE3_ArenaSinFilas() {
        let a = XCUIApplication()
        a.launchArguments = ["-nivlDemo", "1", "-variante", "sinfilas", "-pestana", "arena"]
        a.launch()
        XCTAssertTrue(hayTexto(a, "Tu tabla está vacía").waitForExistence(timeout: 15))
        Thread.sleep(forTimeInterval: 1)
        XCTAssertTrue(enfocado(a).exists, "el foco no se pierde; \(describeFoco(a))")
        pulsar(.down)
        XCTAssertTrue(enBarra(a), "nada que enfocar debajo; foco en \(describeFoco(a))")
        captura("E6-sin-filas")
    }

    // MARK: F. Cuenta vacía

    @MainActor
    func testF_CuentaVacia() {
        let a = enlazado(cuenta: "vacia")
        XCTAssertTrue(hayTexto(a, "Sin rutina").waitForExistence(timeout: 30))
        XCTAssertFalse(a.buttons["empezarSesion"].exists)
        Thread.sleep(forTimeInterval: 1)
        XCTAssertTrue(enfocado(a).exists, "foco en Entreno vacío")
        XCTAssertTrue(enBarra(a), "foco en \(describeFoco(a))")
        pulsar(.down)
        XCTAssertTrue(enBarra(a), "nada enfocable en Entreno vacío")
        captura("F1-entreno")

        irAPestana(a, "Arena")
        XCTAssertTrue(a.otherElements["filaPropia"].firstMatch.waitForExistence(timeout: 10))
        XCTAssertFalse(hayTexto(a, "Tu ludus").exists, "sin ludus no hay ficha")
        captura("F2-arena")

        irAPestana(a, "Semana")
        XCTAssertTrue(hayTexto(a, "Aún no hay nada que leer").waitForExistence(timeout: 10))
        XCTAssertFalse(hayTexto(a, "Peso").exists, "sin peso no hay tarjeta")
        captura("F3-semana")

        irAPestana(a, "Cuenta")
        XCTAssertTrue(a.buttons["cerrarSesion"].waitForExistence(timeout: 10))
        captura("F4-cuenta")
    }

    // MARK: G. Sin red

    @MainActor
    func testG1_SinRedSinCache() {
        ctl("apagar-tras-canje")
        let a = app()
        a.launch()
        XCTAssertTrue(a.staticTexts["codigoEnlace"].waitForExistence(timeout: 30))
        ctl("aprobar", ["cuenta": "llena"])
        let reintentar = a.buttons["reintentarCarga"]
        XCTAssertTrue(reintentar.waitForExistence(timeout: 40), "sin caché y sin red, la pantalla con qué hacer")
        XCTAssertTrue(hayTexto(a, "Tu sesión sigue activa").exists)
        XCTAssertTrue(esperarFoco(reintentar), "foco en Reintentar; está en \(describeFoco(a))")
        captura("G1-sin-red-sin-cache")

        // Menú también deja salir desde aquí, y al volver sigue la misma pantalla.
        XCTAssertTrue(saleConMenu(a), "Menú en la raíz sale de la app")
        a.activate()
        XCTAssertTrue(reintentar.waitForExistence(timeout: 30))
        XCTAssertTrue(esperarFoco(reintentar, segundos: 10), "foco al volver; está en \(describeFoco(a))")

        // Reintentar sin red: vuelve aquí con el foco.
        mando.press(.select)
        Thread.sleep(forTimeInterval: 1.5)
        XCTAssertTrue(reintentar.waitForExistence(timeout: 30))
        XCTAssertTrue(esperarFoco(reintentar, segundos: 10), "el foco no se pierde al reintentar; está en \(describeFoco(a))")

        // Vuelve la red: Reintentar entra.
        ctl("encender")
        Thread.sleep(forTimeInterval: 6)
        XCTAssertTrue(esperarFoco(reintentar))
        mando.press(.select)
        XCTAssertTrue(a.buttons["empezarSesion"].waitForExistence(timeout: 30), "recupera al volver la red")
        captura("G2-recuperado")
    }

    @MainActor
    func testG2_SinRedSinCacheRecuperaSolo() {
        ctl("apagar-tras-canje")
        let a = app()
        a.launch()
        XCTAssertTrue(a.staticTexts["codigoEnlace"].waitForExistence(timeout: 30))
        ctl("aprobar", ["cuenta": "llena"])
        XCTAssertTrue(a.buttons["reintentarCarga"].waitForExistence(timeout: 40))
        ctl("encender")
        XCTAssertTrue(a.buttons["empezarSesion"].waitForExistence(timeout: 90), "al minuto reintenta solo")
    }

    @MainActor
    func testG3_SinRedConCache() {
        var a = enlazado()
        XCTAssertTrue(a.buttons["empezarSesion"].waitForExistence(timeout: 20))
        a.terminate()
        ctl("apagar")
        Thread.sleep(forTimeInterval: 1)

        // Abre con lo guardado y dice de cuándo es.
        a = app(pestana: "cuenta", limpiar: false)
        a.launch()
        let sinc = a.buttons["sincronizar"]
        XCTAssertTrue(sinc.waitForExistence(timeout: 30), "con caché abre sin red")
        let sello = a.staticTexts["selloFrescura"].firstMatch
        XCTAssertTrue(sello.waitForExistence(timeout: 30), "un sello dice que no es de ahora")
        XCTAssertTrue(sello.label.contains("Sin conexión"), sello.label)
        captura("G3-cache-sin-red")
        pulsarHasta(sinc, .down, veces: 3)
        XCTAssertTrue(sinc.hasFocus)
        mando.press(.select)
        Thread.sleep(forTimeInterval: 2)
        XCTAssertTrue(sinc.exists, "sigue en la pestaña")
        XCTAssertTrue(esperarFoco(sinc), "sin perder el foco; está en \(describeFoco(a))")
        XCTAssertFalse(hayTexto(a, "Ya está al día").exists, "sin red no se puede decir que está al día")

        ctl("encender")
        Thread.sleep(forTimeInterval: 6)
        mando.press(.select)
        let fin = Date().addingTimeInterval(20)
        while Date() < fin, sello.exists { Thread.sleep(forTimeInterval: 0.5) }
        XCTAssertFalse(sello.exists, "con red, el sello se va")
        XCTAssertTrue(esperarFoco(sinc), "y el foco sigue")
        captura("G4-recuperado")
    }

    /// Reabrir enseguida choca con el freno de 5 s del servidor: no es un fallo de red.
    @MainActor
    func testG4_ReabrirEnseguidaNoDiceSinServidor() {
        var a = enlazado(pestana: "cuenta")
        XCTAssertTrue(a.buttons["cerrarSesion"].waitForExistence(timeout: 20))
        a.terminate()
        a = app(pestana: "cuenta", limpiar: false)
        a.launch()
        XCTAssertTrue(a.buttons["cerrarSesion"].waitForExistence(timeout: 20))
        Thread.sleep(forTimeInterval: 2)
        XCTAssertFalse(hayTexto(a, "Sin servidor").exists, "el servidor está bien")
        let fin = Date().addingTimeInterval(12)
        let sello = a.staticTexts["selloFrescura"].firstMatch
        while Date() < fin, !sello.exists { Thread.sleep(forTimeInterval: 0.5) }
        XCTAssertFalse(sello.exists, "y tampoco un sello de fallo")
    }

    // MARK: H. Sesión revocada

    @MainActor
    func testH_SesionRevocadaEnMitadDeUso() {
        var a = enlazado(pestana: "cuenta")
        let sinc = a.buttons["sincronizar"]
        XCTAssertTrue(sinc.waitForExistence(timeout: 20))
        pulsarHasta(sinc, .down, veces: 3)
        XCTAssertTrue(sinc.hasFocus)
        ctl("revocar")
        Thread.sleep(forTimeInterval: 62) // el tope de un refresco por minuto
        mando.press(.select)

        let enlazar = a.buttons["enlazarDeNuevo"]
        XCTAssertTrue(enlazar.waitForExistence(timeout: 20), "tiene que decir que ha caducado")
        XCTAssertTrue(esperarFoco(enlazar), "foco en Enlazar de nuevo; está en \(describeFoco(a))")
        XCTAssertFalse(a.tabBars.firstMatch.exists, "nada de la cuenta a la vista")
        captura("H1-caducada")

        // Cerrar y abrir: lo local ya no está, no hay datos viejos ni token.
        a.terminate()
        a = app(limpiar: false)
        a.launch()
        XCTAssertTrue(a.staticTexts["codigoEnlace"].waitForExistence(timeout: 30), "sin token y sin caché, vuelve el código")
        XCTAssertFalse(a.tabBars.firstMatch.exists)
    }

    @MainActor
    func testH2_EnlazarDeNuevoTrasRevocar() {
        let a = enlazado(pestana: "cuenta")
        let sinc = a.buttons["sincronizar"]
        XCTAssertTrue(sinc.waitForExistence(timeout: 20))
        pulsarHasta(sinc, .down, veces: 3)
        ctl("revocar")
        Thread.sleep(forTimeInterval: 62)
        mando.press(.select)
        let enlazar = a.buttons["enlazarDeNuevo"]
        XCTAssertTrue(enlazar.waitForExistence(timeout: 20))
        XCTAssertTrue(esperarFoco(enlazar))
        mando.press(.select)
        XCTAssertTrue(a.staticTexts["codigoEnlace"].waitForExistence(timeout: 20), "vuelve a enlazar")
        ctl("aprobar", ["cuenta": "llena"])
        XCTAssertTrue(a.tabBars.firstMatch.waitForExistence(timeout: 40))
    }

    // MARK: I. Cerrar sesión

    @MainActor
    func testI_CerrarSesionCancelarYAceptar() {
        var a = enlazado(pestana: "cuenta")
        let cerrar = a.buttons["cerrarSesion"]
        XCTAssertTrue(cerrar.waitForExistence(timeout: 20))
        pulsarHasta(cerrar, .down, veces: 4)
        XCTAssertTrue(cerrar.hasFocus)
        mando.press(.select)
        let alerta = a.alerts.firstMatch
        XCTAssertTrue(alerta.waitForExistence(timeout: 8))
        captura("I1-confirmar")
        confirmarAlerta(a, "Cancelar")
        Thread.sleep(forTimeInterval: 1)
        XCTAssertFalse(alerta.exists, "cancelar no cierra nada")
        XCTAssertTrue(esperarFoco(cerrar), "el foco vuelve al botón; está en \(describeFoco(a))")
        XCTAssertEqual(ctl("estado")["dispositivos"] as? Int, 1)

        mando.press(.select)
        confirmarAlerta(a, "Cerrar sesión")
        XCTAssertTrue(a.staticTexts["codigoEnlace"].waitForExistence(timeout: 30), "vuelve el código")
        Thread.sleep(forTimeInterval: 1)
        XCTAssertEqual(ctl("estado")["dispositivos"] as? Int, 0, "también en el servidor")

        a.terminate()
        a = app(limpiar: false)
        a.launch()
        XCTAssertTrue(a.staticTexts["codigoEnlace"].waitForExistence(timeout: 30))
        XCTAssertFalse(a.tabBars.firstMatch.exists)
    }

    @MainActor
    func testI2_CerrarSesionSinRed() {
        var a = enlazado(pestana: "cuenta")
        let cerrar = a.buttons["cerrarSesion"]
        XCTAssertTrue(cerrar.waitForExistence(timeout: 20))
        pulsarHasta(cerrar, .down, veces: 4)
        XCTAssertTrue(cerrar.hasFocus)
        ctl("apagar")
        Thread.sleep(forTimeInterval: 1)
        mando.press(.select)
        confirmarAlerta(a, "Cerrar sesión")

        let pedir = a.buttons["pedirCodigo"]
        XCTAssertTrue(pedir.waitForExistence(timeout: 30), "sin red no se queda colgada")
        XCTAssertTrue(hayTexto(a, "Sin conexión").exists)
        XCTAssertTrue(esperarFoco(pedir, segundos: 8), "foco en Pedir código; está en \(describeFoco(a))")
        XCTAssertFalse(a.tabBars.firstMatch.exists, "nada de la cuenta a la vista")
        captura("I2-cerrada-sin-red")

        // Vuelta de la red: el código aparece.
        ctl("encender")
        XCTAssertTrue(a.staticTexts["codigoEnlace"].waitForExistence(timeout: 40), "vuelve el código solo")

        // Lo local estaba borrado aunque no hubiera red.
        a.terminate()
        a = app(limpiar: false)
        a.launch()
        XCTAssertTrue(a.staticTexts["codigoEnlace"].waitForExistence(timeout: 30))
        XCTAssertFalse(a.tabBars.firstMatch.exists)
    }

    // MARK: J. Demo

    @MainActor
    func testJ_SinElArgumentoNuncaHayDemo() {
        var a = enlazado(pestana: "cuenta")
        XCTAssertTrue(a.buttons["cerrarSesion"].waitForExistence(timeout: 20))
        XCTAssertFalse(hayTexto(a, "Modo demostración").exists)
        XCTAssertFalse(hayTexto(a, "Ana V.").exists)
        a.terminate()

        // `-nivlDemo` con otro valor no abre la demo.
        ctl("revocar")
        a = app(extra: ["-nivlDemo", "0"])
        a.launch()
        XCTAssertTrue(a.staticTexts["codigoEnlace"].waitForExistence(timeout: 30), "sin demo, el enlace")
        XCTAssertFalse(hayTexto(a, "Ana V.").exists)
    }

    // MARK: Recorrido principal con área segura y capturas

    @MainActor
    func testZ_AreaSeguraRecorridoPrincipal() {
        let a = app()
        a.launch()
        XCTAssertTrue(a.staticTexts["codigoEnlace"].waitForExistence(timeout: 30))
        comprobarAreaSegura(a, "enlace")
        captura("Z1-enlace")
        ctl("aprobar", ["cuenta": "llena"])
        let empezar = a.buttons["empezarSesion"]
        XCTAssertTrue(empezar.waitForExistence(timeout: 40))
        pulsarHasta(empezar, .down, veces: 3)
        Thread.sleep(forTimeInterval: 0.6)
        comprobarAreaSegura(a, "entreno")
        captura("Z2-entreno")

        subirABarra(a)
        irAPestana(a, "Arena")
        let propia = a.otherElements["filaPropia"].firstMatch
        XCTAssertTrue(propia.waitForExistence(timeout: 10))
        pulsarHasta(propia, .down, veces: 3)
        Thread.sleep(forTimeInterval: 0.6)
        comprobarAreaSegura(a, "arena")
        captura("Z3-arena")
        pulsar(.menu)

        irAPestana(a, "Semana")
        Thread.sleep(forTimeInterval: 1)
        comprobarAreaSegura(a, "semana")
        captura("Z4-semana")

        irAPestana(a, "Cuenta")
        let cerrar = a.buttons["cerrarSesion"]
        XCTAssertTrue(cerrar.waitForExistence(timeout: 10))
        pulsarHasta(cerrar, .down, veces: 4)
        Thread.sleep(forTimeInterval: 0.6)
        comprobarAreaSegura(a, "cuenta")
        captura("Z5-cuenta")
        mando.press(.select)
        XCTAssertTrue(a.alerts.firstMatch.waitForExistence(timeout: 8))
        captura("Z6-confirmar")
        confirmarAlerta(a, "Cancelar")
        Thread.sleep(forTimeInterval: 1)

        subirABarra(a)
        irAPestana(a, "Entreno")
        pulsarHasta(empezar, .down, veces: 3)
        mando.press(.select)
        let accion = a.buttons["accionSesion"]
        XCTAssertTrue(accion.waitForExistence(timeout: 10))
        XCTAssertTrue(esperarFoco(accion))
        Thread.sleep(forTimeInterval: 0.6)
        comprobarAreaSegura(a, "sesión, serie")
        captura("Z7-serie")
        mando.press(.select)
        Thread.sleep(forTimeInterval: 0.8)
        comprobarAreaSegura(a, "sesión, descanso")
        captura("Z8-descanso")
    }
}
