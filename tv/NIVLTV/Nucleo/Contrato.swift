// NIVL TV · Lo que dice el servidor, tal cual (tv/CONTRATO.md).
//
// Lógica pura: decodifica las respuestas de las RPC y las traduce a los
// modelos que pintan las vistas. Sin red ni almacenamiento, para poder
// probarla con el JSON del contrato (ContratoTests).

import Foundation

// MARK: Errores tipados

enum ErrorTV: Error, Equatable {
    case sinRed
    /// HTTP distinto de 2xx o respuesta que no cumple el contrato. No se borra la sesión.
    case servidor(Int?)
    /// `tv_datos` dijo `sesion_invalida`: el único caso que borra la sesión.
    case sesionInvalida
}

// MARK: Fechas

enum FechaTV {
    /// ISO 8601 con zona y decimales de segundo opcionales (Postgres manda hasta seis).
    static func desde(_ texto: String) -> Date? {
        var limpio = texto.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: " ", with: "T")
        var fraccion: Double = 0
        if let punto = limpio.firstIndex(of: ".") {
            var fin = limpio.index(after: punto)
            while fin < limpio.endIndex, limpio[fin].isNumber { fin = limpio.index(after: fin) }
            fraccion = Double("0" + limpio[punto..<fin]) ?? 0
            limpio.removeSubrange(punto..<fin)
        }
        // «+00» es válido en Postgres y ISO8601DateFormatter pide «+00:00».
        if let signo = limpio.lastIndex(where: { $0 == "+" || $0 == "-" }),
           limpio.distance(from: limpio.startIndex, to: signo) >= 19,
           limpio.distance(from: signo, to: limpio.endIndex) == 3 {
            limpio += ":00"
        }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        guard let base = f.date(from: limpio) else { return nil }
        return base.addingTimeInterval(fraccion)
    }

    /// `YYYY-MM-DD` en el calendario y la zona dados (para `p_hoy`).
    static func dia(_ fecha: Date, zona: TimeZone = .current) -> String {
        var calendario = Calendar(identifier: .gregorian)
        calendario.timeZone = zona
        let c = calendario.dateComponents([.year, .month, .day], from: fecha)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}

// MARK: Respuestas de las RPC

struct CodigoEmitido: Equatable {
    let codigo: String
    let secreto: String
    let caducaEn: Date
    let sondeoSeg: Int
}

enum RespuestaEmision: Equatable {
    case ok(CodigoEmitido)
    case saturado(reintentarSeg: Int)
}

enum RespuestaCanje: Equatable {
    case pendiente(sondeoSeg: Int)
    case aprobado(token: String)
    case caducado
    case denegado
}

/// Lo que devuelve `tv_datos` con `estado = ok`.
struct PaqueteTV: Decodable, Equatable {
    let generadoEn: Date
    let hoy: String
    let sesionCaducaEn: Date
    let saludActiva: Bool
    let perfil: Perfil
    let rutina: Rutina?
    let arena: [FilaArenaC]
    let ludus: Ludus?
    let semana: Semana
    /// Falta en servidores anteriores a la 0128: se trata como null.
    let proxima: Proxima?

    struct Proxima: Decodable, Equatable {
        let nombre: String
        let diaSemana: Int
        let enDias: Int
        let ejercicios: Int
    }

    struct Perfil: Decodable, Equatable {
        let nombre: String
        let titulo: String
        let tipo: String?
        let rango: String
        let xpTotal: Int
        let elite: Bool
    }

    struct Rutina: Decodable, Equatable {
        let fuente: String
        let nombre: String
        let diaSemana: Int
        let hecha: Bool
        let ejercicios: [Ejercicio]
    }

    struct Ejercicio: Decodable, Equatable {
        let id: String
        let nombre: String
        let series: Int
        let reps: String
        let cargaKg: Double?
        let descansoSeg: Int
    }

