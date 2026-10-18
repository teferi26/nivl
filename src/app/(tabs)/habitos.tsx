// NIVL · Hábitos. La ruta solo junta las piezas (L-RADICAL §C): los datos, los
// efectos y los cerrojos viven en useHabitos; lo que se pinta, en
// HabitosVista (pura, también en la galería /kit/pantallas); la hoja de crear
// y editar (QuestForm) va aparte. Modos F1: con `modos_activos` encendido, la
// hoja lleva las etiquetas de modo (opcionesEtiquetas).

import { HabitosVista } from '@/components/habitos/HabitosVista';
import { useHabitos } from '@/components/habitos/useHabitos';
import { QuestForm } from '@/components/QuestForm';
import { opcionesEtiquetas, useModo } from '@/modos';

export default function Habitos() {
  const { vista, hoja } = useHabitos();
  const modos = useModo();
  return (
    <>
      <HabitosVista {...vista} />
      <QuestForm
        // i18n-ok: valor de la prop (un identificador), no un texto
        sustantivo="hábito"
        visible={hoja.visible}
        initial={hoja.initial}
        onClose={hoja.onClose}
        onSubmit={hoja.onSubmit}
        onDelete={hoja.onDelete}
        modos={modos.activo ? opcionesEtiquetas(modos.activados, modos.modo) : null}
      />
    </>
  );
}
