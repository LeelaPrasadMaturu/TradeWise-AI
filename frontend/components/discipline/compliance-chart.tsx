'use client';

import { cn, formatPercent } from '@/lib/utils';

interface ComplianceChartProps {
  winRateCompliant: number;
  winRateViolating: number;
}

export function ComplianceChart({ winRateCompliant, winRateViolating }: ComplianceChartProps) {
  const difference = winRateCompliant - winRateViolating;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">When Following Rules</span>
            <span className="text-sm font-mono-numbers text-profit font-medium">
              {winRateCompliant.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-profit transition-all duration-500"
              style={{ width: `${winRateCompliant}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">When Breaking Rules</span>
            <span className="text-sm font-mono-numbers text-loss font-medium">
              {winRateViolating.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-loss transition-all duration-500"
              style={{ width: `${winRateViolating}%` }}
            />
          </div>
        </div>
      </div>

      <div className={cn(
        'rounded-md p-3 text-center',
        difference > 0 ? 'bg-profit/10' : 'bg-loss/10'
      )}>
        <p className={cn(
          'text-lg font-semibold',
          difference > 0 ? 'text-profit' : 'text-loss'
        )}>
          {difference > 0 ? '+' : ''}{difference.toFixed(1)}%
        </p>
        <p className="text-xs text-muted-foreground">
          {difference > 0
            ? 'better win rate when following your rules'
            : 'Rules may need adjustment'
          }
        </p>
      </div>
    </div>
  );
}
