import { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play } from 'lucide-react';
import { useSessionStore, selectSession, type TerminalId } from '@/stores/session-store';
import { QueryResultView } from './query-result';
import { SqlPresets } from './sql-presets';
import { IsolationSelect } from './isolation-select';
import type { IsolationLevel } from '@isolation-demo/shared';

interface TerminalPanelProps {
  terminalId: TerminalId;
  defaultIsolationLevel?: IsolationLevel;
}

export function TerminalPanel({
  terminalId,
  defaultIsolationLevel = 'READ COMMITTED',
}: TerminalPanelProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const initializedRef = useRef(false);

  const session = useSessionStore(selectSession(terminalId));
  const setSql = useSessionStore((s) => s.setSql);
  const createSession = useSessionStore((s) => s.createSession);
  const execute = useSessionStore((s) => s.execute);
  const commit = useSessionStore((s) => s.commit);
  const rollback = useSessionStore((s) => s.rollback);
  const setIsolationLevel = useSessionStore((s) => s.setIsolationLevel);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      createSession(terminalId, defaultIsolationLevel);
    }
  }, [terminalId, defaultIsolationLevel, createSession]);

  const handleExecute = () => {
    execute(terminalId);
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    editor.addAction({
      id: 'run-query',
      label: 'Run Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: handleExecute,
    });
  };

  const handlePresetSelect = (presetSql: string) => {
    setSql(terminalId, presetSql);
    editorRef.current?.focus();
  };

  const inTransaction = session.state?.inTransaction ?? false;
  const statusColor = inTransaction ? 'bg-yellow-500' : 'bg-green-500';
  const statusText = inTransaction ? 'In Transaction' : 'Idle';
  const canRun = !session.isLoading && session.state && session.sql.trim();

  const reversedLog = [...session.log].reverse().slice(0, 3);
  const showResult = session.lastResult && !session.lastWasTransactionCommand;

  return (
    <Card className="flex flex-col h-full p-4 gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Terminal {terminalId}</span>
          <Badge variant="outline" className="gap-1.5 text-xs">
            {session.isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <span className={`w-2 h-2 rounded-full ${statusColor}`} />
            )}
            {session.isLoading ? 'Running...' : statusText}
          </Badge>
        </div>
        <IsolationSelect
          value={session.state?.isolationLevel ?? defaultIsolationLevel}
          onChange={(level) => setIsolationLevel(terminalId, level)}
          disabled={inTransaction}
        />
      </div>

      {/* Transaction Controls */}
      <div
        className={`shrink-0 p-2.5 rounded border transition-colors ${
          inTransaction ? 'bg-green-950/20 border-green-800/30' : 'bg-zinc-900/50 border-zinc-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-400">Transaction</span>
            <Button
              variant={inTransaction ? 'outline' : 'secondary'}
              size="sm"
              onClick={() => {
                setSql(terminalId, 'BEGIN');
                execute(terminalId);
              }}
              disabled={session.isLoading || !session.state || inTransaction}
              className="h-7 text-xs font-mono"
            >
              BEGIN
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {inTransaction && <span className="text-xs text-green-400 mr-2">Active</span>}
            <Button
              variant="outline"
              size="sm"
              onClick={() => commit(terminalId)}
              disabled={session.isLoading || !inTransaction}
              className="h-7 text-xs font-mono"
            >
              COMMIT
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => rollback(terminalId)}
              disabled={session.isLoading || !inTransaction}
              className="h-7 text-xs font-mono"
            >
              ROLLBACK
            </Button>
          </div>
        </div>
      </div>

      {/* Presets + Editor + Run */}
      <div className="flex gap-3 shrink-0 items-start">
        <div className="flex flex-col gap-1.5 shrink-0">
          <SqlPresets onSelect={handlePresetSelect} disabled={!session.state} />
        </div>

        <div className="flex-1 flex flex-col gap-1.5">
          <span className="text-xs text-zinc-500">Query</span>
          <div className="h-[160px] border border-zinc-800 rounded overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="sql"
              value={session.sql}
              onChange={(value) => setSql(terminalId, value ?? '')}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                readOnly: session.isLoading,
                padding: { top: 8, bottom: 8 },
                wordWrap: 'on',
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          <span className="text-xs text-zinc-500">Run</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExecute}
            disabled={!canRun}
            className={`h-8 px-3 ${canRun ? 'text-green-400 hover:text-green-300' : ''}`}
          >
            {session.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className={`w-4 h-4 mr-1.5 ${canRun ? 'text-green-400' : ''}`} />
            )}
            Run
          </Button>
          <span className="text-xs text-zinc-600 text-center">Ctrl+Enter</span>
        </div>
      </div>

      {/* Activity Log */}
      <div className="shrink-0 min-h-[48px] bg-zinc-900/30 rounded px-2 py-1.5">
        {reversedLog.length === 0 ? (
          <span className="text-xs text-zinc-600">Ready</span>
        ) : (
          <div className="flex flex-col gap-0.5">
            {reversedLog.map((entry) => (
              <div
                key={entry.id}
                className={`text-xs font-mono flex gap-2 ${
                  entry.type === 'success'
                    ? 'text-green-400'
                    : entry.type === 'error'
                      ? 'text-red-400'
                      : entry.type === 'warning'
                        ? 'text-yellow-400'
                        : 'text-zinc-500'
                }`}
              >
                <span className="text-zinc-600 shrink-0">{entry.timestamp}</span>
                <span className="truncate">{entry.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <QueryResultView
          result={showResult ? session.lastResult : null}
          error={session.lastError}
        />
      </div>
    </Card>
  );
}
