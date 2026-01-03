import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { useSessionStore, selectSession, type TerminalId } from '@/stores/session-store';
import { TerminalHeader } from './terminal-header';
import { TransactionControls } from './transaction-controls';
import { SqlEditor } from './sql-editor';
import { ActivityLog } from './activity-log';
import { QueryResultView } from './query-result';
import type { IsolationLevel } from '@isolation-demo/shared';

interface TerminalPanelProps {
  terminalId: TerminalId;
  defaultIsolationLevel?: IsolationLevel;
  lockIsolation?: boolean;
}

export function TerminalPanel({
  terminalId,
  defaultIsolationLevel = 'READ COMMITTED',
  lockIsolation = false,
}: TerminalPanelProps) {
  const sessionCreatedRef = useRef(false);

  const session = useSessionStore(selectSession(terminalId));
  const setSql = useSessionStore((s) => s.setSql);
  const createSession = useSessionStore((s) => s.createSession);
  const execute = useSessionStore((s) => s.execute);
  const executeWithSql = useSessionStore((s) => s.executeWithSql);
  const commit = useSessionStore((s) => s.commit);
  const rollback = useSessionStore((s) => s.rollback);
  const setIsolationLevel = useSessionStore((s) => s.setIsolationLevel);

  useEffect(() => {
    if (!sessionCreatedRef.current) {
      sessionCreatedRef.current = true;
      createSession(terminalId, defaultIsolationLevel);
    }
  }, [terminalId, defaultIsolationLevel, createSession]);

  const inTransaction = session.state?.inTransaction ?? false;
  const hasSession = session.state !== null;
  const canExecute = !session.isLoading && hasSession && session.sql.trim() !== '';
  const showResult = session.lastResult && !session.lastWasTransactionCommand;
  const recentLogs = [...session.log].reverse().slice(0, 3);

  return (
    <Card className="flex flex-col h-full p-4 gap-3 overflow-hidden">
      <TerminalHeader
        terminalId={terminalId}
        isLoading={session.isLoading}
        inTransaction={inTransaction}
        isolationLevel={session.state?.isolationLevel ?? defaultIsolationLevel}
        onIsolationChange={(level) => setIsolationLevel(terminalId, level)}
        lockIsolation={lockIsolation}
      />

      <TransactionControls
        inTransaction={inTransaction}
        isLoading={session.isLoading}
        hasSession={hasSession}
        onBegin={() => executeWithSql(terminalId, 'BEGIN')}
        onCommit={() => commit(terminalId)}
        onRollback={() => rollback(terminalId)}
      />

      <SqlEditor
        sql={session.sql}
        isLoading={session.isLoading}
        canExecute={canExecute}
        hasSession={hasSession}
        onSqlChange={(sql) => setSql(terminalId, sql)}
        onExecute={() => execute(terminalId)}
        onPresetSelect={(sql) => setSql(terminalId, sql)}
      />

      <ActivityLog logs={recentLogs} />

      <div className="flex-1 min-h-0 overflow-hidden">
        <QueryResultView
          result={showResult ? session.lastResult : null}
          error={session.lastError}
        />
      </div>
    </Card>
  );
}
