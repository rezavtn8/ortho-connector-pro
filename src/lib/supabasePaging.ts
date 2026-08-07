/**
 * PostgREST caps every response at 1000 rows by default, and it does so *silently* —
 * you get 1000 rows and no error. For `monthly_patients` that ceiling is reached at
 * roughly 42 offices × 24 months, after which referral history is quietly truncated:
 * lifetime totals read low and the map's month scrubber shows phantom empty months.
 *
 * Any query that can exceed 1000 rows must go through `fetchAllRows`.
 */

const PAGE_SIZE = 1000;

/**
 * Page through a Supabase query until a short page comes back.
 *
 * `build` must return a *fresh* query builder on each call — Supabase builders are
 * thenable and single-use, so reusing one across pages silently returns page 1 forever.
 *
 * @example
 *   const rows = await fetchAllRows<MonthlyRow>(() =>
 *     supabase.from('monthly_patients').select('source_id, year_month, patient_count')
 *   );
 */
export async function fetchAllRows<T>(
  build: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }> & {
    range: (from: number, to: number) => PromiseLike<{
      data: T[] | null;
      error: { message: string } | null;
    }>;
  },
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const out: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;

    const page = data ?? [];
    out.push(...page);

    if (page.length < pageSize) return out;
  }
}
