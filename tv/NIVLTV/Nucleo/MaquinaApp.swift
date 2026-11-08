// NIVL TV · Qué pantalla toca y qué hay que hacer, como máquina pura.
//
// `MaquinaApp.reducir` recibe el estado, un evento y la hora, cambia el estado
// y devuelve los efectos que debe ejecutar ModeloApp (red, Llavero, caché,
// temporizador). Sin relojes ni red, así se prueba en MaquinaAppTests.
//
// Reglas que salen del contrato:
// - Se sondea tras recibir la respuesta anterior: nunca hay dos canjes a la vez.
// - El token se guarda antes de leer nada.
// - Solo `sesion_invalida` borra la sesión. Un fallo de red o servidor, jamás.
// - Se refresca como mucho una vez por minuto.
// - En segundo plano no se programa nada.

import Foundation

enum Politica {
    /// Refresco normal con la app delante.
    static let refrescoSeg: Double = 300
    /// El contrato: como mucho una vez por minuto.
    static let refrescoMinimoSeg: Double = 60
    /// Tras un `demasiado_rapido`: el servidor frena 5 s por token.
    static let reintentoFrenoSeg: Double = 6

    static func reintentoDatos(fallos: Int) -> Double {
        min(300, 60 * pow(2, Double(max(0, fallos - 1))))
    }

    static func reintentoEmision(fallos: Int) -> Double {
        min(60, 5 * pow(2, Double(max(0, fallos - 1))))
    }

    static func reintentoCanje(sondeoSeg: Int, fallos: Int) -> Double {
        let base = Double(sondeoSeg)
        return max(base, min(60, base * pow(2, Double(max(0, fallos - 1)))))
    }
}

struct EnlaceActivo: Equatable {
    let codigo: String
    let secreto: String
    let caducaEn: Date
    var sondeoSeg: Int
    var sinConexion = false
    var canjeEnCurso = false

    init(_ c: CodigoEmitido) {
        codigo = c.codigo
        secreto = c.secreto
        caducaEn = c.caducaEn
        sondeoSeg = c.sondeoSeg
    }
}

enum MotivoSinEnlazar: Equatable {
    case pidiendo
    case sinRed
    case servidor
    case saturado
    /// La persona dijo que no en el iPhone. No se pide otro código solo.
    case denegado
    /// El Llavero no guardó el token.
    case almacen
}

enum EstadoRed: Equatable {
    case alDia
    case sincronizando
    case sinRed
    case errorServidor
}

struct Contenido: Equatable {
    let datos: DatosTV
    let sincronizado: Date
    let sesionCaducaEn: Date
    var red: EstadoRed
}

enum Fase: Equatable {
    case arrancando
    /// El binario no tiene servidor configurado.
    case noDisponible
    case sinEnlazar(MotivoSinEnlazar)
    case enlazando(EnlaceActivo)
    case cargando
    /// Con datos, frescos o de la caché: `red` dice cuáles.
    case listo(Contenido)
    /// Con sesión, sin caché y sin red.
    case sinRed
    /// Con sesión, sin caché y el servidor falla.
    case errorServidor
    case sesionCaducada
}

struct EstadoApp: Equatable {
    var fase: Fase = .arrancando
    var enPrimerPlano = true
    var fallos = 0
    var emisionEnCurso = false
    var cargaEnCurso = false
    /// Mensaje de la pestaña Cuenta tras pedir sincronizar.
    var aviso: String?
}

enum EventoApp {
    case arranque(config: Bool, hayToken: Bool, cache: CacheTV?)
    case primerPlano
    case segundoPlano
    /// Terminó la única espera pendiente.
    case temporizador
    /// Botón de reintento o de pedir otro código.
    case reintentar
    case sincronizarAhora
    case cerrarSesion
    case emision(Result<RespuestaEmision, ErrorTV>)
    case canje(Result<RespuestaCanje, ErrorTV>)
    case tokenGuardado(Bool)
    case datos(Result<CargaTV, ErrorTV>)
}

enum EfectoApp: Equatable {
    case emitirCodigo
    case canjear(secreto: String)
    case guardarToken(String)
    case cargarDatos
    /// Sustituye a la espera anterior, si la había.
    case esperar(Double)
    case cancelarEspera
    /// Borra Llavero y caché y avisa al servidor sin esperar respuesta.
    case cerrarSesion
    /// El servidor ya la dio por muerta: solo borrar lo local.
    case borrarSesionLocal
}

