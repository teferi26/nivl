// NIVL TV · Tests del enlace y la sesión: contrato, transiciones y formato.

import XCTest
@testable import NIVLTV

private let paqueteJSON = #"""
{"estado":"ok","generado_en":"2026-11-08T12:34:56.123456+00:00","hoy":"2026-11-08",
 "sesion_caduca_en":"2027-02-06T12:34:56+00:00","salud_activa":true,
 "perfil":{"nombre":"Livia","titulo":"Veterano","tipo":null,"rango":"C","xp_total":9000,"elite":true},
 "rutina":{"fuente":"rutina","nombre":"Torso","dia_semana":2,"hecha":false,"ejercicios":[
   {"id":"a","nombre":"Press banca","series":4,"reps":"8-10","carga_kg":80.5,"descanso_seg":90},
   {"id":"b","nombre":"Dominadas","series":3,"reps":"AMRAP","carga_kg":null,"descanso_seg":90}]},
 "arena":[{"id":"x","soy_yo":true,"nombre":"Livia","titulo":"Veterano","rango":"C","xp_total":9000,"xp_ventana":550,"racha":7,"cumplimiento_pct":null,"elite":true}],
 "ludus":{"nombre":"Capua","miembros":[{"id":"x","soy_yo":true,"nombre":"Livia","xp_ventana":550,"cumplimiento_pct":80}]},
 "semana":{"racha":8,"piedras":2,"piedras_max":3,"xp_ganado":550,"hechas":2,"falladas":0,
   "dias":[{"fecha":"2026-11-02","inicial":"L","hechas":1,"falladas":0}],
   "mapa":[[0,0.5,1,0,0,0,0]],"pesos":[{"dia":0,"kg":84.6},{"dia":27,"kg":82.9}],
   "tendencia_kg_semana":-0.43,"tendencia_inicio":84.62,"tendencia_fin":82.93,"lectura":"Bajas despacio."}}
"""#

private let paqueteVacioJSON = #"""
{"estado":"ok","generado_en":"2026-11-08T12:34:56+00:00","hoy":"2026-11-08","sesion_caduca_en":"2027-02-06T12:34:56.5+00:00",
 "salud_activa":false,"perfil":{"nombre":"Tito","titulo":"Tiro","tipo":"general","rango":"E","xp_total":0,"elite":false},
 "rutina":null,"arena":[],"ludus":null,
 "semana":{"racha":0,"piedras":0,"piedras_max":3,"xp_ganado":0,"hechas":0,"falladas":0,"dias":[],"mapa":[],"pesos":[],
   "tendencia_kg_semana":null,"tendencia_inicio":null,"tendencia_fin":null,"lectura":null}}
