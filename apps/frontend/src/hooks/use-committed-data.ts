import { useState, useEffect, useRef } from 'react';
import { socket } from '@/lib/socket-client';
import { WS_EVENTS, type CommittedDataEvent } from '@isolation-demo/shared';

interface CommittedData {
  accounts: Record<string, unknown>[];
  products: Record<string, unknown>[];
}

type TableName = keyof CommittedData;

// { rowId: Set<columnName> }
export type TableChanges = Record<string, Set<string>>;
type ChangedCells = Partial<Record<TableName, TableChanges>>;

const HIGHLIGHT_DURATION_MS = 2000;

function getRowId(row: Record<string, unknown>): string {
  if ('id' in row && row.id != null) {
    return String(row.id);
  }
  return JSON.stringify(row);
}

function detectChanges(
  prevRows: Record<string, unknown>[],
  newRows: Record<string, unknown>[],
): TableChanges {
  const changes: TableChanges = {};
  const prevMap = new Map(prevRows.map((r) => [getRowId(r), r]));

  for (const row of newRows) {
    const id = getRowId(row);
    const prev = prevMap.get(id);

    if (!prev) {
      // New row — all columns changed
      changes[id] = new Set(Object.keys(row));
    } else {
      // Check each column
      const changedCols = Object.keys(row).filter(
        (col) => JSON.stringify(prev[col]) !== JSON.stringify(row[col]),
      );
      if (changedCols.length > 0) {
        changes[id] = new Set(changedCols);
      }
    }
  }

  return changes;
}

interface UseCommittedDataReturn {
  data: CommittedData;
  changedCells: ChangedCells;
}

export function useCommittedData(): UseCommittedDataReturn {
  const [data, setData] = useState<CommittedData>({ accounts: [], products: [] });
  const [changedCells, setChangedCells] = useState<ChangedCells>({});
  const prevDataRef = useRef<CommittedData>({ accounts: [], products: [] });
  const highlightTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const scheduleHighlightClear = () => {
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = window.setTimeout(() => {
        setChangedCells({});
      }, HIGHLIGHT_DURATION_MS);
    };

    const handleDataCommitted = (event: CommittedDataEvent) => {
      const table = event.table as TableName;

      const changes = detectChanges(prevDataRef.current[table], event.rows);

      prevDataRef.current = { ...prevDataRef.current, [table]: event.rows };
      setData(prevDataRef.current);

      if (Object.keys(changes).length > 0) {
        setChangedCells((prev) => ({ ...prev, [table]: changes }));
        scheduleHighlightClear();
      }
    };

    socket.on(WS_EVENTS.DATA_COMMITTED, handleDataCommitted);

    // Fetch initial data
    Promise.all([
      socket.emitWithAck(WS_EVENTS.DATA_GET_COMMITTED, { table: 'accounts' }),
      socket.emitWithAck(WS_EVENTS.DATA_GET_COMMITTED, { table: 'products' }),
    ]).then((responses) => {
      const [accountsRes, productsRes] = responses as CommittedDataEvent[];
      const initial = [
        { table: 'accounts' as TableName, rows: accountsRes.rows },
        { table: 'products' as TableName, rows: productsRes.rows },
      ].reduce((acc, { table, rows }) => ({ ...acc, [table]: rows }), {
        accounts: [],
        products: [],
      } as CommittedData);
      prevDataRef.current = initial;
      setData(initial);
    });

    return () => {
      socket.off(WS_EVENTS.DATA_COMMITTED, handleDataCommitted);
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  return { data, changedCells };
}
