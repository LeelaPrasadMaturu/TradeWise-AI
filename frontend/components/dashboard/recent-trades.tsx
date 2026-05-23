'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import api from '@/lib/api';
import { formatCurrency, formatDate, cn, getPnLColor } from '@/lib/utils';

export function RecentTrades() {
  const { data, isLoading } = useQuery({
    queryKey: ['recent-trades'],
    queryFn: () => api.getTrades({ limit: 5, sort: '-tradeDate' }),
  });

  const trades = data?.data || [];

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">Recent Trades</CardTitle>
        <Link href="/trades">
          <Button variant="ghost" size="sm" className="text-sm text-muted-foreground hover:text-foreground">
            View all
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : trades.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No trades yet</p>
            <Link href="/journal">
              <Button variant="outline" size="sm" className="mt-2">
                Log your first trade
              </Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Symbol</TableHead>
                <TableHead className="text-xs">Direction</TableHead>
                <TableHead className="text-xs text-right">P&L</TableHead>
                <TableHead className="text-xs">Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade) => (
                <TableRow key={trade._id} className="hover:bg-muted/50">
                  <TableCell className="text-sm font-mono-numbers">
                    {formatDate(trade.tradeDate, 'MMM d')}
                  </TableCell>
                  <TableCell className="font-medium">{trade.symbol}</TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className={cn('text-right font-mono-numbers', getPnLColor(trade.profitLoss || 0))}>
                    {trade.profitLoss !== undefined 
                      ? formatCurrency(trade.profitLoss)
                      : '-'
                    }
                  </TableCell>
                  <TableCell>
                    {trade.result && trade.result !== 'open' ? (
                      <Badge 
                        variant={trade.result === 'win' ? 'default' : 'destructive'}
                        className={cn(
                          'text-xs',
                          trade.result === 'win' && 'bg-profit/20 text-profit hover:bg-profit/30',
                          trade.result === 'loss' && 'bg-loss/20 text-loss hover:bg-loss/30'
                        )}
                      >
                        {trade.result.toUpperCase()}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">OPEN</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
