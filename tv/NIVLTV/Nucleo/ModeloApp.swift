// NIVL TV · El estado raíz: ejecuta los efectos que pide MaquinaApp.
//
// Toda la decisión está en la máquina pura; aquí solo se habla con la red, el
// Llavero, la caché y el reloj. Las peticiones no se cancelan nunca, para que
// un canje aprobado no se pierda al pasar a segundo plano: lo único que se
// cancela es la espera.

import Foundation
import Observation
import UIKit

@MainActor
@Observable
final class ModeloApp {
    private(set) var estado = EstadoApp()

    @ObservationIgnored private let servicio: ServicioTV?
    @ObservationIgnored private let tokens: AlmacenToken
    @ObservationIgnored private let cache: AlmacenCache
    @ObservationIgnored private let nombreAparato: String
    @ObservationIgnored private let reloj: @MainActor () -> Date
    @ObservationIgnored private let dormir: @Sendable (Double) async throws -> Void
    @ObservationIgnored private var espera: Task<Void, Never>?
    /// Sube al borrar la sesión: lo que llegue de la anterior se descarta.
    @ObservationIgnored private var sesionId = 0
    @ObservationIgnored private var arrancado = false

    init(
        servicio: ServicioTV?,
        tokens: AlmacenToken,
        cache: AlmacenCache,
        nombreAparato: String,
        reloj: @escaping @MainActor () -> Date = { Date() },
        dormir: @escaping @Sendable (Double) async throws -> Void = { try await Task.sleep(nanoseconds: UInt64($0 * 1_000_000_000)) }
    ) {
        self.servicio = servicio
        self.tokens = tokens
        self.cache = cache
        self.nombreAparato = nombreAparato
        self.reloj = reloj
        self.dormir = dormir
    }

    static func real() -> ModeloApp {
        ModeloApp(
            servicio: ConfigServidor.actual().map { ClienteTV(config: $0) },
            tokens: LlaveroToken(),
            cache: ArchivoCache(),
            nombreAparato: UIDevice.current.name
        )
    }

    func arrancar() {
        guard !arrancado else { return }
        arrancado = true
        #if DEBUG || targetEnvironment(simulator)
        if Lanzamiento.actual.limpiar {
            tokens.borrar()
            cache.borrar()
        }
        #endif
        var hayToken = false
        var guardado: CacheTV?
        if servicio != nil {
            hayToken = tokens.leer() != nil
            if hayToken {
                guardado = cache.leer()
            } else {
                cache.borrar()
            }
        }
        enviar(.arranque(config: servicio != nil, hayToken: hayToken, cache: guardado))
    }

    func enviar(_ evento: EventoApp) {
        let efectos = MaquinaApp.reducir(&estado, evento, ahora: reloj())
        for efecto in efectos { ejecutar(efecto) }
    }

    private func ejecutar(_ efecto: EfectoApp) {
        switch efecto {
        case .cancelarEspera:
            espera?.cancel()
            espera = nil

        case .esperar(let segundos):
            espera?.cancel()
            let dormir = self.dormir
            espera = Task { [weak self] in
                do { try await dormir(segundos) } catch { return }
                guard !Task.isCancelled else { return }
                self?.enviar(.temporizador)
            }

        case .emitirCodigo:
            guard let servicio else { return }
            let nombre = nombreAparato
            Task {
                do {
                    enviar(.emision(.success(try await servicio.emitirCodigo(nombre: nombre))))
                } catch {
                    enviar(.emision(.failure(ClienteTV.traducir(error))))
                }
            }

        case .canjear(let secreto):
            guard let servicio else { return }
            Task {
                do {
                    enviar(.canje(.success(try await servicio.canjear(secreto: secreto))))
                } catch {
                    enviar(.canje(.failure(ClienteTV.traducir(error))))
                }
            }

        case .guardarToken(let token):
            if tokens.guardar(token) {
                cache.borrar()
                enviar(.tokenGuardado(true))
            } else {
                // Sin guardarlo no hay sesión posible: que no ocupe plaza de TV en la cuenta.
                avisarCierre(token)
                enviar(.tokenGuardado(false))
            }

        case .cargarDatos:
            guard let servicio, let token = tokens.leer() else {
                enviar(.datos(.failure(.sesionInvalida)))
                return
            }
            let id = sesionId
            let hoy = FechaTV.dia(reloj())
            Task {
                let resultado: Result<CargaTV, ErrorTV>
                do {
                    resultado = .success(try await servicio.datos(token: token, hoy: hoy))
                } catch {
                    resultado = .failure(ClienteTV.traducir(error))
                }
                guard id == sesionId else { return }
                if case .success(let carga) = resultado { cache.guardar(carga) }
                enviar(.datos(resultado))
            }

        case .cerrarSesion:
            let token = tokens.leer()
            borrarLocal()
            if let token { avisarCierre(token) }

        case .borrarSesionLocal:
            borrarLocal()
        }
    }

    private func borrarLocal() {
        sesionId += 1
        tokens.borrar()
        cache.borrar()
    }

    /// Sin esperar y sin insistir: lo local ya está borrado, haya red o no.
    private func avisarCierre(_ token: String) {
        guard let servicio else { return }
        Task { try? await servicio.cerrarSesion(token: token) }
    }
}
