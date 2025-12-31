import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, RotateCcw } from 'lucide-react';
import { useCommittedData, type TableChanges } from '@/hooks/use-committed-data';

interface DatabaseStateProps {
  onReset?: () => void;
  isResetting?: boolean;
}

export function DatabaseState({ onReset, isResetting }: DatabaseStateProps) {
  const { data, changedCells } = useCommittedData();

  return (
    <Card className="p-4 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-medium text-zinc-400">Committed Data</h2>
          <span className="text-xs text-zinc-600">— what's actually in the database</span>
        </div>
        {onReset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={isResetting}
            className="h-7 text-xs text-zinc-500 hover:text-zinc-300"
          >
            <RotateCcw className={`w-3 h-3 mr-1.5 ${isResetting ? 'animate-spin' : ''}`} />
            Reset
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-6">
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
        <h3 className="text-xs font-medium text-zinc-500 mb-1.5">{title}</h3>
        <p className="text-xs text-zinc-600">No data</p>
      </div>
    );
  }

  const columns = Object.keys(rows[0]);

  return (
    <div>
      <h3 className="text-xs font-medium text-zinc-500 mb-1.5">{title}</h3>
      <div className="border border-zinc-800 rounded overflow-hidden">
        <table className="text-xs">
          <thead className="bg-zinc-800/50">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-2 py-1 text-left font-medium text-zinc-400">
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
                  className={`border-t border-zinc-800/50 transition-colors duration-300 ${
                    isNewRow ? 'bg-green-950/50' : ''
                  }`}
                >
                  {columns.map((col) => {
                    const isChanged = rowChanges?.has(col) && !isNewRow;
                    return (
                      <td
                        key={col}
                        className={`px-2 py-1 font-mono transition-colors duration-300 ${
                          isChanged ? 'bg-yellow-900/40 text-yellow-200' : 'text-zinc-300'
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
