'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, X, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CSVImportModal } from '@/components/trades/csv-import-modal';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [capital, setCapital] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ['trading-config'],
    queryFn: () => api.getTradingConfig(),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.updateTradingConfig>[0]) => 
      api.updateTradingConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trading-config'] });
      setSuccessMessage('Settings updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });

  const handleCapitalUpdate = () => {
    if (capital) {
      updateMutation.mutate({ capital: parseFloat(capital) });
      setCapital('');
    }
  };

  const handleToggleSetting = (key: string, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  const addChecklistItem = () => {
    if (newChecklistItem && config) {
      const items = [...(config.customChecklistItems || []), {
        _id: Date.now().toString(),
        question: newChecklistItem,
        required: false,
        action: 'warn' as const,
      }];
      updateMutation.mutate({ customChecklistItems: items });
      setNewChecklistItem('');
    }
  };

  const removeChecklistItem = (id: string) => {
    if (config) {
      const items = config.customChecklistItems.filter(item => item._id !== id);
      updateMutation.mutate({ customChecklistItems: items });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your trading configuration
          </p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your trading configuration and preferences
        </p>
      </div>

      {successMessage && (
        <Alert className="border-profit/50 bg-profit/10">
          <AlertDescription className="text-profit">{successMessage}</AlertDescription>
        </Alert>
      )}

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Trading Capital</CardTitle>
          <CardDescription>
            Set your trading capital for percentage-based rules
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Current Capital</p>
            <p className="text-2xl font-semibold font-mono-numbers">
              {formatCurrency(config?.capital || 0)}
            </p>
            {config?.capitalUpdatedAt && (
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(config.capitalUpdatedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Enter new capital"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
            />
            <Button 
              onClick={handleCapitalUpdate}
              disabled={!capital || updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Pre-Trade Checklist</CardTitle>
          <CardDescription>
            Configure your pre-trade checklist settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="checklist-enabled">Enable Checklist</Label>
              <p className="text-sm text-muted-foreground">
                Show checklist before entering trades
              </p>
            </div>
            <Switch
              id="checklist-enabled"
              checked={config?.checklistEnabled}
              onCheckedChange={(checked) => handleToggleSetting('checklistEnabled', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="block-on-failure">Block on Failure</Label>
              <p className="text-sm text-muted-foreground">
                Prevent trades when required checklist items are not completed
              </p>
            </div>
            <Switch
              id="block-on-failure"
              checked={config?.blockOnFailure}
              onCheckedChange={(checked) => handleToggleSetting('blockOnFailure', checked)}
            />
          </div>

          <Separator />

          <div>
            <Label>Checklist Items</Label>
            <div className="mt-2 space-y-2">
              {config?.customChecklistItems?.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between rounded-md border border-border/50 p-2"
                >
                  <span className="text-sm">{item.question}</span>
                  <div className="flex items-center gap-2">
                    {item.required && (
                      <Badge variant="secondary" className="text-xs">Required</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeChecklistItem(item._id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Add checklist item..."
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addChecklistItem()}
              />
              <Button variant="outline" size="icon" onClick={addChecklistItem}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Emotional Trading</CardTitle>
          <CardDescription>
            Configure emotional state restrictions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="emotional-check">Require Emotional Check</Label>
              <p className="text-sm text-muted-foreground">
                Track emotional state before each trade
              </p>
            </div>
            <Switch
              id="emotional-check"
              checked={config?.requireEmotionalCheck}
              onCheckedChange={(checked) => handleToggleSetting('requireEmotionalCheck', checked)}
            />
          </div>

          <Separator />

          <div>
            <Label>Allowed Emotions</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {config?.allowedEmotions?.map((emotion) => (
                <Badge key={emotion} variant="secondary" className="text-profit">
                  {emotion}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label>Blocked Emotions</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {config?.blockedEmotions?.map((emotion) => (
                <Badge key={emotion} variant="secondary" className="text-loss">
                  {emotion}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Data Import</CardTitle>
          <CardDescription>
            Import trades from broker CSV exports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CSVImportModal
            trigger={
              <Button variant="outline" className="w-full">
                <Upload className="mr-2 h-4 w-4" />
                Import from CSV
              </Button>
            }
          />
          <p className="text-xs text-muted-foreground mt-2">
            Supports Zerodha tradebook and generic CSV formats
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
