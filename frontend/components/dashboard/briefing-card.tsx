'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  AlertTriangle, 
  Target, 
  RefreshCw, 
  Mail, 
  Loader2,
  TrendingUp,
  TrendingDown,
  Ban,
  Zap,
  BarChart3,
  Shield
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import api from '@/lib/api';
import { cn, getPnLColor, formatCurrency } from '@/lib/utils';

export function BriefingCard() {
  const [expanded, setExpanded] = useState(true);
  const queryClient = useQueryClient();

  const { data: briefing, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['briefing'],
    queryFn: () => api.getBriefing(),
  });

  const sendEmailMutation = useMutation({
    mutationFn: () => api.sendBriefingEmail(),
    onSuccess: (data) => {
      if (data.deliveryResult.method === 'email') {
        alert('Briefing sent to your email!');
      } else {
        alert('Email not configured. Briefing was logged to console.');
      }
    },
    onError: (error: Error) => {
      alert(`Failed to send email: ${error.message}`);
    },
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleSendEmail = () => {
    sendEmailMutation.mutate();
  };

  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (!briefing) {
    return null;
  }

  const hasAvoidItems = briefing.gamePlan?.avoid && briefing.gamePlan.avoid.length > 0;
  const hasFocusItems = briefing.gamePlan?.focus && briefing.gamePlan.focus.length > 0;

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
            {briefing.tradingStyle && briefing.tradingStyle !== 'UNKNOWN' && (
              <Badge variant="outline" className="text-xs">
                <BarChart3 className="h-3 w-3 mr-1" />
                {briefing.tradingStyle}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              title="Refresh briefing"
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSendEmail}
              disabled={sendEmailMutation.isPending}
              title="Send to email"
            >
              {sendEmailMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
            </Button>
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
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Yesterday's Summary */}
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

            {briefing.bestHours && briefing.bestHours.hours.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Best Hours
                </p>
                <div className="flex flex-wrap gap-1">
                  {briefing.bestHours.hours.map((h) => (
                    <Badge key={h.hour} variant="outline" className="text-xs text-success border-success/30">
                      {h.hour}:00 ({h.winRate}%)
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {briefing.rulesViolated && briefing.rulesViolated.count > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3 w-3 text-warning" /> Rules Violated Yesterday
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

          {/* Day of Week Warning */}
          {briefing.dayOfWeekWarning && (
            <>
              <Separator />
              <div className="flex items-center gap-2 rounded-md bg-warning/10 p-3">
                <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                <p className="text-sm text-warning">
                  {briefing.dayOfWeekWarning.warning}
                </p>
              </div>
            </>
          )}

          {/* Game Plan - Avoid Section */}
          {hasAvoidItems && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-destructive flex items-center gap-1">
                  <Ban className="h-3 w-3" /> Avoid Today
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {briefing.gamePlan!.avoid.map((item, i) => (
                    <div 
                      key={i} 
                      className="flex items-start gap-2 rounded-md bg-destructive/5 border border-destructive/20 p-2"
                    >
                      {item.reason === 'TIME' && <Clock className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />}
                      {item.reason === 'SYMBOL' && <TrendingDown className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />}
                      {item.reason === 'DAY' && <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-destructive">{item.message}</p>
                        {item.data?.pnl !== undefined && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            P&L: {formatCurrency(item.data.pnl)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Game Plan - Focus Section */}
          {hasFocusItems && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-success flex items-center gap-1">
                  <Target className="h-3 w-3" /> Focus Today
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {briefing.gamePlan!.focus.slice(0, 6).map((item, i) => (
                    <div 
                      key={i} 
                      className="flex items-start gap-2 rounded-md bg-success/5 border border-success/20 p-2"
                    >
                      {item.type === 'BEST_HOUR' && <Clock className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />}
                      {item.type === 'BEST_SYMBOL' && <TrendingUp className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />}
                      {item.type === 'AI_FOCUS' && <Zap className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-success">{item.message}</p>
                        {item.data?.pnl !== undefined && item.data.pnl > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            P&L: +{formatCurrency(item.data.pnl)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Rules to Focus On (from Game Plan) */}
          {briefing.gamePlan?.rules && briefing.gamePlan.rules.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-warning flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Rules to Follow Today
                </p>
                {briefing.gamePlan.rules.map((item, i) => (
                  <div 
                    key={i} 
                    className="flex items-center gap-2 rounded-md bg-warning/10 p-2"
                  >
                    <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                    <p className="text-sm text-warning">{item.message}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Legacy Focus Areas (fallback if no game plan) */}
          {!hasFocusItems && briefing.focusAreas?.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Target className="h-3 w-3" /> Focus Areas
                </p>
                <ul className="space-y-1">
                  {briefing.focusAreas.map((area, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <Zap className="h-3 w-3 text-primary" />
                      {area}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Motivational Message */}
          <Separator />
          <p className="text-sm italic text-muted-foreground text-center">
            &quot;{briefing.motivationalMessage}&quot;
          </p>
        </CardContent>
      )}
    </Card>
  );
}
