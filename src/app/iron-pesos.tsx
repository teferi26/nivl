// NIVL · Mundo IRON: «Pesos» ya no es una pestaña; vive en Entreno (con
// Rutinas y Cardio). Esta ruta queda fuera del grupo `(iron)` para que no salga
// en la barra y solo redirige: los enlaces viejos a /iron-pesos siguen valiendo.
import { Redirect } from 'expo-router';

export default function IronPesos() {
  return <Redirect href={{ pathname: '/iron-rutinas', params: { vista: 'pesos' } }} />;
}
