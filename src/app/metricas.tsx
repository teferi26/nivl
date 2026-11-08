// NIVL · Métricas y opiniones. Pantalla oculta: solo se llega desde Perfil o
// desde Moderación si la cuenta es admin. La ruta solo junta las piezas.

import { MetricasVista } from '@/components/metricas/MetricasVista';
import { useMetricas } from '@/components/metricas/useMetricas';

export default function MetricasAdmin() {
  const props = useMetricas();
  return <MetricasVista {...props} />;
}
