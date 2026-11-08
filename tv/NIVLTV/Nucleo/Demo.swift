// NIVL TV · Datos de demostración (como los demo.tsx de la app).
//
// Solo existe en Debug o en simulador y solo se enseña con `-nivlDemo 1`: en
// Release para aparato este código no se compila. No usa red, Llavero ni
// caché. Los nombres son inventados. Ninguna cadena lleva guion largo (lo
// comprueba DemoTests).

#if DEBUG || targetEnvironment(simulator)

import Foundation

enum Demo {
    static let datos = DatosTV(
        perfil: PerfilTV(nombre: "Ana V.", titulo: "Campeón", rango: "B", xpTotal: 38_450, elite: true),
        saludActiva: true,
        rutina: rutina,
        arena: arena,
        ludus: ludus,
        semana: semana
    )

    /// Los estados que no se ven con la cuenta llena, para capturas (`-variante`).
    static func datos(variante: String?) -> DatosTV {
        let d = datos
        switch variante {
        case "sinfilas":
            // friends_board da siempre tu fila; esto prueba la red de seguridad de la vista.
            return DatosTV(perfil: d.perfil, saludActiva: true, rutina: nil, arena: [], ludus: nil, semana: d.semana)
        case "vacia":
            return DatosTV(
                perfil: PerfilTV(nombre: "Tito N.", titulo: "Tiro", rango: "E", xpTotal: 0, elite: false),
                saludActiva: true, rutina: nil,
                arena: [FilaArena(id: "yo", soyYo: true, nombre: "Tito N.", titulo: "Tiro", rango: "E",
                                  xpTotal: 0, xpVentana: 0, racha: 0, cumplimientoPct: nil, elite: false)],
                ludus: nil, semana: semanaVacia
            )
        case "sinsalud":
            return DatosTV(perfil: d.perfil, saludActiva: false, rutina: nil, arena: d.arena, ludus: d.ludus, semana: semanaSinPeso)
        case "descanso":
            return DatosTV(perfil: d.perfil, saludActiva: true, rutina: nil, arena: d.arena, ludus: d.ludus, semana: d.semana,
                           proxima: ProximaSesion(nombre: "Pierna · fuerza", diaSemana: 4, enDias: 1, ejercicios: 6))
        case "real":
            return DatosTV(perfil: d.perfil, saludActiva: true, rutina: rutinaComoLaReal, arena: d.arena, ludus: d.ludus, semana: d.semana)
        case "larga":
            return DatosTV(perfil: d.perfil, saludActiva: true, rutina: rutinaComoLaReal, arena: arenaLarga, ludus: ludusLleno, semana: d.semana)
        default:
            return d
        }
    }

    /// Lo que llega del servidor: sin figura ni técnica, descanso fijo, cargas que faltan.
    static let rutinaComoLaReal = RutinaTV(
        nombre: "Torso fuerza",
        dia: "Martes · rutina semanal",
        ejercicios: [
            ("Press de banca con barra en banco inclinado a treinta grados", 4, "6", 80.0),
            ("Remo con barra", 4, "8 a 10", 70.0),
            ("Press militar", 3, "10", 42.5),
            ("Dominadas", 3, "AMRAP", nil),
            ("Fondos en paralelas", 3, "12", nil),
            ("Curl martillo", 3, "12", 14.0),
            ("Extensión de tríceps", 3, "15", 25.0),
            ("Facepull", 3, "15", 20.0),
            ("Plancha", 2, "", nil),
        ].enumerated().map { i, e in
            EjercicioTV(id: "r\(i)", nombre: e.0, series: e.1, reps: e.2, cargaKg: e.3, descansoSeg: 90,
                        figura: nil, musculos: [], tecnica: [])
        }
    )

    /// 200 filas con nombres imposibles; tú, en la 137.
    static let arenaLarga: [FilaArena] = (1...200).map { i in
        let yo = i == 137
        return FilaArena(
            id: "f\(i)", soyYo: yo,
            nombre: yo ? "Ana V." : (i % 3 == 0 ? "Maximiliano Constantino de la Santísima Trinidad \(i)" : "Gladiador \(i)"),
            titulo: i % 4 == 0 ? "Héroe de la arena con título equipado larguísimo" : "Veterano",
            rango: ["S", "A", "B", "C", "D", "E"][min(5, i / 40)],
            xpTotal: 1_250_000 - i * 5_000, xpVentana: max(0, 123_456 - i * 700), racha: max(0, 365 - i * 2),
            cumplimientoPct: i % 5 == 0 ? nil : max(0, 100 - i / 3), elite: i % 7 == 0
        )
    }