"""#

private func carga(_ json: String = paqueteJSON, en fecha: Date = Date(timeIntervalSince1970: 1000)) throws -> CargaTV {
    let data = Data(json.utf8)
    return CargaTV(paquete: try ContratoTV.paquete(data), crudo: data, sincronizado: fecha)
}

final class ContratoTests: XCTestCase {
    func testFechasConDecimalesYZonas() throws {
        let sin = try XCTUnwrap(FechaTV.desde("2026-11-08T12:00:00+00:00"))
        XCTAssertEqual(try XCTUnwrap(FechaTV.desde("2026-11-08T12:00:00.123456+00:00")).timeIntervalSince(sin), 0.123456, accuracy: 1e-5)
        XCTAssertEqual(try XCTUnwrap(FechaTV.desde("2026-11-08T12:00:00Z")), sin)
        XCTAssertEqual(try XCTUnwrap(FechaTV.desde("2026-11-08T13:00:00+01")), sin)
        XCTAssertEqual(try XCTUnwrap(FechaTV.desde("2026-11-08 12:00:00.5+00")).timeIntervalSince(sin), 0.5, accuracy: 1e-5)
        XCTAssertNil(FechaTV.desde("ayer"))
    }

    func testDiaLocalParaPHoy() {
        let f = Date(timeIntervalSince1970: 1_793_000_000 - 1_793_000_000.truncatingRemainder(dividingBy: 86400) + 23 * 3600)
        let utc = FechaTV.dia(f, zona: TimeZone(identifier: "UTC")!)
        let madrid = FechaTV.dia(f, zona: TimeZone(identifier: "Europe/Madrid")!)
        XCTAssertNotEqual(utc, madrid, "a las 23 UTC en Madrid ya es mañana")
        XCTAssertNotNil(utc.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression))
    }

    func testEmision() throws {
        let ok = Data(#"{"estado":"ok","codigo":"ABCD2345","secreto":"ff","caduca_en":"2026-11-08T12:10:00.1+00:00","sondeo_seg":5}"#.utf8)
        guard case .ok(let c) = try ContratoTV.emision(ok) else { return XCTFail() }
        XCTAssertEqual(c.codigo, "ABCD2345")
        XCTAssertEqual(c.sondeoSeg, 5)
        XCTAssertEqual(try ContratoTV.emision(Data(#"{"estado":"saturado","reintentar_seg":60}"#.utf8)), .saturado(reintentarSeg: 60))
        let raro = Data(#"{"estado":"ok","codigo":"abc","secreto":"ff","caduca_en":"2026-11-08T12:10:00+00:00"}"#.utf8)
        XCTAssertThrowsError(try ContratoTV.emision(raro)) { XCTAssertEqual($0 as? ErrorTV, .servidor(nil)) }
    }

    func testCanje() throws {
        XCTAssertEqual(try ContratoTV.canje(Data(#"{"estado":"pendiente","sondeo_seg":7}"#.utf8)), .pendiente(sondeoSeg: 7))
        XCTAssertEqual(try ContratoTV.canje(Data(#"{"estado":"pendiente","demasiado_rapido":true,"sondeo_seg":5}"#.utf8)), .pendiente(sondeoSeg: 5))
        XCTAssertEqual(try ContratoTV.canje(Data(#"{"estado":"aprobado","token":"cafe","caduca_en":"2027-02-06T12:34:56+00:00"}"#.utf8)), .aprobado(token: "cafe"))
        XCTAssertEqual(try ContratoTV.canje(Data(#"{"estado":"caducado"}"#.utf8)), .caducado)
        XCTAssertEqual(try ContratoTV.canje(Data(#"{"estado":"denegado"}"#.utf8)), .denegado)
        XCTAssertThrowsError(try ContratoTV.canje(Data(#"{"estado":"otro"}"#.utf8)))
    }

    func testPaqueteCompleto() throws {
        let p = try ContratoTV.paquete(Data(paqueteJSON.utf8))
        XCTAssertNil(p.perfil.tipo)
        XCTAssertEqual(p.rutina?.ejercicios[0].cargaKg, 80.5)
        XCTAssertNil(p.arena[0].cumplimientoPct)
        let v = p.vista
        XCTAssertEqual(v.rutina?.ejercicios[0].reps, "8 a 10")
        XCTAssertEqual(v.rutina?.ejercicios[1].reps, "AMRAP")
        XCTAssertEqual(v.rutina?.dia, "Martes · rutina semanal")
        XCTAssertEqual(v.rutina?.ejercicios[0].musculos, [], "el servidor no da técnica")
        XCTAssertEqual(v.semana.tendenciaKgSemana, -0.43)
        XCTAssertEqual(v.ludus?.nombre, "Capua")
    }

    func testPaqueteVacioConNulos() throws {
        let v = try ContratoTV.paquete(Data(paqueteVacioJSON.utf8)).vista
        XCTAssertNil(v.rutina)
        XCTAssertNil(v.ludus)
        XCTAssertNil(v.semana.tendenciaKgSemana)
        XCTAssertNil(v.semana.lectura)
        XCTAssertFalse(v.saludActiva)
    }

    func testLoQueLlegaDelServidorNoPintaGuiones() throws {
        let sucio = paqueteJSON
            .replacingOccurrences(of: "Press banca", with: "Press — banca")
            .replacingOccurrences(of: "\"8-10\"", with: "\"8–10\"")
            .replacingOccurrences(of: "Torso", with: "Torso — fuerza")
            .replacingOccurrences(of: "Livia", with: "Livia – Tessari")
            .replacingOccurrences(of: "Veterano", with: "Vete—rano")
            .replacingOccurrences(of: "Capua", with: "Capua — Sur")
            .replacingOccurrences(of: "Bajas despacio.", with: "Bajas — despacio.")
        let v = try ContratoTV.paquete(Data(sucio.utf8)).vista
        XCTAssertEqual(v.rutina?.ejercicios.first?.reps, "8 a 10")
        var textos = [v.perfil.nombre, v.perfil.titulo, v.rutina?.nombre, v.ludus?.nombre, v.semana.lectura].compactMap { $0 }
        textos += v.rutina?.ejercicios.flatMap { [$0.nombre, $0.reps] } ?? []
        textos += v.arena.flatMap { [$0.nombre, $0.titulo] }
        textos += v.ludus?.miembros.map(\.nombre) ?? []
        for t in textos { XCTAssertTrue(Formato.sinGuiones(t), t) }
    }

    func testDemasiadoRapidoNoEsPerderLaSesion() {
        XCTAssertThrowsError(try ContratoTV.paquete(Data(#"{"estado":"demasiado_rapido","reintentar_seg":5}"#.utf8))) {
            XCTAssertEqual($0 as? ErrorTV, .servidor(429))
        }
    }

    func testSesionInvalidaEsUnErrorPropio() {
        XCTAssertThrowsError(try ContratoTV.paquete(Data(#"{"estado":"sesion_invalida"}"#.utf8))) {
            XCTAssertEqual($0 as? ErrorTV, .sesionInvalida)
        }
        XCTAssertThrowsError(try ContratoTV.paquete(Data("no json".utf8))) { XCTAssertEqual($0 as? ErrorTV, .servidor(nil)) }
    }

    func testTraduccionDeErroresDeRed() {
        XCTAssertEqual(ClienteTV.traducir(URLError(.notConnectedToInternet)), .sinRed)
        XCTAssertEqual(ClienteTV.traducir(URLError(.timedOut)), .sinRed)
        XCTAssertEqual(ClienteTV.traducir(URLError(.badServerResponse)), .servidor(nil))
        XCTAssertEqual(ClienteTV.traducir(ErrorTV.servidor(503)), .servidor(503))
    }
}

final class RutinaRealTests: XCTestCase {
    private let json = #"""
    {"estado":"ok","generado_en":"2026-11-08T12:00:00+00:00","hoy":"2026-11-08","sesion_caduca_en":"2027-02-06T12:00:00+00:00",
     "salud_activa":true,"perfil":{"nombre":"L","titulo":"T","tipo":null,"rango":"C","xp_total":1,"elite":false},
     "rutina":{"fuente":"rutina","nombre":"Torso","dia_semana":9,"hecha":true,"ejercicios":[
       {"id":"a","nombre":"Plancha","series":0,"reps":"","carga_kg":0,"descanso_seg":-5},
       {"id":"b","nombre":"Press","series":4,"reps":"8-10","carga_kg":null,"descanso_seg":90}]},
     "arena":[],"ludus":null,"proxima":{"nombre":"Pierna","dia_semana":4,"en_dias":2,"ejercicios":6},
     "semana":{"racha":0,"piedras":0,"piedras_max":3,"xp_ganado":0,"hechas":0,"falladas":0,"dias":[],"mapa":[],"pesos":[],
       "tendencia_kg_semana":null,"tendencia_inicio":null,"tendencia_fin":null,"lectura":null}}
    """#

    func testNoSeInventaCargaNiFiguraYSeToleraLoRaro() throws {
        let v = try ContratoTV.paquete(Data(json.utf8)).vista
        let r = try XCTUnwrap(v.rutina)
        XCTAssertNil(r.ejercicios[0].cargaKg, "0 kg no es una carga")
        XCTAssertEqual(r.ejercicios[0].series, 1)
        XCTAssertEqual(r.ejercicios[0].descansoSeg, 0)
        XCTAssertEqual(r.ejercicios[1].reps, "8 a 10")
        XCTAssertNil(r.ejercicios[1].figura)
        XCTAssertFalse(r.tieneTecnica)
        XCTAssertTrue(r.hecha)
        XCTAssertTrue(r.dia.hasPrefix("Hoy"))
        XCTAssertEqual(v.proxima, ProximaSesion(nombre: "Pierna", diaSemana: 4, enDias: 2, ejercicios: 6))
    }

    func testUnServidorSinLa0128SeLeeSinProxima() throws {
        XCTAssertNil(try ContratoTV.paquete(Data(paqueteJSON.utf8)).vista.proxima)
    }
}

final class CodigoTests: XCTestCase {
    func testFormato() {
        XCTAssertEqual(CodigoTV.visible("ABCD2345"), "ABCD-2345")
        XCTAssertEqual(CodigoTV.enlaceQR("ABCD2345"), "nivl://tv/ABCD-2345")
        XCTAssertEqual(CodigoTV.deletreado("AB23"), "A B 2 3")
    }

    func testValidez() {
        XCTAssertTrue(CodigoTV.valido("ABCDEFGH"))
        XCTAssertTrue(CodigoTV.valido("ZZ223399"))
        XCTAssertFalse(CodigoTV.valido("ABCDEFG"), "corto")
        XCTAssertFalse(CodigoTV.valido("ABCDEFGI"), "la I no está en el alfabeto")
        XCTAssertFalse(CodigoTV.valido("ABCDEFG0"), "el 0 no está en el alfabeto")
        XCTAssertFalse(CodigoTV.valido("abcdefgh"))
    }

    func testQRBienOrientadoBlancoSobreNegro() throws {
        // Vision no decodifica en el simulador: aquí se comprueba la forma y la
        // lectura real se hace sobre la captura (tv/README.md).
        let enlace = "nivl://tv/ABCD-2345"
        let imagen = try XCTUnwrap(GeneradorQR.imagen(enlace))
        let m = try XCTUnwrap(GeneradorQR.matriz(enlace))
        let n = m.count
        XCTAssertTrue(m.allSatisfy { $0.count == n })
        XCTAssertEqual(imagen.width, n + 8, "cuatro módulos de silencio por lado")
        XCTAssertEqual(imagen.width, imagen.height)

        func buscador(_ x0: Int, _ y0: Int) -> Bool {
            for y in 0..<7 {
                for x in 0..<7 {
                    let borde = x == 0 || y == 0 || x == 6 || y == 6
                    let centro = (2...4).contains(x) && (2...4).contains(y)
                    if m[y0 + y][x0 + x] != (borde || centro) { return false }
                }
            }
            return true
        }
        XCTAssertTrue(buscador(0, 0))
        XCTAssertTrue(buscador(n - 7, 0))
        XCTAssertTrue(buscador(0, n - 7))
        XCTAssertFalse(buscador(n - 7, n - 7), "si estuviera aquí el QR saldría volteado")

        let datos = try XCTUnwrap(imagen.dataProvider?.data) as Data
        XCTAssertEqual(datos[0], 0, "la zona de silencio es negra")
        XCTAssertEqual(datos[(4 * imagen.width) + 4], 255, "el módulo es blanco")
    }
}

final class ConfigTests: XCTestCase {
    func testValidacion() {
        XCTAssertNotNil(ConfigServidor.validar(url: "https://x.supabase.co", clave: "k", permitirLocal: false))
        XCTAssertNil(ConfigServidor.validar(url: "", clave: "k", permitirLocal: false))
        XCTAssertNil(ConfigServidor.validar(url: "https://x.supabase.co", clave: " ", permitirLocal: false))
        XCTAssertNil(ConfigServidor.validar(url: "$(NIVL_SUPABASE_URL)", clave: "k", permitirLocal: false))
        XCTAssertNil(ConfigServidor.validar(url: "https:", clave: "k", permitirLocal: false), "la URL cortada por el comentario del xcconfig")
        XCTAssertNil(ConfigServidor.validar(url: "http://x.supabase.co", clave: "k", permitirLocal: true), "http solo a la propia máquina")
        XCTAssertNil(ConfigServidor.validar(url: "http://127.0.0.1:54399", clave: "k", permitirLocal: false))
        XCTAssertNotNil(ConfigServidor.validar(url: "http://127.0.0.1:54399", clave: "k", permitirLocal: true))
    }

    func testLaDemoPideExactamenteElArgumento() {
        XCTAssertFalse(Lanzamiento.leer(["app"]).demo)
        XCTAssertFalse(Lanzamiento.leer(["app", "-nivlDemo", "0"]).demo)
        XCTAssertFalse(Lanzamiento.leer(["app", "-nivlDemo"]).demo)
        XCTAssertFalse(Lanzamiento.leer(["app", "-pestana", "arena"]).demo)
        let l = Lanzamiento.leer(["app", "-nivlDemo", "1", "-pestana", "arena", "-estado", "fin"])
        XCTAssertTrue(l.demo)
        XCTAssertEqual(l.pestana, "arena")
        XCTAssertEqual(l.estado, "fin")
    }
}

final class TextosTests: XCTestCase {
    func testSinGuiones() {
        for t in Textos.todos + Pestana.allCases.map(\.titulo) {
            XCTAssertTrue(Formato.sinGuiones(t), "guion en «\(t)»")
            XCTAssertFalse(t.contains("!!"), t)
        }
    }

    func testFrescuraCabeJuntoALasPestanas() {
        XCTAssertNil(Textos.frescura(.alDia, hace: "hace 3 h"))
        XCTAssertEqual(Textos.frescura(.sinRed, hace: "hace 3 h"), "Sin conexión · hace 3 h")
        XCTAssertEqual(Textos.frescura(.errorServidor, hace: "hace 3 h"), "Sin servidor · hace 3 h")
        XCTAssertEqual(Textos.frescura(.sincronizando, hace: "hace 3 h"), "Actualizando · hace 3 h")
        for red in [EstadoRed.sincronizando, .sinRed, .errorServidor] {
            XCTAssertLessThanOrEqual(Textos.frescura(red, hace: "hace un momento")?.count ?? 99, 32)
        }
    }

    func testLimpiarGuiones() {
        XCTAssertEqual(Formato.limpiar("Torso"), "Torso")
        XCTAssertEqual(Formato.limpiar("Empuje — pecho"), "Empuje · pecho")
        XCTAssertEqual(Formato.limpiar("Serie–larga"), "Serie · larga")
        XCTAssertEqual(Formato.limpiar("8–12"), "8 a 12")
        XCTAssertEqual(Formato.limpiar("— Pierna —"), "Pierna")
    }

    func testFormatoAuxiliar() {
        XCTAssertEqual(Formato.reps("8"), "8")
        XCTAssertEqual(Formato.reps("8-10"), "8 a 10")
        XCTAssertEqual(Formato.reps("AMRAP"), "AMRAP")
        XCTAssertEqual(Formato.cumple(nil), "Sin medir")
        XCTAssertEqual(Formato.cumple(0), "0 %")
        let t = Date(timeIntervalSince1970: 100_000)
        XCTAssertEqual(Formato.hace(t, ahora: t.addingTimeInterval(30)), "hace un momento")
        XCTAssertEqual(Formato.hace(t, ahora: t.addingTimeInterval(300)), "hace 5 min")
        XCTAssertEqual(Formato.hace(t, ahora: t.addingTimeInterval(7200)), "hace 2 h")
        XCTAssertEqual(Formato.hace(t, ahora: t.addingTimeInterval(90000)), "hace 1 día")
        XCTAssertEqual(Formato.hace(t, ahora: t.addingTimeInterval(200000)), "hace 2 días")
    }
}

final class MaquinaAppTests: XCTestCase {
    private let t0 = Date(timeIntervalSince1970: 1_000_000)

    private func emitido(caduca: Double = 600) -> CodigoEmitido {
        CodigoEmitido(codigo: "ABCD2345", secreto: "s3", caducaEn: t0.addingTimeInterval(caduca), sondeoSeg: 5)
    }

    private func enlazando() -> EstadoApp {
        var s = EstadoApp()
        _ = MaquinaApp.reducir(&s, .arranque(config: true, hayToken: false, cache: nil), ahora: t0)
        _ = MaquinaApp.reducir(&s, .emision(.success(.ok(emitido()))), ahora: t0)
        return s
    }

    private func listo(_ edad: Double = 0) throws -> EstadoApp {
        var s = EstadoApp()
        _ = MaquinaApp.reducir(&s, .arranque(config: true, hayToken: true, cache: nil), ahora: t0)
        _ = MaquinaApp.reducir(&s, .datos(.success(try carga(en: t0.addingTimeInterval(-edad)))), ahora: t0)
        return s
    }

    func testSinConfiguracionNoHayServicio() {
        var s = EstadoApp()
        XCTAssertEqual(MaquinaApp.reducir(&s, .arranque(config: false, hayToken: true, cache: nil), ahora: t0), [])
        XCTAssertEqual(s.fase, .noDisponible)
    }

    func testSinTokenPideCodigo() {
        var s = EstadoApp()
        let e = MaquinaApp.reducir(&s, .arranque(config: true, hayToken: false, cache: nil), ahora: t0)
        XCTAssertEqual(s.fase, .sinEnlazar(.pidiendo))
        XCTAssertEqual(e, [.cancelarEspera, .emitirCodigo])
    }

    func testConTokenSinCacheCarga() {
        var s = EstadoApp()
        let e = MaquinaApp.reducir(&s, .arranque(config: true, hayToken: true, cache: nil), ahora: t0)
        XCTAssertEqual(s.fase, .cargando)
        XCTAssertEqual(e, [.cancelarEspera, .cargarDatos])
    }

    func testConCacheEnsenaLoAnteriorMarcado() throws {
        var s = EstadoApp()
        let c = try carga(en: t0.addingTimeInterval(-3600))
        _ = MaquinaApp.reducir(&s, .arranque(config: true, hayToken: true, cache: CacheTV(paquete: c.paquete, sincronizado: c.sincronizado)), ahora: t0)
        guard case .listo(let con) = s.fase else { return XCTFail() }
        XCTAssertEqual(con.red, .sincronizando)
        XCTAssertEqual(con.sincronizado, c.sincronizado)
    }

    func testSondeoRespetaIntervaloYNoSolapa() {
        var s = enlazando()
        guard case .enlazando = s.fase else { return XCTFail() }
        // Vence la espera: un canje.
        XCTAssertEqual(MaquinaApp.reducir(&s, .temporizador, ahora: t0.addingTimeInterval(5)), [.canjear(secreto: "s3")])
        // Con el canje en vuelo, otro vencimiento no lanza otro.
        XCTAssertEqual(MaquinaApp.reducir(&s, .temporizador, ahora: t0.addingTimeInterval(6)), [])
        // Solo tras la respuesta se programa el siguiente, con el sondeo que diga el servidor.
        XCTAssertEqual(MaquinaApp.reducir(&s, .canje(.success(.pendiente(sondeoSeg: 8))), ahora: t0.addingTimeInterval(7)), [.esperar(8)])
    }

    func testAlCaducarRenuevaSolo() {
        var s = enlazando()
        XCTAssertEqual(MaquinaApp.reducir(&s, .canje(.success(.pendiente(sondeoSeg: 5))), ahora: t0.addingTimeInterval(598)), [.esperar(2)], "despierta justo al caducar")
        XCTAssertEqual(MaquinaApp.reducir(&s, .temporizador, ahora: t0.addingTimeInterval(600)), [.cancelarEspera, .emitirCodigo])
        XCTAssertEqual(s.fase, .sinEnlazar(.pidiendo))
    }

    func testCaducadoPideOtroYDenegadoEspera() {
        var s = enlazando()
        _ = MaquinaApp.reducir(&s, .temporizador, ahora: t0)
        XCTAssertEqual(MaquinaApp.reducir(&s, .canje(.success(.caducado)), ahora: t0), [.cancelarEspera, .emitirCodigo])

        var d = enlazando()
        _ = MaquinaApp.reducir(&d, .temporizador, ahora: t0)
        XCTAssertEqual(MaquinaApp.reducir(&d, .canje(.success(.denegado)), ahora: t0), [.cancelarEspera])
        XCTAssertEqual(d.fase, .sinEnlazar(.denegado))
        XCTAssertEqual(MaquinaApp.reducir(&d, .temporizador, ahora: t0), [], "no pide otro por su cuenta")
        XCTAssertEqual(MaquinaApp.reducir(&d, .reintentar, ahora: t0), [.cancelarEspera, .emitirCodigo])
    }

    func testAprobadoGuardaAntesDeLeer() {
        var s = enlazando()
        XCTAssertEqual(MaquinaApp.reducir(&s, .canje(.success(.aprobado(token: "t"))), ahora: t0), [.cancelarEspera, .guardarToken("t")])
        XCTAssertEqual(s.fase, .cargando)
        XCTAssertEqual(MaquinaApp.reducir(&s, .tokenGuardado(true), ahora: t0), [.cancelarEspera, .cargarDatos])
    }

    func testAprobadoEnSegundoPlanoNoSePierde() {
        var s = enlazando()
        _ = MaquinaApp.reducir(&s, .segundoPlano, ahora: t0)
        XCTAssertEqual(MaquinaApp.reducir(&s, .canje(.success(.aprobado(token: "t"))), ahora: t0), [.cancelarEspera, .guardarToken("t")])
        XCTAssertEqual(MaquinaApp.reducir(&s, .tokenGuardado(true), ahora: t0), [])
        XCTAssertEqual(MaquinaApp.reducir(&s, .primerPlano, ahora: t0), [.cancelarEspera, .cargarDatos])
    }

    func testTokenNoGuardado() {
        var s = enlazando()
        _ = MaquinaApp.reducir(&s, .canje(.success(.aprobado(token: "t"))), ahora: t0)
        _ = MaquinaApp.reducir(&s, .tokenGuardado(false), ahora: t0)
        XCTAssertEqual(s.fase, .sinEnlazar(.almacen))
    }

    func testFalloDeRedEnElSondeoSigueEsperando() {
        var s = enlazando()
        _ = MaquinaApp.reducir(&s, .temporizador, ahora: t0)
        let e = MaquinaApp.reducir(&s, .canje(.failure(.sinRed)), ahora: t0)
        guard case .enlazando(let en) = s.fase else { return XCTFail() }
        XCTAssertTrue(en.sinConexion)
        XCTAssertEqual(e, [.esperar(5)])
    }

    func testSegundoPlanoParaYVolverReanuda() {
        var s = enlazando()
        XCTAssertEqual(MaquinaApp.reducir(&s, .segundoPlano, ahora: t0), [.cancelarEspera])
        XCTAssertEqual(MaquinaApp.reducir(&s, .temporizador, ahora: t0), [], "en segundo plano no se sondea")
        XCTAssertEqual(MaquinaApp.reducir(&s, .primerPlano, ahora: t0), [.esperar(5)])
        XCTAssertEqual(MaquinaApp.reducir(&s, .primerPlano, ahora: t0), [], "repetir no duplica")
    }

    func testVolverConElCodigoCaducadoRenueva() {
        var s = enlazando()
        _ = MaquinaApp.reducir(&s, .segundoPlano, ahora: t0)
        XCTAssertEqual(MaquinaApp.reducir(&s, .primerPlano, ahora: t0.addingTimeInterval(700)), [.cancelarEspera, .emitirCodigo])
    }

    func testFalloEnEmisionReintentaConEspera() {
        var s = EstadoApp()
        _ = MaquinaApp.reducir(&s, .arranque(config: true, hayToken: false, cache: nil), ahora: t0)
        XCTAssertEqual(MaquinaApp.reducir(&s, .emision(.failure(.sinRed)), ahora: t0), [.esperar(5)])
        XCTAssertEqual(s.fase, .sinEnlazar(.sinRed))
        _ = MaquinaApp.reducir(&s, .temporizador, ahora: t0)
        XCTAssertEqual(MaquinaApp.reducir(&s, .emision(.failure(.servidor(500))), ahora: t0), [.esperar(10)])
        XCTAssertEqual(s.fase, .sinEnlazar(.servidor))
    }

    func testSaturadoRespetaElTiempoDelServidor() {
        var s = EstadoApp()
        _ = MaquinaApp.reducir(&s, .arranque(config: true, hayToken: false, cache: nil), ahora: t0)
        XCTAssertEqual(MaquinaApp.reducir(&s, .emision(.success(.saturado(reintentarSeg: 60))), ahora: t0), [.esperar(60)])
        XCTAssertEqual(s.fase, .sinEnlazar(.saturado))
    }

    func testDatosCorrectos() throws {
        var s = EstadoApp()
        _ = MaquinaApp.reducir(&s, .arranque(config: true, hayToken: true, cache: nil), ahora: t0)
        let e = MaquinaApp.reducir(&s, .datos(.success(try carga(en: t0))), ahora: t0)
        guard case .listo(let c) = s.fase else { return XCTFail() }
        XCTAssertEqual(c.red, .alDia)
        XCTAssertEqual(c.datos.perfil.nombre, "Livia")
        XCTAssertEqual(e, [.esperar(Politica.refrescoSeg)])
    }

    func testSesionInvalidaBorraTodo() throws {
        var s = try listo()
        let e = MaquinaApp.reducir(&s, .datos(.failure(.sesionInvalida)), ahora: t0)
        XCTAssertEqual(s.fase, .sesionCaducada)
        XCTAssertEqual(e, [.cancelarEspera, .borrarSesionLocal])
        XCTAssertEqual(MaquinaApp.reducir(&s, .temporizador, ahora: t0), [], "no sigue pidiendo códigos solo")
        XCTAssertEqual(MaquinaApp.reducir(&s, .reintentar, ahora: t0), [.cancelarEspera, .emitirCodigo])
    }

    func testSinRedConCacheMantieneLosDatosYNoBorra() throws {
        var s = try listo()
        let e = MaquinaApp.reducir(&s, .datos(.failure(.sinRed)), ahora: t0)
        guard case .listo(let c) = s.fase else { return XCTFail() }
        XCTAssertEqual(c.red, .sinRed)
        XCTAssertFalse(e.contains(.borrarSesionLocal))
        XCTAssertFalse(e.contains(.cerrarSesion))
        XCTAssertEqual(e, [.esperar(60)])
    }

    func testErrorDeServidorNoBorraLaSesion() throws {
        var s = try listo()
        let e = MaquinaApp.reducir(&s, .datos(.failure(.servidor(503))), ahora: t0)
        guard case .listo(let c) = s.fase else { return XCTFail() }
        XCTAssertEqual(c.red, .errorServidor)
        XCTAssertFalse(e.contains(.borrarSesionLocal))
    }

    func testSinRedSinCacheYReintentar() {
        var s = EstadoApp()
        _ = MaquinaApp.reducir(&s, .arranque(config: true, hayToken: true, cache: nil), ahora: t0)
        XCTAssertEqual(MaquinaApp.reducir(&s, .datos(.failure(.sinRed)), ahora: t0), [.esperar(60)])
        XCTAssertEqual(s.fase, .sinRed)
        XCTAssertEqual(MaquinaApp.reducir(&s, .reintentar, ahora: t0), [.cancelarEspera, .cargarDatos])
        XCTAssertEqual(s.fase, .cargando)
    }

    func testErrorSinCache() {
        var s = EstadoApp()
        _ = MaquinaApp.reducir(&s, .arranque(config: true, hayToken: true, cache: nil), ahora: t0)
        _ = MaquinaApp.reducir(&s, .datos(.failure(.servidor(500))), ahora: t0)
        XCTAssertEqual(s.fase, .errorServidor)
    }

    func testSincronizarComoMuchoUnaVezPorMinuto() throws {
        var s = try listo(30)
        XCTAssertEqual(MaquinaApp.reducir(&s, .sincronizarAhora, ahora: t0), [])
        XCTAssertNotNil(s.aviso)
        var v = try listo(60)
        XCTAssertEqual(MaquinaApp.reducir(&v, .sincronizarAhora, ahora: t0), [.cancelarEspera, .cargarDatos])
        XCTAssertNil(v.aviso)
        XCTAssertEqual(MaquinaApp.reducir(&v, .sincronizarAhora, ahora: t0), [], "sin dos cargas a la vez")
    }

    func testSincronizarTrasUnFalloReintentaSinEsperarAlMinuto() throws {
        var s = try listo(10)
        guard case .listo(var c) = s.fase else { return XCTFail() }
        c.red = .sinRed
        s.fase = .listo(c)
        XCTAssertEqual(MaquinaApp.reducir(&s, .sincronizarAhora, ahora: t0), [.cancelarEspera, .cargarDatos])
        XCTAssertNil(s.aviso, "sin red no se puede decir que está al día")
    }

    func testDemasiadoRapidoReintentaProntoYSinRotuloDeFallo() throws {
        var s = try listo(10)
        guard case .listo(var c) = s.fase else { return XCTFail() }
        c.red = .sincronizando
        s.fase = .listo(c)
        s.cargaEnCurso = true
        XCTAssertEqual(MaquinaApp.reducir(&s, .datos(.failure(.servidor(429))), ahora: t0), [.esperar(Politica.reintentoFrenoSeg)])
        guard case .listo(let despues) = s.fase else { return XCTFail() }
        XCTAssertEqual(despues.red, .sincronizando)
        // Si insiste, ya es un fallo como los demás.
        s.cargaEnCurso = true
        _ = MaquinaApp.reducir(&s, .datos(.failure(.servidor(429))), ahora: t0)
        guard case .listo(let segundo) = s.fase else { return XCTFail() }
        XCTAssertEqual(segundo.red, .errorServidor)
    }

    func testDemasiadoRapidoEnLaPrimeraCargaVuelveALeer() {
        var s = EstadoApp()
        s.fase = .cargando
        s.cargaEnCurso = true
        XCTAssertEqual(MaquinaApp.reducir(&s, .datos(.failure(.servidor(429))), ahora: t0), [.esperar(Politica.reintentoFrenoSeg)])
        XCTAssertEqual(s.fase, .cargando)
        XCTAssertEqual(MaquinaApp.reducir(&s, .temporizador, ahora: t0), [.cancelarEspera, .cargarDatos])
    }

    func testElTemporizadorRespetaElMinuto() throws {
        var s = try listo(10)
        XCTAssertEqual(MaquinaApp.reducir(&s, .temporizador, ahora: t0), [.esperar(50)])
    }

    func testVolverAPrimerPlanoRefrescaSoloSiToca() throws {
        var a = try listo(10)
        _ = MaquinaApp.reducir(&a, .segundoPlano, ahora: t0)
        XCTAssertEqual(MaquinaApp.reducir(&a, .primerPlano, ahora: t0), [.esperar(50)])
        var b = try listo(120)
        _ = MaquinaApp.reducir(&b, .segundoPlano, ahora: t0)
        XCTAssertEqual(MaquinaApp.reducir(&b, .primerPlano, ahora: t0), [.cancelarEspera, .cargarDatos])
    }

    func testEnSegundoPlanoNoSeProgramaNada() throws {
        var s = try listo()
        _ = MaquinaApp.reducir(&s, .segundoPlano, ahora: t0)
        XCTAssertEqual(MaquinaApp.reducir(&s, .datos(.failure(.sinRed)), ahora: t0), [])
    }

    func testCerrarSesionBorraAntesDePedirCodigo() throws {
        var s = try listo()
        let e = MaquinaApp.reducir(&s, .cerrarSesion, ahora: t0)
        XCTAssertEqual(s.fase, .sinEnlazar(.pidiendo))
        XCTAssertEqual(e, [.cerrarSesion, .cancelarEspera, .emitirCodigo])
    }

    func testTrasCerrarSesionLoQueLlegueSeIgnora() throws {
        var s = try listo()
        _ = MaquinaApp.reducir(&s, .cerrarSesion, ahora: t0)
        XCTAssertEqual(MaquinaApp.reducir(&s, .datos(.success(try carga())), ahora: t0), [])
        XCTAssertEqual(s.fase, .sinEnlazar(.pidiendo))
    }
}

// MARK: Modelo con dobles

private final class TokenFalso: AlmacenToken, @unchecked Sendable {
    var valor: String?
    var falla = false
    var historial: [String] = []
    init(_ v: String? = nil) { valor = v }
    func leer() -> String? { valor }
    func guardar(_ token: String) -> Bool {
        if falla { return false }
        valor = token
        historial.append("guardar")
        return true
    }
    func borrar() { valor = nil }
}

private final class CacheFalsa: AlmacenCache, @unchecked Sendable {
    var carga: CargaTV?
    var borrada = false
    func leer() -> CacheTV? { carga.map { CacheTV(paquete: $0.paquete, sincronizado: $0.sincronizado) } }
    func guardar(_ c: CargaTV) { carga = c }
    func borrar() { carga = nil; borrada = true }
}

private actor ServicioFalso: ServicioTV {
    var canjes: [RespuestaCanje] = []
    var llamadasCerrar = 0
    var llamadasDatos = 0
    var sinRed = false
    var carga: CargaTV?

    func preparar(canjes: [RespuestaCanje] = [], carga: CargaTV? = nil, sinRed: Bool = false) {
        self.canjes = canjes
        self.carga = carga
        self.sinRed = sinRed
    }

    func emitirCodigo(nombre: String) async throws -> RespuestaEmision {
        if sinRed { throw ErrorTV.sinRed }
        return .ok(CodigoEmitido(codigo: "ABCD2345", secreto: "s", caducaEn: Date().addingTimeInterval(600), sondeoSeg: 5))
    }

    func canjear(secreto: String) async throws -> RespuestaCanje {
        canjes.isEmpty ? .pendiente(sondeoSeg: 5) : canjes.removeFirst()
    }

    func datos(token: String, hoy: String) async throws -> CargaTV {
        llamadasDatos += 1
        if sinRed { throw ErrorTV.sinRed }
        guard let carga else { throw ErrorTV.servidor(500) }
        return carga
    }

    func cerrarSesion(token: String) async throws {
        llamadasCerrar += 1
        if sinRed { throw ErrorTV.sinRed }
    }
}

@MainActor
final class ModeloAppTests: XCTestCase {
    private func hasta(_ condicion: @MainActor () async -> Bool, _ detalle: String = "") async {
        for _ in 0..<400 {
            if await condicion() { return }
            try? await Task.sleep(nanoseconds: 5_000_000)
        }
        XCTFail("no llegó: \(detalle)")
    }

    private func modelo(_ s: ServicioFalso, _ t: TokenFalso, _ c: CacheFalsa) -> ModeloApp {
        // El tiempo no corre en el test: la espera termina al instante.
        ModeloApp(servicio: s, tokens: t, cache: c, nombreAparato: "TV", dormir: { _ in await Task.yield() })
    }

    func testEnlazarGuardaTokenYCache() async throws {
        let s = ServicioFalso(), t = TokenFalso(), c = CacheFalsa()
        await s.preparar(canjes: [.aprobado(token: "tok")], carga: try carga())
        let m = modelo(s, t, c)
        m.arrancar()
        await hasta({ if case .listo = m.estado.fase { return true }; return false }, "listo")
        XCTAssertEqual(t.valor, "tok")
        XCTAssertNotNil(c.carga)
    }

    func testCerrarSesionSinRedBorraIgualYVuelveAlCodigo() async throws {
        let s = ServicioFalso(), t = TokenFalso("tok"), c = CacheFalsa()
        c.carga = try carga()
        await s.preparar(carga: try carga())
        let m = modelo(s, t, c)
        m.arrancar()
        await hasta({ m.estado.cargaEnCurso == false && m.estado.fase != .arrancando }, "carga")
        await s.preparar(sinRed: true)
        m.enviar(.cerrarSesion)
        XCTAssertNil(t.valor, "se borra en el mismo paso, sin esperar a la red")
        XCTAssertNil(c.carga)
        await hasta({ if case .sinEnlazar(.sinRed) = m.estado.fase { return true }; return false }, "sin red al pedir código")
        await hasta({ await s.llamadasCerrar == 1 }, "avisa al servidor")
    }

    func testSinTokenBorraUnaCacheHuerfana() {
        let s = ServicioFalso(), t = TokenFalso(), c = CacheFalsa()
        let m = modelo(s, t, c)
        m.arrancar()
        XCTAssertTrue(c.borrada)
    }

    func testSinConfiguracionNoTocaNada() {
        let t = TokenFalso("tok"), c = CacheFalsa()
        let m = ModeloApp(servicio: nil, tokens: t, cache: c, nombreAparato: "TV")
        m.arrancar()
        XCTAssertEqual(m.estado.fase, .noDisponible)
        XCTAssertEqual(t.valor, "tok", "sin config no se borra la sesión")
    }

    func testTokenNoGuardadoAvisaAlServidor() async {
        let s = ServicioFalso(), t = TokenFalso(), c = CacheFalsa()
        t.falla = true
        await s.preparar(canjes: [.aprobado(token: "tok")])
        let m = modelo(s, t, c)
        m.arrancar()
        await hasta({ if case .sinEnlazar(.almacen) = m.estado.fase { return true }; return false }, "almacén")
        await hasta({ await s.llamadasCerrar == 1 }, "cierra el token que no se guardó")
    }

    func testCacheEnDisco() throws {
        let carpeta = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let a = ArchivoCache(carpeta: carpeta)
        XCTAssertNil(a.leer())
        a.guardar(try carga())
        XCTAssertEqual(a.leer()?.paquete.perfil.nombre, "Livia")
        a.borrar()
        XCTAssertNil(a.leer())
        try FileManager.default.createDirectory(at: carpeta, withIntermediateDirectories: true)
        try Data("basura".utf8).write(to: carpeta.appendingPathComponent("paquete.json"))
        XCTAssertNil(a.leer(), "lo corrupto no rompe el arranque")
    }

    func testLlavero() {
        let k = LlaveroToken(servicio: "com.teferi.nivl.tv.prueba", cuenta: UUID().uuidString)
        XCTAssertNil(k.leer())
        guard k.guardar("uno") else {
            // Sin firma puede faltar el acceso al Llavero: la prueba real va en el punta a punta.
            return
        }
        XCTAssertEqual(k.leer(), "uno")
        XCTAssertTrue(k.guardar("dos"))
        XCTAssertEqual(k.leer(), "dos")
        k.borrar()
        XCTAssertNil(k.leer())
    }
}
