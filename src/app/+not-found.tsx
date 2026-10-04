import { router } from 'expo-router';
import { FueraDeLaArena } from '@/components/acceso/Arranque';

// Deep link inválido / ruta vieja: mantiene la identidad oscura en vez del 404
// claro por defecto de expo-router. Lo que se ve está en FueraDeLaArena.
export default function NotFound() {
  return <FueraDeLaArena onVolver={() => router.replace('/')} />;
}