    static let ludusLleno = LudusTV(
        nombre: "Ludus de la Gran Capua y sus alrededores",
        miembros: (0..<8).map { i in
            FilaLudus(id: "l\(i)", nombre: i == 2 ? "Ana V." : "Miembro con nombre muy largo \(i)", xpVentana: 1_000 + i * 310,
                      cumplimientoPct: i == 5 ? nil : 90 - i, soyYo: i == 2)
        }
    )

    static let semanaVacia = SemanaTV(
        racha: 0, piedras: 0, piedrasMax: 3, xpGanado: 0, hechas: 0, falladas: 0,
        dias: ["L", "M", "X", "J", "V", "S", "D"].map { DiaSemana(id: $0, inicial: $0, hechas: 0, falladas: 0) },
        mapa: Array(repeating: Array(repeating: 0, count: 7), count: 12),
        pesos: [], tendenciaKgSemana: nil, tendenciaInicio: nil, tendenciaFin: nil, lectura: nil
    )

    static let semanaSinPeso = SemanaTV(
        racha: semana.racha, piedras: semana.piedras, piedrasMax: semana.piedrasMax, xpGanado: semana.xpGanado,
        hechas: semana.hechas, falladas: semana.falladas, dias: semana.dias, mapa: semana.mapa,
        pesos: [], tendenciaKgSemana: nil, tendenciaInicio: nil, tendenciaFin: nil, lectura: nil
    )

    static let rutina = RutinaTV(
        nombre: "TORSO · FUERZA",
        dia: "Martes · semana 3 de la campaña",
        ejercicios: [
            EjercicioTV(
                id: "press-banca",
                nombre: "Press de banca",
                series: 4,
                reps: "6",
                cargaKg: 80,
                descansoSeg: 150,
                figura: "figure.strengthtraining.traditional",
                musculos: ["Pectoral", "Tríceps", "Deltoide anterior"],
                tecnica: [
                    "Escápulas juntas y abajo",
                    "Barra al esternón, codos a 45°",
                    "Pies firmes, empuja el suelo",
                ]
            ),
            EjercicioTV(
                id: "remo-barra",
                nombre: "Remo con barra",
                series: 4,
                reps: "8",
                cargaKg: 70,
                descansoSeg: 120,
                figura: "figure.rower",
                musculos: ["Dorsal", "Romboides", "Bíceps"],
                tecnica: [
                    "Bisagra de cadera, espalda neutra",
                    "Tira con los codos hacia la cadera",
                    "Baja controlando dos segundos",
                ]
            ),
            EjercicioTV(
                id: "press-militar",
                nombre: "Press militar",
                series: 3,
                reps: "8 a 10",
                cargaKg: 42.5,
                descansoSeg: 90,
                figura: "figure.arms.open",
                musculos: ["Deltoide", "Tríceps"],
                tecnica: [
                    "Glúteo y abdomen apretados",
                    "La cabeza pasa bajo la barra",
                    "Bloquea arriba sin arquear",
                ]
            ),
            EjercicioTV(
                id: "dominadas",
                nombre: "Dominadas",
                series: 3,
                reps: "Al fallo menos 2",
                cargaKg: nil,
                descansoSeg: 90,
                figura: "figure.climbing",
                musculos: ["Dorsal", "Bíceps", "Core"],
                tecnica: [
                    "Arranca colgado, hombros activos",
                    "Pecho a la barra",
                    "Sin balanceo",
                ]
            ),
        ]
    )