enum MaquinaApp {
    static func reducir(_ s: inout EstadoApp, _ evento: EventoApp, ahora: Date) -> [EfectoApp] {
        switch evento {
        case let .arranque(config, hayToken, cache):
            guard s.fase == .arrancando else { return [] }
            guard config else {
                s.fase = .noDisponible
                return []
            }
            guard hayToken else { return pedirCodigo(&s) }
            if let cache {
                let vista = cache.paquete.vista
                s.fase = .listo(Contenido(datos: vista, sincronizado: cache.sincronizado,
                                          sesionCaducaEn: cache.paquete.sesionCaducaEn, red: .sincronizando))
            } else {
                s.fase = .cargando
            }
            return cargar(&s)

        case .segundoPlano:
            s.enPrimerPlano = false
            return [.cancelarEspera]

        case .primerPlano:
            guard !s.enPrimerPlano else { return [] }
            s.enPrimerPlano = true
            return alVolver(&s, ahora: ahora)

        case .temporizador:
            return alVencerEspera(&s, ahora: ahora)

        case .reintentar:
            switch s.fase {
            case .sinRed, .errorServidor:
                s.fase = .cargando
                return cargar(&s)
            case .sinEnlazar, .enlazando, .sesionCaducada:
                s.fallos = 0
                return pedirCodigo(&s)
            default:
                return []
            }

        case .sincronizarAhora:
            guard case .listo(var c) = s.fase, c.red != .sincronizando, !s.cargaEnCurso else { return [] }
            // El tope es para no releer datos buenos. Si la última vuelta falló, la
            // persona puede reintentar: decirle «ya está al día» sin red sería mentira.
            guard c.red != .alDia || ahora.timeIntervalSince(c.sincronizado) >= Politica.refrescoMinimoSeg else {
                s.aviso = "Ya está al día. Prueba en un minuto."
                return []
            }
            s.aviso = nil
            c.red = .sincronizando
            s.fase = .listo(c)
            return cargar(&s)

        case .cerrarSesion:
            switch s.fase {
            case .listo, .cargando, .sinRed, .errorServidor:
                s.cargaEnCurso = false
                s.fallos = 0
                s.aviso = nil
                return [.cerrarSesion] + pedirCodigo(&s)
            default:
                return []
            }

        case let .emision(resultado):
            return alEmitir(&s, resultado)

        case let .canje(resultado):
            return alCanjear(&s, resultado, ahora: ahora)

        case let .tokenGuardado(ok):
            guard s.fase == .cargando else { return [] }
            guard ok else {
                s.fase = .sinEnlazar(.almacen)
                return []
            }
            return s.enPrimerPlano ? cargar(&s) : []

        case let .datos(resultado):
            return alCargar(&s, resultado)
        }
    }

    // MARK: Piezas

    private static func pedirCodigo(_ s: inout EstadoApp) -> [EfectoApp] {
        s.fase = .sinEnlazar(.pidiendo)
        guard s.enPrimerPlano, !s.emisionEnCurso else { return [.cancelarEspera] }
        s.emisionEnCurso = true
        return [.cancelarEspera, .emitirCodigo]
    }

    private static func cargar(_ s: inout EstadoApp) -> [EfectoApp] {
        guard !s.cargaEnCurso else { return [.cancelarEspera] }
        s.cargaEnCurso = true
        return [.cancelarEspera, .cargarDatos]
    }

    private static func esperaSondeo(_ e: EnlaceActivo, ahora: Date, fallos: Int) -> [EfectoApp] {
        let sondeo = fallos > 0
            ? Politica.reintentoCanje(sondeoSeg: e.sondeoSeg, fallos: fallos)
            : Double(e.sondeoSeg)
        // Despierta justo al caducar para renovar el código sin esperar al siguiente sondeo.
        return [.esperar(max(0, min(sondeo, e.caducaEn.timeIntervalSince(ahora))))]
    }

    private static func alVolver(_ s: inout EstadoApp, ahora: Date) -> [EfectoApp] {
        switch s.fase {
        case .enlazando(let e):
            if ahora >= e.caducaEn { return pedirCodigo(&s) }
            return esperaSondeo(e, ahora: ahora, fallos: 0)
        case .sinEnlazar(let motivo):
            guard motivo != .denegado, motivo != .almacen else { return [] }
            return pedirCodigo(&s)
        case .cargando, .sinRed, .errorServidor:
            return cargar(&s)
        case .listo(var c):
            let edad = ahora.timeIntervalSince(c.sincronizado)
            guard edad >= Politica.refrescoMinimoSeg else {
                return [.esperar(Politica.refrescoMinimoSeg - edad)]
            }
            if c.red == .alDia {
                c.red = .sincronizando
                s.fase = .listo(c)
            }
            return cargar(&s)
        case .arrancando, .noDisponible, .sesionCaducada:
            return []
        }
    }

