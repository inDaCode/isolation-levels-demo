import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Check } from 'lucide-react';
import type { IsolationLevel } from '@isolation-demo/shared';

interface IsolationLevelOption {
  level: IsolationLevel;
  description: string;
  prevents: string[];
  allows: string[];
}

const ISOLATION_OPTIONS: IsolationLevelOption[] = [
  {
    level: 'READ UNCOMMITTED',
    description: 'In PostgreSQL, behaves the same as READ COMMITTED',
    prevents: ['Dirty reads (in PG)'],
    allows: ['Non-repeatable reads', 'Phantom reads'],
  },
  {
    level: 'READ COMMITTED',
    description: 'Default level — each query sees only committed data at query start',
    prevents: ['Dirty reads'],
    allows: ['Non-repeatable reads', 'Phantom reads'],
  },
  {
    level: 'REPEATABLE READ',
    description: 'Snapshot at transaction start — same query returns same results',
    prevents: ['Dirty reads', 'Non-repeatable reads', 'Phantom reads (in PG)'],
    allows: ['Serialization anomalies'],
  },
  {
    level: 'SERIALIZABLE',
    description: 'Strictest level — transactions behave as if executed sequentially',
    prevents: ['Dirty reads', 'Non-repeatable reads', 'Phantom reads', 'All anomalies'],
    allows: [],
  },
];

interface IsolationSelectProps {
  value: IsolationLevel;
  onChange: (level: IsolationLevel) => void;
  disabled?: boolean;
}

export function IsolationSelect({ value, onChange, disabled }: IsolationSelectProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          title={disabled ? 'Cannot change during transaction' : 'Select isolation level'}
          className="h-8 px-3 text-xs font-mono disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {value}
          <ChevronDown className="ml-2 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[350px]">
        {ISOLATION_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.level}
            onClick={() => onChange(option.level)}
            className="flex flex-col items-start gap-2 cursor-pointer py-3"
          >
            <div className="flex items-center gap-2 w-full">
              <span className="font-medium font-mono">{option.level}</span>
              {option.level === value && <Check className="h-4 w-4 ml-auto text-green-500" />}
            </div>
            <span className="text-xs text-zinc-400">{option.description}</span>
            <div className="flex gap-4 text-xs">
              {option.prevents.length > 0 && (
                <span className="text-green-500">✓ {option.prevents.join(', ')}</span>
              )}
              {option.allows.length > 0 && (
                <span className="text-yellow-500">✗ {option.allows.join(', ')}</span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
