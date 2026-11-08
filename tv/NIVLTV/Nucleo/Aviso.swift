// NIVL TV · Aviso sonoro de fin de descanso.
//
// Usa el mismo sonido que el fin de bloque de FOCUS en la app
// (assets/sonidos/focus/fin.m4a). Se mezcla con lo que suene en el salón.

import AVFoundation

final class Aviso {
    private var reproductor: AVAudioPlayer?

    init() {
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
        if let url = Bundle.main.url(forResource: "fin_descanso", withExtension: "m4a") {
            reproductor = try? AVAudioPlayer(contentsOf: url)
            reproductor?.prepareToPlay()
        }
    }

    func sonar() {
        reproductor?.currentTime = 0
        reproductor?.play()
    }
}
