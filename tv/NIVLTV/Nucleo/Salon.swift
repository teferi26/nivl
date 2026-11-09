// NIVL TV · Qué enseña cada pestaña según lo que haya llegado.
//
// Decisiones puras, sin SwiftUI: así se prueban los estados sin datos, sin
// salud o sin historial (SalonTests) y las vistas solo pintan.

import Foundation

/// Qué pinta la pestaña Entreno.
enum EstadoEntreno: Equatable {
    case ironCerrado
    case sinSalud
    case rutina(RutinaTV)
    case rutinaVacia(nombre: String)
    case descanso(ProximaSesion?)

    static func decidir(rutina: RutinaTV?, saludActiva: Bool, proxima: ProximaSesion?, ironAbierto: Bool = true) -> EstadoEntreno {
        guard ironAbierto else { return .ironCerrado }
        guard saludActiva else { return .sinSalud }
        guard let rutina else { return .descanso(proxima) }
        return rutina.ejercicios.isEmpty ? .rutinaVacia(nombre: rutina.nombre) : .rutina(rutina)
    }
}

enum ListaVisible {
    /// Las filas que caben, con la actual dentro y una ya pasada encima para no perder el hilo.
    static func ventana(total: Int, actual: Int, capacidad: Int) -> Range<Int> {
        guard total > capacidad else { return 0..<max(0, total) }
        let inicio = min(max(0, actual - 1), total - capacidad)
        return inicio..<(inicio + capacidad)
    }
}

/// Tu sitio en la tabla, tal como la ordena el servidor.
struct PuestoArena: Equatable {
    let puesto: Int
    let total: Int

    static func propio(_ filas: [FilaArena]) -> PuestoArena? {
        filas.firstIndex(where: \.soyYo).map { PuestoArena(puesto: $0 + 1, total: filas.count) }
    }
}

/// La parte de peso de la Semana, solo si hay algo verdadero que pintar.
struct SeccionPeso: Equatable {
    let pesos: [PuntoPeso]
    let tendenciaKgSemana: Double
    let inicio: Double
    let fin: Double
    let lectura: String?
}

extension SemanaTV {
    /// Sin consentimiento, sin pesajes en la ventana o sin recta: nil, y la tarjeta no existe.
    func seccionPeso(saludActiva: Bool) -> SeccionPeso? {
        guard saludActiva, !pesos.isEmpty, let tendenciaKgSemana, let tendenciaInicio, let tendenciaFin else { return nil }
        return SeccionPeso(pesos: pesos, tendenciaKgSemana: tendenciaKgSemana, inicio: tendenciaInicio,
                           fin: tendenciaFin, lectura: lectura)
    }

    /// Cuenta nueva: nada que leer. Tres filas de ceros no son información.
    var sinHistorial: Bool {
        racha == 0 && piedras == 0 && xpGanado == 0 && hechas == 0 && falladas == 0
            && pesos.isEmpty && mapa.allSatisfy { $0.allSatisfy { $0 <= 0 } }
    }
}
