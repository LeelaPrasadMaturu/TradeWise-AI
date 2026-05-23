'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { PnLCalendar } from '@/components/calendar/pnl-calendar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import { Trade } from '@/types';
import { formatCurrency, cn, getPnLColor } from '@/lib/utils';

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<{ date: Date; trades: Trade[] } | null>(null);

  const startDate = format(startOfMonth(subMonths(currentMonth, 2)), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['trades-calendar', startDate, endDate],
    queryFn: () => api.getTrades({
      startDate,
      endDate,
      limit: 1000,
    }),
  });

  const trades = data?.data || [];

  const handleDayClick = (date: Date, dayTrades: Trade[]) => {
    setSelectedDay({ date, trades: dayTrades });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">P&L Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Visualize your daily trading performance
        </p>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-[400px] w-full" />
            </div>
          ) : (
            <PnLCalendar
              trades={trades}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              onDayClick={handleDayClick}
            />
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {selectedDay && format(selectedDay.date, 'EEEE, MMMM d, yyyy')}
            </SheetTitle>
          </SheetHeader>
          
          {selectedDay && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Day P&L</p>
                  <p className={cn(
                    'text-lg font-semibold font-mono-numbers',
                    getPnLColor(selectedDay.trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0))
                  )}>
                    {formatCurrency(selectedDay.trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0))}
                  </p>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Trades</p>
                  <p className="text-lg font-semibold">
                    {selectedDay.trades.length}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium">Trades</h4>
                {selectedDay.trades.map((trade) => (
                  <div
                    key={trade._id}
                    className="rounded-md border border-border/50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{trade.symbol}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            trade.direction === 'long'
                              ? 'border-profit/50 text-profit'
                              : 'border-loss/50 text-loss'
                          )}
                        >
                          {trade.direction.toUpperCase()}
                        </Badge>
                      </div>
                      <span className={cn(
                        'font-mono-numbers font-medium',
                        getPnLColor(trade.profitLoss || 0)
                      )}>
                        {trade.profitLoss !== undefined
                          ? formatCurrency(trade.profitLoss)
                          : '-'
                        }
                      </span>
                    </div>
                    {trade.reason && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        {trade.reason}
                      </p>
                    )}
                    {trade.emotionAnalysis?.detected && (
                      <Badge variant="secondary" className="mt-2 text-xs">
                        {trade.emotionAnalysis.detected}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
