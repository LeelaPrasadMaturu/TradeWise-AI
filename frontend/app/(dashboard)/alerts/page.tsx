'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, TrendingUp, TrendingDown, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

type AlertType = 'above' | 'below' | 'percentage_change';

export default function AlertsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newAlert, setNewAlert] = useState({
    symbol: '',
    assetType: 'stock',
    alertType: 'above' as AlertType,
    targetPrice: '',
    percentageChange: '',
  });
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['price-alerts'],
    queryFn: () => api.getPriceAlerts(),
  });

  const createMutation = useMutation({
    mutationFn: () => api.createPriceAlert({
      symbol: newAlert.symbol.toUpperCase(),
      assetType: newAlert.assetType,
      alertType: newAlert.alertType,
      targetPrice: newAlert.alertType !== 'percentage_change' ? parseFloat(newAlert.targetPrice) : undefined,
      percentageChange: newAlert.alertType === 'percentage_change' ? parseFloat(newAlert.percentageChange) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-alerts'] });
      setIsDialogOpen(false);
      setNewAlert({
        symbol: '',
        assetType: 'stock',
        alertType: 'above',
        targetPrice: '',
        percentageChange: '',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePriceAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-alerts'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.togglePriceAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-alerts'] });
    },
  });

  const alerts = data?.alerts || [];
  const activeAlerts = alerts.filter(a => a.active && !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);
  const inactiveAlerts = alerts.filter(a => !a.active && !a.triggered);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'above':
        return <TrendingUp className="h-4 w-4 text-profit" />;
      case 'below':
        return <TrendingDown className="h-4 w-4 text-loss" />;
      case 'percentage_change':
        return <Percent className="h-4 w-4 text-warning" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getAlertDescription = (alert: typeof alerts[0]) => {
    if (alert.alertType === 'above') {
      return `Price goes above ₹${alert.targetPrice?.toLocaleString()}`;
    } else if (alert.alertType === 'below') {
      return `Price goes below ₹${alert.targetPrice?.toLocaleString()}`;
    } else {
      return `Price changes by ${alert.percentageChange}%`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Price Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Get notified when prices reach your targets
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Alert
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Bell className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeAlerts.length}</p>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-profit/10 flex items-center justify-center">
                <Bell className="h-6 w-6 text-profit" />
              </div>
              <div>
                <p className="text-2xl font-bold">{triggeredAlerts.length}</p>
                <p className="text-sm text-muted-foreground">Triggered Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Bell className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inactiveAlerts.length}</p>
                <p className="text-sm text-muted-foreground">Paused</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <Bell className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Alerts Set</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create price alerts to get notified when stocks reach your target prices
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Alert
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {activeAlerts.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Active Alerts</h2>
              <div className="space-y-3">
                {activeAlerts.map((alert) => (
                  <Card key={alert._id} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            {getAlertIcon(alert.alertType)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{alert.symbol}</span>
                              <Badge variant="outline" className="text-xs">
                                {alert.assetType}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {getAlertDescription(alert)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {alert.currentPrice && (
                            <span className="text-sm text-muted-foreground mr-4">
                              Current: ₹{alert.currentPrice.toLocaleString()}
                            </span>
                          )}
                          <Switch
                            checked={alert.active}
                            onCheckedChange={() => toggleMutation.mutate(alert._id)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-loss"
                            onClick={() => deleteMutation.mutate(alert._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {triggeredAlerts.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Triggered Alerts</h2>
              <div className="space-y-3">
                {triggeredAlerts.map((alert) => (
                  <Card key={alert._id} className="border-profit/30 bg-profit/5">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-profit/20 flex items-center justify-center">
                            <Bell className="h-5 w-5 text-profit" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{alert.symbol}</span>
                              <Badge variant="secondary" className="text-xs bg-profit/20 text-profit">
                                Triggered
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {getAlertDescription(alert)}
                            </p>
                            {alert.triggeredAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Triggered {formatDate(alert.triggeredAt, 'MMM d, h:mm a')}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-loss"
                          onClick={() => deleteMutation.mutate(alert._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {inactiveAlerts.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 text-muted-foreground">Paused Alerts</h2>
              <div className="space-y-3">
                {inactiveAlerts.map((alert) => (
                  <Card key={alert._id} className="border-border/30 bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            {getAlertIcon(alert.alertType)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-muted-foreground">{alert.symbol}</span>
                              <Badge variant="outline" className="text-xs opacity-50">
                                Paused
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground/60">
                              {getAlertDescription(alert)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={alert.active}
                            onCheckedChange={() => toggleMutation.mutate(alert._id)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-loss"
                            onClick={() => deleteMutation.mutate(alert._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Price Alert</DialogTitle>
            <DialogDescription>
              Get notified when a stock reaches your target price
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Symbol</Label>
                <Input
                  value={newAlert.symbol}
                  onChange={(e) => setNewAlert({ ...newAlert, symbol: e.target.value.toUpperCase() })}
                  placeholder="e.g., RELIANCE"
                />
              </div>
              <div className="space-y-2">
                <Label>Asset Type</Label>
                <Select
                  value={newAlert.assetType}
                  onValueChange={(v) => setNewAlert({ ...newAlert, assetType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stock">Stock</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                    <SelectItem value="forex">Forex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Alert Type</Label>
              <Select
                value={newAlert.alertType}
                onValueChange={(v) => setNewAlert({ ...newAlert, alertType: v as AlertType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-profit" />
                      Price goes above
                    </div>
                  </SelectItem>
                  <SelectItem value="below">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-loss" />
                      Price goes below
                    </div>
                  </SelectItem>
                  <SelectItem value="percentage_change">
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-warning" />
                      Percentage change
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newAlert.alertType !== 'percentage_change' ? (
              <div className="space-y-2">
                <Label>Target Price (₹)</Label>
                <Input
                  type="number"
                  value={newAlert.targetPrice}
                  onChange={(e) => setNewAlert({ ...newAlert, targetPrice: e.target.value })}
                  placeholder="e.g., 2500"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Percentage Change (%)</Label>
                <Input
                  type="number"
                  value={newAlert.percentageChange}
                  onChange={(e) => setNewAlert({ ...newAlert, percentageChange: e.target.value })}
                  placeholder="e.g., 5"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={
                  createMutation.isPending ||
                  !newAlert.symbol ||
                  (newAlert.alertType !== 'percentage_change' && !newAlert.targetPrice) ||
                  (newAlert.alertType === 'percentage_change' && !newAlert.percentageChange)
                }
              >
                {createMutation.isPending ? 'Creating...' : 'Create Alert'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
