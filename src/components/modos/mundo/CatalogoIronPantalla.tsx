// NIVL · Mundo IRON: el catálogo como pantalla (pura). Reutiliza CatalogoIron
// de Gimnasio (búsqueda, grupos y lista); aquí elegir un ejercicio abre su
// técnica animada en vez de rellenar un campo.

import { EncabezadoArena, Entrada } from '@/components/arena';
import { CatalogoIron } from '@/components/gym/CatalogoIron';
import { Screen } from '@/components/ui';
import { t } from '@/i18n';

export interface CatalogoIronPantallaProps {
  onVolver: () => void;
  onElegir: (nombre: string) => void;
}

export function CatalogoIronPantalla({ onVolver, onElegir }: CatalogoIronPantallaProps) {
  return (
    <Screen keyboardShouldPersistTaps="handled">
      <Entrada indice={0}>
        <EncabezadoArena
          onVolver={onVolver}
          eyebrow={t('mundos:iron.catalogoEyebrow')}
          titulo={t('mundos:iron.catalogoTitulo')}
          subtitulo={t('mundos:iron.catalogoSub')}
          meandro
        />
      </Entrada>
      <Entrada indice={1}>
        <CatalogoIron actual="" onElegir={onElegir} />
      </Entrada>
    </Screen>
  );
}
