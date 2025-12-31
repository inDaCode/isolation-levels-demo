import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, BookOpen, Play } from 'lucide-react';
import { SCENARIOS } from '@/data/scenarios';
import type { Scenario } from '@isolation-demo/shared';

interface ScenarioSelectProps {
  currentScenario: Scenario | null;
  onSelect: (scenarioId: string) => void;
  onExit: () => void;
}

export function ScenarioSelect({ currentScenario, onSelect, onExit }: ScenarioSelectProps) {
  const basicScenarios = SCENARIOS.filter((s) => s.difficulty === 'basic');
  const intermediateScenarios = SCENARIOS.filter((s) => s.difficulty === 'intermediate');
  const advancedScenarios = SCENARIOS.filter((s) => s.difficulty === 'advanced');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <BookOpen className="w-4 h-4" />
          {currentScenario ? currentScenario.title : 'Sandbox'}
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        <DropdownMenuItem onClick={onExit} className="gap-2">
          <Play className="w-4 h-4" />
          <div>
            <div className="font-medium">Sandbox</div>
            <div className="text-xs text-zinc-400">Free experimentation mode</div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {basicScenarios.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-zinc-500">Basic</DropdownMenuLabel>
            {basicScenarios.map((scenario) => (
              <ScenarioItem
                key={scenario.id}
                scenario={scenario}
                isActive={currentScenario?.id === scenario.id}
                onSelect={onSelect}
              />
            ))}
          </>
        )}

        {intermediateScenarios.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-zinc-500">Intermediate</DropdownMenuLabel>
            {intermediateScenarios.map((scenario) => (
              <ScenarioItem
                key={scenario.id}
                scenario={scenario}
                isActive={currentScenario?.id === scenario.id}
                onSelect={onSelect}
              />
            ))}
          </>
        )}

        {advancedScenarios.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-zinc-500">Advanced</DropdownMenuLabel>
            {advancedScenarios.map((scenario) => (
              <ScenarioItem
                key={scenario.id}
                scenario={scenario}
                isActive={currentScenario?.id === scenario.id}
                onSelect={onSelect}
              />
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ScenarioItemProps {
  scenario: Scenario;
  isActive: boolean;
  onSelect: (id: string) => void;
}

function ScenarioItem({ scenario, isActive, onSelect }: ScenarioItemProps) {
  return (
    <DropdownMenuItem
      onClick={() => onSelect(scenario.id)}
      className={`flex flex-col items-start gap-1 cursor-pointer ${isActive ? 'bg-zinc-800' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">{scenario.title}</span>
        {scenario.terminals === 3 && (
          <span className="text-xs px-1.5 py-0.5 bg-zinc-700 rounded">3 terminals</span>
        )}
      </div>
      <span className="text-xs text-zinc-400">{scenario.description}</span>
    </DropdownMenuItem>
  );
}
