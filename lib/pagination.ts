// Supabase's 1000-row cap must not silently truncate exports or annual totals.
export async function fetchAll(query: any) {
  const rows: any[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const result = await query.range(offset, offset + pageSize - 1);
    if (result.error) return { data: null, error: result.error };
    const page = result.data || [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}

// Bound URL size for PostgREST IN filters. Each batch still observes row limits.
export async function fetchByIds(ids: string[], query: (ids: string[]) => any) {
  const unique = [...new Set(ids)],
    rows: any[] = [];
  for (let offset = 0; offset < unique.length; offset += 100) {
    const result = await fetchAll(query(unique.slice(offset, offset + 100)));
    if (result.error) return { data: null, error: result.error };
    rows.push(...result.data!);
  }
  return { data: rows, error: null };
}
