'use client';

import { useState } from 'react';
import { MoreHorizontal, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TradingRule } from '@/types';
import { cn } from '@/lib/utils';

interface RuleCardProps {
  rule: TradingRule;
  complianceRate?: number;
  violations?: number;
  onToggle: (id: string) => void;
  onEdit: (rule: TradingRule) => void;
  onDelete: (id: string) => void;
}

export function RuleCard({
  rule,
  complianceRate,
  violations,
  onToggle,
  onEdit,
  onDelete,
}: RuleCardProps) {
  const formatRuleType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getRuleDescription = (rule: TradingRule) => {
    const params = rule.params;
    switch (rule.ruleType) {
      case 'MAX_DAILY_TRADES':
        return `Maximum ${params.maxTrades} trades per day`;
      case 'TIME_WINDOW':
        return `Trade only between ${params.startHour}:${String(params.startMinute || 0).padStart(2, '0')} - ${params.endHour}:${String(params.endMinute || 0).padStart(2, '0')}`;
      case 'MAX_POSITION_SIZE':
        return `Max position: ${params.maxSizeType === 'percentage' ? `${params.maxSizeValue}%` : `₹${params.maxSizeValue}`}`;
      case 'MAX_DAILY_LOSS':
        return `Stop after ${params.maxLossType === 'percentage' ? `${params.maxLossValue}%` : `₹${params.maxLossValue}`} loss`;
      case 'MIN_RISK_REWARD':
        return `Minimum R:R ratio of ${params.minRiskReward}:1`;
      case 'REQUIRED_STOP_LOSS':
        return 'Stop loss must be set';
      case 'REQUIRED_TAKE_PROFIT':
        return 'Take profit must be set';
      case 'MAX_CONSECUTIVE_LOSSES':
        return `Stop after ${params.maxConsecutiveLosses} consecutive losses`;
      case 'COOLING_OFF_AFTER_LOSS':
        return `Wait ${params.coolingMinutes} minutes after a loss`;
      default:
        return rule.description || formatRuleType(rule.ruleType);
    }
  };

  return (
    <Card className={cn(
      'border',
      rule.enabled ? 'border-border/50' : 'border-border/30 bg-muted/30'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn('font-medium', !rule.enabled && 'text-muted-foreground')}>
                {rule.name}
              </span>
              <Badge
                variant={rule.action === 'block' ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {rule.action.toUpperCase()}
              </Badge>
              {!rule.enabled && (
                <Badge variant="outline" className="text-xs">
                  Disabled
                </Badge>
              )}
            </div>
            <p className={cn(
              'text-sm',
              rule.enabled ? 'text-muted-foreground' : 'text-muted-foreground/60'
            )}>
              {getRuleDescription(rule)}
            </p>
            {complianceRate !== undefined && rule.enabled && (
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        complianceRate >= 80 ? 'bg-profit' : complianceRate >= 60 ? 'bg-warning' : 'bg-loss'
                      )}
                      style={{ width: `${complianceRate}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {complianceRate.toFixed(0)}%
                  </span>
                </div>
                {violations !== undefined && violations > 0 && (
                  <span className="text-xs text-loss">
                    {violations} violation{violations !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={rule.enabled}
              onCheckedChange={() => onToggle(rule._id)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(rule)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(rule._id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