    private static func alVencerEspera(_ s: inout EstadoApp, ahora: Date) -> [EfectoApp] {
        guard s.enPrimerPlano else { return [] }
        switch s.fase {
        case .enlazando(var e):
            if ahora >= e.caducaEn { return pedirCodigo(&s) }
            guard !e.canjeEnCurso else { return [] }
            e.canjeEnCurso = true
            s.fase = .enlazando(e)
            return [.canjear(secreto: e.secreto)]
        case .sinEnlazar(let motivo):
            guard motivo != .denegado, motivo != .almacen else { return [] }
            return pedirCodigo(&s)
        case .cargando, .sinRed, .errorServidor:
            return cargar(&s)
        case .listo(var c):
            let edad = ahora.timeIntervalSince(c.sincronizado)
            guard edad >= Politica.refrescoMinimoSeg else {
                return [.esperar(Politica.refrescoMinimoSeg - edad)]
            }
            // Si ya venía fallando, el rótulo sigue diciendo por qué hasta que acierte.
            if c.red == .alDia {
                c.red = .sincronizando
                s.fase = .listo(c)
            }
            return cargar(&s)
        case .arrancando, .noDisponible, .sesionCaducada:
            return []
        }
    }

    private static func alEmitir(_ s: inout EstadoApp, _ r: Result<RespuestaEmision, ErrorTV>) -> [EfectoApp] {
        s.emisionEnCurso = false
        guard s.fase == .sinEnlazar(.pidiendo) else { return [] }
        switch r {
        case .success(.ok(let codigo)):
            s.fallos = 0
            let e = EnlaceActivo(codigo)
            s.fase = .enlazando(e)
            return s.enPrimerPlano ? [.esperar(Double(e.sondeoSeg))] : []
        case .success(.saturado(let seg)):
            s.fase = .sinEnlazar(.saturado)
            return s.enPrimerPlano ? [.esperar(Double(seg))] : []
        case .failure(let fallo):
            s.fallos += 1
            s.fase = .sinEnlazar(fallo == .sinRed ? .sinRed : .servidor)
            return s.enPrimerPlano ? [.esperar(Politica.reintentoEmision(fallos: s.fallos))] : []
        }
    }

    private static func alCanjear(_ s: inout EstadoApp, _ r: Result<RespuestaCanje, ErrorTV>, ahora: Date) -> [EfectoApp] {
        // El token sale una sola vez: se guarda aunque la pantalla ya sea otra.
        if case .success(.aprobado(let token)) = r {
            s.fallos = 0
            s.fase = .cargando
            return [.cancelarEspera, .guardarToken(token)]
        }
        guard case .enlazando(var e) = s.fase else { return [] }
        e.canjeEnCurso = false
        switch r {
        case .success(.pendiente(let sondeoSeg)):
            s.fallos = 0
            e.sondeoSeg = sondeoSeg
            e.sinConexion = false
            s.fase = .enlazando(e)
            return s.enPrimerPlano ? esperaSondeo(e, ahora: ahora, fallos: 0) : []
        case .success(.caducado):
            return pedirCodigo(&s)
        case .success(.denegado):
            s.fase = .sinEnlazar(.denegado)
            return [.cancelarEspera]
        case .failure:
            s.fallos += 1
            e.sinConexion = true
            s.fase = .enlazando(e)
            return s.enPrimerPlano ? esperaSondeo(e, ahora: ahora, fallos: s.fallos) : []
        case .success(.aprobado):
            return []
        }
    }

    private static func alCargar(_ s: inout EstadoApp, _ r: Result<CargaTV, ErrorTV>) -> [EfectoApp] {
        s.cargaEnCurso = false
        switch s.fase {
        case .cargando, .listo, .sinRed, .errorServidor: break
        default: return []
        }
        switch r {
        case .success(let carga):
            s.fallos = 0
            s.aviso = nil
            s.fase = .listo(Contenido(datos: carga.paquete.vista, sincronizado: carga.sincronizado,
                                      sesionCaducaEn: carga.paquete.sesionCaducaEn, red: .alDia))
            return s.enPrimerPlano ? [.esperar(Politica.refrescoSeg)] : []
        case .failure(.sesionInvalida):
            s.fallos = 0
            s.aviso = nil
            s.fase = .sesionCaducada
            return [.cancelarEspera, .borrarSesionLocal]
        case .failure(.servidor(429)) where s.fallos == 0:
            // `demasiado_rapido` (reabrir la app en menos de 5 s): el servidor está bien.
            // Una vez y sin rótulo de fallo; si insiste, ya es un fallo como los demás.
            s.fallos = 1
            return s.enPrimerPlano ? [.esperar(Politica.reintentoFrenoSeg)] : []
        case .failure(let fallo):
            s.fallos += 1
            if case .listo(var c) = s.fase {
                c.red = fallo == .sinRed ? .sinRed : .errorServidor
                s.fase = .listo(c)
            } else {
                s.fase = fallo == .sinRed ? .sinRed : .errorServidor
            }
            return s.enPrimerPlano ? [.esperar(Politica.reintentoDatos(fallos: s.fallos))] : []
        }
    }
}
