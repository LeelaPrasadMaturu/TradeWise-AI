'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import api from '@/lib/api';
import { Trade } from '@/types';
import { cn } from '@/lib/utils';

const tradeSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  direction: z.enum(['long', 'short']),
  entryPrice: z.number().positive('Entry price must be positive'),
  exitPrice: z.number().positive().optional().or(z.literal('')),
  quantity: z.number().positive('Quantity must be positive'),
  stopLoss: z.number().positive().optional().or(z.literal('')),
  takeProfit: z.number().positive().optional().or(z.literal('')),
  originalStopLoss: z.number().positive().optional().or(z.literal('')),
  tradeDate: z.string().min(1, 'Date is required'),
  reason: z.string().optional(),
  exitReason: z.string().optional(),
  preTradeEmotion: z.string().optional(),
  notes: z.string().optional(),
  result: z.enum(['win', 'loss', 'breakeven', 'open']).optional(),
  profitLoss: z.number().optional(),
  // Discipline tracking
  movedStopLoss: z.boolean().optional(),
  movedStopLossDown: z.boolean().optional(),
  stopLossMovementReason: z.string().optional(),
  exitedBeforeTarget: z.boolean().optional(),
  earlyExitReason: z.enum(['fear', 'impatience', 'news', 'time_constraint', 'changed_view', 'partial_profit', 'other']).optional(),
});

type TradeFormData = z.infer<typeof tradeSchema>;

const earlyExitReasons = [
  { value: 'fear', label: 'Fear of losing profit' },
  { value: 'impatience', label: 'Impatience / Wanted quick exit' },
  { value: 'news', label: 'News / External event' },
  { value: 'time_constraint', label: 'Time constraint (EOD, etc.)' },
  { value: 'changed_view', label: 'Changed my view on trade' },
  { value: 'partial_profit', label: 'Wanted to book partial profit' },
  { value: 'other', label: 'Other reason' },
];

const emotions = [
  { value: 'calm', label: 'Calm' },
  { value: 'confident', label: 'Confident' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'anxious', label: 'Anxious' },
  { value: 'fomo', label: 'FOMO' },
  { value: 'revenge', label: 'Revenge' },
  { value: 'frustrated', label: 'Frustrated' },
  { value: 'greedy', label: 'Greedy' },
];

interface TradeFormProps {
  editTrade?: Trade;
  onSymbolChange?: (symbol: string) => void;
  onEmotionChange?: (emotion: string) => void;
}

