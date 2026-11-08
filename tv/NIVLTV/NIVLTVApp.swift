// NIVL TV · Modo salón, de solo lectura.
//
// Sin sesión, la pantalla de enlace. Con sesión, cuatro pestañas en la barra
// superior de tvOS: Entreno (IRON del día con temporizador), Arena (tabla de
// amigos y ludus), Semana (resumen) y Cuenta. Ver tv/README.md.

import SwiftUI

@main
struct NIVLTVApp: App {
    init() {
        Fuentes.registrar()
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
            PestanasVista(
                datos: Demo.datos,
                pestanaInicial: Pestana(rawValue: Lanzamiento.actual.pestana ?? "") ?? .entreno,
                estadoInicial: Lanzamiento.actual.estado
            ) {
                CuentaVista(perfil: Demo.datos.perfil, contenido: nil, aviso: nil)
            }
        } else {
            RaizVista(arrancar: !Lanzamiento.enTests)
        }
        #else
        RaizVista(arrancar: true)
        #endif
    }
}

struct RaizVista: View {
    let arrancar: Bool
    @State private var modelo = ModeloApp.real()
    @Environment(\.scenePhase) private var escena

    var body: some View {
        contenido
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
        case .noDisponible:
            PantallaAviso(titulo: Textos.noDisponibleTitulo, texto: Textos.noDisponibleTexto)
        case .cargando:
            CargandoVista()
        case .listo(let c):
            PestanasVista(datos: c.datos, pestanaInicial: Self.pestanaInicial, estadoInicial: nil) {
                CuentaVista(
                    perfil: c.datos.perfil,
                    contenido: c,
                    aviso: modelo.estado.aviso,
                    sincronizar: { modelo.enviar(.sincronizarAhora) },
                    cerrarSesion: { modelo.enviar(.cerrarSesion) }
                )
            }
            .overlay(alignment: .topTrailing) { SelloFrescura(contenido: c) }
        case .sinRed:
            PantallaAviso(titulo: Textos.sinRedTitulo, texto: Textos.sinRedTexto) { botonesSesion }
        case .errorServidor:
            PantallaAviso(titulo: Textos.errorTitulo, texto: Textos.errorTexto) { botonesSesion }
        case .sesionCaducada:
            PantallaAviso(titulo: Textos.caducadaTitulo, texto: Textos.caducadaTexto) {
                Button("Enlazar de nuevo") { modelo.enviar(.reintentar) }
                    .buttonStyle(EstiloFoco(invertido: true))
            }
        }
    }

    private var botonesSesion: some View {
        HStack(spacing: Hueco.s8) {
            Button("Reintentar") { modelo.enviar(.reintentar) }
                .buttonStyle(EstiloFoco(invertido: true))
            Button("Cerrar sesión") { modelo.enviar(.cerrarSesion) }
                .buttonStyle(EstiloFoco())
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
    let datos: DatosTV
    let estadoInicial: String?
    let cuenta: Cuenta
    @State private var pestana: Pestana

    init(datos: DatosTV, pestanaInicial: Pestana, estadoInicial: String?, @ViewBuilder cuenta: () -> Cuenta) {
        self.datos = datos
        self.estadoInicial = estadoInicial
        self.cuenta = cuenta()
        _pestana = State(initialValue: pestanaInicial)
    }

    var body: some View {
        TabView(selection: $pestana) {
            EntrenoPantalla(rutina: datos.rutina, saludActiva: datos.saludActiva, estadoInicial: estadoInicial)
                .tabItem { Text(Pestana.entreno.titulo) }
                .tag(Pestana.entreno)
            ArenaVista(filas: datos.arena, ludus: datos.ludus)
                .tabItem { Text(Pestana.arena.titulo) }
                .tag(Pestana.arena)
            SemanaVista(semana: datos.semana, saludActiva: datos.saludActiva)
                .tabItem { Text(Pestana.semana.titulo) }
                .tag(Pestana.semana)
            cuenta
                .tabItem { Text(Pestana.cuenta.titulo) }
                .tag(Pestana.cuenta)
        }
        .background(Tinta.i0.ignoresSafeArea())
    }
}

/// Deja claro que lo que se ve no es de ahora.
private struct SelloFrescura: View {
    let contenido: Contenido

    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { t in
            if let texto = Textos.frescura(contenido.red, hace: Formato.hace(contenido.sincronizado, ahora: t.date)),
               contenido.red != .sincronizando || t.date.timeIntervalSince(contenido.sincronizado) >= Politica.refrescoMinimoSeg {
                Text(texto)
                    .font(Tipo.rotulo)
                    .foregroundStyle(Tinta.i0)
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

/// Primera carga, sin nada que enseñar todavía.
struct CargandoVista: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Hueco.s8) {
            EncabezadoTV(ceja: "NIVL", titulo: Textos.cargando)
            HuecoCarga().frame(height: 200)
            HStack(spacing: Hueco.s8) {
                HuecoCarga()
                HuecoCarga()
            }
            .frame(height: 360)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Tinta.i0.ignoresSafeArea())
    }
}
