'use client';

import { cn, getScoreLabel } from '@/lib/utils';

interface DisciplineGaugeProps {
  score: number;
  totalTrades: number;
  compliantTrades: number;
}

export function DisciplineGauge({ score, totalTrades, compliantTrades }: DisciplineGaugeProps) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-profit';
    if (s >= 60) return 'text-warning';
    return 'text-loss';
  };

  const getProgressColor = (s: number) => {
    if (s >= 80) return 'stroke-profit';
    if (s >= 60) return 'stroke-warning';
    return 'stroke-loss';
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-32 w-32">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn('transition-all duration-500', getProgressColor(score))}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-3xl font-bold font-mono-numbers', getScoreColor(score))}>
            {score}
          </span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <p className={cn('text-lg font-semibold', getScoreColor(score))}>
            {getScoreLabel(score)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Compliance</p>
          <p className="text-lg font-semibold">
            <span className="text-profit">{compliantTrades}</span>
            <span className="text-muted-foreground"> / {totalTrades}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