export function TradeForm({ editTrade, onSymbolChange, onEmotionChange }: TradeFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<string[]>(editTrade?.tags || []);
  const [newTag, setNewTag] = useState('');
  const [checklistResponses, setChecklistResponses] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [blockedData, setBlockedData] = useState<{
    violations: string[];
    score: number;
    message: string;
  } | null>(null);
  const [pendingTradeData, setPendingTradeData] = useState<Partial<Trade> | null>(null);
  const [showDisciplineSection, setShowDisciplineSection] = useState(!!editTrade?.exitPrice);

  const { data: config } = useQuery({
    queryKey: ['trading-config'],
    queryFn: () => api.getTradingConfig(),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TradeFormData>({
    resolver: zodResolver(tradeSchema),
    defaultValues: editTrade ? {
      symbol: editTrade.symbol,
      direction: editTrade.direction,
      entryPrice: editTrade.entryPrice,
      exitPrice: editTrade.exitPrice || '',
      quantity: editTrade.quantity,
      stopLoss: editTrade.stopLoss || '',
      takeProfit: editTrade.takeProfit || '',
      originalStopLoss: editTrade.originalStopLoss || editTrade.stopLoss || '',
      tradeDate: editTrade.tradeDate?.split('T')[0] || new Date().toISOString().split('T')[0],
      reason: editTrade.reason || '',
      exitReason: editTrade.exitReason || '',
      preTradeEmotion: editTrade.preTradeEmotion || '',
      notes: editTrade.notes || '',
      result: editTrade.result || 'open',
      profitLoss: editTrade.profitLoss,
      movedStopLoss: editTrade.movedStopLoss || false,
      movedStopLossDown: editTrade.movedStopLossDown || false,
      stopLossMovementReason: editTrade.stopLossMovementReason || '',
      exitedBeforeTarget: editTrade.earlyExit?.exitedBeforeTarget || false,
      earlyExitReason: editTrade.earlyExit?.exitReason,
    } : {
      direction: 'long',
      tradeDate: new Date().toISOString().split('T')[0],
      result: 'open',
      movedStopLoss: false,
      movedStopLossDown: false,
      exitedBeforeTarget: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Trade>) => api.createTrade(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['trade-stats'] });
      router.push('/trades');
    },
    onError: (err: Error & { status?: number; data?: { blocked?: boolean; violations?: string[]; score?: number; message?: string } }) => {
      if (err.status === 403 && err.data?.blocked) {
        setBlockedData({
          violations: err.data.violations || [],
          score: err.data.score || 0,
          message: err.data.message || 'Trade blocked by your trading rules',
        });
      } else {
        setError(err.message);
      }
    },
  });

  const forceCreateMutation = useMutation({
    mutationFn: (data: Partial<Trade>) => api.createTrade({ ...data, skipValidation: true } as Partial<Trade> & { skipValidation: boolean }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['trade-stats'] });
      router.push('/trades');
    },
    onError: (err: Error) => {
      setError(err.message);
      setBlockedData(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Trade> }) => 
      api.updateTrade(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['trade-stats'] });
      router.push('/trades');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending || forceCreateMutation.isPending;

  const handleProceedAnyway = () => {
    if (pendingTradeData) {
      forceCreateMutation.mutate(pendingTradeData);
    }
    setBlockedData(null);
    setPendingTradeData(null);
  };

  const handleCancelBlocked = () => {
    setBlockedData(null);
    setPendingTradeData(null);
  };

  const onSubmit = async (data: TradeFormData) => {
    setError(null);
    setWarnings([]);

    const tradeData: Partial<Trade> = {
      symbol: data.symbol.toUpperCase(),
      direction: data.direction,
      entryPrice: data.entryPrice,
      exitPrice: data.exitPrice || undefined,
      quantity: data.quantity,
      stopLoss: data.stopLoss || undefined,
      takeProfit: data.takeProfit || undefined,
      originalStopLoss: data.originalStopLoss || data.stopLoss || undefined,
      tradeDate: data.tradeDate,
      reason: data.reason || undefined,
      exitReason: data.exitReason || undefined,
      preTradeEmotion: data.preTradeEmotion || undefined,
      notes: data.notes || undefined,
      tags,
      result: data.result || 'open',
      profitLoss: data.profitLoss,
      // Discipline tracking
      movedStopLoss: data.movedStopLoss || false,
      movedStopLossDown: data.movedStopLossDown || false,
      stopLossMovementReason: data.stopLossMovementReason || undefined,
    };

    // Add early exit data if applicable
    if (data.exitedBeforeTarget) {
      (tradeData as Record<string, unknown>).earlyExit = {
        exitedBeforeTarget: true,
        exitReason: data.earlyExitReason || undefined,
      };
    }

    // Calculate P&L if exit price is provided
    if (data.exitPrice && !data.profitLoss) {
      const pnl = data.direction === 'long'
        ? (Number(data.exitPrice) - data.entryPrice) * data.quantity
        : (data.entryPrice - Number(data.exitPrice)) * data.quantity;
      tradeData.profitLoss = pnl;
      tradeData.result = pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven';
    }

    if (editTrade) {
      updateMutation.mutate({ id: editTrade._id, data: tradeData });
    } else {
      setPendingTradeData(tradeData);
      createMutation.mutate(tradeData);
    }
  };

  const addTag = () => {
    if (newTag && !tags.includes(newTag.toLowerCase())) {
      setTags([...tags, newTag.toLowerCase()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const watchExitPrice = watch('exitPrice');
  const watchEntryPrice = watch('entryPrice');
  const watchQuantity = watch('quantity');
  const watchDirection = watch('direction');

  const calculatedPnL = watchExitPrice && watchEntryPrice && watchQuantity
    ? watchDirection === 'long'
      ? (Number(watchExitPrice) - watchEntryPrice) * watchQuantity
      : (watchEntryPrice - Number(watchExitPrice)) * watchQuantity
    : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert className="border-warning/50 bg-warning/10">
          <AlertDescription className="text-warning">
            {warnings.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Trade Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                placeholder="RELIANCE"
                {...register('symbol', {
                  onBlur: (e) => onSymbolChange?.(e.target.value?.toUpperCase()),
                })}
                className={errors.symbol ? 'border-destructive' : ''}
              />
              {errors.symbol && (
                <p className="text-sm text-destructive">{errors.symbol.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="direction">Direction</Label>
              <Select
                value={watch('direction')}
                onValueChange={(value) => value && setValue('direction', value as 'long' | 'short')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tradeDate">Date</Label>
              <Input
                id="tradeDate"
                type="date"
                {...register('tradeDate')}
                className={errors.tradeDate ? 'border-destructive' : ''}
              />
              {errors.tradeDate && (
                <p className="text-sm text-destructive">{errors.tradeDate.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="entryPrice">Entry Price</Label>
              <Input
                id="entryPrice"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('entryPrice', { valueAsNumber: true })}
                className={errors.entryPrice ? 'border-destructive' : ''}
              />
              {errors.entryPrice && (
                <p className="text-sm text-destructive">{errors.entryPrice.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="exitPrice">Exit Price (optional)</Label>
              <Input
                id="exitPrice"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('exitPrice', { 
                  setValueAs: v => v === '' ? undefined : Number(v)
                })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="0"
                {...register('quantity', { valueAsNumber: true })}
                className={errors.quantity ? 'border-destructive' : ''}
              />
              {errors.quantity && (
                <p className="text-sm text-destructive">{errors.quantity.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="stopLoss">Stop Loss (optional)</Label>
              <Input
                id="stopLoss"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('stopLoss', { 
                  setValueAs: v => v === '' ? undefined : Number(v)
                })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="takeProfit">Take Profit (optional)</Label>
              <Input
                id="takeProfit"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('takeProfit', { 
                  setValueAs: v => v === '' ? undefined : Number(v)
                })}
              />
            </div>
          </div>

          {calculatedPnL !== null && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm text-muted-foreground">Calculated P&L</p>
              <p className={cn(
                'text-lg font-semibold font-mono-numbers',
                calculatedPnL >= 0 ? 'text-profit' : 'text-loss'
              )}>
                {calculatedPnL >= 0 ? '+' : ''}{calculatedPnL.toFixed(2)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Entry Reason & Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Entry Reason</Label>
            <Textarea
              id="reason"
              placeholder="Why did you enter this trade?"
              {...register('reason')}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exitReason">Exit Reason (if closed)</Label>
            <Textarea
              id="exitReason"
              placeholder="Why did you exit?"
              {...register('exitReason')}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any other observations..."
              {...register('notes')}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Discipline Tracking - Show when trade has exit price (closed trade) */}
      {(watchExitPrice || editTrade?.exitPrice) && (
        <Card className="border-border/50 border-warning/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              Trade Discipline Review
              <Badge variant="outline" className="text-xs font-normal">
                Important for insights
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stop Loss Movement */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Stop Loss Management</Label>
              
              <div className="flex items-center gap-3">
                <Checkbox
                  id="movedStopLoss"
                  checked={watch('movedStopLoss') || false}
                  onCheckedChange={(checked) => {
                    setValue('movedStopLoss', !!checked);
                    if (!checked) {
                      setValue('movedStopLossDown', false);
                      setValue('stopLossMovementReason', '');
                    }
                  }}
                />
                <label htmlFor="movedStopLoss" className="text-sm">
                  I moved my stop loss during this trade
                </label>
              </div>

              {watch('movedStopLoss') && (
                <div className="ml-6 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="movedStopLossDown"
                      checked={watch('movedStopLossDown') || false}
                      onCheckedChange={(checked) => setValue('movedStopLossDown', !!checked)}
                    />
                    <label htmlFor="movedStopLossDown" className="text-sm text-warning">
                      I moved SL away from entry (widened risk / moved down for longs)
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="originalStopLoss" className="text-xs">Original Stop Loss</Label>
                      <Input
                        id="originalStopLoss"
                        type="number"
                        step="0.01"
                        placeholder="Original SL price"
                        {...register('originalStopLoss', { 
                          setValueAs: v => v === '' ? undefined : Number(v)
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stopLossMovementReason" className="text-xs">Why did you move SL?</Label>
                      <Input
                        id="stopLossMovementReason"
                        placeholder="e.g., hope it will recover, scared of loss"
                        {...register('stopLossMovementReason')}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Early Exit */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Exit Timing</Label>
              
              <div className="flex items-center gap-3">
                <Checkbox
                  id="exitedBeforeTarget"
                  checked={watch('exitedBeforeTarget') || false}
                  onCheckedChange={(checked) => {
                    setValue('exitedBeforeTarget', !!checked);
                    if (!checked) {
                      setValue('earlyExitReason', undefined);
                    }
                  }}
                />
                <label htmlFor="exitedBeforeTarget" className="text-sm">
                  I exited before my target was hit (even though in profit)
                </label>
              </div>

              {watch('exitedBeforeTarget') && (
                <div className="ml-6 space-y-2 animate-in fade-in">
                  <Label htmlFor="earlyExitReason" className="text-xs">Why did you exit early?</Label>
                  <Select
                    value={watch('earlyExitReason') || ''}
                    onValueChange={(value) => value && setValue('earlyExitReason', value as TradeFormData['earlyExitReason'])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason..." />
                    </SelectTrigger>
                    <SelectContent>
                      {earlyExitReasons.map((reason) => (
                        <SelectItem key={reason.value} value={reason.value}>
                          {reason.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {(watch('movedStopLossDown') || watch('exitedBeforeTarget')) && (
              <Alert className="border-warning/50 bg-warning/10">
                <AlertDescription className="text-sm text-warning">
                  Tracking these patterns helps identify discipline issues. Your insights will show how these behaviors affect your P&L.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Pre-Trade State</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Emotional State</Label>
            <div className="flex flex-wrap gap-2">
              {emotions.map((emotion) => (
                <Button
                  key={emotion.value}
                  type="button"
                  variant={watch('preTradeEmotion') === emotion.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setValue('preTradeEmotion', emotion.value);
                    onEmotionChange?.(emotion.value);
                  }}
                  className={cn(
                    watch('preTradeEmotion') === emotion.value && 'bg-primary'
                  )}
                >
                  {emotion.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 rounded-full hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <Button type="button" variant="outline" size="icon" onClick={addTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {config?.checklistEnabled && config.customChecklistItems.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label>Pre-Trade Checklist</Label>
                {config.customChecklistItems.map((item) => (
                  <div key={item._id} className="flex items-center gap-2">
                    <Checkbox
                      id={item._id}
                      checked={checklistResponses[item._id] || false}
                      onCheckedChange={(checked) => 
                        setChecklistResponses({
                          ...checklistResponses,
                          [item._id]: !!checked,
                        })
                      }
                    />
                    <label htmlFor={item._id} className="text-sm">
                      {item.question}
                      {item.required && <span className="text-destructive ml-1">*</span>}
                    </label>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {editTrade ? 'Update Trade' : 'Save Trade'}
        </Button>
      </div>

      <AlertDialog open={!!blockedData} onOpenChange={(open) => !open && handleCancelBlocked()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Discipline Rule Violation</AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-3">
              <p>
                This trade violates your discipline rules. Proceeding will penalize your discipline score.
              </p>

              {blockedData && blockedData.violations.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Violations:</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                    {blockedData.violations.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </div>
              )}

              {blockedData && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Discipline score impact:</span>
                  <span className="font-mono font-semibold text-destructive">-{100 - blockedData.score} pts</span>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-3">
            <AlertDialogCancel onClick={handleCancelBlocked}>
              Cancel Trade
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleProceedAnyway} disabled={forceCreateMutation.isPending}>
              {forceCreateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Proceed Anyway
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
