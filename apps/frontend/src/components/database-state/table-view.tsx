import type { TableChanges } from '@/hooks/use-committed-data';
import type { UncommittedData } from '@/stores/session-store';
import { TERMINAL_COLORS } from './constants';
import { computePendingChanges, getRowId } from './pending-changes';

interface TableViewProps {
  title: 'accounts' | 'products';
  rows: Record<string, unknown>[];
  changes?: TableChanges;
  uncommitted: UncommittedData;
}

export function TableView({ title, rows, changes, uncommitted }: TableViewProps) {
  const { cellChanges, pendingInserts, pendingDeletes } = computePendingChanges(
    rows,
    uncommitted,
    title,
  );

  if (rows.length === 0 && pendingInserts.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-medium text-zinc-500 mb-1.5">{title}</h3>
        <p className="text-xs text-zinc-600">No data</p>
      </div>
    );
  }

  const columns =
    rows.length > 0
      ? Object.keys(rows[0])
      : pendingInserts.length > 0
        ? Object.keys(pendingInserts[0].row)
        : [];

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
              const rowPendingChanges = cellChanges.get(rowId);
              const deleteTerminals = pendingDeletes.get(rowId);
              const isDeleted = deleteTerminals && deleteTerminals.length > 0;

              return (
                <tr
                  key={rowId}
                  className={`border-t border-zinc-800/50 transition-colors duration-300 ${
                    isNewRow ? 'bg-green-950/50' : ''
                  } ${isDeleted ? 'opacity-50' : ''}`}
                >
                  {columns.map((col) => {
                    const isChanged = rowChanges?.has(col) && !isNewRow;
                    const pendingForCell = rowPendingChanges?.get(col);
                    const committedValue = String(row[col] ?? 'NULL');

                    return (
                      <td
                        key={col}
                        className={`px-2 py-1 font-mono transition-colors duration-300 ${
                          isChanged ? 'bg-yellow-900/40 text-yellow-200' : 'text-zinc-300'
                        } ${isDeleted ? 'line-through' : ''}`}
                      >
                        <span>{committedValue}</span>
                        {pendingForCell?.map((change, i) => (
                          <span
                            key={i}
                            className={`ml-1 ${TERMINAL_COLORS[change.terminalId].text}`}
                          >
                            → {String(change.newValue ?? 'NULL')}
                            <span className="text-[10px] ml-0.5 opacity-70">
                              ({TERMINAL_COLORS[change.terminalId].label})
                            </span>
                          </span>
                        ))}
                        {isDeleted && (
                          <span className="ml-1 text-red-400">
                            → ∅
                            <span className="text-[10px] ml-0.5 opacity-70">
                              ({deleteTerminals.map((t) => TERMINAL_COLORS[t].label).join(', ')})
                            </span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {pendingInserts.map(({ terminalId, row }, i) => (
              <tr
                key={`insert-${i}`}
                className={`border-t border-zinc-800/50 ${TERMINAL_COLORS[terminalId].bg}`}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className={`px-2 py-1 font-mono ${TERMINAL_COLORS[terminalId].text}`}
                  >
                    {String(row[col] ?? 'NULL')}
                    <span className="text-[10px] ml-1 opacity-70">
                      ({TERMINAL_COLORS[terminalId].label})
                    </span>
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