    struct FilaArenaC: Decodable, Equatable {
        let id: String
        let soyYo: Bool
        let nombre: String
        let titulo: String
        let rango: String
        let xpTotal: Int
        let xpVentana: Int
        let racha: Int
        let cumplimientoPct: Int?
        let elite: Bool
    }

    struct Ludus: Decodable, Equatable {
        let nombre: String
        let miembros: [Miembro]

        struct Miembro: Decodable, Equatable {
            let id: String
            let soyYo: Bool
            let nombre: String
            let xpVentana: Int
            let cumplimientoPct: Int?
        }
    }

    struct Semana: Decodable, Equatable {
        let racha: Int
        let piedras: Int
        let piedrasMax: Int
        let xpGanado: Int
        let hechas: Int
        let falladas: Int
        let dias: [Dia]
        let mapa: [[Double]]
        let pesos: [Peso]
        let tendenciaKgSemana: Double?
        let tendenciaInicio: Double?
        let tendenciaFin: Double?
        let lectura: String?

        struct Dia: Decodable, Equatable {
            let fecha: String
            let inicial: String
            let hechas: Int
            let falladas: Int
        }

        struct Peso: Decodable, Equatable {
            let dia: Int
            let kg: Double
        }
    }
}

enum ContratoTV {
    private struct Sobre: Decodable { let estado: String? }

    private struct Emision: Decodable {
        let estado: String
        let codigo: String?
        let secreto: String?
        let caducaEn: Date?
        let sondeoSeg: Int?
        let reintentarSeg: Int?
    }

    private struct Canje: Decodable {
        let estado: String
        let sondeoSeg: Int?
        let token: String?
    }

    private static func decodificador() -> JSONDecoder {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        d.dateDecodingStrategy = .custom { dec in
            let c = try dec.singleValueContainer()
            let texto = try c.decode(String.self)
            guard let fecha = FechaTV.desde(texto) else {
                throw DecodingError.dataCorruptedError(in: c, debugDescription: "fecha no ISO 8601")
            }
            return fecha
        }
        return d
    }

    private static func leer<T: Decodable>(_ tipo: T.Type, _ data: Data) throws -> T {
        do { return try decodificador().decode(tipo, from: data) } catch { throw ErrorTV.servidor(nil) }
    }

    static func emision(_ data: Data) throws -> RespuestaEmision {
        let r = try leer(Emision.self, data)
        switch r.estado {
        case "ok":
            guard let codigo = r.codigo, CodigoTV.valido(codigo),
                  let secreto = r.secreto, !secreto.isEmpty,
                  let caduca = r.caducaEn else { throw ErrorTV.servidor(nil) }
            return .ok(CodigoEmitido(codigo: codigo, secreto: secreto, caducaEn: caduca, sondeoSeg: max(1, r.sondeoSeg ?? 5)))
        case "saturado":
            return .saturado(reintentarSeg: max(1, r.reintentarSeg ?? 60))
        default:
            throw ErrorTV.servidor(nil)
        }
    }

    static func canje(_ data: Data) throws -> RespuestaCanje {
        let r = try leer(Canje.self, data)
        switch r.estado {
        case "pendiente":
            return .pendiente(sondeoSeg: max(1, r.sondeoSeg ?? 5))
        case "aprobado":
            guard let token = r.token, !token.isEmpty else { throw ErrorTV.servidor(nil) }
            return .aprobado(token: token)
        case "caducado":
            return .caducado
        case "denegado":
            return .denegado
        default:
            throw ErrorTV.servidor(nil)
        }
    }

    /// `.sesionInvalida` si el servidor dice que el token ya no vale.
    static func paquete(_ data: Data) throws -> PaqueteTV {
        let sobre = try leer(Sobre.self, data)
        switch sobre.estado {
        case "ok": return try leer(PaqueteTV.self, data)
        case "sesion_invalida": throw ErrorTV.sesionInvalida
        default: throw ErrorTV.servidor(nil)
        }
    }
}

// MARK: Código de enlace

enum CodigoTV {
    private static let alfabeto = Set("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")

