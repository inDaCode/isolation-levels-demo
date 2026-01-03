import { Card } from '@/components/ui/card';
import { Database, Terminal, GitBranch, FlaskConical } from 'lucide-react';

export function ExplanationPanel() {
  return (
    <Card className="p-4 shrink-0 border-zinc-800 bg-zinc-900/50">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <h2 className="text-lg font-semibold mb-1">PostgreSQL Isolation Levels Demo</h2>
          <p className="text-sm text-zinc-400">
            Interactive tool for learning transaction isolation. Experiment freely or select a
            guided scenario from the menu.
          </p>
        </div>

        <div className="flex gap-4">
          <InfoBadge
            icon={<Database className="w-4 h-4 text-blue-400" />}
            title="PostgreSQL 16"
            subtitle="with SSI"
          />
          <InfoBadge
            icon={<Terminal className="w-4 h-4 text-green-400" />}
            title="3 Sessions"
            subtitle="independent"
          />
          <InfoBadge
            icon={<GitBranch className="w-4 h-4 text-yellow-400" />}
            title="4 Levels"
            subtitle="isolation"
          />
          <InfoBadge
            icon={<FlaskConical className="w-4 h-4 text-purple-400" />}
            title="15 Scenarios"
            subtitle="guided"
          />
        </div>
      </div>
    </Card>
  );
}

interface InfoBadgeProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

function InfoBadge({ icon, title, subtitle }: InfoBadgeProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded bg-zinc-800/50">
      {icon}
      <div className="text-xs">
        <div className="font-medium">{title}</div>
        <div className="text-zinc-500">{subtitle}</div>
      </div>
    </div>
  );
}
