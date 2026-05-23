'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { Trade } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface EquityCurveProps {
  trades: Trade[];
}

export function EquityCurve({ trades }: EquityCurveProps) {
  const chartData = useMemo(() => {
    const sortedTrades = [...trades]
      .filter(t => t.profitLoss !== undefined)
      .sort((a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime());

    let cumulative = 0;
    return sortedTrades.map((trade, index) => {
      cumulative += trade.profitLoss || 0;
      return {
        index: index + 1,
        date: format(new Date(trade.tradeDate), 'MMM d'),
        pnl: trade.profitLoss || 0,
        cumulative,
        symbol: trade.symbol,
      };
    });
  }, [trades]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No closed trades to display
      </div>
    );
  }

  const minValue = Math.min(0, ...chartData.map(d => d.cumulative));
  const maxValue = Math.max(0, ...chartData.map(d => d.cumulative));
  const padding = (maxValue - minValue) * 0.1 || 1000;

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => 
              Math.abs(value) >= 1000 
                ? `${(value / 1000).toFixed(0)}k` 
                : value.toFixed(0)
            }
            domain={[minValue - padding, maxValue + padding]}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const data = payload[0].payload;
              return (
                <div className="rounded-md border border-border/50 bg-popover p-3 shadow-md">
                  <p className="text-sm font-medium">{data.symbol}</p>
                  <p className="text-xs text-muted-foreground">{data.date}</p>
                  <div className="mt-1 space-y-1">
                    <p className={`text-sm font-mono-numbers ${data.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      Trade: {formatCurrency(data.pnl)}
                    </p>
                    <p className={`text-sm font-mono-numbers font-medium ${data.cumulative >= 0 ? 'text-profit' : 'text-loss'}`}>
                      Total: {formatCurrency(data.cumulative)}
                    </p>
                  </div>
                </div>
              );
            }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 4,
              fill: 'hsl(var(--primary))',
              stroke: 'hsl(var(--background))',
              strokeWidth: 2,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
