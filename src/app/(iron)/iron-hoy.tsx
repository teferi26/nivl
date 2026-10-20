// NIVL · Mundo IRON: el inicio (entreno de hoy, pesos y récords, rutinas,
// catálogo, dieta y coach). Los efectos en useIronHoy; lo que se pinta, en
// IronHoyVista. Con la sesión en marcha se pinta Gimnasio entero (el mismo
// useGym: la tabla de series, terminar y pagar). Datos de salud: guarda `gym`.
import { HealthConsentGuard } from '@/components/ConsentimientoSalud';
import { GymVista } from '@/components/gym/GymVista';
import { EmblemaMundo } from '@/components/modos/EmblemaMundo';
import { CabeceraMundo } from '@/components/modos/mundo/CabeceraMundo';
import { IronHoyVista } from '@/components/modos/mundo/IronHoyVista';
import { useIronHoy } from '@/components/modos/mundo/useIronHoy';

export default function IronHoy() {
  return (
    <HealthConsentGuard routeName="gym">
      <Contenido />
    </HealthConsentGuard>
  );
}

function Contenido() {
  const { gym, mundo, fecha, cierre, pesos, dieta, acciones } = useIronHoy();
  const v = gym.vista;
  if (v.entrenando) return <GymVista {...v} acciones={{ ...v.acciones, onVolver: undefined }} />;
  return (
    <IronHoyVista
      cabecera={<CabeceraMundo modo="iron" nivel={mundo.nivel} emblema={<EmblemaMundo modo="iron" />} />}
      fecha={fecha}
      cierre={cierre}
      entreno={{
        cargado: v.cargado,
        errorCarga: v.errorCarga,
        hoyDia: v.hoyDia,
        dias: v.dias,
        ejercicios: v.ejercicios,
        sesionHoy: v.sesionHoy,
        xpMisionHoy: v.xpMisionHoy,
        tecnicaDe: v.tecnicaDe,
        onEmpezar: v.acciones.onEntrenar,
        onReintentar: v.acciones.onReintentar,
      }}
      pesos={pesos}
      dieta={dieta}
      acciones={acciones}
    />
  );
}
