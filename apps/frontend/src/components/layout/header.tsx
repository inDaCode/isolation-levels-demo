import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, X } from 'lucide-react';
import { SCENARIOS_BY_CATEGORY, CATEGORY_LABELS, type Scenario } from '@/data/scenarios';
import type { ConnectionStatus } from '@/hooks/use-socket';

interface HeaderProps {
  connectionStatus: ConnectionStatus;
  setupError?: string | null;
  currentScenario: Scenario | null;
  onScenarioSelect: (scenarioId: string) => void;
  onScenarioExit: () => void;
}

const CATEGORY_ORDER: Scenario['category'][] = [
  'read-anomalies',
  'write-anomalies',
  'locks',
  'deadlocks',
];

const DIFFICULTY_COLORS: Record<Scenario['difficulty'], string> = {
  basic: 'text-green-400',
  intermediate: 'text-yellow-400',
  advanced: 'text-red-400',
};

export function Header({
  connectionStatus,
  setupError,
  currentScenario,
  onScenarioSelect,
  onScenarioExit,
}: HeaderProps) {
  const statusColor =
    connectionStatus === 'connected'
      ? 'bg-green-500'
      : connectionStatus === 'connecting'
        ? 'bg-yellow-500'
        : 'bg-red-500';

  const statusText =
    connectionStatus === 'connected'
      ? 'Connected'
      : connectionStatus === 'connecting'
        ? 'Connecting...'
        : 'Disconnected';

  return (
    <header className="border-b border-zinc-800 px-4 py-3 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">PostgreSQL Isolation Levels</h1>

          <div className="flex items-center gap-1">
            {CATEGORY_ORDER.map((category) => (
              <CategoryDropdown
                key={category}
                category={category}
                scenarios={SCENARIOS_BY_CATEGORY[category]}
                currentScenarioId={currentScenario?.id ?? null}
                onSelect={onScenarioSelect}
              />
            ))}
          </div>

          {currentScenario && (
            <div className="flex items-center gap-2 ml-2 pl-4 border-l border-zinc-700">
              <span className="text-sm text-zinc-400">Current:</span>
              <Badge variant="secondary" className="gap-1.5">
                {currentScenario.title}
                <button
                  onClick={onScenarioExit}
                  className="ml-1 hover:text-red-400 transition-colors"
                  title="Exit scenario"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {setupError && <span className="text-xs text-red-400">{setupError}</span>}
          <Badge variant="outline" className="gap-1.5">
            <span className={`w-2 h-2 rounded-full ${statusColor}`} />
            {statusText}
          </Badge>
        </div>
      </div>
    </header>
  );
}

interface CategoryDropdownProps {
  category: Scenario['category'];
  scenarios: Scenario[];
  currentScenarioId: string | null;
  onSelect: (scenarioId: string) => void;
}

function CategoryDropdown({
  category,
  scenarios,
  currentScenarioId,
  onSelect,
}: CategoryDropdownProps) {
  const hasActiveScenario = scenarios.some((s) => s.id === currentScenarioId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 px-3 text-sm ${hasActiveScenario ? 'bg-zinc-800' : ''}`}
        >
          {CATEGORY_LABELS[category]}
          <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[300px]">
        {scenarios.map((scenario) => (
          <DropdownMenuItem
            key={scenario.id}
            onClick={() => onSelect(scenario.id)}
            className={`flex flex-col items-start gap-1 cursor-pointer ${
              scenario.id === currentScenarioId ? 'bg-zinc-800' : ''
            }`}
          >
            <div className="flex items-center gap-2 w-full">
              <span className="font-medium">{scenario.title}</span>
              <div className="ml-auto flex items-center gap-2">
                {scenario.terminals === 3 && (
                  <span className="text-xs px-1.5 py-0.5 bg-zinc-700 rounded">3T</span>
                )}
                <span className={`text-xs ${DIFFICULTY_COLORS[scenario.difficulty]}`}>
                  {scenario.difficulty}
                </span>
              </div>
            </div>
            <span className="text-xs text-zinc-400">{scenario.description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
