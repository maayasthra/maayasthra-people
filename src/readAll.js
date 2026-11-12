// Rebuild the query for each page. Advance by the actual server page size,
// so a deployment's API cap cannot silently truncate the result.
export async function readAll(query, message) {
  const rows = [];
  for (;;) {
    const { data, error } = await query().range(rows.length, rows.length + 499);
    if (error) throw new Error(message);
    if (!data.length) return rows;
    rows.push(...data);
  }
}
