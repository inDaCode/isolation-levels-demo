import { useState, useEffect, useCallback } from 'react';
import { socket } from '@/lib/socket-client';
import { WS_EVENTS, type CommittedDataEvent } from '@isolation-demo/shared';

interface CommittedData {
  accounts: Record<string, unknown>[];
  products: Record<string, unknown>[];
}

interface UseCommittedDataReturn {
  data: CommittedData;
  refresh: () => Promise<void>;
}

async function fetchCommittedData(): Promise<CommittedData> {
  const [accounts, products] = await Promise.all([
    socket.emitWithAck(WS_EVENTS.DATA_GET_COMMITTED, { table: 'accounts' }),
    socket.emitWithAck(WS_EVENTS.DATA_GET_COMMITTED, { table: 'products' }),
  ]);
  return {
    accounts: (accounts as CommittedDataEvent).rows,
    products: (products as CommittedDataEvent).rows,
  };
}

export function useCommittedData(): UseCommittedDataReturn {
  const [data, setData] = useState<CommittedData>({
    accounts: [],
    products: [],
  });

  const refresh = useCallback(async () => {
    const newData = await fetchCommittedData();
    setData(newData);
  }, []);

  useEffect(() => {
    const handleCommitted = (event: CommittedDataEvent) => {
      setData((prev) => ({
        ...prev,
        [event.table]: event.rows,
      }));
    };

    socket.on(WS_EVENTS.DATA_COMMITTED, handleCommitted);

    // Fetch initial data
    fetchCommittedData().then(setData);

    return () => {
      socket.off(WS_EVENTS.DATA_COMMITTED, handleCommitted);
    };
  }, []);

  return { data, refresh };
}
