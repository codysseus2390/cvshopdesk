/** Read every page: PostgREST's row cap must never silently truncate a report. */
export async function readAllRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: null }> {
  const rows: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    const result = await page(from, from + size - 1);
    if (result.error) throw new Error("Unable to load all report records. Please try again.");
    if (!result.data) throw new Error("The report response was incomplete. Please try again.");
    rows.push(...result.data);
    if (result.data.length < size) return { data: rows, error: null };
  }
}
