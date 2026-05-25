'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Clock, AlertTriangle, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import api from '@/lib/api';
import { cn, getPnLColor } from '@/lib/utils';

export function BriefingCard() {
  const [expanded, setExpanded] = useState(true);

  const { data: briefing, isLoading } = useQuery({
    queryKey: ['briefing'],
    queryFn: () => api.getBriefing(),
  });

  if (isLoading) {
    return <Skeleton className="h-[200px] w-full" />;
  }

  if (!briefing) {
    return null;
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-medium">
              {briefing.greeting}
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              Today&apos;s Briefing
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {briefing.yesterdaySummary && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Yesterday</p>
                <p className="text-sm font-medium">
                  {briefing.yesterdaySummary.message}
                </p>
                <p className={cn(
                  'text-lg font-mono-numbers font-semibold',
                  getPnLColor(briefing.yesterdaySummary.pnl)
                )}>
                  {briefing.yesterdaySummary.pnlFormatted}
                </p>
              </div>
            )}

            {briefing.bestHours && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Best Hours
                </p>
                <div className="flex flex-wrap gap-1">
                  {briefing.bestHours.hours.map((h) => (
                    <Badge key={h.hour} variant="outline" className="text-xs">
                      {h.hour}:00 ({h.winRate}%)
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {briefing.rulesViolated && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-warning" /> Rules Violated
                </p>
                <div className="flex flex-wrap gap-1">
                  {briefing.rulesViolated.rules.slice(0, 3).map((rule) => (
                    <Badge key={rule} variant="secondary" className="text-xs text-warning">
                      {rule}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {briefing.dayOfWeekWarning && (
            <>
              <Separator />
              <div className="flex items-center gap-2 rounded-md bg-warning/10 p-3">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <p className="text-sm text-warning">
                  {briefing.dayOfWeekWarning.warning}
                </p>
              </div>
            </>
          )}

          {briefing.focusAreas?.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Target className="h-3 w-3" /> Focus Areas
                </p>
                <ul className="space-y-1">
                  {briefing.focusAreas.map((area, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      {area}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          <Separator />
          <p className="text-sm italic text-muted-foreground text-center">
            &quot;{briefing.motivationalMessage}&quot;
          </p>
        </CardContent>
      )}
    </Card>
  );
}
