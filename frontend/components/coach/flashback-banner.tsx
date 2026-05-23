'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronUp, X, TrendingDown, Clock, Brain, Zap } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { FlashbackWarning } from '@/types';

const warningIcons: Record<string, React.ElementType> = {
  SYMBOL_HISTORY: TrendingDown,
  SYMBOL_LOSING: TrendingDown,
  BAD_HOUR: Clock,
  BAD_DAY: Clock,
  FIRST_TRADE_SYNDROME: Zap,
  LOSS_STREAK: AlertTriangle,
  NEGATIVE_EMOTION: Brain,
  REVENGE_TRADING: Brain,
  TILT_STREAK: Brain,
  OVERTRADING: AlertTriangle,
};

const severityColors = {
  high: 'border-red-500/50 bg-red-500/10',
  medium: 'border-amber-500/50 bg-amber-500/10',
  low: 'border-blue-500/50 bg-blue-500/10',
};

const severityBadgeVariants = {
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
} as const;

interface FlashbackBannerProps {
  symbol?: string;
  emotion?: string;
  onDismiss?: () => void;
}

function WarningCard({ warning }: { warning: FlashbackWarning }) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = warningIcons[warning.type] || AlertTriangle;

  return (
    <Card className={`border ${severityColors[warning.severity]}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full ${
              warning.severity === 'high' ? 'bg-red-500/20' :
              warning.severity === 'medium' ? 'bg-amber-500/20' : 'bg-blue-500/20'
            }`}>
              <Icon className={`h-4 w-4 ${
                warning.severity === 'high' ? 'text-red-500' :
                warning.severity === 'medium' ? 'text-amber-500' : 'text-blue-500'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-medium text-sm">{warning.title}</h4>
                <Badge variant={severityBadgeVariants[warning.severity]} className="text-xs">
                  {warning.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{warning.message}</p>
              
              {(warning.detail || warning.recentTrades) && (
                <CollapsibleTrigger>
                  <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs">
                    {isOpen ? (
                      <>Less <ChevronUp className="h-3 w-3 ml-1" /></>
                    ) : (
                      <>More details <ChevronDown className="h-3 w-3 ml-1" /></>
                    )}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
          </div>
          
          <CollapsibleContent>
            <div className="mt-3 pl-11 space-y-2">
              {warning.detail && (
                <p className="text-xs text-muted-foreground">{warning.detail}</p>
              )}
              
              {warning.recentTrades && warning.recentTrades.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium">Recent trades:</p>
                  {warning.recentTrades.map((trade, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{formatDate(trade.date)}</span>
                      <span className={trade.pnl >= 0 ? 'text-profit' : 'text-loss'}>
                        {formatCurrency(trade.pnl)}
                      </span>
                      {trade.reason && (
                        <span className="text-muted-foreground truncate max-w-32">
                          {trade.reason}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}

export function FlashbackBanner({ symbol, emotion, onDismiss }: FlashbackBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['flashback', symbol, emotion],
    queryFn: () => api.getFlashback({ symbol, emotion }),
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });

  if (isLoading || isDismissed || !data?.hasWarnings) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const highSeverity = data.warnings.filter(w => w.severity === 'high');
  const otherWarnings = data.warnings.filter(w => w.severity !== 'high');

  return (
    <div className="space-y-3">
      {highSeverity.length > 0 && (
        <Alert variant="destructive" className="relative">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between">
            <span>Warning: {data.highSeverityCount} High-Risk Alert{data.highSeverityCount > 1 ? 's' : ''}</span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertTitle>
          <AlertDescription>
            Review these warnings before entering a trade. Past behavior suggests caution.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {data.warnings.slice(0, 4).map((warning, index) => (
          <WarningCard key={`${warning.type}-${index}`} warning={warning} />
        ))}
      </div>

      {data.warnings.length > 4 && (
        <p className="text-xs text-muted-foreground text-center">
          +{data.warnings.length - 4} more warnings
        </p>
      )}
    </div>
  );
}

export default FlashbackBanner;
