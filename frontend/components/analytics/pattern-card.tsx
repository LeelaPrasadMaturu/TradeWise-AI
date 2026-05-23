'use client';

import { AlertTriangle, TrendingDown, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BehavioralPattern } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';

interface PatternCardProps {
  pattern: BehavioralPattern;
}

const severityConfig = {
  high: {
    icon: AlertTriangle,
    badge: 'destructive' as const,
    bgClass: 'bg-loss/5 border-loss/30',
    iconClass: 'text-loss',
  },
  medium: {
    icon: TrendingDown,
    badge: 'secondary' as const,
    bgClass: 'bg-warning/5 border-warning/30',
    iconClass: 'text-warning',
  },
  low: {
    icon: Info,
    badge: 'outline' as const,
    bgClass: 'border-border/50',
    iconClass: 'text-muted-foreground',
  },
};

export function PatternCard({ pattern }: PatternCardProps) {
  const config = severityConfig[pattern.severity] || severityConfig.low;
  const Icon = config.icon;

  const formatPatternType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .replace(/NEGATIVE|POSITIVE/g, '')
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <Card className={cn('border', config.bgClass)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-muted p-2">
            <Icon className={cn('h-4 w-4', config.iconClass)} />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {formatPatternType(pattern.type)}
                </span>
                <Badge variant={config.badge} className="text-xs">
                  {pattern.severity.toUpperCase()}
                </Badge>
              </div>
              {pattern.costEstimate && (
                <span className={cn(
                  'text-sm font-mono-numbers font-medium',
                  pattern.costEstimate.directCost < 0 ? 'text-loss' : 'text-profit'
                )}>
                  {formatCurrency(pattern.costEstimate.directCost)}
                </span>
              )}
            </div>

            {pattern.insight && (
              <p className="text-sm text-muted-foreground">
                {pattern.insight}
              </p>
            )}

            {pattern.message && !pattern.insight && (
              <p className="text-sm text-muted-foreground">
                {pattern.message}
              </p>
            )}

            {pattern.recommendation && (
              <p className="text-xs text-primary">
                Tip: {pattern.recommendation}
              </p>
            )}

            {pattern.affectedTrades && pattern.affectedTrades.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {pattern.affectedTrades.length} trades affected
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
