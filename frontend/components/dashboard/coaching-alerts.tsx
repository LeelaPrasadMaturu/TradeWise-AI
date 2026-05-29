'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Info, AlertCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

const severityConfig = {
  info: {
    icon: Info,
    className: 'border-info/50 bg-info/5',
    iconClassName: 'text-info',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-warning/50 bg-warning/5',
    iconClassName: 'text-warning',
  },
  high: {
    icon: AlertCircle,
    className: 'border-loss/50 bg-loss/5',
    iconClassName: 'text-loss',
  },
  critical: {
    icon: XCircle,
    className: 'border-loss/50 bg-loss/10',
    iconClassName: 'text-loss',
  },
};

export function CoachingAlerts() {
  const { data, isLoading } = useQuery({
    queryKey: ['coaching-alerts'],
    queryFn: () => api.getAlerts(),
    refetchInterval: 60000,
  });

  const alerts = data?.alerts || [];

  if (isLoading) {
    return <Skeleton className="h-[100px] w-full" />;
  }

  if (alerts.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Active Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert, index) => {
          const config = severityConfig[alert.severity] || severityConfig.info;
          const Icon = config.icon;

          return (
            <Alert key={index} className={cn('border', config.className)}>
              <Icon className={cn('h-4 w-4', config.iconClassName)} />
              <AlertTitle className="text-sm font-medium">
                {alert.ruleName || alert.type.replace(/_/g, ' ')}
              </AlertTitle>
              <AlertDescription className="text-sm text-muted-foreground">
                {alert.message}
              </AlertDescription>
            </Alert>
          );
        })}
      </CardContent>
    </Card>
  );
}
