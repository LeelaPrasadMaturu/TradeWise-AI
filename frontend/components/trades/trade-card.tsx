'use client';

import Link from 'next/link';
import { MoreVertical, Pencil, Trash2, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Trade } from '@/types';

interface TradeCardProps {
  trade: Trade;
  onView?: (trade: Trade) => void;
  onEdit?: (trade: Trade) => void;
  onDelete?: (trade: Trade) => void;
}

export function TradeCard({ trade, onView, onEdit, onDelete }: TradeCardProps) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{trade.symbol}</span>
              <Badge 
                variant={trade.direction === 'long' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {trade.direction}
              </Badge>
              <Badge 
                variant={
                  trade.result === 'win' ? 'default' :
                  trade.result === 'loss' ? 'destructive' :
                  trade.result === 'open' ? 'outline' : 'secondary'
                }
                className="text-xs"
              >
                {trade.result || 'open'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDate(trade.tradeDate)}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {trade.profitLoss !== undefined && (
              <span className={`font-mono-numbers font-semibold ${
                trade.profitLoss >= 0 ? 'text-profit' : 'text-loss'
              }`}>
                {formatCurrency(trade.profitLoss)}
              </span>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onView && (
                  <DropdownMenuItem onClick={() => onView(trade)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </DropdownMenuItem>
                )}
                <Link href={`/journal?edit=${trade._id}`}>
                  <DropdownMenuItem>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                </Link>
                {onDelete && (
                  <DropdownMenuItem 
                    className="text-destructive"
                    onClick={() => onDelete(trade)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Entry</p>
            <p className="font-mono-numbers">{trade.entryPrice.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Exit</p>
            <p className="font-mono-numbers">
              {trade.exitPrice ? trade.exitPrice.toFixed(2) : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Qty</p>
            <p className="font-mono-numbers">{trade.quantity}</p>
          </div>
        </div>
        
        {trade.reason && (
          <p className="mt-3 text-xs text-muted-foreground line-clamp-2">
            {trade.reason}
          </p>
        )}
        
        {trade.tags && trade.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {trade.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {trade.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{trade.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TradeCard;
