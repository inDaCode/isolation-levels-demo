import { useState, useCallback, useEffect, useRef } from 'react';
import { socket } from '@/lib/socket-client';
import { WS_EVENTS, SETUP_SQL, type SetupResponse } from '@isolation-demo/shared';

interface UseDatabaseSetupReturn {
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  reset: () => Promise<boolean>;
}

export function useDatabaseSetup(autoReset: boolean = false): UseDatabaseSetupReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const reset = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response: SetupResponse = await socket.emitWithAck(WS_EVENTS.SETUP_EXECUTE, {
        sql: SETUP_SQL,
      });

      if (!response.success) {
        setError(response.error ?? 'Failed to reset database');
        return false;
      }

      setIsReady(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoReset && !initializedRef.current) {
      initializedRef.current = true;
      reset();
    }
  }, [autoReset, reset]);

  return { isLoading, isReady, error, reset };
}
