// NIVL · Hábitos. La ruta solo junta las piezas (L-RADICAL §C): los datos, los
// efectos y los cerrojos viven en useHabitos; lo que se pinta, en
// HabitosVista (pura, también en la galería /kit/pantallas); la hoja de crear
// y editar (QuestForm) va aparte.

import { HabitosVista } from '@/components/habitos/HabitosVista';
import { useHabitos } from '@/components/habitos/useHabitos';
import { QuestForm } from '@/components/QuestForm';

export default function Habitos() {
  const { vista, hoja } = useHabitos();
  return (
    <>
      <HabitosVista {...vista} />
      <QuestForm
        sustantivo="hábito"
        visible={hoja.visible}
        initial={hoja.initial}
        onClose={hoja.onClose}
        onSubmit={hoja.onSubmit}
        onDelete={hoja.onDelete}
      />
    </>
  );
}
