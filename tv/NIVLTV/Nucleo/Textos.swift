// NIVL TV · Los textos fijos del enlace y la cuenta.
//
// Voz del sistema: segunda persona, frases cortas, constata. Sin guion largo
// ni medio (TextosTests lo comprueba).

import Foundation

enum Textos {
    static let enlaceCeja = "NIVL en tu Apple TV"
    static let enlaceTitulo = "Enlaza esta TV"
    static let pasoUno = "Apunta la cámara de tu iPhone al código QR."
    static let pasoDos = "Confirma en NIVL. Sin contraseña."
    static let renovando = "Renovando el código."
    static let sinConexionEnlace = "Sin conexión. Seguimos intentándolo."

    static func caducaEn(_ reloj: String) -> String { "Caduca en \(reloj)" }

    static func motivo(_ m: MotivoSinEnlazar) -> String {
        switch m {
        case .pidiendo: return "Pidiendo tu código."
        case .sinRed: return "Sin conexión. Seguimos intentándolo."
        case .servidor: return "El servidor no responde. Seguimos intentándolo."
        case .saturado: return "Hay demasiadas TV enlazándose. Prueba en un minuto."
        case .denegado: return "El enlace se rechazó en el iPhone. Pide otro código si quieres entrar."
        case .almacen: return "Esta TV no ha podido guardar la sesión. Vuelve a enlazarla."
        }
    }

    static let noDisponibleTitulo = "Servicio no disponible"
    static let noDisponibleTexto = "Esta versión no puede hablar con el servidor. Actualiza NIVL."
    static let sinRedTitulo = "Sin conexión"
    static let sinRedTexto = "La TV no llega a internet. Tu sesión sigue activa."
    static let errorTitulo = "El servidor no responde"
    static let errorTexto = "Tu sesión sigue activa. Vuelve a intentarlo en un rato."
    static let caducadaTitulo = "Sesión caducada"
    static let caducadaTexto = "Esta TV ya no está enlazada. Enlázala otra vez desde tu iPhone."

    static let confirmarCierre = "¿Cerrar sesión en esta TV?"
    static let confirmarCierreTexto = "Para volver a entrar necesitarás tu iPhone."
    static let demoCuenta = "Modo demostración. Sin cuenta y sin red."

    static let entrenoCeja = "IRON · hoy"
    static let entrenoAyuda = "Clic del mando al terminar cada serie. El descanso corre solo."
    static let entrenoNoRegistra = "Esta TV no registra nada. La sesión se apunta en tu iPhone."
    static let sinSaludTitulo = "Sin entreno"
    static let sinSaludEntreno = "Activa los datos de salud en tu iPhone para ver tu rutina aquí."
    static let rutinaVacia = "Tu rutina de hoy no tiene ejercicios. Añádelos en el iPhone."
    static let hoyNoToca = "Hoy no toca"
    static let descansoConProxima = "Hoy no tienes entreno programado."
    static let descansoSinProxima = "No tienes entreno programado. Tu rutina se prepara en el iPhone."
    static let proximaRotulo = "Próxima sesión"
    static let sesionTerminada = "Sesión terminada"
    static let sesionTerminadaTexto = "Esta TV no registra nada. Apunta la sesión en tu iPhone para que cuente."
    static let salirTitulo = "¿Salir de la sesión?"
    static let salirTexto = "Lo que llevas en esta TV se pierde. No hay nada registrado."
    static let salirSeguir = "Seguir entrenando"
    static let salirConfirmar = "Salir"

    static func numeroEjercicios(_ n: Int) -> String { n == 1 ? "1 ejercicio" : "\(n) ejercicios" }
    static func yMas(_ n: Int) -> String { n == 1 ? "y 1 más" : "y \(n) más" }

    static let arenaTitulo = "Tu tabla"
    static let arenaSinAmigos = "Aún no tienes amigos en la tabla. Añádelos desde el iPhone."
    static let arenaVacia = "Tu tabla está vacía. Añade amigos desde el iPhone."

    static let semanaVaciaTitulo = "Aún no hay nada que leer"
    static let semanaVaciaTexto = "Cierra tu primer día en el iPhone. Aquí verás tu racha, tus misiones y tu mapa."

    /// El sello de los datos que no son de ahora. nil si están al día.
    static func frescura(_ red: EstadoRed, hace: String) -> String? {
        switch red {
        case .alDia: return nil
        case .sincronizando: return "Sincronizando · datos de \(hace)"
        case .sinRed: return "Sin conexión · datos de \(hace)"
        case .errorServidor: return "Servidor sin respuesta · datos de \(hace)"
        }
    }

    static var todos: [String] {
        let motivos: [MotivoSinEnlazar] = [.pidiendo, .sinRed, .servidor, .saturado, .denegado, .almacen]
        let redes: [EstadoRed] = [.alDia, .sincronizando, .sinRed, .errorServidor]
        return [
            enlaceCeja, enlaceTitulo, pasoUno, pasoDos, renovando, sinConexionEnlace, caducaEn("9:59"),
            noDisponibleTitulo, noDisponibleTexto, sinRedTitulo, sinRedTexto, errorTitulo, errorTexto,
            caducadaTitulo, caducadaTexto, confirmarCierre, confirmarCierreTexto, demoCuenta,
            entrenoCeja, entrenoAyuda, entrenoNoRegistra, sinSaludTitulo, sinSaludEntreno, rutinaVacia, hoyNoToca,
            descansoConProxima, descansoSinProxima, proximaRotulo, sesionTerminada, sesionTerminadaTexto,
            salirTitulo, salirTexto, salirSeguir, salirConfirmar, numeroEjercicios(1), numeroEjercicios(4), yMas(1), yMas(3),
            arenaTitulo, arenaSinAmigos, arenaVacia, semanaVaciaTitulo, semanaVaciaTexto,
        ] + motivos.map(motivo) + redes.compactMap { frescura($0, hace: "hace 3 h") }
    }
}
