// NIVL TV · Modo salón, de solo lectura.
//
// Sin sesión, la pantalla de enlace. Con sesión, cuatro pestañas en la barra
// superior de tvOS: Entreno (IRON del día, sesión guiada), Arena (tabla de
// amigos y ludus), Semana (resumen) y Cuenta. Ver tv/README.md.

import SwiftUI
import UIKit

@main
struct NIVLTVApp: App {
    init() {
        Fuentes.registrar()
        // La píldora de la barra es del sistema (excepción al radio 0: ver README); el texto no.
        if let fuente = UIFont(name: "Outfit-Bold", size: 30) {
            for estado: UIControl.State in [.normal, .focused, .selected] {
                UITabBarItem.appearance().setTitleTextAttributes([.font: fuente], for: estado)
            }
        }
    }

    var body: some Scene {
        WindowGroup {
            Raiz()
                .preferredColorScheme(.dark)
        }
    }
}

enum Pestana: String, CaseIterable {
    case entreno, arena, semana, cuenta

    var titulo: String {
        switch self {
        case .entreno: return "Entreno"
        case .arena: return "Arena"
        case .semana: return "Semana"
        case .cuenta: return "Cuenta"
        }
    }
}

/// Decide entre la app real y la demo. En Release para aparato solo existe la real.
private struct Raiz: View {
    var body: some View {
        #if DEBUG || targetEnvironment(simulator)
        if Lanzamiento.actual.demo {
            RaizDemo()
        } else {
            RaizVista(arrancar: !Lanzamiento.enTests)
        }
        #else
        RaizVista(arrancar: true)
        #endif
    }
}

#if DEBUG || targetEnvironment(simulator)
/// Solo capturas: `-estado carga` enseña los huecos y `-estado sinred` el sello.
private struct RaizDemo: View {
    private let l = Lanzamiento.actual
    private var datos: DatosTV { Demo.datos(variante: l.variante) }

    var body: some View {
        PestanasVista(
            datos: l.estado == "carga" ? nil : datos,
            pestanaInicial: Pestana(rawValue: l.pestana ?? "") ?? .entreno,
            estadoInicial: l.estado
        ) {
            if l.estado == "carga" {
                HuecosCuenta()
            } else {
                CuentaVista(perfil: datos.perfil, contenido: nil, aviso: nil)
            }
        }
        .modifier(AnclaSesion())
        .overlay(alignment: .topTrailing) {
            if l.estado == "sinred" {
                SelloFrescura(contenido: Contenido(
                    datos: datos, sincronizado: Date().addingTimeInterval(-3 * 3600),
                    sesionCaducaEn: Date().addingTimeInterval(86400), red: .sinRed
                ))
            }
        }
    }
}
#endif

struct RaizVista: View {
    let arrancar: Bool
    @State private var modelo = ModeloApp.real()
    @State private var confirmandoCierre = false
    @Environment(\.scenePhase) private var escena

    var body: some View {
        contenido
            // Por encima de todas las pantallas: si la sesión caduca a mitad de un
            // entreno, el token se borra ya pero «Sesión caducada» espera detrás.
            .modifier(AnclaSesion())
            .task { if arrancar { modelo.arrancar() } }
            .onChange(of: escena) { _, nueva in
                guard arrancar else { return }
                switch nueva {
                case .background: modelo.enviar(.segundoPlano)
                case .active: modelo.enviar(.primerPlano)
                default: break
                }
            }
    }

    /// El enlace va en una sola rama: así la vista conserva su identidad y el
    /// foco no se pierde al pasar de pedir el código a enseñarlo.
    private var enEnlace: (enlace: EnlaceActivo?, motivo: MotivoSinEnlazar?)? {
        switch modelo.estado.fase {
        case .sinEnlazar(let motivo): return (nil, motivo)
        case .enlazando(let enlace): return (enlace, nil)
        default: return nil
        }
    }

    @ViewBuilder
    private var contenido: some View {
        if let e = enEnlace {
            EnlaceVista(enlace: e.enlace, motivo: e.motivo) { modelo.enviar(.reintentar) }
        } else {
            sinEnlace
        }
    }

    @ViewBuilder
    private var sinEnlace: some View {
        switch modelo.estado.fase {
        case .arrancando, .sinEnlazar, .enlazando:
            Tinta.i0.ignoresSafeArea()
        case .cargando, .listo:
            // Una sola rama: la pestaña y el foco sobreviven a la primera carga.
            pestanas
        case .noDisponible:
            PantallaAviso(titulo: Textos.noDisponibleTitulo, texto: Textos.noDisponibleTexto)
        case .sinRed:
            PantallaAviso(titulo: Textos.sinRedTitulo, texto: Textos.sinRedTexto) { botonesSesion }
        case .errorServidor:
            PantallaAviso(titulo: Textos.errorTitulo, texto: Textos.errorTexto) { botonesSesion }
        case .sesionCaducada:
            PantallaAviso(titulo: Textos.caducadaTitulo, texto: Textos.caducadaTexto) {
                Button("Enlazar de nuevo") { modelo.enviar(.reintentar) }
                    .buttonStyle(EstiloFoco(invertido: true))
                    .accessibilityIdentifier("enlazarDeNuevo")
            }
        }
    }

