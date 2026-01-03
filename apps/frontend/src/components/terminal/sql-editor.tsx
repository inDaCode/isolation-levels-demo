import { useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Button } from '@/components/ui/button';
import { Loader2, Play } from 'lucide-react';
import { SqlPresets } from './sql-presets';

interface SqlEditorProps {
  sql: string;
  isLoading: boolean;
  canExecute: boolean;
  hasSession: boolean;
  onSqlChange: (sql: string) => void;
  onExecute: () => void;
  onPresetSelect: (sql: string) => void;
}

export function SqlEditor({
  sql,
  isLoading,
  canExecute,
  hasSession,
  onSqlChange,
  onExecute,
  onPresetSelect,
}: SqlEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    editor.addAction({
      id: 'run-query',
      label: 'Run Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => onExecute(),
    });
  };

  const handlePresetSelect = (presetSql: string) => {
    onPresetSelect(presetSql);
    editorRef.current?.focus();
  };

  return (
    <div className="flex gap-3 shrink-0 items-start">
      <div className="flex flex-col gap-1.5 shrink-0">
        <SqlPresets onSelect={handlePresetSelect} disabled={!hasSession} />
      </div>

      <div className="flex-1 flex flex-col gap-1.5">
        <span className="text-xs text-zinc-500">Query</span>
        <div className="h-[160px] border border-zinc-800 rounded overflow-hidden">
          <Editor
            height="100%"
            defaultLanguage="sql"
            value={sql}
            onChange={(value) => onSqlChange(value ?? '')}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              readOnly: isLoading,
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
          onClick={onExecute}
          disabled={!canExecute}
          className={`h-8 px-3 ${canExecute ? 'text-green-400 hover:text-green-300' : ''}`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className={`w-4 h-4 mr-1.5 ${canExecute ? 'text-green-400' : ''}`} />
          )}
          Run
        </Button>
        <span className="text-xs text-zinc-600 text-center">Ctrl+Enter</span>
      </div>
    </div>
  );
}
