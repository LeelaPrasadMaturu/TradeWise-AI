'use client';

import { cn, getScoreLabel } from '@/lib/utils';

interface BehavioralScoreProps {
  score: number;
  tradingStyle?: string;
  styleConfidence?: number;
}

export function BehavioralScore({ score, tradingStyle, styleConfidence }: BehavioralScoreProps) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-profit';
    if (s >= 60) return 'text-warning';
    return 'text-loss';
  };

  const getProgressColor = (s: number) => {
    if (s >= 80) return 'bg-profit';
    if (s >= 60) return 'bg-warning';
    return 'bg-loss';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Behavioral Score</p>
          <p className={cn('text-4xl font-bold font-mono-numbers', getScoreColor(score))}>
            {score}
          </p>
          <p className="text-sm text-muted-foreground">{getScoreLabel(score)}</p>
        </div>
        {tradingStyle && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Trading Style</p>
            <p className="text-lg font-semibold">{tradingStyle}</p>
            {styleConfidence !== undefined && (
              <p className="text-xs text-muted-foreground">
                {Math.round(styleConfidence * 100)}% confidence
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', getProgressColor(score))}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>
    </div>
  );
}
