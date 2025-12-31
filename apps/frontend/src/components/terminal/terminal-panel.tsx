import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { QueryResultView } from './query-result';
import { SqlPresets } from './sql-presets';
import { IsolationSelect } from './isolation-select';
import type { IsolationLevel } from '@isolation-demo/shared';

export interface TerminalHandle {
  setSql: (sql: string) => void;
  execute: () => void;
  setIsolationLevel: (level: IsolationLevel) => void;
}

interface TerminalPanelProps {
  terminalId: number;
  defaultIsolationLevel?: IsolationLevel;
}

export const TerminalPanel = forwardRef<TerminalHandle, TerminalPanelProps>(function TerminalPanel(
  { terminalId, defaultIsolationLevel = 'READ COMMITTED' },
  ref,
) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const initializedRef = useRef(false);
  const [sql, setSql] = useState('SELECT * FROM accounts;');
  const session = useSession();

  const executeRef = useRef<() => void>(() => {});

  useEffect(() => {
    executeRef.current = () => {
      if (sql.trim()) {
        session.execute(sql.trim());
      }
    };
  }, [sql, session]);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      session.create(defaultIsolationLevel);
    }
  }, [session, defaultIsolationLevel]);

  // Expose methods to parent
  useImperativeHandle(
    ref,
    () => ({
      setSql: (newSql: string) => {
        setSql(newSql);
        editorRef.current?.focus();
      },
      execute: () => {
        executeRef.current();
      },
      setIsolationLevel: (level: IsolationLevel) => {
        session.setIsolationLevel(level);
      },
    }),
    [session],
  );

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    editor.addAction({
      id: 'run-query',
      label: 'Run Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => executeRef.current(),
    });
  };

  const handlePresetSelect = (presetSql: string) => {
    setSql(presetSql);
    editorRef.current?.focus();
  };

  const inTransaction = session.state?.inTransaction ?? false;
  const statusColor = inTransaction ? 'bg-yellow-500' : 'bg-green-500';
  const statusText = inTransaction ? 'In Transaction' : 'Idle';
  const canRun = !session.isLoading && session.state && sql.trim();

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
          onChange={(level) => session.setIsolationLevel(level)}
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
              onClick={() => session.execute('BEGIN')}
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
              onClick={() => session.commit()}
              disabled={session.isLoading || !inTransaction}
              className="h-7 text-xs font-mono"
            >
              COMMIT
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => session.rollback()}
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
        {/* Presets слева */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <SqlPresets onSelect={handlePresetSelect} disabled={!session.state} />
        </div>

        {/* Editor по центру */}
        <div className="flex-1 flex flex-col gap-1.5">
          <span className="text-xs text-zinc-500">Query</span>
          <div className="h-[160px] border border-zinc-800 rounded overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="sql"
              value={sql}
              onChange={(value) => setSql(value ?? '')}
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

        {/* Run справа */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <span className="text-xs text-zinc-500">Run</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => executeRef.current()}
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
});
