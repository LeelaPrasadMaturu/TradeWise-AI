'use client';

import { useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency } from '@/lib/utils';
import { Trade } from '@/types';

interface PnLCalendarProps {
  trades: Trade[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onDayClick?: (date: Date, trades: Trade[]) => void;
}

export function PnLCalendar({
  trades,
  currentMonth,
  onMonthChange,
  onDayClick,
}: PnLCalendarProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const pnlByDay = useMemo(() => {
    const map = new Map<string, { pnl: number; trades: Trade[]; wins: number; losses: number }>();
    
    trades.forEach((trade) => {
      const dateKey = format(new Date(trade.tradeDate), 'yyyy-MM-dd');
      const existing = map.get(dateKey) || { pnl: 0, trades: [], wins: 0, losses: 0 };
      
      existing.pnl += trade.profitLoss || 0;
      existing.trades.push(trade);
      if (trade.result === 'win') existing.wins++;
      if (trade.result === 'loss') existing.losses++;
      
      map.set(dateKey, existing);
    });
    
    return map;
  }, [trades]);

  const monthStats = useMemo(() => {
    let totalPnL = 0;
    let tradeCount = 0;
    let wins = 0;
    let losses = 0;

    pnlByDay.forEach((day, dateKey) => {
      const date = new Date(dateKey);
      if (isSameMonth(date, currentMonth)) {
        totalPnL += day.pnl;
        tradeCount += day.trades.length;
        wins += day.wins;
        losses += day.losses;
      }
    });

    const winRate = tradeCount > 0 ? (wins / (wins + losses)) * 100 : 0;

    return { totalPnL, tradeCount, wins, losses, winRate };
  }, [pnlByDay, currentMonth]);

  const maxPnL = useMemo(() => {
    let max = 0;
    pnlByDay.forEach((day) => {
      max = Math.max(max, Math.abs(day.pnl));
    });
    return max || 1;
  }, [pnlByDay]);

  const getColorIntensity = (pnl: number) => {
    const intensity = Math.min(Math.abs(pnl) / maxPnL, 1);
    if (pnl > 0) {
      return `rgba(34, 197, 94, ${0.2 + intensity * 0.6})`;
    } else if (pnl < 0) {
      return `rgba(239, 68, 68, ${0.2 + intensity * 0.6})`;
    }
    return 'transparent';
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMonthChange(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/50">
          {weekDays.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayData = pnlByDay.get(dateKey);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={index}
                className={cn(
                  'min-h-[80px] border-t border-l border-border/30 p-1 transition-colors',
                  !isCurrentMonth && 'bg-muted/30',
                  isToday && 'ring-1 ring-primary ring-inset',
                  dayData && onDayClick && 'cursor-pointer hover:bg-muted/50'
                )}
                style={{
                  backgroundColor: dayData && isCurrentMonth
                    ? getColorIntensity(dayData.pnl)
                    : undefined,
                }}
                onClick={() => dayData && onDayClick?.(day, dayData.trades)}
              >
                <div className={cn(
                  'text-xs',
                  !isCurrentMonth && 'text-muted-foreground/50',
                  isToday && 'font-bold text-primary'
                )}>
                  {format(day, 'd')}
                </div>
                {dayData && isCurrentMonth && (
                  <div className="mt-1 space-y-0.5">
                    <div className={cn(
                      'text-xs font-mono-numbers font-medium',
                      dayData.pnl >= 0 ? 'text-profit' : 'text-loss'
                    )}>
                      {dayData.pnl >= 0 ? '+' : ''}
                      {Math.abs(dayData.pnl) >= 1000
                        ? `${(dayData.pnl / 1000).toFixed(1)}k`
                        : dayData.pnl.toFixed(0)
                      }
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {dayData.wins}W/{dayData.losses}L
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-md border border-border/50 p-3">
          <p className="text-xs text-muted-foreground">Total P&L</p>
          <p className={cn(
            'text-lg font-semibold font-mono-numbers',
            monthStats.totalPnL >= 0 ? 'text-profit' : 'text-loss'
          )}>
            {formatCurrency(monthStats.totalPnL)}
          </p>
        </div>
        <div className="rounded-md border border-border/50 p-3">
          <p className="text-xs text-muted-foreground">Win Rate</p>
          <p className="text-lg font-semibold font-mono-numbers">
            {monthStats.winRate.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-md border border-border/50 p-3">
          <p className="text-xs text-muted-foreground">Trades</p>
          <p className="text-lg font-semibold font-mono-numbers">
            {monthStats.tradeCount}
          </p>
        </div>
        <div className="rounded-md border border-border/50 p-3">
          <p className="text-xs text-muted-foreground">W/L</p>
          <p className="text-lg font-semibold">
            <span className="text-profit">{monthStats.wins}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-loss">{monthStats.losses}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-profit/40" />
          <span>Profit</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-loss/40" />
          <span>Loss</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded border border-border/50" />
          <span>No trades</span>
        </div>
      </div>
    </div>
  );
}
