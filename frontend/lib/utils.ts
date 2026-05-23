import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(num: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

export function formatPnL(amount: number): string {
  const formatted = formatCurrency(Math.abs(amount))
  return amount >= 0 ? `+${formatted}` : `-${formatted}`
}

export function formatDate(date: string | Date, formatStr: string = 'MMM d, yyyy'): string {
  return format(new Date(date), formatStr)
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy h:mm a')
}

export function formatRelativeDate(date: string | Date): string {
  const d = new Date(date)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return formatDistanceToNow(d, { addSuffix: true })
}

export function formatTime(date: string | Date): string {
  return format(new Date(date), 'h:mm a')
}

export function getPnLColor(pnl: number): string {
  if (pnl > 0) return 'text-profit'
  if (pnl < 0) return 'text-loss'
  return 'text-muted-foreground'
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'high':
    case 'critical':
      return 'text-loss'
    case 'medium':
    case 'warning':
      return 'text-warning'
    case 'low':
    case 'info':
      return 'text-info'
    default:
      return 'text-muted-foreground'
  }
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-profit'
  if (score >= 60) return 'text-warning'
  return 'text-loss'
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 80) return 'Good'
  if (score >= 70) return 'Fair'
  if (score >= 60) return 'Needs Improvement'
  return 'Poor'
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}
