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

    func testAlVolverDeSegundoPlanoElRelojDiceLaVerdadYNoSuenaTarde() {
        var m = MaquinaSesion(rutina: rutina([2], descanso: 60))
        m.pulsar(ahora: t0)
        m.pulsar(ahora: t0)
        // El descanso acabó en t0+60 y la app vuelve media hora después.
        XCTAssertFalse(m.tic(ahora: t0.addingTimeInterval(1800)), "un aviso a destiempo no suena")
        XCTAssertEqual(m.fase, .serie(desde: t0.addingTimeInterval(60)))
        XCTAssertEqual(m.transcurrido(ahora: t0.addingTimeInterval(1800)), 1740)
    }

    func testAlVolverConElDescansoEnMarchaQuedaLoQueQueda() {
        var m = MaquinaSesion(rutina: rutina([2], descanso: 90))
        m.pulsar(ahora: t0)
        m.pulsar(ahora: t0)
        XCTAssertFalse(m.tic(ahora: t0.addingTimeInterval(70)))
        XCTAssertEqual(m.restante(ahora: t0.addingTimeInterval(70)), 20)
    }

    func testAvisoConRetrasoPequenoSiSuena() {
        var m = MaquinaSesion(rutina: rutina([2], descanso: 30))
        m.pulsar(ahora: t0)
        m.pulsar(ahora: t0)
        XCTAssertTrue(m.tic(ahora: t0.addingTimeInterval(30 + MaquinaSesion.margenAviso)))
    }

    func testPantallaDespiertaSoloMientrasDuraLaSesion() {
        var m = MaquinaSesion(rutina: rutina([1, 1], descanso: 0))
        XCTAssertFalse(m.pantallaDespierta(ahora: t0), "sin empezar se puede apagar")
        m.pulsar(ahora: t0)
        XCTAssertTrue(m.pantallaDespierta(ahora: t0.addingTimeInterval(60)))
        XCTAssertFalse(m.pantallaDespierta(ahora: t0.addingTimeInterval(MaquinaSesion.limiteSinMando)),
                       "sesión abandonada: la TV puede apagarse")
        m.pulsar(ahora: t0.addingTimeInterval(100))
        m.pulsar(ahora: t0.addingTimeInterval(200))
        XCTAssertEqual(m.fase, .terminada)
        XCTAssertFalse(m.pantallaDespierta(ahora: t0.addingTimeInterval(201)), "acabada se puede apagar")
    }

    func testMenuSoloPideConfirmacionConLaSesionEnMarcha() {
        var m = MaquinaSesion(rutina: rutina([1], descanso: 0))
        XCTAssertFalse(m.enMarcha)
        m.pulsar(ahora: t0)
        XCTAssertTrue(m.enMarcha)
        m.pulsar(ahora: t0)
        XCTAssertEqual(m.fase, .terminada)
        XCTAssertFalse(m.enMarcha)
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

    func testPrescripcionSinHuecosNiCerosInventados() {
        XCTAssertEqual(Formato.prescripcion(series: 4, reps: "8 a 10", cargaKg: 80.5), "4 × 8 a 10 · 80,5 kg")
        XCTAssertEqual(Formato.prescripcion(series: 3, reps: "AMRAP", cargaKg: nil), "3 × AMRAP")
        XCTAssertEqual(Formato.prescripcion(series: 3, reps: "", cargaKg: nil), "3 series")
        XCTAssertEqual(Formato.prescripcion(series: 1, reps: "", cargaKg: 20), "1 serie · 20 kg")
    }

    func testCuandoEsLaProxima() {
        XCTAssertEqual(Formato.cuando(enDias: 1, diaSemana: 4), "Mañana")
        XCTAssertEqual(Formato.cuando(enDias: 3, diaSemana: 6), "Sábado")
        XCTAssertEqual(Formato.cuando(enDias: 7, diaSemana: 3), "El miércoles que viene")
        XCTAssertEqual(Formato.cuando(enDias: 2, diaSemana: 9), "En 2 días")
    }

    func testKgYTendencia() {
        XCTAssertEqual(Formato.kg(80), "80")
        XCTAssertEqual(Formato.kg(42.5), "42,5")
        XCTAssertEqual(Formato.tendencia(-0.43), "\u{2212}0,43")
        XCTAssertEqual(Formato.tendencia(0.2), "+0,20")
        XCTAssertEqual(Formato.tendencia(0), "0,00")
    }
}

final class SalonTests: XCTestCase {
    private func ejercicio(_ id: String) -> EjercicioTV {
        EjercicioTV(id: id, nombre: id, series: 3, reps: "8", cargaKg: nil, descansoSeg: 90, figura: nil, musculos: [], tecnica: [])
    }

    private func fila(_ id: String, yo: Bool = false) -> FilaArena {
        FilaArena(id: id, soyYo: yo, nombre: id, titulo: "Tiro", rango: "E", xpTotal: 0, xpVentana: 0, racha: 0, cumplimientoPct: nil, elite: false)
    }

