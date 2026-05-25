'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Pencil, 
  Trash2, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Clock,
  Target,
  AlertTriangle,
  Brain,
  FileText,
  Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import api from '@/lib/api';
import { formatCurrency, formatDate, cn, getPnLColor } from '@/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TradeDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: trade, isLoading, error } = useQuery({
    queryKey: ['trade', id],
    queryFn: () => api.getTrade(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTrade(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      router.push('/trades');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !trade) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Trade not found</p>
        <Link href="/trades">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Trades
          </Button>
        </Link>
      </div>
    );
  }

  const pnlColor = getPnLColor(trade.profitLoss || 0);
  const isProfit = (trade.profitLoss || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/trades">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{trade.symbol}</h1>
              <Badge
                variant="outline"
                className={cn(
                  trade.direction === 'long'
                    ? 'border-profit/50 text-profit'
                    : 'border-loss/50 text-loss'
                )}
              >
                {trade.direction?.toUpperCase()}
              </Badge>
              {trade.result && (
                <Badge
                  variant="secondary"
                  className={cn(
                    trade.result === 'win' && 'bg-profit/20 text-profit',
                    trade.result === 'loss' && 'bg-loss/20 text-loss',
                    trade.result === 'breakeven' && 'bg-muted'
                  )}
                >
                  {trade.result.toUpperCase()}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDate(trade.tradeDate, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/journal?edit=${trade._id}`}>
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" />}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this trade?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this trade.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground"
                  onClick={() => deleteMutation.mutate()}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* P&L Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Profit / Loss
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {isProfit ? (
                <TrendingUp className="h-8 w-8 text-profit" />
              ) : (
                <TrendingDown className="h-8 w-8 text-loss" />
              )}
              <span className={cn('text-3xl font-bold', pnlColor)}>
                {formatCurrency(trade.profitLoss || 0)}
              </span>
            </div>
            {trade.riskRewardRatio && (
              <p className="mt-2 text-sm text-muted-foreground">
                R:R Ratio: {trade.riskRewardRatio.toFixed(2)}:1
              </p>
            )}
          </CardContent>
        </Card>

        {/* Trade Details Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Trade Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Entry Price</span>
                <p className="font-mono-numbers font-medium">
                  {formatCurrency(trade.entryPrice)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Exit Price</span>
                <p className="font-mono-numbers font-medium">
                  {trade.exitPrice ? formatCurrency(trade.exitPrice) : '-'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Quantity</span>
                <p className="font-mono-numbers font-medium">{trade.quantity}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Position Value</span>
                <p className="font-mono-numbers font-medium">
                  {formatCurrency(trade.entryPrice * trade.quantity)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Management Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Target className="h-4 w-4" />
              Risk Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Stop Loss</span>
                <p className="font-mono-numbers font-medium">
                  {trade.stopLoss ? formatCurrency(trade.stopLoss) : 'Not set'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Take Profit</span>
                <p className="font-mono-numbers font-medium">
                  {trade.takeProfit ? formatCurrency(trade.takeProfit) : 'Not set'}
                </p>
              </div>
            </div>
            {trade.disciplineScore !== undefined && (
              <div className="pt-2">
                <span className="text-muted-foreground text-sm">Discipline Score</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        'h-full rounded-full',
                        trade.disciplineScore >= 80 && 'bg-profit',
                        trade.disciplineScore >= 50 && trade.disciplineScore < 80 && 'bg-yellow-500',
                        trade.disciplineScore < 50 && 'bg-loss'
                      )}
                      style={{ width: `${trade.disciplineScore}%` }}
                    />
                  </div>
                  <span className="font-medium text-sm">{trade.disciplineScore}%</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Psychology Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Brain className="h-4 w-4" />
              Psychology
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trade.preTradeEmotion && (
              <div>
                <span className="text-muted-foreground text-sm">Pre-Trade Emotion</span>
                <p className="font-medium capitalize">{trade.preTradeEmotion}</p>
              </div>
            )}
            {trade.emotionAnalysis?.detected && (
              <div>
                <span className="text-muted-foreground text-sm">AI Detected Sentiment</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'ml-2',
                    trade.emotionAnalysis.detected === 'positive' && 'border-profit/50 text-profit',
                    trade.emotionAnalysis.detected === 'negative' && 'border-loss/50 text-loss'
                  )}
                >
                  {trade.emotionAnalysis.detected}
                </Badge>
                {trade.emotionAnalysis.confidence && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({(trade.emotionAnalysis.confidence * 100).toFixed(0)}% confidence)
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reason & Notes */}
      {(trade.reason || trade.exitReason || trade.notes) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              Trade Journal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {trade.reason && (
              <div>
                <span className="text-sm text-muted-foreground">Entry Reason</span>
                <p className="mt-1">{trade.reason}</p>
              </div>
            )}
            {trade.exitReason && (
              <div>
                <span className="text-sm text-muted-foreground">Exit Reason</span>
                <p className="mt-1">{trade.exitReason}</p>
              </div>
            )}
            {trade.notes && (
              <div>
                <span className="text-sm text-muted-foreground">Notes</span>
                <p className="mt-1">{trade.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tags */}
      {trade.tags && trade.tags.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Tag className="h-4 w-4" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {trade.tags.map((tag, index) => (
                <Badge key={index} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Analysis */}
      {trade.postTradeAnalysis?.summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Brain className="h-4 w-4" />
              AI Post-Trade Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p>{trade.postTradeAnalysis.summary}</p>
            </div>
            
            {trade.postTradeAnalysis.recommendations && 
             trade.postTradeAnalysis.recommendations.length > 0 && (
              <div>
                <span className="text-sm font-medium">Recommendations</span>
                <ul className="mt-2 space-y-1">
                  {trade.postTradeAnalysis.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-profit">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {trade.postTradeAnalysis.behavioralWarnings && 
             trade.postTradeAnalysis.behavioralWarnings.length > 0 && (
              <div>
                <span className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Behavioral Warnings
                </span>
                <ul className="mt-2 space-y-2">
                  {trade.postTradeAnalysis.behavioralWarnings.map((warning, index) => (
                    <li key={index} className="text-sm p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
                      <span className="font-medium">{warning.type}</span>
                      <p className="text-muted-foreground">{warning.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Post-Trade Review */}
      {trade.postTradeReview && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Post-Trade Review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trade.postTradeReview.planFollowed !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Plan Followed:</span>
                <Badge variant={trade.postTradeReview.planFollowed ? 'default' : 'destructive'}>
                  {trade.postTradeReview.planFollowed ? 'Yes' : 'No'}
                </Badge>
              </div>
            )}
            {trade.postTradeReview.mistakes && (
              <div>
                <span className="text-sm text-muted-foreground">Mistakes</span>
                <p className="mt-1">{trade.postTradeReview.mistakes}</p>
              </div>
            )}
            {trade.postTradeReview.lessons && (
              <div>
                <span className="text-sm text-muted-foreground">Lessons Learned</span>
                <p className="mt-1">{trade.postTradeReview.lessons}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