    private var listo: Contenido? {
        if case .listo(let c) = modelo.estado.fase { return c }
        return nil
    }

    private var pestanas: some View {
        let c = listo
        return PestanasVista(datos: c?.datos, pestanaInicial: Self.pestanaInicial, estadoInicial: nil) {
            if let c {
                CuentaVista(
                    perfil: c.datos.perfil,
                    contenido: c,
                    aviso: modelo.estado.aviso,
                    sincronizar: { modelo.enviar(.sincronizarAhora) },
                    cerrarSesion: { modelo.enviar(.cerrarSesion) }
                )
            } else {
                HuecosCuenta()
            }
        }
        .overlay(alignment: .topTrailing) {
            if let c { SelloFrescura(contenido: c) }
        }
    }

    private var botonesSesion: some View {
        HStack(spacing: Hueco.s8) {
            Button("Reintentar") { modelo.enviar(.reintentar) }
                .buttonStyle(EstiloFoco(invertido: true))
            Button("Cerrar sesión") { confirmandoCierre = true }
                .buttonStyle(EstiloFoco())
        }
        .alert(Textos.confirmarCierre, isPresented: $confirmandoCierre) {
            Button("Cerrar sesión") { modelo.enviar(.cerrarSesion) }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text(Textos.confirmarCierreTexto)
        }
    }

    private static var pestanaInicial: Pestana {
        #if DEBUG || targetEnvironment(simulator)
        return Pestana(rawValue: Lanzamiento.actual.pestana ?? "") ?? .entreno
        #else
        return .entreno
        #endif
    }
}

struct PestanasVista<Cuenta: View>: View {
    /// nil en la primera carga: cada pestaña enseña sus huecos.
    let datos: DatosTV?
    let estadoInicial: String?
    let cuenta: Cuenta
    @State private var pestana: Pestana

    init(datos: DatosTV?, pestanaInicial: Pestana, estadoInicial: String?, @ViewBuilder cuenta: () -> Cuenta) {
        self.datos = datos
        self.estadoInicial = estadoInicial
        self.cuenta = cuenta()
        _pestana = State(initialValue: pestanaInicial)
    }

    var body: some View {
        TabView(selection: $pestana) {
            pestanaEntreno
                .tabItem { Text(Pestana.entreno.titulo) }
                .tag(Pestana.entreno)
            pestanaArena
                .tabItem { Text(Pestana.arena.titulo) }
                .tag(Pestana.arena)
            pestanaSemana
                .tabItem { Text(Pestana.semana.titulo) }
                .tag(Pestana.semana)
            cuenta
                .tabItem { Text(Pestana.cuenta.titulo) }
                .tag(Pestana.cuenta)
        }
        .background(Tinta.i0.ignoresSafeArea())
    }

    @ViewBuilder private var pestanaEntreno: some View {
        if let datos {
            EntrenoPantalla(rutina: datos.rutina, saludActiva: datos.saludActiva, proxima: datos.proxima, estadoInicial: estadoInicial)
        } else {
            HuecosEntreno()
        }
    }

    @ViewBuilder private var pestanaArena: some View {
        if let datos {
            ArenaVista(filas: datos.arena, ludus: datos.ludus)
        } else {
            HuecosArena()
        }
    }

    @ViewBuilder private var pestanaSemana: some View {
        if let datos {
            SemanaVista(semana: datos.semana, saludActiva: datos.saludActiva)
        } else {
            HuecosSemana()
        }
    }
}

/// Deja claro que lo que se ve no es de ahora.
struct SelloFrescura: View {
    let contenido: Contenido

    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { t in
            if let texto = Textos.frescura(contenido.red, hace: Formato.hace(contenido.sincronizado, ahora: t.date)),
               contenido.red != .sincronizando || t.date.timeIntervalSince(contenido.sincronizado) >= Politica.refrescoMinimoSeg {
                Text(texto)
                    .font(Tipo.cuerpoSm)
                    .foregroundStyle(Tinta.i0)
                    .lineLimit(1)
                    .padding(.horizontal, Hueco.s4)
                    .padding(.vertical, Hueco.s2)
                    .background(Tinta.i10, ignoresSafeAreaEdges: [])
                    .accessibilityIdentifier("selloFrescura")
            }
        }
    }
}

/// Una pantalla de estado: título, frase y, si toca, qué hacer.
struct PantallaAviso<Acciones: View>: View {
    let titulo: String
    let texto: String
    let acciones: Acciones

    init(titulo: String, texto: String, @ViewBuilder acciones: () -> Acciones) {
        self.titulo = titulo
        self.texto = texto
        self.acciones = acciones()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Hueco.s10) {
            EncabezadoTV(ceja: "NIVL", titulo: titulo)
            Text(texto)
                .font(Tipo.titular)
                .foregroundStyle(Tinta.i9)
                .fixedSize(horizontal: false, vertical: true)
            acciones
        }
        .frame(maxWidth: 1200, alignment: .leading)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Tinta.i0.ignoresSafeArea())
    }
}

extension PantallaAviso where Acciones == EmptyView {
    init(titulo: String, texto: String) {
        self.init(titulo: titulo, texto: texto) { EmptyView() }
    }
}
