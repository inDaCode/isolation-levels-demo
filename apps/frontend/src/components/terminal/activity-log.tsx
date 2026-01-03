import type { LogEntry } from '@/stores/session-store';

interface ActivityLogProps {
  logs: LogEntry[];
}

const LOG_TYPE_COLORS = {
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-yellow-400',
  info: 'text-zinc-500',
} as const;

export function ActivityLog({ logs }: ActivityLogProps) {
  if (logs.length === 0) {
    return (
      <div className="shrink-0 min-h-[48px] bg-zinc-900/30 rounded px-2 py-1.5">
        <span className="text-xs text-zinc-600">Ready</span>
      </div>
    );
  }

  return (
    <div className="shrink-0 min-h-[48px] bg-zinc-900/30 rounded px-2 py-1.5">
      <div className="flex flex-col gap-0.5">
        {logs.map((entry) => (
          <div
            key={entry.id}
            className={`text-xs font-mono flex gap-2 ${LOG_TYPE_COLORS[entry.type]}`}
          >
            <span className="text-zinc-600 shrink-0">{entry.timestamp}</span>
            <span className="truncate">{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
