import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCommittedData, type TableChanges } from '@/hooks/use-committed-data';

export function DatabaseState() {
  const { data, changedCells } = useCommittedData();

  return (
    <Card className="p-4 shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-semibold">Committed Data</h2>
        <Badge variant="outline" className="text-xs">
          What's actually in the database
        </Badge>
      </div>

      <div className="flex gap-6">
        <TableView title="accounts" rows={data.accounts} changes={changedCells.accounts} />
        <TableView title="products" rows={data.products} changes={changedCells.products} />
      </div>
    </Card>
  );
}

interface TableViewProps {
  title: string;
  rows: Record<string, unknown>[];
  changes?: TableChanges;
}

function getRowId(row: Record<string, unknown>): string {
  return String(row['id'] ?? JSON.stringify(row));
}

function TableView({ title, rows, changes }: TableViewProps) {
  if (rows.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium text-zinc-400 mb-2">{title}</h3>
        <p className="text-sm text-zinc-500">No data</p>
      </div>
    );
  }

  const columns = Object.keys(rows[0]);

  return (
    <div>
      <h3 className="text-sm font-medium text-zinc-400 mb-2">{title}</h3>
      <div className="border border-zinc-800 rounded overflow-hidden">
        <table className="text-sm">
          <thead className="bg-zinc-800">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-3 py-1.5 text-left font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowId = getRowId(row);
              const rowChanges = changes?.[rowId];
              const isNewRow = rowChanges && rowChanges.size === columns.length;

              return (
                <tr
                  key={rowId}
                  className={`border-t border-zinc-800 transition-colors duration-300 ${
                    isNewRow ? 'bg-green-950' : ''
                  }`}
                >
                  {columns.map((col) => {
                    const isChanged = rowChanges?.has(col) && !isNewRow;
                    return (
                      <td
                        key={col}
                        className={`px-3 py-1.5 transition-colors duration-300 ${
                          isChanged ? 'bg-yellow-900/50 text-yellow-200' : ''
                        }`}
                      >
                        {String(row[col] ?? 'NULL')}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
