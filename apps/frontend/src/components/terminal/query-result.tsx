import type { QueryResult, QueryError } from '@isolation-demo/shared';

interface QueryResultProps {
  result: QueryResult | null;
  error: QueryError | null;
}

function getRowKey(row: Record<string, unknown>, index: number): string {
  if ('id' in row && row.id != null) {
    return String(row.id);
  }
  return `row-${index}`;
}

export function QueryResultView({ result, error }: QueryResultProps) {
  if (error) {
    return (
      <div className="p-3 bg-red-950 border border-red-900 rounded text-red-400 text-sm">
        {error.message}
        {error.detail && <div className="mt-1 text-red-500">{error.detail}</div>}
      </div>
    );
  }

  if (!result) {
    return <div className="p-3 text-zinc-500 text-sm">Run a query to see results</div>;
  }

  if (result.rows.length === 0) {
    return (
      <div className="p-3 text-zinc-400 text-sm">
        Query executed successfully. No rows returned.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto border border-zinc-800 rounded">
      <table className="w-full text-sm">
        <thead className="bg-zinc-800 sticky top-0">
          <tr>
            {result.fields.map((field) => (
              <th key={field.name} className="px-3 py-2 text-left font-medium">
                {field.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={getRowKey(row, i)} className="border-t border-zinc-800">
              {result.fields.map((field) => (
                <td key={field.name} className="px-3 py-2">
                  {String(row[field.name] ?? 'NULL')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
