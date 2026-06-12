/**
 * PostgREST devuelve como máximo 1.000 filas por petición y NO da error al
 * truncar: cualquier query analítica sin paginar calcula sobre datos
 * parciales en silencio. Estos helpers paginan con .range() hasta agotar.
 */

type PageResult<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

const PAGE_SIZE = 1000;

// .in() con listas largas de ids revienta el límite de longitud de URL de
// PostgREST mucho antes que el límite de filas; trocear también los ids.
const ID_CHUNK_SIZE = 150;

/**
 * Trae todas las filas de una query paginando con .range(from, to).
 * El callback debe aplicar `.range(from, to)` a la query que construye.
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

/**
 * Variante para queries con `.in(column, ids)`: trocea los ids y pagina
 * cada trozo. El callback recibe el trozo de ids y el rango de página.
 */
export async function fetchAllRowsByIds<T>(
  ids: readonly string[],
  fetchPage: (idsChunk: string[], from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + ID_CHUNK_SIZE) as string[];
    rows.push(...(await fetchAllRows<T>((from, to) => fetchPage(chunk, from, to))));
  }
  return rows;
}