'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal, ArrowUpDown, Eye, Pencil, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { TradeCard } from './trade-card';
import { Trade } from '@/types';
import { formatCurrency, formatDate, cn, getPnLColor, truncateText } from '@/lib/utils';
import api from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface TradeTableProps {
  trades: Trade[];
  isLoading: boolean;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
}

export function TradeTable({
  trades,
  isLoading,
  sortField,
  sortDirection,
  onSort,
}: TradeTableProps) {
  const [deleteTradeId, setDeleteTradeId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTrade(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      setDeleteTradeId(null);
    },
  });

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 text-xs font-medium"
      onClick={() => onSort(field)}
    >
      {children}
      <ArrowUpDown className={cn(
        'ml-1 h-3 w-3',
        sortField === field && 'text-primary'
      )} />
    </Button>
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No trades found</p>
        <Link href="/journal">
          <Button variant="outline" className="mt-4">
            Log your first trade
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {trades.map((trade) => (
          <TradeCard
            key={trade._id}
            trade={trade}
            onDelete={(t) => setDeleteTradeId(t._id)}
          />
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[100px]">
                <SortableHeader field="tradeDate">Date</SortableHeader>
              </TableHead>
              <TableHead>
                <SortableHeader field="symbol">Symbol</SortableHeader>
              </TableHead>
              <TableHead>Direction</TableHead>
              <TableHead className="text-right">Entry</TableHead>
              <TableHead className="text-right">Exit</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">
                <SortableHeader field="profitLoss">P&L</SortableHeader>
              </TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Emotion</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((trade) => (
              <TableRow key={trade._id} className="hover:bg-muted/50">
                <TableCell className="font-mono-numbers text-sm">
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
                <TableCell className="text-right font-mono-numbers">
                  {formatCurrency(trade.entryPrice).replace('₹', '')}
                </TableCell>
                <TableCell className="text-right font-mono-numbers">
                  {trade.exitPrice 
                    ? formatCurrency(trade.exitPrice).replace('₹', '')
                    : '-'
                  }
                </TableCell>
                <TableCell className="text-right font-mono-numbers">
                  {trade.quantity}
                </TableCell>
                <TableCell className={cn(
                  'text-right font-mono-numbers font-medium',
                  getPnLColor(trade.profitLoss || 0)
                )}>
                  {trade.profitLoss !== undefined
                    ? formatCurrency(trade.profitLoss)
                    : '-'
                  }
                </TableCell>
                <TableCell>
                  {trade.result && trade.result !== 'open' ? (
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-xs',
                        trade.result === 'win' && 'bg-profit/20 text-profit',
                        trade.result === 'loss' && 'bg-loss/20 text-loss',
                        trade.result === 'breakeven' && 'bg-muted text-muted-foreground'
                      )}
                    >
                      {trade.result.toUpperCase()}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      OPEN
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {trade.emotionAnalysis?.detected && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        trade.emotionAnalysis.detected === 'positive' && 'border-profit/50 text-profit',
                        trade.emotionAnalysis.detected === 'negative' && 'border-loss/50 text-loss',
                        trade.emotionAnalysis.detected === 'neutral' && 'border-muted-foreground/50'
                      )}
                    >
                      {trade.emotionAnalysis.detected}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <Link href={`/trades/${trade._id}`}>
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" />
                          View details
                        </DropdownMenuItem>
                      </Link>
                      <Link href={`/journal?edit=${trade._id}`}>
                        <DropdownMenuItem>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteTradeId(trade._id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTradeId} onOpenChange={() => setDeleteTradeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete trade?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this trade
              from your journal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTradeId && deleteMutation.mutate(deleteTradeId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
