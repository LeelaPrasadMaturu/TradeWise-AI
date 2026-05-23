'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import api from '@/lib/api';
import { TradingRule } from '@/types';

const ruleTypes = [
  { value: 'MAX_DAILY_TRADES', label: 'Max Daily Trades', params: ['maxTrades'] },
  { value: 'TIME_WINDOW', label: 'Time Window', params: ['startHour', 'startMinute', 'endHour', 'endMinute'] },
  { value: 'MAX_POSITION_SIZE', label: 'Max Position Size', params: ['maxSizeType', 'maxSizeValue'] },
  { value: 'MAX_DAILY_LOSS', label: 'Max Daily Loss', params: ['maxLossType', 'maxLossValue'] },
  { value: 'MIN_RISK_REWARD', label: 'Min Risk:Reward', params: ['minRiskReward'] },
  { value: 'REQUIRED_STOP_LOSS', label: 'Required Stop Loss', params: [] },
  { value: 'REQUIRED_TAKE_PROFIT', label: 'Required Take Profit', params: [] },
  { value: 'MAX_CONSECUTIVE_LOSSES', label: 'Max Consecutive Losses', params: ['maxConsecutiveLosses'] },
  { value: 'COOLING_OFF_AFTER_LOSS', label: 'Cooling Off After Loss', params: ['coolingMinutes'] },
];

const ruleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  ruleType: z.string().min(1, 'Rule type is required'),
  action: z.enum(['warn', 'block']),
});

type RuleFormData = z.infer<typeof ruleSchema>;

interface RuleFormProps {
  editRule?: TradingRule;
  onSuccess: () => void;
}

export function RuleForm({ editRule, onSuccess }: RuleFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, string | number>>(
    editRule?.params as Record<string, string | number> || {}
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
    defaultValues: editRule ? {
      name: editRule.name,
      description: editRule.description || '',
      ruleType: editRule.ruleType,
      action: editRule.action,
    } : {
      action: 'warn',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<TradingRule>) => api.createRule(data),
    onSuccess,
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TradingRule> }) =>
      api.updateRule(id, data),
    onSuccess,
    onError: (err: Error) => setError(err.message),
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const selectedType = watch('ruleType');
  const selectedConfig = ruleTypes.find(t => t.value === selectedType);

  const onSubmit = (data: RuleFormData) => {
    setError(null);
    
    const ruleData: Partial<TradingRule> = {
      name: data.name,
      description: data.description,
      ruleType: data.ruleType,
      action: data.action,
      params,
    };

    if (editRule) {
      updateMutation.mutate({ id: editRule._id, data: ruleData });
    } else {
      createMutation.mutate(ruleData);
    }
  };

  const updateParam = (key: string, value: string | number) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Rule Name</Label>
        <Input
          id="name"
          placeholder="e.g., Max 3 Trades Per Day"
          {...register('name')}
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="ruleType">Rule Type</Label>
        <Select
          value={watch('ruleType')}
          onValueChange={(value) => {
            if (value) {
              setValue('ruleType', value);
              setParams({});
            }
          }}
        >
          <SelectTrigger className={errors.ruleType ? 'border-destructive' : ''}>
            <SelectValue placeholder="Select rule type" />
          </SelectTrigger>
          <SelectContent>
            {ruleTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.ruleType && (
          <p className="text-sm text-destructive">{errors.ruleType.message}</p>
        )}
      </div>

      {selectedConfig?.params.includes('maxTrades') && (
        <div className="space-y-2">
          <Label>Max Trades</Label>
          <Input
            type="number"
            value={params.maxTrades || ''}
            onChange={(e) => updateParam('maxTrades', parseInt(e.target.value))}
            placeholder="e.g., 3"
          />
        </div>
      )}

      {selectedConfig?.params.includes('startHour') && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Time</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={params.startHour || ''}
                onChange={(e) => updateParam('startHour', parseInt(e.target.value))}
                placeholder="Hour"
                min={0}
                max={23}
              />
              <Input
                type="number"
                value={params.startMinute || ''}
                onChange={(e) => updateParam('startMinute', parseInt(e.target.value))}
                placeholder="Min"
                min={0}
                max={59}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>End Time</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={params.endHour || ''}
                onChange={(e) => updateParam('endHour', parseInt(e.target.value))}
                placeholder="Hour"
                min={0}
                max={23}
              />
              <Input
                type="number"
                value={params.endMinute || ''}
                onChange={(e) => updateParam('endMinute', parseInt(e.target.value))}
                placeholder="Min"
                min={0}
                max={59}
              />
            </div>
          </div>
        </div>
      )}

      {selectedConfig?.params.includes('maxSizeType') && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Size Type</Label>
            <Select
              value={params.maxSizeType as string || 'absolute'}
              onValueChange={(value) => value && updateParam('maxSizeType', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="absolute">Absolute (₹)</SelectItem>
                <SelectItem value="percentage">% of Capital</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Max Value</Label>
            <Input
              type="number"
              value={params.maxSizeValue || ''}
              onChange={(e) => updateParam('maxSizeValue', parseFloat(e.target.value))}
              placeholder={params.maxSizeType === 'percentage' ? '10' : '50000'}
            />
          </div>
        </div>
      )}

      {selectedConfig?.params.includes('maxLossType') && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Loss Type</Label>
            <Select
              value={params.maxLossType as string || 'absolute'}
              onValueChange={(value) => value && updateParam('maxLossType', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="absolute">Absolute (₹)</SelectItem>
                <SelectItem value="percentage">% of Capital</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Max Loss</Label>
            <Input
              type="number"
              value={params.maxLossValue || ''}
              onChange={(e) => updateParam('maxLossValue', parseFloat(e.target.value))}
              placeholder={params.maxLossType === 'percentage' ? '2' : '5000'}
            />
          </div>
        </div>
      )}

      {selectedConfig?.params.includes('minRiskReward') && (
        <div className="space-y-2">
          <Label>Minimum R:R Ratio</Label>
          <Input
            type="number"
            step="0.1"
            value={params.minRiskReward || ''}
            onChange={(e) => updateParam('minRiskReward', parseFloat(e.target.value))}
            placeholder="e.g., 2 (for 1:2)"
          />
        </div>
      )}

      {selectedConfig?.params.includes('maxConsecutiveLosses') && (
        <div className="space-y-2">
          <Label>Max Consecutive Losses</Label>
          <Input
            type="number"
            value={params.maxConsecutiveLosses || ''}
            onChange={(e) => updateParam('maxConsecutiveLosses', parseInt(e.target.value))}
            placeholder="e.g., 3"
          />
        </div>
      )}

      {selectedConfig?.params.includes('coolingMinutes') && (
        <div className="space-y-2">
          <Label>Cooling Off Period (minutes)</Label>
          <Input
            type="number"
            value={params.coolingMinutes || ''}
            onChange={(e) => updateParam('coolingMinutes', parseInt(e.target.value))}
            placeholder="e.g., 30"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="action">Action</Label>
        <Select
          value={watch('action')}
          onValueChange={(value) => value && setValue('action', value as 'warn' | 'block')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="warn">Warn (allow trade with warning)</SelectItem>
            <SelectItem value="block">Block (prevent trade)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          placeholder="Additional notes about this rule..."
          {...register('description')}
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {editRule ? 'Update Rule' : 'Create Rule'}
        </Button>
      </div>
    </form>
  );
}
