import { Button } from '@/components/ui/button';

interface TransactionControlsProps {
  inTransaction: boolean;
  isLoading: boolean;
  hasSession: boolean;
  onBegin: () => void;
  onCommit: () => void;
  onRollback: () => void;
}

export function TransactionControls({
  inTransaction,
  isLoading,
  hasSession,
  onBegin,
  onCommit,
  onRollback,
}: TransactionControlsProps) {
  return (
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
            onClick={onBegin}
            disabled={isLoading || !hasSession || inTransaction}
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
            onClick={onCommit}
            disabled={isLoading || !inTransaction}
            className="h-7 text-xs font-mono"
          >
            COMMIT
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRollback}
            disabled={isLoading || !inTransaction}
            className="h-7 text-xs font-mono"
          >
            ROLLBACK
          </Button>
        </div>
      </div>
    </div>
  );
}
