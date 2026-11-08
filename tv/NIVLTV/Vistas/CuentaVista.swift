// NIVL TV · La pestaña Cuenta: quién está aquí, cuándo se sincronizó y salir.

import SwiftUI

struct CuentaVista: View {
    let perfil: PerfilTV
    let contenido: Contenido?
    let aviso: String?
    var sincronizar: (() -> Void)?
    var cerrarSesion: (() -> Void)?

    @State private var confirmando = false

    var body: some View {
        let nivel = Juego.nivel(xp: perfil.xpTotal)
        HStack(alignment: .top, spacing: Hueco.s14) {
            VStack(alignment: .leading, spacing: Hueco.s8) {
                EncabezadoTV(ceja: "Cuenta · esta TV", titulo: perfil.nombre)
                Tarjeta(marco: Trazo.frame, relleno: Hueco.s8) {
                    VStack(alignment: .leading, spacing: Hueco.s6) {
                        HStack(spacing: Hueco.s4) {
                            Inscripcion(texto: "Rango \(perfil.rango) · \(perfil.titulo)")
                            if perfil.elite { LaurelElite(tam: 26) }
                        }
                        HStack(spacing: Hueco.s8) {
                            Cifra(rotulo: "Nivel", valor: "\(nivel.nivel)")
                            Cifra(rotulo: "XP total", valor: Formato.miles(perfil.xpTotal))
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: Hueco.s8) {
                if let contenido {
                    TimelineView(.periodic(from: .now, by: 30)) { t in
                        estado(contenido, ahora: t.date)
                    }
                    if let aviso {
                        Text(aviso).font(Tipo.cuerpo).foregroundStyle(Tinta.i9)
                    }
                    Button("Sincronizar ahora") { sincronizar?() }
                        .buttonStyle(EstiloFoco(invertido: true))
                    Button("Cerrar sesión") { confirmando = true }
                        .buttonStyle(EstiloFoco())
                        .accessibilityIdentifier("cerrarSesion")
                } else {
                    Text(Textos.demoCuenta).font(Tipo.cuerpo).foregroundStyle(Tinta.i8)
                }
            }
            .padding(Hueco.s6)
            .frame(width: 760, alignment: .leading)
        }
        .padding(.top, Hueco.bajoPestanas)
        .padding(.bottom, Hueco.s8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .alert(Textos.confirmarCierre, isPresented: $confirmando) {
            // Sin role: .destructive, que el sistema pinta en rojo (paleta solo blanco y negro).
            Button("Cerrar sesión") { cerrarSesion?() }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text(Textos.confirmarCierreTexto)
        }
    }

    private func estado(_ c: Contenido, ahora: Date) -> some View {
        VStack(alignment: .leading, spacing: Hueco.s6) {
            VStack(alignment: .leading, spacing: Hueco.s2) {
                Rotulo(texto: "Última sincronización")
                Text(Formato.hace(c.sincronizado, ahora: ahora).capitalizadaPrimera)
                    .font(Tipo.titular)
                    .foregroundStyle(Tinta.i10)
                if let sello = Textos.frescura(c.red, hace: Formato.hace(c.sincronizado, ahora: ahora)) {
                    Text(sello).font(Tipo.cuerpoSm).foregroundStyle(Tinta.i8)
                }
            }
            VStack(alignment: .leading, spacing: Hueco.s2) {
                Rotulo(texto: "Sesión activa hasta")
                Text(Formato.fechaCorta(c.sesionCaducaEn)).font(Tipo.cuerpo).foregroundStyle(Tinta.i9)
            }
        }
    }
}

private extension String {
    var capitalizadaPrimera: String { prefix(1).uppercased() + dropFirst() }
}
