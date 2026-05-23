'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BehavioralScore } from '@/components/analytics/behavioral-score';
import { PatternCard } from '@/components/analytics/pattern-card';
import { EquityCurve } from '@/components/analytics/equity-curve';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d');

  const { data: behavioral, isLoading: behavioralLoading } = useQuery({
    queryKey: ['behavioral-patterns', period],
    queryFn: () => api.getBehavioralPatterns(period),
  });

  const { data: tradesData, isLoading: tradesLoading } = useQuery({
    queryKey: ['trades-all'],
    queryFn: () => api.getTrades({ limit: 500, sort: '-tradeDate' }),
  });

  const isLoading = behavioralLoading || tradesLoading;
  const trades = tradesData?.data || [];

  const negativePatterns = behavioral?.patternsDetected.filter(
    p => !p.type.includes('POSITIVE')
  ) || [];

  const positivePatterns = behavioral?.positivePatterns || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Behavioral Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Understand your trading patterns and improve your performance
          </p>
        </div>
        <Select value={period} onValueChange={(value) => value && setPeriod(value)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 days</SelectItem>
            <SelectItem value="14d">14 days</SelectItem>
            <SelectItem value="30d">30 days</SelectItem>
            <SelectItem value="60d">60 days</SelectItem>
            <SelectItem value="90d">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Score Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[120px] w-full" />
            ) : (
              <BehavioralScore
                score={behavioral?.behavioralScore || 0}
                tradingStyle={behavioral?.tradingStyle}
                styleConfidence={behavioral?.styleConfidence}
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Baseline Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[120px] w-full" />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Avg Daily Trades</p>
                  <p className="text-lg font-semibold font-mono-numbers">
                    {behavioral?.baseline?.avgDailyTradeCount?.toFixed(1) || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Baseline Win Rate</p>
                  <p className="text-lg font-semibold font-mono-numbers">
                    {behavioral?.baseline?.baselineWinRate?.toFixed(1) || '-'}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Position Size</p>
                  <p className="text-lg font-semibold font-mono-numbers">
                    {behavioral?.baseline?.avgPositionSize 
                      ? `₹${(behavioral.baseline.avgPositionSize / 1000).toFixed(1)}k`
                      : '-'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Hold Duration</p>
                  <p className="text-lg font-semibold font-mono-numbers">
                    {behavioral?.baseline?.avgHoldDurationMinutes
                      ? behavioral.baseline.avgHoldDurationMinutes < 60
                        ? `${Math.round(behavioral.baseline.avgHoldDurationMinutes)}m`
                        : `${(behavioral.baseline.avgHoldDurationMinutes / 60).toFixed(1)}h`
                      : '-'
                    }
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Equity Curve</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <EquityCurve trades={trades} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Detected Patterns</h2>
            <Badge variant="secondary">
              {negativePatterns.length} issues
            </Badge>
          </div>
          
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-[100px] w-full" />
              ))}
            </div>
          ) : negativePatterns.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-8 text-center">
                <CheckCircle className="mx-auto h-8 w-8 text-profit mb-2" />
                <p className="text-sm text-muted-foreground">
                  No negative patterns detected
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {negativePatterns.map((pattern, index) => (
                <PatternCard key={index} pattern={pattern} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Positive Patterns</h2>
            <Badge variant="secondary" className="bg-profit/20 text-profit">
              {positivePatterns.length} strengths
            </Badge>
          </div>
          
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-[80px] w-full" />
              ))}
            </div>
          ) : positivePatterns.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Keep trading to identify your strengths
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {positivePatterns.map((pattern, index) => (
                <Card key={index} className="border border-profit/30 bg-profit/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-profit" />
                      <span className="font-medium text-profit">
                        {pattern.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pattern.message}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {behavioral?.recommendations && behavioral.recommendations.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {behavioral.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      'text-xs mt-0.5',
                      rec.priority === 'high' && 'border-loss/50 text-loss',
                      rec.priority === 'medium' && 'border-warning/50 text-warning'
                    )}
                  >
                    {rec.priority}
                  </Badge>
                  <span className="text-sm">{rec.recommendation}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
