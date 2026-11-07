// NIVL · Apple Watch: el día de ejemplo (el mismo que src/watch/demo.ts).
// Solo con el interruptor de demo (`-nivlDemo YES`): sin iPhone ni servidor.

import Foundation

enum Demo {
  static func estado(_ ahora: Date = Date()) -> EstadoReloj {
    let ms = ahora.timeIntervalSince1970 * 1000
    func m(_ id: String, _ titulo: String, _ dif: String, _ premio: Int, unidad: String = "XP", enlace: String? = nil,
           hecha: Bool = false, extra: Bool = false, foto: Bool = false) -> MisionReloj {
      MisionReloj(id: id, titulo: titulo, dificultad: dif, premio: premio, unidad: unidad, enlace: enlace, hecha: hecha,
                  penalizacion: false, extra: extra, requiereFoto: foto, bloqueada: false)
    }
    return EstadoReloj(
      v: VERSION_CONTRATO,
      generadoEn: ms,
      fecha: EstadoReloj.claveHoy(ahora),
      sesion: true,
      misiones: [
        m("demo-1", "Entrenar pierna", "dificil", 110, enlace: "gym"),
        m("demo-2", "Leer 20 páginas", "media", 55),
        m("demo-3", "Foto de la comida", "facil", 28, enlace: "nutricion", foto: true),
        m("demo-4", "Meditar 10 minutos", "facil", 3, unidad: "PB", extra: true),
        m("demo-5", "Despertar a las 6:30", "media", 55, hecha: true),
      ],
      racha: 23,
      rachaCerrada: false,
      nivel: 14,
      xpEnNivel: 3120,
      xpSiguiente: 5238,
      rango: "D",
      titulo: "Gladiador de bronce",
      piedras: 2,
      piedrasMax: 3,
      focus: FocusReloj(fase: "foco", situacion: "en_marcha", finEn: ms + 872_000, restanteMs: 872_000,
                        totalMs: 1_500_000, bloque: 2, cadaLargo: 4),
      iron: IronReloj(ejercicio: "Sentadilla", serie: 3, series: 4, reps: "5", carga: 100, descansoS: 180,
                      siguiente: "Sentadilla")
    )
  }
}
