'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, BarChart3, Brain, Shield, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

const features = [
  {
    icon: BarChart3,
    title: 'Trade Journal',
    description: 'Log and analyze every trade with detailed metrics and insights',
  },
  {
    icon: Brain,
    title: 'Behavioral AI',
    description: 'Detect patterns like revenge trading, FOMO, and tilt before they cost you',
  },
  {
    icon: Shield,
    title: 'Discipline Rules',
    description: 'Set personal rules and get warned or blocked before breaking them',
  },
  {
    icon: TrendingUp,
    title: 'Performance Analytics',
    description: 'Track win rates, P&L curves, and identify your best setups',
  },
];

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (api.isAuthenticated()) {
      router.push('/dashboard');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <span className="text-sm font-bold text-primary-foreground">TW</span>
            </div>
            <span className="text-lg font-semibold">TradeWise AI</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Trade Smarter,
            <br />
            <span className="text-primary">Not Harder</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            AI-powered trading journal that helps you understand your behavior, 
            enforce discipline, and improve your win rate.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                Start Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">
                Sign in
              </Button>
            </Link>
          </div>
        </section>

        <section className="border-t border-border/50 bg-card/50">
          <div className="container mx-auto px-4 py-20">
            <h2 className="text-center text-2xl font-semibold">
              Everything you need to become a better trader
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-lg border border-border/50 bg-background p-6"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mt-4 font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-semibold">
            Stop losing money to emotional trading
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Most traders fail because of psychology, not strategy. 
            TradeWise AI helps you identify and fix behavioral patterns 
            that are costing you money.
          </p>
          <Link href="/register">
            <Button size="lg" className="mt-8 gap-2">
              Create Free Account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </section>
      </main>

      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>TradeWise AI - Your Intelligent Trading Assistant</p>
        </div>
      </footer>
    </div>
  );
}
