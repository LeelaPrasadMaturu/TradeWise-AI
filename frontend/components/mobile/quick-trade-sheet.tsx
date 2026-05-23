'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

const quickTradeSchema = z.object({
  symbol: z.string().min(1, 'Required'),
  direction: z.enum(['long', 'short']),
  entryPrice: z.number().positive('Required'),
  quantity: z.number().positive('Required'),
  exitPrice: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
});

type QuickTradeData = z.infer<typeof quickTradeSchema>;

const emotionOptions = [
  { value: 'calm', label: 'Calm' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'anxious', label: 'Anxious' },
];

interface QuickTradeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickTradeSheet({ open, onOpenChange }: QuickTradeSheetProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [emotion, setEmotion] = useState<string>('neutral');
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<QuickTradeData>({
    resolver: zodResolver(quickTradeSchema),
    defaultValues: {
      direction: 'long',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<QuickTradeData> & { preTradeEmotion?: string; tradeDate: string; result?: 'win' | 'loss' | 'breakeven' | 'open'; profitLoss?: number }) => 
      api.createTrade(data),
    onSuccess: (trade) => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      reset();
      setError(null);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const onSubmit = (data: QuickTradeData) => {
    const tradeDate = new Date().toISOString().split('T')[0];
    
    let result: 'open' | 'win' | 'loss' | 'breakeven' = 'open';
    let profitLoss: number | undefined;
    
    if (data.exitPrice) {
      const pnl = data.direction === 'long'
        ? (data.exitPrice - data.entryPrice) * data.quantity
        : (data.entryPrice - data.exitPrice) * data.quantity;
      profitLoss = pnl;
      result = pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven';
    }

    createMutation.mutate({
      ...data,
      tradeDate,
      preTradeEmotion: emotion,
      result,
      profitLoss,
    });
  };

  const watchExitPrice = watch('exitPrice');
  const watchEntryPrice = watch('entryPrice');
  const watchQuantity = watch('quantity');
  const watchDirection = watch('direction');

  const calculatedPnL = watchExitPrice && watchEntryPrice && watchQuantity
    ? watchDirection === 'long'
      ? (watchExitPrice - watchEntryPrice) * watchQuantity
      : (watchEntryPrice - watchExitPrice) * watchQuantity
    : null;

  const navigateToFullForm = () => {
    onOpenChange(false);
    router.push('/journal');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Quick Trade Entry</SheetTitle>
          <SheetDescription>
            Log a trade quickly. Add more details later.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="q-symbol" className="text-xs">Symbol</Label>
              <Input
                id="q-symbol"
                placeholder="RELIANCE"
                {...register('symbol')}
                className={cn('h-10', errors.symbol && 'border-destructive')}
                autoCapitalize="characters"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Direction</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={watch('direction') === 'long' ? 'default' : 'outline'}
                  className="flex-1 h-10"
                  onClick={() => setValue('direction', 'long')}
                >
                  Long
                </Button>
                <Button
                  type="button"
                  variant={watch('direction') === 'short' ? 'default' : 'outline'}
                  className="flex-1 h-10"
                  onClick={() => setValue('direction', 'short')}
                >
                  Short
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="q-entry" className="text-xs">Entry Price</Label>
              <Input
                id="q-entry"
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                {...register('entryPrice', { valueAsNumber: true })}
                className={cn('h-10 font-mono-numbers', errors.entryPrice && 'border-destructive')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-qty" className="text-xs">Quantity</Label>
              <Input
                id="q-qty"
                type="number"
                inputMode="numeric"
                placeholder="0"
                {...register('quantity', { valueAsNumber: true })}
                className={cn('h-10 font-mono-numbers', errors.quantity && 'border-destructive')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="q-exit" className="text-xs">Exit Price (optional - leave empty for open trade)</Label>
            <Input
              id="q-exit"
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              {...register('exitPrice', { valueAsNumber: true })}
              className="h-10 font-mono-numbers"
            />
            {calculatedPnL !== null && (
              <p className={cn(
                'text-sm font-mono-numbers',
                calculatedPnL >= 0 ? 'text-profit' : 'text-loss'
              )}>
                P&L: {calculatedPnL >= 0 ? '+' : ''}{calculatedPnL.toFixed(2)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Quick Emotion Check</Label>
            <div className="flex gap-2">
              {emotionOptions.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={emotion === opt.value ? 'default' : 'outline'}
                  className="flex-1 h-9 text-xs"
                  onClick={() => setEmotion(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger>
              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
                {showAdvanced ? (
                  <>Less options <ChevronUp className="h-3 w-3 ml-1" /></>
                ) : (
                  <>More options <ChevronDown className="h-3 w-3 ml-1" /></>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="q-sl" className="text-xs">Stop Loss</Label>
                  <Input
                    id="q-sl"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    {...register('stopLoss', { valueAsNumber: true })}
                    className="h-9 font-mono-numbers"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="q-tp" className="text-xs">Take Profit</Label>
                  <Input
                    id="q-tp"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    {...register('takeProfit', { valueAsNumber: true })}
                    className="h-9 font-mono-numbers"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <SheetFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={navigateToFullForm}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Full Form
            </Button>
            <Button 
              type="submit" 
              className="w-full sm:w-auto"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {watchExitPrice ? 'Save & Close' : 'Save as Open'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default QuickTradeSheet;
