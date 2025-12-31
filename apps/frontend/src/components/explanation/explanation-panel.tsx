import { Card } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

export function ExplanationPanel() {
  // TODO: В следующем шаге добавим useExplanation hook
  // который будет генерировать контент на основе состояния терминалов

  return (
    <Card className="p-4 shrink-0 border-amber-900/50 bg-amber-950/20">
      <div className="flex gap-3">
        <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm text-zinc-200">
            <strong>Welcome!</strong> This is an interactive demo of PostgreSQL transaction
            isolation levels.
          </p>
          <p className="text-sm text-zinc-400">
            Try running{' '}
            <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs">
              SELECT * FROM accounts
            </code>{' '}
            in Terminal 1, then start a transaction in Terminal 2 with a different isolation level
            and observe how they see data differently.
          </p>
        </div>
      </div>
    </Card>
  );
}
