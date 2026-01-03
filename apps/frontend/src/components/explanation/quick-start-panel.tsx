import { Card } from '@/components/ui/card';

export function QuickStartPanel() {
  return (
    <Card className="p-4 h-full border-zinc-800 bg-zinc-900/50 overflow-y-auto">
      <h3 className="font-medium text-sm mb-3">Quick Start</h3>
      <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-400">
        <li>
          Start a transaction with{' '}
          <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-zinc-200">BEGIN</code>
        </li>
        <li>Run queries in different terminals to see isolation behavior</li>
        <li>
          Use{' '}
          <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-zinc-200">COMMIT</code> or{' '}
          <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-zinc-200">ROLLBACK</code>{' '}
          to end
        </li>
        <li>Watch the "Committed Data" panel to see when changes become visible</li>
      </ol>

      <div className="mt-4 pt-3 border-t border-zinc-800">
        <p className="text-xs text-zinc-500">
          💡 Each terminal is an independent database connection. Changes in one affect others based
          on isolation level.
        </p>
      </div>
    </Card>
  );
}