    func testEstadoDeLaPestanaEntreno() {
        let r = RutinaTV(nombre: "Torso", dia: "Lunes", ejercicios: [ejercicio("a")])
        let vacia = RutinaTV(nombre: "Pierna", dia: "Lunes", ejercicios: [])
        let p = ProximaSesion(nombre: "Pierna", diaSemana: 4, enDias: 1, ejercicios: 6)
        XCTAssertEqual(EstadoEntreno.decidir(rutina: r, saludActiva: true, proxima: nil), .rutina(r))
        XCTAssertEqual(EstadoEntreno.decidir(rutina: vacia, saludActiva: true, proxima: p), .rutinaVacia(nombre: "Pierna"))
        XCTAssertEqual(EstadoEntreno.decidir(rutina: nil, saludActiva: true, proxima: p), .descanso(p))
        XCTAssertEqual(EstadoEntreno.decidir(rutina: nil, saludActiva: true, proxima: nil), .descanso(nil))
        XCTAssertEqual(EstadoEntreno.decidir(rutina: nil, saludActiva: false, proxima: p), .sinSalud, "sin consentimiento no se enseña nada de salud")
    }

    func testSinFiguraNiTecnicaLaColumnaNoExiste() {
        XCTAssertFalse(RutinaTV(nombre: "T", dia: "L", ejercicios: [ejercicio("a")]).tieneTecnica)
        XCTAssertTrue(Demo.rutina.tieneTecnica)
    }

    func testVentanaDeLaLista() {
        XCTAssertEqual(ListaVisible.ventana(total: 0, actual: 0, capacidad: 6), 0..<0)
        XCTAssertEqual(ListaVisible.ventana(total: 4, actual: 3, capacidad: 6), 0..<4)
        XCTAssertEqual(ListaVisible.ventana(total: 10, actual: 0, capacidad: 6), 0..<6)
        XCTAssertEqual(ListaVisible.ventana(total: 10, actual: 5, capacidad: 6), 4..<10)
        XCTAssertEqual(ListaVisible.ventana(total: 10, actual: 9, capacidad: 6), 4..<10)
        for actual in 0..<30 {
            let v = ListaVisible.ventana(total: 30, actual: actual, capacidad: 6)
            XCTAssertTrue(v.contains(actual), "el actual siempre se ve")
            XCTAssertEqual(v.count, 6)
        }
    }

    func testTuPuesto() {
        XCTAssertNil(PuestoArena.propio([]))
        XCTAssertNil(PuestoArena.propio([fila("a")]))
        XCTAssertEqual(PuestoArena.propio([fila("a"), fila("b", yo: true), fila("c")]), PuestoArena(puesto: 2, total: 3))
        XCTAssertEqual(PuestoArena.propio(Demo.arenaLarga), PuestoArena(puesto: 137, total: 200))
    }

    private func semana(pesos: [PuntoPeso] = [], tendencia: Double? = nil, inicio: Double? = nil, fin: Double? = nil,
                        hechas: Int = 0, racha: Int = 0, mapa: [[Double]] = [[0, 0]]) -> SemanaTV {
        SemanaTV(racha: racha, piedras: 0, piedrasMax: 3, xpGanado: 0, hechas: hechas, falladas: 0, dias: [], mapa: mapa,
                 pesos: pesos, tendenciaKgSemana: tendencia, tendenciaInicio: inicio, tendenciaFin: fin, lectura: nil)
    }

    func testElPesoDesapareceSinDatoVerdadero() {
        let p = [PuntoPeso(id: 0, dia: 0, kg: 80)]
        XCTAssertNotNil(semana(pesos: p, tendencia: -0.2, inicio: 80, fin: 79).seccionPeso(saludActiva: true))
        XCTAssertNil(semana(pesos: p, tendencia: -0.2, inicio: 80, fin: 79).seccionPeso(saludActiva: false), "sin consentimiento")
        XCTAssertNil(semana(pesos: p).seccionPeso(saludActiva: true), "sin tendencia no hay recta falsa")
        XCTAssertNil(semana(tendencia: -0.2, inicio: 80, fin: 79).seccionPeso(saludActiva: true), "sin pesajes en la ventana")
    }

    func testCuentaSinHistorial() {
        XCTAssertTrue(semana().sinHistorial)
        XCTAssertTrue(Demo.semanaVacia.sinHistorial)
        XCTAssertFalse(semana(hechas: 1).sinHistorial)
        XCTAssertFalse(semana(racha: 2).sinHistorial)
        XCTAssertFalse(semana(mapa: [[0, 0.5]]).sinHistorial)
        XCTAssertFalse(semana(pesos: [PuntoPeso(id: 0, dia: 0, kg: 80)]).sinHistorial)
        XCTAssertFalse(Demo.semanaSinPeso.sinHistorial)
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
