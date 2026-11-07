// NIVL TV · Tests de la lógica pura (máquina de la sesión, tablas, formato, demo).

import XCTest
@testable import NIVLTV

final class MaquinaSesionTests: XCTestCase {
    private let t0 = Date(timeIntervalSinceReferenceDate: 1_000_000)

    private func rutina(_ series: [Int], descanso: Int = 60) -> RutinaTV {
        RutinaTV(nombre: "PRUEBA", dia: "Hoy", ejercicios: series.enumerated().map { i, n in
            EjercicioTV(id: "e\(i)", nombre: "E\(i)", series: n, reps: "8", cargaKg: 50, descansoSeg: descanso,
                        figura: "figure.walk", musculos: [], tecnica: [])
        })
    }

    func testEmpiezaEnInicioYElClicArrancaLaSerie() {
        var m = MaquinaSesion(rutina: rutina([2]))
        XCTAssertEqual(m.fase, .inicio)
        m.pulsar(ahora: t0)
        XCTAssertEqual(m.fase, .serie(desde: t0))
        XCTAssertEqual(m.transcurrido(ahora: t0.addingTimeInterval(12)), 12)
    }

    func testSerieHechaAbreElDescansoPrescrito() {
        var m = MaquinaSesion(rutina: rutina([3], descanso: 90))
        m.pulsar(ahora: t0)
        m.pulsar(ahora: t0.addingTimeInterval(40))
        XCTAssertEqual(m.hechas, 1)
        XCTAssertEqual(m.serie, 2)
        XCTAssertEqual(m.restante(ahora: t0.addingTimeInterval(70)), 60)
        XCTAssertEqual(m.fraccionDescanso(ahora: t0.addingTimeInterval(85)), 0.5, accuracy: 1e-9)
    }

    func testAlAcabarElDescansoSuenaUnaVezYEmpiezaLaSiguienteSerie() {
        var m = MaquinaSesion(rutina: rutina([2], descanso: 30))
        m.pulsar(ahora: t0)
        m.pulsar(ahora: t0)
        XCTAssertFalse(m.tic(ahora: t0.addingTimeInterval(29)))
        XCTAssertTrue(m.tic(ahora: t0.addingTimeInterval(31)))
        XCTAssertEqual(m.fase, .serie(desde: t0.addingTimeInterval(30)))
        XCTAssertFalse(m.tic(ahora: t0.addingTimeInterval(32)))
    }

    func testClicEnElDescansoLoSalta() {
        var m = MaquinaSesion(rutina: rutina([2]))
        m.pulsar(ahora: t0)
        m.pulsar(ahora: t0)
        m.pulsar(ahora: t0.addingTimeInterval(5))
        XCTAssertEqual(m.fase, .serie(desde: t0.addingTimeInterval(5)))
        XCTAssertEqual(m.hechas, 1)
    }

    func testPausaCongelaElDescanso() {
        var m = MaquinaSesion(rutina: rutina([2], descanso: 60))
        m.pulsar(ahora: t0)
        m.pulsar(ahora: t0)
        m.alternarPausa(ahora: t0.addingTimeInterval(20))
        XCTAssertEqual(m.restante(ahora: t0.addingTimeInterval(500)), 40)
        XCTAssertFalse(m.tic(ahora: t0.addingTimeInterval(500)))
        m.alternarPausa(ahora: t0.addingTimeInterval(500))
        XCTAssertEqual(m.restante(ahora: t0.addingTimeInterval(510)), 30)
    }

    func testLaPausaNoActuaDuranteLaSerie() {
        var m = MaquinaSesion(rutina: rutina([2]))
        m.pulsar(ahora: t0)
        m.alternarPausa(ahora: t0)
        XCTAssertEqual(m.fase, .serie(desde: t0))
    }

    func testPasaAlSiguienteEjercicioYTerminaEnLaUltimaSerie() {
        var m = MaquinaSesion(rutina: rutina([1, 2]))
        m.pulsar(ahora: t0) // empieza
        m.pulsar(ahora: t0) // E0 serie 1 hecha
        XCTAssertEqual(m.indice, 1)
        XCTAssertEqual(m.serie, 1)
        m.pulsar(ahora: t0) // salta descanso
        m.pulsar(ahora: t0) // E1 serie 1
        m.pulsar(ahora: t0)
        m.pulsar(ahora: t0) // E1 serie 2: última
        XCTAssertEqual(m.fase, .terminada)
        XCTAssertEqual(m.hechas, 3)
        XCTAssertEqual(m.progreso, 1)
        m.pulsar(ahora: t0)
        XCTAssertEqual(m.hechas, 3, "terminada no cuenta más series")
    }

