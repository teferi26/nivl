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

  // MARK: - Entreno (`-nivlPagina enmarcha|resumen`, y `-nivlDeporte` para las métricas de cada uno)

  enum PantallaEntreno { case enMarcha, resumen }

  static var pantallaEntreno: PantallaEntreno? {
    switch UserDefaults.standard.string(forKey: "nivlPagina") {
    case "enmarcha": return .enMarcha
    case "resumen": return .resumen
    default: return nil
    }
  }

  static func metricasEntreno() -> MetricasEntreno {
    let deporte: DeporteReloj
    switch UserDefaults.standard.string(forKey: "nivlDeporte") {
    case "bici": deporte = .bici
    case "piscina": deporte = .piscina
    case "aguas": deporte = .aguasAbiertas
    case "fuerza": deporte = .fuerza
    default: deporte = .carrera
    }
    let nado = deporte == .piscina || deporte == .aguasAbiertas
    var m = MetricasEntreno(deporte: deporte)
    m.duracion_s = 1934
    m.distancia_m = deporte == .fuerza ? nil : (nado ? 1250 : 6420)
    m.ritmo_s_km = deporte == .fuerza ? nil : (nado ? 1548 : 301)
    m.velocidad_kmh = deporte == .bici ? 27.4 : nil
    m.fc = 152
    m.fc_media = 147
    m.kcal = 412
    if deporte == .piscina { m.largos = 50 }
    m.parcialActual = nado || deporte == .fuerza ? 0 : 7
    m.gpsActivo = deporte != .aguasAbiertas
    return m
  }

  /// Por JSON a propósito: es el mismo contrato que viaja al iPhone
  /// (src/lib/entrenoMedido.ts), con datos inventados.
  static func resumenEntreno() -> EntrenoMedido? {
    let json = """
    {"origen":"watch","externo_id":"demo-entreno","deporte":"carrera",
     "inicio":"2026-01-05T07:00:00Z","fin":"2026-01-05T07:32:14Z","duracion_s":1934,
     "distancia_m":6420,"kcal":412,"fc_media":147,"fc_max":171,"desnivel_m":58,
     "ruta":null,"largo_piscina_m":null,"fc_serie":null,
     "parciales":[
       {"n":1,"tipo":"km","distancia_m":1000,"duracion_s":305,"fc_media":138,"desnivel_m":9},
       {"n":2,"tipo":"km","distancia_m":1000,"duracion_s":298,"fc_media":146,"desnivel_m":12},
       {"n":3,"tipo":"km","distancia_m":1000,"duracion_s":301,"fc_media":150,"desnivel_m":7}
     ]}
    """
    return try? JSONDecoder().decode(EntrenoMedido.self, from: Data(json.utf8))
  }
}
