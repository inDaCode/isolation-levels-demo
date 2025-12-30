import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCommittedData } from '@/hooks/use-committed-data';

export function DatabaseState() {
  const { data } = useCommittedData();

  return (
    <Card className="p-4 shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-semibold">Committed Data</h2>
        <Badge variant="outline" className="text-xs">
          What's actually in the database
        </Badge>
      </div>

      <div className="flex gap-6">
        <TableView title="accounts" rows={data.accounts} />
        <TableView title="products" rows={data.products} />
      </div>
    </Card>
  );
}

interface TableViewProps {
  title: string;
  rows: Record<string, unknown>[];
}

function TableView({ title, rows }: TableViewProps) {
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
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-zinc-800">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-1.5">
                    {String(row[col] ?? 'NULL')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
