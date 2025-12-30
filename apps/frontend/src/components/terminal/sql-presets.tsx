import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

interface SqlPreset {
  label: string;
  sql: string;
  tooltip: string;
}

interface PresetCategory {
  name: string;
  note?: string;
  presets: SqlPreset[];
}

const PRESET_CATEGORIES: PresetCategory[] = [
  {
    name: 'SELECT',
    presets: [
      {
        label: 'SELECT *',
        sql: 'SELECT * FROM accounts;',
        tooltip: 'Basic read — sees only committed data in READ COMMITTED',
      },
      {
        label: 'SELECT WHERE',
        sql: 'SELECT * FROM accounts WHERE id = 1;',
        tooltip: 'Read single row — useful for comparing visibility between sessions',
      },
      {
        label: 'SELECT balance',
        sql: 'SELECT balance FROM accounts WHERE id = 1;',
        tooltip: 'Read specific column — observe value changes between isolation levels',
      },
    ],
  },
  {
    name: 'UPDATE',
    presets: [
      {
        label: 'Add 100',
        sql: 'UPDATE accounts SET balance = balance + 100 WHERE id = 1;',
        tooltip: 'Increment balance — change not visible to others until COMMIT',
      },
      {
        label: 'Subtract 100',
        sql: 'UPDATE accounts SET balance = balance - 100 WHERE id = 1;',
        tooltip: 'Decrement balance — try concurrent updates to see conflicts',
      },
      {
        label: 'INSERT',
        sql: "INSERT INTO accounts (name, balance) VALUES ('Test', 500);",
        tooltip: 'Add new row — demonstrates phantom reads in lower isolation levels',
      },
      {
        label: 'DELETE',
        sql: 'DELETE FROM accounts WHERE id > 2;',
        tooltip: 'Remove rows — shows phantom read phenomenon',
      },
    ],
  },
  {
    name: 'LOCK',
    note: 'Locks work the same on all isolation levels — this demonstrates concurrency control, not visibility',
    presets: [
      {
        label: 'FOR UPDATE',
        sql: 'SELECT * FROM accounts WHERE id = 1 FOR UPDATE;',
        tooltip: 'Exclusive row lock — blocks other FOR UPDATE and writes on same row',
      },
      {
        label: 'FOR UPDATE SKIP LOCKED',
        sql: 'SELECT * FROM accounts FOR UPDATE SKIP LOCKED;',
        tooltip: 'Skip locked rows — useful for job queues, returns only unlocked rows',
      },
      {
        label: 'FOR SHARE',
        sql: 'SELECT * FROM accounts WHERE id = 1 FOR SHARE;',
        tooltip: 'Shared lock — allows other FOR SHARE but blocks FOR UPDATE',
      },
      {
        label: 'pg_sleep(3)',
        sql: 'SELECT pg_sleep(3);',
        tooltip: 'Sleep 3 seconds — hold transaction open to observe locks',
      },
    ],
  },
];

interface SqlPresetsProps {
  onSelect: (sql: string) => void;
  disabled?: boolean;
}

export function SqlPresets({ onSelect, disabled }: SqlPresetsProps) {
  return (
    <div className="flex gap-1">
      {PRESET_CATEGORIES.map((category) => (
        <DropdownMenu key={category.name}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={disabled} className="h-7 px-2 text-xs">
              {category.name}
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[300px]">
            {category.note && (
              <>
                <DropdownMenuLabel className="text-xs font-normal text-yellow-500">
                  ⚠️ {category.note}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            {category.presets.map((preset) => (
              <DropdownMenuItem
                key={preset.label}
                onClick={() => onSelect(preset.sql)}
                className="flex flex-col items-start gap-1 cursor-pointer"
              >
                <span className="font-medium">{preset.label}</span>
                <span className="text-xs text-zinc-400">{preset.tooltip}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </div>
  );
}
