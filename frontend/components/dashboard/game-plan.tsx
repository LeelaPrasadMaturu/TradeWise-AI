'use client';

import { useQuery } from '@tanstack/react-query';
import { Target, AlertTriangle, CheckCircle, Clock, Ban, Focus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

export function GamePlan() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['game-plan'],
    queryFn: () => api.getGamePlan(),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.gamePlan) {
    return null;
  }

  const { gamePlan, flashbackSummary } = data;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Today&apos;s Game Plan
          </CardTitle>
          {flashbackSummary?.hasWarnings && (
            <Badge variant="destructive" className="text-xs">
              {flashbackSummary.highSeverityCount} warnings
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {gamePlan.symbolsToAvoid && gamePlan.symbolsToAvoid.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-loss">
              <Ban className="h-4 w-4" />
              Avoid Trading
            </div>
            <div className="flex flex-wrap gap-2">
              {gamePlan.symbolsToAvoid.map((symbol, i) => (
                <Badge key={i} variant="outline" className="border-loss/50 text-loss">
                  {symbol}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {gamePlan.focusAreas && gamePlan.focusAreas.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Focus className="h-4 w-4 text-primary" />
              Focus Areas
            </div>
            <ul className="space-y-1.5">
              {gamePlan.focusAreas.slice(0, 3).map((area, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 text-profit shrink-0" />
                  {area}
                </li>
              ))}
            </ul>
          </div>
        )}

        {gamePlan.rulesReminder && gamePlan.rulesReminder.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-warning">
                <AlertTriangle className="h-4 w-4" />
                Rules to Remember
              </div>
              <ul className="space-y-1.5">
                {gamePlan.rulesReminder.slice(0, 3).map((rule, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    • {rule}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {gamePlan.bestTradingHours && gamePlan.bestTradingHours.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock className="h-4 w-4 text-profit" />
                Best Hours
              </div>
              <div className="flex flex-wrap gap-2">
                {gamePlan.bestTradingHours.map((hour, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {hour}:00
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {gamePlan.emotionalCheck && (
          <div className={cn(
            'p-3 rounded-lg text-sm',
            gamePlan.emotionalCheck.includes('caution') || gamePlan.emotionalCheck.includes('avoid')
              ? 'bg-warning/10 text-warning'
              : 'bg-profit/10 text-profit'
          )}>
            {gamePlan.emotionalCheck}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
