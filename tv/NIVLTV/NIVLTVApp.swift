// NIVL TV · Modo salón (prototipo de solo lectura con datos de demo).
//
// Tres pestañas en la barra superior de tvOS: Entreno (IRON del día con
// temporizador), Arena (tabla de amigos y ludus) y Semana (resumen). Se
// navega solo con el foco del mando. Ver tv/README.md.

import SwiftUI

@main
struct NIVLTVApp: App {
    init() {
        Fuentes.registrar()
    }

    var body: some Scene {
        WindowGroup {
            RaizVista()
                .preferredColorScheme(.dark)
        }
    }
}

enum Pestana: String, CaseIterable {
    case entreno, arena, semana

    var titulo: String {
        switch self {
        case .entreno: return "Entreno"
        case .arena: return "Arena"
        case .semana: return "Semana"
        }
    }
}

struct RaizVista: View {
    // `-pestana arena` al lanzar (capturas): UserDefaults recoge el argumento.
    @State private var pestana = Pestana(rawValue: UserDefaults.standard.string(forKey: "pestana") ?? "") ?? .entreno

    var body: some View {
        TabView(selection: $pestana) {
            EntrenoVista()
                .tabItem { Text(Pestana.entreno.titulo) }
                .tag(Pestana.entreno)
            ArenaVista()
                .tabItem { Text(Pestana.arena.titulo) }
                .tag(Pestana.arena)
            SemanaVista()
                .tabItem { Text(Pestana.semana.titulo) }
                .tag(Pestana.semana)
        }
        .background(Tinta.i0.ignoresSafeArea())
    }
}
