import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { IsolationSelect } from './isolation-select';
import type { IsolationLevel, TerminalId } from '@isolation-demo/shared';
import { TERMINAL_COLORS } from '@/lib/constants';

interface TerminalHeaderProps {
  terminalId: TerminalId;
  isLoading: boolean;
  inTransaction: boolean;
  isolationLevel: IsolationLevel;
  onIsolationChange: (level: IsolationLevel) => void;
  lockIsolation: boolean;
}

export function TerminalHeader({
  terminalId,
  isLoading,
  inTransaction,
  isolationLevel,
  onIsolationChange,
  lockIsolation,
}: TerminalHeaderProps) {
  const statusColor = inTransaction ? 'bg-yellow-500' : 'bg-green-500';
  const statusText = inTransaction ? 'In Transaction' : 'Idle';

  return (
    <div className="flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        <span className={`font-semibold ${TERMINAL_COLORS[terminalId]}`}>
          Terminal {terminalId}
        </span>
        <Badge variant="outline" className="gap-1.5 text-xs">
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          )}
          {isLoading ? 'Running...' : statusText}
        </Badge>
      </div>
      <IsolationSelect
        value={isolationLevel}
        onChange={onIsolationChange}
        disabled={inTransaction || lockIsolation}
      />
    </div>
  );
}
