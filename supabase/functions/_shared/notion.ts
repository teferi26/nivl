// NIVL · Espejo de la memoria hacia Notion.
//
// El coach de escritorio (con calendario, PDFs y acceso a los repos) y el del
// móvil deben compartir un solo cerebro. NIVL es la fuente de verdad; esto
// vuelca lo que sabe a la página del CEREBRO para que el otro lo lea.
//
// Opcional por diseño: si no hay secretos configurados no hace nada y nadie se
// entera. Para activarlo:
//   supabase secrets set NOTION_TOKEN=ntn_... NOTION_PAGE_ID=<id de la página>
//
// El token se crea en notion.so/my-integrations y hay que COMPARTIR la página
// con esa integración; si no, Notion responde 404 aunque el token sea válido.

const NOTION_VERSION = '2022-06-28';

function credenciales(): { token: string; pageId: string } | null {
  const token = Deno.env.get('NOTION_TOKEN');
  const pageId = Deno.env.get('NOTION_PAGE_ID');
  if (!token || !pageId) return null;
  return { token, pageId };
}

export function espejoActivo(): boolean {
  return credenciales() !== null;
}

async function notion(path: string, method: string, body?: unknown): Promise<Response> {
  const c = credenciales()!;
  return fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${c.token}`,
      'notion-version': NOTION_VERSION,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Notion corta los bloques de texto en 2000 caracteres. */
function trocear(texto: string, max = 1900): string[] {
  const salida: string[] = [];
  for (const parrafo of texto.split('\n')) {
    if (parrafo.length <= max) {
      salida.push(parrafo);
      continue;
    }
    for (let i = 0; i < parrafo.length; i += max) {
      salida.push(parrafo.slice(i, i + max));
    }
  }
  return salida;
}

function parrafo(texto: string) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [{ type: 'text', text: { content: texto } }] },
  };
}

/**
 * Añade una entrada de log al final de la página del CEREBRO.
 *
 * Se AÑADE, no se reescribe: la página lleva meses de historia escrita por el
 * coach anterior y sobrescribirla sería destruir justamente lo que hace que
 * este sistema valga algo.
 */
export async function espejarEntrada(fecha: string, titulo: string, cuerpo: string): Promise<boolean> {
  if (!espejoActivo()) return false;
  try {
    const c = credenciales()!;
    const bloques = [
      {
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: [{ type: 'text', text: { content: `${fecha} · ${titulo}` } }] },
      },
      ...trocear(cuerpo).filter(Boolean).map(parrafo),
    ];
    const res = await notion(`blocks/${c.pageId}/children`, 'PATCH', { children: bloques });
    if (!res.ok) {
      console.error('notion espejo:', res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    // Que falle el espejo nunca debe tumbar un ritual: es una copia, no la
    // fuente de verdad.
    console.error('notion espejo:', e instanceof Error ? e.message : String(e));
    return false;
  }
}
