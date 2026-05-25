'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Target, 
  Plus, 
  Pencil, 
  Trash2, 
  TrendingUp,
  TrendingDown,
  BarChart3,
  Lightbulb,
  CheckCircle,
  Settings
} from 'lucide-react';
import api from '@/lib/api';
import type { Playbook, PlaybookSetup } from '@/types';

function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  if (absAmount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (absAmount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
}

function SetupCard({ 
  setup, 
  onEdit, 
  onDelete 
}: { 
  setup: PlaybookSetup;
  onEdit: (setup: PlaybookSetup) => void;
  onDelete: (setupId: string) => void;
}) {
  const stats = setup.stats;
  
  return (
    <Card className={`border-l-4`} style={{ borderLeftColor: setup.color }}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {setup.name}
              {!setup.enabled && (
                <Badge variant="outline" className="text-xs">Disabled</Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {setup.description || 'No description'}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(setup)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(setup._id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{stats.totalTrades}</p>
            <p className="text-xs text-muted-foreground">Trades</p>
          </div>
          <div>
            <p className={`text-2xl font-bold ${stats.winRate >= 50 ? 'text-profit' : 'text-loss'}`}>
              {stats.winRate}%
            </p>
            <p className="text-xs text-muted-foreground">Win Rate</p>
          </div>
          <div>
            <p className={`text-2xl font-bold font-mono ${stats.totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
              {formatCurrency(stats.totalPnL)}
            </p>
            <p className="text-xs text-muted-foreground">Total P&L</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {stats.profitFactor > 0 ? stats.profitFactor.toFixed(1) : '-'}
            </p>
            <p className="text-xs text-muted-foreground">PF</p>
          </div>
        </div>

        {setup.matchCriteria.keywords && setup.matchCriteria.keywords.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Keywords:</p>
            <div className="flex flex-wrap gap-1">
              {setup.matchCriteria.keywords.map((kw, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddSetupDialog({ 
  open, 
  onOpenChange, 
  editSetup,
  onSave 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSetup?: PlaybookSetup | null;
  onSave: (data: Partial<PlaybookSetup>) => void;
}) {
  const [name, setName] = useState(editSetup?.name || '');
  const [description, setDescription] = useState(editSetup?.description || '');
  const [keywords, setKeywords] = useState(editSetup?.matchCriteria?.keywords?.join(', ') || '');
  const [direction, setDirection] = useState<'long' | 'short' | 'both'>(
    editSetup?.matchCriteria?.direction || 'both'
  );
  const [requireStopLoss, setRequireStopLoss] = useState(editSetup?.rules?.requireStopLoss ?? true);
  const [minRR, setMinRR] = useState(editSetup?.rules?.minRiskReward?.toString() || '');
  const [color, setColor] = useState(editSetup?.color || '#3b82f6');

  const handleSave = () => {
    onSave({
      name,
      description,
      matchCriteria: {
        keywords: keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean),
        direction,
        symbols: [],
        tags: [],
      },
      rules: {
        requireStopLoss,
        minRiskReward: minRR ? parseFloat(minRR) : undefined,
      },
      color,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editSetup ? 'Edit Setup' : 'Add New Setup'}</DialogTitle>
          <DialogDescription>
            Define a trading setup to track its performance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Setup Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Breakout, Gap & Go"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe when you use this setup..."
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="keywords">Keywords (comma separated)</Label>
            <Input
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="breakout, resistance break, volume surge"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Trades with these words in reason/notes will auto-tag
            </p>
          </div>

          <div>
            <Label>Direction</Label>
            <div className="flex gap-2 mt-1">
              {(['both', 'long', 'short'] as const).map((d) => (
                <Button
                  key={d}
                  variant={direction === d ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDirection(d)}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="requireSL">Require Stop Loss</Label>
            <Switch
              id="requireSL"
              checked={requireStopLoss}
              onCheckedChange={setRequireStopLoss}
            />
          </div>

          <div>
            <Label htmlFor="minRR">Min Risk:Reward</Label>
            <Input
              id="minRR"
              type="number"
              step="0.1"
              value={minRR}
              onChange={(e) => setMinRR(e.target.value)}
              placeholder="e.g., 1.5"
            />
          </div>

          <div>
            <Label htmlFor="color">Color</Label>
            <div className="flex gap-2 mt-1">
              {['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'].map((c) => (
                <button
                  key={c}
                  className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-foreground' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <Button onClick={handleSave} className="w-full" disabled={!name}>
            {editSetup ? 'Update Setup' : 'Create Setup'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PlaybookPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSetup, setEditingSetup] = useState<PlaybookSetup | null>(null);

  const { data: playbookData, isLoading } = useQuery({
    queryKey: ['playbook'],
    queryFn: () => api.getPlaybook(),
  });

  const { data: comparison } = useQuery({
    queryKey: ['playbook-comparison'],
    queryFn: () => api.compareSetups(90),
  });

  const { data: suggestions } = useQuery({
    queryKey: ['setup-suggestions'],
    queryFn: () => api.getSetupSuggestions(),
  });

  const addMutation = useMutation({
    mutationFn: (setup: Parameters<typeof api.addSetup>[0]) => api.addSetup(setup),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-comparison'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<PlaybookSetup> }) => 
      api.updateSetup(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-comparison'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteSetup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-comparison'] });
    },
  });

  const handleSave = (data: Partial<PlaybookSetup>) => {
    if (editingSetup) {
      updateMutation.mutate({ id: editingSetup._id, updates: data });
    } else {
      addMutation.mutate(data as Parameters<typeof api.addSetup>[0]);
    }
    setEditingSetup(null);
  };

  const handleEdit = (setup: PlaybookSetup) => {
    setEditingSetup(setup);
    setDialogOpen(true);
  };

  const handleDelete = (setupId: string) => {
    if (confirm('Delete this setup? Statistics will be lost.')) {
      deleteMutation.mutate(setupId);
    }
  };

  const handleAddNew = () => {
    setEditingSetup(null);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  const playbook = playbookData?.playbook as Playbook;
  const setups = playbook?.setups || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trading Playbook</h1>
          <p className="text-muted-foreground">Define and track your trading setups</p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Add Setup
        </Button>
      </div>

      <Tabs defaultValue="setups">
        <TabsList>
          <TabsTrigger value="setups">My Setups</TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="setups" className="space-y-4">
          {setups.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No setups defined</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Create your first trading setup to start tracking performance
                </p>
                <Button onClick={handleAddNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Setup
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {setups.map((setup) => (
                <SetupCard
                  key={setup._id}
                  setup={setup}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="compare">
          {comparison?.summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold">{comparison.summary.totalSetups}</p>
                    <p className="text-sm text-muted-foreground">Active Setups</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold text-profit">
                      {comparison.summary.profitableSetups}
                    </p>
                    <p className="text-sm text-muted-foreground">Profitable</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold text-loss">
                      {comparison.summary.unprofitableSetups}
                    </p>
                    <p className="text-sm text-muted-foreground">Unprofitable</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className={`text-3xl font-bold font-mono ${
                      comparison.summary.totalPnL >= 0 ? 'text-profit' : 'text-loss'
                    }`}>
                      {formatCurrency(comparison.summary.totalPnL)}
                    </p>
                    <p className="text-sm text-muted-foreground">Total P&L</p>
                  </CardContent>
                </Card>
              </div>

              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Recommendation</AlertTitle>
                <AlertDescription>{comparison.recommendation}</AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle>Setup Performance Ranking</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {comparison.setups.map((setup, idx) => (
                      <div 
                        key={setup.id}
                        className="flex items-center justify-between p-3 rounded-md border border-border/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-muted-foreground">#{idx + 1}</span>
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: setup.color }}
                          />
                          <span className="font-medium">{setup.name}</span>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <span>{setup.totalTrades} trades</span>
                          <Badge variant={setup.winRate >= 50 ? 'default' : 'destructive'}>
                            {setup.winRate}% WR
                          </Badge>
                          <span className={`font-mono ${setup.totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {formatCurrency(setup.totalPnL)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="suggestions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                AI-Suggested Setups
              </CardTitle>
              <CardDescription>
                Based on patterns in your winning trades
              </CardDescription>
            </CardHeader>
            <CardContent>
              {suggestions?.suggestions && suggestions.suggestions.length > 0 ? (
                <div className="space-y-3">
                  {suggestions.suggestions.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-md border border-border/50"
                    >
                      <div>
                        <Badge variant="secondary">{s.keyword}</Badge>
                        <p className="text-sm text-muted-foreground mt-1">
                          Found in {s.count} trades
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${s.winRate >= 50 ? 'text-profit' : ''}`}>
                          {s.winRate}% win rate
                        </p>
                        <p className={`text-sm font-mono ${s.totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatCurrency(s.totalPnL)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{suggestions?.message || 'Loading...'}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Playbook Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-tag trades</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically tag trades based on keywords
                  </p>
                </div>
                <Switch
                  checked={playbook?.settings?.autoTagEnabled ?? true}
                  onCheckedChange={(checked) => {
                    api.updatePlaybookSettings({ autoTagEnabled: checked })
                      .then(() => queryClient.invalidateQueries({ queryKey: ['playbook'] }));
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Require setup match</Label>
                  <p className="text-sm text-muted-foreground">
                    Warn if trade doesn't match any setup
                  </p>
                </div>
                <Switch
                  checked={playbook?.settings?.requireSetupMatch ?? false}
                  onCheckedChange={(checked) => {
                    api.updatePlaybookSettings({ requireSetupMatch: checked })
                      .then(() => queryClient.invalidateQueries({ queryKey: ['playbook'] }));
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddSetupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editSetup={editingSetup}
        onSave={handleSave}
      />
    </div>
  );
}
