import { useState, useEffect, useRef } from 'react';
import { socket } from '@/lib/socket-client';
import { WS_EVENTS, type CommittedDataEvent } from '@isolation-demo/shared';

interface CommittedData {
  accounts: Record<string, unknown>[];
  products: Record<string, unknown>[];
}

// { rowId: Set<columnName> }
export type TableChanges = Record<string, Set<string>>;
type ChangedCells = Partial<Record<keyof CommittedData, TableChanges>>;

const HIGHLIGHT_DURATION = 2000;

function getRowId(row: Record<string, unknown>): string {
  return String(row['id'] ?? JSON.stringify(row));
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
      // New row
      changes[id] = new Set(Object.keys(row));
    } else {
      // Check changed columns
      const changed = Object.keys(row).filter(
        (col) => JSON.stringify(prev[col]) !== JSON.stringify(row[col]),
      );
      if (changed.length) changes[id] = new Set(changed);
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
  const prevRef = useRef<CommittedData>({ accounts: [], products: [] });
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearHighlight = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setChangedCells({}), HIGHLIGHT_DURATION);
    };

    const handleUpdate = (event: CommittedDataEvent) => {
      const table = event.table as keyof CommittedData;
      const changes = detectChanges(prevRef.current[table], event.rows);

      prevRef.current = { ...prevRef.current, [table]: event.rows };
      setData(prevRef.current);

      if (Object.keys(changes).length) {
        setChangedCells((prev) => ({ ...prev, [table]: changes }));
        clearHighlight();
      }
    };

    socket.on(WS_EVENTS.DATA_COMMITTED, handleUpdate);

    // Initial fetch
    Promise.all([
      socket.emitWithAck(WS_EVENTS.DATA_GET_COMMITTED, { table: 'accounts' }),
      socket.emitWithAck(WS_EVENTS.DATA_GET_COMMITTED, { table: 'products' }),
    ]).then(([acc, prod]) => {
      const initial = {
        accounts: (acc as CommittedDataEvent).rows,
        products: (prod as CommittedDataEvent).rows,
      };
      prevRef.current = initial;
      setData(initial);
    });

    return () => {
      socket.off(WS_EVENTS.DATA_COMMITTED, handleUpdate);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return { data, changedCells };
}
