import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, RotateCcw } from 'lucide-react';
import { useCommittedData } from '@/hooks/use-committed-data';
import { useSessionStore, selectUncommitted } from '@/stores/session-store';
import { TableView } from './table-view';

interface DatabaseStateProps {
  onReset?: () => void;
  isResetting?: boolean;
}

export function DatabaseState({ onReset, isResetting }: DatabaseStateProps) {
  const { data, changedCells } = useCommittedData();
  const uncommitted = useSessionStore(selectUncommitted);

  return (
    <Card className="p-4 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-medium text-zinc-400">Database State</h2>
          <span className="text-xs text-zinc-600">— committed data with pending changes</span>
        </div>
        {onReset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={isResetting}
            className="h-7 text-xs text-zinc-500 hover:text-zinc-300"
          >
            <RotateCcw className={`w-3 h-3 mr-1.5 ${isResetting ? 'animate-spin' : ''}`} />
            Reset
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-6">
        <TableView
          title="accounts"
          rows={data.accounts}
          changes={changedCells.accounts}
          uncommitted={uncommitted}
        />
        <TableView
          title="products"
          rows={data.products}
          changes={changedCells.products}
          uncommitted={uncommitted}
        />
      </div>
    </Card>
  );
}
