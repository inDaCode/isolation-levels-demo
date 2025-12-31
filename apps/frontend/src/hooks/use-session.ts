import { useState, useCallback, useRef } from 'react';
import { socket } from '@/lib/socket-client';
import {
  WS_EVENTS,
  type SessionState,
  type QueryResult,
  type QueryError,
  type IsolationLevel,
  type SessionCreatedEvent,
  type QueryResultEvent,
  type SessionOperationResult,
} from '@isolation-demo/shared';

export interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface UseSessionReturn {
  state: SessionState | null;
  lastResult: QueryResult | null;
  lastError: QueryError | null;
  log: LogEntry[];
  isLoading: boolean;
  create: (isolationLevel?: IsolationLevel) => Promise<void>;
  execute: (sql: string) => Promise<void>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
  setIsolationLevel: (level: IsolationLevel) => Promise<void>;
}

const MAX_LOG_ENTRIES = 10;

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function useSession(): UseSessionReturn {
  const [state, setState] = useState<SessionState | null>(null);
  const [lastResult, setLastResult] = useState<QueryResult | null>(null);
  const [lastError, setLastError] = useState<QueryError | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const logIdRef = useRef(0);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLog((prev) => [
      ...prev.slice(-(MAX_LOG_ENTRIES - 1)),
      { id: logIdRef.current++, timestamp: formatTime(), message, type },
    ]);
  }, []);

  const create = useCallback(
    async (isolationLevel?: IsolationLevel) => {
      setIsLoading(true);
      try {
        const response: SessionCreatedEvent = await socket.emitWithAck(WS_EVENTS.SESSION_CREATE, {
          isolationLevel,
        });
        setState(response.state);
        addLog('Session created', 'info');
      } finally {
        setIsLoading(false);
      }
    },
    [addLog],
  );

  const execute = useCallback(
    async (sql: string) => {
      if (!state) return;

      setIsLoading(true);
      setLastError(null);
      try {
        const response: QueryResultEvent = await socket.emitWithAck(WS_EVENTS.SESSION_EXECUTE, {
          sessionId: state.sessionId,
          sql,
        });

        if (response.error) {
          setLastError(response.error);
          setLastResult(null);
          addLog(response.error.message, 'error');
        } else if (response.result) {
          setLastResult(response.result);

          const sqlUpper = sql.trim().toUpperCase();
          if (sqlUpper === 'BEGIN' || sqlUpper === 'BEGIN;') {
            const level = response.state?.isolationLevel ?? state.isolationLevel;
            addLog(`BEGIN (${level})`, 'success');
          } else {
            const preview = sql.trim().slice(0, 25) + (sql.length > 25 ? '...' : '');
            addLog(
              `${preview} → ${response.result.rowCount} rows, ${response.result.duration}ms`,
              'info',
            );
          }
        }

        if (response.state) {
          setState(response.state);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [state, addLog],
  );

  const commit = useCallback(async () => {
    if (!state) return;

    setIsLoading(true);
    try {
      const response: SessionOperationResult = await socket.emitWithAck(WS_EVENTS.SESSION_COMMIT, {
        sessionId: state.sessionId,
      });
      if (response.state) {
        setState(response.state);
        addLog('COMMIT ✓', 'success');
      } else if (response.error) {
        setLastError({ message: response.error });
        addLog(response.error, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [state, addLog]);

  const rollback = useCallback(async () => {
    if (!state) return;

    setIsLoading(true);
    try {
      const response: SessionOperationResult = await socket.emitWithAck(
        WS_EVENTS.SESSION_ROLLBACK,
        { sessionId: state.sessionId },
      );
      if (response.state) {
        setState(response.state);
        addLog('ROLLBACK', 'warning');
      } else if (response.error) {
        setLastError({ message: response.error });
        addLog(response.error, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [state, addLog]);

  const setIsolationLevel = useCallback(
    async (level: IsolationLevel) => {
      if (!state) return;

      const response: SessionOperationResult = await socket.emitWithAck(
        WS_EVENTS.SESSION_SET_ISOLATION,
        { sessionId: state.sessionId, level },
      );
      if (response.state) {
        setState(response.state);
        addLog(`Isolation → ${level}`, 'info');
      } else if (response.error) {
        setLastError({ message: response.error });
        addLog(response.error, 'error');
      }
    },
    [state, addLog],
  );

  return {
    state,
    lastResult,
    lastError,
    log,
    isLoading,
    create,
    execute,
    commit,
    rollback,
    setIsolationLevel,
  };
}
