import { useEffect, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

  const handleExecute = () => {
    executeRef.current();
  };

  const handleBegin = () => {
    session.execute('BEGIN');
  };

  const handlePresetSelect = (presetSql: string) => {
    setSql(presetSql);
    editorRef.current?.focus();
  };

  const statusColor = session.state?.inTransaction ? 'bg-yellow-500' : 'bg-green-500';
  const statusText = session.state?.inTransaction ? 'In Transaction' : 'Idle';

  return (
    <Card className="flex flex-col h-full p-4 gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{title}</span>
          <Badge variant="outline" className="gap-1.5">
            <span className={`w-2 h-2 rounded-full ${statusColor}`} />
            {statusText}
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
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex gap-2 shrink-0">
        <Button
          variant={session.state?.inTransaction ? 'outline' : 'default'}
          onClick={handleBegin}
          disabled={session.isLoading || !session.state || session.state.inTransaction}
        >
          BEGIN
        </Button>
        <Button
          variant="secondary"
          onClick={handleExecute}
          disabled={session.isLoading || !session.state}
        >
          Run
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
        {session.lastResult && (
          <span className="ml-auto text-sm text-zinc-400">
            {session.lastResult.rowCount} rows • {session.lastResult.duration}ms
          </span>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <QueryResultView result={session.lastResult} error={session.lastError} />
      </div>
    </Card>
  );
}