    func testSinDescansoEncadenaLasSeries() {
        var m = MaquinaSesion(rutina: rutina([2], descanso: 0))
        m.pulsar(ahora: t0)
        m.pulsar(ahora: t0.addingTimeInterval(10))
        XCTAssertEqual(m.fase, .serie(desde: t0.addingTimeInterval(10)))
    }

    func testRutinaVaciaNaceTerminada() {
        XCTAssertEqual(MaquinaSesion(rutina: rutina([])).fase, .terminada)
    }
}

final class JuegoTests: XCTestCase {
    // Mismos valores que src/lib/game.ts (xpCostForLevel = round(100·n^1,5)).
    func testCurvaDeNivelComoLaApp() {
        XCTAssertEqual(Juego.costeNivel(1), 100)
        XCTAssertEqual(Juego.costeNivel(2), 283)
        XCTAssertEqual(Juego.costeNivel(10), 3162)
        XCTAssertEqual(Juego.nivel(xp: 0), .init(nivel: 1, dentro: 0, siguiente: 100))
        XCTAssertEqual(Juego.nivel(xp: 99).nivel, 1)
        XCTAssertEqual(Juego.nivel(xp: 100), .init(nivel: 2, dentro: 0, siguiente: 283))
        XCTAssertEqual(Juego.nivel(xp: -50).nivel, 1)
        XCTAssertEqual(Juego.nivel(xp: 38_450).nivel, 16)
    }

    func testFraccionNuncaDesborda() {
        XCTAssertEqual(Juego.Nivel(nivel: 999, dentro: 0, siguiente: 0).fraccion, 1)
        XCTAssertEqual(Juego.nivel(xp: 150).fraccion, 50.0 / 283.0, accuracy: 1e-9)
    }
}

final class FormatoTests: XCTestCase {
    func testMiles() {
        XCTAssertEqual(Formato.miles(0), "0")
        XCTAssertEqual(Formato.miles(999), "999")
        XCTAssertEqual(Formato.miles(1_840), "1.840")
        XCTAssertEqual(Formato.miles(1_234_567), "1.234.567")
        XCTAssertEqual(Formato.miles(-2_500), "-2.500")
    }

    func testReloj() {
        XCTAssertEqual(Formato.reloj(0), "0:00")
        XCTAssertEqual(Formato.reloj(59.2), "1:00")
        XCTAssertEqual(Formato.reloj(150), "2:30")
        XCTAssertEqual(Formato.reloj(-3), "0:00")
    }

    func testKgYTendencia() {
        XCTAssertEqual(Formato.kg(80), "80")
        XCTAssertEqual(Formato.kg(42.5), "42,5")
        XCTAssertEqual(Formato.tendencia(-0.43), "\u{2212}0,43")
        XCTAssertEqual(Formato.tendencia(0.2), "+0,20")
        XCTAssertEqual(Formato.tendencia(0), "0,00")
    }
}

final class DemoTests: XCTestCase {
    func testNingunTextoLlevaGuionLargo() {
        for texto in Demo.textos + Pestana.allCases.map(\.titulo) {
            XCTAssertTrue(Formato.sinGuiones(texto), "guion largo en «\(texto)»")
        }
    }

    func testLaDemoEsCoherente() {
        XCTAssertFalse(Demo.rutina.ejercicios.isEmpty)
        XCTAssertEqual(Demo.arena.filter(\.soyYo).count, 1)
        XCTAssertTrue(Demo.arena.allSatisfy { ["E", "D", "C", "B", "A", "S"].contains($0.rango) })
        XCTAssertEqual(Demo.arena.map(\.xpVentana), Demo.arena.map(\.xpVentana).sorted(by: >), "friends_board llega ordenado")
        XCTAssertEqual(Demo.semana.mapa.count, 12)
        XCTAssertTrue(Demo.semana.mapa.allSatisfy { $0.count == 7 && $0.allSatisfy { (0...1).contains($0) } })
        XCTAssertEqual(Demo.semana.dias.count, 7)
    }
}
