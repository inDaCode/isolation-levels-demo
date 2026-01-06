import type { TerminalId } from '@isolation-demo/shared';
import type { UncommittedData } from '@/stores/session-store';

export interface PendingChange {
  terminalId: TerminalId;
  newValue: unknown;
}

export interface PendingInsert {
  terminalId: TerminalId;
  row: Record<string, unknown>;
}

export interface PendingChangesResult {
  cellChanges: Map<string, Map<string, PendingChange[]>>;
  pendingInserts: PendingInsert[];
  pendingDeletes: Map<string, TerminalId[]>;
}

function getRowId(row: Record<string, unknown>): string {
  return String(row['id'] ?? JSON.stringify(row));
}

export { getRowId };

export function computePendingChanges(
  committedRows: Record<string, unknown>[],
  uncommitted: UncommittedData,
  tableName: 'accounts' | 'products',
): PendingChangesResult {
  const cellChanges = new Map<string, Map<string, PendingChange[]>>();
  const pendingInserts: PendingInsert[] = [];
  const pendingDeletes = new Map<string, TerminalId[]>();

  const committedIds = new Set(committedRows.map(getRowId));
  const committedMap = new Map(committedRows.map((r) => [getRowId(r), r]));

  for (const terminalId of [1, 2, 3] as TerminalId[]) {
    const terminalData = uncommitted[terminalId];
    if (!terminalData) continue;

    const uncommittedRows = terminalData.tables[tableName];
    const modifiedRowIds = new Set(terminalData.modifiedRows[tableName]);
    const uncommittedIds = new Set(uncommittedRows.map(getRowId));

    // Find deletes: row was modified by this terminal and not in uncommitted
    for (const rowId of committedIds) {
      if (modifiedRowIds.has(rowId) && !uncommittedIds.has(rowId)) {
        const existing = pendingDeletes.get(rowId) ?? [];
        existing.push(terminalId);
        pendingDeletes.set(rowId, existing);
      }
    }

    // Find inserts: row was modified by this terminal and not in committed
    for (const row of uncommittedRows) {
      const rowId = getRowId(row);
      if (modifiedRowIds.has(rowId) && !committedIds.has(rowId)) {
        pendingInserts.push({ terminalId, row });
      }
    }

    // Find updates: row was modified by this terminal and values differ
    for (const row of uncommittedRows) {
      const rowId = getRowId(row);
      if (!modifiedRowIds.has(rowId)) continue;

      const committed = committedMap.get(rowId);
      if (!committed) continue;

      for (const col of Object.keys(row)) {
        if (JSON.stringify(committed[col]) !== JSON.stringify(row[col])) {
          if (!cellChanges.has(rowId)) {
            cellChanges.set(rowId, new Map());
          }
          const rowChanges = cellChanges.get(rowId)!;
          if (!rowChanges.has(col)) {
            rowChanges.set(col, []);
          }
          rowChanges.get(col)!.push({
            terminalId,
            newValue: row[col],
          });
        }
      }
    }
  }

  return { cellChanges, pendingInserts, pendingDeletes };
}