    static func valido(_ codigo: String) -> Bool {
        codigo.count == 8 && codigo.allSatisfy { alfabeto.contains($0) }
    }

    /// `ABCD2345` se enseña como `ABCD-2345`. Un guion normal, no largo.
    static func visible(_ codigo: String) -> String {
        guard codigo.count == 8 else { return codigo }
        return codigo.prefix(4) + "-" + codigo.suffix(4)
    }

    /// Lo que abre la cámara del iPhone.
    static func enlaceQR(_ codigo: String) -> String {
        "nivl://tv/" + visible(codigo)
    }

    /// Letra a letra para el lector de pantalla.
    static func deletreado(_ codigo: String) -> String {
        codigo.map(String.init).joined(separator: " ")
    }
}

// MARK: Del contrato a lo que pintan las vistas

extension PaqueteTV {
    var vista: DatosTV {
        DatosTV(
            perfil: PerfilTV(
                nombre: perfil.nombre,
                titulo: perfil.titulo,
                rango: perfil.rango,
                xpTotal: perfil.xpTotal,
                elite: perfil.elite
            ),
            saludActiva: saludActiva,
            rutina: rutina.map(Self.vistaRutina),
            arena: arena.map {
                FilaArena(id: $0.id, soyYo: $0.soyYo, nombre: $0.nombre, titulo: $0.titulo, rango: $0.rango,
                          xpTotal: $0.xpTotal, xpVentana: $0.xpVentana, racha: $0.racha,
                          cumplimientoPct: $0.cumplimientoPct, elite: $0.elite)
            },
            ludus: ludus.map { l in
                LudusTV(nombre: l.nombre, miembros: l.miembros.map {
                    FilaLudus(id: $0.id, nombre: $0.nombre, xpVentana: $0.xpVentana,
                              cumplimientoPct: $0.cumplimientoPct, soyYo: $0.soyYo)
                })
            },
            semana: SemanaTV(
                racha: semana.racha,
                piedras: semana.piedras,
                piedrasMax: semana.piedrasMax,
                xpGanado: semana.xpGanado,
                hechas: semana.hechas,
                falladas: semana.falladas,
                dias: semana.dias.map { DiaSemana(id: $0.fecha, inicial: $0.inicial, hechas: $0.hechas, falladas: $0.falladas) },
                mapa: semana.mapa,
                pesos: semana.pesos.map { PuntoPeso(id: $0.dia, dia: $0.dia, kg: $0.kg) },
                tendenciaKgSemana: semana.tendenciaKgSemana,
                tendenciaInicio: semana.tendenciaInicio,
                tendenciaFin: semana.tendenciaFin,
                lectura: semana.lectura
            ),
            proxima: proxima.map {
                ProximaSesion(nombre: $0.nombre, diaSemana: $0.diaSemana, enDias: $0.enDias, ejercicios: $0.ejercicios)
            }
        )
    }

    private static func vistaRutina(_ r: Rutina) -> RutinaTV {
        let dia = Formato.nombreDia(r.diaSemana) ?? "Hoy"
        let detalle: String
        if r.hecha {
            detalle = "sesión registrada hoy"
        } else if r.fuente == "prescripcion" {
            detalle = "prescrita por tu coach"
        } else {
            detalle = "rutina semanal"
        }
        return RutinaTV(
            nombre: r.nombre,
            dia: "\(dia) · \(detalle)",
            ejercicios: r.ejercicios.map {
                // Figura, músculos y técnica no llegan del servidor (contrato). Tampoco
                // se finge una carga: 0 o null es «sin carga prescrita».
                EjercicioTV(id: $0.id, nombre: $0.nombre, series: max(1, $0.series),
                            reps: Formato.reps($0.reps), cargaKg: $0.cargaKg.flatMap { $0 > 0 ? $0 : nil },
                            descansoSeg: max(0, $0.descansoSeg),
                            figura: nil, musculos: [], tecnica: [])
            },
            hecha: r.hecha
        )
    }
}
