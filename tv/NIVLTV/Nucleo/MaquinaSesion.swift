// NIVL TV · La sesión de IRON en el salón, como máquina pura.
//
// Un solo gesto con el mando: clic = serie hecha. Tras la serie arranca la
// cuenta atrás del descanso prescrito; al llegar a cero suena el aviso y la
// siguiente serie empieza sola. Clic durante el descanso = saltarlo.
// Play/Pausa congela el descanso. Todo depende de `ahora`, así se prueba sin
// relojes (MaquinaSesionTests) y la vista solo pinta.

import Foundation

struct MaquinaSesion: Equatable {
    enum Fase: Equatable {
        /// Antes de empezar: la primera serie espera el primer clic.
        case inicio
        /// Serie en curso desde ese instante.
        case serie(desde: Date)
        /// Descanso que termina en ese instante.
        case descanso(hasta: Date, total: TimeInterval)
        /// Descanso congelado con lo que le quedaba.
        case pausa(restante: TimeInterval, total: TimeInterval)
        case terminada
    }

    let rutina: RutinaTV
    /// Ejercicio y serie (1...series) que toca hacer ahora o tras el descanso.
    private(set) var indice = 0
    private(set) var serie = 1
    private(set) var fase: Fase = .inicio
    private(set) var hechas = 0
    private var ultimoGesto: Date?

    /// Un descanso que acabó hace más de esto (la app estaba en segundo plano)
    /// ya no suena: el aviso llegaría a destiempo.
    static let margenAviso: TimeInterval = 3
    /// Sin tocar el mando tanto tiempo, la sesión se da por abandonada y la
    /// pantalla vuelve a poder apagarse.
    static let limiteSinMando: TimeInterval = 45 * 60

    init(rutina: RutinaTV) {
        self.rutina = rutina
        if rutina.ejercicios.isEmpty { fase = .terminada }
    }

    var ejercicio: EjercicioTV? {
        rutina.ejercicios.indices.contains(indice) ? rutina.ejercicios[indice] : nil
    }

    /// El que viene después del actual, para el «a continuación».
    var siguienteEjercicio: EjercicioTV? {
        rutina.ejercicios.indices.contains(indice + 1) ? rutina.ejercicios[indice + 1] : nil
    }

    var progreso: Double {
        let total = rutina.seriesTotales
        return total > 0 ? Double(hechas) / Double(total) : 1
    }

    /// El clic del mando.
    mutating func pulsar(ahora: Date) {
        ultimoGesto = ahora
        switch fase {
        case .inicio:
            fase = .serie(desde: ahora)
        case .serie:
            completarSerie(ahora: ahora)
        case .descanso, .pausa:
            fase = .serie(desde: ahora)
        case .terminada:
            break
        }
    }

    /// Play/Pausa: solo actúa en el descanso.
    mutating func alternarPausa(ahora: Date) {
        ultimoGesto = ahora
        switch fase {
        case let .descanso(hasta, total):
            fase = .pausa(restante: max(0, hasta.timeIntervalSince(ahora)), total: total)
        case let .pausa(restante, total):
            fase = .descanso(hasta: ahora.addingTimeInterval(restante), total: total)
        default:
            break
        }
    }

    /// Avanza el reloj. Devuelve true justo cuando acaba un descanso y toca el
    /// aviso. Todo va por fechas absolutas: al volver de segundo plano el reloj
    /// dice la verdad, y un descanso ya vencido no suena tarde.
    @discardableResult
    mutating func tic(ahora: Date) -> Bool {
        if case let .descanso(hasta, _) = fase, ahora >= hasta {
            fase = .serie(desde: hasta)
            return ahora.timeIntervalSince(hasta) <= Self.margenAviso
        }
        return false
    }

    /// La sesión está en marcha: el botón Menú pide confirmación.
    var enMarcha: Bool {
        fase != .inicio && fase != .terminada
    }

    /// Si la TV debe seguir encendida sin que nadie toque el mando.
    func pantallaDespierta(ahora: Date) -> Bool {
        guard enMarcha, let ultimoGesto else { return false }
        return ahora.timeIntervalSince(ultimoGesto) < Self.limiteSinMando
    }

    /// Segundos que le quedan al descanso (nil fuera del descanso).
    func restante(ahora: Date) -> TimeInterval? {
        switch fase {
        case let .descanso(hasta, _): return max(0, hasta.timeIntervalSince(ahora))
        case let .pausa(restante, _): return restante
        default: return nil
        }
    }

    /// Fracción consumida del descanso (0 recién empezado, 1 terminado).
    func fraccionDescanso(ahora: Date) -> Double {
        switch fase {
        case let .descanso(_, total), let .pausa(_, total):
            guard total > 0, let queda = restante(ahora: ahora) else { return 1 }
            return min(1, max(0, 1 - queda / total))
        default:
            return 0
        }
    }

    /// Segundos que lleva la serie en curso (nil fuera de la serie).
    func transcurrido(ahora: Date) -> TimeInterval? {
        if case let .serie(desde) = fase { return max(0, ahora.timeIntervalSince(desde)) }
        return nil
    }

    private mutating func completarSerie(ahora: Date) {
        guard let actual = ejercicio else {
            fase = .terminada
            return
        }
        hechas += 1
        let descanso = TimeInterval(actual.descansoSeg)
        if serie < actual.series {
            serie += 1
        } else if indice + 1 < rutina.ejercicios.count {
            indice += 1
            serie = 1
        } else {
            fase = .terminada
            return
        }
        fase = descanso > 0 ? .descanso(hasta: ahora.addingTimeInterval(descanso), total: descanso) : .serie(desde: ahora)
    }
}