    static let arena: [FilaArena] = [
        FilaArena(id: "1", soyYo: false, nombre: "Lucía M.", titulo: "Campeón", rango: "B", xpTotal: 61_200, xpVentana: 2_310, racha: 41, cumplimientoPct: 96, elite: true),
        FilaArena(id: "2", soyYo: true, nombre: "Ana V.", titulo: "Campeón", rango: "B", xpTotal: 38_450, xpVentana: 1_840, racha: 23, cumplimientoPct: 89, elite: true),
        FilaArena(id: "3", soyYo: false, nombre: "Diego R.", titulo: "Veterano", rango: "C", xpTotal: 22_900, xpVentana: 1_620, racha: 12, cumplimientoPct: 84, elite: false),
        FilaArena(id: "4", soyYo: false, nombre: "Marta G.", titulo: "Veterano", rango: "C", xpTotal: 19_300, xpVentana: 1_405, racha: 9, cumplimientoPct: 78, elite: true),
        FilaArena(id: "5", soyYo: false, nombre: "Álex P.", titulo: "Gladiador", rango: "D", xpTotal: 8_700, xpVentana: 990, racha: 5, cumplimientoPct: 71, elite: false),
        FilaArena(id: "6", soyYo: false, nombre: "Sara T.", titulo: "Gladiador", rango: "D", xpTotal: 4_100, xpVentana: 610, racha: 3, cumplimientoPct: 64, elite: false),
        FilaArena(id: "7", soyYo: false, nombre: "Hugo L.", titulo: "Tiro", rango: "E", xpTotal: 950, xpVentana: 240, racha: 1, cumplimientoPct: 40, elite: false),
    ]

    static let ludus = LudusTV(
        nombre: "LUDUS CAPUA",
        miembros: [
            // Sin orden por puntos (0026): el ludus va por nombre.
            FilaLudus(id: "d", nombre: "Iván S.", xpVentana: 1_220, cumplimientoPct: 75, soyYo: false),
            FilaLudus(id: "b", nombre: "Ana V.", xpVentana: 1_840, cumplimientoPct: 89, soyYo: true),
            FilaLudus(id: "a", nombre: "Lucía M.", xpVentana: 2_310, cumplimientoPct: 96, soyYo: false),
            FilaLudus(id: "c", nombre: "Marta G.", xpVentana: 1_405, cumplimientoPct: 78, soyYo: false),
            FilaLudus(id: "e", nombre: "Nora B.", xpVentana: 1_010, cumplimientoPct: 70, soyYo: false),
        ]
    )

    static let semana: SemanaTV = {
        let iniciales = ["L", "M", "X", "J", "V", "S", "D"]
        let hechas = [5, 6, 4, 5, 6, 3, 2]
        let falladas = [0, 0, 1, 0, 0, 2, 1]
        let dias = iniciales.indices.map {
            DiaSemana(id: iniciales[$0], inicial: iniciales[$0], hechas: hechas[$0], falladas: falladas[$0])
        }
        // 12 semanas fijas (sin aleatorio: las capturas salen iguales).
        let patron: [Double] = [1, 0.8, 0.6, 1, 0.9, 0.4, 0.2, 0.7, 1, 0.5, 0.8, 1, 0.6, 0.3]
        let mapa: [[Double]] = (0..<12).map { s in
            (0..<7).map { d in
                let base = patron[(s * 3 + d) % patron.count]
                return min(1, base * (0.55 + Double(s) * 0.045))
            }
        }
        let kilos: [Double] = [84.6, 84.4, 84.7, 84.2, 84.0, 84.1, 83.8, 83.9, 83.5, 83.6, 83.2, 83.3, 83.0, 82.9]
        let pesos = kilos.indices.map { PuntoPeso(id: $0, dia: $0 * 2, kg: kilos[$0]) }
        return SemanaTV(
            racha: 23,
            piedras: 2,
            piedrasMax: 3,
            xpGanado: 1_840,
            hechas: hechas.reduce(0, +),
            falladas: falladas.reduce(0, +),
            dias: dias,
            mapa: mapa,
            pesos: pesos,
            tendenciaKgSemana: -0.43,
            tendenciaInicio: 84.62,
            tendenciaFin: 82.93,
            lectura: "Bajas a un ritmo sostenible. Mantén la proteína y el volumen de fuerza."
        )
    }()

    /// Todas las cadenas visibles de la demo, para el test de guiones.
    static var textos: [String] {
        var t: [String] = [rutina.nombre, rutina.dia, ludus.nombre, semana.lectura ?? ""]
        for e in rutina.ejercicios { t += [e.nombre, e.reps] + e.musculos + e.tecnica }
        for f in arena { t += [f.nombre, f.titulo] }
        for m in ludus.miembros + ludusLleno.miembros { t.append(m.nombre) }
        t.append(ludusLleno.nombre)
        for e in rutinaComoLaReal.ejercicios { t += [e.nombre, e.reps] }
        for f in arenaLarga.prefix(8) { t += [f.nombre, f.titulo] }
        return t
    }
}

#endif
