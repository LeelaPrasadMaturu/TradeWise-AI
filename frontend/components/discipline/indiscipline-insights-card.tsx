'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, TrendingDown, Target, ChevronDown, ChevronUp, RefreshCw, IndianRupee } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import type { IndisciplineAnalysis } from '@/types';

interface IndisciplineInsightsCardProps {
  className?: string;
  defaultExpanded?: boolean;
}

export function IndisciplineInsightsCard({ 
  className, 
  defaultExpanded = false 
}: IndisciplineInsightsCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [period, setPeriod] = useState(90);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['indiscipline-analysis', period],
    queryFn: () => api.getIndisciplineAnalysis(period),
  });

  if (isLoading) {
    return (
      <Card className={cn('border-warning/30', className)}>
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const hasIssues = 
    data.stopLossMovements.summary.tradesMovedStopLossDown > 0 || 
    data.earlyExits.summary.earlyExitCount > 0;

  return (
    <Card className={cn('border-warning/30', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Indiscipline Insights
            {hasIssues && (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                Needs attention
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Section */}
        <div className="space-y-4">
          {/* Cost Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingDown className="h-4 w-4" />
                SL Widening Cost
              </div>
              <p className="text-xl font-semibold text-loss font-mono-numbers">
                ₹{data.stopLossMovements.impact.totalExtraLoss.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.stopLossMovements.summary.tradesMovedStopLossDown} trades affected
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Target className="h-4 w-4" />
                Missed Profits
              </div>
              <p className="text-xl font-semibold text-warning font-mono-numbers">
                ₹{data.earlyExits.impact.totalMissedProfit.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.earlyExits.summary.earlyExitCount} early exits
              </p>
            </div>
          </div>

          {/* Total Impact */}
          {data.combinedImpact.totalIndisciplineCost > 0 && (
            <Alert className="border-warning/50 bg-warning/10">
              <IndianRupee className="h-4 w-4" />
              <AlertDescription>
                <span className="font-semibold">Total cost of indiscipline: </span>
                <span className="text-loss font-mono-numbers">
                  ₹{data.combinedImpact.totalIndisciplineCost.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground"> in the last {period} days</span>
              </AlertDescription>
            </Alert>
          )}

          {expanded && (
            <Tabs defaultValue="stoploss" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="stoploss" className="text-xs">
                  Stop Loss Analysis
                </TabsTrigger>
                <TabsTrigger value="earlyexit" className="text-xs">
                  Early Exit Analysis
                </TabsTrigger>
              </TabsList>

              <TabsContent value="stoploss" className="space-y-4">
                <StopLossSection data={data.stopLossMovements} />
              </TabsContent>

              <TabsContent value="earlyexit" className="space-y-4">
                <EarlyExitSection data={data.earlyExits} />
              </TabsContent>
            </Tabs>
          )}

          {/* Recommendations */}
          {data.topRecommendations.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Top Recommendations</p>
              {data.topRecommendations.slice(0, expanded ? 4 : 2).map((rec, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "p-2 rounded-md text-sm",
                    rec.priority === 'high' ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted/50'
                  )}
                >
                  <p className="font-medium">{rec.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{rec.action}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StopLossSection({ data }: { data: IndisciplineAnalysis['stopLossMovements'] }) {
  return (
    <div className="space-y-4">
      {/* Win Rate Comparison */}
      <div className="p-3 rounded-lg bg-muted/50">
        <p className="text-sm font-medium mb-2">Win Rate Comparison</p>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-2xl font-semibold text-profit font-mono-numbers">
              {data.winRateComparison.normalWinRate}%
            </p>
            <p className="text-xs text-muted-foreground">Normal Trades</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-loss font-mono-numbers">
              {data.winRateComparison.movedSLDownWinRate}%
            </p>
            <p className="text-xs text-muted-foreground">When SL Moved Down</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {data.winRateComparison.insight}
        </p>
      </div>

      {/* SL Usage Stats */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">SL Usage Rate</span>
          <span className="font-mono-numbers">{data.summary.stopLossUsageRate}%</span>
        </div>
        <Progress value={data.summary.stopLossUsageRate} className="h-2" />
        
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">% Moved SL Down</span>
          <span className="font-mono-numbers text-warning">{data.summary.percentMovedDown}%</span>
        </div>
        <Progress value={data.summary.percentMovedDown} className="h-2 [&>div]:bg-warning" />
      </div>

      {/* Common Reasons */}
      {data.commonReasons.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Why You Moved SL Down</p>
          <div className="flex flex-wrap gap-2">
            {data.commonReasons.map((r, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {r.reason} ({r.count})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Recent Examples */}
      {data.recentExamples.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Recent Examples</p>
          <div className="space-y-2">
            {data.recentExamples.slice(0, 3).map((ex, i) => (
              <div key={i} className="p-2 rounded bg-muted/30 text-xs">
                <div className="flex justify-between">
                  <span className="font-medium">{ex.symbol}</span>
                  <span className={ex.result === 'loss' ? 'text-loss' : 'text-profit'}>
                    ₹{Math.abs(ex.profitLoss).toLocaleString()} {ex.result}
                  </span>
                </div>
                {ex.reason && (
                  <p className="text-muted-foreground mt-1">{ex.reason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EarlyExitSection({ data }: { data: IndisciplineAnalysis['earlyExits'] }) {
  return (
    <div className="space-y-4">
      {/* Profit Comparison */}
      <div className="p-3 rounded-lg bg-muted/50">
        <p className="text-sm font-medium mb-2">Avg Profit Comparison</p>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-2xl font-semibold text-profit font-mono-numbers">
              ₹{data.profitComparison.fullTargetAvgProfit.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Full Target Trades</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-warning font-mono-numbers">
              ₹{data.profitComparison.earlyExitAvgProfit.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Early Exit Trades</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {data.profitComparison.insight}
        </p>
      </div>

      {/* Target Achievement */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Avg % to Target</span>
          <span className="font-mono-numbers">{data.summary.avgPercentToTarget}%</span>
        </div>
        <Progress value={data.summary.avgPercentToTarget} className="h-2" />
        
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Early Exit Rate</span>
          <span className="font-mono-numbers text-warning">{data.summary.earlyExitRate}%</span>
        </div>
        <Progress value={data.summary.earlyExitRate} className="h-2 [&>div]:bg-warning" />
      </div>

      {/* Exit Reasons */}
      {data.exitReasons.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Why You Exited Early</p>
          <div className="flex flex-wrap gap-2">
            {data.exitReasons.map((r, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {r.label} ({r.count})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Recent Examples */}
      {data.recentExamples.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Recent Examples</p>
          <div className="space-y-2">
            {data.recentExamples.slice(0, 3).map((ex, i) => (
              <div key={i} className="p-2 rounded bg-muted/30 text-xs">
                <div className="flex justify-between">
                  <span className="font-medium">{ex.symbol}</span>
                  <span>
                    <span className="text-profit">₹{ex.actualProfit.toLocaleString()}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-warning">₹{ex.potentialProfit.toLocaleString()}</span>
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">
                    Achieved {ex.percentAchieved}% of target
                  </span>
                  <span className="text-loss">
                    Missed ₹{ex.missedProfit.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
