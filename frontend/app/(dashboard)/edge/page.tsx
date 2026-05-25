'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Calendar,
  BarChart3,
  Target,
  Brain,
  AlertTriangle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Timer
} from 'lucide-react';
import api from '@/lib/api';
import type { EdgeAnalysis, TimeAlert, HoldTimeAnalysis } from '@/types';

function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  if (absAmount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (absAmount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} hrs`;
  return `${(minutes / 1440).toFixed(1)} days`;
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon,
  trend 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${
              trend === 'up' ? 'text-profit' : trend === 'down' ? 'text-loss' : ''
            }`}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function EdgeStatsTable({ 
  data, 
  labelKey, 
  labelName 
}: { 
  data: Array<{ [key: string]: unknown } & { winRate: number; totalPnL: number; totalTrades: number }>;
  labelKey: string;
  labelName: string;
}) {
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground text-sm">Not enough data</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left py-2 px-3 font-medium">{labelName}</th>
            <th className="text-right py-2 px-3 font-medium">Trades</th>
            <th className="text-right py-2 px-3 font-medium">Win Rate</th>
            <th className="text-right py-2 px-3 font-medium">P&L</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((item, idx) => (
            <tr key={idx} className="border-b border-border/30">
              <td className="py-2 px-3 font-medium">{String(item[labelKey])}</td>
              <td className="py-2 px-3 text-right font-mono">{item.totalTrades}</td>
              <td className="py-2 px-3 text-right">
                <Badge variant={item.winRate >= 50 ? 'default' : 'destructive'}>
                  {item.winRate}%
                </Badge>
              </td>
              <td className={`py-2 px-3 text-right font-mono ${
                item.totalPnL >= 0 ? 'text-profit' : 'text-loss'
              }`}>
                {formatCurrency(item.totalPnL)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimeAlertsCard({ alerts }: { alerts: TimeAlert[] }) {
  if (alerts.length === 0) {
    return (
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertTitle>All Clear</AlertTitle>
        <AlertDescription>No trades exceeding your average hold time.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <Alert 
          key={alert.tradeId}
          variant={alert.severity === 'critical' ? 'destructive' : 'default'}
        >
          <Timer className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            {alert.symbol}
            <Badge variant={alert.severity === 'critical' ? 'destructive' : alert.severity === 'high' ? 'destructive' : 'default'}>
              {alert.severity}
            </Badge>
          </AlertTitle>
          <AlertDescription>
            <p>{alert.message}</p>
            <p className="text-xs mt-1">
              Held: {formatDuration(alert.holdMinutes)} | 
              Avg: {formatDuration(alert.avgHoldMinutes)} |
              {alert.exceedsByPercent}% over
            </p>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

export default function EdgePage() {
  const [period, setPeriod] = useState('90');

  const { data: edgeData, isLoading: edgeLoading } = useQuery({
    queryKey: ['edge-analysis', period],
    queryFn: () => api.getEdgeAnalysis(parseInt(period)),
  });

  const { data: timeAlerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['time-alerts'],
    queryFn: () => api.getTimeAlerts(),
  });

  const { data: holdAnalysis, isLoading: holdLoading } = useQuery({
    queryKey: ['hold-time-analysis', period],
    queryFn: () => api.getHoldTimeAnalysis(parseInt(period)),
  });

  if (edgeLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  const edge = edgeData as EdgeAnalysis & { success: boolean };
  const summary = edge?.edgeSummary;
  const overall = edge?.overall;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edge Analysis</h1>
          <p className="text-muted-foreground">Understand where your actual edge is</p>
        </div>
        <Select value={period} onValueChange={(val) => val && setPeriod(val)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="60">60 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
            <SelectItem value="180">180 days</SelectItem>
            <SelectItem value="365">1 year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Overall P&L"
            value={summary.overallPnLFormatted}
            icon={summary.overallPnL >= 0 ? TrendingUp : TrendingDown}
            trend={summary.overallPnL >= 0 ? 'up' : 'down'}
          />
          <StatCard
            title="Win Rate"
            value={`${summary.winRate}%`}
            subtitle={`${overall?.wins || 0}W / ${overall?.losses || 0}L`}
            icon={Target}
            trend={summary.winRate >= 50 ? 'up' : 'down'}
          />
          <StatCard
            title="Expectancy"
            value={formatCurrency(summary.expectancy)}
            subtitle="per trade"
            icon={BarChart3}
            trend={summary.expectancy >= 0 ? 'up' : 'down'}
          />
          <StatCard
            title="Profit Factor"
            value={String(summary.profitFactor)}
            icon={TrendingUp}
            trend={typeof summary.profitFactor === 'number' && summary.profitFactor >= 1 ? 'up' : 'down'}
          />
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-profit" />
                Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary.strengths.length > 0 ? (
                <ul className="space-y-2">
                  {summary.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ArrowUp className="h-4 w-4 text-profit mt-0.5 flex-shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">Keep trading to discover your strengths</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-loss" />
                Areas to Improve
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary.weaknesses.length > 0 ? (
                <ul className="space-y-2">
                  {summary.weaknesses.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ArrowDown className="h-4 w-4 text-loss mt-0.5 flex-shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">No major weaknesses detected</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="time">
        <TabsList>
          <TabsTrigger value="time">By Time</TabsTrigger>
          <TabsTrigger value="symbol">By Symbol</TabsTrigger>
          <TabsTrigger value="setup">By Setup</TabsTrigger>
          <TabsTrigger value="emotion">By Emotion</TabsTrigger>
          <TabsTrigger value="holdtime">Hold Time</TabsTrigger>
        </TabsList>

        <TabsContent value="time" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  By Hour
                </CardTitle>
                <CardDescription>{edge?.byHour?.recommendation}</CardDescription>
              </CardHeader>
              <CardContent>
                <EdgeStatsTable 
                  data={edge?.byHour?.all || []} 
                  labelKey="label" 
                  labelName="Hour" 
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  By Day of Week
                </CardTitle>
                <CardDescription>{edge?.byDayOfWeek?.recommendation}</CardDescription>
              </CardHeader>
              <CardContent>
                <EdgeStatsTable 
                  data={edge?.byDayOfWeek?.all || []} 
                  labelKey="dayName" 
                  labelName="Day" 
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="symbol">
          <Card>
            <CardHeader>
              <CardTitle>Symbol Performance</CardTitle>
              <CardDescription>{edge?.bySymbol?.recommendation}</CardDescription>
            </CardHeader>
            <CardContent>
              <EdgeStatsTable 
                data={edge?.bySymbol?.all || []} 
                labelKey="symbol" 
                labelName="Symbol" 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="setup">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Setup Performance
              </CardTitle>
              <CardDescription>{edge?.bySetup?.recommendation}</CardDescription>
            </CardHeader>
            <CardContent>
              <EdgeStatsTable 
                data={edge?.bySetup?.all || []} 
                labelKey="setup" 
                labelName="Setup/Tag" 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emotion">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Emotion Impact
              </CardTitle>
              <CardDescription>{edge?.byEmotion?.recommendation}</CardDescription>
            </CardHeader>
            <CardContent>
              <EdgeStatsTable 
                data={edge?.byEmotion?.all || []} 
                labelKey="emotion" 
                labelName="Emotion" 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holdtime" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5" />
                Overheld Trade Alerts
              </CardTitle>
              <CardDescription>
                Trades exceeding your average hold time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <Skeleton className="h-20" />
              ) : (
                <TimeAlertsCard alerts={timeAlerts?.alerts || []} />
              )}
            </CardContent>
          </Card>

          {holdAnalysis && !holdLoading && (
            <Card>
              <CardHeader>
                <CardTitle>Hold Time Analysis: Winners vs Losers</CardTitle>
                <CardDescription>{holdAnalysis.lossAversionMessage}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2 text-profit">Winners</h4>
                    {holdAnalysis.winners ? (
                      <div className="space-y-1 text-sm">
                        <p>Avg hold: <span className="font-mono">{formatDuration(holdAnalysis.winners.avgMinutes)}</span></p>
                        <p>Median: <span className="font-mono">{formatDuration(holdAnalysis.winners.medianMinutes)}</span></p>
                        <p>Range: <span className="font-mono">{formatDuration(holdAnalysis.winners.minMinutes)} - {formatDuration(holdAnalysis.winners.maxMinutes)}</span></p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No data</p>
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium mb-2 text-loss">Losers</h4>
                    {holdAnalysis.losers ? (
                      <div className="space-y-1 text-sm">
                        <p>Avg hold: <span className="font-mono">{formatDuration(holdAnalysis.losers.avgMinutes)}</span></p>
                        <p>Median: <span className="font-mono">{formatDuration(holdAnalysis.losers.medianMinutes)}</span></p>
                        <p>Range: <span className="font-mono">{formatDuration(holdAnalysis.losers.minMinutes)} - {formatDuration(holdAnalysis.losers.maxMinutes)}</span></p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No data</p>
                    )}
                  </div>
                </div>
                {holdAnalysis.lossAversionRatio && (
                  <div className="mt-4 p-3 bg-muted rounded-md">
                    <p className="text-sm">
                      <strong>Loss Aversion Ratio:</strong>{' '}
                      <span className={holdAnalysis.lossAversionRatio > 1.5 ? 'text-loss' : 'text-profit'}>
                        {holdAnalysis.lossAversionRatio}x
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {holdAnalysis.recommendation}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
