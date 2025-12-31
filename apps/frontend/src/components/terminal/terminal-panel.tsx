import { useEffect, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { QueryResultView } from './query-result';
import { SqlPresets } from './sql-presets';
import { IsolationSelect } from './isolation-select';
import type { IsolationLevel } from '@isolation-demo/shared';

interface TerminalPanelProps {
  title: string;
  defaultIsolationLevel?: IsolationLevel;
}

export function TerminalPanel({
  title,
  defaultIsolationLevel = 'READ COMMITTED',
}: TerminalPanelProps) {
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

  const statusColor = session.state?.inTransaction ? 'bg-yellow-500' : 'bg-green-500';
  const statusText = session.state?.inTransaction ? 'In Transaction' : 'Idle';

  const reversedLog = [...session.log].reverse();

  return (
    <Card className="flex flex-col h-full p-4 gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{title}</span>
          <Badge variant="outline" className="gap-1.5">
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
          disabled={session.state?.inTransaction}
        />
      </div>

      {/* SQL Presets Toolbar */}
      <div className="flex items-center justify-between shrink-0">
        <SqlPresets onSelect={handlePresetSelect} disabled={!session.state} />
        <span className="text-xs text-zinc-500">Ctrl+Enter to run</span>
      </div>

      {/* Editor */}
      <div className="h-[200px] shrink-0 border border-zinc-800 rounded overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={sql}
          onChange={(value) => setSql(value ?? '')}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            readOnly: session.isLoading,
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex gap-2 shrink-0">
        <Button
          variant={session.state?.inTransaction ? 'outline' : 'default'}
          onClick={() => session.execute('BEGIN')}
          disabled={session.isLoading || !session.state || session.state.inTransaction}
        >
          BEGIN
        </Button>
        <Button
          variant="secondary"
          onClick={() => executeRef.current()}
          disabled={session.isLoading || !session.state}
        >
          {session.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Run'}
        </Button>
        <Button
          variant="outline"
          onClick={() => session.commit()}
          disabled={session.isLoading || !session.state?.inTransaction}
        >
          Commit
        </Button>
        <Button
          variant="outline"
          onClick={() => session.rollback()}
          disabled={session.isLoading || !session.state?.inTransaction}
        >
          Rollback
        </Button>
      </div>

      {/* Activity Log */}
      <div className="shrink-0 h-[90px] overflow-y-auto bg-zinc-900/50 rounded border border-zinc-800 px-2 py-1.5">
        {reversedLog.length === 0 ? (
          <span className="text-xs text-zinc-500">Ready</span>
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
                        : 'text-zinc-400'
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
        <QueryResultView result={session.lastResult} error={session.lastError} />
      </div>
    </Card>
  );
}
